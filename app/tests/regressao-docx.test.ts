// M3-T06 (ADR-0006, camada 5; RF-05, DOC-01 a DOC-07). Dois níveis: propriedades normativas, com a RN na mensagem de falha
// e valores escritos aqui a partir do Manual, de propósito fora do perfil; e instantâneo do XML normalizado.
// Instantâneo só muda com revisão humana: `npx vitest run tests/regressao-docx.test.ts -u`, e o commit explica o motivo.
import { join } from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { formatar, type DocumentoFormatado } from '../src/dominio/normas';
import type { Documento } from '../src/dominio/modelo';
import { exportarDocx } from '../src/exportacao/docx';
import { abrirDocx, normalizarXml, PARTES_DO_INSTANTANEO, type Partes } from './apoio/docx-normalizado';
import { documentoDificil, IMAGENS_CORPUS, TIPOS, trabalhoDoTipo } from './corpus/corpus';

type No = Record<string, unknown>;
const leitor = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', isArray: (n) => ['w:style', 'w:p', 'w:sectPr', 'w:r'].includes(n) });

const CORPUS: readonly (readonly [string, () => Documento])[] = [...TIPOS.map((t) => [t, () => trabalhoDoTipo(t)] as const), ['documento-dificil', documentoDificil]];
const gerados = new Map<string, { partes: Partes; formatado: DocumentoFormatado; bytes: Uint8Array }>();

beforeAll(async () => {
  for (const [nome, criar] of CORPUS) {
    const formatado = formatar({ ...criar(), imagens: IMAGENS_CORPUS }, PERFIL);
    const bytes = await exportarDocx(formatado);
    gerados.set(nome, { partes: abrirDocx(bytes), formatado, bytes });
  }
}, 120_000);

function estilosDe(partes: Partes): Map<string, No> {
  const raiz = leitor.parse(partes['word/styles.xml']!) as { 'w:styles': { 'w:style': No[] } };
  return new Map(raiz['w:styles']['w:style'].map((e) => [e['@w:styleId'] as string, e]));
}
const pPr = (e: No): No => (e['w:pPr'] as No | undefined) ?? {};
const rPr = (e: No): No => (e['w:rPr'] as No | undefined) ?? {};
const at = (n: unknown, a: string): string | undefined => (n as No | undefined)?.[`@w:${a}`] as string | undefined;

