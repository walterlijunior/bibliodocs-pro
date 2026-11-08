/**
 * Esquema do perfil normativo (M3-T02; ADR-0005, seção 3). Objetos estritos: campo desconhecido é recusado. O tipo fica
 * em `dominio/normas/perfil.ts`, porque `normas` não importa `esquemas`; `tests/perfil.test.ts` confere que os dois batem.
 */
import { z } from 'zod';

const ID_RN = z.string().regex(/^RN-\d{3}$/);
const medida = z.number().positive().max(1000);

const propriedades = z.strictObject({
  larguraMm: medida.optional(),
  alturaMm: medida.optional(),
  margemSuperiorCm: medida.optional(),
  margemInferiorCm: medida.optional(),
  margemEsquerdaCm: medida.optional(),
  margemDireitaCm: medida.optional(),
  corpoPt: medida.optional(),
  entrelinha: z.enum(['simples', '1,5']).optional(),
  alinhamento: z.enum(['esquerda', 'direita', 'centralizado', 'justificado']).optional(),
  recuoPrimeiraLinhaCm: medida.optional(),
  recuoEsquerdaCm: medida.optional(),
  negrito: z.boolean().optional(),
  italico: z.boolean().optional(),
  sublinhado: z.boolean().optional(),
  maiusculas: z.boolean().optional(),
  quebraPaginaAntes: z.boolean().optional(),
  manterComProximo: z.boolean().optional(),
});

const parametro = z.strictObject({
  valor: z.unknown(),
  opcoes: z.array(z.unknown()).max(50).optional(),
  ajustavel: z.boolean(),
  rn: z.array(ID_RN).min(1).max(20),
  origem: z.string().regex(/^(norma|provisorio|decisao-usuario-\d{4}-\d{2}-\d{2})$/),
});

const regra = z
  .strictObject({
    id: ID_RN,
    status: z.enum(['CONFIRMADA', 'IMPLEMENTADA', 'AMBIGUA', 'PENDENTE-FONTE']),
    fonte: z.string().min(1).max(300),
    tipo: z.enum(['estilo', 'estrutura', 'procedimento', 'verificacao']),
    alvo: z.enum([
      'documento',
      'pagina',
      'corpo.paragrafo',
      'citacao.longa',
      'titulo',
      'titulo.nivel1',
      'titulo.nivel2',
      'titulo.nivel3',
      'titulo.nivel4',
      'titulo.nivel5',
      'titulo.semIndicativo',
      'nota.texto',
      'nota.numeracao',
      'nota.filete',
      'alinea',
      'subalinea',
      'capa',
      'capa.instituicao',
      'capa.autoria',
      'capa.titulo',
      'capa.localAno',
      'folhaRosto',
      'folhaRosto.autoria',
      'folhaRosto.titulo',
      'folhaRosto.localAno',
      'fichaCatalografica',
      'folhaAprovacao.identificacao',
      'folhaAprovacao.natureza',
      'folhaAprovacao.data',
      'folhaAprovacao.banca',
      'preTextual.dedicatoria',
      'sumario.entrada',
      'posTextual.identificacao',
      'folhaRosto.natureza',
      'preTextual.agradecimentos',
      'preTextual.resumo',
      'posTextual.apendice',
      'posTextual.anexo',
      'referencia',
      'citacao.chamada',
      'paginacao',
      'paginacao.numero',
      'elemento',
      'elemento.titulo',
      'elemento.rodape',
      'tabela.celula',
      'tabela.moldura',
      'tabela.cabecalho',
      'quadro.moldura',
    ]),
    propriedades: propriedades.optional(),
    procedimento: z.string().regex(/^[a-z][A-Za-z]{0,63}$/).optional(),
    parametros: z.array(z.string().min(1).max(64)).max(20).optional(),
    provisoria: z.literal(true).optional(),
  })
  .refine((r) => (r.tipo === 'procedimento' || r.tipo === 'verificacao' ? r.procedimento !== undefined : true), {
    message: 'regra de procedimento ou verificação precisa do nome da função',
  })
  .refine((r) => r.status !== 'PENDENTE-FONTE' || r.provisoria === true, {
    message: 'regra PENDENTE-FONTE só entra no perfil como provisória, com decisão do usuário',
  });

const presenca = z.strictObject({
  presenca: z.enum(['obrigatorio', 'condicional', 'opcional', 'sugerido', 'naoDefinido']),
  rn: z.array(ID_RN).max(20),
  fonte: z.string().min(1).max(300),
});

interface SecaoInicial {
  titulo: string;
  subsecoes?: SecaoInicial[] | undefined;
}
const secaoInicial: z.ZodType<SecaoInicial> = z.lazy(() =>
  z.strictObject({ titulo: z.string().min(1).max(200), subsecoes: z.array(secaoInicial).max(50).optional() }),
);

const tipoTrabalho = z.strictObject({
  preTextuais: z.record(z.string(), presenca),
  textuais: z.array(
    z.strictObject({
      ...presenca.shape,
      elemento: z.enum(['introducao', 'desenvolvimento', 'conclusao']),
      secoes: z.array(secaoInicial).max(50),
    }),
  ),
  posTextuais: z.record(z.string(), presenca),
});

export const esquemaPerfil = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    versao: z.string().regex(/^\d+\.\d+\.\d+$/),
    nome: z.string().min(1).max(100),
    fontes: z.array(z.strictObject({ id: z.string().min(1).max(8), citacao: z.string().min(1).max(500), arquivo: z.string().min(1).max(300) })).min(1),
    parametros: z.record(z.string(), parametro),
    regras: z.array(regra).min(1).max(1000),
    tiposTrabalho: z.record(z.string(), tipoTrabalho),
  })
  .refine((p) => p.regras.every((r) => (r.parametros ?? []).every((c) => c in p.parametros)), {
    message: 'regra cita parâmetro que o perfil não define',
  });

export function validarPerfil(dados: unknown): { ok: true } | { ok: false; erros: string[] } {
  const r = esquemaPerfil.safeParse(dados);
  return r.success ? { ok: true } : { ok: false, erros: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
