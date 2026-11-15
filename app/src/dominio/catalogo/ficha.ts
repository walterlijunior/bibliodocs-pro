/**
 * Ficha institucional (Etapa 3 da especificação de atualização, "Ficha institucional, contribuições e importação"): o
 * formulário padronizado em que alguém cadastra os dados de uma instituição (câmpus ou polos, cursos, disciplinas,
 * docentes, manuais e perfis de formatação) para compartilhar e importar em outro computador.
 *
 * Diferente do catálogo (uma árvore instituição › câmpus › curso), a ficha é plana: cada curso diz a que câmpus pertence
 * e cada disciplina ou docente diz a que cursos pertence, com quantos vínculos houver. As ligações usam `chave`, que só
 * vale dentro da ficha. Na importação, a ficha é cruzada com o catálogo pelos nomes normalizados (sem acento, caixa nem
 * espaços repetidos); o que já existe é reaproveitado, o que falta é incluído e o valor que difere do catálogo só é
 * substituído com a confirmação do usuário. Reimportar a mesma ficha não muda nada.
 *
 * Puro: sem E/S. A validação do arquivo fica em `dominio/esquemas/ficha.ts`.
 */
import type { RegrasModelo, TipoTrabalhoUft } from '../modelo';
import { idDoNome, idsDoCatalogo } from './operacoes';
import type {
  AplicacaoRegra,
  Catalogo,
  Curso,
  Disciplina,
  Docente,
  FonteRegistro,
  GrauCurso,
  Instituicao,
  ManualInstitucional,
  NivelCurso,
  PerfilInstitucional,
} from './tipos';

export const FORMATO_FICHA = 'bibliodocs-ficha-institucional';

/** Conjuntos de informação da ficha; cada um pode ter a sua fonte pública. */
export type ConjuntoFicha = 'instituicao' | 'campi' | 'cursos' | 'disciplinas' | 'docentes' | 'manuais';

export interface CampusFicha {
  chave: string;
  nome: string;
  especie: 'campus' | 'polo';
  cidade?: string;
  uf?: string;
  /** Campos que quem preencheu marcou como desconhecidos (não é esquecimento). */
  desconhecidos?: ('cidade' | 'uf')[];
  fonte?: FonteRegistro;
}

export interface CursoFicha {
  chave: string;
  nome: string;
  nivel: NivelCurso;
  grau?: GrauCurso;
  areaConcentracao?: string;
  /** Chaves dos câmpus ou polos onde o curso é oferecido (um ou mais). */
  campi: string[];
  desconhecidos?: ('grau' | 'areaConcentracao')[];
  fonte?: FonteRegistro;
}

export interface DisciplinaFicha {
  chave: string;
  nome: string;
  /** Chaves dos cursos (um ou mais). */
  cursos: string[];
  fonte?: FonteRegistro;
}

export interface DocenteFicha {
  chave: string;
  /** Nome profissional público. */
  nome: string;
  titulacao?: string;
  cursos: string[];
  desconhecidos?: 'titulacao'[];
  fonte?: FonteRegistro;
}

export interface ManualFicha {
  chave: string;
  titulo: string;
  url?: string;
  arquivo?: string;
  edicao?: string;
  data?: string;
  /** Chaves dos cursos a que se aplica; vazio = a todos. */
  cursos?: string[];
  tipos?: TipoTrabalhoUft[];
  desconhecidos?: ('edicao' | 'data')[];
  fonte?: FonteRegistro;
}

export interface PerfilFicha {
  chave: string;
  nome: string;
  /** Chave do manual (em `manuais`). */
  manual?: string;
  secao?: string;
  regras: RegrasModelo;
  instrucoes?: string[];
  cursos?: string[];
  tipos?: TipoTrabalhoUft[];
}

export interface FichaInstitucional {
  formato: typeof FORMATO_FICHA;
  versao: 1;
  /** Quando a ficha foi exportada (ISO 8601). */
  preenchidaEm?: string;
  instituicao: {
    nome: string;
    sigla: string;
    logotipo?: Instituicao['logotipo'];
    desconhecidos?: 'logotipo'[];
  };
  /** Fonte pública de cada conjunto; vale para os registros do conjunto que não têm fonte própria. */
  fontes: Partial<Record<ConjuntoFicha, FonteRegistro>>;
  campi: CampusFicha[];
  cursos: CursoFicha[];
  disciplinas: DisciplinaFicha[];
  docentes: DocenteFicha[];
  manuais: ManualFicha[];
  perfis: PerfilFicha[];
}

/** Ficha vazia (o modelo de preenchimento). */
export function fichaVazia(): FichaInstitucional {
  return { formato: FORMATO_FICHA, versao: 1, instituicao: { nome: '', sigla: '' }, fontes: {}, campi: [], cursos: [], disciplinas: [], docentes: [], manuais: [], perfis: [] };
}

