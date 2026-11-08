/** Sigla ligada ao cadastro (M6-T03). Texto digitado só vira ligação depois do aceite do autor. */
import { closeHistory } from 'prosemirror-history';
import type { Node as NoPm } from 'prosemirror-model';
import { NodeSelection, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import type { Sigla } from '../../dominio/modelo';
import { esquemaEditor } from './esquema';

const tipoSigla = esquemaEditor.nodes['sigla']!;
export const TEXTO_SIGLA_QUEBRADA = '[sigla sem cadastro]';
export interface SiglaNoEditor { id: string; pos: number; sigla: string }
export interface SiglaEscrita { de: number; ate: number; texto: string; sigla: string }

export function siglaSelecionada(estado: EditorState): SiglaNoEditor | null {
  const s = estado.selection;
  return s instanceof NodeSelection && s.node.type === tipoSigla
    ? { id: String(s.node.attrs['id']), pos: s.from, sigla: String(s.node.attrs['sigla']) } : null;
}
export const podeInserirSigla = (estado: EditorState): boolean => estado.selection.$to.parent.type.contentMatch.matchType(tipoSigla) !== null;

export function inserirSigla(sigla: string): Command {
  return (estado, despachar) => {
    if (!podeInserirSigla(estado)) return false;
    if (despachar) {
      const pos = estado.selection.to;
      const tr = estado.tr.insert(pos, tipoSigla.create({ id: null, sigla }));
      tr.setSelection(TextSelection.create(tr.doc, pos + 1));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}
export function alterarSigla(id: string, sigla: string): Command {
  return (estado, despachar) => {
    let pos: number | null = null;
    estado.doc.descendants((no, p) => {
      if (pos !== null) return false;
      if (no.type === tipoSigla && no.attrs['id'] === id) pos = p;
      return pos === null;
    });
    if (pos === null) return false;
    if (despachar) {
      const tr = estado.tr.setNodeMarkup(pos, null, { id, sigla });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}

/** Procura só nos blocos alterados; nós existentes interrompem palavras e nunca são convertidos de novo. */
export function siglasEscritasNoDoc(doc: NoPm, cadastro: readonly Sigla[], blocos?: ReadonlySet<string>): SiglaEscrita[] {
  const mapa = new Map<string, string | null>();
  for (const s of cadastro) mapa.set(s.sigla, mapa.has(s.sigla) ? null : s.id);
  if (mapa.size === 0) return [];
  const saida: SiglaEscrita[] = [];
  const procurar = (no: NoPm, pos: number): boolean => {
    if (saida.length >= 200) return false;
    if (!no.isTextblock) return true;
    if (no.type.contentMatch.matchType(tipoSigla) === null) return false;
    let texto = '';
    no.forEach((filho) => { texto += filho.isText ? filho.text! : '\ufffc'.repeat(filho.nodeSize); });
    for (const m of texto.matchAll(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*\.?/gu)) {
      let palavra = m[0];
      if (!mapa.has(palavra) && palavra.endsWith('.')) palavra = palavra.slice(0, -1);
      const id = mapa.get(palavra);
      if (id) saida.push({ de: pos + 1 + m.index!, ate: pos + 1 + m.index! + palavra.length, texto: palavra, sigla: id });
      if (saida.length >= 200) break;
    }
    return false;
  };
  doc.forEach((no, pos) => {
    if (blocos !== undefined && !blocos.has(String(no.attrs['id']))) return;
    if (procurar(no, pos)) no.descendants((sub, rel) => procurar(sub, pos + 1 + rel));
  });
  return saida;
}

export function ligarSiglasEscritas(entradas: readonly SiglaEscrita[]): Command {
  return (estado, despachar) => {
    if (entradas.length === 0) return false;
    // O texto pode ter mudado desde a sugestão; nenhuma posição desatualizada é aplicada.
    const validas = entradas.filter((e) => e.de >= 0 && e.ate <= estado.doc.content.size && estado.doc.textBetween(e.de, e.ate, '', '\ufffc') === e.texto);
    if (validas.length === 0) return false;
    if (despachar) {
      const tr = estado.tr;
      for (const e of [...validas].sort((a, b) => b.de - a.de)) tr.replaceWith(e.de, e.ate, tipoSigla.create({ id: null, sigla: e.sigla }));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}
