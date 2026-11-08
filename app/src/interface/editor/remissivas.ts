/**
 * Remissiva no editor de seção (M5-T08; RF-11). A remissiva é o nó atômico `remissiva`, ligado ao alvo (tabela, quadro,
 * ilustração ou equação numerada) pelo id. O texto ("Tabela 3", "(2)") nunca entra no documento: a tela o pede ao
 * registro (`RegistroRemissivas`), alimentado pela lista de elementos da sessão; o DOCX, ao motor.
 *
 * - Inserir vai para o fim da seleção, sem apagar o que está selecionado, e o cursor fica depois da remissiva; inserir e
 *   trocar o alvo são passos próprios do histórico (Ctrl+Z desfaz um por vez, junto com o texto).
 *
 * Puro: roda em Node. A vista na tela está em `remissiva-view.ts`.
 */
import { closeHistory } from 'prosemirror-history';
import { NodeSelection, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { esquemaEditor } from './esquema';

const tipoRemissiva = esquemaEditor.nodes['remissiva']!;

/** Cópia de `TEXTO_REMISSIVA_QUEBRADA` do domínio (a interface só importa tipos do domínio; o teste confere). */
export const TEXTO_QUEBRADA = '[remissiva quebrada]';

export interface RemissivaNoEditor {
  id: string;
  pos: number;
  alvo: string;
}

/** A remissiva selecionada, ou `null`. */
export function remissivaSelecionada(estado: EditorState): RemissivaNoEditor | null {
  const s = estado.selection;
  if (!(s instanceof NodeSelection) || s.node.type !== tipoRemissiva) return null;
  return { id: String(s.node.attrs['id']), pos: s.from, alvo: String(s.node.attrs['alvo']) };
}

/** Lugar que aceita remissiva: texto corrido (parágrafo, alínea, citação longa). Não o título, a equação nem a nota. */
export const podeInserirRemissiva = (estado: EditorState): boolean => estado.selection.$to.parent.type.contentMatch.matchType(tipoRemissiva) !== null;

export function inserirRemissiva(alvo: string): Command {
  return (estado, despachar) => {
    if (!podeInserirRemissiva(estado)) return false;
    if (despachar) {
      const pos = estado.selection.to;
      const tr = estado.tr.insert(pos, tipoRemissiva.create({ id: null, alvo }));
      tr.setSelection(TextSelection.create(tr.doc, pos + 1));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}

export function alterarRemissiva(id: string, alvo: string): Command {
  return (estado, despachar) => {
    let pos: number | null = null;
    estado.doc.descendants((no, p) => {
      if (pos !== null) return false;
      if (no.type === tipoRemissiva && no.attrs['id'] === id) pos = p;
      return pos === null;
    });
    if (pos === null) return false;
    if (despachar) {
      const tr = estado.tr.setNodeMarkup(pos, null, { id, alvo });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}
