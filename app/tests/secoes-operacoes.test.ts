// M2-T03 — numeração progressiva (RN-038, RN-039, RN-041) e operações estruturais puras sobre a árvore de seções
// (RF-03; RN-028, RN-041). Exemplos do aceite e propriedades com gerador semeado (sem dependência nova).
import { describe, expect, it } from 'vitest';
import {
  alturaSecao,
  aplicarOperacaoSecao,
  inserirSecao,
  MAXIMO_SECOES_POR_NIVEL,
  MENSAGENS_RECUSA_SECAO,
  moverSecao,
  NIVEL_MAXIMO_SECAO,
  promoverSecao,
  recuarSecao,
  removerSecao,
  type Id,
  type InversoSecao,
  type OperacaoSecao,
  type ResultadoOperacaoSecao,
  type Secao,
} from '../src/dominio/modelo';
import { indicativoSecao, mapaIndicativos, numerarSecoes } from '../src/dominio/numeracao';

function s(id: Id, ...subsecoes: Secao[]): Secao {
  return { id, titulo: [{ tipo: 'texto', texto: `Título ${id}` }], blocos: [], subsecoes };
}

/** Cadeia `a1 > a2 > ... > an` (n níveis). */
function cadeia(prefixo: string, n: number): Secao {
  let atual = s(`${prefixo}${n}`);
  for (let i = n - 1; i >= 1; i--) atual = s(`${prefixo}${i}`, atual);
  return atual;
}

function numeros(corpo: readonly Secao[]): string[] {
  return numerarSecoes(corpo).map((n) => `${n.indicativo} ${n.secao.id}`);
}

function aceito(r: ResultadoOperacaoSecao): Extract<ResultadoOperacaoSecao, { ok: true }> {
  if (!r.ok) throw new Error(`recusado: ${r.codigo}`);
  return r;
}

function congelar<T>(v: T): T {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) congelar(x);
  }
  return v;
}

describe('numeração progressiva (RN-038, RN-039)', () => {
  it('numera em algarismos arábicos, do primário ao quinário, sem saltos', () => {
    const corpo = [s('a', s('a1'), s('a2', cadeia('q', 3))), s('b'), s('c', s('c1'))];
    expect(numeros(corpo)).toEqual([
      '1 a',
      '1.1 a1',
      '1.2 a2',
      '1.2.1 q1',
      '1.2.1.1 q2',
      '1.2.1.1.1 q3',
      '2 b',
      '3 c',
      '3.1 c1',
    ]);
    const n = numerarSecoes(corpo);
    expect(n.map((x) => x.nivel)).toEqual([1, 2, 2, 3, 4, 5, 1, 1, 2]);
    expect(n.every((x) => /^\d+(\.\d+){0,4}$/u.test(x.indicativo))).toBe(true);
    expect(n.find((x) => x.secao.id === 'q1')!.paiId).toBe('a2');
    expect(n.some((x) => x.alemDoLimite)).toBe(false);
    expect(mapaIndicativos(corpo).get('c1')).toBe('3.1');
    expect(indicativoSecao([4, 2])).toBe('4.2');
  });

  it('corpo vazio não tem números', () => {
    expect(numerarSecoes([])).toEqual([]);
  });

  it('seção além da quinária (vinda de arquivo) recebe número e fica marcada (RN-041)', () => {
    const n = numerarSecoes([cadeia('x', 7)]);
    expect(n.map((x) => x.alemDoLimite)).toEqual([false, false, false, false, false, true, true]);
    expect(n[6]!.indicativo).toBe('1.1.1.1.1.1.1');
  });

  it('aceita a profundidade máxima do formato (64) sem recursão', () => {
    expect(numerarSecoes([cadeia('p', 64)])).toHaveLength(64);
  });
});

