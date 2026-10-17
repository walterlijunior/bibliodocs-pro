/**
 * Ids de blocos e notas criados no editor (M2-T05; ADR-0007, seção 2, e adendo do M2-T04, R38).
 *
 * Formato: `<prefixo>_<16 caracteres base64url>`, dentro do `PADRAO_ID` do formato v1. A interface só importa tipos do
 * domínio (ADR-0005, regra 4), por isso o padrão é repetido aqui; `tests/editor-ids.test.ts` confere que é o mesmo.
 */

/** Cópia de `PADRAO_ID` (`dominio/esquemas/projeto-v1.ts`). */
export const PADRAO_ID_EDITOR = /^[A-Za-z0-9_-]{8,64}$/;

/** Gera um id novo com o prefixo do tipo de nó (`PREFIXO_ID` do esquema). Injetável nos testes. */
export type GeradorId = (prefixo: string) => string;

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** 16 caracteres de 64 símbolos = 96 bits de `crypto.getRandomValues` (renderer e Node 24). */
export const gerarId: GeradorId = (prefixo) => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = '';
  for (const b of bytes) s += ALFABETO[b & 63];
  return `${prefixo}_${s}`;
};
