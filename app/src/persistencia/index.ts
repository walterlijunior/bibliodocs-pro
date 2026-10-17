/**
 * Módulo `persistencia` — contêiner .bdp, salvamento atômico, backup, recuperação e biblioteca de trabalhos (ADR-0004).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Roda só no processo principal (regra 6); pode usar node:fs.
 * - Pode importar dominio/ (tipos e esquemas). Não importa interface/ nem aplicacao/.
 *
 * Contêiner .bdp criado no M1-T05; salvamento atômico e abertura do disco no M1-T06; migração na abertura, com
 * backup obrigatório, no M1-T07; biblioteca (varredura, índice, preferências, nomes) no M1-T09; recuperação no M1-T12.
 */
export {
  ESPERAS_TENTATIVAS_MS,
  gravarAtomico,
  MENSAGENS_FALHA,
  type CodigoFalhaGravacao,
  type OpcoesGravacao,
  type ResultadoGravacao,
} from './arquivo/gravacao-atomica';
export {
  abrirProjeto,
  lerArquivoLimitado,
  nomeBackupMigracao,
  salvarProjeto,
  type OpcoesAbertura,
  type ResultadoAbertura,
  type ResultadoLeituraArquivo,
  type ResultadoSalvamento,
} from './arquivo/projeto-em-disco';
export {
  codigoErro,
  SISTEMA_ARQUIVOS_NODE,
  type ArquivoAberto,
  type EntradaPasta,
  type InfoCaminho,
  type SistemaArquivos,
} from './arquivo/sistema-arquivos';
export { LIMITES_CONTEINER, type LimitesConteiner } from './conteiner/limites';
export {
  empacotarProjeto,
  lerProjeto,
  type AvisoPacote,
  type PacoteProjeto,
  type PacoteSomenteLeitura,
  type ResultadoEmpacotamento,
  type ResultadoLeituraProjeto,
  type VersaoFutura,
} from './conteiner/pacote';
export {
  esquemaResumoProjeto,
  gravarIndice,
  gravarPreferencias,
  indiceVazio,
  lerIndice,
  lerPreferencias,
  LIMITE_ITENS_BIBLIOTECA,
  MAX_TITULO_INDICE,
  PREFERENCIAS_PADRAO,
  type EntradaIndice,
  type IndiceBiblioteca,
  type MotivoDescarte,
  type Preferencias,
  type ResumoProjeto,
} from './biblioteca/indice';
export {
  chaveCaminho,
  comSufixo,
  ehArquivoProjeto,
  EXTENSAO_PROJETO,
  limparNomeArquivo,
  MAX_NOME_TRABALHO,
  nomeLivre,
  pastaNaNuvem,
  semExtensao,
  validarNomeTrabalho,
  type ResultadoNome,
} from './biblioteca/nomes';
export { renomearSemSobrescrever, type ResultadoRenomear } from './biblioteca/renomear';
export { resumirProjeto } from './biblioteca/resumo';
export {
  ARQUIVOS_POR_LOTE,
  PRAZO_VARREDURA_MS,
  varrerPasta,
  type OpcoesVarredura,
  type Resumir,
  type ResultadoVarredura,
} from './biblioteca/varredura';
