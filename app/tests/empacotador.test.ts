// M2-T01 — cliente do empacotador (worker de vida longa que tira o `empacotarProjeto` da thread do principal). Worker
// falso, sem build: o worker real é exercitado nos E2E (todo salvar e instantâneo passa por ele).
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { criarTrabalhoVazio } from '../src/aplicacao';
import type { PacoteProjeto, ResultadoEmpacotamento } from '../src/persistencia';
import {
  criarEmpacotador,
  lerPedidoEmpacotador,
  lerRespostaEmpacotador,
  RESULTADO_FALHA_EMPACOTADOR,
  type PedidoEmpacotador,
  type WorkerEmpacotador,
} from '../src/principal/ipc/empacotador-isolado';

const t = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-10-17T10:00:00.000Z', appVersao: '0.1.0' });
const PACOTE: PacoteProjeto = { ...t, midias: new Map() };
const OK = (n: number): ResultadoEmpacotamento => ({ ok: true, bytes: new Uint8Array([n]) });

class WorkerFalso extends EventEmitter implements WorkerEmpacotador {
  readonly pedidos: PedidoEmpacotador[] = [];
  terminado = false;
  desligado = false;
  postMessage(m: PedidoEmpacotador): void {
    this.pedidos.push(m);
  }
  async terminate(): Promise<number> {
    this.terminado = true;
    return 0;
  }
  unref(): void {
    this.desligado = true;
  }
  responder(n: number, resultado: unknown = OK(n)): void {
    this.emit('message', { n, resultado });
  }
}

function montar(tempoMaximoMs = 60_000) {
  const workers: WorkerFalso[] = [];
  const logs: string[] = [];
  const e = criarEmpacotador('empacotador.js', {
    criarWorker: () => {
      const w = new WorkerFalso();
      workers.push(w);
      return w;
    },
    tempoMaximoMs,
    log: (m) => logs.push(m),
  });
  return { e, workers, logs };
}

describe('cliente do empacotador', () => {
  it('um worker para todos os pedidos, criado no primeiro e sem segurar o app aberto; cada resposta vai ao seu pedido', async () => {
    const { e, workers } = montar();
    const a = e.empacotar(PACOTE);
    const b = e.empacotar(PACOTE);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.desligado).toBe(true);
    const [p1, p2] = workers[0]!.pedidos;
    expect(p1!.pacote).toBe(PACOTE);
    workers[0]!.responder(p2!.n);
    workers[0]!.responder(p1!.n);
    expect(await a).toEqual(OK(p1!.n));
    expect(await b).toEqual(OK(p2!.n));
  });

  it('erro ou saída do worker: os pendentes falham com mensagem, e o próximo pedido cria outro worker', async () => {
    const { e, workers, logs } = montar();
    const a = e.empacotar(PACOTE);
    workers[0]!.emit('error', new Error('caiu'));
    expect(await a).toEqual(RESULTADO_FALHA_EMPACOTADOR);
    expect(workers[0]!.terminado).toBe(true);

    const b = e.empacotar(PACOTE);
    expect(workers).toHaveLength(2);
    workers[1]!.emit('exit', 1);
    expect(await b).toEqual(RESULTADO_FALHA_EMPACOTADOR);
    // Eventos do worker antigo não afetam o novo.
    const c = e.empacotar(PACOTE);
    workers[1]!.emit('error', new Error('tarde'));
    workers[2]!.responder(workers[2]!.pedidos[0]!.n);
    expect((await c).ok).toBe(true);
    expect(logs.join('\n')).toMatch(/erro: Error/);
  });

  it('resposta fora do protocolo ou tempo esgotado descartam o worker', async () => {
    const { e, workers } = montar(20);
    const a = e.empacotar(PACOTE);
    workers[0]!.emit('message', { n: 1, resultado: { ok: true, bytes: [1] } });
    expect(await a).toEqual(RESULTADO_FALHA_EMPACOTADOR);
    const b = e.empacotar(PACOTE); // ninguém responde
    expect(await b).toEqual(RESULTADO_FALHA_EMPACOTADOR);
    expect(workers[1]!.terminado).toBe(true);
  });

  it('encerrar falha os pendentes e termina o worker', async () => {
    const { e, workers } = montar();
    const a = e.empacotar(PACOTE);
    await e.encerrar();
    expect(await a).toEqual(RESULTADO_FALHA_EMPACOTADOR);
    expect(workers[0]!.terminado).toBe(true);
  });
});

describe('protocolo do empacotador', () => {
  it('pedido: número e pacote com mídias em Map', () => {
    expect(lerPedidoEmpacotador({ n: 1, pacote: PACOTE })).not.toBeNull();
    expect(lerPedidoEmpacotador({ n: 1, pacote: { ...PACOTE, midias: [] } })).toBeNull();
    expect(lerPedidoEmpacotador({ n: 1.5, pacote: PACOTE })).toBeNull();
    expect(lerPedidoEmpacotador(null)).toBeNull();
  });

  it('resposta: bytes em Uint8Array ou lista de erros', () => {
    expect(lerRespostaEmpacotador({ n: 1, resultado: OK(1) })).not.toBeNull();
    expect(lerRespostaEmpacotador({ n: 1, resultado: RESULTADO_FALHA_EMPACOTADOR })).not.toBeNull();
    expect(lerRespostaEmpacotador({ n: 1, resultado: { ok: true } })).toBeNull();
    expect(lerRespostaEmpacotador({ n: 1, resultado: { ok: false } })).toBeNull();
    expect(lerRespostaEmpacotador({ resultado: OK(1) })).toBeNull();
  });
});
