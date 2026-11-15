/**
 * Esquema do arquivo do catálogo acadêmico (Etapa 3 da especificação de atualização): os dados iniciais empacotados
 * (`catalogos/catalogo-inicial.json`) e o catálogo do usuário (`%LOCALAPPDATA%\BiblioDocsPro\catalogo.json`). Objetos
 * estritos: campo desconhecido é recusado. O tipo fica em `dominio/catalogo/tipos.ts`, como o do perfil em
 * `dominio/normas`; `tests/catalogo.test.ts` confere que os dois batem.
 */
import { z } from 'zod';
import { esquemaRegrasModelo } from './projeto-v1';

/** Id de registro do catálogo: minúsculas, algarismos e hífen ("uft-palmas-direito"). */
export const PADRAO_ID_CATALOGO = /^[a-z0-9][a-z0-9-]{0,99}$/;
const id = z.string().regex(PADRAO_ID_CATALOGO);
const texto = z.string().trim().min(1).max(300).regex(/^[^\u0000-\u001F\u007F]*$/);
const origem = z.enum(['oficial', 'usuario', 'importado']);
const fonte = z.strictObject({
  url: z.url({ protocol: /^https$/ }).max(500),
  consultadoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacao: texto.optional(),
});

/** Limites do catálogo (proteção contra arquivo editado à mão ou corrompido). */
export const LIMITES_CATALOGO = { instituicoes: 500, campi: 200, cursos: 500, disciplinas: 500, docentes: 1000, manuais: 50, perfis: 50, instrucoes: 100 } as const;

export const TIPOS_TRABALHO_UFT = ['monografia', 'artigo-tcc', 'dissertacao', 'tese', 'relatorio-tecnico', 'projeto-pesquisa'] as const;

const docente = z.strictObject({ id, nome: texto, titulacao: z.string().trim().min(1).max(40).optional(), origem, fonte: fonte.optional() });
const disciplina = z.strictObject({ id, nome: texto, origem, fonte: fonte.optional() });
const aplicaA = z.strictObject({ cursos: z.array(id).max(LIMITES_CATALOGO.cursos).optional(), tipos: z.array(z.enum(TIPOS_TRABALHO_UFT)).max(6).optional() });
/** Data de publicação: AAAA ou AAAA-MM-DD. */
const dataPublicacao = z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/);
const manual = z.strictObject({
  id,
  titulo: texto,
  url: z.url({ protocol: /^https$/ }).max(500).optional(),
  arquivo: texto.optional(),
  edicao: z.string().trim().min(1).max(60).optional(),
  data: dataPublicacao.optional(),
  aplicaA: aplicaA.optional(),
  origem,
  fonte: fonte.optional(),
});
const textoLongo = z.string().trim().min(1).max(2000).regex(/^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/);
const perfilInstitucional = z.strictObject({
  id,
  nome: texto,
  manual: id.optional(),
  secao: texto.optional(),
  regras: esquemaRegrasModelo,
  instrucoes: z.array(textoLongo).max(LIMITES_CATALOGO.instrucoes).optional(),
  aplicaA: aplicaA.optional(),
  revisado: z.boolean(),
  origem,
});
const curso = z.strictObject({
  id,
  nome: texto,
  nivel: z.enum(['graduacao', 'especializacao', 'mestrado', 'doutorado']),
  grau: z.enum(['bacharelado', 'licenciatura', 'tecnologia']).optional(),
  areaConcentracao: texto.optional(),
  disciplinas: z.array(disciplina).max(LIMITES_CATALOGO.disciplinas),
  docentes: z.array(docente).max(LIMITES_CATALOGO.docentes),
  origem,
  fonte: fonte.optional(),
});
const campus = z.strictObject({
  id,
  nome: texto,
  especie: z.enum(['campus', 'polo']),
  cidade: texto.optional(),
  uf: z.string().regex(/^[A-Z]{2}$/).optional(),
  cursos: z.array(curso).max(LIMITES_CATALOGO.cursos),
  origem,
  fonte: fonte.optional(),
});
const instituicao = z.strictObject({
  id,
  nome: texto,
  sigla: z.string().trim().min(1).max(20),
  perfis: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(20),
  logotipo: z
    .strictObject({
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      tipo: z.enum(['image/png', 'image/jpeg']),
      // Base64 da imagem, até 2 MB.
      dados: z.string().max(2_800_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
    })
    .optional(),
  campi: z.array(campus).max(LIMITES_CATALOGO.campi),
  manuais: z.array(manual).max(LIMITES_CATALOGO.manuais).optional(),
  perfisInstitucionais: z.array(perfilInstitucional).max(LIMITES_CATALOGO.perfis).optional(),
  origem,
  fonte: fonte.optional(),
});

export const esquemaCatalogo = z.strictObject({
  formato: z.literal('bibliodocs-catalogo'),
  versao: z.literal(1),
  instituicoes: z.array(instituicao).max(LIMITES_CATALOGO.instituicoes),
});

/** Arquivo do catálogo do usuário: o catálogo e os ids oficiais que ele retirou. */
export const esquemaCatalogoUsuario = z.strictObject({
  catalogo: esquemaCatalogo,
  removidos: z.array(id).max(10_000),
});

/** Peças reaproveitadas pelo esquema da ficha institucional. */
export const PECAS_CATALOGO = { id, texto, textoLongo, fonte, dataPublicacao } as const;

export type CatalogoValidado = z.infer<typeof esquemaCatalogo>;
export type CatalogoUsuarioValidado = z.infer<typeof esquemaCatalogoUsuario>;

/** Ids repetidos em qualquer nível tornam a escolha ambígua: recusados. */
function idRepetido(c: CatalogoValidado): string | null {
  const vistos = new Set<string>();
  for (const i of c.instituicoes) {
    for (const x of [i, ...(i.manuais ?? []), ...(i.perfisInstitucionais ?? []), ...i.campi, ...i.campi.flatMap((k) => k.cursos), ...i.campi.flatMap((k) => k.cursos.flatMap((u) => [...u.disciplinas, ...u.docentes]))]) {
      if (vistos.has(x.id)) return x.id;
      vistos.add(x.id);
    }
  }
  return null;
}

export type ResultadoCatalogo<T> = { ok: true; valor: T } | { ok: false; erro: string };

export function validarCatalogo(valor: unknown): ResultadoCatalogo<CatalogoValidado> {
  const r = esquemaCatalogo.safeParse(valor);
  if (!r.success) return { ok: false, erro: r.error.issues[0]?.message ?? 'catálogo inválido' };
  const repetido = idRepetido(r.data);
  return repetido === null ? { ok: true, valor: r.data } : { ok: false, erro: `id repetido no catálogo: ${repetido}` };
}

export function validarCatalogoUsuario(valor: unknown): ResultadoCatalogo<CatalogoUsuarioValidado> {
  const r = esquemaCatalogoUsuario.safeParse(valor);
  if (!r.success) return { ok: false, erro: r.error.issues[0]?.message ?? 'catálogo inválido' };
  const repetido = idRepetido(r.data.catalogo);
  return repetido === null ? { ok: true, valor: r.data } : { ok: false, erro: `id repetido no catálogo: ${repetido}` };
}
