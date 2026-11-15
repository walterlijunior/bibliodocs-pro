/**
 * Catálogo acadêmico (Etapa 3 da especificação de atualização): instituições, câmpus ou polos, cursos e programas,
 * disciplinas e docentes. Serve para escolher e reaproveitar os dados institucionais do trabalho (capa, folha de rosto,
 * folha de aprovação); o trabalho guarda a cópia do texto (`Metadados`) e o vínculo (`VinculoInstitucional`), e continua
 * completo sem o catálogo.
 *
 * Cada registro pode dizer de onde veio (`fonte`): os dados iniciais vêm de páginas oficiais; o que o usuário acrescenta
 * ou corrige fica marcado como dele. Registro sem fonte aparece como "sem fonte confirmada".
 */

import type { RegrasModelo, TipoTrabalhoUft } from '../modelo';

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

/**
 * `oficial`: veio dos dados iniciais, com fonte; `usuario`: acrescentado ou corrigido pelo usuário; `importado`: veio de
 * uma ficha institucional importada (a fonte é a que a ficha informou).
 */
export type OrigemRegistro = 'oficial' | 'usuario' | 'importado';

export interface Docente {
  id: string;
  nome: string;
  /** "Dr.", "Dra.", "Me.", "Ma."… como o docente assina (RN-132: "Orientador (a): Titulação/Nome"). */
  titulacao?: string;
  origem: OrigemRegistro;
  fonte?: FonteRegistro;
}

export interface Disciplina {
  id: string;
  nome: string;
  origem: OrigemRegistro;
  fonte?: FonteRegistro;
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
  /** Ausente: desconhecida (ficha importada sem a cidade); o local da capa fica para o autor. */
  cidade?: string;
  /** Sigla da unidade da federação ("TO"). Ausente: desconhecida. */
  uf?: string;
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
  /**
   * Logotipo para os trabalhos acadêmicos (o brasão da capa, RN-118), guardado no próprio catálogo (base64) e copiado
   * para as mídias do trabalho quando a instituição é escolhida.
   */
  logotipo?: { sha256: string; tipo: 'image/png' | 'image/jpeg'; dados: string };
  campi: Campus[];
  /** Manuais, modelos e regras publicados pela instituição (ficha institucional). */
  manuais?: ManualInstitucional[];
  /** Perfis de formatação da instituição, com as regras e a fonte de cada uma (ficha institucional). */
  perfisInstitucionais?: PerfilInstitucional[];
  origem: OrigemRegistro;
  fonte?: FonteRegistro;
}

/** A que cursos (ids) e tipos de trabalho algo se aplica. Lista vazia ou ausente: a todos. */
export interface AplicacaoRegra {
  cursos?: string[];
  tipos?: TipoTrabalhoUft[];
}

/** Manual, modelo ou norma interna publicado pela instituição. */
export interface ManualInstitucional {
  id: string;
  titulo: string;
  /** Página ou arquivo oficial (https). */
  url?: string;
  /** Nome do arquivo de origem, quando a fonte foi um arquivo. */
  arquivo?: string;
  /** Edição, versão ou ano ("2022", "3. ed."). */
  edicao?: string;
  /** Data de publicação, AAAA-MM-DD ou AAAA. */
  data?: string;
  aplicaA?: AplicacaoRegra;
  origem: OrigemRegistro;
  fonte?: FonteRegistro;
}

/**
 * Perfil de formatação da instituição: ajustes sobre o perfil base do aplicativo (os mesmos aspectos do modelo de evento,
 * Etapa 7), com o manual e a seção de onde vieram. Só pode ser escolhido num trabalho depois de revisado.
 */
export interface PerfilInstitucional {
  id: string;
  nome: string;
  /** Id do manual (em `manuais`) de onde vêm as regras. */
  manual?: string;
  /** Seção, página ou trecho do manual. */
  secao?: string;
  regras: RegrasModelo;
  /** Instruções do manual que o aplicativo não aplica sozinho (ficam para o autor conferir). */
  instrucoes?: string[];
  aplicaA?: AplicacaoRegra;
  /** O usuário conferiu as regras neste computador. Perfil importado ou sugerido pela IA chega sem revisão. */
  revisado: boolean;
  origem: OrigemRegistro;
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
