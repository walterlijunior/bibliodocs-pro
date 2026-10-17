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
import { EditorState } from 'prosemirror-state';
import { pluginColagem, type OpcoesColagem } from './colagem';
import { TECLAS_BASE, TECLAS_SECAO } from './comandos';
import { secaoParaDoc, type ConteudoSecao } from './conversao';
import type { GeradorId } from './ids';
import { pluginIdsUnicos } from './plugins/ids-unicos';
import { pluginLimites } from './plugins/limites';

export interface OpcoesEstadoSecao {
  gerarId?: GeradorId;
  /** Avisos da colagem (imagem, tabela, limite…), como `AvisoColagem`. */
  aoAvisar?: OpcoesColagem['aoAvisar'];
}

/** Estado novo para a seção: documento convertido do modelo, histórico vazio. */
export function criarEstadoSecao(secao: ConteudoSecao, opcoes: OpcoesEstadoSecao = {}): EditorState {
  return EditorState.create({
    doc: secaoParaDoc(secao),
    plugins: [
      history(),
      keymap(TECLAS_SECAO),
      keymap(TECLAS_BASE),
      pluginColagem({ ...(opcoes.gerarId ? { gerarId: opcoes.gerarId } : {}), ...(opcoes.aoAvisar ? { aoAvisar: opcoes.aoAvisar } : {}) }),
      pluginIdsUnicos(opcoes.gerarId),
      pluginLimites(),
    ],
  });
}
