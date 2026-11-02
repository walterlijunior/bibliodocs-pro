/**
 * Diálogo "Versões descartadas" (M2-T11; R-M1-10): o que está em `recuperacao-antigos` e ainda abre. Abrir uma versão
 * não altera nenhum arquivo: ela vem como trabalho sem arquivo, e só "Salvar como…" a grava.
 */
import { useEffect, useId, useRef } from 'react';
import type { IdentificadorOferta, VersaoDescartada } from '../../aplicacao';
import { quandoLegivel } from './recuperacao';

export interface PropsDialogoVersoesDescartadas {
  /** `null`: ainda listando. */
  versoes: readonly VersaoDescartada[] | null;
  /** Algum arquivo não pôde ser lido: "nenhuma versão" seria falso. */
  incompleta?: boolean;
  ocupado?: boolean;
  aoAbrir: (id: IdentificadorOferta) => void;
  aoFechar: () => void;
}

export function DialogoVersoesDescartadas(p: PropsDialogoVersoesDescartadas) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const hoje = new Date();

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
      aria-describedby={`${base}-nota`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
      onClose={p.aoFechar}
    >
      <div className="dialogo__corpo">
        <h2 id={`${base}-titulo`}>Versões descartadas</h2>
        <p id={`${base}-nota`} className="dica">
          Alterações descartadas ao fechar um trabalho ficam guardadas aqui por 7 dias. Abrir uma versão não altera nenhum arquivo: para mantê-la, use “Salvar como…”.
        </p>
        {p.incompleta && <p role="alert">Algumas versões não puderam ser lidas agora e podem não aparecer. Tente de novo.</p>}
        {p.versoes === null ? (
          <p role="status">Procurando versões…</p>
        ) : p.versoes.length === 0 ? (
          !p.incompleta && <p role="status">Nenhuma versão descartada nos últimos 7 dias.</p>
        ) : (
          <ul className="versoes lista-rolavel" aria-label="Versões descartadas">
            {p.versoes.map((v) => {
              const quando = `${quandoLegivel(v.quando, hoje)}${v.anterior ? ' (cópia anterior)' : ''}`;
              return (
              <li key={v.identificador} className="versoes__item">
                <div className="versoes__texto">
                  <span className="versoes__titulo">{v.titulo.trim() !== '' ? v.titulo : 'Trabalho sem título'}</span>
                  <span className="dica">Guardada em {quando}</span>
                </div>
                <button
                  type="button"
                  className="btn-secundario"
                  disabled={p.ocupado}
                  aria-label={`Abrir a versão de ${quando} de ${v.titulo.trim() !== '' ? v.titulo : 'trabalho sem título'}`}
                  onClick={() => p.aoAbrir(v.identificador)}
                >
                  Abrir
                </button>
              </li>
              );
            })}
          </ul>
        )}
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
