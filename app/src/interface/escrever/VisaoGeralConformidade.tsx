/**
 * Visão geral do painel de conformidade (Etapa 6 da especificação de atualização, D-E6-05), na organização do
 * Gerenciador de Tarefas: à esquerda, as categorias com as contagens (no trabalho, verificados, com pendência ou aviso);
 * à direita, o detalhe da categoria escolhida. Em tabelas, quadros, figuras, gráficos e equações, o detalhe lista cada
 * elemento com o rótulo, o título, as menções ligadas e a situação, com "Ir ao elemento" e "Ir à menção".
 * Texto sempre como texto (nunca HTML).
 */
import type { CategoriaConformidade, ElementoNoInventario, InventarioConformidade, LinhaCategoria } from '../../aplicacao';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "2 no trabalho · 2 verificados · nenhum com pendência" (ou só as ocorrências, sem itens contáveis). */
export function resumoDaCategoria(c: LinhaCategoria): string {
  const ocorr = c.pendencias + c.avisos;
  if (c.noTrabalho === null) return ocorr === 0 ? 'nenhuma ocorrência' : `${plural(c.pendencias, 'pendência', 'pendências')}, ${plural(c.avisos, 'aviso', 'avisos')}`;
  return `${c.noTrabalho} no trabalho · ${c.verificados} sem ocorrência · ${c.comOcorrencia === 0 ? 'nenhum com pendência ou aviso' : `${c.comOcorrencia} com pendência ou aviso`}`;
}

export function NavegacaoCategorias(p: { inventario: InventarioConformidade; ativa: CategoriaConformidade | null; aoEscolher: (c: CategoriaConformidade | null) => void }) {
  return (
    <nav className="conformidade__navegacao" aria-label="Categorias da verificação">
      <ul>
        <li>
          <button type="button" className="conformidade__categoria" aria-pressed={p.ativa === null} onClick={() => p.aoEscolher(null)}>
            <span className="conformidade__categoria-nome">Todas as categorias</span>
          </button>
        </li>
        {p.inventario.categorias.map((c) => {
          const ocorr = c.pendencias + c.avisos;
          return (
            <li key={c.categoria}>
              <button type="button" className="conformidade__categoria" aria-pressed={p.ativa === c.categoria} onClick={() => p.aoEscolher(c.categoria)} aria-label={`${c.nome}: ${resumoDaCategoria(c)}`}>
                <span className="conformidade__categoria-nome">{c.nome}</span>
                <span className="conformidade__numeros" aria-hidden="true">
                  {c.noTrabalho !== null && <span title="No trabalho">{c.noTrabalho}</span>}
                  {c.verificados !== null && <span className="conformidade__num--ok" title="Sem ocorrência">✓ {c.verificados}</span>}
                  <span className={ocorr > 0 ? 'conformidade__num--alerta' : 'conformidade__num--zero'} title="Pendências e avisos">
                    ! {ocorr}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="dica">Número: itens no trabalho. ✓: verificados sem ocorrência. !: pendências e avisos.</p>
    </nav>
  );
}

export function ElementosDaCategoria(p: {
  linha: LinhaCategoria;
  elementos: readonly ElementoNoInventario[];
  aoIrAoElemento: (e: ElementoNoInventario) => void;
  aoIrAMencao: (e: ElementoNoInventario, k: number) => void;
}) {
  return (
    <section className="conformidade__detalhe" aria-label={`${p.linha.nome}: detalhe`}>
      <h3>{p.linha.nome}</h3>
      <p role="status">{resumoDaCategoria(p.linha)}.</p>
      {p.elementos.length === 0 ? (
        <p className="dica">Nenhum no trabalho.</p>
      ) : (
        <table className="registro__tabela conformidade__elementos">
          <thead>
            <tr>
              <th scope="col">Rótulo e título</th>
              <th scope="col">Menções ligadas</th>
              <th scope="col">Situação</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {p.elementos.map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.descricao}</th>
                <td>
                  {e.mencoes.length === 0 ? (
                    <span className="conformidade__num--alerta">nenhuma no texto</span>
                  ) : (
                    <ul className="conformidade__mencoes">
                      {e.mencoes.map((m, k) => (
                        <li key={m.remissiva}>
                          <button type="button" className="btn-link" onClick={() => p.aoIrAMencao(e, k)} aria-label={`Ir à menção ${k + 1} de ${e.rotulo}`}>
                            {m.semNumero !== undefined ? `“${m.semNumero}” (sem número)` : e.rotulo}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  {e.ocorrencias.length === 0 ? (
                    <span className="conformidade__selo conformidade__selo--verificado">Verificado, sem ocorrência</span>
                  ) : (
                    <ul className="conformidade__mencoes">
                      {e.ocorrencias.map((c) => (
                        <li key={c.id}>
                          {c.gravidade === 'erro' ? 'Pendência' : 'Aviso'}: {c.mensagem}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  <button type="button" className="btn-secundario" onClick={() => p.aoIrAoElemento(e)} aria-label={`Ir a ${e.rotulo}`}>
                    Ir ao elemento
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
