/**
 * Verificador da bibliografia (M4-T08; RN-078, RN-096, RN-182): confere citações × referências e a consistência das
 * obras. Só diagnostica; nunca muda o documento. O verificador completo de conformidade é do M7.
 *
 * - CHAMADA_SEM_LIGACAO: texto que parece chamada, "(SILVA, 2001)" ou "Silva (2001)", escrito à mão e não ligado a
 *   obra. É a citação órfã possível no formato v1: a ligada sempre tem obra (a leitura recusa a que não tem). Busca
 *   heurística: aviso, nunca erro.
 * - OBRA_NAO_CITADA: obra da bibliografia sem chamada no texto nem nas notas (RN-078). Com "incluir as não citadas" no
 *   elemento REFERÊNCIAS, ela sai na lista e o aviso diz isso.
 * - REFERENCIAS_AUSENTES: há citação e o trabalho não tem o elemento REFERÊNCIAS (RN-078).
 * - CHAMADA_AMBIGUA: autores diferentes, mesmo sobrenome e ano: a chamada não distingue as obras e o sufixo a, b não se
 *   aplica (D-M4-03, que só o dá à mesma autoria).
 * - GRAFIA_DIVERGENTE: a mesma pessoa parece escrita de formas diferentes em obras diferentes (D-M4-10, provisório):
 *   mesmo sobrenome sem distinguir acentos e maiúsculas, prenomes com as mesmas iniciais, grafias diferentes. A lista
 *   ordenaria as formas separadas.
 * - PRENOMES_NAO_UNIFORMES: na lista, prenomes por extenso e abreviados misturados (RN-182, C-B10: fica como digitado,
 *   com aviso).
 * - CHAMADA_COM_AVISO e REFERENCIA_INCOMPLETA: os avisos dos formatadores (obra sem ano, elemento que falta…).
 */
import {
  contextoDeChamadas,
  formatarChamada,
  formatarReferencia,
  ordenarReferencias,
  type EdicaoNbr10520,
} from '../bibliografia';
import { conteudosDoBloco, type Autor, type Documento, type Id, type Inline, type InlineCitacao, type Obra, type Secao } from '../modelo';

export type CodigoProblemaBibliografia =
  | 'REFERENCIAS_AUSENTES'
  | 'CHAMADA_SEM_LIGACAO'
  | 'OBRA_NAO_CITADA'
  | 'CHAMADA_AMBIGUA'
  | 'GRAFIA_DIVERGENTE'
  | 'PRENOMES_NAO_UNIFORMES'
  | 'CHAMADA_COM_AVISO'
  | 'REFERENCIA_INCOMPLETA';

/** Onde está o problema: uma obra, um ponto do texto (o nó com id mais próximo) ou o trabalho todo. */
export type LocalProblema =
  | { tipo: 'obra'; obra: Id }
  | { tipo: 'texto'; secao: Id; no: Id; trecho: string }
  | { tipo: 'trabalho' };

export interface ProblemaBibliografia {
  codigo: CodigoProblemaBibliografia;
  gravidade: 'erro' | 'aviso';
  /** RN ou decisão de onde vem a conferência. */
  origem: readonly string[];
  mensagem: string;
  local: LocalProblema;
}

export interface OpcoesVerificacao {
  edicaoNbr10520?: EdicaoNbr10520;
  listarTodosAutores?: boolean;
}

const LOCALE = 'pt-BR';
const semAcento = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase(LOCALE).trim();

/** Ponto de leitura de um conteúdo: a seção e o nó com id que o contém (bloco ou nota). */
interface Trecho {
  secao: Id;
  no: Id;
  conteudo: readonly Inline[];
}

function trechosDoCorpo(corpo: readonly Secao[]): Trecho[] {
  const saida: Trecho[] = [];
  const visitar = (s: Secao) => {
    for (const b of s.blocos) {
      for (const c of conteudosDoBloco(b)) {
        saida.push({ secao: s.id, no: b.id, conteudo: c });
        for (const i of c) if (i.tipo === 'nota') saida.push({ secao: s.id, no: i.id, conteudo: i.conteudo });
      }
    }
    s.subsecoes.forEach(visitar);
  };
  corpo.forEach(visitar);
  return saida;
}

