// Etapa 1 da especificação de atualização (2026-11-14): "Novo trabalho" sumia no `npm run dev`. O `StrictMode` desfaz e
// refaz o efeito do diálogo; o evento `close` da limpeza chegava com o diálogo já reaberto e era tratado como Cancelar.
// A varredura de que todo diálogo usa `aoFecharDialogo` precisa de Node: está em `tests/interface-dialogo.test.ts`.
import type { SyntheticEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { aoFecharDialogo } from '../../src/interface/casca/dialogo';

const evento = (open: boolean) => ({ currentTarget: { open } }) as unknown as SyntheticEvent<HTMLDialogElement>;

describe('aoFecharDialogo', () => {
  it('ignora o `close` atrasado que chega com o diálogo aberto de novo (StrictMode)', () => {
    const fechar = vi.fn();
    aoFecharDialogo(fechar)(evento(true));
    expect(fechar).not.toHaveBeenCalled();
  });

  it('repassa o fechamento real, com o diálogo fechado', () => {
    const fechar = vi.fn();
    aoFecharDialogo(fechar)(evento(false));
    expect(fechar).toHaveBeenCalledOnce();
  });
});
