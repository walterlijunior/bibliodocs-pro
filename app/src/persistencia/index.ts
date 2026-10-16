/**
 * Módulo `persistencia` — contêiner .bdp, salvamento atômico, backup, recuperação e biblioteca de trabalhos (ADR-0004).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Roda só no processo principal (regra 6); pode usar node:fs.
 * - Pode importar dominio/ (tipos e esquemas). Não importa interface/ nem aplicacao/.
 *
 * Contêiner .bdp criado no M1-T05; salvamento atômico, recuperação e biblioteca vêm nas tarefas seguintes.
 */
export { LIMITES_CONTEINER, type LimitesConteiner } from './conteiner/limites';
export {
  empacotarProjeto,
  lerProjeto,
  type AvisoPacote,
  type PacoteProjeto,
  type ResultadoEmpacotamento,
  type ResultadoLeituraProjeto,
} from './conteiner/pacote';
