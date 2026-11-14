/**
 * Registro de atividades e cronograma (Etapa 6 da especificação de atualização), na aba Elementos, no lugar do editor.
 *
 * - Sem registro: "Começar com o modelo pronto" (Data, Tipo, Atividade desenvolvida, Encaminhamentos).
 * - Colunas adaptáveis (renomear, tipo, ordem, acrescentar, retirar) e linhas (atividade ou reunião com o orientador).
 * - Os campos de texto gravam ao sair do campo; as ações de linha e coluna, na hora.
 * - Separado do manuscrito: "Exportar cronograma…" gera um DOCX avulso; "Incorporar ao trabalho" põe o quadro num
 *   apêndice (novo ou existente). Incorporado, "Atualizar no trabalho" e "Retirar do trabalho".
 *
 * Texto sempre como texto (nunca HTML).
 */
import { useEffect, useId, useState } from 'react';
import { FONTE_PADRAO_REGISTRO, linhaNova, NATUREZAS, ordenarPorData, registroPadrao, TITULO_PADRAO_REGISTRO, type DestinoRegistro, type ResultadoExportar, type ResultadoObra } from '../../aplicacao';
import type { ColunaRegistro, RegistroAtividades } from '../../dominio/modelo';
import { gerarId } from '../editor/ids';

export interface PropsPainelRegistro {
  registro: RegistroAtividades | undefined;
  /** Onde o quadro está no trabalho; `null` = fora do trabalho. */
  incorporado: { apendice: string; rotulo: string } | null;
  /** Apêndices do trabalho, para incorporar no fim de um deles. */
  apendices: readonly { id: string; rotulo: string; titulo: string }[];
  somenteLeitura: boolean;
  aoAlterar: (r: RegistroAtividades | null) => ResultadoObra;
  aoIncorporar: (destino: DestinoRegistro) => ResultadoObra;
  aoAtualizar: () => ResultadoObra;
  aoRetirar: () => ResultadoObra;
  aoExportar: () => Promise<ResultadoExportar>;
}

const TIPOS_COLUNA: readonly { valor: ColunaRegistro['tipo']; nome: string }[] = [
  { valor: 'data', nome: 'Data' },
  { valor: 'natureza', nome: 'Atividade ou reunião' },
  { valor: 'texto', nome: 'Texto' },
];

