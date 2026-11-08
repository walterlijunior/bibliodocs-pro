// M5-T04: rascunho da tabela no editor (grade completa), operações de linha, coluna e mesclagem, sinais convencionais e
// validação. A volta ao modelo é sempre conferida pela validação do formato v1.
import { describe, expect, it } from 'vitest';
import {
  alterarCelula,
  dadosDoRascunho,
  excluirColuna,
  excluirLinha,
  explicarSinaisNaNota,
  inserirColuna,
  inserirLinha,
  mesclar,
  mudarCabecalho,
  notaDeSinais,
  rascunhoDe,
  rascunhoNovo,
  separar,
  validarTabela,
  type DadosTabela,
  type RascunhoTabela,
  type ResultadoOperacao,
} from '../src/aplicacao';
import { problemaNaGrade, type CelulaTabela } from '../src/dominio/modelo';
import { TABELA_CORPUS } from './corpus/corpus';

const ok = (r: ResultadoOperacao): RascunhoTabela => {
  if (!r.ok) throw new Error(r.motivo);
  return r.rascunho;
};
const recusa = (r: ResultadoOperacao): string => (r.ok ? 'aceita' : r.motivo);
const { id: _id, ...DADOS_CORPUS } = TABELA_CORPUS;
const textos = (d: DadosTabela) => d.linhas.map((l) => l.map((c) => c.conteudo.map((i) => i.texto).join('')));
const forma = (d: DadosTabela) => d.linhas.map((l) => l.map((c) => [c.colunas ?? 1, c.linhas ?? 1]));
/** Rascunho com os textos dados e um título, para a validação passar. */
function preenchido(linhas: string[][], extra: Partial<RascunhoTabela> = {}): RascunhoTabela {
  let r: RascunhoTabela = { ...rascunhoNovo('tabela'), titulo: { texto: 'Título' }, ...extra };
  r = { ...r, alinhamentos: linhas[0]!.map(() => 'esquerda' as const), grade: linhas.map((l) => l.map((texto) => ({ campo: { texto }, colunas: 1, linhas: 1 }))) };
  return r;
}
const valida = (r: RascunhoTabela): DadosTabela => {
  const v = validarTabela(r);
  if (!v.ok) throw new Error(v.erros.map((e) => `${e.campo}: ${e.mensagem}`).join('; '));
  expect(problemaNaGrade(v.dados)).toBeNull();
  return v.dados;
};

describe('rascunho ↔ modelo', () => {
  it('ida e volta sem mudar nada devolve a tabela igual, com as marcas', () => {
    const comMarca: DadosTabela = {
      ...DADOS_CORPUS,
      titulo: [{ tipo: 'texto', texto: 'Espécie ' }, { tipo: 'texto', texto: 'Bos taurus', marcas: ['italico'] }],
    };
    expect(dadosDoRascunho(rascunhoDe(comMarca))).toEqual(comMarca);
    expect(dadosDoRascunho(rascunhoDe(DADOS_CORPUS))).toEqual(DADOS_CORPUS);
  });
  it('a grade completa marca as posições cobertas com null', () => {
    const r = rascunhoDe(DADOS_CORPUS);
    expect(r.grade.map((l) => l.map((c) => (c === null ? '·' : c.campo.texto)))).toEqual([
      ['Região', 'Produção (t)', '·', '·'],
      ['·', '2020', '2021', '2022'],
      ['Norte (1)', '1.234,5', '1.300,0', '1.410,2'],
      ['Nordeste', '2.100,0', '–', '2.250,7'],
      ['Sul', '987,1', '1.002,3', '...'],
      ['·', '45,0', '46,2', '47,9'],
    ]);
  });
  it('texto alterado perde as marcas e é aparado; campo vazio some', () => {
    const r = rascunhoDe({ ...DADOS_CORPUS, titulo: [{ tipo: 'texto', texto: 'X', marcas: ['negrito'] }] });
    const d = dadosDoRascunho({ ...r, titulo: { ...r.titulo, texto: '  Novo título ' }, fonte: { texto: '   ' } });
    expect(d.titulo).toEqual([{ tipo: 'texto', texto: 'Novo título' }]);
    expect(d.fonte).toBeUndefined();
  });
  it('tabela nova: três colunas, números à direita (P-C4), uma linha de cabeçalho; quadro com duas colunas de texto', () => {
    expect(rascunhoNovo('tabela').alinhamentos).toEqual(['esquerda', 'direita', 'direita']);
    expect(rascunhoNovo('tabela').linhasCabecalho).toBe(1);
    expect(rascunhoNovo('quadro').alinhamentos).toEqual(['esquerda', 'esquerda']);
  });
});

