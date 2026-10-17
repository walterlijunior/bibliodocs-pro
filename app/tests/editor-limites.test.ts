// M2-T05 — O editor nunca produz o que o formato v1 recusa (achados A1, A2 e M1 da revisão do `especialista-documento`):
// limites de quantidade, caracteres de controle digitados e ordem das regras de leitura do DOM.
import { DOMParser as DOMParserPm } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { LIMITES_V1, validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Bloco, Documento, Inline } from '../src/dominio/modelo';
import { blocosParaSlice, docParaSecao, secaoParaDoc, type ConteudoSecao } from '../src/interface/editor/conversao';
import { esquemaEditor } from '../src/interface/editor/esquema';
import { lerTextoColado } from '../src/interface/editor/html-colado';
import { pluginIdsUnicos } from '../src/interface/editor/plugins/ids-unicos';
import { excedeLimites, LIMITES_EDITOR, pluginLimites } from '../src/interface/editor/plugins/limites';

function sequencial(): (prefixo: string) => string {
  let n = 0;
  return (prefixo) => `${prefixo}_lim${String(++n).padStart(6, '0')}`;
}

const valida = (secao: ConteudoSecao): boolean => {
  const documento: Documento = {
    id: 'prj_limites001',
    tipoTrabalho: 'generico',
    metadados: { titulo: [] },
    corpo: [{ id: 'sec_limites001', ...secao, subsecoes: [] }],
  };
  return validarDocumentoV1(documento).ok;
};