function citacoesComLocal(corpo: readonly Secao[]): { citacao: InlineCitacao; secao: Id }[] {
  return trechosDoCorpo(corpo).flatMap((t) => t.conteudo.flatMap((i) => (i.tipo === 'citacao' ? [{ citacao: i, secao: t.secao }] : [])));
}

// Ano: 2001, 2001a, [2001], [2001?]. Depois do ano, página ou outra obra, sem parênteses dentro.
const ANO = String.raw`\[?\d{4}[a-z]?\??\]?`;
const PARENTETICA = new RegExp(String.raw`\((\p{Lu}[^()]{0,200}?),\s*${ANO}(?:[,;][^()]{0,200})?\)`, 'gu');
// Narrativa: "Silva (2001)", "Silva Neto (2001)" (RN-181), "Aranha e Martins (1993)", "Lima, Costa e Souza (2010)",
// "Lima et al. (2010)". Só o sobrenome com parentesco junta duas palavras: "Conforme Costa (2001)" acha "Costa (2001)".
// A lista de sobrenomes vai até 11: sem teto, uma lista longa sem "(" custaria tempo quadrático (R-M4-07).
const SOBRENOME = String.raw`\p{Lu}[\p{L}'’-]+(?: (?:Neto|Filho|Júnior|Junior|Sobrinho))?`;
const NARRATIVA = new RegExp(String.raw`(?<![\p{L}\p{N}])${SOBRENOME}(?:, ${SOBRENOME}){0,10}(?: e ${SOBRENOME})?(?: et al\.)? \(${ANO}(?:,[^()]{0,200})?\)`, 'gu');

/** Chamadas escritas no texto (só os trechos de texto entre os nós; o texto não atravessa nota nem chamada). */
export function chamadasEscritas(conteudo: readonly Inline[]): string[] {
  const achadas: string[] = [];
  let texto = '';
  const procurar = () => {
    const vistas: { inicio: number; fim: number; t: string }[] = [];
    for (const re of [PARENTETICA, NARRATIVA]) {
      for (const m of texto.matchAll(re)) vistas.push({ inicio: m.index, fim: m.index + m[0].length, t: m[0] });
    }
    vistas.sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
    let fim = -1;
    for (const v of vistas) {
      if (v.inicio < fim) continue;
      achadas.push(v.t);
      fim = v.fim;
    }
    texto = '';
  };
  for (const i of conteudo) {
    if (i.tipo === 'texto') texto += i.texto;
    else procurar();
  }
  procurar();
  return achadas;
}

