/**
 * Módulo `persistencia` — contêiner .bdp, salvamento atômico, backup, recuperação e biblioteca de trabalhos (ADR-0004).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Roda só no processo principal (regra 6); pode usar node:fs.
 * - Pode importar dominio/ (tipos e esquemas). Não importa interface/ nem aplicacao/.
 *
 * Contêiner .bdp criado no M1-T05; salvamento atômico e abertura do disco no M1-T06; recuperação e biblioteca vêm
 * nas tarefas seguintes.
 */
export {
  ESPERAS_TENTATIVAS_MS,
  gravarAtomico,
  MENSAGENS_FALHA,
  type CodigoFalhaGravacao,
  type OpcoesGravacao,
  type ResultadoGravacao,
} from './arquivo/gravacao-atomica';
export { abrirProjeto, salvarProjeto, type ResultadoSalvamento } from './arquivo/projeto-em-disco';
export { SISTEMA_ARQUIVOS_NODE, type ArquivoAberto, type InfoCaminho, type SistemaArquivos } from './arquivo/sistema-arquivos';
export { LIMITES_CONTEINER, type LimitesConteiner } from './conteiner/limites';
export {
  empacotarProjeto,
  lerProjeto,
  type AvisoPacote,
  type PacoteProjeto,
  type ResultadoEmpacotamento,
  type ResultadoLeituraProjeto,
} from './conteiner/pacote';