describe('operações sobre a árvore (RF-03)', () => {
  const base = (): Secao[] => congelar([s('A', s('A1')), s('B', s('B1'), s('B2')), s('C', s('C1'))]);

  it('mover a seção 3 para antes da 2 renumera tudo, com subseções', () => {
    const r = aceito(moverSecao(base(), 'C', { paiId: null, indice: 1 }));
    expect(numeros(r.corpo)).toEqual(['1 A', '1.1 A1', '2 C', '2.1 C1', '3 B', '3.1 B1', '3.2 B2']);
    expect(numeros(aceito(aplicarOperacaoSecao(r.corpo, r.inverso)).corpo)).toEqual(numeros(base()));
  });

  it('mover para dentro de outra seção muda o nível', () => {
    const r = aceito(moverSecao(base(), 'A', { paiId: 'B1', indice: 0 }));
    expect(numeros(r.corpo)).toEqual(['1 B', '1.1 B1', '1.1.1 A', '1.1.1.1 A1', '1.2 B2', '2 C', '2.1 C1']);
  });

  it('mover para o mesmo lugar é aceito sem mudança', () => {
    const r = aceito(moverSecao(base(), 'B2', { paiId: 'B', indice: 1 }));
    expect(r.corpo).toEqual(base());
    expect(r.mudou).toBe(false);
    expect(aceito(moverSecao(base(), 'B2', { paiId: 'B', indice: 0 })).mudou).toBe(true);
  });

  it('não move para dentro da própria seção', () => {
    for (const paiId of ['B', 'B1']) {
      const r = moverSecao(base(), 'B', { paiId, indice: 0 });
      expect(r).toEqual({ ok: false, codigo: 'DESTINO_DENTRO_DA_PROPRIA', mensagem: MENSAGENS_RECUSA_SECAO.DESTINO_DENTRO_DA_PROPRIA });
    }
  });

  it('recusa seção, destino e posição inexistentes', () => {
    expect(moverSecao(base(), 'Z', { paiId: null, indice: 0 })).toMatchObject({ ok: false, codigo: 'SECAO_INEXISTENTE' });
    expect(moverSecao(base(), 'A', { paiId: 'Z', indice: 0 })).toMatchObject({ ok: false, codigo: 'DESTINO_INEXISTENTE' });
    // Sem a própria A, a lista primária tem 2 posições + o fim (0..2).
    expect(moverSecao(base(), 'A', { paiId: null, indice: 3 })).toMatchObject({ ok: false, codigo: 'POSICAO_INVALIDA' });
    expect(moverSecao(base(), 'A', { paiId: null, indice: 2 }).ok).toBe(true);
    for (const indice of [-1, 0.5, Number.NaN]) {
      expect(moverSecao(base(), 'A', { paiId: null, indice })).toMatchObject({ ok: false, codigo: 'POSICAO_INVALIDA' });
      expect(inserirSecao(base(), s('N'), { paiId: null, indice })).toMatchObject({ ok: false, codigo: 'POSICAO_INVALIDA' });
    }
    expect(inserirSecao(base(), s('N'), { paiId: 'B', indice: 3 })).toMatchObject({ ok: false, codigo: 'POSICAO_INVALIDA' });
    expect(inserirSecao(base(), s('N'), { paiId: 'Z', indice: 0 })).toMatchObject({ ok: false, codigo: 'DESTINO_INEXISTENTE' });
    expect(removerSecao(base(), 'Z')).toMatchObject({ ok: false, codigo: 'SECAO_INEXISTENTE' });
    expect(recuarSecao(base(), 'Z')).toMatchObject({ ok: false, codigo: 'SECAO_INEXISTENTE' });
    expect(promoverSecao(base(), 'Z')).toMatchObject({ ok: false, codigo: 'SECAO_INEXISTENTE' });
  });

  it('recuar vira a última subseção da anterior; promover a última subseção desfaz o recuo', () => {
    const r = aceito(recuarSecao(base(), 'B'));
    expect(numeros(r.corpo)).toEqual(['1 A', '1.1 A1', '1.2 B', '1.2.1 B1', '1.2.2 B2', '2 C', '2.1 C1']);
    const p = aceito(promoverSecao(r.corpo, 'B'));
    expect(p.corpo).toEqual(base());
  });

  it('promover funciona como o Word: as irmãs seguintes viram subseções e a ordem do texto não muda', () => {
    const antes = numerarSecoes(base()).map((n) => n.secao.id);
    const r = aceito(promoverSecao(base(), 'B1'));
    expect(numeros(r.corpo)).toEqual(['1 A', '1.1 A1', '2 B', '3 B1', '3.1 B2', '4 C', '4.1 C1']);
    expect(numerarSecoes(r.corpo).map((n) => n.secao.id)).toEqual(antes);
    expect(r.inverso).toEqual({ tipo: 'rebaixar', id: 'B1', devolver: 1 });
    expect(aceito(aplicarOperacaoSecao(r.corpo, r.inverso)).corpo).toEqual(base());
    // As subseções próprias vêm antes das irmãs adotadas; nenhuma seção desce de nível.
    const comFilhas = congelar([s('M', s('X', s('X1')), s('Y', s('Y1')), s('Z'))]);
    const p = aceito(promoverSecao(comFilhas, 'X'));
    expect(numeros(p.corpo)).toEqual(['1 M', '2 X', '2.1 X1', '2.2 Y', '2.2.1 Y1', '2.3 Z']);
    expect(aceito(aplicarOperacaoSecao(p.corpo, p.inverso)).corpo).toEqual(comFilhas);
    // Exemplo da decisão: em 2 Método [2.1 Coleta, 2.2 Análise], promover Coleta dá 3 Coleta [3.1 Análise].
    const metodo = congelar([s('Intro'), s('Metodo', s('Coleta'), s('Analise'))]);
    expect(numeros(aceito(promoverSecao(metodo, 'Coleta')).corpo)).toEqual(['1 Intro', '2 Metodo', '3 Coleta', '3.1 Analise']);
  });

  it('respeita o limite de seções por nível do formato (1000)', () => {
    const cheio = congelar(Array.from({ length: MAXIMO_SECOES_POR_NIVEL }, (_, i) => s(`p${i}`)));
    expect(inserirSecao(cheio, s('n'), { paiId: null, indice: 0 })).toEqual({
      ok: false,
      codigo: 'SECOES_DEMAIS',
      mensagem: MENSAGENS_RECUSA_SECAO.SECOES_DEMAIS,
    });
    expect(inserirSecao(cheio, s('n'), { paiId: 'p0', indice: 0 }).ok).toBe(true);
    // Mover dentro da lista cheia não a aumenta; trazer de fora, sim.
    expect(moverSecao(cheio, 'p5', { paiId: null, indice: 0 }).ok).toBe(true);
    const comFilha = congelar([...cheio.slice(0, -1), s('pai', s('f'))]);
    expect(moverSecao(comFilha, 'f', { paiId: null, indice: 0 })).toMatchObject({ ok: false, codigo: 'SECOES_DEMAIS' });
    expect(promoverSecao(comFilha, 'f')).toMatchObject({ ok: false, codigo: 'SECOES_DEMAIS' });
    // Promover não pode juntar subseções demais na promovida.
    const muitas = congelar([
      s('m', s('x', ...Array.from({ length: 600 }, (_, i) => s(`x${i}`))), ...Array.from({ length: 401 }, (_, i) => s(`y${i}`))),
    ]);
    expect(promoverSecao(muitas, 'x')).toMatchObject({ ok: false, codigo: 'SECOES_DEMAIS' });
    // Remover e desfazer numa lista cheia restaura.
    const r = aceito(removerSecao(cheio, 'p3'));
    expect(aceito(aplicarOperacaoSecao(r.corpo, r.inverso)).corpo).toEqual(cheio);
  });

  it('um inverso montado à mão não fura os limites; só o devolvido por uma operação aceita', () => {
    const corpo = congelar([cadeia('a', 5), s('b')]);
    const forjados: InversoSecao[] = [
      { tipo: 'mover', id: 'b', destino: { paiId: 'a5', indice: 0 } },
      { tipo: 'inserir', secao: s('n'), destino: { paiId: 'a5', indice: 0 } },
    ];
    for (const op of forjados) {
      expect(aplicarOperacaoSecao(corpo, op), op.tipo).toMatchObject({ ok: false, codigo: 'NIVEL_EXCEDIDO' });
      // Nem uma cópia do objeto (como depois de serializar).
      expect(aplicarOperacaoSecao(corpo, JSON.parse(JSON.stringify(op)) as InversoSecao).ok).toBe(false);
    }
    // Rebaixar forjado: b iria para dentro de a1 com a cadeia b > c > d > e > f (6 níveis).
    const fundo = congelar([s('a1'), cadeia('b', 5)]);
    expect(aplicarOperacaoSecao(fundo, { tipo: 'rebaixar', id: 'b1', devolver: 0 })).toMatchObject({ ok: false, codigo: 'NIVEL_EXCEDIDO' });
    expect(aplicarOperacaoSecao(corpo, { tipo: 'rebaixar', id: 'b', devolver: 1 })).toMatchObject({ ok: false, codigo: 'POSICAO_INVALIDA' });
    expect(aplicarOperacaoSecao(corpo, { tipo: 'rebaixar', id: 'a1', devolver: 0 })).toMatchObject({ ok: false, codigo: 'SEM_SECAO_ANTERIOR' });
    expect(aplicarOperacaoSecao(corpo, { tipo: 'rebaixar', id: 'z', devolver: 0 })).toMatchObject({ ok: false, codigo: 'SECAO_INEXISTENTE' });
    const raso = congelar([s('m'), s('b', s('b1'))]);
    expect(numeros(aceito(aplicarOperacaoSecao(raso, { tipo: 'rebaixar', id: 'b', devolver: 1 })).corpo)).toEqual(['1 m', '1.1 b', '1.2 b1']);
  });

  it('recusa recuar a primeira do nível e promover uma primária', () => {
    expect(recuarSecao(base(), 'A')).toMatchObject({ ok: false, codigo: 'SEM_SECAO_ANTERIOR' });
    expect(recuarSecao(base(), 'B1')).toMatchObject({ ok: false, codigo: 'SEM_SECAO_ANTERIOR' });
    expect(promoverSecao(base(), 'A')).toMatchObject({ ok: false, codigo: 'JA_PRIMARIA' });
  });

  it('recuar além da quinária é recusado com mensagem que orienta usar alíneas (RN-041, RN-028)', () => {
    const corpo = congelar([cadeia('a', 5), s('b')]);
    // Recuar b (secundária) para dentro de a1 a deixa terciária: cabe.
    const quinaria = congelar([s('r', cadeia('a', 4), s('b'))]);
    const r = recuarSecao(quinaria, 'b');
    expect(r.ok).toBe(true);
    // Na cadeia de 5, mover b para dentro de a5 criaria a 6.ª: recusado.
    const m = moverSecao(corpo, 'b', { paiId: 'a5', indice: 0 });
    expect(m).toEqual({ ok: false, codigo: 'NIVEL_EXCEDIDO', mensagem: MENSAGENS_RECUSA_SECAO.NIVEL_EXCEDIDO });
    expect(MENSAGENS_RECUSA_SECAO.NIVEL_EXCEDIDO).toMatch(/quinária/u);
    expect(MENSAGENS_RECUSA_SECAO.NIVEL_EXCEDIDO).toMatch(/alíneas/u);
    // Recuar uma quinária que tem irmã anterior.
    const irmas = congelar([s('r', s('r2', s('r3', s('r4', s('q1'), s('q2')))))]);
    expect(recuarSecao(irmas, 'q2')).toMatchObject({ ok: false, codigo: 'NIVEL_EXCEDIDO' });
    // A altura das subseções conta: recuar B (2 níveis) para dentro de uma quaternária passa de 5.
    const comFilhas = congelar([s('r', s('r2', s('r3', s('x'), s('B', s('B1')))))]);
    expect(recuarSecao(comFilhas, 'B')).toMatchObject({ ok: false, codigo: 'NIVEL_EXCEDIDO' });
    expect(inserirSecao(corpo, s('n'), { paiId: 'a5', indice: 0 })).toMatchObject({ ok: false, codigo: 'NIVEL_EXCEDIDO' });
    expect(inserirSecao(corpo, cadeia('n', 2), { paiId: 'a4', indice: 0 })).toMatchObject({ ok: false, codigo: 'NIVEL_EXCEDIDO' });
    expect(inserirSecao(corpo, s('n'), { paiId: 'a4', indice: 1 }).ok).toBe(true);
    expect(NIVEL_MAXIMO_SECAO).toBe(5);
  });

  it('arquivo que já passa da quinária pode ser corrigido promovendo, e desfazer volta ao estado anterior', () => {
    const corpo = congelar([cadeia('x', 7)]);
    const p = aceito(promoverSecao(corpo, 'x7'));
    expect(numerarSecoes(p.corpo).filter((n) => n.alemDoLimite)).toHaveLength(2);
    expect(aceito(aplicarOperacaoSecao(p.corpo, p.inverso)).corpo).toEqual(corpo);
    // Mover uma seção funda para um nível menos fundo, mesmo ainda além da quinária, também é aceito.
    expect(numeros(aceito(moverSecao(corpo, 'x7', { paiId: 'x5', indice: 1 })).corpo).at(-1)).toBe('1.1.1.1.1.2 x7');
    // Mas não se aprofunda ainda mais.
    expect(moverSecao(corpo, 'x7', { paiId: 'x7', indice: 0 }).ok).toBe(false);
    const fundo = congelar([cadeia('x', 7), s('y')]);
    expect(moverSecao(fundo, 'y', { paiId: 'x7', indice: 0 })).toMatchObject({ ok: false, codigo: 'NIVEL_EXCEDIDO' });
    // Remover uma seção funda e desfazer também restaura.
    const r = aceito(removerSecao(corpo, 'x3'));
    expect(aceito(aplicarOperacaoSecao(r.corpo, r.inverso)).corpo).toEqual(corpo);
  });

  it('inserir e remover são inversos e levam subseções e blocos', () => {
    const nova: Secao = { ...s('N', s('N1')), blocos: [{ tipo: 'paragrafo', id: 'pN', conteudo: [] }] };
    const r = aceito(inserirSecao(base(), nova, { paiId: 'B', indice: 1 }));
    expect(numeros(r.corpo)).toEqual(['1 A', '1.1 A1', '2 B', '2.1 B1', '2.2 N', '2.2.1 N1', '2.3 B2', '3 C', '3.1 C1']);
    expect(r.inverso).toEqual({ tipo: 'remover', id: 'N' });
    const d = aceito(aplicarOperacaoSecao(r.corpo, r.inverso));
    expect(d.corpo).toEqual(base());
    expect(aceito(aplicarOperacaoSecao(d.corpo, d.inverso)).corpo).toEqual(r.corpo);
  });

  it('recusa inserir id repetido (de seção ou de bloco, no trabalho ou dentro da própria seção)', () => {
    const comBloco = congelar([{ ...s('A'), blocos: [{ tipo: 'paragrafo' as const, id: 'p1', conteudo: [] }] }]);
    const casos: Secao[] = [
      s('A'),
      s('N', s('A')),
      { ...s('N'), blocos: [{ tipo: 'quebraPagina', id: 'p1' }] },
      s('N', s('N')),
      { ...s('N'), blocos: [{ tipo: 'quebraPagina', id: 'N' }] },
      { ...s('N'), blocos: [{ tipo: 'quebraPagina', id: 'q' }, { tipo: 'quebraPagina', id: 'q' }] },
    ];
    for (const c of casos) {
      expect(inserirSecao(comBloco, c, { paiId: null, indice: 0 })).toMatchObject({ ok: false, codigo: 'ID_REPETIDO' });
    }
  });

  it('não altera a entrada e compartilha o que não mudou', () => {
    const corpo = base();
    const r = aceito(moverSecao(corpo, 'B2', { paiId: 'B', indice: 0 }));
    expect(r.corpo[0]).toBe(corpo[0]);
    expect(r.corpo[2]).toBe(corpo[2]);
    expect(r.corpo[1]!.subsecoes[1]).toBe(corpo[1]!.subsecoes[0]);
    // A mãe é copiada só na casca: título e blocos continuam os mesmos objetos.
    expect(r.corpo[1]).not.toBe(corpo[1]);
    expect(r.corpo[1]!.titulo).toBe(corpo[1]!.titulo);
    expect(r.corpo[1]!.blocos).toBe(corpo[1]!.blocos);
    expect(corpo).toEqual([s('A', s('A1')), s('B', s('B1'), s('B2')), s('C', s('C1'))]);
  });
});

