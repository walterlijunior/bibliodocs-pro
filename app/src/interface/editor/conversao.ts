/**
 * Conversão modelo ↔ editor de uma seção (M2-T05; ADR-0007, seções 2 e 3). Pura e testável em Node: só
 * `prosemirror-model` e tipos do domínio.
 *
 * Forma canônica: o ProseMirror junta textos vizinhos com as mesmas marcas e não guarda texto vazio. Por isso a ida e
 * volta devolve `normalizarSecao(s)`, que é a própria `s` quando ela já é canônica:
 * - textos vizinhos com as mesmas marcas juntos, sem texto vazio;
 * - marcas na ordem de `ORDEM_MARCAS`, sem repetição, e `marcas` omitido quando vazio;
 * - texto acima de `LIMITE_TEXTO_INLINE` dividido em trechos (o formato v1 recusa trecho maior);
 * - sem os caracteres que o XML 1.0 recusa (`CARACTERES_FORA_DO_XML`).
 *
 * Do editor para o modelo, o resultado de cada bloco é memorizado pela identidade do nó: os nós que a transação não
 * tocou são o mesmo objeto, e o custo fica proporcional ao que mudou (R39).
 */
import { Fragment, Slice, type Mark, type Node as NoPm } from 'prosemirror-model';
import type {
  Bloco,
  Inline,
  InlineDeNota,
  InlineDeTitulo,
  InlineCitacao,
  InlineTexto,
  ItemAlinea,
  MarcaTexto,
  Secao,
} from '../../dominio/modelo';
import { esquemaEditor, ORDEM_MARCAS } from './esquema';

/** O que o editor de uma seção edita: o título e os blocos (as subseções ficam na árvore do domínio). */
export type ConteudoSecao = Pick<Secao, 'titulo' | 'blocos'>;

/** Cópia de `LIMITES_V1.textoInline` (a interface só importa tipos do domínio; o teste confere o valor). */
export const LIMITE_TEXTO_INLINE = 100_000;

/**
 * Cópia do que `PADRAO_TEXTO_XML` recusa (controles, U+FFFE/U+FFFF e substitutos soltos); o teste confere. A forma
 * canônica os remove: assim nem a colagem nem o texto que chega pela digitação, pelo IME ou pela releitura do DOM
 * produzem um arquivo que a leitura recusaria.
 */
export const CARACTERES_FORA_DO_XML = /[\u0000-\u0008\u000B-\u001F\uFFFE\uFFFF\p{Cs}]/gu;

const { nodes: tipos } = esquemaEditor;

// ---------------------------------------------------------------------------------------------------------
// Forma canônica
// ---------------------------------------------------------------------------------------------------------

const ehMarca = (nome: string): nome is MarcaTexto => (ORDEM_MARCAS as readonly string[]).includes(nome);
const ordenarMarcas = (marcas: readonly string[]): MarcaTexto[] => ORDEM_MARCAS.filter((m) => marcas.includes(m));

const texto = (valor: string, marcas: readonly MarcaTexto[]): InlineTexto =>
  marcas.length > 0 ? { tipo: 'texto', texto: valor, marcas: [...marcas] } : { tipo: 'texto', texto: valor };

/** Divide no limite sem separar um par substituto (surrogate). */
function dividirTexto(valor: string): string[] {
  if (valor.length <= LIMITE_TEXTO_INLINE) return [valor];
  const partes: string[] = [];
  let inicio = 0;
  while (valor.length - inicio > LIMITE_TEXTO_INLINE) {
    let fim = inicio + LIMITE_TEXTO_INLINE;
    const c = valor.charCodeAt(fim - 1);
    if (c >= 0xd800 && c <= 0xdbff) fim--;
    partes.push(valor.slice(inicio, fim));
    inicio = fim;
  }
  partes.push(valor.slice(inicio));
  return partes;
}

