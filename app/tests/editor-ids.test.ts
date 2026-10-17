// M2-T05 — Ids únicos no editor (ADR-0007, seção 2; adendo do M2-T04; R38). Transações reais do ProseMirror
// (`EditorState.apply`, sem view): dividir, colar cópias, criar nó. Depois de cada uma, a seção convertida tem ids
// únicos e passa no `validarDocumentoV1`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitBlock } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { EditorState, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import { idsDoBloco, type Bloco, type Documento } from '../src/dominio/modelo';
import { blocosParaSlice, docParaSecao, secaoParaDoc, type ConteudoSecao } from '../src/interface/editor/conversao';
import { esquemaEditor } from '../src/interface/editor/esquema';
import { gerarId, PADRAO_ID_EDITOR } from '../src/interface/editor/ids';
import { corrigirIds, pluginIdsUnicos } from '../src/interface/editor/plugins/ids-unicos';

const documentoBordas = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'projeto-v1', 'documento-bordas-m2.json'), 'utf8'),
) as Documento;

/** Gerador determinístico para os testes. */
function sequencial(): (prefixo: string) => string {
  let n = 0;
  return (prefixo) => `${prefixo}_novo${String(++n).padStart(4, '0')}`;
}

const par = (id: string, texto: string): Bloco => ({ tipo: 'paragrafo', id, conteudo: [{ tipo: 'texto', texto }] });

function estado(secao: ConteudoSecao, gerar = sequencial()): EditorState {
  return EditorState.create({ doc: secaoParaDoc(secao), plugins: [history(), pluginIdsUnicos(gerar)] });
}

function executar(s: EditorState, comando: Command): EditorState {
  let proximo = s;
  const ok = comando(s, (tr: Transaction) => {
    proximo = s.apply(tr);
  });
  expect(ok).toBe(true);
  return proximo;
}

/** Converte, confere ids únicos e valida a seção dentro de um documento. */
function conferir(s: EditorState): ConteudoSecao {
  s.doc.check();
  const secao = docParaSecao(s.doc);
  const ids = secao.blocos.flatMap(idsDoBloco);
  expect(new Set(ids).size, `ids repetidos: ${ids.join(', ')}`).toBe(ids.length);
  const documento: Documento = {
    id: 'prj_idsUnicos1',
    tipoTrabalho: 'generico',
    metadados: { titulo: [] },
    corpo: [{ id: 'sec_idsUnicos1', ...secao, subsecoes: [] }],
  };
  const r = validarDocumentoV1(documento);
  expect(r.ok, r.ok ? '' : JSON.stringify(r.erros)).toBe(true);
  return secao;
}

/** Posição dentro do texto do bloco `indice` (0 = título). */
const dentroDoBloco = (s: EditorState, indice: number, deslocamento: number): number => {
  let pos = 0;
  for (let i = 0; i < indice; i++) pos += s.doc.child(i).nodeSize;
  return pos + 1 + deslocamento;
};

describe('EDT — ids únicos depois de dividir', () => {
  it('Enter no meio do parágrafo: a primeira parte fica com o id, a segunda ganha id novo', () => {
    let s = estado({ titulo: [], blocos: [par('par_original01', 'antes depois')] });
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, dentroDoBloco(s, 1, 6))));
    s = executar(s, splitBlock);
    const secao = conferir(s);
    expect(secao.blocos.map((b) => b.id)).toEqual(['par_original01', 'par_novo0001']);
    expect(secao.blocos.map((b) => (b.tipo === 'paragrafo' && b.conteudo[0]?.tipo === 'texto' ? b.conteudo[0].texto : ''))).toEqual(['antes ', 'depois']);
  });

  it('Enter no começo do parágrafo: o parágrafo vazio novo vem antes e o original mantém o id', () => {
    let s = estado({ titulo: [], blocos: [par('par_original01', 'texto')] });
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, dentroDoBloco(s, 1, 0))));
    s = executar(s, splitBlock);
    const secao = conferir(s);
    expect(secao.blocos.map((b) => b.id)).toEqual(['par_novo0001', 'par_original01']);
  });

  it('desfazer e refazer a divisão mantêm ids únicos e o original', () => {
    let s = estado({ titulo: [], blocos: [par('par_original01', 'antes depois')] });
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, dentroDoBloco(s, 1, 6))));
    s = executar(s, splitBlock);
    s = executar(s, undo);
    expect(conferir(s).blocos.map((b) => b.id)).toEqual(['par_original01']);
    s = executar(s, redo);
    expect(conferir(s).blocos.map((b) => b.id)).toEqual(['par_original01', 'par_novo0001']);
  });
});

