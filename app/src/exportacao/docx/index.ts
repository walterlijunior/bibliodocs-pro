/**
 * Módulo `exportacao/docx` — gera DOCX a partir do DocumentoFormatado (processo utilitário).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa apenas os tipos de dominio/normas/formatado e a biblioteca docx (regra 5).
 * - Não lê o Perfil nem o Documento; não conhece números RN nem medidas.
 *
 * Implementado no M3-T05.
 */
export { exportarDocx } from './exportador';
