/**
 * Gráfico gerado de tabela (M5-T09; RF-10; D-M5-08): dados lidos da tabela a cada vez e desenho em primitivas (retângulos,
 * traços, setores, textos) em pixels. Puro: quem pinta é a interface (canvas), na tela e no PNG da exportação. Assim o
 * mesmo desenho sai nos dois lugares, e a geometria é testada sem tela.
 *
 * Leitura da tabela (D-M5-50):
 * - categorias: a 1.ª coluna (coluna indicadora, RN-256) das linhas de dados (as de depois do cabeçalho);
 * - séries: as colunas escolhidas, ou todas as numéricas depois da 1.ª; o nome vem do cabeçalho (a última linha de
 *   cabeçalho com texto naquela coluna);
 * - número no padrão brasileiro ("1.234,5", "R$ 10", "12%", espaço entre milhares); sinal convencional (RN-263) e célula
 *   vazia ficam sem valor (o ponto falta, a barra não aparece);
 * - linha cuja categoria começa por "Total" fica de fora (somaria o próprio gráfico), com aviso.
 *
 * Desenho (D-M5-08): tons de cinza e padrões, legível impresso em preto e branco; legenda embaixo quando há mais de uma
 * série (e sempre nos setores); escala com 0 e passos redondos (1, 2 ou 5 × 10ⁿ); números no padrão brasileiro.
 */
import type { BlocoGrafico, BlocoTabela, FormaGrafico } from '../modelo';
import { celulasComColuna, textoDaCelula } from './dados-numericos';

// ---------------------------------------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------------------------------------

export interface SerieGrafico {
  /** Coluna da tabela, a partir de 0. */
  coluna: number;
  nome: string;
  /** Um valor por categoria; `null` = sem dado. */
  valores: (number | null)[];
}

export type DadosGrafico =
  | { ok: true; categorias: string[]; series: SerieGrafico[]; avisos: string[] }
  | { ok: false; motivo: 'semTabela' | 'semDados'; mensagem: string };

const SINAIS = new Set(['-', '–', '—', '..', '...', '…', 'X', 'x']);

/** Número no padrão brasileiro, ou `null` (texto, sinal convencional, vazio). */
export function lerNumero(texto: string): number | null {
  let t = texto.trim();
  if (t === '' || SINAIS.has(t)) return null;
  t = t.replace(/(?<=\d)[\s  ](?=\d)/gu, '').replace(/^(?:R\$|US\$|€)\s?/u, '').replace(/\s?%$/u, '');
  const m = /^([+\-−–]?)\s?(?:R\$|US\$|€)?\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/u.exec(t);
  if (!m) return null;
  const inteiro = m[2]!.replace(/\./gu, '');
  const valor = Number(`${inteiro}${m[3] !== undefined ? `.${m[3]}` : ''}`);
  if (!Number.isFinite(valor)) return null;
  return m[1] !== '' && m[1] !== '+' ? -valor : valor;
}

/** Texto de cada posição da grade (a célula mesclada fica na posição onde começa; as cobertas ficam vazias). */
function grade(t: BlocoTabela): string[][] {
  const g = t.linhas.map(() => new Array<string>(t.colunas.length).fill(''));
  for (const { linha, coluna, celula } of celulasComColuna(t)) if (coluna < t.colunas.length) g[linha]![coluna] = textoDaCelula(celula);
  return g;
}

/** Limite técnico de categorias desenhadas (D-M5-50): acima disso o gráfico fica ilegível. */
export const CATEGORIAS_MAXIMAS = 60;

