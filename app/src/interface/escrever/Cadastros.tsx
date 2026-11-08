import { useEffect, useId, useRef, useState } from 'react';
import type { CadastrosDocumento, ResultadoObra } from '../../aplicacao';

type Categoria = 'siglas' | 'simbolos' | 'glossario';
const CAMPOS = {
  siglas: { nome: 'Siglas', primeiro: 'Sigla', segundo: 'Forma por extenso', a: 'sigla', b: 'extenso' },
  simbolos: { nome: 'Símbolos', primeiro: 'Símbolo', segundo: 'Significado', a: 'simbolo', b: 'significado' },
  glossario: { nome: 'Glossário', primeiro: 'Termo', segundo: 'Definição', a: 'termo', b: 'definicao' },
} as const;

export function Cadastros(p: { dados: CadastrosDocumento; somenteLeitura: boolean; aoAlterar: (c: CadastrosDocumento) => ResultadoObra; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const [categoria, setCategoria] = useState<Categoria>('siglas');
  const [editando, setEditando] = useState<string | null>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [erro, setErro] = useState('');
  const [excluir, setExcluir] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const config = CAMPOS[categoria];
  const lista = (p.dados[categoria] ?? []) as unknown as readonly Record<string, string>[];
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  const limpar = () => { setEditando(null); setA(''); setB(''); setErro(''); setExcluir(null); };
  const aplicar = (novos: readonly Record<string, string>[]) => {
    const dados = { ...p.dados };
    delete dados[categoria];
    if (novos.length > 0) Object.assign(dados, { [categoria]: novos });
    const r = p.aoAlterar(dados);
    if (!r.ok) { setErro(r.mensagem); return false; }
    return true;
  };
  const salvar = () => {
    if (a.trim() === '' || b.trim() === '') { setErro('Preencha os dois campos.'); return; }
    const id = editando ?? `cad_${crypto.randomUUID().replaceAll('-', '')}`;
    const registro = { id, [config.a]: a.trim(), [config.b]: b.trim() };
    const novos = editando ? lista.map((r) => r['id'] === editando ? registro : r) : [...lista, registro];
    if (aplicar(novos)) { limpar(); setAnuncio('Cadastro gravado. Ctrl+Z no texto desfaz.'); }
  };
  const retirar = (id: string) => {
    if (aplicar(lista.filter((r) => r['id'] !== id))) { limpar(); setAnuncio('Cadastro excluído. Ctrl+Z no texto restaura.'); }
  };
  return <dialog ref={ref} className="dialogo" aria-labelledby={`${base}-titulo`} onCancel={(e) => { e.preventDefault(); p.aoFechar(); }}>
    <div className="dialogo__corpo">
      <h2 id={`${base}-titulo`}>Siglas, símbolos e glossário</h2>
      <div role="group" aria-label="Escolher cadastro">{(Object.keys(CAMPOS) as Categoria[]).map((c) => <button type="button" className="btn-secundario" key={c} aria-pressed={categoria === c} onClick={() => { setCategoria(c); limpar(); setAnuncio(''); }}>{CAMPOS[c].nome}</button>)}</div>
      <p className="dica">Inclua a lista correspondente nos elementos do trabalho para aparecer no DOCX. A lista de siglas usa somente as siglas ligadas ao texto.</p>
      <ul className="lista-rolavel" aria-label={`Cadastros: ${config.nome}`}>
        {lista.map((r) => <li key={r['id']}><span>{r[config.a]} — {r[config.b]}</span>{!p.somenteLeitura && <>
          <button type="button" className="btn-secundario" aria-label={`Editar ${r[config.a]}`} onClick={() => { setEditando(r['id']!); setA(r[config.a]!); setB(r[config.b]!); setErro(''); }}>Editar</button>
          <button type="button" className="btn-secundario" aria-label={`Excluir ${r[config.a]}`} onClick={() => categoria === 'siglas' ? setExcluir(r['id']!) : retirar(r['id']!)}>Excluir</button>
        </>}</li>)}
      </ul>
      {lista.length === 0 && <p>Nenhum item cadastrado.</p>}
      {excluir !== null && <div role="alert"><p>Excluir esta sigla pode deixar ligações sem cadastro no texto. Você pode restaurá-la com Ctrl+Z.</p><button type="button" className="btn-secundario" onClick={() => retirar(excluir)}>Confirmar exclusão</button><button type="button" className="btn-secundario" onClick={() => setExcluir(null)}>Cancelar exclusão</button></div>}
      {!p.somenteLeitura && <form onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <h3>{editando ? 'Editar cadastro' : 'Novo cadastro'}</h3>
        <label htmlFor={`${base}-a`}>{config.primeiro}</label><input id={`${base}-a`} className="campo" value={a} maxLength={2000} onChange={(e) => setA(e.target.value)} />
        <label htmlFor={`${base}-b`}>{config.segundo}</label><textarea id={`${base}-b`} className="campo" value={b} maxLength={2000} onChange={(e) => setB(e.target.value)} rows={3} />
        {erro && <p role="alert">{erro}</p>}
        <div className="dialogo__acoes"><button type="button" className="btn-secundario" onClick={limpar}>Limpar</button><button type="submit" className="btn-principal" disabled={!a.trim() || !b.trim()}>Gravar cadastro</button></div>
      </form>}
      <p role="status">{anuncio}</p>
      <div className="dialogo__acoes"><button type="button" className="btn-secundario" onClick={p.aoFechar}>Fechar</button></div>
    </div>
  </dialog>;
}
