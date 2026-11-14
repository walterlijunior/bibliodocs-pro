/**
 * Parágrafo e listas no editor de seção (Etapa 2 da especificação de atualização). Puros: rodam em Node.
 *
 * - Alinhamento do parágrafo (Ctrl+L, Ctrl+Shift+E, Ctrl+R, Ctrl+J): vale para os parágrafos da seleção. Escolher o
 *   alinhamento do perfil, ou de novo o que já está escolhido, devolve o parágrafo ao padrão do perfil (forma única:
 *   o arquivo nunca grava o padrão por escrito).
 * - Recuo de primeira linha: tira e repõe o recuo do perfil nos parágrafos da seleção.
 * - Lista com marcadores (Ctrl+Shift+8) e numerada (Ctrl+Shift+7): parágrafos e citações da seleção viram itens,
 *   emendando na lista vizinha do mesmo tipo; na lista, o mesmo comando a desfaz e o do outro tipo a troca.
 *   Enter cria o próximo item e, no item vazio, sai da lista; Backspace no começo do item o devolve a parágrafo.
 * - Novo parágrafo: parágrafo vazio logo depois do bloco do cursor (também depois de tabela, figura ou lista).
 *
 * O texto, as marcas e as notas passam intactos; números e marcadores nunca entram no documento.
 */
import type { Node as NoPm } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import type { AlinhamentoParagrafo } from '../../dominio/modelo';
import { blocosDaSelecao, cursor } from './comandos-blocos';
import { esquemaEditor } from './esquema';

const { nodes: tipos } = esquemaEditor;
const T = {
  paragrafo: tipos['paragrafo']!,
  citacao: tipos['citacaoLonga']!,
  lista: tipos['lista']!,
  item: tipos['itemLista']!,
};

/**
 * Alinhamento do corpo do texto no perfil UFT 2022 (RN-003, `corpo.paragrafo` em `perfis/uft-2022/perfil.json`; o teste
 * confere). A interface não lê o perfil: com outro perfil, quem chama passa o dele.
 */
export const ALINHAMENTO_PADRAO: AlinhamentoParagrafo = 'justificado';

/** Alinhamento que vale no parágrafo: o escolhido pelo autor ou o do perfil. */
export const alinhamentoEfetivo = (no: NoPm, padrao: AlinhamentoParagrafo): AlinhamentoParagrafo =>
  (no.attrs['alinhamento'] as AlinhamentoParagrafo | null) ?? padrao;

const paragrafosDaSelecao = (estado: EditorState) => (blocosDaSelecao(estado) ?? []).filter((b) => b.no.type === T.paragrafo);

/** Alinhamento comum aos parágrafos da seleção; `null` sem parágrafo ou com alinhamentos diferentes. */
export function alinhamentoDaSelecao(estado: EditorState, padrao: AlinhamentoParagrafo): AlinhamentoParagrafo | null {
  const ps = paragrafosDaSelecao(estado);
  if (ps.length === 0) return null;
  const a = alinhamentoEfetivo(ps[0]!.no, padrao);
  return ps.every((p) => alinhamentoEfetivo(p.no, padrao) === a) ? a : null;
}

export const temParagrafoNaSelecao = (estado: EditorState): boolean => paragrafosDaSelecao(estado).length > 0;

/** Todos os parágrafos da seleção estão sem o recuo de primeira linha. */
export function semRecuoNaSelecao(estado: EditorState): boolean {
  const ps = paragrafosDaSelecao(estado);
  return ps.length > 0 && ps.every((p) => p.no.attrs['semRecuo'] === true);
}

/**
 * Alinha os parágrafos da seleção. `padrao` é o do perfil: escolhê-lo, ou escolher de novo o que todos já têm,
 * devolve os parágrafos ao padrão.
 */
export function definirAlinhamento(alinhamento: AlinhamentoParagrafo, padrao: AlinhamentoParagrafo): Command {
  return (estado, despachar) => {
    const ps = paragrafosDaSelecao(estado);
    if (ps.length === 0) return false;
    if (despachar) {
      const todos = ps.every((p) => alinhamentoEfetivo(p.no, padrao) === alinhamento);
      const valor = alinhamento === padrao || todos ? null : alinhamento;
      const tr = estado.tr;
      for (const p of ps) tr.setNodeAttribute(p.pos, 'alinhamento', valor);
      despachar(tr);
    }
    return true;
  };
}

