// M2-T07 — estrutura das seções: subir, descer e soltar junto de outra seção no domínio (RF-03); `HistoricoEdicao`;
// sequências de desfazer que misturam texto (estado do editor em Node, sem view) e estrutura (ADR-0007, seção 4); e as
// regras puras da árvore da aba Escrever (seção ativa, teclas, lado de soltar).
import { closeHistory, isHistoryTransaction, redo, undo, undoDepth } from 'prosemirror-history';
import type { EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import {
  criarTrabalhoVazio,
  HistoricoEdicao,
  resumirSecoes,
  SessaoTrabalho,
  type PacoteTransferivel,
  type ResumoSecao,
} from '../src/aplicacao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import {
  aplicarOperacaoSecao,
  MENSAGENS_RECUSA_SECAO,
  moverJuntoDe,
  moverParaBaixo,
  moverParaCima,
  type Id,
  type ResultadoOperacaoSecao,
  type Secao,
} from '../src/dominio/modelo';
import { numerarSecoes } from '../src/dominio/numeracao';
import { docParaSecao } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';
import { destinoTeclaArvore, escolhaDe, ladoDoSoltar, resolverAtiva, secaoVizinha } from '../src/interface/escrever/secoes';

const s = (id: Id, ...subsecoes: Secao[]): Secao => ({ id, titulo: [{ tipo: 'texto', texto: id }], blocos: [], subsecoes });
const numeros = (corpo: readonly Secao[]) => numerarSecoes(corpo).map((n) => `${n.indicativo} ${n.secao.id}`);

function aceito(r: ResultadoOperacaoSecao): Extract<ResultadoOperacaoSecao, { ok: true }> {
  if (!r.ok) throw new Error(`recusado: ${r.codigo}`);
  return r;
}

// 1 [1.1, 1.2] · 2 [2.1] · 3
const arvore = (): Secao[] => [s('a', s('a1'), s('a2')), s('b', s('b1')), s('c')];

describe('subir e descer sem mudar de nível (M2-T07)', () => {
  it('troca com a irmã; a primeira sobe para a seção anterior à mãe e a última desce para a seguinte', () => {
    const corpo = arvore();
    expect(numeros(aceito(moverParaCima(corpo, 'a2')).corpo)).toEqual(['1 a', '1.1 a2', '1.2 a1', '2 b', '2.1 b1', '3 c']);
    expect(numeros(aceito(moverParaCima(corpo, 'b1')).corpo)).toEqual(['1 a', '1.1 a1', '1.2 a2', '1.3 b1', '2 b', '3 c']);
    expect(numeros(aceito(moverParaBaixo(corpo, 'a2')).corpo)).toEqual(['1 a', '1.1 a1', '2 b', '2.1 a2', '2.2 b1', '3 c']);
    expect(numeros(aceito(moverParaBaixo(corpo, 'a')).corpo)).toEqual(['1 b', '1.1 b1', '2 a', '2.1 a1', '2.2 a2', '3 c']);
    expect(numeros(aceito(moverParaCima(corpo, 'c')).corpo)).toEqual(['1 a', '1.1 a1', '1.2 a2', '2 c', '3 b', '3.1 b1']);
  });

  it('nas pontas recusa com mensagem; a entrada não muda; o inverso desfaz', () => {
    const corpo = arvore();
    const antes = JSON.stringify(corpo);
    expect(moverParaCima(corpo, 'a')).toEqual({ ok: false, codigo: 'JA_PRIMEIRA', mensagem: MENSAGENS_RECUSA_SECAO.JA_PRIMEIRA });
    expect(moverParaCima(corpo, 'a1')).toMatchObject({ ok: false, codigo: 'JA_PRIMEIRA' }); // a mãe não tem anterior
    expect(moverParaBaixo(corpo, 'c')).toMatchObject({ ok: false, codigo: 'JA_ULTIMA' });
    expect(moverParaBaixo([s('p', s('q'))], 'q')).toMatchObject({ ok: false, codigo: 'JA_ULTIMA' }); // a mãe não tem seguinte
    expect(numeros(aceito(moverParaBaixo(corpo, 'b1')).corpo)).toEqual(['1 a', '1.1 a1', '1.2 a2', '2 b', '3 c', '3.1 b1']);
    expect(moverParaCima(corpo, 'x')).toMatchObject({ ok: false, codigo: 'SECAO_INEXISTENTE' });
    expect(JSON.stringify(corpo)).toBe(antes);
    const r = aceito(moverParaCima(corpo, 'b1'));
    expect(aceito(aplicarOperacaoSecao(r.corpo, r.inverso)).corpo).toEqual(corpo);
  });
});

