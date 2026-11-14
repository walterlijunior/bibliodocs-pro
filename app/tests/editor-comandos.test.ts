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
import { alternarAlineas, alternarCitacaoLonga, enterNaLista, estaEmAlineas, estaEmCitacao, promoverSubalinea, recuarAlinea, voltarNoComeco } from '../src/interface/editor/comandos-blocos';
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

describe('Enter no título da seção (achado do primeiro CI)', () => {
  // Título "Introdução" (texto de 1 a 11); um parágrafo "Texto." depois dele.
  const comTitulo = (): ConteudoSecao => ({
    titulo: [{ tipo: 'texto', texto: 'Introdução' }],
    blocos: [{ tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto: 'Texto.' }] }],
  });
  const enter = TECLAS_SECAO['Enter']!;

  it.each([
    ['no começo', 1],
    ['no meio', 6],
    ['no fim', 11],
  ])('%s: o título fica inteiro e um parágrafo vazio entra logo depois, com o cursor nele', (_nome, pos) => {
    let e = selecionar(criarEstadoSecao(comTitulo(), { gerarId }), pos);
    e = executar(e, enter);
    const secao = docParaSecao(e.doc);
    expect(secao.titulo).toEqual([{ tipo: 'texto', texto: 'Introdução' }]);
    expect(secao.blocos.map((b) => b.tipo)).toEqual(['paragrafo', 'paragrafo']);
    expect(secao.blocos[0]!.id).toMatch(/^par_/);
    expect(secao.blocos[0]!.id).not.toBe('par_paragrafo001');
    expect(secao.blocos[1]!.id).toBe('par_paragrafo001');
    expect(e.selection.empty).toBe(true);
    expect(e.selection.$from.parent.type.name).toBe('paragrafo');
    expect(e.selection.$from.index(0)).toBe(1);
    valida(secao);
  });

  it('com trecho do título selecionado: o trecho sai e o resto do título fica', () => {
    let e = selecionar(criarEstadoSecao(comTitulo(), { gerarId }), 1, 6);
    e = executar(e, enter);
    expect(docParaSecao(e.doc).titulo).toEqual([{ tipo: 'texto', texto: 'dução' }]);
    expect(e.selection.$from.parent.type.name).toBe('paragrafo');
  });

  it('seleção do título até o texto: não é com ele (segue o Enter padrão)', () => {
    const e = selecionar(criarEstadoSecao(comTitulo(), { gerarId }), 6, 15);
    expect(enter(e)).toBe(false);
  });
});

describe('colar sem formatação pelo menu (B5)', () => {
  it('o plugin de colagem do estado expõe o pedido', () => {
    const e = criarEstadoSecao(comNota(), { gerarId });
    expect(chaveColagem.get(e)).toBeDefined();
    expect(() => colarSemFormatacaoNaProxima(e)).not.toThrow();
  });
});

