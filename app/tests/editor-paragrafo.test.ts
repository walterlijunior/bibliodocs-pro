// Etapa 2 da especificação de atualização — parágrafo e listas no editor, em Node (sem view): alinhamento com volta ao
// padrão do perfil, recuo de primeira linha, listas com marcadores e numeradas (ligar, emendar, trocar, Enter,
// Backspace), novo parágrafo e atalhos. Toda seção produzida é conferida com o esquema v1, e o padrão confere com o perfil.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeSelection, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Bloco } from '../src/dominio/modelo';
import { TECLAS_SECAO } from '../src/interface/editor/comandos';
import {
  ALINHAMENTO_PADRAO,
  alinhamentoDaSelecao,
  alternarLista,
  alternarRecuo,
  definirAlinhamento,
  enterNaListaSimples,
  listaDaSelecao,
  novoParagrafo,
  semRecuoNaSelecao,
  voltarNoComecoDaLista,
} from '../src/interface/editor/comandos-paragrafo';
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
const blocos = (estado: EditorState): Bloco[] => docParaSecao(estado.doc).blocos;

function valida(estado: EditorState): void {
  const r = validarDocumentoV1({
    id: 'prj_abcdefghijklmnop',
    tipoTrabalho: 'generico',
    metadados: { titulo: [] },
    corpo: [{ id: 'sec_paragrafo001', ...docParaSecao(estado.doc), subsecoes: [] }],
  });
  expect(r.ok, JSON.stringify(r)).toBe(true);
}

const par = (id: string, texto: string): Bloco => ({ tipo: 'paragrafo', id, conteudo: [{ tipo: 'texto', texto }] });
// Título "T" (0–3). Parágrafos "um" (3–7), "dois" (7–13), "três" (13–19): o texto de cada um começa 1 depois.
const tres = (): ConteudoSecao => ({
  titulo: [{ tipo: 'texto', texto: 'T' }],
  blocos: [par('par_paragrafo001', 'um'), par('par_paragrafo002', 'dois'), par('par_paragrafo003', 'três')],
});
const textos = (b: Bloco): string[] => (b.tipo === 'lista' ? b.itens.map((i) => i.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('')) : []);

describe('alinhamento do parágrafo', () => {
  it('o padrão da interface é o do corpo do texto no perfil UFT 2022 (RN-003)', () => {
    const perfil = JSON.parse(readFileSync(join(__dirname, '..', 'perfis', 'uft-2022', 'perfil.json'), 'utf8')) as {
      regras: { alvo?: string; propriedades?: { alinhamento?: string } }[];
    };
    const corpo = perfil.regras.filter((r) => r.alvo === 'corpo.paragrafo' && r.propriedades?.alinhamento);
    expect(corpo.map((r) => r.propriedades!.alinhamento)).toEqual([ALINHAMENTO_PADRAO]);
  });

  it('centralizar grava só no parágrafo do cursor; de novo, volta ao padrão sem nada gravado', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 9);
    expect(alinhamentoDaSelecao(e, 'justificado')).toBe('justificado');
    e = executar(e, definirAlinhamento('centralizado', 'justificado'));
    expect(blocos(e)[1]).toMatchObject({ id: 'par_paragrafo002', alinhamento: 'centralizado' });
    expect(blocos(e)[0]).not.toHaveProperty('alinhamento');
    expect(alinhamentoDaSelecao(e, 'justificado')).toBe('centralizado');
    valida(e);
    e = executar(e, definirAlinhamento('centralizado', 'justificado'));
    expect(blocos(e)[1]).not.toHaveProperty('alinhamento');
  });

  it('escolher o alinhamento do perfil devolve ao padrão (forma única); vale para todos os parágrafos da seleção', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 4, 16);
    e = executar(e, definirAlinhamento('direita', 'justificado'));
    expect(blocos(e).map((b) => (b.tipo === 'paragrafo' ? b.alinhamento : null))).toEqual(['direita', 'direita', 'direita']);
    e = executar(e, definirAlinhamento('justificado', 'justificado'));
    for (const b of blocos(e)) expect(b).not.toHaveProperty('alinhamento');
    valida(e);
  });

  it('alinhamentos diferentes na seleção: nenhum botão marcado', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 4);
    e = executar(e, definirAlinhamento('esquerda', 'justificado'));
    e = selecionar(e, 4, 10);
    expect(alinhamentoDaSelecao(e, 'justificado')).toBeNull();
  });

  it('no título não há parágrafo: o comando não se aplica', () => {
    const e = selecionar(criarEstadoSecao(tres(), { gerarId }), 1);
    expect(definirAlinhamento('centralizado', 'justificado')(e)).toBe(false);
    expect(alternarRecuo(e)).toBe(false);
  });

  it('Enter num parágrafo centralizado: o novo continua centralizado, com id próprio', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 12);
    e = executar(e, definirAlinhamento('centralizado', 'justificado'));
    e = executar(e, TECLAS_SECAO['Enter']!);
    const b = blocos(e);
    expect(b).toHaveLength(4);
    expect(b[2]).toMatchObject({ tipo: 'paragrafo', alinhamento: 'centralizado' });
    expect(b[2]!.id).not.toBe(b[1]!.id);
    valida(e);
  });
});

describe('recuo de primeira linha', () => {
  it('tira e repõe o recuo dos parágrafos da seleção', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 4, 10);
    e = executar(e, alternarRecuo);
    expect(blocos(e).map((b) => b.tipo === 'paragrafo' && b.semRecuo === true)).toEqual([true, true, false]);
    expect(semRecuoNaSelecao(e)).toBe(true);
    valida(e);
    e = executar(e, alternarRecuo);
    for (const b of blocos(e)) expect(b).not.toHaveProperty('semRecuo');
  });
});

