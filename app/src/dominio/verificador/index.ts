/**
 * Módulo `dominio/verificador` — Documento + Perfil (+ DocumentoFormatado) -> NaoConformidade[].
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Pode importar os demais submódulos do domínio; ninguém importa verificador (regra 2).
 *
 * M4-T08: verificador da bibliografia (citações × referências, consistência das obras). O verificador completo de
 * conformidade é do M7.
 */
export {
  chamadasEscritas,
  verificarBibliografia,
  type CodigoProblemaBibliografia,
  type LocalProblema,
  type OpcoesVerificacao,
  type ProblemaBibliografia,
} from './bibliografia';
