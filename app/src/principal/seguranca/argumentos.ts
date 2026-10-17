/**
 * Argumentos de linha de comando do app empacotado — função pura (sem electron, sem node:*), testada em
 * tests/seguranca-argumentos.test.ts. Achado A-1 da revisão do M1-T14 (complementa C-13 e C-15):
 * nenhum fuse cobre as chaves do Chromium, e `--remote-debugging-port` abre no pacote uma porta CDP sem senha no
 * 127.0.0.1 (equivale às DevTools e alcança o documento aberto). Um atalho `.lnk` alterado bastaria para expor toda
 * abertura do app. Por isso, no app empacotado, toda chave (`-x`, `--x`, `/x`) antes de um `--` é recusada,
 * exceto as da lista de permissão. O que vem depois de `--` é dado (ex.: arquivo, quando houver associação `.bdp`).
 *
 * Exceções:
 * - `--updated`: o instalador NSIS abre o app com ela depois de uma atualização (app-builder-lib,
 *   templates/nsis/common.nsh). O app a ignora;
 * - só no artefato de fumaça (`npm run dist:fumaca`, marca `bibliodocsFumaca` no package.json do ASAR, que a
 *   integridade do ASAR protege): a porta de depuração, o perfil e o net-log que a fumaça do pacote usa.
 *   O instalador nunca leva a marca (tests/empacotamento.test.ts).
 */

/** Chaves sempre aceitas no app empacotado (forma exata). */
const SEMPRE_PERMITIDAS: readonly RegExp[] = [/^--updated$/];

/** Chaves aceitas só no artefato de fumaça. */
const PERMITIDAS_NA_FUMACA: readonly RegExp[] = [
  /^--remote-debugging-port=\d{4,5}$/,
  /^--user-data-dir=.+$/,
  /^--log-net-log=.+$/,
];

/** No Windows o Chromium aceita `-x`, `--x` e `/x` como chave. */
const ehChave = (argumento: string): boolean => argumento.startsWith('-') || argumento.startsWith('/');

/**
 * Primeiro argumento recusado, ou `null` se todos podem seguir.
 * `argumentos` = `process.argv.slice(1)` (sem o executável).
 */
export function argumentoRecusado(argumentos: readonly string[], fumaca: boolean): string | null {
  const permitidas = fumaca ? [...SEMPRE_PERMITIDAS, ...PERMITIDAS_NA_FUMACA] : SEMPRE_PERMITIDAS;
  for (const argumento of argumentos) {
    if (argumento === '--') return null;
    if (ehChave(argumento) && !permitidas.some((p) => p.test(argumento))) return argumento;
  }
  return null;
}

/** Código de saída quando um argumento é recusado. */
export const SAIDA_ARGUMENTO_RECUSADO = 2;
