// M2-T06 — comandos e estado do editor de seção, em Node (sem view): marcas que não entram na nota (achado M6 da
// revisão do M2-T05), nota inserida com id e selecionada, quebra de linha, desfazer/refazer e Enter com ids únicos.
// Toda seção produzida é conferida com o esquema v1 (R38).
import { splitBlock } from 'prosemirror-commands';
import { NodeSelection, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Bloco } from '../src/dominio/modelo';
import { chaveColagem, colarSemFormatacaoNaProxima } from '../src/interface/editor/colagem';
import { alternarMarca, faixasForaDasNotas, inserirNota, marcaAtiva, podeInserirNota, quebrarLinha, desfazer, refazer, TECLAS_SECAO } from '../src/interface/editor/comandos';
import { docParaSecao, type ConteudoSecao } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';

let contador = 0;
const gerarId = (prefixo: string) => `${prefixo}_teste${String(++contador).padStart(11, '0')}`;

const executar = (estado: EditorState, comando: Command): EditorState => {
  let saida = estado;
  expect(comando(estado, (tr) => (saida = estado.apply(tr)))).toBe(true);
  return saida;
};

const selecionar = (estado: EditorState, de: number, ate = de): EditorState =>
  estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, de, ate)));

function valida(secao: ConteudoSecao): void {
  const documento = {
    id: 'prj_abcdefghijklmnop',
    tipoTrabalho: 'generico',
    metadados: { titulo: [] },
    corpo: [{ id: 'sec_comandos0001', ...secao, subsecoes: [] }],
  };
  const r = validarDocumentoV1(documento);
  expect(r.ok, JSON.stringify(r)).toBe(true);
}

// Título "T" (posições 0–3); parágrafo a partir de 3: texto em 4. Com o título vazio, o texto começa em 3.
const comNota = (): ConteudoSecao => ({
  titulo: [{ tipo: 'texto', texto: 'T' }],
  blocos: [
    {
      tipo: 'paragrafo',
      id: 'par_paragrafo001',
      conteudo: [
        { tipo: 'texto', texto: 'antes' },
        { tipo: 'nota', id: 'nta_nota00000001', conteudo: [{ tipo: 'texto', texto: 'texto da nota' }] },
        { tipo: 'texto', texto: 'depois' },
      ],
    },
  ],
});

const blocos = (estado: EditorState): Bloco[] => docParaSecao(estado.doc).blocos;

describe('marcas sobre a nota (M6 da revisão do M2-T05)', () => {
  it('itálico numa seleção com nota: o texto em volta fica itálico; o da nota, não', () => {
    let e = criarEstadoSecao(comNota(), { gerarId });
    e = selecionar(e, 4, e.doc.child(1).nodeSize + 2);
    e = executar(e, alternarMarca('italico'));
    const secao = docParaSecao(e.doc);
    expect(secao.blocos[0]).toEqual({
      tipo: 'paragrafo',
      id: 'par_paragrafo001',
      conteudo: [
        { tipo: 'texto', texto: 'antes', marcas: ['italico'] },
        { tipo: 'nota', id: 'nta_nota00000001', conteudo: [{ tipo: 'texto', texto: 'texto da nota' }] },
        { tipo: 'texto', texto: 'depois', marcas: ['italico'] },
      ],
    });
    expect(marcaAtiva(e, 'italico')).toBe(true);
    valida(secao);
    // De novo: tira (a nota continua sem marca).
    e = executar(e, alternarMarca('italico'));
    expect(docParaSecao(e.doc)).toEqual(comNota());
  });

  it('faixasForaDasNotas corta só o conteúdo da nota', () => {
    const e = criarEstadoSecao(comNota(), { gerarId });
    // "antes" = 4..9; nota em 9 (conteúdo 10..23); "depois" a partir de 24.
    expect(faixasForaDasNotas(e.doc, 4, 30)).toEqual([
      { de: 4, ate: 10 },
      { de: 23, ate: 30 },
    ]);
  });

  it('sobrescrito e subscrito se excluem; sem seleção, a marca vale para o que se digita', () => {
    let e = criarEstadoSecao({ titulo: [], blocos: [{ tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto: 'H2O' }] }] }, { gerarId });
    e = selecionar(e, 4, 5);
    e = executar(e, alternarMarca('sobrescrito'));
    e = executar(e, alternarMarca('subscrito'));
    expect(blocos(e)[0]).toMatchObject({ conteudo: [{ texto: 'H' }, { texto: '2', marcas: ['subscrito'] }, { texto: 'O' }] });
    e = selecionar(e, 6);
    e = executar(e, alternarMarca('negrito'));
    expect(marcaAtiva(e, 'negrito')).toBe(true);
    e = e.apply(e.tr.insertText('!'));
    expect(blocos(e)[0]).toMatchObject({ conteudo: [{ texto: 'H' }, { texto: '2' }, { texto: 'O' }, { texto: '!', marcas: ['negrito'] }] });
  });
});

