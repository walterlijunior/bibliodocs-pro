/**
 * Tabela e quadro no editor (M5-T04; RF-09), em funções puras usadas pela janela da tabela.
 *
 * O modelo (`BlocoTabela`) guarda a grade no formato do HTML: cada linha lista só as células que começam nela. Para editar,
 * a janela usa o **rascunho**: a grade completa, uma posição por linha × coluna, com `null` nas posições cobertas por uma
 * célula mesclada. Inserir e excluir linha ou coluna, mesclar e separar ficam simples assim, e a volta ao modelo é direta.
 *
 * - Texto: cada campo guarda o texto da tela e o conteúdo original. Campo não alterado volta com as marcas que tinha;
 *   alterado, volta como texto simples (a janela edita texto, não marcas).
 * - Sinais convencionais (RN-263, RN-264): a célula que só tem "-" grava a meia-risca "–" (P-C10); "…", o "..." que o
 *   corretor trocou. `notaDeSinais` monta a explicação da nota geral (RN-265), na forma dos exemplos do IBGE.
 * - `validarTabela`: só sai a tabela que o formato v1 aceita (esquema e grade, `validarTabelaV1`).
 */
import { LIMITES_V1, validarTabelaV1 } from '../../dominio/esquemas';
import type { AlinhamentoColuna, BlocoTabela, InlineDeTitulo } from '../../dominio/modelo';

/** O que o editor guarda da tabela: tudo menos o id do nó. */
export type DadosTabela = Omit<BlocoTabela, 'id'>;

export interface CampoTexto {
  texto: string;
  /** Conteúdo de onde o texto veio; volta inteiro (com as marcas) se o texto não mudou. */
  original?: readonly InlineDeTitulo[];
}

export interface CelulaRascunho {
  campo: CampoTexto;
  colunas: number;
  linhas: number;
}

export interface RascunhoTabela {
  especie: 'tabela' | 'quadro';
  titulo: CampoTexto;
  alinhamentos: AlinhamentoColuna[];
  linhasCabecalho: number;
  /** Grade completa: `null` é posição coberta por célula mesclada de cima ou da esquerda. */
  grade: (CelulaRascunho | null)[][];
  fonte: CampoTexto;
  nota: CampoTexto;
  notasEspecificas: CampoTexto[];
}

/** Resultado de uma operação na grade: a operação recusada diz o motivo, para a janela mostrar. */
export type ResultadoOperacao = { ok: true; rascunho: RascunhoTabela } | { ok: false; motivo: string };

export interface ErroTabela {
  /** Nome do campo como a janela o mostra ("Título", "Linha 3", "Nota específica 1"). */
  campo: string;
  mensagem: string;
}

export type ResultadoValidacaoTabela = { ok: true; dados: DadosTabela } | { ok: false; erros: readonly ErroTabela[] };

/** Limite de colunas: o do formato (o do Word). */
export const MAX_COLUNAS_TABELA = LIMITES_V1.colunasTabela;
/** Limite de linhas no editor: o do formato. */
export const MAX_LINHAS_TABELA = LIMITES_V1.linhasTabela;

const ID_PROVISORIO = 'tab_provisorio0001';

// ---------------------------------------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------------------------------------

const plano = (c: readonly InlineDeTitulo[]): string => c.map((i) => i.texto).join('');

export const campoDe = (conteudo: readonly InlineDeTitulo[] | undefined): CampoTexto =>
  conteudo === undefined ? { texto: '' } : { texto: plano(conteudo), original: conteudo };

const campoVazio = (): CampoTexto => ({ texto: '' });

/** Texto → conteúdo: original quando não mudou; senão, texto simples aparado (vazio = sem conteúdo). */
function conteudoDe(c: CampoTexto, normalizar: (t: string) => string = (t) => t): InlineDeTitulo[] {
  if (c.original !== undefined && c.texto === plano(c.original)) {
    const t = normalizar(c.texto.trim());
    // O sinal digitado e já gravado também se normaliza; o resto volta intacto.
    return t !== c.texto.trim() ? [{ tipo: 'texto', texto: t }] : [...c.original];
  }
  const t = normalizar(c.texto.trim());
  return t === '' ? [] : [{ tipo: 'texto', texto: t }];
}

// ---------------------------------------------------------------------------------------------------------
// Sinais convencionais (RN-263, RN-264, RN-265)
// ---------------------------------------------------------------------------------------------------------

