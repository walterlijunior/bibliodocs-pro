/**
 * Módulo `integracoes` — adaptadores externos: conversão para PDF (LibreOffice) e revisão de texto (LanguageTool), após
 * o M7; serviço de IA no formato de chat da OpenAI (Etapa 8 da especificação de atualização).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Roda só no processo principal (regra 6); pode usar child_process.
 * - Rede só em integracoes/revisao-texto e integracoes/ia, com consentimento (regra 8 e adendo da Etapa 8).
 */
export { buscarNode, enviarChat, urlBaseValida, type Buscar, type RespostaCliente } from './ia/cliente';
