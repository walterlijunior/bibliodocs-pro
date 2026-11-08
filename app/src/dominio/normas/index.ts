/**
 * Módulo `dominio/normas` — motor normativo: Perfil + Documento -> DocumentoFormatado. Único módulo que lê regras RN-xxx.
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa modelo, numeracao, bibliografia e visuais (regra 2).
 * - Nenhuma outra camada conhece números de regra, medidas ou fontes tipográficas.
 *
 * Marcador criado no M1-T01; elementos por tipo de trabalho no M2-T02. O motor vem no M3.
 */
export {
  entraNoTrabalhoNovo,
  estruturaInicial,
  type ElementoTextualId,
  type EstruturaInicial,
  type EstruturaTipo,
  type PresencaElemento,
  type SecaoInicial,
  type Presenca,
} from './tipos-trabalho';
export type { AlvoRegra, ParametroPerfil, Perfil, PropriedadesFormatacao, RegraNormativa } from './perfil';
export {
  contarPalavras,
  pendenciasPreTextuais,
  type PendenciaPreTextual,
} from './pendencias-pre-textuais';
export { formatar, type AjustesProjeto, type DocumentoParaFormatar } from './motor';
export type {
  AvisoFormatacao,
  BlocoFormatado,
  BlocoTabelaFormatado,
  CelulaFormatada,
  DocumentoFormatado,
  EntradaSumario,
  PaginaResolvida,
  SecaoFormatada,
  EstiloResolvido,
  ItemDeLista,
  PropriedadesEstilo,
  TracosMoldura,
  TrechoFormatado,
} from './formatado';
