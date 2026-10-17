// Editor de uma seção na aba Escrever (M2-T06; ADR-0007, seção 3): o `EditorView` não é controlado pelo React (o React
// monta e desmonta; o `dispatchTransaction` aplica o estado). Cada transação que muda o documento é convertida na hora
// para o modelo e vai para a sessão (`aoAlterar`), de modo que nenhuma alteração fica só no editor: salvar, fechar e o
// instantâneo sempre veem o que foi digitado.
//
// O `EditorState` de cada seção visitada fica na `MemoriaEditores` (o histórico de texto sobrevive à troca de seção) até
// a sessão abrir outro trabalho (`geracao`). A barra de formatação reflete a seleção e só re-renderiza quando muda.
import 'prosemirror-view/style/prosemirror.css';
import { redoDepth, undoDepth } from 'prosemirror-history';
import type { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { MarcaTexto } from '../../dominio/modelo';
import { colarSemFormatacaoNaProxima } from './colagem';
import { alternarMarca, desfazer, inserirNota, marcaAtiva, META_ABRIR_NOTA, podeInserirNota, refazer } from './comandos';
import { docParaSecao, type ConteudoSecao } from './conversao';
import { criarEstadoSecao } from './estado';
import { MENSAGENS_AVISO, type AvisoColagem } from './html-colado';
import { NotaView } from './nota-view';

/** Comandos que o menu Editar e o menu Inserir mandam para o editor da seção aberta. */
export interface ControleEditor {
  desfazer(): boolean;
  refazer(): boolean;
  inserirNota(): boolean;
  /** A próxima colagem neste editor fica só com o texto. */
  colarSemFormatacao(): void;
  focar(): void;
  /** O foco está no editor da seção ou no de uma nota dela. */
  temFoco(): boolean;
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
  /** Textos do que a colagem descartou (imagem, tabela…). */
  aoAvisar: (textos: string[]) => void;
  controle: RefObject<ControleEditor | null>;
}

interface Barra {
  italico: boolean;
  negrito: boolean;
  sobrescrito: boolean;
  subscrito: boolean;
  nota: boolean;
  desfazer: boolean;
  refazer: boolean;
}

const BARRA_VAZIA: Barra = { italico: false, negrito: false, sobrescrito: false, subscrito: false, nota: false, desfazer: false, refazer: false };

function barraDe(estado: EditorState): Barra {
  return {
    italico: marcaAtiva(estado, 'italico'),
    negrito: marcaAtiva(estado, 'negrito'),
    sobrescrito: marcaAtiva(estado, 'sobrescrito'),
    subscrito: marcaAtiva(estado, 'subscrito'),
    nota: podeInserirNota(estado),
    desfazer: undoDepth(estado) > 0,
    refazer: redoDepth(estado) > 0,
  };
}

const mesmaBarra = (a: Barra, b: Barra): boolean => (Object.keys(a) as (keyof Barra)[]).every((k) => a[k] === b[k]);

const BOTOES_MARCA: readonly { marca: MarcaTexto; rotulo: string; atalho: string; aria: string; texto: string }[] = [
  { marca: 'italico', rotulo: 'Itálico', atalho: 'Ctrl+I', aria: 'Control+I', texto: 'I' },
  { marca: 'negrito', rotulo: 'Negrito', atalho: 'Ctrl+B', aria: 'Control+B', texto: 'N' },
  { marca: 'sobrescrito', rotulo: 'Sobrescrito', atalho: 'Ctrl+Shift+=', aria: 'Control+Shift+=', texto: 'x²' },
  { marca: 'subscrito', rotulo: 'Subscrito', atalho: 'Ctrl+=', aria: 'Control+=', texto: 'x₂' },
];

export function EditorSecao(p: PropsEditorSecao) {
  const refHospedeiro = useRef<HTMLDivElement>(null);
  const refView = useRef<EditorView | null>(null);
  const [barra, setBarra] = useState<Barra>(BARRA_VAZIA);
  // As funções de fora mudam a cada renderização da casca; o editor lê sempre a mais recente.
  const refProps = useRef(p);
  useEffect(() => {
    refProps.current = p;
  });

  const { secaoId, geracao, memoria, somenteLeitura, controle } = p;
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

    const view: EditorView = new EditorView(hospedeiro, {
      state: estado,
      editable: () => !somenteLeitura,
      nodeViews: { nota: (no, v, posicao) => new NotaView(no, v, posicao, () => memoria.avisar(['limite'])) },
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
    controle.current = {
      desfazer: () => executar(desfazer),
      refazer: () => executar(refazer),
      inserirNota: () => executar(inserirNota),
      colarSemFormatacao: () => colarSemFormatacaoNaProxima(view.state),
      focar: () => view.focus(),
      temFoco: () => view.hasFocus() || view.dom.contains(document.activeElement),
    };

    return () => {
      memoria.guardar(geracao, secaoId, view.state);
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
              aria-label={b.rotulo}
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
        </div>
      )}
      <div ref={refHospedeiro} className="editor-secao__texto" />
    </div>
  );
}
