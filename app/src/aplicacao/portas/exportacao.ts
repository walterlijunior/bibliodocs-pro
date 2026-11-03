/**
 * Porta `exportacao`: contrato da API `window.bibliodocs.exportacao.*` (M3-T08; RF-06). O destino vem sempre do diálogo
 * do principal: nenhum caminho passa pelo renderer. A forma do documento sai do motor, no principal.
 */
import type { PacoteTransferivel } from './projetos';

export const CANAIS_EXPORTACAO = {
  docx: 'bibliodocs:exportacao:docx',
} as const;

export type CanalExportacao = (typeof CANAIS_EXPORTACAO)[keyof typeof CANAIS_EXPORTACAO];

export interface OpcoesExportacao {
  /** Fonte escolhida para este arquivo; fora das opções do perfil, vale a padrão. */
  fonte?: string;
}

export type ResultadoExportar =
  | {
      ok: true;
      /** Só o nome, sem a pasta. */
      nomeArquivo: string;
      /** O que o autor precisa saber: elemento sem conteúdo, forma sem fonte. */
      avisos: string[];
    }
  | { ok: false; motivo: 'CANCELADO' }
  | { ok: false; motivo: 'ERRO'; mensagem: string };

export interface ApiExportacao {
  docx(pacote: PacoteTransferivel, opcoes: OpcoesExportacao): Promise<ResultadoExportar>;
}
