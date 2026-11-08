// M5-T06 (RF-10; RNF-17; D-M5-09; RN-059) — figuras: cabeçalho do PNG e do JPEG, largura impressa e resolução efetiva,
// aviso abaixo de 150 ppi (aceite do RF-10), a figura no motor e no DOCX, e a validação da janela.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { avaliarImagem, rascunhoFiguraNova, validarFigura } from '../src/aplicacao';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import type { BlocoIlustracao, Secao } from '../src/dominio/modelo';
import { areaUtilMm, formatar, type BlocoFormatado } from '../src/dominio/normas';
import { avisoDeResolucao, verificarVisuais } from '../src/dominio/verificador';
import { larguraImpressaMm, lerInfoImagem, resolucaoEfetivaPpi } from '../src/dominio/visuais';
import { exportarDocx } from '../src/exportacao/docx';
import { abrirDocx } from './apoio/docx-normalizado';
import { pngDeTeste } from './corpus/corpus';

/** Cabeçalho de JPEG (SOI, APP0 JFIF com a densidade, SOF0): basta para ler tamanho e resolução. */
function jpegDeTeste(largura: number, altura: number, densidade: { unidade: 0 | 1 | 2; x: number }, sof = 0xc0): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, densidade.unidade, densidade.x >> 8, densidade.x & 0xff, densidade.x >> 8, densidade.x & 0xff, 0x00, 0x00];
  const sof0 = [0xff, sof, 0x00, 0x0b, 0x08, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 0x01, 0x01, 0x11, 0x00];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9]);
}

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const AREA = areaUtilMm(PERFIL);

describe('cabeçalho da imagem', () => {
  it('PNG: tamanho e resolução do pHYs; sem pHYs, sem resolução', () => {
    expect(lerInfoImagem(pngDeTeste(600, 400, 300))).toEqual({ tipo: 'image/png', larguraPx: 600, alturaPx: 400, ppi: expect.closeTo(300, 0) });
    expect(lerInfoImagem(pngDeTeste(30, 20, null))!.ppi).toBeNull();
  });
  it('JPEG: tamanho do SOF e resolução do JFIF em ppi ou em pontos por cm; SOF2 (progressivo) também', () => {
    expect(lerInfoImagem(jpegDeTeste(1200, 800, { unidade: 1, x: 300 }))).toEqual({ tipo: 'image/jpeg', larguraPx: 1200, alturaPx: 800, ppi: 300 });
    expect(lerInfoImagem(jpegDeTeste(100, 50, { unidade: 2, x: 100 }))!.ppi).toBeCloseTo(254);
    expect(lerInfoImagem(jpegDeTeste(100, 50, { unidade: 0, x: 1 }))!.ppi).toBeNull();
    expect(lerInfoImagem(jpegDeTeste(64, 32, { unidade: 1, x: 72 }, 0xc2))!.larguraPx).toBe(64);
  });
  it('não é PNG nem JPEG, ou cabeçalho cortado: null', () => {
    expect(lerInfoImagem(new TextEncoder().encode('GIF89a...'))).toBeNull();
    expect(lerInfoImagem(pngDeTeste(10, 10, null).subarray(0, 20))).toBeNull();
    expect(lerInfoImagem(jpegDeTeste(10, 10, { unidade: 1, x: 72 }).subarray(0, 12))).toBeNull();
  });
});

