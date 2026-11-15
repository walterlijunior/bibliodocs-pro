/**
 * Backup e restauração dos cadastros e configurações (Etapa 10 da especificação de atualização, D-E10-01). Puro.
 *
 * - `criarBackup`: o catálogo acadêmico de uso (com os ids oficiais retirados), a configuração da IA sem a chave e as
 *   preferências da interface, com o resumo do que há dentro e do que não há.
 * - `lerBackup`: confere formato, versão e conteúdo; arquivo inválido nunca chega a gravar nada.
 * - `previaRestauracao`: o que será restaurado e os conflitos com o catálogo atual (instituições com o mesmo id e
 *   dados diferentes).
 * - `catalogoRestaurado`: "substituir" põe o catálogo do backup no lugar; "acrescentar" mantém o atual e acrescenta só
 *   o que falta (instituições, campi e cursos).
 */
import { contarRegistros, mesclarCatalogo, type Catalogo } from '../../dominio/catalogo';
import { FORMATO_BACKUP, LIMITE_BYTES_BACKUP, NAO_INCLUIDO_NO_BACKUP, validarBackup, VERSAO_BACKUP, type Backup } from '../../dominio/esquemas';
import type { CatalogoUsuario } from '../portas/catalogo';
import type { ConfigIA } from '../portas/ia';

export type { Backup } from '../../dominio/esquemas';
export { LIMITE_BYTES_BACKUP, NAO_INCLUIDO_NO_BACKUP } from '../../dominio/esquemas';

export interface EntradaBackup {
  usuario: CatalogoUsuario | null;
  ia?: ConfigIA;
  preferencias?: Record<string, string>;
  appVersao: string;
  agora: Date;
}

export function resumoDoCatalogo(c: Catalogo | null | undefined): Backup['resumo'] {
  const r = { instituicoes: 0, campi: 0, cursos: 0, disciplinas: 0, docentes: 0, manuais: 0, perfis: 0, logotipos: 0 };
  for (const i of c?.instituicoes ?? []) {
    const n = contarRegistros(i);
    r.instituicoes++;
    r.campi += n.campi;
    r.cursos += n.cursos;
    r.disciplinas += n.disciplinas;
    r.docentes += n.docentes;
    r.manuais += n.manuais;
    r.perfis += n.perfis;
    if (i.logotipo) r.logotipos++;
  }
  return r;
}

/** Texto do arquivo de backup (JSON com recuo, para ser legível). */
export function criarBackup(e: EntradaBackup): string {
  const preferencias = Object.fromEntries(Object.entries(e.preferencias ?? {}).filter(([k, v]) => /^bibliodocs\.[A-Za-z0-9.]{1,60}$/.test(k) && v.length <= 200));
  const ia = e.ia ? { ativa: e.ia.ativa, provedor: e.ia.provedor, url: e.ia.url, modelo: e.ia.modelo, ...(e.ia.limiteTokensMes ? { limiteTokensMes: e.ia.limiteTokensMes } : {}) } : undefined;
  const backup: Backup = {
    formato: FORMATO_BACKUP,
    versao: VERSAO_BACKUP,
    criadoEm: e.agora.toISOString(),
    appVersao: e.appVersao,
    escopo: 'cadastros-e-configuracoes',
    naoInclui: [...NAO_INCLUIDO_NO_BACKUP],
    resumo: resumoDoCatalogo(e.usuario?.catalogo),
    conteudo: { catalogo: e.usuario, ...(ia ? { ia } : {}), ...(Object.keys(preferencias).length > 0 ? { preferencias } : {}) },
  };
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export type ResultadoLerBackup = { ok: true; backup: Backup } | { ok: false; mensagem: string };

export function lerBackup(texto: string): ResultadoLerBackup {
  if (texto.length > LIMITE_BYTES_BACKUP) return { ok: false, mensagem: 'O arquivo é grande demais para um backup do BiblioDocs Pro.' };
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, mensagem: 'O arquivo não é um backup do BiblioDocs Pro (não é JSON legível). Nada foi alterado.' };
  }
  if (typeof json === 'object' && json !== null && (json as { formato?: unknown }).formato !== FORMATO_BACKUP)
    return { ok: false, mensagem: 'O arquivo não é um backup do BiblioDocs Pro. Nada foi alterado.' };
  if (typeof json === 'object' && json !== null && (json as { versao?: unknown }).versao !== VERSAO_BACKUP)
    return { ok: false, mensagem: 'O backup é de uma versão de formato que este aplicativo não conhece. Atualize o aplicativo. Nada foi alterado.' };
  const v = validarBackup(json);
  if (!v.ok) return { ok: false, mensagem: `O backup está incompleto ou foi alterado (${v.erro}). Nada foi alterado.` };
  return { ok: true, backup: v.valor };
}

export interface PreviaRestauracao {
  resumo: Backup['resumo'];
  criadoEm: string;
  appVersao: string;
  /** Instituições que entram (não existem no catálogo atual). */
  novas: string[];
  /** Instituições iguais nos dois. */
  iguais: string[];
  /** Mesmo id, dados diferentes: o usuário escolhe substituir ou manter. */
  conflitos: string[];
  temIa: boolean;
  preferencias: number;
}

export function previaRestauracao(atual: Catalogo, b: Backup): PreviaRestauracao {
  const porId = new Map(atual.instituicoes.map((i) => [i.id, i]));
  const novas: string[] = [];
  const iguais: string[] = [];
  const conflitos: string[] = [];
  for (const i of b.conteudo.catalogo?.catalogo.instituicoes ?? []) {
    const x = porId.get(i.id);
    const nome = i.sigla ? `${i.nome} (${i.sigla})` : i.nome;
    if (!x) novas.push(nome);
    else if (JSON.stringify(x) === JSON.stringify(i)) iguais.push(nome);
    else conflitos.push(nome);
  }
  return {
    resumo: b.resumo,
    criadoEm: b.criadoEm,
    appVersao: b.appVersao,
    novas,
    iguais,
    conflitos,
    temIa: b.conteudo.ia !== undefined,
    preferencias: Object.keys(b.conteudo.preferencias ?? {}).length,
  };
}

/** Catálogo depois da restauração (o de uso: dados iniciais por baixo). */
export function catalogoRestaurado(inicial: Catalogo, atual: Catalogo, b: Backup, modo: 'substituir' | 'acrescentar'): Catalogo {
  const doBackup = mesclarCatalogo(inicial, (b.conteudo.catalogo?.catalogo as Catalogo | undefined) ?? null, b.conteudo.catalogo?.removidos ?? []);
  return modo === 'substituir' ? doBackup : mesclarCatalogo(doBackup, atual);
}
