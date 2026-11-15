/**
 * Busca no documento (Etapa 2 da especificação de atualização, D-E2-05), no painel lateral de Escrever: o termo é
 * procurado nos títulos e no texto das seções, sem diferença de maiúsculas nem de acentos; cada resultado mostra a
 * seção e o trecho com o contexto, e o clique (ou Enter no campo, que avança de um em um) leva ao trecho selecionado.
 * Texto sempre como texto (nunca HTML).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ResultadoBusca } from '../../aplicacao';
import { AjudaContextual, TextoAjuda } from '../casca/AjudaContextual';

export function BuscaDocumento(p: { buscar: (termo: string) => ResultadoBusca[]; aoIr: (r: ResultadoBusca) => void; pedidoFoco?: number }) {
  const base = useId();
  const [termo, setTermo] = useState('');
  const [atual, setAtual] = useState(-1);
  const refCampo = useRef<HTMLInputElement>(null);
  const resultados = useMemo(() => (termo.trim().length >= 2 ? p.buscar(termo) : []), [termo, p]);

  useEffect(() => {
    if (!p.pedidoFoco) return;
    refCampo.current?.focus();
    refCampo.current?.select();
  }, [p.pedidoFoco]);

  const ir = (k: number) => {
    const r = resultados[k];
    if (!r) return;
    setAtual(k);
    p.aoIr(r);
  };

  return (
    <section className="busca-documento" aria-labelledby={`${base}-t`}>
      <h2 id={`${base}-t`} className="sr-only">
        Buscar no documento
      </h2>
      <div className="busca-documento__linha">
      <input
        ref={refCampo}
        type="search"
        className="campo"
        aria-label="Buscar no documento"
        placeholder="Buscar no documento"
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setAtual(-1);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || resultados.length === 0) return;
          e.preventDefault();
          ir(e.shiftKey ? (atual <= 0 ? resultados.length - 1 : atual - 1) : (atual + 1) % resultados.length);
        }}
      />
      <AjudaContextual titulo="Buscar no documento">
        <TextoAjuda>Procura nos títulos e no texto de todas as seções, sem diferença de maiúsculas nem de acentos (“funcao” acha “Função”), a partir de duas letras.</TextoAjuda>
        <TextoAjuda>Clique num resultado, ou use Enter e Shift+Enter no campo, para ir ao trecho, que fica selecionado. Ctrl+F nesta aba volta ao campo.</TextoAjuda>
      </AjudaContextual>
      </div>
      {termo.trim().length >= 2 && (
        <p className="dica" role="status">
          {resultados.length === 0 ? 'Nada encontrado.' : `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}${atual >= 0 ? ` (${atual + 1}.º)` : ''}. Enter vai ao próximo.`}
        </p>
      )}
      {resultados.length > 0 && (
        <ol className="busca-documento__lista" aria-label="Resultados da busca">
          {resultados.slice(0, 200).map((r, k) => (
            <li key={`${r.bloco}-${k}`}>
              <button type="button" className="busca-documento__item" aria-current={k === atual ? 'true' : undefined} onClick={() => ir(k)}>
                <span className="busca-documento__secao">
                  {r.indicativo ? `${r.indicativo} ` : ''}
                  {r.tituloSecao || 'Sem título'}
                  {r.noTitulo ? ' (título)' : ''}
                </span>
                <span className="busca-documento__trecho">
                  {r.antes.length > 0 && '…'}
                  {r.antes}
                  <mark>{r.trecho}</mark>
                  {r.depois}
                  {r.depois.length > 0 && '…'}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
