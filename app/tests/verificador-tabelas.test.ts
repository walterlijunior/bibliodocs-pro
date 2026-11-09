import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import type { BlocoTabela, Documento } from '../src/dominio/modelo';
import type { Perfil } from '../src/dominio/normas';
import { avaliarConformidade } from '../src/dominio/verificador/conformidade';
import { verificarTabelas } from '../src/dominio/verificador/tabelas';
import { rodapeDoElemento } from '../src/dominio/visuais';
import { FIGURA_CORPUS, QUADRO_CORPUS } from './corpus/corpus';

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
  // E6-T04: o recorte leva a chamada (1) do cabeçalho, as três notas específicas e o sinal explicado na nota geral.
  nota: t('Sinal convencional utilizado: ... Dado numérico não disponível.'),
  notasEspecificas: [t('Nota fictícia um.'), t('Nota fictícia dois.'), t('Nota fictícia três.')],
  linhas: [linha('Região socioeconômica (1)', '1940', '1950', '1960'), linha('Brasil', '(2) 42,74', '(2) 45,90', '(3) 52,37'), linha('Região I - RJ', '45,38', '50,91', '59,19'), linha('Região VI - DF', '...', '48,91', '54,17')],
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
  it('RN-279: série consecutiva com meia-risca, no título ou no cabeçalho; hífen, barra e "a" passam', () => {
    expect(codigos({ ...base, titulo: t('População - Brasil - 1981–1985') })).toEqual(['TABELA_SERIE_TEMPORAL']);
    expect(codigos({ ...base, linhas: [linha('Situação', 'Média 2010–2015', 'Mulheres', 'Homens'), ...base.linhas.slice(1)] })).toEqual(['TABELA_SERIE_TEMPORAL']);
    // N-M7-02: período por extenso no título (IBGE 4.2.2) e classe "w a z" na indicadora (6.3) não são acusados.
    expect(codigos({ ...base, titulo: t('Mortes registradas de 1956 a 1964 - Japão') })).toEqual([]);
    expect(codigos({ ...base, linhas: [linha('Renda', 'Famílias'), linha('1500 a 1999', '10'), linha('2000 a 2499', '20')] })).toEqual([]);
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
    // N-M7-03 e N-M7-11: "mais de w a z" é fechada; "w e mais" e "w ou mais anos" são abertas.
    expect(codigos(classes('Mais de 0 a 5', 'Mais de 10 a 15'))).toEqual([]);
    expect(codigos(classes('0 a menos de 5', '50 e mais bovinos por km²'))).toEqual(['TABELA_CLASSE_ABERTA']);
    expect(codigos(classes('0 a menos de 5', '15 ou mais anos'))).toEqual(['TABELA_CLASSE_ABERTA']);
  });
  it('RN-287: total diferente da soma sem nota geral; com nota passa', () => {
    const b = { ...base, linhas: [linha('Situação', 'Pessoas', 'Taxa (%)'), linha('Total', '100', '100,0'), linha('Urbana', '60', '33,3'), linha('Rural', '41', '66,6')] };
    expect(codigos(b)).toEqual(['TABELA_TOTAL_DIVERGENTE']);
    expect(codigos({ ...b, nota: t('A soma das parcelas difere do total por arredondamento.') })).toEqual([]);
  });
  it('N-M7-05: diferença maior que o arredondamento (subtotais, taxa, parcela parcial) não é acusada; "Subtotal" fica fora', () => {
    expect(codigos({ ...base, linhas: [linha('Via', 'Turistas'), linha('Total', '100'), linha('Via aérea', '70'), linha('SP', '40'), linha('RJ', '30'), linha('Via terrestre', '30')] })).toEqual([]);
    expect(codigos({ ...base, linhas: [linha('Região', 'Taxa (%)'), linha('Total', '3,2'), linha('Norte', '2,1'), linha('Sul', '4,0')] })).toEqual([]);
    expect(codigos({ ...base, linhas: [linha('Região', 'Pessoas'), linha('Total', '60'), linha('Subtotal Norte', '30'), linha('Norte A', '10'), linha('Norte B', '20'), linha('Sul', '31')] })).toEqual(['TABELA_TOTAL_DIVERGENTE']);
  });
  it('R-M7-01: número infinito, acima de 2^53 ou com casas demais não entra nas contas', () => {
    const nove = '9'.repeat(400);
    expect(codigos({ ...base, linhas: [linha('Situação', 'Pessoas'), linha('Total', nove), linha('A', nove), linha('B', '5')] })).not.toContain('TABELA_TOTAL_DIVERGENTE');
    expect(codigos({ ...base, linhas: [linha('Produto', 'Toneladas'), linha('Soja', '50'), linha('Outros', nove)] })).not.toContain('TABELA_OUTROS_MAIOR');
    const zeros = `0,${'0'.repeat(400)}`;
    expect(codigos({ ...base, linhas: [linha('Situação', 'Taxa'), linha('Total', zeros), linha('A', zeros), linha('B', zeros)] })).not.toContain('TABELA_TOTAL_DIVERGENTE');
    expect(codigos({ ...base, linhas: [linha('Situação', 'Taxa'), linha('Total', '0,30000000000000000'), linha('A', '0,10000000000000000'), linha('B', '0,20000000000000000')] })).not.toContain('TABELA_TOTAL_DIVERGENTE');
  });
  it('R-M7-03: texto do usuário cortado em 80 caracteres na mensagem e no trecho', () => {
    const longo = 'n/d '.repeat(100_000);
    const r = verificarTabelas(doc({ ...base, linhas: [base.linhas[0]!, linha('Total', '10', '5', '5'), linha('Urbana', '6', longo, '3'), linha('Rural', '4', '5', '2')] }));
    const p = r.find((x) => x.codigo === 'TABELA_CELULA_FORA_DOS_SINAIS')!;
    expect(p.trecho!.length).toBeLessThanOrEqual(80);
    expect(p.mensagem.length).toBeLessThan(300);
  });
  it('N-M7-07: linha separadora ou de grupo, com os dados todos vazios, não é célula sem sinal', () => {
    expect(codigos({ ...base, linhas: [base.linhas[0]!, linha('Total', '10', '5', '5'), linha('Situação urbana', '', '', ''), linha('Urbana', '6', '3', '3'), linha('Rural', '4', '2', '2')] })).toEqual([]);
  });
  it('N-M7-04: Anexo B, Tabela 7 do IBGE: sigla junto da forma por extenso, mês abreviado e moeda passam', () => {
    expect(codigos({ ...base, titulo: t('Preço médio de produto selecionado do Índice Nacional de Preços ao Consumidor - INPC - Brasil - JUN/DEZ 1989-JUN/DEZ 1990') })).toEqual([]);
    expect(codigos({ ...base, titulo: t('Exportações em US$ milhões - Brasil - 1990') })).toEqual([]);
    expect(codigos({ ...base, titulo: t('Índice Nacional de Preços ao Consumidor (INPC) - Brasil - 1990') })).toEqual([]);
  });
  it('RN-298: sinais tantos quanto os dados', () => {
    expect(codigos({ ...base, nota: t('Sinais convencionais utilizados: ... Dado numérico não disponível. X Dado omitido.'), linhas: [linha('Ano', 'Valor'), linha('2000', '...'), linha('2001', '5'), linha('2002', 'X')] })).toEqual(['TABELA_SINAIS_DEMAIS']);
  });
  it('RN-299: "Outros" maior que outra classificação', () => {
    const b = (outros: string) => ({ ...base, linhas: [linha('Produto', 'Toneladas'), linha('Soja', '50'), linha('Milho', '30'), linha('Outros', outros)] });
    expect(codigos(b('40'))).toEqual(['TABELA_OUTROS_MAIOR']);
    expect(codigos(b('10'))).toEqual([]);
  });
});

