// Editor de uma seção na aba Escrever (M2-T06; ADR-0007, seção 3): o `EditorView` não é controlado pelo React (o React
// monta e desmonta; o `dispatchTransaction` aplica o estado). Cada transação que muda o documento é convertida na hora
// para o modelo e vai para a sessão (`aoAlterar`), de modo que nenhuma alteração fica só no editor: salvar, fechar e o
// instantâneo sempre veem o que foi digitado.
//
// O `EditorState` de cada seção visitada fica na `MemoriaEditores` (o histórico de texto sobrevive à troca de seção) até
// a sessão abrir outro trabalho (`geracao`). A barra de formatação reflete a seleção e só re-renderiza quando muda.
//
// M2-T07 (ADR-0007, seção 4): Ctrl+Z e Ctrl+Y vão para a ordem única de desfazer do trabalho (`aoHistorico`), que pode
// desfazer uma operação de estrutura ou o texto de outra seção. Cada passo novo do histórico de texto desta seção é
// avisado (`aoRegistrarTexto`), e o grupo de digitação se fecha quando a ordem única ganha outra entrada (outra seção,
// estrutura): sem isso, o que se digita logo depois juntaria com o passo de antes e sairia fora de ordem. O texto de uma seção que não está na tela é desfeito no estado guardado
// (`MemoriaEditores.aplicarHistorico`). Seção excluída: o estado continua guardado, e desfazer a exclusão a devolve com
// o texto e o histórico.
//
// M4-T07: citação. Ctrl+Shift+C, o botão "Citação" ou o menu Inserir › Citação… pedem a janela da citação
// (`aoPedirCitacao`), que volta pelo `ControleEditor`. A chamada mostra o texto do formatador atual (`RegistroChamadas`, na
// memória). Colar texto com "(AUTOR, ano)" de uma obra cadastrada mostra a sugestão de ligar as chamadas. Com o foco no
// texto de uma nota, a citação vai para a nota (`AlvoCitacao`).
import 'prosemirror-view/style/prosemirror.css';
import { closeHistory, isHistoryTransaction, redoDepth, undoDepth } from 'prosemirror-history';
import { keydownHandler } from 'prosemirror-keymap';
import { NodeSelection, TextSelection, type EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ChamadaEscrita, DadosCitacao, FormatadorDeChamadas } from '../../aplicacao';
import type { MarcaTexto } from '../../dominio/modelo';
import { ChamadaView, copiaComChamadas, RegistroChamadas } from './chamada-view';
import {
  alterarCitacao,
  chamadaSelecionada,
  blocosMudados,
  chamadasEscritasNoDoc,
  inserirCitacao,
  ligarChamadasEscritas,
  podeInserirCitacao,
  retirarCitacao,
  selecaoParaIr,
  type AlvoCitacao,
  type ChamadaEscritaNoDoc,
  type ChamadaNoEditor,
} from './citacoes';
import { colarSemFormatacaoNaProxima } from './colagem';
import { alternarAlineas, alternarCitacaoLonga, estaEmAlineas, estaEmCitacao } from './comandos-blocos';
import { alternarMarca, desfazer, inserirNota, marcaAtiva, META_ABRIR_NOTA, podeInserirNota, refazer } from './comandos';
import { docParaSecao, type ConteudoSecao } from './conversao';
import { criarEstadoSecao } from './estado';
import { MENSAGENS_AVISO, type AvisoColagem } from './html-colado';
import { NotaView } from './nota-view';

/** Desfazer ou refazer na ordem única do trabalho (texto e estrutura). */
export type SentidoHistorico = 'desfazer' | 'refazer';

