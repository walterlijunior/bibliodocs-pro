/**
 * Módulo `dominio/bibliografia` — formatadores de referência e de chamada, ordenação da lista.
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa dominio/modelo e dominio/numeracao (regra 2).
 *
 * M4-T04: formatadores dos nove tipos da primeira leva (D-M4-06).
 * M4-T03: chamadas de citação (parentética e narrativa, apud, grifo, título, sufixos), perfil 2002 e opção 2023.
 * M4-T02: referência em trechos com a RN de cada elemento, autores, datas, ordenação e sufixos de ano; livro.
 */
export { abreviaturaFuncao, maiusculas, nomeDeEntrada, type OpcoesAutoria } from './autores';
export {
  contextoDeChamadas,
  entradaPeloTitulo,
  formatarChamada,
  type ChamadaFormatada,
  type ContextoChamadas,
  type EdicaoNbr10520,
  type OpcoesChamada,
} from './chamadas';
export { anoDaReferencia, dataAbreviada, MESES_ABREVIADOS } from './datas';
export { compararReferencias, ordenarReferencias, sufixosDeAno } from './ordenacao';
export { formatarReferencia, tiposComFormatador, type OpcoesReferencia } from './referencia';
export {
  ORIGENS_PROVISORIAS,
  origensProvisorias,
  textoDaReferencia,
  type AvisoReferencia,
  type CodigoAvisoReferencia,
  type ReferenciaFormatada,
  type TrechoReferencia,
} from './trechos';
export {
  autorDeNome,
  detectarFormato,
  ID_RASCUNHO_IMPORTADO,
  LIMITE_REGISTROS_IMPORTACAO,
  LIMITE_TEXTO_IMPORTACAO,
  lerBibliografiaImportada,
  textoDoLatex,
  type FormatoImportacao,
  type RegistroImportado,
  type ResultadoImportacao,
} from './importacao';
