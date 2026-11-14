/**
 * Leitura de um DOCX de modelo de evento (Etapa 7 da especificação de atualização). Puro: recebe os bytes e devolve o
 * que reconheceu, sem tocar no disco. Roda no renderer (o arquivo vem do `<input type="file">`) e nos testes.
 *
 * Reconhece, do jeito que o Word grava (OOXML):
 * - página e margens: o último `w:sectPr` do corpo (`w:pgSz`, `w:pgMar`, em twips);
 * - texto: o estilo de parágrafo padrão (`w:default="1"`) com a herança (`w:basedOn`) e o `w:docDefaults`: fonte
 *   (também a do tema), tamanho, entrelinha, alinhamento e recuo da primeira linha;
 * - títulos: os estilos "heading 1" a "heading 3" (ou Título 1 a 3): tamanho, negrito, itálico, maiúsculas,
 *   alinhamento, quebra de página antes;
 * - seções: os parágrafos com esses estilos, na ordem;
 * - instruções: parágrafos que falam de formatação ("fonte", "margem", "espaçamento", "máximo de páginas"…).
 *
 * O que a exportação não reproduz vira aviso: várias colunas, mais de uma seção de página, cabeçalho e rodapé, imagens
 * e caixas de texto do modelo, entrelinha exata. O XML é lido por expressões regulares sobre partes conhecidas, sem
 * avaliar nada; o ZIP tem teto de tamanho comprimido e descomprimido (arquivo malicioso não esgota a memória).
 */
import { strFromU8, unzipSync } from 'fflate';
import type { EstiloTituloModelo, RegrasModelo } from '../dominio/modelo';

export const LIMITE_BYTES_MODELO = 20 * 1024 * 1024;
const LIMITE_PARTE = 15 * 1024 * 1024;
const LIMITE_INSTRUCOES = 40;
const LIMITE_SECOES = 100;

export interface ModeloLido {
  regras: RegrasModelo;
  instrucoes: string[];
  secoes: { nivel: number; titulo: string }[];
  avisos: string[];
}

export type ResultadoLerModelo = { ok: true; modelo: ModeloLido } | { ok: false; mensagem: string };

const PARTES = new Set(['word/document.xml', 'word/styles.xml', 'word/theme/theme1.xml']);

const twipsCm = (tw: number) => Math.round((tw / 567) * 100) / 100;
const twipsMm = (tw: number) => Math.round((tw / 56.7) * 10) / 10;

/** Valor do atributo `w:nome` (ou `nome`) da primeira tag `w:tag` do trecho. */
function atributo(xml: string, tag: string, nome: string): string | undefined {
  const m = new RegExp(`<${tag}(?=[\\s/>])[^>]*?\\s${nome}="([^"]*)"`).exec(xml);
  return m?.[1];
}
/** `<w:b/>` ou `<w:b w:val="1"/>` = verdadeiro; `w:val="0"`/`"false"` = falso; ausente = indefinido. */
function liga(xml: string, tag: string): boolean | undefined {
  const m = new RegExp(`<${tag}(\\s[^>]*)?/?>`).exec(xml);
  if (!m) return undefined;
  const v = /w:val="([^"]*)"/.exec(m[1] ?? '')?.[1];
  return !(v === '0' || v === 'false' || v === 'off');
}
function trecho(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m?.[1] ?? '';
}
const desfazerEntidades = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

function alinhamento(jc: string | undefined): RegrasModelo['alinhamento'] {
  if (jc === undefined) return undefined;
  if (jc === 'both' || jc === 'distribute') return 'justificado';
  if (jc === 'center') return 'centralizado';
  if (jc === 'right' || jc === 'end') return 'direita';
  if (jc === 'left' || jc === 'start') return 'esquerda';
  return undefined;
}

interface Estilo {
  id: string;
  nome: string;
  tipo: string;
  padrao: boolean;
  base?: string;
  rPr: string;
  pPr: string;
}

