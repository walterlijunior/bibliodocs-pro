/**
 * Porta `catalogo`: contrato da API `window.bibliodocs.catalogo.*` (Etapa 3 da especificação de atualização). O
 * principal lê e grava só o catálogo do usuário, num arquivo fixo da pasta de dados local; os dados iniciais vêm com a
 * interface (`aplicacao/catalogo.ts`) e a mesclagem é feita do lado de cá. O principal valida tudo o que recebe.
 */
import type { Catalogo } from '../../dominio/catalogo';

export const CANAIS_CATALOGO = {
  ler: 'bibliodocs:catalogo:ler',
  gravar: 'bibliodocs:catalogo:gravar',
  exportarFicha: 'bibliodocs:catalogo:exportarFicha',
  exportarBackup: 'bibliodocs:catalogo:exportarBackup',
} as const;

export type CanalCatalogo = (typeof CANAIS_CATALOGO)[keyof typeof CANAIS_CATALOGO];

/** O que o usuário mudou no catálogo: o catálogo dele e os ids oficiais que retirou. */
export interface CatalogoUsuario {
  catalogo: Catalogo;
  removidos: string[];
}

export type ResultadoLerCatalogo =
  | { ok: true; usuario: CatalogoUsuario | null }
  /** O arquivo existe mas não pôde ser lido: a tela usa os dados iniciais e avisa; o arquivo fica intacto. */
  | { ok: false; mensagem: string };

export type ResultadoGravarCatalogo = { ok: true } | { ok: false; mensagem: string };

/** `cancelado`: o usuário fechou a janela de salvar. */
export type ResultadoExportarFicha = { ok: true; nome: string } | { ok: false; cancelado: true } | { ok: false; cancelado: false; mensagem: string };

export interface ApiCatalogo {
  ler(): Promise<ResultadoLerCatalogo>;
  gravar(usuario: CatalogoUsuario): Promise<ResultadoGravarCatalogo>;
  /**
   * Ficha institucional (texto JSON) num arquivo escolhido pelo usuário na janela de salvar. O principal valida a ficha
   * antes de gravar; `nomeSugerido` só sugere o nome.
   */
  exportarFicha(texto: string, nomeSugerido: string): Promise<ResultadoExportarFicha>;
  /**
   * Etapa 10: backup dos cadastros e configurações (texto JSON) num arquivo escolhido pelo usuário (pasta, pendrive ou
   * outra unidade). O principal confere o formato antes de gravar.
   */
  exportarBackup(texto: string, nomeSugerido: string): Promise<ResultadoExportarFicha>;
}