/**
 * Sinais da RN-263 (IBGE, seção 4.8.1, p. 18), com o significado como nas notas dos exemplos do Anexo B. O "–" é a
 * meia-risca (RN-264, P-C10). "X" maiúsculo como no texto da seção 4.8.1 (D-M5-25).
 */
export const SINAIS_CONVENCIONAIS: readonly { sinal: string; significado: string }[] = [
  { sinal: '–', significado: 'Dado numérico igual a zero não resultante de arredondamento.' },
  { sinal: '..', significado: 'Não se aplica dado numérico.' },
  { sinal: '...', significado: 'Dado numérico não disponível.' },
  { sinal: 'X', significado: 'Dado numérico omitido a fim de evitar a individualização da informação.' },
];

/** A célula que só tem o hífen grava a meia-risca (RN-264); "…" do corretor volta a "...". */
export function normalizarSinal(texto: string): string {
  if (texto === '-') return '–';
  if (texto === '…') return '...';
  return texto;
}

const sinalDe = (texto: string): string | undefined => {
  const t = normalizarSinal(texto.trim());
  return SINAIS_CONVENCIONAIS.find((s) => s.sinal === t || (s.sinal === 'X' && t === 'x'))?.sinal;
};

/**
 * Explicação dos sinais usados no corpo da tabela, para a nota geral (RN-265): "Sinal convencional utilizado:" e uma
 * linha por sinal, na ordem da RN-263. `null` sem sinal no corpo.
 */
export function notaDeSinais(r: RascunhoTabela): string | null {
  const usados = new Set<string>();
  r.grade.forEach((linha, l) => {
    if (l < r.linhasCabecalho) return;
    for (const c of linha) {
      const s = c ? sinalDe(c.campo.texto) : undefined;
      if (s !== undefined) usados.add(s);
    }
  });
  const lista = SINAIS_CONVENCIONAIS.filter((s) => usados.has(s.sinal));
  if (lista.length === 0) return null;
  const cabeca = lista.length === 1 ? 'Sinal convencional utilizado:' : 'Sinais convencionais utilizados:';
  return [cabeca, ...lista.map((s) => `${s.sinal} ${s.significado}`)].join('\n');
}

/** Acrescenta a explicação dos sinais à nota geral (sem repetir a que já está lá). */
export function explicarSinaisNaNota(r: RascunhoTabela): RascunhoTabela {
  const texto = notaDeSinais(r);
  if (texto === null || r.nota.texto.includes(texto)) return r;
  const atual = r.nota.texto.trimEnd();
  return { ...r, nota: { texto: atual === '' ? texto : `${atual}\n${texto}` } };
}

// ---------------------------------------------------------------------------------------------------------
// Modelo ↔ rascunho
// ---------------------------------------------------------------------------------------------------------

/** Tabela nova: três colunas (indicador à esquerda, números à direita, P-C4) e uma linha de cabeçalho; quadro, duas colunas de texto. */
export function rascunhoNovo(especie: 'tabela' | 'quadro'): RascunhoTabela {
  const alinhamentos: AlinhamentoColuna[] = especie === 'tabela' ? ['esquerda', 'direita', 'direita'] : ['esquerda', 'esquerda'];
  return {
    especie,
    titulo: campoVazio(),
    alinhamentos,
    linhasCabecalho: 1,
    grade: Array.from({ length: 3 }, () => alinhamentos.map(() => celulaVazia())),
    fonte: campoVazio(),
    nota: campoVazio(),
    notasEspecificas: [],
  };
}

const celulaVazia = (): CelulaRascunho => ({ campo: campoVazio(), colunas: 1, linhas: 1 });

/** Rascunho a partir da tabela gravada (grade já conferida na leitura do arquivo). */
export function rascunhoDe(d: DadosTabela): RascunhoTabela {
  const nColunas = d.colunas.length;
  const grade: (CelulaRascunho | null)[][] = d.linhas.map(() => new Array<CelulaRascunho | null>(nColunas).fill(null));
  const cobertas = new Array<number>(nColunas).fill(0);
  d.linhas.forEach((linha, l) => {
    let c = 0;
    for (const cel of linha) {
      while (c < nColunas && cobertas[c]! > 0) c++;
      const colunas = cel.colunas ?? 1;
      const linhas = cel.linhas ?? 1;
      if (c < nColunas) grade[l]![c] = { campo: campoDe(cel.conteudo), colunas, linhas };
      for (let k = c; k < Math.min(nColunas, c + colunas); k++) cobertas[k] = linhas;
      c += colunas;
    }
    for (let k = 0; k < nColunas; k++) cobertas[k] = Math.max(0, cobertas[k]! - 1);
  });
  return {
    especie: d.especie,
    titulo: campoDe(d.titulo),
    alinhamentos: d.colunas.map((c) => c.alinhamento),
    linhasCabecalho: d.linhasCabecalho,
    grade,
    fonte: campoDe(d.fonte),
    nota: campoDe(d.nota),
    notasEspecificas: (d.notasEspecificas ?? []).map((n) => campoDe(n)),
  };
}

