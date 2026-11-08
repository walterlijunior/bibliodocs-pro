/**
 * Esquema do editor de seção (M2-T05; ADR-0007, seção 2). Espelha o modelo `Bloco`/`Inline` do M2-T04: o editor não
 * consegue representar nada que o modelo não aceite.
 *
 * Regras:
 * - `toDOM` emite só classes e `data-*`, nunca `style` nem atributos de evento (teste em `tests/editor-esquema.test.ts`);
 * - só as quatro marcas do modelo; sobrescrito e subscrito se excluem;
 * - a ordem das marcas aqui é a ordem canônica (`ORDEM_MARCAS`), usada pela conversão;
 * - `\n` do modelo vira o nó `quebraLinha`; `\t` fica no texto;
 * - números (seção, alínea, nota) nunca entram no documento do editor.
 *
 * Os `parseDOM` servem à leitura que o `prosemirror-view` faz do DOM ao digitar (composição, correções do navegador).
 * As regras com classe (`p.bd-linha-alinea`, `p.bd-subalinea`) têm prioridade 60, acima da regra genérica de `p` (50),
 * para uma releitura dentro da alínea não virar parágrafo.
 * A colagem não passa por eles: ela usa `html-colado.ts` (ADR-0007, seção 5).
 *
 * Sem `prosemirror-view` aqui: o esquema roda em Node nos testes.
 */
import { Schema, type DOMOutputSpec, type MarkSpec, type Node as NoPm, type NodeSpec } from 'prosemirror-model';
import type { MarcaTexto } from '../../dominio/modelo';

/** Ordem canônica das marcas (a mesma da união `MarcaTexto`). */
export const ORDEM_MARCAS: readonly MarcaTexto[] = ['italico', 'negrito', 'sobrescrito', 'subscrito'];

/** Atributo `id` dos nós que têm id no modelo; `null` só até o plugin de ids únicos preencher. */
const atributoId = { id: { default: null, validate: 'string|null' } };

/** Tipo estrutural (não `HTMLElement`) para o esquema compilar também nos testes em Node, sem a lib DOM. */
const idDoElemento = (el: { getAttribute(nome: string): string | null }): { id: string | null } => ({
  id: el.getAttribute('data-id'),
});

/** `data-id` só quando há id (o `toDOM` nunca recebe valor que não seja do próprio nó). */
const atributosComId = (classe: string, no: NoPm): Record<string, string> => {
  const id: unknown = no.attrs['id'];
  return typeof id === 'string' ? { class: classe, 'data-id': id } : { class: classe };
};

/** Nó atômico de elemento visual com o bloco do modelo em `dados` (M5-T01). */
function elementoVisual(classe: string, nome: string): NodeSpec {
  return {
    group: 'bloco',
    atom: true,
    selectable: true,
    attrs: { ...atributoId, dados: { validate: 'string' } },
    toDOM: (no): DOMOutputSpec => ['div', atributosComId(classe, no), nome],
  };
}

