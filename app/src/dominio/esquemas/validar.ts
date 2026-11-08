/**
 * Validação dos JSON do pacote `.bdp` com mensagens em pt-BR (M1-T04; ADR-0004, seções 2 e 3).
 * Ordem: aninhamento JSON (iterativo, antes do zod, contra estouro de pilha) → esquema estrito →
 * profundidade da árvore de seções → elementos pré e pós-textuais → ids únicos → obras citadas → grade das tabelas (M5-T01).
 */
import { z } from 'zod';
import { problemaNaGrade, problemaNosElementos, type Bloco, type BlocoIlustracao, type BlocoTabela, type Documento, type Inline, type InlineCitacao, type MotivoGrade, type Obra, type Secao } from '../modelo';
import { LIMITES_V1 } from './limites';
import { esquemaBlocoIlustracao, esquemaBlocoTabela, esquemaDocumentoV1, esquemaInlineCitacao, esquemaManifestoV1, esquemaObra, type Manifesto } from './projeto-v1';

export interface ErroValidacao {
  /** Caminho legível, ex.: `documento.corpo[0].titulo[1].texto`. */
  caminho: string;
  mensagem: string;
}

export type ResultadoValidacao<T> = { ok: true; valor: T } | { ok: false; erros: ErroValidacao[] };

const localeBase = z.locales.ptBR().localeError;

/** Mensagens próprias para os casos mais comuns; o resto vem do locale pt-BR do zod. */
const mensagemPtBr: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === 'unrecognized_keys') {
    const campos = issue.keys.map((k) => `"${k}"`).join(', ');
    return issue.keys.length === 1 ? `campo não permitido: ${campos}` : `campos não permitidos: ${campos}`;
  }
  if (issue.code === 'invalid_type' && issue.input === undefined) {
    return 'campo obrigatório ausente';
  }
  if (issue.code === 'invalid_union' && 'note' in issue && issue.note === 'No matching discriminator') {
    return 'tipo desconhecido';
  }
  return localeBase(issue);
};

export function formatarCaminho(raiz: string, caminho: readonly PropertyKey[]): string {
  let texto = raiz;
  for (const parte of caminho) {
    texto += typeof parte === 'number' ? `[${parte}]` : `.${String(parte)}`;
  }
  return texto;
}

/** Profundidade de aninhamento de um valor JSON, sem recursão. Para assim que passa de `limite`. */
export function profundidadeJsonExcede(valor: unknown, limite: number): boolean {
  const pilha: { v: unknown; n: number }[] = [{ v: valor, n: 0 }];
  while (pilha.length > 0) {
    const { v, n } = pilha.pop()!;
    if (v === null || typeof v !== 'object') continue;
    if (n + 1 > limite) return true;
    const filhos = Array.isArray(v) ? v : Object.values(v);
    for (const filho of filhos) pilha.push({ v: filho, n: n + 1 });
  }
  return false;
}

/** Primeira seção que passa do limite de profundidade (nível 1 = seção do corpo), sem recursão. */
function secaoAlemDoLimite(corpo: Secao[], limite: number): readonly PropertyKey[] | null {
  const pilha: { s: Secao; nivel: number; caminho: PropertyKey[] }[] = corpo.map((s, i) => ({ s, nivel: 1, caminho: ['corpo', i] }));
  while (pilha.length > 0) {
    const { s, nivel, caminho } = pilha.pop()!;
    if (nivel > limite) return caminho;
    s.subsecoes.forEach((sub, i) => pilha.push({ s: sub, nivel: nivel + 1, caminho: [...caminho, 'subsecoes', i] }));
  }
  return null;
}