/** Rascunho → dados do modelo, sem conferir (ver `validarTabela`). */
export function dadosDoRascunho(r: RascunhoTabela): DadosTabela {
  const fonte = conteudoDe(r.fonte);
  const nota = conteudoDe(r.nota);
  return {
    tipo: 'tabela',
    especie: r.especie,
    titulo: conteudoDe(r.titulo),
    colunas: r.alinhamentos.map((alinhamento) => ({ alinhamento })),
    linhasCabecalho: r.linhasCabecalho,
    linhas: r.grade.map((linha) =>
      linha
        .filter((c): c is CelulaRascunho => c !== null)
        .map((c) => ({
          conteudo: conteudoDe(c.campo, normalizarSinal),
          ...(c.colunas > 1 ? { colunas: c.colunas } : {}),
          ...(c.linhas > 1 ? { linhas: c.linhas } : {}),
        })),
    ),
    ...(fonte.length > 0 ? { fonte } : {}),
    ...(nota.length > 0 ? { nota } : {}),
    ...(r.notasEspecificas.length > 0 ? { notasEspecificas: r.notasEspecificas.map((n) => conteudoDe(n)) } : {}),
  };
}

/** "tabela.linhas[2][0].conteudo" → "Linha 3"; "tabela.notasEspecificas[0]" → "Nota específica 1". */
function campoDoErro(caminho: string): string {
  const m = /^tabela\.(\w+)(?:\[(\d+)\])?/.exec(caminho);
  const n = m?.[2] !== undefined ? Number(m[2]) + 1 : null;
  switch (m?.[1]) {
    case 'titulo':
      return 'Título';
    case 'fonte':
      return 'Fonte';
    case 'nota':
      return 'Nota';
    case 'notasEspecificas':
      return n !== null ? `Nota específica ${n}` : 'Notas específicas';
    case 'linhas':
      return n !== null ? `Linha ${n}` : 'Linhas';
    case 'colunas':
      return 'Colunas';
    case 'linhasCabecalho':
      return 'Cabeçalho';
    default:
      return 'Tabela';
  }
}

/** Confere o rascunho como o arquivo conferiria. A tabela só vai para o texto com `ok`. */
export function validarTabela(r: RascunhoTabela): ResultadoValidacaoTabela {
  const erros: ErroTabela[] = [];
  if (r.titulo.texto.trim() === '') erros.push({ campo: 'Título', mensagem: 'escreva o título (RN-050)' });
  r.notasEspecificas.forEach((n, i) => {
    if (n.texto.trim() === '') erros.push({ campo: `Nota específica ${i + 1}`, mensagem: 'escreva o texto da nota ou retire-a' });
  });
  if (erros.length > 0) return { ok: false, erros };
  const dados = dadosDoRascunho(r);
  const v = validarTabelaV1({ ...dados, id: ID_PROVISORIO });
  if (!v.ok) return { ok: false, erros: v.erros.map((e) => ({ campo: campoDoErro(e.caminho), mensagem: e.mensagem })) };
  return { ok: true, dados };
}

// ---------------------------------------------------------------------------------------------------------
// Operações na grade
// ---------------------------------------------------------------------------------------------------------

type Grade = (CelulaRascunho | null)[][];

const copiar = (g: Grade): Grade => g.map((linha) => linha.map((c) => (c ? { ...c } : null)));

/** Grade transposta: as operações de coluna são as de linha na transposta. */
const transpor = (g: Grade): Grade =>
  (g[0] ?? []).map((_, c) => g.map((linha) => {
    const x = linha[c]!;
    return x ? { campo: x.campo, colunas: x.linhas, linhas: x.colunas } : null;
  }));

