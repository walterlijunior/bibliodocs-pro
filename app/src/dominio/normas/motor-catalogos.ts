/** Listas de cadastros (M6): ordenação e texto no motor; o exportador só traduz parágrafos e tabulações. */
import type { Sigla, Simbolo, TermoGlossario } from '../modelo';
import type { BlocoFormatado } from './formatado';

/** R-M6-09: tabulação ou quebra num campo do cadastro desalinharia as duas colunas da lista; vira espaço. */
const umaLinha = (t: string): string => t.replace(/[\t\r\n]+/g, ' ');

export const compararPtBr =(a: string, b: string): number => a.localeCompare(b, 'pt-BR') || (a < b ? -1 : a > b ? 1 : 0);

export function blocosListaSiglas(siglas: readonly Sigla[], usadas: ReadonlySet<string>, larguraTw: number): BlocoFormatado[] {
  const itens = siglas.filter((s) => usadas.has(s.id)).sort((a, b) => compararPtBr(a.sigla, b.sigla));
  if (itens.length === 0) return [];
  return [
    { tipo: 'paragrafo', estilo: 'tituloSemIndicativo', trechos: [{ tipo: 'texto', texto: 'LISTA DE ABREVIATURAS E SIGLAS', marcas: [] }], novaPagina: true, origem: ['RN-007', 'RN-045', 'RN-166'] },
    ...itens.map((s): BlocoFormatado => ({ tipo: 'paragrafo', estilo: 'entradaLista', trechos: [{ tipo: 'texto', texto: `${umaLinha(s.sigla)}\t${umaLinha(s.extenso)}`, marcas: [] }], tabulacaoEsquerdaTw: Math.round(larguraTw / 3), origem: ['RN-165'] })),
  ];
}

/** Ordenação por significado do exemplo do Manual, p. 45 (D-M6-05, critério provisório). */
export function blocosListaSimbolos(simbolos: readonly Simbolo[], larguraTw: number): BlocoFormatado[] {
  if (simbolos.length === 0) return [];
  return [
    { tipo: 'paragrafo', estilo: 'tituloSemIndicativo', trechos: [{ tipo: 'texto', texto: 'LISTA DE SÍMBOLOS', marcas: [] }], novaPagina: true, origem: ['RN-007', 'RN-045', 'RN-167'] },
    ...[...simbolos].sort((a, b) => compararPtBr(a.significado, b.significado) || compararPtBr(a.simbolo, b.simbolo)).map((s): BlocoFormatado => ({
      tipo: 'paragrafo', estilo: 'entradaLista', trechos: [{ tipo: 'texto', texto: `${umaLinha(s.simbolo)}\t${umaLinha(s.significado)}`, marcas: [] }], tabulacaoEsquerdaTw: Math.round(larguraTw / 3), origem: ['RN-167'],
    })),
  ];
}

/** A forma "Termo: definição" é a do exemplo da p. 64, escolhida provisoriamente em D-M6-06 (PF-10). */
export function blocosGlossario(termos: readonly TermoGlossario[]): BlocoFormatado[] {
  return [...termos].sort((a, b) => compararPtBr(a.termo, b.termo)).map((s): BlocoFormatado => ({
    tipo: 'paragrafo', estilo: 'corpo', trechos: [{ tipo: 'texto', texto: `${umaLinha(s.termo)}: ${umaLinha(s.definicao)}`, marcas: [] }], origem: ['RN-230'],
  }));
}
