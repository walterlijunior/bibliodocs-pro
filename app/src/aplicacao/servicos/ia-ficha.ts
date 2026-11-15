/**
 * Preenchimento opcional da ficha institucional com IA (Etapa 3 da especificação de atualização, "Preenchimento opcional
 * com IA"). Puro: monta o pedido e converte a resposta numa ficha; quem envia é a porta `ia`, depois da autorização do
 * autor, e a ficha sugerida passa pela mesma prévia da importação (`importarFicha`) antes de entrar no catálogo.
 *
 * - O aplicativo não acessa a página oficial (a rede fica restrita ao serviço de IA, ADR-0005): o autor cola o texto da
 *   página ou do manual, ou abre um arquivo de texto, e informa o endereço de onde veio. Esse endereço vira a fonte dos
 *   registros; o trecho que a IA citou fica na observação da fonte e na lista de origens da prévia.
 * - Os vínculos vêm pelo nome (a IA escreve o nome do câmpus ou do curso); nome que não casa vira pendência na prévia.
 * - As regras do perfil passam pelo mesmo filtro da sugestão do modelo de evento (`lerSugestaoModelo`): só aspectos
 *   conhecidos e valores dentro dos limites. O perfil chega sem revisão (a importação o marca `revisado: false`).
 */
import { normalizarNome, type FichaInstitucional } from '../../dominio/catalogo';
import { validarFicha } from '../../dominio/esquemas';
import { TIPOS_TRABALHO_UFT, type TipoTrabalhoUft } from '../../dominio/modelo';
import type { PedidoIA } from '../portas/ia';
import { lerSugestaoModelo } from './ia';

/** Teto do texto enviado (cerca de 15 mil tokens pela estimativa do aplicativo). */
export const LIMITE_TEXTO_FICHA_IA = 60_000;

export const TITULO_PREENCHER_FICHA = 'Preencher a ficha institucional';

const SISTEMA_FICHA = [
  'Você extrai dados institucionais de textos de universidades brasileiras (páginas oficiais, manuais de normalização, regulamentos) para uma ficha estruturada.',
  'Extraia só o que o texto diz. Não invente nomes, cidades, titulações nem valores; na dúvida, omita o campo ou marque "incerto": true.',
  'Em cada registro, "trecho" é a frase curta do texto de onde a informação veio.',
  'Responda somente com um objeto JSON, sem texto fora dele:',
  '{"instituicao": {"nome": string, "sigla": string},',
  '"campi": [{"nome": string, "especie": "campus" | "polo", "cidade": string, "uf": "duas letras", "trecho": string, "incerto": boolean}],',
  '"cursos": [{"nome": string sem "Curso de" nem o grau, "nivel": "graduacao" | "especializacao" | "mestrado" | "doutorado", "grau": "bacharelado" | "licenciatura" | "tecnologia", "areaConcentracao": string, "campi": [nomes dos câmpus], "trecho": string, "incerto": boolean}],',
  '"disciplinas": [{"nome": string, "cursos": [nomes dos cursos], "trecho": string, "incerto": boolean}],',
  '"docentes": [{"nome": string, "titulacao": "Dr." | "Dra." | "Me." | "Ma." | "Esp.", "cursos": [nomes dos cursos], "trecho": string, "incerto": boolean}],',
  '"manuais": [{"titulo": string, "edicao": string, "data": "AAAA" ou "AAAA-MM-DD", "url": "https://...", "trecho": string, "incerto": boolean}],',
  '"perfis": [{"nome": string, "manual": título do manual, "secao": seção ou página, "regras": {"margemSuperiorCm": número, "margemInferiorCm": número, "margemEsquerdaCm": número, "margemDireitaCm": número, "fonte": string, "corpoPt": número, "entrelinha": "simples" | "1,5" | "duplo", "alinhamento": "esquerda" | "direita" | "centralizado" | "justificado", "recuoPrimeiraLinhaCm": número}, "instrucoes": [exigências que não cabem em "regras"], "tipos": ["monografia" | "artigo-tcc" | "dissertacao" | "tese" | "relatorio-tecnico" | "projeto-pesquisa"], "trecho": string, "incerto": boolean}],',
  '"observacoes": [strings curtas]}.',
  'Listas sem dados ficam vazias.',
].join(' ');

