/**
 * Alíneas e citação longa no editor de seção (M2-T13; RF-03; RN-004, RN-023, RN-026, RN-028). Puros: rodam em Node.
 *
 * - Ctrl+Shift+L liga e desliga alíneas nos parágrafos da seleção; Ctrl+Shift+Q, a citação longa.
 * - Na alínea: Enter cria a próxima e, vazia, sai da lista; Tab vira subalínea da anterior (um nível só, RN-026);
 *   Shift+Tab volta a alínea; Backspace no começo da linha desfaz um passo. Fora da lista o Tab sai do editor.
 *
 * O texto, as marcas e as notas passam intactos. Rótulos (`a)`) nunca entram no documento; ids novos vêm do plugin.
 *
 * Equação (M5-T07; RN-105, RN-106, D-M5-14): Alt+= liga e desliga a equação nos parágrafos da seleção (só os de texto:
 * equação não tem nota nem citação); a nova já vem numerada, e "Numerar" tira e põe o número. Enter no fim da equação
 * abre um parágrafo depois dela; Backspace no começo a devolve a parágrafo.
 */
import type { Node as NoPm } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import { esquemaEditor } from './esquema';

const { nodes: tipos } = esquemaEditor;
const T = {
  paragrafo: tipos['paragrafo']!,
  citacao: tipos['citacaoLonga']!,
  equacao: tipos['equacao']!,
  lista: tipos['alineas']!,
  alinea: tipos['alinea']!,
  linha: tipos['linhaAlinea']!,
  sub: tipos['subalinea']!,
};

interface BlocoTopo {
  no: NoPm;
  pos: number;
  indice: number;
}

/** Blocos de primeiro nível tocados pela seleção. `null` se ela toca o título. */
function blocosDaSelecao(estado: EditorState): BlocoTopo[] | null {
  const { $from, $to } = estado.selection;
  const inicio = $from.index(0);
  const fim = $to.index(0);
  if (inicio === 0) return null; // o título é sempre o primeiro filho
  const blocos: BlocoTopo[] = [];
  let pos = 0;
  estado.doc.forEach((no, _desloc, indice) => {
    if (indice >= inicio && indice <= fim) blocos.push({ no, pos, indice });
    pos += no.nodeSize;
  });
  return blocos;
}

const cursor = (tr: Transaction, pos: number): Transaction => tr.setSelection(TextSelection.create(tr.doc, pos)).scrollIntoView();

/** Lugar do cursor dentro da lista: a lista, o item e, se houver, a subalínea. `null` fora da lista. */
function naLista(estado: EditorState) {
  const { $from, $to } = estado.selection;
  if ($from.depth < 3 || $from.node(1).type !== T.lista) return null;
  if ($to.depth < 3 || $to.node(1).type !== T.lista || $from.before(1) !== $to.before(1)) return null;
  return {
    lista: $from.node(1),
    posLista: $from.before(1),
    indiceDe: $from.index(1),
    indiceAte: $to.index(1),
    item: $from.node(2),
    posItem: $from.before(2),
    /** Filho do item (0 é a linha da alínea; 1 em diante, subalíneas). */
    filho: $from.index(2),
    parente: $from.parent,
    deslocamento: $from.parentOffset,
  };
}

export const estaEmAlineas = (estado: EditorState): boolean => naLista(estado) !== null;

export function estaEmCitacao(estado: EditorState): boolean {
  const blocos = blocosDaSelecao(estado);
  return blocos !== null && blocos.length > 0 && blocos.every((b) => b.no.type === T.citacao);
}

/** Tira os itens `[de, ate]` da lista, como parágrafos; o que vem antes e depois continua em lista. */
const sairDaLista: Command = (estado, despachar) => {
  const l = naLista(estado);
  if (l === null) return false;
  if (despachar) {
    const antes: NoPm[] = [];
    const saem: NoPm[] = [];
    const depois: NoPm[] = [];
    l.lista.forEach((item, _d, i) => {
      if (i < l.indiceDe) antes.push(item);
      else if (i > l.indiceAte) depois.push(item);
      else item.forEach((filho) => saem.push(T.paragrafo.create({ id: null }, filho.content)));
    });
    const partes: NoPm[] = [];
    if (antes.length > 0) partes.push(T.lista.create({ id: l.lista.attrs['id'] as string | null }, antes));
    partes.push(...saem);
    if (depois.length > 0) partes.push(T.lista.create({ id: null }, depois));
    const tr = estado.tr.replaceWith(l.posLista, l.posLista + l.lista.nodeSize, partes);
    // O parágrafo do cursor: conta os filhos dos itens que saem antes dele.
    const inicio = l.posLista + (antes.length > 0 ? partes[0]!.nodeSize : 0);
    let pos = inicio;
    for (let i = 0; i < l.filho; i++) pos += saem[i]!.nodeSize;
    despachar(cursor(tr, pos + 1 + l.deslocamento));
  }
  return true;
};

