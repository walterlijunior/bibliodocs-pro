// M5-T03: tabela e quadro no motor e no DOCX. Cada propriedade com a RN de origem (RF-05); o XML é conferido sem Word
// (tblBorders, tcBorders, tblHeader, gridSpan, vMerge, jc, sz). Abertura no Word e no LibreOffice: `npm run test:externos`.
import { strFromU8, unzipSync } from 'fflate';
import { XMLValidator } from 'fast-xml-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import type { BlocoTabela, Documento, Secao } from '../src/dominio/modelo';
import { formatar, type Perfil } from '../src/dominio/normas';
import type { BlocoFormatado, BlocoTabelaFormatado, DocumentoFormatado } from '../src/dominio/normas/formatado';
import { exportarDocx } from '../src/exportacao/docx';
import { QUADRO_CORPUS, TABELA_CORPUS, TABELA_LONGA_CORPUS } from './corpus/corpus';

const sec = (id: string, blocos: Secao['blocos']): Secao => ({ id, titulo: [{ tipo: 'texto', texto: 'Seção' }], blocos, subsecoes: [] });
const doc = (...blocos: Secao['blocos']): Pick<Documento, 'corpo'> => ({ corpo: [sec('s1', blocos)] });
const blocos = (f: DocumentoFormatado): BlocoFormatado[] => f.secoes.flatMap((s) => s.blocos);
const paragrafos = (f: DocumentoFormatado) => blocos(f).filter((b): b is Extract<BlocoFormatado, { tipo: 'paragrafo' }> => b.tipo === 'paragrafo');
const tabelas = (f: DocumentoFormatado) => blocos(f).filter((b): b is BlocoTabelaFormatado => b.tipo === 'tabela');
const textoDe = (b: Extract<BlocoFormatado, { tipo: 'paragrafo' }>) => b.trechos.map((t) => (t.tipo === 'texto' ? t.texto : '')).join('');
const estilo = (f: DocumentoFormatado, id: string) => f.estilos.find((e) => e.id === id)!;
const semRegras = (...ids: string[]): Perfil => ({ ...PERFIL, regras: PERFIL.regras.filter((r) => !ids.includes(r.id)) });

const SEM_RODAPE: BlocoTabela = { ...QUADRO_CORPUS, id: 'tab_semrodape01', fonte: undefined } as BlocoTabela;

describe('motor: estilos de título, rodapé e célula, todos do perfil', () => {
  const f = formatar(doc(), PERFIL);

  it('título: 12, centralizado, simples, preso à tabela, uma linha antes (RN-021, RN-015, RN-066, RN-032, RN-050, RN-063, RN-031, RN-308)', () => {
    const e = estilo(f, 'tituloElemento');
    expect(e.propriedades).toMatchObject({ corpoMeioPt: 24, alinhamento: 'centralizado', linha: 240, manterComProximo: true, antesTw: 240 });
    expect(e.propriedades.negrito).toBeUndefined();
    expect(e.origem.corpoMeioPt).toEqual(['RN-021']);
    expect(e.origem.alinhamento).toEqual(['RN-015', 'RN-066']);
    expect(e.origem.linha).toEqual(['RN-032']);
    expect(e.origem.manterComProximo).toEqual(['RN-050', 'RN-063']);
    expect(e.origem.antesTw).toEqual(['RN-031', 'RN-308']);
  });

  it('fonte e notas: 10, à esquerda, simples (RN-022, RN-057, RN-307, RN-032)', () => {
    const e = estilo(f, 'rodapeElemento');
    expect(e.propriedades).toMatchObject({ corpoMeioPt: 20, alinhamento: 'esquerda', linha: 240 });
    expect(e.origem.corpoMeioPt).toEqual(['RN-022']);
    expect(e.origem.alinhamento).toEqual(['RN-057', 'RN-307']);
  });

  it('célula: 10, simples (RN-311, P-C2), sem recuo nem alinhamento no estilo', () => {
    const e = estilo(f, 'celulaTabela');
    expect(e.propriedades).toMatchObject({ corpoMeioPt: 20, linha: 240 });
    expect(e.origem.corpoMeioPt).toEqual(['RN-311']);
    expect(e.propriedades.alinhamento).toBeUndefined();
    expect(e.propriedades.recuoPrimeiraLinhaTw).toBeUndefined();
  });

  it('o corpo das células vem do parâmetro do perfil', () => {
    const p = structuredClone(PERFIL) as unknown as { parametros: Record<string, { valor: unknown }> };
    p.parametros['corpoTabelaPt']!.valor = 9;
    expect(estilo(formatar(doc(), p as unknown as Perfil), 'celulaTabela').propriedades.corpoMeioPt).toBe(18);
  });
});

