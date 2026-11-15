/**
 * Arquivo de backup dos cadastros e configurações (Etapa 10 da especificação de atualização, D-E10-01). JSON com
 * formato e versão, data, o que contém e o que não contém. Contém: o catálogo acadêmico do usuário (instituições,
 * logotipos, campi, cursos, disciplinas, docentes, vínculos, manuais e perfis) e os ids oficiais que ele retirou, a
 * configuração da IA **sem a chave** e as preferências da interface. Não contém trabalhos, referências dos trabalhos,
 * anexos nem chaves de API (a chave é configurada de novo na instalação restaurada).
 */
import { z } from 'zod';
import { esquemaCatalogoUsuario } from './catalogo';

export const FORMATO_BACKUP = 'bibliodocs-backup';
export const VERSAO_BACKUP = 1;
/** Limite do arquivo (logotipos em base64 cabem). */
export const LIMITE_BYTES_BACKUP = 32 * 1024 * 1024;

export const NAO_INCLUIDO_NO_BACKUP = ['trabalhos (.bdp)', 'referências e anexos dos trabalhos', 'chave de API da IA'] as const;

const configIa = z.strictObject({
  ativa: z.boolean(),
  provedor: z.string().min(1).max(40),
  url: z.string().max(500),
  modelo: z.string().max(200),
  limiteTokensMes: z.int().min(1).max(1_000_000_000).optional(),
});

export const esquemaBackup = z.strictObject({
  formato: z.literal(FORMATO_BACKUP),
  versao: z.literal(VERSAO_BACKUP),
  criadoEm: z.iso.datetime({ offset: true }),
  appVersao: z.string().max(40),
  escopo: z.literal('cadastros-e-configuracoes'),
  naoInclui: z.array(z.string().max(100)).max(20),
  resumo: z.strictObject({
    instituicoes: z.int().min(0),
    campi: z.int().min(0),
    cursos: z.int().min(0),
    disciplinas: z.int().min(0),
    docentes: z.int().min(0),
    manuais: z.int().min(0),
    perfis: z.int().min(0),
    logotipos: z.int().min(0),
  }),
  conteudo: z.strictObject({
    catalogo: esquemaCatalogoUsuario.nullable(),
    ia: configIa.optional(),
    preferencias: z.record(z.string().regex(/^bibliodocs\.[A-Za-z0-9.]{1,60}$/), z.string().max(200)).optional(),
  }),
});

export type Backup = z.infer<typeof esquemaBackup>;

export function validarBackup(valor: unknown): { ok: true; valor: Backup } | { ok: false; erro: string } {
  const r = esquemaBackup.safeParse(valor);
  if (r.success) return { ok: true, valor: r.data };
  const p = r.error.issues[0];
  return { ok: false, erro: p ? `${p.path.join('.') || 'arquivo'}: ${p.message}` : 'arquivo inválido' };
}