const par = (id: string, conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
/** n trechos alternando itálico e normal (não se juntam). */
const alternados = (n: number): Inline[] =>
  Array.from({ length: n }, (_, i) => (i % 2 ? { tipo: 'texto', texto: 'x' } : { tipo: 'texto', texto: 'y', marcas: ['italico'] }));

const estado = (secao: ConteudoSecao) =>
  EditorState.create({ doc: secaoParaDoc(secao), plugins: [pluginLimites(), pluginIdsUnicos(sequencial())] });

describe('EDT — limites de quantidade do v1 no editor (A1)', () => {
  it('as cópias dos limites são iguais às do domínio', () => {
    expect(LIMITES_EDITOR).toEqual({
      inlinesPorConteudo: LIMITES_V1.inlinesPorConteudo,
      blocosPorSecao: LIMITES_V1.blocosPorSecao,
      itensPorAlineas: LIMITES_V1.itensPorAlineas,
      subalineasPorAlinea: LIMITES_V1.subalineasPorAlinea,
    });
  });

  it('no limite exato a seção é válida; um a mais é detectado e o v1 também recusaria', () => {
    const casos: [string, (n: number) => ConteudoSecao, number][] = [
      ['trechos', (n) => ({ titulo: [], blocos: [par('par_lim0000001', alternados(n))] }), LIMITES_V1.inlinesPorConteudo],
      ['trechos na nota', (n) => ({ titulo: [], blocos: [par('par_lim0000001', [{ tipo: 'nota', id: 'nta_lim0000001', conteudo: alternados(n) as never }])] }), LIMITES_V1.inlinesPorConteudo],
      ['blocos', (n) => ({ titulo: [], blocos: Array.from({ length: n }, (_, i) => ({ tipo: 'quebraPagina', id: `qbr_lim${String(i).padStart(6, '0')}` })) }), LIMITES_V1.blocosPorSecao],
      ['alíneas', (n) => ({ titulo: [], blocos: [{ tipo: 'alineas', id: 'aln_lim0000001', itens: Array.from({ length: n }, () => ({ conteudo: [] })) }] }), LIMITES_V1.itensPorAlineas],
      ['subalíneas', (n) => ({ titulo: [], blocos: [{ tipo: 'alineas', id: 'aln_lim0000001', itens: [{ conteudo: [], subalineas: Array.from({ length: n }, () => []) }] }] }), LIMITES_V1.subalineasPorAlinea],
      ['trechos do título', (n) => ({ titulo: alternados(n) as never, blocos: [] }), LIMITES_V1.inlinesPorConteudo],
    ];
    for (const [nome, montar, limite] of casos) {
      const noLimite = montar(limite);
      expect(excedeLimites(secaoParaDoc(noLimite)), `${nome} no limite`).toBe(false);
      expect(valida(docParaSecao(secaoParaDoc(noLimite))), `${nome} no limite`).toBe(true);
      const acima = montar(limite + 1);
      expect(excedeLimites(secaoParaDoc(acima)), `${nome} acima`).toBe(true);
      expect(valida(acima), `${nome} acima`).toBe(false);
    }
  });

  it('texto longo conta a divisão em trechos', () => {
    const longo = 'a'.repeat(3 * 100_000);
    const conteudo: Inline[] = [...alternados(LIMITES_V1.inlinesPorConteudo - 2), { tipo: 'texto', texto: longo, marcas: ['negrito'] }];
    const secao = { titulo: [], blocos: [par('par_lim0000001', conteudo)] };
    expect(excedeLimites(secaoParaDoc(secao))).toBe(true);
    expect(valida(docParaSecao(secaoParaDoc(secao)))).toBe(false);
  });

  it('a transação que passaria do limite é recusada; a seção fica como estava', () => {
    let s = estado({ titulo: [], blocos: [par('par_lim0000001', [{ tipo: 'texto', texto: 'a' }])] });
    const colado = lerTextoColado(Array.from({ length: LIMITES_V1.blocosPorSecao }, (_, i) => `p${i}`).join('\n\n'), sequencial());
    expect(colado.blocos).toHaveLength(LIMITES_V1.blocosPorSecao);
    const antes = s.doc;
    const r = s.applyTransaction(s.tr.replace(s.doc.content.size, s.doc.content.size, blocosParaSlice(colado.blocos)));
    expect(r.transactions).toHaveLength(0);
    s = r.state;
    expect(s.doc).toBe(antes);
    // Um bloco a menos cabe.
    const r2 = s.applyTransaction(s.tr.replace(s.doc.content.size, s.doc.content.size, blocosParaSlice(colado.blocos.slice(1))));
    expect(r2.transactions.length).toBeGreaterThan(0);
    expect(valida(docParaSecao(r2.state.doc))).toBe(true);
  });
});

describe('EDT — caracteres de controle digitados não chegam ao arquivo (A2)', () => {
  it('insertText com \\v, \\r, U+FFFE e substituto solto: a seção convertida é válida e sem eles', () => {
    let s = estado({ titulo: [], blocos: [par('par_lim0000001', [])] });
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 3)).insertText('a\u000bb\rc￾d\uD800e\tf'));
    const secao = docParaSecao(s.doc);
    expect(secao.blocos[0]).toEqual(par('par_lim0000001', [{ tipo: 'texto', texto: 'abcde\tf' }]));
    expect(valida(secao)).toBe(true);
    // Texto feito só de controle some, sem deixar trecho vazio.
    let t = estado({ titulo: [], blocos: [par('par_lim0000001', [])] });
    t = t.apply(t.tr.setSelection(TextSelection.create(t.doc, 3)).insertText('\u0001\u0002'));
    expect(docParaSecao(t.doc).blocos[0]).toEqual(par('par_lim0000001', []));
  });
});

describe('EDT — leitura do DOM ao digitar (M1)', () => {
  it('as regras de linha da alínea e de subalínea vêm antes da regra genérica de parágrafo', () => {
    const tags = DOMParserPm.fromSchema(esquemaEditor).rules.map((r) => ('tag' in r ? r.tag : undefined));
    const p = tags.indexOf('p');
    expect(p).toBeGreaterThanOrEqual(0);
    expect(tags.indexOf('p.bd-linha-alinea')).toBeLessThan(p);
    expect(tags.indexOf('p.bd-subalinea')).toBeLessThan(p);
  });
});
