/**
 * Porta `fontes`: contrato da API `window.bibliodocs.fontes.*` (Etapa 5 da especificação de atualização). A obra pode ter
 * um PDF no computador, guardado só pelo caminho (o arquivo não entra no `.bdp`). O principal escolhe o arquivo pela
 * janela do sistema e abre no leitor padrão só um `.pdf` que existe; o link da obra não é aberto pelo aplicativo (a
 * política de links externos, C-6, aceita só hosts de uma lista fixa): a tela oferece copiar o endereço.
 */
export const CANAIS_FONTES = {
  escolherPdf: 'bibliodocs:fontes:escolherPdf',
  abrirPdf: 'bibliodocs:fontes:abrirPdf',
} as const;

export type CanalFontes = (typeof CANAIS_FONTES)[keyof typeof CANAIS_FONTES];

/** `null` = cancelado. */
export type ResultadoEscolherPdf = { caminho: string } | null;

export type ResultadoAbrirPdf = { ok: true } | { ok: false; mensagem: string };

export interface ApiFontes {
  escolherPdf(): Promise<ResultadoEscolherPdf>;
  abrirPdf(caminho: string): Promise<ResultadoAbrirPdf>;
}