function lerEstilos(styles: string): Map<string, Estilo> {
  const m = new Map<string, Estilo>();
  for (const s of styles.matchAll(/<w:style\s([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const attrs = s[1]!;
    const corpo = s[2]!;
    const id = /w:styleId="([^"]*)"/.exec(attrs)?.[1];
    if (!id) continue;
    m.set(id, {
      id,
      nome: (atributo(corpo, 'w:name', 'w:val') ?? id).toLowerCase(),
      tipo: /w:type="([^"]*)"/.exec(attrs)?.[1] ?? '',
      padrao: /w:default="(1|true)"/.test(attrs),
      ...(atributo(corpo, 'w:basedOn', 'w:val') ? { base: atributo(corpo, 'w:basedOn', 'w:val')! } : {}),
      rPr: trecho(corpo, 'w:rPr'),
      pPr: trecho(corpo, 'w:pPr'),
    });
  }
  return m;
}

/** Propriedades efetivas de um estilo: docDefaults, depois a cadeia `basedOn` do mais geral ao mais específico. */
function cadeia(estilos: Map<string, Estilo>, id: string | undefined): Estilo[] {
  const saida: Estilo[] = [];
  const vistos = new Set<string>();
  for (let e = id ? estilos.get(id) : undefined; e && !vistos.has(e.id) && saida.length < 20; e = e.base ? estilos.get(e.base) : undefined) {
    vistos.add(e.id);
    saida.unshift(e);
  }
  return saida;
}

interface Efetivo {
  fonte?: string;
  corpoPt?: number;
  linha?: { valor: number; regra: string };
  jc?: string;
  primeiraLinhaTw?: number;
  negrito?: boolean;
  italico?: boolean;
  maiusculas?: boolean;
  quebra?: boolean;
}

function efetivo(rPrs: readonly string[], pPrs: readonly string[], tema: { menor?: string; maior?: string }): Efetivo {
  const e: Efetivo = {};
  for (const r of rPrs) {
    const fonte = atributo(r, 'w:rFonts', 'w:ascii') ?? atributo(r, 'w:rFonts', 'w:hAnsi');
    const temaFonte = atributo(r, 'w:rFonts', 'w:asciiTheme') ?? atributo(r, 'w:rFonts', 'w:hAnsiTheme');
    if (fonte) e.fonte = fonte;
    else if (temaFonte) {
      const f = temaFonte.startsWith('major') ? tema.maior : tema.menor;
      if (f) e.fonte = f;
    }
    const sz = atributo(r, 'w:sz', 'w:val');
    if (sz && /^\d+$/.test(sz)) e.corpoPt = Number(sz) / 2;
    const b = liga(r, 'w:b');
    if (b !== undefined) e.negrito = b;
    const i = liga(r, 'w:i');
    if (i !== undefined) e.italico = i;
    const caps = liga(r, 'w:caps');
    if (caps !== undefined) e.maiusculas = caps;
  }
  for (const p of pPrs) {
    const linha = atributo(p, 'w:spacing', 'w:line');
    if (linha && /^\d+$/.test(linha)) e.linha = { valor: Number(linha), regra: atributo(p, 'w:spacing', 'w:lineRule') ?? 'auto' };
    const jc = atributo(p, 'w:jc', 'w:val');
    if (jc) e.jc = jc;
    const ind = atributo(p, 'w:ind', 'w:firstLine');
    if (ind && /^\d+$/.test(ind)) e.primeiraLinhaTw = Number(ind);
    if (atributo(p, 'w:ind', 'w:hanging')) e.primeiraLinhaTw = 0;
    const q = liga(p, 'w:pageBreakBefore');
    if (q !== undefined) e.quebra = q;
  }
  return e;
}

function entrelinha(l: Efetivo['linha'], avisos: string[]): RegrasModelo['entrelinha'] {
  if (!l) return undefined;
  if (l.regra !== 'auto') {
    avisos.push(`Entrelinha exata ou mínima no modelo (${Math.round(l.valor / 20)} pt): foi aproximada para a mais próxima entre simples, 1,5 e dupla.`);
    const pt = l.valor / 20;
    return pt <= 15 ? 'simples' : pt <= 21 ? '1,5' : 'duplo';
  }
  const m = l.valor / 240;
  if (Math.abs(m - 1) > 0.05 && Math.abs(m - 1.5) > 0.05 && Math.abs(m - 2) > 0.05) {
    avisos.push(`Entrelinha de ${m.toFixed(2).replace('.', ',')} no modelo: foi aproximada para a mais próxima entre simples, 1,5 e dupla.`);
  }
  return m < 1.25 ? 'simples' : m < 1.75 ? '1,5' : 'duplo';
}

