/**
 * Tabelas, ilustrações e equações no modelo (M5-T01): listas fechadas e a conferência da grade da tabela, usada na
 * leitura do arquivo e, no M5-T04, pelo editor de tabela (só tabela válida é gravada).
 */
import type { BlocoTabela, EspecieIlustracao } from './tipos';

/** Espécies de ilustração na ordem da RN-049 (Manual, p. 18), com "Figura" (exemplos do Manual) primeiro. */
export const ESPECIES_ILUSTRACAO: readonly EspecieIlustracao[] = [
  'figura',
  'desenho',
  'esquema',
  'fluxograma',
  'fotografia',
  'grafico',
  'mapa',
  'organograma',
  'planta',
  'retrato',
];

export type MotivoGrade =
  | 'cabecalhoMaiorQueTabela'
  | 'passaDaUltimaColuna'
  | 'passaDaUltimaLinha'
  | 'sobreposta'
  | 'atravessaCabecalho'
  | 'linhaIncompleta';

export interface ProblemaGrade {
  motivo: MotivoGrade;
  /** Caminho a partir do bloco: `['linhas', r, i]` (célula), `['linhas', r]` (linha) ou `['linhasCabecalho']`. */
  caminho: (string | number)[];
}

/**
 * Primeiro problema da grade, em ordem de leitura, ou `null`. Modelo do HTML: a célula ocupa a primeira coluna livre
 * da linha (as cobertas por mesclagem de cima são puladas); `colunas` a estende para a direita e `linhas` para baixo.
 * Custo proporcional ao número de posições da grade, limitado pelo esquema (`LIMITES_V1.posicoesTabela`).
 */
export function problemaNaGrade(t: Pick<BlocoTabela, 'colunas' | 'linhas' | 'linhasCabecalho'>): ProblemaGrade | null {
  const nColunas = t.colunas.length;
  const nLinhas = t.linhas.length;
  if (t.linhasCabecalho > nLinhas) return { motivo: 'cabecalhoMaiorQueTabela', caminho: ['linhasCabecalho'] };
  // Quantas linhas ainda estão cobertas, em cada coluna, por uma célula mesclada de uma linha anterior (ou desta).
  const cobertas = new Array<number>(nColunas).fill(0);
  for (let r = 0; r < nLinhas; r++) {
    const linha = t.linhas[r]!;
    let c = 0;
    for (let i = 0; i < linha.length; i++) {
      while (c < nColunas && cobertas[c]! > 0) c++;
      const largura = linha[i]!.colunas ?? 1;
      const altura = linha[i]!.linhas ?? 1;
      const caminho = ['linhas', r, i];
      if (c + largura > nColunas) return { motivo: 'passaDaUltimaColuna', caminho };
      for (let k = c; k < c + largura; k++) if (cobertas[k]! > 0) return { motivo: 'sobreposta', caminho };
      if (r + altura > nLinhas) return { motivo: 'passaDaUltimaLinha', caminho };
      if (r < t.linhasCabecalho && r + altura > t.linhasCabecalho) return { motivo: 'atravessaCabecalho', caminho };
      for (let k = c; k < c + largura; k++) cobertas[k] = altura;
      c += largura;
    }
    if (cobertas.some((n) => n === 0)) return { motivo: 'linhaIncompleta', caminho: ['linhas', r] };
    for (let k = 0; k < nColunas; k++) cobertas[k] = cobertas[k]! - 1;
  }
  return null;
}
