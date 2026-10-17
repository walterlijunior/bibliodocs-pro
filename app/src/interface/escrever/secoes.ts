/**
 * Regras puras da lista de seções da aba Escrever (M2-T07): qual seção fica ativa depois de uma mudança, as teclas da
 * árvore e o lado em que se solta uma seção arrastada. Sem DOM, para ser testado em Node.
 */
import type { ResumoSecao } from '../../aplicacao';

/**
 * Seção escolhida no trabalho de `geracao`. `vizinhas` = para onde ir se ela deixar de existir (excluída, ou a criação
 * desfeita): primeiro as seguintes na ordem de leitura, depois as anteriores, da mais próxima à mais distante.
 */
export interface EscolhaSecao {
  geracao: number;
  id: string;
  vizinhas: readonly string[];
}

/** Escolhe `id`, com as vizinhas dele na lista atual. */
export function escolhaDe(secoes: readonly ResumoSecao[], id: string, geracao: number): EscolhaSecao {
  const i = secoes.findIndex((s) => s.id === id);
  if (i < 0) return { geracao, id, vizinhas: [] };
  return { geracao, id, vizinhas: [...secoes.slice(i + 1), ...secoes.slice(0, i).reverse()].map((s) => s.id) };
}

/** A seção ativa: a escolhida, ou a vizinha mais próxima que ainda existe, ou a primeira (outro trabalho aberto). */
export function resolverAtiva(secoes: readonly ResumoSecao[], escolha: EscolhaSecao | null, geracao: number): ResumoSecao | null {
  if (escolha !== null && escolha.geracao === geracao) {
    const porId = new Map(secoes.map((s) => [s.id, s]));
    for (const id of [escolha.id, ...escolha.vizinhas]) {
      const s = porId.get(id);
      if (s !== undefined) return s;
    }
  }
  return secoes[0] ?? null;
}

/** Seção anterior ou seguinte na ordem de leitura (botões da barra e Ctrl+Page Up/Down); `null` na ponta. */
export function secaoVizinha(secoes: readonly ResumoSecao[], id: string | null, delta: -1 | 1): ResumoSecao | null {
  const i = secoes.findIndex((s) => s.id === id);
  if (i < 0) return null;
  return secoes[i + delta] ?? null;
}

/**
 * Próxima seção em foco na árvore (padrão ARIA "tree", sem recolher): setas para cima e para baixo, Home e End; seta
 * para a esquerda vai à mãe e para a direita, à primeira subseção. `null` = a tecla não é de movimento ou não há destino.
 */
export function destinoTeclaArvore(secoes: readonly ResumoSecao[], indice: number, tecla: string): number | null {
  const atual = secoes[indice];
  if (atual === undefined) return null;
  switch (tecla) {
    case 'ArrowUp':
      return indice > 0 ? indice - 1 : null;
    case 'ArrowDown':
      return indice < secoes.length - 1 ? indice + 1 : null;
    case 'Home':
      return 0;
    case 'End':
      return secoes.length - 1;
    case 'ArrowLeft': {
      if (atual.paiId === null) return null;
      const mae = secoes.findIndex((s) => s.id === atual.paiId);
      return mae < 0 ? null : mae;
    }
    case 'ArrowRight':
      return secoes[indice + 1]?.paiId === atual.id ? indice + 1 : null;
    default:
      return null;
  }
}

/** Soltar na metade de cima do item põe a seção antes dele; na de baixo, depois. */
export function ladoDoSoltar(y: number, topo: number, altura: number): 'antes' | 'depois' {
  return y < topo + altura / 2 ? 'antes' : 'depois';
}
