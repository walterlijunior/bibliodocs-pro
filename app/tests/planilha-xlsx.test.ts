// Etapa 4 da especificação de atualização — "Importar planilha" por aba: leitura do .xlsx (valores como aparecem na
// tela, fórmulas pelo resultado gravado, mesclagens, quebras de linha, acentos, zero × vazio × "N/A"), intervalos
// sugeridos (vários elementos na mesma aba), colunas vazias, origem guardada na tabela e a renumeração quando uma
// tabela importada entra antes de outra já citada (legenda, menção no texto e DOCX).
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import {
  aplicarPlanilha,
  converterPlanilha,
  criarTrabalhoVazio,
  lerIntervalo,
  lerPastaXlsx,
  opcoesSugeridas,
  planilhaDoIntervalo,
  rascunhoDe,
  rascunhoNovo,
  SessaoTrabalho,
  sugerirIntervalos,
  textoIntervalo,
  validarTabela,
  type AbaXlsx,
  type PacoteTransferivel,
} from '../src/aplicacao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Bloco, BlocoTabela, Documento, Inline, Secao } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { exportarDocx } from '../src/exportacao/docx';
import { formatarNumero, formatoGeral, lerEndereco, letrasColuna } from '../src/importacao/xlsx';
import { largurasColunas } from '../src/exportacao/docx/exportador';
import { excluirColuna, inserirColuna } from '../src/aplicacao';
import { abrirDocx } from './apoio/docx-normalizado';
import { linha, n, s, xlsxSintetico } from './apoio/xlsx-sintetico';

describe('formato de número do Excel, no padrão brasileiro', () => {
  it('casas, milhar, porcentagem, moeda, contábil, científica, data e "Geral"', () => {
    expect(formatarNumero(12.5, '0.00')).toBe('12,50');
    expect(formatarNumero(1234567, '#,##0')).toBe('1.234.567');
    expect(formatarNumero(1234.5, '#,##0.00')).toBe('1.234,50');
    expect(formatarNumero(0.256, '0%')).toBe('26%');
    expect(formatarNumero(0.2567, '0.0%')).toBe('25,7%');
    expect(formatarNumero(1234.5, '"R$" #,##0.00')).toBe('R$ 1.234,50');
    expect(formatarNumero(1234.5, '[$R$-416] #,##0.00')).toBe('R$ 1.234,50');
    const contabil = '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"??_-;_-@_-';
    expect(formatarNumero(0, contabil)).toBe('-');
    expect(formatarNumero(-5, contabil)).toBe('-5,00');
    expect(formatarNumero(1500, contabil)).toBe('1.500,00');
    expect(formatarNumero(-3, '#,##0.00;(#,##0.00)')).toBe('(3,00)');
    expect(formatarNumero(0.5, '#.00')).toBe(',50');
    expect(formatarNumero(12345, '0.00E+00')).toBe('1,23E+04');
    expect(formatarNumero(45000, 'dd/mm/yyyy')).toBe('15/03/2023');
    expect(formatarNumero(45000, 'mmm-yy')).toBe('mar/23');
    expect(formatarNumero(2022, 'General')).toBe('2022');
    expect(formatoGeral(0.1 + 0.2)).toBe('0,3');
    expect(formatoGeral(-1.25)).toBe('-1,25');
    expect(formatarNumero(0, 'General')).toBe('0');
  });

  it('endereços e intervalos', () => {
    expect(lerEndereco('C24')).toEqual({ l: 23, c: 2 });
    expect(lerEndereco('$AB$3')).toEqual({ l: 2, c: 27 });
    expect(letrasColuna(27)).toBe('AB');
    expect(lerIntervalo('C39:A1')).toEqual({ l1: 0, c1: 0, l2: 38, c2: 2 });
    expect(lerIntervalo('B5')).toEqual({ l1: 4, c1: 1, l2: 4, c2: 1 });
    expect(lerIntervalo('A1:')).toBeNull();
    expect(lerIntervalo('1A')).toBeNull();
    expect(textoIntervalo({ l1: 0, c1: 0, l2: 38, c2: 2 })).toBe('A1:C39');
  });
});

// Textos compartilhados: 0..n.
const TEXTOS = [
  'Critério', // 0
  'Descrição', // 1
  'Pontuação', // 2
  'Existência de disclosure', // 3
  'Linha um\nlinha dois', // 4
  'N/A', // 5
  'TOTAL DA PONTUAÇÃO', // 6
  '<r><t>Texto </t></r><r><rPr><b/></rPr><t>rico</t></r>', // 7
  'Ação_x000D_\nsaúde', // 8
  '2023', // 9
  'Empresa', // 10
  'Eletrobras', // 11
  'Neoenergia', // 12
];

