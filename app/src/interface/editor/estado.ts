/**
 * Estado do editor de uma seção (M2-T06; ADR-0007, seções 2 a 5). Puro: roda em Node com `prosemirror-state`.
 *
 * Todo `EditorState` de seção nasce aqui, com os plugins de que a gravação depende (instrução do M2-T05):
 * - `pluginIdsUnicos`: id repetido torna o `.bdp` ilegível (R38);
 * - `pluginLimites`: acima dos limites do v1 a leitura recusaria o arquivo;
 * - `pluginColagem`: a colagem nunca passa pelo `innerHTML` da biblioteca (R40);
 * - histórico de texto da seção e as teclas de `comandos.ts`.
 */
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Fragment } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { esquemaEditor } from './esquema';
import { pluginColagem, type OpcoesColagem } from './colagem';
import { TECLAS_BASE, TECLAS_SECAO } from './comandos';
import { secaoParaDoc, type ConteudoSecao } from './conversao';
import { gerarId, type GeradorId } from './ids';
import { pluginIdsUnicos } from './plugins/ids-unicos';
import { pluginLimites } from './plugins/limites';
import { pluginTituloPeloPainel } from './titulo-painel';

export interface OpcoesEstadoSecao {
  gerarId?: GeradorId;
  /** Avisos da colagem (imagem, tabela, limite…), como `AvisoColagem`. */
  aoAvisar?: OpcoesColagem['aoAvisar'];
  /** Etapa 2 (D-E2-04): o título só muda pelo painel Seções (e pelo desfazer); o cursor fica no corpo. */
  tituloPeloPainel?: boolean;
}

/** Estado novo para a seção: documento convertido do modelo, histórico vazio. */
export function criarEstadoSecao(secao: ConteudoSecao, opcoes: OpcoesEstadoSecao = {}): EditorState {
  // Título pelo painel: a seção sem corpo ganha um parágrafo vazio para o cursor (o título não se edita na página),
  // e o cursor começa no corpo.
  let doc = secaoParaDoc(secao);
  if (opcoes.tituloPeloPainel && doc.childCount === 1) doc = doc.copy(doc.content.append(Fragment.from(esquemaEditor.nodes['paragrafo']!.create({ id: (opcoes.gerarId ?? gerarId)('par') }))));
  const selection = opcoes.tituloPeloPainel && doc.childCount > 1 && doc.child(1).isTextblock ? TextSelection.create(doc, doc.firstChild!.nodeSize + 1) : undefined;
  return EditorState.create({
    doc,
    ...(selection ? { selection } : {}),
    plugins: [
      history(),
      keymap(TECLAS_SECAO),
      keymap(TECLAS_BASE),
      pluginColagem({ ...(opcoes.gerarId ? { gerarId: opcoes.gerarId } : {}), ...(opcoes.aoAvisar ? { aoAvisar: opcoes.aoAvisar } : {}) }),
      pluginIdsUnicos(opcoes.gerarId),
      pluginLimites(),
      ...(opcoes.tituloPeloPainel ? [pluginTituloPeloPainel] : []),
    ],
  });
}
