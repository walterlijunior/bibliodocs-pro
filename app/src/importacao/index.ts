/**
 * Módulo `importacao` — importadores: backup tcc-uft (ADR-0004), CSV/XLSX (M5), BibTeX/RIS (M4+), DOCX de modelo de
 * evento (Etapa 7 da especificação de atualização).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Parte no processo principal (leitura de arquivo), parte no domínio (conversão para o modelo).
 * - Não monta HTML a partir de dados do usuário (regra 7).
 */
export { LIMITE_BYTES_MODELO, lerModeloDocx, type ModeloLido, type ResultadoLerModelo } from './modelo-docx';
