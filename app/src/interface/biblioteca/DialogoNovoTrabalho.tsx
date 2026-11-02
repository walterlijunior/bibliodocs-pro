/**
 * Diálogo "Novo trabalho" (M2-T02; RF-02): o autor escolhe o tipo, e o trabalho nasce com os elementos e as seções do
 * tipo. `<dialog>` modal do próprio Chromium: prende o foco e fecha com Esc; o resto da janela fica inerte.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { TipoTrabalhoUft } from '../../dominio/modelo';
import { ROTULOS_TIPO, TIPOS_NOVO_TRABALHO } from './selecao';

export interface PropsDialogoNovoTrabalho {
  /** Tipo marcado ao abrir (o último escolhido na sessão). */
  inicial: TipoTrabalhoUft;
  /** Outra troca de trabalho em curso: "Criar trabalho" fica desativado. */
  ocupado?: boolean;
  aoCriar: (tipo: TipoTrabalhoUft) => void;
  aoCancelar: () => void;
}

export function DialogoNovoTrabalho(p: PropsDialogoNovoTrabalho) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tipo, setTipo] = useState(p.inicial);
  const base = useId();

  // O diálogo sai da página ao fechar, e o Chromium só devolve o foco de um `<dialog>` que continua nela: o foco volta
  // aqui a quem abriu (se ainda existe; ao criar, a aba Escrever põe o foco no título depois).
  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      // O `autoFocus` do React age antes do `showModal` e não vale: o foco vai ao tipo marcado (revisão do M2-T02, M2).
      d.querySelector<HTMLInputElement>('input:checked')?.focus();
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
      aria-describedby={`${base}-nota`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoCancelar();
      }}
      // Fechado à força pelo Chromium (Esc repetido sem ativação): o estado acompanha.
      onClose={p.aoCancelar}
    >
      <form
        className="dialogo__corpo"
        onSubmit={(e) => {
          e.preventDefault();
          p.aoCriar(tipo);
        }}
      >
        <h2 id={`${base}-titulo`}>Novo trabalho</h2>
        <p id={`${base}-nota`} className="dica">
          O trabalho é gravado na pasta da Biblioteca assim que for criado.
        </p>
        <fieldset className="tipos-trabalho lista-rolavel">
          <legend>Tipo de trabalho</legend>
          {TIPOS_NOVO_TRABALHO.map((t) => (
            <label key={t.id} className="tipos-trabalho__opcao">
              <input
                type="radio"
                name={`${base}-tipo`}
                value={t.id}
                checked={tipo === t.id}
                onChange={() => setTipo(t.id)}
                // Nome só com o rótulo; a descrição vem uma vez, pelo `aria-describedby` (revisão do M2-T02, A1).
                aria-labelledby={`${base}-${t.id}-nome`}
                aria-describedby={`${base}-${t.id}`}
              />
              <span id={`${base}-${t.id}-nome`} className="tipos-trabalho__nome">
                {ROTULOS_TIPO[t.id]}
              </span>
              <span id={`${base}-${t.id}`} className="dica">
                {t.descricao}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoCancelar}>
            Cancelar
          </button>
          <button type="submit" className="btn-principal" disabled={p.ocupado}>
            Criar trabalho
          </button>
        </div>
      </form>
    </dialog>
  );
}