/** Conteúdos do bloco com o caminho de cada um a partir do bloco (alínea, depois as suas subalíneas). */
function conteudosComCaminho(b: Bloco): { conteudo: readonly Inline[]; caminho: PropertyKey[] }[] {
  switch (b.tipo) {
    case 'paragrafo':
    case 'citacaoLonga':
      return [{ conteudo: b.conteudo, caminho: ['conteudo'] }];
    case 'alineas':
      return b.itens.flatMap((item, i) => [
        { conteudo: item.conteudo, caminho: ['itens', i, 'conteudo'] },
        ...(item.subalineas ?? []).map((sub, j) => ({ conteudo: sub, caminho: ['itens', i, 'subalineas', j] })),
      ]);
    case 'quebraPagina':
    // Campos dos elementos visuais: só texto (sem nota nem citação), então nada a conferir aqui (M5-T01).
    case 'tabela':
    case 'ilustracao':
    case 'equacao':
      return [];
  }
}

const MENSAGENS_GRADE: Record<MotivoGrade | 'posicoesDemais', string> = {
  cabecalhoMaiorQueTabela: 'o cabeçalho tem mais linhas que a tabela',
  passaDaUltimaColuna: 'a célula passa da última coluna da tabela',
  passaDaUltimaLinha: 'a célula mesclada passa da última linha da tabela',
  sobreposta: 'a célula se sobrepõe a uma célula mesclada de uma linha anterior',
  atravessaCabecalho: 'a célula mesclada atravessa o fim do cabeçalho',
  linhaIncompleta: 'a linha não preenche todas as colunas da tabela (grade irregular)',
  posicoesDemais: `tabela grande demais (limite de ${LIMITES_V1.posicoesTabela} posições, linhas × colunas)`,
};

/** Primeira tabela com grade incoerente ou grande demais (M5-T01), com o caminho a partir do documento. */
function gradeInvalida(corpo: readonly Secao[]): ErroValidacao | null {
  for (const p of percorrerCorpo(corpo)) {
    if (p.tipo !== 'bloco' || p.bloco.tipo !== 'tabela') continue;
    const b = p.bloco;
    if (b.linhas.length * b.colunas.length > LIMITES_V1.posicoesTabela) {
      return { caminho: formatarCaminho('documento', [...p.caminho, 'linhas']), mensagem: MENSAGENS_GRADE.posicoesDemais };
    }
    const problema = problemaNaGrade(b);
    if (problema) return { caminho: formatarCaminho('documento', [...p.caminho, ...problema.caminho]), mensagem: MENSAGENS_GRADE[problema.motivo] };
  }
  return null;
}

const MENSAGENS_ELEMENTOS = {
  tipoSemElementos: 'o tipo de trabalho genérico não tem elementos pré nem pós-textuais',
  foraDeOrdem: 'elemento fora da ordem do Quadro 5 do Manual UFT',
  repetido: 'elemento repetido (só apêndice e anexo podem aparecer mais de uma vez)',
  repeticoesDemais: 'apêndices ou anexos demais',
} as const;

/** Seções, blocos e trechos do corpo em ordem de leitura, com o caminho de cada um, sem recursão. */
function* percorrerCorpo(corpo: readonly Secao[]): Generator<
  | { tipo: 'secao'; id: string; caminho: PropertyKey[] }
  | { tipo: 'bloco'; id: string; bloco: Bloco; caminho: PropertyKey[] }
  | { tipo: 'inline'; inline: Inline; caminho: PropertyKey[] }
> {
  const pilha: { s: Secao; caminho: PropertyKey[] }[] = corpo.map((s, i) => ({ s, caminho: ['corpo', i] })).reverse();
  while (pilha.length > 0) {
    const { s, caminho } = pilha.pop()!;
    yield { tipo: 'secao', id: s.id, caminho };
    for (const [i, b] of s.blocos.entries()) {
      yield { tipo: 'bloco', id: b.id, bloco: b, caminho: [...caminho, 'blocos', i] };
      for (const c of conteudosComCaminho(b)) {
        for (const [k, inline] of c.conteudo.entries()) {
          const aqui = [...caminho, 'blocos', i, ...c.caminho, k];
          yield { tipo: 'inline', inline, caminho: aqui };
          // Dentro da nota: as chamadas de citação (M4-T07).
          if (inline.tipo === 'nota') for (const [j, n] of inline.conteudo.entries()) yield { tipo: 'inline', inline: n, caminho: [...aqui, 'conteudo', j] };
        }
      }
    }
    for (let i = s.subsecoes.length - 1; i >= 0; i--) pilha.push({ s: s.subsecoes[i]!, caminho: [...caminho, 'subsecoes', i] });
  }
}

