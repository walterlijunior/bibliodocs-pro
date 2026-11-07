/**
 * Cadastro de obras (M4-T06; RF-08), em funções puras usadas pela `SessaoTrabalho` e pela tela.
 *
 * - Cada tipo mostra só os seus campos (`CAMPOS_DO_TIPO`), na ordem em que aparecem na referência (Manual, 5.19).
 * - Forma única: `prepararObra` tira o que não é do tipo, apara o texto, limpa o que o XML 1.0 não aceita e deixa ausente
 *   o que ficou vazio. Só a obra que o documento aceitaria é gravada (`validarObra`).
 */
import { formatarReferencia, tiposComFormatador, type AvisoReferencia, type TrechoReferencia } from '../../dominio/bibliografia';
import { LIMITES_V1, validarObraV1, type ErroValidacao } from '../../dominio/esquemas';
import type { Autor, EventoObra, InlineDeTitulo, Obra, ObraNoTodo, TipoObra } from '../../dominio/modelo';
import { limparTexto } from './pre-textuais';

export type CampoTextoObra =
  | 'traducao'
  | 'local'
  | 'editora'
  | 'paginas'
  | 'volume'
  | 'numero'
  | 'periodico'
  | 'secao'
  | 'dataPublicacao'
  | 'natureza'
  | 'instituicao'
  | 'programa'
  | 'jurisdicao'
  | 'identificacao'
  | 'ementa'
  | 'publicacao'
  | 'url'
  | 'acesso'
  | 'doi'
  | 'colecao'
  | 'tituloOriginal'
  | 'suplemento'
  | 'anoVeiculo';
export type CampoNumeroObra = 'edicao' | 'ano' | 'folhas';
export type CampoObra = 'autores' | 'funcao' | 'titulo' | 'subtitulo' | 'anoIncerto' | 'ebook' | 'noTodo' | 'evento' | CampoTextoObra | CampoNumeroObra;

const ONLINE: readonly CampoObra[] = ['url', 'acesso'];

/** Campos de cada tipo, na ordem da referência (padrões das p. 50–60 do Manual). */
export const CAMPOS_DO_TIPO: Readonly<Record<TipoObra, readonly CampoObra[]>> = {
  livro: ['autores', 'funcao', 'titulo', 'subtitulo', 'traducao', 'edicao', 'local', 'editora', 'ano', 'anoIncerto', 'paginas', 'colecao', 'tituloOriginal', ...ONLINE, 'ebook'],
  capitulo: ['autores', 'titulo', 'subtitulo', 'noTodo', 'edicao', 'local', 'editora', 'ano', 'anoIncerto', 'volume', 'paginas', ...ONLINE],
  trabalhoAcademico: ['autores', 'titulo', 'subtitulo', 'ano', 'anoIncerto', 'folhas', 'natureza', 'instituicao', 'programa', 'local', ...ONLINE],
  artigoPeriodico: ['autores', 'titulo', 'subtitulo', 'periodico', 'local', 'volume', 'numero', 'paginas', 'dataPublicacao', 'ano', 'anoIncerto', 'suplemento', 'doi', ...ONLINE],
  trabalhoEvento: ['autores', 'titulo', 'subtitulo', 'evento', 'noTodo', 'local', 'editora', 'ano', 'anoIncerto', 'paginas', ...ONLINE],
  artigoJornal: ['autores', 'titulo', 'subtitulo', 'periodico', 'local', 'dataPublicacao', 'ano', 'anoIncerto', 'secao', 'paginas', ...ONLINE],
  norma: ['autores', 'identificacao', 'titulo', 'subtitulo', 'edicao', 'local', 'editora', 'ano', 'anoIncerto', 'paginas', ...ONLINE],
  legislacao: ['jurisdicao', 'autores', 'identificacao', 'titulo', 'subtitulo', 'ementa', 'publicacao', 'secao', 'local', 'anoVeiculo', 'numero', 'paginas', 'dataPublicacao', 'editora', 'ano', 'anoIncerto', ...ONLINE],
  documentoOnline: ['autores', 'titulo', 'subtitulo', 'local', 'editora', 'ano', 'anoIncerto', ...ONLINE],
};

const CAMPOS_TEXTO: readonly CampoTextoObra[] = [
  'traducao', 'local', 'editora', 'paginas', 'volume', 'numero', 'periodico', 'secao', 'dataPublicacao', 'natureza', 'instituicao',
  'programa', 'jurisdicao', 'identificacao', 'ementa', 'publicacao', 'url', 'acesso', 'doi', 'colecao', 'tituloOriginal', 'suplemento', 'anoVeiculo',
];
const CAMPOS_NUMERO: readonly CampoNumeroObra[] = ['edicao', 'ano', 'folhas'];

const curto = (v: string): string => limparTexto(v, LIMITES_V1.campoCurto).trim();

function trechos(t: readonly InlineDeTitulo[] | undefined): InlineDeTitulo[] {
  const saida = (t ?? []).map((i) => ({ ...i, texto: limparTexto(i.texto, LIMITES_V1.campoCurto) })).filter((i) => i.texto !== '');
  // Espaço das pontas fora, como nos outros campos.
  if (saida.length > 0) {
    saida[0] = { ...saida[0]!, texto: saida[0]!.texto.replace(/^\s+/u, '') };
    const u = saida.length - 1;
    saida[u] = { ...saida[u]!, texto: saida[u]!.texto.replace(/\s+$/u, '') };
  }
  return saida.filter((i) => i.texto !== '');
}

