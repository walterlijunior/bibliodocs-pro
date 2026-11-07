/**
 * Validação dos JSON do pacote `.bdp` com mensagens em pt-BR (M1-T04; ADR-0004, seções 2 e 3).
 * Ordem: aninhamento JSON (iterativo, antes do zod, contra estouro de pilha) → esquema estrito →
 * profundidade da árvore de seções → elementos pré e pós-textuais → ids únicos.
 */
import { z } from 'zod';
import { problemaNosElementos, type Bloco, type Documento, type Inline, type Obra, type Secao } from '../modelo';
import { LIMITES_V1 } from './limites';
import { esquemaDocumentoV1, esquemaManifestoV1, esquemaObra, type Manifesto } from './projeto-v1';

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
      return [];
  }
}

const MENSAGENS_ELEMENTOS = {
  tipoSemElementos: 'o tipo de trabalho genérico não tem elementos pré nem pós-textuais',
  foraDeOrdem: 'elemento fora da ordem do Quadro 5 do Manual UFT',
  repetido: 'elemento repetido (só apêndice e anexo podem aparecer mais de uma vez)',
  repeticoesDemais: 'apêndices ou anexos demais',
} as const;

/** Seções, blocos e trechos do corpo em ordem de leitura, com o caminho de cada um, sem recursão. */
function* percorrerCorpo(corpo: readonly Secao[]): Generator<
  { tipo: 'secao'; id: string; caminho: PropertyKey[] } | { tipo: 'bloco'; id: string; caminho: PropertyKey[] } | { tipo: 'inline'; inline: Inline; caminho: PropertyKey[] }
> {
  const pilha: { s: Secao; caminho: PropertyKey[] }[] = corpo.map((s, i) => ({ s, caminho: ['corpo', i] })).reverse();
  while (pilha.length > 0) {
    const { s, caminho } = pilha.pop()!;
    yield { tipo: 'secao', id: s.id, caminho };
    for (const [i, b] of s.blocos.entries()) {
      yield { tipo: 'bloco', id: b.id, caminho: [...caminho, 'blocos', i] };
      for (const c of conteudosComCaminho(b)) {
        for (const [k, inline] of c.conteudo.entries()) yield { tipo: 'inline', inline, caminho: [...caminho, 'blocos', i, ...c.caminho, k] };
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
  return r;
}

/** Uma obra sozinha (M4-T06): o cadastro só grava a obra que o documento aceitaria. Caminhos a partir de `obra`. */
export function validarObraV1(json: unknown): ResultadoValidacao<Obra> {
  return validarComEsquema('obra', esquemaObra as z.ZodType<Obra>, json);
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
