/**
 * Seletor de titulação (Etapa 3 da especificação revista): as formas da lista e "Outra titulação…", que abre um campo
 * livre. Valor gravado fora da lista aparece como "outra" com o texto como estava.
 */
import { useId, useState } from 'react';
import { TITULACOES, titulacaoDaLista } from '../../aplicacao';

export const OUTRA = '__outra__';

export function SeletorTitulacao(p: { rotulo?: string; valor: string | undefined; somenteLeitura: boolean; aoMudar: (v: string) => void }) {
  const id = useId();
  const [outraAberta, setOutraAberta] = useState(false);
  const vazio = (p.valor ?? '') === '';
  const outra = !vazio && !titulacaoDaLista(p.valor);
  const selecionado = outra || outraAberta ? OUTRA : (p.valor ?? '');
  const rotulo = p.rotulo ?? 'Titulação';
  return (
    <div className="elemento__campo">
      <label htmlFor={id}>{rotulo}</label>
      <select
        id={id}
        className="campo"
        value={selecionado}
        disabled={p.somenteLeitura}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OUTRA) {
            setOutraAberta(true);
            return;
          }
          setOutraAberta(false);
          p.aoMudar(v);
        }}
      >
        <option value="">Sem titulação</option>
        {TITULACOES.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.rotulo}
          </option>
        ))}
        <option value={OUTRA}>Outra titulação…</option>
      </select>
      {selecionado === OUTRA && (
        <input
          className="campo"
          type="text"
          aria-label={`${rotulo}: outra`}
          placeholder="Ex.: Prof. Livre-Docente"
          maxLength={40}
          value={outra ? (p.valor ?? '') : ''}
          readOnly={p.somenteLeitura}
          onChange={(e) => p.aoMudar(e.target.value)}
        />
      )}
    </div>
  );
}
