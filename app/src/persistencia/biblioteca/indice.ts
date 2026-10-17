/**
 * Índice da biblioteca (`%LOCALAPPDATA%\BiblioDocsPro\biblioteca.json`) e preferências do app
 * (`%LOCALAPPDATA%\BiblioDocsPro\preferencias.json`) — M1-T09; ADR-0004, seção 5.
 *
 * O índice é **cache**: guarda o resumo de cada `.bdp` (título, tipo, datas) junto do tamanho e da data de
 * modificação do arquivo. Ausente, corrompido, de outra pasta ou de outro formato → começa vazio e é recriado na
 * próxima varredura, sem aviso ao usuário. O arquivo do projeto é sempre a fonte da verdade.
 *
 * As preferências não são cache (perder a pasta escolhida muda o que o usuário vê), por isso ficam em arquivo próprio:
 * apagar o índice não as afeta. Inválidas → valores padrão, com registro técnico.
 */
import { dirname, isAbsolute } from 'node:path';
import { z } from 'zod';
import { PADRAO_ID } from '../../dominio/esquemas';
import { LIMITES_CONTEINER } from '../conteiner/limites';
import { gravarAtomico, type OpcoesGravacao, type ResultadoGravacao } from '../arquivo/gravacao-atomica';
import { lerArquivoLimitado } from '../arquivo/projeto-em-disco';
import { SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../arquivo/sistema-arquivos';

export const FORMATO_INDICE = 'bibliodocs-biblioteca';
export const FORMATO_PREFERENCIAS = 'bibliodocs-preferencias';

/** Arquivos `.bdp` considerados numa pasta; acima disso a lista é cortada, com aviso. */
export const LIMITE_ITENS_BIBLIOTECA = 5_000;
/** Título guardado no índice e enviado à interface (caracteres UTF-16). */
export const MAX_TITULO_INDICE = 500;
/** Teto de leitura do índice e das preferências: o índice cheio (5 000 entradas) fica bem abaixo. */
const BYTES_MAX_ARQUIVO_LOCAL = 16 * 1024 * 1024;
const MAX_CAMINHO = 32_767;

const textoCurto = z.string().max(64);

export const esquemaResumoProjeto = z.discriminatedUnion('estado', [
  z.strictObject({
    estado: z.literal('ok'),
    id: z.string().regex(PADRAO_ID),
    titulo: z.string().max(MAX_TITULO_INDICE),
    tipoTrabalho: textoCurto,
    criadoEm: textoCurto,
    atualizadoEm: textoCurto,
  }),
  z.strictObject({ estado: z.literal('versaoFutura'), versaoFormato: z.int().min(0) }),
  z.strictObject({ estado: z.literal('invalido') }),
]);

/** O que a biblioteca sabe de um `.bdp` sem abri-lo para edição. */
export type ResumoProjeto = z.infer<typeof esquemaResumoProjeto>;

const esquemaEntrada = z.strictObject({
  nomeArquivo: z.string().min(1).max(255),
  bytes: z.int().min(0),
  modificadoEmMs: z.number().min(0),
  resumo: esquemaResumoProjeto,
});

export type EntradaIndice = z.infer<typeof esquemaEntrada>;

const esquemaIndice = z.strictObject({
  formato: z.literal(FORMATO_INDICE),
  versao: z.literal(1),
  /** Caminho da pasta indexada; índice de outra pasta é descartado. */
  pasta: z.string().max(MAX_CAMINHO),
  entradas: z.array(esquemaEntrada).max(LIMITE_ITENS_BIBLIOTECA),
});

export type IndiceBiblioteca = z.infer<typeof esquemaIndice>;

const esquemaPreferencias = z.strictObject({
  formato: z.literal(FORMATO_PREFERENCIAS),
  versao: z.literal(1),
  /** Pasta escolhida pelo usuário, ou `null` para a padrão. */
  pastaBiblioteca: z
    .string()
    .min(1)
    .max(MAX_CAMINHO)
    .refine((c) => isAbsolute(c) && !c.includes('\0'))
    .nullable(),
});

export type Preferencias = z.infer<typeof esquemaPreferencias>;

export const indiceVazio = (pasta: string): IndiceBiblioteca => ({ formato: FORMATO_INDICE, versao: 1, pasta, entradas: [] });

export const PREFERENCIAS_PADRAO: Preferencias = { formato: FORMATO_PREFERENCIAS, versao: 1, pastaBiblioteca: null };

/** Por que um arquivo local não foi aproveitado (só para o registro técnico). */
export type MotivoDescarte = 'ausente' | 'ilegivel' | 'invalido' | 'outraPasta' | null;

async function lerJsonLocal(caminho: string, fs: SistemaArquivos): Promise<{ valor: unknown; motivo: MotivoDescarte }> {
  const lido = await lerArquivoLimitado(caminho, fs, { ...LIMITES_CONTEINER, bytesArquivo: BYTES_MAX_ARQUIVO_LOCAL });
  if (!lido.ok) return { valor: undefined, motivo: lido.codigo === 'ENOENT' ? 'ausente' : 'ilegivel' };
  try {
    return { valor: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(lido.bytes)) as unknown, motivo: null };
  } catch {
    return { valor: undefined, motivo: 'invalido' };
  }
}

