// Configuração de build do BiblioDocs Pro (electron-vite 6 + Vite 8).
// Três alvos: processo principal (src/principal), preload (src/preload) e renderer (src/interface).
// Decisão: ADR-0003 (tecnologia) e ADR-0005 (módulos). Endurecimento do runtime: M1-T02.
import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const raiz = import.meta.dirname;

export default defineConfig({
  main: {
    build: {
      outDir: 'out/principal',
      rollupOptions: {
        input: { index: resolve(raiz, 'src/principal/index.ts') },
      },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(raiz, 'src/preload/index.ts') },
        // Preload com sandbox: o Electron só aceita CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(raiz, 'src/interface'),
    plugins: [react()],
    build: {
      outDir: resolve(raiz, 'out/interface'),
      rollupOptions: {
        input: { index: resolve(raiz, 'src/interface/index.html') },
      },
    },
  },
});
