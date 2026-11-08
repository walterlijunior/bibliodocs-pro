/**
 * Nota de rodapé no editor (M2-T06; ADR-0007, seção 2): a chamada é um nó atômico no texto e o conteúdo se edita num
 * editor aninhado, aberto quando a chamada é selecionada (clique, setas ou logo depois de Ctrl+Alt+F). Segue o exemplo
 * de notas do ProseMirror: cada passo do editor da nota vira um passo no editor da seção, deslocado para dentro do
 * nó, de modo que o histórico, os ids, os limites e a conversão para o modelo são os da seção.
 *
 * - O número da nota não aparece (a numeração é do documento inteiro e ainda é PENDENTE-FONTE, RN-102): a chamada mostra
 *   a marca "nota", e o leitor de tela ouve "Nota de rodapé" com o começo do texto.
 * - A nota tem um parágrafo só: Enter e Esc voltam ao texto da seção; Shift+Enter é quebra de linha.
 * - Colar na nota cola só o texto, sem o `readHTML` da biblioteca (que usa `innerHTML`, R40); soltar é recusado.
 * - Citação na nota (M4-T07): Ctrl+Shift+C no texto da nota pede a janela da citação com a nota como destino; a chamada
 *   aparece como no texto da seção (`ChamadaView`); duplo clique, ou Enter com ela selecionada, abre para alterar.
 */
