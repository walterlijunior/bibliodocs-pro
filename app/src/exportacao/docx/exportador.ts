/**
 * Exportador DOCX (M3-T05; ADR-0005, seção 3): traduz o `DocumentoFormatado` para OOXML, um para um. Não toma decisão
 * normativa: medida, caixa e ordem chegam prontas. Uma decisão encontrada aqui é defeito.
 *
 * Contornos conferidos no Word (M3-T01): sumário com `\u` (L2) e entradas em cache com a página estimada (L12). A
 * numeração das seções fica no estilo, para o autor continuar editando no Word.
 */
import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  FootnoteReferenceRun,
  Header,
  HeightRule,
  LevelFormat,
  LevelSuffix,
  LineRuleType,
  NumberFormat,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  Tab,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlignSection,
  WidthType,
  type IParagraphStylePropertiesOptions,
  type IRunOptions,
} from 'docx';
import { estimatePageNumbers } from 'docx/layout';
import type {
  BlocoFormatado,
  DocumentoFormatado,
  EstiloResolvido,
  PropriedadesEstilo,
  SecaoFormatada,
  TrechoFormatado,
} from '../../dominio/normas/formatado';

type Filho = Paragraph | Table | TableOfContents;
type Notas = Record<number, { children: Paragraph[] }>;

const ALINHAMENTO = {
  esquerda: AlignmentType.LEFT,
  direita: AlignmentType.RIGHT,
  centralizado: AlignmentType.CENTER,
  justificado: AlignmentType.BOTH,
} as const;

const NIVEIS_TITULO = 5;

function propriedadesDeRun(p: PropriedadesEstilo): IRunOptions {
  return {
    ...(p.fonte !== undefined ? { font: p.fonte } : {}),
    ...(p.corpoMeioPt !== undefined ? { size: p.corpoMeioPt } : {}),
    ...(p.negrito ? { bold: true } : {}),
    ...(p.italico ? { italics: true } : {}),
    ...(p.sublinhado ? { underline: {} } : {}),
    ...(p.maiusculas ? { allCaps: true } : {}),
  };
}

function recuo(p: PropriedadesEstilo) {
  const r = {
    ...(p.recuoEsquerdaTw !== undefined ? { left: p.recuoEsquerdaTw } : {}),
    ...(p.deslocamentoTw !== undefined ? { hanging: p.deslocamentoTw } : {}),
    ...(p.recuoPrimeiraLinhaTw !== undefined ? { firstLine: p.recuoPrimeiraLinhaTw } : {}),
  };
  return Object.keys(r).length > 0 ? { indent: r } : {};
}

function propriedadesDeParagrafo(p: PropriedadesEstilo): IParagraphStylePropertiesOptions {
  const espaco = {
    ...(p.linha !== undefined ? { line: p.linha, lineRule: LineRuleType.AUTO } : {}),
    ...(p.antesTw !== undefined ? { before: p.antesTw } : {}),
    ...(p.depoisTw !== undefined ? { after: p.depoisTw } : {}),
  };
  return {
    ...(p.alinhamento !== undefined ? { alignment: ALINHAMENTO[p.alinhamento] } : {}),
    ...(Object.keys(espaco).length > 0 ? { spacing: espaco } : {}),
    ...recuo(p),
    ...(p.manterComProximo ? { keepNext: true } : {}),
    ...(p.quebraPaginaAntes ? { pageBreakBefore: true } : {}),
  };
}

const temIndicativo = (f: DocumentoFormatado): boolean => f.secoes.some((s) => s.blocos.some((b) => b.tipo === 'paragrafo' && b.indicativo !== undefined));
const buscar = (f: DocumentoFormatado, id: string): EstiloResolvido | undefined => f.estilos.find((e) => e.id === id);

