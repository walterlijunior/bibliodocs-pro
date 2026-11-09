import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import type { BlocoTabela, Documento } from '../src/dominio/modelo';
import type { Perfil } from '../src/dominio/normas';
import { avaliarConformidade } from '../src/dominio/verificador/conformidade';
import { verificarTabelas } from '../src/dominio/verificador/tabelas';
import { QUADRO_CORPUS } from './corpus/corpus';

const t = (texto: string) => [{ tipo: 'texto' as const, texto }];
const linha = (...c: string[]) => c.map((x) => ({ conteudo: t(x) }));
const tabela = (o: Partial<BlocoTabela> & { linhas: BlocoTabela['linhas'] }): BlocoTabela => ({
  tipo: 'tabela', id: 'tab_vtab', especie: 'tabela', titulo: t('Pessoas residentes, por situação do domicílio - Brasil - 1980'),
  colunas: o.linhas[0]!.map(() => ({ alinhamento: 'direita' as const })), linhasCabecalho: 1, fonte: t('Fundação Instituto Brasileiro de Geografia e Estatística'), ...o,
});
const doc = (...blocos: BlocoTabela[]): Documento => ({ id: 'prj_vtab', tipoTrabalho: 'generico', metadados: { titulo: [] }, corpo: [{ id: 'sec_vtab', titulo: t('Texto'), blocos, subsecoes: [] }] });
const codigos = (b: BlocoTabela) => verificarTabelas(doc(b)).map((p) => p.codigo);

/** IBGE, Normas de apresentação tabular, Anexo B, Tabela 1 (p. 44), transcrita. */
const IBGE_TABELA_1 = tabela({
  titulo: t('Pessoas residentes em domicílios particulares, por sexo e situação do domicílio - Brasil - 1980'),
  linhas: [linha('Situação do domicílio', 'Total', 'Mulheres', 'Homens'), linha('Total', '117 960 301', '59 595 332', '58 364 969'), linha('Urbana', '79 972 931', '41 115 439', '38 857 492'), linha('Rural', '37 987 370', '18 479 893', '19 507 477')],
  fonte: t('Fundação Instituto Brasileiro de Geografia e Estatística - IBGE'),
});
/** Anexo B, Tabela 4 (p. 49), recorte, com as chamadas de nota "(2)", "(3)". */
const IBGE_TABELA_4 = tabela({
  titulo: t('Esperança de vida ao nascer, por região socioeconômica - Brasil - 1940/1980'),
  linhas: [linha('Região socioeconômica', '1940', '1950', '1960'), linha('Brasil', '(2) 42,74', '(2) 45,90', '(3) 52,37'), linha('Região I - RJ', '45,38', '50,91', '59,19'), linha('Região VI - DF', '...', '48,91', '54,17')],
});

describe('M7-T02: controles do Anexo B do IBGE sem falso positivo', () => {
  it.each([['Tabela 1', IBGE_TABELA_1], ['Tabela 4', IBGE_TABELA_4]])('%s', (_n, b) => {
    expect(verificarTabelas(doc(b))).toEqual([]);
  });
  it('quadro fica de fora (não segue a Norma Tabular)', () => {
    expect(codigos({ ...QUADRO_CORPUS, titulo: t('Conceitos do IBGE.') })).toEqual([]);
  });
});

