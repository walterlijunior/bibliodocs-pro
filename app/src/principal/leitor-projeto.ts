/**
 * Processo leitor (`utilityProcess`): abre um `.bdp` escolhido pelo usuário fora do processo principal (pendência da
 * revisão do M1-T05; protocolo em `ipc/protocolo-leitor.ts`) ou resume um lote de arquivos da biblioteca (M1-T09).
 * Um pedido por processo: recebe, lê e responde. Quem encerra é o principal, depois de receber a resposta: sair aqui
 * logo após o `postMessage` arriscaria o `exit` chegar antes da mensagem (revisão do M1-T08, S8-02).
 * Entrada própria do build (`out/principal/leitor-projeto.js`).
 */
import { abrirProjeto, resumirProjeto, type ResumoProjeto } from '../persistencia';
import {
  lerPedidoLeitor,
  lerPedidoResumo,
  paraRespostaLeitor,
  RESPOSTA_FALHA_LEITOR,
  type RespostaLeitor,
  type RespostaResumo,
} from './ipc/protocolo-leitor';

async function resumirTodos(caminhos: string[]): Promise<RespostaResumo> {
  const resumos: ResumoProjeto[] = [];
  // Um por vez: o pico de memória é o de um arquivo, não o do lote.
  for (const caminho of caminhos) resumos.push(await resumirProjeto(caminho));
  return { resumos };
}

process.parentPort.once('message', (evento) => {
  const pedido = lerPedidoLeitor(evento.data);
  const resumo = pedido ? null : lerPedidoResumo(evento.data);
  let resposta: Promise<RespostaLeitor | RespostaResumo>;
  if (pedido) resposta = abrirProjeto(pedido.caminho, { pastaBackups: pedido.pastaBackups }).then(paraRespostaLeitor);
  else if (resumo) resposta = resumirTodos(resumo.resumir);
  else resposta = Promise.resolve(RESPOSTA_FALHA_LEITOR);
  void resposta
    .catch(() => RESPOSTA_FALHA_LEITOR)
    .then((r) => process.parentPort.postMessage(r));
});