describe.each(CORPUS.map(([nome]) => nome))('propriedades normativas: %s', (nome) => {
  const g = () => gerados.get(nome)!;
  const estilo = (id: string): No => {
    const e = estilosDe(g().partes).get(id);
    if (!e) throw new Error(`estilo ${id} ausente`);
    return e;
  };
  const secoes = () => (g().partes['word/document.xml']!.match(/<w:sectPr.*?<\/w:sectPr>/gs) ?? []);

  it('marcadores com nome que o Word aceita: até 40 caracteres, letras, algarismos e "_" (revisão do M6)', () => {
    const nomes = [...g().partes['word/document.xml']!.matchAll(/<w:bookmarkStart [^>]*w:name="([^"]*)"/g)].map((m) => m[1]!);
    for (const n of nomes) expect(n, n).toMatch(/^[A-Za-z_][A-Za-z0-9_]{0,39}$/);
  });
  it('XML bem formado', () => {
    for (const [n, x] of Object.entries(g().partes)) expect(XMLValidator.validate(x), n).toBe(true);
  });
  it('RN-018: A4; RN-002: margens 3/3/2/2 cm', () => {
    expect(secoes().length).toBeGreaterThan(0);
    for (const s of secoes()) {
      expect(s, 'RN-018').toMatch(/<w:pgSz [^>]*w:w="11906"[^>]*w:h="16838"/);
      for (const m of ['top="1701"', 'left="1701"', 'bottom="1134"', 'right="1134"']) expect(s, `RN-002 ${m}`).toContain(`w:${m}`);
    }
  });
  it('RN-001: corpo em Times 12; RN-003: 1,25 cm e justificado; RN-029: 1,5', () => {
    const e = estilo('corpo');
    expect(at(rPr(e)['w:rFonts'], 'ascii'), 'RN-001').toBe('Times New Roman');
    expect(at(rPr(e)['w:sz'], 'val'), 'RN-001').toBe('24');
    expect(at(pPr(e)['w:ind'], 'firstLine'), 'RN-003').toBe('709');
    expect(at(pPr(e)['w:jc'], 'val'), 'RN-003').toBe('both');
    expect(at(pPr(e)['w:spacing'], 'line'), 'RN-029').toBe('360');
  });
  it('RN-004: citação longa com 4 cm, 10 pt e simples', () => {
    const e = estilo('citacaoLonga');
    expect(at(pPr(e)['w:ind'], 'left'), 'RN-004').toBe('2268');
    expect(at(rPr(e)['w:sz'], 'val'), 'RN-004').toBe('20');
    expect(at(pPr(e)['w:spacing'], 'line'), 'RN-004').toBe('240');
  });
  it('RN-010 a RN-014 e RN-040: cinco níveis do Quadro 1, em 12 pt', () => {
    const destaque: [string, string, string][] = [
      ['titulo1', 'w:b', 'RN-010'],
      ['titulo1', 'w:caps', 'RN-010'],
      ['titulo2', 'w:b', 'RN-011'],
      ['titulo4', 'w:i', 'RN-013'],
      ['titulo5', 'w:u', 'RN-014'],
    ];
    for (const [id, marca, rn] of destaque) expect(rPr(estilo(id))[marca], `${rn} ${id}`).toBeDefined();
    expect(rPr(estilo('titulo2'))['w:caps'], 'RN-011').toBeUndefined();
    expect(rPr(estilo('titulo3'))['w:b'], 'RN-012').toBeUndefined();
    [1, 2, 3, 4, 5].forEach((n) => {
      expect(at(rPr(estilo(`titulo${n}`))['w:sz'], 'val'), 'RN-040').toBe('24');
      expect(at(pPr(estilo(`titulo${n}`))['w:outlineLvl'], 'val'), 'RN-041').toBe(String(n - 1));
      expect(at(pPr(estilo(`titulo${n}`))['w:jc'], 'val'), 'RN-005').toBe('left');
      expect(pPr(estilo(`titulo${n}`))['w:keepNext'], 'RN-005').toBeDefined();
    });
    expect(pPr(estilo('titulo1'))['w:pageBreakBefore'], 'RN-008').toBeDefined();
  });
  it('RN-016: nota 10 pt, simples e justificada; RN-045: sem indicativo centralizado em maiúsculas e negrito', () => {
    const n = estilo('textoNota');
    expect(at(rPr(n)['w:sz'], 'val'), 'RN-016').toBe('20');
    expect(at(pPr(n)['w:spacing'], 'line'), 'RN-016').toBe('240');
    expect(at(pPr(n)['w:jc'], 'val'), 'RN-016').toBe('both');
    const s = estilo('tituloSemIndicativo');
    expect(at(pPr(s)['w:jc'], 'val'), 'RN-007').toBe('center');
    expect(rPr(s)['w:caps'], 'RN-045').toBeDefined();
    expect(rPr(s)['w:b'], 'RN-045').toBeDefined();
  });
  it('RN-017: natureza com 8 cm; RN-153: resumo simples; RN-070: número da página em 10 pt, à direita', () => {
    expect(at(pPr(estilo('naturezaTrabalho'))['w:ind'], 'left'), 'RN-017').toBe('4536');
    expect(at(pPr(estilo('resumo'))['w:spacing'], 'line'), 'RN-153').toBe('240');
    expect(at(rPr(estilo('numeroPagina'))['w:sz'], 'val'), 'RN-070').toBe('20');
    expect(at(pPr(estilo('numeroPagina'))['w:jc'], 'val'), 'RN-069').toBe('right');
  });
  it('RN-067 e RN-068: contagem uma vez só; número só do texto em diante', () => {
    const s = secoes();
    expect(s.filter((x) => /w:start="\d+"/.test(x)), 'RN-073').toHaveLength(1);
    const papeis = g().formatado.secoes.map((x) => x.papel);
    s.forEach((x, i) => expect(/headerReference/.test(x), `RN-068 ${papeis[i]}`).toBe(papeis[i] === 'textual' || papeis[i] === 'posTextual'));
  });
  it('RF-05: nenhuma formatação nos estilos do motor sem RN de origem', () => {
    const mapa: Record<string, (v: No) => string[]> = {
      'w:rFonts': () => ['fonte'],
      'w:sz': () => ['corpoMeioPt'],
      'w:szCs': () => ['corpoMeioPt'],
      'w:b': () => ['negrito'],
      'w:bCs': () => ['negrito'],
      'w:i': () => ['italico'],
      'w:iCs': () => ['italico'],
      'w:u': () => ['sublinhado'],
      'w:caps': () => ['maiusculas'],
      'w:jc': () => ['alinhamento'],
      'w:keepNext': () => ['manterComProximo'],
      'w:pageBreakBefore': () => ['quebraPaginaAntes'],
      'w:spacing': (v) => [v['@w:line'] ? 'linha' : '', v['@w:before'] ? 'antesTw' : '', v['@w:after'] ? 'depoisTw' : ''].filter(Boolean),
      'w:ind': (v) => [v['@w:left'] ? 'recuoEsquerdaTw' : '', v['@w:firstLine'] ? 'recuoPrimeiraLinhaTw' : '', v['@w:hanging'] ? 'deslocamentoTw' : ''].filter(Boolean),
    };
    const sem = new Set(['w:outlineLvl', 'w:numPr', 'w:lineRule']); // estrutura, com RN-041 e RN-039 no bloco
    const todos = estilosDe(g().partes);
    const conhecidas = new Set(Object.keys(mapa));
    for (const e of g().formatado.estilos) {
      const x = todos.get(e.id);
      expect(x, e.id).toBeDefined();
      for (const [marca, v] of [...Object.entries(pPr(x!)), ...Object.entries(rPr(x!))]) {
        if (sem.has(marca)) continue;
        expect(conhecidas.has(marca), `marca sem mapa em ${e.id}: ${marca}`).toBe(true);
        for (const prop of mapa[marca]!((v as No) ?? {})) {
          expect((e.origem as Record<string, unknown>)[prop], `${e.id}.${prop} (${marca}) sem RN`).toBeDefined();
        }
      }
    }
  });
  it('RF-05: nos parágrafos, nenhuma formatação direta além da estrutura e da dedicatória (RN-146)', () => {
    // M5-T03: dentro das células, só o alinhamento da coluna, escolhido pelo autor (conferido no documento difícil).
    const doc = g().partes['word/document.xml']!.replace(/<w:tc>.*?<\/w:tc>/gs, '');
    // M5-T10 (N-M5-01): a fonte da figura e do gráfico tem recuo esquerdo até a borda da imagem (RN-057, C-A4); é posição
    // calculada da largura do elemento, como a tabulação da equação, e é conferida no documento difícil.
    const fora = [...doc.matchAll(/<w:pPr>(.*?)<\/w:pPr>/gs)].flatMap((m) =>
      [...m[1]!.matchAll(/<(w:\w+)/g)]
        .map((x) => x[1]!)
        .filter((tag) => /^w:(jc|ind|keepNext|keepLines|shd|pBdr)$/.test(tag))
        .filter((tag) => !(tag === 'w:ind' && m[1]!.includes('w:val="rodapeElemento"') && /^<w:pStyle w:val="rodapeElemento"\/><w:ind w:left="\d+"\/>/.test(m[1]!.replace(/<w:spacing[^>]*\/>/, '')))),
    );
    expect(fora).toEqual([]);
  });
});

