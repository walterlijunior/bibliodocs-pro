/**
 * Módulo `dominio/modelo` — Documento, Secao, Bloco, Inline, ids e operações de árvore (modelo semântico, sem formatação).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Base do domínio: não importa nenhum outro submódulo (regra 2).
 * - Sem números armazenados e sem HTML.
 *
 * Tipos mínimos do formato v1 criados no M1-T04; operações estruturais da árvore de seções no M2-T03; alíneas, citação
 * longa e nota de rodapé no M2-T04; tipos de trabalho UFT e lugares dos elementos pré e pós-textuais no M2-T02.
 */
export type {
  AlinhamentoColuna,
  Bloco,
  BlocoAlineas,
  BlocoCitacaoLonga,
  BlocoEquacao,
  BlocoGrafico,
  FormaGrafico,
  BlocoIlustracao,
  BlocoParagrafo,
  BlocoQuebraPagina,
  BlocoTabela,
  CelulaTabela,
  ColunaTabela,
  EspecieIlustracao,
  Autor,
  Documento,
  EventoObra,
  FuncaoResponsavel,
  ElementoPosTextual,
  ElementoPosTextualId,
  ElementoPreTextual,
  ElementoPreTextualId,
  Id,
  IdiomaResumo,
  Inline,
  InlineCitacao,
  InlineRemissiva,
  InlineDeNota,
  InlineDeTitulo,
  InlineNota,
  InlineTexto,
  ItemAlinea,
  MarcaTexto,
  MembroBanca,
  Metadados,
  Obra,
  ObraCitada,
  ObraNoTodo,
  PessoaTitulada,
  Secao,
  TipoObra,
  TipoTrabalhoId,
  TipoTrabalhoUft,
} from './tipos';
export {
  ehTipoTrabalhoUft,
  incluirPosTextual,
  retirarPosTextual,
  ELEMENTOS_REPETIVEIS,
  MAXIMO_REPETICOES_ELEMENTO,
  ORDEM_POS_TEXTUAIS,
  ORDEM_PRE_TEXTUAIS,
  problemaNosElementos,
  TIPOS_TRABALHO,
  TIPOS_TRABALHO_UFT,
  type ProblemaElementos,
} from './elementos';
export { conteudosDoBloco, idsDoBloco } from './percorrer';
export { ESPECIES_ILUSTRACAO, problemaNaGrade, type MotivoGrade, type ProblemaGrade } from './visuais';
export { citacoesDoDocumento, FUNCOES_RESPONSAVEL, TIPOS_OBRA } from './obras';
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
