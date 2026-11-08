import { writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { aplicarCampos } from '../src/aplicacao/servicos/pre-textuais';
import { esquemaElementoPreTextual } from '../src/dominio/esquemas/projeto-v1';
import type { Bloco, BlocoIlustracao, Documento, ElementoPreTextual } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import type { BlocoFormatado, DocumentoFormatado } from '../src/dominio/normas/formatado';
import { exportarDocx } from '../src/exportacao/docx';
import { FIGURA_CORPUS, IMAGENS_CORPUS, QUADRO_CORPUS, TABELA_CORPUS, TABELA_LONGA_CORPUS } from './corpus/corpus';

const pre: ElementoPreTextual[] = [{ tipo: 'listaIlustracoes', id: 'pre_lista0001' }, { tipo: 'listaTabelas', id: 'pre_lista0002' }];
const figura = (n: number, especie: BlocoIlustracao['especie'] = 'figura'): BlocoIlustracao => ({ ...FIGURA_CORPUS, id: `ilu_lista${String(n).padStart(4, '0')}`, especie });
const doc = (blocos: Bloco[], preTextuais = pre): Pick<Documento, 'corpo' | 'preTextuais'> => ({
  preTextuais,
  corpo: [{ id: 'sec_lista0001', titulo: [{ tipo: 'texto', texto: 'Introdução' }], blocos, subsecoes: [] }],
});
const todos = (f: DocumentoFormatado) => f.secoes.flatMap((s) => s.blocos);
const listas = (f: DocumentoFormatado) => todos(f).filter((b): b is Extract<BlocoFormatado, { tipo: 'listaElementos' }> => b.tipo === 'listaElementos');
const texto = (t: readonly { tipo: string; texto?: string }[]) => t.map((x) => x.texto ?? '').join('');
const titulos = (f: DocumentoFormatado) => todos(f).flatMap((b) => b.tipo === 'paragrafo' && b.estilo === 'tituloSemIndicativo' ? [texto(b.trechos)] : []);

describe('M6-T01: listas do mesmo cálculo das legendas', () => {
  it('RN-160/163/309: ordem do texto, quadro nas ilustrações e cada tabela longa uma vez', () => {
    const f = formatar(doc([figura(1), TABELA_CORPUS, QUADRO_CORPUS, figura(2, 'grafico'), TABELA_LONGA_CORPUS]), PERFIL);
    expect(titulos(f)).toEqual(['LISTA DE ILUSTRAÇÕES', 'LISTA DE TABELAS']);
    expect(listas(f).map((l) => l.entradas.map((e) => texto(e.trechos)))).toEqual([
      ['Figura 1 – Degradê fictício de teste', 'Quadro 1 – Etapas fictícias do procedimento', 'Gráfico 1 – Degradê fictício de teste'],
      ['Tabela 1 – Produção fictícia por região, 2020–2022', 'Tabela 2 – Medições fictícias por amostra'],
    ]);
    const legendas = todos(f).filter((b) => b.tipo === 'paragrafo' && b.estilo === 'tituloElemento');
    for (const l of listas(f)) for (const e of l.entradas) expect(legendas).toContainEqual(expect.objectContaining({ ancora: e.ancora, trechos: e.trechos }));
  });
  it('RN-161: quatro figuras na geral; cinco em lista própria; resto mantém ordem', () => {
    expect(titulos(formatar(doc([1, 2, 3, 4].map((n) => figura(n))), PERFIL))).toEqual(['LISTA DE ILUSTRAÇÕES']);
    const f = formatar(doc([QUADRO_CORPUS, ...[1, 2, 3, 4, 5].map((n) => figura(n)), figura(6, 'mapa')]), PERFIL);
    expect(titulos(f)).toEqual(['LISTA DE ILUSTRAÇÕES', 'LISTA DE FIGURAS']);
    expect(listas(f).map((l) => l.entradas.length)).toEqual([2, 5]);
    expect(todos(f).filter((b) => b.tipo === 'paragrafo' && b.novaPagina)).toHaveLength(1);
  });
  it('C-B8: lista única mesmo com cinco figuras; opção validada e reversível', () => {
    const e = aplicarCampos(pre[0]!, { listaUnica: true });
    expect(esquemaElementoPreTextual.safeParse(e).success).toBe(true);
    expect(titulos(formatar(doc([1, 2, 3, 4, 5].map((n) => figura(n)), [e]), PERFIL))).toEqual(['LISTA DE ILUSTRAÇÕES']);
    expect(aplicarCampos(e, { listaUnica: false })).toEqual(pre[0]);
    expect(esquemaElementoPreTextual.safeParse({ ...e, listaUnica: false }).success).toBe(false);
    expect(esquemaElementoPreTextual.safeParse(pre[0]).success).toBe(true);
  });
  it('RN-162: estilo 12, 1,5 e justificado, cada propriedade com a RN', () => {
    const estilo = formatar(doc([]), PERFIL).estilos.find((e) => e.id === 'entradaLista')!;
    expect(estilo.propriedades).toMatchObject({ corpoMeioPt: 24, linha: 360, alinhamento: 'justificado' });
    for (const k of ['corpoMeioPt', 'linha', 'alinhamento'] as const) expect(estilo.origem[k]).toContain('RN-162');
    expect(estilo.propriedades.recuoPrimeiraLinhaTw).toBeUndefined();
  });
  it('RF-12: inserir, mover e excluir recalcula lista, sem dados derivados no projeto', () => {
    const a = figura(1); const b = { ...figura(2), titulo: [{ tipo: 'texto' as const, texto: 'Outra' }] };
    const entradas = (bs: Bloco[]) => listas(formatar(doc(bs), PERFIL))[0]!.entradas.map((e) => texto(e.trechos));
    expect(entradas([a])).toHaveLength(1);
    expect(entradas([b, a])).toEqual(['Figura 1 – Outra', 'Figura 2 – Degradê fictício de teste']);
    expect(entradas([a, b])[1]).toBe('Figura 2 – Outra');
    expect(entradas([b])).toEqual(['Figura 1 – Outra']);
  });
  it('lista opcional vazia ou retirada não é exportada', () => {
    expect(listas(formatar(doc([]), PERFIL))).toEqual([]);
    expect(listas(formatar(doc([figura(1)], []), PERFIL))).toEqual([]);
  });
  it('gráfico gerado e gráfico de imagem compartilham a lista própria e a numeração', () => {
    const grafico: Bloco = { tipo: 'grafico', id: 'gra_lista0001', tabela: TABELA_CORPUS.id, forma: 'colunas', series: [1], titulo: [{ tipo: 'texto', texto: 'Gerado' }] };
    const f = formatar(doc([TABELA_CORPUS, ...[1, 2, 3, 4].map((n) => figura(n, 'grafico')), grafico]), PERFIL);
    expect(titulos(f)).toEqual(['LISTA DE GRÁFICOS', 'LISTA DE TABELAS']);
    expect(texto(listas(f)[0]!.entradas[4]!.trechos)).toBe('Gráfico 5 – Gerado');
  });
  it('sem o procedimento no perfil, a lista correspondente não se aplica', () => {
    const p = { ...PERFIL, regras: PERFIL.regras.filter((r) => r.procedimento !== 'listaDeIlustracoes') };
    expect(titulos(formatar(doc([figura(1), TABELA_CORPUS]), p))).toEqual(['LISTA DE TABELAS']);
  });
});

describe('M6-T01: DOCX', () => {
  it('marcadores únicos, PAGEREF com página estimada mesmo sem sumário, tabulação pontilhada e XML válido', async () => {
    const d = doc([figura(1), { tipo: 'quebraPagina', id: 'q_lista0001' }, TABELA_CORPUS]);
    const f = formatar({ ...d, imagens: IMAGENS_CORPUS }, PERFIL);
    const bytes = await exportarDocx(f);
    if (process.env['SAIDA_LISTAS']) writeFileSync(process.env['SAIDA_LISTAS'], bytes);
    const z = unzipSync(bytes);
    for (const [nome, b] of Object.entries(z)) if (/\.xml$/.test(nome)) expect(XMLValidator.validate(strFromU8(b)), nome).toBe(true);
    const xml = strFromU8(z['word/document.xml']!);
    const campos = [...xml.matchAll(/<w:fldSimple w:instr="PAGEREF (_Lista_\d+) \\h">.*?<w:t[^>]*>(\d+)<\/w:t>.*?<\/w:fldSimple>/gs)];
    expect(campos).toHaveLength(2);
    expect(campos.map((m) => Number(m[2]))).toEqual([3, 4]);
    for (const m of campos) expect([...xml.matchAll(new RegExp(`w:name="${m[1]}"`, 'g'))]).toHaveLength(1);
    expect(xml).toMatch(/<w:tab [^>]*w:val="right"[^>]*w:leader="dot"/);
    const nomes = [...xml.matchAll(/w:name="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(nomes).size).toBe(nomes.length);
    expect(f.avisos.filter((a) => a.codigo === 'ELEMENTO_ADIADO')).toEqual([]);
  });
});
