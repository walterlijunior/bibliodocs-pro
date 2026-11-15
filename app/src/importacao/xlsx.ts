/**
 * Leitura de uma pasta de trabalho do Excel (.xlsx) para "Importar planilha" (Etapa 4 da especificação de atualização:
 * importar por aba). Puro: recebe os bytes e devolve as abas com as células como aparecem na tela, sem tocar no disco
 * e sem alterar o arquivo de origem. Roda no renderer (o arquivo vem do `<input type="file">`) e nos testes.
 *
 * O que é lido, do jeito que o Excel e o LibreOffice gravam (SpreadsheetML):
 * - abas na ordem do `xl/workbook.xml`, com o nome e se estão ocultas;
 * - células: texto compartilhado (inclusive o rico), texto em linha, número, lógico, erro; a **fórmula vale pelo
 *   resultado gravado** (`<v>`); sem resultado gravado, a célula fica marcada (`semResultado`) para a prévia avisar;
 * - número com o **formato de exibição** da célula (casas decimais, milhar, porcentagem, moeda, seções de negativo e de
 *   zero, data), no padrão brasileiro (vírgula decimal), para a tabela receber o que o autor vê na planilha;
 * - quebras de linha dentro da célula (`\n`), acentos (UTF-8 do XML) e os escapes `_xHHHH_` do OOXML;
 * - mesclagens (`mergeCells`), alinhamento horizontal, quebra automática, negrito, itálico, bordas e cor de fundo, linhas
 *   e colunas ocultas: o que o modelo da tabela guarda vai para a grade; o resto entra no relatório da prévia.
 *
 * O XML é lido por expressões regulares sobre partes conhecidas, sem avaliar nada; o ZIP tem teto de tamanho
 * comprimido e descomprimido, e cada aba tem teto de células (arquivo malicioso não esgota a memória).
 */
import { strFromU8, unzipSync } from 'fflate';

export const LIMITE_BYTES_XLSX = 20 * 1024 * 1024;
const LIMITE_PARTE = 30 * 1024 * 1024;
/** Células com conteúdo lidas por aba; o resto é contado e avisado. */
export const LIMITE_CELULAS_ABA = 100_000;

export type AlinhamentoXlsx = 'esquerda' | 'centro' | 'direita';

export interface BordasXlsx {
  cima: boolean;
  baixo: boolean;
  esquerda: boolean;
  direita: boolean;
}

export interface CelulaXlsx {
  /** Linha e coluna, a partir de 0. */
  l: number;
  c: number;
  /** Texto como a planilha mostra (número já formatado). Vazio = célula sem valor. */
  texto: string;
  tipo: 'texto' | 'numero' | 'logico' | 'erro' | 'vazio';
  /** Valor numérico gravado, quando é número (para conferir a precisão). */
  valor?: number;
  formula?: boolean;
  /** Fórmula sem resultado gravado no arquivo: o texto ficou vazio. */
  semResultado?: boolean;
  alinhamento?: AlinhamentoXlsx;
  quebraAutomatica?: boolean;
  negrito?: boolean;
  italico?: boolean;
  cor?: boolean;
  bordas?: BordasXlsx;
}

/** Retângulo de células, a partir de 0, inclusivo. */
export interface IntervaloXlsx {
  l1: number;
  c1: number;
  l2: number;
  c2: number;
}

export interface AbaXlsx {
  nome: string;
  oculta: boolean;
  /** Células com valor ou com estilo que importa (bordas), na ordem de linha e coluna. */
  celulas: CelulaXlsx[];
  mesclagens: IntervaloXlsx[];
  linhasOcultas: number[];
  colunasOcultas: number[];
  /** Área preenchida: o menor retângulo com todas as células com valor (e as mesclagens que as contêm); `null` = aba vazia. */
  preenchida: IntervaloXlsx | null;
  /** Células com conteúdo além do limite, não lidas. */
  celulasNaoLidas: number;
}

export interface PastaXlsx {
  abas: AbaXlsx[];
  avisos: string[];
}

export type ResultadoLerXlsx = { ok: true; pasta: PastaXlsx } | { ok: false; mensagem: string };

// ---------------------------------------------------------------------------------------------------------
// Endereços
// ---------------------------------------------------------------------------------------------------------

