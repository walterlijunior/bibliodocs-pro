// M5-T09 (RF-10; D-M5-08, D-M5-47 a 51) — gráfico gerado de tabela: leitura dos números no padrão brasileiro, dados
// tirados da tabela a cada vez (o gráfico acompanha a tabela: aceite do RF-10), escala, desenho em primitivas, numeração
// "Gráfico n" na sequência dos gráficos com imagem, motor e DOCX com o PNG que vem do renderer, verificador e a
// conferência dos PNG no canal de exportação. O canvas é exercitado no E2E (`e2e/grafico.spec.ts`).
import { describe, expect, it } from 'vitest';
import { CANAIS_EXPORTACAO, criarTrabalhoDoTipo, type PacoteTransferivel, type ResultadoExportar } from '../src/aplicacao';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import type { BlocoGrafico, BlocoIlustracao, BlocoTabela, CelulaTabela, Secao } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { verificarVisuais } from '../src/dominio/verificador';
import { dadosDoGrafico, desenharGrafico, escalaRedonda, lerNumero, tamanhoGraficoMm, type Primitiva } from '../src/dominio/visuais';
import { exportarDocx } from '../src/exportacao/docx';
import { ErroIpcRecusado } from '../src/principal/ipc/chamada';
import { criarManipuladoresExportacao, type DependenciasExportacao } from '../src/principal/ipc/manipuladores-exportacao';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';
import { abrirDocx } from './apoio/docx-normalizado';
import { pngDeTeste } from './corpus/corpus';

const t = (texto: string) => [{ tipo: 'texto' as const, texto }];
const cel = (texto: string, extra: Partial<CelulaTabela> = {}): CelulaTabela => ({ conteudo: t(texto), ...extra });
const TABELA: BlocoTabela = {
  tipo: 'tabela',
  id: 'tab_grafico00001',
  especie: 'tabela',
  titulo: t('Produção'),
  colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'direita' }, { alinhamento: 'direita' }, { alinhamento: 'esquerda' }],
  linhasCabecalho: 1,
  linhas: [
    [cel('Ano'), cel('Soja (t)'), cel('Milho (t)'), cel('Obs.')],
    [cel('2020'), cel('1.234,5'), cel('–'), cel('seca')],
    [cel('2021'), cel('2 000'), cel('800'), cel('')],
    [cel('Total'), cel('3.234,5'), cel('800'), cel('')],
  ],
  fonte: t('IBGE (2022).'),
};
const grafico = (extra: Partial<BlocoGrafico> = {}): BlocoGrafico => ({ tipo: 'grafico', id: 'gra_grafico00001', tabela: TABELA.id, forma: 'colunas', titulo: t('Produção por ano'), fonte: t('IBGE (2022).'), ...extra });
const sec = (blocos: Secao['blocos']): Secao => ({ id: 'sec_grafico00001', titulo: t('Seção'), blocos, subsecoes: [] });

describe('números no padrão brasileiro (D-M5-50)', () => {
  it.each([
    ['1.234,5', 1234.5],
    ['2 000', 2000],
    ['R$ 10,50', 10.5],
    ['12%', 12],
    ['-3', -3],
    ['−3,5', -3.5],
    ['0,25', 0.25],
    ['1234', 1234],
  ])('%s → %d', (texto, valor) => expect(lerNumero(texto)).toBe(valor));
  it.each(['', '–', '...', 'X', 'seca', '1.5', '1,2,3'])('"%s" não é número', (texto) => expect(lerNumero(texto)).toBeNull());
});