/**
 * Primeiro id de elemento, seção, bloco, nota, citação ou obra repetido no documento, em ordem de leitura
 * (pré-textuais, corpo, pós-textuais, obras) e sem recursão.
 */
function idRepetido(doc: Documento): readonly PropertyKey[] | null {
  const vistos = new Set<string>();
  const novo = (id: string) => (vistos.has(id) ? false : (vistos.add(id), true));
  for (const [i, e] of (doc.preTextuais ?? []).entries()) if (!novo(e.id)) return ['preTextuais', i, 'id'];
  for (const p of percorrerCorpo(doc.corpo)) {
    if (p.tipo !== 'inline') {
      if (!novo(p.id)) return [...p.caminho, 'id'];
    } else if (p.inline.tipo !== 'texto' && !novo(p.inline.id)) return [...p.caminho, 'id'];
  }
  for (const [i, e] of (doc.posTextuais ?? []).entries()) if (!novo(e.id)) return ['posTextuais', i, 'id'];
  for (const [i, o] of (doc.obras ?? []).entries()) if (!novo(o.id)) return ['obras', i, 'id'];
  return null;
}

/** Primeira citação que aponta para obra fora de `obras` (RF-07: não existe citação sem obra). */
function citacaoSemObra(doc: Documento): readonly PropertyKey[] | null {
  const obras = new Set((doc.obras ?? []).map((o) => o.id));
  for (const p of percorrerCorpo(doc.corpo)) {
    if (p.tipo !== 'inline' || p.inline.tipo !== 'citacao') continue;
    const c = p.inline;
    const k = c.obras.findIndex((o) => !obras.has(o.obra));
    if (k >= 0) return [...p.caminho, 'obras', k, 'obra'];
    if (c.apud && !obras.has(c.apud.obra)) return [...p.caminho, 'apud', 'obra'];
  }
  return null;
}

function validarComEsquema<T>(raiz: string, esquema: z.ZodType<T>, json: unknown): ResultadoValidacao<T> {
  if (profundidadeJsonExcede(json, LIMITES_V1.profundidadeJson)) {
    return { ok: false, erros: [{ caminho: raiz, mensagem: `estrutura aninhada demais (limite de ${LIMITES_V1.profundidadeJson} níveis)` }] };
  }
  const r = esquema.safeParse(json, { error: mensagemPtBr });
  if (r.success) return { ok: true, valor: r.data };
  return { ok: false, erros: r.error.issues.map((i) => ({ caminho: formatarCaminho(raiz, i.path), mensagem: i.message })) };
}

export function validarDocumentoV1(json: unknown): ResultadoValidacao<Documento> {
  const r = validarComEsquema('documento', esquemaDocumentoV1, json);
  if (!r.ok) return r;
  const alem = secaoAlemDoLimite(r.valor.corpo, LIMITES_V1.profundidadeSecoes);
  if (alem) {
    return {
      ok: false,
      erros: [{ caminho: formatarCaminho('documento', alem), mensagem: `seções aninhadas demais (limite de ${LIMITES_V1.profundidadeSecoes} níveis)` }],
    };
  }
  const elementos = problemaNosElementos(r.valor);
  if (elementos) {
    return {
      ok: false,
      erros: [{ caminho: formatarCaminho('documento', [elementos.lista, elementos.indice, 'tipo']), mensagem: MENSAGENS_ELEMENTOS[elementos.motivo] }],
    };
  }
  const repetido = idRepetido(r.valor);
  if (repetido) {
    return { ok: false, erros: [{ caminho: formatarCaminho('documento', repetido), mensagem: 'identificador repetido no documento' }] };
  }
  const semObra = citacaoSemObra(r.valor);
  if (semObra) {
    return { ok: false, erros: [{ caminho: formatarCaminho('documento', semObra), mensagem: 'a citação aponta para uma obra que não está na bibliografia' }] };
  }
  const grade = gradeInvalida(r.valor.corpo);
  if (grade) return { ok: false, erros: [grade] };
  return r;
}

