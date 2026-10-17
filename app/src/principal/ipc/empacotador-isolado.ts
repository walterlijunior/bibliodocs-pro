/**
 * Cliente do empacotador (`../empacotador.ts`, um `worker_threads` de vida longa; M2-T01): `empacotar(pacote)` devolve
 * o mesmo resultado do `empacotarProjeto`, sem ocupar a thread do principal.
 *
 * - O worker nasce no primeiro pedido e atende um por vez (os pedidos esperam na ordem de chegada, dentro dele).
 * - Falha do worker (erro, saída, tempo esgotado) vira `ok: false` para os pedidos pendentes, com mensagem; o
 *   próximo pedido cria outro worker. Nunca lança.
 * - O `PacoteProjeto` vai como está (o clone estruturado do worker aceita `Map` e `Uint8Array`). As mídias guardadas
 *   no registro estão em `SharedArrayBuffer` e não são copiadas; só as que acabaram de chegar do renderer são (uma
 *   vez). Os bytes do `.bdp` voltam transferidos.
 *
 * O worker é criado por uma fábrica injetável: os testes usam um worker falso, sem build (tests/empacotador.test.ts).
 */
import { Worker } from 'node:worker_threads';
import type { PacoteProjeto, ResultadoEmpacotamento } from '../../persistencia';

/** Prazo de um pedido. O documento grande (150 páginas, 25 MiB) empacota em ~0,3 s (M2-T01). */
export const TEMPO_MAXIMO_EMPACOTAR_MS = 60_000;

export interface PedidoEmpacotador {
  n: number;
  pacote: PacoteProjeto;
}

export interface RespostaEmpacotador {
  n: number;
  resultado: ResultadoEmpacotamento;
}

export const RESULTADO_FALHA_EMPACOTADOR: ResultadoEmpacotamento = {
  ok: false,
  erros: [{ caminho: 'empacotamento', mensagem: 'o empacotamento do projeto falhou; nada foi gravado' }],
};

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Envelope do pedido (o conteúdo já foi validado pelo principal antes de chegar aqui). */
export function lerPedidoEmpacotador(v: unknown): PedidoEmpacotador | null {
  if (!ehObjeto(v) || !Number.isSafeInteger(v['n']) || !ehObjeto(v['pacote'])) return null;
  const p = v['pacote'];
  return p['midias'] instanceof Map && ehObjeto(p['manifesto']) && ehObjeto(p['documento']) ? (v as unknown as PedidoEmpacotador) : null;
}

/** Envelope da resposta; `null` se fora do protocolo. */
export function lerRespostaEmpacotador(v: unknown): RespostaEmpacotador | null {
  if (!ehObjeto(v) || !Number.isSafeInteger(v['n']) || !ehObjeto(v['resultado'])) return null;
  const r = v['resultado'];
  if (r['ok'] === true) return r['bytes'] instanceof Uint8Array ? (v as unknown as RespostaEmpacotador) : null;
  return r['ok'] === false && Array.isArray(r['erros']) ? (v as unknown as RespostaEmpacotador) : null;
}

/** O que o cliente usa de um `Worker` (o falso dos testes implementa só isto). */
export interface WorkerEmpacotador {
  postMessage(mensagem: PedidoEmpacotador): void;
  on(evento: 'message', ouvinte: (mensagem: unknown) => void): unknown;
  on(evento: 'error', ouvinte: (erro: Error) => void): unknown;
  on(evento: 'exit', ouvinte: (codigo: number) => void): unknown;
  terminate(): Promise<number>;
  unref(): void;
}

export interface OpcoesEmpacotador {
  criarWorker?: (entrada: string) => WorkerEmpacotador;
  tempoMaximoMs?: number;
  log?: (mensagem: string) => void;
}

export interface Empacotador {
  empacotar(pacote: PacoteProjeto): Promise<ResultadoEmpacotamento>;
  /** Encerra o worker (os pendentes recebem a falha). */
  encerrar(): Promise<void>;
}

export function criarEmpacotador(entrada: string, opcoes: OpcoesEmpacotador = {}): Empacotador {
  const criar = opcoes.criarWorker ?? ((e: string) => new Worker(e, { name: 'BiblioDocs Pro — empacotador' }) as WorkerEmpacotador);
  const tempoMaximo = opcoes.tempoMaximoMs ?? TEMPO_MAXIMO_EMPACOTAR_MS;
  const log = opcoes.log ?? ((m: string) => console.warn(m));
  type Pendente = { resolver: (r: ResultadoEmpacotamento) => void; relogio: ReturnType<typeof setTimeout> };
  let worker: WorkerEmpacotador | null = null;
  let contador = 0;
  const pendentes = new Map<number, Pendente>();

  const responder = (n: number, r: ResultadoEmpacotamento) => {
    const p = pendentes.get(n);
    if (p === undefined) return;
    pendentes.delete(n);
    clearTimeout(p.relogio);
    p.resolver(r);
  };
  /** O worker atual não serve mais: os pendentes falham e o próximo pedido cria outro. */
  const descartar = (w: WorkerEmpacotador, motivo: string) => {
    if (worker !== w) return;
    worker = null;
    log(`[empacotador] ${motivo}`);
    for (const n of [...pendentes.keys()]) responder(n, RESULTADO_FALHA_EMPACOTADOR);
    void w.terminate().catch(() => undefined);
  };

  const obterWorker = (): WorkerEmpacotador => {
    if (worker !== null) return worker;
    const w = criar(entrada);
    // Não segura o app aberto: ao sair, o processo acaba com ele.
    w.unref();
    w.on('message', (m: unknown) => {
      const r = lerRespostaEmpacotador(m);
      if (r === null) descartar(w, 'resposta fora do protocolo');
      else responder(r.n, r.resultado);
    });
    w.on('error', (e: Error) => descartar(w, `erro: ${e.name}`));
    w.on('exit', (codigo: number) => descartar(w, `saiu (código ${codigo})`));
    worker = w;
    return w;
  };

  return {
    empacotar(pacote) {
      return new Promise((resolver) => {
        const n = ++contador;
        const w = obterWorker();
        const relogio = setTimeout(() => descartar(w, 'tempo esgotado'), tempoMaximo);
        pendentes.set(n, { resolver, relogio });
        try {
          w.postMessage({ n, pacote });
        } catch {
          descartar(w, 'pedido não enviado');
        }
      });
    },
    async encerrar() {
      if (worker !== null) descartar(worker, 'encerrado');
    },
  };
}