describe('dados lidos da tabela', () => {
  it('categorias da 1.ª coluna, séries numéricas com o nome do cabeçalho, sinal sem valor, total fora com aviso', () => {
    const d = dadosDoGrafico(grafico(), TABELA);
    expect(d).toEqual({
      ok: true,
      categorias: ['2020', '2021'],
      series: [
        { coluna: 1, nome: 'Soja (t)', valores: [1234.5, 2000] },
        { coluna: 2, nome: 'Milho (t)', valores: [null, 800] },
      ],
      avisos: ['a linha de total da tabela ficou fora do gráfico.'],
    });
  });

  it('o gráfico acompanha a tabela (aceite do RF-10): outro número na tabela, outro dado', () => {
    const mudada: BlocoTabela = { ...TABELA, linhas: TABELA.linhas.map((l, i) => (i === 1 ? [cel('2020'), cel('9.999'), cel('1'), cel('')] : l)) };
    const d = dadosDoGrafico(grafico(), mudada);
    expect(d.ok && d.series[0]!.valores).toEqual([9999, 2000]);
  });

  it('séries escolhidas; setores usa a primeira, com aviso', () => {
    expect(dadosDoGrafico(grafico({ series: [2] }), TABELA)).toMatchObject({ ok: true, series: [{ coluna: 2 }] });
    const s = dadosDoGrafico(grafico({ forma: 'setores' }), TABELA);
    expect(s.ok && s.series.map((x) => x.coluna)).toEqual([1]);
    expect(s.ok && s.avisos).toContain('o gráfico de setores usa só a primeira série.');
  });

  it('sem tabela, quadro no lugar de tabela, ou sem número: não desenha', () => {
    expect(dadosDoGrafico(grafico(), null)).toMatchObject({ ok: false, motivo: 'semTabela' });
    expect(dadosDoGrafico(grafico(), { ...TABELA, especie: 'quadro' })).toMatchObject({ ok: false, motivo: 'semTabela' });
    expect(dadosDoGrafico(grafico({ series: [3] }), TABELA)).toMatchObject({ ok: false, motivo: 'semDados' });
  });
});

describe('escala e desenho (D-M5-08)', () => {
  it('escala com 0 e passo redondo', () => {
    expect(escalaRedonda(1234.5, 2000)).toEqual({ inicio: 0, fim: 2000, passo: 500 });
    expect(escalaRedonda(-30, 70)).toEqual({ inicio: -40, fim: 80, passo: 20 });
    expect(escalaRedonda(5, 5)).toEqual({ inicio: 0, fim: 5, passo: 1 });
  });

  const d = dadosDoGrafico(grafico(), TABELA);
  if (!d.ok) throw new Error('dados');
  const tipos = (p: Primitiva[], tipo: Primitiva['tipo']) => p.filter((x) => x.tipo === tipo);
  const textos = (p: Primitiva[]) => p.flatMap((x) => (x.tipo === 'texto' ? [x.texto] : []));
  const dentro = (p: Primitiva[], l: number, a: number) =>
    p.every((x) => (x.tipo === 'retangulo' ? x.x >= 0 && x.y >= 0 && x.x + x.largura <= l + 0.01 && x.y + x.altura <= a + 0.01 : true));

  it('colunas: uma coluna por valor (o sem dado não aparece), padrão por série, marcas em pt-BR, legenda com as séries', () => {
    const p = desenharGrafico(d, 'colunas', 600, 360, { tamanhoTexto: 14 });
    const barras = tipos(p, 'retangulo').filter((r) => r.tipo === 'retangulo' && r.largura < 100);
    // 3 valores + 2 amostras da legenda.
    expect(barras).toHaveLength(5);
    expect(new Set(barras.map((r) => (r.tipo === 'retangulo' ? r.padrao : -1)))).toEqual(new Set([0, 1]));
    expect(textos(p)).toEqual(expect.arrayContaining(['Soja (t)', 'Milho (t)', '2020', '2021', '0', '500', '1.000', '1.500', '2.000']));
    expect(dentro(p, 600, 360)).toBe(true);
    // Nenhum texto sai pela borda de cima (a marca mais alta ficava cortada ao meio).
    for (const x of p) if (x.tipo === 'texto') expect(x.y - (x.base === 'meio' ? x.tamanho / 2 : 0), x.texto).toBeGreaterThanOrEqual(0);
  });

  it('barras: horizontais, uma série sem legenda', () => {
    const uma = dadosDoGrafico(grafico({ series: [1] }), TABELA);
    if (!uma.ok) throw new Error('dados');
    const p = desenharGrafico(uma, 'barras', 600, 360, { tamanhoTexto: 14 });
    const r = tipos(p, 'retangulo');
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.tipo === 'retangulo' && x.largura > x.altura)).toBe(true);
    expect(textos(p)).not.toContain('Soja (t)');
  });

  it('linhas: traço por série com tracejado diferente e marcador nos pontos com dado', () => {
    const p = desenharGrafico(d, 'linhas', 600, 360, { tamanhoTexto: 14 });
    // Soja tem 2 pontos (um traço); Milho tem 1 ponto (sem traço). + 2 traços da legenda.
    const tracosSeries = tipos(p, 'traco').filter((x) => x.tipo === 'traco' && x.espessura > 14 / 12 + 0.01);
    expect(tracosSeries.length).toBe(3);
    expect(tipos(p, 'marcador').length).toBe(3 + 2);
  });

  it('setores: fatias que somam a volta, percentuais e legenda das categorias', () => {
    const s = dadosDoGrafico(grafico({ forma: 'setores' }), TABELA);
    if (!s.ok) throw new Error('dados');
    const p = desenharGrafico(s, 'setores', 600, 450, { tamanhoTexto: 14 });
    const setores = tipos(p, 'setor') as Extract<Primitiva, { tipo: 'setor' }>[];
    expect(setores).toHaveLength(2);
    expect(setores.reduce((a, x) => a + (x.fim - x.inicio), 0)).toBeCloseTo(Math.PI * 2);
    expect(textos(p)).toEqual(expect.arrayContaining(['38,2%', '61,8%', '2020', '2021']));
  });

  it('tamanho: 150 mm por padrão, limitado à área útil; setores mais alto', () => {
    expect(tamanhoGraficoMm({ forma: 'colunas' }, 160)).toEqual({ larguraMm: 150, alturaMm: 90 });
    expect(tamanhoGraficoMm({ forma: 'setores', larguraMm: 400 }, 160)).toEqual({ larguraMm: 160, alturaMm: 120 });
  });
});

