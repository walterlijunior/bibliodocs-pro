// Analisador leve de código-fonte para os testes de arquitetura (M1-T03; ADR-0005 seção 2; ADR-0006 camada 3).
//
// Sem dependência nova: um léxico mínimo (comentários, strings, templates e literais de regex) e expressões
// regulares sobre o código. Todas as funções são PURAS: recebem {arquivo, conteudo} e devolvem dados.
// Assim os testes alimentam arquivos sintéticos (casos negativos) sem criar nada em src/.
//
// Caminhos de arquivo são relativos à raiz do app, com '/', por exemplo 'src/dominio/modelo/index.ts'.
import { builtinModules } from 'node:module';
import { posix } from 'node:path';

export interface ArquivoFonte {
  arquivo: string;
  conteudo: string;
}

// ---------------------------------------------------------------------------------------------------------
// 1. Léxico mínimo
// ---------------------------------------------------------------------------------------------------------

export interface Lexico {
  /** Fonte com comentários trocados por espaços (strings preservadas). Mesmo comprimento e mesmas linhas. */
  semComentarios: string;
  /** Fonte sem comentários e sem o conteúdo de strings, templates e regex (só código). Mesmo comprimento. */
  soCodigo: string;
}

const PALAVRAS_ANTES_DE_REGEX = new Set([
  'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await',
  'instanceof',
]);
// '<' fica de fora de propósito: em .tsx, '</' é fechamento de tag JSX, não início de regex.
const SINAIS_ANTES_DE_REGEX = '(,=:[!&|?{};+-*%~^>';

const ehPalavra = (c: string): boolean => /[\p{L}\p{N}_$]/u.test(c);
const branco = (c: string): string => (c === '\n' || c === '\r' ? c : ' ');

/**
 * Separa comentários, strings e código. Limitações conhecidas: a decisão "divisão × regex" é heurística
 * (último caractere significativo); strings com aspas simples ou duplas terminam na quebra de linha (protege
 * texto JSX com apóstrofo, que só afeta a própria linha).
 */
