/**
 * Coleções da Biblioteca além de Trabalhos (F-E6-01): Referências, Figuras e Tabelas e Siglas juntam o conteúdo de todos
 * os trabalhos da pasta (o resumo que o índice guarda de cada `.bdp`), com o trabalho de onde cada entrada vem. Funções
 * puras: a tela só mostra.
 */
import type { IdentificadorItem, ItemBiblioteca } from '../../aplicacao';
import { normalizarBusca, tituloExibido } from './selecao';

export type ColecaoConteudo = 'referencias' | 'visuais' | 'siglas';

/** Uma linha da coleção: o texto principal, o complemento e os trabalhos em que aparece. */
export interface EntradaColecao {
  chave: string;
  texto: string;
  /** Rótulo do elemento visual ("Tabela 3") ou forma por extenso da sigla. */
  complemento: string | null;
  trabalhos: readonly { id: IdentificadorItem; titulo: string }[];
}

const COLADOR = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * Entradas da coleção nos itens dados (já filtrados pela barra lateral). Referências e siglas iguais em trabalhos
 * diferentes viram uma entrada só, com todos os trabalhos; elementos visuais ficam um por trabalho, na ordem dele.
 */
export function entradasDaColecao(itens: readonly ItemBiblioteca[], colecao: ColecaoConteudo, busca = ''): EntradaColecao[] {
  const termo = normalizarBusca(busca);
  const porChave = new Map<string, { texto: string; complemento: string | null; trabalhos: { id: IdentificadorItem; titulo: string }[] }>();
  const ordenados = [...itens].sort((a, b) => COLADOR.compare(tituloExibido(a), tituloExibido(b)));
  for (const item of ordenados) {
    const c = item.conteudo;
    if (c === null) continue;
    const trabalho = { id: item.identificador, titulo: tituloExibido(item) };
    const linhas: { chave: string; texto: string; complemento: string | null }[] =
      colecao === 'referencias'
        ? c.referencias.map((r) => ({ chave: `r:${normalizarBusca(r)}`, texto: r, complemento: null }))
        : colecao === 'siglas'
          ? c.siglas.map((s) => ({ chave: `s:${normalizarBusca(s.sigla)}|${normalizarBusca(s.extenso)}`, texto: s.sigla, complemento: s.extenso }))
          : c.visuais.map((v, i) => ({ chave: `v:${item.identificador}:${i}`, texto: v.descricao, complemento: v.rotulo }));
    for (const l of linhas) {
      const existente = porChave.get(l.chave);
      if (existente) {
        if (!existente.trabalhos.some((t) => t.id === trabalho.id)) existente.trabalhos.push(trabalho);
      } else {
        porChave.set(l.chave, { texto: l.texto, complemento: l.complemento, trabalhos: [trabalho] });
      }
    }
  }
  let entradas = [...porChave].map(([chave, e]) => ({ chave, ...e }));
  if (termo !== '') {
    entradas = entradas.filter((e) =>
      [e.texto, e.complemento ?? '', ...e.trabalhos.map((t) => t.titulo)].some((x) => normalizarBusca(x).includes(termo)),
    );
  }
  // Elementos visuais seguem a ordem dos trabalhos e a do documento; referências e siglas, a alfabética.
  if (colecao !== 'visuais') entradas.sort((a, b) => COLADOR.compare(a.texto, b.texto) || COLADOR.compare(a.complemento ?? '', b.complemento ?? ''));
  return entradas;
}

export const NOMES_COLECAO: Readonly<Record<ColecaoConteudo, { titulo: string; vazio: string; singular: string; plural: string }>> = {
  referencias: {
    titulo: 'Referências',
    vazio: 'Nenhuma referência nos trabalhos desta seleção. As obras cadastradas na aba Referências de cada trabalho aparecem aqui.',
    singular: 'referência',
    plural: 'referências',
  },
  visuais: {
    titulo: 'Figuras e Tabelas',
    vazio: 'Nenhuma tabela, quadro, figura ou gráfico nos trabalhos desta seleção.',
    singular: 'elemento',
    plural: 'elementos',
  },
  siglas: {
    titulo: 'Siglas',
    vazio: 'Nenhuma sigla cadastrada nos trabalhos desta seleção. Cadastre em Siglas, símbolos e glossário…, na aba Elementos.',
    singular: 'sigla',
    plural: 'siglas',
  },
};
