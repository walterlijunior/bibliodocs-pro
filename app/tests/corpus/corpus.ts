// Corpus da regressão documental (M3-T06; skill `regressao-documental`). Conteúdo fictício e neutro, gerado aqui: nada de
// dados reais. Um trabalho por tipo e um "documento difícil". Tabelas, figuras e equações entram no M5.
import { criarTrabalhoDoTipo } from '../../src/aplicacao/servicos/criar-trabalho';
import type { Bloco, Documento, Inline, InlineCitacao, Obra, Secao, TipoTrabalhoUft } from '../../src/dominio/modelo';

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
const OBRAS_FICTICIAS: Obra[] = [
  { id: 'o1', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Exemplar Neto', prenomes: 'Autoria' }], titulo: [{ tipo: 'texto', texto: 'Estudo de ' }, { tipo: 'texto', texto: 'Caryocar brasiliense', marcas: ['italico'] }], subtitulo: [{ tipo: 'texto', texto: 'um caso fictício' }], edicao: 2, local: 'Palmas', editora: 'Editora Fictícia', ano: 2020, paginas: '120' },
  { id: 'o2', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Exemplar Neto', prenomes: 'Autoria' }], titulo: [{ tipo: 'texto', texto: 'Outro estudo' }], local: 'Palmas', editora: 'Editora Fictícia', ano: 2020 },
  { id: 'o3', tipo: 'capitulo', autores: [{ tipo: 'pessoa', sobrenome: 'Capítulo', prenomes: 'Autoria' }], titulo: [{ tipo: 'texto', texto: 'Um capítulo de teste' }], noTodo: { autores: [{ tipo: 'pessoa', sobrenome: 'Organização', prenomes: 'Fictícia' }], funcao: 'org', titulo: [{ tipo: 'texto', texto: 'Coletânea de teste' }] }, local: 'Palmas', editora: 'Editora Fictícia', ano: 2019, paginas: '10-30' },
  { id: 'o4', tipo: 'artigoPeriodico', autores: ['A', 'B', 'C', 'D'].map((x) => ({ tipo: 'pessoa' as const, sobrenome: `Coautoria ${x}`, prenomes: x })), titulo: [{ tipo: 'texto', texto: 'Artigo de teste' }], periodico: 'Revista Fictícia', local: 'Palmas', volume: '1', numero: '2', paginas: '3-4', ano: 2021, url: 'https://exemplo.invalid/artigo', acesso: '2026-01-01' },
  { id: 'o5', tipo: 'legislacao', jurisdicao: 'Brasil', titulo: [{ tipo: 'texto', texto: 'Lei fictícia nº 1, de 1 de janeiro de 2000' }], ementa: 'Ementa fictícia.', publicacao: 'Diário Oficial Fictício', local: 'Brasília, DF', paginas: '1', ano: 2000, dataPublicacao: '2 jan. 2000' },
];
const citacao = (id: string, forma: InlineCitacao['forma'], obras: InlineCitacao['obras'], extra: Partial<InlineCitacao> = {}): Inline => ({ tipo: 'citacao', id, forma, obras, ...extra });

/** Cinco níveis, citação longa, notas, alíneas com subalíneas, listas que recomeçam, marcas, citações, apêndices e anexos. */
export function documentoDificil(): Documento {
  const d = preencher(novo('tese'));
  const p = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
  const nota = (id: string, texto: string): Inline => ({ tipo: 'nota', id, conteudo: [{ tipo: 'texto', texto }] });
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
      p('p1b', t('Texto entre listas.')),
      { tipo: 'alineas', id: 'a2', itens: Array.from({ length: 28 }, (_, i) => ({ conteudo: [t(`item ${i + 1};`)] })) },
      { tipo: 'quebraPagina', id: 'q1' },
      p('p1c', t('Depois da quebra pedida pelo autor.\nCom quebra de linha\te tabulação.')),
    ], [q2]),
    sec('s6', 'Considerações finais', [
      p('p6', t(FRASE)),
      p('p7', citacao('k2', 'narrativa', [{ obra: 'o4' }]), t(' e '), citacao('k3', 'narrativa', [{ obra: 'o3', pagina: '15' }], { apud: { obra: 'o2', pagina: '8' } }), t(' afirmam o exemplo '), citacao('k4', 'parentetica', [{ obra: 'o5' }, { obra: 'o1', semPaginacao: true }], { grifo: 'nosso' }), t('.')),
    ]),
  ];
  return {
    ...d,
    metadados: { ...d.metadados, coorientador: { titulacao: 'Dr.', nome: 'Coorientação Fictícia' }, areaConcentracao: 'Área de exemplo', volume: 'Volume 1' },
    preTextuais: d.preTextuais!.map((e) => {
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