/** "C" → 2, "AB" → 27. */
export function indiceColuna(letras: string): number {
  let n = 0;
  for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 2 → "C", 27 → "AB". */
export function letrasColuna(c: number): string {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** "C24" → { l: 23, c: 2 }; inválido = null. */
export function lerEndereco(ref: string): { l: number; c: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(ref.trim());
  if (!m) return null;
  const c = indiceColuna(m[1]!);
  const l = Number(m[2]) - 1;
  if (l < 0 || c < 0 || c > 16383 || l > 1_048_575) return null;
  return { l, c };
}

/** "A1:C39" (ou "B5", ou "C39:A1") → intervalo normalizado; inválido = null. */
export function lerIntervalo(texto: string): IntervaloXlsx | null {
  const partes = texto.trim().split(':');
  if (partes.length < 1 || partes.length > 2) return null;
  const a = lerEndereco(partes[0]!);
  const b = partes.length === 2 ? lerEndereco(partes[1]!) : a;
  if (!a || !b) return null;
  return { l1: Math.min(a.l, b.l), c1: Math.min(a.c, b.c), l2: Math.max(a.l, b.l), c2: Math.max(a.c, b.c) };
}

export const textoIntervalo = (i: IntervaloXlsx): string =>
  i.l1 === i.l2 && i.c1 === i.c2 ? `${letrasColuna(i.c1)}${i.l1 + 1}` : `${letrasColuna(i.c1)}${i.l1 + 1}:${letrasColuna(i.c2)}${i.l2 + 1}`;

// ---------------------------------------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------------------------------------

const desfazerEntidades = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

/** Texto de `<t>`: entidades, escapes `_xHHHH_` do OOXML e quebras normalizadas para `\n` (o formato recusa `\r`). */
function textoXml(bruto: string): string {
  return desfazerEntidades(bruto)
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B-\u001F￾￿]/g, '');
}

const attr = (attrs: string, nome: string): string | undefined => new RegExp(`(?:^|\\s)${nome}="([^"]*)"`).exec(attrs)?.[1];

/** Texto de um `<si>` ou `<is>`: os `<t>` na ordem, fora dos `<rPh>` (guia fonética do japonês). */
function textoDeSi(si: string): string {
  const semFonetica = si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let s = '';
  for (const m of semFonetica.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) s += m[1] ?? '';
  return textoXml(s);
}

// ---------------------------------------------------------------------------------------------------------
// Estilos e formato de número
// ---------------------------------------------------------------------------------------------------------

interface EstiloCelula {
  formato: string;
  alinhamento?: AlinhamentoXlsx;
  quebra?: boolean;
  negrito?: boolean;
  italico?: boolean;
  cor?: boolean;
  bordas?: BordasXlsx;
}

/** Formatos internos do Excel (ECMA-376, 18.8.30) que importam aqui. */
const FORMATOS_INTERNOS: Record<number, string> = {
  0: 'General',
  1: '0',
  2: '0.00',
  3: '#,##0',
  4: '#,##0.00',
  9: '0%',
  10: '0.00%',
  11: '0.00E+00',
  12: '# ?/?',
  13: '# ??/??',
  14: 'dd/mm/yyyy',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  18: 'h:mm AM/PM',
  19: 'h:mm:ss AM/PM',
  20: 'h:mm',
  21: 'h:mm:ss',
  22: 'dd/mm/yyyy h:mm',
  37: '#,##0 ;(#,##0)',
  38: '#,##0 ;[Red](#,##0)',
  39: '#,##0.00;(#,##0.00)',
  40: '#,##0.00;[Red](#,##0.00)',
  45: 'mm:ss',
  46: '[h]:mm:ss',
  47: 'mmss.0',
  48: '##0.0E+0',
  49: '@',
};

