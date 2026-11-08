/**
 * Leitura do conteúdo colado (M2-T05; ADR-0007, seção 5; R40). Transforma o HTML da área de transferência (Word,
 * LibreOffice, navegador, o próprio app) ou o texto puro em blocos do modelo, com ids novos. O resultado só pode ser
 * `Bloco`/`Inline`; o que o modelo não tem é descartado com aviso, e o texto fica.
 *
 * Não usa o DOM nem o `DOMParser` do ProseMirror: percorre uma árvore mínima (`NoHtml`), que o `Document` inerte de
 * `colagem.ts` satisfaz no renderer e que os testes montam em Node. Nada aqui lê `innerHTML`, carrega recurso ou
 * executa código: atributos são só lidos como texto (`style`, `class`, `id`).
 *
 * Decisões (adendo do M2-T05 no ADR-0007):
 * - preserva itálico, negrito, sobrescrito e subscrito (por tag ou por `style`) e os parágrafos;
 * - listas (`ul`/`ol`, listas do Word com `mso-list`) viram alíneas; o 2.º nível vira subalínea, e os mais fundos
 *   ficam no 2.º nível, com aviso; título numerado do Word (`h1` com `mso-list`) não é lista;
 * - `blockquote` vira citação longa; títulos `h1`–`h6` viram parágrafos, com aviso;
 * - notas de rodapé e de fim do Word e do LibreOffice viram notas no ponto da chamada; comentários do Word saem;
 * - imagens, tabelas, objetos e quadros são descartados, com aviso.
 */
import type { Bloco, Inline, InlineDeNota, InlineTexto, ItemAlinea, MarcaTexto } from '../../dominio/modelo';
import { CARACTERES_FORA_DO_XML, normalizarConteudo } from './conversao';
import { PREFIXO_ID } from './esquema';
import type { GeradorId } from './ids';

/** O mínimo de um nó do DOM que a leitura usa (o `Node` do navegador satisfaz). */
export interface NoHtml {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly nodeValue: string | null;
  readonly childNodes: ArrayLike<NoHtml>;
}

interface ElementoHtml extends NoHtml {
  getAttribute(nome: string): string | null;
}

export type AvisoColagem = 'imagem' | 'tabela' | 'titulo' | 'listaFunda' | 'notaPerdida' | 'notaDeFim' | 'limite';

/** Mensagens mostradas depois de colar (texto simples, sem HTML). */
export const MENSAGENS_AVISO: Readonly<Record<AvisoColagem, string>> = {
  imagem: 'As imagens coladas foram descartadas. Use Inserir › Figura.',
  tabela: 'As tabelas coladas no texto foram descartadas. Para trazê-las, use Inserir › Tabela ou quadro… e cole na janela.',
  titulo: 'Os títulos colados viraram parágrafos. Para criar uma seção, use a árvore de seções.',
  listaFunda: 'Listas com mais de dois níveis ficaram no nível da subalínea.',
  notaPerdida: 'Uma chamada de nota veio sem o texto da nota e foi descartada.',
  notaDeFim: 'As notas de fim coladas viraram notas de rodapé.',
  limite: 'O conteúdo não foi colado: a seção passaria do tamanho máximo do arquivo. Divida o texto em mais seções.',
};

export interface ResultadoColagem {
  blocos: Bloco[];
  avisos: AvisoColagem[];
}

const ELEMENTO = 1;
const TEXTO = 3;

const BRANCO_HTML = /[ \t\n\r\f]+/g;

/** Elementos cujo conteúdo não é texto do trabalho. */
const IGNORADOS = new Set([
  'head', 'title', 'meta', 'link', 'style', 'script', 'template', 'noscript', 'xml', 'button', 'select', 'textarea',
  'input', 'option', 'datalist', 'map', 'area',
]);
const IMAGENS = new Set([
  'img', 'picture', 'svg', 'canvas', 'video', 'audio', 'object', 'embed', 'iframe', 'frame', 'frameset', 'math',
  'v:shape', 'v:imagedata', 'v:rect', 'v:group', 'v:line', 'v:oval', 'v:roundrect', 'v:textbox', 'o:ole',
]);
const BLOCOS = new Set([
  'html', 'body', 'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote',
  'pre', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'main', 'figure', 'figcaption', 'address',
  'center', 'hr', 'details', 'summary', 'fieldset', 'legend', 'form',
]);
const TITULOS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const LISTAS = new Set(['ul', 'ol']);