/** Posição da célula que cobre (l, c). */
function dono(g: Grade, l: number, c: number): [number, number] {
  for (let rr = l; rr >= 0; rr--) {
    for (let cc = c; cc >= 0; cc--) {
      const x = g[rr]![cc];
      if (x && rr + x.linhas > l && cc + x.colunas > c) return [rr, cc];
    }
  }
  return [l, c];
}

/** Linha nova no índice `k`. A célula mesclada que atravessa o ponto de inserção cresce e cobre a linha nova. */
function gradeComLinha(g0: Grade, k: number): Grade {
  const g = copiar(g0);
  const nColunas = g[0]?.length ?? 0;
  const nova: (CelulaRascunho | null)[] = [];
  const crescidas = new Set<string>();
  for (let c = 0; c < nColunas; c++) {
    if (k > 0 && k < g.length && g[k]![c] === null) {
      const [rr, cc] = dono(g, k, c);
      if (rr < k) {
        if (!crescidas.has(`${rr},${cc}`)) {
          crescidas.add(`${rr},${cc}`);
          g[rr]![cc]!.linhas++;
        }
        nova.push(null);
        continue;
      }
    }
    nova.push(celulaVazia());
  }
  g.splice(k, 0, nova);
  return g;
}

/** Sem a linha `l`. A célula que começa nela e desce passa para a linha de baixo; a que vem de cima encolhe. */
function gradeSemLinha(g0: Grade, l: number): Grade {
  const g = copiar(g0);
  const nColunas = g[0]?.length ?? 0;
  const encolher = new Set<string>();
  const descer: number[] = [];
  for (let c = 0; c < nColunas; c++) {
    const x = g[l]![c];
    if (x === null) {
      const [rr, cc] = dono(g, l, c);
      if (rr < l) encolher.add(`${rr},${cc}`);
    } else if (x!.linhas > 1) descer.push(c);
  }
  for (const k of encolher) {
    const [rr, cc] = k.split(',').map(Number) as [number, number];
    g[rr]![cc]!.linhas--;
  }
  for (const c of descer) {
    const x = g[l]![c]!;
    g[l + 1]![c] = { ...x, linhas: x.linhas - 1 };
  }
  g.splice(l, 1);
  return g;
}

const comGrade = (r: RascunhoTabela, grade: Grade, extra: Partial<RascunhoTabela> = {}): ResultadoOperacao => ({ ok: true, rascunho: { ...r, ...extra, grade } });

/** Linha nova antes da linha `k` (`k` = número de linhas: no fim). Dentro do cabeçalho, ela é de cabeçalho. */
export function inserirLinha(r: RascunhoTabela, k: number): ResultadoOperacao {
  if (r.grade.length >= MAX_LINHAS_TABELA) return { ok: false, motivo: `a tabela já tem o máximo de ${MAX_LINHAS_TABELA} linhas` };
  if ((r.grade.length + 1) * r.alinhamentos.length > LIMITES_V1.posicoesTabela) return { ok: false, motivo: 'a tabela já está no tamanho máximo' };
  const i = Math.max(0, Math.min(k, r.grade.length));
  return comGrade(r, gradeComLinha(r.grade, i), { linhasCabecalho: i < r.linhasCabecalho ? r.linhasCabecalho + 1 : r.linhasCabecalho });
}

export function excluirLinha(r: RascunhoTabela, l: number): ResultadoOperacao {
  if (r.grade.length <= 1) return { ok: false, motivo: 'a tabela precisa de pelo menos uma linha' };
  return comGrade(r, gradeSemLinha(r.grade, l), { linhasCabecalho: l < r.linhasCabecalho ? r.linhasCabecalho - 1 : r.linhasCabecalho });
}

/** Coluna nova antes da coluna `k`, com o alinhamento da vizinha (a da esquerda, ou a da direita no começo). */
export function inserirColuna(r: RascunhoTabela, k: number): ResultadoOperacao {
  if (r.alinhamentos.length >= MAX_COLUNAS_TABELA) return { ok: false, motivo: `a tabela já tem o máximo de ${MAX_COLUNAS_TABELA} colunas` };
  if (r.grade.length * (r.alinhamentos.length + 1) > LIMITES_V1.posicoesTabela) return { ok: false, motivo: 'a tabela já está no tamanho máximo' };
  const i = Math.max(0, Math.min(k, r.alinhamentos.length));
  const alinhamentos = [...r.alinhamentos];
  alinhamentos.splice(i, 0, r.alinhamentos[i - 1] ?? r.alinhamentos[i] ?? 'esquerda');
  return comGrade(r, transpor(gradeComLinha(transpor(r.grade), i)), { alinhamentos });
}

