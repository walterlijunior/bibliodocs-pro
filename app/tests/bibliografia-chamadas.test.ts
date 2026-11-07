// M4-T03 (RF-07): chamadas de citação. Cada caso traz a fonte do esperado (página do Manual UFT, cap. 3, ou decisão
// da matriz). Fora por falta de campo: o volume na chamada (CANDIDO, 1993, v. 2, p. 12), p. 23.
import { describe, expect, it } from 'vitest';
import { contextoDeChamadas, entradaPeloTitulo, formatarChamada, type ChamadaFormatada, type OpcoesChamada } from '../src/dominio/bibliografia';
import type { Autor, InlineCitacao, InlineDeTitulo, Obra, ObraCitada } from '../src/dominio/modelo';

const t = (texto: string): InlineDeTitulo[] => [{ tipo: 'texto', texto }];
const p = (sobrenome: string, prenomes = 'X.'): Autor => ({ tipo: 'pessoa', sobrenome, prenomes });
let seq = 0;
const obra = (campos: Partial<Obra>): Obra => ({ id: `obr_ch${String(++seq).padStart(6, '0')}`, tipo: 'livro', titulo: t('Título'), ...campos });
const cit = (forma: InlineCitacao['forma'], obras: ObraCitada[], extra: Partial<InlineCitacao> = {}): InlineCitacao => ({ tipo: 'citacao', id: `cit_${++seq}`, forma, obras, ...extra });
const em = (o: Obra, pagina?: string): ObraCitada => ({ obra: o.id, ...(pagina ? { pagina } : {}) });

/** Texto com _itálico_ marcado. */
const marcado = (c: ChamadaFormatada) => c.trechos.map((x) => (x.marcas.includes('italico') ? `_${x.texto}_` : x.texto)).join('');
const chamar = (todas: Obra[], c: InlineCitacao, opcoes?: OpcoesChamada) => formatarChamada(c, contextoDeChamadas(todas), opcoes);

describe('exemplos do Manual, cap. 3 (perfil 2002, C-01)', () => {
  const sudbrack = obra({ autores: [p('Sudbrack', 'Josef')], ano: 2001 });
  const nichols = obra({ autores: [p('Nichols')], ano: 1993 });
  const souto = obra({ autores: [p('Souto')], ano: 1916 });
  const candido = obra({ autores: [p('Candido', 'Antonio')], ano: 1993 });
  const anteprojeto = obra({ tipo: 'artigoPeriodico', titulo: t('Anteprojeto de lei'), ano: 1987 });
  const aranha = obra({ autores: [p('Aranha'), p('Martins')], ano: 1993 });
  const authier = obra({ autores: [p('AUTHIER-REIRIZ', 'J.')], ano: 1982 });
  const vianna = obra({ autores: [p('Vianna')], ano: 1986 });
  const segatto = obra({ autores: [p('Segatto')], ano: 1995 });
  const ilda = obra({ autores: [p('Ilda')], ano: 1995 });
  const alencar = obra({ autores: [p('Alencar')], ano: 2000 });
  const ramazzini = obra({ autores: [p('Ramazzini')], ano: 1998 });
  const oliveira = obra({ autores: [p('Oliveira')], ano: 1998 });
  const silva = obra({ autores: [p('Silva')], ano: 2004 });
  const todas = [sudbrack, nichols, souto, candido, anteprojeto, aranha, authier, vianna, segatto, ilda, alencar, ramazzini, oliveira, silva];

  it.each<[string, InlineCitacao, string]>([
    ['p. 22, narrativa (RN-083)', cit('narrativa', [em(sudbrack, '27')]), 'Sudbrack (2001, p. 27)'],
    ['p. 22, parentética em caixa alta (RN-082)', cit('parentetica', [em(sudbrack, '27')]), '(SUDBRACK, 2001, p. 27)'],
    ['p. 22, citação longa', cit('parentetica', [em(nichols, '181')]), '(NICHOLS, 1993, p. 181)'],
    ['p. 23, grifo nosso dentro dos parênteses (RN-090)', cit('parentetica', [em(souto, '46')], { grifo: 'nosso' }), '(SOUTO, 1916, p. 46, grifo nosso)'],
    ['p. 23, grifo do autor (RN-090; sem o volume)', cit('parentetica', [em(candido, '12')], { grifo: 'doAutor' }), '(CANDIDO, 1993, p. 12, grifo do autor)'],
    ['p. 24, entrada pelo título (RN-091)', cit('parentetica', [em(anteprojeto, '55')]), '(ANTEPROJETO..., 1987, p. 55)'],
    ['p. 25, dois autores na narrativa com "e" (RN-093)', cit('narrativa', [em(aranha)]), 'Aranha e Martins (1993)'],
    ['p. 25, indireta sem página; sobrenome digitado em maiúsculas desce na narrativa (RN-092)', cit('narrativa', [em(authier)]), 'Authier-Reiriz (1982)'],
    ['p. 25, apud com as duas páginas (RN-098)', cit('parentetica', [em(vianna, '172')], { apud: em(segatto, '214-215') }), '(VIANNA, 1986, p. 172 apud SEGATTO, 1995, p. 214-215)'],
    ['p. 26, apud sem página (RN-098)', cit('parentetica', [em(ilda)], { apud: em(alencar) }), '(ILDA, 1995 apud ALENCAR, 2000)'],
    ['p. 26, apud na narrativa: consultado em maiúsculas dentro dos parênteses (RN-099)', cit('narrativa', [em(ramazzini)], { apud: em(oliveira) }), 'Ramazzini (1998 apud OLIVEIRA, 1998)'],
    ['p. 24, Quadro 3', cit('narrativa', [em(silva)]), 'Silva (2004)'],
  ])('%s', (_fonte, c, esperado) => {
    const r = chamar(todas, c);
    expect(marcado(r)).toBe(esperado);
    expect(r.avisos).toEqual([]);
    for (const x of r.trechos) expect(x.origem.length).toBeGreaterThan(0);
  });
});

