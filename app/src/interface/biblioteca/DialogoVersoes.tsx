/**
 * Diálogo "Versões descartadas" (M2-T11; R-M1-10) e "Cópias de segurança" (M3-T09): o que está guardado e ainda abre. Abrir
 * não altera nenhum arquivo: a versão vem como trabalho sem arquivo, e só "Salvar como…" a grava.
 */
import { useEffect, useId, useRef } from 'react';
import type { IdentificadorOferta, VersaoDescartada } from '../../aplicacao';
import { quandoLegivel } from './recuperacao';

export type OrigemVersoes = 'descartadas' | 'backups';

const TEXTOS: Readonly<Record<OrigemVersoes, { titulo: string; nota: string; vazio: string; data: string; artigo: string }>> = {
  descartadas: {
    titulo: 'Versões descartadas',
    nota: 'Alterações descartadas ao fechar um trabalho ficam guardadas aqui por 7 dias. Abrir uma versão não altera nenhum arquivo: para mantê-la, use “Salvar como…”.',
    vazio: 'Nenhuma versão descartada nos últimos 7 dias.',
    data: 'Guardada em',
    artigo: 'a versão',
  },
  backups: {
    titulo: 'Cópias de segurança',
    nota: 'Ao salvar por cima de um trabalho, o aplicativo guarda a versão anterior. Depois de excluir um trabalho, as cópias dele ficam por 30 dias. Abrir uma cópia não altera nenhum arquivo: para mantê-la, use “Salvar como…”.',
    vazio: 'Ainda não há cópias de segurança.',
    data: 'Cópia de',
    artigo: 'a cópia',
  },
};

export interface PropsDialogoVersoes {
  origem: OrigemVersoes;
  /** `null`: ainda listando. */
  versoes: readonly VersaoDescartada[] | null;
  /** Algum arquivo não pôde ser lido: "nenhuma versão" seria falso. */
  incompleta?: boolean;
  ocupado?: boolean;
  aoAbrir: (id: IdentificadorOferta) => void;
  aoFechar: () => void;
}

export function DialogoVersoes(p: PropsDialogoVersoes) {
  const t = TEXTOS[p.origem];
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
        <h2 id={`${base}-titulo`}>{t.titulo}</h2>
        <p id={`${base}-nota`} className="dica">
          {t.nota}
        </p>
        {p.incompleta && <p role="alert">Algumas versões não puderam ser lidas ou não couberam na lista: podem não aparecer.</p>}
        {p.versoes === null ? (
          <p role="status">Procurando versões…</p>
        ) : p.versoes.length === 0 ? (
          !p.incompleta && <p role="status">{t.vazio}</p>
        ) : (
          <ul className="versoes lista-rolavel" aria-label={t.titulo}>
            {p.versoes.map((v) => {
              const quando = `${quandoLegivel(v.quando, hoje)}${v.anterior ? ' (cópia anterior)' : ''}`;
              return (
              <li key={v.identificador} className="versoes__item">
                <div className="versoes__texto">
                  <span className="versoes__titulo">{v.titulo.trim() !== '' ? v.titulo : 'Trabalho sem título'}</span>
                  <span className="dica">{t.data} {quando}</span>
                </div>
                <button
                  type="button"
                  className="btn-secundario"
                  disabled={p.ocupado}
                  aria-label={`Abrir ${t.artigo} de ${quando} de ${v.titulo.trim() !== '' ? v.titulo : 'trabalho sem título'}`}
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
