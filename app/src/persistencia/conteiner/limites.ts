/**
 * Limites do contêiner `.bdp` (ADR-0004, seção 3). Valores iniciais [HIPÓTESE], a calibrar por medição.
 * Conferidos antes da descompressão (tamanhos declarados) e durante ela (bytes reais).
 */
export const LIMITES_CONTEINER = {
  bytesArquivo: 1024 * 1024 * 1024,
  entradas: 5_000,
  /** `manifesto.json`: 4.990 mídias com cerca de 230 bytes cada cabem com folga (revisão do M1-T05, A3). */
  bytesManifesto: 2 * 1024 * 1024,
  bytesJson: 64 * 1024 * 1024,
  bytesMidia: 64 * 1024 * 1024,
  bytesDescomprimidosTotal: 2 * 1024 * 1024 * 1024,
  razaoCompressao: 200,
  /**
   * A razão só é conferida acima deste tamanho. Abaixo dele uma bomba não causa dano, e um texto pequeno e
   * repetitivo do usuário passa da razão sem ser ataque (revisão do M1-T05, A1).
   */
  pisoRazao: 1024 * 1024,
} as const;

export type LimitesConteiner = { readonly [K in keyof typeof LIMITES_CONTEINER]: number };
