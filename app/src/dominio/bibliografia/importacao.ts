/**
 * Importação de BibTeX e RIS (M4-T09; RF-08). Leitor próprio, sem biblioteca: só os campos usados nas referências dos
 * tipos da primeira leva. Puro: recebe o texto, devolve rascunhos de obra (sem id definitivo) e o que não foi aproveitado.
 *
 * Regras:
 * - Nada é inventado: campo sem lugar no modelo vai para `ignorados`; tipo sem formatador fica "não suportado" (skill
 *   citacoes-referencias), com a obra `null`.
 * - Autores: "Sobrenome, Prenomes" ou "Prenomes Sobrenome"; Filho, Júnior, Neto e Sobrinho ficam com o sobrenome
 *   (RN-181); nome todo entre chaves no BibTeX é entidade (RN-187). "and others" não tem lugar: vira aviso.
 * - Título com ": " separa o subtítulo (RN-178 destaca só o título).
 * - Acentos do LaTeX ({\'a}, \c{c}, \~a…) viram caracteres; as chaves saem.
 * - Limites: texto até `LIMITE_TEXTO_IMPORTACAO` caracteres e `LIMITE_REGISTROS_IMPORTACAO` registros; chaves aninhadas
 *   até 32 níveis. Acima disso, o que sobra é recusado com aviso (o arquivo vem de fora).
 */
import type { Autor, FuncaoResponsavel, Obra, TipoObra } from '../modelo';

export const LIMITE_TEXTO_IMPORTACAO = 2_000_000;
export const LIMITE_REGISTROS_IMPORTACAO = 2_000;
const PROFUNDIDADE_MAXIMA = 32;
/** "editor" do BibTeX e A2/ED do RIS: a função editor, "(ed.)" (RN-186), a tradução literal; o usuário troca no cadastro. */
const FUNCAO_EDITOR: FuncaoResponsavel = 'ed';
/** Id provisório dos rascunhos: a sessão dá o definitivo ao incluir. */
export const ID_RASCUNHO_IMPORTADO = 'obr_importada0001';

export type FormatoImportacao = 'bibtex' | 'ris';

export interface RegistroImportado {
  /** Chave do BibTeX ou número do registro RIS ("registro 3"). */
  origem: string;
  /** Tipo como veio no arquivo ("article", "JOUR"). */
  tipoOriginal: string;
  /** `null` = tipo não suportado. */
  obra: Obra | null;
  /** Campos do arquivo que não têm lugar no modelo ("isbn", "abstract"). */
  ignorados: string[];
  avisos: string[];
}

export interface ResultadoImportacao {
  formato: FormatoImportacao | null;
  registros: RegistroImportado[];
  avisos: string[];
}