describe('decisões provisórias D-M4 (NBR 10520 ausente)', () => {
  it('D-M4-02: "; " entre dois ou três autores na parentética; "," e "e" na narrativa', () => {
    const a = obra({ autores: [p('Fulano'), p('Ciclano')], ano: 2004 });
    const b = obra({ autores: [p('Lima'), p('Costa'), p('Souza')], ano: 2010 });
    expect(marcado(chamar([a, b], cit('parentetica', [em(a)])))).toBe('(FULANO; CICLANO, 2004)');
    expect(marcado(chamar([a, b], cit('parentetica', [em(b)])))).toBe('(LIMA; COSTA; SOUZA, 2010)');
    expect(marcado(chamar([a, b], cit('narrativa', [em(b)])))).toBe('Lima, Costa e Souza (2010)');
  });

  it('D-M4-02: mais de três autores, o primeiro e et al. em itálico', () => {
    const o = obra({ autores: [p('Luckesi'), p('Barreto'), p('Cosma'), p('Baptista')], ano: 2003 });
    expect(marcado(chamar([o], cit('parentetica', [em(o, '15')])))).toBe('(LUCKESI _et al._, 2003, p. 15)');
    expect(marcado(chamar([o], cit('narrativa', [em(o)])))).toBe('Luckesi _et al._ (2003)');
  });

  it('D-M4-03: várias obras separadas por "; " e sufixos a, b iguais aos da referência', () => {
    const a1 = obra({ autores: [p('Lima', 'Ana')], titulo: t('Beta'), ano: 2020 });
    const a2 = obra({ autores: [p('Lima', 'Ana')], titulo: t('Alfa'), ano: 2020 });
    const b = obra({ autores: [p('Costa')], ano: 2019 });
    const todas = [a1, a2, b];
    expect(marcado(chamar(todas, cit('parentetica', [em(a2), em(a1, '3'), em(b)])))).toBe('(LIMA, 2020a; LIMA, 2020b, p. 3; COSTA, 2019)');
  });

  it('D-M4-03: autores diferentes com o mesmo sobrenome e ano só avisam', () => {
    const ana = obra({ autores: [p('Silva', 'Ana')], ano: 2020 });
    const jose = obra({ autores: [p('Silva', 'José')], ano: 2020 });
    const outra = obra({ autores: [p('Silva', 'José'), p('Costa')], ano: 2020 });
    const todas = [ana, jose, outra];
    const r = chamar(todas, cit('parentetica', [em(ana)]));
    expect(marcado(r)).toBe('(SILVA, 2020)');
    expect(r.avisos.map((a) => a.codigo)).toEqual(['SOBRENOME_E_ANO_REPETIDOS']);
    expect(chamar(todas, cit('parentetica', [em(outra)])).avisos).toEqual([]);
  });

  it('D-M4-04: ano provável e não impresso entre colchetes; "não paginado"', () => {
    const o = obra({ autores: [p('Lima')], ano: 2016, anoIncerto: 'provavel' });
    const q = obra({ autores: [p('Costa')], ano: 2016, anoIncerto: 'naoImpresso' });
    expect(marcado(chamar([o, q], cit('parentetica', [{ obra: o.id, semPaginacao: true }])))).toBe('(LIMA, [2016?], não paginado)');
    expect(marcado(chamar([o, q], cit('narrativa', [em(q, '4')])))).toBe('Costa ([2016], p. 4)');
  });

  it('sem ano: a chamada sai sem data e avisa', () => {
    const o = obra({ autores: [p('Lima')] });
    const r = chamar([o], cit('parentetica', [em(o, '5')]));
    expect(marcado(r)).toBe('(LIMA, p. 5)');
    expect(r.avisos.map((a) => a.codigo)).toEqual(['ANO_AUSENTE']);
  });

  it('narrativa com várias obras: cada uma com o seu ano, e aviso', () => {
    const a = obra({ autores: [p('Lima')], ano: 2000 });
    const b = obra({ autores: [p('Costa')], ano: 2001 });
    const r = chamar([a, b], cit('narrativa', [em(a), em(b)]));
    expect(marcado(r)).toBe('Lima (2000); Costa (2001)');
    expect(r.avisos.map((x) => x.codigo)).toEqual(['NARRATIVA_COM_VARIAS_OBRAS']);
  });
});

