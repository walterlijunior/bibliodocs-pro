/**
 * Limites do formato de projeto v1 (ADR-0004, seção 3). Valores iniciais [HIPÓTESE], a calibrar por medição.
 *
 * Os limites de tamanho do arquivo, de entradas do ZIP e de compressão ficam no contêiner (M1-T05).
 * Aqui ficam os que dependem da estrutura dos JSON.
 */
import { MAXIMO_REPETICOES_ELEMENTO, MAXIMO_SECOES_POR_NIVEL, ORDEM_POS_TEXTUAIS, ORDEM_PRE_TEXTUAIS } from '../modelo';

export const LIMITES_V1 = {
  /** Profundidade máxima da árvore de seções (ADR-0004: "profundidade da árvore de blocos ≤ 64"). */
  profundidadeSecoes: 64,
  /**
   * Aninhamento máximo de qualquer valor JSON, conferido antes da validação de esquema para que um
   * arquivo malicioso não esgote a pilha. Cada nível de seção usa 2 níveis de JSON (lista + objeto);
   * a folga cobre os níveis de bloco, inline e marcas.
   */
  profundidadeJson: 2 * 64 + 16,
  /** Caracteres (unidades UTF-16) de um trecho de texto. */
  textoInline: 100_000,
  /** Trechos (`Inline`) num título, parágrafo ou metadado. */
  inlinesPorConteudo: 10_000,
  blocosPorSecao: 10_000,
  /** Alíneas numa lista e subalíneas numa alínea (M2-T04). */
  itensPorAlineas: 1_000,
  subalineasPorAlinea: 1_000,
  /** Mesmo valor que as operações de `dominio/modelo` respeitam (M2-T03). */
  secoesPorNivel: MAXIMO_SECOES_POR_NIVEL,
  /** Cada pré-textual uma vez; apêndices e anexos até `MAXIMO_REPETICOES_ELEMENTO` cada (M2-T02). */
  elementosPreTextuais: ORDEM_PRE_TEXTUAIS.length,
  elementosPosTextuais: ORDEM_POS_TEXTUAIS.length - 2 + 2 * MAXIMO_REPETICOES_ELEMENTO,
  /** 5.000 entradas do ZIP menos as entradas fixas do pacote. */
  midias: 4_990,
  bytesMidia: 64 * 1024 * 1024,
  /** Campos de identificação (autoria, instituição, natureza, data, membro da banca...) (M2-T08). */
  campoCurto: 2_000,
  palavrasChave: 50,
  membrosBanca: 30,
  /** Campos curtos: versões, ids de perfil. */
  textoCurto: 64,
  /** Erros listados por validação; o restante é resumido. */
  errosRelatados: 50,
} as const;
