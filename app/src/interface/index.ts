/**
 * Módulo `interface` — renderer em React 19: biblioteca, editor, inspetor, verificador e
 * pré-visualização (HTML do DocumentoFormatado).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa aplicacao/ e os tipos de dominio/. Nunca importa dominio/normas para obter valores,
 *   números RN ou medidas (regra 4).
 * - Sem Node e sem electron (sandbox). Sem innerHTML e sem dangerouslySetInnerHTML (regra 7).
 *
 * O ponto de entrada do renderer é main.tsx, carregado por index.html.
 */
export {};