/** Nome normalizado para cruzar registros: sem acento, sem pontuação, minúsculas, espaços simples. */
export function normalizarNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const unicos = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/** JSON com as chaves em ordem (para comparar regras). */
function estavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estavel).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${estavel((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------------------------------------
// Do catálogo para a ficha (exportar)
// ---------------------------------------------------------------------------------------------------------

/**
 * Ficha de uma instituição do catálogo. Cursos com o mesmo nome e nível em câmpus diferentes viram um curso com vários
 * câmpus; disciplinas e docentes com o mesmo nome em cursos diferentes viram um registro com vários cursos.
 */
export function fichaDoCatalogo(c: Catalogo, idInstituicao: string, agora?: Date): FichaInstitucional | null {
  const inst = c.instituicoes.find((i) => i.id === idInstituicao);
  if (!inst) return null;
  const ficha = fichaVazia();
  if (agora) ficha.preenchidaEm = agora.toISOString();
  ficha.instituicao = { nome: inst.nome, sigla: inst.sigla, ...(inst.logotipo ? { logotipo: inst.logotipo } : {}) };
  if (inst.fonte) ficha.fontes.instituicao = inst.fonte;

  const chaveDoCurso = new Map<string, string>();
  const cursos = new Map<string, CursoFicha>();
  for (const k of inst.campi) {
    const desconhecidos = [...(k.cidade === undefined ? ['cidade' as const] : []), ...(k.uf === undefined ? ['uf' as const] : [])];
    ficha.campi.push({
      chave: k.id,
      nome: k.nome,
      especie: k.especie,
      ...(k.cidade !== undefined && { cidade: k.cidade }),
      ...(k.uf !== undefined && { uf: k.uf }),
      ...(desconhecidos.length > 0 && { desconhecidos }),
      ...(k.fonte && { fonte: k.fonte }),
    });
    for (const u of k.cursos) {
      const grupo = `${normalizarNome(u.nome)}|${u.nivel}`;
      const existente = cursos.get(grupo);
      if (existente) {
        existente.campi = unicos([...existente.campi, k.id]);
        if (existente.grau === undefined && u.grau !== undefined) existente.grau = u.grau;
        if (existente.areaConcentracao === undefined && u.areaConcentracao !== undefined) existente.areaConcentracao = u.areaConcentracao;
        chaveDoCurso.set(u.id, existente.chave);
        continue;
      }
      const novo: CursoFicha = {
        chave: u.id,
        nome: u.nome,
        nivel: u.nivel,
        ...(u.grau && { grau: u.grau }),
        ...(u.areaConcentracao && { areaConcentracao: u.areaConcentracao }),
        campi: [k.id],
        ...(u.fonte && { fonte: u.fonte }),
      };
      cursos.set(grupo, novo);
      chaveDoCurso.set(u.id, novo.chave);
    }
  }
  ficha.cursos = [...cursos.values()];

  const disciplinas = new Map<string, DisciplinaFicha>();
  const docentes = new Map<string, DocenteFicha>();
  for (const k of inst.campi) {
    for (const u of k.cursos) {
      const chaveCurso = chaveDoCurso.get(u.id)!;
      for (const d of u.disciplinas) {
        const grupo = normalizarNome(d.nome);
        const x = disciplinas.get(grupo);
        if (x) x.cursos = unicos([...x.cursos, chaveCurso]);
        else disciplinas.set(grupo, { chave: d.id, nome: d.nome, cursos: [chaveCurso], ...(d.fonte && { fonte: d.fonte }) });
      }
      for (const d of u.docentes) {
        const grupo = normalizarNome(d.nome);
        const x = docentes.get(grupo);
        if (x) {
          x.cursos = unicos([...x.cursos, chaveCurso]);
          if (x.titulacao === undefined && d.titulacao !== undefined) x.titulacao = d.titulacao;
        } else docentes.set(grupo, { chave: d.id, nome: d.nome, ...(d.titulacao && { titulacao: d.titulacao }), cursos: [chaveCurso], ...(d.fonte && { fonte: d.fonte }) });
      }
    }
  }
  ficha.disciplinas = [...disciplinas.values()];
  ficha.docentes = [...docentes.values()];

  const cursosDaRegra = (a: AplicacaoRegra | undefined) => {
    const xs = unicos((a?.cursos ?? []).flatMap((id) => (chaveDoCurso.has(id) ? [chaveDoCurso.get(id)!] : [])));
    return xs.length > 0 ? { cursos: xs } : {};
  };
  ficha.manuais = (inst.manuais ?? []).map((m) => ({
    chave: m.id,
    titulo: m.titulo,
    ...(m.url && { url: m.url }),
    ...(m.arquivo && { arquivo: m.arquivo }),
    ...(m.edicao && { edicao: m.edicao }),
    ...(m.data && { data: m.data }),
    ...cursosDaRegra(m.aplicaA),
    ...(m.aplicaA?.tipos?.length ? { tipos: m.aplicaA.tipos } : {}),
    ...(m.fonte && { fonte: m.fonte }),
  }));
  ficha.perfis = (inst.perfisInstitucionais ?? []).map((p) => ({
    chave: p.id,
    nome: p.nome,
    ...(p.manual && { manual: p.manual }),
    ...(p.secao && { secao: p.secao }),
    regras: p.regras,
    ...(p.instrucoes?.length ? { instrucoes: p.instrucoes } : {}),
    ...cursosDaRegra(p.aplicaA),
    ...(p.aplicaA?.tipos?.length ? { tipos: p.aplicaA.tipos } : {}),
  }));
  return ficha;
}

// ---------------------------------------------------------------------------------------------------------
// Da ficha para o catálogo (importar)
// ---------------------------------------------------------------------------------------------------------

export type NivelPrevia = 'instituicao' | 'campus' | 'curso' | 'disciplina' | 'docente' | 'manual' | 'perfil';

export interface ItemPrevia {
  nivel: NivelPrevia;
  rotulo: string;
  /** `incluir`: registro novo; `atualizar`: campo vazio preenchido ou substituição confirmada; `sem-mudanca`: igual. */
  acao: 'incluir' | 'atualizar' | 'sem-mudanca';
  detalhe?: string;
}

export interface VinculoPrevia {
  de: string;
  para: string;
}

export interface FaltantePrevia {
  rotulo: string;
  campo: string;
  /** Quem preencheu marcou o campo como desconhecido. */
  desconhecido: boolean;
}

export interface ConflitoPrevia {
  /** Id estável (para a decisão). */
  id: string;
  rotulo: string;
  campo: string;
  noCatalogo: string;
  naFicha: string;
  /** A decisão atual: o valor da ficha substitui o do catálogo. */
  substituir: boolean;
}

export interface PendenciaPrevia {
  id: string;
  /** `ambigua`: mais de um registro do catálogo serve, o usuário escolhe; `incompleta`: falta a ligação, não entra. */
  tipo: 'ambigua' | 'incompleta';
  mensagem: string;
  opcoes?: { id: string; rotulo: string }[];
  /** A escolha feita (para `ambigua`). */
  escolha?: string;
}

export interface PreviaImportacao {
  itens: ItemPrevia[];
  /** Vínculos que serão criados (os que já existiam não aparecem). */
  vinculosNovos: VinculoPrevia[];
  /** Quantos vínculos da ficha já existiam no catálogo e foram preservados. */
  vinculosPreservados: number;
  faltantes: FaltantePrevia[];
  conflitos: ConflitoPrevia[];
  pendencias: PendenciaPrevia[];
  /** Há ambiguidade sem escolha: a importação espera a revisão. */
  aguardaRevisao: boolean;
  /** Nada a gravar (reimportação da mesma ficha, por exemplo). */
  semMudancas: boolean;
}

export interface DecisoesImportacao {
  /** Para cada pendência ambígua (pelo id): o id do registro do catálogo escolhido, ou `NOVO_REGISTRO`. */
  escolhas?: Readonly<Record<string, string>>;
  /** Conflitos (ids) em que o valor da ficha substitui o do catálogo. Os demais mantêm o valor do catálogo. */
  substituir?: readonly string[];
}

export const NOVO_REGISTRO = '__novo__';

export interface ResultadoImportacao {
  previa: PreviaImportacao;
  /** O catálogo depois da importação, pronto para gravar quando o usuário confirmar. */
  catalogo: Catalogo;
  /** Id da instituição no catálogo (nova ou existente); `null` enquanto aguarda a escolha da instituição. */
  instituicao: string | null;
}

const NIVEIS_TEXTO: Readonly<Record<NivelCurso, string>> = { graduacao: 'graduação', especializacao: 'especialização', mestrado: 'mestrado', doutorado: 'doutorado' };
const textoValor = (v: unknown): string => (v === undefined ? '—' : Array.isArray(v) ? v.join(', ') || '—' : typeof v === 'object' ? estavel(v) : String(v));

/**
 * Cruza a ficha com o catálogo e devolve a prévia e o catálogo resultante. Chamado de novo a cada decisão do usuário
 * (escolha numa ambiguidade, substituição num conflito): a prévia e o resultado vêm sempre da mesma passada.
 */
export function importarFicha(catalogo: Catalogo, ficha: FichaInstitucional, decisoes: DecisoesImportacao = {}): ResultadoImportacao {
  const escolhas = decisoes.escolhas ?? {};
  const substituir = new Set(decisoes.substituir ?? []);
  const itens: ItemPrevia[] = [];
  const vinculosNovos: VinculoPrevia[] = [];
  let vinculosPreservados = 0;
  const faltantes: FaltantePrevia[] = [];
  const conflitos: ConflitoPrevia[] = [];
  const pendencias: PendenciaPrevia[] = [];
  const ids = idsDoCatalogo(catalogo);
  const novoId = (prefixo: string, nome: string) => {
    const id = idDoNome(prefixo, nome, ids);
    ids.add(id);
    return id;
  };
  const fonteDe = (conjunto: ConjuntoFicha, propria: FonteRegistro | undefined) => propria ?? ficha.fontes[conjunto];
  let mudou = false;

  /**
   * Compara um campo: vazio no catálogo é preenchido; diferente vira conflito e só muda com a confirmação. Devolve o
   * valor que fica.
   */
  const campo = <T>(rotulo: string, nomeCampo: string, idConflito: string, atual: T | undefined, novo: T | undefined, igual: (a: T, b: T) => boolean = (a, b) => a === b): { valor: T | undefined; mudou: boolean } => {
    if (novo === undefined) return { valor: atual, mudou: false };
    if (atual === undefined) return { valor: novo, mudou: true };
    if (igual(atual, novo)) return { valor: atual, mudou: false };
    const sim = substituir.has(idConflito);
    conflitos.push({ id: idConflito, rotulo, campo: nomeCampo, noCatalogo: textoValor(atual), naFicha: textoValor(novo), substituir: sim });
    return sim ? { valor: novo, mudou: true } : { valor: atual, mudou: false };
  };

  /** Escolhe o registro do catálogo para um da ficha: nenhum (novo), um, ou vários (pendência). */
  const casar = <T extends { id: string }>(idPendencia: string, candidatos: readonly T[], rotulo: (x: T) => string, mensagem: string): T | null | 'pendente' => {
    if (candidatos.length === 0) return null;
    if (candidatos.length === 1) return candidatos[0]!;
    const escolha = escolhas[idPendencia];
    pendencias.push({
      id: idPendencia,
      tipo: 'ambigua',
      mensagem,
      opcoes: [...candidatos.map((x) => ({ id: x.id, rotulo: rotulo(x) })), { id: NOVO_REGISTRO, rotulo: 'Incluir como registro novo' }],
      ...(escolha !== undefined && { escolha }),
    });
    if (escolha === NOVO_REGISTRO) return null;
    return candidatos.find((x) => x.id === escolha) ?? 'pendente';
  };

  // --- Instituição -------------------------------------------------------------------------------------------
  const fi = ficha.instituicao;
  const candidatasInst = catalogo.instituicoes.filter((i) => normalizarNome(i.sigla) === normalizarNome(fi.sigla) || normalizarNome(i.nome) === normalizarNome(fi.nome));
  const casadaInst = casar('instituicao', candidatasInst, (i) => `${i.nome} (${i.sigla})`, `Mais de uma instituição do catálogo corresponde a “${fi.nome} (${fi.sigla})”. Escolha qual recebe a ficha.`);
  if (casadaInst === 'pendente') {
    return {
      previa: { itens, vinculosNovos, vinculosPreservados, faltantes, conflitos, pendencias, aguardaRevisao: true, semMudancas: true },
      catalogo,
      instituicao: null,
    };
  }
  let inst: Instituicao;
  const rotuloInst = `${fi.nome} (${fi.sigla})`;
  if (casadaInst === null) {
    inst = {
      id: novoId('inst', fi.sigla),
      nome: fi.nome,
      sigla: fi.sigla,
      perfis: [],
      ...(fi.logotipo && { logotipo: fi.logotipo }),
      campi: [],
      origem: 'importado',
      ...(ficha.fontes.instituicao && { fonte: ficha.fontes.instituicao }),
    };
    itens.push({ nivel: 'instituicao', rotulo: rotuloInst, acao: 'incluir' });
    mudou = true;
  } else {
    const nome = campo(rotuloInst, 'nome', 'instituicao:nome', casadaInst.nome, fi.nome);
    const sigla = campo(rotuloInst, 'sigla', 'instituicao:sigla', casadaInst.sigla, fi.sigla);
    const logo = campo(rotuloInst, 'logotipo', 'instituicao:logotipo', casadaInst.logotipo, fi.logotipo, (a, b) => a.sha256 === b.sha256);
    const fonte = casadaInst.fonte === undefined && ficha.fontes.instituicao !== undefined;
    const alterada = nome.mudou || sigla.mudou || logo.mudou || fonte;
    inst = {
      ...casadaInst,
      nome: nome.valor!,
      sigla: sigla.valor!,
      ...(logo.valor && { logotipo: logo.valor }),
      ...(fonte && { fonte: ficha.fontes.instituicao! }),
      campi: casadaInst.campi.map((k) => ({ ...k, cursos: [...k.cursos] })),
    };
    itens.push({ nivel: 'instituicao', rotulo: rotuloInst, acao: alterada ? 'atualizar' : 'sem-mudanca' });
    mudou ||= alterada;
  }
  if (fi.logotipo === undefined) faltantes.push({ rotulo: rotuloInst, campo: 'logotipo', desconhecido: (fi.desconhecidos ?? []).includes('logotipo') });

  // --- Câmpus ou polos ----------------------------------------------------------------------------------------
  const campusDaChave = new Map<string, number>(); // chave da ficha → índice em inst.campi
  for (const fk of ficha.campi) {
    const rotulo = fk.especie === 'polo' ? `Polo ${fk.nome}` : `Câmpus ${fk.nome}`;
    for (const c of ['cidade', 'uf'] as const) if (fk[c] === undefined) faltantes.push({ rotulo, campo: c === 'uf' ? 'UF' : 'cidade', desconhecido: (fk.desconhecidos ?? []).includes(c) });
    const casado = casar(`campus:${fk.chave}`, inst.campi.filter((k) => normalizarNome(k.nome) === normalizarNome(fk.nome)), (k) => `${k.nome}${k.cidade ? ` (${k.cidade})` : ''}`, `Mais de um câmpus do catálogo se chama “${fk.nome}”. Escolha qual corresponde ao da ficha.`);
    if (casado === 'pendente') continue;
    if (casado === null) {
      const fonte = fonteDe('campi', fk.fonte);
      inst.campi.push({
        id: novoId(inst.id, fk.nome),
        nome: fk.nome,
        especie: fk.especie,
        ...(fk.cidade !== undefined && { cidade: fk.cidade }),
        ...(fk.uf !== undefined && { uf: fk.uf }),
        cursos: [],
        origem: 'importado',
        ...(fonte && { fonte }),
      });
      campusDaChave.set(fk.chave, inst.campi.length - 1);
      itens.push({ nivel: 'campus', rotulo, acao: 'incluir' });
      vinculosNovos.push({ de: rotulo, para: fi.sigla });
      mudou = true;
    } else {
      const i = inst.campi.indexOf(casado);
      campusDaChave.set(fk.chave, i);
      const especie = campo(rotulo, 'tipo', `campus:${fk.chave}:especie`, casado.especie, fk.especie);
      const cidade = campo(rotulo, 'cidade', `campus:${fk.chave}:cidade`, casado.cidade, fk.cidade);
      const uf = campo(rotulo, 'UF', `campus:${fk.chave}:uf`, casado.uf, fk.uf);
      const alterado = especie.mudou || cidade.mudou || uf.mudou;
      inst.campi[i] = { ...casado, especie: especie.valor!, ...(cidade.valor !== undefined && { cidade: cidade.valor }), ...(uf.valor !== undefined && { uf: uf.valor }) };
      itens.push({ nivel: 'campus', rotulo, acao: alterado ? 'atualizar' : 'sem-mudanca' });
      vinculosPreservados++;
      mudou ||= alterado;
    }
  }

  // --- Cursos: uma cópia em cada câmpus ligado ---------------------------------------------------------------
  /** Chave do curso na ficha → ids dos cursos no catálogo (um por câmpus). */
  const cursosDaChave = new Map<string, { campus: number; id: string }[]>();
  for (const fu of ficha.cursos) {
    const rotulo = `${fu.nome} (${NIVEIS_TEXTO[fu.nivel]})`;
    if (fu.nivel === 'graduacao' && fu.grau === undefined) faltantes.push({ rotulo, campo: 'grau', desconhecido: (fu.desconhecidos ?? []).includes('grau') });
    const semCampus = fu.campi.filter((k) => !ficha.campi.some((x) => x.chave === k));
    for (const k of semCampus) pendencias.push({ id: `curso:${fu.chave}:campus:${k}`, tipo: 'incompleta', mensagem: `O curso “${rotulo}” aponta para um câmpus (“${k}”) que não está na ficha: esse vínculo não será criado.` });
    if (fu.campi.length === 0) pendencias.push({ id: `curso:${fu.chave}:sem-campus`, tipo: 'incompleta', mensagem: `O curso “${rotulo}” não está ligado a nenhum câmpus: ele não será incluído. Ligue-o a um câmpus na ficha.` });
    const instancias: { campus: number; id: string }[] = [];
    for (const chaveCampus of unicos(fu.campi)) {
      const ic = campusDaChave.get(chaveCampus);
      if (ic === undefined) {
        if (!semCampus.includes(chaveCampus)) pendencias.push({ id: `curso:${fu.chave}:espera:${chaveCampus}`, tipo: 'incompleta', mensagem: `O curso “${rotulo}” espera a escolha do câmpus “${ficha.campi.find((x) => x.chave === chaveCampus)?.nome ?? chaveCampus}”.` });
        continue;
      }
      const campus = inst.campi[ic]!;
      const idP = `curso:${fu.chave}@${chaveCampus}`;
      const casado = casar(idP, campus.cursos.filter((u) => normalizarNome(u.nome) === normalizarNome(fu.nome) && u.nivel === fu.nivel), (u) => u.nome, `Mais de um curso “${rotulo}” no câmpus ${campus.nome}. Escolha qual corresponde ao da ficha.`);
      if (casado === 'pendente') continue;
      const rotuloAqui = `${rotulo} em ${campus.nome}`;
      if (casado === null) {
        const fonte = fonteDe('cursos', fu.fonte);
        const novo: Curso = {
          id: novoId(campus.id, fu.nome),
          nome: fu.nome,
          nivel: fu.nivel,
          ...(fu.grau && { grau: fu.grau }),
          ...(fu.areaConcentracao && { areaConcentracao: fu.areaConcentracao }),
          disciplinas: [],
          docentes: [],
          origem: 'importado',
          ...(fonte && { fonte }),
        };
        inst.campi[ic] = { ...campus, cursos: [...campus.cursos, novo] };
        instancias.push({ campus: ic, id: novo.id });
        itens.push({ nivel: 'curso', rotulo: rotuloAqui, acao: 'incluir' });
        vinculosNovos.push({ de: rotulo, para: campus.especie === 'polo' ? `Polo ${campus.nome}` : `Câmpus ${campus.nome}` });
        mudou = true;
      } else {
        const grau = campo(rotuloAqui, 'grau', `${idP}:grau`, casado.grau, fu.grau);
        const area = campo(rotuloAqui, 'área de concentração', `${idP}:area`, casado.areaConcentracao, fu.areaConcentracao);
        const alterado = grau.mudou || area.mudou;
        const atualizado: Curso = { ...casado, ...(grau.valor && { grau: grau.valor }), ...(area.valor && { areaConcentracao: area.valor }) };
        inst.campi[ic] = { ...campus, cursos: campus.cursos.map((u) => (u.id === casado.id ? atualizado : u)) };
        instancias.push({ campus: ic, id: casado.id });
        itens.push({ nivel: 'curso', rotulo: rotuloAqui, acao: alterado ? 'atualizar' : 'sem-mudanca' });
        vinculosPreservados++;
        mudou ||= alterado;
      }
    }
    cursosDaChave.set(fu.chave, instancias);
  }

  // --- Disciplinas e docentes: em cada curso ligado ---------------------------------------------------------
  const pessoas = <F extends DisciplinaFicha | DocenteFicha>(lista: readonly F[], nivel: 'disciplina' | 'docente') => {
    const conjunto: ConjuntoFicha = nivel === 'disciplina' ? 'disciplinas' : 'docentes';
    for (const f of lista) {
      const rotulo = nivel === 'docente' && (f as DocenteFicha).titulacao ? `${(f as DocenteFicha).titulacao} ${f.nome}` : f.nome;
      if (nivel === 'docente' && (f as DocenteFicha).titulacao === undefined) faltantes.push({ rotulo, campo: 'titulação', desconhecido: ((f as DocenteFicha).desconhecidos ?? []).includes('titulacao') });
      if (f.cursos.length === 0) pendencias.push({ id: `${nivel}:${f.chave}:sem-curso`, tipo: 'incompleta', mensagem: `${nivel === 'disciplina' ? 'A disciplina' : 'O docente'} “${f.nome}” não está ligad${nivel === 'disciplina' ? 'a' : 'o'} a nenhum curso: não será incluíd${nivel === 'disciplina' ? 'a' : 'o'}.` });
      for (const chaveCurso of unicos(f.cursos)) {
        const fu = ficha.cursos.find((u) => u.chave === chaveCurso);
        if (!fu) {
          pendencias.push({ id: `${nivel}:${f.chave}:curso:${chaveCurso}`, tipo: 'incompleta', mensagem: `“${f.nome}” aponta para um curso (“${chaveCurso}”) que não está na ficha: esse vínculo não será criado.` });
          continue;
        }
        for (const { campus: ic, id: idCurso } of cursosDaChave.get(chaveCurso) ?? []) {
          const campus = inst.campi[ic]!;
          const curso = campus.cursos.find((u) => u.id === idCurso)!;
          const existentes: readonly (Disciplina | Docente)[] = nivel === 'disciplina' ? curso.disciplinas : curso.docentes;
          const idP = `${nivel}:${f.chave}@${idCurso}`;
          const casado = casar(idP, existentes.filter((d) => normalizarNome(d.nome) === normalizarNome(f.nome)), (d) => d.nome, `Mais de ${nivel === 'disciplina' ? 'uma disciplina' : 'um docente'} “${f.nome}” no curso ${curso.nome} (${campus.nome}). Escolha qual corresponde ao da ficha.`);
          if (casado === 'pendente') continue;
          const rotuloAqui = `${rotulo} em ${curso.nome} (${campus.nome})`;
          let novoCurso: Curso;
          if (casado === null) {
            const fonte = fonteDe(conjunto, f.fonte);
            const base = { id: novoId(curso.id, f.nome), nome: f.nome, origem: 'importado' as const, ...(fonte && { fonte }) };
            if (nivel === 'disciplina') novoCurso = { ...curso, disciplinas: [...curso.disciplinas, base] };
            else {
              const t = (f as DocenteFicha).titulacao;
              novoCurso = { ...curso, docentes: [...curso.docentes, { ...base, ...(t && { titulacao: t }) }] };
            }
            itens.push({ nivel, rotulo: rotuloAqui, acao: 'incluir' });
            vinculosNovos.push({ de: rotulo, para: `${curso.nome} (${campus.nome})` });
            mudou = true;
          } else {
            vinculosPreservados++;
            if (nivel === 'docente') {
              const d = casado as Docente;
              const t = campo(rotuloAqui, 'titulação', `${idP}:titulacao`, d.titulacao, (f as DocenteFicha).titulacao);
              novoCurso = { ...curso, docentes: curso.docentes.map((x) => (x.id === d.id ? { ...d, ...(t.valor && { titulacao: t.valor }) } : x)) };
              itens.push({ nivel, rotulo: rotuloAqui, acao: t.mudou ? 'atualizar' : 'sem-mudanca' });
              mudou ||= t.mudou;
            } else {
              novoCurso = curso;
              itens.push({ nivel, rotulo: rotuloAqui, acao: 'sem-mudanca' });
            }
          }
          inst.campi[ic] = { ...campus, cursos: campus.cursos.map((u) => (u.id === idCurso ? novoCurso : u)) };
        }
      }
    }
  };
  pessoas(ficha.disciplinas, 'disciplina');
  pessoas(ficha.docentes, 'docente');

  // --- Manuais e perfis ---------------------------------------------------------------------------------------
  const idsCursos = (chaves: readonly string[] | undefined): string[] => unicos((chaves ?? []).flatMap((k) => (cursosDaChave.get(k) ?? []).map((x) => x.id)));
  const aplicacao = (cursos: readonly string[] | undefined, tipos: readonly TipoTrabalhoUft[] | undefined): AplicacaoRegra | undefined => {
    const c = idsCursos(cursos);
    const a: AplicacaoRegra = { ...(c.length > 0 && { cursos: c }), ...(tipos?.length ? { tipos: [...tipos] } : {}) };
    return Object.keys(a).length > 0 ? a : undefined;
  };
  const igualAplicacao = (a: AplicacaoRegra, b: AplicacaoRegra) => estavel({ c: [...(a.cursos ?? [])].sort(), t: [...(a.tipos ?? [])].sort() }) === estavel({ c: [...(b.cursos ?? [])].sort(), t: [...(b.tipos ?? [])].sort() });

  const manuais = [...(inst.manuais ?? [])];
  const manualDaChave = new Map<string, string>();
  for (const fm of ficha.manuais) {
    const rotulo = fm.edicao ? `${fm.titulo} (${fm.edicao})` : fm.titulo;
    for (const c of ['edicao', 'data'] as const) if (fm[c] === undefined) faltantes.push({ rotulo, campo: c === 'edicao' ? 'edição' : 'data', desconhecido: (fm.desconhecidos ?? []).includes(c) });
    if (fm.url === undefined && fm.arquivo === undefined) faltantes.push({ rotulo, campo: 'link ou arquivo de origem', desconhecido: false });
    const casado = casar(`manual:${fm.chave}`, manuais.filter((m) => normalizarNome(m.titulo) === normalizarNome(fm.titulo) && normalizarNome(m.edicao ?? '') === normalizarNome(fm.edicao ?? '')), (m) => m.titulo, `Mais de um manual “${rotulo}” no catálogo. Escolha qual corresponde ao da ficha.`);
    if (casado === 'pendente') continue;
    const aplicaA = aplicacao(fm.cursos, fm.tipos);
    if (casado === null) {
      const fonte = fonteDe('manuais', fm.fonte);
      const novo: ManualInstitucional = {
        id: novoId(`${inst.id}-manual`, fm.titulo),
        titulo: fm.titulo,
        ...(fm.url && { url: fm.url }),
        ...(fm.arquivo && { arquivo: fm.arquivo }),
        ...(fm.edicao && { edicao: fm.edicao }),
        ...(fm.data && { data: fm.data }),
        ...(aplicaA && { aplicaA }),
        origem: 'importado',
        ...(fonte && { fonte }),
      };
      manuais.push(novo);
      manualDaChave.set(fm.chave, novo.id);
      itens.push({ nivel: 'manual', rotulo, acao: 'incluir' });
      mudou = true;
    } else {
      const idC = `manual:${fm.chave}`;
      const url = campo(rotulo, 'link', `${idC}:url`, casado.url, fm.url);
      const arquivo = campo(rotulo, 'arquivo', `${idC}:arquivo`, casado.arquivo, fm.arquivo);
      const data = campo(rotulo, 'data', `${idC}:data`, casado.data, fm.data);
      const ap = campo(rotulo, 'aplica-se a', `${idC}:aplicaA`, casado.aplicaA, aplicaA, igualAplicacao);
      const alterado = url.mudou || arquivo.mudou || data.mudou || ap.mudou;
      const { url: _u, arquivo: _a, data: _d, aplicaA: _ap, ...resto } = casado;
      manuais[manuais.indexOf(casado)] = { ...resto, ...(url.valor && { url: url.valor }), ...(arquivo.valor && { arquivo: arquivo.valor }), ...(data.valor && { data: data.valor }), ...(ap.valor && { aplicaA: ap.valor }) };
      manualDaChave.set(fm.chave, casado.id);
      itens.push({ nivel: 'manual', rotulo, acao: alterado ? 'atualizar' : 'sem-mudanca' });
      mudou ||= alterado;
    }
  }

  const perfis = [...(inst.perfisInstitucionais ?? [])];
  for (const fp of ficha.perfis) {
    const rotulo = fp.nome;
    if (fp.manual !== undefined && !ficha.manuais.some((m) => m.chave === fp.manual)) {
      pendencias.push({ id: `perfil:${fp.chave}:manual`, tipo: 'incompleta', mensagem: `O perfil “${fp.nome}” cita um manual (“${fp.manual}”) que não está na ficha: a fonte do perfil fica sem o manual.` });
    }
    const casado = casar(`perfil:${fp.chave}`, perfis.filter((x) => normalizarNome(x.nome) === normalizarNome(fp.nome)), (x) => x.nome, `Mais de um perfil “${fp.nome}” no catálogo. Escolha qual corresponde ao da ficha.`);
    if (casado === 'pendente') continue;
    const aplicaA = aplicacao(fp.cursos, fp.tipos);
    const manual = fp.manual !== undefined ? manualDaChave.get(fp.manual) : undefined;
    const instrucoes = fp.instrucoes?.length ? [...fp.instrucoes] : undefined;
    if (casado === null) {
      const novo: PerfilInstitucional = {
        id: novoId(`${inst.id}-perfil`, fp.nome),
        nome: fp.nome,
        ...(manual && { manual }),
        ...(fp.secao && { secao: fp.secao }),
        regras: fp.regras,
        ...(instrucoes && { instrucoes }),
        ...(aplicaA && { aplicaA }),
        revisado: false,
        origem: 'importado',
      };
      perfis.push(novo);
      itens.push({ nivel: 'perfil', rotulo, acao: 'incluir', detalhe: 'Chega sem revisão: revise no catálogo antes de usar num trabalho.' });
      mudou = true;
    } else {
      const idC = `perfil:${fp.chave}`;
      const regras = campo(rotulo, 'regras de formatação', `${idC}:regras`, casado.regras, fp.regras, (a, b) => estavel(a) === estavel(b));
      const secao = campo(rotulo, 'seção do manual', `${idC}:secao`, casado.secao, fp.secao);
      const instr = campo(rotulo, 'instruções', `${idC}:instrucoes`, casado.instrucoes, instrucoes, (a, b) => estavel(a) === estavel(b));
      const ap = campo(rotulo, 'aplica-se a', `${idC}:aplicaA`, casado.aplicaA, aplicaA, igualAplicacao);
      const man = campo(rotulo, 'manual', `${idC}:manual`, casado.manual, manual);
      const alterado = regras.mudou || secao.mudou || instr.mudou || ap.mudou || man.mudou;
      const { secao: _s, instrucoes: _i, aplicaA: _a, manual: _m, ...resto } = casado;
      perfis[perfis.indexOf(casado)] = {
        ...resto,
        regras: regras.valor!,
        ...(secao.valor && { secao: secao.valor }),
        ...(instr.valor && { instrucoes: instr.valor }),
        ...(ap.valor && { aplicaA: ap.valor }),
        ...(man.valor && { manual: man.valor }),
        // Regras trocadas pela ficha precisam de nova revisão.
        revisado: regras.mudou ? false : casado.revisado,
      };
      itens.push({ nivel: 'perfil', rotulo, acao: alterado ? 'atualizar' : 'sem-mudanca', ...(regras.mudou && { detalhe: 'Regras trocadas: revise de novo antes de usar.' }) });
      mudou ||= alterado;
    }
  }
  if (manuais.length > 0) inst.manuais = manuais;
  if (perfis.length > 0) inst.perfisInstitucionais = perfis;

  // Conjuntos sem fonte (nem a do conjunto nem a dos registros).
  const semFonte = (conjunto: ConjuntoFicha, registros: readonly { fonte?: FonteRegistro }[], rotulo: string) => {
    if (registros.length > 0 && ficha.fontes[conjunto] === undefined && registros.some((r) => r.fonte === undefined)) faltantes.push({ rotulo, campo: 'fonte pública', desconhecido: false });
  };
  if (ficha.fontes.instituicao === undefined) faltantes.push({ rotulo: rotuloInst, campo: 'fonte pública', desconhecido: false });
  semFonte('campi', ficha.campi, 'Câmpus ou polos');
  semFonte('cursos', ficha.cursos, 'Cursos');
  semFonte('disciplinas', ficha.disciplinas, 'Disciplinas');
  semFonte('docentes', ficha.docentes, 'Docentes');
  semFonte('manuais', ficha.manuais, 'Manuais');

  const aguardaRevisao = pendencias.some((p) => p.tipo === 'ambigua' && (p.escolha === undefined || (p.escolha !== NOVO_REGISTRO && !p.opcoes?.some((o) => o.id === p.escolha))));
  const instituicoes = casadaInst === null ? [...catalogo.instituicoes, inst] : catalogo.instituicoes.map((i) => (i.id === casadaInst.id ? inst : i));
  return {
    previa: { itens, vinculosNovos, vinculosPreservados, faltantes, conflitos, pendencias, aguardaRevisao, semMudancas: !mudou },
    catalogo: mudou ? { ...catalogo, instituicoes } : catalogo,
    instituicao: inst.id,
  };
}

/** Perfis institucionais que valem para o curso e o tipo de trabalho escolhidos. */
export function perfisAplicaveis(inst: Instituicao | undefined, curso: string | undefined, tipo: string | undefined): PerfilInstitucional[] {
  return (inst?.perfisInstitucionais ?? []).filter((p) => {
    const cursos = p.aplicaA?.cursos ?? [];
    const tipos = p.aplicaA?.tipos ?? [];
    return (cursos.length === 0 || (curso !== undefined && cursos.includes(curso))) && (tipos.length === 0 || (tipo !== undefined && (tipos as readonly string[]).includes(tipo)));
  });
}

/** Contagem de registros de uma instituição (para conferir duplicatas). */
export function contarRegistros(inst: Instituicao): { campi: number; cursos: number; disciplinas: number; docentes: number; manuais: number; perfis: number } {
  const cursos = inst.campi.flatMap((k) => k.cursos);
  return {
    campi: inst.campi.length,
    cursos: cursos.length,
    disciplinas: cursos.reduce((n, u) => n + u.disciplinas.length, 0),
    docentes: cursos.reduce((n, u) => n + u.docentes.length, 0),
    manuais: inst.manuais?.length ?? 0,
    perfis: inst.perfisInstitucionais?.length ?? 0,
  };
}

