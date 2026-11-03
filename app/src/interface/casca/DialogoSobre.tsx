/** Diálogo "Sobre" (M3-T11; RNF-15, C-19): versão e licenças dos componentes de terceiros, o mesmo texto de `TERCEIROS.txt`. */
import { useEffect, useId, useRef } from 'react';
import terceiros from '../../../recursos-build/TERCEIROS.txt?raw';
import { version } from '../../../package.json';

export function DialogoSobre({ aoFechar }: { aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) d.showModal();
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
        aoFechar();
      }}
      onClose={aoFechar}
    >
      <div className="dialogo__corpo">
        <h2 id={`${base}-titulo`}>Sobre o BiblioDocs Pro</h2>
        <p>Versão {version}</p>
        <h3 id={`${base}-terceiros`}>Componentes de terceiros</h3>
        {/* Rolável por teclado: sem nada focável dentro, o foco precisa poder entrar na área. */}
        <pre className="terceiros lista-rolavel" tabIndex={0} aria-labelledby={`${base}-terceiros`}>
          {terceiros}
        </pre>
        <div className="dialogo__acoes">
          <button type="button" className="btn-principal" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
