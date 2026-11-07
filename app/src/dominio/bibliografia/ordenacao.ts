/**
 * Ordem da lista de referências e sufixos de mesmo autor e ano (M4-T02).
 *
 * - Alfabética pelo elemento de entrada (RN-176), com a ordem do português (Intl.Collator pt-BR, sem distinguir
 *   maiúsculas nem acentos no primeiro nível).
 * - Comparação autor a autor e, em cada autor, sobrenome antes dos prenomes: "SILVA, José" vem antes de
 *   "SILVA NETO, Roberto" (nada vem antes de algo), o que a comparação da linha inteira inverteria.
 * - Desempate: mesmo autor por ano e depois pelo título (PF-09 g; D-M4-05, provisório). Sem ano vai por último.
 * - Mesmo autor e mesmo ano: sufixo a, b, c… na ordem da lista (RN-096; D-M4-03, provisório).
 */
import type { Autor, Id, InlineDeTitulo, Obra } from '../modelo';
import { LOCALE } from './autores';

const colador = new Intl.Collator(LOCALE, { sensitivity: 'base', numeric: true });

/** Elemento de entrada como lista de partes comparáveis, em ordem de importância. */
function chaveDeEntrada(obra: Obra): string[] {
  if (obra.autores && obra.autores.length > 0) return obra.autores.flatMap(partesDoAutor);
  return [textoDe(obra.titulo)];
}

function partesDoAutor(a: Autor): string[] {
  return a.tipo === 'entidade' ? [a.nome.trim(), ''] : [a.sobrenome.trim(), a.prenomes?.trim() ?? ''];
}

function textoDe(inlines: readonly InlineDeTitulo[]): string {
  return inlines.map((i) => i.texto).join('').trim();
}

function compararListas(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const c = colador.compare(a[i]!, b[i]!);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

function mesmaEntrada(a: Obra, b: Obra): boolean {
  return compararListas(chaveDeEntrada(a), chaveDeEntrada(b)) === 0;
}

function compararAno(a: Obra, b: Obra): number {
  if (a.ano === b.ano) return 0;
  if (a.ano === undefined) return 1;
  if (b.ano === undefined) return -1;
  return a.ano - b.ano;
}

export function compararReferencias(a: Obra, b: Obra): number {
  return (
    compararListas(chaveDeEntrada(a), chaveDeEntrada(b)) ||
    compararAno(a, b) ||
    colador.compare(textoDe(a.titulo), textoDe(b.titulo)) ||
    // Estável e determinística mesmo com obras idênticas.
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Nova lista na ordem das referências; não altera a entrada. */
export function ordenarReferencias<T extends Obra>(obras: readonly T[]): T[] {
  return [...obras].sort(compararReferencias);
}

/**
 * Sufixo de cada obra com autoria que divide autor e ano com outra (D-M4-03): "a", "b", … na ordem da lista. Obras
 * sem autoria entram pelo título e não recebem sufixo; obras sem ano também não.
 */
export function sufixosDeAno(obras: readonly Obra[]): Map<Id, string> {
  const saida = new Map<Id, string>();
  const ordem = ordenarReferencias(obras.filter((o) => o.autores && o.autores.length > 0 && o.ano !== undefined));
  let i = 0;
  while (i < ordem.length) {
    let j = i + 1;
    while (j < ordem.length && ordem[j]!.ano === ordem[i]!.ano && mesmaEntrada(ordem[i]!, ordem[j]!)) j++;
    if (j - i > 1) for (let k = i; k < j; k++) saida.set(ordem[k]!.id, letra(k - i));
    i = j;
  }
  return saida;
}

/** a…z, depois aa, ab… (mais de 26 obras do mesmo autor no mesmo ano é improvável; o rótulo só não pode repetir). */
function letra(n: number): string {
  const base = 'abcdefghijklmnopqrstuvwxyz';
  return n < 26 ? base[n]! : letra(Math.floor(n / 26) - 1) + base[n % 26]!;
}
