/**
 * Catálogo acadêmico na interface (Etapa 3 da especificação de atualização): o catálogo de uso (dados iniciais + o do
 * usuário) num contexto React, carregado uma vez pelo canal `catalogo.ler` e gravado a cada alteração pelo
 * `catalogo.gravar`. Sem o canal (testes da casca), vale só o catálogo inicial.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CATALOGO_INICIAL, idsRetirados, mesclarCatalogo, type ApiCatalogo, type ApiIa, type Catalogo } from '../../aplicacao';

export interface EstadoCatalogo {
  catalogo: Catalogo;
  /** Aviso para mostrar (catálogo do usuário ilegível, gravação que falhou). */
  aviso: string | null;
  /** Grava o catálogo inteiro como o do usuário (o que difere dos dados iniciais fica guardado neste computador). */
  alterar: (novo: Catalogo) => Promise<boolean>;
  /** O canal do catálogo (exportar a ficha institucional); ausente nos testes da casca. */
  api?: ApiCatalogo | undefined;
  /** O serviço de IA (preenchimento opcional da ficha institucional); ausente sem o canal. */
  ia?: ApiIa | undefined;
}

const PADRAO: EstadoCatalogo = { catalogo: CATALOGO_INICIAL, aviso: null, alterar: async () => false };
const Contexto = createContext<EstadoCatalogo>(PADRAO);

export const useCatalogo = (): EstadoCatalogo => useContext(Contexto);

export function ProvedorCatalogo({ api, ia, children }: { api: ApiCatalogo | undefined; ia?: ApiIa | undefined; children: ReactNode }) {
  const [catalogo, setCatalogo] = useState<Catalogo>(CATALOGO_INICIAL);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let vivo = true;
    void api.ler().then(
      (r) => {
        if (!vivo) return;
        if (r.ok) setCatalogo(mesclarCatalogo(CATALOGO_INICIAL, r.usuario?.catalogo ?? null, r.usuario?.removidos ?? []));
        else setAviso(r.mensagem);
      },
      () => vivo && setAviso('O catálogo acadêmico deste computador não pôde ser lido. A lista mostra só os dados iniciais.'),
    );
    return () => {
      vivo = false;
    };
  }, [api]);

  const alterar = useCallback(
    async (novo: Catalogo) => {
      setCatalogo(novo);
      if (!api) return false;
      try {
        const r = await api.gravar({ catalogo: novo, removidos: idsRetirados(CATALOGO_INICIAL, novo) });
        setAviso(r.ok ? null : r.mensagem);
        return r.ok;
      } catch {
        setAviso('Não foi possível guardar o catálogo acadêmico. A alteração vale só até fechar o aplicativo.');
        return false;
      }
    },
    [api],
  );

  const valor = useMemo(() => ({ catalogo, aviso, alterar, api, ia }), [catalogo, aviso, alterar, api, ia]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