/** Além disto, o resto da árvore é lido como texto, sem recursão (HTML colado pode ser arbitrariamente fundo). */
const PROFUNDIDADE_MAXIMA = 256;

type TipoLinha = 'paragrafo' | 'citacao' | 'alinea' | 'subalinea';

interface Linha {
  tipo: TipoLinha;
  conteudo: Inline[];
}

interface Contexto {
  marcas: ReadonlySet<MarcaTexto>;
  tipo: TipoLinha;
  /** Listas `ul`/`ol` abertas acima. */
  nivelLista: number;
  pre: boolean;
}

/**
 * Nome que o atributo `style` recebe antes do `DOMParser` (`neutralizarEstilos`). No Chromium o documento do
 * `DOMParser` herda a CSP da página, e cada `style` do HTML colado gerava um relatório "Applying inline style violates
 * … style-src" (E2E do M2-T06), mesmo sem nada ser aplicado.
 */
export const ATRIBUTO_ESTILO = 'data-bd-estilo';

/**
 * Prepara o HTML da área de transferência para o `DOMParser`: tira as folhas `<style>` (a leitura já as ignora) e troca
 * o nome dos atributos `style` dentro das tags por `ATRIBUTO_ESTILO`. Texto do documento nunca contém `<` cru (seria
 * `&lt;`), então só a marcação é tocada. Uma tag com `>` dentro de um valor de atributo pode ficar com o `style`
 * original: a leitura aceita os dois nomes, e o pior caso é o relatório de CSP voltar (nada é aplicado).
 */
