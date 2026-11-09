/**
 * E6-T02 — documentos de exemplo, um por tipo de trabalho, com todos os elementos que o aplicativo produz: pré-textuais
 * preenchidos, listas, cinco níveis de seção, citações (parentética, narrativa, longa com [...]), alíneas, nota de
 * rodapé, sigla, tabela, quadro, figura, gráfico da tabela, equação, remissivas a todos os elementos, referências,
 * glossário, apêndice com conteúdo e anexo. Conteúdo fictício e neutro, sem dados de pessoas.
 *
 * O exemplo é também o controle da validação: o verificador de conformidade não deve acusar nada nele.
 */
import { ORDEM_PRE_TEXTUAIS } from '../../src/dominio/modelo';
import type { Bloco, BlocoGrafico, BlocoIlustracao, BlocoTabela, Documento, ElementoPreTextual, Inline, Secao, TipoTrabalhoUft } from '../../src/dominio/modelo';
import { FIGURA_CORPUS, IMAGENS_CORPUS, OBRAS_FICTICIAS, QUADRO_CORPUS, trabalhoDoTipo } from './corpus';

export { IMAGENS_CORPUS as IMAGENS_EXEMPLOS };

const t = (texto: string): Inline => ({ tipo: 'texto', texto });
const tx = (texto: string) => [{ tipo: 'texto' as const, texto }];
const FRASE = 'Este parágrafo fictício existe apenas para mostrar a formatação do trabalho exportado, sem conteúdo real.';
const RESUMO = Array.from({ length: 20 }, () => 'Texto fictício do resumo, escrito só para conferir a formatação.').join(' ');
const ABSTRACT = Array.from({ length: 20 }, () => 'Fictional abstract text, written only to check the layout.').join(' ');

const p = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
const sec = (id: string, titulo: string, blocos: Bloco[], subsecoes: Secao[] = []): Secao => ({ id, titulo: tx(titulo), blocos, subsecoes });
const rem = (id: string, alvo: string): Inline => ({ tipo: 'remissiva', id, alvo });
const cel = (texto: string) => ({ conteudo: tx(texto) });

const TABELA: BlocoTabela = {
  tipo: 'tabela', id: 'tab_exemplo00001', especie: 'tabela',
  titulo: tx('Produção fictícia por região do Brasil, 2020-2022'),
  colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'direita' }, { alinhamento: 'direita' }, { alinhamento: 'direita' }],
  linhasCabecalho: 1,
  linhas: [
    [cel('Região'), cel('2020 (t)'), cel('2021 (t)'), cel('2022 (t)')],
    [cel('Norte'), cel('1.234,5'), cel('1.300,0'), cel('1.410,2')],
    [cel('Nordeste'), cel('2.100,0'), cel('-'), cel('2.250,7')],
    [cel('Sul'), cel('987,1'), cel('2.002,3'), cel('1.000,0')],
  ],
  fonte: tx('Dados fictícios de teste (2026).'),
  nota: tx('Sinal convencional utilizado: - Dado numérico igual a zero não resultante de arredondamento.'),
};
const QUADRO: BlocoTabela = { ...structuredClone(QUADRO_CORPUS), id: 'tab_exemplo00002' };
const FIGURA: BlocoIlustracao = { ...structuredClone(FIGURA_CORPUS), id: 'ilu_exemplo00001', titulo: tx('Degradê fictício usado como figura de exemplo') };
const GRAFICO: BlocoGrafico = { tipo: 'grafico', id: 'grf_exemplo00001', tabela: TABELA.id, forma: 'colunas', titulo: tx('Produção fictícia por região do Brasil, 2020-2022'), fonte: tx('Dados fictícios de teste (2026).') };

