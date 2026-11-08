// M6-T03: siglas são nós ligados ao cadastro; comandos, histórico e sugestões rodam em Node.
import { EditorState, NodeSelection, TextSelection, type Command } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import type { Sigla } from '../src/dominio/modelo';
import { desfazer, refazer } from '../src/interface/editor/comandos';
import { docParaSecao, normalizarConteudo, secaoParaDoc } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';
import { esquemaEditor } from '../src/interface/editor/esquema';
import { alterarSigla, inserirSigla, ligarSiglasEscritas, podeInserirSigla, siglaSelecionada, siglasEscritasNoDoc } from '../src/interface/editor/siglas';

const UFT: Sigla = { id: 'sig_cadastro0001', sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' };
const IBGE: Sigla = { id: 'sig_cadastro0002', sigla: 'IBGE', extenso: 'Instituto Brasileiro de Geografia e Estatística' };
const t = (texto: string) => ({ tipo: 'texto' as const, texto });
let n = 0;
const estado = (texto = 'A UFT, o IBGE e a UFT.') => criarEstadoSecao({ titulo: [t('Título UFT')], blocos: [{ tipo: 'paragrafo', id: 'par_siglas0001', conteudo: [t(texto)] }] }, { gerarId: (prefixo) => `${prefixo}_sigla${String(++n).padStart(10, '0')}` });
const selecionar = (s: EditorState, de: number, ate = de) => s.apply(s.tr.setSelection(TextSelection.create(s.doc, de, ate)));
const executar = (s: EditorState, c: Command) => {
  let novo = s;
  expect(c(s, (tr) => { novo = s.apply(tr); })).toBe(true);
  return novo;
};
const inicioCorpo = (s: EditorState) => s.doc.child(0).nodeSize + 1;

describe('sigla no esquema e conversão', () => {
  it('ida e volta preserva o id e o cadastro no texto e na nota', () => {
    const conteudo = { titulo: [t('Título')], blocos: [{ tipo: 'paragrafo' as const, id: 'par_siglas0001', conteudo: [
      t('A '), { tipo: 'sigla' as const, id: 'sig_inline0001', sigla: UFT.id },
      { tipo: 'nota' as const, id: 'nta_siglas0001', conteudo: [t('Ver '), { tipo: 'sigla' as const, id: 'sig_inline0002', sigla: IBGE.id }] },
    ] }] };
    const doc = secaoParaDoc(conteudo);
    expect(() => doc.check()).not.toThrow();
    expect(docParaSecao(doc)).toEqual(conteudo);
    expect(normalizarConteudo(conteudo.blocos[0]!.conteudo)).toEqual(conteudo.blocos[0]!.conteudo);
    const sigla = esquemaEditor.nodes['sigla']!.create({ id: 'sig_inline0003', sigla: UFT.id });
    expect(() => esquemaEditor.nodes['titulo']!.createChecked(null, [sigla])).toThrow();
    expect(() => esquemaEditor.nodes['equacao']!.createChecked({ id: 'eqc_siglas0001' }, [sigla])).toThrow();
  });
  it('o id do nó é independente do id do cadastro e pode repetir o cadastro', () => {
    let s = estado('');
    s = selecionar(s, inicioCorpo(s));
    s = executar(s, inserirSigla(UFT.id));
    s = executar(s, inserirSigla(UFT.id));
    const conteudo = docParaSecao(s.doc).blocos[0]!;
    if (conteudo.tipo !== 'paragrafo') throw new Error('parágrafo esperado');
    expect(conteudo.conteudo).toHaveLength(2);
    expect(new Set(conteudo.conteudo.map((i) => i.tipo === 'sigla' ? i.id : '')).size).toBe(2);
    expect(conteudo.conteudo.every((i) => i.tipo === 'sigla' && i.sigla === UFT.id)).toBe(true);
  });
});

describe('comandos e histórico', () => {
  it('inserir preserva a seleção de texto; alterar e desfazer/refazer mantêm vínculo e id', () => {
    let s = estado('abcd');
    const inicio = inicioCorpo(s);
    s = selecionar(s, inicio, inicio + 2);
    s = executar(s, inserirSigla(UFT.id));
    expect(s.doc.textContent).toContain('abcd');
    s = s.apply(s.tr.setSelection(NodeSelection.create(s.doc, inicio + 2)));
    const original = siglaSelecionada(s)!;
    expect(original.sigla).toBe(UFT.id);
    s = executar(s, alterarSigla(original.id, IBGE.id));
    expect(siglaSelecionada(s)).toMatchObject({ id: original.id, sigla: IBGE.id });
    s = executar(s, desfazer);
    expect(s.doc.nodeAt(inicio + 2)?.attrs['sigla']).toBe(UFT.id);
    s = executar(s, refazer);
    expect(s.doc.nodeAt(inicio + 2)?.attrs['sigla']).toBe(IBGE.id);
  });
  it('título não aceita inserir; nota aceita', () => {
    const s = selecionar(estado(), 1);
    expect(podeInserirSigla(s)).toBe(false);
    expect(inserirSigla(UFT.id)(s)).toBe(false);
    const nota = esquemaEditor.nodes['nota']!.create({ id: 'nta_siglas0001' }, esquemaEditor.text('Ver '));
    const interno = EditorState.create({ doc: nota });
    expect(podeInserirSigla(interno)).toBe(true);
    expect(inserirSigla(UFT.id)(interno)).toBe(true);
  });
});

describe('sugestão explícita de ligação', () => {
  it('detecta só palavras exatas do texto corrido e só nos blocos pedidos', () => {
    const s = estado('UFTX UFT; UFT. uft e IBGE');
    expect(siglasEscritasNoDoc(s.doc, [UFT, IBGE]).map((e) => e.texto)).toEqual(['UFT', 'UFT', 'IBGE']);
    expect(siglasEscritasNoDoc(s.doc, [UFT], new Set(['outro']))).toEqual([]);
    expect(siglasEscritasNoDoc(s.doc, [{ ...UFT, id: 'sig_duplicada01' }, UFT])).toEqual([]);
  });
  it('ligação só ocorre no comando de aceite e Ctrl+Z devolve o texto', () => {
    let s = estado();
    const antes = s.doc;
    const achadas = siglasEscritasNoDoc(s.doc, [UFT, IBGE]);
    expect(s.doc).toBe(antes);
    expect(achadas).toHaveLength(3);
    s = executar(s, ligarSiglasEscritas(achadas));
    expect(siglasEscritasNoDoc(s.doc, [UFT, IBGE])).toEqual([]);
    s = executar(s, desfazer);
    expect(s.doc).toEqual(antes);
  });
  it('texto alterado desde a sugestão não é substituído em posição antiga', () => {
    const s = estado();
    const achadas = siglasEscritasNoDoc(s.doc, [UFT]);
    const mudado = s.apply(s.tr.insertText('outro texto', achadas[0]!.de, achadas[0]!.ate));
    expect(ligarSiglasEscritas([achadas[0]!])(mudado)).toBe(false);
  });
  it('nós ligados interrompem palavras, e o número de sugestões é limitado', () => {
    let s = estado('UFT '.repeat(1000));
    expect(siglasEscritasNoDoc(s.doc, [UFT])).toHaveLength(200);
    s = selecionar(s, inicioCorpo(s));
    s = executar(s, inserirSigla(UFT.id));
    expect(siglasEscritasNoDoc(s.doc, [UFT])).toHaveLength(200);
  });
});

