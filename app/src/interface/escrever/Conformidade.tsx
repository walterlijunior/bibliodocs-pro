import { useEffect, useId, useRef, useState } from 'react';
import {
  CATEGORIAS_CONFORMIDADE,
  COBERTURA_CONFORMIDADE,
  FAMILIAS_CONFORMIDADE,
  type CategoriaConformidade,
  type NaoConformidade,
  type RelatorioConformidade,
  type ResultadoExportar,
} from '../../aplicacao';

type Filtro = 'todos' | 'erro' | 'aviso';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A ocorrência que o autor foi corrigir: ao voltar, o relatório diz se ela ainda aparece. */
export interface RetornoConformidade {
  chave: string;
  rotulo: string;
}

export interface PropsConformidade {
  relatorio: RelatorioConformidade;
  aoAtualizar: () => void;
  aoLocal: (local: NaoConformidade['local'], item: NaoConformidade) => void;
  aoExportar: () => Promise<ResultadoExportar>;
  aoFechar: () => void;
  embutido?: boolean;
  /** Voltando de "Ir ao local": a ocorrência a procurar no relatório refeito. */
  retorno?: RetornoConformidade | null;
  aoRetornoAtendido?: () => void;
}

/**
 * Verificador de conformidade (RF-15; M7-T03; Etapa 6 da especificação revista): resumo, filtros por gravidade e por
 * categoria (tabelas, quadros, figuras, gráficos, equações, citações, fontes e referências…), grupos por família, cada
 * ocorrência marcada como verificada ou a revisar, "Ir ao local" com volta ao mesmo item, o que cada verificação cobre e
 * a exportação do relatório. Na aba Conformidade fica na página (painel); pelo F7, numa janela larga.
 */
