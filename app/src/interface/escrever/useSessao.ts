/**
 * Liga a `SessaoTrabalho` (aplicacao/servicos, M1-T11) ao React: uma sessão por janela, temporizador do navegador
 * para o salvamento automático e o estado lido por `useSyncExternalStore`.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SessaoTrabalho, type ApiBiblioDocs } from '../../aplicacao';

export function useSessao(api: ApiBiblioDocs, aoSalvar: () => void) {
  const refAoSalvar = useRef(aoSalvar);
  useEffect(() => {
    refAoSalvar.current = aoSalvar;
  }, [aoSalvar]);

  const [sessao] = useState(
    () =>
      new SessaoTrabalho({
        api: api.projetos,
        agora: () => new Date(),
        agendar: (acao, ms) => {
          const t = window.setTimeout(acao, ms);
          return () => window.clearTimeout(t);
        },
        aoSalvar: () => refAoSalvar.current(),
      }),
  );
  useEffect(() => () => sessao.encerrar(), [sessao]);

  const estado = useSyncExternalStore(sessao.assinar, sessao.obterEstado, sessao.obterEstado);
  return { sessao, estado };
}
