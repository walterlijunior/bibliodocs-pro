/**
 * Módulo `dominio/esquemas` — validação (zod) e migrações do formato de projeto (ADR-0004).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Pode importar dominio/modelo; único lugar do domínio com zod (regras 1 e 2).
 *
 * Esquemas v1 e validação criados no M1-T04; migrações no M1-T07.
 */
export { LIMITES_V1 } from './limites';
export {
  esquemaBloco,
  esquemaBlocoEquacao,
  esquemaBlocoIlustracao,
  esquemaBlocoTabela,
  esquemaCelulaTabela,
  esquemaDocumentoV1,
  esquemaInline,
  esquemaInlineNota,
  esquemaInlineSigla,
  esquemaSigla,
  esquemaSimbolo,
  esquemaTermoGlossario,
  esquemaItemAlinea,
  esquemaManifestoV1,
  esquemaMidia,
  esquemaSecao,
  IDENTIFICADOR_FORMATO,
  MIMETYPE_PROJETO,
  PADRAO_ID,
  PADRAO_TEXTO_XML,
  RESTRICOES_SO_NO_CODIGO,
  VERSAO_FORMATO_ATUAL,
  type Manifesto,
  type MidiaManifesto,
} from './projeto-v1';
export {
  descreverErros,
  formatarCaminho,
  midiasDoDocumento,
  profundidadeJsonExcede,
  validarDocumentoV1,
  validarManifestoV1,
  validarObraV1,
  validarCitacaoV1,
  validarTabelaV1,
  validarIlustracaoV1,
  type ErroValidacao,
  type ResultadoValidacao,
} from './validar';
export { gerarJsonSchemasV1, type ArquivoJsonSchema } from './json-schema';
export {
  MIGRACOES_REGISTRADAS,
  migrarParaAtual,
  motivoParaNaoMigrar,
  problemasDoRegistro,
  versaoFormatoDeclarada,
  type JsonProjeto,
  type Migracao,
  type ResultadoMigracao,
} from './migracoes';
export { esquemaPerfil, validarPerfil } from './perfil';