function pasta() {
  return xlsxSintetico(
    [
      {
        // Três quadros na aba, como em "Quadro 6": o 2.º repete o cabeçalho depois de uma linha vazia; o 3.º vem depois de duas.
        nome: 'Quadro 6',
        linhas: [
          linha(1, s('A1', 0, 2), s('B1', 1, 2), s('C1', 2, 2)),
          linha(2, s('A2', 3, 5), s('B2', 4, 5), n('C2', 1, 5)),
          linha(3, s('A3', 7, 5), s('B3', 5, 5), n('C3', 0, 5)),
          linha(5, s('A5', 0, 2), s('B5', 1, 2), s('C5', 2, 2)),
          linha(6, s('A6', 3, 5), s('B6', 8, 5), n('C6', 1, 5)),
          linha(7, s('A7', 6, 5), `<c r="C7" s="5"><f>SUM(C6:C6)</f><v>8</v></c>`),
          linha(10, s('A10', 0, 2), s('C10', 2, 2)),
          linha(11, s('A11', 3, 5), `<c r="C11" s="5"><f>SUM(C1:C2)</f></c>`),
        ].join(''),
        mesclagens: ['A7:B7'],
      },
      {
        // Como "2022" de Pasta1: linhas-título "2022"/"2023" separam as tabelas; a linha vazia no meio é espaçamento.
        nome: '2022',
        linhas: [
          linha(1, n('A1', 2022)),
          linha(2, s('A2', 10), s('B2', 1)),
          linha(3, s('A3', 11), n('B3', 1500.25, 3)),
          linha(4, n('B4', 0, 3)),
          linha(6, s('A6', 12), n('B6', 45000, 4)),
          linha(8, s('A8', 9)),
          linha(9, s('A9', 10), s('B9', 1)),
          linha(10, s('A10', 11), n('B10', 12.5, 1)),
        ].join(''),
        mesclagens: ['A3:A4'],
      },
      {
        // Como "2024": colunas C e E sem nenhum valor no meio do intervalo.
        nome: '2024',
        colunas: '<col min="1" max="1" width="30" customWidth="1"/><col min="4" max="4" width="15" customWidth="1"/>',
        linhas: [linha(1, s('A1', 10), s('B1', 1), s('D1', 2), s('F1', 0)), linha(2, s('A2', 11), n('B2', 1), n('D2', 2), s('F2', 5)), linha(3, `<c r="C3" s="2"/>`, `<c r="E3" s="2"/>`)].join(''),
      },
      { nome: 'SIGLAS', oculta: true, linhas: linha(1, s('A1', 10)) },
    ],
    TEXTOS,
  );
}

function abas(): AbaXlsx[] {
  const r = lerPastaXlsx(pasta());
  if (!r.ok) throw new Error(r.mensagem);
  return r.pasta.abas;
}

