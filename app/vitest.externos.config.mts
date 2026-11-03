// Testes que dependem de programas fora do Node: validador OOXML, LibreOffice e Word (M3-T07; ADR-0006, camadas 6 e 7).
// Sem o programa, o grupo pula com aviso. Um por vez: o Word e o LibreOffice não gostam de instâncias concorrentes.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/externos/**/*.externo.ts'],
    environment: 'node',
    testTimeout: 180_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