/** Comandos que o menu Editar, o menu Inserir e a lista de seções mandam para o editor da seção aberta. */
export interface ControleEditor {
  /** Seção que o editor mostra. */
  readonly secaoId: string;
  /** Desfaz ou refaz um passo do histórico de texto desta seção (quem decide a ordem é o histórico único). */
  desfazer(): boolean;
  refazer(): boolean;
  inserirNota(): boolean;
  /** A próxima colagem neste editor fica só com o texto. */
  colarSemFormatacao(): void;
  focar(): void;
  /** Foco no título da seção, todo selecionado (Renomear, F2). */
  focarTitulo(): void;
  /** O próximo passo de texto começa um evento novo no histórico da seção (outra entrada entrou na ordem única). */
  fecharGrupo(): void;
  /** O foco está no editor da seção ou no de uma nota dela. */
  temFoco(): boolean;
  /** Pede a janela da citação: a chamada selecionada, ou uma nova no cursor (M4-T07); na nota, se o foco está nela. */
  pedirCitacao(): boolean;
  /** Foco de volta onde a citação foi pedida (texto da seção ou da nota), com a seleção do editor. */
  focarCitacao(): void;
  /** Leva ao nó com o `id` (bloco, nota ou chamada) e seleciona o `trecho`, se achado (M4-T08). `false` = não está aqui. */
  irPara(id: string, trecho?: string): boolean;
  inserirCitacao(dados: DadosCitacao): boolean;
  alterarCitacao(id: string, dados: DadosCitacao): boolean;
  retirarCitacao(id: string): boolean;
}

/** Estados dos editores das seções visitadas no trabalho aberto. */
export class MemoriaEditores {
  #geracao = -1;
  readonly #estados = new Map<string, EditorState>();
  /**
   * Quem mostra os avisos da colagem agora. Os estados guardados levam o plugin de colagem consigo, então o plugin chama
   * esta função estável, e não a do componente que o criou.
   */
  aoAvisar: (avisos: readonly AvisoColagem[]) => void = () => {};
  readonly avisar = (avisos: readonly AvisoColagem[]): void => this.aoAvisar(avisos);
  /** Formatador das chamadas na tela (M4-T07): troca quando as obras mudam e redesenha as chamadas. */
  readonly chamadas = new RegistroChamadas();

  obter(geracao: number, secaoId: string): EditorState | undefined {
    if (geracao !== this.#geracao) {
      this.#estados.clear();
      this.#geracao = geracao;
    }
    return this.#estados.get(secaoId);
  }