// --- Propriedades ---------------------------------------------------------------------------------------------

/** mulberry32: gerador determinístico, para que uma falha seja reproduzível pela semente. */
function gerador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `fundo` = maior nível gerado; 7 simula um arquivo que já passa da quinária. */
function arvoreAleatoria(rnd: () => number, contador: { n: number }, fundo: number, nivel = 1): Secao[] {
  const quantas = nivel === 1 ? 1 + Math.floor(rnd() * 4) : Math.floor(rnd() * (nivel > 4 ? 1.5 : 3.2 - nivel * 0.4));
  const lista: Secao[] = [];
  for (let i = 0; i < quantas; i++) {
    const id = `s${contador.n++}`;
    const blocos = rnd() < 0.3 ? [{ tipo: 'paragrafo' as const, id: `b${contador.n++}`, conteudo: [] }] : [];
    lista.push({ id, titulo: [], blocos, subsecoes: nivel < fundo ? arvoreAleatoria(rnd, contador, fundo, nivel + 1) : [] });
  }
  return lista;
}

function opAleatoria(rnd: () => number, corpo: readonly Secao[], contador: { n: number }): OperacaoSecao {
  const todas = numerarSecoes(corpo);
  const escolher = <T>(l: readonly T[]): T => l[Math.floor(rnd() * l.length)]!;
  const alvo = todas.length > 0 ? escolher(todas).secao.id : 'inexistente';
  const destino = () => {
    const paiId = rnd() < 0.3 || todas.length === 0 ? null : escolher(todas).secao.id;
    return { paiId, indice: Math.floor(rnd() * 4) };
  };
  switch (Math.floor(rnd() * 5)) {
    case 0:
      return { tipo: 'inserir', secao: s(`n${contador.n++}`, ...(rnd() < 0.3 ? [s(`n${contador.n++}`)] : [])), destino: destino() };
    case 1:
      return { tipo: 'remover', id: alvo };
    case 2:
      return { tipo: 'mover', id: alvo, destino: destino() };
    case 3:
      return { tipo: 'recuar', id: alvo };
    default:
      return { tipo: 'promover', id: alvo };
  }
}