/** Os dados do gráfico, lidos da tabela agora. */
export function dadosDoGrafico(g: Pick<BlocoGrafico, 'forma' | 'series'>, tabela: BlocoTabela | null | undefined): DadosGrafico {
  if (!tabela || tabela.especie !== 'tabela') return { ok: false, motivo: 'semTabela', mensagem: 'a tabela de onde o gráfico vem não está mais no trabalho.' };
  const m = grade(tabela);
  const cab = Math.min(tabela.linhasCabecalho, m.length);
  const avisos: string[] = [];
  let linhas = m.slice(cab);
  const totais = linhas.filter((l) => /^total\b/iu.test(l[0] ?? ''));
  if (totais.length > 0) {
    linhas = linhas.filter((l) => !/^total\b/iu.test(l[0] ?? ''));
    avisos.push('a linha de total da tabela ficou fora do gráfico.');
  }
  if (linhas.length > CATEGORIAS_MAXIMAS) {
    avisos.push(`só as ${CATEGORIAS_MAXIMAS} primeiras linhas da tabela entram no gráfico.`);
    linhas = linhas.slice(0, CATEGORIAS_MAXIMAS);
  }
  const colunas = tabela.colunas.length;
  const escolhidas =
    g.series?.filter((c) => c >= 1 && c < colunas) ??
    Array.from({ length: Math.max(0, colunas - 1) }, (_, i) => i + 1).filter((c) => linhas.some((l) => lerNumero(l[c] ?? '') !== null));
  const nomeDa = (c: number): string => {
    for (let r = cab - 1; r >= 0; r--) if ((m[r]![c] ?? '') !== '') return m[r]![c]!;
    return `Coluna ${c + 1}`;
  };
  let series = escolhidas.map((c) => ({ coluna: c, nome: nomeDa(c), valores: linhas.map((l) => lerNumero(l[c] ?? '')) }));
  series = series.filter((s) => s.valores.some((v) => v !== null));
  if (series.length === 0 || linhas.length === 0) return { ok: false, motivo: 'semDados', mensagem: 'a tabela não tem valores numéricos para o gráfico.' };
  if (g.forma === 'setores') {
    if (series.length > 1) avisos.push('o gráfico de setores usa só a primeira série.');
    series = series.slice(0, 1);
    if (series[0]!.valores.some((v) => v !== null && v < 0)) avisos.push('o gráfico de setores não mostra valores negativos.');
  }
  return { ok: true, categorias: linhas.map((l, i) => l[0] || `${i + 1}`), series, avisos };
}

// ---------------------------------------------------------------------------------------------------------
// Tamanho
// ---------------------------------------------------------------------------------------------------------

/** Largura padrão (D-M5-48), limitada à área útil; altura pela forma (setores mais alto, pela legenda). */
export const LARGURA_PADRAO_GRAFICO_MM = 150;

export function tamanhoGraficoMm(g: Pick<BlocoGrafico, 'forma' | 'larguraMm'>, areaUtilMm: number): { larguraMm: number; alturaMm: number } {
  const larguraMm = Math.min(g.larguraMm ?? LARGURA_PADRAO_GRAFICO_MM, areaUtilMm);
  return { larguraMm, alturaMm: Math.round(larguraMm * (g.forma === 'setores' ? 0.75 : 0.6)) };
}

// ---------------------------------------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------------------------------------

export type Ponto = readonly [number, number];

export type Primitiva =
  /** Preenchido com o padrão `padrao` (0, 1, 2… em ciclo) e contorno preto fino. */
  | { tipo: 'retangulo'; x: number; y: number; largura: number; altura: number; padrao: number }
  | { tipo: 'setor'; cx: number; cy: number; raio: number; inicio: number; fim: number; padrao: number }
  /** Linha aberta; `tracejado` vazio = contínua. */
  | { tipo: 'traco'; pontos: readonly Ponto[]; espessura: number; tracejado: readonly number[] }
  /** Marcador do ponto da série `forma` (círculo, quadrado, triângulo, losango… em ciclo). */
  | { tipo: 'marcador'; x: number; y: number; tamanho: number; forma: number }
  | { tipo: 'texto'; x: number; y: number; texto: string; tamanho: number; alinhar: 'inicio' | 'centro' | 'fim'; base: 'topo' | 'meio' | 'base'; rotacao?: number };

export interface OpcoesDesenho {
  /** Tamanho do texto em pixels (10 pt na resolução de destino). */
  tamanhoTexto: number;
  /** Largura do texto em pixels; sem ela, estimativa de meia altura por caractere. */
  medir?: (texto: string, tamanho: number) => number;
}

/**
 * Cores do desenho impresso (D-M5-08): preto, branco e três cinzas para os preenchimentos lisos. São do documento, não da
 * tela, por isso ficam aqui, com o desenho, e não nos tokens da interface.
 */
export const CORES_GRAFICO = { traco: '#000000', fundo: '#ffffff', escuro: '#3c3c3c', medio: '#787878', claro: '#b4b4b4' } as const;

/** Tracejados das séries de linhas, em múltiplos da espessura (D-M5-08: distinguíveis sem cor). */
const TRACEJADOS: readonly (readonly number[])[] = [[], [6, 3], [2, 2], [8, 3, 2, 3], [4, 4]];

const formato = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
export const numeroBr = (n: number): string => formato.format(n);

/** Escala com passos redondos que cobre [min, max] e inclui o 0. */
export function escalaRedonda(min: number, max: number, alvoDeMarcas = 5): { inicio: number; fim: number; passo: number } {
  let a = Math.min(0, min);
  let b = Math.max(0, max);
  if (a === b) b = a + 1;
  const bruto = (b - a) / alvoDeMarcas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((k) => k * potencia).find((p) => p >= bruto)!;
  a = Math.floor(a / passo) * passo;
  b = Math.ceil(b / passo) * passo;
  return { inicio: a, fim: b, passo };
}

