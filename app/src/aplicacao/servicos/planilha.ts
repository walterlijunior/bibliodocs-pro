/**
 * Dados de planilha para a tabela (M5-T05; RF-09; D-M5-01): colagem do Excel e do LibreOffice (HTML ou TSV) e CSV.
 * Funções puras: a leitura do HTML da área de transferência fica na interface (`planilha-colada.ts`), que entrega a
 * grade no modelo do HTML (cada linha lista só as células que começam nela).
 *
 * A conversão nunca descarta texto em silêncio; o que mudou ou ficou de fora vai para o relatório:
 * - números (P-C3: vírgula decimal, milhares com ponto): no modo "ponto" o separador decimal do arquivo é o ponto, e
 *   "1,234.5" vira "1.234,5" e "12.5" vira "12,5"; no modo "vírgula" (padrão brasileiro) os números ficam como vieram.
 *   O modo sugerido vem dos números que só se leem de um jeito (D-M5-29);
 * - datas ISO ("2024-03-15") viram "15/03/2024"; as outras ficam como vieram;
 * - célula vazia nas colunas de números fica vazia, ou recebe o sinal escolhido (RN-262, RN-263);
 * - "-" sozinho será gravado como "–" (RN-264), como na janela;
 * - grade irregular é completada com células vazias; mesclagem que sobrepõe outra ou sai da grade é reduzida;
 *   linhas e colunas além do limite do formato ficam de fora, com aviso.
 */
import { LIMITES_V1 } from '../../dominio/esquemas';
import { ehDadoNumerico, textoDaCelula } from '../../dominio/visuais';
import type { AlinhamentoColuna } from '../../dominio/modelo';
import type { CelulaRascunho, RascunhoTabela } from './tabelas';

/** Célula lida da planilha, no modelo do HTML. */
export interface CelulaPlanilha {
  texto: string;
  colunas?: number;
  linhas?: number;
}

export interface PlanilhaLida {
  linhas: CelulaPlanilha[][];
  /** Linhas de cabeçalho marcadas na origem (`<th>`/`<thead>` do HTML), quando há. */
  linhasCabecalho?: number;
  /** Avisos da leitura (mais de uma tabela colada, arquivo fora do UTF-8…). */
  avisos: string[];
}

export type SinalParaVazio = '' | '–' | '..' | '...' | 'X';

export interface OpcoesPlanilha {
  /** Separador decimal dos números na origem. */
  decimal: 'virgula' | 'ponto';
  /** O que pôr nas células vazias das colunas de números ('' = deixar vazias). */
  vazios: SinalParaVazio;
  linhasCabecalho: number;
}

export interface PlanilhaConvertida {
  grade: (CelulaRascunho | null)[][];
  alinhamentos: AlinhamentoColuna[];
  linhasCabecalho: number;
  /** O que mudou ou ficou de fora, em frases para a prévia. */
  relatorio: string[];
  /** Nenhuma célula com texto: nada a usar. */
  vazia: boolean;
}

/** Tamanho máximo do CSV (o mesmo teto da importação de bibliografia). */
export const LIMITE_BYTES_CSV = 4 * 1024 * 1024;
const EXEMPLOS = 8;

// ---------------------------------------------------------------------------------------------------------
// Texto separado (TSV da área de transferência, CSV)
// ---------------------------------------------------------------------------------------------------------

/** Separador do CSV: o que mais aparece fora de aspas na primeira linha com conteúdo (empate: ";", o do Excel em pt-BR). */
export function detectarSeparador(texto: string): ';' | ',' | '\t' {
  const conta = { ';': 0, ',': 0, '\t': 0 };
  let aspas = false;
  for (const ch of texto) {
    if (ch === '"') aspas = !aspas;
    else if (!aspas && (ch === '\n' || ch === '\r')) {
      if (conta[';'] + conta[','] + conta['\t'] > 0) break;
    } else if (!aspas && ch in conta) conta[ch as keyof typeof conta]++;
  }
  if (conta['\t'] > conta[';'] && conta['\t'] > conta[',']) return '\t';
  return conta[','] > conta[';'] ? ',' : ';';
}

