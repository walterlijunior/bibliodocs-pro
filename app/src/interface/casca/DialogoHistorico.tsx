/**
 * Histórico do trabalho (Etapa 5 da especificação de atualização): os estados guardados desde que o trabalho foi aberto
 * (antes de inserir ou retirar citação, de incluir ou excluir obra, de excluir seção, e ao salvar), do mais novo ao mais
 * antigo, com quantas citações e referências cada um tinha. Restaurar volta texto, citações e lista de referências
 * juntos; o estado atual fica no histórico. Estados de outros dias: Arquivo › Cópias de segurança…
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { PontoHistorico } from '../../aplicacao';
import { aoFecharDialogo } from './dialogo';

const hora = (iso: string): string => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

export function DialogoHistorico(p: { pontos: readonly PontoHistorico[]; aoRestaurar: (id: number) => void; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const [escolhido, setEscolhido] = useState<number | null>(p.pontos[0]?.id ?? null);
  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      (d.querySelector<HTMLInputElement>('input:checked') ?? d.querySelector<HTMLButtonElement>('button'))?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
      onClose={aoFecharDialogo(p.aoFechar)}
    >
      <form
        className="dialogo__corpo"
        onSubmit={(e) => {
          e.preventDefault();
          if (escolhido !== null) p.aoRestaurar(escolhido);
        }}
      >
        <h2 id={`${base}-titulo`}>Histórico do trabalho</h2>
        <p className="dialogo__nota">
          Estados guardados desde que o trabalho foi aberto. Restaurar volta o texto, as citações ligadas e a lista de referências daquele momento; o estado atual
          fica no histórico, para voltar a ele se precisar. Estados de outros dias estão em Arquivo › Cópias de segurança…
        </p>
        {p.pontos.length === 0 ? (
          <p>Nenhum estado guardado ainda.</p>
        ) : (
          <fieldset className="tipos-trabalho lista-rolavel historico__lista">
            <legend>Estado</legend>
            {p.pontos.map((x) => (
              <label key={x.id} className="tipos-trabalho__opcao">
                <input type="radio" name={`${base}-ponto`} value={x.id} checked={escolhido === x.id} onChange={() => setEscolhido(x.id)} />
                <span className="tipos-trabalho__nome">
                  {hora(x.em)} – {x.descricao}
                </span>
                <span className="tipos-trabalho__descricao">
                  {plural(x.citacoes, 'citação', 'citações')}, {plural(x.referencias, 'referência na lista', 'referências na lista')}, {plural(x.obras, 'obra cadastrada', 'obras cadastradas')}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            Fechar
          </button>
          {p.pontos.length > 0 && (
            <button type="submit" className="btn-principal" disabled={escolhido === null}>
              Restaurar este estado
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
