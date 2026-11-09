// Corpus da regressão documental (M3-T06; skill `regressao-documental`). Conteúdo fictício e neutro, gerado aqui: nada de
// dados reais. Um trabalho por tipo e um "documento difícil". Tabela e quadro desde o M5-T03; figuras e equações entram no M5.
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { criarTrabalhoDoTipo } from '../../src/aplicacao/servicos/criar-trabalho';
import type { Bloco, BlocoIlustracao, BlocoTabela, CelulaTabela, Documento, ElementoPreTextual, Inline, InlineCitacao, Obra, Secao, TipoTrabalhoUft } from '../../src/dominio/modelo';

export const TIPOS: readonly TipoTrabalhoUft[] = ['monografia', 'artigo-tcc', 'dissertacao', 'tese', 'relatorio-tecnico', 'projeto-pesquisa'];

const t = (texto: string): Inline => ({ tipo: 'texto', texto });
const FRASE = 'Este parágrafo fictício existe apenas para conferir a formatação do documento exportado, sem conteúdo real.';

function preencher(d: Documento): Documento {
  return {
    ...d,
    metadados: {
      titulo: [{ tipo: 'texto', texto: 'Título fictício do trabalho' }],
      subtitulo: [{ tipo: 'texto', texto: 'subtítulo de teste' }],
      autoria: 'Nome Fictício da Autoria',
      instituicao: 'Universidade Federal do Tocantins',
      campus: 'Câmpus Fictício',
      curso: 'Curso de Exemplo',
      local: 'Palmas, TO',
      ano: '2026',
      natureza: 'Trabalho apresentado como requisito de teste do aplicativo.',
      orientador: { titulacao: 'Dra.', nome: 'Orientação Fictícia' },
    },
  };
}

function novo(tipo: TipoTrabalhoUft): Documento {
  let n = 0;
  return criarTrabalhoDoTipo({
    id: 'prj_Corpus000001',
    agora: '2026-01-01T00:00:00.000Z',
    appVersao: '0.0.0',
    tipo,
    novoId: (p) => `${p}_${String(++n).padStart(16, '0')}`,
  }).documento;
}

export function trabalhoDoTipo(tipo: TipoTrabalhoUft): Documento {
  return preencher(novo(tipo));
}