describe('largura impressa e resolução efetiva (RNF-17, D-M5-09)', () => {
  const info = lerInfoImagem(pngDeTeste(600, 400, 300))!;
  it('natural: pixels na resolução do arquivo (96 ppi sem ela), até a área útil', () => {
    expect(larguraImpressaMm(info, undefined, 160)).toBeCloseTo(50.8);
    expect(larguraImpressaMm({ ...info, ppi: null }, undefined, 160)).toBeCloseTo(158.75);
    expect(larguraImpressaMm({ ...info, larguraPx: 6000 }, undefined, 160)).toBe(160);
    expect(larguraImpressaMm(info, 200, 160)).toBe(160);
  });
  it('a área útil do perfil UFT é 160 mm (A4, margens de 3 e 2 cm)', () => {
    expect(AREA).toBeCloseTo(160, 0);
  });
  it('resolução efetiva no tamanho impresso; abaixo de 150 ppi, o aviso diz até que largura a imagem vai bem', () => {
    expect(resolucaoEfetivaPpi(info, 50.8)).toBeCloseTo(300);
    const png = pngDeTeste(600, 400, 300);
    expect(avisoDeResolucao(png, undefined, 160)).toBeNull();
    expect(avisoDeResolucao(png, 160, 160)).toBe(
      'a imagem fica com 95 ppi no tamanho impresso (o mínimo é 150) e pode sair borrada. Use uma imagem maior ou reduza a largura para até 101 mm.',
    );
    expect(avisoDeResolucao(pngDeTeste(40, 40, 72), 100, 160)).toBe('a imagem fica com 10 ppi no tamanho impresso (o mínimo é 150) e pode sair borrada. Use uma imagem maior.');
  });
});

describe('aceite do RF-10: figura com resolução abaixo do mínimo gera aviso', () => {
  const pequena = pngDeTeste(300, 200, null); // natural: 79 mm a 96 ppi
  const figura = (larguraMm?: number): BlocoIlustracao => ({
    tipo: 'ilustracao',
    id: 'ilu_teste0000001',
    especie: 'fotografia',
    titulo: [{ tipo: 'texto', texto: 'Foto' }],
    midia: sha(pequena),
    fonte: [{ tipo: 'texto', texto: 'Autor (2026).' }],
    ...(larguraMm !== undefined ? { larguraMm } : {}),
  });
  // Com a remissiva à figura: sem ela, o verificador também avisaria SEM_REMISSIVA (M5-T08).
  const corpo = (b: BlocoIlustracao): Secao[] => [
    { id: 'sec_teste00000001', titulo: [{ tipo: 'texto', texto: 'S' }], subsecoes: [], blocos: [b, { tipo: 'paragrafo', id: 'par_teste00000001', conteudo: [{ tipo: 'remissiva', id: 'rem_teste00000001', alvo: b.id }] }] },
  ];
  const imagens = new Map([[sha(pequena), pequena]]);

  it('o verificador avisa com o rótulo da figura; sem as imagens nas opções, não confere', () => {
    expect(verificarVisuais({ corpo: corpo(figura()) }, { imagens, areaUtilMm: AREA }).map((p) => [p.codigo, p.mensagem])).toEqual([
      ['RESOLUCAO_BAIXA', 'Fotografia 1: a imagem fica com 96 ppi no tamanho impresso (o mínimo é 150) e pode sair borrada. Use uma imagem maior ou reduza a largura para até 50 mm.'],
    ]);
    expect(verificarVisuais({ corpo: corpo(figura(40)) }, { imagens, areaUtilMm: AREA })).toEqual([]);
    expect(verificarVisuais({ corpo: corpo(figura()) })).toEqual([]);
  });
  it('a janela mostra a mesma avaliação', () => {
    const info = lerInfoImagem(pequena)!;
    expect(avaliarImagem(info, pequena, null)).toMatchObject({ larguraMm: expect.closeTo(79.375), ppi: expect.closeTo(96), aviso: expect.stringContaining('96 ppi') });
    expect(avaliarImagem(info, pequena, 40).aviso).toBeNull();
  });
});

