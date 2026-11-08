/**
 * Porta `exportacao`: contrato da API `window.bibliodocs.exportacao.*` (M3-T08; RF-06). O destino vem sempre do diálogo
 * do principal: nenhum caminho passa pelo renderer. A forma do documento sai do motor, no principal.
 */
import type { PacoteTransferivel } from './projetos';

export const CANAIS_EXPORTACAO = {
  docx: 'bibliodocs:exportacao:docx',
  relatorio: 'bibliodocs:exportacao:relatorio',
} as const;

export type CanalExportacao = (typeof CANAIS_EXPORTACAO)[keyof typeof CANAIS_EXPORTACAO];

export interface OpcoesExportacao {
  /** Fonte escolhida para este arquivo; fora das opções do perfil, vale a padrão. */
  fonte?: string;
  /**
   * PNG de cada gráfico gerado de tabela, pelo id do bloco, desenhado no renderer (M5-T09): o principal não tem canvas. O
   * principal confere cada um (id de gráfico do documento, PNG legível, tamanho) antes de usar.
   */
  graficos?: Record<string, Uint8Array>;
}

/** Limites dos PNG dos gráficos na exportação (M5-T09). */
export const LIMITES_GRAFICOS_EXPORTACAO = { quantidade: 500, bytesPorGrafico: 20 * 1024 * 1024 } as const;

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
  relatorio(pacote: PacoteTransferivel): Promise<ResultadoExportar>;
  docx(pacote: PacoteTransferivel, opcoes: OpcoesExportacao): Promise<ResultadoExportar>;
}