describe('M7-T02: cada verificação, positiva e negativa', () => {
  const base = IBGE_TABELA_1;
  it('RN-247: sigla no título; numeral romano não conta', () => {
    expect(codigos({ ...base, titulo: t('População do DF - 2020') })).toEqual(['TABELA_TITULO_SIGLA']);
    expect(codigos({ ...base, titulo: t('População no século XX - Brasil - 1980') })).toEqual([]);
  });
  it('RN-310 (provisória): ponto final no título; reticências passam', () => {
    expect(codigos({ ...base, titulo: t('População - Brasil - 1980.') })).toEqual(['TABELA_TITULO_PONTO']);
    expect(codigos({ ...base, titulo: t('População - Brasil - 1980...') })).toEqual([]);
  });
  it('RN-271: fonte só com sigla', () => {
    expect(codigos({ ...base, fonte: t('IBGE') })).toEqual(['TABELA_FONTE_SIGLA']);
    expect(codigos({ ...base, fonte: t('IBGE, Censo Demográfico 1980') })).toEqual([]);
  });
  it('RN-256: cabeçalho da coluna indicadora vazio', () => {
    expect(codigos({ ...base, linhas: [linha('', 'Total', 'Mulheres', 'Homens'), ...base.linhas.slice(1)] })).toEqual(['TABELA_SEM_INDICADOR']);
  });
  it('RN-279: série consecutiva com meia-risca ou "a"; hífen e barra passam', () => {
    expect(codigos({ ...base, titulo: t('População - Brasil - 1981–1985') })).toEqual(['TABELA_SERIE_TEMPORAL']);
    expect(codigos({ ...base, titulo: t('População - Brasil - 1981 a 1985') })).toEqual(['TABELA_SERIE_TEMPORAL']);
    expect(codigos({ ...base, titulo: t('População - Brasil - 1981-1985') })).toEqual([]);
    expect(codigos({ ...base, titulo: t('População - Brasil - 1981/1985') })).toEqual([]);
  });
  it('RN-263: célula vazia ou "n/d" em coluna numérica; sinais da lista passam', () => {
    const r = verificarTabelas(doc({ ...base, linhas: [base.linhas[0]!, linha('Total', '10', '5', '5'), linha('Urbana', '6', 'n/d', '3'), linha('Rural', '4', '', '2')] }));
    expect(r.map((p) => p.codigo)).toContain('TABELA_CELULA_FORA_DOS_SINAIS');
    expect(r.find((p) => p.codigo === 'TABELA_CELULA_FORA_DOS_SINAIS')!.mensagem).toMatch(/“n\/d”.*conteúdo vazio/u);
    expect(codigos({ ...base, linhas: [base.linhas[0]!, linha('Total', '10', '5', '5'), linha('Urbana', '6', '-', '3'), linha('Rural', '4', 'X', '2')] })).not.toContain('TABELA_CELULA_FORA_DOS_SINAIS');
  });
  it('RN-263: coluna só de texto não é cobrada', () => {
    expect(codigos({ ...base, linhas: [linha('Região', 'Capital', 'População'), linha('Norte', 'Belém', '10'), linha('Sul', '', '20')] })).toEqual([]);
  });
  it('RN-284: primeira ou última classe aberta', () => {
    const classes = (a: string, z: string) => ({ ...base, linhas: [linha('Idade', 'Pessoas'), linha(a, '10'), linha('5 a menos de 10', '20'), linha(z, '30')] });
    expect(codigos(classes('Até 5 anos', '10 anos ou mais'))).toEqual(['TABELA_CLASSE_ABERTA']);
    expect(codigos(classes('0 a menos de 5', '10 a menos de 15'))).toEqual([]);
  });
  it('RN-287: total diferente da soma sem nota geral; com nota passa', () => {
    const b = { ...base, linhas: [linha('Situação', 'Pessoas', 'Taxa (%)'), linha('Total', '100', '100,0'), linha('Urbana', '60', '33,3'), linha('Rural', '41', '66,6')] };
    expect(codigos(b)).toEqual(['TABELA_TOTAL_DIVERGENTE']);
    expect(codigos({ ...b, nota: t('A soma das parcelas difere do total por arredondamento.') })).toEqual([]);
  });
  it('RN-298: sinais tantos quanto os dados', () => {
    expect(codigos({ ...base, linhas: [linha('Ano', 'Valor'), linha('2000', '...'), linha('2001', '5'), linha('2002', 'X')] })).toEqual(['TABELA_SINAIS_DEMAIS']);
  });
  it('RN-299: "Outros" maior que outra classificação', () => {
    const b = (outros: string) => ({ ...base, linhas: [linha('Produto', 'Toneladas'), linha('Soja', '50'), linha('Milho', '30'), linha('Outros', outros)] });
    expect(codigos(b('40'))).toEqual(['TABELA_OUTROS_MAIOR']);
    expect(codigos(b('10'))).toEqual([]);
  });
});

describe('M7-T02: integração com o relatório', () => {
  it('tudo aviso, com sugestão e local no elemento; RN-310 marcada provisória', () => {
    const r = avaliarConformidade(doc({ ...IBGE_TABELA_1, titulo: t('População do DF - 1980.') }), PERFIL);
    expect(r.diagnosticos).toEqual([]);
    const tab = r.problemas.filter((p) => p.codigo.startsWith('TABELA_'));
    expect(tab.map((p) => [p.codigo, p.gravidade, p.provisoria ?? false])).toEqual([
      ['TABELA_TITULO_SIGLA', 'aviso', false], ['TABELA_TITULO_PONTO', 'aviso', true],
    ]);
    for (const p of tab) expect(p.local).toMatchObject({ tipo: 'texto', secao: 'sec_vtab', no: 'tab_vtab' });
  });
  it('RN-310 desligada no perfil vira diagnóstico, não acusação', () => {
    const p: Perfil = { ...PERFIL, parametros: { ...PERFIL.parametros, verificarPontoFinalTituloTabela: { ...PERFIL.parametros['verificarPontoFinalTituloTabela']!, valor: false } } };
    const r = avaliarConformidade(doc({ ...IBGE_TABELA_1, titulo: t('População - Brasil - 1980.') }), p);
    expect(r.problemas.filter((x) => x.codigo.startsWith('TABELA_'))).toEqual([]);
    expect(r.diagnosticos).toContainEqual(expect.objectContaining({ codigo: 'REGRA_DESATIVADA', origem: ['RN-310'] }));
  });
  it('não muda o documento', () => {
    const d = doc(IBGE_TABELA_1);
    const antes = JSON.stringify(d);
    verificarTabelas(d);
    expect(JSON.stringify(d)).toBe(antes);
  });
});
