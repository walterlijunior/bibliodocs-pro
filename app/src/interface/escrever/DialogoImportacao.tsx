/**
 * Janela "Importar obras" (M4-T09; RF-08): o que o arquivo BibTeX ou RIS trouxe, antes de gravar. Cada registro mostra
 * a referência como sairá no documento, o que impede gravar, os avisos e os campos do arquivo que ficaram de fora. Vêm
 * marcadas as obras válidas que ainda não estão no trabalho; nada entra sem o botão. Texto sempre como texto.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ItemImportacao, PreviaImportacao } from '../../aplicacao';

export interface PropsDialogoImportacao {
  nomeArquivo: string;
  previa: PreviaImportacao;
  /** Aviso da leitura do arquivo (codificação). */
  avisoArquivo: string | null;
  aoImportar: (itens: readonly ItemImportacao[]) => void;
  aoFechar: () => void;
}

const FORMATO = { bibtex: 'BibTeX', ris: 'RIS' } as const;

export function DialogoImportacao(p: PropsDialogoImportacao) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const [marcadas, setMarcadas] = useState<ReadonlySet<number>>(() => new Set(p.previa.itens.flatMap((i, k) => (i.importavel && !i.duplicada ? [k] : []))));

  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('input:not([disabled]), button')?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  const { itens } = p.previa;
  const naoImportaveis = itens.filter((i) => !i.importavel).length;
  const n = marcadas.size;
  const alternar = (k: number, sim: boolean) =>
    setMarcadas((m) => {
      const novo = new Set(m);
      if (sim) novo.add(k);
      else novo.delete(k);
      return novo;
    });

  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--citacao"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
      onClose={p.aoFechar}
    >
      <div className="dialogo__corpo">
        <h2 id={`${base}-titulo`}>Importar obras</h2>
        <p>
          {p.previa.formato === null ? `“${p.nomeArquivo}”` : `“${p.nomeArquivo}” (${FORMATO[p.previa.formato]})`}:{' '}
          {itens.length === 0
            ? 'nenhum registro encontrado.'
            : `${itens.length} ${itens.length === 1 ? 'registro' : 'registros'}${naoImportaveis > 0 ? `, ${naoImportaveis} que não ${naoImportaveis === 1 ? 'pode ser importado' : 'podem ser importados'}` : ''}. Confira antes de importar.`}
        </p>
        {(p.avisoArquivo !== null || p.previa.avisos.length > 0) && (
          <ul className="avisos" aria-label="Avisos do arquivo">
            {[...(p.avisoArquivo ? [p.avisoArquivo] : []), ...p.previa.avisos].map((a) => (
              <li key={a} className="aviso">
                <span className="aviso__texto">{a}</span>
              </li>
            ))}
          </ul>
        )}
        {itens.length > 0 && (
          <ul className="importacao__lista lista-rolavel" aria-label="Registros do arquivo">
            {itens.map((i, k) => (
              <li key={k} className="importacao__item">
                <label className="elemento__marcar">
                  <input type="checkbox" checked={marcadas.has(k)} disabled={!i.importavel} onChange={(ev) => alternar(k, ev.target.checked)} />
                  <span className="obra__referencia">{i.referencia !== '' && i.importavel ? i.referencia : `${i.origem} (${i.tipoOriginal})`}</span>
                </label>
                <ul className="importacao__notas">
                  {i.duplicada && <li>Já está no trabalho ou repete um registro anterior.</li>}
                  {i.erros.map((e) => (
                    <li key={`${e.caminho}-${e.mensagem}`} className="importacao__erro">
                      Não pode ser gravada: {e.mensagem}.
                    </li>
                  ))}
                  {i.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {i.ignorados.length > 0 && <li>Ficou de fora do arquivo: {i.ignorados.join(', ')}.</li>}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="dialogo__acoes">
          <button type="button" className="btn-principal" disabled={n === 0} onClick={() => p.aoImportar(itens.filter((_, k) => marcadas.has(k)))}>
            {n === 1 ? 'Importar 1 obra' : `Importar ${n} obras`}
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </dialog>
  );
}