const ehParticula = (p: string): boolean => /^(da|das|de|do|dos|e|d')$/iu.test(p);
const ehInicial = (p: string): boolean => /^\p{Lu}\.(?:-\p{Lu}\.)?$/u.test(p);

function palavrasDosPrenomes(prenomes: string | undefined): string[] {
  return (prenomes ?? '')
    .split(/\s+/u)
    .map((p) => p.trim())
    .filter((p) => p !== '' && !ehParticula(p));
}

/** 'extenso' (Luiz Carlos), 'abreviado' (L. C.), 'misto' (Luiz C.) ou null sem prenomes. */
function formaDosPrenomes(prenomes: string | undefined): 'extenso' | 'abreviado' | 'misto' | null {
  const p = palavrasDosPrenomes(prenomes);
  if (p.length === 0) return null;
  const iniciais = p.filter(ehInicial).length;
  return iniciais === 0 ? 'extenso' : iniciais === p.length ? 'abreviado' : 'misto';
}

const iniciaisDe = (prenomes: string | undefined): string => palavrasDosPrenomes(prenomes).map((p) => semAcento(p)[0] ?? '').join('');
const grafia = (a: Extract<Autor, { tipo: 'pessoa' }>): string => `${a.sobrenome.trim()}, ${a.prenomes?.trim() ?? ''}`.replace(/, $/u, '');

export function verificarBibliografia(doc: Documento, opcoes: OpcoesVerificacao = {}): ProblemaBibliografia[] {
  const problemas: ProblemaBibliografia[] = [];
  const obras = doc.obras ?? [];
  const citacoes = citacoesComLocal(doc.corpo);
  const citadas = new Set<Id>();
  for (const { citacao } of citacoes) {
    for (const o of citacao.obras) citadas.add(o.obra);
    if (citacao.apud) citadas.add(citacao.apud.obra);
  }
  const elemento = (doc.posTextuais ?? []).find((e) => e.tipo === 'referencias');
  const todasNaLista = elemento?.tipo === 'referencias' && elemento.incluirNaoCitadas === true;
  const listadas = ordenarReferencias(todasNaLista ? obras : obras.filter((o) => citadas.has(o.id)));
  const ctx = contextoDeChamadas(listadas);

  if (citacoes.length > 0 && !elemento) {
    problemas.push({
      codigo: 'REFERENCIAS_AUSENTES',
      gravidade: 'erro',
      origem: ['RN-078'],
      mensagem: 'Há citações no texto, mas o trabalho não tem o elemento REFERÊNCIAS: inclua-o nos elementos pós-textuais.',
      local: { tipo: 'trabalho' },
    });
  }

  // Chamadas escritas à mão (a citação órfã possível).
  for (const t of trechosDoCorpo(doc.corpo)) {
    for (const escrita of chamadasEscritas(t.conteudo)) {
      problemas.push({
        codigo: 'CHAMADA_SEM_LIGACAO',
        gravidade: 'aviso',
        origem: ['RN-078'],
        mensagem: `"${escrita}" parece uma chamada escrita como texto: sem ligação com a obra, ela não entra na conferência com as referências nem acompanha a obra. Troque por uma citação (Ctrl+Shift+C).`,
        local: { tipo: 'texto', secao: t.secao, no: t.no, trecho: escrita },
      });
    }
  }

  // Chamadas ligadas com aviso do formatador (obra sem ano, narrativa com várias obras…).
  for (const { citacao, secao } of citacoes) {
    const c = formatarChamada(citacao, ctx, { edicaoNbr10520: opcoes.edicaoNbr10520 ?? '2002' });
    const texto = c.trechos.map((x) => x.texto).join('');
    for (const a of c.avisos) {
      if (a.codigo === 'SOBRENOME_E_ANO_REPETIDOS') continue; // vai em CHAMADA_AMBIGUA, uma vez por obra
      problemas.push({ codigo: 'CHAMADA_COM_AVISO', gravidade: 'aviso', origem: [a.rn], mensagem: `${texto}: ${a.mensagem}`, local: { tipo: 'texto', secao, no: citacao.id, trecho: texto } });
    }
  }

  for (const o of ordenarReferencias(obras)) {
    if (!citadas.has(o.id)) {
      problemas.push({
        codigo: 'OBRA_NAO_CITADA',
        gravidade: 'aviso',
        origem: ['RN-078'],
        mensagem: todasNaLista
          ? 'Obra não citada no texto. Sai na lista porque o elemento REFERÊNCIAS inclui as obras não citadas.'
          : 'Obra não citada no texto: não sai na lista de referências. Cite-a ou exclua-a da bibliografia.',
        local: { tipo: 'obra', obra: o.id },
      });
    }
    if (ctx.sobrenomeAmbiguo.has(o.id)) {
      problemas.push({
        codigo: 'CHAMADA_AMBIGUA',
        gravidade: 'aviso',
        origem: ['RN-096'],
        mensagem: 'Outra obra de autor diferente tem o mesmo sobrenome e o mesmo ano: as chamadas saem iguais. O Manual não trata o caso (RN-096, pendente de fonte).',
        local: { tipo: 'obra', obra: o.id },
      });
    }
  }

  for (const o of listadas) {
    const r = formatarReferencia(o, { listarTodosAutores: opcoes.listarTodosAutores === true, ...(ctx.sufixos.has(o.id) ? { sufixoAno: ctx.sufixos.get(o.id)! } : {}) });
    for (const a of r.avisos) {
      problemas.push({ codigo: 'REFERENCIA_INCOMPLETA', gravidade: 'aviso', origem: [a.rn], mensagem: a.mensagem, local: { tipo: 'obra', obra: o.id } });
    }
  }

  problemas.push(...grafiasDivergentes(obras), ...prenomesNaoUniformes(listadas));
  const peso = { erro: 0, aviso: 1 } as const;
  return problemas.map((p, i) => ({ p, i })).sort((a, b) => peso[a.p.gravidade] - peso[b.p.gravidade] || a.i - b.i).map((x) => x.p);
}

/** Pessoas de todas as obras (autores, responsáveis da obra no todo), com a obra onde aparecem. */
function pessoas(obras: readonly Obra[]): { autor: Extract<Autor, { tipo: 'pessoa' }>; obra: Id }[] {
  return obras.flatMap((o) =>
    [...(o.autores ?? []), ...(o.noTodo?.autores ?? [])].flatMap((a) => (a.tipo === 'pessoa' && a.sobrenome.trim() !== '' ? [{ autor: a, obra: o.id }] : [])),
  );
}

/** D-M4-10 (provisório): mesma pessoa, grafias diferentes: mesmo sobrenome (sem acentos e maiúsculas) e mesmas iniciais. */
function grafiasDivergentes(obras: readonly Obra[]): ProblemaBibliografia[] {
  const grupos = new Map<string, { autor: Extract<Autor, { tipo: 'pessoa' }>; obra: Id }[]>();
  for (const p of pessoas(obras)) {
    const chave = `${semAcento(p.autor.sobrenome)}|${iniciaisDe(p.autor.prenomes)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
  }
  const saida: ProblemaBibliografia[] = [];
  for (const grupo of grupos.values()) {
    const formas = [...new Set(grupo.map((p) => grafia(p.autor)))];
    // Diferença só de maiúsculas no sobrenome não aparece (a referência põe em maiúsculas); abreviado × extenso é o caso
    // da RN-182 (prenomes não uniformes), não de grafia. Sobra: acento no sobrenome, ou prenomes por extenso diferentes.
    const sobrenomes = new Set(grupo.map((p) => p.autor.sobrenome.trim().toLocaleUpperCase(LOCALE)));
    const extensos = new Set(grupo.filter((p) => formaDosPrenomes(p.autor.prenomes) === 'extenso').map((p) => p.autor.prenomes!.trim()));
    if (formas.length < 2 || (sobrenomes.size < 2 && extensos.size < 2)) continue;
    const obra = grupo.find((p) => grafia(p.autor) !== formas[0])!.obra;
    saida.push({
      codigo: 'GRAFIA_DIVERGENTE',
      gravidade: 'aviso',
      origem: ['D-M4-10'],
      mensagem: `O mesmo autor parece escrito de formas diferentes: ${formas.join('; ')}. Se for a mesma pessoa, use a mesma grafia em todas as obras.`,
      local: { tipo: 'obra', obra },
    });
  }
  return saida;
}

/** RN-182, C-B10: na lista, prenomes por extenso e abreviados misturados. */
function prenomesNaoUniformes(listadas: readonly Obra[]): ProblemaBibliografia[] {
  const extenso: string[] = [];
  const abreviado: string[] = [];
  let obra: Id | null = null;
  for (const p of pessoas(listadas)) {
    const forma = formaDosPrenomes(p.autor.prenomes);
    if (forma === 'extenso' && !extenso.includes(grafia(p.autor))) extenso.push(grafia(p.autor));
    if (forma === 'abreviado' && !abreviado.includes(grafia(p.autor))) {
      abreviado.push(grafia(p.autor));
      obra ??= p.obra;
    }
  }
  if (extenso.length === 0 || abreviado.length === 0 || obra === null) return [];
  const exemplos = (l: string[]) => l.slice(0, 2).join('; ') + (l.length > 2 ? '…' : '');
  return [
    {
      codigo: 'PRENOMES_NAO_UNIFORMES',
      gravidade: 'aviso',
      origem: ['RN-182', 'C-B10'],
      mensagem: `A lista mistura prenomes por extenso (${exemplos(extenso)}) e abreviados (${exemplos(abreviado)}). Escolha uma forma para todas as referências.`,
      local: { tipo: 'obra', obra },
    },
  ];
}
