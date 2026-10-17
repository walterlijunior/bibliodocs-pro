/**
 * Módulo `dominio/modelo` — Documento, Secao, Bloco, Inline, ids e operações de árvore (modelo semântico, sem formatação).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Base do domínio: não importa nenhum outro submódulo (regra 2).
 * - Sem números armazenados e sem HTML.
 *
 * Tipos mínimos do formato v1 criados no M1-T04; operações estruturais da árvore de seções no M2-T03; alíneas, citação
 * longa e nota de rodapé no M2-T04.
 */
export type {
  Bloco,
  BlocoAlineas,
  BlocoCitacaoLonga,
  BlocoParagrafo,
  BlocoQuebraPagina,
  Documento,
  Id,
  Inline,
  InlineDeNota,
  InlineDeTitulo,
  InlineNota,
  InlineTexto,
  ItemAlinea,
  MarcaTexto,
  Metadados,
  Secao,
  TipoTrabalhoId,
} from './tipos';
export { conteudosDoBloco, idsDoBloco } from './percorrer';
export { textoPlano } from './texto-plano';
export {
  alturaSecao,
  aplicarOperacaoSecao,
  inserirSecao,
  localizarSecao,
  MAXIMO_SECOES_POR_NIVEL,
  MENSAGENS_RECUSA_SECAO,
  moverJuntoDe,
  moverParaBaixo,
  moverParaCima,
  moverSecao,
  NIVEL_MAXIMO_SECAO,
  promoverSecao,
  recuarSecao,
  removerSecao,
} from './operacoes';
export type {
  CodigoRecusaSecao,
  DestinoSecao,
  InversoSecao,
  LocalSecao,
  OperacaoSecao,
  RebaixarSecao,
  ResultadoOperacaoSecao,
} from './operacoes';