describe('soltar junto de outra seção (arrastar, M2-T07)', () => {
  it('antes ou depois do alvo, como irmã dele, contando as posições sem a seção movida', () => {
    const corpo = arvore();
    expect(numeros(aceito(moverJuntoDe(corpo, 'c', 'a', 'antes')).corpo)).toEqual(['1 c', '2 a', '2.1 a1', '2.2 a2', '3 b', '3.1 b1']);
    expect(numeros(aceito(moverJuntoDe(corpo, 'a', 'b', 'depois')).corpo)).toEqual(['1 b', '1.1 b1', '2 a', '2.1 a1', '2.2 a2', '3 c']);
    expect(numeros(aceito(moverJuntoDe(corpo, 'a1', 'a2', 'depois')).corpo)).toEqual(['1 a', '1.1 a2', '1.2 a1', '2 b', '2.1 b1', '3 c']);
    // Muda de nível: c vira subseção de b, logo antes de b1.
    expect(numeros(aceito(moverJuntoDe(corpo, 'c', 'b1', 'antes')).corpo)).toEqual(['1 a', '1.1 a1', '1.2 a2', '2 b', '2.1 c', '2.2 b1']);
  });

  it('sobre ela mesma não muda; dentro dela mesma e alvo inexistente são recusados', () => {
    const corpo = arvore();
    expect(aceito(moverJuntoDe(corpo, 'b', 'b', 'depois')).mudou).toBe(false);
    expect(moverJuntoDe(corpo, 'a', 'a1', 'depois')).toMatchObject({ ok: false, codigo: 'DESTINO_DENTRO_DA_PROPRIA' });
    expect(moverJuntoDe(corpo, 'a', 'zz', 'antes')).toMatchObject({ ok: false, codigo: 'DESTINO_INEXISTENTE' });
  });
});

describe('HistoricoEdicao (M2-T07)', () => {
  it('linear: registrar esvazia o refazer; concluir passa a contrária para a outra pilha; descartar só tira', () => {
    const h = new HistoricoEdicao();
    expect(h.topo('desfazer')).toBeUndefined();
    h.registrar({ tipo: 'texto', secaoId: 'a' });
    h.registrar({ tipo: 'texto', secaoId: 'b' });
    expect(h.topo('desfazer')).toEqual({ tipo: 'texto', secaoId: 'b' });
    h.concluir('desfazer', { tipo: 'texto', secaoId: 'b' });
    expect(h.podeRefazer).toBe(true);
    expect(h.topo('refazer')).toEqual({ tipo: 'texto', secaoId: 'b' });
    h.descartar('desfazer');
    expect(h.podeDesfazer).toBe(false);
    h.registrar({ tipo: 'texto', secaoId: 'c' });
    expect(h.podeRefazer).toBe(false);
    h.limpar();
    expect(h.podeDesfazer).toBe(false);
  });

  it('guarda o inverso como recebeu (mesmo objeto) e corta as mais antigas no limite', () => {
    const h = new HistoricoEdicao(3);
    const inverso = { tipo: 'remover', id: 'a' } as const;
    h.registrar({ tipo: 'estrutura', inverso });
    for (const id of ['b', 'c', 'd']) h.registrar({ tipo: 'texto', secaoId: id });
    const ids: string[] = [];
    for (let e = h.topo('desfazer'); e !== undefined; e = h.topo('desfazer')) {
      ids.push(e.tipo === 'texto' ? e.secaoId : 'estrutura');
      h.descartar('desfazer');
    }
    expect(ids).toEqual(['d', 'c', 'b']);
    const h2 = new HistoricoEdicao();
    h2.registrar({ tipo: 'estrutura', inverso });
    const topo = h2.topo('desfazer');
    expect(topo?.tipo === 'estrutura' && topo.inverso).toBe(inverso);
  });
});

// ---------- sequências com o estado do editor (o que a interface faz, sem view) ----------

let contador = 0;
const gerarId = (prefixo: string) => `${prefixo}_seq${String(++contador).padStart(13, '0')}`;

const corpoSequencia = (): Secao[] => [
  { id: 'sec_secaoum00001', titulo: [{ tipo: 'texto', texto: 'Um' }], blocos: [], subsecoes: [] },
  { id: 'sec_secaodois001', titulo: [{ tipo: 'texto', texto: 'Dois' }], blocos: [], subsecoes: [] },
  { id: 'sec_secaotres001', titulo: [{ tipo: 'texto', texto: 'Três' }], blocos: [], subsecoes: [] },
];

function pacote(corpo: Secao[]): PacoteTransferivel {
  const t = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-10-17T10:00:00.000Z', appVersao: '0.1.0' });
  return { ...t, documento: { ...t.documento, corpo }, midias: [] };
}

