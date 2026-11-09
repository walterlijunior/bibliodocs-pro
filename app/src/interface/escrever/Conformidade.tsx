import { useEffect, useId, useRef, useState } from 'react';
import { FAMILIAS_CONFORMIDADE, type NaoConformidade, type RelatorioConformidade, type ResultadoExportar } from '../../aplicacao';

type Filtro = 'todos' | 'erro' | 'aviso';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Janela do verificador de conformidade (RF-15; M7-T03): resumo de pendências e avisos, filtro, grupos por família, local
 * legível, "Ir ao local" e exportação do relatório.
 */
export function Conformidade(p: { relatorio: RelatorioConformidade; aoAtualizar: () => void; aoLocal: (local: NaoConformidade['local']) => void; aoExportar: () => Promise<ResultadoExportar>; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const [exportando, setExportando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  const exportar = async () => {
    if (exportando) return;
    setExportando(true); setMensagem('');
    try {
      const r = await p.aoExportar();
      setMensagem(r.ok ? `“${r.nomeArquivo}” foi exportado.` : r.motivo === 'CANCELADO' ? 'Exportação cancelada.' : r.mensagem);
    } catch { setMensagem('Não foi possível exportar o relatório. Tente novamente.'); }
    finally { setExportando(false); }
  };
  const todos = p.relatorio.problemas;
  const erros = todos.filter((c) => c.gravidade === 'erro').length;
  const avisos = todos.length - erros;
  const visiveis = filtro === 'todos' ? todos : todos.filter((c) => c.gravidade === filtro);
  const resumo = todos.length === 0
    ? 'Nenhuma pendência encontrada nas verificações executadas.'
    : `${plural(erros, 'pendência', 'pendências')} e ${plural(avisos, 'aviso', 'avisos')}.`;
  const opcoes: readonly [Filtro, string][] = [['todos', `Todos (${todos.length})`], ['erro', `Pendências (${erros})`], ['aviso', `Avisos (${avisos})`]];

  return <dialog ref={ref} className="dialogo dialogo--conformidade" aria-labelledby={`${base}-titulo`} onCancel={(e) => { e.preventDefault(); if (!exportando) p.aoFechar(); }}>
    <div className="dialogo__corpo">
      <h2 id={`${base}-titulo`}>Verificar conformidade</h2>
      <p>Verificações automáticas implementadas para o perfil UFT. Conferem o conteúdo do trabalho; a formatação (fonte, margens, espaçamento) é aplicada pelo aplicativo na exportação. Este relatório apoia a revisão e não substitui a conferência de todas as normas.</p>
      <p role="status">{resumo}</p>
      {todos.length > 0 && <fieldset className="conformidade__filtro">
        <legend className="sr-only">Mostrar</legend>
        {opcoes.map(([v, rotulo]) => <label key={v}><input type="radio" name={`${base}-filtro`} value={v} checked={filtro === v} onChange={() => setFiltro(v)} /> {rotulo}</label>)}
      </fieldset>}
      {p.relatorio.diagnosticos.length > 0 && <details><summary>Limites desta verificação</summary><ul>{p.relatorio.diagnosticos.map((d, i) => <li key={i}>{d.mensagem}</li>)}</ul></details>}
      {FAMILIAS_CONFORMIDADE.map(({ familia, nome }) => {
        const grupo = visiveis.filter((c) => c.familia === familia);
        if (grupo.length === 0) return null;
        const idGrupo = `${base}-${familia}`;
        return <section key={familia} className="conformidade__grupo" aria-labelledby={idGrupo}>
          <h3 id={idGrupo}>{nome} ({grupo.length})</h3>
          <ol aria-labelledby={idGrupo}>{grupo.map((c) => <li key={c.id} className="conformidade__item">
            <p><strong>{c.gravidade === 'erro' ? 'Pendência' : 'Aviso'}{c.provisoria ? ' (critério provisório)' : ''} — {c.origem.join(', ')}</strong></p>
            <p>Local: {c.rotuloLocal}</p>
            <p>{c.mensagem}</p><p>{c.sugestao}</p>
            {c.local.tipo !== 'trabalho' && <button type="button" className="btn-secundario" onClick={() => p.aoLocal(c.local)}>Ir ao local</button>}
          </li>)}</ol>
        </section>;
      })}
      {mensagem && <p role="status">{mensagem}</p>}
      <div className="dialogo__acoes"><button type="button" className="btn-secundario" onClick={p.aoAtualizar} disabled={exportando}>Verificar novamente</button><button type="button" className="btn-principal" onClick={() => void exportar()} disabled={exportando}>{exportando ? 'Exportando…' : 'Exportar relatório…'}</button><button type="button" className="btn-secundario" onClick={p.aoFechar} disabled={exportando}>Fechar</button></div>
    </div>
  </dialog>;
}
