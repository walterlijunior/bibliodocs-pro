/**
 * Colagem e soltura no editor (M2-T05; ADR-0007, seção 5; R40). Único arquivo do app com `DOMParser`: o HTML da área de
 * transferência vira um `Document` inerte (sem scripts, sem carregar imagens) e é lido por `lerHtmlColado`. O caminho
 * de colagem do `prosemirror-view` (`readHTML`, que usa `innerHTML`) nunca roda: `handleDOMEvents` vem antes dele e
 * encerra o evento.
 *
 * Ctrl+Shift+V cola só o texto; pelo menu, "Colar sem formatação" chama `colarSemFormatacaoNaProxima` antes de pedir a
 * colagem ao principal (B5 da revisão do M2-T05). Arrastar dentro do próprio editor fica com o ProseMirror (é mover,
 * não colar).
 *
 * Só testável com DOM: o E2E com a área de transferência real está em `e2e/editor.spec.ts`. A leitura em si é testada
 * em Node.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { blocosParaSlice } from './conversao';
import { lerHtmlColado, lerTextoColado, neutralizarEstilos, type AvisoColagem, type NoHtml, type ResultadoColagem } from './html-colado';
import { gerarId as gerarIdPadrao, type GeradorId } from './ids';
import { excedeLimites } from './plugins/limites';

export const chaveColagem = new PluginKey('colagem');

export interface OpcoesColagem {
  gerarId?: GeradorId;
  /** Chamado quando a colagem descartou algo (imagem, tabela…); as mensagens estão em `MENSAGENS_AVISO`. */
  aoAvisar?: (avisos: readonly AvisoColagem[]) => void;
}

/**
 * O que se usa do `DataTransfer` e do `DOMParser`, como tipos estruturais: o arquivo também é compilado para Node (o
 * estado do editor, testado em Node, inclui o plugin de colagem), onde não há a lib DOM. No renderer valem os do
 * navegador.
 */
interface Transferencia {
  getData(formato: string): string;
  readonly files: { readonly length: number };
  readonly types: readonly string[];
}
declare const DOMParser: new () => { parseFromString(html: string, tipo: 'text/html'): { body: NoHtml } };

function lerTransferencia(dados: Transferencia, soTexto: boolean, gerar: GeradorId): ResultadoColagem | null {
  const html = soTexto ? '' : dados.getData('text/html');
  if (html) {
    const documento = new DOMParser().parseFromString(neutralizarEstilos(html), 'text/html');
    return lerHtmlColado(documento.body, gerar);
  }
  const texto = dados.getData('text/plain');
  if (texto) return lerTextoColado(texto, gerar);
  // Só arquivos ou imagem na área de transferência.
  return dados.files.length > 0 || dados.types.some((t) => t.startsWith('image/'))
    ? { blocos: [], avisos: ['imagem'] }
    : null;
}

/**
 * HTML da área de transferência como árvore inerte, para a janela da tabela ler a planilha colada (M5-T05). O mesmo
 * `DOMParser` e a mesma neutralização dos estilos da colagem no texto (regra E3: o `DOMParser` só existe aqui).
 */
export function arvoreDoHtmlColado(html: string): NoHtml {
  return new DOMParser().parseFromString(neutralizarEstilos(html), 'text/html').body;
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
    proximaSemFormatacao: () => {
      soTexto = true;
    },
    props: {
      handleDOMEvents: {
        // Foco saiu (por exemplo, para o editor de uma nota): o pedido do menu não vale para a colagem seguinte
        // (revisão do M2-T06, B2).
        blur: () => {
          soTexto = false;
          return false;
        },
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
          soTexto = false;
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

/** A próxima colagem neste editor fica só com o texto (o item "Colar sem formatação" do menu Editar). */
export function colarSemFormatacaoNaProxima(estado: EditorState): void {
  const spec = chaveColagem.get(estado)?.spec as { proximaSemFormatacao?: () => void } | undefined;
  spec?.proximaSemFormatacao?.();
}