function idsSecoes(corpo: readonly Secao[]): string[] {
  return numerarSecoes(corpo)
    .map((n) => n.secao.id)
    .sort();
}

function profundidade(corpo: readonly Secao[]): number {
  return Math.max(0, ...corpo.map((x) => alturaSecao(x)));
}

/** RN-039: cada indicativo é o da mãe + "." + posição (base 1); as primárias contam 1, 2, 3... */
function confereNumeracao(corpo: readonly Secao[], nivelMaximo: number): void {
  const confere = (lista: readonly Secao[], prefixo: string, nivel: number): void => {
    lista.forEach((sec, i) => {
      const esperado = prefixo === '' ? `${i + 1}` : `${prefixo}.${i + 1}`;
      expect(mapaIndicativos(corpo).get(sec.id)).toBe(esperado);
      expect(nivel).toBeLessThanOrEqual(nivelMaximo);
      confere(sec.subsecoes, esperado, nivel + 1);
    });
  };
  confere(corpo, '', 1);
}

describe('propriedades (400 sequências semeadas)', () => {
  it('toda operação aceita mantém a numeração progressiva, os 5 níveis e a entrada intacta; o inverso restaura', () => {
    let aceitas = 0;
    let recusadas = 0;
    for (let semente = 1; semente <= 400; semente++) {
      const rnd = gerador(semente);
      const contador = { n: 0 };
      // Uma em cada quatro árvores vem "de arquivo" com até 7 níveis.
      let corpo = congelar(arvoreAleatoria(rnd, contador, semente % 4 === 0 ? 7 : NIVEL_MAXIMO_SECAO));
      const historico: { antes: Secao[]; inverso: InversoSecao }[] = [];
      for (let passo = 0; passo < 12; passo++) {
        const op = opAleatoria(rnd, corpo, contador);
        const antes = corpo;
        const copia = JSON.stringify(antes);
        const r = aplicarOperacaoSecao(antes, op);
        expect(JSON.stringify(antes), `semente ${semente}`).toBe(copia);
        if (!r.ok) {
          recusadas++;
          expect(r.mensagem).toBe(MENSAGENS_RECUSA_SECAO[r.codigo]);
          continue;
        }
        aceitas++;
        if (!r.mudou) expect(r.corpo).toEqual(antes);
        // Nunca passa da quinária, nem aprofunda uma árvore que já passava dela.
        confereNumeracao(r.corpo, Math.max(NIVEL_MAXIMO_SECAO, profundidade(antes)));
        if (op.tipo === 'mover' || op.tipo === 'recuar' || op.tipo === 'promover') {
          expect(idsSecoes(r.corpo)).toEqual(idsSecoes(antes));
        }
        const desfeito = aplicarOperacaoSecao(r.corpo, r.inverso);
        expect(desfeito.ok, `semente ${semente}, passo ${passo}`).toBe(true);
        expect((desfeito as { corpo: Secao[] }).corpo).toEqual(antes);
        // Refazer (o inverso do inverso) volta ao resultado.
        const d = aceito(desfeito);
        expect(aceito(aplicarOperacaoSecao(d.corpo, d.inverso)).corpo, `semente ${semente}, passo ${passo}`).toEqual(r.corpo);
        historico.push({ antes, inverso: r.inverso });
        corpo = congelar(r.corpo);
      }
      // Desfazer tudo, do último ao primeiro, volta à árvore inicial.
      for (let h = historico.pop(); h !== undefined; h = historico.pop()) {
        corpo = aceito(aplicarOperacaoSecao(corpo, h.inverso)).corpo;
        expect(corpo).toEqual(h.antes);
      }
    }
    // O gerador exercita os dois lados.
    expect(aceitas).toBeGreaterThan(1300);
    expect(recusadas).toBeGreaterThan(400);
  });
});
