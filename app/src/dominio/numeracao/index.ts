/**
 * Módulo `dominio/numeracao` — numeração derivada de seções, ilustrações, tabelas, notas e remissivas.
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa só dominio/modelo (regra 2).
 *
 * Seções no M2-T03; rótulo das alíneas no M2-T04; ilustrações, tabelas, notas e remissivas nos marcos seguintes.
 */
export { rotuloAlinea } from './alineas';
export { letraPosTextual, rotulosPosTextuais } from './pos-textuais';
export { indicativoSecao, mapaIndicativos, numerarSecoes } from './secoes';
export type { SecaoNumerada } from './secoes';