export function neutralizarEstilos(html: string): string {
  return html
    // `(?=[\s>/])`: não casa com elementos personalizados como `<style-x>` (revisão do M2-T06, B5).
    .replace(/<style(?=[\s>/])[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<[A-Za-z][^>]*>/g, (tag) => tag.replace(/(\s)style(\s*=)/gi, `$1${ATRIBUTO_ESTILO}$2`));
}

/** Propriedades de `style`, em minúsculas e sem `!important`. */
function lerEstilo(el: ElementoHtml): Map<string, string> {
  const mapa = new Map<string, string>();
  const estilo = el.getAttribute(ATRIBUTO_ESTILO) ?? el.getAttribute('style');
  if (!estilo) return mapa;
  for (const declaracao of estilo.split(';')) {
    const doisPontos = declaracao.indexOf(':');
    if (doisPontos < 0) continue;
    const prop = declaracao.slice(0, doisPontos).trim().toLowerCase();
    const valor = declaracao.slice(doisPontos + 1).replace(/!\s*important/i, '').trim().toLowerCase();
    if (prop) mapa.set(prop, valor);
  }
  return mapa;
}

const ehElemento = (no: NoHtml): no is ElementoHtml => no.nodeType === ELEMENTO;
const nomeDe = (no: NoHtml): string => no.nodeName.toLowerCase();

const temClasse = (el: ElementoHtml, classe: string): boolean =>
  (el.getAttribute('class') ?? '').split(/\s+/).includes(classe);

function marcasDoElemento(nome: string, estilo: Map<string, string>, herdadas: ReadonlySet<MarcaTexto>): Set<MarcaTexto> {
  const m = new Set(herdadas);
  const sobrescrito = (): void => void (m.delete('subscrito'), m.add('sobrescrito'));
  const subscrito = (): void => void (m.delete('sobrescrito'), m.add('subscrito'));
  if (nome === 'b' || nome === 'strong') m.add('negrito');
  if (nome === 'i' || nome === 'em' || nome === 'cite') m.add('italico');
  if (nome === 'sup') sobrescrito();
  if (nome === 'sub') subscrito();

  const peso = estilo.get('font-weight');
  if (peso !== undefined) {
    const numero = Number(peso);
    if (peso === 'bold' || peso === 'bolder' || numero >= 600) m.add('negrito');
    else if (peso === 'normal' || peso === 'lighter' || (numero > 0 && numero < 600)) m.delete('negrito');
  }
  const forma = estilo.get('font-style');
  if (forma !== undefined) {
    if (forma.startsWith('italic') || forma.startsWith('oblique')) m.add('italico');
    else if (forma === 'normal') m.delete('italico');
  }
  const vertical = estilo.get('vertical-align');
  if (vertical === 'super') sobrescrito();
  else if (vertical === 'sub') subscrito();
  else if (vertical === 'baseline') {
    m.delete('sobrescrito');
    m.delete('subscrito');
  }
  return m;
}

/** Nível da lista do Word (`mso-list: l0 level2 lfo1`), ou 0. */
function nivelListaWord(estilo: Map<string, string>): number {
  const lista = estilo.get('mso-list');
  if (!lista) return 0;
  const m = /\blevel(\d+)/.exec(lista);
  return m ? Number(m[1]) : 1;
}

/**
 * Id da nota na chamada e se é nota de fim. Word: `<a style="mso-footnote-id:ftn1">`; LibreOffice:
 * `<a class="sdfootnoteanc" href="#sdfootnote1sym">` [HIPÓTESE quanto ao formato exato da área de transferência].
 */
function chamadaDeNota(el: ElementoHtml, estilo: Map<string, string>): { id: string; fim: boolean } | null {
  const rodape = estilo.get('mso-footnote-id');
  if (rodape) return { id: rodape, fim: false };
  const fim = estilo.get('mso-endnote-id');
  if (fim) return { id: fim, fim: true };
  const lo = temClasse(el, 'sdfootnoteanc') ? false : temClasse(el, 'sdendnoteanc') ? true : null;
  if (lo === null) return null;
  return { id: (el.getAttribute('href') ?? '').replace(/^#/, '').replace(/sym$/, ''), fim: lo };
}

/** Elemento que guarda o texto de uma nota (Word: `mso-element:footnote`; LibreOffice: `div#sdfootnote1`). */
function ehCorpoDeNota(el: ElementoHtml, estilo: Map<string, string>): boolean {
  const tipo = estilo.get('mso-element');
  if (tipo === 'footnote' || tipo === 'endnote') return true;
  return nomeDe(el) === 'div' && /^sd(foot|end)note\d+$/.test(el.getAttribute('id') ?? '');
}

/** Âncoras e marcas que não são texto do trabalho: comentários do Word e a remissão de volta das notas do LibreOffice. */
const ehMarcadorDescartado = (el: ElementoHtml, estilo: Map<string, string>): boolean =>
  temClasse(el, 'MsoCommentReference') ||
  temClasse(el, 'msocomanchor') ||
  estilo.has('mso-comment-reference') ||
  estilo.get('mso-special-character') === 'comment' ||
  temClasse(el, 'sdfootnotesym') ||
  temClasse(el, 'sdendnotesym');

const texto = (valor: string, marcas: Iterable<MarcaTexto>): InlineTexto => {
  const lista = [...marcas];
  return lista.length > 0 ? { tipo: 'texto', texto: valor, marcas: lista } : { tipo: 'texto', texto: valor };
};

class Leitor {
  readonly linhas: Linha[] = [];
  /** Índices de `linhas` que marcam uma quebra de página copiada do app. */
  readonly quebras = new Set<number>();
  readonly avisos = new Set<AvisoColagem>();
  #atual: Linha | null = null;

  constructor(
    private readonly gerar: GeradorId,
    private readonly notas: ReadonlyMap<string, InlineDeNota[]>,
  ) {}

  /** Fecha a linha em montagem: tira o branco e as quebras do fim (o `<br>` final do Chrome) e descarta a linha vazia. */
  fecharLinha(): void {
    const linha = this.#atual;
    if (!linha) return;
    this.#aparar();
    this.#atual = null;
    const conteudo = normalizarConteudo(linha.conteudo);
    for (let ultimo = conteudo.at(-1); ultimo?.tipo === 'texto'; ultimo = conteudo.at(-1)) {
      const aparado = ultimo.texto.replace(/[\n ]+$/, '');
      if (aparado === ultimo.texto) break;
      if (aparado === '') conteudo.pop();
      else conteudo[conteudo.length - 1] = { ...ultimo, texto: aparado };
    }
    const temAlgo = conteudo.some((i) => i.tipo !== 'texto' || i.texto.replace(/[\s\u00a0]/g, '') !== '');
    if (temAlgo) this.linhas.push({ tipo: linha.tipo, conteudo });
  }

  /** Tira o branco do fim da linha em montagem (antes de uma quebra, de uma nota ou do fim do parágrafo). */
  #aparar(): void {
    const ultimo = this.#atual?.conteudo.at(-1);
    if (ultimo?.tipo === 'texto' && !ultimo.texto.endsWith('\n')) ultimo.texto = ultimo.texto.replace(/ +$/, '');
  }

  #linha(ctx: Contexto): Linha {
    this.#atual ??= { tipo: ctx.tipo, conteudo: [] };
    return this.#atual;
  }

  adicionarTexto(bruto: string, ctx: Contexto): void {
    let valor = bruto.replace(CARACTERES_FORA_DO_XML, '');
    if (ctx.pre) valor = valor.replace(/\r\n?/g, '\n');
    else valor = valor.replace(BRANCO_HTML, ' ');
    if (valor === '') return;
    const linha = this.#atual;
    if (!ctx.pre && valor.startsWith(' ')) {
      const ultimo = linha?.conteudo.at(-1);
      const antes = ultimo?.tipo === 'texto' ? ultimo.texto : '';
      if (!linha || linha.conteudo.length === 0 || antes.endsWith(' ') || antes.endsWith('\n')) valor = valor.slice(1);
      if (valor === '') return;
    }
    this.#linha(ctx).conteudo.push(texto(valor, ctx.marcas));
  }

  adicionarQuebra(ctx: Contexto): void {
    this.#aparar();
    this.#linha(ctx).conteudo.push(texto('\n', ctx.marcas));
  }

  adicionarNota(conteudo: InlineDeNota[], ctx: Contexto): void {
    this.#aparar();
    this.#linha(ctx).conteudo.push({ tipo: 'nota', id: this.gerar(PREFIXO_ID['nota']!), conteudo });
  }

  visitar(no: NoHtml, ctx: Contexto, profundidade: number): void {
    if (no.nodeType === TEXTO) {
      this.adicionarTexto(no.nodeValue ?? '', ctx);
      return;
    }
    if (!ehElemento(no)) return; // comentários (inclusive os condicionais do Word), instruções etc.
    const nome = nomeDe(no);
    if (IGNORADOS.has(nome)) return;
    if (IMAGENS.has(nome)) {
      this.avisos.add('imagem');
      return;
    }
    if (nome === 'table') {
      this.avisos.add('tabela');
      return;
    }
    const estilo = lerEstilo(no);
    if (estilo.get('display') === 'none') return;
    if (estilo.get('mso-list') === 'ignore') return; // marcador "a)" ou "•" que o Word escreve na alínea
    const elementoWord = estilo.get('mso-element');
    if (elementoWord && /^(footnote|endnote|comment)/.test(elementoWord)) return; // notas: lidas antes, em `lerNotas`
    if (ehCorpoDeNota(no, estilo) || ehMarcadorDescartado(no, estilo)) return;
    if (nome === 'br') {
      this.adicionarQuebra(ctx);
      return;
    }
    const chamada = nome === 'a' ? chamadaDeNota(no, estilo) : null;
    if (chamada) {
      const conteudo = this.notas.get(chamada.id);
      if (conteudo) {
        if (chamada.fim) this.avisos.add('notaDeFim');
        this.adicionarNota(conteudo, ctx);
      } else {
        this.avisos.add('notaPerdida');
      }
      return;
    }
    if (nome === 'span' && temClasse(no, 'bd-nota')) {
      // Nota copiada do próprio app: o conteúdo dela é o texto do `span`.
      const sub = new Leitor(this.gerar, this.notas);
      sub.visitarFilhos(no, { ...ctx, tipo: 'paragrafo', marcas: new Set() }, profundidade + 1);
      sub.fecharLinha();
      this.adicionarNota(conteudoDeNota(sub.linhas), ctx);
      return;
    }

    const marcas = marcasDoElemento(nome, estilo, ctx.marcas);
    if (!BLOCOS.has(nome)) {
      this.visitarFilhos(no, { ...ctx, marcas }, profundidade + 1);
      return;
    }

    if (nome === 'hr') {
      if (temClasse(no, 'bd-quebra-pagina')) {
        this.fecharLinha();
        this.linhas.push({ tipo: 'paragrafo', conteudo: [] }); // marcador da quebra (ver `montarBlocos`)
        this.quebras.add(this.linhas.length - 1);
      }
      return;
    }
    if (TITULOS.has(nome) && !temClasse(no, 'bd-titulo')) this.avisos.add('titulo');
    const filho: Contexto = { ...ctx, marcas, pre: ctx.pre || nome === 'pre' };
    if (LISTAS.has(nome)) filho.nivelLista = ctx.nivelLista + 1;
    if (nome === 'blockquote' || temClasse(no, 'bd-citacao-longa')) filho.tipo = 'citacao';
    if (nome === 'li') filho.tipo = this.#tipoDeNivel(Math.max(1, ctx.nivelLista));
    // Título numerado do Word (lista multinível nos estilos de título) continua parágrafo, não alínea.
    const nivelWord = TITULOS.has(nome) ? 0 : nivelListaWord(estilo);
    if (nivelWord > 0) filho.tipo = this.#tipoDeNivel(nivelWord);
    if (temClasse(no, 'bd-subalinea')) filho.tipo = 'subalinea';

    this.fecharLinha();
    this.visitarFilhos(no, filho, profundidade + 1);
    this.fecharLinha();
  }

  #tipoDeNivel(nivel: number): TipoLinha {
    if (nivel >= 3) this.avisos.add('listaFunda');
    return nivel === 1 ? 'alinea' : 'subalinea';
  }

  visitarFilhos(no: NoHtml, ctx: Contexto, profundidade: number): void {
    if (profundidade > PROFUNDIDADE_MAXIMA) {
      this.adicionarTexto(textoPlano(no), ctx);
      return;
    }
    const filhos = no.childNodes;
    for (let i = 0; i < filhos.length; i++) this.visitar(filhos[i]!, ctx, profundidade);
  }
}

