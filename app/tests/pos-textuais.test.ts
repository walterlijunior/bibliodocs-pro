// Testes do M2-T09: lugares dos pós-textuais na ordem do Quadro 5 e identificação de apêndices e anexos por letra.
import { describe, expect, it } from 'vitest';
import { criarTrabalhoDoTipo } from '../src/aplicacao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import {
  incluirPosTextual,
  MAXIMO_REPETICOES_ELEMENTO,
  retirarPosTextual,
  type Documento,
  type ElementoPosTextual,
  type ElementoPosTextualId,
  type TipoTrabalhoUft,
} from '../src/dominio/modelo';
import { letraPosTextual, letraSemFonte, rotulosPosTextuais } from '../src/dominio/numeracao';

const id = (n: number) => `ele_${String(n).padStart(16, '0')}`;

function montar(tipos: ElementoPosTextualId[]): ElementoPosTextual[] {
  let lista: ElementoPosTextual[] = [];
  tipos.forEach((tipo, i) => {
    const r = incluirPosTextual(lista, tipo, id(i));
    if (r === null) throw new Error(`recusado: ${tipo}`);
    lista = r;
  });
  return lista;
}

describe('ordem (RN-114)', () => {
  it('qualquer ordem de inclusão resulta na ordem do Quadro 5', () => {
    const lista = montar(['indice', 'anexo', 'glossario', 'apendice', 'referencias']);
    expect(lista.map((e) => e.tipo)).toEqual(['referencias', 'glossario', 'apendice', 'anexo', 'indice']);
  });

  it('apêndice novo entra depois dos que existem e antes dos anexos', () => {
    const lista = montar(['apendice', 'anexo', 'apendice']);
    expect(lista.map((e) => e.id)).toEqual([id(0), id(2), id(1)]);
  });

  it('não repete o que não se repete; apêndice e anexo param no limite', () => {
    expect(incluirPosTextual(montar(['glossario']), 'glossario', id(9))).toBeNull();
    const cheia = montar(Array.from({ length: MAXIMO_REPETICOES_ELEMENTO }, () => 'anexo' as const));
    expect(incluirPosTextual(cheia, 'anexo', id(999))).toBeNull();
    expect(incluirPosTextual(cheia, 'apendice', id(999))).not.toBeNull();
  });

  it('não altera a lista recebida; retirar devolve lista nova e ignora id desconhecido', () => {
    const lista = montar(['referencias']);
    const copia = [...lista];
    incluirPosTextual(lista, 'anexo', id(5));
    expect(lista).toEqual(copia);
    expect(retirarPosTextual(lista, id(0))).toEqual([]);
    expect(retirarPosTextual(lista, 'ele_naoexiste000000')).toBe(lista);
  });

  it.each<[TipoTrabalhoUft, ElementoPosTextualId[]]>([
    ['monografia', ['referencias']],
    ['artigo-tcc', ['referencias']],
    ['dissertacao', ['referencias']],
    ['tese', ['referencias']],
    ['relatorio-tecnico', ['referencias', 'apendice', 'anexo']],
    ['projeto-pesquisa', ['referencias', 'apendice', 'anexo']],
  ])('%s nasce com os lugares do tipo', (tipo, esperado) => {
    let n = 0;
    const { documento } = criarTrabalhoDoTipo({ id: 'prj_abcdefghijklmnop', agora: '2026-11-02T10:00:00.000Z', appVersao: '0.1.0', tipo, novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
    expect(documento.posTextuais?.map((e) => e.tipo)).toEqual(esperado);
  });
});

describe('identificação por letra (RN-231, RN-232, RN-234, RN-235)', () => {
  it('A…Z, depois letras dobradas AA, BB (C-A6), depois triplas', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(letraPosTextual)).toEqual(['A', 'B', 'Z', 'AA', 'BB', 'ZZ', 'AAA']);
    expect(() => letraPosTextual(-1)).toThrow(RangeError);
    expect(() => letraPosTextual(1.5)).toThrow(RangeError);
  });

  it('cada tipo conta as suas letras; os outros elementos não têm rótulo', () => {
    const lista = montar(['referencias', 'apendice', 'apendice', 'anexo', 'indice']);
    expect([...rotulosPosTextuais(lista)]).toEqual([
      [id(1), 'APÊNDICE A'],
      [id(2), 'APÊNDICE B'],
      [id(3), 'ANEXO A'],
    ]);
  });

  it('retirar um apêndice renumera os seguintes: a letra vem da posição', () => {
    const lista = montar(['apendice', 'apendice', 'apendice']);
    expect(rotulosPosTextuais(retirarPosTextual(lista, id(0))).get(id(2))).toBe('APÊNDICE B');
  });
});

describe('título no formato v1', () => {
  const doc = (posTextuais: unknown): unknown => ({ id: 'prj_abcdefghijklmnop', tipoTrabalho: 'tese', metadados: { titulo: [] }, corpo: [], posTextuais } satisfies Omit<Documento, 'posTextuais'> & { posTextuais: unknown });

  it('apêndice e anexo aceitam título, sem letra gravada', () => {
    expect(validarDocumentoV1(doc([{ tipo: 'apendice', id: id(1), titulo: 'Questionário' }, { tipo: 'anexo', id: id(2) }])).ok).toBe(true);
  });

  it.each<[string, unknown]>([
    ['título vazio', { tipo: 'apendice', id: id(1), titulo: '' }],
    ['título em referências', { tipo: 'referencias', id: id(1), titulo: 'x' }],
    ['letra gravada', { tipo: 'anexo', id: id(1), letra: 'A' }],
    ['caractere de controle', { tipo: 'anexo', id: id(1), titulo: 'a\u0001' }],
  ])('recusa %s', (_caso, e) => {
    expect(validarDocumentoV1(doc([e])).ok).toBe(false);
  });
});

describe('letra sem fonte (decisão do usuário, 2026-11-02)', () => {
  it('até ZZ tem fonte; AAA em diante, não', () => {
    expect(letraPosTextual(51)).toBe('ZZ');
    expect(letraSemFonte(51)).toBe(false);
    expect(letraPosTextual(52)).toBe('AAA');
    expect(letraSemFonte(52)).toBe(true);
  });
});