  guardar(geracao: number, secaoId: string, estado: EditorState): void {
    if (geracao === this.#geracao) this.#estados.set(secaoId, estado);
  }

  /**
   * Desfaz ou refaz um passo do texto de uma seção que não está na tela, no estado guardado; o conteúdo novo vai para
   * `aoAlterar` (a sessão). `false` = sem estado guardado ou sem passo a aplicar.
   */
  aplicarHistorico(geracao: number, secaoId: string, sentido: SentidoHistorico, aoAlterar: (conteudo: ConteudoSecao) => void): boolean {
    const estado = this.obter(geracao, secaoId);
    if (estado === undefined) return false;
    let novo: EditorState | null = null;
    const ok = (sentido === 'desfazer' ? desfazer : refazer)(estado, (tr) => {
      novo = estado.apply(tr);
    });
    if (!ok || novo === null) return false;
    const aplicado: EditorState = novo;
    this.guardar(geracao, secaoId, aplicado);
    if (aplicado.doc !== estado.doc) aoAlterar(docParaSecao(aplicado.doc));
    return true;
  }

  /** Esquece os estados guardados (trabalho fechado: o texto dele não fica na memória; revisão do M2-T06, B4). */
  limpar(): void {
    this.#estados.clear();
    this.#geracao = -1;
  }
}

export interface PropsEditorSecao {
  secaoId: string;
  geracao: number;
  memoria: MemoriaEditores;
  /** Conteúdo atual da seção no modelo (lido só ao montar sem estado guardado). */
  ler: (secaoId: string) => ConteudoSecao | null;
  somenteLeitura: boolean;
  /** Nome acessível do editor (ex.: "Texto da seção 2"). */
  rotulo: string;
  aoAlterar: (secaoId: string, conteudo: ConteudoSecao) => void;
  /** Passo novo no histórico de texto da seção (entra na ordem única de desfazer). */
  aoRegistrarTexto: (secaoId: string) => void;
  /** Ctrl+Z, Ctrl+Y e Ctrl+Shift+Z: a ordem única de desfazer do trabalho. */
  aoHistorico: (sentido: SentidoHistorico) => boolean;
  /** Textos do que a colagem descartou (imagem, tabela…). */
  aoAvisar: (textos: string[]) => void;
  controle: RefObject<ControleEditor | null>;
  /** Texto das chamadas com as obras atuais (M4-T07). */
  formatarChamada: FormatadorDeChamadas;
  /** Chamadas escritas à mão que correspondem a obras cadastradas (sugestão ao colar). */
  reconhecerChamadas: (texto: string) => readonly ChamadaEscrita[];
  /** Abre a janela da citação: `existente` é a chamada a alterar; `null`, uma nova no cursor. */
  aoPedirCitacao: (existente: ChamadaNoEditor | null) => void;
}

interface Barra {
  italico: boolean;
  negrito: boolean;
  sobrescrito: boolean;
  subscrito: boolean;
  nota: boolean;
  alineas: boolean;
  citacao: boolean;
  podeAlineas: boolean;
  podeCitacao: boolean;
  podeCitar: boolean;
  desfazer: boolean;
  refazer: boolean;
}

const BARRA_VAZIA: Barra = { italico: false, negrito: false, sobrescrito: false, subscrito: false, nota: false, alineas: false, citacao: false, podeAlineas: false, podeCitacao: false, podeCitar: false, desfazer: false, refazer: false };

function barraDe(estado: EditorState): Barra {
  return {
    italico: marcaAtiva(estado, 'italico'),
    negrito: marcaAtiva(estado, 'negrito'),
    sobrescrito: marcaAtiva(estado, 'sobrescrito'),
    subscrito: marcaAtiva(estado, 'subscrito'),
    nota: podeInserirNota(estado),
    alineas: estaEmAlineas(estado),
    citacao: estaEmCitacao(estado),
    podeAlineas: alternarAlineas(estado),
    podeCitacao: alternarCitacaoLonga(estado),
    podeCitar: chamadaSelecionada(estado) !== null || podeInserirCitacao(estado),
    desfazer: undoDepth(estado) > 0,
    refazer: redoDepth(estado) > 0,
  };
}

const mesmaBarra = (a: Barra, b: Barra): boolean => (Object.keys(a) as (keyof Barra)[]).every((k) => a[k] === b[k]);

const BOTOES_MARCA: readonly { marca: MarcaTexto; rotulo: string; nome?: string; atalho: string; aria: string; texto: string }[] = [
  { marca: 'italico', rotulo: 'Itálico', atalho: 'Ctrl+I', aria: 'Control+I', texto: 'I' },
  { marca: 'negrito', rotulo: 'Negrito', atalho: 'Ctrl+B', aria: 'Control+B', texto: 'N' },
  { marca: 'sobrescrito', rotulo: 'Sobrescrito', nome: 'Sobrescrito x²', atalho: 'Ctrl+Shift+=', aria: 'Control+Shift+=', texto: 'x²' },
  { marca: 'subscrito', rotulo: 'Subscrito', nome: 'Subscrito x₂', atalho: 'Ctrl+=', aria: 'Control+=', texto: 'x₂' },
];

export function EditorSecao(p: PropsEditorSecao) {
  const refHospedeiro = useRef<HTMLDivElement>(null);
  const refView = useRef<EditorView | null>(null);
  const [barra, setBarra] = useState<Barra>(BARRA_VAZIA);
  // Chamadas escritas à mão no texto colado (M4-T07): a sugestão espera o aceite.
  const [sugestao, setSugestao] = useState<readonly ChamadaEscritaNoDoc[]>([]);
  // Blocos tocados pela colagem: a sugestão e o "Ligar às obras" ficam neles (revisão R-M4-03).
  const refBlocosColados = useRef<ReadonlySet<string>>(new Set());
  // As funções de fora mudam a cada renderização da casca; o editor lê sempre a mais recente.
  const refProps = useRef(p);
  useEffect(() => {
    refProps.current = p;
  });

  const { secaoId, geracao, memoria, somenteLeitura, controle, formatarChamada } = p;
  // Antes de montar o editor: as chamadas nascem já com o texto.
  useEffect(() => memoria.chamadas.definir(formatarChamada), [memoria, formatarChamada]);
  useEffect(() => {
    const hospedeiro = refHospedeiro.current;
    if (!hospedeiro) return;
    memoria.aoAvisar = (avisos) => refProps.current.aoAvisar([...new Set(avisos)].map((a) => MENSAGENS_AVISO[a]));
    const guardado = memoria.obter(geracao, secaoId);
    const conteudo = guardado ? null : refProps.current.ler(secaoId);
    if (!guardado && conteudo === null) return;
    const estado = guardado ?? criarEstadoSecao(conteudo!, { aoAvisar: memoria.avisar });
    let atualBarra = barraDe(estado);
    setBarra(atualBarra);

    const historico = (sentido: SentidoHistorico): boolean => !somenteLeitura && refProps.current.aoHistorico(sentido);
    // Antes das teclas dos plugins (as props do `EditorView` vêm primeiro): o `undo` do estado só desfaria esta seção. A
    // tecla é sempre consumida, mesmo sem nada a desfazer na ordem única: se seguisse para o `keymap` da seção, um passo
    // que a ordem única não conhece seria desfeito ou refeito fora de ordem (revisão do M2-T07, A1).
    const consumir = (sentido: SentidoHistorico) => (): boolean => {
      historico(sentido);
      return true;
    };
    // Destino da janela da citação: o texto da seção ou o de uma nota aberta (M4-T07).
    let alvo: AlvoCitacao | null = null;
    const pedirNoAlvo = (existente: ChamadaNoEditor | null, destino: AlvoCitacao) => {
      alvo = destino;
      refProps.current.aoPedirCitacao(existente);
    };
    const notas = new Set<NotaView>();
    // Ctrl+Shift+C (o atalho do menu Inserir › Citação…), e Enter com a chamada selecionada: a janela da citação.
    const pedirCitacao = (): boolean => {
      if (somenteLeitura) return false;
      for (const n of notas) if (n.temFoco()) return n.pedirCitacao();
      const existente = chamadaSelecionada(view.state);
      if (existente === null && !podeInserirCitacao(view.state)) return false;
      pedirNoAlvo(existente, { estado: () => view.state, despachar: (tr) => view.dispatch(tr), focar: () => view.focus() });
      return true;
    };
    const teclas = keydownHandler({
      'Mod-z': consumir('desfazer'),
      'Mod-y': consumir('refazer'),
      'Shift-Mod-z': consumir('refazer'),
      'Shift-Mod-c': () => {
        pedirCitacao();
        return true;
      },
      Enter: () => chamadaSelecionada(view.state) !== null && pedirCitacao(),
    });

    const view: EditorView = new EditorView(hospedeiro, {
      state: estado,
      editable: () => !somenteLeitura,
      handleKeyDown: teclas,
      ...copiaComChamadas(memoria.chamadas),
      nodeViews: {
        nota: (no, v, posicao) => {
          const n: NotaView = new NotaView(no, v, posicao, () => memoria.avisar(['limite']), historico, { registro: memoria.chamadas, pedir: pedirNoAlvo }, () =>
            notas.delete(n),
          );
          notas.add(n);
          return n;
        },
        chamadaCitacao: (no, v, posicao) =>
          new ChamadaView(no, memoria.chamadas, () => {
            const pos = posicao();
            if (pos === undefined || somenteLeitura) return;
            v.dispatch(v.state.tr.setSelection(NodeSelection.create(v.state.doc, pos)));
            pedirCitacao();
          }),
      },
      attributes: {
        class: 'bd-editor',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': refProps.current.rotulo,
        // Corretor ortográfico desligado no M2 (decisão da preparação do M2).
        spellcheck: 'false',
      },
      dispatchTransaction(tr) {
        const anterior = view.state;
        const novo = anterior.apply(tr);
        view.updateState(novo);
        if (novo.doc !== anterior.doc) refProps.current.aoAlterar(secaoId, docParaSecao(novo.doc));
        // Colagem com chamadas escritas de obras cadastradas: sugere ligar (nunca liga sozinho).
        if (tr.getMeta('uiEvent') === 'paste' && novo.doc !== anterior.doc) {
          // Só os blocos que a colagem criou ou mudou: o resto da seção não é examinado (revisão R-M4-03).
          const blocos = blocosMudados(anterior.doc, novo.doc);
          const achadas = blocos.size === 0 ? [] : chamadasEscritasNoDoc(novo.doc, refProps.current.reconhecerChamadas, blocos);
          if (achadas.length > 0) {
            refBlocosColados.current = blocos;
            setSugestao(achadas);
          }
        }
        // Passo novo no histórico de texto (também quando o limite de 100 eventos corta os mais antigos e a profundidade
        // diminui); desfazer e refazer não contam: a ordem única já os moveu.
        if (!isHistoryTransaction(tr) && undoDepth(novo) !== undoDepth(anterior)) refProps.current.aoRegistrarTexto(secaoId);
        // Nota recém-inserida (botão, menu ou Ctrl+Alt+F): o foco vai para o texto dela.
        if (tr.getMeta(META_ABRIR_NOTA)) view.dom.querySelector<HTMLElement>('.bd-nota__editor')?.focus();
        const b = barraDe(novo);
        if (!mesmaBarra(b, atualBarra)) {
          atualBarra = b;
          setBarra(b);
        }
      },
    });
    refView.current = view;

    const executar = (c: typeof desfazer): boolean => !somenteLeitura && c(view.state, view.dispatch);
    // Citação no destino pedido: passo próprio no desfazer, sem juntar com o que for digitado logo depois.
    const passoProprio = (c: typeof desfazer): boolean => {
      const estadoAlvo = alvo?.estado() ?? null;
      if (somenteLeitura || alvo === null || estadoAlvo === null) return false;
      const ok = c(estadoAlvo, alvo.despachar);
      if (ok) view.dispatch(closeHistory(view.state.tr));
      return ok;
    };
    controle.current = {
      secaoId,
      desfazer: () => executar(desfazer),
      refazer: () => executar(refazer),
      inserirNota: () => executar(inserirNota),
      colarSemFormatacao: () => colarSemFormatacaoNaProxima(view.state),
      focar: () => view.focus(),
      focarTitulo: () => {
        const { doc } = view.state;
        view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 1, 1 + doc.child(0).content.size)).scrollIntoView());
        view.focus();
      },
      temFoco: () => view.hasFocus() || view.dom.contains(document.activeElement),
      fecharGrupo: () => view.dispatch(closeHistory(view.state.tr)),
      pedirCitacao,
      focarCitacao: () => (alvo ?? { focar: () => view.focus() }).focar(),
      irPara: (id, trecho) => {
        const s = selecaoParaIr(view.state.doc, id, trecho);
        if (s === null) return false;
        view.dispatch(view.state.tr.setSelection(s).scrollIntoView());
        view.focus();
        return true;
      },
      inserirCitacao: (dados) => passoProprio(inserirCitacao(dados)),
      alterarCitacao: (id, dados) => passoProprio(alterarCitacao(id, dados)),
      retirarCitacao: (id) => passoProprio(retirarCitacao(id)),
    };

