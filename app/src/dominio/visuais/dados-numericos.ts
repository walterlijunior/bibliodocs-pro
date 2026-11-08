/**
 * Conteúdo das células da tabela (M5-T02): quanto dos dados é numérico, para o aviso de "tabela" sem dado numérico
 * (RN-241, IBGE p. 9: o dado numérico é a informação central; D-M5-10: o autor escolhe, o verificador sugere "quadro").
 *
 * Heurística técnica (o limite e a leitura das células não são norma; a matriz registra a de RN-241):
 * - células de dados = fora das linhas de cabeçalho e fora da 1.ª coluna, que é a coluna indicadora (RN-256, IBGE
 *   p. 15–16), quando a tabela tem mais de uma coluna;
 * - conta como numérico o número (sinal, R$, milhares com ponto ou espaço, vírgula decimal, %) e o sinal convencional
 *   da RN-263 (IBGE p. 18: -, –, .., ..., X, x);
 * - a chamada de nota específica não conta (RN-267: "(1)", "[1]" ou exponencial);
 * - célula vazia fica de fora da conta (é outro aviso, RN-263, de tarefa posterior).
 */
import type { BlocoTabela, CelulaTabela } from '../modelo';

/** Sinais convencionais da RN-263 (com "–" da RN-264); "…" é o "..." trocado pelo corretor automático. */
const SINAIS = new Set(['-', '–', '..', '...', '…', 'X', 'x']);
const CHAMADA = /^(?:\(\d+\)|\[\d+\])\s*|\s*(?:\(\d+\)|\[\d+\])$/gu;
const NUMERO = /^[+\-−–]?\s?(?:R\$|US\$|€)?\s?\d+(?:[.,]\d+)*\s?%?$/u;

/** Texto da célula sem a chamada de nota específica (sobrescrito ou entre parênteses/colchetes, RN-267). */
export function textoDaCelula(celula: CelulaTabela): string {
  return celula.conteudo
    .filter((i) => !(i.marcas ?? []).includes('sobrescrito'))
    .map((i) => i.texto)
    .join('')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(CHAMADA, '')
    .trim();
}

/** Número ou sinal convencional (RN-263)? Espaço entre algarismos (milhares do IBGE, "117 960 301") é ignorado. */
export function ehDadoNumerico(texto: string): boolean {
  const t = texto.trim();
  if (SINAIS.has(t)) return true;
  return NUMERO.test(t.replace(/(?<=\d)[\s  ](?=\d)/gu, ''));
}

/** Células com a coluna em que começam, no modelo do HTML (as cobertas por mesclagem de cima são puladas). */
export function celulasComColuna(t: Pick<BlocoTabela, 'colunas' | 'linhas'>): { linha: number; coluna: number; celula: CelulaTabela }[] {
  const saida: { linha: number; coluna: number; celula: CelulaTabela }[] = [];
  const cobertas = new Array<number>(t.colunas.length).fill(0);
  t.linhas.forEach((linha, r) => {
    let c = 0;
    for (const celula of linha) {
      while (c < cobertas.length && cobertas[c]! > 0) c++;
      saida.push({ linha: r, coluna: c, celula });
      const largura = celula.colunas ?? 1;
      for (let k = c; k < c + largura && k < cobertas.length; k++) cobertas[k] = celula.linhas ?? 1;
      c += largura;
    }
    for (let k = 0; k < cobertas.length; k++) cobertas[k] = Math.max(0, cobertas[k]! - 1);
  });
  return saida;
}

/**
 * Proporção de células de dados numéricas (0 a 1), ou `null` se não há célula de dados com texto (nada a julgar: tabela
 * em rascunho).
 */
export function proporcaoNumerica(t: Pick<BlocoTabela, 'colunas' | 'linhas' | 'linhasCabecalho'>): number | null {
  const pularColuna = t.colunas.length > 1;
  let total = 0;
  let numericas = 0;
  for (const { linha, coluna, celula } of celulasComColuna(t)) {
    if (linha < t.linhasCabecalho || (pularColuna && coluna === 0)) continue;
    const texto = textoDaCelula(celula);
    if (texto === '') continue;
    total++;
    if (ehDadoNumerico(texto)) numericas++;
  }
  return total === 0 ? null : numericas / total;
}
