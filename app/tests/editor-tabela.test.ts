// M5-T04 (RF-09) — tabela e quadro no editor de seção, em Node (sem view): a tabela inserida é um nó com id novo e o
// bloco em `dados`; ocupa o parágrafo vazio do cursor ou entra depois do bloco; alterar acha pelo id e mantém o id; tudo
// entra no histórico de texto (Ctrl+Z desfaz junto com o texto); o que sai para o modelo passa na validação do v1.
import { NodeSelection, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { dadosDoRascunho, rascunhoNovo, type DadosTabela } from '../src/aplicacao';
import { criarTrabalhoDoTipo } from '../src/aplicacao/servicos/criar-trabalho';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import { desfazer, refazer } from '../src/interface/editor/comandos';
import { docParaSecao, type ConteudoSecao } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';
import { alterarTabela, inserirTabela, tabelaSelecionada } from '../src/interface/editor/tabelas';
import { TABELA_CORPUS } from './corpus/corpus';

let contador = 0;
const gerarId = (prefixo: string) => `${prefixo}_teste${String(++contador).padStart(11, '0')}`;

const executar = (estado: EditorState, comando: Command): EditorState => {
  let saida = estado;
  expect(comando(estado, (tr) => (saida = estado.apply(tr)))).toBe(true);
  return saida;
};
const selecionar = (estado: EditorState, pos: number): EditorState => estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, pos)));

const { id: _id, ...DADOS } = TABELA_CORPUS;
const NOVA: DadosTabela = { ...dadosDoRascunho(rascunhoNovo('quadro')), titulo: [{ tipo: 'texto', texto: 'Novo' }] };

// Título "T" (0–3); "Antes." em 3–11; parágrafo vazio em 11–13; "Depois." em 13–22.
const secao = (): ConteudoSecao => ({
  titulo: [{ tipo: 'texto', texto: 'T' }],
  blocos: [
    { tipo: 'paragrafo', id: 'par_paragrafo001', conteudo: [{ tipo: 'texto', texto: 'Antes.' }] },
    { tipo: 'paragrafo', id: 'par_paragrafo002', conteudo: [] },
    { tipo: 'paragrafo', id: 'par_paragrafo003', conteudo: [{ tipo: 'texto', texto: 'Depois.' }] },
  ],
});
const tipos = (e: EditorState) => docParaSecao(e.doc).blocos.map((b) => b.tipo);

describe('inserir e alterar a tabela', () => {
  it('no parágrafo vazio, a tabela ocupa o lugar dele, com id novo, e fica selecionada', () => {
    let e = selecionar(criarEstadoSecao(secao(), { gerarId }), 12);
    e = executar(e, inserirTabela(DADOS));
    expect(tipos(e)).toEqual(['paragrafo', 'tabela', 'paragrafo']);
    const b = docParaSecao(e.doc).blocos[1]!;
    expect(b).toEqual({ ...DADOS, id: expect.stringMatching(/^tab_/) });
    expect(tabelaSelecionada(e)).toEqual({ id: b.id, dados: DADOS });
  });

  it('com texto no parágrafo, entra depois dele; no título, vira o primeiro bloco', () => {
    const e = criarEstadoSecao(secao(), { gerarId });
    expect(tipos(executar(selecionar(e, 6), inserirTabela(DADOS)))).toEqual(['paragrafo', 'tabela', 'paragrafo', 'paragrafo']);
    expect(tipos(executar(selecionar(e, 2), inserirTabela(DADOS)))).toEqual(['tabela', 'paragrafo', 'paragrafo', 'paragrafo']);
  });

  it('alterar troca os dados e mantém o id; id que não está na seção falha', () => {
    let e = executar(selecionar(criarEstadoSecao(secao(), { gerarId }), 12), inserirTabela(DADOS));
    const id = tabelaSelecionada(e)!.id;
    e = selecionar(e, 4);
    e = executar(e, alterarTabela(id, NOVA));
    expect(docParaSecao(e.doc).blocos[1]).toEqual({ ...NOVA, id });
    expect(e.selection instanceof NodeSelection).toBe(true);
    expect(alterarTabela('tab_naoexiste00001', NOVA)(e)).toBe(false);
  });

  it('sem tabela selecionada, a janela abre para uma nova', () => {
    expect(tabelaSelecionada(selecionar(criarEstadoSecao(secao(), { gerarId }), 4))).toBeNull();
  });
});

describe('Ctrl+Z junto com o texto', () => {
  it('desfazer tira a tabela e devolve o parágrafo vazio; refazer a põe de volta com o mesmo id', () => {
    const inicial = selecionar(criarEstadoSecao(secao(), { gerarId }), 12);
    const com = executar(inicial, inserirTabela(DADOS));
    const id = docParaSecao(com.doc).blocos[1]!.id;
    const sem = executar(com, desfazer);
    expect(docParaSecao(sem.doc)).toEqual(docParaSecao(inicial.doc));
    expect(docParaSecao(executar(sem, refazer).doc).blocos[1]!.id).toBe(id);
  });

  it('desfazer a alteração devolve a tabela de antes', () => {
    const com = executar(selecionar(criarEstadoSecao(secao(), { gerarId }), 12), inserirTabela(DADOS));
    const id = tabelaSelecionada(com)!.id;
    const alterada = executar(com, alterarTabela(id, NOVA));
    expect(docParaSecao(executar(alterada, desfazer).doc).blocos[1]).toEqual({ ...DADOS, id });
  });
});

describe('o que vai para o arquivo', () => {
  it('a seção com a tabela inserida passa na validação do formato v1', () => {
    const e = executar(selecionar(criarEstadoSecao(secao(), { gerarId }), 12), inserirTabela(NOVA));
    const s = docParaSecao(e.doc);
    let n = 0;
    const base = criarTrabalhoDoTipo({ id: 'prj_Tabela000001', agora: '2026-01-01T00:00:00.000Z', appVersao: '0.0.0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` }).documento;
    const doc = { ...base, corpo: [{ id: 'sec_teste0000000001', titulo: s.titulo, blocos: s.blocos, subsecoes: [] }] };
    const v = validarDocumentoV1(doc);
    expect(v.ok ? [] : v.erros).toEqual([]);
  });
});