function autoresLimpos(lista: readonly Autor[] | undefined): Autor[] {
  const saida: Autor[] = [];
  for (const a of lista ?? []) {
    if (a.tipo === 'entidade') {
      const nome = curto(a.nome);
      if (nome !== '') saida.push({ tipo: 'entidade', nome });
    } else {
      const sobrenome = curto(a.sobrenome);
      const prenomes = curto(a.prenomes ?? '');
      if (sobrenome !== '' || prenomes !== '') saida.push({ tipo: 'pessoa', sobrenome, ...(prenomes !== '' && { prenomes }) });
    }
  }
  return saida;
}

function noTodoLimpo(t: ObraNoTodo | undefined, tipo: TipoObra): ObraNoTodo | undefined {
  if (t === undefined) return undefined;
  const autores = tipo === 'capitulo' ? autoresLimpos(t.autores) : [];
  const titulo = trechos(t.titulo);
  const subtitulo = tipo === 'capitulo' ? trechos(t.subtitulo) : [];
  if (autores.length === 0 && titulo.length === 0 && subtitulo.length === 0) return undefined;
  return {
    ...(autores.length > 0 && { autores }),
    ...(autores.length > 0 && t.funcao && { funcao: t.funcao }),
    titulo,
    ...(subtitulo.length > 0 && { subtitulo }),
  };
}

function eventoLimpo(e: EventoObra | undefined): EventoObra | undefined {
  if (e === undefined) return undefined;
  const nome = curto(e.nome);
  const local = curto(e.local ?? '');
  const numero = inteiroOuNada(e.numero);
  const ano = inteiroOuNada(e.ano);
  if (nome === '' && local === '' && numero === undefined && ano === undefined) return undefined;
  return { nome, ...(numero !== undefined && { numero }), ...(ano !== undefined && { ano }), ...(local !== '' && { local }) };
}

const inteiroOuNada = (n: number | undefined): number | undefined => (n !== undefined && Number.isInteger(n) && n >= 1 ? n : undefined);

/** A obra na forma única do formato, só com os campos do tipo. Não valida: veja `validarObra`. */
export function prepararObra(o: Obra): Obra {
  const campos = new Set(CAMPOS_DO_TIPO[o.tipo]);
  const tem = (c: CampoObra) => campos.has(c);
  const saida: Record<string, unknown> = { id: o.id, tipo: o.tipo };
  const autores = tem('autores') ? autoresLimpos(o.autores) : [];
  if (autores.length > 0) saida['autores'] = autores;
  if (tem('funcao') && autores.length > 0 && o.funcao) saida['funcao'] = o.funcao;
  saida['titulo'] = trechos(o.titulo);
  const subtitulo = tem('subtitulo') ? trechos(o.subtitulo) : [];
  if (subtitulo.length > 0) saida['subtitulo'] = subtitulo;
  for (const c of CAMPOS_NUMERO) {
    const n = tem(c) ? inteiroOuNada(o[c]) : undefined;
    if (n !== undefined) saida[c] = n;
  }
  if (tem('anoIncerto') && saida['ano'] !== undefined && o.anoIncerto) saida['anoIncerto'] = o.anoIncerto;
  for (const c of CAMPOS_TEXTO) {
    const v = tem(c) ? (c === 'ementa' ? limparTexto(o[c] ?? '', LIMITES_V1.textoInline).trim() : curto(o[c] ?? '')) : '';
    if (v !== '') saida[c] = v;
  }
  if (tem('ebook') && o.ebook) saida['ebook'] = true;
  const noTodo = tem('noTodo') ? noTodoLimpo(o.noTodo, o.tipo) : undefined;
  if (noTodo) saida['noTodo'] = noTodo;
  const evento = tem('evento') ? eventoLimpo(o.evento) : undefined;
  if (evento) saida['evento'] = evento;
  return saida as unknown as Obra;
}

export type ResultadoValidacaoObra = { ok: true; obra: Obra } | { ok: false; erros: readonly ErroValidacao[] };

/** Prepara e confere a obra com o esquema do formato v1: a obra que passa é a que será gravada. */
export function validarObra(o: Obra): ResultadoValidacaoObra {
  const preparada = prepararObra(o);
  const r = validarObraV1(preparada);
  // A saída do esquema, com as chaves na ordem dele: a mesma obra grava sempre os mesmos bytes.
  return r.ok ? { ok: true, obra: r.valor } : { ok: false, erros: r.erros };
}

/** Obra nova de um tipo, ainda sem título (o cadastro só grava quando houver). */
export function obraVazia(id: string, tipo: TipoObra): Obra {
  return { id, tipo, titulo: [] };
}

export interface PreviaObra {
  /** Referência como sairá na lista, com o destaque (RN-178). */
  trechos: readonly TrechoReferencia[];
  /** Elementos que faltam na referência (não impedem gravar). */
  avisos: readonly AvisoReferencia[];
  /** O que impede gravar, com o caminho a partir de `obra`. */
  erros: readonly ErroValidacao[];
}

/** Prévia do cadastro: a referência formatada da obra preparada e o que falta para gravá-la. */
export function previaDaObra(o: Obra): PreviaObra {
  const preparada = prepararObra(o);
  const v = validarObraV1(preparada);
  const ref = tiposComFormatador().includes(preparada.tipo) ? formatarReferencia(preparada) : { trechos: [], avisos: [] };
  return { trechos: ref.trechos, avisos: ref.avisos, erros: v.ok ? [] : v.erros };
}
