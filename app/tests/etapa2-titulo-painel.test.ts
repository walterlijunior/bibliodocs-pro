// Etapa 2 da especificação de atualização — título pelo painel Seções (D-E2-04): na página o título não se edita; o
// cursor que cai nele vai para o corpo; renomear pelo painel é um passo do histórico, que o desfazer volta.
import { TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { desfazer } from '../src/interface/editor/comandos';
import { docParaSecao } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';
import { renomearTitulo } from '../src/interface/editor/titulo-painel';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const executar = (e: EditorState, c: Command): EditorState => {
  let s = e;
  expect(c(e, (tr) => (s = e.apply(tr)))).toBe(true);
  return s;
};
const novo = (blocos = true) =>
  criarEstadoSecao({ titulo: [t('Introdução')], blocos: blocos ? [{ tipo: 'paragrafo', id: 'par_tp000000001', conteudo: [t('Corpo.')] }] : [] }, { tituloPeloPainel: true });

describe('título pelo painel Seções', () => {
  it('digitar no título não muda o título; o cursor no título vai para o começo do corpo', () => {
    const e = novo();
    const noTitulo = e.apply(e.tr.setSelection(TextSelection.create(e.doc, 3)));
    expect(noTitulo.selection.$from.parent.type.name).toBe('paragrafo');
    const tentativa = e.apply(e.tr.insertText('X', 3));
    expect(docParaSecao(tentativa.doc).titulo).toEqual([t('Introdução')]);
  });

  it('seção sem corpo nasce com um parágrafo vazio e o cursor nele; o documento não muda sozinho', () => {
    const e = novo(false);
    expect(e.doc.childCount).toBe(2);
    expect(e.selection.$from.parent.type.name).toBe('paragrafo');
    expect(docParaSecao(e.doc).titulo).toEqual([t('Introdução')]);
    const s = e.apply(e.tr.setSelection(TextSelection.create(e.doc, 1)));
    expect(s.doc.eq(e.doc)).toBe(true);
    expect(s.selection.$from.parent.type.name).toBe('paragrafo');
  });

  it('renomear pelo painel muda o título (espaços normalizados) e o desfazer volta', () => {
    const e = executar(novo(), renomearTitulo('  Introdução   e objetivos '));
    expect(docParaSecao(e.doc).titulo).toEqual([t('Introdução e objetivos')]);
    expect(docParaSecao(executar(e, desfazer).doc).titulo).toEqual([t('Introdução')]);
  });

  it('sem o plugin (núcleo do editor), o título continua editável como antes', () => {
    const e = criarEstadoSecao({ titulo: [t('A')], blocos: [] });
    expect(docParaSecao(e.apply(e.tr.insertText('B', 2)).doc).titulo).toEqual([t('AB')]);
  });
});