export function analisarLexico(fonte: string): Lexico {
  const a: string[] = [];
  const b: string[] = [];
  const n = fonte.length;
  let i = 0;
  let ultimoSig = '';
  let ultimaPalavra = '';
  let palavraAtual = '';
  let chaves = 0;
  const pilhaTemplate: number[] = [];

  const codigo = (c: string): void => {
    a.push(c);
    b.push(c);
  };
  const conteudo = (c: string): void => {
    a.push(c);
    b.push(branco(c));
  };
  const comentario = (c: string): void => {
    a.push(branco(c));
    b.push(branco(c));
  };

  /** Lê o corpo de um template a partir de `i`. Devolve true se parou num `${` (volta ao código). */
  const lerTemplate = (): boolean => {
    while (i < n) {
      const x = fonte[i]!;
      if (x === '\\') {
        conteudo(x);
        if (i + 1 < n) conteudo(fonte[i + 1]!);
        i += 2;
        continue;
      }
      if (x === '`') {
        codigo(x);
        i++;
        return false;
      }
      if (x === '$' && fonte[i + 1] === '{') {
        codigo('$');
        codigo('{');
        i += 2;
        pilhaTemplate.push(chaves);
        chaves++;
        return true;
      }
      conteudo(x);
      i++;
    }
    return false;
  };

  const regexPermitido = (): boolean => {
    if (ultimoSig === '') return true;
    if (ehPalavra(ultimoSig)) return PALAVRAS_ANTES_DE_REGEX.has(ultimaPalavra);
    return SINAIS_ANTES_DE_REGEX.includes(ultimoSig);
  };

  const fimDoRegex = (inicio: number): number => {
    let j = inicio + 1;
    let classe = false;
    while (j < n) {
      const x = fonte[j]!;
      if (x === '\n' || x === '\r') return -1;
      if (x === '\\') {
        j += 2;
        continue;
      }
      if (x === '[') classe = true;
      else if (x === ']') classe = false;
      else if (x === '/' && !classe) return j;
      j++;
    }
    return -1;
  };

  while (i < n) {
    const c = fonte[i]!;
    const d = fonte[i + 1] ?? '';

    if (c === '/' && d === '/') {
      while (i < n && fonte[i] !== '\n') comentario(fonte[i++]!);
      continue;
    }
    if (c === '/' && d === '*') {
      const fim = fonte.indexOf('*/', i + 2);
      const ate = fim < 0 ? n : fim + 2;
      while (i < ate) comentario(fonte[i++]!);
      continue;
    }
    if (c === "'" || c === '"') {
      codigo(c);
      i++;
      while (i < n) {
        const x = fonte[i]!;
        if (x === '\\') {
          conteudo(x);
          if (i + 1 < n) conteudo(fonte[i + 1]!);
          i += 2;
          continue;
        }
        if (x === c) {
          codigo(x);
          i++;
          break;
        }
        if (x === '\n') break;
        conteudo(x);
        i++;
      }
      ultimoSig = c;
      palavraAtual = '';
      ultimaPalavra = '';
      continue;
    }
    if (c === '`') {
      codigo(c);
      i++;
      lerTemplate();
      ultimoSig = '`';
      palavraAtual = '';
      ultimaPalavra = '';
      continue;
    }
    if (c === '}' && pilhaTemplate.length > 0 && pilhaTemplate[pilhaTemplate.length - 1] === chaves - 1) {
      chaves--;
      pilhaTemplate.pop();
      codigo(c);
      i++;
      lerTemplate();
      ultimoSig = '`';
      palavraAtual = '';
      ultimaPalavra = '';
      continue;
    }
    if (c === '/' && regexPermitido()) {
      const fim = fimDoRegex(i);
      if (fim > 0) {
        codigo('/');
        for (let j = i + 1; j < fim; j++) conteudo(fonte[j]!);
        codigo('/');
        i = fim + 1;
        while (i < n && /[a-z]/.test(fonte[i]!)) codigo(fonte[i++]!);
        ultimoSig = 'a'; // depois de um regex, '/' é divisão
        ultimaPalavra = '';
        palavraAtual = '';
        continue;
      }
    }

    codigo(c);
    i++;
    if (c === '{') chaves++;
    else if (c === '}') chaves--;
    if (/\s/.test(c)) {
      palavraAtual = '';
    } else if (ehPalavra(c)) {
      palavraAtual += c;
      ultimaPalavra = palavraAtual;
      ultimoSig = c;
    } else {
      palavraAtual = '';
      ultimaPalavra = '';
      ultimoSig = c;
    }
  }
  return { semComentarios: a.join(''), soCodigo: b.join('') };
}

const linhaDoIndice = (texto: string, indice: number): number => {
  let linha = 1;
  for (let k = 0; k < indice && k < texto.length; k++) if (texto.charCodeAt(k) === 10) linha++;
  return linha;
};

// ---------------------------------------------------------------------------------------------------------
// 2. Extração de importações
// ---------------------------------------------------------------------------------------------------------

export type TipoImportacao = 'estatica' | 'reexportacao' | 'efeito' | 'dinamica' | 'require' | 'referencia';

export interface Importacao {
  /** Especificador literal; null quando import()/require() recebe expressão calculada (não analisável). */
  especificador: string | null;
  tipo: TipoImportacao;
  /** `import type`, `export type` ou todos os nomes com `type`; também `/// <reference types>`. */
  somenteTipo: boolean;
  /** Nomes importados (original, antes de `as`); '*' para namespace; 'default' para importação padrão. */
  nomes: string[];
  linha: number;
  trecho: string;
}