describe('instantâneo do XML normalizado', () => {
  it.each(CORPUS.map(([nome]) => nome))('%s é igual ao aprovado', async (nome) => {
    for (const parte of PARTES_DO_INSTANTANEO) {
      const xml = gerados.get(nome)!.partes[parte];
      if (xml === undefined) continue;
      await expect(normalizarXml(xml)).toMatchFileSnapshot(join(__dirname, 'instantaneos', nome, `${parte.replace('word/', '')}.snap`));
    }
  });
  it('duas exportações do mesmo documento dão o mesmo XML normalizado', async () => {
    const f = formatar({ ...documentoDificil(), imagens: IMAGENS_CORPUS }, PERFIL);
    const [a, b] = [abrirDocx(await exportarDocx(f)), abrirDocx(await exportarDocx(f))];
    for (const parte of [...PARTES_DO_INSTANTANEO, 'docProps/core.xml']) expect(normalizarXml(b[parte] ?? ''), parte).toBe(normalizarXml(a[parte] ?? ''));
  });
  it('a normalização tira data e rsid, ordena atributos e renumera marcadores', () => {
    expect(normalizarXml('<a w:b="1" w:a="2" w:rsidR="x"/><dcterms:created x="y">2026</dcterms:created><w:bookmarkStart w:name="n" w:id="99"/>')).toBe(
      '<a w:a="2" w:b="1"/>\n<dcterms:created/>\n<w:bookmarkStart w:id="1" w:name="n"/>',
    );
  });
});

