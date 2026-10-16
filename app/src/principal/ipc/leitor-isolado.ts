/**
 * Lança o processo leitor (`utilityProcess`) para um arquivo e espera a resposta. Um processo por abertura: nada do
 * arquivo anterior sobra para o seguinte. Qualquer falha (saída sem resposta, resposta fora do protocolo, tempo
 * esgotado) vira `RESPOSTA_FALHA_LEITOR`; nunca lança.
 */
import { utilityProcess } from 'electron';
import { lerRespostaLeitor, RESPOSTA_FALHA_LEITOR, type PedidoLeitor, type RespostaLeitor } from './protocolo-leitor';

/** Tempo máximo de uma leitura. O maior projeto medido (25 MB) abre em menos de 0,3 s (adendo do M1-T06). */
export const TEMPO_MAXIMO_LEITURA_MS = 60_000;

/**
 * Teto do heap do V8 no leitor (revisão do M1-T08, S8-01). O `documento.json` vai até 64 MB e vira objetos no heap;
 * as mídias ficam em `Uint8Array`, fora dele. Acima do teto o leitor morre, e o principal responde com erro.
 * [HIPÓTESE] valor a calibrar com o maior projeto medido.
 */
export const HEAP_MAXIMO_LEITOR_MB = 2048;

export function lerIsolado(
  entrada: string,
  pedido: PedidoLeitor,
  log: (mensagem: string) => void = (m) => console.warn(m),
): Promise<RespostaLeitor> {
  return new Promise((resolver) => {
    let terminado = false;
    const filho = utilityProcess.fork(entrada, [], {
      serviceName: 'BiblioDocs Pro — leitor de projeto',
      stdio: 'ignore',
      execArgv: [`--max-old-space-size=${HEAP_MAXIMO_LEITOR_MB}`],
    });
    const terminar = (resposta: RespostaLeitor, motivo?: string): void => {
      if (terminado) return;
      terminado = true;
      clearTimeout(relogio);
      if (motivo) log(`[leitor] ${motivo}`);
      filho.kill();
      resolver(resposta);
    };
    const relogio = setTimeout(() => terminar(RESPOSTA_FALHA_LEITOR, 'tempo esgotado'), TEMPO_MAXIMO_LEITURA_MS);

    filho.once('message', (mensagem: unknown) => {
      const resposta = lerRespostaLeitor(mensagem);
      terminar(resposta ?? RESPOSTA_FALHA_LEITOR, resposta ? undefined : 'resposta fora do protocolo');
    });
    filho.once('exit', (codigo) => terminar(RESPOSTA_FALHA_LEITOR, `saiu sem responder (código ${codigo})`));
    filho.once('spawn', () => filho.postMessage(pedido));
  });
}