    setSugestao([]);
    return () => {
      // Guardado com o grupo fechado: o que for digitado em outra seção entra depois na ordem única.
      memoria.guardar(geracao, secaoId, view.state.apply(closeHistory(view.state.tr)));
      if (refView.current === view) refView.current = null;
      controle.current = null;
      view.destroy();
    };
  }, [secaoId, geracao, memoria, somenteLeitura, controle]);

  // O número da seção muda quando a árvore muda (M2-T07): o nome acessível acompanha.
  const { rotulo } = p;
  useEffect(() => {
    const view = refView.current;
    if (!view) return;
    view.setProps({ attributes: { ...(view.props.attributes as Record<string, string>), 'aria-label': rotulo } });
  }, [rotulo]);

  const aplicar = (marca: MarcaTexto) => {
    const view = refView.current;
    if (!view || somenteLeitura) return;
    alternarMarca(marca)(view.state, view.dispatch);
    view.focus();
  };

  const ligarSugestao = () => {
    const view = refView.current;
    setSugestao([]);
    if (!view || somenteLeitura) return;
    // Procura de novo: o texto pode ter mudado depois da colagem.
    if (ligarChamadasEscritas(chamadasEscritasNoDoc(view.state.doc, refProps.current.reconhecerChamadas, refBlocosColados.current))(view.state, view.dispatch)) {
      view.dispatch(closeHistory(view.state.tr));
    }
    view.focus();
  };

  const aplicarBloco = (comando: typeof alternarAlineas) => {
    const view = refView.current;
    if (!view || somenteLeitura) return;
    comando(view.state, view.dispatch);
    view.focus();
  };

  return (
    <div className="editor-secao">
      {!somenteLeitura && (
        <div className="barra-formatacao" role="toolbar" aria-label="Formatação do texto">
          {BOTOES_MARCA.map((b) => (
            <button
              key={b.marca}
              type="button"
              className={`btn-formato btn-formato--${b.marca}`}
              aria-pressed={barra[b.marca]}
              aria-keyshortcuts={b.aria}
              title={`${b.rotulo} (${b.atalho})`}
              aria-label={b.nome ?? b.rotulo} // O nome contém o texto visível (WCAG 2.5.3; axe, M2-T11)
              // Não tira o foco do editor (a seleção continua onde estava).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar(b.marca)}
            >
              {b.texto}
            </button>
          ))}
          <span className="barra-formatacao__separador" aria-hidden="true" />
          <button
            type="button"
            className="btn-formato"
            disabled={!barra.nota}
            aria-keyshortcuts="Control+Alt+F"
            title="Nota de rodapé (Ctrl+Alt+F)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => controle.current?.inserirNota()}
          >
            Nota de rodapé
          </button>
          <button
            type="button"
            className="btn-formato"
            disabled={!barra.podeAlineas}
            aria-pressed={barra.alineas}
            aria-keyshortcuts="Control+Shift+L"
            title="Alíneas (Ctrl+Shift+L). Na alínea, Tab cria subalínea e Shift+Tab volta"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aplicarBloco(alternarAlineas)}
          >
            Alíneas
          </button>
          <button
            type="button"
            className="btn-formato"
            disabled={!barra.podeCitacao}
            aria-pressed={barra.citacao}
            aria-keyshortcuts="Control+Shift+Q"
            title="Citação longa (Ctrl+Shift+Q)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aplicarBloco(alternarCitacaoLonga)}
          >
            Citação longa
          </button>
          <button
            type="button"
            className="btn-formato"
            disabled={!barra.podeCitar}
            aria-keyshortcuts="Control+Shift+C"
            title="Citação: escolher a obra citada (Ctrl+Shift+C)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => controle.current?.pedirCitacao()}
          >
            Citação
          </button>
        </div>
      )}
      {sugestao.length > 0 && !somenteLeitura && (
        <div className="editor-secao__sugestao" role="group" aria-label="Chamadas no texto colado">
          <p role="status">
            {sugestao.length === 1 ? 'O texto colado tem uma chamada escrita de obra da bibliografia: ' : `O texto colado tem ${sugestao.length} chamadas escritas de obras da bibliografia: `}
            {sugestao.map((c) => c.texto).join('; ')}. Ligada à obra, a chamada acompanha as mudanças da obra.
          </p>
          <button type="button" className="btn-principal" onClick={ligarSugestao}>
            Ligar às obras
          </button>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => {
              setSugestao([]);
              refView.current?.focus();
            }}
          >
            Manter como texto
          </button>
        </div>
      )}
      <div ref={refHospedeiro} className="editor-secao__texto" />
    </div>
  );
}
