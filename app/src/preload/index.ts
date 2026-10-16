/**
 * Preload — roda isolado (contextIsolation) e com sandbox, antes do renderer.
 *
 * Não é um módulo de domínio do ADR-0005: é a ponte entre `interface/` e `principal/`.
 * Expõe só `window.bibliodocs` (M1-T08, C-10), montada em `api.ts`; nunca o `ipcRenderer` cru.
 * A saída é CommonJS (`out/preload/index.cjs`), exigência do Electron para preload com sandbox.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { criarApiBiblioDocs } from './api';

contextBridge.exposeInMainWorld(
  'bibliodocs',
  criarApiBiblioDocs((canal, ...argumentos) => ipcRenderer.invoke(canal, ...argumentos)),
);