const CLAUSULA_PROIBIDA = /\b(import|export|class|function|const|let|var|interface|enum|namespace|declare|abstract|async)\b/;
const R_FROM = /(import|export)\s+(type\s+)?([\p{L}\p{N}_$\s{},*]*?)\s*\bfrom\s*(['"])([^'"\n]+)\4/uy;
const R_EFEITO = /import\s*(['"])([^'"\n]+)\1/y;
const R_DINAMICO = /import\s*\(/y;
const R_DINAMICO_LITERAL = /import\s*\(\s*(['"`])([^'"`\n$]*)\1\s*[,)]/y;
const R_REQUIRE = /require\s*\(/y;
const R_REQUIRE_LITERAL = /require\s*\(\s*(['"`])([^'"`\n$]*)\1\s*\)/y;
const R_REFERENCIA = /^[ \t]*\/\/\/[ \t]*<reference\s+(path|types)\s*=\s*["']([^"']+)["']/gm;

function nomesDaClausula(clausula: string): { nomes: string[]; todosTipo: boolean } {
  const nomes: string[] = [];
  let todosTipo = true;
  let temChaves = false;
  const texto = clausula.trim();
  const chave = texto.indexOf('{');
  const antes = chave >= 0 ? texto.slice(0, chave) : texto;
  const dentro = chave >= 0 ? texto.slice(chave + 1, texto.lastIndexOf('}')) : '';
  for (const parte of antes.split(',').map((p) => p.trim()).filter(Boolean)) {
    todosTipo = false;
    nomes.push(parte.startsWith('*') ? '*' : 'default');
  }
  if (chave >= 0) {
    for (const item of dentro.split(',').map((p) => p.trim()).filter(Boolean)) {
      temChaves = true;
      const ehTipo = /^type\s+/.test(item);
      if (!ehTipo) todosTipo = false;
      const nome = item.replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim();
      nomes.push(nome);
    }
  }
  return { nomes, todosTipo: todosTipo && temChaves };
}

/** Extrai todas as importações de um arquivo (import/export from, import 'x', import(), require(), /// <reference>). */
export function extrairImportacoes(conteudo: string): Importacao[] {
  const { semComentarios, soCodigo } = analisarLexico(conteudo);
  const saida: Importacao[] = [];
  const trechoEm = (inicio: number, fim: number): string =>
    semComentarios.slice(inicio, fim).replace(/\s+/g, ' ').trim();

  const palavras = /(?<![\p{L}\p{N}_$.])(import|export|require)(?![\p{L}\p{N}_$])/gu;
  for (let m = palavras.exec(soCodigo); m; m = palavras.exec(soCodigo)) {
    const pos = m.index;
    const linha = linhaDoIndice(soCodigo, pos);
    if (m[1] === 'require') {
      R_REQUIRE.lastIndex = pos;
      if (!R_REQUIRE.test(semComentarios)) continue; // require.resolve, identificador etc.
      R_REQUIRE_LITERAL.lastIndex = pos;
      const lit = R_REQUIRE_LITERAL.exec(semComentarios);
      saida.push({
        especificador: lit ? lit[2]! : null,
        tipo: 'require',
        somenteTipo: false,
        nomes: [],
        linha,
        trecho: lit ? trechoEm(pos, R_REQUIRE_LITERAL.lastIndex) : trechoEm(pos, pos + 40),
      });
      continue;
    }

    R_FROM.lastIndex = pos;
    const from = R_FROM.exec(semComentarios);
    if (from && !CLAUSULA_PROIBIDA.test(from[3]!)) {
      const { nomes, todosTipo } = nomesDaClausula(from[3]!);
      saida.push({
        especificador: from[5]!,
        tipo: from[1] === 'import' ? 'estatica' : 'reexportacao',
        somenteTipo: Boolean(from[2]) || todosTipo,
        nomes,
        linha,
        trecho: trechoEm(pos, R_FROM.lastIndex),
      });
      continue;
    }
    if (m[1] !== 'import') continue;

    R_EFEITO.lastIndex = pos;
    const efeito = R_EFEITO.exec(semComentarios);
    if (efeito) {
      saida.push({ especificador: efeito[2]!, tipo: 'efeito', somenteTipo: false, nomes: [], linha, trecho: trechoEm(pos, R_EFEITO.lastIndex) });
      continue;
    }
    R_DINAMICO.lastIndex = pos;
    if (R_DINAMICO.test(semComentarios)) {
      R_DINAMICO_LITERAL.lastIndex = pos;
      const lit = R_DINAMICO_LITERAL.exec(semComentarios);
      saida.push({
        especificador: lit ? lit[2]! : null,
        tipo: 'dinamica',
        somenteTipo: false,
        nomes: [],
        linha,
        trecho: lit ? trechoEm(pos, R_DINAMICO_LITERAL.lastIndex) : trechoEm(pos, pos + 40),
      });
    }
  }

  R_REFERENCIA.lastIndex = 0;
  for (let r = R_REFERENCIA.exec(conteudo); r; r = R_REFERENCIA.exec(conteudo)) {
    saida.push({
      especificador: r[2]!,
      tipo: 'referencia',
      somenteTipo: true,
      nomes: [],
      linha: linhaDoIndice(conteudo, r.index),
      trecho: r[0].trim(),
    });
  }
  return saida.sort((x, y) => x.linha - y.linha);
}

// ---------------------------------------------------------------------------------------------------------
// 3. Classificação de módulos e destinos
// ---------------------------------------------------------------------------------------------------------

export const SUBMODULOS_DOMINIO = ['modelo', 'numeracao', 'bibliografia', 'visuais', 'normas', 'verificador', 'esquemas'] as const;
const SUBMODULOS_EXPORTACAO = ['docx'] as const;
const MODULOS_SIMPLES = ['principal', 'preload', 'persistencia', 'integracoes', 'aplicacao', 'interface', 'importacao'] as const;

const semExtensao = (s: string): string => s.replace(/\.d\.ts$/, '').replace(/\.[cm]?[jt]sx?$/, '');

/**
 * Módulo do ADR-0005 a que pertence um caminho (arquivo ou pasta) relativo à raiz do app.
 * 'dominio' e 'exportacao' sozinhos = arquivos da raiz desses módulos (ex.: dominio/index.ts).
 * 'fora-de-src' = caminho fora de src/; 'desconhecido:<x>' = pasta não prevista no ADR-0005.
 */
export function moduloDoCaminho(caminho: string): string {
  if (!caminho.startsWith('src/')) return 'fora-de-src';
  const partes = caminho.slice(4).split('/').filter(Boolean);
  if (partes.length === 0) return 'desconhecido:src';
  const topo = partes[0]!;
  if (partes.length === 1) {
    // A própria pasta do módulo (ex.: import de '../principal' resolve para 'src/principal').
    const pastas: readonly string[] = [...MODULOS_SIMPLES, 'dominio', 'exportacao'];
    return pastas.includes(topo) ? topo : `desconhecido:${topo}`;
  }
  const sub = semExtensao(partes[1]!);
  if (topo === 'dominio' || topo === 'exportacao') {
    const conhecidos: readonly string[] = topo === 'dominio' ? SUBMODULOS_DOMINIO : SUBMODULOS_EXPORTACAO;
    if (conhecidos.includes(sub)) return `${topo}/${sub}`;
    return partes.length === 2 ? topo : `desconhecido:${topo}/${sub}`;
  }
  if ((MODULOS_SIMPLES as readonly string[]).includes(topo)) return topo;
  return `desconhecido:${topo}`;
}

/** O caminho aponta para `dominio/normas/formatado` (arquivo formatado.ts ou pasta formatado/)? */
export const ehFormatado = (caminho: string): boolean =>
  /^src\/dominio\/normas\/formatado(\.d\.ts|\.[cm]?[jt]sx?)?$/.test(caminho) || caminho.startsWith('src/dominio/normas/formatado/');

const BUILTINS_NODE = new Set(builtinModules.map((m) => m.replace(/^node:/, '')));

export type Destino =
  | { tipo: 'interno'; caminho: string; modulo: string }
  | { tipo: 'node'; nome: string }
  | { tipo: 'electron'; nome: string }
  | { tipo: 'pacote'; nome: string }
  | { tipo: 'nao-analisavel'; motivo: string };

/** Classifica o destino de uma importação feita a partir de `arquivo`. */
export function classificarDestino(arquivo: string, imp: Importacao): Destino {
  const esp = imp.especificador;
  if (esp === null) return { tipo: 'nao-analisavel', motivo: 'especificador calculado (não literal)' };
  const limpo = esp.split('?')[0]!;
  if (imp.tipo === 'referencia' && !limpo.startsWith('.')) {
    // /// <reference types="x" />
    if (limpo === 'node' || BUILTINS_NODE.has(limpo)) return { tipo: 'node', nome: limpo };
    if (limpo === 'electron') return { tipo: 'electron', nome: limpo };
    return { tipo: 'pacote', nome: limpo };
  }
  if (limpo.startsWith('./') || limpo.startsWith('../') || limpo === '.' || limpo === '..') {
    const caminho = posix.normalize(posix.join(posix.dirname(arquivo), limpo)).replace(/\/$/, '');
    return { tipo: 'interno', caminho, modulo: moduloDoCaminho(caminho) };
  }
  if (limpo.startsWith('/') || /^[A-Za-z]:[\\/]/.test(limpo) || limpo.startsWith('file:')) {
    return { tipo: 'nao-analisavel', motivo: 'caminho absoluto' };
  }
  if (limpo.startsWith('node:')) return { tipo: 'node', nome: limpo.slice(5) };
  const partes = limpo.split('/');
  const pacote = limpo.startsWith('@') ? partes.slice(0, 2).join('/') : partes[0]!;
  if (pacote === 'electron' || pacote === 'original-fs') return { tipo: 'electron', nome: limpo };
  if (BUILTINS_NODE.has(pacote)) return { tipo: 'node', nome: pacote };
  return { tipo: 'pacote', nome: pacote };
}

// ---------------------------------------------------------------------------------------------------------
// 4. Regras de dependência do ADR-0005, seção 2 (regras 1 a 6)
// ---------------------------------------------------------------------------------------------------------

/**
 * Regra 2 — direção interna do domínio. No ADR, "A ← B" quer dizer "B depende de (importa) A":
 *   modelo ← numeracao ← bibliografia/visuais ← normas ← verificador;  esquemas importa modelo.
 * Tabela explícita: chave = submódulo que importa; valor = submódulos que ele PODE importar
 * (além de arquivos do próprio submódulo, sempre permitidos).
 */
export const PERMISSOES_DOMINIO: Readonly<Record<string, readonly string[]>> = {
  // Base: não importa nenhum outro submódulo.
  'dominio/modelo': [],
  // numeracao ← modelo.
  'dominio/numeracao': ['dominio/modelo'],
  // bibliografia e visuais estão no mesmo nível: importam modelo e numeracao, não um ao outro.
  'dominio/bibliografia': ['dominio/modelo', 'dominio/numeracao'],
  'dominio/visuais': ['dominio/modelo', 'dominio/numeracao'],
  // normas importa os níveis abaixo. NÃO importa esquemas (o ADR não prevê) nem verificador.
  'dominio/normas': ['dominio/modelo', 'dominio/numeracao', 'dominio/bibliografia', 'dominio/visuais'],
  // verificador é o topo: pode importar todos os demais (inclusive esquemas). Ninguém o importa.
  'dominio/verificador': [
    'dominio/modelo', 'dominio/numeracao', 'dominio/bibliografia', 'dominio/visuais', 'dominio/normas', 'dominio/esquemas',
  ],
  // esquemas pode importar modelo (texto do ADR).
  'dominio/esquemas': ['dominio/modelo'],
  // Arquivos da raiz de dominio/ (ex.: index.ts como agregador). Decisão técnica do M1-T03: não reexporta
  // normas (senão a interface contornaria a regra 4) nem verificador ("ninguém importa verificador").
  dominio: ['dominio/modelo', 'dominio/numeracao', 'dominio/bibliografia', 'dominio/visuais', 'dominio/esquemas'],
};

/** Módulos que podem usar node:* / builtins do Node (regra 6). */
const USAM_NODE = new Set(['principal', 'persistencia', 'integracoes']);
/** Módulos que podem usar electron (regra 6; o preload precisa de contextBridge/ipcRenderer). */
const USAM_ELECTRON = new Set(['principal', 'persistencia', 'integracoes', 'preload']);

export interface Violacao {
  arquivo: string;
  linha: number;
  importacao: string;
  regra: string;
  motivo: string;
}

export const formatarViolacao = (v: Violacao): string =>
  `${v.arquivo}:${v.linha} — import ${v.importacao} — ${v.regra}: ${v.motivo}`;

const descreverDestino = (d: Destino): string => {
  switch (d.tipo) {
    case 'interno':
      return `${d.caminho} (módulo ${d.modulo})`;
    case 'node':
      return `módulo do Node '${d.nome}'`;
    case 'electron':
      return `'${d.nome}'`;
    case 'pacote':
      return `pacote '${d.nome}'`;
    case 'nao-analisavel':
      return d.motivo;
  }
};

/** Devolve [regra, motivo] se a importação viola alguma regra, ou null. */
function avaliar(origem: string, imp: Importacao, d: Destino): [string, string] | null {
  const R = (n: number): string => `ADR-0005 regra ${n}`;
  if (origem.startsWith('desconhecido:')) {
    return ['ADR-0005 seção 1', `arquivo fora dos módulos previstos (${origem.slice(13)}); atualize o ADR e a tabela do teste`];
  }
  if (d.tipo === 'nao-analisavel') {
    return ['ADR-0005 regras 1–6', `importação não verificável (${d.motivo}); use especificador literal`];
  }
  if (d.tipo === 'interno' && d.modulo.startsWith('desconhecido:')) {
    return ['ADR-0005 seção 1', `destino fora dos módulos previstos (${d.modulo.slice(13)})`];
  }
  const destino = descreverDestino(d);

  // Regras 1 e 2 — domínio.
  if (origem === 'dominio' || origem.startsWith('dominio/')) {
    if (d.tipo === 'node' || d.tipo === 'electron') return [R(1), `domínio não usa plataforma: ${destino}`];
    if (d.tipo === 'pacote') {
      if (d.nome === 'zod' && origem === 'dominio/esquemas') return null;
      return [R(1), `domínio não importa bibliotecas (${destino}); zod só em dominio/esquemas`];
    }
    if (d.modulo !== 'dominio' && !d.modulo.startsWith('dominio/')) return [R(1), `domínio só importa domínio, não ${destino}`];
    if (d.modulo === origem) return null;
    if (d.modulo === 'dominio/verificador') return [R(2), `ninguém importa dominio/verificador (origem ${origem})`];
    const permitidos = PERMISSOES_DOMINIO[origem] ?? [];
    if (!permitidos.includes(d.modulo)) {
      return [R(2), `${origem} não pode importar ${d.modulo} (permitidos: ${permitidos.join(', ') || 'nenhum'})`];
    }
    return null;
  }

  // Regra 3 — aplicação.
  if (origem === 'aplicacao') {
    if (d.tipo === 'node' || d.tipo === 'electron') return [R(3), `aplicacao não usa plataforma: ${destino}`];
    if (d.tipo === 'interno' && ['interface', 'principal'].includes(d.modulo)) return [R(3), `aplicacao não importa ${d.modulo}/`];
    // Adendo M1-T03 ao ADR-0005: adaptadores entram por portas, nunca por import direto.
    if (d.tipo === 'interno' && ['persistencia', 'integracoes', 'preload'].includes(d.modulo)) {
      return [R(3), `aplicacao não importa ${d.modulo}/ (use uma porta declarada em aplicacao/)`];
    }
    return null;
  }

  // Regra 4 — interface.
  if (origem === 'interface') {
    if (d.tipo === 'node' || d.tipo === 'electron') return [R(4), `interface (renderer em sandbox) não usa ${destino}`];
    if (d.tipo !== 'interno') return null;
    if (['principal', 'persistencia', 'integracoes'].includes(d.modulo)) return [R(4), `interface não importa ${d.modulo}/`];
    if (d.modulo === 'dominio/normas') {
      if (!ehFormatado(d.caminho)) return [R(4), 'interface não importa dominio/normas (só os tipos de dominio/normas/formatado)'];
      if (!imp.somenteTipo) return [R(4), 'interface só importa TIPOS de dominio/normas/formatado (use import type)'];
      return null;
    }
    if (d.modulo === 'dominio' || d.modulo.startsWith('dominio/')) {
      if (!imp.somenteTipo) return [R(4), `interface só importa tipos do domínio (use import type de ${d.modulo})`];
      return null;
    }
    if (d.modulo === 'fora-de-src' && /(^|\/)perfis(\/|$)/.test(d.caminho)) {
      return [R(4), 'interface não lê o perfil normativo (valores, RN e medidas vêm do DocumentoFormatado)'];
    }
    return null;
  }

  // Regra 5 — exportação DOCX (e a raiz de exportacao/, que só agrega exportacao/docx).
  if (origem === 'exportacao/docx' || origem === 'exportacao') {
    if (d.tipo === 'node' || d.tipo === 'electron') return [R(5), `exportacao/docx não usa ${destino}`];
    if (d.tipo === 'pacote') return d.nome === 'docx' ? null : [R(5), `exportacao/docx só usa a biblioteca docx, não ${destino}`];
    if (d.modulo === origem) return null;
    if (origem === 'exportacao' && d.modulo === 'exportacao/docx') return null;
    if (ehFormatado(d.caminho)) {
      return imp.somenteTipo ? null : [R(5), 'exportacao/docx importa só os TIPOS de dominio/normas/formatado (use import type)'];
    }
    return [R(5), `exportacao/docx importa apenas dominio/normas/formatado e docx, não ${destino}`];
  }

  // Regra 6 — plataforma só em principal, persistencia, integracoes (+ preload para electron).
  if (d.tipo === 'node' && !USAM_NODE.has(origem)) return [R(6), `só principal, persistencia e integracoes usam ${destino} (origem ${origem})`];
  if (d.tipo === 'electron' && !USAM_ELECTRON.has(origem)) {
    return [R(6), `só principal, persistencia, integracoes e preload usam ${destino} (origem ${origem})`];
  }
  return null;
}

/** Verifica as regras 1 a 6 do ADR-0005 em uma lista de arquivos. */
export function verificarFronteiras(arquivos: readonly ArquivoFonte[]): Violacao[] {
  const violacoes: Violacao[] = [];
  for (const { arquivo, conteudo } of arquivos) {
    const origem = moduloDoCaminho(arquivo);
    const importacoes = extrairImportacoes(conteudo);
    if (origem.startsWith('desconhecido:')) {
      violacoes.push({ arquivo, linha: 1, importacao: '(arquivo)', regra: 'ADR-0005 seção 1', motivo: `arquivo fora dos módulos previstos (${origem.slice(13)})` });
      continue;
    }
    for (const imp of importacoes) {
      const destino = classificarDestino(arquivo, imp);
      const r = avaliar(origem, imp, destino);
      if (r) violacoes.push({ arquivo, linha: imp.linha, importacao: `'${imp.especificador ?? imp.trecho}'`, regra: r[0], motivo: r[1] });
    }
  }
  return violacoes;
}

// ---------------------------------------------------------------------------------------------------------
// 5. Varreduras de texto (regras 7 e 8; C-6 e C-20)
// ---------------------------------------------------------------------------------------------------------

interface PadraoProibido {
  nome: string;
  /** Aplicado sobre o código sem comentários e sem conteúdo de strings. */
  codigo?: RegExp;
  /** Aplicado sobre o código sem comentários (strings preservadas), para pegar acesso por colchetes. */
  comStrings?: RegExp;
}

function varrer(arquivos: readonly ArquivoFonte[], padroes: readonly PadraoProibido[], regra: string, ignorar: (arquivo: string) => boolean): Violacao[] {
  const saida: Violacao[] = [];
  for (const { arquivo, conteudo } of arquivos) {
    if (ignorar(arquivo)) continue;
    const { semComentarios, soCodigo } = analisarLexico(conteudo);
    for (const p of padroes) {
      for (const [re, texto] of [[p.codigo, soCodigo], [p.comStrings, semComentarios]] as const) {
        if (!re) continue;
        const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
        for (let m = g.exec(texto); m; m = g.exec(texto)) {
          saida.push({ arquivo, linha: linhaDoIndice(texto, m.index), importacao: `'${m[0].trim()}'`, regra, motivo: `uso proibido: ${p.nome}` });
        }
      }
    }
  }
  return saida;
}

const colchetes = (nomes: string): RegExp => new RegExp(`\\[\\s*(['"\`])(${nomes})\\1\\s*\\]`);

/** Regra 7 / C-20: nada de HTML montado de dado (innerHTML etc.) nem execução de texto como código. */
export const PADROES_HTML: readonly PadraoProibido[] = [
  { nome: 'innerHTML', codigo: /\binnerHTML\b/ },
  { nome: 'outerHTML', codigo: /\bouterHTML\b/ },
  { nome: 'insertAdjacentHTML', codigo: /\binsertAdjacentHTML\b/ },
  { nome: 'dangerouslySetInnerHTML', codigo: /\bdangerouslySetInnerHTML\b/ },
  { nome: 'createContextualFragment', codigo: /\bcreateContextualFragment\b/ },
  { nome: 'setHTMLUnsafe', codigo: /\bsetHTMLUnsafe\b/ },
  { nome: 'srcdoc', codigo: /\bsrcdoc\b/i },
  { nome: 'document.write', codigo: /\bdocument\s*\.\s*write(ln)?\b/ },
  { nome: 'eval(', codigo: /\beval\s*\(/ },
  { nome: 'new Function(', codigo: /\bnew\s+Function\s*\(/ },
  { nome: 'Function(', codigo: /(?<![\p{L}\p{N}_$.])Function\s*\(/u },
  { nome: 'acesso por colchetes a propriedade de HTML', comStrings: colchetes('innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|write|writeln|eval') },
];

export function varrerHtml(arquivos: readonly ArquivoFonte[]): Violacao[] {
  return varrer(arquivos, PADROES_HTML, 'ADR-0005 regra 7 / C-20', () => false);
}

/** Pasta onde a rede será permitida (após o M7; ainda não existe). */
export const PASTA_REDE_PERMITIDA = 'src/integracoes/revisao-texto/';

/** Módulos de rede cuja importação é proibida fora de PASTA_REDE_PERMITIDA. */
export const MODULOS_REDE = new Set([
  'http', 'https', 'http2', 'net', 'tls', 'dgram',
  'undici', 'ws', 'axios', 'node-fetch', 'got',
]);

/** Regra 8: chamadas de rede (o texto 'https:' em strings de política não conta: strings são ignoradas). */
export const PADROES_REDE: readonly PadraoProibido[] = [
  { nome: 'fetch( (inclui net.fetch e session.fetch)', codigo: /\bfetch\s*\(/ },
  { nome: 'XMLHttpRequest', codigo: /\bXMLHttpRequest\b/ },
  { nome: 'WebSocket', codigo: /\bWebSocket\b/ },
  { nome: 'EventSource', codigo: /\bEventSource\b/ },
  { nome: 'sendBeacon', codigo: /\bsendBeacon\s*\(/ },
  { nome: 'downloadURL', codigo: /\bdownloadURL\s*\(/ },
  { nome: 'net do electron (net.request/net.resolveHost)', codigo: /\bnet\s*\.\s*(request|resolveHost|fetch)\b/ },
  { nome: "require('electron').net", comStrings: /require\s*\(\s*(['"])electron\1\s*\)\s*\.\s*net\b/ },
];

export function varrerRede(arquivos: readonly ArquivoFonte[]): Violacao[] {
  const ignorar = (arquivo: string): boolean => arquivo.startsWith(PASTA_REDE_PERMITIDA);
  const saida = varrer(arquivos, PADROES_REDE, 'ADR-0005 regra 8', ignorar);
  for (const { arquivo, conteudo } of arquivos) {
    if (ignorar(arquivo)) continue;
    for (const imp of extrairImportacoes(conteudo)) {
      if (imp.especificador === null) continue;
      const d = classificarDestino(arquivo, imp);
      const nome = d.tipo === 'node' || d.tipo === 'pacote' ? d.nome : null;
      if (nome !== null && MODULOS_REDE.has(nome)) {
        saida.push({ arquivo, linha: imp.linha, importacao: `'${imp.especificador}'`, regra: 'ADR-0005 regra 8', motivo: `módulo de rede fora de ${PASTA_REDE_PERMITIDA}` });
      }
      if (d.tipo === 'electron' && imp.nomes.includes('net')) {
        saida.push({ arquivo, linha: imp.linha, importacao: `'${imp.especificador}'`, regra: 'ADR-0005 regra 8', motivo: `net do electron fora de ${PASTA_REDE_PERMITIDA}` });
      }
    }
  }
  return saida;
}

/** Único arquivo autorizado a chamar shell.openExternal (C-6, com validação e confirmação). */
export const ARQUIVO_OPEN_EXTERNAL = 'src/principal/seguranca/endurecimento.ts';

export function varrerOpenExternal(arquivos: readonly ArquivoFonte[]): Violacao[] {
  return varrer(
    arquivos,
    [{ nome: 'shell.openExternal', codigo: /\bopenExternal\b/, comStrings: colchetes('openExternal') }],
    'C-6 (openExternal só em endurecimento.ts)',
    (arquivo) => arquivo === ARQUIVO_OPEN_EXTERNAL,
  );
}
