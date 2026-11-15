/**
 * Título da seção pelo painel Seções (Etapa 2 da especificação de atualização, D-E2-04). A página mostra o número e o
 * título gerados pela estrutura; a área de digitação é só do corpo.
 *
 * - O plugin recusa a transação que muda o texto do título, salvo a do painel (`META_TITULO`) e a do desfazer e
 *   refazer (que volta a renomeação junto com o texto, na ordem única do histórico).
 * - O cursor que cair no título (clique, setas, Ctrl+Home) vai para o começo do corpo. A seção sem corpo nasce com um
 *   parágrafo vazio no editor (`criarEstadoSecao`), que só vai para o arquivo quando o autor escreve.
 * Puro: roda em Node nos testes.
 */
import { closeHistory } from 'prosemirror-history';
import { Plugin, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { esquemaEditor } from './esquema';

export const META_TITULO = 'bdTituloPeloPainel';
const META_HISTORICO = 'history$';

const tituloMudou = (antes: EditorState['doc'], depois: EditorState['doc']): boolean => {
  const a = antes.firstChild;
  const b = depois.firstChild;
  return !a || !b || a.type !== b.type || !a.content.eq(b.content);
};

export const pluginTituloPeloPainel = new Plugin({
  filterTransaction: (tr, estado) => {
    if (!tr.docChanged || tr.getMeta(META_TITULO) || tr.getMeta(META_HISTORICO) !== undefined) return true;
    // Colagem que cobre o documento inteiro, por exemplo, não pode reescrever o título.
    return !tituloMudou(estado.doc, tr.doc);
  },
  appendTransaction: (_trs, _antes, estado) => {
    const { $from } = estado.selection;
    if ($from.depth === 0 || $from.index(0) !== 0 || estado.doc.childCount < 2) return null;
    // Cursor no título: vai ao começo do corpo quando ele começa por texto (só a seleção: o documento não muda). Com
    // tabela ou figura no começo, fica no título: digitar ali não muda nada, e inserir põe o elemento antes do primeiro.
    if (!estado.doc.child(1).isTextblock) return null;
    return estado.tr.setSelection(TextSelection.create(estado.doc, estado.doc.firstChild!.nodeSize + 1));
  },
});

/** Troca o texto do título (renomear pelo painel), como passo próprio do histórico. */
export function renomearTitulo(texto: string): Command {
  return (estado, despachar) => {
    const titulo = estado.doc.firstChild;
    if (!titulo) return false;
    const limpo = texto.replace(/\s+/g, ' ').trim();
    if (despachar) {
      const conteudo = limpo === '' ? [] : [esquemaEditor.text(limpo)];
      const tr = estado.tr.replaceWith(1, 1 + titulo.content.size, conteudo).setMeta(META_TITULO, true);
      despachar(closeHistory(tr));
    }
    return true;
  };
}