/**
 * Texto separado por `separador`, com aspas como no CSV (RFC 4180) e no TSV do Excel: campo entre aspas pode ter o
 * separador, quebra de linha e `""`. A linha vazia do fim (o Excel termina com quebra) não conta.
 */
export function lerTextoSeparado(texto: string, separador: string): CelulaPlanilha[][] {
  const t = texto.replace(/^﻿/, '');
  const linhas: CelulaPlanilha[][] = [];
  let linha: CelulaPlanilha[] = [];
  let campo = '';
  let aspas = false;
  let inicioDeCampo = true;
  const fecharCampo = () => {
    linha.push({ texto: campo });
    campo = '';
    inicioDeCampo = true;
  };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (aspas) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"' && inicioDeCampo) {
      aspas = true;
      inicioDeCampo = false;
    } else if (ch === separador) fecharCampo();
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      fecharCampo();
      linhas.push(linha);
      linha = [];
    } else {
      campo += ch;
      inicioDeCampo = false;
    }
  }
  if (campo !== '' || linha.length > 0 || !inicioDeCampo) {
    fecharCampo();
    linhas.push(linha);
  }
  return linhas;
}

/** CSV já decodificado (a interface decodifica: UTF-8, ou Windows-1252 com aviso, como na importação de bibliografia). */
export function lerCsv(texto: string, avisos: readonly string[] = []): PlanilhaLida {
  return { linhas: lerTextoSeparado(texto, detectarSeparador(texto)), avisos: [...avisos] };
}

// ---------------------------------------------------------------------------------------------------------
// Números e datas
// ---------------------------------------------------------------------------------------------------------

const PT_AGRUPADO = /^[-−]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;
const PT_DECIMAL = /^[-−]?\d+,\d+$/;
const EN_AGRUPADO = /^[-−]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
const EN_DECIMAL = /^[-−]?\d+\.\d+$/;

/** Número que só se lê no padrão inglês (ponto decimal): "1,234.5", "12.5", "1234.567". */
const soIngles = (t: string): boolean =>
  (/^[-−]?\d{1,3}(?:,\d{3})+\.\d+$/.test(t)) || (EN_DECIMAL.test(t) && !/^[-−]?\d{1,3}\.\d{3}$/.test(t));
/** Número que só se lê no padrão brasileiro: "12,5", "1.234.567", "1.234,5". */
const soBrasileiro = (t: string): boolean => PT_DECIMAL.test(t) || (PT_AGRUPADO.test(t) && (t.includes(',') || (t.match(/\./g)?.length ?? 0) > 1));

/** Número no padrão inglês reescrito no brasileiro (troca vírgula e ponto); outro texto volta igual. */
function paraBrasileiro(t: string): string {
  if (EN_AGRUPADO.test(t) || EN_DECIMAL.test(t)) return t.replace(/[.,]/g, (s) => (s === '.' ? ',' : '.'));
  return t;
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]00:00(?::00(?:\.0+)?)?Z?)?$/;