/** Lê o índice da pasta; qualquer problema devolve o índice vazio e o motivo. Nunca lança. */
export async function lerIndice(
  arquivo: string,
  pasta: string,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
): Promise<{ indice: IndiceBiblioteca; descarte: MotivoDescarte }> {
  const { valor, motivo } = await lerJsonLocal(arquivo, fs);
  if (motivo) return { indice: indiceVazio(pasta), descarte: motivo };
  const r = esquemaIndice.safeParse(valor);
  if (!r.success) return { indice: indiceVazio(pasta), descarte: 'invalido' };
  if (r.data.pasta !== pasta) return { indice: indiceVazio(pasta), descarte: 'outraPasta' };
  // Nome repetido só aparece em índice editado à mão: fica a primeira entrada.
  const vistos = new Set<string>();
  const entradas = r.data.entradas.filter((e) => !vistos.has(e.nomeArquivo) && vistos.add(e.nomeArquivo));
  return { indice: { ...r.data, entradas }, descarte: null };
}

async function gravarJsonLocal(arquivo: string, valor: unknown, fs: SistemaArquivos, opcoes: Omit<OpcoesGravacao, 'fs'>) {
  try {
    await fs.criarPasta(dirname(arquivo));
  } catch {
    // O gravarAtomico devolve PASTA_INEXISTENTE.
  }
  return gravarAtomico(arquivo, new TextEncoder().encode(`${JSON.stringify(valor)}\n`), { ...opcoes, fs });
}

/** Grava o índice pelo salvamento atômico (cria a pasta de dados se faltar). */
export function gravarIndice(
  arquivo: string,
  indice: IndiceBiblioteca,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
  opcoes: Omit<OpcoesGravacao, 'fs'> = {},
): Promise<ResultadoGravacao> {
  return gravarJsonLocal(arquivo, indice, fs, opcoes);
}

/** Lê as preferências; ausentes ou inválidas → padrão e o motivo. Nunca lança. */
export async function lerPreferencias(
  arquivo: string,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
): Promise<{ preferencias: Preferencias; descarte: MotivoDescarte }> {
  const { valor, motivo } = await lerJsonLocal(arquivo, fs);
  if (motivo) return { preferencias: PREFERENCIAS_PADRAO, descarte: motivo };
  const r = esquemaPreferencias.safeParse(valor);
  return r.success ? { preferencias: r.data, descarte: null } : { preferencias: PREFERENCIAS_PADRAO, descarte: 'invalido' };
}

export function gravarPreferencias(
  arquivo: string,
  preferencias: Preferencias,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
  opcoes: Omit<OpcoesGravacao, 'fs'> = {},
): Promise<ResultadoGravacao> {
  return gravarJsonLocal(arquivo, preferencias, fs, opcoes);
}
