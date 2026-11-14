/**
 * Evento `close` dos diálogos modais (`<dialog>`), que só repassa o fechamento quando o diálogo está de fato fechado.
 *
 * Por quê: cada diálogo abre com `showModal()` num efeito e fecha com `close()` na limpeza. No React em modo de
 * desenvolvimento (`StrictMode`, usado no `npm run dev`), o efeito roda, é desfeito e roda de novo ao montar: o
 * `close()` da limpeza enfileira um evento `close` que só chega depois do segundo `showModal()`. Tratado como
 * "Cancelar", ele desmontava o diálogo recém-aberto, e "Novo trabalho" (e os demais diálogos) sumia antes do clique em
 * "Criar trabalho" (Etapa 1 da especificação de atualização, 2026-11-14). Com o diálogo aberto, o evento é atrasado e
 * é ignorado; os fechamentos reais (Esc repetido, `close()` do Chromium) chegam com ele fechado.
 */
import type { SyntheticEvent } from 'react';

export function aoFecharDialogo(fechar: () => void): (e: SyntheticEvent<HTMLDialogElement>) => void {
  return (e) => {
    if (!e.currentTarget.open) fechar();
  };
}