export function normalizarConteudo(conteudo: readonly InlineTexto[]): InlineTexto[];
export function normalizarConteudo(conteudo: readonly InlineDeNota[]): InlineDeNota[];
export function normalizarConteudo(conteudo: readonly Inline[]): Inline[];
export function normalizarConteudo(conteudo: readonly Inline[]): Inline[] {
  // Trechos de texto em montagem (`valor`), ainda sem a divisão no limite.
  const saida: (Inline | { valor: string; marcas: MarcaTexto[] })[] = [];
  for (const i of conteudo) {
    if (i.tipo === 'nota') {
      saida.push({ tipo: 'nota', id: i.id, conteudo: normalizarConteudo(i.conteudo as readonly InlineDeNota[]) });
      continue;
    }
    if (i.tipo === 'citacao') {
      saida.push(i);
      continue;
    }
    const valor = i.texto.replace(CARACTERES_FORA_DO_XML, '');
    if (valor === '') continue;
    const marcas = ordenarMarcas(i.marcas ?? []);
    const anterior = saida[saida.length - 1];
    if (anterior && !('tipo' in anterior) && anterior.marcas.join(' ') === marcas.join(' ')) {
      anterior.valor += valor;
    } else {
      saida.push({ valor, marcas });
    }
  }
  return saida.flatMap((i) => ('tipo' in i ? [i] : dividirTexto(i.valor).map((v) => texto(v, i.marcas))));
}

function normalizarItem(item: ItemAlinea): ItemAlinea {
  const conteudo = normalizarConteudo(item.conteudo);
  return item.subalineas && item.subalineas.length > 0
    ? { conteudo, subalineas: item.subalineas.map((s) => normalizarConteudo(s)) }
    : { conteudo };
}

export function normalizarBloco(bloco: Bloco): Bloco {
  switch (bloco.tipo) {
    case 'paragrafo':
    case 'citacaoLonga':
      return { tipo: bloco.tipo, id: bloco.id, conteudo: normalizarConteudo(bloco.conteudo) };
    case 'alineas':
      return { tipo: 'alineas', id: bloco.id, itens: bloco.itens.map(normalizarItem) };
    case 'quebraPagina':
      return { tipo: 'quebraPagina', id: bloco.id };
  }
}

export function normalizarSecao(secao: ConteudoSecao): ConteudoSecao {
  return { titulo: normalizarConteudo(secao.titulo), blocos: secao.blocos.map(normalizarBloco) };
}

// ---------------------------------------------------------------------------------------------------------
// Modelo → editor
// ---------------------------------------------------------------------------------------------------------

const marcasCriadas = new Map<string, readonly Mark[]>();

function marcasPm(marcas: readonly MarcaTexto[] | undefined): readonly Mark[] {
  const ordenadas = ordenarMarcas(marcas ?? []);
  const chave = ordenadas.join(' ');
  let pm = marcasCriadas.get(chave);
  if (!pm) {
    pm = ordenadas.map((m) => esquemaEditor.marks[m]!.create());
    marcasCriadas.set(chave, pm);
  }
  return pm;
}

function inlinesParaNos(conteudo: readonly Inline[]): NoPm[] {
  const nos: NoPm[] = [];
  for (const i of conteudo) {
    if (i.tipo === 'nota') {
      nos.push(tipos['nota']!.create({ id: i.id }, inlinesParaNos(i.conteudo)));
      continue;
    }
    if (i.tipo === 'citacao') {
      const { id, tipo: _tipo, ...dados } = i;
      nos.push(tipos['chamadaCitacao']!.create({ id, dados: JSON.stringify(dados) }));
      continue;
    }
    const marcas = marcasPm(i.marcas);
    const linhas = i.texto.split('\n');
    linhas.forEach((linha, k) => {
      if (linha !== '') nos.push(esquemaEditor.text(linha, marcas));
      if (k < linhas.length - 1) nos.push(tipos['quebraLinha']!.create(null, null, marcas));
    });
  }
  return nos;
}

export function blocoParaNo(bloco: Bloco): NoPm {
  switch (bloco.tipo) {
    case 'paragrafo':
    case 'citacaoLonga':
      return tipos[bloco.tipo]!.create({ id: bloco.id }, inlinesParaNos(bloco.conteudo));
    case 'quebraPagina':
      return tipos['quebraPagina']!.create({ id: bloco.id });
    case 'alineas':
      return tipos['alineas']!.create(
        { id: bloco.id },
        bloco.itens.map((item) =>
          tipos['alinea']!.create(null, [
            tipos['linhaAlinea']!.create(null, inlinesParaNos(item.conteudo)),
            ...(item.subalineas ?? []).map((s) => tipos['subalinea']!.create(null, inlinesParaNos(s))),
          ]),
        ),
      );
  }
}

/** Documento do editor para a seção. Conteúdo fora do modelo é impossível de representar (ver `Node.check()`). */
export function secaoParaDoc(secao: ConteudoSecao): NoPm {
  return tipos['secaoDoc']!.create(null, [
    tipos['titulo']!.create(null, inlinesParaNos(secao.titulo)),
    ...secao.blocos.map(blocoParaNo),
  ]);
}

