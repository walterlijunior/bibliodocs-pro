/**
 * Módulo `aplicacao` — serviços e comandos (criarTrabalho, inserirCitacao, moverSecao, desfazer/refazer, exportar) e portas (RepositorioProjetos, Exportador, ConversorPdf, RevisorTexto, Relogio).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa dominio/ e declara portas (interfaces) (regra 3).
 * - Não importa interface/, principal/ nem electron. Sem DOM e sem Node (checado por tsconfig.puro.json).
 *
 * Marcador criado no M1-T01; contrato da API de projetos (IPC) no M1-T08.
 */
export {
  CANAIS_PROJETOS,
  type ApiBiblioDocs,
  type ApiProjetos,
  type AvisoProjeto,
  type CanalProjetos,
  type ErroProjeto,
  type FalhaSalvar,
  type IdentificadorProjeto,
  type MidiaTransferivel,
  type PacoteSomenteLeituraTransferivel,
  type PacoteTransferivel,
  type ProjetoAberto,
  type ResultadoAbrir,
  type ResultadoSalvar,
  type ResultadoSalvarComo,
} from './portas/projetos';