const hoje = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function PainelRegistro(p: PropsPainelRegistro) {
  const base = useId();
  const so = p.somenteLeitura;
  // Rascunho local: os campos de texto só vão para o trabalho ao sair do campo (a validação é do documento inteiro).
  const [r, setR] = useState<RegistroAtividades | undefined>(p.registro);
  useEffect(() => setR(p.registro), [p.registro]);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [destino, setDestino] = useState<string>('novo');

  const gravar = (novo: RegistroAtividades | null, mensagem?: string) => {
    const res = p.aoAlterar(novo);
    setAnuncio(res.ok ? (mensagem ?? null) : res.mensagem);
    if (!res.ok) setR(p.registro);
  };
  const mudarLocal = (novo: RegistroAtividades) => setR(novo);
  const confirmar = () => {
    if (r && r !== p.registro) gravar(r);
  };

  if (!r) {
    return (
      <div className="gerenciador registro" aria-labelledby={`${base}-titulo`}>
        <h2 id={`${base}-titulo`}>Registro de atividades e cronograma</h2>
        <p>
          Anote as datas, as atividades desenvolvidas e os encontros com o orientador. O registro fica separado do texto: só entra no trabalho se você o
          incorporar.
        </p>
        {!so && (
          <button type="button" className="btn-principal" onClick={() => gravar(registroPadrao(gerarId), 'Registro criado com o modelo pronto.')}>
            Começar com o modelo pronto
          </button>
        )}
        <p className="dica" role="status">
          {anuncio}
        </p>
      </div>
    );
  }

  const colunas = r.colunas;
  const trocarColunas = (novas: ColunaRegistro[], linhas = r.linhas) => gravar({ ...r, colunas: novas, linhas });
  const moverColuna = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= colunas.length) return;
    const troca = <T,>(xs: readonly T[]): T[] => xs.map((x, k) => (k === i ? xs[j]! : k === j ? xs[i]! : x));
    trocarColunas(troca(colunas), r.linhas.map((l) => ({ ...l, valores: troca(l.valores) })));
  };

  return (
    <div className="gerenciador registro" aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`}>Registro de atividades e cronograma</h2>
      <p className="dica">
        {p.incorporado
          ? `Incorporado ao trabalho no ${p.incorporado.rotulo}. As mudanças daqui só chegam lá com “Atualizar no trabalho”.`
          : 'Fora do trabalho: o registro não sai no documento exportado até você incorporá-lo.'}
      </p>

      <div className="registro__campos">
        <label htmlFor={`${base}-tit`}>Título do quadro</label>
        <input
          id={`${base}-tit`}
          className="campo"
          value={r.titulo ?? ''}
          placeholder={TITULO_PADRAO_REGISTRO}
          readOnly={so}
          onChange={(e) => mudarLocal({ ...r, ...(e.target.value.trim() ? { titulo: e.target.value } : { titulo: undefined }) })}
          onBlur={confirmar}
        />
        <label htmlFor={`${base}-fonte`}>Fonte</label>
        <input
          id={`${base}-fonte`}
          className="campo"
          value={r.fonte ?? ''}
          placeholder={FONTE_PADRAO_REGISTRO}
          readOnly={so}
          onChange={(e) => mudarLocal({ ...r, ...(e.target.value.trim() ? { fonte: e.target.value } : { fonte: undefined }) })}
          onBlur={confirmar}
        />
      </div>

      <details className="registro__colunas">
        <summary>Adaptar as colunas do modelo</summary>
        <ul className="elementos__lista">
          {colunas.map((c, i) => (
            <li key={c.id} className="registro__coluna">
              <input
                className="campo"
                aria-label={`Título da coluna ${i + 1}`}
                value={c.titulo}
                readOnly={so}
                onChange={(e) => mudarLocal({ ...r, colunas: colunas.map((x) => (x.id === c.id ? { ...x, titulo: e.target.value } : x)) })}
                onBlur={() => {
                  if (c.titulo.trim() === '') setR(p.registro);
                  else confirmar();
                }}
              />
              <select
                className="campo"
                aria-label={`Tipo da coluna ${i + 1}`}
                value={c.tipo}
                disabled={so}
                onChange={(e) => trocarColunas(colunas.map((x) => (x.id === c.id ? { ...x, tipo: e.target.value as ColunaRegistro['tipo'] } : x)), r.linhas.map((l) => ({ ...l, valores: l.valores.map((v, k) => (k === i && e.target.value === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? '' : v)) })))}
              >
                {TIPOS_COLUNA.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.nome}
                  </option>
                ))}
              </select>
              {!so && (
                <>
                  <button type="button" className="btn-secundario" aria-label={`Mover a coluna ${c.titulo} para a esquerda`} disabled={i === 0} onClick={() => moverColuna(i, -1)}>
                    ←
                  </button>
                  <button type="button" className="btn-secundario" aria-label={`Mover a coluna ${c.titulo} para a direita`} disabled={i === colunas.length - 1} onClick={() => moverColuna(i, 1)}>
                    →
                  </button>
                  <button
                    type="button"
                    className="btn-secundario"
                    aria-label={`Retirar a coluna ${c.titulo}`}
                    disabled={colunas.length === 1}
                    onClick={() => trocarColunas(colunas.filter((x) => x.id !== c.id), r.linhas.map((l) => ({ ...l, valores: l.valores.filter((_, k) => k !== i) })))}
                  >
                    Retirar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {!so && (
          <button
            type="button"
            className="btn-secundario"
            disabled={colunas.length >= 10}
            onClick={() => trocarColunas([...colunas, { id: gerarId('rcl'), titulo: `Coluna ${colunas.length + 1}`, tipo: 'texto' }], r.linhas.map((l) => ({ ...l, valores: [...l.valores, ''] })))}
          >
            Acrescentar coluna
          </button>
        )}
      </details>

      <div className="gerenciador__previa">
        <table className="registro__tabela">
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.id} scope="col">
                  {c.titulo}
                </th>
              ))}
              {!so && <th scope="col"><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody>
            {r.linhas.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 1} className="dica">
                  Nenhuma linha ainda.
                </td>
              </tr>
            )}
            {r.linhas.map((l, i) => (
              <tr key={l.id}>
                {colunas.map((c, j) => {
                  const rotulo = `${c.titulo}, linha ${i + 1}`;
                  const valor = l.valores[j] ?? '';
                  const mudar = (v: string, agora = false) => {
                    const novo = { ...r, linhas: r.linhas.map((x) => (x.id === l.id ? { ...x, valores: x.valores.map((y, k) => (k === j ? v : y)) } : x)) };
                    if (agora) gravar(novo);
                    else mudarLocal(novo);
                  };
                  return (
                    <td key={c.id}>
                      {c.tipo === 'data' ? (
                        <input type="date" className="campo" aria-label={rotulo} value={valor} readOnly={so} onChange={(e) => mudar(e.target.value, true)} />
                      ) : c.tipo === 'natureza' ? (
                        <select className="campo" aria-label={rotulo} value={valor} disabled={so} onChange={(e) => mudar(e.target.value, true)}>
                          <option value="">—</option>
                          {[...new Set([...NATUREZAS, ...(valor ? [valor] : [])])].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <textarea className="campo" rows={2} aria-label={rotulo} value={valor} readOnly={so} onChange={(e) => mudar(e.target.value.replace(/[\u0000-\u0008\u000B-\u001F]/g, ''))} onBlur={confirmar} />
                      )}
                    </td>
                  );
                })}
                {!so && (
                  <td>
                    <button type="button" className="btn-secundario" aria-label={`Retirar a linha ${i + 1}`} onClick={() => gravar({ ...r, linhas: r.linhas.filter((x) => x.id !== l.id) })}>
                      Retirar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!so && (
        <div className="acoes">
          <button type="button" className="btn-secundario" disabled={r.linhas.length >= 1000} onClick={() => gravar({ ...r, linhas: [...r.linhas, linhaNova(r, gerarId('rln'), hoje(), 'Atividade')] }, 'Atividade acrescentada.')}>
            Nova atividade
          </button>
          <button
            type="button"
            className="btn-secundario"
            disabled={r.linhas.length >= 1000}
            onClick={() => gravar({ ...r, linhas: [...r.linhas, linhaNova(r, gerarId('rln'), hoje(), 'Reunião com o orientador')] }, 'Reunião acrescentada.')}
          >
            Nova reunião com o orientador
          </button>
          <button type="button" className="btn-secundario" onClick={() => gravar(ordenarPorData(r), 'Linhas em ordem de data.')}>
            Ordenar por data
          </button>
        </div>
      )}

      <section className="registro__saida" aria-labelledby={`${base}-saida`}>
        <h3 id={`${base}-saida`}>Exportar e incorporar</h3>
        <div className="acoes">
          <button
            type="button"
            className="btn-secundario"
            onClick={() => {
              confirmar();
              void p.aoExportar().then((res) =>
                setAnuncio(res.ok ? `Cronograma exportado em “${res.nomeArquivo}”.` : res.motivo === 'CANCELADO' ? null : (res.mensagem ?? 'O cronograma não foi exportado.')),
              );
            }}
          >
            Exportar cronograma…
          </button>
        </div>
        {!so &&
          (p.incorporado ? (
            <div className="acoes">
              <button type="button" className="btn-principal" onClick={() => {
                confirmar();
                const res = p.aoAtualizar();
                setAnuncio(res.ok ? `Quadro atualizado no ${p.incorporado!.rotulo}. Ctrl+Z desfaz.` : res.mensagem);
              }}>
                Atualizar no trabalho
              </button>
              <button type="button" className="btn-secundario" onClick={() => {
                const res = p.aoRetirar();
                setAnuncio(res.ok ? 'Registro retirado do trabalho. Ctrl+Z desfaz.' : res.mensagem);
              }}>
                Retirar do trabalho
              </button>
            </div>
          ) : (
            <div className="registro__campos">
              <label htmlFor={`${base}-destino`}>Onde entra no trabalho</label>
              <select id={`${base}-destino`} className="campo" value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="novo">Num apêndice novo, depois dos outros (material elaborado pelo autor)</option>
                {p.apendices.map((a) => (
                  <option key={a.id} value={a.id}>
                    No fim do {a.rotulo}{a.titulo ? ` – ${a.titulo}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-principal"
                onClick={() => {
                  confirmar();
                  const res = p.aoIncorporar(destino === 'novo' ? { tipo: 'novoApendice' } : { tipo: 'apendice', id: destino });
                  setAnuncio(res.ok ? 'Registro incorporado ao trabalho. Ctrl+Z desfaz.' : res.mensagem);
                }}
              >
                Incorporar registro/cronograma ao trabalho
              </button>
            </div>
          ))}
      </section>
      <p className="dica" role="status">
        {anuncio}
      </p>
    </div>
  );
}
