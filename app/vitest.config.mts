// Configuração do Vitest (ADR-0006). Separada do electron.vite.config.mts para que os testes
// rodem em Node puro, sem os alvos do Electron.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // .test.tsx: renderização da interface com react-dom/server (M1-T10), ainda em Node.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
  },
});