describe('sinais convencionais (RN-263, RN-264, RN-265)', () => {
  it('a célula só com hífen grava a meia-risca; "…" volta a "..."; número negativo fica', () => {
    const d = valida(preenchido([['A', 'B'], ['-', '…'], ['-0,5', 'x']]));
    expect(textos(d)).toEqual([['A', 'B'], ['–', '...'], ['-0,5', 'x']]);
  });
  it('nota geral: um sinal no singular, vários no plural, na ordem da RN-263; cabeçalho não conta', () => {
    expect(notaDeSinais(preenchido([['-', 'A'], ['1', '2']], { linhasCabecalho: 1 }))).toBeNull();
    expect(notaDeSinais(preenchido([['A', 'B'], ['-', '2']]))).toBe('Sinal convencional utilizado:\n– Dado numérico igual a zero não resultante de arredondamento.');
    expect(notaDeSinais(preenchido([['A', 'B'], ['...', '-'], ['x', '..']]))).toBe(
      [
        'Sinais convencionais utilizados:',
        '– Dado numérico igual a zero não resultante de arredondamento.',
        '.. Não se aplica dado numérico.',
        '... Dado numérico não disponível.',
        'X Dado numérico omitido a fim de evitar a individualização da informação.',
      ].join('\n'),
    );
  });
  it('explicar na nota acrescenta ao que já está e não repete', () => {
    const r = preenchido([['A', 'B'], ['-', '2']], { nota: { texto: 'Dados sujeitos a retificação.' } });
    const uma = explicarSinaisNaNota(r);
    expect(uma.nota.texto).toBe('Dados sujeitos a retificação.\nSinal convencional utilizado:\n– Dado numérico igual a zero não resultante de arredondamento.');
    expect(explicarSinaisNaNota(uma)).toBe(uma);
    expect(valida(uma).nota).toEqual([{ tipo: 'texto', texto: uma.nota.texto }]);
  });
});

describe('linhas e colunas', () => {
  const base = () => rascunhoDe(DADOS_CORPUS);

  it('inserir linha no corpo: vazia; a mesclada que atravessa o ponto cresce (Sul)', () => {
    const d = valida(ok(inserirLinha(base(), 5)));
    expect(d.linhas).toHaveLength(7);
    expect(d.linhas[4]![0]).toMatchObject({ linhas: 3 });
    expect(forma(d)[5]).toEqual([[1, 1], [1, 1], [1, 1]]);
  });
  it('inserir linha no cabeçalho aumenta o cabeçalho; logo depois dele, não', () => {
    expect(ok(inserirLinha(base(), 1)).linhasCabecalho).toBe(3);
    expect(valida(ok(inserirLinha(base(), 1))).linhas[0]![0]).toMatchObject({ linhas: 3 });
    expect(ok(inserirLinha(base(), 2)).linhasCabecalho).toBe(2);
    expect(ok(inserirLinha(base(), 0)).linhasCabecalho).toBe(3);
  });
  it('excluir a linha onde a mesclada começa: ela desce, com o texto, e encolhe', () => {
    const d = valida(ok(excluirLinha(base(), 4)));
    expect(textos(d)[4]).toEqual(['Sul', '45,0', '46,2', '47,9']);
    expect(d.linhas[4]![0]!.linhas).toBeUndefined();
  });
  it('excluir linha coberta encolhe a mesclada de cima; excluir no cabeçalho diminui o cabeçalho', () => {
    const r = ok(excluirLinha(base(), 1));
    expect(r.linhasCabecalho).toBe(1);
    const d = valida(r);
    expect(d.linhas[0]).toEqual([{ conteudo: [{ tipo: 'texto', texto: 'Região' }] }, { conteudo: [{ tipo: 'texto', texto: 'Produção (t)' }], colunas: 3 }]);
  });
  it('a última linha e a última coluna não saem', () => {
    const uma = preenchido([['A']]);
    expect(recusa(excluirLinha(uma, 0))).toBe('a tabela precisa de pelo menos uma linha');
    expect(recusa(excluirColuna(uma, 0))).toBe('a tabela precisa de pelo menos uma coluna');
  });
  it('inserir coluna: alinhamento da vizinha; a mesclada que atravessa cresce', () => {
    const r = ok(inserirColuna(base(), 2));
    expect(r.alinhamentos).toEqual(['esquerda', 'direita', 'direita', 'direita', 'direita']);
    const d = valida(r);
    expect(d.linhas[0]![1]).toMatchObject({ colunas: 4 });
    expect(ok(inserirColuna(base(), 0)).alinhamentos[0]).toBe('esquerda');
  });
  it('excluir coluna onde a mesclada começa: ela passa para a direita e encolhe', () => {
    const d = valida(ok(excluirColuna(base(), 1)));
    expect(textos(d)[0]).toEqual(['Região', 'Produção (t)']);
    expect(d.linhas[0]![1]).toMatchObject({ colunas: 2 });
    expect(d.colunas).toHaveLength(3);
  });
  it('limite de colunas do Word (63)', () => {
    const r = preenchido([Array.from({ length: 63 }, () => 'a')]);
    expect(recusa(inserirColuna(r, 0))).toBe('a tabela já tem o máximo de 63 colunas');
  });
});

