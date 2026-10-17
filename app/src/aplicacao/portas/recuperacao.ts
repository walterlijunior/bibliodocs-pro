/**
 * Porta `recuperacao` — contrato da API `window.bibliodocs.recuperacao.*` (M1-T12; ADR-0004, seção 4, "Salvamento
 * automático e recuperação").
 *
 * - `instantaneo`: cerca de 2 s depois de uma alteração, o renderer manda o pacote do trabalho aberto; o principal o
 *   grava em `%LOCALAPPDATA%\BiblioDocsPro\recuperacao\<id>\`, nunca no arquivo do usuário;
 * - `listar`: o que há para recuperar (trabalho aberto quando o app foi fechado inesperadamente; temporário de uma
 *   gravação interrompida; `.bak` íntegro de um arquivo que não abre);
 * - `recuperar` e `abrirSalvo`: as escolhas do aviso. "Decidir depois" não chama nada: a oferta volta na próxima
 *   listagem.
 *
 * Mesmas regras das outras portas: nada de caminhos no renderer (cada oferta tem um `IdentificadorOferta` opaco, que
 * vale só para a janela que listou); nenhuma função lança por erro esperado.
 */
import type { IdentificadorProjeto, PacoteEnvio, ProjetoAberto, ResultadoAbrir } from './projetos';

export const CANAIS_RECUPERACAO = {
  instantaneo: 'bibliodocs:recuperacao:instantaneo',
  listar: 'bibliodocs:recuperacao:listar',
  recuperar: 'bibliodocs:recuperacao:recuperar',
  abrirSalvo: 'bibliodocs:recuperacao:abrir-salvo',
} as const;

export type CanalRecuperacao = (typeof CANAIS_RECUPERACAO)[keyof typeof CANAIS_RECUPERACAO];

/** Identificador opaco de uma oferta de recuperação (22 caracteres base64url). */
export type IdentificadorOferta = string;

/**
 * - `instantaneo`: o app foi fechado com o trabalho aberto e alterações que não chegaram ao arquivo;
 * - `temporario`: o arquivo falta ou não abre, e há uma cópia completa de uma gravação interrompida;
 * - `bak`: o arquivo não abre, e a cópia de segurança (`.bak`) está íntegra.
 */
export type TipoOferta = 'instantaneo' | 'temporario' | 'bak';

export interface OfertaRecuperacao {
  identificador: IdentificadorOferta;
  tipo: TipoOferta;
  /** Nome do arquivo do usuário (só o nome). */
  nomeArquivo: string;
  /** Título da versão recuperável, em texto plano (pode ser vazio). */
  titulo: string;
  /** Quando a versão recuperável foi gravada (ms desde 1970). */
  quando: number;
  /** O arquivo do usuário ainda existe (oferece "Abrir o arquivo salvo"). */
  arquivoSalvoExiste: boolean;
}

/** `MIDIA_AUSENTE`: o principal não tem uma mídia referida; reenviar com os bytes (M2-T01). */
export type ResultadoInstantaneo = { ok: true } | { ok: false; codigo: 'NAO_ABERTO' | 'PACOTE_INVALIDO' | 'FALHA_DISCO' | 'MIDIA_AUSENTE' };

export interface ResultadoListarRecuperacao {
  ofertas: OfertaRecuperacao[];
}

export type ResultadoRecuperar =
  | {
      ok: true;
      projeto: ProjetoAberto;
      /** Quando a versão recuperada foi gravada (ms desde 1970). */
      quando: number;
      /** `instantaneo`: o conteúdo ainda não está no arquivo do usuário; `temporario`/`bak`: já foi restaurado nele. */
      tipo: TipoOferta;
    }
  | { ok: false; mensagem: string };

export interface ApiRecuperacao {
  /** Grava o instantâneo de recuperação do trabalho aberto em `identificador`. */
  instantaneo(identificador: IdentificadorProjeto, pacote: PacoteEnvio): Promise<ResultadoInstantaneo>;
  listar(): Promise<ResultadoListarRecuperacao>;
  /** Abre a versão recuperável (instantâneo) ou restaura a cópia no arquivo do usuário e a abre (temporário, `.bak`). */
  recuperar(oferta: IdentificadorOferta): Promise<ResultadoRecuperar>;
  /** Só para `instantaneo`: guarda o instantâneo em `recuperacao-antigos` (7 dias) e abre o arquivo do usuário. */
  abrirSalvo(oferta: IdentificadorOferta): Promise<ResultadoAbrir>;
}
