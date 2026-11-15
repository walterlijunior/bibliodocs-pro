/**
 * Operações puras do catálogo acadêmico (Etapa 3 da especificação de atualização): seletores dependentes, revisão da
 * escolha quando um nível muda, tipos de trabalho do nível do curso, textos institucionais para a capa e a folha de
 * rosto, mesclagem dos dados iniciais com os do usuário e edição dos registros.
 *
 * Textos institucionais (D-E3-03, provisório): câmpus "Câmpus Universitário de X" e curso "Curso de Graduação em X" ou
 * "Programa de Pós-Graduação em X", como na Fig. 3 do Manual (p. 32, RN-117, RN-119); local "Cidade, UF" (RN-123); a
 * natureza segue o exemplo da Fig. 5 (p. 34, RN-132) e só é proposta quando o grau é conhecido.
 */
import type { PessoaTitulada, TipoTrabalhoId, TipoTrabalhoUft } from '../modelo';
import type { Campus, Catalogo, Curso, Disciplina, Docente, GrauCurso, Instituicao, NivelCurso, SelecaoCatalogo } from './tipos';

export const instituicaoDe = (c: Catalogo, id: string | undefined): Instituicao | undefined =>
  id === undefined ? undefined : c.instituicoes.find((i) => i.id === id);
export const campusDe = (c: Catalogo, s: SelecaoCatalogo): Campus | undefined =>
  s.campus === undefined ? undefined : instituicaoDe(c, s.instituicao)?.campi.find((x) => x.id === s.campus);
export const cursoDe = (c: Catalogo, s: SelecaoCatalogo): Curso | undefined =>
  s.curso === undefined ? undefined : campusDe(c, s)?.cursos.find((x) => x.id === s.curso);

/** Câmpus e polos da instituição escolhida. */
export const campiDisponiveis = (c: Catalogo, s: SelecaoCatalogo): readonly Campus[] => instituicaoDe(c, s.instituicao)?.campi ?? [];
/** Só os cursos cadastrados no câmpus escolhido (o filtro da Etapa 3). */
export const cursosDisponiveis = (c: Catalogo, s: SelecaoCatalogo): readonly Curso[] => campusDe(c, s)?.cursos ?? [];
export const disciplinasDisponiveis = (c: Catalogo, s: SelecaoCatalogo): readonly Disciplina[] => cursoDe(c, s)?.disciplinas ?? [];
export const docentesDisponiveis = (c: Catalogo, s: SelecaoCatalogo): readonly Docente[] => cursoDe(c, s)?.docentes ?? [];

/**
 * Tipos de trabalho pertinentes ao nível do curso (D-E3-02, provisório): TCC e artigo na graduação e na especialização,
 * dissertação no mestrado, tese no doutorado; relatório técnico e projeto de pesquisa em todos. Sem curso, todos.
 */
const TIPOS_DO_NIVEL: Readonly<Record<NivelCurso, readonly TipoTrabalhoUft[]>> = {
  graduacao: ['monografia', 'artigo-tcc', 'relatorio-tecnico', 'projeto-pesquisa'],
  especializacao: ['monografia', 'artigo-tcc', 'relatorio-tecnico', 'projeto-pesquisa'],
  mestrado: ['dissertacao', 'relatorio-tecnico', 'projeto-pesquisa'],
  doutorado: ['tese', 'relatorio-tecnico', 'projeto-pesquisa'],
};
export const TODOS_OS_TIPOS: readonly TipoTrabalhoUft[] = ['monografia', 'artigo-tcc', 'dissertacao', 'tese', 'relatorio-tecnico', 'projeto-pesquisa'];

export function tiposDeTrabalhoDoNivel(nivel: NivelCurso | undefined): readonly TipoTrabalhoUft[] {
  return nivel === undefined ? TODOS_OS_TIPOS : TIPOS_DO_NIVEL[nivel];
}

export type CampoSelecao = keyof SelecaoCatalogo;

/**
 * Tira da escolha o que não existe mais sob o nível de cima: trocar a instituição limpa câmpus, curso, disciplina e
 * docentes que não são dela; trocar o câmpus limpa o curso que não é dele; e assim por diante. Devolve também o que saiu.
 */
export function revisarSelecao(c: Catalogo, s: SelecaoCatalogo): { selecao: SelecaoCatalogo; descartados: CampoSelecao[] } {
  const descartados: CampoSelecao[] = [];
  const r: SelecaoCatalogo = {};
  const inst = instituicaoDe(c, s.instituicao);
  if (inst) r.instituicao = inst.id;
  else if (s.instituicao !== undefined) descartados.push('instituicao');
  const campus = inst?.campi.find((x) => x.id === s.campus);
  if (campus) r.campus = campus.id;
  else if (s.campus !== undefined) descartados.push('campus');
  const curso = campus?.cursos.find((x) => x.id === s.curso);
  if (curso) r.curso = curso.id;
  else if (s.curso !== undefined) descartados.push('curso');
  for (const k of ['disciplina'] as const) {
    if (s[k] === undefined) continue;
    if (curso?.disciplinas.some((d) => d.id === s[k])) r[k] = s[k];
    else descartados.push(k);
  }
  for (const k of ['orientador', 'coorientador'] as const) {
    if (s[k] === undefined) continue;
    if (curso?.docentes.some((d) => d.id === s[k])) r[k] = s[k];
    else descartados.push(k);
  }
  return { selecao: r, descartados };
}

