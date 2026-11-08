import { useEffect, useId, useRef, useState } from 'react';
import type { NaoConformidade, RelatorioConformidade, ResultadoExportar } from '../../aplicacao';

export function Conformidade(p: { relatorio: RelatorioConformidade; aoAtualizar: () => void; aoLocal: (local: NaoConformidade['local']) => void; aoExportar: () => Promise<ResultadoExportar>; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const [exportando, setExportando] = useState(false);
  const [mensagem, setMensagem] = useState('');
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
  return <dialog ref={ref} className="dialogo" aria-labelledby={`${base}-titulo`} onCancel={(e) => { e.preventDefault(); if (!exportando) p.aoFechar(); }}>
    <div className="dialogo__corpo">
      <h2 id={`${base}-titulo`}>Verificar conformidade</h2>
      <p>Verificações automáticas implementadas para o perfil UFT. Este relatório apoia a revisão do trabalho e não substitui a conferência de todas as normas.</p>
      <p role="status">{p.relatorio.problemas.length === 0 ? 'Nenhuma pendência encontrada nas verificações executadas.' : `${p.relatorio.problemas.length} pendência(s) encontrada(s).`}</p>
      {p.relatorio.diagnosticos.length > 0 && <details><summary>Limites desta verificação</summary><ul>{p.relatorio.diagnosticos.map((d, i) => <li key={i}>{d.mensagem} {d.origem.join(', ')}</li>)}</ul></details>}
      <ol className="lista-rolavel" aria-label="Pendências de conformidade">{p.relatorio.problemas.map((c) => <li key={c.id}>
        <p><strong>{c.gravidade === 'erro' ? 'Pendência' : 'Aviso'} — {c.origem.join(', ')}</strong></p>
        <p>{c.mensagem}</p><p>{c.sugestao}</p>
        <button type="button" className="btn-secundario" onClick={() => p.aoLocal(c.local)}>Ir ao local</button>
      </li>)}</ol>
      {mensagem && <p role="status">{mensagem}</p>}
      <div className="dialogo__acoes"><button type="button" className="btn-secundario" onClick={p.aoAtualizar} disabled={exportando}>Verificar novamente</button><button type="button" className="btn-principal" onClick={() => void exportar()} disabled={exportando}>{exportando ? 'Exportando…' : 'Exportar relatório…'}</button><button type="button" className="btn-secundario" onClick={p.aoFechar} disabled={exportando}>Fechar</button></div>
    </div>
  </dialog>;
}