export interface EntradaFichaIA {
  texto: string;
  /** Endereço (https) de onde o texto veio; vira a fonte dos registros. */
  url?: string;
  /** Nome do arquivo, quando o texto veio de um arquivo. */
  arquivo?: string;
  /** Instituição escolhida no catálogo: a ficha sugerida fica presa a ela. */
  instituicao?: { nome: string; sigla: string };
}

export function pedidoPreencherFicha(e: EntradaFichaIA): PedidoIA {
  const cabecalho = [
    e.instituicao ? `Instituição: ${e.instituicao.nome} (${e.instituicao.sigla})` : 'Instituição: identifique pelo texto.',
    e.url ? `Origem do texto: ${e.url}` : e.arquivo ? `Origem do texto: arquivo ${e.arquivo}` : 'Origem do texto: colado pelo autor.',
    '',
    'Texto:',
  ];
  return { mensagens: [{ papel: 'sistema', texto: SISTEMA_FICHA }, { papel: 'usuario', texto: [...cabecalho, e.texto.slice(0, LIMITE_TEXTO_FICHA_IA)].join('\n') }], maxTokens: 4000 };
}

/** De onde veio cada sugestão, para a prévia. */
export interface OrigemSugestao {
  rotulo: string;
  trecho?: string;
  incerto: boolean;
}

export type ResultadoSugestaoFicha = { ok: true; ficha: FichaInstitucional; origens: OrigemSugestao[]; observacoes: string[] } | { ok: false; mensagem: string };

// ---------------------------------------------------------------------------------------------------------

function objetoJson(texto: string): Record<string, unknown> | null {
  const ini = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  try {
    const v = JSON.parse(texto.slice(ini, fim + 1)) as unknown;
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Texto de uma linha, sem controle, até `max`. */
const linha = (v: unknown, max = 300): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return t === '' ? undefined : t.slice(0, max).trim();
};
const lista = (v: unknown, max: number): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)).slice(0, max) : [];
const nomes = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap((x) => (linha(x) ? [linha(x)!] : [])).slice(0, 200) : []);
const umDe = <T extends string>(v: unknown, opcoes: readonly T[]): T | undefined => {
  const n = typeof v === 'string' ? normalizarNome(v).replace(/ /g, '-') : '';
  return opcoes.find((o) => o === n);
};

/** Chave da ficha a partir do nome ("Câmpus de Palmas" → "campus-de-palmas"), única na lista. */
function chaveDe(nome: string, usadas: Set<string>): string {
  const base = normalizarNome(nome).replace(/ /g, '-').slice(0, 90).replace(/-+$/, '') || 'registro';
  let c = /^[a-z0-9]/.test(base) ? base : `r-${base}`;
  for (let n = 2; usadas.has(c); n++) c = `${base.slice(0, 90)}-${n}`;
  usadas.add(c);
  return c;
}

/** Ligação pelo nome: a chave do registro de mesmo nome normalizado, ou uma chave que não existe (vira pendência). */
const ligar = (alvos: ReadonlyMap<string, string>, ref: string): string => alvos.get(normalizarNome(ref)) ?? `sem-${normalizarNome(ref).replace(/ /g, '-').slice(0, 80) || 'nome'}`;

/**
 * Converte a resposta da IA numa ficha. `consultadoEm`: a data de hoje (AAAA-MM-DD), da consulta à fonte informada.
 * Registros sem nome são ignorados; a ficha montada passa pelo esquema antes de voltar.
 */
