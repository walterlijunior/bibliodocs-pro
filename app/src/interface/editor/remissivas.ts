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
  /** Menção sem número (Etapa 4): o texto do autor; ausente, a remissiva mostra o rótulo. */
  texto?: string;
}

/** Limite do texto da menção sem número e do trecho selecionado para ligar (cópia de `LIMITES_V1.textoMencao`). */
export const LIMITE_TEXTO_MENCAO = 200;

/** A remissiva selecionada, ou `null`. */
export function remissivaSelecionada(estado: EditorState): RemissivaNoEditor | null {
  const s = estado.selection;
  if (!(s instanceof NodeSelection) || s.node.type !== tipoRemissiva) return null;
  const texto = s.node.attrs['texto'];
  return { id: String(s.node.attrs['id']), pos: s.from, alvo: String(s.node.attrs['alvo']), ...(typeof texto === 'string' ? { texto } : {}) };
}

/** Lugar que aceita remissiva: texto corrido (parágrafo, alínea, citação longa). Não o título, a equação nem a nota. */
export const podeInserirRemissiva = (estado: EditorState): boolean => estado.selection.$to.parent.type.contentMatch.matchType(tipoRemissiva) !== null;

/**
 * Menção já escrita e selecionada (Etapa 4): o trecho, se a seleção é só texto, num bloco que aceita remissiva, numa linha
 * e com até `LIMITE_TEXTO_MENCAO` caracteres. É o que "Ligar" troca pela remissiva. `null` = nada a ligar.
 */
export function mencaoEscritaSelecionada(estado: EditorState): string | null {
  const s = estado.selection;
  if (!(s instanceof TextSelection) || s.empty || !s.$from.sameParent(s.$to) || !podeInserirRemissiva(estado)) return null;
  let soTexto = true;
  estado.doc.nodesBetween(s.from, s.to, (no) => {
    if (no.isInline && !no.isText) soTexto = false;
  });
  if (!soTexto) return null;
  const texto = estado.doc.textBetween(s.from, s.to).trim();
  if (texto === '' || texto.length > LIMITE_TEXTO_MENCAO || /[\u0000-\u001F]/.test(texto)) return null;
  return texto;
}

export interface OpcoesRemissiva {
  /** Menção sem número: o texto do autor. */
  texto?: string;
  /** Troca o trecho selecionado (a menção escrita) pela remissiva. Sem isso, entra no fim da seleção. */
  substituir?: boolean;
}

const textoValido = (t: string | undefined): string | null => {
  const limpo = t?.replace(/[\u0000-\u001F]+/g, ' ').trim() ?? '';
  return limpo === '' ? null : limpo.slice(0, LIMITE_TEXTO_MENCAO);
};

export function inserirRemissiva(alvo: string, opcoes: OpcoesRemissiva = {}): Command {
  return (estado, despachar) => {
    if (!podeInserirRemissiva(estado)) return false;
    const substituir = opcoes.substituir === true && mencaoEscritaSelecionada(estado) !== null;
    if (despachar) {
      const { from, to } = estado.selection;
      const no = tipoRemissiva.create({ id: null, alvo, texto: textoValido(opcoes.texto) });
      const tr = substituir ? estado.tr.replaceWith(from, to, no) : estado.tr.insert(to, no);
      const depois = (substituir ? from : to) + 1;
      tr.setSelection(TextSelection.create(tr.doc, depois));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}

/** Troca o alvo e, com `texto` definido, a forma: `null` volta ao rótulo; texto, menção sem número. */
export function alterarRemissiva(id: string, alvo: string, texto?: string | null): Command {
  return (estado, despachar) => {
    let pos: number | null = null;
    let atual: unknown = null;
    estado.doc.descendants((no, p) => {
      if (pos !== null) return false;
      if (no.type === tipoRemissiva && no.attrs['id'] === id) {
        pos = p;
        atual = no.attrs['texto'];
      }
      return pos === null;
    });
    if (pos === null) return false;
    if (despachar) {
      const novoTexto = texto === undefined ? atual : texto === null ? null : textoValido(texto);
      const tr = estado.tr.setNodeMarkup(pos, null, { id, alvo, texto: novoTexto });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}
