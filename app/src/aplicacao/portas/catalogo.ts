/**
 * Porta `catalogo`: contrato da API `window.bibliodocs.catalogo.*` (Etapa 3 da especificação de atualização). O
 * principal lê e grava só o catálogo do usuário, num arquivo fixo da pasta de dados local; os dados iniciais vêm com a
 * interface (`aplicacao/catalogo.ts`) e a mesclagem é feita do lado de cá. O principal valida tudo o que recebe.
 */
import type { Catalogo } from '../../dominio/catalogo';

export const CANAIS_CATALOGO = {
  ler: 'bibliodocs:catalogo:ler',
  gravar: 'bibliodocs:catalogo:gravar',
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

export interface ApiCatalogo {
  ler(): Promise<ResultadoLerCatalogo>;
  gravar(usuario: CatalogoUsuario): Promise<ResultadoGravarCatalogo>;
}
