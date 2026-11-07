// M4-T07 (RF-07) — citação no editor de seção, em Node (sem view): a chamada inserida é um nó ligado à obra por id, com
// id novo; alterar e retirar acham a chamada pelo id; tudo entra no histórico de texto (Ctrl+Z desfaz junto com o
// texto); o título não aceita citação; o texto colado com "(AUTOR, ano)" vira chamada ligada só com o aceite.
import { EditorState as Estado, NodeSelection, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { reconhecerChamadasEscritas, type DadosCitacao } from '../src/aplicacao';
import type { InlineCitacao, Obra } from '../src/dominio/modelo';
import {
  alterarCitacao,
  chamadaSelecionada,
  chamadasEscritasNoDoc,
  inserirCitacao,
  ligarChamadasEscritas,
  podeInserirCitacao,
  retirarCitacao,
} from '../src/interface/editor/citacoes';
import { desfazer, refazer } from '../src/interface/editor/comandos';
import { docParaSecao, type ConteudoSecao } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';

let contador = 0;
const gerarId = (prefixo: string) => `${prefixo}_teste${String(++contador).padStart(11, '0')}`;

const executar = (estado: EditorState, comando: Command): EditorState => {
  let saida = estado;
  expect(comando(estado, (tr) => (saida = estado.apply(tr)))).toBe(true);
  return saida;
};
const selecionar = (estado: EditorState, de: number, ate = de): EditorState => estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, de, ate)));

const cagliari: Obra = { id: 'obr_cagliari000001', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Cagliari', prenomes: 'Luiz' }], titulo: [{ tipo: 'texto', texto: 'A' }], ano: 2003 };
const candido: Obra = { id: 'obr_candido0000001', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Candido', prenomes: 'Antonio' }], titulo: [{ tipo: 'texto', texto: 'B' }], ano: 1993 };
const DADOS: DadosCitacao = { forma: 'parentetica', obras: [{ obra: cagliari.id, pagina: '12' }] };

// Título "T" (0–3); parágrafo a partir de 3: "Texto citado." começa em 4.
const secao = (texto = 'Texto citado.'): ConteudoSecao => ({
  titulo: [{ tipo: 'texto', texto: 'T' }],
  blocos: [{ tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto }] }],
});
const conteudo = (e: EditorState) => {
  const b = docParaSecao(e.doc).blocos[0]!;
  return b.tipo === 'paragrafo' ? b.conteudo : [];
};

describe('inserir, alterar e retirar a chamada', () => {
  it('insere no fim da seleção, com id novo, e o cursor fica depois da chamada', () => {
    let e = selecionar(criarEstadoSecao(secao(), { gerarId }), 4, 16); // "Texto citado" selecionado, sem o ponto
    e = executar(e, inserirCitacao(DADOS));
    const c = conteudo(e);
    expect(c.map((i) => i.tipo)).toEqual(['texto', 'citacao', 'texto']);
    const cit = c[1] as InlineCitacao;
    expect(cit).toEqual({ tipo: 'citacao', id: expect.stringMatching(/^cta_/), ...DADOS });
    expect(e.selection.from).toBe(17);
    expect(e.selection.empty).toBe(true);
  });

  it('o título não aceita citação; o parágrafo aceita', () => {
    const e = criarEstadoSecao(secao(), { gerarId });
    expect(podeInserirCitacao(selecionar(e, 2))).toBe(false);
    expect(inserirCitacao(DADOS)(selecionar(e, 2))).toBe(false);
    expect(podeInserirCitacao(selecionar(e, 6))).toBe(true);
  });

  it('alterar e retirar acham a chamada pelo id; a selecionada é reconhecida', () => {
    let e = executar(selecionar(criarEstadoSecao(secao(), { gerarId }), 9), inserirCitacao(DADOS));
    const id = (conteudo(e)[1] as InlineCitacao).id;
    const novos: DadosCitacao = { forma: 'narrativa', obras: [{ obra: candido.id, volume: '2' }], grifo: 'nosso' };
    e = executar(e, alterarCitacao(id, novos));
    expect(conteudo(e)[1]).toEqual({ tipo: 'citacao', id, ...novos });
    expect(chamadaSelecionada(e)).toEqual({ id, pos: 9, dados: novos });
    expect(chamadaSelecionada(selecionar(e, 5))).toBeNull();
    e = executar(e, retirarCitacao(id));
    expect(conteudo(e)).toEqual([{ tipo: 'texto', texto: 'Texto citado.' }]);
    expect(alterarCitacao(id, novos)(e)).toBe(false);
  });

  it('inserir, alterar e retirar entram no histórico de texto: Ctrl+Z desfaz, Ctrl+Y refaz', () => {
    let e = executar(selecionar(criarEstadoSecao(secao(), { gerarId }), 9), inserirCitacao(DADOS));
    const id = (conteudo(e)[1] as InlineCitacao).id;
    e = executar(e, alterarCitacao(id, { ...DADOS, forma: 'narrativa' }));
    e = executar(e, desfazer);
    expect((conteudo(e)[1] as InlineCitacao).forma).toBe('parentetica');
    e = executar(e, desfazer);
    expect(conteudo(e)).toEqual([{ tipo: 'texto', texto: 'Texto citado.' }]);
    e = executar(e, refazer);
    expect(conteudo(e)[1]).toEqual({ tipo: 'citacao', id, ...DADOS });
  });

  it('chamada selecionada por NodeSelection é a que Enter abre', () => {
    let e = executar(selecionar(criarEstadoSecao(secao(), { gerarId }), 9), inserirCitacao(DADOS));
    e = e.apply(e.tr.setSelection(NodeSelection.create(e.doc, 9)));
    expect(chamadaSelecionada(e)?.dados).toEqual(DADOS);
  });
});