describe('nota de rodapé (M2-T06)', () => {
  it('Ctrl+Alt+F insere a nota vazia no cursor, com id novo, e a seleciona', () => {
    let e = criarEstadoSecao({ titulo: [], blocos: [{ tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto: 'ab' }] }] }, { gerarId });
    e = selecionar(e, 4);
    expect(TECLAS_SECAO['Mod-Alt-f']).toBe(inserirNota);
    e = executar(e, inserirNota);
    expect(e.selection).toBeInstanceOf(NodeSelection);
    expect((e.selection as NodeSelection).node.type.name).toBe('nota');
    const [bloco] = blocos(e);
    expect(bloco).toMatchObject({ conteudo: [{ texto: 'a' }, { tipo: 'nota', conteudo: [] }, { texto: 'b' }] });
    const nota = (bloco as { conteudo: { tipo: string; id?: string }[] }).conteudo[1]!;
    expect(nota.id).toMatch(/^nta_/);
    valida(docParaSecao(e.doc));
  });

  it('com texto selecionado, a nota vai para o fim da seleção e o texto fica (como no Word)', () => {
    let e = criarEstadoSecao({ titulo: [], blocos: [{ tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto: 'pequi cerrado' }] }] }, { gerarId });
    e = selecionar(e, 9, 16); // "cerrado"
    e = executar(e, inserirNota);
    expect(blocos(e)[0]).toMatchObject({ conteudo: [{ texto: 'pequi cerrado' }, { tipo: 'nota', conteudo: [] }] });
    expect((e.selection as NodeSelection).node.type.name).toBe('nota');
  });

  it('não insere nota no título', () => {
    const e = selecionar(criarEstadoSecao(comNota(), { gerarId }), 1);
    expect(podeInserirNota(e)).toBe(false);
    expect(inserirNota(e)).toBe(false);
  });
});

describe('quebra de linha, desfazer e Enter (M2-T06)', () => {
  it('Shift+Enter vira "\\n" no modelo', () => {
    let e = criarEstadoSecao({ titulo: [], blocos: [{ tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto: 'ab' }] }] }, { gerarId });
    e = executar(selecionar(e, 4), quebrarLinha);
    expect(blocos(e)).toEqual([{ tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto: 'a\nb' }] }]);
  });

  it('desfazer e refazer devolvem o modelo exato', () => {
    const inicial = comNota();
    let e = criarEstadoSecao(inicial, { gerarId });
    e = e.apply(e.tr.insertText('X', 4).setMeta('addToHistory', true));
    const editado = docParaSecao(e.doc);
    e = executar(e, desfazer);
    expect(docParaSecao(e.doc)).toEqual(inicial);
    e = executar(e, refazer);
    expect(docParaSecao(e.doc)).toEqual(editado);
  });

  it('Enter no meio do parágrafo: dois parágrafos, o id antigo fica com o começo e o novo é único', () => {
    let e = criarEstadoSecao(comNota(), { gerarId });
    e = executar(selecionar(e, 6), splitBlock);
    const [a, b] = blocos(e);
    expect(a!.id).toBe('par_paragrafo001');
    expect(b!.id).not.toBe(a!.id);
    expect(b!.id).toMatch(/^par_/);
    valida(docParaSecao(e.doc));
  });
});

describe('colar sem formatação pelo menu (B5)', () => {
  it('o plugin de colagem do estado expõe o pedido', () => {
    const e = criarEstadoSecao(comNota(), { gerarId });
    expect(chaveColagem.get(e)).toBeDefined();
    expect(() => colarSemFormatacaoNaProxima(e)).not.toThrow();
  });
});
