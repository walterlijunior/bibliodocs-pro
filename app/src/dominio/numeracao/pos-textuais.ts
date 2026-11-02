/**
 * Identificação de apêndices e anexos (M2-T09), derivada da posição e nunca gravada (ADR-0005, seção 3).
 *
 * - Palavra APÊNDICE ou ANEXO seguida de letra maiúscula consecutiva (RN-231, RN-234; Manual UFT, p. 65–66). Cada tipo
 *   conta as suas letras.
 * - Esgotado o alfabeto, "letras maiúsculas dobradas" (RN-232, RN-235). O Manual não exemplifica: o perfil UFT 2022 usa
 *   `AA, BB, CC`, o mesmo valor da decisão C-A6 para as alíneas, provisório até a fonte (P-03). Depois de `ZZ` a mesma
 *   regra triplica a letra [HIPÓTESE: o Manual não trata].
 * - O travessão e o título ("APÊNDICE A – Título") são forma: ficam com o motor normativo (M3).
 */
import type { ElementoPosTextual, Id } from '../modelo';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Letra na posição `indice` (base 0). Posição inválida é erro de programação. */
export function letraPosTextual(indice: number): string {
  if (!Number.isInteger(indice) || indice < 0) throw new RangeError(`posição de apêndice ou anexo inválida: ${indice}`);
  return ALFABETO[indice % ALFABETO.length]!.repeat(Math.floor(indice / ALFABETO.length) + 1);
}

/** Rótulo de cada apêndice e anexo da lista, por id ("APÊNDICE A", "ANEXO B"). Os outros elementos não têm rótulo. */
export function rotulosPosTextuais(lista: readonly ElementoPosTextual[]): Map<Id, string> {
  const rotulos = new Map<Id, string>();
  let apendices = 0;
  let anexos = 0;
  for (const e of lista) {
    if (e.tipo === 'apendice') rotulos.set(e.id, `APÊNDICE ${letraPosTextual(apendices++)}`);
    else if (e.tipo === 'anexo') rotulos.set(e.id, `ANEXO ${letraPosTextual(anexos++)}`);
  }
  return rotulos;
}