/** Tira o recuo de primeira linha dos parágrafos da seleção; se todos já estão sem, repõe. */
export const alternarRecuo: Command = (estado, despachar) => {
  const ps = paragrafosDaSelecao(estado);
  if (ps.length === 0) return false;
  if (despachar) {
    const tirar = !ps.every((p) => p.no.attrs['semRecuo'] === true);
    const tr = estado.tr;
    for (const p of ps) tr.setNodeAttribute(p.pos, 'semRecuo', tirar);
    despachar(tr);
  }
  return true;
};

/** Lugar do cursor na lista com marcadores ou numerada; `null` fora dela ou com a seleção saindo dela. */
function naLista(estado: EditorState) {
  const { $from, $to } = estado.selection;
  if ($from.depth < 2 || $from.node(1).type !== T.lista) return null;
  if ($to.depth < 2 || $to.node(1).type !== T.lista || $from.before(1) !== $to.before(1)) return null;
  return {
    lista: $from.node(1),
    posLista: $from.before(1),
    indiceDe: $from.index(1),
    indiceAte: $to.index(1),
    item: $from.node(2),
    deslocamento: $from.parentOffset,
  };
}

/** `'marcadores'`, `'numerada'` ou `null` (fora de lista). */
export function listaDaSelecao(estado: EditorState): 'marcadores' | 'numerada' | null {
  const l = naLista(estado);
  if (l === null) return null;
  return l.lista.attrs['numerada'] === true ? 'numerada' : 'marcadores';
}

/** Tira os itens `[de, ate]` da lista, como parágrafos; o que vem antes e depois continua em lista. */
const sairDaLista: Command = (estado, despachar) => {
  const l = naLista(estado);
  if (l === null) return false;
  if (despachar) {
    const numerada = l.lista.attrs['numerada'] === true;
    const antes: NoPm[] = [];
    const saem: NoPm[] = [];
    const depois: NoPm[] = [];
    l.lista.forEach((item, _d, i) => {
      if (i < l.indiceDe) antes.push(item);
      else if (i > l.indiceAte) depois.push(item);
      else saem.push(T.paragrafo.create({ id: null }, item.content));
    });
    const partes: NoPm[] = [];
    if (antes.length > 0) partes.push(T.lista.create({ id: l.lista.attrs['id'] as string | null, numerada }, antes));
    partes.push(...saem);
    if (depois.length > 0) partes.push(T.lista.create({ id: null, numerada }, depois));
    const tr = estado.tr.replaceWith(l.posLista, l.posLista + l.lista.nodeSize, partes);
    const inicio = l.posLista + (antes.length > 0 ? partes[0]!.nodeSize : 0);
    despachar(cursor(tr, inicio + 1 + l.deslocamento));
  }
  return true;
};

/**
 * Liga a lista do tipo pedido nos parágrafos e citações da seleção. Na lista do mesmo tipo, desfaz os itens
 * selecionados; na do outro tipo, troca o tipo da lista inteira.
 */