describe('motor e DOCX (RN-052, RN-059)', () => {
  const png = pngDeTeste(600, 400, 300);
  const b: BlocoIlustracao = { tipo: 'ilustracao', id: 'ilu_teste0000001', especie: 'grafico', titulo: [{ tipo: 'texto', texto: 'Vendas' }], midia: sha(png), larguraMm: 120 };
  const corpo: Secao[] = [{ id: 'sec_teste00000001', titulo: [{ tipo: 'texto', texto: 'S' }], subsecoes: [], blocos: [b] }];
  const blocos = (f: ReturnType<typeof formatar>): BlocoFormatado[] => f.secoes.flatMap((s) => s.blocos).filter((x) => x.tipo === 'imagem' || ('estilo' in x && /Elemento$/.test(x.estilo)));

  it('título "Gráfico 1 – Vendas", imagem na largura pedida com a proporção, rodapé com a linha depois', () => {
    const f = formatar({ corpo, imagens: new Map([[b.midia, png]]) }, PERFIL);
    const [titulo, imagem, rodape] = blocos(f);
    expect(titulo).toMatchObject({ tipo: 'paragrafo', estilo: 'tituloElemento', trechos: [{ texto: 'Gráfico 1 – ' }, { texto: 'Vendas' }] });
    expect(imagem).toMatchObject({ tipo: 'imagem', estilo: 'imagemElemento', formato: 'png', larguraTw: 6803, alturaTw: 4535, descricao: 'Gráfico 1 – Vendas', origem: ['RN-059'] });
    expect(rodape).toMatchObject({ tipo: 'paragrafo', estilo: 'rodapeElemento', trechos: [], depoisTw: 240 });
    expect(f.avisos).toEqual([]);
  });
  it('o estilo da imagem é centralizado (RN-059), simples e sem recuo', () => {
    const f = formatar({ corpo, imagens: new Map([[b.midia, png]]) }, PERFIL);
    const e = f.estilos.find((x) => x.id === 'imagemElemento')!;
    expect(e.propriedades).toMatchObject({ alinhamento: 'centralizado' });
    expect(e.propriedades.linha).toBeUndefined();
    expect(e.propriedades.recuoPrimeiraLinhaTw).toBeUndefined();
    expect(e.origem.alinhamento).toEqual(['RN-059']);
  });
  it('sem os bytes: sai sem a imagem, com aviso', () => {
    const f = formatar({ corpo }, PERFIL);
    expect(f.avisos.map((a) => a.codigo)).toEqual(['IMAGEM_AUSENTE']);
    expect(blocos(f).map((x) => x.tipo)).toEqual(['paragrafo', 'paragrafo']);
  });
  it('DOCX: a imagem em linha, 120 mm, com texto alternativo e a mídia no pacote', async () => {
    const partes = abrirDocx(await exportarDocx(formatar({ corpo, imagens: new Map([[b.midia, png]]) }, PERFIL)));
    const doc = partes['word/document.xml']!;
    // 120 × 80 mm (36 000 EMU por mm), com o arredondamento de twips e pixels.
    const [, cx, cy] = /<wp:inline[^>]*><wp:extent cx="(\d+)" cy="(\d+)"\/>/.exec(doc)!;
    expect(Number(cx) / 36000).toBeCloseTo(120, 1);
    expect(Number(cy) / 36000).toBeCloseTo(80, 1);
    expect(doc).toContain('descr="Gráfico 1 – Vendas"');
    // A relação aponta para o PNG dentro de word/media.
    const embed = /r:embed="(rId\d+)"/.exec(doc)![1]!;
    expect(partes['word/_rels/document.xml.rels']).toMatch(new RegExp(`Id="${embed}"[^>]*Target="media/[^"]+\\.png"`));
  });
});

describe('janela da figura: só a figura válida vai para o texto', () => {
  it('sem imagem e sem título, os dois erros; largura fora do limite', () => {
    const v = validarFigura(rascunhoFiguraNova());
    expect(v.ok ? [] : v.erros.map((e) => e.campo)).toEqual(['Imagem', 'Título']);
    const w = validarFigura({ ...rascunhoFiguraNova(), midia: 'a'.repeat(64), titulo: { texto: 'T' }, larguraMm: 5 });
    expect(w.ok ? [] : w.erros).toEqual([{ campo: 'Largura', mensagem: 'use um número inteiro de 10 a 500 mm, ou deixe em branco' }]);
  });
  it('válida: espécie, título aparado, largura e fonte; nota vazia some', () => {
    const v = validarFigura({ ...rascunhoFiguraNova(), especie: 'mapa', midia: 'a'.repeat(64), titulo: { texto: ' Rios ' }, larguraMm: 80, fonte: { texto: 'IBGE (2020).' } });
    expect(v.ok && v.dados).toEqual({
      tipo: 'ilustracao',
      especie: 'mapa',
      titulo: [{ tipo: 'texto', texto: 'Rios' }],
      midia: 'a'.repeat(64),
      larguraMm: 80,
      fonte: [{ tipo: 'texto', texto: 'IBGE (2020).' }],
    });
  });
});
