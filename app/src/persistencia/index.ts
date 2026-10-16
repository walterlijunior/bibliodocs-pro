/**
 * Módulo `persistencia` — contêiner .bdp, salvamento atômico, backup, recuperação e biblioteca de trabalhos (ADR-0004).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Roda só no processo principal (regra 6); pode usar node:fs.
 * - Pode importar dominio/ (tipos e esquemas). Não importa interface/ nem aplicacao/.
 *
 * Marcador criado no M1-T01; a implementação vem nas tarefas seguintes.
 */
export {};
