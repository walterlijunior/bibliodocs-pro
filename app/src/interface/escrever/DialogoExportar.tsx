/**
 * Diálogo "Exportar DOCX" (M3-T08; RF-06): escolhe a fonte aceita pelo Manual e mostra o resultado com os avisos. O local
 * do arquivo é escolhido no diálogo do sistema. A escolha da fonte vale para a sessão: o trabalho ainda não a guarda.
 */
import { useEffect, useId, useRef } from 'react';

export type EstadoExportacao =
  | { etapa: 'escolher' }
  | { etapa: 'exportando' }
  | { etapa: 'concluido'; nomeArquivo: string; avisos: readonly string[] }
  | { etapa: 'erro'; mensagem: string };

export const FONTES_EXPORTACAO = ['Times New Roman', 'Arial'] as const;

export interface PropsDialogoExportar {
  estado: EstadoExportacao;
  fonte: string;
  aoEscolherFonte: (fonte: string) => void;
  aoExportar: () => void;
  aoFechar: () => void;
}

export function DialogoExportar(p: PropsDialogoExportar) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const { estado } = p;

  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLInputElement>('input:checked')?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  const exportando = estado.etapa === 'exportando';
  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        if (!exportando) p.aoFechar();
      }}
      onClose={() => {
        if (!exportando) p.aoFechar();
      }}
    >
      <div className="dialogo__corpo">
        <h2 id={`${base}-titulo`}>Exportar DOCX</h2>
        {(estado.etapa === 'escolher' || estado.etapa === 'erro') && (
          <fieldset className="tipos-trabalho">
            <legend>Fonte</legend>
            {FONTES_EXPORTACAO.map((f) => (
              <label key={f} className="tipos-trabalho__opcao">
                <input type="radio" name={`${base}-fonte`} value={f} checked={p.fonte === f} onChange={() => p.aoEscolherFonte(f)} />
                <span className="tipos-trabalho__nome">{f}</span>
              </label>
            ))}
          </fieldset>
        )}
        {estado.etapa === 'erro' && <p role="alert">{estado.mensagem}</p>}
        {exportando && <p role="status">Gerando o arquivo…</p>}
        {estado.etapa === 'concluido' && (
          <>
            <p role="status">“{estado.nomeArquivo}” foi exportado. Se o trabalho mudar no Word, atualize o sumário com F9.</p>
            {estado.avisos.length > 0 && (
              <>
                <p>Confira antes de entregar:</p>
                <ul className="versoes lista-rolavel" aria-label="Avisos da exportação">
                  {estado.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <div className="dialogo__acoes">
          {estado.etapa === 'concluido' ? (
            <button type="button" className="btn-principal" onClick={p.aoFechar}>
              Fechar
            </button>
          ) : (
            <>
              <button type="button" className="btn-secundario" disabled={exportando} onClick={p.aoFechar}>
                Cancelar
              </button>
              <button type="button" className="btn-principal" disabled={exportando} onClick={p.aoExportar}>
                Exportar…
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