describe('numeração, motor e verificador', () => {
  const figuraGrafico: BlocoIlustracao = { tipo: 'ilustracao', id: 'ilu_grafico00001', especie: 'grafico', titulo: t('Imagem'), midia: 'a'.repeat(64), fonte: t('X.') };
  const remissivas = { tipo: 'paragrafo' as const, id: 'par_grafico00001', conteudo: [TABELA.id, figuraGrafico.id, 'gra_grafico00001'].map((alvo, i) => ({ tipo: 'remissiva' as const, id: `rem_grafico0000${i}`, alvo })) };

  it('"Gráfico 2" depois do gráfico com imagem (mesma sequência, RN-049); título, imagem e rodapé no DOCX', async () => {
    const png = pngDeTeste(1772, 1063, 300);
    const corpo = [sec([TABELA, figuraGrafico, grafico(), remissivas])];
    const f = formatar({ corpo, graficos: new Map([['gra_grafico00001', png]]) }, PERFIL);
    const blocos = f.secoes.flatMap((s) => s.blocos);
    const titulos = blocos.flatMap((b) => (b.tipo === 'paragrafo' && b.estilo === 'tituloElemento' ? [b.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('')] : []));
    expect(titulos).toEqual(['Tabela 1 – Produção', 'Gráfico 1 – Imagem', 'Gráfico 2 – Produção por ano']);
    const imagem = blocos.find((b) => b.tipo === 'imagem' && b.dados === png);
    // 150 mm = 8504 twips; altura pela proporção do PNG.
    expect(imagem).toMatchObject({ formato: 'png', larguraTw: 8504, alturaTw: Math.round((8504 * 1063) / 1772), descricao: 'Gráfico 2 – Produção por ano' });
    expect(f.avisos.filter((a) => a.codigo === 'GRAFICO_NAO_DESENHADO')).toEqual([]);
    const xml = abrirDocx(await exportarDocx(f))['word/document.xml']!.replace(/<[^>]+>/g, '');
    expect(xml).toContain('Gráfico 2 – Produção por ano');
  });

  it('sem o PNG: título e rodapé, sem a imagem, com aviso', () => {
    const f = formatar({ corpo: [sec([TABELA, grafico()])] }, PERFIL);
    expect(f.avisos.map((a) => [a.codigo, a.id])).toEqual([['GRAFICO_NAO_DESENHADO', 'gra_grafico00001']]);
  });

  it('verificador: tabela excluída e sem número são pendências; total fora é aviso', () => {
    const r = verificarVisuais({ corpo: [sec([TABELA, grafico(), grafico({ id: 'gra_grafico00002', tabela: 'tab_naoexiste001' }), grafico({ id: 'gra_grafico00003', series: [3] }), { ...remissivas, conteudo: ['tab_grafico00001', 'gra_grafico00001', 'gra_grafico00002', 'gra_grafico00003'].map((alvo, i) => ({ tipo: 'remissiva' as const, id: `rem_graficoX000${i}`, alvo })) }])] });
    expect(r.map((p) => [p.codigo, p.nivel, p.elemento])).toEqual([
      ['GRAFICO_PARCIAL', 'aviso', 'gra_grafico00001'],
      ['GRAFICO_SEM_TABELA', 'pendencia', 'gra_grafico00002'],
      ['GRAFICO_SEM_DADOS', 'pendencia', 'gra_grafico00003'],
    ]);
    expect(r[1]!.mensagem).toBe('Gráfico 2: a tabela de onde o gráfico vem não está mais no trabalho.');
  });
});