function corpo(): Secao[] {
  const q5 = sec('sec_exemplo00025', 'Detalhe do quinto nível', [p('par_exemplo00025', t(FRASE))]);
  const q4 = sec('sec_exemplo00024', 'Detalhe do quarto nível', [p('par_exemplo00024', t(FRASE))], [q5]);
  const q3 = sec('sec_exemplo00023', 'Conceitos de apoio', [p('par_exemplo00023', t(FRASE))], [q4]);
  return [
    sec('sec_exemplo00001', 'Introdução', [
      p('par_exemplo00001', t('Este trabalho fictício, feito na '), { tipo: 'sigla', id: 'sgu_exemplo00001', sigla: 'sgl_exemplo00001' },
        t(', mostra a formatação. Os elementos estão na '), rem('rem_exemplo00001', TABELA.id), t(', no '), rem('rem_exemplo00002', QUADRO.id),
        t(', na '), rem('rem_exemplo00003', FIGURA.id), t(', no '), rem('rem_exemplo00004', GRAFICO.id), t(' e na equação '), rem('rem_exemplo00005', 'equ_exemplo00001'),
        t('; o método está na seção '), rem('rem_exemplo00006', 'sec_exemplo00003'), t('.'),
        { tipo: 'nota', id: 'nta_exemplo00001', conteudo: tx('Nota de rodapé fictícia.') }),
      p('par_exemplo00002', t('A '), { tipo: 'sigla', id: 'sgu_exemplo00002', sigla: 'sgl_exemplo00001' }, t(' aparece de novo só com a sigla. '), t(FRASE)),
    ]),
    sec('sec_exemplo00002', 'Referencial teórico', [
      p('par_exemplo00003', t('Segundo '), { tipo: 'citacao', id: 'cit_exemplo00001', forma: 'narrativa', obras: [{ obra: 'obr_exemplo_o4' }] }, t(', o exemplo vale. '), t(FRASE.slice(0, -1)), t(' '),
        { tipo: 'citacao', id: 'cit_exemplo00002', forma: 'parentetica', obras: [{ obra: 'obr_exemplo_o1', pagina: '12' }] }, t('.')),
      { tipo: 'citacaoLonga', id: 'cil_exemplo00001', conteudo: [t(`${FRASE} [...] ${FRASE} ${FRASE}`), t(' '), { tipo: 'citacao', id: 'cit_exemplo00003', forma: 'parentetica', obras: [{ obra: 'obr_exemplo_o3', pagina: '15' }] }] },
      p('par_exemplo00004', t('A legislação fictícia '), { tipo: 'citacao', id: 'cit_exemplo00004', forma: 'parentetica', obras: [{ obra: 'obr_exemplo_o5' }] }, t(' e outra obra '),
        { tipo: 'citacao', id: 'cit_exemplo00005', forma: 'parentetica', obras: [{ obra: 'obr_exemplo_o2' }] }, t(' completam o quadro.')),
    ], [sec('sec_exemplo00021', 'Fundamentos', [p('par_exemplo00021', t(FRASE))], [q3])]),
    sec('sec_exemplo00003', 'Metodologia', [
      p('par_exemplo00005', t('O procedimento tem três passos:')),
      { tipo: 'alineas', id: 'ali_exemplo00001', itens: [{ conteudo: tx('preparar o material;'), subalineas: [tx('separar as amostras;'), tx('conferir a lista;')] }, { conteudo: tx('aplicar o roteiro;') }, { conteudo: tx('registrar os resultados.') }] },
      QUADRO,
      { tipo: 'equacao', id: 'equ_exemplo00001', numerada: true, conteudo: [...tx('E = mc'), { tipo: 'texto', texto: '2', marcas: ['sobrescrito'] }] },
    ]),
    sec('sec_exemplo00004', 'Resultados', [p('par_exemplo00006', t(FRASE)), TABELA, GRAFICO, FIGURA]),
    sec('sec_exemplo00005', 'Considerações finais', [p('par_exemplo00007', t(FRASE))]),
  ];
}

function preTextuais(lista: readonly ElementoPreTextual[]): ElementoPreTextual[] {
  const tem = new Set(lista.map((e) => e.tipo));
  const listas: ElementoPreTextual[] = [
    { tipo: 'listaIlustracoes', id: 'pre_exemplolis01' },
    { tipo: 'listaTabelas', id: 'pre_exemplolis02' },
    { tipo: 'listaSiglas', id: 'pre_exemplolis03' },
  ];
  return lista.flatMap((e): ElementoPreTextual[] => e.tipo === 'sumario' ? [...listas.filter((x) => !tem.has(x.tipo)), e] : [e]).map((e): ElementoPreTextual => {
    switch (e.tipo) {
      case 'fichaCatalografica': return { ...e, texto: 'Dados fictícios da ficha catalográfica.' };
      case 'errata': return { ...e, texto: 'Folha 10, linha 3: onde se lê "exemplo", leia-se "modelo".' };
      case 'dedicatoria': return { ...e, texto: 'Dedicatória fictícia.' };
      case 'agradecimentos': return { ...e, texto: 'Agradecimentos fictícios.' };
      case 'epigrafe': return { ...e, texto: 'Epígrafe fictícia.' };
      case 'folhaAprovacao': return { ...e, dataAprovacao: '01/12/2026', banca: [{ titulacao: 'Dra.', nome: 'Banca Fictícia Um', instituicao: 'Universidade Federal do Tocantins' }, { titulacao: 'Dr.', nome: 'Banca Fictícia Dois', instituicao: 'Universidade Federal do Tocantins' }] };
      case 'resumo': return { ...e, texto: RESUMO, palavrasChave: ['Formatação', 'Exemplo', 'Teste'] };
      case 'abstract': return { ...e, texto: ABSTRACT, palavrasChave: ['Formatting', 'Example', 'Test'] };
      default: return e;
    }
  });
}

/** Exemplo completo do tipo de trabalho (E6-T02). */
export function exemploCompleto(tipo: TipoTrabalhoUft): Documento {
  const d = trabalhoDoTipo(tipo);
  return {
    ...d,
    id: `prj_exemplo_${tipo}`.slice(0, 64),
    metadados: { ...d.metadados, titulo: tx(`Exemplo de ${tipo.replace('-', ' ')}`) },
    // Ordem canônica do Quadro 5: as listas entram antes do sumário em todos os tipos.
    preTextuais: preTextuais(d.preTextuais ?? []).sort((a, b) => ORDEM_PRE_TEXTUAIS.indexOf(a.tipo) - ORDEM_PRE_TEXTUAIS.indexOf(b.tipo)),
    corpo: corpo(),
    obras: structuredClone(OBRAS_FICTICIAS).map((o) => ({ ...o, id: `obr_exemplo_${o.id}` })),
    siglas: [{ id: 'sgl_exemplo00001', sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' }],
    glossario: [{ id: 'gls_exemplo00001', termo: 'Exemplo', definicao: 'Entrada fictícia para conferir a formatação.' }],
    posTextuais: [
      ...(d.posTextuais ?? []).filter((e) => e.tipo === 'referencias'),
      { tipo: 'glossario', id: 'pos_exemplo00002' },
      { tipo: 'apendice', id: 'pos_exemplo00003', titulo: 'Roteiro fictício', blocos: [p('par_exemplo00090', t('Roteiro fictício: '), t(FRASE))] },
      { tipo: 'anexo', id: 'pos_exemplo00004', titulo: 'Documento fictício de terceiros', blocos: [p('par_exemplo00091', t(FRASE))] },
    ],
  };
}