function lerEstilos(xml: string): EstiloCelula[] {
  const formatos = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\s([^>]*?)\/?>/g)) {
    const id = attr(m[1]!, 'numFmtId');
    const codigo = attr(m[1]!, 'formatCode');
    if (id !== undefined && codigo !== undefined) formatos.set(Number(id), desfazerEntidades(codigo));
  }
  const lista = (tag: string, item: string): string[] => {
    const corpo = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1] ?? '';
    // `[^>]*?` preguiçoso: o `<xf …/>` fechado em si mesmo não engole o elemento seguinte.
    return [...corpo.matchAll(new RegExp(`<${item}(?:\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</${item}>)`, 'g'))].map((x) => x[0]);
  };
  const fontes = lista('fonts', 'font').map((f) => ({
    negrito: /<b(?:\s+val="(?:1|true)")?\s*\/>/.test(f),
    italico: /<i(?:\s+val="(?:1|true)")?\s*\/>/.test(f),
    cor: (() => {
      const cor = /<color\s([^>]*)\/>/.exec(f)?.[1] ?? '';
      const rgb = attr(cor, 'rgb');
      return rgb !== undefined && !/^(FF)?000000$/i.test(rgb);
    })(),
  }));
  const preenchimentos = lista('fills', 'fill').map((f) => {
    const tipo = /patternType="([^"]*)"/.exec(f)?.[1];
    return tipo !== undefined && tipo !== 'none' && tipo !== 'gray125';
  });
  const temLado = (b: string, lado: string): boolean => {
    const m = new RegExp(`<${lado}(\\s[^>]*)?(?:/>|>)`).exec(b);
    return m !== null && /style="(?!none")[^"]+"/.test(m[1] ?? '');
  };
  const bordas = lista('borders', 'border').map((b) => ({
    cima: temLado(b, 'top'),
    baixo: temLado(b, 'bottom'),
    esquerda: temLado(b, 'left') || temLado(b, 'start'),
    direita: temLado(b, 'right') || temLado(b, 'end'),
  }));
  return lista('cellXfs', 'xf').map((xf) => {
    const abre = /<xf\s([^>]*?)\/?>/.exec(xf)?.[1] ?? '';
    const numFmtId = Number(attr(abre, 'numFmtId') ?? 0);
    const fonte = fontes[Number(attr(abre, 'fontId') ?? 0)];
    const borda = bordas[Number(attr(abre, 'borderId') ?? 0)];
    const fundo = preenchimentos[Number(attr(abre, 'fillId') ?? 0)] ?? false;
    const al = /<alignment\s([^>]*?)\/?>/.exec(xf)?.[1] ?? '';
    const h = attr(al, 'horizontal');
    const alinhamento: AlinhamentoXlsx | undefined =
      h === 'left' ? 'esquerda' : h === 'center' || h === 'centerContinuous' ? 'centro' : h === 'right' ? 'direita' : undefined;
    const e: EstiloCelula = { formato: formatos.get(numFmtId) ?? FORMATOS_INTERNOS[numFmtId] ?? 'General' };
    if (alinhamento) e.alinhamento = alinhamento;
    if (attr(al, 'wrapText') === '1' || attr(al, 'wrapText') === 'true') e.quebra = true;
    if (fonte?.negrito) e.negrito = true;
    if (fonte?.italico) e.italico = true;
    if (fonte?.cor || fundo) e.cor = true;
    if (borda && (borda.cima || borda.baixo || borda.esquerda || borda.direita)) e.bordas = borda;
    return e;
  });
}

/** Número com `casas` decimais no padrão brasileiro, com ou sem separador de milhar. */
function numeroBr(v: number, casas: number, milhar: boolean): string {
  const fixo = Math.abs(v).toFixed(casas);
  const [int, dec] = fixo.split('.');
  const inteiro = milhar ? int!.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : int!;
  return `${v < 0 ? '-' : ''}${inteiro}${dec !== undefined ? `,${dec}` : ''}`;
}

/** "Geral": até 11 caracteres, como o Excel mostra, com vírgula decimal. */
export function formatoGeral(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v) && Math.abs(v) < 1e11) return String(v);
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e11 || abs < 1e-9)) return v.toExponential(5).replace('.', ',').replace(/(,\d*?)0+e/, '$1e').replace(',e', 'e').toUpperCase();
  const digitosInteiros = Math.max(1, Math.floor(Math.log10(abs || 1)) + 1);
  const casas = Math.max(0, Math.min(10 - digitosInteiros, 15));
  const s = v.toFixed(casas).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Número de série do Excel (sistema 1900) → data e hora. */