/** Obras fictícias para a lista REFERÊNCIAS e as chamadas (M4-T05): destaque, et al., In:, sufixo a/b, on-line, veículo. */
export const OBRAS_FICTICIAS: Obra[] = [
  { id: 'o1', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Exemplar Neto', prenomes: 'Autoria' }], titulo: [{ tipo: 'texto', texto: 'Estudo de ' }, { tipo: 'texto', texto: 'Caryocar brasiliense', marcas: ['italico'] }], subtitulo: [{ tipo: 'texto', texto: 'um caso fictício' }], edicao: 2, local: 'Palmas', editora: 'Editora Fictícia', ano: 2020, paginas: '120' },
  { id: 'o2', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Exemplar Neto', prenomes: 'Autoria' }], titulo: [{ tipo: 'texto', texto: 'Outro estudo' }], local: 'Palmas', editora: 'Editora Fictícia', ano: 2020 },
  { id: 'o3', tipo: 'capitulo', autores: [{ tipo: 'pessoa', sobrenome: 'Capítulo', prenomes: 'Autoria' }], titulo: [{ tipo: 'texto', texto: 'Um capítulo de teste' }], noTodo: { autores: [{ tipo: 'pessoa', sobrenome: 'Organização', prenomes: 'Fictícia' }], funcao: 'org', titulo: [{ tipo: 'texto', texto: 'Coletânea de teste' }] }, local: 'Palmas', editora: 'Editora Fictícia', ano: 2019, paginas: '10-30' },
  { id: 'o4', tipo: 'artigoPeriodico', autores: ['A', 'B', 'C', 'D'].map((x) => ({ tipo: 'pessoa' as const, sobrenome: `Coautoria ${x}`, prenomes: x })), titulo: [{ tipo: 'texto', texto: 'Artigo de teste' }], periodico: 'Revista Fictícia', local: 'Palmas', volume: '1', numero: '2', paginas: '3-4', ano: 2021, url: 'https://exemplo.invalid/artigo', acesso: '2026-01-01' },
  { id: 'o5', tipo: 'legislacao', jurisdicao: 'Brasil', titulo: [{ tipo: 'texto', texto: 'Lei fictícia nº 1, de 1 de janeiro de 2000' }], ementa: 'Ementa fictícia.', publicacao: 'Diário Oficial Fictício', local: 'Brasília, DF', paginas: '1', ano: 2000, dataPublicacao: '2 jan. 2000' },
];
const citacao = (id: string, forma: InlineCitacao['forma'], obras: InlineCitacao['obras'], extra: Partial<InlineCitacao> = {}): Inline => ({ tipo: 'citacao', id, forma, obras, ...extra });

const cel = (texto: string, extra: Partial<CelulaTabela> = {}): CelulaTabela => ({ conteudo: [{ tipo: 'texto', texto }], ...extra });
const tx = (texto: string) => [{ tipo: 'texto' as const, texto }];

/**
 * Tabela (M5-T03): cabeçalho em duas linhas com mesclagem nas duas direções, chamada de nota específica entre parênteses
 * (RN-267), sinal convencional, fonte, nota geral e duas notas específicas. Números fictícios.
 */
export const TABELA_CORPUS: BlocoTabela = {
  tipo: 'tabela',
  id: 'tab_corpus0001',
  especie: 'tabela',
  titulo: tx('Produção fictícia por região, 2020–2022'),
  colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'direita' }, { alinhamento: 'direita' }, { alinhamento: 'direita' }],
  linhasCabecalho: 2,
  linhas: [
    [cel('Região', { linhas: 2 }), cel('Produção (t)', { colunas: 3 })],
    [cel('2020'), cel('2021'), cel('2022')],
    [cel('Norte (1)'), cel('1.234,5'), cel('1.300,0'), cel('1.410,2')],
    [cel('Nordeste'), cel('2.100,0'), cel('–'), cel('2.250,7')],
    [cel('Sul', { linhas: 2 }), cel('987,1'), cel('1.002,3'), cel('...')],
    [cel('45,0'), cel('46,2'), cel('47,9')],
  ],
  fonte: tx('Dados fictícios de teste (2026).'),
  nota: tx('Sinal convencional utilizado: – Dado numérico igual a zero não resultante de arredondamento.'),
  notasEspecificas: [tx('Região de exemplo.'), tx('Outra nota de exemplo.')],
};

/** Quadro (M5-T03): texto, fechado. */
export const QUADRO_CORPUS: BlocoTabela = {
  tipo: 'tabela',
  id: 'tab_corpus0002',
  especie: 'quadro',
  titulo: tx('Etapas fictícias do procedimento'),
  colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'esquerda' }],
  linhasCabecalho: 1,
  linhas: [
    [cel('Etapa'), cel('Descrição')],
    [cel('Preparação'), cel('Separar o material de teste e conferir a lista.')],
    [cel('Execução'), cel('Aplicar o roteiro de exemplo, sem dados reais.')],
  ],
  fonte: tx('Elaborado pela autoria fictícia (2026).'),
};

/** Tabela longa (M5-T03): passa da página, com o cabeçalho repetido (RN-292) e o aviso de tabela longa (RN-297). */
export const TABELA_LONGA_CORPUS: BlocoTabela = {
  tipo: 'tabela',
  id: 'tab_corpus0003',
  especie: 'tabela',
  titulo: tx('Medições fictícias por amostra'),
  colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'direita' }],
  linhasCabecalho: 1,
  linhas: [[cel('Amostra'), cel('Valor (mm)')], ...Array.from({ length: 60 }, (_, i) => [cel(`Amostra ${i + 1}`), cel(`${10 + i},${i % 10}`)])],
  fonte: tx('Dados fictícios de teste (2026).'),
};

/** Tabela de CRC-32 do PNG. */
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Uint8Array): number => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * PNG em tons de cinza gerado aqui (M5-T06), sem arquivo de fora: degradê de `largura` × `altura` px, com a resolução
 * gravada no bloco pHYs (`ppi`, ou sem o bloco). Determinístico: os instantâneos dependem dos bytes.
 */
