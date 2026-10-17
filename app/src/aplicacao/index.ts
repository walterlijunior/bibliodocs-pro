/**
 * Módulo `aplicacao` — serviços e comandos (criarTrabalho, inserirCitacao, moverSecao, desfazer/refazer, exportar) e portas (RepositorioProjetos, Exportador, ConversorPdf, RevisorTexto, Relogio).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa dominio/ e declara portas (interfaces) (regra 3).
 * - Não importa interface/, principal/ nem electron. Sem DOM e sem Node (checado por tsconfig.puro.json).
 *
 * Marcador criado no M1-T01; contrato da API de projetos (IPC) no M1-T08; biblioteca e criação de trabalho no M1-T09;
 * sessão de edição (trabalho aberto e salvamento automático) no M1-T11; recuperação (instantâneos) no M1-T12.
 */
export {
  CANAIS_PROJETOS,
  CODIGO_MIDIA_AUSENTE,
  type ApiBiblioDocs,
  type ApiProjetos,
  type AvisoProjeto,
  type CanalProjetos,
  type ErroProjeto,
  type FalhaSalvar,
  type IdentificadorProjeto,
  type MidiaReferida,
  type MidiaTransferivel,
  type PacoteEnvio,
  type PacoteSomenteLeituraTransferivel,
  type PacoteTransferivel,
  type ProjetoAberto,
  type ResultadoAbrir,
  type ResultadoSalvar,
  type ResultadoSalvarComo,
} from './portas/projetos';
export {
  CANAIS_BIBLIOTECA,
  type ApiBiblioteca,
  type CanalBiblioteca,
  type CodigoFalhaBiblioteca,
  type EstadoItem,
  type FalhaBiblioteca,
  type IdentificadorItem,
  type ItemBiblioteca,
  type PastaBiblioteca,
  type ResultadoCriar,
  type ResultadoEscolherPasta,
  type ResultadoExcluir,
  type ResultadoItem,
  type ResultadoListar,
} from './portas/biblioteca';
export {
  CANAIS_RECUPERACAO,
  type ApiRecuperacao,
  type CanalRecuperacao,
  type IdentificadorOferta,
  type OfertaRecuperacao,
  type ResultadoInstantaneo,
  type ResultadoListarRecuperacao,
  type ResultadoRecuperar,
  type TipoOferta,
} from './portas/recuperacao';
export { criarTrabalhoVazio, PERFIL_PADRAO, type DadosNovoTrabalho, type TrabalhoNovo } from './servicos/criar-trabalho';
export {
  ATRASO_INSTANTANEO_MS,
  ATRASO_SALVAMENTO_AUTOMATICO_MS,
  FATOR_ESPACAMENTO_INSTANTANEO,
  MENSAGEM_FALHA_INESPERADA,
  MENSAGEM_FALHA_INSTANTANEO,
  MENSAGEM_SEM_DESTINO,
  paraEnvio,
  SessaoTrabalho,
  textoDoTitulo,
  tituloDoTexto,
  type AcaoAviso,
  type AvisoSessao,
  type Cancelar,
  type DependenciasSessao,
  type EstadoSessao,
  type OpcoesAbrir,
  type SalvamentoSessao,
  type TrabalhoDaSessao,
} from './servicos/sessao-trabalho';
