/**
 * Empacotador (`worker_threads`, M2-T01; R-M1-01, R36): roda o `empacotarProjeto` (validação, SHA-256 das mídias, ZIP e
 * releitura) fora da thread do processo principal. No Electron, o JS do principal roda na thread que encaminha o
 * teclado ao renderer: os ~250 ms de empacotar o documento grande travavam a digitação a cada instantâneo.
 *
 * Diferente do leitor (`utilityProcess`, um processo por pedido): não há arquivo de fora a abrir. O conteúdo vem do
 * renderer (não confiável) com a forma e os esquemas já conferidos no principal; sha256, tamanho e tipo das mídias e a
 * coerência são conferidos aqui, no `empacotarProjeto`, como antes. O que importa é não ocupar o principal. Um
 * worker de vida longa, um pedido por vez, e os bytes do `.bdp` voltam por transferência (sem cópia). Protocolo em `ipc/empacotador-isolado.ts`.
 * Entrada própria do build (`out/principal/empacotador.js`).
 */
import { parentPort } from 'node:worker_threads';
import { empacotarProjeto } from '../persistencia';
import { lerPedidoEmpacotador, RESULTADO_FALHA_EMPACOTADOR, type RespostaEmpacotador } from './ipc/empacotador-isolado';

const porta = parentPort;
if (porta === null) throw new Error('empacotador: rodar só como worker');

porta.on('message', (mensagem: unknown) => {
  const pedido = lerPedidoEmpacotador(mensagem);
  if (pedido === null) return; // fora do protocolo: o principal espera até o tempo esgotar
  let resposta: RespostaEmpacotador;
  try {
    resposta = { n: pedido.n, resultado: empacotarProjeto(pedido.pacote) };
  } catch {
    resposta = { n: pedido.n, resultado: RESULTADO_FALHA_EMPACOTADOR };
  }
  const r = resposta.resultado;
  // O ZIP do fflate é um buffer só dele; transferir evita copiar dezenas de MB de volta ao principal.
  const transferir = r.ok && r.bytes.byteOffset === 0 && r.bytes.byteLength === r.bytes.buffer.byteLength ? [r.bytes.buffer as ArrayBuffer] : [];
  porta.postMessage(resposta, transferir);
});