export function pngDeTeste(largura: number, altura: number, ppi: number | null): Uint8Array {
  const bloco = (tipo: string, dados: Uint8Array): Buffer => {
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corpo));
    return Buffer.concat([tam, corpo, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // 8 bits, tons de cinza (tipo 0)
  const linhas = Buffer.alloc((largura + 1) * altura);
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) linhas[y * (largura + 1) + 1 + x] = Math.floor((x * 255) / largura);
  const partes = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloco('IHDR', ihdr)];
  if (ppi !== null) {
    const phys = Buffer.alloc(9);
    phys.writeUInt32BE(Math.round(ppi / 0.0254), 0);
    phys.writeUInt32BE(Math.round(ppi / 0.0254), 4);
    phys[8] = 1;
    partes.push(bloco('pHYs', phys));
  }
  partes.push(bloco('IDAT', deflateSync(linhas, { level: 9 })), bloco('IEND', new Uint8Array()));
  return new Uint8Array(Buffer.concat(partes));
}

const PNG_CORPUS = pngDeTeste(600, 400, 300);
const SHA_PNG_CORPUS = createHash('sha256').update(PNG_CORPUS).digest('hex');
/** Imagens do corpus pelo sha256, como o pacote as entrega ao motor. */
export const IMAGENS_CORPUS: ReadonlyMap<string, Uint8Array> = new Map([[SHA_PNG_CORPUS, PNG_CORPUS]]);

/** Figura (M5-T06): imagem natural de 50,8 mm (600 px a 300 ppi), com fonte. */
export const FIGURA_CORPUS: BlocoIlustracao = {
  tipo: 'ilustracao',
  id: 'ilu_corpus0001',
  especie: 'figura',
  titulo: tx('Degradê fictício de teste'),
  midia: SHA_PNG_CORPUS,
  fonte: tx('Elaborado pela autoria fictícia (2026).'),
};

