/**
 * Numeração progressiva das seções do corpo (M2-T03), sempre derivada da posição na árvore e nunca gravada
 * (ADR-0005, seção 3).
 *
 * - Indicativo em algarismos arábicos (RN-038; Manual UFT, p. 28, cap. 4).
 * - Primárias 1, 2, 3; secundárias 1.1; terciárias 1.1.1; quaternárias 1.1.1.1; quinárias 1.1.1.1.1, sem saltos:
 *   a primeira subseção de `n` é `n.1` (RN-039; Manual UFT, p. 28, cap. 4, citando a NBR 6024:2012).
 * - Seção além da quinária (RN-041) ainda recebe número, marcada `alemDoLimite`, para o verificador apontar
 *   e a interface mostrar; as operações de `dominio/modelo` não deixam criar uma.
 */
import { NIVEL_MAXIMO_SECAO, type Id, type Secao } from '../modelo';

export interface SecaoNumerada {
  secao: Secao;
  /** Ex.: "2.1.3". */
  indicativo: string;
  /** 1 = primária ... 5 = quinária. */
  nivel: number;
  paiId: Id | null;
  alemDoLimite: boolean;
}

/** Indicativo a partir das posições (base 1) do nível primário até a seção. */
export function indicativoSecao(posicoes: readonly number[]): string {
  return posicoes.join('.');
}

/** Todas as seções em ordem de leitura (pré-ordem), com indicativo e nível. Iterativa: aceita 64 níveis. */
export function numerarSecoes(corpo: readonly Secao[]): SecaoNumerada[] {
  const saida: SecaoNumerada[] = [];
  const pilha: { secao: Secao; posicoes: number[]; paiId: Id | null }[] = [];
  const empilhar = (lista: readonly Secao[], prefixo: number[], paiId: Id | null): void => {
    for (let i = lista.length - 1; i >= 0; i--) pilha.push({ secao: lista[i]!, posicoes: [...prefixo, i + 1], paiId });
  };
  empilhar(corpo, [], null);
  for (let item = pilha.pop(); item !== undefined; item = pilha.pop()) {
    const nivel = item.posicoes.length;
    saida.push({
      secao: item.secao,
      indicativo: indicativoSecao(item.posicoes),
      nivel,
      paiId: item.paiId,
      alemDoLimite: nivel > NIVEL_MAXIMO_SECAO,
    });
    empilhar(item.secao.subsecoes, item.posicoes, item.secao.id);
  }
  return saida;
}

/** Indicativo por id da seção, para rótulos e remissivas. */
export function mapaIndicativos(corpo: readonly Secao[]): ReadonlyMap<Id, string> {
  return new Map(numerarSecoes(corpo).map((n) => [n.secao.id, n.indicativo]));
}