const PALAVRAS_INSTRUCAO =
  /\b(fonte|margem|margens|espaçamento|entrelinha|entre linhas|tamanho|páginas?|laudas?|palavras|caracteres|resumo|palavras-chave|recuo|justificad|alinhad|centralizad|negrito|itálico|maiúscul|times|arial|calibri|referências|citaç|figuras?|tabelas?|deve|devem|máximo|mínimo|formato|template|modelo)\b/iu;

function textoDoParagrafo(p: string): string {
  const partes: string[] = [];
  for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) partes.push(m[1] !== undefined ? desfazerEntidades(m[1]) : ' ');
  return partes.join('').replace(/\s+/g, ' ').trim();
}

function nivelDoTitulo(e: Estilo | undefined): number | null {
  if (!e) return null;
  const n = /^(?:heading|título|titulo)\s*([1-3])$/.exec(e.nome) ?? /^(?:heading|ttulo|titulo|título)([1-3])$/i.exec(e.id);
  return n ? Number(n[1]) : null;
}

export function lerModeloDocx(bytes: Uint8Array): ResultadoLerModelo {
  if (bytes.length > LIMITE_BYTES_MODELO) return { ok: false, mensagem: `O arquivo passa de ${LIMITE_BYTES_MODELO / 1024 / 1024} MB.` };
  let partes: Record<string, Uint8Array>;
  let grandes = false;
  const nomes: string[] = [];
  try {
    partes = unzipSync(bytes, {
      filter: (f) => {
        nomes.push(f.name);
        if (!PARTES.has(f.name)) return false;
        if (f.originalSize > LIMITE_PARTE) {
          grandes = true;
          return false;
        }
        return true;
      },
    });
  } catch {
    return { ok: false, mensagem: 'O arquivo não é um DOCX legível.' };
  }
  if (grandes) return { ok: false, mensagem: 'O conteúdo do DOCX é grande demais para um modelo.' };
  const doc = partes['word/document.xml'];
  if (!doc) return { ok: false, mensagem: 'O arquivo não é um documento do Word (.docx).' };
  const documento = strFromU8(doc);
  const styles = partes['word/styles.xml'] ? strFromU8(partes['word/styles.xml']) : '';
  const tema = partes['word/theme/theme1.xml'] ? strFromU8(partes['word/theme/theme1.xml']) : '';
  const temaFontes = {
    menor: /<a:minorFont>[\s\S]*?<a:latin typeface="([^"]*)"/.exec(tema)?.[1],
    maior: /<a:majorFont>[\s\S]*?<a:latin typeface="([^"]*)"/.exec(tema)?.[1],
  };

  const avisos: string[] = [];
  const regras: RegrasModelo = {};

  // Página: o sectPr do fim do corpo vale para a última seção (e para todas, se houver uma só).
  const sects = [...documento.matchAll(/<w:sectPr(?:\s[^>]*)?>([\s\S]*?)<\/w:sectPr>/g)].map((m) => m[1]!);
  const sect = sects.at(-1) ?? '';
  const w = atributo(sect, 'w:pgSz', 'w:w');
  const h = atributo(sect, 'w:pgSz', 'w:h');
  if (w && h && /^\d+$/.test(w) && /^\d+$/.test(h)) {
    regras.larguraMm = twipsMm(Number(w));
    regras.alturaMm = twipsMm(Number(h));
  }
  const margem = (lado: string) => {
    const v = atributo(sect, 'w:pgMar', `w:${lado}`);
    return v !== undefined && /^-?\d+$/.test(v) ? twipsCm(Math.abs(Number(v))) : undefined;
  };
  const [sup, inf, esq, dir] = [margem('top'), margem('bottom'), margem('left'), margem('right')];
  if (sup !== undefined) regras.margemSuperiorCm = sup;
  if (inf !== undefined) regras.margemInferiorCm = inf;
  if (esq !== undefined) regras.margemEsquerdaCm = esq;
  if (dir !== undefined) regras.margemDireitaCm = dir;
  const colunas = atributo(sect, 'w:cols', 'w:num');
  if (colunas && Number(colunas) > 1) avisos.push(`O modelo usa ${colunas} colunas: a exportação sai em uma coluna.`);
  if (sects.length > 1) avisos.push('O modelo tem mais de uma seção de página (margens ou orientação diferentes): vale a última.');
  if (nomes.some((n) => /^word\/(header|footer)\d*\.xml$/.test(n))) avisos.push('Cabeçalho e rodapé do modelo (logotipo, nome do evento) não são reproduzidos: a exportação usa a paginação do perfil.');
  if (nomes.some((n) => n.startsWith('word/media/'))) avisos.push('Imagens do modelo (logotipos, figuras de exemplo) não são copiadas para o trabalho.');
  if (/<w:txbxContent>/.test(documento)) avisos.push('O modelo tem caixas de texto: o conteúdo delas não é reproduzido.');

  // Texto: estilo de parágrafo padrão sobre os docDefaults.
  const estilos = lerEstilos(styles);
  const defaults = trecho(styles, 'w:docDefaults');
  const rDef = trecho(trecho(defaults, 'w:rPrDefault'), 'w:rPr');
  const pDef = trecho(trecho(defaults, 'w:pPrDefault'), 'w:pPr');
  // O DOCX exportado pelo BiblioDocs põe o texto no estilo `corpo` (o Normal fica com o padrão da biblioteca): ele vale
  // como estilo do texto, para comparar o exportado com o modelo.
  const normal = estilos.get('corpo') ?? [...estilos.values()].find((e) => e.tipo === 'paragraph' && e.padrao);
  const cadNormal = cadeia(estilos, normal?.id);
  const texto = efetivo([rDef, ...cadNormal.map((e) => e.rPr)], [pDef, ...cadNormal.map((e) => e.pPr)], temaFontes);
  if (texto.fonte && /^[\p{L}\p{N} ._-]{1,64}$/u.test(texto.fonte)) regras.fonte = texto.fonte;
  if (texto.corpoPt !== undefined && texto.corpoPt >= 6 && texto.corpoPt <= 72) regras.corpoPt = texto.corpoPt;
  const ent = entrelinha(texto.linha, avisos);
  if (ent) regras.entrelinha = ent;
  const al = alinhamento(texto.jc);
  if (al) regras.alinhamento = al;
  if (texto.primeiraLinhaTw !== undefined) regras.recuoPrimeiraLinhaCm = Math.min(10, twipsCm(texto.primeiraLinhaTw));

  // Títulos de 1 a 3.
  const idsTitulo = new Map<string, number>();
  for (const e of estilos.values()) {
    const n = nivelDoTitulo(e);
    if (n === null || e.tipo !== 'paragraph') continue;
    idsTitulo.set(e.id, n);
    const cad = cadeia(estilos, e.id);
    const t = efetivo([rDef, ...cad.map((x) => x.rPr)], [pDef, ...cad.map((x) => x.pPr)], temaFontes);
    const estilo: EstiloTituloModelo = {
      ...(t.corpoPt !== undefined && t.corpoPt >= 6 && t.corpoPt <= 72 ? { corpoPt: t.corpoPt } : {}),
      negrito: t.negrito ?? false,
      italico: t.italico ?? false,
      maiusculas: t.maiusculas ?? false,
      alinhamento: alinhamento(t.jc) ?? 'esquerda',
      quebraPagina: t.quebra ?? false,
    };
    regras[`titulo${n as 1 | 2 | 3}`] = estilo;
  }

  // Seções (parágrafos com estilo de título) e instruções (parágrafos que falam de formatação).
  const secoes: { nivel: number; titulo: string }[] = [];
  const instrucoes: string[] = [];
  for (const m of documento.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const p = m[1]!;
    const t = textoDoParagrafo(p);
    if (t === '') continue;
    const estilo = atributo(trecho(p, 'w:pPr'), 'w:pStyle', 'w:val');
    const nivel = estilo ? idsTitulo.get(estilo) : undefined;
    if (nivel !== undefined) {
      if (secoes.length < LIMITE_SECOES) secoes.push({ nivel, titulo: t.slice(0, 300) });
      continue;
    }
    if (t.length >= 15 && t.length <= 1000 && PALAVRAS_INSTRUCAO.test(t) && instrucoes.length < LIMITE_INSTRUCOES) instrucoes.push(t);
  }
  return { ok: true, modelo: { regras, instrucoes, secoes, avisos } };
}
