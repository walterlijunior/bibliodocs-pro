/**
 * Colagem e soltura no editor (M2-T05; ADR-0007, seção 5; R40). Único arquivo do app com `DOMParser`: o HTML da área de
 * transferência vira um `Document` inerte (sem scripts, sem carregar imagens) e é lido por `lerHtmlColado`. O caminho
 * de colagem do `prosemirror-view` (`readHTML`, que usa `innerHTML`) nunca roda: `handleDOMEvents` vem antes dele e
 * encerra o evento.
 *
 * Ctrl+Shift+V cola só o texto. Arrastar dentro do próprio editor fica com o ProseMirror (é mover, não colar).
 *
 * Só testável com DOM: o E2E entra com o editor na tela (M2-T06). A leitura em si é testada em Node.
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { blocosParaSlice } from './conversao';
import { lerHtmlColado, lerTextoColado, type AvisoColagem, type ResultadoColagem } from './html-colado';
import { gerarId as gerarIdPadrao, type GeradorId } from './ids';
import { excedeLimites } from './plugins/limites';

export const chaveColagem = new PluginKey('colagem');

export interface OpcoesColagem {
  gerarId?: GeradorId;
  /** Chamado quando a colagem descartou algo (imagem, tabela…); as mensagens estão em `MENSAGENS_AVISO`. */
  aoAvisar?: (avisos: readonly AvisoColagem[]) => void;
}

function lerTransferencia(dados: DataTransfer, soTexto: boolean, gerar: GeradorId): ResultadoColagem | null {
  const html = soTexto ? '' : dados.getData('text/html');
  if (html) {
    const documento = new DOMParser().parseFromString(html, 'text/html');
    return lerHtmlColado(documento.body, gerar);
  }
  const texto = dados.getData('text/plain');
  if (texto) return lerTextoColado(texto, gerar);
  // Só arquivos ou imagem na área de transferência.
  return dados.files.length > 0 || dados.types.some((t) => t.startsWith('image/'))
    ? { blocos: [], avisos: ['imagem'] }
    : null;
}

export function pluginColagem(opcoes: OpcoesColagem = {}): Plugin {
  const gerar = opcoes.gerarId ?? gerarIdPadrao;
  let soTexto = false;

  const inserir = (view: EditorView, resultado: ResultadoColagem | null, pos?: number): void => {
    if (!resultado) return;
    if (resultado.blocos.length === 0) {
      if (resultado.avisos.length > 0) opcoes.aoAvisar?.(resultado.avisos);
      return;
    }
    const fatia = blocosParaSlice(resultado.blocos);
    const tr = view.state.tr;
    if (pos === undefined) tr.replaceSelection(fatia);
    else tr.replaceRange(pos, pos, fatia);
    // Acima dos limites do v1 o plugin de limites recusaria a transação em silêncio: aqui o usuário é avisado.
    if (excedeLimites(tr.doc)) {
      opcoes.aoAvisar?.(['limite']);
      return;
    }
    if (resultado.avisos.length > 0) opcoes.aoAvisar?.(resultado.avisos);
    view.dispatch(tr.scrollIntoView().setMeta('uiEvent', pos === undefined ? 'paste' : 'drop'));
  };

  return new Plugin({
    key: chaveColagem,
    props: {
      handleDOMEvents: {
        keydown: (_view, evento) => {
          if (evento.key.toLowerCase() === 'v' && (evento.ctrlKey || evento.metaKey)) soTexto = evento.shiftKey;
          return false;
        },
        paste: (view, evento) => {
          evento.preventDefault();
          const semFormatacao = soTexto;
          soTexto = false;
          if (evento.clipboardData) inserir(view, lerTransferencia(evento.clipboardData, semFormatacao, gerar));
          return true;
        },
        drop: (view, evento) => {
          if (view.dragging || !evento.dataTransfer) return false; // mover dentro do editor
          evento.preventDefault();
          const alvo = view.posAtCoords({ left: evento.clientX, top: evento.clientY });
          if (alvo) inserir(view, lerTransferencia(evento.dataTransfer, false, gerar), alvo.pos);
          return true;
        },
      },
    },
  });
}