/** Parágrafos e citações da seleção viram alíneas, emendando na lista vizinha; dentro da lista, saem dela. */
export const alternarAlineas: Command = (estado, despachar) => {
  if (naLista(estado) !== null) return sairDaLista(estado, despachar);
  const blocos = blocosDaSelecao(estado);
  if (blocos === null || blocos.length === 0) return false;
  if (!blocos.every((b) => b.no.type === T.paragrafo || b.no.type === T.citacao)) return false;
  if (despachar) {
    const novos = blocos.map((b) => T.alinea.create(null, T.linha.create(null, b.no.content)));
    const doc = estado.doc;
    const primeiro = blocos[0]!;
    const ultimo = blocos[blocos.length - 1]!;
    const anterior = doc.child(primeiro.indice - 1);
    const seguinte = ultimo.indice + 1 < doc.childCount ? doc.child(ultimo.indice + 1) : null;
    const emendaAntes = anterior.type === T.lista;
    const emendaDepois = seguinte?.type === T.lista;
    const itens: NoPm[] = [];
    if (emendaAntes) anterior.forEach((i) => itens.push(i));
    const posPrimeiroNovo = itens.length;
    itens.push(...novos);
    if (emendaDepois) seguinte!.forEach((i) => itens.push(i));
    const de = emendaAntes ? primeiro.pos - anterior.nodeSize : primeiro.pos;
    const ate = ultimo.pos + ultimo.no.nodeSize + (emendaDepois ? seguinte!.nodeSize : 0);
    const id = emendaAntes ? (anterior.attrs['id'] as string | null) : emendaDepois ? (seguinte!.attrs['id'] as string | null) : null;
    const tr = estado.tr.replaceWith(de, ate, T.lista.create({ id }, itens));
    let pos = de + 1;
    for (let i = 0; i < posPrimeiroNovo; i++) pos += itens[i]!.nodeSize;
    // Item > linha: dois níveis até o texto; o cursor fica no mesmo ponto do primeiro bloco.
    despachar(cursor(tr, pos + 2 + estado.selection.$from.parentOffset));
  }
  return true;
};

/** Parágrafos ↔ citação longa, mantendo o id do bloco. Outros blocos da seleção ficam como estão. */
export const alternarCitacaoLonga: Command = (estado, despachar) => {
  const blocos = blocosDaSelecao(estado);
  if (blocos === null) return false;
  const alvos = blocos.filter((b) => b.no.type === T.paragrafo || b.no.type === T.citacao);
  if (alvos.length === 0) return false;
  if (despachar) {
    const tipo = alvos.every((b) => b.no.type === T.citacao) ? T.paragrafo : T.citacao;
    const tr = estado.tr;
    for (const b of alvos) tr.setNodeMarkup(b.pos, tipo, { id: b.no.attrs['id'] as string | null });
    despachar(tr.scrollIntoView());
  }
  return true;
};

/** Subalínea vira alínea; as subalíneas seguintes ficam com ela. */
export const promoverSubalinea: Command = (estado, despachar) => {
  const l = naLista(estado);
  if (l === null || l.filho === 0 || !estado.selection.empty) return false;
  if (despachar) {
    const filhos: NoPm[] = [];
    l.item.forEach((f) => filhos.push(f));
    const fica = T.alinea.create(null, filhos.slice(0, l.filho));
    const nova = T.alinea.create(null, [T.linha.create(null, l.parente.content), ...filhos.slice(l.filho + 1)]);
    const tr = estado.tr.replaceWith(l.posItem, l.posItem + l.item.nodeSize, [fica, nova]);
    despachar(cursor(tr, l.posItem + fica.nodeSize + 2 + l.deslocamento));
  }
  return true;
};

/** Tab na alínea: vira subalínea da anterior, e as subalíneas dela vão junto (um nível só, RN-026). */
export const recuarAlinea: Command = (estado, despachar) => {
  const l = naLista(estado);
  if (l === null) return false; // fora da lista o Tab sai do editor
  // Dentro da lista o Tab nunca sai: na primeira alínea e na subalínea não há o que recuar.
  if (l.filho > 0 || l.indiceDe === 0 || !estado.selection.empty) return true;
  if (despachar) {
    const anterior = l.lista.child(l.indiceDe - 1);
    const posAnterior = l.posItem - anterior.nodeSize;
    const filhos: NoPm[] = [];
    anterior.forEach((f) => filhos.push(f));
    const tamanhoAntes = filhos.reduce((n, f) => n + f.nodeSize, 0);
    l.item.forEach((f, _d, i) => filhos.push(i === 0 ? T.sub.create(null, f.content) : f));
    const novo = T.alinea.create(null, filhos);
    const tr = estado.tr.replaceWith(posAnterior, l.posItem + l.item.nodeSize, novo);
    despachar(cursor(tr, posAnterior + 1 + tamanhoAntes + 1 + l.deslocamento));
  }
  return true;
};