/** Cinco níveis, citação longa, notas, alíneas com subalíneas, listas que recomeçam, marcas, citações, apêndices e anexos. */
export function documentoDificil(): Documento {
  const d = preencher(novo('tese'));
  const p = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
  const nota = (id: string, texto: string): Inline => ({ tipo: 'nota', id, conteudo: [{ tipo: 'texto', texto }] });
  // M4-T07: nota de rodapé que cita a fonte, com volume.
  const notaComCitacao: Inline = { tipo: 'nota', id: 'n_cita', conteudo: [{ tipo: 'texto', texto: 'Ver ' }, { tipo: 'citacao', id: 'k5', forma: 'parentetica', obras: [{ obra: 'o2', volume: '2', pagina: '9' }] }, { tipo: 'texto', texto: '.' }] };
  const sec = (id: string, titulo: string, blocos: Bloco[] = [], subsecoes: Secao[] = []): Secao => ({ id, titulo: [{ tipo: 'texto', texto: titulo }], blocos, subsecoes });
  const q5 = sec('s5', 'Seção quinária', [p('p5', t(FRASE))]);
  const q4 = sec('s4', 'Seção quaternária', [p('p4', t(FRASE))], [q5]);
  const q3 = sec('s3', 'Seção terciária', [p('p3', t(FRASE))], [q4]);
  const q2 = sec('s2', 'Seção secundária', [p('p2', t(FRASE))], [q3]);
  const corpo: Secao[] = [
    sec('s1', 'Introdução à ação', [
      p('p1', t(`${FRASE} Com nota`), nota('n1', 'Primeira nota.'), t(' e '), { tipo: 'texto', texto: 'itálico', marcas: ['italico'] }, t(' e H'), { tipo: 'texto', texto: '2', marcas: ['subscrito'] }, t('O.')),
      { tipo: 'citacaoLonga', id: 'c1', conteudo: [t(`${FRASE} ${FRASE} ${FRASE}`), nota('n2', 'Nota na citação.'), t(' '), citacao('k1', 'parentetica', [{ obra: 'o1', pagina: '12' }])] },
      { tipo: 'alineas', id: 'a1', itens: [{ conteudo: [t('primeira;')], subalineas: [[t('subalínea;')], [t('outra subalínea;')]] }, { conteudo: [t('segunda;'), nota('n3', 'Nota na alínea.')] }, { conteudo: [t('terceira.')] }] },
      // M5-T08: remissiva à Tabela 1 (na seção 2): o texto vem da numeração.
      p('p1b', t('Texto entre listas; ver a '), { tipo: 'remissiva', id: 'rem_corpus01', alvo: TABELA_CORPUS.id }, t('.')),
      { tipo: 'alineas', id: 'a2', itens: Array.from({ length: 28 }, (_, i) => ({ conteudo: [t(`item ${i + 1};`)] })) },
      // M5-T07: duas equações numeradas, (1) e (2), com expoente, e uma sem número, com índice. Antes da quebra de
      // página pedida, onde há folga: no fim do texto, o LibreOffice passava REFERÊNCIAS para a folha seguinte e o Word
      // não (DOC-07, conferido no Word em 2026-11-08).
      { tipo: 'equacao', id: 'eqc_corpus01', numerada: true, conteudo: [...tx('E = mc'), { tipo: 'texto', texto: '2', marcas: ['sobrescrito'] }] },
      { tipo: 'equacao', id: 'eqc_corpus02', numerada: true, conteudo: tx('(x + y) / 5 = n') },
      { tipo: 'equacao', id: 'eqc_corpus03', conteudo: [...tx('x'), { tipo: 'texto', texto: 'i', marcas: ['subscrito'] }, ...tx(' + 1')] },
      { tipo: 'quebraPagina', id: 'q1' },
      p('p1c', t('Depois da quebra pedida pelo autor.\nCom quebra de linha\te tabulação.')),
    ], [q2]),
    sec('s6', 'Considerações finais', [
      p('p6', t(FRASE), t(' '), { tipo: 'sigla', id: 'sgu_corpus0001', sigla: 'sgl_corpus0001' }, t('.')),
      TABELA_CORPUS,
      p('p6b', t(FRASE)),
      QUADRO_CORPUS,
      TABELA_LONGA_CORPUS,
      FIGURA_CORPUS,
      p('p7', citacao('k2', 'narrativa', [{ obra: 'o4' }]), t(' e '), citacao('k3', 'narrativa', [{ obra: 'o3', pagina: '15' }], { apud: { obra: 'o2', pagina: '8' } }), t(' afirmam o exemplo '), citacao('k4', 'parentetica', [{ obra: 'o5' }, { obra: 'o1', semPaginacao: true }], { grifo: 'nosso' }), t('.'), notaComCitacao),
    ]),
  ];
  return {
    ...d,
    metadados: { ...d.metadados, coorientador: { titulacao: 'Dr.', nome: 'Coorientação Fictícia' }, areaConcentracao: 'Área de exemplo', volume: 'Volume 1' },
    preTextuais: d.preTextuais!.flatMap((e): ElementoPreTextual[] => e.tipo === 'sumario' ? [
      { tipo: 'listaIlustracoes', id: 'pre_corpuslista01' },
      { tipo: 'listaTabelas', id: 'pre_corpuslista02' },
      { tipo: 'listaSiglas', id: 'pre_corpuslista03' },
      { tipo: 'listaSimbolos', id: 'pre_corpuslista04' },
      e,
    ] : [e]).map((e) => {
      switch (e.tipo) {
        case 'fichaCatalografica':
          return { ...e, texto: 'Dados fictícios da ficha.' };
        case 'folhaAprovacao':
          return { ...e, dataAprovacao: '01/01/2026', banca: [{ titulacao: 'Dra.', nome: 'Banca Um', instituicao: 'UFT' }, { titulacao: 'Dr.', nome: 'Banca Dois', instituicao: 'UFT' }] };
        case 'resumo':
          return { ...e, texto: FRASE, palavrasChave: ['Teste', 'Exemplo'] };
        case 'abstract':
          return { ...e, texto: 'Fictional text for testing.', palavrasChave: ['Test', 'Example'] };
        default:
          return e;
      }
    }),
    corpo,
    obras: OBRAS_FICTICIAS,
    siglas: [{ id: 'sgl_corpus0001', sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' }],
    simbolos: [{ id: 'smb_corpus0001', simbolo: 'α', significado: 'Alfa' }, { id: 'smb_corpus0002', simbolo: 'β', significado: 'Beta' }],
    glossario: [{ id: 'gls_corpus0001', termo: 'Exemplo', definicao: 'Entrada fictícia para conferir a formatação.' }],
    posTextuais: [
      { tipo: 'referencias', id: 'r1' },
      { tipo: 'glossario', id: 'g1' },
      { tipo: 'apendice', id: 'ap1', titulo: 'Roteiro de exemplo' },
      { tipo: 'apendice', id: 'ap2', titulo: 'Questionário de exemplo' },
      { tipo: 'anexo', id: 'an1', titulo: 'Documento de exemplo' },
      { tipo: 'indice', id: 'i1' },
    ],
  };
}