/** Texto de uma subárvore, sem recursão. */
function textoPlano(raiz: NoHtml): string {
  const partes: string[] = [];
  const pilha: NoHtml[] = [raiz];
  while (pilha.length > 0) {
    const no = pilha.pop()!;
    if (no.nodeType === TEXTO) partes.push(no.nodeValue ?? '');
    else if (ehElemento(no) && !IGNORADOS.has(nomeDe(no))) {
      for (let i = no.childNodes.length - 1; i >= 0; i--) pilha.push(no.childNodes[i]!);
    }
  }
  return partes.join('');
}

/** Nota é de um parágrafo só (B7 do M2-T04): parágrafos da nota colada viram quebras de linha. */
function conteudoDeNota(linhas: readonly Linha[]): InlineDeNota[] {
  const saida: InlineTexto[] = [];
  linhas.forEach((linha, i) => {
    if (i > 0) saida.push({ tipo: 'texto', texto: '\n' });
    for (const inline of linha.conteudo) if (inline.tipo === 'texto') saida.push(inline);
  });
  return normalizarConteudo(saida);
}

const CONTEXTO_INICIAL: Contexto = { marcas: new Set(), tipo: 'paragrafo', nivelLista: 0, pre: false };

/**
 * Texto das notas de rodapé e de fim (`ehCorpoDeNota`), pelo id que a chamada usa. A remissão de volta (Word:
 * `<a style="mso-footnote-id:ftn1" href="#_ftnref1">[1]</a>`; LibreOffice: `a.sdfootnotesym`) é descartada.
 */
