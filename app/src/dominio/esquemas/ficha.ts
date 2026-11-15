/**
 * Esquema do arquivo da ficha institucional (`.bdficha.json`, Etapa 3 da especificação de atualização): o que alguém
 * preencheu e exportou para outra pessoa importar. O arquivo vem de fora, então tudo é conferido: objetos estritos,
 * limites de tamanho, chaves únicas em cada lista. Ligações para chaves que não existem não são recusadas aqui: viram
 * pendências na prévia da importação (`dominio/catalogo/ficha.ts`). O tipo fica em `dominio/catalogo/ficha.ts`;
 * `tests/ficha-institucional.test.ts` confere que os dois batem.
 */
import { z } from 'zod';
import { LIMITES_CATALOGO, PECAS_CATALOGO, TIPOS_TRABALHO_UFT } from './catalogo';
import { esquemaRegrasModelo } from './projeto-v1';

const { id: chave, texto, textoLongo, fonte, dataPublicacao } = PECAS_CATALOGO;
const chaves = (max: number) => z.array(chave).max(max);

const logotipo = z.strictObject({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  tipo: z.enum(['image/png', 'image/jpeg']),
  dados: z.string().max(2_800_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

const campus = z.strictObject({
  chave,
  nome: texto,
  especie: z.enum(['campus', 'polo']),
  cidade: texto.optional(),
  uf: z.string().regex(/^[A-Z]{2}$/).optional(),
  desconhecidos: z.array(z.enum(['cidade', 'uf'])).max(2).optional(),
  fonte: fonte.optional(),
});
const curso = z.strictObject({
  chave,
  nome: texto,
  nivel: z.enum(['graduacao', 'especializacao', 'mestrado', 'doutorado']),
  grau: z.enum(['bacharelado', 'licenciatura', 'tecnologia']).optional(),
  areaConcentracao: texto.optional(),
  campi: chaves(LIMITES_CATALOGO.campi),
  desconhecidos: z.array(z.enum(['grau', 'areaConcentracao'])).max(2).optional(),
  fonte: fonte.optional(),
});
const disciplina = z.strictObject({ chave, nome: texto, cursos: chaves(LIMITES_CATALOGO.cursos), fonte: fonte.optional() });
const docente = z.strictObject({
  chave,
  nome: texto,
  titulacao: z.string().trim().min(1).max(40).optional(),
  cursos: chaves(LIMITES_CATALOGO.cursos),
  desconhecidos: z.array(z.literal('titulacao')).max(1).optional(),
  fonte: fonte.optional(),
});
const tipos = z.array(z.enum(TIPOS_TRABALHO_UFT)).max(6);
const manual = z.strictObject({
  chave,
  titulo: texto,
  url: z.url({ protocol: /^https$/ }).max(500).optional(),
  arquivo: texto.optional(),
  edicao: z.string().trim().min(1).max(60).optional(),
  data: dataPublicacao.optional(),
  cursos: chaves(LIMITES_CATALOGO.cursos).optional(),
  tipos: tipos.optional(),
  desconhecidos: z.array(z.enum(['edicao', 'data'])).max(2).optional(),
  fonte: fonte.optional(),
});
const perfil = z.strictObject({
  chave,
  nome: texto,
  manual: chave.optional(),
  secao: texto.optional(),
  regras: esquemaRegrasModelo,
  instrucoes: z.array(textoLongo).max(LIMITES_CATALOGO.instrucoes).optional(),
  cursos: chaves(LIMITES_CATALOGO.cursos).optional(),
  tipos: tipos.optional(),
});

export const esquemaFicha = z.strictObject({
  formato: z.literal('bibliodocs-ficha-institucional'),
  versao: z.literal(1),
  preenchidaEm: z.iso.datetime().optional(),
  instituicao: z.strictObject({
    nome: texto,
    sigla: z.string().trim().min(1).max(20),
    logotipo: logotipo.optional(),
    desconhecidos: z.array(z.literal('logotipo')).max(1).optional(),
  }),
  fontes: z.strictObject({
    instituicao: fonte.optional(),
    campi: fonte.optional(),
    cursos: fonte.optional(),
    disciplinas: fonte.optional(),
    docentes: fonte.optional(),
    manuais: fonte.optional(),
  }),
  campi: z.array(campus).max(LIMITES_CATALOGO.campi),
  cursos: z.array(curso).max(LIMITES_CATALOGO.cursos),
  disciplinas: z.array(disciplina).max(LIMITES_CATALOGO.disciplinas),
  docentes: z.array(docente).max(LIMITES_CATALOGO.docentes),
  manuais: z.array(manual).max(LIMITES_CATALOGO.manuais),
  perfis: z.array(perfil).max(LIMITES_CATALOGO.perfis),
});

export type FichaValidada = z.infer<typeof esquemaFicha>;

const NOMES_LISTA = { campi: 'câmpus', cursos: 'curso', disciplinas: 'disciplina', docentes: 'docente', manuais: 'manual', perfis: 'perfil' } as const;

/** Valida a ficha; a mensagem de erro diz onde está o problema, para quem preencheu corrigir. */
export function validarFicha(valor: unknown): { ok: true; valor: FichaValidada } | { ok: false; erro: string } {
  const r = esquemaFicha.safeParse(valor);
  if (!r.success) {
    const q = r.error.issues[0];
    const onde = q?.path.length ? ` (em ${q.path.join(' › ')})` : '';
    return { ok: false, erro: `${q?.message ?? 'ficha inválida'}${onde}` };
  }
  for (const lista of Object.keys(NOMES_LISTA) as (keyof typeof NOMES_LISTA)[]) {
    const vistas = new Set<string>();
    for (const x of r.data[lista]) {
      if (vistas.has(x.chave)) return { ok: false, erro: `chave repetida na lista de ${NOMES_LISTA[lista]}: ${x.chave}` };
      vistas.add(x.chave);
    }
  }
  return { ok: true, valor: r.data };
}
