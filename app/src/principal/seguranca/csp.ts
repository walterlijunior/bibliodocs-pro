/**
 * Política de Segurança de Conteúdo (CSP) do renderer — item C-4 do checklist de endurecimento
 * (docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md). Módulo puro: não importa electron nem node:*.
 *
 * Produção (`app://interface/...`): a CSP é exatamente a do checklist e vai como cabeçalho
 * `Content-Security-Policy` em toda resposta do protocolo `app://` (ver `protocolo-caminho.ts` e
 * `endurecimento.ts`). Não há `<meta>` no index.html: o `frame-ancestors` é ignorado em `<meta>` e
 * a meta valeria também no modo de desenvolvimento, onde quebraria o Vite.
 *
 * Desenvolvimento (`npm run dev`): o Vite + @vitejs/plugin-react injetam um script inline (preâmbulo
 * do React Refresh), estilos inline (CSS por JS) e usam WebSocket para o HMR. A CSP de
 * desenvolvimento libera só isso, e só para a origem exata do servidor dev (ELECTRON_RENDERER_URL).
 * Ela é aplicada pelo processo principal por `webRequest.onHeadersReceived`, só quando o app não
 * está empacotado e a URL dev existe; nunca entra no build (`out/`), porque não há CSP no HTML.
 */

/** CSP de produção, idêntica ao checklist C-4 (ordem e texto). */
export const CSP_PRODUCAO =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; " +
  "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/**
 * CSP de desenvolvimento para a origem do servidor Vite (ex.: `http://localhost:5173`).
 * Diferenças em relação à produção, todas necessárias ao Vite dev:
 * - `script-src` com `'unsafe-inline'` (preâmbulo inline do React Refresh);
 * - `style-src` com `'unsafe-inline'` (o Vite injeta `<style>` para o CSS importado);
 * - `connect-src` com `ws://` da mesma origem (HMR).
 * Continua sem `'unsafe-eval'` e sem nenhuma origem remota.
 *
 * @param origemDev origem `http://host:porta` já validada por `origemDeDesenvolvimento`.
 */
export function cspDesenvolvimento(origemDev: { readonly protocolo: string; readonly host: string }): string {
  const http = `${origemDev.protocolo}//${origemDev.host}`;
  const ws = `ws://${origemDev.host}`;
  return (
    `default-src 'none'; script-src ${http} 'unsafe-inline'; style-src ${http} 'unsafe-inline'; ` +
    `img-src ${http} data: blob:; font-src ${http}; connect-src ${http} ${ws}; object-src 'none'; ` +
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  );
}
