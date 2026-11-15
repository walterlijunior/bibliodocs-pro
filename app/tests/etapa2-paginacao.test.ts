// Etapa 2 da especificação de atualização — folhas no editor (D-E2-07): o bloco que passaria do fim da área de texto
// vai para o começo da folha seguinte; bloco no topo da folha (mesmo alto demais) não se move.
import { describe, expect, it } from 'vitest';
import { calcularEspacadores } from '../src/interface/editor/paginacao-calculo';

// Folha de 1000 px, margens de 100 (área de texto de 100 a 900), intervalo de 20: período de 1020.
const M = { altura: 1000, margemSuperior: 100, margemInferior: 100, intervalo: 20 };

describe('folhas no editor', () => {
  it('o bloco que não cabe vai para o topo da área de texto da folha seguinte; os de baixo acompanham', () => {
    const r = calcularEspacadores(
      [
        { pos: 0, topo: 100, altura: 400 },
        { pos: 10, topo: 500, altura: 300 },
        { pos: 20, topo: 800, altura: 200 }, // passaria de 900
        { pos: 30, topo: 1000, altura: 100 },
      ],
      M,
    );
    // Vai de 800 para 1020 + 100 = 1120.
    expect(r.espacadores).toEqual([{ pos: 20, altura: 320 }]);
    expect(r.folhas).toBe(2);
  });

  it('bloco no topo da folha, mesmo mais alto que ela, fica; tudo cabendo, nenhum espaçador', () => {
    expect(calcularEspacadores([{ pos: 0, topo: 100, altura: 2000 }], M).espacadores).toEqual([]);
    expect(calcularEspacadores([{ pos: 0, topo: 100, altura: 700 }], M)).toEqual({ espacadores: [], folhas: 1 });
  });

  it('várias folhas: cada salto conta o deslocamento dos anteriores', () => {
    const blocos = Array.from({ length: 6 }, (_, i) => ({ pos: i * 10, topo: 100 + i * 350, altura: 350 }));
    const r = calcularEspacadores(blocos, M);
    expect(r.espacadores.map((e) => e.pos)).toEqual([20, 40]);
    expect(r.folhas).toBe(3);
  });
});
