/**
 * Catálogo acadêmico (Etapa 3 da especificação de atualização): instituições, câmpus ou polos, cursos e programas,
 * disciplinas e docentes. Serve para escolher e reaproveitar os dados institucionais do trabalho (capa, folha de rosto,
 * folha de aprovação); o trabalho guarda a cópia do texto (`Metadados`) e o vínculo (`VinculoInstitucional`), e continua
 * completo sem o catálogo.
 *
 * Cada registro pode dizer de onde veio (`fonte`): os dados iniciais vêm de páginas oficiais; o que o usuário acrescenta
 * ou corrige fica marcado como dele. Registro sem fonte aparece como "sem fonte confirmada".
 */

/** Nível do curso: decide os tipos de trabalho oferecidos (`tiposDeTrabalhoDoNivel`). */
export type NivelCurso = 'graduacao' | 'especializacao' | 'mestrado' | 'doutorado';

/** Grau conferido pelo curso de graduação, para a natureza do trabalho (RN-132). */
export type GrauCurso = 'bacharelado' | 'licenciatura' | 'tecnologia';

export interface FonteRegistro {
  /** Página oficial consultada. */
  url: string;
  /** Data da consulta, AAAA-MM-DD. */
  consultadoEm: string;
  observacao?: string;
}

/** `oficial`: veio dos dados iniciais, com fonte; `usuario`: acrescentado ou corrigido pelo usuário. */
export type OrigemRegistro = 'oficial' | 'usuario';

export interface Docente {
  id: string;
  nome: string;
  /** "Dr.", "Dra.", "Me.", "Ma."… como o docente assina (RN-132: "Orientador (a): Titulação/Nome"). */
  titulacao?: string;
  origem: OrigemRegistro;
}

export interface Disciplina {
  id: string;
  nome: string;
  origem: OrigemRegistro;
}

export interface Curso {
  id: string;
  /** Nome do curso ou do programa, sem "Curso de" nem "Programa de Pós-Graduação em". */
  nome: string;
  nivel: NivelCurso;
  grau?: GrauCurso;
  /** Área de concentração do programa (pós-graduação), se houver. */
  areaConcentracao?: string;
  disciplinas: Disciplina[];
  docentes: Docente[];
  origem: OrigemRegistro;
  fonte?: FonteRegistro;
}

export interface Campus {
  id: string;
  /** Nome como a instituição escreve ("Palmas"); a capa usa "Câmpus Universitário de Palmas". */
  nome: string;
  /** Câmpus ou polo (EaD). */
  especie: 'campus' | 'polo';
  cidade: string;
  /** Sigla da unidade da federação ("TO"). */
  uf: string;
  cursos: Curso[];
  origem: OrigemRegistro;
  fonte?: FonteRegistro;
}

export interface Instituicao {
  id: string;
  nome: string;
  sigla: string;
  /** Perfis de formatação da instituição (ids de `perfis/`). Vazio: ainda sem perfil próprio no aplicativo. */
  perfis: string[];
  /** Logotipo para os trabalhos acadêmicos (o brasão da capa, RN-118): sha256 do arquivo guardado pelo aplicativo. */
  logotipo?: { sha256: string; tipo: 'image/png' | 'image/jpeg' };
  campi: Campus[];
  origem: OrigemRegistro;
  fonte?: FonteRegistro;
}

export interface Catalogo {
  formato: 'bibliodocs-catalogo';
  versao: 1;
  instituicoes: Instituicao[];
}

/** Escolha feita no catálogo; cada nível só vale com o anterior. */
export interface SelecaoCatalogo {
  instituicao?: string;
  campus?: string;
  curso?: string;
  disciplina?: string;
  orientador?: string;
  coorientador?: string;
}