describe('o documento difícil exercita o que deve', () => {
  it('tem cinco níveis, notas, listas, citação e os avisos esperados', () => {
    const { formatado, partes } = gerados.get('documento-dificil')!;
    const doc = partes['word/document.xml']!;
    for (let n = 1; n <= 5; n++) expect(doc, `titulo${n}`).toContain(`w:val="titulo${n}"`);
    expect(partes['word/footnotes.xml']!.match(/<w:footnote /g)!.length).toBeGreaterThanOrEqual(3);
    expect(doc).toContain('w:val="citacaoLonga"');
    expect(doc).toContain('w:val="subalinea"');
    expect(doc).toContain('APÊNDICE B – Questionário de exemplo');
    expect(doc).toContain('ANEXO A – Documento de exemplo');
    // M6-T04: a forma "Termo: definição" do glossário é provisória (D-M6-06) e avisa.
    expect(formatado.avisos.map((a) => a.codigo)).toEqual(['FORMA_SEM_FONTE', 'BRASAO_AUSENTE']);
  });

  it('tem tabela, quadro e tabela longa nativos, com os traços da norma (M5-T03; RN-251, RN-254, RN-061, RN-292)', () => {
    const doc = gerados.get('documento-dificil')!.partes['word/document.xml']!;
    const tbls = doc.match(/<w:tbl>.*?<\/w:tbl>/gs)!;
    expect(tbls).toHaveLength(4); // a ficha catalográfica e os três elementos
    for (const titulo of ['Tabela 1 – ', 'Quadro 1 – ', 'Tabela 2 – ']) expect(doc).toContain(titulo);
    const lados = (t: string) => ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((l) => new RegExp(`<w:${l} [^>]*w:val="(\\w+)"`).exec(t)![1]);
    // O traço de baixo da tabela vai nas células da última linha (RN-295).
    expect(lados(tbls[1]!), 'RN-251, RN-254').toEqual(['single', 'none', 'none', 'none', 'none', 'none']);
    expect(lados(tbls[2]!), 'RN-061').toEqual(Array(6).fill('single'));
    expect(lados(tbls[3]!), 'RN-251, RN-254').toEqual(['single', 'none', 'none', 'none', 'none', 'none']);
    expect(tbls[3]!.match(/<w:tr>.*?<\/w:tr>/gs)!.at(-1), 'RN-251, RN-295').toMatch(/<w:tcBorders><w:bottom [^>]*w:val="single"/);
    expect(tbls[3]!.match(/<w:tblHeader\/>/g), 'RN-292').toHaveLength(1);
  });

  it('tem equações destacadas, com "(n)" numa tabulação à direita na largura útil (M5-T07; RN-105, RN-106, RN-108)', () => {
    const { partes } = gerados.get('documento-dificil')!;
    const eqs = partes['word/document.xml']!.match(/<w:p>(?:(?!<\/w:p>).)*?w:val="equacao".*?<\/w:p>/gs)!;
    expect(eqs, 'RN-105').toHaveLength(3);
    const texto = (p: string) => [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:(tab)\/>/g)].map((m) => m[1] ?? '	').join('');
    expect(eqs.map(texto)).toEqual(['E = mc2	(1)', '(x + y) / 5 = n	(2)', 'xi + 1']);
    // A4 com margens 3 e 2 cm: 11906 - 1701 - 1134 = 9071 twips.
    for (const p of eqs.slice(0, 2)) expect(p, 'RN-106').toMatch(/<w:tabs><w:tab w:val="right" w:pos="9071"\/><\/w:tabs>/);
    expect(eqs[2], 'sem número, sem tabulação').not.toContain('<w:tabs>');
    expect(eqs[0], 'expoente').toMatch(/<w:vertAlign w:val="superscript"\/>/);
    const e = estilosDe(partes).get('equacao')!;
    expect(at(pPr(e)['w:jc'], 'val'), 'RN-108, D-M5-05').toBe('left');
    expect(pPr(e)['w:ind'], 'sem recuo de primeira linha').toBeUndefined();
    expect(at(pPr(e)['w:spacing'], 'lineRule'), 'RN-107: auto, a linha cresce com o expoente').toBe('auto');
  });

  it('a fonte da figura começa na borda esquerda da imagem centralizada (N-M5-01; RN-057, C-A4)', () => {
    const doc = gerados.get('documento-dificil')!.partes['word/document.xml']!;
    // Figura de 50,8 mm (2880 twips) numa área útil de 9071: recuo de (9071 − 2880) / 2. Na tabela, de largura inteira, nenhum.
    const paragrafos = doc.match(/<w:p>.*?<\/w:p>/gs)!;
    const i = paragrafos.findIndex((x) => x.includes('<w:drawing'));
    const daFigura = paragrafos[i + 1]!;
    expect(daFigura).toContain('Fonte: ');
    expect(daFigura).toContain('<w:ind w:left="3096"/>');
    const daTabela = paragrafos.filter((x, k) => k !== i + 1 && x.includes('w:val="rodapeElemento"'));
    expect(daTabela.length).toBeGreaterThan(0);
    for (const x of daTabela) expect(x).not.toContain('<w:ind');
  });

  it('tem a remissiva com o número da tabela citada (M5-T08)', () => {
    const doc = gerados.get('documento-dificil')!.partes['word/document.xml']!;
    expect(doc.replace(/<[^>]+>/g, '')).toContain('Texto entre listas; ver a Tabela 1.');
  });

  it('tem a lista REFERÊNCIAS ordenada e as chamadas no texto (M4-T05)', () => {
    const { formatado } = gerados.get('documento-dificil')!;
    const texto = (estilo: string) =>
      formatado.secoes.flatMap((s) => s.blocos).flatMap((b) => (b.tipo === 'paragrafo' && b.estilo === estilo ? [b.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('')] : []));
    expect(texto('referencia')).toEqual([
      'BRASIL. Lei fictícia nº 1, de 1 de janeiro de 2000. Ementa fictícia. Diário Oficial Fictício, Brasília, DF, p. 1, 2 jan. 2000.',
      'CAPÍTULO, Autoria. Um capítulo de teste. In: ORGANIZAÇÃO, Fictícia (org.). Coletânea de teste. Palmas: Editora Fictícia, 2019. p. 10-30.',
      'COAUTORIA A, A et al. Artigo de teste. Revista Fictícia, Palmas, v. 1, n. 2, p. 3-4, 2021. Disponível em: https://exemplo.invalid/artigo. Acesso em: 1 jan. 2026.',
      'EXEMPLAR NETO, Autoria. Estudo de Caryocar brasiliense: um caso fictício. 2. ed. Palmas: Editora Fictícia, 2020a. 120 p.',
      'EXEMPLAR NETO, Autoria. Outro estudo. Palmas: Editora Fictícia, 2020b.',
    ]);
    // M6: o glossário (estilo do corpo) vem depois; a chamada narrativa é o último parágrafo do texto.
    expect(texto('corpo').find((t) => t.startsWith('Coautoria A'))).toBe(
      'Coautoria A et al. (2021) e Capítulo (2019, p. 15 apud EXEMPLAR NETO, 2020b, p. 8) afirmam o exemplo (BRASIL, 2000; EXEMPLAR NETO, 2020a, não paginado, grifo nosso).',
    );
    expect(texto('citacaoLonga')[0]).toMatch(/\(EXEMPLAR NETO, 2020a, p\. 12\)$/u);
  });
});