export function excluirColuna(r: RascunhoTabela, c: number): ResultadoOperacao {
  if (r.alinhamentos.length <= 1) return { ok: false, motivo: 'a tabela precisa de pelo menos uma coluna' };
  return comGrade(r, transpor(gradeSemLinha(transpor(r.grade), c)), { alinhamentos: r.alinhamentos.filter((_, i) => i !== c) });
}

const juntar = (a: CampoTexto, b: CampoTexto): CampoTexto => {
  const x = a.texto.trim();
  const y = b.texto.trim();
  return { texto: x === '' ? y : y === '' ? x : `${x} ${y}` };
};

/** Junta a célula de (l, c) com a vizinha da direita, de mesma altura. O texto das duas fica junto. */
function mesclarDireita(g0: Grade, l: number, c: number): Grade | string {
  const x = g0[l]?.[c];
  if (!x) return 'escolha uma célula';
  const j = c + x.colunas;
  if (j >= (g0[0]?.length ?? 0)) return 'não há célula à direita';
  const v = g0[l]![j];
  if (!v) return 'a célula à direita já está mesclada com outra';
  if (v.linhas !== x.linhas) return 'as duas células precisam ter a mesma altura';
  const g = copiar(g0);
  g[l]![c] = { campo: juntar(x.campo, v.campo), colunas: x.colunas + v.colunas, linhas: x.linhas };
  g[l]![j] = null;
  return g;
}

export function mesclar(r: RascunhoTabela, l: number, c: number, direcao: 'direita' | 'abaixo'): ResultadoOperacao {
  if (direcao === 'direita') {
    const g = mesclarDireita(r.grade, l, c);
    return typeof g === 'string' ? { ok: false, motivo: g } : comGrade(r, g);
  }
  const x = r.grade[l]?.[c];
  if (x && l < r.linhasCabecalho && l + x.linhas >= r.linhasCabecalho) {
    return { ok: false, motivo: 'o cabeçalho não se mescla com o corpo da tabela' };
  }
  const t = mesclarDireita(transpor(r.grade), c, l);
  if (typeof t === 'string') return { ok: false, motivo: t.replace('à direita', 'abaixo').replace('altura', 'largura') };
  return comGrade(r, transpor(t));
}

/** Desfaz a mesclagem: a célula volta a uma posição, com o texto; as outras ficam vazias. */
export function separar(r: RascunhoTabela, l: number, c: number): ResultadoOperacao {
  const x = r.grade[l]?.[c];
  if (!x || (x.colunas === 1 && x.linhas === 1)) return { ok: false, motivo: 'a célula não está mesclada' };
  const g = copiar(r.grade);
  for (let rr = l; rr < l + x.linhas; rr++) for (let cc = c; cc < c + x.colunas; cc++) g[rr]![cc] = celulaVazia();
  g[l]![c] = { campo: x.campo, colunas: 1, linhas: 1 };
  return comGrade(r, g);
}

/** Quantas das primeiras linhas formam o cabeçalho. Recusa se uma célula mesclada ficaria atravessando o fim dele. */
export function mudarCabecalho(r: RascunhoTabela, n: number): ResultadoOperacao {
  if (!Number.isInteger(n) || n < 0 || n > r.grade.length) return { ok: false, motivo: `o cabeçalho vai de 0 a ${r.grade.length} linhas` };
  const atravessa = r.grade.some((linha, l) => linha.some((x) => x !== null && l < n && l + x.linhas > n));
  if (atravessa) return { ok: false, motivo: 'uma célula mesclada atravessaria o fim do cabeçalho: separe-a antes' };
  return { ok: true, rascunho: { ...r, linhasCabecalho: n } };
}

/** Texto novo na célula de (l, c). */
export function alterarCelula(r: RascunhoTabela, l: number, c: number, texto: string): RascunhoTabela {
  const x = r.grade[l]?.[c];
  if (!x) return r;
  const grade = r.grade.map((linha, i) => (i === l ? linha.map((y, j) => (j === c ? { ...x, campo: { ...x.campo, texto } } : y)) : linha));
  return { ...r, grade };
}