import { toggleMark } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import type { Node as NoPm } from 'prosemirror-model';
import { EditorState, NodeSelection, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { StepMap } from 'prosemirror-transform';
import { EditorView, type NodeView } from 'prosemirror-view';
import { ChamadaView, copiaComChamadas, RegistroChamadas } from './chamada-view';
import { chamadaSelecionada, podeInserirCitacao, type AlvoCitacao, type ChamadaNoEditor } from './citacoes';
import { desfazer, quebrarLinha, refazer } from './comandos';
import { CARACTERES_FORA_DO_XML } from './conversao';
import { esquemaEditor } from './esquema';
import { podeInserirSigla, siglaSelecionada, type SiglaNoEditor } from './siglas';
import { SiglaView, type RegistroSiglas } from './sigla-view';

/** Começo do texto da nota no nome acessível da chamada. */
const LIMITE_ROTULO = 80;

export const rotuloNota = (no: NoPm): string => {
  const texto = no.textContent.replace(/\s+/g, ' ').trim();
  if (texto === '') return 'Nota de rodapé vazia';
  return `Nota de rodapé: ${texto.length > LIMITE_ROTULO ? `${texto.slice(0, LIMITE_ROTULO)}…` : texto}`;
};

/** Citação dentro da nota (M4-T07): o formatador das chamadas e quem abre a janela. */
export interface CitacaoNaNota {
  registro: RegistroChamadas;
  pedir: (existente: ChamadaNoEditor | null, alvo: AlvoCitacao) => void;
}
export interface SiglaNaNota {
  registro: RegistroSiglas;
  pedir: (existente: SiglaNoEditor | null, alvo: AlvoCitacao) => void;
}

export class NotaView implements NodeView {
  dom: HTMLElement;
  #no: NoPm;
  readonly #externo: EditorView;
  readonly #posicao: () => number | undefined;
  #painel: HTMLElement | null = null;
  #interno: EditorView | null = null;

  readonly #aoRecusar: () => void;
  readonly #historico: ((sentido: 'desfazer' | 'refazer') => boolean) | undefined;
  readonly #citacao: CitacaoNaNota | undefined;
  readonly #aoDestruir: (() => void) | undefined;
  readonly #sigla: SiglaNaNota | undefined;

  /**
   * `aoRecusar`: a seção recusou a alteração feita na nota (o editor mostra o aviso de limite). `historico`: Ctrl+Z e
   * Ctrl+Y na nota vão para a ordem única de desfazer do trabalho (M2-T07); sem ela, para o histórico da seção.
   */
  constructor(
    no: NoPm,
    externo: EditorView,
    posicao: () => number | undefined,
    aoRecusar: () => void = () => {},
    historico?: (sentido: 'desfazer' | 'refazer') => boolean,
    citacao?: CitacaoNaNota,
    aoDestruir?: () => void,
    sigla?: SiglaNaNota,
  ) {
    this.#no = no;
    this.#externo = externo;
    this.#posicao = posicao;
    this.#aoRecusar = aoRecusar;
    this.#historico = historico;
    this.#citacao = citacao;
    this.#aoDestruir = aoDestruir;
    this.#sigla = sigla;
    this.dom = document.createElement('span');
    this.dom.className = 'bd-nota';
    // Papel de chamada de nota (DPUB-ARIA): sem papel, o `aria-label` de um `span` é ignorado (revisão do M2-T06, M3).
    this.dom.setAttribute('role', 'doc-noteref');
    this.#rotular();
  }

  #rotular(): void {
    const rotulo = rotuloNota(this.#no);
    this.dom.setAttribute('aria-label', rotulo);
    this.dom.title = rotulo;
    if (this.#no.attrs['id']) this.dom.dataset['id'] = String(this.#no.attrs['id']);
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    // Somente leitura: o clique ainda seleciona o nó, mas o texto da nota não abre para edição (revisão do M2-T06, M1).
    if (!this.#interno && this.#externo.editable) this.#abrir();
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    if (this.#interno) this.#fechar();
  }

  /** Volta ao texto da seção, com o cursor logo depois da chamada. */
  #voltar = (): boolean => {
    const pos = this.#posicao();
    if (pos === undefined) return false;
    const estado = this.#externo.state;
    this.#externo.dispatch(estado.tr.setSelection(TextSelection.create(estado.doc, pos + this.#no.nodeSize)));
    this.#externo.focus();
    return true;
  };

  #abrir(): void {
    const painel = document.createElement('span');
    painel.className = 'bd-nota__painel';
    painel.setAttribute('role', 'group');
    painel.setAttribute('aria-label', 'Texto da nota de rodapé');
    this.dom.appendChild(painel);
    this.#painel = painel;
    const externo = (c: Command): (() => boolean) => () => c(this.#externo.state, this.#externo.dispatch);
    const historico = this.#historico;
    // Sempre consumida (revisão do M2-T07, A1): sem nada a desfazer, a tecla não segue para o desfazer do navegador.
    const desfazerNota = historico ? () => (historico('desfazer'), true) : externo(desfazer);
    const refazerNota = historico ? () => (historico('refazer'), true) : externo(refazer);
    const voltar = this.#voltar;
    const pedirCitacao = (): boolean => this.pedirCitacao();
    const pedirSigla = (): boolean => this.pedirSigla();
    const registro = this.#citacao?.registro;
    this.#interno = new EditorView(painel, {
      state: EditorState.create({
        doc: this.#no,
        plugins: [
          keymap({
            'Mod-z': desfazerNota,
            'Mod-y': refazerNota,
            'Shift-Mod-z': refazerNota,
            'Mod-i': toggleMark(esquemaEditor.marks['italico']!),
            'Mod-b': toggleMark(esquemaEditor.marks['negrito']!),
            'Shift-Mod-=': toggleMark(esquemaEditor.marks['sobrescrito']!),
            'Mod-+': toggleMark(esquemaEditor.marks['sobrescrito']!),
            'Mod-=': toggleMark(esquemaEditor.marks['subscrito']!),
            'Shift-Enter': quebrarLinha,
            // Consumida: no texto da nota, o atalho nunca vai para a seção (a citação entraria fora da nota).
            'Shift-Mod-c': () => (pedirCitacao(), true),
            Enter: (estado) => siglaSelecionada(estado) !== null ? pedirSigla() : chamadaSelecionada(estado) !== null ? pedirCitacao() : voltar(),
            Escape: voltar,
          }),
        ],
      }),
      dispatchTransaction: (tr) => this.#despacharInterno(tr),
      ...copiaComChamadas(registro ?? new RegistroChamadas(), undefined, this.#sigla?.registro),
      nodeViews: {
        ...(registro ? {
              chamadaCitacao: (no: NoPm, v: EditorView, pos: () => number | undefined) =>
                new ChamadaView(no, registro, () => {
                  const p = pos();
                  if (p === undefined) return;
                  v.dispatch(v.state.tr.setSelection(NodeSelection.create(v.state.doc, p)));
                  pedirCitacao();
                }),
        } : {}),
        ...(this.#sigla ? {
          sigla: (no: NoPm, v: EditorView, pos: () => number | undefined) => new SiglaView(no, this.#sigla!.registro, () => {
            const p = pos();
            if (p === undefined) return;
            v.dispatch(v.state.tr.setSelection(NodeSelection.create(v.state.doc, p)));
            pedirSigla();
          }),
        } : {}),
      },
      attributes: { class: 'bd-nota__editor', 'aria-multiline': 'true', role: 'textbox', 'aria-label': 'Texto da nota de rodapé' },
      handleDOMEvents: {
        mousedown: () => {
          // Clique dentro do editor da nota: o editor da seção não deve tratar (senão a nota perde a seleção).
          if (this.#externo.hasFocus() && this.#interno) this.#interno.focus();
          return false;
        },
        paste: (view, evento) => {
          evento.preventDefault();
          const texto = (evento.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?|\n/g, ' ').replace(CARACTERES_FORA_DO_XML, '');
          if (texto !== '') view.dispatch(view.state.tr.insertText(texto).scrollIntoView());
          return true;
        },
        drop: (_view, evento) => {
          evento.preventDefault();
          return true;
        },
      },
    });
  }

  #fechar(): void {
    this.#interno?.destroy();
    this.#interno = null;
    this.#painel?.remove();
    this.#painel = null;
  }

  /** Cada passo do editor da nota vai para o editor da seção, deslocado para dentro do nó. */
  #despacharInterno(tr: Transaction): void {
    const interno = this.#interno;
    if (!interno) return;
    const anterior = interno.state;
    const { state, transactions } = anterior.applyTransaction(tr);
    interno.updateState(state);
    if (tr.getMeta('deFora') || !tr.docChanged) return;
    // Revisão do M2-T06 (M2): se a seção não aceitar os passos (posição perdida, ou o plugin de limites recusou), o
    // editor da nota volta ao que era, para nunca mostrar texto que não está no modelo.
    const pos = this.#posicao();
    const docAntes = this.#externo.state.doc;
    if (pos !== undefined) {
      const externoTr = this.#externo.state.tr;
      const deslocamento = StepMap.offset(pos + 1);
      for (const t of transactions) for (const passo of t.steps) {
        const mapeado = passo.map(deslocamento);
        if (mapeado) externoTr.step(mapeado);
      }
      if (externoTr.docChanged) this.#externo.dispatch(externoTr);
    }
    if (this.#externo.state.doc === docAntes) {
      interno.updateState(anterior);
      this.#aoRecusar();
    }
  }

  update(no: NoPm): boolean {
    if (!no.sameMarkup(this.#no)) return false;
    this.#no = no;
    this.#rotular();
    const interno = this.#interno;
    if (interno) {
      // Mudança vinda da seção (desfazer, refazer): o editor da nota acompanha.
      const estado = interno.state;
      const inicio = no.content.findDiffStart(estado.doc.content);
      if (inicio !== null) {
        let { a: fimA, b: fimB } = no.content.findDiffEnd(estado.doc.content)!;
        const sobra = inicio - Math.min(fimA, fimB);
        if (sobra > 0) {
          fimA += sobra;
          fimB += sobra;
        }
        interno.dispatch(estado.tr.replace(inicio, fimB, no.slice(inicio, fimA)).setMeta('deFora', true));
      }
    }
    return true;
  }

  /** O foco está no texto desta nota (o botão e o menu de citação vão para ela). */
  temFoco(): boolean {
    return this.#interno !== null && this.#interno.hasFocus();
  }

  /** Pede a janela da citação com o texto da nota como destino. `false` = nota fechada ou sem citação. */
  pedirCitacao(): boolean {
    const interno = this.#interno;
    const citacao = this.#citacao;
    if (!interno || !citacao || !this.#externo.editable) return false;
    const existente = chamadaSelecionada(interno.state);
    if (existente === null && !podeInserirCitacao(interno.state)) return false;
    citacao.pedir(existente, {
      estado: () => (this.#interno === interno ? interno.state : null),
      despachar: (tr) => interno.dispatch(tr),
      focar: () => {
        if (this.#interno === interno) interno.focus();
        else this.#externo.focus();
      },
    });
    return true;
  }

  pedirSigla(): boolean {
    const interno = this.#interno;
    const sigla = this.#sigla;
    if (!interno || !sigla || !this.#externo.editable) return false;
    const existente = siglaSelecionada(interno.state);
    if (existente === null && !podeInserirSigla(interno.state)) return false;
    sigla.pedir(existente, {
      estado: () => this.#interno === interno ? interno.state : null,
      despachar: (tr) => interno.dispatch(tr),
      focar: () => { if (this.#interno === interno) interno.focus(); else this.#externo.focus(); },
    });
    return true;
  }

  /** Foca o editor da nota, se aberto (depois de inserir uma nota). */
  focar(): boolean {
    if (!this.#interno) return false;
    this.#interno.focus();
    return true;
  }

  destroy(): void {
    this.#fechar();
    this.#aoDestruir?.();
  }

  stopEvent(evento: Event): boolean {
    return this.#painel !== null && evento.target instanceof Node && this.#painel.contains(evento.target);
  }

  ignoreMutation(): boolean {
    return true;
  }
}
