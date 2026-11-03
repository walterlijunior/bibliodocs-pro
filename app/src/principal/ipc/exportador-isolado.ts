/**
 * Lança o processo exportador para um pedido e espera a resposta (M3-T05). Nunca lança: saída sem resposta, mensagem fora
 * do protocolo ou tempo esgotado viram falha. O motivo vai ao log sem nada do trabalho.
 */
import { utilityProcess } from 'electron';
import type { DocumentoFormatado } from '../../dominio/normas/formatado';
import { lerRespostaExportacao, RESPOSTA_FALHA_EXPORTACAO, type PedidoExportacao, type RespostaExportacao } from './protocolo-exportacao';

/** O documento de 150 páginas leva cerca de 4 s (M3-T01); a margem cobre máquina lenta e arquivo com muitas mídias. */
export const TEMPO_MAXIMO_EXPORTACAO_MS = 180_000;

export function exportarIsolado(entrada: string, formatado: DocumentoFormatado, log: (m: string) => void = (m) => console.warn(m)): Promise<RespostaExportacao> {
  return new Promise((resolver) => {
    let terminado = false;
    const filho = utilityProcess.fork(entrada, [], { serviceName: 'BiblioDocs Pro — exportador DOCX', stdio: 'ignore' });
    const terminar = (resposta: RespostaExportacao, motivo?: string): void => {
      if (terminado) return;
      terminado = true;
      clearTimeout(relogio);
      if (motivo) log(`[exportador] ${motivo}`);
      filho.kill();
      resolver(resposta);
    };
    const relogio = setTimeout(() => terminar(RESPOSTA_FALHA_EXPORTACAO, 'tempo esgotado'), TEMPO_MAXIMO_EXPORTACAO_MS);
    filho.once('message', (m: unknown) => {
      const r = lerRespostaExportacao(m);
      terminar(r ?? RESPOSTA_FALHA_EXPORTACAO, r !== null ? undefined : 'resposta fora do protocolo');
    });
    filho.once('exit', (codigo) => terminar(RESPOSTA_FALHA_EXPORTACAO, `saiu sem responder (código ${codigo})`));
    const pedido: PedidoExportacao = { formatado };
    filho.once('spawn', () => filho.postMessage(pedido));
  });
}
