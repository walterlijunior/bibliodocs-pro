/**
 * Módulo `aplicacao` — serviços e comandos (criarTrabalho, inserirCitacao, moverSecao, desfazer/refazer, exportar) e portas (RepositorioProjetos, Exportador, ConversorPdf, RevisorTexto, Relogio).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa dominio/ e declara portas (interfaces) (regra 3).
 * - Não importa interface/, principal/ nem electron. Sem DOM e sem Node (checado por tsconfig.puro.json).
 *
 * Marcador criado no M1-T01; contrato da API de projetos (IPC) no M1-T08; biblioteca e criação de trabalho no M1-T09;
 * sessão de edição (trabalho aberto e salvamento automático) no M1-T11; recuperação (instantâneos) no M1-T12; ordem
 * única de desfazer (`HistoricoEdicao`) e operações estruturais na sessão no M2-T07.
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
  type ResultadoAbrirDescartada,
  type ResultadoListarDescartadas,
  type VersaoDescartada,
  type ResultadoInstantaneo,
  type ResultadoListarRecuperacao,
  type ResultadoRecuperar,
  type TipoOferta,
} from './portas/recuperacao';
export { CANAIS_EXPORTACAO, type ApiExportacao, type CanalExportacao, type OpcoesExportacao, type ResultadoExportar } from './portas/exportacao';
export { ACOES_EDICAO, CANAIS_EDICAO, type AcaoEdicao, type ApiEdicao, type CanalEdicao } from './portas/edicao';
export {
  criarTrabalhoDoTipo,
  criarTrabalhoVazio,
  PERFIL_PADRAO,
  PREFIXO_ID_ELEMENTO,
  PREFIXO_ID_SECAO,
  type DadosNovoTrabalho,
  type DadosNovoTrabalhoDoTipo,
  type TrabalhoNovo,
} from './servicos/criar-trabalho';
export {
  ATRASO_INSTANTANEO_MS,
  ATRASO_SALVAMENTO_AUTOMATICO_MS,
  FATOR_ESPACAMENTO_INSTANTANEO,
  MENSAGEM_FALHA_INESPERADA,
  MENSAGEM_FALHA_INSTANTANEO,
  MENSAGEM_NADA_A_DESFAZER,
  MENSAGEM_NADA_A_REFAZER,
  MENSAGEM_NAO_EDITAVEL,
  MENSAGEM_SEM_DESTINO,
  paraEnvio,
  resumirSecoes,
  SessaoTrabalho,
  textoDoTitulo,
  tituloDoTexto,
  type AcaoAviso,
  type AcaoSecao,
  type AplicarTexto,
  type AvisoSessao,
  type Cancelar,
  type ConteudoDaSecao,
  type DependenciasSessao,
  type EstadoSessao,
  type OpcoesAbrir,
  type ResultadoEstrutura,
  type ResumoSecao,
  type SalvamentoSessao,
  type TrabalhoDaSessao,
  type PreTextuaisDaSessao,
  type ResumoElemento,
  type ObraNaLista,
  type ResultadoObra,
  MENSAGEM_OBRA_INVALIDA,
} from './servicos/sessao-trabalho';
export {
  formatadorDeChamadas,
  reconhecedorDeChamadas,
  reconhecerChamadasEscritas,
  validarCitacao,
  verificarBibliografiaDoDocumento,
  type ChamadaEscrita,
  type ChamadaNaTela,
  type DadosCitacao,
  type FormatadorDeChamadas,
  type ResultadoValidacaoCitacao,
} from './servicos/citacoes';
export {
  alterarCelula,
  campoDe,
  dadosDoRascunho,
  excluirColuna,
  excluirLinha,
  explicarSinaisNaNota,
  inserirColuna,
  inserirLinha,
  MAX_COLUNAS_TABELA,
  MAX_LINHAS_TABELA,
  mesclar,
  mudarCabecalho,
  normalizarSinal,
  notaDeSinais,
  rascunhoDe,
  rascunhoNovo,
  separar,
  SINAIS_CONVENCIONAIS,
  validarTabela,
  type CampoTexto,
  type CelulaRascunho,
  type DadosTabela,
  type ErroTabela,
  type RascunhoTabela,
  type ResultadoOperacao,
  type ResultadoValidacaoTabela,
} from './servicos/tabelas';
export {
  LIMITE_BYTES_IMPORTACAO,
  prepararImportacao,
  type ItemImportacao,
  type PreviaImportacao,
} from './servicos/importacao-bibliografia';
export {
  CAMPOS_DO_TIPO,
  obraVazia,
  prepararObra,
  previaDaObra,
  validarObra,
  type CampoNumeroObra,
  type CampoObra,
  type CampoTextoObra,
  type PreviaObra,
  type ResultadoValidacaoObra,
} from './servicos/obras';
export {
  aplicarCampos,
  aplicarDados,
  limparTexto,
  palavrasChaveDoTexto,
  type AlteracaoDados,
  type CampoTextoDados,
  type CamposElemento,
} from './servicos/pre-textuais';
export type { PendenciaPreTextual } from '../dominio/normas';
export type { CodigoProblemaBibliografia, LocalProblema, ProblemaBibliografia } from '../dominio/verificador';
export { HistoricoEdicao, LIMITE_HISTORICO_EDICAO, type EntradaHistorico } from './servicos/historico-edicao';
