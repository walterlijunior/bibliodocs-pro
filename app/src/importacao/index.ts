/**
 * Módulo `importacao` — importadores: backup tcc-uft (ADR-0004), CSV/XLSX (M5), BibTeX/RIS (M4+), DOCX (após M7).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Parte no processo principal (leitura de arquivo), parte no domínio (conversão para o modelo).
 * - Não monta HTML a partir de dados do usuário (regra 7).
 *
 * Marcador criado no M1-T01; a implementação vem nas tarefas seguintes.
 */
export {};
