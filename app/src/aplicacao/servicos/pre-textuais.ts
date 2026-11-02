/**
 * Edição dos dados de identificação e dos elementos pré-textuais (M2-T08), em funções puras usadas pela `SessaoTrabalho`.
 *
 * Forma única: campo vazio sai do objeto (os esquemas recusam texto vazio). O texto digitado é limpo antes de entrar no
 * modelo (caracteres que o XML 1.0 não aceita e o limite do esquema), porque o arquivo inválido não pode ser gravado.
 */
import { LIMITES_V1, PADRAO_TEXTO_XML } from '../../dominio/esquemas';
import {
  ORDEM_PRE_TEXTUAIS,
  type ElementoPreTextual,
  type ElementoPreTextualId,
  type IdiomaResumo,
  type MembroBanca,
  type Metadados,
  type PessoaTitulada,
} from '../../dominio/modelo';

/** Campos de texto simples de `Metadados` (título e subtítulo têm trechos; `bolsista` é marca). */
export type CampoTextoDados = 'autoria' | 'instituicao' | 'campus' | 'curso' | 'volume' | 'local' | 'ano' | 'natureza' | 'areaConcentracao';

export type AlteracaoDados =
  | { campo: CampoTextoDados; valor: string }
  | { campo: 'orientador' | 'coorientador'; valor: PessoaTitulada }
  | { campo: 'bolsista'; valor: boolean };

export interface CamposElemento {
  texto?: string;
  palavrasChave?: readonly string[];
  idioma?: IdiomaResumo;
  dataAprovacao?: string;
  banca?: readonly MembroBanca[];
}

const CAMPOS_POR_TIPO: Partial<Readonly<Record<ElementoPreTextualId, readonly (keyof CamposElemento)[]>>> = {
  fichaCatalografica: ['texto'],
  errata: ['texto'],
  dedicatoria: ['texto'],
  agradecimentos: ['texto'],
  epigrafe: ['texto'],
  resumo: ['texto', 'palavrasChave'],
  abstract: ['idioma', 'texto', 'palavrasChave'],
  folhaAprovacao: ['dataAprovacao', 'banca'],
};

/** Tira o que o XML 1.0 não aceita (sobra só tabulação e quebra de linha entre os controles) e respeita o limite. */
export function limparTexto(texto: string, limite: number): string {
  let limpo = texto.replace(/\r\n?/g, '\n');
  if (!PADRAO_TEXTO_XML.test(limpo)) {
    limpo = Array.from(limpo)
      .filter((c) => PADRAO_TEXTO_XML.test(c))
      .join('');
  }
  if (limpo.length <= limite) return limpo;
  // Não deixa metade de um par substituto no corte.
  const corte = limpo.slice(0, limite);
  return /[\uD800-\uDBFF]$/.test(corte) ? corte.slice(0, -1) : corte;
}

const curto = (v: string): string => limparTexto(v, LIMITES_V1.campoCurto);

function pessoa(p: PessoaTitulada): PessoaTitulada | undefined {
  const nome = curto(p.nome ?? '');
  const titulacao = curto(p.titulacao ?? '');
  if (nome === '' && titulacao === '') return undefined;
  return { ...(nome !== '' && { nome }), ...(titulacao !== '' && { titulacao }) };
}

function membro(m: MembroBanca): MembroBanca {
  const nome = curto(m.nome ?? '');
  const titulacao = curto(m.titulacao ?? '');
  const instituicao = curto(m.instituicao ?? '');
  return { ...(nome !== '' && { nome }), ...(titulacao !== '' && { titulacao }), ...(instituicao !== '' && { instituicao }) };
}

/** Metadados com a alteração; o mesmo objeto se nada mudou. */
export function aplicarDados(m: Metadados, a: AlteracaoDados): Metadados {
  const copia = { ...m };
  if (a.campo === 'bolsista') {
    if (a.valor) copia.bolsista = true;
    else delete copia.bolsista;
  } else if (a.campo === 'orientador' || a.campo === 'coorientador') {
    const p = pessoa(a.valor);
    if (p) copia[a.campo] = p;
    else delete copia[a.campo];
    if (JSON.stringify(p) === JSON.stringify(m[a.campo])) return m;
    return copia;
  } else if (typeof a.valor === 'string') {
    const v = curto(a.valor);
    if (v !== '') copia[a.campo] = v;
    else delete copia[a.campo];
  }
  return copia[a.campo] === m[a.campo] ? m : copia;
}

/** Palavras-chave de um texto separado por ponto e vírgula. O ponto final vem da formatação (RN-156), não do autor. */
export function palavrasChaveDoTexto(texto: string): string[] {
  return texto
    .split(';')
    .map((p) => p.trim().replace(/\.+$/u, '').trim())
    .filter((p) => p !== '');
}

/** Elemento com os campos alterados (só os que o tipo tem); o mesmo objeto se nada mudou. */
export function aplicarCampos(e: ElementoPreTextual, campos: CamposElemento): ElementoPreTextual {
  const permitidos = CAMPOS_POR_TIPO[e.tipo] ?? [];
  const novo: Record<string, unknown> = { ...e };
  for (const k of permitidos) {
    if (!(k in campos)) continue;
    delete novo[k];
    if (k === 'texto') {
      const v = limparTexto(campos.texto ?? '', LIMITES_V1.textoInline);
      if (v !== '') novo.texto = v;
    } else if (k === 'dataAprovacao') {
      const v = curto(campos.dataAprovacao ?? '');
      if (v !== '') novo.dataAprovacao = v;
    } else if (k === 'idioma') {
      if (campos.idioma !== undefined) novo.idioma = campos.idioma;
    } else if (k === 'palavrasChave') {
      const v = (campos.palavrasChave ?? []).map(curto).filter((p) => p !== '').slice(0, LIMITES_V1.palavrasChave);
      if (v.length > 0) novo.palavrasChave = v;
    } else {
      const v = (campos.banca ?? []).slice(0, LIMITES_V1.membrosBanca).map(membro);
      if (v.length > 0) novo.banca = v;
    }
  }
  const resultado = novo as unknown as ElementoPreTextual;
  return JSON.stringify(resultado) === JSON.stringify(e) ? e : resultado;
}

/** Lista com o elemento no lugar dele na ordem do Quadro 5. */
export function comElemento(lista: readonly ElementoPreTextual[], e: ElementoPreTextual): ElementoPreTextual[] {
  const posicao = ORDEM_PRE_TEXTUAIS.indexOf(e.tipo);
  const i = lista.findIndex((x) => ORDEM_PRE_TEXTUAIS.indexOf(x.tipo) > posicao);
  return i < 0 ? [...lista, e] : [...lista.slice(0, i), e, ...lista.slice(i)];
}
