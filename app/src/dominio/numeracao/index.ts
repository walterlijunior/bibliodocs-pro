/**
 * Módulo `dominio/numeracao` — numeração derivada de seções, ilustrações, tabelas, notas e remissivas.
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa só dominio/modelo (regra 2).
 *
 * Seções no M2-T03; rótulo das alíneas no M2-T04; tabelas, quadros, ilustrações e equações no M5-T02; notas e
 * remissivas nos marcos seguintes.
 */
export { rotuloAlinea } from './alineas';
export { mapaNumerosElementos, numerarElementos, rotuloEquacao } from './elementos';
export type { ElementoNumerado, EquacaoNumerada, NumeracaoElementos, SequenciaElemento } from './elementos';
export { letraPosTextual, letraSemFonte, rotulosPosTextuais } from './pos-textuais';
export { indicativoSecao, mapaIndicativos, numerarSecoes } from './secoes';
export type { SecaoNumerada } from './secoes';
