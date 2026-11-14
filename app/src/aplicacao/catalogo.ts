/**
 * Catálogo acadêmico na aplicação (Etapa 3 da especificação de atualização): carrega os dados iniciais empacotados
 * (`catalogos/catalogo-inicial.json`, validado por `tests/catalogo.test.ts`) e repassa à interface as operações puras do
 * domínio (a interface só importa tipos do domínio, ADR-0005).
 */
import dados from '../../catalogos/catalogo-inicial.json';
import type { Catalogo } from '../dominio/catalogo';

export const CATALOGO_INICIAL = dados as unknown as Catalogo;

export {
  campiDisponiveis,
  campusDe,
  cursoDe,
  cursosDisponiveis,
  dadosInstitucionais,
  disciplinasDisponiveis,
  docentesDisponiveis,
  gravarCampus,
  gravarCurso,
  gravarInstituicao,
  idDoNome,
  idsDoCatalogo,
  idsRetirados,
  instituicaoDe,
  mesclarCatalogo,
  naturezaSugerida,
  retirarRegistro,
  revisarSelecao,
  textoCampus,
  textoCurso,
  tiposDeTrabalhoDoNivel,
  TODOS_OS_TIPOS,
  type CampoSelecao,
  type DadosInstitucionais,
} from '../dominio/catalogo';
export type { Campus, Catalogo, Curso, Disciplina, Docente, GrauCurso, Instituicao, NivelCurso, SelecaoCatalogo } from '../dominio/catalogo';