describe('alíneas e citação longa (M2-T13; RF-03)', () => {
  const secao = (...textos: string[]): ConteudoSecao => ({
    id: 'sec_abcdefghijklmnop',
    titulo: [{ tipo: 'texto', texto: 'T' }],
    blocos: textos.map((t, i) => ({ tipo: 'paragrafo', id: `par_abcdefghijklmn${String(i).padStart(2, '0')}`, conteudo: t === '' ? [] : [{ tipo: 'texto', texto: t }] })),
  }) as ConteudoSecao;
  const estado = (...textos: string[]): EditorState => criarEstadoSecao(secao(...textos), { gerarId });
  /** Cursor no texto do bloco `i`, `desloc` caracteres depois do começo. */
  const noBloco = (e: EditorState, i: number, desloc = 0): EditorState => {
    let pos = 0;
    for (let k = 0; k <= i; k++) pos += e.doc.child(k).nodeSize;
    return selecionar(e, pos + 1 + desloc);
  };
  const conferir = (e: EditorState): Bloco[] => {
    const s = docParaSecao(e.doc);
    valida(s);
    return s.blocos;
  };
  const itens = (b: Bloco | undefined) => (b as Extract<Bloco, { tipo: 'alineas' }>).itens;
  const texto = (conteudo: readonly unknown[]) => (conteudo as { texto?: string }[]).map((x) => x.texto ?? '').join('');
  const descrever = (b: Bloco | undefined) => itens(b).map((i) => [texto(i.conteudo), ...(i.subalineas ?? []).map((s) => texto(s))]);

  it('parágrafo vira alínea com o texto e o cursor no lugar; de novo, volta a parágrafo', () => {
    let e = noBloco(estado('um'), 0, 1);
    e = executar(e, alternarAlineas);
    expect(descrever(conferir(e)[0])).toEqual([['um']]);
    expect(e.selection.$from.parentOffset).toBe(1);
    expect(estaEmAlineas(e)).toBe(true);
    e = executar(e, alternarAlineas);
    const [p] = conferir(e);
    expect(p!.tipo).toBe('paragrafo');
    expect(e.selection.$from.parentOffset).toBe(1);
  });

  it('seleção de dois parágrafos vira duas alíneas, e o seguinte emenda na lista anterior', () => {
    let e = estado('um', 'dois', 'três');
    const fim = e.doc.child(0).nodeSize + e.doc.child(1).nodeSize + e.doc.child(2).nodeSize - 2;
    e = selecionar(e, e.doc.child(0).nodeSize + 1, fim);
    e = executar(e, alternarAlineas);
    expect(descrever(conferir(e)[0])).toEqual([['um'], ['dois']]);
    e = noBloco(e, 1, 0); // a lista é o bloco 0, e o parágrafo restante, o 1
    e = executar(e, alternarAlineas);
    const blocos = conferir(e);
    expect(blocos).toHaveLength(1);
    expect(descrever(blocos[0])).toEqual([['um'], ['dois'], ['três']]);
  });

  it('Enter cria a próxima; na alínea vazia sai da lista; no meio, divide', () => {
    let e = noBloco(estado('umdois'), 0, 2);
    e = executar(e, alternarAlineas);
    e = executar(e, enterNaLista);
    expect(descrever(conferir(e)[0])).toEqual([['um'], ['dois']]);
    expect(e.selection.$from.parentOffset).toBe(0);
    e = executar(e, alternarAlineas); // "dois" sai da lista
    e = executar(e, alternarAlineas); // e volta
    expect(descrever(conferir(e)[0])).toEqual([['um'], ['dois']]);
    const fimDoItem = e.selection.$from.end();
    e = selecionar(e, fimDoItem);
    e = executar(e, enterNaLista);
    expect(descrever(conferir(e)[0])).toEqual([['um'], ['dois'], ['']]);
    e = executar(e, enterNaLista);
    const blocos = conferir(e);
    expect(blocos.map((b) => b.tipo)).toEqual(['alineas', 'paragrafo']);
  });

  it('Tab vira subalínea da anterior; a primeira não recua; um nível só; Shift+Tab volta', () => {
    let e = noBloco(estado('um', 'dois', 'três'), 0);
    const fim = e.doc.content.size - 2;
    e = selecionar(e, e.doc.child(0).nodeSize + 1, fim);
    e = executar(e, alternarAlineas);
    // Primeira alínea: Tab não muda nada, e o foco não sai.
    let p = e.doc.child(0).nodeSize + 3;
    e = selecionar(e, p);
    const antes = e.doc;
    e = executar(e, recuarAlinea);
    expect(e.doc.eq(antes)).toBe(true);
    // Segunda alínea.
    p += e.doc.child(1).child(0).nodeSize;
    e = selecionar(e, p);
    e = executar(e, recuarAlinea);
    expect(descrever(conferir(e)[0])).toEqual([['um', 'dois'], ['três']]);
    expect(e.selection.$from.parent.type.name).toBe('subalinea');
    // Subalínea: Tab não aprofunda.
    const naSub = e.doc;
    e = executar(e, recuarAlinea);
    expect(e.doc.eq(naSub)).toBe(true);
    e = executar(e, promoverSubalinea);
    expect(descrever(conferir(e)[0])).toEqual([['um'], ['dois'], ['três']]);
    expect(e.selection.$from.parent.type.name).toBe('linhaAlinea');
  });

  it('recuar leva as subalíneas junto; promover deixa as seguintes com a nova alínea', () => {
    let e = estado('a', 'b', 'c', 'd');
    e = selecionar(e, e.doc.child(0).nodeSize + 1, e.doc.content.size - 2);
    e = executar(e, alternarAlineas);
    const pos = (item: number) => {
      let p = e.doc.child(0).nodeSize + 1;
      for (let i = 0; i < item; i++) p += e.doc.child(1).child(i).nodeSize;
      return p + 2;
    };
    e = selecionar(e, pos(2));
    e = executar(e, recuarAlinea); // c é sub de b
    e = selecionar(e, pos(1));
    e = executar(e, recuarAlinea); // b e c são subs de a
    expect(descrever(conferir(e)[0])).toEqual([['a', 'b', 'c'], ['d']]);
    const noB = e.doc.child(0).nodeSize + 1 + 1 + e.doc.child(1).child(0).child(0).nodeSize + 1;
    e = selecionar(e, noB);
    e = executar(e, promoverSubalinea);
    expect(descrever(conferir(e)[0])).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('sair de uma alínea do meio divide a lista; Backspace no começo faz o mesmo', () => {
    let e = estado('a', 'b', 'c');
    e = selecionar(e, e.doc.child(0).nodeSize + 1, e.doc.content.size - 2);
    e = executar(e, alternarAlineas);
    const noB = e.doc.child(0).nodeSize + 1 + e.doc.child(1).child(0).nodeSize + 2;
    e = selecionar(e, noB);
    e = executar(e, voltarNoComeco);
    expect(conferir(e).map((b) => b.tipo)).toEqual(['alineas', 'paragrafo', 'alineas']);
  });

  it('citação longa liga e desliga mantendo o id; Backspace no começo volta a parágrafo', () => {
    let e = noBloco(estado('um'), 0, 1);
    const id = conferir(e)[0]!.id;
    e = executar(e, alternarCitacaoLonga);
    expect(conferir(e)[0]).toMatchObject({ tipo: 'citacaoLonga', id });
    expect(estaEmCitacao(e)).toBe(true);
    e = executar(e, alternarCitacaoLonga);
    expect(conferir(e)[0]).toMatchObject({ tipo: 'paragrafo', id });
    e = executar(noBloco(e, 0), alternarCitacaoLonga);
    e = executar(e, voltarNoComeco);
    expect(conferir(e)[0]!.tipo).toBe('paragrafo');
  });

  it('no título nada acontece; fora da lista Tab, Enter e Backspace ficam com o padrão', () => {
    const e = selecionar(estado('um'), 1);
    expect(alternarAlineas(e)).toBe(false);
    expect(alternarCitacaoLonga(e)).toBe(false);
    // Seleção do título até o parágrafo também não: o título não muda de tipo.
    const juntos = selecionar(estado('um'), 1, e.doc.content.size - 2);
    expect(alternarAlineas(juntos)).toBe(false);
    expect(alternarCitacaoLonga(juntos)).toBe(false);
    const p = noBloco(estado('um'), 0);
    expect(recuarAlinea(p)).toBe(false);
    expect(promoverSubalinea(p)).toBe(false);
    expect(enterNaLista(p)).toBe(false);
    expect(voltarNoComeco(p)).toBe(false);
  });

  it('a nota e as marcas passam intactas para a alínea, e desfazer devolve o parágrafo', () => {
    let e = selecionar(criarEstadoSecao(comNota(), { gerarId }), 2);
    const antes = conferir(e);
    e = noBloco(e, 0, 0);
    e = executar(e, alternarAlineas);
    const notas = JSON.stringify(conferir(e)).match(/"nota"/g) ?? [];
    expect(notas.length).toBe((JSON.stringify(antes).match(/"nota"/g) ?? []).length);
    e = executar(e, desfazer);
    expect(conferir(e)).toEqual(antes);
  });
});