function lerNotas(raiz: NoHtml, gerar: GeradorId): Map<string, InlineDeNota[]> {
  const notas = new Map<string, InlineDeNota[]>();
  const pilha: NoHtml[] = [raiz];
  while (pilha.length > 0) {
    const no = pilha.pop()!;
    if (!ehElemento(no)) continue;
    const id = no.getAttribute('id');
    if (id && ehCorpoDeNota(no, lerEstilo(no))) {
      const leitor = new Leitor(gerar, new Map());
      // As chamadas dentro da própria nota (a remissão de volta) não têm nota no mapa vazio: saem sem aviso.
      leitor.visitarFilhos(no, CONTEXTO_INICIAL, 1);
      leitor.fecharLinha();
      notas.set(id, conteudoDeNota(leitor.linhas));
      continue;
    }
    for (let i = no.childNodes.length - 1; i >= 0; i--) pilha.push(no.childNodes[i]!);
  }
  return notas;
}

/** Agrupa as linhas em blocos: alíneas seguidas formam uma lista; subalínea sem alínea antes vira alínea. */
function montarBlocos(leitor: Leitor, gerar: GeradorId): Bloco[] {
  const blocos: Bloco[] = [];
  let lista: ItemAlinea[] | null = null;
  leitor.linhas.forEach((linha, indice) => {
    if (leitor.quebras.has(indice)) {
      lista = null;
      blocos.push({ tipo: 'quebraPagina', id: gerar(PREFIXO_ID['quebraPagina']!) });
      return;
    }
    if (linha.tipo === 'alinea' || linha.tipo === 'subalinea') {
      if (!lista) {
        lista = [];
        blocos.push({ tipo: 'alineas', id: gerar(PREFIXO_ID['alineas']!), itens: lista });
      }
      const ultimo = lista[lista.length - 1];
      if (linha.tipo === 'subalinea' && ultimo) (ultimo.subalineas ??= []).push(linha.conteudo);
      else lista.push({ conteudo: linha.conteudo });
      return;
    }
    lista = null;
    const tipo = linha.tipo === 'citacao' ? 'citacaoLonga' : 'paragrafo';
    blocos.push({ tipo, id: gerar(PREFIXO_ID[tipo]!), conteudo: linha.conteudo });
  });
  return blocos;
}

