/**
 * Canais `bibliodocs:catalogo:*` (Etapa 3 da especificação de atualização): ler e gravar o catálogo acadêmico do
 * usuário num arquivo fixo da pasta de dados local. Nenhum caminho vem do renderer; o que chega é validado pelo esquema
 * do catálogo antes de gravar. Gravações em fila (a segunda espera a primeira).
 */
import { CANAIS_CATALOGO, type CanalCatalogo, type ResultadoExportarFicha, type ResultadoGravarCatalogo, type ResultadoLerCatalogo } from '../../aplicacao/portas/catalogo';
import { LIMITE_BYTES_BACKUP, validarBackup, validarCatalogoUsuario, validarFicha } from '../../dominio/esquemas';
import { gravarCatalogoUsuario, lerCatalogoUsuario, SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../../persistencia';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { criarConferencia, type Manipulador } from './chamada';

export const MENSAGEM_CATALOGO_ILEGIVEL =
  'O catálogo acadêmico deste computador não pôde ser lido. A lista mostra só os dados iniciais; o arquivo não foi alterado.';
export const MENSAGEM_CATALOGO_NAO_GRAVADO = 'Não foi possível guardar o catálogo acadêmico. A alteração vale só até fechar o aplicativo.';

export const MENSAGEM_FICHA_NAO_GRAVADA = 'Não foi possível gravar a ficha nesse lugar. Escolha outra pasta (de preferência local) e tente de novo.';
/** Limite do texto da ficha (o logotipo em base64 cabe). */
export const LIMITE_TEXTO_FICHA = 8 * 1024 * 1024;

/** Nome de arquivo seguro para sugerir na janela de salvar. */
export function nomeSeguroFicha(nome: unknown): string | null {
  if (typeof nome !== 'string' || nome.length === 0 || nome.length > 120) return null;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.bdficha\.json$/.test(nome) ? nome : null;
}

export const MENSAGEM_BACKUP_NAO_GRAVADO = 'Não foi possível gravar o backup nesse lugar. Confira se a unidade (pendrive) está conectada e tem espaço, ou escolha outra pasta.';

/** Nome de arquivo seguro para sugerir na janela de salvar o backup. */
export function nomeSeguroBackup(nome: unknown): string | null {
  if (typeof nome !== 'string' || nome.length === 0 || nome.length > 120) return null;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.bdbackup\.json$/.test(nome) ? nome : null;
}

export interface DependenciasCatalogo {
  origem: OrigemPermitida;
  conteudosPermitidos: () => ReadonlySet<number>;
  /** `%LOCALAPPDATA%\BiblioDocsPro\catalogo.json`. */
  arquivo: string;
  fs?: SistemaArquivos;
  log?: (m: string) => void;
  /** Janela de salvar do sistema; `null` = cancelado. */
  escolherDestinoFicha?: (idConteudo: number, nomeSugerido: string) => Promise<string | null>;
  /** Etapa 10: janela de salvar do backup; `null` = cancelado. */
  escolherDestinoBackup?: (idConteudo: number, nomeSugerido: string) => Promise<string | null>;
  gravarArquivo?: (destino: string, bytes: Uint8Array) => Promise<{ ok: boolean }>;
}

export function criarManipuladoresCatalogo(dep: DependenciasCatalogo): Readonly<Record<CanalCatalogo, Manipulador>> {
  const log = dep.log ?? ((m: string) => console.warn(m));
  const fs = dep.fs ?? SISTEMA_ARQUIVOS_NODE;
  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, log);
  let fila: Promise<unknown> = Promise.resolve();
  const emFila = <T>(f: () => Promise<T>): Promise<T> => {
    const r = fila.then(f, f);
    fila = r.catch(() => undefined);
    return r;
  };

  const ler: Manipulador = async (r, argumentos): Promise<ResultadoLerCatalogo> => {
    conferir(CANAIS_CATALOGO.ler, r, argumentos, 0);
    return emFila(async () => {
      const { catalogo, descarte } = await lerCatalogoUsuario(dep.arquivo, fs);
      if (descarte !== null) {
        log(`[catalogo] catálogo do usuário descartado: ${descarte}`);
        return { ok: false, mensagem: MENSAGEM_CATALOGO_ILEGIVEL };
      }
      return { ok: true, usuario: catalogo };
    });
  };

  const gravar: Manipulador = async (r, argumentos): Promise<ResultadoGravarCatalogo> => {
    const canal = CANAIS_CATALOGO.gravar;
    conferir(canal, r, argumentos, 1);
    const v = validarCatalogoUsuario(argumentos[0]);
    if (!v.ok) return recusarArgumento(canal, `catálogo (${v.erro})`);
    return emFila(async () => {
      const g = await gravarCatalogoUsuario(dep.arquivo, v.valor, fs);
      if (!g.ok) {
        log(`[catalogo] gravação falhou: ${g.codigo}`);
        return { ok: false, mensagem: MENSAGEM_CATALOGO_NAO_GRAVADO };
      }
      return { ok: true };
    });
  };

  const exportarFicha: Manipulador = async (r, argumentos): Promise<ResultadoExportarFicha> => {
    const canal = CANAIS_CATALOGO.exportarFicha;
    conferir(canal, r, argumentos, 2);
    const [texto, nome] = argumentos;
    const nomeSeguro = nomeSeguroFicha(nome);
    if (typeof texto !== 'string' || texto.length > LIMITE_TEXTO_FICHA || nomeSeguro === null) return recusarArgumento(canal, 'ficha');
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      return recusarArgumento(canal, 'ficha (JSON)');
    }
    const v = validarFicha(json);
    if (!v.ok) return recusarArgumento(canal, `ficha (${v.erro})`);
    if (!dep.escolherDestinoFicha || !dep.gravarArquivo) return { ok: false, cancelado: false, mensagem: MENSAGEM_FICHA_NAO_GRAVADA };
    const destino = await dep.escolherDestinoFicha(r.idConteudo, nomeSeguro);
    if (destino === null) return { ok: false, cancelado: true };
    const g = await dep.gravarArquivo(destino, new TextEncoder().encode(texto)).catch(() => ({ ok: false }));
    if (!g.ok) {
      log('[catalogo] gravação da ficha falhou');
      return { ok: false, cancelado: false, mensagem: MENSAGEM_FICHA_NAO_GRAVADA };
    }
    return { ok: true, nome: destino.split(/[\/]/).pop() ?? nomeSeguro };
  };

  const exportarBackup: Manipulador = async (r, argumentos): Promise<ResultadoExportarFicha> => {
    const canal = CANAIS_CATALOGO.exportarBackup;
    conferir(canal, r, argumentos, 2);
    const [texto, nome] = argumentos;
    const nomeSeguro = nomeSeguroBackup(nome);
    if (typeof texto !== 'string' || texto.length > LIMITE_BYTES_BACKUP || nomeSeguro === null) return recusarArgumento(canal, 'backup');
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      return recusarArgumento(canal, 'backup (JSON)');
    }
    const v = validarBackup(json);
    if (!v.ok) return recusarArgumento(canal, `backup (${v.erro})`);
    if (!dep.escolherDestinoBackup || !dep.gravarArquivo) return { ok: false, cancelado: false, mensagem: MENSAGEM_BACKUP_NAO_GRAVADO };
    const destino = await dep.escolherDestinoBackup(r.idConteudo, nomeSeguro);
    if (destino === null) return { ok: false, cancelado: true };
    const g = await dep.gravarArquivo(destino, new TextEncoder().encode(texto)).catch(() => ({ ok: false }));
    if (!g.ok) {
      log('[catalogo] gravação do backup falhou');
      return { ok: false, cancelado: false, mensagem: MENSAGEM_BACKUP_NAO_GRAVADO };
    }
    return { ok: true, nome: destino.split(/[\\/]/).pop() ?? nomeSeguro };
  };

  return {
    [CANAIS_CATALOGO.ler]: ler,
    [CANAIS_CATALOGO.gravar]: gravar,
    [CANAIS_CATALOGO.exportarFicha]: exportarFicha,
    [CANAIS_CATALOGO.exportarBackup]: exportarBackup,
  } as Record<CanalCatalogo, Manipulador>;
}