function dataDoSerial(serial: number, base1904: boolean): Date {
  const dias = base1904 ? serial + 1462 : serial;
  // 25569 = dias de 30/12/1899 a 01/01/1970; o Excel conta 29/02/1900, que não existiu.
  const ms = Math.round((dias - 25569) * 86400000);
  return new Date(ms);
}

function formatarData(v: number, codigo: string, base1904: boolean): string {
  const d = dataDoSerial(v, base1904);
  const dois = (n: number) => String(n).padStart(2, '0');
  const dia = d.getUTCDate();
  const mes = d.getUTCMonth() + 1;
  const ano = d.getUTCFullYear();
  const c = codigo.toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '').replace(/\\./g, '');
  const temDia = /d/.test(c);
  const temAno = /y/.test(c);
  const temHora = /h/.test(c) || /:m|m:|s/.test(c.replace(/mmm+/g, ''));
  const hora = temHora ? `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}${/s/.test(c) ? `:${dois(d.getUTCSeconds())}` : ''}` : '';
  let data = '';
  if (temDia && temAno) data = `${dois(dia)}/${dois(mes)}/${ano}`;
  else if (/mmm/.test(c) && temAno) data = `${MESES[mes - 1]}/${String(ano).slice(/yyyy/.test(c) ? 0 : 2)}`;
  else if (temAno) data = `${dois(mes)}/${ano}`;
  else if (temDia) data = `${dois(dia)}/${dois(mes)}`;
  return [data, hora].filter((x) => x !== '').join(' ') || formatoGeral(v);
}

/**
 * Número com o código de formato do Excel, no padrão brasileiro. Cobre o que as planilhas acadêmicas usam: seções
 * (positivo;negativo;zero;texto), casas decimais, milhar, porcentagem, notação científica, texto literal (moeda, "-" do
 * formato contábil), datas e horas. Código que não se reconhece cai no "Geral".
 */
