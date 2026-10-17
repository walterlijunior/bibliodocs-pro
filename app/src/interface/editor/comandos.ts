/**
 * Comandos e teclas do editor de seção (M2-T06; ADR-0007, seções 3 e 4). Puros: rodam em Node com `prosemirror-state`.
 *
 * - Marcas: Ctrl+I itálico, Ctrl+B negrito, Ctrl+Shift+= sobrescrito e Ctrl+= subscrito (os atalhos do Word). Aplicadas
 *   numa seleção que contém uma nota, não entram no texto da nota (achado M6 da revisão do M2-T05): a marca da chamada
 *   não é a do texto da nota, que se edita à parte.
 * - Nota de rodapé: Ctrl+Alt+F (o atalho do Word) insere a nota vazia no cursor e a seleciona; o editor da nota abre.
 * - Shift+Enter: quebra de linha manual (o `\n` do modelo).
 * - Ctrl+Z desfaz; Ctrl+Y e Ctrl+Shift+Z refazem (histórico de texto da seção, `prosemirror-history`).
 */
import { baseKeymap, chainCommands, toggleMark } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import type { MarkType, Node as NoPm } from 'prosemirror-model';
import { NodeSelection, type Command, type EditorState } from 'prosemirror-state';
import type { MarcaTexto } from '../../dominio/modelo';
import { esquemaEditor } from './esquema';

const { nodes: tipos, marks: marcas } = esquemaEditor;

/** Trechos de `[de, ate)` fora do conteúdo das notas (a chamada fica; o texto dentro dela, não). */
export function faixasForaDasNotas(doc: NoPm, de: number, ate: number): { de: number; ate: number }[] {
  const faixas: { de: number; ate: number }[] = [];
  let inicio = de;
  doc.nodesBetween(de, ate, (no, pos) => {
    if (no.type !== tipos['nota']) return true;
    const dentroDe = pos + 1;
    const dentroAte = pos + no.nodeSize - 1;
    if (dentroDe > inicio) faixas.push({ de: inicio, ate: Math.min(dentroDe, ate) });
    inicio = Math.max(inicio, dentroAte);
    return false;
  });
  if (ate > inicio) faixas.push({ de: inicio, ate });
  return faixas;
}

/** A marca está em todo o texto das faixas? */
function marcaEmTudo(doc: NoPm, faixas: readonly { de: number; ate: number }[], tipo: MarkType): boolean {
  let tem = false;
  let falta = false;
  for (const f of faixas) {
    doc.nodesBetween(f.de, f.ate, (no) => {
      if (no.type === tipos['nota']) return false;
      if (no.isInline) {
        if (tipo.isInSet(no.marks)) tem = true;
        else falta = true;
      }
      return true;
    });
  }
  return tem && !falta;
}

/**
 * Liga ou desliga a marca na seleção, sem tocar no texto das notas. Sem seleção, vale para o que for digitado a seguir
 * (`storedMarks`, como o `toggleMark` da biblioteca).
 */
export function alternarMarca(nome: MarcaTexto): Command {
  const tipo = marcas[nome]!;
  const padrao = toggleMark(tipo);
  return (estado, despachar) => {
    const { empty, ranges } = estado.selection;
    if (empty) return padrao(estado, despachar);
    const faixas = ranges.flatMap((r) => faixasForaDasNotas(estado.doc, r.$from.pos, r.$to.pos));
    if (faixas.length === 0) return false;
    if (despachar) {
      const tr = estado.tr;
      const tirar = marcaEmTudo(estado.doc, faixas, tipo);
      for (const f of faixas) {
        if (tirar) tr.removeMark(f.de, f.ate, tipo);
        else tr.addMark(f.de, f.ate, tipo.create());
      }
      despachar(tr.scrollIntoView());
    }
    return true;
  };
}

/** A marca vale no cursor ou em toda a seleção (para o botão da barra mostrar "pressionado"). */
export function marcaAtiva(estado: EditorState, nome: MarcaTexto): boolean {
  const tipo = marcas[nome]!;
  const { empty, $from, ranges } = estado.selection;
  if (empty) return tipo.isInSet(estado.storedMarks ?? $from.marks()) !== undefined;
  return marcaEmTudo(estado.doc, ranges.flatMap((r) => faixasForaDasNotas(estado.doc, r.$from.pos, r.$to.pos)), tipo);
}

/** O fim da seleção está num lugar que aceita nota (parágrafo, alínea, citação; não o título nem dentro de outra nota)? */
const aceitaNota = (estado: EditorState): boolean => estado.selection.$to.parent.type.contentMatch.matchType(tipos['nota']!) !== null;

/** Transação que acabou de inserir uma nota: o editor da seção põe o foco no texto dela. */
export const META_ABRIR_NOTA = 'abrirNota';

/**
 * Insere uma nota vazia no fim da seleção, sem apagar o que está selecionado (como no Word: a chamada vai depois da
 * palavra marcada), e a seleciona (o NodeView abre o editor da nota). A chamada leva as marcas do texto anterior
 * (itálico etc.), que a conversão para o modelo ignora.
 */
export const inserirNota: Command = (estado, despachar) => {
  if (!aceitaNota(estado)) return false;
  if (despachar) {
    const pos = estado.selection.to;
    const tr = estado.tr.insert(pos, tipos['nota']!.create());
    tr.setSelection(NodeSelection.create(tr.doc, pos)).setMeta(META_ABRIR_NOTA, true);
    despachar(tr.scrollIntoView());
  }
  return true;
};

/** Pode inserir nota aqui? (para desativar o botão da barra e o item do menu). */
export const podeInserirNota = (estado: EditorState): boolean => inserirNota(estado);

/** Quebra de linha manual (o `\n` do modelo), com as marcas do cursor. */
export const quebrarLinha: Command = (estado, despachar) => {
  const { $from } = estado.selection;
  if (!$from.parent.type.contentMatch.matchType(tipos['quebraLinha']!)) return false;
  if (despachar) {
    const marcasAqui = estado.storedMarks ?? $from.marks();
    despachar(estado.tr.replaceSelectionWith(tipos['quebraLinha']!.create(null, null, marcasAqui), true).scrollIntoView());
  }
  return true;
};

export const desfazer: Command = undo;
export const refazer: Command = redo;

/** Teclas do editor de seção (vêm antes do `baseKeymap`). */
export const TECLAS_SECAO: Readonly<Record<string, Command>> = {
  'Mod-z': desfazer,
  'Mod-y': refazer,
  'Shift-Mod-z': refazer,
  'Mod-i': alternarMarca('italico'),
  'Mod-b': alternarMarca('negrito'),
  // Ctrl+Shift+= no ABNT2 chega como "+" (Shift+=) ou "=", conforme o leiaute; os dois nomes valem.
  'Shift-Mod-=': alternarMarca('sobrescrito'),
  'Mod-+': alternarMarca('sobrescrito'),
  'Mod-=': alternarMarca('subscrito'),
  'Mod-Alt-f': inserirNota,
  // Com Caps Lock o Windows manda "F"; e Ctrl+Alt (AltGr) não tem a volta pelo código da tecla no prosemirror-keymap.
  'Mod-Alt-F': inserirNota,
  'Shift-Enter': quebrarLinha,
};

/** `baseKeymap` com a quebra de linha no Shift+Enter antes do comportamento padrão. */
export const TECLAS_BASE: Readonly<Record<string, Command>> = {
  ...baseKeymap,
  'Shift-Enter': chainCommands(quebrarLinha, baseKeymap['Enter']!),
};
