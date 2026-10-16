/**
 * Módulo `integracoes` — adaptadores externos: conversão para PDF (LibreOffice) e revisão de texto (LanguageTool), ambos após o M7.
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Roda só no processo principal (regra 6); pode usar child_process.
 * - Rede só em integracoes/revisao-texto, após o M7 e com consentimento (regra 8).
 *
 * Marcador criado no M1-T01; a implementação vem nas tarefas seguintes.
 */
export {};