function dataBrasileira(t: string): string | null {
  const m = DATA_ISO.exec(t);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const ehDado = (t: string): boolean => ehDadoNumerico(textoDaCelula({ conteudo: [{ tipo: 'texto', texto: t }] }));

// ---------------------------------------------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------------------------------------------

interface Posicionada {
  texto: string;
  l: number;
  c: number;
  colunas: number;
  linhas: number;
}

/** Põe as células na grade como o navegador poria, reduzindo mesclagens que sobrepõem outra ou passam do limite. */
function posicionar(linhas: readonly CelulaPlanilha[][], maxLinhas: number, rel: Contagem): { celulas: Posicionada[]; nLinhas: number; nColunas: number } {
  const nLinhas = Math.min(linhas.length, maxLinhas);
  if (linhas.length > nLinhas) rel.linhasFora += linhas.length - nLinhas;
  const ocupada: boolean[][] = Array.from({ length: nLinhas }, () => []);
  const livre = (l: number, c: number) => !ocupada[l]![c];
  const celulas: Posicionada[] = [];
  let nColunas = 0;
  for (let l = 0; l < nLinhas; l++) {
    let c = 0;
    for (const cel of linhas[l]!) {
      while (!livre(l, c)) c++;
      if (c >= LIMITES_V1.colunasTabela) {
        if (cel.texto.trim() !== '') rel.celulasFora++;
        continue;
      }
      const pedidas = { colunas: Math.max(1, Math.floor(cel.colunas ?? 1)), linhas: Math.max(1, Math.floor(cel.linhas ?? 1)) };
      let w = 1;
      while (w < pedidas.colunas && c + w < LIMITES_V1.colunasTabela && livre(l, c + w)) w++;
      let h = 1;
      const linhaLivre = (ll: number) => Array.from({ length: w }, (_, k) => livre(ll, c + k)).every(Boolean);
      while (h < pedidas.linhas && l + h < nLinhas && linhaLivre(l + h)) h++;
      if (w !== pedidas.colunas || h !== pedidas.linhas) rel.mesclagensAjustadas++;
      for (let ll = l; ll < l + h; ll++) for (let cc = c; cc < c + w; cc++) ocupada[ll]![cc] = true;
      celulas.push({ texto: cel.texto, l, c, colunas: w, linhas: h });
      nColunas = Math.max(nColunas, c + w);
      c += w;
    }
  }
  return { celulas, nLinhas, nColunas };
}

interface Contagem {
  linhasFora: number;
  celulasFora: number;
  mesclagensAjustadas: number;
  completadas: number;
}

const vazia = (x: CelulaRascunho | null) => x !== null && x.campo.texto.trim() === '' && x.colunas === 1 && x.linhas === 1;

/** Grade completa, sem linhas e colunas vazias no fim (a quebra final do Excel, o ";" final do CSV). */
function gradeCompleta(p: PlanilhaLida, rel: Contagem): (CelulaRascunho | null)[][] {
  const { celulas, nLinhas, nColunas } = posicionar(p.linhas, LIMITES_V1.linhasTabela, rel);
  let grade: (CelulaRascunho | null)[][] = Array.from({ length: nLinhas }, () => new Array<CelulaRascunho | null>(nColunas).fill(null));
  const coberta: boolean[][] = Array.from({ length: nLinhas }, () => new Array<boolean>(nColunas).fill(false));
  for (const x of celulas) {
    grade[x.l]![x.c] = { campo: { texto: x.texto.replace(/ /g, ' ').trim() }, colunas: x.colunas, linhas: x.linhas };
    for (let l = x.l; l < x.l + x.linhas; l++) for (let c = x.c; c < x.c + x.colunas; c++) coberta[l]![c] = true;
  }
  grade.forEach((linha, l) => {
    for (let c = 0; c < nColunas; c++) if (!coberta[l]![c]) linha[c] = { campo: { texto: '' }, colunas: 1, linhas: 1 };
  });
  while (grade.length > 1 && grade.at(-1)!.every(vazia)) grade.pop();
  while ((grade[0]?.length ?? 0) > 1 && grade.every((linha) => vazia(linha.at(-1)!))) grade = grade.map((linha) => linha.slice(0, -1));
  // Linhas completadas: só as que ficaram, nas colunas que ficaram.
  const largura = grade[0]?.length ?? 0;
  rel.completadas = grade.filter((_, l) => coberta[l]!.slice(0, largura).some((x) => !x)).length;
  // Linhas × colunas: o limite de posições do formato.
  const nCol = grade[0]?.length ?? 0;
  const maxLinhas = nCol > 0 ? Math.floor(LIMITES_V1.posicoesTabela / nCol) : grade.length;
  if (grade.length > maxLinhas) {
    rel.linhasFora += grade.length - maxLinhas;
    grade = grade.slice(0, maxLinhas);
    grade.forEach((linha, l) => linha.forEach((x) => x && l + x.linhas > maxLinhas && (x.linhas = maxLinhas - l)));
  }
  return grade;
}

/** Cabeçalho que não corta mesclagem: cresce até a última linha da célula que o atravessa. */
function cabecalhoSemCorte(grade: readonly (CelulaRascunho | null)[][], n: number): number {
  let h = Math.max(0, Math.min(n, grade.length));
  for (let mudou = true; mudou; ) {
    mudou = false;
    grade.forEach((linha, l) =>
      linha.forEach((x) => {
        if (x && l < h && l + x.linhas > h) {
          h = l + x.linhas;
          mudou = true;
        }
      }),
    );
  }
  return h;
}

/** Opções sugeridas para a prévia: separador decimal pelos números inequívocos, cabeçalho pelos `<th>` ou pela 1.ª linha sem números. */
export function opcoesSugeridas(p: PlanilhaLida): OpcoesPlanilha {
  let ingles = 0;
  let brasileiro = 0;
  for (const linha of p.linhas) {
    for (const c of linha) {
      const t = c.texto.trim();
      if (soIngles(t)) ingles++;
      else if (soBrasileiro(t)) brasileiro++;
    }
  }
  const decimal = ingles > 0 && brasileiro === 0 ? 'ponto' : 'virgula';
  let linhasCabecalho = p.linhasCabecalho ?? 0;
  if (p.linhasCabecalho === undefined && p.linhas.length > 1) {
    const temDado = (linha: readonly CelulaPlanilha[]) => linha.some((c) => c.texto.trim() !== '' && ehDado(c.texto.trim()));
    const primeiraSemNumero = !temDado(p.linhas[0]!);
    linhasCabecalho = primeiraSemNumero ? 1 : 0;
  }
  return { decimal, vazios: '', linhasCabecalho };
}

const lista = (itens: readonly string[], total: number): string =>
  `${itens.slice(0, EXEMPLOS).join('; ')}${total > EXEMPLOS ? `; e mais ${total - EXEMPLOS}` : ''}`;
const plural = (n: number, um: string, varios: string): string => (n === 1 ? um : varios.replace('#', String(n)));

/** Converte a planilha lida com as opções da prévia. */
export function converterPlanilha(p: PlanilhaLida, especie: 'tabela' | 'quadro', opcoes: OpcoesPlanilha): PlanilhaConvertida {
  const cont: Contagem = { linhasFora: 0, celulasFora: 0, mesclagensAjustadas: 0, completadas: 0 };
  const grade = gradeCompleta(p, cont);
  const nColunas = grade[0]?.length ?? 0;
  const linhasCabecalho = cabecalhoSemCorte(grade, opcoes.linhasCabecalho);

  let numerosConvertidos = 0;
  let exemploNumero = '';
  let datas = 0;
  let hifens = 0;
  for (const linha of grade) {
    for (const x of linha) {
      if (!x) continue;
      const t = x.campo.texto;
      const data = dataBrasileira(t);
      if (data !== null) {
        x.campo = { texto: data };
        datas++;
        continue;
      }
      if (opcoes.decimal === 'ponto') {
        const novo = paraBrasileiro(t);
        if (novo !== t) {
          if (exemploNumero === '') exemploNumero = `${t} → ${novo}`;
          x.campo = { texto: novo };
          numerosConvertidos++;
        }
      }
      if (x.campo.texto === '-') hifens++;
    }
  }

  // Colunas de números: no corpo, a maioria das células com texto é número ou sinal (a 1.ª coluna é a indicadora).
  const numerica = Array.from({ length: nColunas }, (_, c) => {
    if (c === 0 && nColunas > 1) return false;
    let total = 0;
    let dados = 0;
    grade.forEach((linha, l) => {
      const x = linha[c];
      if (l < linhasCabecalho || !x || x.campo.texto === '') return;
      total++;
      if (ehDado(x.campo.texto)) dados++;
    });
    return total > 0 && dados * 2 >= total;
  });
  const alinhamentos: AlinhamentoColuna[] = numerica.map((n) => (n ? 'direita' : 'esquerda'));

  const vazios: string[] = [];
  const naoNumericas: string[] = [];
  grade.forEach((linha, l) => {
    if (l < linhasCabecalho) return;
    linha.forEach((x, c) => {
      if (!x || !numerica[c]) return;
      const onde = `linha ${l + 1}, coluna ${c + 1}`;
      if (x.campo.texto === '') {
        vazios.push(onde);
        if (opcoes.vazios !== '') x.campo = { texto: opcoes.vazios };
      } else if (!ehDado(x.campo.texto)) naoNumericas.push(`${onde}: “${x.campo.texto.length > 30 ? `${x.campo.texto.slice(0, 30)}…` : x.campo.texto}”`);
    });
  });

  const relatorio: string[] = [...p.avisos];
  if (numerosConvertidos > 0) relatorio.push(`${plural(numerosConvertidos, 'Um número convertido', '# números convertidos')} para o padrão brasileiro (ex.: ${exemploNumero}).`);
  if (datas > 0) relatorio.push(`${plural(datas, 'Uma data convertida', '# datas convertidas')} para dia/mês/ano.`);
  if (hifens > 0) relatorio.push(`${plural(hifens, 'Uma célula', '# células')} com “-” ${hifens === 1 ? 'será gravada' : 'serão gravadas'} com “–”, o sinal de dado igual a zero (RN-264).`);
  if (vazios.length > 0) {
    relatorio.push(
      opcoes.vazios !== ''
        ? `${plural(vazios.length, 'Uma célula vazia recebeu', '# células vazias receberam')} “${opcoes.vazios}”: ${lista(vazios, vazios.length)}.`
        : `${plural(vazios.length, 'Uma célula vazia', '# células vazias')} nas colunas de números ficou como veio (o IBGE pede um sinal convencional no lugar do dado, RN-262): ${lista(vazios, vazios.length)}.`,
    );
  }
  if (especie === 'tabela' && naoNumericas.length > 0) {
    relatorio.push(`Não convertido, nas colunas de números (não é número nem sinal convencional; o texto foi mantido): ${lista(naoNumericas, naoNumericas.length)}.`);
  }
  if (cont.completadas > 0) relatorio.push(`${plural(cont.completadas, 'Uma linha tinha', '# linhas tinham')} menos células: completadas com células vazias.`);
  if (cont.mesclagensAjustadas > 0) relatorio.push(`${plural(cont.mesclagensAjustadas, 'Uma mesclagem foi reduzida', '# mesclagens foram reduzidas')} para caber na grade.`);
  if (linhasCabecalho !== opcoes.linhasCabecalho) relatorio.push(`O cabeçalho ficou com ${linhasCabecalho} linhas para não cortar uma célula mesclada.`);
  if (cont.linhasFora > 0) relatorio.push(`Ficaram de fora ${plural(cont.linhasFora, 'uma linha', '# linhas')}, além do tamanho máximo da tabela.`);
  if (cont.celulasFora > 0) relatorio.push(`Ficaram de fora ${plural(cont.celulasFora, 'uma célula', '# células')} além da ${LIMITES_V1.colunasTabela}.ª coluna (o máximo do Word).`);
  const semTexto = grade.every((linha) => linha.every((x) => x === null || x.campo.texto === ''));
  return { grade, alinhamentos, linhasCabecalho, relatorio, vazia: grade.length === 0 || semTexto };
}

/** Os dados da planilha no lugar da grade do rascunho; título, fonte e notas ficam. */
export function aplicarPlanilha(r: RascunhoTabela, c: PlanilhaConvertida): RascunhoTabela {
  return { ...r, grade: c.grade, alinhamentos: c.alinhamentos, linhasCabecalho: c.linhasCabecalho };
}