function estilos(f: DocumentoFormatado) {
  const numerar = temIndicativo(f);
  const sumario = buscar(f, 'entradaSumario');
  const corpo = buscar(f, 'corpo');
  return {
    default: {
      document: {
        run: corpo ? propriedadesDeRun({ ...(corpo.propriedades.fonte !== undefined ? { fonte: corpo.propriedades.fonte } : {}), ...(corpo.propriedades.corpoMeioPt !== undefined ? { corpoMeioPt: corpo.propriedades.corpoMeioPt } : {}) }) : {},
        paragraph: { spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 0, after: 0 } },
      },
    },
    paragraphStyles: [
      ...f.estilos.map((e) => ({
        id: e.id,
        name: e.nome,
        basedOn: 'Normal',
        quickFormat: true,
        run: propriedadesDeRun(e.propriedades),
        paragraph: {
          ...propriedadesDeParagrafo(e.propriedades),
          ...(e.nivelEstrutura !== undefined
            ? {
                outlineLevel: e.nivelEstrutura,
                ...(numerar && e.numerado ? { numbering: { reference: 'titulos', level: e.nivelEstrutura, custom: true } } : {}),
              }
            : {}),
        },
      })),
      // Estilos que o Word procura pelo nome interno, com a forma que o motor deu à entrada do sumário.
      ...(sumario
        ? Array.from({ length: NIVEIS_TITULO }, (_, i) => ({
            id: `TOC${i + 1}`,
            name: `toc ${i + 1}`,
            basedOn: 'Normal',
            run: propriedadesDeRun(sumario.propriedades),
            paragraph: propriedadesDeParagrafo(sumario.propriedades),
          }))
        : []),
    ],
    characterStyles: [
      { id: 'FootnoteReference', name: 'footnote reference', run: { superScript: true } },
      // A biblioteca aponta as entradas do sumário para este estilo, sem defini-lo.
      { id: 'IndexLink', name: 'Index Link', run: {} },
    ],
  };
}

function numeracoes(f: DocumentoFormatado) {
  const a = buscar(f, 'alinea')?.propriedades ?? {};
  const s = buscar(f, 'subalinea')?.propriedades ?? {};
  return {
    config: [
      {
        reference: 'titulos',
        levels: Array.from({ length: NIVEIS_TITULO }, (_, n) => ({
          level: n,
          format: LevelFormat.DECIMAL,
          suffix: LevelSuffix.SPACE,
          alignment: AlignmentType.LEFT,
          text: Array.from({ length: n + 1 }, (_, i) => `%${i + 1}`).join('.'),
          isLegalNumberingStyle: true,
          style: { paragraph: { indent: { left: 0, hanging: 0 } } },
        })),
      },
      {
        reference: 'alineas',
        levels: [
          { level: 0, format: LevelFormat.LOWER_LETTER, text: '%1)', alignment: AlignmentType.LEFT, style: { paragraph: recuo(a) } },
          { level: 1, format: LevelFormat.BULLET, text: f.listas.marcadorSubalinea ?? '', alignment: AlignmentType.LEFT, style: { paragraph: recuo(s) } },
        ],
      },
    ],
  };
}

/** Texto em runs: `\n` é quebra de linha e `\t` é tabulação (modelo, ADR-0004). */
function runsDeTexto(t: Extract<TrechoFormatado, { tipo: 'texto' }>): TextRun[] {
  const marcas: IRunOptions = {
    ...(t.marcas.includes('italico') ? { italics: true } : {}),
    ...(t.marcas.includes('negrito') ? { bold: true } : {}),
    ...(t.marcas.includes('sobrescrito') ? { superScript: true } : {}),
    ...(t.marcas.includes('subscrito') ? { subScript: true } : {}),
  };
  return t.texto.split('\n').map((linha, i) => {
    const partes = linha.split('\t').flatMap((p, j) => (j === 0 ? [p] : [new Tab(), p]));
    return new TextRun({ ...marcas, ...(i > 0 ? { break: 1 } : {}), children: partes });
  });
}

function converterTrechos(trechos: readonly TrechoFormatado[], notas: Notas): (TextRun | FootnoteReferenceRun)[] {
  return trechos.flatMap((t) => {
    if (t.tipo === 'texto') return runsDeTexto(t);
    // O espaço separa o número da nota do texto dela.
    notas[t.numero] = { children: [new Paragraph({ style: t.estilo, children: [new TextRun(' '), ...converterTrechos(t.trechos, notas)] })] };
    return [new FootnoteReferenceRun(t.numero)];
  });
}

