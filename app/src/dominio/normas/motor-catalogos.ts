/** Listas de cadastros (M6): ordenação e texto no motor; o exportador só traduz parágrafos e tabulações. */
import type { GrupoSiglas, Sigla, Simbolo, TermoGlossario } from '../modelo';
import type { BlocoFormatado } from './formatado';

/** R-M6-09: tabulação ou quebra num campo do cadastro desalinharia as duas colunas da lista; vira espaço. */
const umaLinha = (t: string): string => t.replace(/[\t\r\n]+/g, ' ');

export const compararPtBr =(a: string, b: string): number => a.localeCompare(b, 'pt-BR') || (a < b ? -1 : a > b ? 1 : 0);

/**
 * Lista de abreviaturas e siglas: relação alfabética (RN-165). Com `grupos` (a lista agrupada, D-E3-12), as siglas sem
 * grupo vêm primeiro e cada grupo segue, na ordem do autor, com o nome em negrito e as siglas em ordem alfabética.
 */
export function blocosListaSiglas(siglas: readonly Sigla[], usadas: ReadonlySet<string>, larguraTw: number, grupos?: readonly GrupoSiglas[]): BlocoFormatado[] {
  const itens = siglas.filter((s) => usadas.has(s.id)).sort((a, b) => compararPtBr(a.sigla, b.sigla));
  if (itens.length === 0) return [];
  const entrada = (s: Sigla): BlocoFormatado => ({ tipo: 'paragrafo', estilo: 'entradaLista', trechos: [{ tipo: 'texto', texto: `${umaLinha(s.sigla)}\t${umaLinha(s.extenso)}`, marcas: [] }], tabulacaoEsquerdaTw: Math.round(larguraTw / 3), origem: ['RN-165'] });
  const titulo: BlocoFormatado = { tipo: 'paragrafo', estilo: 'tituloSemIndicativo', trechos: [{ tipo: 'texto', texto: 'LISTA DE ABREVIATURAS E SIGLAS', marcas: [] }], novaPagina: true, origem: ['RN-007', 'RN-045', 'RN-166'] };
  if (!grupos || grupos.length === 0) return [titulo, ...itens.map(entrada)];
  const conhecidos = new Set(grupos.map((g) => g.id));
  const semGrupo = itens.filter((s) => s.grupo === undefined || !conhecidos.has(s.grupo));
  return [
    titulo,
    ...semGrupo.map(entrada),
    ...grupos.flatMap((g): BlocoFormatado[] => {
      const doGrupo = itens.filter((s) => s.grupo === g.id);
      return doGrupo.length === 0 ? [] : [{ tipo: 'paragrafo', estilo: 'entradaLista', trechos: [{ tipo: 'texto', texto: umaLinha(g.nome), marcas: ['negrito'] }], origem: ['D-E3-12'] }, ...doGrupo.map(entrada)];
    }),
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
    tipo: 'paragrafo', estilo: 'entradaGlossario', trechos: [{ tipo: 'texto', texto: `${umaLinha(s.termo)}: ${umaLinha(s.definicao)}`, marcas: [] }], origem: ['RN-230'],
  }));
}
