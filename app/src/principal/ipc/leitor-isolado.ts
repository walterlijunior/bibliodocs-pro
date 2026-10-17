/**
 * Lança o processo leitor (`utilityProcess`) para um pedido e espera a resposta. Um processo por pedido: nada do
 * arquivo anterior sobra para o seguinte. Qualquer falha (saída sem resposta, resposta fora do protocolo, tempo
 * esgotado) vira a resposta de falha do pedido; nunca lança.
 */
import { utilityProcess } from 'electron';
import type { ResumoProjeto } from '../../persistencia';
import {
  lerRespostaLeitor,
  lerRespostaResumo,
  RESPOSTA_FALHA_LEITOR,
  type PedidoLeitor,
  type PedidoResumo,
  type RespostaLeitor,
} from './protocolo-leitor';

/**
 * Tempo máximo de um pedido. O maior projeto medido (25 MB) abre em menos de 0,3 s (adendo do M1-T06); um lote de
 * resumos (até 50 arquivos, M1-T09) usa o mesmo prazo.
 */
export const TEMPO_MAXIMO_LEITURA_MS = 60_000;

/**
 * Teto do heap do V8 no leitor (revisão do M1-T08, S8-01). O `documento.json` vai até 64 MB e vira objetos no heap;
 * as mídias ficam em `Uint8Array`, fora dele. Acima do teto o leitor morre, e o principal responde com erro.
 * [HIPÓTESE] valor a calibrar com o maior projeto medido.
 */
export const HEAP_MAXIMO_LEITOR_MB = 2048;

type Log = (mensagem: string) => void;

function consultarLeitor<T>(entrada: string, pedido: unknown, validar: (mensagem: unknown) => T | null, falha: T, log: Log): Promise<T> {
  return new Promise((resolver) => {
    let terminado = false;
    const filho = utilityProcess.fork(entrada, [], {
      serviceName: 'BiblioDocs Pro — leitor de projeto',
      stdio: 'ignore',
      execArgv: [`--max-old-space-size=${HEAP_MAXIMO_LEITOR_MB}`],
    });
    const terminar = (resposta: T, motivo?: string): void => {
      if (terminado) return;
      terminado = true;
      clearTimeout(relogio);
      if (motivo) log(`[leitor] ${motivo}`);
      filho.kill();
      resolver(resposta);
    };
    const relogio = setTimeout(() => terminar(falha, 'tempo esgotado'), TEMPO_MAXIMO_LEITURA_MS);

    filho.once('message', (mensagem: unknown) => {
      const resposta = validar(mensagem);
      terminar(resposta ?? falha, resposta !== null ? undefined : 'resposta fora do protocolo');
    });
    filho.once('exit', (codigo) => terminar(falha, `saiu sem responder (código ${codigo})`));
    filho.once('spawn', () => filho.postMessage(pedido));
  });
}

export function lerIsolado(entrada: string, pedido: PedidoLeitor, log: Log = (m) => console.warn(m)): Promise<RespostaLeitor> {
  return consultarLeitor(entrada, pedido, lerRespostaLeitor, RESPOSTA_FALHA_LEITOR, log);
}

/** Resumo de um lote de arquivos da biblioteca; `null` se o leitor falhou (o lote é tentado de novo depois). */
export function resumirIsolado(entrada: string, caminhos: string[], log: Log = (m) => console.warn(m)): Promise<ResumoProjeto[] | null> {
  const pedido: PedidoResumo = { resumir: caminhos };
  return consultarLeitor<ResumoProjeto[] | null>(entrada, pedido, (m) => lerRespostaResumo(m, caminhos.length), null, log);
}