/** Blocos do modelo a partir do HTML colado (a raiz é o `body` do documento inerte). */
export function lerHtmlColado(raiz: NoHtml, gerar: GeradorId): ResultadoColagem {
  const leitorNotas = lerNotas(raiz, gerar);
  const leitor = new Leitor(gerar, leitorNotas);
  leitor.visitarFilhos(raiz, CONTEXTO_INICIAL, 0);
  leitor.fecharLinha();
  const blocos = montarBlocos(leitor, gerar);
  return { blocos, avisos: [...leitor.avisos] };
}

/**
 * Blocos a partir de texto puro (Ctrl+Shift+V, ou quando não há HTML): uma linha em branco separa parágrafos, e a
 * quebra de linha simples vira espaço, para o texto copiado de PDF não chegar quebrado em cada linha.
 */
export function lerTextoColado(textoPuro: string, gerar: GeradorId): ResultadoColagem {
  const limpo = textoPuro.replace(/\r\n?/g, '\n').replace(CARACTERES_FORA_DO_XML, '');
  const blocos: Bloco[] = [];
  for (const trecho of limpo.split(/\n[ \t]*\n/)) {
    const valor = trecho.split('\n').map((l) => l.trim()).filter((l) => l !== '').join(' ');
    if (valor === '') continue;
    blocos.push({ tipo: 'paragrafo', id: gerar(PREFIXO_ID['paragrafo']!), conteudo: normalizarConteudo([texto(valor, [])]) });
  }
  return { blocos, avisos: [] };
}