/**
 * Mídias de que o documento precisa (M5-T01): o sha256 de cada ilustração, com o caminho, em ordem de leitura. O
 * contêiner confere contra as mídias do pacote; o documento sozinho não sabe quais existem.
 */
export function midiasDoDocumento(doc: Pick<Documento, 'corpo'>): { sha256: string; caminho: string }[] {
  const saida: { sha256: string; caminho: string }[] = [];
  for (const p of percorrerCorpo(doc.corpo)) {
    if (p.tipo === 'bloco' && p.bloco.tipo === 'ilustracao') saida.push({ sha256: p.bloco.midia, caminho: formatarCaminho('documento', [...p.caminho, 'midia']) });
  }
  return saida;
}

/** Uma obra sozinha (M4-T06): o cadastro só grava a obra que o documento aceitaria. Caminhos a partir de `obra`. */
export function validarObraV1(json: unknown): ResultadoValidacao<Obra> {
  return validarComEsquema('obra', esquemaObra as z.ZodType<Obra>, json);
}

/** Uma chamada sozinha (M4-T07): o editor só insere a citação que o documento aceitaria. Caminhos a partir de `citacao`. */
export function validarCitacaoV1(json: unknown): ResultadoValidacao<InlineCitacao> {
  return validarComEsquema('citacao', esquemaInlineCitacao as z.ZodType<InlineCitacao>, json);
}

/**
 * Uma tabela ou quadro sozinho (M5-T04): o editor só grava a tabela que o documento aceitaria, esquema e grade.
 * Caminhos a partir de `tabela`.
 */
export function validarTabelaV1(json: unknown): ResultadoValidacao<BlocoTabela> {
  const r = validarComEsquema('tabela', esquemaBlocoTabela as z.ZodType<BlocoTabela>, json);
  if (!r.ok) return r;
  const b = r.valor;
  if (b.linhas.length * b.colunas.length > LIMITES_V1.posicoesTabela) {
    return { ok: false, erros: [{ caminho: 'tabela.linhas', mensagem: MENSAGENS_GRADE.posicoesDemais }] };
  }
  const problema = problemaNaGrade(b);
  if (problema) return { ok: false, erros: [{ caminho: formatarCaminho('tabela', problema.caminho), mensagem: MENSAGENS_GRADE[problema.motivo] }] };
  return r;
}

/** Uma ilustração sozinha (M5-T06): a janela da figura só grava a que o documento aceitaria. Caminhos a partir de `ilustracao`. */
export function validarIlustracaoV1(json: unknown): ResultadoValidacao<BlocoIlustracao> {
  return validarComEsquema('ilustracao', esquemaBlocoIlustracao as z.ZodType<BlocoIlustracao>, json);
}

export function validarManifestoV1(json: unknown): ResultadoValidacao<Manifesto> {
  return validarComEsquema('manifesto', esquemaManifestoV1, json);
}

/** Texto único para relatório ao usuário; lista no máximo `LIMITES_V1.errosRelatados` erros. */
export function descreverErros(erros: readonly ErroValidacao[]): string {
  const listados = erros.slice(0, LIMITES_V1.errosRelatados).map((e) => `${e.caminho}: ${e.mensagem}`);
  const resto = erros.length - listados.length;
  if (resto > 0) listados.push(`… e mais ${resto} ${resto === 1 ? 'erro' : 'erros'}`);
  return listados.join('\n');
}
