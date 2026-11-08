import { useEffect, useId, useRef, useState } from 'react';
import type { Sigla } from '../../dominio/modelo';

export function DialogoSigla(p: { siglas: readonly Sigla[]; atual: string | null; aoConfirmar: (id: string) => void; aoFechar: () => void; aoCadastrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const [id, setId] = useState(p.atual ?? p.siglas[0]?.id ?? '');
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} className="dialogo" aria-labelledby={`${base}-titulo`} onCancel={(e) => { e.preventDefault(); p.aoFechar(); }}>
    <form className="dialogo__corpo" onSubmit={(e) => { e.preventDefault(); if (p.siglas.some((s) => s.id === id)) p.aoConfirmar(id); }}>
      <h2 id={`${base}-titulo`}>{p.atual === null ? 'Inserir sigla' : 'Alterar sigla'}</h2>
      <p>A primeira ocorrência sai por extenso no DOCX; as seguintes mostram a sigla.</p>
      {p.siglas.length === 0 ? <p>Cadastre uma sigla e sua forma por extenso para inserir no texto.</p> : <fieldset className="lista-rolavel"><legend>Sigla</legend>{p.siglas.map((s) => <label className="tipos-trabalho__opcao" key={s.id}><input type="radio" name={`${base}-sigla`} checked={id === s.id} onChange={() => setId(s.id)} /><span>{s.sigla} — {s.extenso}</span></label>)}</fieldset>}
      <div className="dialogo__acoes"><button type="button" className="btn-secundario" onClick={p.aoCadastrar}>Cadastros…</button><button type="button" className="btn-secundario" onClick={p.aoFechar}>Cancelar</button><button type="submit" className="btn-principal" disabled={!p.siglas.some((s) => s.id === id)}>Inserir no texto</button></div>
    </form>
  </dialog>;
}
