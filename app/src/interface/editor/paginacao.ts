/**
 * Folhas no editor (Etapa 2 da especificação de atualização, D-E2-07): o texto segue para a folha seguinte.
 *
 * O editor é uma faixa contínua desenhada como folhas do tamanho da página do perfil, separadas por um intervalo (o
 * fundo da faixa repete "folha, intervalo"). Depois de cada mudança, o plugin mede os blocos do topo: o bloco que
 * passaria do fim da área de texto de uma folha, e que não começa no topo dela, ganha antes de si um espaçador que o
 * leva ao começo da área de texto da folha seguinte (margem de baixo + intervalo + margem de cima).
 *
 * - Só tela: o espaçador é decoração (widget), fora do documento, do arquivo e do histórico.
 * - Bloco mais alto que uma folha (parágrafo ou tabela muito longos) não se divide: segue pela folha seguinte, como
 *   na prévia aproximada; a quebra exata das linhas é a do Word, no DOCX.
 * - A transação que troca os espaçadores só leva metadado (o documento não muda): não marca o trabalho como alterado.
 */
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { calcularEspacadores, type Espacador, type MedidasFolha } from './paginacao-calculo';

export { calcularEspacadores, type MedidasFolha } from './paginacao-calculo';

interface EstadoPaginacao {
  espacadores: Espacador[];
  decoracoes: DecorationSet;
}

export const chavePaginacao = new PluginKey<EstadoPaginacao>('bdPaginacao');

function decoracoes(estado: EditorState, lista: readonly Espacador[]): DecorationSet {
  return DecorationSet.create(
    estado.doc,
    lista.map((e) =>
      Decoration.widget(
        e.pos,
        () => {
          const div = document.createElement('div');
          div.className = 'bd-salto-folha';
          div.contentEditable = 'false';
          div.setAttribute('aria-hidden', 'true');
          div.style.height = `${e.altura}px`;
          return div;
        },
        { side: -1, key: `folha-${e.pos}-${Math.round(e.altura)}`, ignoreSelection: true },
      ),
    ),
  );
}

const iguais = (a: readonly Espacador[], b: readonly Espacador[]) => a.length === b.length && a.every((x, i) => x.pos === b[i]!.pos && Math.abs(x.altura - b[i]!.altura) < 1);

export function pluginPaginacao(medidas: (view: EditorView) => MedidasFolha | null): Plugin {
  return new Plugin<EstadoPaginacao>({
    key: chavePaginacao,
    state: {
      init: (): EstadoPaginacao => ({ espacadores: [], decoracoes: DecorationSet.empty }),
      apply(tr: Transaction, valor: EstadoPaginacao, _antes: EditorState, estado: EditorState): EstadoPaginacao {
        const novos = tr.getMeta(chavePaginacao) as Espacador[] | undefined;
        if (novos) return { espacadores: novos, decoracoes: decoracoes(estado, novos) };
        if (!tr.docChanged) return valor;
        // Até a próxima medida, os espaçadores acompanham o texto.
        const espacadores = valor.espacadores.map((e) => ({ ...e, pos: tr.mapping.map(e.pos, -1) }));
        return { espacadores, decoracoes: valor.decoracoes.map(tr.mapping, tr.doc) };
      },
    },
    props: {
      decorations: (estado) => chavePaginacao.getState(estado)?.decoracoes ?? DecorationSet.empty,
    },
    view(view) {
      let quadro = 0;
      const medir = () => {
        quadro = 0;
        const m = medidas(view);
        if (!m || !view.dom.isConnected) return;
        const atuais = chavePaginacao.getState(view.state)?.espacadores ?? [];
        const blocos: { pos: number; topo: number; altura: number }[] = [];
        view.state.doc.forEach((_no, pos) => {
          const el = view.nodeDOM(pos);
          if (!(el instanceof HTMLElement)) return;
          const antes = atuais.filter((e) => e.pos <= pos).reduce((s, e) => s + e.altura, 0);
          const estilo = getComputedStyle(el);
          blocos.push({ pos, topo: el.offsetTop - antes, altura: el.offsetHeight + (Number.parseFloat(estilo.marginBottom) || 0) });
        });
        const { espacadores, folhas } = calcularEspacadores(blocos, m);
        view.dom.style.minHeight = `${folhas * (m.altura + m.intervalo) - m.intervalo}px`;
        if (!iguais(espacadores, atuais)) view.dispatch(view.state.tr.setMeta(chavePaginacao, espacadores).setMeta('addToHistory', false));
      };
      const agendar = () => {
        if (quadro === 0) quadro = requestAnimationFrame(medir);
      };
      const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(agendar) : null;
      observador?.observe(view.dom);
      agendar();
      return {
        update: agendar,
        destroy: () => {
          if (quadro) cancelAnimationFrame(quadro);
          observador?.disconnect();
        },
      };
    },
  });
}
