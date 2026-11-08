/**
 * Janela da remissiva (M5-T08; RF-11): escolhe a tabela, o quadro, a ilustração ou a equação numerada citada no texto. A
 * lista vem da sessão, na ordem do documento, com o rótulo e o título ("Tabela 3 – Vendas"). O texto da remissiva
 * acompanha a numeração: mudar o elemento de lugar muda o número em todo o texto.
 *
 * - Remissiva existente: o alvo atual vem marcado; quebrada, a janela avisa e pede outro.
 * - Sem elementos no trabalho: só a explicação e "Fechar".
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ElementoNaSessao } from '../../aplicacao';

export interface PropsDialogoRemissiva {
  elementos: readonly ElementoNaSessao[];
  /** Alvo da remissiva a alterar; `null` = remissiva nova. */
  alvoAtual: string | null;
  aoConfirmar: (alvo: string) => void;
  aoFechar: () => void;
}

export function DialogoRemissiva(p: PropsDialogoRemissiva) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const { elementos, alvoAtual } = p;
  const quebrada = alvoAtual !== null && !elementos.some((e) => e.id === alvoAtual);
  const [escolhido, setEscolhido] = useState<string | null>(quebrada ? null : (alvoAtual ?? elementos[0]?.id ?? null));
  const nova = alvoAtual === null;
  const acao = nova ? 'Inserir remissiva' : 'Alterar remissiva';

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      (d.querySelector<HTMLInputElement>('input:checked') ?? d.querySelector<HTMLInputElement>('input') ?? d.querySelector<HTMLButtonElement>('button'))?.focus();
    }
    return () => d?.close();
  }, []);

  const confirmar = () => {
    if (escolhido !== null) p.aoConfirmar(escolhido);
  };

  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
    >
      <form
        className="dialogo__corpo"
        onSubmit={(e) => {
          e.preventDefault();
          confirmar();
        }}
      >
        <h2 id={`${base}-titulo`}>{acao}</h2>
        {elementos.length === 0 ? (
          <p>O trabalho ainda não tem seção, apêndice, tabela, quadro, figura nem equação numerada para citar.</p>
        ) : (
          <>
            {quebrada && <p role="alert">Esta remissiva está quebrada: o elemento citado foi excluído ou a equação ficou sem número. Escolha outro.</p>}
            <fieldset className="tipos-trabalho lista-rolavel remissiva__lista">
              <legend>Elemento citado</legend>
              {elementos.map((e) => (
                <label key={e.id} className="tipos-trabalho__opcao">
                  <input type="radio" name={`${base}-alvo`} value={e.id} checked={escolhido === e.id} onChange={() => setEscolhido(e.id)} />
                  <span className="tipos-trabalho__nome">{e.descricao}</span>
                </label>
              ))}
            </fieldset>
            <p className="dialogo__nota">No texto aparece só o rótulo (“2.1” na seção, “Tabela 3”, “(2)” na equação, “APÊNDICE A”), que acompanha a numeração.</p>
          </>
        )}
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            {elementos.length === 0 ? 'Fechar' : 'Cancelar'}
          </button>
          {elementos.length > 0 && (
            <button type="submit" className="btn-principal" disabled={escolhido === null}>
              {acao}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