describe('E6-T04 (N-M5-06): sinal sem explicação e chamada × nota específica', () => {
  const base = IBGE_TABELA_1;
  const dados = [base.linhas[0]!, linha('Total', '10', '5', '5'), linha('Urbana', '6', '...', '3'), linha('Rural', '4', '–', '2')];
  it('RN-265: cada sinal usado aparece na nota geral; "–" e "-", "…" e "..." valem o mesmo', () => {
    expect(codigos({ ...base, linhas: dados })).toEqual(['TABELA_SINAL_SEM_NOTA']);
    expect(verificarTabelas(doc({ ...base, linhas: dados, nota: t('Sinal convencional utilizado: - Dado igual a zero.') }))[0]!.mensagem).toContain('“...”');
    expect(codigos({ ...base, linhas: dados, nota: t('Sinais convencionais utilizados: - Dado igual a zero. … Dado não disponível.') })).toEqual([]);
    // O hífen de uma palavra não explica o sinal.
    expect(codigos({ ...base, linhas: [base.linhas[0]!, linha('Total', '10', '5', '5'), linha('Urbana', '6', '-', '3')], nota: t('Dados da região Centro-Oeste.') })).toEqual(['TABELA_SINAL_SEM_NOTA']);
  });
  it('RN-276: chamada sem nota e nota sem chamada; chamada sobrescrita conta', () => {
    const comChamada = [linha('Situação (1)', 'Total', 'Mulheres', 'Homens'), ...base.linhas.slice(1)];
    expect(codigos({ ...base, linhas: comChamada })).toEqual(['TABELA_CHAMADA_SEM_NOTA']);
    expect(verificarTabelas(doc({ ...base, linhas: comChamada }))[0]!.mensagem).toContain('chamada (1) sem nota específica');
    expect(codigos({ ...base, linhas: comChamada, notasEspecificas: [t('Nota um.')] })).toEqual([]);
    expect(verificarTabelas(doc({ ...base, notasEspecificas: [t('Nota um.')] }))[0]!.mensagem).toContain('nota específica (1) sem chamada');
    const sobrescrita = [[{ conteudo: [{ tipo: 'texto' as const, texto: 'Situação' }, { tipo: 'texto' as const, texto: '1', marcas: ['sobrescrito' as const] }] }, ...base.linhas[0]!.slice(1)], ...base.linhas.slice(1)];
    expect(codigos({ ...base, linhas: sobrescrita, notasEspecificas: [t('Nota um.')] })).toEqual([]);
    // Ano entre parênteses não é chamada.
    expect(codigos({ ...base, linhas: [linha('Situação (2020)', 'Total', 'Mulheres', 'Homens'), ...base.linhas.slice(1)] })).toEqual([]);
  });
});

describe('N-M7-01: "Fontes:" na tabela com mais de um responsável (RN-270)', () => {
  it('tabela com ";" na fonte sai "Fontes:"; uma fonte, quadro e figura seguem "Fonte:"', () => {
    const prefixo = (b: BlocoTabela | typeof FIGURA_CORPUS) => rodapeDoElemento(b).find((x) => x.parte === 'fonte');
    expect(prefixo({ ...IBGE_TABELA_1, fonte: t('Ministério da Saúde; Fundação Instituto Brasileiro de Geografia e Estatística') })).toMatchObject({ prefixo: 'Fontes:' });
    expect(prefixo(IBGE_TABELA_1)).toMatchObject({ prefixo: 'Fonte:' });
    expect(prefixo({ ...QUADRO_CORPUS, fonte: t('Autor A; Autor B') })).toMatchObject({ prefixo: 'Fonte:' });
    expect(prefixo({ ...FIGURA_CORPUS, fonte: t('Autor A; Autor B') })).toMatchObject({ prefixo: 'Fonte:' });
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
