/**
 * Processo exportador (`utilityProcess`, M3-T05): gera o DOCX fora do principal, para não travar a interface. Um pedido
 * por processo; quem o encerra é o principal, depois da resposta. Entrada própria do build.
 */
import { exportarDocx } from '../exportacao/docx';
import { lerPedidoExportacao, RESPOSTA_FALHA_EXPORTACAO, type RespostaExportacao } from './ipc/protocolo-exportacao';

process.parentPort.once('message', (evento) => {
  const pedido = lerPedidoExportacao(evento.data);
  const resposta: Promise<RespostaExportacao> = pedido
    ? exportarDocx(pedido.formatado).then((bytes) => ({ ok: true as const, bytes }), () => RESPOSTA_FALHA_EXPORTACAO)
    : Promise.resolve(RESPOSTA_FALHA_EXPORTACAO);
  void resposta.then((r) => process.parentPort.postMessage(r));
});