function converterBloco(b: BlocoFormatado, f: DocumentoFormatado, notas: Notas, paginas: ReadonlyMap<string, number> | null): Filho[] {
  switch (b.tipo) {
    case 'quebraPagina':
      return [new Paragraph({ pageBreakBefore: true })];
    case 'quadro': {
      const linha = { style: BorderStyle.SINGLE, size: 4, color: 'auto' };
      return [
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: b.larguraTw, type: WidthType.DXA },
          columnWidths: [b.larguraTw],
          borders: { top: linha, bottom: linha, left: linha, right: linha },
          rows: [
            new TableRow({
              height: { value: b.alturaTw, rule: HeightRule.EXACT },
              children: [new TableCell({ width: { size: b.larguraTw, type: WidthType.DXA }, children: [new Paragraph({ style: b.estilo, children: converterTrechos(b.trechos, notas) })] })],
            }),
          ],
        }),
        // O Word exige um parágrafo depois da tabela, antes do fim da seção.
        new Paragraph({}),
      ];
    }
    case 'sumario':
      return [
        new TableOfContents('Sumário', {
          headingStyleRange: `1-${NIVEIS_TITULO}`,
          hyperlink: true,
          useAppliedParagraphOutlineLevel: true,
          beginDirty: paginas === null,
          cachedEntries: b.entradas.map((e) => ({
            title: e.indicativo === '' ? e.texto : `${e.indicativo} ${e.texto}`,
            level: e.nivel,
            href: e.ancora,
            ...(paginas?.has(e.ancora) ? { page: paginas.get(e.ancora)! } : {}),
          })),
        }),
      ];
    case 'paragrafo': {
      const nivelEstilo = buscar(f, b.estilo)?.nivelEstrutura;
      // Além do quinto nível, a numeração do Word não alcança: o indicativo vai como texto.
      const literal = b.indicativo !== undefined && nivelEstilo !== undefined && b.indicativo.split('.').length !== nivelEstilo + 1;
      const runs = [...(literal ? [new TextRun(`${b.indicativo} `)] : []), ...converterTrechos(b.trechos, notas)];
      return [
        new Paragraph({
          style: b.estilo,
          ...(literal ? { numbering: false as const } : {}),
          ...(b.lista && b.lista.rotulo !== null ? { numbering: { reference: 'alineas', level: b.lista.nivel, instance: b.lista.lista } } : {}),
          ...(b.novaPagina ? { pageBreakBefore: true } : {}),
          ...(b.antesTw !== undefined ? { spacing: { before: b.antesTw } } : {}),
          children: b.ancora !== undefined ? [new Bookmark({ id: b.ancora, children: runs })] : runs,
        }),
      ];
    }
  }
}

const VERTICAL = { distribuido: VerticalAlignSection.BOTH, inferior: VerticalAlignSection.BOTTOM } as const;

function converterSecao(s: SecaoFormatada, f: DocumentoFormatado, notas: Notas, paginas: ReadonlyMap<string, number> | null) {
  const p = f.pagina;
  const cabecalho = () =>
    new Header({ children: [new Paragraph({ style: 'numeroPagina', children: [new TextRun({ children: [PageNumber.CURRENT] })] })] });
  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      ...(s.alinhamentoVertical ? { verticalAlign: VERTICAL[s.alinhamentoVertical] } : {}),
      page: {
        size: { width: p.larguraTw, height: p.alturaTw },
        margin: { top: p.margemSuperiorTw, right: p.margemDireitaTw, bottom: p.margemInferiorTw, left: p.margemEsquerdaTw, header: p.cabecalhoTw },
        pageNumbers: { formatType: NumberFormat.DECIMAL, ...(s.reiniciarEm !== undefined ? { start: s.reiniciarEm } : {}) },
      },
    },
    ...(s.exibirNumero ? { headers: { default: cabecalho() } } : {}),
    children: s.blocos.flatMap((b) => converterBloco(b, f, notas, paginas)),
  };
}

function montar(f: DocumentoFormatado, paginas: ReadonlyMap<string, number> | null, medir?: typeof estimatePageNumbers): Document {
  const notas: Notas = {};
  const sections = f.secoes.map((s) => converterSecao(s, f, notas, paginas));
  return new Document({
    creator: f.metadados.autor,
    lastModifiedBy: f.metadados.autor,
    title: f.metadados.titulo,
    styles: estilos(f),
    numbering: numeracoes(f),
    footnotes: notas,
    sections,
    ...(medir ? { pageNumbers: medir } : {}),
  });
}

/**
 * Gera o DOCX. Com sumário, a primeira passada só mede em que página fica cada âncora, para as entradas já saírem com o
 * número certo (M3-T01: igual ao do Word em 15 e 149 páginas); custa cerca de 4 s em 150 páginas.
 */
export async function exportarDocx(f: DocumentoFormatado): Promise<Uint8Array> {
  const temSumario = f.secoes.some((s) => s.blocos.some((b) => b.tipo === 'sumario'));
  let paginas: ReadonlyMap<string, number> | null = null;
  if (temSumario) {
    let medido: ReturnType<typeof estimatePageNumbers> | undefined;
    const medir = ((corpo, contexto) => (medido = estimatePageNumbers(corpo, contexto))) as typeof estimatePageNumbers;
    await Packer.toBuffer(montar(f, null, medir));
    paginas = medido?.bookmarkPageNumbers ?? null;
  }
  return new Uint8Array(await Packer.toBuffer(montar(f, paginas)));
}