export function alternarLista(numerada: boolean): Command {
  return (estado, despachar) => {
    const l = naLista(estado);
    if (l !== null) {
      if ((l.lista.attrs['numerada'] === true) === numerada) return sairDaLista(estado, despachar);
      if (despachar) despachar(estado.tr.setNodeAttribute(l.posLista, 'numerada', numerada));
      return true;
    }
    const blocos = blocosDaSelecao(estado);
    if (blocos === null || blocos.length === 0) return false;
    if (!blocos.every((b) => b.no.type === T.paragrafo || b.no.type === T.citacao)) return false;
    if (despachar) {
      const mesmoTipo = (no: NoPm | null | undefined) => no?.type === T.lista && (no.attrs['numerada'] === true) === numerada;
      const novos = blocos.map((b) => T.item.create(null, b.no.content));
      const doc = estado.doc;
      const primeiro = blocos[0]!;
      const ultimo = blocos[blocos.length - 1]!;
      const anterior = doc.child(primeiro.indice - 1);
      const seguinte = ultimo.indice + 1 < doc.childCount ? doc.child(ultimo.indice + 1) : null;
      const emendaAntes = mesmoTipo(anterior);
      const emendaDepois = mesmoTipo(seguinte);
      const itens: NoPm[] = [];
      if (emendaAntes) anterior.forEach((i) => itens.push(i));
      const antesDoPrimeiro = itens.length;
      itens.push(...novos);
      if (emendaDepois) seguinte!.forEach((i) => itens.push(i));
      const de = emendaAntes ? primeiro.pos - anterior.nodeSize : primeiro.pos;
      const ate = ultimo.pos + ultimo.no.nodeSize + (emendaDepois ? seguinte!.nodeSize : 0);
      const id = emendaAntes ? (anterior.attrs['id'] as string | null) : emendaDepois ? (seguinte!.attrs['id'] as string | null) : null;
      const tr = estado.tr.replaceWith(de, ate, T.lista.create({ id, numerada }, itens));
      let pos = de + 1;
      for (let i = 0; i < antesDoPrimeiro; i++) pos += itens[i]!.nodeSize;
      despachar(cursor(tr, pos + 1 + estado.selection.$from.parentOffset));
    }
    return true;
  };
}

/** Enter na lista: próximo item; no item vazio, sai da lista. */
export const enterNaListaSimples: Command = (estado, despachar) => {
  const l = naLista(estado);
  if (l === null) return false;
  const { selection } = estado;
  if (selection.empty && l.item.content.size === 0) return sairDaLista(estado, despachar);
  if (despachar) {
    const tr = estado.tr;
    if (!selection.empty) tr.deleteSelection();
    const pos = tr.selection.from;
    tr.split(pos, 1);
    despachar(cursor(tr, tr.mapping.slice(tr.steps.length - 1).map(pos, 1)));
  }
  return true;
};

/** Backspace no começo do item: o item volta a parágrafo. */
export const voltarNoComecoDaLista: Command = (estado, despachar) => {
  const { selection } = estado;
  if (!selection.empty || selection.$from.parentOffset !== 0 || naLista(estado) === null) return false;
  return sairDaLista(estado, despachar);
};

/**
 * Enter no parágrafo com alinhamento ou recuo escolhidos: o parágrafo novo continua com eles, como no Word (o Enter
 * padrão, no fim do parágrafo, criaria um parágrafo do padrão). Sem escolha nenhuma, fica com o Enter padrão.
 */
export const enterNoParagrafo: Command = (estado, despachar) => {
  const { $from } = estado.selection;
  if ($from.depth !== 1 || $from.parent.type !== T.paragrafo || !estado.selection.$to.sameParent($from)) return false;
  const { alinhamento, semRecuo } = $from.parent.attrs as { alinhamento: AlinhamentoParagrafo | null; semRecuo: boolean };
  if (alinhamento === null && !semRecuo) return false;
  if (despachar) {
    const tr = estado.tr;
    if (!estado.selection.empty) tr.deleteSelection();
    const pos = tr.selection.from;
    tr.split(pos, 1, [{ type: T.paragrafo, attrs: { id: null, alinhamento, semRecuo } }]);
    despachar(cursor(tr, tr.mapping.slice(tr.steps.length - 1).map(pos, 1)));
  }
  return true;
};

/** Parágrafo vazio logo depois do bloco do cursor (no título, logo depois dele), com o cursor nele. */
export const novoParagrafo: Command = (estado, despachar) => {
  const { selection } = estado;
  // Bloco de primeiro nível do cursor; com um elemento (tabela, figura) selecionado, o próprio elemento.
  const indice = selection.$from.index(0);
  let pos = 0;
  for (let i = 0; i <= indice; i++) pos += estado.doc.child(i).nodeSize;
  if (despachar) {
    const tr = estado.tr.insert(pos, T.paragrafo.create({ id: null }));
    despachar(cursor(tr, pos + 1));
  }
  return true;
};