describe('leitura do .xlsx', () => {
  it('lista as abas pelo nome, na ordem do arquivo, e marca a oculta', () => {
    expect(abas().map((a) => [a.nome, a.oculta])).toEqual([
      ['Quadro 6', false],
      ['2022', false],
      ['2024', false],
      ['SIGLAS', true],
    ]);
  });

  it('valores como aparecem na tela: fórmula pelo resultado, quebra de linha, acento, texto rico, zero, "N/A", formato', () => {
    const [q6, a22] = abas();
    const cel = (a: AbaXlsx, ref: string) => {
      const p = lerEndereco(ref)!;
      return a.celulas.find((x) => x.l === p.l && x.c === p.c);
    };
    expect(cel(q6!, 'C7')).toMatchObject({ texto: '8', formula: true, tipo: 'numero' });
    expect(cel(q6!, 'C11')).toMatchObject({ texto: '', formula: true, semResultado: true });
    expect(cel(q6!, 'B2')?.texto).toBe('Linha um\nlinha dois');
    expect(cel(q6!, 'B6')?.texto).toBe('Ação\nsaúde');
    expect(cel(q6!, 'A3')?.texto).toBe('Texto rico');
    expect(cel(q6!, 'B3')?.texto).toBe('N/A');
    expect(cel(q6!, 'C3')?.texto).toBe('0');
    expect(cel(q6!, 'A1')).toMatchObject({ negrito: true, bordas: { cima: true, baixo: true, esquerda: true, direita: true } });
    expect(cel(q6!, 'A2')).toMatchObject({ alinhamento: 'esquerda', quebraAutomatica: true });
    expect(cel(a22!, 'B3')?.texto).toBe('1.500,25');
    expect(cel(a22!, 'B4')?.texto).toBe('-');
    expect(cel(a22!, 'B6')?.texto).toBe('15/03/2023');
    expect(cel(a22!, 'B10')).toMatchObject({ texto: '12,50', alinhamento: 'centro' });
    expect(q6!.mesclagens.map(textoIntervalo)).toEqual(['A7:B7']);
  });

  it('arquivo que não é .xlsx: mensagem clara, sem exceção', () => {
    const r = lerPastaXlsx(new Uint8Array([1, 2, 3]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/xlsx/);
  });
});

describe('intervalos sugeridos', () => {
  it('vários quadros na aba: separa pelo cabeçalho repetido e por duas linhas vazias', () => {
    const [q6] = abas();
    expect(sugerirIntervalos(q6!).map((x) => textoIntervalo(x.intervalo))).toEqual(['A1:C3', 'A5:C7', 'A10:C11']);
  });

  it('linhas-título separam as tabelas; a linha vazia de espaçamento fica dentro', () => {
    const [, a22] = abas();
    const sug = sugerirIntervalos(a22!);
    expect(sug.map((x) => textoIntervalo(x.intervalo))).toEqual(['A2:B6', 'A9:B10']);
    expect(sug[0]!.rotulo).toContain('“2022”');
  });

  it('uma tabela só: a área preenchida', () => {
    const [, , a24] = abas();
    expect(sugerirIntervalos(a24!).map((x) => [x.rotulo, textoIntervalo(x.intervalo)])).toEqual([['Área preenchida', 'A1:F2']]);
  });
});

describe('intervalo → prévia', () => {
  it('colunas sem valor saem (por padrão), com aviso; zero, vazio e "N/A" ficam distintos', () => {
    const [, , a24] = abas();
    const r = planilhaDoIntervalo(a24!, lerIntervalo('A1:F3')!);
    expect(r.colunasRetiradas).toEqual(['C', 'E']);
    expect(r.lida.linhas.map((l) => l.map((c) => c.texto))).toEqual([
      ['Empresa', 'Descrição', 'Pontuação', 'Critério'],
      ['Eletrobras', '1', '2', 'N/A'],
      ['', '', '', ''],
    ]);
    expect(r.lida.avisos.join(' ')).toContain('As colunas C, E');
    const mantidas = planilhaDoIntervalo(a24!, lerIntervalo('A1:F2')!, { retirarColunasVazias: false, retirarLinhasVazias: false });
    expect(mantidas.lida.linhas[0]!.length).toBe(6);
  });

  it('mesclagem vertical e horizontal no modelo do HTML; fórmula pelo resultado, com aviso; sem resultado, aviso', () => {
    const [q6, a22] = abas();
    const a = planilhaDoIntervalo(q6!, lerIntervalo('A5:C7')!);
    expect(a.lida.linhas.at(-1)).toEqual([{ texto: 'TOTAL DA PONTUAÇÃO', colunas: 2, alinhamento: 'esquerda' }, { texto: '8', alinhamento: 'esquerda' }]);
    expect(a.lida.avisos.join(' ')).toMatch(/resultado gravado/);
    const b = planilhaDoIntervalo(q6!, lerIntervalo('A10:C11')!);
    expect(b.lida.avisos.join(' ')).toMatch(/Sem resultado gravado no arquivo .*C11/);
    const c = planilhaDoIntervalo(a22!, lerIntervalo('A2:B6')!);
    expect(c.lida.linhas.map((l) => l.map((x) => [x.texto, x.linhas ?? 1]))).toEqual([
      [['Empresa', 1], ['Descrição', 1]],
      [['Eletrobras', 2], ['1.500,25', 1]],
      [['-', 1]],
      [['', 1], ['', 1]],
      [['Neoenergia', 1], ['15/03/2023', 1]],
    ]);
    // Linhas vazias saem só a pedido.
    expect(planilhaDoIntervalo(a22!, lerIntervalo('A2:B6')!, { retirarColunasVazias: true, retirarLinhasVazias: true }).linhasRetiradas).toEqual([5]);
  });

  it('mesclagem cortada pelo intervalo é reduzida a ele, com aviso', () => {
    const [q6] = abas();
    const r = planilhaDoIntervalo(q6!, lerIntervalo('B7:C7')!);
    expect(r.lida.linhas).toEqual([[{ texto: 'TOTAL DA PONTUAÇÃO', alinhamento: 'esquerda' }, { texto: '8', alinhamento: 'esquerda' }]]);
    expect(r.lida.avisos.join(' ')).toMatch(/passa do intervalo/);
  });

  it('a conversão da prévia conserva textos, quebras e mesclagens; as bordas e o negrito entram no relatório', () => {
    const [q6] = abas();
    const lida = planilhaDoIntervalo(q6!, lerIntervalo('A1:C3')!).lida;
    const conv = converterPlanilha(lida, 'quadro', opcoesSugeridas(lida));
    expect(conv.linhasCabecalho).toBe(1);
    expect(conv.grade.map((l) => l.map((x) => x?.campo.texto ?? null))).toEqual([
      ['Critério', 'Descrição', 'Pontuação'],
      ['Existência de disclosure', 'Linha um\nlinha dois', '1'],
      ['Texto rico', 'N/A', '0'],
    ]);
    expect(conv.relatorio.join(' ')).toMatch(/bordas da origem/);
    expect(conv.relatorio.join(' ')).toMatch(/negrito/);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Origem na tabela e renumeração
// ---------------------------------------------------------------------------------------------------------

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const par = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
const sec = (id: string, blocos: Bloco[]): Secao => ({ id, titulo: [t('Seção')], blocos, subsecoes: [] });

function importada(id: string, aba: AbaXlsx, intervalo: string, titulo: string, fonte: string): BlocoTabela {
  const lida = planilhaDoIntervalo(aba, lerIntervalo(intervalo)!).lida;
  const conv = converterPlanilha(lida, 'tabela', opcoesSugeridas(lida));
  const r = { ...aplicarPlanilha(rascunhoNovo('tabela'), conv), titulo: { texto: titulo }, fonte: { texto: fonte }, origem: { arquivo: 'Pasta1.xlsx', aba: aba.nome, intervalo } };
  const v = validarTabela(r);
  if (!v.ok) throw new Error(JSON.stringify(v.erros));
  return { ...v.dados, id };
}

function abrir(documento: Partial<Documento>) {
  const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-15T10:00:00.000Z', appVersao: '0.1.0' });
  const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, ...documento }, midias: [] };
  const sessao = new SessaoTrabalho({ api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} }, agora: () => new Date(0), agendar: () => () => {} });
  sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
  return sessao;
}

describe('origem e renumeração da tabela importada', () => {
  it('a origem (arquivo, aba, intervalo) é gravada, volta pela janela e sai quando a grade é trocada por outra colagem', () => {
    const [, a22] = abas();
    const tab = importada('tab_xl00000000001', a22!, 'A2:B6', 'Documentos', 'Elaboração própria.');
    expect(tab.origem).toEqual({ arquivo: 'Pasta1.xlsx', aba: '2022', intervalo: 'A2:B6' });
    const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-15T10:00:00.000Z', appVersao: '0.1.0' }).documento;
    expect(validarDocumentoV1({ ...base, corpo: [sec('sec_xl00000000001', [tab])] }).ok).toBe(true);
    expect(validarDocumentoV1({ ...base, corpo: [sec('sec_xl00000000001', [{ ...tab, origem: { ...tab.origem!, intervalo: 'A1:' } }])] }).ok).toBe(false);
    const r = rascunhoDe(tab);
    expect(r.origem).toEqual(tab.origem);
    const outra = aplicarPlanilha(r, converterPlanilha({ linhas: [[{ texto: 'x' }]], avisos: [] }, 'tabela', { decimal: 'virgula', vazios: '', linhasCabecalho: 0 }));
    expect(outra.origem).toBeUndefined();
  });

  it('nova tabela importada antes de outra já citada: a original passa a Tabela 2 na legenda, na menção, na lista e no DOCX', async () => {
    const [q6, a22] = abas();
    const original = importada('tab_xl00000000001', a22!, 'A2:B6', 'Documentos por empresa', 'Fonte da original.');
    const texto = par('par_xl00000000001', t('Conforme a '), { tipo: 'remissiva', id: 'rem_xl00000000001', alvo: original.id }, t(', os dados...'));
    const s = abrir({ corpo: [sec('sec_xl00000000001', [texto, original])] });
    const rotulos = () => s.obterEstado().trabalho!.elementos.filter((e) => e.tipo === 'tabela').map((e) => [e.id, e.rotulo, e.remissivas]);
    expect(rotulos()).toEqual([[original.id, 'Tabela 1', 1]]);

    const nova = importada('tab_xl00000000002', q6!, 'A5:C7', 'Critérios', 'Fonte da nova.');
    s.alterarSecao('sec_xl00000000001', { titulo: [t('Seção')], blocos: [nova, texto, original] });
    expect(rotulos()).toEqual([
      [nova.id, 'Tabela 1', 0],
      [original.id, 'Tabela 2', 1],
    ]);
    const doc = s.pacote!.documento;
    const f = formatar(doc, PERFIL);
    const corpo = f.secoes.flatMap((x) => x.blocos);
    const corrido = corpo
      .filter((b) => b.tipo === 'paragrafo' && b.estilo === 'corpo')
      .map((b) => (b.tipo === 'paragrafo' ? b.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('') : ''));
    expect(corrido).toEqual(['Conforme a Tabela 2, os dados...']);
    // Origem e fonte continuam com a tabela original.
    const salva = doc.corpo[0]!.blocos.find((b) => b.id === original.id) as BlocoTabela;
    expect(salva.origem?.intervalo).toBe('A2:B6');
    expect(salva.fonte).toEqual([t('Fonte da original.')]);

    const xml = abrirDocx(await exportarDocx(f))['word/document.xml']!;
    const pos = (x: string) => xml.indexOf(x);
    expect(xml).toContain('Tabela 1 – ');
    expect(xml).toContain('Tabela 2 – ');
    expect(pos('Critérios')).toBeLessThan(pos('Fonte da nova.'));
    expect(pos('Fonte da nova.')).toBeLessThan(pos('Documentos por empresa'));
    expect(pos('Documentos por empresa')).toBeLessThan(pos('Fonte da original.'));
    expect(xml).toMatch(/Conforme a <\/w:t>[\s\S]*?Tabela 2/);
    // Os valores importados chegam ao DOCX como na planilha.
    for (const v of ['1.500,25', '15/03/2023', 'TOTAL DA PONTUAÇÃO', 'Ação']) expect(xml).toContain(v);
  });
});

describe('larguras das colunas da planilha', () => {
  it('vêm do <col width> (ou da padrão), acompanham as colunas retiradas e vão até a tabela', () => {
    const [, , a24] = abas();
    const p = planilhaDoIntervalo(a24!, lerIntervalo('A1:F2')!);
    // A (30), B (padrão 8,43), D (15), F (padrão): C e E saíram.
    expect(p.lida.larguras).toEqual([300, 84, 150, 84]);
    const conv = converterPlanilha(p.lida, 'quadro', opcoesSugeridas(p.lida));
    expect(conv.larguras).toEqual([300, 84, 150, 84]);
    const r = { ...aplicarPlanilha(rascunhoNovo('quadro'), conv), titulo: { texto: 'T' } };
    const v = validarTabela(r);
    expect(v.ok && v.dados.colunas.map((c) => c.largura)).toEqual([300, 84, 150, 84]);
    // Inserir e excluir coluna mantêm os pesos alinhados; outra colagem sem larguras as tira.
    const mais = inserirColuna(r, 1);
    expect(mais.ok && mais.rascunho.larguras).toEqual([300, 300, 84, 150, 84]);
    const menos = excluirColuna(r, 0);
    expect(menos.ok && menos.rascunho.larguras).toEqual([84, 150, 84]);
    expect(aplicarPlanilha(r, converterPlanilha({ linhas: [[{ texto: 'x' }]], avisos: [] }, 'quadro', { decimal: 'virgula', vazios: '', linhasCabecalho: 0 })).larguras).toBeUndefined();
  });

  it('no DOCX, as colunas seguem a proporção, com mínimo por coluna, e somam a largura do texto', async () => {
    expect(largurasColunas({ larguraTw: 9000, colunas: 3 })).toEqual([3000, 3000, 3000]);
    expect(largurasColunas({ larguraTw: 9000, colunas: 3, pesosColunas: [200, 100, 100] })).toEqual([4500, 2250, 2250]);
    const w = largurasColunas({ larguraTw: 9000, colunas: 2, pesosColunas: [1000, 1] });
    expect(w[1]).toBeGreaterThanOrEqual(400);
    expect(w[0]! + w[1]!).toBe(9000);
    const [, , a24] = abas();
    const tab = importada('tab_xl00000000009', a24!, 'A1:F2', 'Larguras', 'F.');
    const doc = { ...criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-15T10:00:00.000Z', appVersao: '0.1.0' }).documento, corpo: [sec('sec_xl00000000001', [tab])] };
    expect(validarDocumentoV1(doc).ok).toBe(true);
    const xml = abrirDocx(await exportarDocx(formatar(doc, PERFIL)))['word/document.xml']!;
    const grid = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
    expect(grid[0]! / grid[1]!).toBeCloseTo(300 / 84, 1);
    expect(grid[2]! / grid[3]!).toBeCloseTo(150 / 84, 1);
  });
});
