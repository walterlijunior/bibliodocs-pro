/**
 * Processo leitor (`utilityProcess`): abre um `.bdp` escolhido pelo usuário fora do processo principal (pendência da
 * revisão do M1-T05; protocolo em `ipc/protocolo-leitor.ts`). Um pedido por processo: recebe, lê e responde. Quem
 * encerra é o principal, depois de receber a resposta: sair aqui logo após o `postMessage` arriscaria o `exit` chegar
 * antes da mensagem (revisão do M1-T08, S8-02).
 * Entrada própria do build (`out/principal/leitor-projeto.js`).
 */
import { abrirProjeto } from '../persistencia';
import { lerPedidoLeitor, paraRespostaLeitor, RESPOSTA_FALHA_LEITOR } from './ipc/protocolo-leitor';

process.parentPort.once('message', (evento) => {
  const pedido = lerPedidoLeitor(evento.data);
  const resposta = pedido
    ? abrirProjeto(pedido.caminho, { pastaBackups: pedido.pastaBackups }).then(paraRespostaLeitor)
    : Promise.resolve(RESPOSTA_FALHA_LEITOR);
  void resposta
    .catch(() => RESPOSTA_FALHA_LEITOR)
    .then((r) => process.parentPort.postMessage(r));
});