/** A sessão e os estados dos editores das seções visitadas (o papel de `MemoriaEditores` e do `EditorSecao`). */
function simulador() {
  const ids = ['sec_secaonova001', 'sec_secaonova002'];
  const sessao = new SessaoTrabalho({
    api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => {} },
    agora: () => new Date(Date.UTC(2026, 9, 17, 13)),
    agendar: () => () => {},
    gerarIdSecao: () => ids.shift()!,
  });
  sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote: pacote(corpoSequencia()), avisos: [], atualizacao: null });
  const estados = new Map<Id, EditorState>();
  const estado = (id: Id) => estados.get(id) ?? criarEstadoSecao(sessao.secao(id)!, { gerarId });

  /** Digita no começo do título: um evento novo no histórico de texto da seção. */
  const digitar = (id: Id, texto: string) => {
    const antes = estado(id);
    const tr = closeHistory(antes.tr.insertText(texto, 1));
    const depois = antes.apply(tr);
    estados.set(id, depois);
    sessao.alterarSecao(id, docParaSecao(depois.doc));
    if (!isHistoryTransaction(tr) && undoDepth(depois) !== undoDepth(antes)) sessao.registrarTexto(id);
  };

  const aplicarTexto = (id: Id, sentido: 'desfazer' | 'refazer'): boolean => {
    const antes = estados.get(id);
    if (antes === undefined) return false;
    let depois: EditorState | null = null;
    if (!(sentido === 'desfazer' ? undo : redo)(antes, (tr) => (depois = antes.apply(tr)))) return false;
    estados.set(id, depois!);
    sessao.alterarSecao(id, docParaSecao(depois!.doc));
    return true;
  };

  const titulos = () => sessao.obterEstado().trabalho!.secoes.map((x) => `${x.indicativo} ${x.titulo}`);
  return { sessao, digitar, aplicarTexto, titulos, corpo: () => sessao.pacote!.documento.corpo };
}

describe('sequências de desfazer: texto e estrutura numa ordem só (ADR-0007, seção 4)', () => {
  it('digitar em 1, mover 3 para antes de 2, digitar em 3, desfazer três vezes → documento inicial; refazer volta', () => {
    const x = simulador();
    const inicial = x.corpo();
    x.digitar('sec_secaoum00001', 'A');
    x.sessao.operarSecao('acima', 'sec_secaotres001');
    x.digitar('sec_secaotres001', 'B');
    const final = x.corpo();
    expect(x.titulos()).toEqual(['1 AUm', '2 BTrês', '3 Dois']);

    expect(x.sessao.desfazer(x.aplicarTexto)).toMatchObject({ ok: true, secaoId: 'sec_secaotres001' });
    expect(x.titulos()).toEqual(['1 AUm', '2 Três', '3 Dois']);
    expect(x.sessao.desfazer(x.aplicarTexto)).toMatchObject({ ok: true, secaoId: 'sec_secaotres001' });
    expect(x.titulos()).toEqual(['1 AUm', '2 Dois', '3 Três']);
    expect(x.sessao.desfazer(x.aplicarTexto)).toMatchObject({ ok: true, secaoId: 'sec_secaoum00001' });
    expect(x.corpo()).toEqual(inicial);
    expect(x.sessao.desfazer(x.aplicarTexto).ok).toBe(false);

    for (let i = 0; i < 3; i++) expect(x.sessao.refazer(x.aplicarTexto).ok).toBe(true);
    expect(x.corpo()).toEqual(final);
    expect(validarDocumentoV1(x.sessao.pacote!.documento).ok).toBe(true);
  });

  it('excluir uma seção com texto e desfazer: ela volta com o texto e o histórico dele', () => {
    const x = simulador();
    x.digitar('sec_secaodois001', 'X');
    x.sessao.operarSecao('excluir', 'sec_secaodois001');
    expect(x.titulos()).toEqual(['1 Um', '2 Três']);
    expect(x.sessao.desfazer(x.aplicarTexto)).toMatchObject({ ok: true, secaoId: 'sec_secaodois001' });
    expect(x.titulos()).toEqual(['1 Um', '2 XDois', '3 Três']);
    // O passo de texto anterior à exclusão continua desfazível.
    x.sessao.desfazer(x.aplicarTexto);
    expect(x.titulos()).toEqual(['1 Um', '2 Dois', '3 Três']);
  });

  it('nova seção, digitar nela e desfazer tudo: o texto sai primeiro, depois a seção', () => {
    const x = simulador();
    x.sessao.novaSecao('sec_secaoum00001');
    x.digitar('sec_secaonova001', 'Nova');
    expect(x.titulos()).toEqual(['1 Um', '2 Nova', '3 Dois', '4 Três']);
    expect(x.sessao.desfazer(x.aplicarTexto)).toMatchObject({ secaoId: 'sec_secaonova001' });
    expect(x.titulos()).toEqual(['1 Um', '2 ', '3 Dois', '4 Três']);
    expect(x.sessao.desfazer(x.aplicarTexto)).toMatchObject({ ok: true, secaoId: null });
    expect(x.titulos()).toEqual(['1 Um', '2 Dois', '3 Três']);
  });

  it('promover e recuar também se desfazem pelo inverso (renumeração recalculada, nunca gravada)', () => {
    const x = simulador();
    x.sessao.operarSecao('recuar', 'sec_secaodois001');
    x.sessao.operarSecao('recuar', 'sec_secaotres001');
    expect(x.titulos()).toEqual(['1 Um', '1.1 Dois', '1.2 Três']);
    x.sessao.operarSecao('promover', 'sec_secaodois001');
    expect(x.titulos()).toEqual(['1 Um', '2 Dois', '2.1 Três']);
    for (let i = 0; i < 3; i++) x.sessao.desfazer(x.aplicarTexto);
    expect(x.corpo()).toEqual(corpoSequencia());
  });
});

