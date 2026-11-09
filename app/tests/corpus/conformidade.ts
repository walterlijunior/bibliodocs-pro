/** RF-15: referência fictícia correta e dez defeitos identificáveis, sem dados de usuários. */
import { criarTrabalhoDoTipo } from '../../src/aplicacao/servicos/criar-trabalho';
import type { BlocoIlustracao, BlocoTabela, Documento, ElementoPreTextual, Inline, Obra } from '../../src/dominio/modelo';
import { FIGURA_CORPUS, IMAGENS_CORPUS, TABELA_CORPUS } from './corpus';

export { IMAGENS_CORPUS as IMAGENS_CONFORMIDADE };
const texto = (t: string): Inline => ({ tipo: 'texto', texto: t });
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
      { ...structuredClone(TABELA_CORPUS), titulo: [{ tipo: 'texto', texto: 'Produção fictícia por região, 2020-2022' }] },
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