describe('canal de exportação: PNG dos gráficos conferidos no principal', () => {
  function pacoteCom(blocos: Secao['blocos']): PacoteTransferivel {
    let n = 0;
    const tr = criarTrabalhoDoTipo({ id: 'prj_abcdefghijklmnop', agora: '2026-01-01T00:00:00.000Z', appVersao: '0.1.0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
    return { manifesto: tr.manifesto, documento: { ...tr.documento, metadados: { titulo: t('T') }, corpo: [sec(blocos)] }, midias: [] } as unknown as PacoteTransferivel;
  }
  function montar() {
    const imagens: number[] = [];
    const dep: DependenciasExportacao = {
      origem: ORIGEM_PRODUCAO,
      conteudosPermitidos: () => new Set([7]),
      perfil: PERFIL,
      escolherDestino: async (_id, nome) => `C:\\pasta\\${nome}`,
      exportar: async (f) => {
        for (const s of f.secoes) for (const b of s.blocos) if (b.tipo === 'imagem') imagens.push(b.dados.length);
        return { ok: true, bytes: new Uint8Array([1]) };
      },
      gravar: async () => ({ ok: true, avisos: [], tentativas: 1, duracaoMs: 0, bak: null }) as never,
      log: () => {},
    };
    const m = criarManipuladoresExportacao(dep)[CANAIS_EXPORTACAO.docx];
    return { chamar: (...a: unknown[]) => m({ idConteudo: 7, urlQuadro: 'app://interface/index.html', quadroPrincipal: true }, a) as Promise<ResultadoExportar>, imagens };
  }
  const png = pngDeTeste(600, 360, 300);

  it('o PNG do gráfico chega ao exportador; id que não é gráfico do documento e bytes que não são PNG ficam de fora', async () => {
    const x = montar();
    const r = await x.chamar(pacoteCom([TABELA, grafico()]), { graficos: { gra_grafico00001: png, tab_grafico00001: png } });
    expect(r.ok).toBe(true);
    expect(x.imagens).toEqual([png.length]);
    const y = montar();
    const r2 = await y.chamar(pacoteCom([TABELA, grafico()]), { graficos: { gra_grafico00001: new Uint8Array([1, 2, 3]) } });
    expect(y.imagens).toEqual([]);
    expect(r2.ok ? r2.avisos.join('\n') : '').toContain('Um gráfico não pôde ser desenhado');
  });

  it('forma errada é recusada como argumento inválido', async () => {
    await expect(montar().chamar(pacoteCom([]), { graficos: [png] })).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(montar().chamar(pacoteCom([]), { graficos: { gra_x00000000001: 'texto' } })).rejects.toBeInstanceOf(ErroIpcRecusado);
  });
});
