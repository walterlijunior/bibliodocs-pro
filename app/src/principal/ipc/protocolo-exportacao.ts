/**
 * Mensagens entre o principal e o processo exportador (M3-T05). O `DocumentoFormatado` sai do motor no próprio principal;
 * a conferência aqui só garante a forma da mensagem. A resposta volta sem texto de erro: nada de caminho nem de conteúdo.
 */
import type { DocumentoFormatado } from '../../dominio/normas/formatado';

export interface PedidoExportacao {
  formatado: DocumentoFormatado;
}

export type RespostaExportacao = { ok: true; bytes: Uint8Array } | { ok: false };

export const RESPOSTA_FALHA_EXPORTACAO: RespostaExportacao = { ok: false };

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function lerPedidoExportacao(m: unknown): PedidoExportacao | null {
  if (!objeto(m) || !objeto(m['formatado'])) return null;
  const f = m['formatado'];
  if (!Array.isArray(f['secoes']) || !Array.isArray(f['estilos']) || !objeto(f['pagina'])) return null;
  return { formatado: f as unknown as DocumentoFormatado };
}

export function lerRespostaExportacao(m: unknown): RespostaExportacao | null {
  if (!objeto(m)) return null;
  if (m['ok'] === false) return RESPOSTA_FALHA_EXPORTACAO;
  return m['ok'] === true && m['bytes'] instanceof Uint8Array ? { ok: true, bytes: m['bytes'] } : null;
}
