// M5-T05 (RF-09; D-M5-01) — dados de planilha na tabela. As fixtures em `fixtures/planilha/` foram escritas à mão no
// formato conhecido da área de transferência do Excel e do LibreOffice [HIPÓTESE de fidelidade: a captura real fica para
// a conferência manual]; o CSV tem acentos, vírgula decimal, células vazias e datas (aceite do RF-09).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aplicarPlanilha,
  converterPlanilha,
  detectarSeparador,
  lerCsv,
  lerTextoColado,
  lerTextoSeparado,
  opcoesSugeridas,
  rascunhoNovo,
  validarTabela,
  type PlanilhaConvertida,
  type PlanilhaLida,
} from '../src/aplicacao';
import { planilhaDoHtml } from '../src/interface/editor/planilha-colada';
import { lerHtmlMinimo } from './apoio/html-minimo';

const fixture = (nome: string) => readFileSync(join(__dirname, 'fixtures', 'planilha', nome));
const html = (nome: string) => planilhaDoHtml(lerHtmlMinimo(fixture(nome).toString('utf8')))!;
const textos = (c: PlanilhaConvertida) => c.grade.map((l) => l.map((x) => (x === null ? '·' : x.campo.texto)));
const converter = (p: PlanilhaLida, especie: 'tabela' | 'quadro' = 'tabela') => converterPlanilha(p, especie, opcoesSugeridas(p));
/** O que vai para o arquivo, depois de "Usar estes dados" e de pôr o título. */
const gravada = (c: PlanilhaConvertida) => {
  const v = validarTabela({ ...aplicarPlanilha(rascunhoNovo('tabela'), c), titulo: { texto: 'T' } });
  if (!v.ok) throw new Error(JSON.stringify(v.erros));
  return v.dados;
};
const decodificar = (b: Uint8Array): { texto: string; avisos: string[] } => {
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(b), avisos: [] };
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(b), avisos: ['Windows-1252'] };
  }
};
const csv = (nome: string) => {
  const d = decodificar(fixture(nome));
  return lerCsv(d.texto, d.avisos);
};

describe('texto separado (TSV do Excel, CSV)', () => {
  it('aspas com separador, quebra de linha e aspas dobradas dentro do campo; quebra final não vira linha', () => {
    expect(lerTextoSeparado('a\t"b\tc"\t"d\ne"\t"f ""g"""\r\n1\t2\r\n', '\t').map((l) => l.map((c) => c.texto))).toEqual([
      ['a', 'b\tc', 'd\ne', 'f "g"'],
      ['1', '2'],
    ]);
  });
  it('detecta o separador: ";" (Excel em pt-BR), "," e tabulação', () => {
    expect(detectarSeparador('a;b;c\n1,5;2;3')).toBe(';');
    expect(detectarSeparador('a,b,c\n1;2')).toBe(',');
    expect(detectarSeparador('a\tb\n1;2')).toBe('\t');
    expect(detectarSeparador('"x;y",b,c')).toBe(',');
  });
});

describe('aceite do RF-09: CSV com acentos, vírgula decimal, células vazias e datas, sem perda', () => {
  it('lê o CSV em UTF-8 com BOM e separador ";", com acentos e campo entre aspas', () => {
    const c = converter(csv('municipios.csv'));
    expect(textos(c)).toEqual([
      ['Município', 'População', 'Área', 'Atualização'],
      ['Araguaína', '183.381', '4.000,4', '15/03/2024'],
      ['Palmas', '313.349', '', '29/02/2024'],
      ['Porto Nacional; TO', '53.316', '4.449,9', ''],
    ]);
    expect(c.linhasCabecalho).toBe(1);
    expect(c.alinhamentos).toEqual(['esquerda', 'direita', 'direita', 'esquerda']);
    expect(c.relatorio).toContain('2 datas convertidas para dia/mês/ano.');
    expect(c.relatorio.join(' ')).toContain('Uma célula vazia nas colunas de números ficou como veio');
    // Nada se perde no caminho até o arquivo.
    const d = gravada(c);
    expect(d.linhas[2]![2]).toEqual({ conteudo: [] });
    expect(d.linhas[1]![0]).toEqual({ conteudo: [{ tipo: 'texto', texto: 'Araguaína' }] });
  });
  it('CSV do Excel em Windows-1252: acentos certos, com aviso para conferir', () => {
    const p = csv('windows-1252.csv');
    expect(p.avisos).toEqual(['Windows-1252']);
    expect(textos(converter(p))).toEqual([['Município', 'População'], ['Gurupi', '85.523']]);
  });
  it('vazios recebem o sinal escolhido só nas colunas de números', () => {
    const p = csv('municipios.csv');
    const c = converterPlanilha(p, 'tabela', { ...opcoesSugeridas(p), vazios: '...' });
    expect(textos(c)[2]).toEqual(['Palmas', '313.349', '...', '29/02/2024']);
    expect(textos(c)[3]![3]).toBe('');
    expect(c.relatorio.join(' ')).toContain('Uma célula vazia recebeu “...”: linha 3, coluna 3.');
  });
});

