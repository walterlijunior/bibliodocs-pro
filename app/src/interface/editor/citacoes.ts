/**
 * Citação no editor de seção (M4-T07; RF-07). Puro: roda em Node com `prosemirror-state`.
 *
 * A chamada é o nó atômico `chamadaCitacao`, ligado às obras por id (`dados`, o `InlineCitacao` sem tipo e id). O texto
 * dela nunca entra no documento: a tela o pede ao formatador (`chamada-view.ts`), o DOCX ao motor.
 *
 * - Inserir vai para o fim da seleção, sem apagar o que está selecionado (como a nota), e o cursor fica depois da
 *   chamada. Inserir, alterar e retirar são passos próprios do histórico de texto (não se juntam ao que foi digitado
 *   antes): Ctrl+Z desfaz junto com o texto, um passo por vez.
 * - Texto colado com "(AUTOR, ano)" de uma obra cadastrada: `chamadasEscritasNoDoc` acha as ocorrências e
 *   `ligarChamadasEscritas` troca cada uma pela chamada ligada, num passo só. Só com o aceite do usuário.
 */
import { closeHistory } from 'prosemirror-history';
import type { Node as NoPm } from 'prosemirror-model';
import { NodeSelection, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import type { DadosCitacao } from '../../aplicacao';
import { esquemaEditor } from './esquema';

const tipoChamada = esquemaEditor.nodes['chamadaCitacao']!;

export const dadosDaChamada = (no: NoPm): DadosCitacao => JSON.parse(String(no.attrs['dados'])) as DadosCitacao;

/**
 * Onde a janela da citação vai inserir ou alterar: o texto da seção ou o de uma nota aberta. `estado()` devolve `null`
 * quando o destino deixou de existir (a nota fechou).
 */
export interface AlvoCitacao {
  estado(): EditorState | null;
  despachar(tr: Transaction): void;
  focar(): void;
}

export interface ChamadaNoEditor {
  id: string;
  pos: number;
  dados: DadosCitacao;
}

/** A chamada selecionada (clique nela, ou setas até ela), ou `null`. */
export function chamadaSelecionada(estado: EditorState): ChamadaNoEditor | null {
  const s = estado.selection;
  if (!(s instanceof NodeSelection) || s.node.type !== tipoChamada) return null;
  return { id: String(s.node.attrs['id']), pos: s.from, dados: dadosDaChamada(s.node) };
}

/** Lugar que aceita citação: parágrafo, alínea, citação longa. Não o título da seção. */
export const podeInserirCitacao = (estado: EditorState): boolean => estado.selection.$to.parent.type.contentMatch.matchType(tipoChamada) !== null;

export function inserirCitacao(dados: DadosCitacao): Command {
  return (estado, despachar) => {
    if (!podeInserirCitacao(estado)) return false;
    if (despachar) {
      const pos = estado.selection.to;
      const tr = estado.tr.insert(pos, tipoChamada.create({ id: null, dados: JSON.stringify(dados) }));
      tr.setSelection(TextSelection.create(tr.doc, pos + 1));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}

function posicaoDaChamada(doc: NoPm, id: string): number | null {
  let achada: number | null = null;
  doc.descendants((no, pos) => {
    if (achada !== null) return false;
    if (no.type === tipoChamada && no.attrs['id'] === id) achada = pos;
    return achada === null;
  });
  return achada;
}

export function alterarCitacao(id: string, dados: DadosCitacao): Command {
  return (estado, despachar) => {
    const pos = posicaoDaChamada(estado.doc, id);
    if (pos === null) return false;
    if (despachar) {
      const tr = estado.tr.setNodeMarkup(pos, null, { id, dados: JSON.stringify(dados) });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}

export function retirarCitacao(id: string): Command {
  return (estado, despachar) => {
    const pos = posicaoDaChamada(estado.doc, id);
    if (pos === null) return false;
    if (despachar) {
      const tr = estado.tr.delete(pos, pos + 1);
      tr.setSelection(TextSelection.create(tr.doc, pos));
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}

/** Chamada escrita à mão no editor que corresponde a uma obra: posições no documento do editor. */
export interface ChamadaEscritaNoDoc {
  de: number;
  ate: number;
  texto: string;
  dados: DadosCitacao;
}

/** Caractere que ocupa o lugar de um nó que não é texto (quebra de linha, nota, chamada): nenhuma chamada o contém. */
const FORA_DO_TEXTO = '￼';

/**
 * Procura, em cada bloco de texto que aceita citação (o título não), as chamadas que `reconhecer` acha no texto. O
 * texto dentro das notas não entra: a nota cola só texto, e a sugestão fica para o texto da seção.
 */
export function chamadasEscritasNoDoc(
  doc: NoPm,
  reconhecer: (texto: string) => readonly { inicio: number; fim: number; texto: string; dados: DadosCitacao }[],
): ChamadaEscritaNoDoc[] {
  const saida: ChamadaEscritaNoDoc[] = [];
  doc.descendants((bloco, posBloco) => {
    if (!bloco.isTextblock) return true;
    if (bloco.type.contentMatch.matchType(tipoChamada) === null) return false;
    // Texto do bloco e, para cada trecho, onde começa no texto e no documento.
    let texto = '';
    const trechos: { noTexto: number; noDoc: number }[] = [];
    bloco.forEach((filho, deslocamento) => {
      trechos.push({ noTexto: texto.length, noDoc: posBloco + 1 + deslocamento });
      texto += filho.isText ? filho.text! : FORA_DO_TEXTO;
    });
    const posicao = (i: number): number => {
      let t = trechos[0]!;
      for (const x of trechos) if (x.noTexto <= i) t = x;
      return t.noDoc + (i - t.noTexto);
    };
    for (const c of reconhecer(texto)) {
      if (c.texto.includes(FORA_DO_TEXTO)) continue;
      saida.push({ de: posicao(c.inicio), ate: posicao(c.fim - 1) + 1, texto: c.texto, dados: c.dados });
    }
    return false;
  });
  return saida;
}

/** Troca cada chamada escrita pela chamada ligada à obra, num passo só (Ctrl+Z devolve o texto). */
export function ligarChamadasEscritas(chamadas: readonly ChamadaEscritaNoDoc[]): Command {
  return (estado, despachar) => {
    if (chamadas.length === 0) return false;
    if (despachar) {
      const tr = estado.tr;
      for (const c of [...chamadas].sort((a, b) => b.de - a.de)) {
        tr.replaceWith(c.de, c.ate, tipoChamada.create({ id: null, dados: JSON.stringify(c.dados) }));
      }
      despachar(closeHistory(tr).scrollIntoView());
    }
    return true;
  };
}
