/**
 * `HistoricoEdicao` (M2-T07; ADR-0007, seção 4): a ordem única de desfazer e refazer do trabalho aberto, linear como no
 * Word, misturando o texto das seções e a estrutura da árvore.
 *
 * - Texto: a entrada só diz **qual seção**; o passo em si fica no `prosemirror-history` daquela seção (o editor empilha
 *   uma entrada quando a profundidade de desfazer da seção muda).
 * - Estrutura: a entrada guarda o `inverso` da operação **como foi recebido**, sem copiar nem serializar: só o próprio
 *   objeto devolvido por uma operação aceita restaura além dos limites (adendo do M2-T03 no ADR-0007).
 * - Registrar algo novo esvazia o refazer. O tamanho é limitado: a entrada mais antiga sai primeiro.
 *
 * Puro (sem DOM, sem Node e sem pacote do editor).
 */
import type { ElementoPreTextual, Id, InversoSecao } from '../../dominio/modelo';

/**
 * Incluir e retirar elemento pré-textual (M2-T08): o que desfaz é só aquele elemento. Os campos digitados depois em outros
 * elementos não voltam atrás: eles usam o desfazer do próprio campo.
 */
export type InversoElemento = { acao: 'retirar'; id: Id } | { acao: 'incluir'; elemento: ElementoPreTextual };

export type EntradaHistorico =
  | { tipo: 'texto'; secaoId: Id }
  | { tipo: 'estrutura'; inverso: InversoSecao }
  | { tipo: 'elemento'; inverso: InversoElemento };

/** Entradas guardadas em cada sentido (o `prosemirror-history` guarda 100 eventos por seção). */
export const LIMITE_HISTORICO_EDICAO = 1_000;

export class HistoricoEdicao {
  readonly #limite: number;
  #desfazer: EntradaHistorico[] = [];
  #refazer: EntradaHistorico[] = [];

  constructor(limite = LIMITE_HISTORICO_EDICAO) {
    this.#limite = limite;
  }

  get podeDesfazer(): boolean {
    return this.#desfazer.length > 0;
  }

  get podeRefazer(): boolean {
    return this.#refazer.length > 0;
  }

  /** Alteração nova (texto ou estrutura): entra no desfazer e esvazia o refazer. */
  registrar(entrada: EntradaHistorico): void {
    this.#empilhar(this.#desfazer, entrada);
    this.#refazer = [];
  }

  /** Próxima entrada a desfazer (ou a refazer), sem tirá-la. */
  topo(sentido: 'desfazer' | 'refazer'): EntradaHistorico | undefined {
    return this.#pilha(sentido).at(-1);
  }

  /**
   * A entrada do topo foi aplicada: sai da pilha de `sentido` e `contraria` (o que a anula) vai para a outra. No texto,
   * a contrária é a própria entrada; na estrutura, a que leva o inverso devolvido ao aplicar.
   */
  concluir(sentido: 'desfazer' | 'refazer', contraria: EntradaHistorico): void {
    this.#pilha(sentido).pop();
    this.#empilhar(this.#pilha(sentido === 'desfazer' ? 'refazer' : 'desfazer'), contraria);
  }

  /** A entrada do topo não pôde ser aplicada (o passo já não existe na seção): sai sem ir para a outra pilha. */
  descartar(sentido: 'desfazer' | 'refazer'): void {
    this.#pilha(sentido).pop();
  }

  limpar(): void {
    this.#desfazer = [];
    this.#refazer = [];
  }

  #pilha(sentido: 'desfazer' | 'refazer'): EntradaHistorico[] {
    return sentido === 'desfazer' ? this.#desfazer : this.#refazer;
  }

  #empilhar(pilha: EntradaHistorico[], entrada: EntradaHistorico): void {
    pilha.push(entrada);
    if (pilha.length > this.#limite) pilha.splice(0, pilha.length - this.#limite);
  }
}