const nos: Record<string, NodeSpec> = {
  /** Documento de uma seção: o título e os blocos (a árvore de seções fica no domínio). */
  secaoDoc: { content: 'titulo bloco*' },

  /** Título da seção: só texto com marcas (`InlineDeTitulo`), sem nota. */
  titulo: {
    content: 'textual*',
    defining: true,
    parseDOM: [{ tag: 'h2.bd-titulo' }],
    toDOM: (): DOMOutputSpec => ['h2', { class: 'bd-titulo' }, 0],
  },

  paragrafo: {
    group: 'bloco',
    content: 'inline*',
    attrs: atributoId,
    parseDOM: [{ tag: 'p', getAttrs: idDoElemento }],
    toDOM: (no): DOMOutputSpec => ['p', atributosComId('bd-paragrafo', no), 0],
  },

  /** Lista de alíneas: pelo menos uma (RN-028). O rótulo "a)" vem de `rotuloAlinea`, nunca do documento. */
  alineas: {
    group: 'bloco',
    content: 'alinea+',
    attrs: atributoId,
    parseDOM: [{ tag: 'ol.bd-alineas', getAttrs: idDoElemento }],
    toDOM: (no): DOMOutputSpec => ['ol', atributosComId('bd-alineas', no), 0],
  },
  /** Uma alínea: a linha dela e as subalíneas (um só nível, RN-026). Sem id, como `ItemAlinea`. */
  alinea: {
    content: 'linhaAlinea subalinea*',
    defining: true,
    parseDOM: [{ tag: 'li.bd-alinea' }],
    toDOM: (): DOMOutputSpec => ['li', { class: 'bd-alinea' }, 0],
  },
  linhaAlinea: {
    content: 'inline*',
    parseDOM: [{ tag: 'p.bd-linha-alinea', priority: 60 }],
    toDOM: (): DOMOutputSpec => ['p', { class: 'bd-linha-alinea' }, 0],
  },
  subalinea: {
    content: 'inline*',
    parseDOM: [{ tag: 'p.bd-subalinea', priority: 60 }],
    toDOM: (): DOMOutputSpec => ['p', { class: 'bd-subalinea' }, 0],
  },

  /** Citação direta longa (RN-004). A forma vem do perfil, na Pré-visualização. */
  citacaoLonga: {
    group: 'bloco',
    content: 'inline*',
    attrs: atributoId,
    defining: true,
    parseDOM: [{ tag: 'blockquote', getAttrs: idDoElemento }],
    toDOM: (no): DOMOutputSpec => ['blockquote', atributosComId('bd-citacao-longa', no), 0],
  },

  quebraPagina: {
    group: 'bloco',
    atom: true,
    selectable: true,
    attrs: atributoId,
    parseDOM: [{ tag: 'hr.bd-quebra-pagina', getAttrs: idDoElemento }],
    toDOM: (no): DOMOutputSpec => ['hr', atributosComId('bd-quebra-pagina', no)],
  },

  /**
   * Tabela e ilustração (M5-T01): folhas atômicas que guardam o bloco do modelo em `dados` (JSON sem o id), só para a
   * ida e volta ser exata; a edição é pela janela (M5-T04, T06). Sem `parseDOM`: colar não cria elemento visual.
   */
  tabela: elementoVisual('bd-tabela', 'Tabela'),
  ilustracao: elementoVisual('bd-ilustracao', 'Ilustração'),
  /** Gráfico gerado de tabela (M5-T09): editado pela janela; o desenho vem da tabela, na `GraficoView`. */
  grafico: elementoVisual('bd-grafico', 'Gráfico'),

  /**
   * Equação (M5-T07; D-M5-06): editada no próprio texto, como a citação longa; só texto com marcas e quebra de linha
   * (`InlineDeTitulo`), sem nota nem citação. O número "(n)" é do documento e não entra aqui: a tela mostra o lugar dele
   * pelo `data-numerada`. A regra com classe (prioridade 60) serve à releitura do DOM ao digitar.
   */
  equacao: {
    group: 'bloco',
    content: 'textual*',
    attrs: { ...atributoId, numerada: { default: true, validate: 'boolean' } },
    defining: true,
    parseDOM: [
      {
        tag: 'div.bd-equacao',
        priority: 60,
        getAttrs: (el) => ({ ...idDoElemento(el), numerada: el.getAttribute('data-numerada') !== 'nao' }),
      },
    ],
    toDOM: (no): DOMOutputSpec => ['div', { ...atributosComId('bd-equacao', no), 'data-numerada': no.attrs['numerada'] === true ? 'sim' : 'nao' }, 0],
  },

  text: { group: 'inline textual' },

  /** `\n` do modelo: quebra de linha manual dentro do parágrafo. */
  quebraLinha: {
    group: 'inline textual',
    inline: true,
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM: (): DOMOutputSpec => ['br'],
  },

  /**
   * Nota de rodapé no ponto da chamada (RN-100), com o conteúdo dentro (`InlineDeNota`: texto e chamadas de citação,
   * M4-T07; sem outra nota). Nó atômico: o conteúdo é editado num editor aninhado (NodeView do M2-T06).
   */
  nota: {
    group: 'inline',
    inline: true,
    atom: true,
    content: '(textual | chamadaCitacao | sigla)*',
    attrs: atributoId,
    parseDOM: [{ tag: 'span.bd-nota', getAttrs: idDoElemento }],
    toDOM: (no): DOMOutputSpec => ['span', atributosComId('bd-nota', no), 0],
  },

  /**
   * Chamada de citação (M4-T01): folha atômica que guarda a ligação com as obras em `dados` (JSON do `InlineCitacao` sem
   * o id). Sem `parseDOM`: colar nunca cria citação, porque a obra pode não existir neste trabalho (o texto colado com
   * "(AUTOR, ano)" só sugere a ligação, M4-T07). Na tela, o texto da chamada vem do `ChamadaView`; o `toDOM` só serve à
   * cópia, que leva a palavra "citação".
   */
  /**
   * Remissiva (M5-T08; RF-11): folha atômica com o id do alvo (tabela, quadro, ilustração ou equação numerada). O texto
   * ("Tabela 3") vem da numeração do documento, no `RemissivaView`; o `toDOM` só serve à cópia. Sem `parseDOM`: colar não
   * cria remissiva, porque o alvo pode não existir no destino.
   */
  remissiva: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: { ...atributoId, alvo: { validate: 'string' } },
    toDOM: (no): DOMOutputSpec => ['span', atributosComId('bd-remissiva', no), 'remissiva'],
  },

  sigla: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: { ...atributoId, sigla: { validate: 'string' } },
    toDOM: (no): DOMOutputSpec => ['span', atributosComId('bd-sigla', no), 'sigla'],
  },

  chamadaCitacao: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: { ...atributoId, dados: { validate: 'string' } },
    toDOM: (no): DOMOutputSpec => ['span', atributosComId('bd-citacao', no), 'citação'],
  },
};

const marcas: Record<MarcaTexto, MarkSpec> = {
  italico: {
    parseDOM: [{ tag: 'em' }, { tag: 'i' }],
    toDOM: (): DOMOutputSpec => ['em', 0],
  },
  negrito: {
    parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
    toDOM: (): DOMOutputSpec => ['strong', 0],
  },
  sobrescrito: {
    excludes: 'sobrescrito subscrito',
    parseDOM: [{ tag: 'sup' }],
    toDOM: (): DOMOutputSpec => ['sup', 0],
  },
  subscrito: {
    excludes: 'sobrescrito subscrito',
    parseDOM: [{ tag: 'sub' }],
    toDOM: (): DOMOutputSpec => ['sub', 0],
  },
};

export const esquemaEditor = new Schema({ nodes: nos, marks: marcas, topNode: 'secaoDoc' });

/** Tipos de nó que têm id no modelo e o prefixo do id novo (o mesmo das fixtures: `par_`, `nta_`…). */
export const PREFIXO_ID: Readonly<Record<string, string>> = {
  paragrafo: 'par',
  alineas: 'aln',
  citacaoLonga: 'cit',
  quebraPagina: 'qbr',
  tabela: 'tab',
  ilustracao: 'ilu',
  equacao: 'eqc',
  grafico: 'gra',
  nota: 'nta',
  chamadaCitacao: 'cta',
  remissiva: 'rem',
  sigla: 'sig',
};