export function detectarFormato(texto: string): FormatoImportacao | null {
  if (/^\s*TY {2}- /mu.test(texto)) return 'ris';
  if (/@\s*[A-Za-z]+\s*[{(]/u.test(texto)) return 'bibtex';
  return null;
}

export function lerBibliografiaImportada(texto: string): ResultadoImportacao {
  const avisos: string[] = [];
  let t = texto.replace(/^﻿/u, '');
  if (t.length > LIMITE_TEXTO_IMPORTACAO) {
    avisos.push(`O arquivo é grande demais: só os primeiros ${LIMITE_TEXTO_IMPORTACAO.toLocaleString('pt-BR')} caracteres foram lidos.`);
    t = t.slice(0, LIMITE_TEXTO_IMPORTACAO);
  }
  const formato = detectarFormato(t);
  if (formato === null) return { formato, registros: [], avisos: [...avisos, 'O arquivo não parece BibTeX nem RIS.'] };
  const r = formato === 'ris' ? lerRis(t) : lerBibtex(t);
  if (r.registros.length > LIMITE_REGISTROS_IMPORTACAO) {
    r.avisos.push(`O arquivo tem mais de ${LIMITE_REGISTROS_IMPORTACAO} registros: só os primeiros foram lidos.`);
    r.registros = r.registros.slice(0, LIMITE_REGISTROS_IMPORTACAO);
  }
  return { formato, registros: r.registros, avisos: [...avisos, ...r.avisos] };
}

// ---------------------------------------------------------------------------------------------------------------
// Campos comuns: o registro lido vira um dicionário de campos normalizados, que vira a obra.

interface Campos {
  tipo: TipoObra | null;
  natureza?: string;
  ebook?: boolean;
  autores: string[];
  autoresEntidade: Set<string>;
  editores: string[];
  titulo?: string;
  tituloSecundario?: string;
  periodico?: string;
  evento?: string;
  volume?: string;
  numero?: string;
  paginas?: string;
  ano?: string;
  local?: string;
  editora?: string;
  instituicao?: string;
  edicao?: string;
  doi?: string;
  url?: string;
  acesso?: string;
  colecao?: string;
  folhas?: string;
  identificacao?: string;
  maisAutores?: boolean;
}

const SUFIXOS_PARENTESCO = /^(filho|júnior|junior|jr\.?|neto|sobrinho)$/iu;

/** "Silva Neto, João" ou "João da Silva Neto" → pessoa; o nome inteiro vira o sobrenome se não houver prenome. */
export function autorDeNome(nome: string, entidade = false): Autor | null {
  const n = nome.replace(/\s+/gu, ' ').trim();
  if (n === '') return null;
  if (entidade) return { tipo: 'entidade', nome: n };
  const virgula = n.split(',').map((p) => p.trim());
  if (virgula.length >= 2) {
    // "Sobrenome, Jr, Prenomes" (BibTeX) ou "Sobrenome, Prenomes".
    const sobrenome = virgula.length >= 3 ? `${virgula[0]} ${virgula[1]}` : virgula[0]!;
    const prenomes = virgula.slice(virgula.length >= 3 ? 2 : 1).join(' ').trim();
    return { tipo: 'pessoa', sobrenome, ...(prenomes ? { prenomes } : {}) };
  }
  const palavras = n.split(' ');
  if (palavras.length === 1) return { tipo: 'pessoa', sobrenome: n };
  let corte = palavras.length - 1;
  if (SUFIXOS_PARENTESCO.test(palavras[corte]!) && corte > 1) corte--;
  // Partícula antes do sobrenome fica nos prenomes ("José da" + "Silva"), como no exemplo da RN-180.
  const prenomes = palavras.slice(0, corte).join(' ');
  return { tipo: 'pessoa', sobrenome: palavras.slice(corte).join(' '), ...(prenomes ? { prenomes } : {}) };
}

function dataIso(valor: string): string | undefined {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/u.exec(valor.trim());
  if (!m) return undefined;
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
}

function paginas(valor: string): string {
  return valor.replace(/\s*(?:--|–|—)\s*/gu, '-').replace(/\s+/gu, '');
}

function deTexto(texto: string) {
  return [{ tipo: 'texto' as const, texto }];
}

/** Separa o subtítulo no primeiro ": " (o destaque é só do título, RN-178). */
function tituloESubtitulo(t: string): { titulo: string; subtitulo?: string } {
  const i = t.indexOf(': ');
  if (i <= 0) return { titulo: t.trim() };
  return { titulo: t.slice(0, i).trim(), subtitulo: t.slice(i + 2).trim() };
}

function obraDosCampos(c: Campos, avisos: string[]): Obra | null {
  if (c.tipo === null) return null;
  const autores = c.autores.map((a) => autorDeNome(a, c.autoresEntidade.has(a))).filter((a): a is Autor => a !== null);
  const editores = c.editores.map((a) => autorDeNome(a)).filter((a): a is Autor => a !== null);
  if (c.maisAutores) avisos.push('O arquivo indica mais autores ("and others"), sem os nomes: confira a autoria.');
  const { titulo, subtitulo } = tituloESubtitulo(c.titulo ?? '');
  if (titulo === '') avisos.push('Sem título no arquivo.');
  let ano: number | undefined;
  if (c.ano !== undefined) {
    const m = /\d{4}/u.exec(c.ano);
    if (m) ano = Number(m[0]);
    if (!m || m[0] !== c.ano.trim()) avisos.push(m ? `Ano lido de "${c.ano}": ${m[0]}.` : `Ano não reconhecido: "${c.ano}".`);
  }
  const edicaoNum = c.edicao ? Number(/^\d+/u.exec(c.edicao.trim())?.[0] ?? NaN) : NaN;
  if (c.edicao && Number.isNaN(edicaoNum)) avisos.push(`Edição não reconhecida: "${c.edicao}".`);
  const folhas = c.folhas ? Number(/^\d+/u.exec(c.folhas.trim())?.[0] ?? NaN) : NaN;
  const obra: Obra = {
    id: ID_RASCUNHO_IMPORTADO,
    tipo: c.tipo,
    ...(autores.length > 0 ? { autores } : editores.length > 0 && c.tipo === 'livro' ? { autores: editores, funcao: FUNCAO_EDITOR } : {}),
    titulo: titulo === '' ? [] : deTexto(titulo),
    ...(subtitulo ? { subtitulo: deTexto(subtitulo) } : {}),
    ...(c.edicao && !Number.isNaN(edicaoNum) && edicaoNum > 1 ? { edicao: edicaoNum } : {}),
    ...(c.local ? { local: c.local } : {}),
    ...(c.editora ? { editora: c.editora } : {}),
    ...(ano !== undefined ? { ano } : {}),
    ...(c.paginas ? { paginas: paginas(c.paginas) } : c.tipo === 'livro' && !Number.isNaN(folhas) && folhas > 0 ? { paginas: String(folhas) } : {}),
    // Total de folhas só no trabalho acadêmico (D-M4-05); no livro, o total vira "191 p.".
    ...(c.tipo === 'trabalhoAcademico' && !Number.isNaN(folhas) && folhas > 0 ? { folhas } : {}),
    ...(c.volume ? { volume: c.volume } : {}),
    ...(c.numero ? { numero: c.numero } : {}),
    ...(c.ebook ? { ebook: true as const } : {}),
    ...(c.periodico ? { periodico: c.periodico } : {}),
    ...(c.natureza ? { natureza: c.natureza } : {}),
    ...(c.instituicao ? { instituicao: c.instituicao } : {}),
    ...(c.identificacao ? { identificacao: c.identificacao } : {}),
    ...(c.url ? { url: c.url } : {}),
    ...(c.acesso ? { acesso: c.acesso } : {}),
    ...(c.doi ? { doi: c.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//iu, '') } : {}),
    ...(c.colecao ? { colecao: c.colecao } : {}),
  };
  // A obra no todo (capítulo, anais) e o evento.
  if (c.tipo === 'capitulo' && c.tituloSecundario) {
    const t = tituloESubtitulo(c.tituloSecundario);
    obra.noTodo = { ...(editores.length > 0 ? { autores: editores, funcao: FUNCAO_EDITOR } : {}), titulo: deTexto(t.titulo), ...(t.subtitulo ? { subtitulo: deTexto(t.subtitulo) } : {}) };
  }
  if (c.tipo === 'trabalhoEvento') {
    const nome = c.evento ?? c.tituloSecundario;
    if (nome) obra.evento = { nome };
    if (!c.evento && c.tituloSecundario) avisos.push('O nome do evento veio do título dos anais: confira o nome, o número, o ano e o local do evento.');
    if (c.evento && c.tituloSecundario) obra.noTodo = { titulo: deTexto(c.tituloSecundario) };
  }
  if (c.tipo === 'artigoPeriodico' && !obra.periodico && c.tituloSecundario) obra.periodico = c.tituloSecundario;
  if (editores.length > 0 && c.tipo !== 'capitulo' && !(c.tipo === 'livro' && autores.length === 0)) {
    avisos.push('Organizadores ou editores do arquivo não entram neste tipo de obra.');
  }
  return obra;
}

// ---------------------------------------------------------------------------------------------------------------
// BibTeX

const TIPOS_BIBTEX: Readonly<Record<string, { tipo: TipoObra; natureza?: string }>> = {
  book: { tipo: 'livro' },
  inbook: { tipo: 'capitulo' },
  incollection: { tipo: 'capitulo' },
  phdthesis: { tipo: 'trabalhoAcademico', natureza: 'Tese (Doutorado)' },
  mastersthesis: { tipo: 'trabalhoAcademico', natureza: 'Dissertação (Mestrado)' },
  thesis: { tipo: 'trabalhoAcademico' },
  article: { tipo: 'artigoPeriodico' },
  inproceedings: { tipo: 'trabalhoEvento' },
  conference: { tipo: 'trabalhoEvento' },
  standard: { tipo: 'norma' },
  online: { tipo: 'documentoOnline' },
  electronic: { tipo: 'documentoOnline' },
  www: { tipo: 'documentoOnline' },
};

/** Campos que o leitor usa; os demais vão para `ignorados`. */
const CAMPOS_BIBTEX = new Set([
  'author', 'editor', 'title', 'booktitle', 'eventtitle', 'journal', 'journaltitle', 'volume', 'number', 'issue', 'pages', 'year', 'date',
  'address', 'location', 'publisher', 'school', 'institution', 'edition', 'doi', 'url', 'urldate', 'series', 'pagetotal', 'type', 'organization',
]);

const ACENTOS: Readonly<Record<string, string>> = { "'": '́', '`': '̀', '^': '̂', '~': '̃', '"': '̈', '=': '̄', '.': '̇', u: '̆', v: '̌', H: '̋', c: '̧', k: '̨' };

/** Acentos e símbolos do LaTeX para texto; as chaves que sobram saem. */
export function textoDoLatex(valor: string): string {
  return valor
    .replace(/\{?\\(['`^~"=.])\s*\{?\\?([A-Za-z])\}?\}?/gu, (_, a: string, l: string) => (l === 'i' ? 'ı' : l) + ACENTOS[a]!)
    .replace(/\{?\\([uvHck])\s*\{\\?([A-Za-z])\}\}?/gu, (_, a: string, l: string) => l + ACENTOS[a]!)
    .replace(/\\([&%$#_{}])/gu, '$1')
    .replace(/\\(?:textit|emph|textbf|textrm|mathrm|text)\s*\{/gu, '{')
    .replace(/\\ss\b\s?/gu, 'ß')
    .replace(/[{}]/gu, '')
    .replace(/ı́/gu, 'í')
    .replace(/~/gu, ' ')
    .replace(/\s+/gu, ' ')
    .normalize('NFC')
    .trim();
}

interface EntradaBibtex {
  tipo: string;
  chave: string;
  campos: Map<string, string>;
  /** Nomes de autor que vieram inteiros entre chaves (entidades). */
  entidades: Set<string>;
}

/** Leitor de BibTeX tolerante: lê entradas `@tipo{chave, campo = valor, …}`; ignora @comment, @preamble e @string. */
function lerEntradasBibtex(texto: string, avisos: string[]): EntradaBibtex[] {
  const entradas: EntradaBibtex[] = [];
  const macros = new Map<string, string>([
    ['jan', 'jan.'], ['feb', 'fev.'], ['mar', 'mar.'], ['apr', 'abr.'], ['may', 'maio'], ['jun', 'jun.'],
    ['jul', 'jul.'], ['aug', 'ago.'], ['sep', 'set.'], ['oct', 'out.'], ['nov', 'nov.'], ['dec', 'dez.'],
  ]);
  let i = 0;
  const n = texto.length;
  const espacos = () => {
    while (i < n && /\s/u.test(texto[i]!)) i++;
  };
  /** Valor entre chaves (com aninhamento) ou aspas; devolve o conteúdo bruto, sem as delimitadoras. */
  const delimitado = (): string | null => {
    const abre = texto[i];
    const fecha = abre === '{' ? '}' : '"';
    let nivel = 0;
    const inicio = i + 1;
    i++;
    while (i < n) {
      const ch = texto[i]!;
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '{') {
        nivel++;
        if (nivel > PROFUNDIDADE_MAXIMA) return null;
      } else if (ch === '}' && nivel > 0) nivel--;
      else if (ch === fecha && nivel === 0) {
        i++;
        return texto.slice(inicio, i - 1);
      }
      i++;
    }
    return null;
  };
  while (i < n && entradas.length <= LIMITE_REGISTROS_IMPORTACAO) {
    const arroba = texto.indexOf('@', i);
    if (arroba < 0) break;
    i = arroba + 1;
    const mTipo = /^[A-Za-z]+/u.exec(texto.slice(i, i + 40));
    if (!mTipo) continue;
    const tipo = mTipo[0].toLowerCase();
    i += mTipo[0].length;
    espacos();
    if (texto[i] !== '{' && texto[i] !== '(') continue;
    const fechaEntrada = texto[i] === '{' ? '}' : ')';
    i++;
    if (tipo === 'comment' || tipo === 'preamble') {
      // Pula até a delimitadora que fecha (com chaves equilibradas).
      i--;
      if (texto[i] === '{') delimitado();
      continue;
    }
    espacos();
    let chave = '';
    if (tipo !== 'string') {
      const fim = texto.slice(i).search(/[,\s}]/u);
      chave = fim < 0 ? '' : texto.slice(i, i + fim).trim();
      i += Math.max(fim, 0);
      espacos();
      if (texto[i] === ',') i++;
    }
    const campos = new Map<string, string>();
    const entidades = new Set<string>();
    let quebrada = false;
    for (;;) {
      espacos();
      if (i >= n) {
        quebrada = true;
        break;
      }
      if (texto[i] === fechaEntrada) {
        i++;
        break;
      }
      const mNome = /^[A-Za-z][\w:.-]*/u.exec(texto.slice(i, i + 60));
      if (!mNome) {
        quebrada = true;
        break;
      }
      const nome = mNome[0].toLowerCase();
      i += mNome[0].length;
      espacos();
      if (texto[i] !== '=') {
        quebrada = true;
        break;
      }
      i++;
      // Valor: partes ligadas por "#".
      let valor = '';
      let brutoAutores = '';
      for (;;) {
        espacos();
        const ch = texto[i];
        if (ch === '{' || ch === '"') {
          const v = delimitado();
          if (v === null) {
            quebrada = true;
            break;
          }
          valor += v;
          brutoAutores += v;
        } else {
          const m = /^[\w.:-]+/u.exec(texto.slice(i, i + 80));
          if (!m) {
            quebrada = true;
            break;
          }
          i += m[0].length;
          const macro = macros.get(m[0].toLowerCase());
          valor += /^\d+$/u.test(m[0]) ? m[0] : (macro ?? m[0]);
        }
        espacos();
        if (texto[i] === '#') {
          i++;
          continue;
        }
        break;
      }
      if (quebrada) break;
      if (tipo === 'string') macros.set(nome, valor);
      else {
        if (nome === 'author' || nome === 'editor') {
          for (const nomeAutor of dividirAutores(brutoAutores || valor)) if (/^\{.*\}$/su.test(nomeAutor.trim()) && chavesEquilibradasPorFora(nomeAutor.trim())) entidades.add(textoDoLatex(nomeAutor));
        }
        campos.set(nome, valor);
      }
      espacos();
      if (texto[i] === ',') i++;
    }
    if (quebrada) {
      avisos.push(`Entrada ${chave ? `"${chave}"` : `@${tipo}`} mal formada: o que vinha depois do problema foi ignorado.`);
      // Recomeça na próxima linha que começa com "@".
      const prox = texto.slice(i).search(/\n\s*@/u);
      i = prox < 0 ? n : i + prox + 1;
    }
    if (tipo !== 'string' && (campos.size > 0 || chave !== '')) entradas.push({ tipo, chave, campos, entidades });
  }
  return entradas;
}

/** "{Universidade Federal do Tocantins}" é uma chave que abre no começo e fecha só no fim. */
function chavesEquilibradasPorFora(s: string): boolean {
  let nivel = 0;
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '{') nivel++;
    else if (s[k] === '}') {
      nivel--;
      if (nivel === 0 && k < s.length - 1) return false;
    }
  }
  return true;
}

/** Divide por " and " fora das chaves. */
function dividirAutores(valor: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let atual = '';
  const palavras = valor.split(/(\s+and\s+)/iu);
  for (const p of palavras) {
    if (/^\s+and\s+$/iu.test(p) && nivel === 0) {
      partes.push(atual);
      atual = '';
      continue;
    }
    atual += p;
    for (const ch of p) nivel += ch === '{' ? 1 : ch === '}' ? -1 : 0;
  }
  partes.push(atual);
  return partes.map((x) => x.trim()).filter((x) => x !== '');
}

function lerBibtex(texto: string): { registros: RegistroImportado[]; avisos: string[] } {
  const avisos: string[] = [];
  const registros = lerEntradasBibtex(texto, avisos).map((e): RegistroImportado => {
    const mapa = TIPOS_BIBTEX[e.tipo];
    const tipoMisc: { tipo: TipoObra; natureza?: string } | undefined = e.tipo === 'misc' && e.campos.has('url') ? { tipo: 'documentoOnline' } : undefined;
    const destino = mapa ?? tipoMisc;
    const ignorados = [...e.campos.keys()].filter((k) => !CAMPOS_BIBTEX.has(k));
    if (!destino) {
      return { origem: e.chave || `@${e.tipo}`, tipoOriginal: e.tipo, obra: null, ignorados: [], avisos: [`Tipo "@${e.tipo}" sem formatador na primeira leva (D-M4-06): não importado.`] };
    }
    const v = (k: string): string | undefined => {
      const bruto = e.campos.get(k);
      if (bruto === undefined) return undefined;
      const t = textoDoLatex(bruto);
      return t === '' ? undefined : t;
    };
    const autoresBrutos = dividirAutores(e.campos.get('author') ?? '');
    const maisAutores = autoresBrutos.some((a) => a.toLowerCase() === 'others');
    const autores = autoresBrutos.filter((a) => a.toLowerCase() !== 'others').map(textoDoLatex);
    const tipoTese = v('type');
    const c: Campos = {
      tipo: destino.tipo,
      ...(destino.natureza ? { natureza: destino.natureza } : tipoTese ? { natureza: tipoTese } : {}),
      autores,
      autoresEntidade: e.entidades,
      editores: dividirAutores(e.campos.get('editor') ?? '').map(textoDoLatex),
      maisAutores,
    };
    const atribuir = (campo: keyof Campos, ...chaves: string[]) => {
      for (const k of chaves) {
        const x = v(k);
        if (x !== undefined) {
          (c as unknown as Record<string, string>)[campo] = x;
          return;
        }
      }
    };
    atribuir('titulo', 'title');
    atribuir('tituloSecundario', 'booktitle');
    atribuir('evento', 'eventtitle');
    atribuir('periodico', 'journal', 'journaltitle');
    atribuir('volume', 'volume');
    atribuir('numero', 'number', 'issue');
    atribuir('paginas', 'pages');
    atribuir('ano', 'year', 'date');
    atribuir('local', 'address', 'location');
    atribuir('editora', 'publisher', 'organization');
    atribuir('instituicao', 'school', 'institution');
    atribuir('edicao', 'edition');
    atribuir('doi', 'doi');
    atribuir('url', 'url');
    atribuir('colecao', 'series');
    atribuir('folhas', 'pagetotal');
    const urldate = v('urldate');
    if (urldate) {
      const d = dataIso(urldate);
      if (d) c.acesso = d;
    }
    if (destino.tipo === 'trabalhoAcademico' && !c.natureza) c.natureza = 'Trabalho acadêmico';
    if (destino.tipo === 'norma') atribuir('identificacao', 'number');
    const avisosRegistro: string[] = [];
    const obra = obraDosCampos(c, avisosRegistro);
    return { origem: e.chave || `@${e.tipo}`, tipoOriginal: e.tipo, obra, ignorados, avisos: avisosRegistro };
  });
  return { registros, avisos };
}

// ---------------------------------------------------------------------------------------------------------------
// RIS

const TIPOS_RIS: Readonly<Record<string, { tipo: TipoObra; ebook?: boolean }>> = {
  BOOK: { tipo: 'livro' },
  EBOOK: { tipo: 'livro', ebook: true },
  EDBOOK: { tipo: 'livro' },
  CHAP: { tipo: 'capitulo' },
  ECHAP: { tipo: 'capitulo' },
  THES: { tipo: 'trabalhoAcademico' },
  JOUR: { tipo: 'artigoPeriodico' },
  EJOUR: { tipo: 'artigoPeriodico' },
  JFULL: { tipo: 'artigoPeriodico' },
  CONF: { tipo: 'trabalhoEvento' },
  CPAPER: { tipo: 'trabalhoEvento' },
  NEWS: { tipo: 'artigoJornal' },
  STAND: { tipo: 'norma' },
  ELEC: { tipo: 'documentoOnline' },
  WEB: { tipo: 'documentoOnline' },
  BLOG: { tipo: 'documentoOnline' },
};

const MARCAS_RIS = new Set(['TY', 'ER', 'AU', 'A1', 'A2', 'A3', 'ED', 'TI', 'T1', 'CT', 'T2', 'BT', 'T3', 'JO', 'JF', 'JA', 'J2', 'VL', 'IS', 'SP', 'EP', 'PY', 'Y1', 'DA', 'CY', 'PB', 'ET', 'DO', 'UR', 'L2', 'Y2', 'M3']);

function lerRis(texto: string): { registros: RegistroImportado[]; avisos: string[] } {
  const avisos: string[] = [];
  const registros: RegistroImportado[] = [];
  let atual: { campos: [string, string][] } | null = null;
  const fechar = () => {
    if (atual === null) return;
    registros.push(registroRis(atual.campos, registros.length + 1));
    atual = null;
  };
  for (const linha of texto.split(/\r\n?|\n/u)) {
    const m = /^([A-Z][A-Z0-9])  -(?: (.*))?$/u.exec(linha);
    if (!m) {
      // Continuação de valor longo: junta ao campo anterior.
      if (atual !== null && linha.trim() !== '' && (atual as { campos: [string, string][] }).campos.length > 0) {
        const c = (atual as { campos: [string, string][] }).campos;
        c[c.length - 1]![1] += ` ${linha.trim()}`;
      }
      continue;
    }
    const [, marca, valor = ''] = m;
    if (marca === 'TY') {
      if (atual !== null) avisos.push(`Registro ${registros.length + 1} sem "ER": fechado no próximo "TY".`);
      fechar();
      atual = { campos: [[marca, valor.trim()]] };
      if (registros.length >= LIMITE_REGISTROS_IMPORTACAO) break;
    } else if (marca === 'ER') fechar();
    else if (atual !== null) (atual as { campos: [string, string][] }).campos.push([marca!, valor.trim()]);
  }
  if (atual !== null) {
    avisos.push(`Registro ${registros.length + 1} sem "ER" no fim do arquivo: lido assim mesmo.`);
    fechar();
  }
  return { registros, avisos };
}

function registroRis(campos: readonly [string, string][], numero: number): RegistroImportado {
  const ty = (campos.find(([k]) => k === 'TY')?.[1] ?? '').toUpperCase();
  const origem = `registro ${numero}`;
  const destino = TIPOS_RIS[ty];
  if (!destino) return { origem, tipoOriginal: ty, obra: null, ignorados: [], avisos: [`Tipo "${ty}" sem formatador na primeira leva (D-M4-06): não importado.`] };
  const todos = (...ks: string[]) => campos.filter(([k, v]) => ks.includes(k) && v !== '').map(([, v]) => v);
  const um = (...ks: string[]) => {
    for (const k of ks) {
      const v = campos.find(([kk, vv]) => kk === k && vv !== '')?.[1];
      if (v !== undefined) return v;
    }
    return undefined;
  };
  const sp = um('SP');
  const ep = um('EP');
  const ano = um('PY', 'Y1', 'DA');
  const y2 = um('Y2');
  const c: Campos = {
    tipo: destino.tipo,
    ...(destino.ebook ? { ebook: true } : {}),
    autores: todos('AU', 'A1'),
    autoresEntidade: new Set(),
    editores: todos('A2', 'ED', 'A3').filter(() => destino.tipo === 'capitulo' || destino.tipo === 'livro'),
  };
  const def = (campo: keyof Campos, v: string | undefined) => {
    if (v !== undefined) (c as unknown as Record<string, string>)[campo] = v;
  };
  def('titulo', um('TI', 'T1', 'CT'));
  def('tituloSecundario', um('T2', 'BT'));
  def('periodico', um('JO', 'JF', 'JA'));
  def('volume', um('VL'));
  def('numero', um('IS'));
  def('paginas', sp ? (ep && ep !== sp ? `${sp}-${ep}` : sp) : undefined);
  def('ano', ano?.split('/')[0]);
  def('local', um('CY'));
  if (destino.tipo === 'trabalhoAcademico') {
    def('instituicao', um('PB'));
    def('natureza', um('M3') ?? 'Trabalho acadêmico');
  } else def('editora', um('PB'));
  def('edicao', um('ET'));
  def('doi', um('DO'));
  def('url', um('UR', 'L2'));
  def('colecao', um('T3'));
  if (y2) def('acesso', dataIso(y2));
  const ignorados = [...new Set(campos.map(([k]) => k).filter((k) => !MARCAS_RIS.has(k)))];
  const avisos: string[] = [];
  const obra = obraDosCampos(c, avisos);
  return { origem, tipoOriginal: ty, obra, ignorados, avisos };
}