/** Enter na lista: próxima alínea ou subalínea; vazia, desfaz um passo (sai da lista ou volta a alínea). */
export const enterNaLista: Command = (estado, despachar) => {
  const l = naLista(estado);
  if (l === null) return false;
  const { selection } = estado;
  if (selection.empty && l.parente.content.size === 0) {
    if (l.filho > 0) return promoverSubalinea(estado, despachar);
    if (l.item.childCount === 1) return sairDaLista(estado, despachar);
  }
  if (despachar) {
    const tr = estado.tr;
    if (!selection.empty) tr.deleteSelection();
    const pos = tr.selection.from;
    const $pos = tr.doc.resolve(pos);
    if ($pos.parent.type === T.sub) tr.split(pos, 1, [{ type: T.sub }]);
    else tr.split(pos, 2);
    despachar(cursor(tr, tr.mapping.slice(tr.steps.length - 1).map(pos, 1)));
  }
  return true;
};

/** Backspace no começo: subalínea volta a alínea, alínea sai da lista, citação volta a parágrafo. */
export const voltarNoComeco: Command = (estado, despachar) => {
  const { selection } = estado;
  if (!selection.empty || selection.$from.parentOffset !== 0) return false;
  const l = naLista(estado);
  if (l !== null) return l.filho > 0 ? promoverSubalinea(estado, despachar) : sairDaLista(estado, despachar);
  const tipo = selection.$from.parent.type;
  if (tipo === T.citacao) return alternarCitacaoLonga(estado, despachar);
  if (tipo === T.equacao) return alternarEquacao(estado, despachar);
  return false;
};

/** Parágrafo que pode virar equação: só texto e quebras de linha (sem nota nem chamada de citação). */
const soTextual = (no: NoPm): boolean => {
  let ok = true;
  no.forEach((filho) => {
    if (!filho.isText && filho.type.name !== 'quebraLinha') ok = false;
  });
  return ok;
};

export function estaEmEquacao(estado: EditorState): boolean {
  const blocos = blocosDaSelecao(estado);
  return blocos !== null && blocos.length > 0 && blocos.every((b) => b.no.type === T.equacao);
}

/** A seleção está só em equações e todas são numeradas. */
export function equacaoNumerada(estado: EditorState): boolean {
  return estaEmEquacao(estado) && blocosDaSelecao(estado)!.every((b) => b.no.attrs['numerada'] === true);
}

/**
 * Parágrafos ↔ equação, mantendo o id do bloco. Todas equações: voltam a parágrafo. Senão, os parágrafos só de texto
 * viram equação numerada (D-M5-14); os demais blocos ficam como estão.
 */
export const alternarEquacao: Command = (estado, despachar) => {
  const blocos = blocosDaSelecao(estado);
  if (blocos === null || blocos.length === 0) return false;
  const voltar = blocos.every((b) => b.no.type === T.equacao);
  const alvos = voltar ? blocos : blocos.filter((b) => b.no.type === T.paragrafo && soTextual(b.no));
  if (alvos.length === 0) return false;
  if (despachar) {
    const tr = estado.tr;
    for (const b of alvos) {
      const id = b.no.attrs['id'] as string | null;
      tr.setNodeMarkup(b.pos, voltar ? T.paragrafo : T.equacao, voltar ? { id } : { id, numerada: true });
    }
    despachar(tr.scrollIntoView());
  }
  return true;
};

/** Põe ou tira o número das equações da seleção (todas numeradas: tira; senão, põe em todas). */
export const alternarNumeroEquacao: Command = (estado, despachar) => {
  if (!estaEmEquacao(estado)) return false;
  if (despachar) {
    const numerar = !equacaoNumerada(estado);
    const tr = estado.tr;
    for (const b of blocosDaSelecao(estado)!) tr.setNodeAttribute(b.pos, 'numerada', numerar);
    despachar(tr);
  }
  return true;
};

/** Enter no fim da equação: parágrafo novo depois dela (no meio, o Enter padrão divide a equação em duas). */
export const enterNaEquacao: Command = (estado, despachar) => {
  const { selection } = estado;
  const { $from } = selection;
  if (!selection.empty || $from.depth !== 1 || $from.parent.type !== T.equacao || $from.parentOffset !== $from.parent.content.size) return false;
  if (despachar) {
    const pos = $from.after(1);
    const tr = estado.tr.insert(pos, T.paragrafo.create({ id: null }));
    despachar(cursor(tr, pos + 1));
  }
  return true;
};