describe('citação dentro da nota (M4-T07)', () => {
  it('o editor da nota (o nó da nota como documento) aceita a chamada, e ela volta ao modelo dentro da nota', () => {
    const s: ConteudoSecao = {
      titulo: [{ tipo: 'texto', texto: 'T' }],
      blocos: [{ tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto: 'A' }, { tipo: 'nota', id: 'nta_nota00000001', conteudo: [{ tipo: 'texto', texto: 'Ver ' }] }] }],
    };
    let e = criarEstadoSecao(s, { gerarId });
    const posNota = 5; // título 0–3, parágrafo em 3, "A" em 4, a nota em 5
    const nota = e.doc.nodeAt(posNota)!;
    expect(nota.type.name).toBe('nota');
    // O editor aninhado da nota: o próprio nó como documento, cursor no fim do texto.
    let interno = Estado.create({ doc: nota });
    interno = interno.apply(interno.tr.setSelection(TextSelection.create(interno.doc, interno.doc.content.size)));
    expect(podeInserirCitacao(interno)).toBe(true);
    const depois = executar(interno, inserirCitacao(DADOS));
    // O conteúdo novo da nota vai para a seção (o plugin de ids dá o id da chamada).
    e = e.apply(e.tr.replaceWith(posNota + 1, posNota + nota.nodeSize - 1, depois.doc.content));
    const c = conteudo(e);
    const n = c[1]!;
    expect(n.tipo === 'nota' && n.conteudo.map((i) => i.tipo)).toEqual(['texto', 'citacao']);
    expect(n.tipo === 'nota' && n.conteudo[1]).toEqual({ tipo: 'citacao', id: expect.stringMatching(/^cta_/), ...DADOS });
  });
});

describe('chamadas escritas no texto colado', () => {
  const reconhecer = (texto: string) => reconhecerChamadasEscritas(texto, [cagliari, candido]);

  it('acha as chamadas com as posições no documento, também entre trechos com marcas diferentes', () => {
    const s: ConteudoSecao = {
      titulo: [{ tipo: 'texto', texto: 'T' }],
      blocos: [
        {
          tipo: 'paragrafo',
          id: 'par_paragrafo001',
          conteudo: [
            { tipo: 'texto', texto: 'Diz ' },
            { tipo: 'texto', texto: 'Cagliari', marcas: ['italico'] },
            { tipo: 'texto', texto: ' (2003, p. 12) e ' },
            { tipo: 'nota', id: 'nta_nota00000001', conteudo: [{ tipo: 'texto', texto: '(CANDIDO, 1993)' }] },
            { tipo: 'texto', texto: ' (CANDIDO, 1993).' },
          ],
        },
      ],
    };
    const e = criarEstadoSecao(s, { gerarId });
    const achadas = chamadasEscritasNoDoc(e.doc, reconhecer);
    // A da nota não entra: a sugestão é só para o texto da seção.
    expect(achadas.map((c) => [c.texto, e.doc.textBetween(c.de, c.ate)])).toEqual([
      ['Cagliari (2003, p. 12)', 'Cagliari (2003, p. 12)'],
      ['(CANDIDO, 1993)', '(CANDIDO, 1993)'],
    ]);
    const ligado = executar(e, ligarChamadasEscritas(achadas));
    const c = conteudo(ligado);
    expect(c.filter((i) => i.tipo === 'citacao').map((i) => ({ ...i, id: '' }))).toEqual([
      { tipo: 'citacao', id: '', forma: 'narrativa', obras: [{ obra: cagliari.id, pagina: '12' }] },
      { tipo: 'citacao', id: '', forma: 'parentetica', obras: [{ obra: candido.id }] },
    ]);
    expect(c.at(-1)).toEqual({ tipo: 'texto', texto: '.' });
    // Um passo só: Ctrl+Z devolve o texto colado.
    expect(docParaSecao(executar(ligado, desfazer).doc)).toEqual(docParaSecao(e.doc));
  });

  it('sem chamada reconhecida, ligar não faz nada', () => {
    const e = criarEstadoSecao(secao('(SILVA, 2001)'), { gerarId });
    expect(chamadasEscritasNoDoc(e.doc, reconhecer)).toEqual([]);
    expect(ligarChamadasEscritas([])(e)).toBe(false);
  });
});