export function desenharGrafico(d: Extract<DadosGrafico, { ok: true }>, forma: FormaGrafico, largura: number, altura: number, o: OpcoesDesenho): Primitiva[] {
  const f = o.tamanhoTexto;
  const medir = o.medir ?? ((t: string, tam: number) => t.length * tam * 0.5);
  const p: Primitiva[] = [];
  const espessura = Math.max(1, f / 12);

  // Legenda embaixo, em linhas que quebram: mais de uma série, ou as categorias dos setores.
  const itens = forma === 'setores' ? d.categorias.map((nome, i) => ({ nome, i })) : d.series.length > 1 ? d.series.map((s, i) => ({ nome: s.nome, i })) : [];
  const amostra = f * 1.2;
  const linhasLegenda: { nome: string; i: number; x: number }[][] = [];
  for (const it of itens) {
    const w = amostra + f * 0.4 + medir(it.nome, f) + f * 1.2;
    const atual = linhasLegenda.at(-1);
    const usado = atual ? atual.reduce((s, x) => s + amostra + f * 0.4 + medir(x.nome, f) + f * 1.2, 0) : Infinity;
    if (!atual || usado + w > largura) linhasLegenda.push([{ ...it, x: 0 }]);
    else atual.push({ ...it, x: usado });
  }
  const alturaLegenda = linhasLegenda.length > 0 ? linhasLegenda.length * f * 1.6 + f * 0.6 : 0;
  linhasLegenda.forEach((linha, k) => {
    const total = linha.reduce((s, x) => s + amostra + f * 0.4 + medir(x.nome, f) + f * 1.2, 0) - f * 1.2;
    const x0 = (largura - total) / 2;
    const y = altura - alturaLegenda + f * 0.6 + k * f * 1.6 + f * 0.8;
    for (const it of linha) {
      const x = x0 + it.x;
      if (forma === 'linhas') {
        p.push({ tipo: 'traco', pontos: [[x, y], [x + amostra, y]], espessura: espessura * 1.5, tracejado: TRACEJADOS[it.i % TRACEJADOS.length]!.map((v) => v * espessura) });
        p.push({ tipo: 'marcador', x: x + amostra / 2, y, tamanho: f * 0.5, forma: it.i });
      } else {
        p.push({ tipo: 'retangulo', x, y: y - amostra / 2, largura: amostra, altura: amostra, padrao: it.i });
      }
      p.push({ tipo: 'texto', x: x + amostra + f * 0.4, y, texto: it.nome, tamanho: f, alinhar: 'inicio', base: 'meio' });
    }
  });
  const baixo = altura - alturaLegenda;

  if (forma === 'setores') {
    const valores = d.series[0]!.valores.map((v) => (v !== null && v > 0 ? v : 0));
    const soma = valores.reduce((s, v) => s + v, 0);
    const cx = largura / 2;
    const cy = baixo / 2;
    const raio = Math.max(0, Math.min(largura / 2, baixo / 2) - f * 2.2);
    let angulo = -Math.PI / 2;
    valores.forEach((v, i) => {
      if (v === 0 || soma === 0) return;
      const fim = angulo + (v / soma) * Math.PI * 2;
      p.push({ tipo: 'setor', cx, cy, raio, inicio: angulo, fim, padrao: i });
      const meio = (angulo + fim) / 2;
      const r = raio + f * 1.1;
      const pct = `${numeroBr(Math.round((v / soma) * 1000) / 10)}%`;
      p.push({ tipo: 'texto', x: cx + Math.cos(meio) * r, y: cy + Math.sin(meio) * r, texto: pct, tamanho: f, alinhar: Math.cos(meio) > 0.2 ? 'inicio' : Math.cos(meio) < -0.2 ? 'fim' : 'centro', base: 'meio' });
      angulo = fim;
    });
    return p;
  }

  const todos = d.series.flatMap((s) => s.valores).filter((v): v is number => v !== null);
  const esc = escalaRedonda(Math.min(...todos), Math.max(...todos));
  const marcas: number[] = [];
  for (let v = esc.inicio; v <= esc.fim + esc.passo / 2; v += esc.passo) marcas.push(Math.round(v / esc.passo) * esc.passo);
  const textoMarca = marcas.map(numeroBr);
  const larguraMarcas = Math.max(...textoMarca.map((t) => medir(t, f)));
  const n = d.categorias.length;

  if (forma === 'barras') {
    // Categorias à esquerda, valores embaixo.
    const larguraCategorias = Math.min(largura * 0.35, Math.max(...d.categorias.map((c) => medir(c, f))));
    const esq = larguraCategorias + f * 0.8;
    const dir = largura - Math.max(f, medir(textoMarca.at(-1)!, f) / 2);
    const topo = f * 0.5;
    const base = baixo - f * 1.8;
    const xDe = (v: number) => esq + ((v - esc.inicio) / (esc.fim - esc.inicio)) * (dir - esq);
    const faixa = (base - topo) / n;
    d.categorias.forEach((c, i) => {
      const y0 = topo + i * faixa;
      p.push({ tipo: 'texto', x: esq - f * 0.4, y: y0 + faixa / 2, texto: c, tamanho: f, alinhar: 'fim', base: 'meio' });
      const grupo = faixa * 0.7;
      const h = grupo / d.series.length;
      d.series.forEach((s, k) => {
        const v = s.valores[i];
        if (v === null || v === undefined) return;
        const a = xDe(Math.min(0, v));
        const b = xDe(Math.max(0, v));
        p.push({ tipo: 'retangulo', x: a, y: y0 + (faixa - grupo) / 2 + k * h, largura: b - a, altura: h, padrao: k });
      });
    });
    p.push({ tipo: 'traco', pontos: [[esq, base], [dir, base]], espessura, tracejado: [] });
    p.push({ tipo: 'traco', pontos: [[xDe(0), topo], [xDe(0), base]], espessura, tracejado: [] });
    marcas.forEach((v, i) => {
      p.push({ tipo: 'traco', pontos: [[xDe(v), base], [xDe(v), base + f * 0.3]], espessura, tracejado: [] });
      p.push({ tipo: 'texto', x: xDe(v), y: base + f * 0.4, texto: textoMarca[i]!, tamanho: f, alinhar: 'centro', base: 'topo' });
    });
    return p;
  }

  // Colunas e linhas: categorias embaixo, valores à esquerda.
  const esq = larguraMarcas + f * 0.8;
  const dir = largura - f * 0.5;
  // Espaço para a metade de cima do texto da marca mais alta (centrado na linha).
  const topo = f * 0.9;
  const faixa = (dir - esq) / n;
  const maiorCategoria = Math.max(...d.categorias.map((c) => medir(c, f)));
  const inclinar = maiorCategoria > faixa * 0.95;
  const alturaCategorias = inclinar ? Math.min(baixo * 0.35, maiorCategoria * 0.72 + f) : f * 1.6;
  const base = baixo - alturaCategorias;
  const yDe = (v: number) => base - ((v - esc.inicio) / (esc.fim - esc.inicio)) * (base - topo);
  marcas.forEach((v, i) => {
    p.push({ tipo: 'traco', pontos: [[esq - f * 0.3, yDe(v)], [esq, yDe(v)]], espessura, tracejado: [] });
    p.push({ tipo: 'texto', x: esq - f * 0.45, y: yDe(v), texto: textoMarca[i]!, tamanho: f, alinhar: 'fim', base: 'meio' });
  });
  d.categorias.forEach((c, i) => {
    const x = esq + (i + 0.5) * faixa;
    if (inclinar) p.push({ tipo: 'texto', x, y: base + f * 0.4, texto: c, tamanho: f, alinhar: 'fim', base: 'meio', rotacao: -Math.PI / 4 });
    else p.push({ tipo: 'texto', x, y: base + f * 0.4, texto: c, tamanho: f, alinhar: 'centro', base: 'topo' });
  });
  if (forma === 'colunas') {
    d.categorias.forEach((_c, i) => {
      const grupo = faixa * 0.7;
      const w = grupo / d.series.length;
      d.series.forEach((s, k) => {
        const v = s.valores[i];
        if (v === null || v === undefined) return;
        const a = yDe(Math.max(0, v));
        const b = yDe(Math.min(0, v));
        p.push({ tipo: 'retangulo', x: esq + i * faixa + (faixa - grupo) / 2 + k * w, y: a, largura: w, altura: b - a, padrao: k });
      });
    });
  } else {
    d.series.forEach((s, k) => {
      let trecho: Ponto[] = [];
      const fechar = () => {
        if (trecho.length > 1) p.push({ tipo: 'traco', pontos: trecho, espessura: espessura * 1.5, tracejado: TRACEJADOS[k % TRACEJADOS.length]!.map((v) => v * espessura) });
        trecho = [];
      };
      s.valores.forEach((v, i) => {
        if (v === null) return fechar();
        trecho.push([esq + (i + 0.5) * faixa, yDe(v)]);
      });
      fechar();
      s.valores.forEach((v, i) => {
        if (v !== null) p.push({ tipo: 'marcador', x: esq + (i + 0.5) * faixa, y: yDe(v), tamanho: f * 0.5, forma: k });
      });
    });
  }
  // Eixos por cima das colunas: o vertical à esquerda e a linha do zero.
  p.push({ tipo: 'traco', pontos: [[esq, topo], [esq, base]], espessura, tracejado: [] });
  p.push({ tipo: 'traco', pontos: [[esq, yDe(0)], [dir, yDe(0)]], espessura, tracejado: [] });
  return p;
}
