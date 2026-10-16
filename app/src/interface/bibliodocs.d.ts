// Tipo de `window.bibliodocs`, exposta pelo preload (M1-T08). O contrato mora em aplicacao/portas/projetos.ts.
import type { ApiBiblioDocs } from '../aplicacao';

declare global {
  interface Window {
    readonly bibliodocs: ApiBiblioDocs;
  }
}

export {};
