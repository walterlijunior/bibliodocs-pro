/**
 * Módulo `dominio/modelo` — Documento, Secao, Bloco, Inline, ids e operações de árvore (modelo semântico, sem formatação).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Base do domínio: não importa nenhum outro submódulo (regra 2).
 * - Sem números armazenados e sem HTML.
 *
 * Tipos mínimos do formato v1 criados no M1-T04; operações de árvore vêm no M2.
 */
export type {
  Bloco,
  BlocoParagrafo,
  BlocoQuebraPagina,
  Documento,
  Id,
  Inline,
  InlineTexto,
  MarcaTexto,
  Metadados,
  Secao,
  TipoTrabalhoId,
} from './tipos';
export { textoPlano } from './texto-plano';