export function Conformidade(p: PropsConformidade) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const embutido = p.embutido === true;
  const [exportando, setExportando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [categorias, setCategorias] = useState<ReadonlySet<CategoriaConformidade>>(new Set());
  const [anuncioRetorno, setAnuncioRetorno] = useState<string | null>(null);
  useEffect(() => {
    if (embutido) return;
    ref.current?.showModal();
    return () => ref.current?.close();
  }, [embutido]);

  // Volta de "Ir ao local": a ocorrência ainda está no relatório refeito? Se está, o foco vai a ela.
  const { retorno, aoRetornoAtendido } = p;
  useEffect(() => {
    if (!retorno) return;
    const ainda = p.relatorio.problemas.find((c) => c.chave === retorno.chave);
    if (ainda) {
      setFiltro('todos');
      setCategorias(new Set());
      setAnuncioRetorno(`Ainda aparece: ${retorno.rotulo}.`);
      requestAnimationFrame(() => {
        const el = document.getElementById(`${base}-item-${ainda.id}`);
        el?.scrollIntoView({ block: 'center' });
        el?.focus({ preventScroll: true });
      });
    } else setAnuncioRetorno(`Resolvido: ${retorno.rotulo} não aparece mais nesta verificação.`);
    aoRetornoAtendido?.();
  }, [retorno, aoRetornoAtendido, p.relatorio, base]);

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
  const porGravidade = filtro === 'todos' ? todos : todos.filter((c) => c.gravidade === filtro);
  const visiveis = categorias.size === 0 ? porGravidade : porGravidade.filter((c) => categorias.has(c.categoria));
  const resumo = todos.length === 0
    ? 'Nenhuma pendência encontrada nas verificações executadas.'
    : `${plural(erros, 'pendência', 'pendências')} e ${plural(avisos, 'aviso', 'avisos')}.`;
  const opcoes: readonly [Filtro, string][] = [['todos', `Todos (${todos.length})`], ['erro', `Pendências (${erros})`], ['aviso', `Avisos (${avisos})`]];
  const marcar = (c: CategoriaConformidade, sim: boolean) =>
    setCategorias((atual) => {
      const novo = new Set(atual);
      if (sim) novo.add(c);
      else novo.delete(c);
      return novo;
    });

  const corpo = <>
      {!embutido && <h2 id={`${base}-titulo`}>Verificar conformidade</h2>}
      <p>Verificações automáticas implementadas para o perfil UFT. Conferem o conteúdo do trabalho; a formatação (fonte, margens, espaçamento) é aplicada pelo aplicativo na exportação. Este relatório apoia a revisão e não substitui a conferência de todas as normas.</p>
      <p role="status">{resumo}</p>
      {anuncioRetorno && <p role="status" className="conformidade__retorno">{anuncioRetorno}</p>}
      {todos.length > 0 && <div className="conformidade__filtros">
        <fieldset className="conformidade__filtro">
          <legend>Mostrar</legend>
          {opcoes.map(([v, rotulo]) => <label key={v}><input type="radio" name={`${base}-filtro`} value={v} checked={filtro === v} onChange={() => setFiltro(v)} /> {rotulo}</label>)}
        </fieldset>
        <fieldset className="conformidade__filtro conformidade__categorias">
          <legend>Categorias (nenhuma marcada: todas)</legend>
          {CATEGORIAS_CONFORMIDADE.map(({ categoria, nome }) => {
            const n = porGravidade.filter((c) => c.categoria === categoria).length;
            return <label key={categoria} className={n === 0 ? 'conformidade__categoria--vazia' : undefined}>
              <input type="checkbox" checked={categorias.has(categoria)} onChange={(e) => marcar(categoria, e.target.checked)} /> {nome} ({n})
            </label>;
          })}
          {categorias.size > 0 && <button type="button" className="btn-link" onClick={() => setCategorias(new Set())}>Mostrar todas as categorias</button>}
        </fieldset>
      </div>}
      {todos.length > 0 && visiveis.length === 0 && <p className="dica">Nenhuma ocorrência com estes filtros.</p>}
      {categorias.size > 0 && visiveis.length > 0 && <p className="dica" role="status">{plural(visiveis.length, 'ocorrência', 'ocorrências')} nas categorias marcadas.</p>}
      {p.relatorio.diagnosticos.length > 0 && <details><summary>Limites desta verificação</summary><ul>{p.relatorio.diagnosticos.map((d, i) => <li key={i}>{d.mensagem}</li>)}</ul></details>}
      {FAMILIAS_CONFORMIDADE.map(({ familia, nome }) => {
        const grupo = visiveis.filter((c) => c.familia === familia);
        if (grupo.length === 0) return null;
        const idGrupo = `${base}-${familia}`;
        return <section key={familia} className="conformidade__grupo" aria-labelledby={idGrupo}>
          <h3 id={idGrupo}>{nome} ({grupo.length})</h3>
          <ol aria-labelledby={idGrupo}>{grupo.map((c) => <li key={c.id} className="conformidade__item" id={`${base}-item-${c.id}`} tabIndex={-1} data-categoria={c.categoria}>
            <p>
              <strong>{c.gravidade === 'erro' ? 'Pendência' : 'Aviso'}{c.provisoria ? ' (critério provisório)' : ''} — {c.origem.join(', ')}</strong>{' '}
              <span className={`conformidade__selo conformidade__selo--${c.verificacao}`}>{c.verificacao === 'verificado' ? 'Verificado pelo aplicativo' : 'Exige revisão sua'}</span>
            </p>
            <p>Local: {c.rotuloLocal}</p>
            <p>{c.mensagem}</p><p>{c.sugestao}</p>
            {c.local.tipo !== 'trabalho' && <button type="button" className="btn-secundario" onClick={() => p.aoLocal(c.local, c)}>Ir ao local</button>}
          </li>)}</ol>
        </section>;
      })}
      <details className="conformidade__cobertura">
        <summary>O que esta verificação cobre</summary>
        <p className="dica">“Verificado pelo aplicativo”: a regra tem fonte e o aplicativo conferiu o conteúdo. “Exige revisão sua”: aviso, critério provisório ou sinal que pede o seu olhar antes de concluir que há erro.</p>
        <table className="registro__tabela">
          <caption className="sr-only">Cobertura das verificações</caption>
          <thead><tr><th scope="col">Assunto</th><th scope="col">Verificado no conteúdo</th><th scope="col">Aplicado na exportação (confira no DOCX)</th><th scope="col">Revisão manual</th></tr></thead>
          <tbody>{COBERTURA_CONFORMIDADE.map((c) => <tr key={c.assunto}><th scope="row">{c.assunto}</th><td>{c.verificado}</td><td>{c.aplicado}</td><td>{c.manual}</td></tr>)}</tbody>
        </table>
      </details>
      {mensagem && <p role="status">{mensagem}</p>}
      <div className="dialogo__acoes"><button type="button" className="btn-secundario" onClick={p.aoAtualizar} disabled={exportando}>Verificar novamente</button><button type="button" className="btn-principal" onClick={() => void exportar()} disabled={exportando}>{exportando ? 'Exportando…' : 'Exportar relatório…'}</button>{!embutido && <button type="button" className="btn-secundario" onClick={p.aoFechar} disabled={exportando}>Fechar</button>}</div>
  </>;
  // Na aba Conformidade (F-E6-01) o relatório fica na própria página; pelo F7 na aba Escrever, numa janela.
  if (embutido) return <section className="conformidade" aria-label="Relatório de conformidade">{corpo}</section>;
  return <dialog ref={ref} className="dialogo dialogo--conformidade" aria-labelledby={`${base}-titulo`} onCancel={(e) => { e.preventDefault(); if (!exportando) p.aoFechar(); }}>
    <div className="dialogo__corpo">{corpo}</div>
  </dialog>;
}
