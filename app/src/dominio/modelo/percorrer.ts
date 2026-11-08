/**
 * Percursos sobre os blocos (M2-T04): os conteúdos `Inline[]` de cada tipo de bloco e os ids que o bloco traz
 * (o dele e o das notas). Usados na conferência de ids únicos das operações de seção.
 */
import type { Bloco, Id, Inline } from './tipos';

/** Os conteúdos de texto corrido do bloco na ordem de leitura (alínea, depois as suas subalíneas). */
export function conteudosDoBloco(bloco: Bloco): readonly (readonly Inline[])[] {
  switch (bloco.tipo) {
    case 'paragrafo':
    case 'citacaoLonga':
      return [bloco.conteudo];
    case 'alineas':
      return bloco.itens.flatMap((item) => [item.conteudo, ...(item.subalineas ?? [])]);
    case 'quebraPagina':
      return [];
    // Elementos visuais (M5-T01): os campos são só texto com marcas, sem nota nem citação, e não fazem parte do texto
    // corrido (o verificador da bibliografia não procura chamadas soltas neles). Os elementos são percorridos por `numerarElementos` (dominio/numeracao).
    case 'tabela':
    case 'ilustracao':
    case 'equacao':
      return [];
  }
}

/** O id do bloco seguido dos ids das notas, das remissivas e das citações (também as de dentro das notas), na ordem de leitura. */
export function idsDoBloco(bloco: Bloco): Id[] {
  const ids = [bloco.id];
  for (const conteudo of conteudosDoBloco(bloco)) {
    for (const inline of conteudo) {
      if (inline.tipo === 'nota' || inline.tipo === 'citacao' || inline.tipo === 'remissiva') ids.push(inline.id);
      if (inline.tipo === 'nota') for (const n of inline.conteudo) if (n.tipo === 'citacao') ids.push(n.id);
    }
  }
  return ids;
}
