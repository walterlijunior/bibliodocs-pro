/**
 * Validação dos JSON do pacote `.bdp` com mensagens em pt-BR (M1-T04; ADR-0004, seções 2 e 3).
 * Ordem: aninhamento JSON (iterativo, antes do zod, contra estouro de pilha) → esquema estrito →
 * profundidade da árvore de seções → ids únicos.
 */
import { z } from 'zod';
import type { Documento, Secao } from '../modelo';
import { LIMITES_V1 } from './limites';
import { esquemaDocumentoV1, esquemaManifestoV1, type Manifesto } from './projeto-v1';

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

/** Primeiro id de seção ou bloco repetido no documento, sem recursão. */
function idRepetido(corpo: Secao[]): readonly PropertyKey[] | null {
  const vistos = new Set<string>();
  const pilha: { s: Secao; caminho: PropertyKey[] }[] = corpo.map((s, i) => ({ s, caminho: ['corpo', i] })).reverse();
  while (pilha.length > 0) {
    const { s, caminho } = pilha.pop()!;
    if (vistos.has(s.id)) return [...caminho, 'id'];
    vistos.add(s.id);
    for (const [i, b] of s.blocos.entries()) {
      if (vistos.has(b.id)) return [...caminho, 'blocos', i, 'id'];
      vistos.add(b.id);
    }
    for (let i = s.subsecoes.length - 1; i >= 0; i--) pilha.push({ s: s.subsecoes[i]!, caminho: [...caminho, 'subsecoes', i] });
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
  const repetido = idRepetido(r.valor.corpo);
  if (repetido) {
    return { ok: false, erros: [{ caminho: formatarCaminho('documento', repetido), mensagem: 'identificador repetido no documento' }] };
  }
  return r;
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