// ---------- regras da árvore na interface ----------

const resumo = (): ResumoSecao[] => resumirSecoes(arvore());

describe('árvore de seções: seção ativa, teclas e soltar (M2-T07)', () => {
  it('a ativa é a escolhida; se ela some, a seguinte que ficou; senão a anterior; outro trabalho volta à primeira', () => {
    const lista = resumo(); // a, a1, a2, b, b1, c
    const escolha = escolhaDe(lista, 'a2', 1);
    expect(escolha.vizinhas).toEqual(['b', 'b1', 'c', 'a1', 'a']);
    expect(resolverAtiva(lista, escolha, 1)?.id).toBe('a2');
    expect(resolverAtiva(lista.filter((x) => x.id !== 'a2'), escolha, 1)?.id).toBe('b');
    expect(resolverAtiva(lista.filter((x) => !['a2', 'b', 'b1', 'c'].includes(x.id)), escolha, 1)?.id).toBe('a1');
    expect(resolverAtiva(lista, escolha, 2)?.id).toBe('a');
    expect(resolverAtiva([], escolha, 1)).toBeNull();
    expect(resolverAtiva(lista, null, 1)?.id).toBe('a');
  });

  it('anterior e seguinte na ordem de leitura (barra superior)', () => {
    const lista = resumo();
    expect(secaoVizinha(lista, 'a2', 1)?.id).toBe('b');
    expect(secaoVizinha(lista, 'b', -1)?.id).toBe('a2');
    expect(secaoVizinha(lista, 'a', -1)).toBeNull();
    expect(secaoVizinha(lista, 'c', 1)).toBeNull();
    expect(secaoVizinha(lista, null, 1)).toBeNull();
  });

  it('setas, Home, End; esquerda vai à mãe e direita à primeira subseção', () => {
    const lista = resumo(); // 0 a, 1 a1, 2 a2, 3 b, 4 b1, 5 c
    expect(destinoTeclaArvore(lista, 2, 'ArrowDown')).toBe(3);
    expect(destinoTeclaArvore(lista, 0, 'ArrowUp')).toBeNull();
    expect(destinoTeclaArvore(lista, 5, 'ArrowDown')).toBeNull();
    expect(destinoTeclaArvore(lista, 3, 'Home')).toBe(0);
    expect(destinoTeclaArvore(lista, 0, 'End')).toBe(5);
    expect(destinoTeclaArvore(lista, 2, 'ArrowLeft')).toBe(0);
    expect(destinoTeclaArvore(lista, 0, 'ArrowLeft')).toBeNull();
    expect(destinoTeclaArvore(lista, 3, 'ArrowRight')).toBe(4);
    expect(destinoTeclaArvore(lista, 5, 'ArrowRight')).toBeNull();
    expect(destinoTeclaArvore(lista, 1, 'a')).toBeNull();
  });

  it('nível, posição e irmãs para o leitor de tela', () => {
    const b1 = resumo().find((x) => x.id === 'b1')!;
    expect(b1).toMatchObject({ indicativo: '2.1', nivel: 2, posicao: 1, irmas: 1, paiId: 'b' });
  });

  it('metade de cima põe antes; de baixo, depois', () => {
    expect(ladoDoSoltar(104, 100, 20)).toBe('antes');
    expect(ladoDoSoltar(110, 100, 20)).toBe('depois');
  });
});