/**
 * Fatia para colar: blocos do modelo. Parágrafo na ponta fica "aberto", para o texto se juntar ao parágrafo onde está
 * o cursor (como o colar do Word); alínea, citação e quebra entram como blocos inteiros.
 */
export function blocosParaSlice(blocos: readonly Bloco[]): Slice {
  if (blocos.length === 0) return Slice.empty;
  const abre = (b: Bloco | undefined): number => (b?.tipo === 'paragrafo' ? 1 : 0);
  return new Slice(Fragment.fromArray(blocos.map(blocoParaNo)), abre(blocos[0]), abre(blocos[blocos.length - 1]));
}

// ---------------------------------------------------------------------------------------------------------
// Editor → modelo
// ---------------------------------------------------------------------------------------------------------

/** Nó com id ainda nulo: o plugin de ids únicos não rodou (defeito do código, não erro do usuário). */
export class ErroConversao extends Error {
  override readonly name = 'ErroConversao';
}

function idDe(no: NoPm): string {
  const id: unknown = no.attrs['id'];
  if (typeof id !== 'string') {
    throw new ErroConversao(`nó "${no.type.name}" sem id: falta o plugin de ids únicos no estado do editor`);
  }
  return id;
}

const marcasDe = (no: NoPm): MarcaTexto[] => no.marks.map((m) => m.type.name).filter(ehMarca);

function nosParaInlines(pai: NoPm): Inline[] {
  const bruto: Inline[] = [];
  pai.forEach((no) => {
    if (no.isText) bruto.push(texto(no.text ?? '', marcasDe(no)));
    else if (no.type === tipos['quebraLinha']) bruto.push(texto('\n', marcasDe(no)));
    else if (no.type === tipos['nota']) bruto.push({ tipo: 'nota', id: idDe(no), conteudo: semNota(nosParaInlines(no)) });
    else if (no.type === tipos['chamadaCitacao']) bruto.push({ ...(JSON.parse(String(no.attrs['dados'])) as Omit<InlineCitacao, 'tipo' | 'id'>), tipo: 'citacao', id: idDe(no) });
  });
  return normalizarConteudo(bruto);
}

/** Conteúdo da nota: texto e chamadas de citação (o esquema do editor não põe nota dentro de nota). */
const semNota = (conteudo: Inline[]): InlineDeNota[] => conteudo.filter((i): i is InlineDeNota => i.tipo !== 'nota');

const soTexto = (conteudo: Inline[]): InlineDeTitulo[] =>
  conteudo.filter((i): i is InlineTexto => i.tipo === 'texto');

const memoBlocos = new WeakMap<NoPm, Bloco>();

export function noParaBloco(no: NoPm): Bloco {
  const memo = memoBlocos.get(no);
  if (memo) return memo;
  let bloco: Bloco;
  switch (no.type.name) {
    case 'paragrafo':
    case 'citacaoLonga':
      bloco = { tipo: no.type.name, id: idDe(no), conteudo: nosParaInlines(no) };
      break;
    case 'quebraPagina':
      bloco = { tipo: 'quebraPagina', id: idDe(no) };
      break;
    case 'alineas': {
      const itens: ItemAlinea[] = [];
      no.forEach((alinea) => {
        const subalineas: Inline[][] = [];
        let conteudo: Inline[] = [];
        alinea.forEach((filho, _deslocamento, indice) => {
          if (indice === 0) conteudo = nosParaInlines(filho);
          else subalineas.push(nosParaInlines(filho));
        });
        itens.push(subalineas.length > 0 ? { conteudo, subalineas } : { conteudo });
      });
      bloco = { tipo: 'alineas', id: idDe(no), itens };
      break;
    }
    default:
      throw new ErroConversao(`nó "${no.type.name}" não é bloco do modelo`);
  }
  memoBlocos.set(no, bloco);
  return bloco;
}

/** Título e blocos da seção a partir do documento do editor. */
export function docParaSecao(doc: NoPm): ConteudoSecao {
  if (doc.type !== tipos['secaoDoc']) throw new ErroConversao(`documento "${doc.type.name}" não é de seção`);
  let titulo: InlineDeTitulo[] = [];
  const blocos: Bloco[] = [];
  doc.forEach((no, _deslocamento, indice) => {
    if (indice === 0) titulo = soTexto(nosParaInlines(no));
    else blocos.push(noParaBloco(no));
  });
  return { titulo, blocos };
}
