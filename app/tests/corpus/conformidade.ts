/** RF-15: referência fictícia correta e dez defeitos identificáveis, sem dados de usuários. */
import { criarTrabalhoDoTipo } from '../../src/aplicacao/servicos/criar-trabalho';
import type { BlocoIlustracao, BlocoTabela, Documento, ElementoPreTextual, Inline, Obra } from '../../src/dominio/modelo';
import { FIGURA_CORPUS, IMAGENS_CORPUS, TABELA_CORPUS } from './corpus';

export { IMAGENS_CORPUS as IMAGENS_CONFORMIDADE };
const texto = (t: string): Inline => ({ tipo: 'texto', texto: t });
const tt = (t: string) => ({ tipo: 'texto' as const, texto: t });
const resumo = Array.from({ length: 180 }, () => 'palavra').join(' ');

export function documentoCorretoConformidade(): Documento {
  let n = 0;
  const d = criarTrabalhoDoTipo({ id: 'prj_conformidade0001', agora: '2026-11-08T00:00:00.000Z', appVersao: '0.1.0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` }).documento;
  const obra: Obra = { id: 'obr_conformidade01', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Silva', prenomes: 'Ana' }], titulo: [{ tipo: 'texto', texto: 'Livro fictício completo' }], local: 'Palmas', editora: 'Editora fictícia', ano: 2020 };
  return {
    ...d,
    metadados: { titulo: [{ tipo: 'texto', texto: 'Trabalho fictício correto' }], autoria: 'Autoria fictícia', instituicao: 'Universidade fictícia', campus: 'Palmas', curso: 'Curso fictício', natureza: 'Monografia apresentada como trabalho de conclusão de curso.', orientador: { nome: 'Orientação fictícia', titulacao: 'Dra.' }, local: 'Palmas', ano: '2026' },
    preTextuais: d.preTextuais!.map((e): ElementoPreTextual => {
      if (e.tipo === 'fichaCatalografica') return { ...e, texto: 'Ficha fictícia completa.' };
      if (e.tipo === 'folhaAprovacao') return { ...e, dataAprovacao: '08/11/2026', banca: [{ nome: 'Banca fictícia', titulacao: 'Dra.', instituicao: 'Universidade fictícia' }] };
      if (e.tipo === 'resumo' || e.tipo === 'abstract') return { ...e, texto: resumo, palavrasChave: ['Teste', 'Documento'] };
      return e;
    }),
    corpo: [{ id: 'sec_conformidade01', titulo: [{ tipo: 'texto', texto: 'Introdução' }], subsecoes: [], blocos: [
      { tipo: 'paragrafo', id: 'par_conformidade01', conteudo: [texto('Segundo '), { tipo: 'citacao', id: 'cit_conformidade01', forma: 'narrativa', obras: [{ obra: obra.id }] }, texto(', veja '), { tipo: 'remissiva', id: 'rem_conformidade01', alvo: TABELA_CORPUS.id }, texto(' e '), { tipo: 'remissiva', id: 'rem_conformidade02', alvo: FIGURA_CORPUS.id }, texto('.')] },
      // M7-T02: série consecutiva com hífen (RN-279); o corpus da regressão DOCX mantém a meia-risca.
      // E6-T04: os dois sinais usados explicados na nota geral (RN-265) e uma nota específica para a única chamada (RN-276).
      {
        ...structuredClone(TABELA_CORPUS),
        titulo: [{ tipo: 'texto', texto: 'Produção fictícia por região, 2020-2022' }],
        nota: [{ tipo: 'texto', texto: 'Sinais convencionais utilizados: – Dado numérico igual a zero não resultante de arredondamento. ... Dado numérico não disponível.' }],
        notasEspecificas: [TABELA_CORPUS.notasEspecificas![0]!],
      },
      { ...structuredClone(FIGURA_CORPUS), larguraMm: 80 },
      { tipo: 'equacao', id: 'equ_conformidade01', numerada: true, conteudo: [{ tipo: 'texto', texto: 'x + 1 = 2' }] },
    ] }],
    obras: [obra],
    posTextuais: [{ tipo: 'referencias', id: 'pos_conformidade01' }],
  };
}

/** 4 pré-textuais, 4 visuais e 2 bibliográficos. Os dez continuam sendo um projeto válido e editável. */
export function documentoDezFalhasConformidade(): Documento {
  const d = documentoCorretoConformidade();
  delete d.metadados.instituicao; // RN-117.
  d.preTextuais = d.preTextuais!.map((e) => {
    if (e.tipo === 'fichaCatalografica') { const { texto: _t, ...resto } = e; return resto; } // RN-135.
    if (e.tipo === 'resumo') return { ...e, texto: 'Resumo curto.' }; // RN-154.
    if (e.tipo === 'abstract') return { ...e, palavrasChave: ['Um', 'Dois', 'Três', 'Quatro', 'Cinco'] }; // RN-155.
    return e;
  });
  const blocos = d.corpo[0]!.blocos;
  const p = blocos[0]!;
  if (p.tipo === 'paragrafo') p.conteudo = [texto('Segundo Silva (2020), veja '), ...p.conteudo.slice(3)]; // RN-078: chamada sem ligação e obra sem citação.
  const tabela = blocos[1] as BlocoTabela;
  delete tabela.fonte; // RN-269/274.
  const figura = blocos[2] as BlocoIlustracao;
  figura.titulo = [{ tipo: 'texto', texto: ' ' }]; // RN-050/051.
  figura.larguraMm = 160; // RNF-17/D-M5-09: 600 px a 160 mm, abaixo de 150 ppi.
  const eq = blocos[3]!;
  if (eq.tipo === 'equacao') delete eq.numerada; // RN-106.
  return d;
}

/**
 * M7-T04 (aceite ampliado do RF-15, D-M7-05): controle correto com uma subseção, citação com supressão em colchetes e texto
 * sem sigla solta. É o controle de `documentoCorretoConformidade` mais o que as famílias novas (texto, tabela, sigla) leem.
 */
export function documentoCorretoM7(): Documento {
  const d = documentoCorretoConformidade();
  d.metadados.titulo = [tt('Trabalho fictício de aceite do verificador')];
  d.corpo[0]!.subsecoes = [{ id: 'sec_conformidade02', titulo: [tt('Metodologia da pesquisa')], subsecoes: [], blocos: [
    { tipo: 'paragrafo', id: 'par_conformidade02', conteudo: [texto('Disse que “a pesquisa [...] avançou” e a universidade apoiou.')] },
  ] }];
  return d;
}

/** As dez não conformidades do aceite, cada uma de uma regra, em seis famílias. Comentário: código esperado. */
export const DEZ_FALHAS_M7 = [
  'PRE_TEXTUAL_INCOMPLETO', // pré-textual: ficha sem texto (RN-135)
  'CHAMADA_SEM_LIGACAO', // bibliografia: "Silva (2020)" escrito como texto (RN-078)
  'OBRA_NAO_CITADA', // bibliografia: a obra deixa de ser citada (RN-078)
  'SEM_FONTE', // visual: figura sem fonte (RN-056)
  'EQUACAO_SEM_NUMERO', // visual: equação sem número (RN-106)
  'TABELA_SERIE_TEMPORAL', // tabela: "2020–2022" com meia-risca (RN-279)
  'TABELA_CELULA_FORA_DOS_SINAIS', // tabela: "n/d" no lugar de "..." (RN-263)
  'SUPRESSAO_FORA_DO_PADRAO', // texto: "(...)" na citação (RN-086)
  'TITULO_CAIXA_ALTA', // texto: subseção em maiúsculas (RN-043)
  'SIGLA_SEM_CADASTRO', // sigla: "UFT" sem cadastro (RN-046)
] as const;

export function documentoDezFalhasM7(): Documento {
  const d = documentoCorretoM7();
  d.preTextuais = d.preTextuais!.map((e) => {
    if (e.tipo === 'fichaCatalografica') { const { texto: _t, ...resto } = e; return resto; }
    return e;
  });
  const sec = d.corpo[0]!;
  const p = sec.blocos[0]!;
  if (p.tipo === 'paragrafo') p.conteudo = [texto('Segundo Silva (2020), veja '), ...p.conteudo.slice(3)];
  const tabela = sec.blocos[1] as BlocoTabela;
  tabela.titulo = [tt('Produção fictícia por região, 2020–2022')];
  const celula = tabela.linhas.flat().find((c) => c.conteudo.some((i) => i.texto === '...'))!;
  celula.conteudo = [tt('n/d')];
  delete (sec.blocos[2] as BlocoIlustracao).fonte;
  const eq = sec.blocos[3]!;
  if (eq.tipo === 'equacao') delete eq.numerada;
  const sub = sec.subsecoes[0]!;
  sub.titulo = [tt('METODOLOGIA DA PESQUISA')];
  sub.blocos = [{ tipo: 'paragrafo', id: 'par_conformidade02', conteudo: [texto('Disse que “a pesquisa (...) avançou” e a UFT apoiou.')] }];
  return d;
}