describe('EDT — ids únicos depois de colar cópias', () => {
  const secaoBordas = documentoBordas.corpo[0]!;

  it('colar uma cópia dos blocos (com as notas) antes do original: o original mantém os ids', () => {
    let s = estado({ titulo: secaoBordas.titulo, blocos: secaoBordas.blocos });
    const originais = secaoBordas.blocos.flatMap(idsDoBloco);
    const copia = blocosParaSlice(secaoBordas.blocos);
    const inicio = s.doc.child(0).nodeSize;
    s = s.apply(s.tr.replace(inicio, inicio, copia));
    const secao = conferir(s);
    const depois = secao.blocos.flatMap(idsDoBloco);
    expect(depois.slice(-originais.length)).toEqual(originais);
    expect(depois.slice(0, depois.length - originais.length).every((id) => id.includes('_novo'))).toBe(true);
  });

  it('colar a mesma cópia duas vezes no fim: cada cópia ganha ids próprios', () => {
    const blocos: Bloco[] = [
      { tipo: 'paragrafo', id: 'par_original01', conteudo: [{ tipo: 'nota', id: 'nta_original01', conteudo: [] }] },
    ];
    let s = estado({ titulo: [], blocos });
    for (let i = 0; i < 2; i++) s = s.apply(s.tr.replace(s.doc.content.size, s.doc.content.size, blocosParaSlice(blocos)));
    const ids = conferir(s).blocos.flatMap(idsDoBloco);
    expect(ids.slice(0, 2)).toEqual(['par_original01', 'nta_original01']);
    expect(ids).toHaveLength(6);
  });

  it('nó criado sem id recebe um id no formato do esquema', () => {
    let s = estado({ titulo: [], blocos: [] }, gerarId);
    const quebra = esquemaEditor.nodes['quebraPagina']!.create();
    const nota = esquemaEditor.nodes['nota']!.create(null, esquemaEditor.text('n'));
    const p = esquemaEditor.nodes['paragrafo']!.create(null, [esquemaEditor.text('a'), nota]);
    s = s.apply(s.tr.insert(s.doc.content.size, [quebra, p]));
    const secao = conferir(s);
    const ids = secao.blocos.flatMap(idsDoBloco);
    expect(ids).toHaveLength(3);
    for (const id of ids) expect(id).toMatch(PADRAO_ID_EDITOR);
    expect(ids.map((id) => id.slice(0, 4))).toEqual(['qbr_', 'par_', 'nta_']);
  });

  it('corrigirIds sem histórico mantém a primeira ocorrência; com tudo certo, não cria transação', () => {
    const blocos = [par('par_repetido1', 'a'), par('par_repetido1', 'b')];
    const s = EditorState.create({ doc: secaoParaDoc({ titulo: [], blocos }) });
    const tr = corrigirIds(s, sequencial());
    expect(docParaSecao(s.apply(tr!).doc).blocos.map((b) => b.id)).toEqual(['par_repetido1', 'par_novo0001']);
    expect(corrigirIds(s.apply(tr!), sequencial())).toBeNull();
  });

  it('a transação que não muda o documento não passa pelo plugin', () => {
    const s = estado({ titulo: [], blocos: [par('par_original01', 'x')] });
    const tr = s.tr.setSelection(TextSelection.create(s.doc, 2));
    const r = s.applyTransaction(tr);
    expect(r.transactions).toHaveLength(1);
  });
});

describe('EDT — colar no título', () => {
  it('parágrafos colados no título: o primeiro entra no título, os outros viram blocos; tudo válido', () => {
    let s = estado({ titulo: [{ tipo: 'texto', texto: 'Título' }], blocos: [] });
    const fatia = blocosParaSlice([
      { tipo: 'paragrafo', id: 'par_colado001', conteudo: [{ tipo: 'texto', texto: ' colado' }, { tipo: 'nota', id: 'nta_colado001', conteudo: [] }] },
      par('par_colado002', 'segundo'),
    ]);
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 7)).replaceSelection(fatia));
    const secao = conferir(s);
    expect(secao.titulo.every((i) => i.tipo === 'texto')).toBe(true);
    expect(secao.titulo.map((i) => i.texto).join('')).toContain('Título colado');
  });
});
