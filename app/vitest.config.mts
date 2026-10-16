// Configuração do Vitest (ADR-0006). Separada do electron.vite.config.mts para que os testes
// rodem em Node puro, sem os alvos do Electron.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