describe('motor: tabela e quadro', () => {
  const f = formatar(doc(TABELA_CORPUS, QUADRO_CORPUS, TABELA_LONGA_CORPUS, SEM_RODAPE), PERFIL);

  it('não há mais ELEMENTO_ADIADO para tabela e quadro', () => {
    expect(f.avisos.filter((a) => a.codigo === 'ELEMENTO_ADIADO')).toEqual([]);
  });

  it('título acima da tabela, "Tabela n – Título", numeração por espécie (RN-051, RN-052, RN-053)', () => {
    const titulos = paragrafos(f).filter((p) => p.estilo === 'tituloElemento');
    expect(titulos.map(textoDe)).toEqual([
      'Tabela 1 – Produção fictícia por região, 2020–2022',
      'Quadro 1 – Etapas fictícias do procedimento',
      'Tabela 2 – Medições fictícias por amostra',
      'Quadro 2 – Etapas fictícias do procedimento',
    ]);
    expect(titulos[0]!.origem).toEqual(['RN-052', 'RN-053']);
    const seq = blocos(f).map((b) => (b.tipo === 'paragrafo' ? b.estilo : b.tipo));
    expect(seq.slice(1, 7)).toEqual(['tituloElemento', 'tabela', 'rodapeElemento', 'rodapeElemento', 'rodapeElemento', 'rodapeElemento']);
  });

  it('o separador vem do perfil', () => {
    const p = structuredClone(PERFIL) as unknown as { parametros: Record<string, { valor: unknown }> };
    p.parametros['separadorTitulo']!.valor = ' - ';
    expect(textoDe(paragrafos(formatar(doc(TABELA_CORPUS), p as unknown as Perfil)).find((x) => x.estilo === 'tituloElemento')!)).toBe('Tabela 1 - Produção fictícia por região, 2020–2022');
  });

  it('tabela aberta: três traços, sem laterais nem traços internos (RN-251 a RN-254)', () => {
    const t = tabelas(f)[0]!;
    expect(t.tracos).toEqual({ superior: true, inferior: true, esquerda: false, direita: false, entreLinhas: false, entreColunas: false, abaixoDoCabecalho: true });
    expect(t.origem).toEqual(['RN-251', 'RN-252', 'RN-253', 'RN-254', 'RN-292']);
  });

  it('quadro fechado (RN-061)', () => {
    const q = tabelas(f)[1]!;
    expect(q.tracos).toEqual({ superior: true, inferior: true, esquerda: true, direita: true, entreLinhas: true, entreColunas: true, abaixoDoCabecalho: false });
    expect(q.origem).toEqual(['RN-061', 'RN-292']);
  });

  it('cabeçalho repetido, largura da área útil, alinhamento da coluna e mesclagem', () => {
    const t = tabelas(f)[0]!;
    expect(t).toMatchObject({ repetirCabecalho: true, linhasCabecalho: 2, colunas: 4, larguraTw: 11906 - 1701 - 1134, estilo: 'celulaTabela' });
    // Cabeçalho centralizado (D-M5-53; IBGE, Anexo B); o corpo segue a coluna.
    expect(t.linhas[0]!.map((c) => [c.colunas, c.linhas, c.alinhamento])).toEqual([
      [1, 2, 'centralizado'],
      [3, 1, 'centralizado'],
    ]);
    expect(t.linhas[1]!.every((c) => c.alinhamento === 'centralizado')).toBe(true);
    // Linha com célula coberta de cima: a primeira célula começa na 2.ª coluna e é numérica.
    expect(t.linhas[5]!.map((c) => c.alinhamento)).toEqual(['direita', 'direita', 'direita']);
    expect(t.linhas[2]!.map((c) => c.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join(''))).toEqual(['Norte (1)', '1.234,5', '1.300,0', '1.410,2']);
  });

  it('rodapé Fonte → Nota → notas específicas (RN-277), chamada entre parênteses (RN-267), uma linha depois (RN-031, RN-308)', () => {
    const r = paragrafos(f).filter((p) => p.estilo === 'rodapeElemento');
    expect(r.slice(0, 4).map(textoDe)).toEqual([
      'Fonte: Dados fictícios de teste (2026).',
      'Nota: Sinal convencional utilizado: – Dado numérico igual a zero não resultante de arredondamento.',
      '(1) Região de exemplo.',
      '(2) Outra nota de exemplo.',
    ]);
    expect(r.slice(0, 3).map((p) => p.depoisTw)).toEqual([undefined, undefined, undefined]);
    expect(r[3]!.depoisTw).toBe(240);
    expect(r[3]!.origem).toEqual(['RN-277', 'RN-267', 'RN-031', 'RN-308']);
  });

  it('sem fonte nem nota, sai um parágrafo vazio com a linha depois', () => {
    const ultimo = blocos(f).at(-1)!;
    expect(ultimo).toMatchObject({ tipo: 'paragrafo', estilo: 'rodapeElemento', trechos: [], depoisTw: 240 });
  });

  it('sem as regras no perfil, nada vem do código: sem traços, sem cabeçalho repetido, sem rótulo, sem espaço', () => {
    const g = formatar(doc(TABELA_CORPUS, QUADRO_CORPUS), semRegras('RN-251', 'RN-061', 'RN-292', 'RN-052', 'RN-031', 'RN-308'));
    for (const t of tabelas(g)) {
      expect(Object.values(t.tracos).every((x) => !x)).toBe(true);
      expect(t.repetirCabecalho).toBe(false);
    }
    expect(textoDe(paragrafos(g).find((p) => p.estilo === 'tituloElemento')!)).toBe('Produção fictícia por região, 2020–2022');
    expect(paragrafos(g).every((p) => p.depoisTw === undefined)).toBe(true);
    expect(estilo(g, 'tituloElemento').propriedades.antesTw).toBeUndefined();
  });
});