describe('números (P-C3) e datas', () => {
  const lida = (linhas: string[][]): PlanilhaLida => ({ linhas: linhas.map((l) => l.map((texto) => ({ texto }))), avisos: [] });

  it('números só em padrão inglês sugerem o ponto decimal e são convertidos', () => {
    const p = lida([['Item', 'Valor'], ['a', '1,234.5'], ['b', '12.5'], ['c', '1234.567'], ['d', '-0.25']]);
    expect(opcoesSugeridas(p).decimal).toBe('ponto');
    const c = converter(p);
    expect(textos(c).map((l) => l[1])).toEqual(['Valor', '1.234,5', '12,5', '1234,567', '-0,25']);
    expect(c.relatorio).toContain('4 números convertidos para o padrão brasileiro (ex.: 1,234.5 → 1.234,5).');
  });
  it('números brasileiros, ou ambíguos ("1.234"), ficam com a vírgula decimal e não mudam', () => {
    const p = lida([['Item', 'Valor'], ['a', '1.234'], ['b', '12,5']]);
    expect(opcoesSugeridas(p).decimal).toBe('virgula');
    expect(textos(converter(p)).map((l) => l[1])).toEqual(['Valor', '1.234', '12,5']);
    expect(opcoesSugeridas(lida([['a', '1.234']])).decimal).toBe('virgula');
  });
  it('data ISO vira dia/mês/ano; data inválida, com hora ou em outro formato fica como veio', () => {
    const c = converter(lida([['2024-02-29', '2023-02-29', '2024-03-15T10:30', '03/15/2024', '2024-03-15T00:00:00Z']]));
    expect(textos(c)[0]).toEqual(['29/02/2024', '2023-02-29', '2024-03-15T10:30', '03/15/2024', '15/03/2024']);
  });
  it('relata o que não é número nem sinal nas colunas de números, e o hífen que vira meia-risca', () => {
    const c = converter(lida([['Item', 'Valor', 'Outro'], ['a', '1,5', '2'], ['b', 'n/d', '-'], ['c', '3', '4']]));
    expect(c.relatorio).toContain('Uma célula com “-” será gravada com “–”, o sinal de dado igual a zero (RN-264).');
    expect(c.relatorio).toContain('Não convertido, nas colunas de números (não é número nem sinal convencional; o texto foi mantido): linha 3, coluna 2: “n/d”.');
    expect(converterPlanilha(lida([['a', 'n/d'], ['b', '1'], ['c', '2']]), 'quadro', { decimal: 'virgula', vazios: '', linhasCabecalho: 0 }).relatorio.join(' ')).not.toContain('Não convertido');
  });
});

describe('colagem do Excel e do LibreOffice (HTML)', () => {
  it('Excel: mesclagens, cabeçalho em duas linhas, linha oculta fora, valor como aparece na tela', () => {
    const p = html('excel.html');
    expect(p.avisos).toEqual(['Uma linha oculta na planilha ficou de fora.']);
    const c = converter(p);
    expect(textos(c)).toEqual([
      ['Região', 'Produção (t)', '·', '·'],
      ['·', '2020', '2021', '2022'],
      ['São Paulo', '1.234,5', '-', '12,3'],
      ['Goiânia', '', 'n/d', '2.100,0'],
    ]);
    // A 1.ª linha não tem número e a "Região" desce até a 2.ª: o cabeçalho cresce para não cortar a mesclagem.
    expect(c.linhasCabecalho).toBe(2);
    expect(c.alinhamentos).toEqual(['esquerda', 'direita', 'direita', 'direita']);
    const d = gravada(c);
    expect(d.linhas[0]).toEqual([
      { conteudo: [{ tipo: 'texto', texto: 'Região' }], linhas: 2 },
      { conteudo: [{ tipo: 'texto', texto: 'Produção (t)' }], colunas: 3 },
    ]);
    expect(d.linhas[2]![2]).toEqual({ conteudo: [{ tipo: 'texto', texto: '–' }] });
  });
  it('LibreOffice: acentos, sobrescrito como texto, célula só com <br> vazia', () => {
    const c = converter(html('libreoffice.html'));
    expect(textos(c)).toEqual([
      ['Município', 'Área (km²)', 'Data'],
      ['Araguaína', '4.000,416', '15/03/2024'],
      ['Palmas', '2.227,329', ''],
    ]);
    expect(c.linhasCabecalho).toBe(1);
  });
  it('th e thead marcam o cabeçalho; mais de uma tabela: só a primeira, com aviso; sem tabela: null', () => {
    const p = planilhaDoHtml(lerHtmlMinimo('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>x</td><td>1</td></tr></tbody></table><table><tr><td>z</td></tr></table>'))!;
    expect(p.linhasCabecalho).toBe(1);
    expect(p.avisos).toEqual(['Havia mais de uma tabela no que foi colado: só a primeira foi lida.']);
    expect(planilhaDoHtml(lerHtmlMinimo('<p>só texto</p>'))).toBeNull();
  });
  it('<br> e parágrafos na célula viram quebra de linha; espaços do HTML colapsam', () => {
    const p = planilhaDoHtml(lerHtmlMinimo('<table><tr><td>  linha   um<br>linha dois </td><td><p>a</p><p>b</p></td></tr></table>'))!;
    expect(p.linhas[0]!.map((c) => c.texto)).toEqual(['linha um\nlinha dois', 'a\nb']);
  });
});

