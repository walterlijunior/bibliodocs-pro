/**
 * Visão geral do painel de conformidade (Etapa 6 da especificação de atualização, D-E6-05). Puro.
 *
 * Para cada categoria, três números com nome claro (a captura mostrava "Tabelas (0)", que contava ocorrências, não
 * tabelas): quantos itens há **no trabalho**, quantos foram **verificados sem ocorrência** e quantos **têm pendência ou
 * aviso**. Em tabelas, quadros, figuras, gráficos e equações, cada elemento vem com o rótulo, o título, as menções
 * ligadas (onde estão no texto) e as ocorrências que apontam para ele ou para uma menção dele.
 *
 * Categoria sem contagem própria (texto e seções, siglas) mostra só as ocorrências.
 */
import type { CategoriaConformidade, NaoConformidade, RelatorioConformidade } from '../../dominio/verificador/conformidade';
import { CATEGORIAS_CONFORMIDADE } from '../../dominio/verificador/conformidade';
import type { AlvoRemissiva, RemissivaNoTexto } from '../../dominio/visuais';
import type { Id } from '../../dominio/modelo';

export interface MencaoDoElemento {
  secao: Id;
  /** Bloco (parágrafo) e id da remissiva, para "Ir à menção". */
  bloco: Id;
  remissiva: Id;
  /** Texto do autor, quando é menção sem número. */
  semNumero?: string;
}

export interface ElementoNoInventario {
  id: Id;
  secao: Id;
  categoria: CategoriaConformidade;
  rotulo: string;
  descricao: string;
  mencoes: MencaoDoElemento[];
  ocorrencias: NaoConformidade[];
}

export interface LinhaCategoria {
  categoria: CategoriaConformidade;
  nome: string;
  /** Itens no trabalho; `null` = a categoria não tem itens contáveis (texto, siglas). */
  noTrabalho: number | null;
  /** Itens sem nenhuma ocorrência (verificados e sem pendência nem aviso). */
  verificados: number | null;
  /** Itens com pendência ou aviso (ou, sem itens contáveis, as ocorrências). */
  comOcorrencia: number;
  pendencias: number;
  avisos: number;
}

export interface EntradaInventario {
  /** Alvos de remissiva do documento (tabelas, quadros, ilustrações, gráficos, equações; seções e apêndices são ignorados). */
  alvos: readonly (AlvoRemissiva & { especie?: 'tabela' | 'quadro' })[];
  remissivas: readonly RemissivaNoTexto[];
  /** Citações no texto e obras na bibliografia; elementos pré-textuais incluídos. */
  citacoes: number;
  obras: number;
  preTextuais: number;
}

export interface InventarioConformidade {
  elementos: ElementoNoInventario[];
  categorias: LinhaCategoria[];
}

function categoriaDoAlvo(a: EntradaInventario['alvos'][number]): CategoriaConformidade | null {
  if (a.tipo === 'tabela') return a.especie === 'quadro' ? 'quadros' : 'tabelas';
  if (a.tipo === 'ilustracao') return 'figuras';
  if (a.tipo === 'grafico') return 'graficos';
  if (a.tipo === 'equacao') return 'equacoes';
  return null;
}

/** O local da ocorrência aponta para o elemento ou para uma menção dele? */
const tocaElemento = (c: NaoConformidade, e: { id: Id; mencoes: readonly MencaoDoElemento[] }): boolean =>
  c.local.tipo === 'texto' && (c.local.no === e.id || e.mencoes.some((m) => m.remissiva === (c.local as { no: Id }).no));

export function inventarioConformidade(relatorio: RelatorioConformidade, entrada: EntradaInventario): InventarioConformidade {
  const elementos: ElementoNoInventario[] = [];
  for (const a of entrada.alvos) {
    const categoria = categoriaDoAlvo(a);
    if (!categoria) continue;
    const mencoes = entrada.remissivas
      .filter((r) => r.remissiva.alvo === a.id)
      .map((r) => ({ secao: r.secao, bloco: r.bloco, remissiva: r.remissiva.id, ...(r.remissiva.texto !== undefined ? { semNumero: r.remissiva.texto } : {}) }));
    const base = { id: a.id, mencoes };
    elementos.push({ id: a.id, secao: a.secao, categoria, rotulo: a.rotulo, descricao: a.descricao, mencoes, ocorrencias: relatorio.problemas.filter((c) => tocaElemento(c, base)) });
  }
  const contaveis: Partial<Record<CategoriaConformidade, number>> = { citacoes: entrada.citacoes, referencias: entrada.obras, preTextual: entrada.preTextuais };
  const categorias = CATEGORIAS_CONFORMIDADE.map(({ categoria, nome }): LinhaCategoria => {
    const ocorr = relatorio.problemas.filter((c) => c.categoria === categoria);
    const pendencias = ocorr.filter((c) => c.gravidade === 'erro').length;
    const avisos = ocorr.length - pendencias;
    const doTipo = elementos.filter((e) => e.categoria === categoria);
    if (['tabelas', 'quadros', 'figuras', 'graficos', 'equacoes'].includes(categoria)) {
      const com = doTipo.filter((e) => e.ocorrencias.length > 0).length;
      return { categoria, nome, noTrabalho: doTipo.length, verificados: doTipo.length - com, comOcorrencia: com, pendencias, avisos };
    }
    const total = contaveis[categoria];
    if (total === undefined) return { categoria, nome, noTrabalho: null, verificados: null, comOcorrencia: ocorr.length, pendencias, avisos };
    // Itens distintos com ocorrência: pelo local (obra, trecho do texto ou elemento pré-textual).
    const locais = new Set(ocorr.map((c) => JSON.stringify(c.local.tipo === 'texto' ? { s: c.local.secao, n: c.local.no } : c.local)));
    const com = Math.min(total, locais.size);
    return { categoria, nome, noTrabalho: total, verificados: total - com, comOcorrencia: com, pendencias, avisos };
  });
  return { elementos, categorias };
}