export function lerSugestaoFicha(resposta: string, e: Omit<EntradaFichaIA, 'texto'>, consultadoEm: string): ResultadoSugestaoFicha {
  const j = objetoJson(resposta);
  if (!j) return { ok: false, mensagem: 'A resposta da IA não veio no formato pedido. Tente de novo ou preencha a ficha à mão.' };
  const origens: OrigemSugestao[] = [];
  const url = e.url && /^https:\/\/[^\s]+$/.test(e.url) ? e.url.slice(0, 500) : undefined;
  const fonteDe = (trecho: string | undefined) =>
    url ? { fonte: { url, consultadoEm, ...(trecho ? { observacao: `Trecho: “${trecho.slice(0, 280)}”` } : {}) } } : {};
  const anotar = (rotulo: string, x: Record<string, unknown>) => {
    const trecho = linha(x['trecho'], 500);
    origens.push({ rotulo, ...(trecho ? { trecho } : {}), incerto: x['incerto'] === true });
    return trecho;
  };

  const ji = (typeof j['instituicao'] === 'object' && j['instituicao'] !== null ? j['instituicao'] : {}) as Record<string, unknown>;
  const instituicao = e.instituicao ?? { nome: linha(ji['nome']) ?? '', sigla: linha(ji['sigla'], 20) ?? '' };
  if (!instituicao.nome || !instituicao.sigla) return { ok: false, mensagem: 'A IA não identificou o nome e a sigla da instituição. Escolha a instituição no catálogo e tente de novo.' };

  const usadas = { campi: new Set<string>(), cursos: new Set<string>(), disciplinas: new Set<string>(), docentes: new Set<string>(), manuais: new Set<string>(), perfis: new Set<string>() };
  const porNome = { campi: new Map<string, string>(), cursos: new Map<string, string>(), manuais: new Map<string, string>() };

  const campi: FichaInstitucional['campi'] = lista(j['campi'], 200).flatMap((x) => {
    const nome = linha(x['nome']);
    if (!nome) return [];
    const chave = chaveDe(nome, usadas.campi);
    porNome.campi.set(normalizarNome(nome), chave);
    const trecho = anotar(`Câmpus ou polo: ${nome}`, x);
    const cidade = linha(x['cidade']);
    const uf = typeof x['uf'] === 'string' && /^[A-Za-z]{2}$/.test(x['uf'].trim()) ? x['uf'].trim().toUpperCase() : undefined;
    return [{ chave, nome, especie: umDe(x['especie'], ['campus', 'polo'] as const) ?? 'campus', ...(cidade ? { cidade } : {}), ...(uf ? { uf } : {}), ...fonteDe(trecho) }];
  });

  const cursosBrutos = lista(j['cursos'], 500).flatMap((x) => {
    const nome = linha(x['nome']);
    const nivel = umDe(x['nivel'], ['graduacao', 'especializacao', 'mestrado', 'doutorado'] as const);
    if (!nome || !nivel) return [];
    const chave = chaveDe(`${nome} ${nivel}`, usadas.cursos);
    porNome.cursos.set(normalizarNome(nome), chave);
    return [{ x, nome, nivel, chave }];
  });
  const cursos: FichaInstitucional['cursos'] = cursosBrutos.map(({ x, nome, nivel, chave }) => {
    const trecho = anotar(`Curso ou programa: ${nome}`, x);
    const grau = nivel === 'graduacao' ? umDe(x['grau'], ['bacharelado', 'licenciatura', 'tecnologia'] as const) : undefined;
    const area = nivel === 'mestrado' || nivel === 'doutorado' ? linha(x['areaConcentracao']) : undefined;
    return { chave, nome, nivel, ...(grau ? { grau } : {}), ...(area ? { areaConcentracao: area } : {}), campi: [...new Set(nomes(x['campi']).map((n) => ligar(porNome.campi, n)))], ...fonteDe(trecho) };
  });

  const vinculados = (x: Record<string, unknown>) => [...new Set(nomes(x['cursos']).map((n) => ligar(porNome.cursos, n)))];
  const disciplinas: FichaInstitucional['disciplinas'] = lista(j['disciplinas'], 500).flatMap((x) => {
    const nome = linha(x['nome']);
    if (!nome) return [];
    const trecho = anotar(`Disciplina: ${nome}`, x);
    return [{ chave: chaveDe(nome, usadas.disciplinas), nome, cursos: vinculados(x), ...fonteDe(trecho) }];
  });
  const docentes: FichaInstitucional['docentes'] = lista(j['docentes'], 1000).flatMap((x) => {
    const nome = linha(x['nome']);
    if (!nome) return [];
    const trecho = anotar(`Docente: ${nome}`, x);
    const titulacao = linha(x['titulacao'], 40);
    return [{ chave: chaveDe(nome, usadas.docentes), nome, ...(titulacao ? { titulacao } : {}), cursos: vinculados(x), ...fonteDe(trecho) }];
  });

  const manuais: FichaInstitucional['manuais'] = lista(j['manuais'], 50).flatMap((x) => {
    const titulo = linha(x['titulo']);
    if (!titulo) return [];
    const chave = chaveDe(titulo, usadas.manuais);
    porNome.manuais.set(normalizarNome(titulo), chave);
    const trecho = anotar(`Manual: ${titulo}`, x);
    const murl = typeof x['url'] === 'string' && /^https:\/\/[^\s]+$/.test(x['url']) && x['url'].length <= 500 ? x['url'] : undefined;
    const edicao = linha(x['edicao'], 60);
    const data = typeof x['data'] === 'string' && /^\d{4}(-\d{2}-\d{2})?$/.test(x['data']) ? x['data'] : undefined;
    return [{ chave, titulo, ...(murl ? { url: murl } : !url && e.arquivo ? { arquivo: e.arquivo.slice(0, 300) } : {}), ...(edicao ? { edicao } : {}), ...(data ? { data } : {}), ...fonteDe(trecho) }];
  });
  const perfis: FichaInstitucional['perfis'] = lista(j['perfis'], 50).flatMap((x) => {
    const nome = linha(x['nome']);
    if (!nome) return [];
    anotar(`Perfil de formatação: ${nome}`, x);
    const regras = lerSugestaoModelo(JSON.stringify(typeof x['regras'] === 'object' && x['regras'] !== null ? x['regras'] : {}))?.regras ?? {};
    const manual = linha(x['manual']);
    const secao = linha(x['secao']);
    const instrucoes = Array.isArray(x['instrucoes']) ? x['instrucoes'].flatMap((t) => (linha(t, 2000) ? [linha(t, 2000)!] : [])).slice(0, 100) : [];
    const tipos = Array.isArray(x['tipos']) ? [...new Set(x['tipos'].filter((t): t is TipoTrabalhoUft => TIPOS_TRABALHO_UFT.includes(t as TipoTrabalhoUft)))] : [];
    return [
      {
        chave: chaveDe(nome, usadas.perfis),
        nome,
        ...(manual ? { manual: ligar(porNome.manuais, manual) } : manuais.length === 1 ? { manual: manuais[0]!.chave } : {}),
        ...(secao ? { secao } : {}),
        regras,
        ...(instrucoes.length > 0 ? { instrucoes } : {}),
        ...(tipos.length > 0 ? { tipos } : {}),
      },
    ];
  });

  const ficha: FichaInstitucional = {
    formato: 'bibliodocs-ficha-institucional',
    versao: 1,
    instituicao: { nome: instituicao.nome.slice(0, 300), sigla: instituicao.sigla.slice(0, 20) },
    fontes: url ? { instituicao: { url, consultadoEm } } : {},
    campi,
    cursos,
    disciplinas,
    docentes,
    manuais,
    perfis,
  };
  const v = validarFicha(ficha);
  if (!v.ok) return { ok: false, mensagem: `A sugestão da IA não forma uma ficha válida (${v.erro}). Tente de novo ou preencha a ficha à mão.` };
  const observacoes = Array.isArray(j['observacoes']) ? j['observacoes'].flatMap((o) => (linha(o, 500) ? [linha(o, 500)!] : [])).slice(0, 20) : [];
  return { ok: true, ficha, origens, observacoes };
}

/** Texto de um arquivo para a IA: HTML vira texto (sem marcação, scripts nem estilos); o resto vai como está. */
export function textoDoArquivoFicha(nome: string, conteudo: string): string {
  if (!/\.html?$/i.test(nome)) return conteudo;
  return conteudo
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
