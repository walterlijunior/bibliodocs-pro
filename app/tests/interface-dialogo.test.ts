// Etapa 1 da especificação de atualização (2026-11-14): todo `<dialog>` da interface com `onClose` passa por
// `aoFecharDialogo` (o comportamento está em `tests/interface/dialogo.test.tsx`). Sem isso, no `npm run dev` o
// `StrictMode` fazia o diálogo sumir logo depois de aberto ("Novo trabalho" não criava nada).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('diálogos da interface', () => {
  it('todo `onClose` passa por aoFecharDialogo', () => {
    const raiz = join(__dirname, '..', 'src', 'interface');
    const arquivos = readdirSync(raiz, { recursive: true, encoding: 'utf8' }).filter((n) => n.endsWith('.tsx'));
    const comOnClose = arquivos.filter((n) => readFileSync(join(raiz, n), 'utf8').includes('onClose='));
    expect(comOnClose.length).toBeGreaterThanOrEqual(8);
    for (const n of comOnClose) {
      const texto = readFileSync(join(raiz, n), 'utf8');
      for (const m of texto.matchAll(/onClose=\{([^\n]*)/g)) expect(m[1], n).toMatch(/^aoFecharDialogo\(/);
    }
  });
});
