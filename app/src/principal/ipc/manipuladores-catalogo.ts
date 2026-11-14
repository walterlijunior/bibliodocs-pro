/**
 * Canais `bibliodocs:catalogo:*` (Etapa 3 da especificação de atualização): ler e gravar o catálogo acadêmico do
 * usuário num arquivo fixo da pasta de dados local. Nenhum caminho vem do renderer; o que chega é validado pelo esquema
 * do catálogo antes de gravar. Gravações em fila (a segunda espera a primeira).
 */
import { CANAIS_CATALOGO, type CanalCatalogo, type ResultadoGravarCatalogo, type ResultadoLerCatalogo } from '../../aplicacao/portas/catalogo';
import { validarCatalogoUsuario } from '../../dominio/esquemas';
import { gravarCatalogoUsuario, lerCatalogoUsuario, SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../../persistencia';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { criarConferencia, type Manipulador } from './chamada';

export const MENSAGEM_CATALOGO_ILEGIVEL =
  'O catálogo acadêmico deste computador não pôde ser lido. A lista mostra só os dados iniciais; o arquivo não foi alterado.';
export const MENSAGEM_CATALOGO_NAO_GRAVADO = 'Não foi possível guardar o catálogo acadêmico. A alteração vale só até fechar o aplicativo.';

export interface DependenciasCatalogo {
  origem: OrigemPermitida;
  conteudosPermitidos: () => ReadonlySet<number>;
  /** `%LOCALAPPDATA%\BiblioDocsPro\catalogo.json`. */
  arquivo: string;
  fs?: SistemaArquivos;
  log?: (m: string) => void;
}

export function criarManipuladoresCatalogo(dep: DependenciasCatalogo): Readonly<Record<CanalCatalogo, Manipulador>> {
  const log = dep.log ?? ((m: string) => console.warn(m));
  const fs = dep.fs ?? SISTEMA_ARQUIVOS_NODE;
  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, log);
  let fila: Promise<unknown> = Promise.resolve();
  const emFila = <T>(f: () => Promise<T>): Promise<T> => {
    const r = fila.then(f, f);
    fila = r.catch(() => undefined);
    return r;
  };

  const ler: Manipulador = async (r, argumentos): Promise<ResultadoLerCatalogo> => {
    conferir(CANAIS_CATALOGO.ler, r, argumentos, 0);
    return emFila(async () => {
      const { catalogo, descarte } = await lerCatalogoUsuario(dep.arquivo, fs);
      if (descarte !== null) {
        log(`[catalogo] catálogo do usuário descartado: ${descarte}`);
        return { ok: false, mensagem: MENSAGEM_CATALOGO_ILEGIVEL };
      }
      return { ok: true, usuario: catalogo };
    });
  };

  const gravar: Manipulador = async (r, argumentos): Promise<ResultadoGravarCatalogo> => {
    const canal = CANAIS_CATALOGO.gravar;
    conferir(canal, r, argumentos, 1);
    const v = validarCatalogoUsuario(argumentos[0]);
    if (!v.ok) return recusarArgumento(canal, `catálogo (${v.erro})`);
    return emFila(async () => {
      const g = await gravarCatalogoUsuario(dep.arquivo, v.valor, fs);
      if (!g.ok) {
        log(`[catalogo] gravação falhou: ${g.codigo}`);
        return { ok: false, mensagem: MENSAGEM_CATALOGO_NAO_GRAVADO };
      }
      return { ok: true };
    });
  };

  return { [CANAIS_CATALOGO.ler]: ler, [CANAIS_CATALOGO.gravar]: gravar } as Record<CanalCatalogo, Manipulador>;
}
