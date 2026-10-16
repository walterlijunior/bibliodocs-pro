/**
 * Preload — roda isolado (contextIsolation) e com sandbox, antes do renderer.
 *
 * Não é um módulo de domínio do ADR-0005: é a ponte entre `interface/` e `principal/`.
 * A API tipada `window.bibliodocs.*` (contextBridge + IPC validado) é criada no M1-T08.
 * A saída é CommonJS (`out/preload/index.cjs`), exigência do Electron para preload com sandbox.
 */
export {};
