/**
 * Tabela e quadro (M5-T04; RF-09) e figura (M5-T06; RF-10) no editor de seção. Puros: rodam em Node.
 *
 * A tabela é um nó atômico com o bloco em `dados` (M5-T01). A janela da tabela edita o bloco e volta por aqui: inserir
 * cria o nó (o id vem do plugin de ids únicos) e alterar troca os `dados` mantendo o id. Cada um é um passo próprio no
 * histórico da seção, então Ctrl+Z desfaz a tabela na mesma ordem do texto (ADR-0007, seção 4).
 */
import { closeHistory } from 'prosemirror-history';
import type { NodeType, Node as NoPm } from 'prosemirror-model';
import { NodeSelection, type Command, type EditorState } from 'prosemirror-state';
import type { DadosFigura, DadosTabela } from '../../aplicacao';
import { esquemaEditor } from './esquema';

const tipoTabela = esquemaEditor.nodes['tabela']!;
const tipoIlustracao = esquemaEditor.nodes['ilustracao']!;
const tipoParagrafo = esquemaEditor.nodes['paragrafo']!;

export interface TabelaNoEditor {
  id: string;
  dados: DadosTabela;
}

/** Figura no editor (M5-T06): o mesmo nó atômico, com a ilustração em `dados`. */
export interface FiguraNoEditor {
  id: string;
  dados: DadosFigura;
}

export const dadosDoNo = (no: NoPm): DadosTabela => JSON.parse(String(no.attrs['dados'])) as DadosTabela;
export const dadosDaFigura = (no: NoPm): DadosFigura => JSON.parse(String(no.attrs['dados'])) as DadosFigura;

function selecionado(estado: EditorState, tipo: NodeType): { id: string; no: NoPm } | null {
  const s = estado.selection;
  if (!(s instanceof NodeSelection) || s.node.type !== tipo) return null;
  const id: unknown = s.node.attrs['id'];
  return typeof id === 'string' ? { id, no: s.node } : null;
}

/** A tabela selecionada (clique ou setas), para a janela alterar. */
export function tabelaSelecionada(estado: EditorState): TabelaNoEditor | null {
  const x = selecionado(estado, tipoTabela);
  return x && { id: x.id, dados: dadosDoNo(x.no) };
}

/** A figura selecionada, para a janela alterar. */
export function figuraSelecionada(estado: EditorState): FiguraNoEditor | null {
  const x = selecionado(estado, tipoIlustracao);
  return x && { id: x.id, dados: dadosDaFigura(x.no) };
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

const inserirAtomo = (tipo: NodeType, dados: unknown): Command => (estado, despachar) => {
    if (despachar) {
      const { de, ate } = lugarDaNova(estado);
      const tr = estado.tr.replaceWith(de, ate, tipo.create({ id: null, dados: JSON.stringify(dados) }));
      tr.setSelection(NodeSelection.create(tr.doc, de));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };

export const inserirTabela = (dados: DadosTabela): Command => inserirAtomo(tipoTabela, dados);
export const inserirFigura = (dados: DadosFigura): Command => inserirAtomo(tipoIlustracao, dados);

function posicaoDoAtomo(doc: NoPm, tipo: NodeType, id: string): number | null {
  let achada: number | null = null;
  doc.forEach((no, pos) => {
    if (achada === null && no.type === tipo && no.attrs['id'] === id) achada = pos;
  });
  return achada;
}

export const alterarTabela = (id: string, dados: DadosTabela): Command => alterarAtomo(tipoTabela, id, dados);
export const alterarFigura = (id: string, dados: DadosFigura): Command => alterarAtomo(tipoIlustracao, id, dados);

function alterarAtomo(tipo: NodeType, id: string, dados: unknown): Command {
  return (estado, despachar) => {
    const pos = posicaoDoAtomo(estado.doc, tipo, id);
    if (pos === null) return false;
    if (despachar) {
      const tr = estado.tr.setNodeMarkup(pos, null, { id, dados: JSON.stringify(dados) });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}
