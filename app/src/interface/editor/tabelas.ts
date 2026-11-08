/**
 * Tabela e quadro no editor de seção (M5-T04; RF-09). Puros: rodam em Node.
 *
 * A tabela é um nó atômico com o bloco em `dados` (M5-T01). A janela da tabela edita o bloco e volta por aqui: inserir
 * cria o nó (o id vem do plugin de ids únicos) e alterar troca os `dados` mantendo o id. Cada um é um passo próprio no
 * histórico da seção, então Ctrl+Z desfaz a tabela na mesma ordem do texto (ADR-0007, seção 4).
 */
import { closeHistory } from 'prosemirror-history';
import type { Node as NoPm } from 'prosemirror-model';
import { NodeSelection, type Command, type EditorState } from 'prosemirror-state';
import type { DadosTabela } from '../../aplicacao';
import { esquemaEditor } from './esquema';

const tipoTabela = esquemaEditor.nodes['tabela']!;
const tipoParagrafo = esquemaEditor.nodes['paragrafo']!;

export interface TabelaNoEditor {
  id: string;
  dados: DadosTabela;
}

export const dadosDoNo = (no: NoPm): DadosTabela => JSON.parse(String(no.attrs['dados'])) as DadosTabela;

/** A tabela selecionada (clique ou setas), para a janela alterar. */
export function tabelaSelecionada(estado: EditorState): TabelaNoEditor | null {
  const s = estado.selection;
  if (!(s instanceof NodeSelection) || s.node.type !== tipoTabela) return null;
  const id: unknown = s.node.attrs['id'];
  return typeof id === 'string' ? { id, dados: dadosDoNo(s.node) } : null;
}

/** Onde a tabela nova entra: no lugar do parágrafo vazio do cursor, ou depois do bloco do cursor (do título, no começo). */
function lugarDaNova(estado: EditorState): { de: number; ate: number } {
  const { $from } = estado.selection;
  const indice = $from.index(0);
  let pos = 0;
  for (let i = 0; i < indice; i++) pos += estado.doc.child(i).nodeSize;
  const bloco = estado.doc.child(indice);
  const fim = pos + bloco.nodeSize;
  if (indice > 0 && bloco.type === tipoParagrafo && bloco.content.size === 0) return { de: pos, ate: fim };
  return { de: fim, ate: fim };
}

export function inserirTabela(dados: DadosTabela): Command {
  return (estado, despachar) => {
    if (despachar) {
      const { de, ate } = lugarDaNova(estado);
      const tr = estado.tr.replaceWith(de, ate, tipoTabela.create({ id: null, dados: JSON.stringify(dados) }));
      tr.setSelection(NodeSelection.create(tr.doc, de));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}

function posicaoDaTabela(doc: NoPm, id: string): number | null {
  let achada: number | null = null;
  doc.forEach((no, pos) => {
    if (achada === null && no.type === tipoTabela && no.attrs['id'] === id) achada = pos;
  });
  return achada;
}

export function alterarTabela(id: string, dados: DadosTabela): Command {
  return (estado, despachar) => {
    const pos = posicaoDaTabela(estado.doc, id);
    if (pos === null) return false;
    if (despachar) {
      const tr = estado.tr.setNodeMarkup(pos, null, { id, dados: JSON.stringify(dados) });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}