/** "Câmpus Universitário de Palmas" ou "Polo de X" (Fig. 3 do Manual; grafia "câmpus" do texto, RN-119). */
export const textoCampus = (x: Campus): string => (x.especie === 'polo' ? `Polo de ${x.nome}` : `Câmpus Universitário de ${x.nome}`);

/** "Curso de Graduação em X", "Curso de Especialização em X" ou "Programa de Pós-Graduação em X" (Fig. 3). */
export function textoCurso(x: Curso): string {
  if (x.nivel === 'graduacao') return `Curso de Graduação em ${x.nome}`;
  if (x.nivel === 'especializacao') return `Curso de Especialização em ${x.nome}`;
  return `Programa de Pós-Graduação em ${x.nome}`;
}

const TITULO_DO_GRAU: Readonly<Record<GrauCurso, string>> = { bacharelado: 'bacharel', licenciatura: 'licenciado', tecnologia: 'tecnólogo' };

const NOME_DO_TIPO: Readonly<Record<TipoTrabalhoId, { nome: string; feminino: boolean }>> = {
  generico: { nome: 'Trabalho', feminino: false },
  monografia: { nome: 'Monografia', feminino: true },
  'artigo-tcc': { nome: 'Artigo', feminino: false },
  dissertacao: { nome: 'Dissertação', feminino: true },
  tese: { nome: 'Tese', feminino: true },
  'relatorio-tecnico': { nome: 'Relatório técnico', feminino: false },
  'projeto-pesquisa': { nome: 'Projeto de pesquisa', feminino: false },
};

/**
 * Natureza do trabalho no modelo da Fig. 5 do Manual (RN-132), ou `null` quando falta dado para escrevê-la sem lacuna
 * (na graduação, o grau do curso).
 */
export function naturezaSugerida(inst: Instituicao, campus: Campus, curso: Curso, tipo: TipoTrabalhoId): string | null {
  const t = NOME_DO_TIPO[tipo];
  const apresentad = t.feminino ? 'apresentada' : 'apresentado';
  const instituicao = `${inst.nome} (${inst.sigla})`;
  if (curso.nivel === 'graduacao' || curso.nivel === 'especializacao') {
    if (curso.nivel === 'graduacao' && curso.grau === undefined) return null;
    const objetivo = curso.nivel === 'graduacao' ? `para obtenção do título de ${TITULO_DO_GRAU[curso.grau!]} em ${curso.nome}` : `para obtenção do título de especialista em ${curso.nome}`;
    return `${t.nome} ${apresentad} à ${instituicao}, ${textoCampus(campus)}, ${textoCurso(curso)}, ${objetivo}.`;
  }
  const grau = curso.nivel === 'mestrado' ? 'Mestre' : 'Doutor';
  return `${t.nome} ${apresentad} ao ${textoCurso(curso)} da ${instituicao}, ${textoCampus(campus)}, como requisito à obtenção do grau de ${grau} em ${curso.nome}.`;
}

/** Dados que a escolha do catálogo preenche no trabalho. Só o que a escolha tem; o resto fica como está. */
export interface DadosInstitucionais {
  instituicao?: string;
  campus?: string;
  curso?: string;
  local?: string;
  areaConcentracao?: string;
  orientador?: PessoaTitulada;
  coorientador?: PessoaTitulada;
  /** Natureza proposta (RN-132); quem aplica decide se substitui a que o autor escreveu. */
  natureza?: string;
}

const pessoa = (d: Docente): PessoaTitulada => ({ nome: d.nome, ...(d.titulacao ? { titulacao: d.titulacao } : {}) });