describe('perfil 2002 e opção 2023 (C-01)', () => {
  const o = obra({ autores: [p('SILVA NETO', 'Roberto da')], ano: 2001 });
  it('2002: maiúsculas na parentética; narrativa só com a inicial e "Neto" junto', () => {
    expect(marcado(chamar([o], cit('parentetica', [em(o, '2')])))).toBe('(SILVA NETO, 2001, p. 2)');
    expect(marcado(chamar([o], cit('narrativa', [em(o, '2')])))).toBe('Silva Neto (2001, p. 2)');
  });
  it('2023 (provisória): caixa mista também nos parênteses, com a origem C-01', () => {
    const r = chamar([o], cit('parentetica', [em(o, '2')]), { edicaoNbr10520: '2023' });
    expect(marcado(r)).toBe('(Silva Neto, 2001, p. 2)');
    expect(r.trechos.find((x) => x.texto === 'Silva Neto')?.origem).toContain('C-01');
  });
  it('entidade: maiúsculas na parentética; na narrativa fica como digitada (siglas não descem)', () => {
    const abnt = obra({ autores: [{ tipo: 'entidade', nome: 'ABNT' }], ano: 2018 });
    const uft = obra({ autores: [{ tipo: 'entidade', nome: 'Universidade Federal do Tocantins' }], ano: 2020 });
    expect(marcado(chamar([abnt, uft], cit('narrativa', [em(abnt)])))).toBe('ABNT (2018)');
    expect(marcado(chamar([abnt, uft], cit('parentetica', [em(uft)])))).toBe('(UNIVERSIDADE FEDERAL DO TOCANTINS, 2020)');
    expect(marcado(chamar([abnt, uft], cit('narrativa', [em(uft)])))).toBe('Universidade Federal do Tocantins (2020)');
  });
  it('partícula no sobrenome digitado em maiúsculas desce: "Costa da Silva"', () => {
    const c = obra({ autores: [p('COSTA DA SILVA')], ano: 2000 });
    expect(marcado(chamar([c], cit('narrativa', [em(c)])))).toBe('Costa da Silva (2000)');
  });
});

describe('entrada pelo título (RN-091)', () => {
  it.each([
    ['Anteprojeto de lei', 'ANTEPROJETO...'],
    ['Os perigos do uso', 'OS PERIGOS...'], // artigo leva a palavra seguinte
    ['Um estudo', 'UM ESTUDO...'],
    ['Mãe de todos', 'MÃE DE...'], // monossílabo
    ['Manual: guia', 'MANUAL...'],
    ['Brasil', 'BRASIL...'],
    ['   ', '...'],
  ])('%s → %s', (titulo, esperado) => {
    expect(entradaPeloTitulo(t(titulo))).toBe(esperado);
  });
});

describe('a chamada é derivada da obra (aceite do RF-07)', () => {
  it('mudar o ano ou o autor da obra muda todas as chamadas', () => {
    const o = obra({ autores: [p('Lima')], ano: 2000 });
    const chamadas = [cit('parentetica', [em(o, '1')]), cit('narrativa', [em(o)]), cit('parentetica', [em(o)], { apud: em(o) })];
    const textos = (lista: Obra[]) => chamadas.map((c) => marcado(chamar(lista, c)));
    expect(textos([o])).toEqual(['(LIMA, 2000, p. 1)', 'Lima (2000)', '(LIMA, 2000 apud LIMA, 2000)']);
    const mudada = { ...o, ano: 2005, autores: [p('Costa')] };
    expect(textos([mudada])).toEqual(['(COSTA, 2005, p. 1)', 'Costa (2005)', '(COSTA, 2005 apud COSTA, 2005)']);
  });

  it('obra ausente (o modelo não deixa chegar aqui): "?" e aviso, sem exceção', () => {
    const r = chamar([], cit('parentetica', [{ obra: 'obr_sumida01' }]));
    expect(marcado(r)).toBe('(?)');
    expect(r.avisos.map((a) => a.codigo)).toEqual(['OBRA_INEXISTENTE']);
  });
});
