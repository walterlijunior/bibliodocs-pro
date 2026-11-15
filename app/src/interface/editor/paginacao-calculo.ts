/** Cálculo das folhas no editor (D-E2-07), sem DOM: roda em Node nos testes. Ver `paginacao.ts`. */

export interface MedidasFolha {
  /** Altura da folha, margens de cima e de baixo, em px já com o zoom. */
  altura: number;
  margemSuperior: number;
  margemInferior: number;
  /** Intervalo entre as folhas, em px. */
  intervalo: number;
}

export interface Espacador {
  pos: number;
  altura: number;
}

/**
 * Onde pôr os espaçadores: `blocos` são os blocos do topo na ordem, com a posição no documento, o topo "natural" (sem
 * os espaçadores atuais) e a altura. Pura (testável em Node).
 */
export function calcularEspacadores(blocos: readonly { pos: number; topo: number; altura: number }[], m: MedidasFolha): { espacadores: Espacador[]; folhas: number } {
  const periodo = m.altura + m.intervalo;
  const espacadores: Espacador[] = [];
  let desloc = 0;
  let fim = m.margemSuperior;
  for (const b of blocos) {
    const topo = b.topo + desloc;
    const k = Math.max(0, Math.floor(topo / periodo));
    const inicioTexto = k * periodo + m.margemSuperior;
    const fimTexto = k * periodo + m.altura - m.margemInferior;
    if (topo + b.altura > fimTexto + 1 && topo > inicioTexto + 1) {
      const altura = (k + 1) * periodo + m.margemSuperior - topo;
      espacadores.push({ pos: b.pos, altura });
      desloc += altura;
    }
    fim = Math.max(fim, b.topo + desloc + b.altura);
  }
  const folhas = Math.max(1, Math.ceil((fim + m.margemInferior) / periodo));
  return { espacadores, folhas };
}

