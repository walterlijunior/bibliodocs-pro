/**
 * Percursos sobre os blocos (M2-T04): os conteúdos `Inline[]` de cada tipo de bloco e os ids que o bloco traz
 * (o dele e o das notas). Usados na conferência de ids únicos das operações de seção.
 */
import type { Bloco, Id, Inline } from './tipos';

/** Os conteúdos do bloco na ordem de leitura (alínea, depois as suas subalíneas). */
export function conteudosDoBloco(bloco: Bloco): readonly (readonly Inline[])[] {
  switch (bloco.tipo) {
    case 'paragrafo':
    case 'citacaoLonga':
      return [bloco.conteudo];
    case 'alineas':
      return bloco.itens.flatMap((item) => [item.conteudo, ...(item.subalineas ?? [])]);
    case 'quebraPagina':
      return [];
  }
}

/** O id do bloco seguido dos ids das notas, na ordem de leitura (com repetição, se houver). */
export function idsDoBloco(bloco: Bloco): Id[] {
  const ids = [bloco.id];
  for (const conteudo of conteudosDoBloco(bloco)) {
    for (const inline of conteudo) if (inline.tipo === 'nota') ids.push(inline.id);
  }
  return ids;
}