describe('mesclar e separar', () => {
  const g = () => preenchido([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']], { linhasCabecalho: 0 });

  it('mesclar à direita junta o texto e a grade continua válida', () => {
    const d = valida(ok(mesclar(g(), 1, 0, 'direita')));
    expect(d.linhas[1]).toEqual([{ conteudo: [{ tipo: 'texto', texto: 'd e' }], colunas: 2 }, { conteudo: [{ tipo: 'texto', texto: 'f' }] }]);
  });
  it('mesclar abaixo, e de novo, forma um bloco de 2 × 2', () => {
    let r = ok(mesclar(g(), 1, 0, 'abaixo'));
    r = ok(mesclar(r, 1, 1, 'abaixo'));
    r = ok(mesclar(r, 1, 0, 'direita'));
    const d = valida(r);
    expect(forma(d)).toEqual([[[1, 1], [1, 1], [1, 1]], [[2, 2], [1, 1]], [[1, 1]]]);
    expect(textos(d)[1]![0]).toBe('d g e h');
  });
  it('recusa: alturas diferentes, sem vizinha, vizinha já coberta, cabeçalho com o corpo', () => {
    const r = ok(mesclar(g(), 1, 0, 'abaixo'));
    expect(recusa(mesclar(r, 1, 0, 'direita'))).toBe('as duas células precisam ter a mesma altura');
    expect(recusa(mesclar(g(), 0, 2, 'direita'))).toBe('não há célula à direita');
    expect(recusa(mesclar(g(), 2, 0, 'abaixo'))).toBe('não há célula abaixo');
    const coberta = ok(mesclar(g(), 0, 1, 'abaixo'));
    expect(recusa(mesclar(coberta, 0, 0, 'direita'))).toBe('as duas células precisam ter a mesma altura');
    expect(recusa(mesclar(coberta, 1, 0, 'direita'))).toBe('a célula à direita já está mesclada com outra');
    expect(recusa(mesclar({ ...g(), linhasCabecalho: 1 }, 0, 0, 'abaixo'))).toBe('o cabeçalho não se mescla com o corpo da tabela');
  });
  it('separar devolve as posições vazias e guarda o texto na primeira', () => {
    const r = ok(separar(ok(mesclar(g(), 0, 0, 'direita')), 0, 0));
    expect(textos(valida(r))[0]).toEqual(['a b', '', 'c']);
    expect(recusa(separar(g(), 0, 0))).toBe('a célula não está mesclada');
  });
  it('o cabeçalho não pode cortar uma célula mesclada', () => {
    const r = ok(mesclar(g(), 0, 0, 'abaixo'));
    expect(recusa(mudarCabecalho({ ...r, linhasCabecalho: 0 }, 1))).toBe('uma célula mesclada atravessaria o fim do cabeçalho: separe-a antes');
    expect(ok(mudarCabecalho({ ...r, linhasCabecalho: 0 }, 2)).linhasCabecalho).toBe(2);
    expect(recusa(mudarCabecalho(r, 4))).toBe('o cabeçalho vai de 0 a 3 linhas');
  });
  it('operações em sequência mantêm a grade válida (exaustivo em 4 × 4)', () => {
    let r = preenchido(Array.from({ length: 4 }, (_, l) => Array.from({ length: 4 }, (_, c) => `${l}${c}`)));
    const passos: ((x: RascunhoTabela) => ResultadoOperacao)[] = [
      (x) => mesclar(x, 0, 0, 'direita'),
      (x) => mesclar(x, 0, 0, 'abaixo'),
      (x) => inserirLinha(x, 1),
      (x) => inserirColuna(x, 1),
      (x) => excluirLinha(x, 0),
      (x) => excluirColuna(x, 0),
      (x) => mesclar(x, 2, 2, 'abaixo'),
      (x) => inserirLinha(x, 3),
      (x) => excluirLinha(x, 2),
      (x) => separar(x, 0, 0),
    ];
    for (const p of passos) {
      const res = p(r);
      if (res.ok) r = res.rascunho;
      valida(r);
    }
  });
});

describe('validação: só a tabela válida vai para o texto', () => {
  it('sem título: erro no campo Título (RN-050)', () => {
    const v = validarTabela(preenchido([['a']], { titulo: { texto: '  ' } }));
    expect(v.ok ? [] : v.erros).toEqual([{ campo: 'Título', mensagem: 'escreva o título (RN-050)' }]);
  });
  it('nota específica vazia: erro, para a numeração das chamadas não mudar', () => {
    const v = validarTabela(preenchido([['a']], { notasEspecificas: [{ texto: 'x' }, { texto: '' }] }));
    expect(v.ok ? [] : v.erros).toEqual([{ campo: 'Nota específica 2', mensagem: 'escreva o texto da nota ou retire-a' }]);
  });
  it('caractere de controle na célula é recusado pelo formato, com o número da linha', () => {
    const r = alterarCelula(preenchido([['a'], ['b']]), 1, 0, 'b\u0007');
    const v = validarTabela(r);
    expect(v.ok).toBe(false);
    expect(v.ok ? '' : v.erros[0]!.campo).toBe('Linha 2');
  });
  it('a célula vazia é aceita (pendência é do verificador)', () => {
    const cel: CelulaTabela = { conteudo: [] };
    expect(valida(preenchido([['', 'b']])).linhas[0]![0]).toEqual(cel);
  });
});
