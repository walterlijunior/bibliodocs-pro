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
        // leitor-projeto: processo utilitário que abre os .bdp fora do principal (M1-T08).
        // empacotador: worker que empacota o .bdp fora da thread do principal (M2-T01).
        input: {
          index: resolve(raiz, 'src/principal/index.ts'),
          'leitor-projeto': resolve(raiz, 'src/principal/leitor-projeto.ts'),
          empacotador: resolve(raiz, 'src/principal/empacotador.ts'),
          // exportador-docx: processo utilitário que gera o DOCX (M3-T05).
          'exportador-docx': resolve(raiz, 'src/principal/exportador-docx.ts'),
        },
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