describe('grade irregular e limites', () => {
  const lida = (linhas: { texto: string; colunas?: number; linhas?: number }[][]): PlanilhaLida => ({ linhas, avisos: [] });

  it('linha curta é completada; linhas e colunas vazias do fim saem', () => {
    const c = converter(lida([[{ texto: 'a' }, { texto: 'b' }, { texto: '' }], [{ texto: 'c' }], [{ texto: '' }, { texto: '' }]]));
    expect(textos(c)).toEqual([['a', 'b'], ['c', '']]);
    expect(c.relatorio).toContain('Uma linha tinha menos células: completadas com células vazias.');
  });
  it('mesclagem que sobrepõe outra ou sai da grade é reduzida, e a grade gravada é válida', () => {
    // "z" desce 5 linhas numa planilha de 2; "c" pede 2 colunas, mas a 2.ª está coberta por "y", que desce de cima.
    const c = converter(lida([[{ texto: 'x' }, { texto: 'y', linhas: 2 }, { texto: 'z', linhas: 5 }], [{ texto: 'c', colunas: 2 }]]));
    expect(c.relatorio).toContain('2 mesclagens foram reduzidas para caber na grade.');
    expect(textos(c)).toEqual([['x', 'y', 'z'], ['c', '·', '·']]);
    gravada(c);
  });
  it('colunas além da 63.ª ficam de fora, com aviso', () => {
    const c = converter(lida([Array.from({ length: 65 }, (_, i) => ({ texto: `c${i}` }))]));
    expect(c.grade[0]).toHaveLength(63);
    expect(c.relatorio).toContain('Ficaram de fora 2 células além da 63.ª coluna (o máximo do Word).');
  });
  it('planilha sem texto: nada a usar', () => {
    expect(converter(lida([[{ texto: '' }]])).vazia).toBe(true);
  });
  it('usar os dados troca grade, alinhamentos e cabeçalho, e mantém título e fonte', () => {
    const r = { ...rascunhoNovo('tabela'), titulo: { texto: 'Título' }, fonte: { texto: 'Fonte' } };
    const novo = aplicarPlanilha(r, converter(csv('municipios.csv')));
    expect(novo.titulo.texto).toBe('Título');
    expect(novo.fonte.texto).toBe('Fonte');
    expect(novo.grade).toHaveLength(4);
  });
});

describe('custo da tabela colada (R-M5-02, revisão do M5)', () => {
  it('200 mil <br> numa célula: linear (menos de 1 s), e as quebras viram uma só', () => {
    const inicio = performance.now();
    const p = planilhaDoHtml(lerHtmlMinimo(`<table><tr><td>x${'<br>'.repeat(200_000)}y</td><td>${'<br>'.repeat(1000)}z${'<br>'.repeat(1000)}</td></tr></table>`))!;
    expect(performance.now() - inicio).toBeLessThan(1000);
    expect(p.linhas[0]!.map((c) => c.texto)).toEqual(['x\ny', 'z']);
  });
});

describe('memória da leitura de CSV e de texto colado (R-M5-03, revisão do M5)', () => {
  it('4 MB só de quebras: nada é guardado além do limite, e rápido', () => {
    const inicio = performance.now();
    const p = lerCsv('\n'.repeat(4 * 1024 * 1024));
    expect(p.linhas.length).toBeLessThanOrEqual(5001);
    expect(p.linhasNaoLidas).toBe(0); // linhas vazias não contam no relatório
    expect(performance.now() - inicio).toBeLessThan(2000);
  });

  it('6.000 linhas com texto: guarda 5.001 e o relatório conta as 1.000 de fora', () => {
    const texto = Array.from({ length: 6000 }, (_, i) => `Linha ${i};${i}`).join('\n');
    const p = lerCsv(texto);
    expect(p.linhas).toHaveLength(5001);
    expect(p.linhasNaoLidas).toBe(999);
    expect(converter(p).relatorio).toContain('Ficaram de fora 1000 linhas, além do tamanho máximo da tabela.');
  });

  it('texto colado com 100 colunas: guarda 64 campos por linha e conta os de fora', () => {
    const linha = Array.from({ length: 100 }, (_, i) => `c${i}`).join('\t');
    const p = lerTextoColado(`${linha}\n${linha}`, '\t');
    expect(p.linhas.every((l) => l.length === 64)).toBe(true);
    expect(p.camposNaoLidos).toBe(72);
    expect(converter(p).relatorio.join(' ')).toContain('Ficaram de fora 74 células além da 63.ª coluna');
  });
});