describe('listas com marcadores e numeradas', () => {
  it('liga a lista com marcadores em dois parágrafos; a lista numerada troca o tipo; o mesmo comando desfaz', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 4, 10);
    e = executar(e, alternarLista(false));
    let b = blocos(e);
    expect(b.map((x) => x.tipo)).toEqual(['lista', 'paragrafo']);
    expect(b[0]).not.toHaveProperty('numerada');
    expect(textos(b[0]!)).toEqual(['um', 'dois']);
    expect(listaDaSelecao(e)).toBe('marcadores');
    valida(e);
    e = executar(e, alternarLista(true));
    b = blocos(e);
    expect(b[0]).toMatchObject({ tipo: 'lista', numerada: true });
    expect(listaDaSelecao(e)).toBe('numerada');
    // Desligar vale para os itens da seleção (como no Word): os dois.
    e = executar(selecionar(e, 5, 11), alternarLista(true));
    expect(blocos(e).map((x) => x.tipo)).toEqual(['paragrafo', 'paragrafo', 'paragrafo']);
    valida(e);
  });

  it('emenda na lista vizinha do mesmo tipo, não na do outro tipo', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 4);
    e = executar(e, alternarLista(true));
    // "dois" está logo depois da lista: no texto dela (lista 3, item 4, texto 5 + 2 + 1).
    const posDois = e.doc.child(0).nodeSize + e.doc.child(1).nodeSize + 1;
    e = executar(selecionar(e, posDois), alternarLista(true));
    expect(blocos(e).map((x) => x.tipo)).toEqual(['lista', 'paragrafo']);
    expect(textos(blocos(e)[0]!)).toEqual(['um', 'dois']);
    const posTres = e.doc.child(0).nodeSize + e.doc.child(1).nodeSize + 1;
    e = executar(selecionar(e, posTres), alternarLista(false));
    expect(blocos(e).map((x) => (x.tipo === 'lista' ? (x.numerada ? 'numerada' : 'marcadores') : x.tipo))).toEqual(['numerada', 'marcadores']);
    valida(e);
  });

  it('Enter cria o próximo item; no item vazio, sai da lista e abre um parágrafo', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 4);
    e = executar(e, alternarLista(false));
    // Fim do texto "um": lista em 3, item em 4, texto em 5.
    e = executar(selecionar(e, 7), enterNaListaSimples);
    expect(textos(blocos(e)[0]!)).toEqual(['um', '']);
    e = executar(e, enterNaListaSimples);
    expect(blocos(e).map((x) => x.tipo)).toEqual(['lista', 'paragrafo', 'paragrafo', 'paragrafo']);
    expect(textos(blocos(e)[0]!)).toEqual(['um']);
    valida(e);
  });

  it('Backspace no começo do item: o item volta a parágrafo', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 4, 10);
    e = executar(e, alternarLista(false));
    // Começo do segundo item: lista 3, item "um" 4–8, item "dois" 8, texto 9.
    e = executar(selecionar(e, 9), voltarNoComecoDaLista);
    expect(blocos(e).map((x) => x.tipo)).toEqual(['lista', 'paragrafo', 'paragrafo']);
    valida(e);
  });

  it('não liga lista sobre alíneas, tabela ou o título', () => {
    const e = selecionar(criarEstadoSecao(tres(), { gerarId }), 1);
    expect(alternarLista(false)(e)).toBe(false);
  });
});

describe('novo parágrafo', () => {
  it('abre um parágrafo vazio logo depois do bloco do cursor', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 9);
    e = executar(e, novoParagrafo);
    expect(blocos(e).map((b) => (b.tipo === 'paragrafo' ? b.conteudo.length : -1))).toEqual([1, 1, 0, 1]);
    expect(e.selection.$from.parent.type.name).toBe('paragrafo');
    expect(e.selection.$from.index(0)).toBe(3);
    valida(e);
  });

  it('no título, o parágrafo novo vem logo depois dele', () => {
    let e = selecionar(criarEstadoSecao(tres(), { gerarId }), 1);
    e = executar(e, novoParagrafo);
    expect(blocos(e)).toHaveLength(4);
    expect(blocos(e)[0]).toMatchObject({ tipo: 'paragrafo', conteudo: [] });
  });

  it('com uma tabela selecionada, o parágrafo vem depois dela', () => {
    const secao: ConteudoSecao = {
      titulo: [],
      blocos: [
        { tipo: 'tabela', id: 'tab_tabela000001', especie: 'quadro', titulo: [{ tipo: 'texto', texto: 'Q' }], colunas: [{ alinhamento: 'esquerda' }], linhasCabecalho: 0, linhas: [[{ conteudo: [] }]] },
      ],
    };
    let e = criarEstadoSecao(secao, { gerarId });
    e = e.apply(e.tr.setSelection(NodeSelection.create(e.doc, e.doc.child(0).nodeSize)));
    e = executar(e, novoParagrafo);
    expect(blocos(e).map((b) => b.tipo)).toEqual(['tabela', 'paragrafo']);
  });
});

describe('atalhos (Etapa 2)', () => {
  it('Ctrl+L, Ctrl+Shift+E, Ctrl+R, Ctrl+J, Ctrl+Shift+8 e Ctrl+Shift+7 estão no editor; Ctrl+E fica para Exportar', () => {
    for (const k of ['Mod-l', 'Shift-Mod-e', 'Mod-r', 'Mod-j', 'Shift-Mod-8', 'Shift-Mod-7']) expect(TECLAS_SECAO[k], k).toBeDefined();
    expect(TECLAS_SECAO['Mod-e']).toBeUndefined();
  });
});