describe('DOCX: tabela nativa do Word', () => {
  let xml: string;
  let estilos: string;
  let tbls: string[];
  beforeAll(async () => {
    const z = unzipSync(await exportarDocx(formatar(doc(TABELA_CORPUS, QUADRO_CORPUS, TABELA_LONGA_CORPUS), PERFIL)));
    xml = strFromU8(z['word/document.xml']!);
    estilos = strFromU8(z['word/styles.xml']!);
    tbls = xml.match(/<w:tbl>.*?<\/w:tbl>/gs) ?? [];
  });
  const bordas = (t: string) => /<w:tblBorders>(.*?)<\/w:tblBorders>/s.exec(t)![1]!;
  const lado = (t: string, l: string) => new RegExp(`<w:${l} [^>]*w:val="(\\w+)"`).exec(bordas(t))?.[1];
  const linhas = (t: string) => t.match(/<w:tr>.*?<\/w:tr>/gs) ?? [];

  it('XML bem formado, três tabelas', () => {
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(tbls).toHaveLength(3);
  });

  it('tabela: tblBorders só com o traço de cima, sem laterais nem internos (RN-251, RN-253, RN-254, RN-252)', () => {
    const t = tbls[0]!;
    // O de baixo vai nas células da última linha: o `bottom` da tabela o Word repete em cada quebra de página (RN-295).
    expect(['top', 'bottom', 'left', 'right', 'insideH', 'insideV'].map((l) => lado(t, l))).toEqual(['single', 'none', 'none', 'none', 'none', 'none']);
  });

  it('tabela: traço abaixo do cabeçalho e abaixo da última linha, nas células, e só nelas (RN-251, RN-295)', () => {
    const tr = linhas(tbls[0]!);
    const comBaixo = tr.map((l) => (l.match(/<w:tcBorders><w:bottom [^>]*w:val="single"/g) ?? []).length);
    // Linha 1: "Região" (restart, desce até a última linha de cabeçalho); linha 2: a continuação e os três anos;
    // linha 5: "Sul" (restart, desce até a última linha); linha 6: a continuação e os três dados.
    expect(comBaixo).toEqual([1, 4, 0, 0, 1, 4]);
    const longa = linhas(tbls[2]!).map((l) => l.includes('<w:tcBorders><w:bottom'));
    expect(longa.filter(Boolean)).toHaveLength(2);
    expect([longa[0], longa.at(-1)]).toEqual([true, true]);
  });

  it('quadro: todos os traços (RN-061)', () => {
    expect(['top', 'bottom', 'left', 'right', 'insideH', 'insideV'].map((l) => lado(tbls[1]!, l))).toEqual(Array(6).fill('single'));
  });

  it('cabeçalho repetido só nas linhas de cabeçalho (RN-292)', () => {
    expect(linhas(tbls[0]!).map((l) => l.includes('<w:tblHeader/>'))).toEqual([true, true, false, false, false, false]);
    expect(linhas(tbls[2]!).filter((l) => l.includes('<w:tblHeader/>'))).toHaveLength(1);
  });

  it('mesclagem: gridSpan e vMerge restart/continue', () => {
    const t = tbls[0]!;
    expect(t).toContain('<w:gridSpan w:val="3"/>');
    expect(t.match(/<w:vMerge w:val="restart"\/>/g)).toHaveLength(2);
    expect(t.match(/<w:vMerge w:val="continue"\/>/g)).toHaveLength(2);
    // Toda linha cobre as quatro colunas da grade.
    for (const l of linhas(t)) {
      const spans = [...l.matchAll(/<w:tc>(.*?)<\/w:tc>/gs)].map((m) => Number(/<w:gridSpan w:val="(\d+)"/.exec(m[1]!)?.[1] ?? 1));
      expect(spans.reduce((a, b) => a + b, 0)).toBe(4);
    }
    // A célula de continuação tem o estilo da célula, para a linha não crescer.
    expect(t).toMatch(/<w:vMerge w:val="continue"\/>.*?<w:pStyle w:val="celulaTabela"\/><\/w:pPr><\/w:p>/s);
  });

  it('largura: área útil, colunas somando exatamente', () => {
    for (const t of tbls) {
      expect(t).toContain('<w:tblW w:type="dxa" w:w="9071"/>');
      const cols = [...t.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
      expect(cols.reduce((a, b) => a + b, 0)).toBe(9071);
    }
  });

  it('alinhamento da coluna nas células: números à direita (P-C4), indicadores à esquerda', () => {
    const dados = linhas(tbls[0]!)[2]!;
    expect([...dados.matchAll(/<w:jc w:val="(\w+)"\/>/g)].map((m) => m[1])).toEqual(['left', 'right', 'right', 'right']);
  });

  it('estilos: título 12 (sz 24) centralizado com keepNext; rodapé e célula 10 (sz 20)', () => {
    const e = (id: string) => new RegExp(`<w:style [^>]*w:styleId="${id}".*?</w:style>`, 's').exec(estilos)![0];
    expect(e('tituloElemento')).toMatch(/<w:keepNext\/>/);
    expect(e('tituloElemento')).toMatch(/<w:jc w:val="center"\/>/);
    expect(e('tituloElemento')).toMatch(/<w:sz w:val="24"\/>/);
    expect(e('tituloElemento')).toMatch(/w:before="240"/);
    expect(e('rodapeElemento')).toMatch(/<w:jc w:val="left"\/>/);
    expect(e('rodapeElemento')).toMatch(/<w:sz w:val="20"\/>/);
    expect(e('celulaTabela')).toMatch(/<w:sz w:val="20"\/>/);
    expect(e('celulaTabela')).not.toMatch(/<w:shd/); // sem sombreamento (D-M5-02)
    expect(xml).not.toMatch(/<w:shd/);
  });

  it('o título precede a tabela e o rodapé vem depois, com a linha após o último parágrafo', () => {
    expect(xml).toMatch(/Tabela 1 – <\/w:t>.*?<\/w:p>\s*<w:tbl>/s);
    expect(xml).toMatch(/<\/w:tbl>\s*<w:p><w:pPr><w:pStyle w:val="rodapeElemento"\/><\/w:pPr><w:r><w:t xml:space="preserve">Fonte: /s);
    expect(xml).toMatch(/<w:spacing w:after="240"\/><\/w:pPr><w:r><w:t xml:space="preserve">\(2\) /);
  });
});