export function formatarNumero(v: number, codigo: string, base1904 = false): string {
  if (codigo === '' || /^general$/i.test(codigo) || codigo === '@') return formatoGeral(v);
  const secoes = dividirSecoes(codigo);
  let secao = secoes[0]!;
  let valor = v;
  let sinalNoFormato = false;
  // Seção com condição ([>=100]) não é tratada: fica a primeira, como o Excel faz quando nenhuma condição bate.
  if (v < 0 && secoes.length >= 2 && secoes[1]!.trim() !== '') {
    secao = secoes[1]!;
    valor = -v;
    sinalNoFormato = true;
  } else if (v === 0 && secoes.length >= 3) secao = secoes[2]!;
  const limpo = secao.replace(/\[(?!\$)[^\]]*\]/g, '');
  const semLiterais = limpo.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/[_*]./g, '').replace(/\[[^\]]*\]/g, '');
  if (!/[0#?]/.test(semLiterais) && /[dmyhs]/i.test(semLiterais)) return formatarData(v, limpo, base1904);
  // Tokens: literais antes e depois do número, e a máscara do número (0 # ? . , E+ E-).
  let antes = '';
  let depois = '';
  let mascara = '';
  const fase: { atual: 'antes' | 'numero' | 'depois' } = { atual: 'antes' };
  let pct = 0;
  const literal = (t: string) => {
    if (fase.atual === 'antes') antes += t;
    else {
      fase.atual = 'depois';
      depois += t;
    }
  };
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i]!;
    if (ch === '"') {
      const fim = limpo.indexOf('"', i + 1);
      literal(limpo.slice(i + 1, fim < 0 ? undefined : fim));
      i = fim < 0 ? limpo.length : fim;
    } else if (ch === '\\') {
      literal(limpo[i + 1] ?? '');
      i++;
    } else if (ch === '_' || ch === '*') i++; // espaço de alinhamento e preenchimento: sem efeito no texto
    else if (ch === '[') {
      const fim = limpo.indexOf(']', i);
      const dentro = limpo.slice(i + 1, fim < 0 ? undefined : fim);
      if (dentro.startsWith('$')) literal(dentro.slice(1).split('-')[0]!);
      i = fim < 0 ? limpo.length : fim;
    } else if (/[0#?]/.test(ch) && fase.atual !== 'depois') {
      fase.atual = 'numero';
      mascara += ch;
    } else if ((ch === '.' || ch === ',') && fase.atual !== 'depois' && /[0#?]/.test(limpo.slice(i + 1, i + 2) + mascara.slice(-1))) {
      fase.atual = 'numero';
      mascara += ch;
    } else if (ch === ',' && fase.atual === 'numero') mascara += ch;
    else if ((ch === 'E' || ch === 'e') && fase.atual === 'numero' && /[+-]/.test(limpo[i + 1] ?? '')) {
      mascara += `E${limpo[i + 1]}`;
      i++;
    } else if (ch === '%') {
      pct++;
      literal('%');
    } else literal(ch);
  }
  if (!/[0#?]/.test(mascara)) return `${antes}${depois}`.trim() || formatoGeral(v);
  let x = valor * 100 ** pct;
  const cientifica = /E[+-]/.exec(mascara);
  let corpo: string;
  if (cientifica) {
    const casas = (mascara.slice(0, cientifica.index).split('.')[1] ?? '').replace(/[^0#?]/g, '').length;
    corpo = x.toExponential(casas).replace('.', ',').replace(/e([+-])(\d)$/, 'e$10$2').replace('e', 'E');
  } else {
    // Vírgulas logo antes do ponto ou no fim da máscara dividem por mil (escala); no meio, separador de milhar.
    const escala = /(,+)(?=\.|$)/.exec(mascara)?.[1]?.length ?? 0;
    const m = escala > 0 ? mascara.replace(/,+(?=\.|$)/, '') : mascara;
    x = x / 1000 ** escala;
    const [inteira = '', fracao = ''] = m.split('.');
    const minimas = (fracao.match(/0/g) ?? []).length;
    const maximas = (fracao.match(/[0#?]/g) ?? []).length;
    corpo = numeroBr(x, maximas, inteira.includes(','));
    let [i2 = '', d = ''] = corpo.split(',');
    while (d.length > minimas && d.endsWith('0')) d = d.slice(0, -1);
    // Sem "0" obrigatório na parte inteira, o zero à esquerda some (#.00 → ,50; "-"?? → -).
    if (!/0/.test(inteira) && /^-?0$/.test(i2)) i2 = i2.replace('0', '');
    corpo = d === '' ? i2 : `${i2},${d}`;
  }
  if (corpo.startsWith('-') && sinalNoFormato) corpo = corpo.slice(1);
  const sinal = !sinalNoFormato && v < 0 && x !== 0 && !corpo.startsWith('-') ? '-' : '';
  const r = `${sinal}${antes}${corpo}${depois}`.replace(/\s+/g, ' ').trim();
  return r === '' ? '' : r;
}

function dividirSecoes(codigo: string): string[] {
  const secoes: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < codigo.length; i++) {
    const ch = codigo[i]!;
    if (ch === '"') aspas = !aspas;
    if (ch === '\\' && !aspas) {
      atual += ch + (codigo[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === ';' && !aspas) {
      secoes.push(atual);
      atual = '';
    } else atual += ch;
  }
  secoes.push(atual);
  return secoes;
}

// ---------------------------------------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------------------------------------

function lerAba(xml: string, nome: string, oculta: boolean, compartilhados: readonly string[], estilos: readonly EstiloCelula[], base1904: boolean): AbaXlsx {
  const celulas: CelulaXlsx[] = [];
  const linhasOcultas: number[] = [];
  const colunasOcultas: number[] = [];
  let naoLidas = 0;
  for (const m of xml.matchAll(/<col\s([^>]*?)\/?>/g)) {
    if (attr(m[1]!, 'hidden') === '1' || attr(m[1]!, 'hidden') === 'true') {
      const de = Number(attr(m[1]!, 'min') ?? 0) - 1;
      const ate = Math.min(Number(attr(m[1]!, 'max') ?? 0) - 1, de + 1000);
      for (let c = de; c <= ate; c++) colunasOcultas.push(c);
    }
  }
  const dados = /<sheetData(?:\s[^>]*)?>([\s\S]*?)<\/sheetData>/.exec(xml)?.[1] ?? '';
  let linhaAtual = -1;
  for (const r of dados.matchAll(/<row(\s[^>]*)?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const ra = r[1] ?? '';
    const rn = attr(ra, 'r');
    linhaAtual = rn !== undefined ? Number(rn) - 1 : linhaAtual + 1;
    if (attr(ra, 'hidden') === '1' || attr(ra, 'hidden') === 'true') linhasOcultas.push(linhaAtual);
    let colunaAtual = -1;
    for (const cm of (r[2] ?? '').matchAll(/<c(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = cm[1] ?? '';
      const corpo = cm[2] ?? '';
      const ref = attr(ca, 'r');
      const pos = ref !== undefined ? lerEndereco(ref) : { l: linhaAtual, c: colunaAtual + 1 };
      if (!pos) continue;
      colunaAtual = pos.c;
      const estilo = estilos[Number(attr(ca, 's') ?? 0)] ?? { formato: 'General' };
      const t = attr(ca, 't') ?? 'n';
      const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
      const formula = /<f[\s>/]/.test(corpo);
      const cel: CelulaXlsx = { l: pos.l, c: pos.c, texto: '', tipo: 'vazio' };
      if (t === 'inlineStr') {
        const is = /<is>([\s\S]*?)<\/is>/.exec(corpo)?.[1];
        if (is !== undefined) {
          cel.texto = textoDeSi(is);
          cel.tipo = 'texto';
        }
      } else if (v !== undefined) {
        const bruto = textoXml(v);
        if (t === 's') {
          cel.texto = compartilhados[Number(bruto)] ?? '';
          cel.tipo = 'texto';
        } else if (t === 'str') {
          cel.texto = bruto;
          cel.tipo = 'texto';
        } else if (t === 'b') {
          cel.texto = bruto === '1' || bruto === 'true' ? 'VERDADEIRO' : 'FALSO';
          cel.tipo = 'logico';
        } else if (t === 'e') {
          cel.texto = bruto;
          cel.tipo = 'erro';
        } else {
          const n = Number(bruto);
          if (Number.isFinite(n)) {
            cel.valor = n;
            cel.texto = formatarNumero(n, estilo.formato, base1904);
            cel.tipo = 'numero';
          } else {
            cel.texto = bruto;
            cel.tipo = 'texto';
          }
        }
      }
      if (formula) {
        cel.formula = true;
        if (v === undefined && t !== 'inlineStr') cel.semResultado = true;
      }
      if (estilo.alinhamento) cel.alinhamento = estilo.alinhamento;
      if (estilo.quebra) cel.quebraAutomatica = true;
      if (estilo.negrito) cel.negrito = true;
      if (estilo.italico) cel.italico = true;
      if (estilo.cor) cel.cor = true;
      if (estilo.bordas) cel.bordas = estilo.bordas;
      const temValor = cel.texto !== '' || cel.semResultado === true;
      if (!temValor && !cel.bordas) continue;
      if (celulas.length >= LIMITE_CELULAS_ABA) {
        if (temValor) naoLidas++;
        continue;
      }
      celulas.push(cel);
    }
  }
  const mesclagens: IntervaloXlsx[] = [];
  for (const m of xml.matchAll(/<mergeCell\s([^>]*?)\/?>/g)) {
    const i = lerIntervalo(attr(m[1]!, 'ref') ?? '');
    if (i && (i.l2 > i.l1 || i.c2 > i.c1)) mesclagens.push(i);
  }
  return { nome, oculta, celulas, mesclagens, linhasOcultas, colunasOcultas, preenchida: areaPreenchida(celulas, mesclagens), celulasNaoLidas: naoLidas };
}

/** Menor retângulo com as células com valor, crescido para conter as mesclagens que tocam nele. */
function areaPreenchida(celulas: readonly CelulaXlsx[], mesclagens: readonly IntervaloXlsx[]): IntervaloXlsx | null {
  let a: IntervaloXlsx | null = null;
  for (const x of celulas) {
    if (x.texto === '' && !x.semResultado) continue;
    a = a ? { l1: Math.min(a.l1, x.l), c1: Math.min(a.c1, x.c), l2: Math.max(a.l2, x.l), c2: Math.max(a.c2, x.c) } : { l1: x.l, c1: x.c, l2: x.l, c2: x.c };
  }
  if (!a) return null;
  return crescerParaMesclagens(a, mesclagens);
}

/** O intervalo cresce até conter inteira toda mesclagem que o toca. */
export function crescerParaMesclagens(i: IntervaloXlsx, mesclagens: readonly IntervaloXlsx[]): IntervaloXlsx {
  let a = { ...i };
  for (let mudou = true; mudou; ) {
    mudou = false;
    for (const m of mesclagens) {
      const toca = m.l1 <= a.l2 && m.l2 >= a.l1 && m.c1 <= a.c2 && m.c2 >= a.c1;
      if (toca && (m.l1 < a.l1 || m.c1 < a.c1 || m.l2 > a.l2 || m.c2 > a.c2)) {
        a = { l1: Math.min(a.l1, m.l1), c1: Math.min(a.c1, m.c1), l2: Math.max(a.l2, m.l2), c2: Math.max(a.c2, m.c2) };
        mudou = true;
      }
    }
  }
  return a;
}

/** Caminho de destino de uma relação do workbook ("worksheets/sheet1.xml" ou "/xl/worksheets/sheet1.xml"). */
function caminhoAlvo(alvo: string): string {
  if (alvo.startsWith('/')) return alvo.slice(1);
  const partes = `xl/${alvo}`.split('/');
  const saida: string[] = [];
  for (const p of partes) {
    if (p === '..') saida.pop();
    else if (p !== '.') saida.push(p);
  }
  return saida.join('/');
}

/** Lê a pasta de trabalho. Nada é gravado; o arquivo de origem fica como está. */
export function lerPastaXlsx(bytes: Uint8Array): ResultadoLerXlsx {
  if (bytes.length > LIMITE_BYTES_XLSX) return { ok: false, mensagem: `O arquivo passa de ${LIMITE_BYTES_XLSX / 1024 / 1024} MB.` };
  let partes: Record<string, Uint8Array>;
  let grandes = false;
  try {
    partes = unzipSync(bytes, {
      filter: (f) => {
        if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(f.name)) return false;
        if (f.originalSize > LIMITE_PARTE) {
          grandes = true;
          return false;
        }
        return true;
      },
    });
  } catch {
    return { ok: false, mensagem: 'O arquivo não é uma planilha .xlsx legível. Se for .xls ou .ods, salve-o como .xlsx no Excel ou no LibreOffice.' };
  }
  if (grandes) return { ok: false, mensagem: 'Uma das abas é grande demais para importar.' };
  const workbook = partes['xl/workbook.xml'];
  if (!workbook) return { ok: false, mensagem: 'O arquivo não é uma pasta de trabalho do Excel (.xlsx).' };
  const wb = strFromU8(workbook);
  const rels = partes['xl/_rels/workbook.xml.rels'] ? strFromU8(partes['xl/_rels/workbook.xml.rels']) : '';
  const alvos = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\s([^>]*?)\/?>/g)) {
    const id = attr(m[1]!, 'Id');
    const alvo = attr(m[1]!, 'Target');
    if (id && alvo) alvos.set(id, caminhoAlvo(alvo));
  }
  const compartilhados = partes['xl/sharedStrings.xml']
    ? [...strFromU8(partes['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => textoDeSi(m[1] ?? ''))
    : [];
  const estilos = partes['xl/styles.xml'] ? lerEstilos(strFromU8(partes['xl/styles.xml'])) : [];
  const base1904 = /<workbookPr\s[^>]*date1904="(1|true)"/.test(wb);
  const avisos: string[] = [];
  const abas: AbaXlsx[] = [];
  for (const m of wb.matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const a = m[1]!;
    const nome = desfazerEntidades(attr(a, 'name') ?? `Aba ${abas.length + 1}`);
    const rid = attr(a, 'r:id');
    const caminho = rid ? alvos.get(rid) : undefined;
    const parte = caminho ? partes[caminho] : undefined;
    const estado = attr(a, 'state');
    if (!parte) {
      // Aba de gráfico (chartsheet) ou parte ausente: não tem células.
      avisos.push(`A aba “${nome}” não tem células (aba de gráfico ou parte ausente) e ficou de fora.`);
      continue;
    }
    abas.push(lerAba(strFromU8(parte), nome, estado === 'hidden' || estado === 'veryHidden', compartilhados, estilos, base1904));
  }
  if (abas.length === 0) return { ok: false, mensagem: 'A planilha não tem abas com células.' };
  return { ok: true, pasta: { abas, avisos } };
}
