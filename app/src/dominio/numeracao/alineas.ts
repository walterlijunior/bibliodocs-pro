/**
 * Rótulo das alíneas (M2-T04), derivado da posição e nunca gravado (ADR-0005, seção 3).
 *
 * - Letra minúscula seguida de parêntese: "a)", "b)" (RN-023; Manual UFT, p. 16, seção 2.5).
 * - Esgotado o alfabeto, "letras dobradas" (RN-025, AMBÍGUA). Valor do perfil UFT 2022 decidido em C-A6
 *   (2026-10-17, delegado pelo usuário): `aa), bb), cc)`, provisório até a fonte (P-03, NBR 6024:2012). Depois de
 *   `zz)` a mesma regra triplica a letra (`aaa)`) [HIPÓTESE: o Manual não trata; nenhum trabalho real chega a 53].
 * - A marca das subalíneas (travessão ou hífen, RN-026) é forma, não numeração: fica com o motor normativo (C-A5).
 */

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz';

/** Rótulo da alínea na posição `indice` (base 0) da lista. Posição inválida é erro de programação. */
export function rotuloAlinea(indice: number): string {
  if (!Number.isInteger(indice) || indice < 0) throw new RangeError(`posição de alínea inválida: ${indice}`);
  const letra = ALFABETO[indice % ALFABETO.length]!;
  return `${letra.repeat(Math.floor(indice / ALFABETO.length) + 1)})`;
}