export function dadosInstitucionais(c: Catalogo, s: SelecaoCatalogo, tipo: TipoTrabalhoId): DadosInstitucionais {
  const inst = instituicaoDe(c, s.instituicao);
  if (!inst) return {};
  const campus = campusDe(c, s);
  const curso = cursoDe(c, s);
  const docente = (id: string | undefined) => (id === undefined ? undefined : curso?.docentes.find((d) => d.id === id));
  const orientador = docente(s.orientador);
  const coorientador = docente(s.coorientador);
  const natureza = campus && curso ? naturezaSugerida(inst, campus, curso, tipo) : null;
  return {
    instituicao: inst.nome,
    ...(campus && { campus: textoCampus(campus) }),
    ...(campus?.cidade !== undefined && { local: campus.uf !== undefined ? `${campus.cidade}, ${campus.uf}` : campus.cidade }),
    ...(curso && { curso: textoCurso(curso) }),
    ...(curso?.areaConcentracao && { areaConcentracao: curso.areaConcentracao }),
    ...(orientador && { orientador: pessoa(orientador) }),
    ...(coorientador && { coorientador: pessoa(coorientador) }),
    ...(natureza !== null && { natureza }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Mesclagem: dados iniciais (oficiais) + catálogo do usuário
// ---------------------------------------------------------------------------------------------------------

/** Junta duas listas pelo id: o do usuário vale; o que só existe nos dados iniciais entra no fim, na ordem deles. */
function juntar<T extends { id: string }>(usuario: readonly T[], inicial: readonly T[], filhos?: (u: T, i: T) => T): T[] {
  const doInicial = new Map(inicial.map((x) => [x.id, x]));
  const saida = usuario.map((u) => {
    const i = doInicial.get(u.id);
    return i && filhos ? filhos(u, i) : u;
  });
  const vistos = new Set(usuario.map((u) => u.id));
  for (const i of inicial) if (!vistos.has(i.id)) saida.push(i);
  return saida;
}

/**
 * Catálogo de uso: o do usuário (correções e acréscimos) por cima dos dados iniciais. Registros oficiais novos de uma
 * versão nova do aplicativo aparecem; o que o usuário corrigiu continua corrigido; `removidos` (ids) somem dos dois.
 */
export function mesclarCatalogo(inicial: Catalogo, usuario: Catalogo | null, removidos: readonly string[] = []): Catalogo {
  const fora = new Set(removidos);
  const semRemovidos = (c: Catalogo): Catalogo => ({
    ...c,
    instituicoes: c.instituicoes
      .filter((i) => !fora.has(i.id))
      .map((i) => ({ ...i, campi: i.campi.filter((x) => !fora.has(x.id)).map((x) => ({ ...x, cursos: x.cursos.filter((k) => !fora.has(k.id)) })) })),
  });
  if (usuario === null) return semRemovidos(inicial);
  const instituicoes = juntar(usuario.instituicoes, inicial.instituicoes, (u, i) => ({
    ...u,
    campi: juntar(u.campi, i.campi, (uc, ic) => ({ ...uc, cursos: juntar(uc.cursos, ic.cursos) })),
  }));
  return semRemovidos({ formato: 'bibliodocs-catalogo', versao: 1, instituicoes });
}

// ---------------------------------------------------------------------------------------------------------
// Edição (o usuário acrescenta e corrige ao longo do uso)
// ---------------------------------------------------------------------------------------------------------

const trocarOuIncluir = <T extends { id: string }>(lista: readonly T[], novo: T): T[] =>
  lista.some((x) => x.id === novo.id) ? lista.map((x) => (x.id === novo.id ? novo : x)) : [...lista, novo];

/** Inclui ou corrige a instituição (pelo id). */
export function gravarInstituicao(c: Catalogo, inst: Instituicao): Catalogo {
  return { ...c, instituicoes: trocarOuIncluir(c.instituicoes, inst) };
}

/** Inclui ou corrige o câmpus da instituição. Instituição que não existe: catálogo igual. */
export function gravarCampus(c: Catalogo, instituicao: string, campus: Campus): Catalogo {
  return { ...c, instituicoes: c.instituicoes.map((i) => (i.id === instituicao ? { ...i, campi: trocarOuIncluir(i.campi, campus) } : i)) };
}

/** Inclui ou corrige o curso do câmpus. */
export function gravarCurso(c: Catalogo, instituicao: string, campus: string, curso: Curso): Catalogo {
  return {
    ...c,
    instituicoes: c.instituicoes.map((i) =>
      i.id !== instituicao ? i : { ...i, campi: i.campi.map((x) => (x.id === campus ? { ...x, cursos: trocarOuIncluir(x.cursos, curso) } : x)) },
    ),
  };
}

/** Retira um registro (instituição, câmpus ou curso) pelo id. */
export function retirarRegistro(c: Catalogo, id: string): Catalogo {
  return {
    ...c,
    instituicoes: c.instituicoes
      .filter((i) => i.id !== id)
      .map((i) => ({ ...i, campi: i.campi.filter((x) => x.id !== id).map((x) => ({ ...x, cursos: x.cursos.filter((k) => k.id !== id) })) })),
  };
}

/** Diferença entre o catálogo de uso e os dados iniciais: ids oficiais que o usuário retirou. */
export function idsRetirados(inicial: Catalogo, atual: Catalogo): string[] {
  const ids = (c: Catalogo) => new Set(c.instituicoes.flatMap((i) => [i.id, ...i.campi.flatMap((x) => [x.id, ...x.cursos.map((k) => k.id)])]));
  const agora = ids(atual);
  return [...ids(inicial)].filter((id) => !agora.has(id));
}

/** Id novo a partir do nome, único entre `existentes` ("uft-palmas-direito", "uft-palmas-direito-2"). */
export function idDoNome(prefixo: string, nome: string, existentes: ReadonlySet<string>): string {
  const base = `${prefixo}-${nome}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  let id = base;
  for (let n = 2; existentes.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Todos os ids do catálogo (para `idDoNome`). */
export function idsDoCatalogo(c: Catalogo): Set<string> {
  return new Set(
    c.instituicoes.flatMap((i) => [
      i.id,
      ...i.campi.flatMap((x) => [x.id, ...x.cursos.flatMap((k) => [k.id, ...k.disciplinas.map((d) => d.id), ...k.docentes.map((d) => d.id)])]),
    ]),
  );
}
