/**
 * Janela da tabela e do quadro (M5-T04; RF-09): espécie, título, grade (linhas, colunas, cabeçalho, mesclagem,
 * alinhamento por coluna, sinais convencionais), fonte, nota e notas específicas. Só a tabela que o formato aceita vai
 * para o texto; o que impede aparece na lista, com o campo. Texto sempre como texto (nunca HTML).
 *
 * O rótulo numerado ("Tabela 3 –"), os traços e o corpo 10 vêm do motor: aqui só o conteúdo.
 */
import { useEffect, useId, useRef, useState } from 'react';
import {
  alterarCelula,
  excluirColuna,
  excluirLinha,
  explicarSinaisNaNota,
  inserirColuna,
  inserirLinha,
  mesclar,
  mudarCabecalho,
  notaDeSinais,
  rascunhoDe,
  rascunhoNovo,
  separar,
  SINAIS_CONVENCIONAIS,
  validarTabela,
  type CampoTexto,
  type DadosTabela,
  type RascunhoTabela,
  type ResultadoOperacao,
} from '../../aplicacao';
import type { AlinhamentoColuna } from '../../dominio/modelo';
import { Icone } from '../Icones';

export interface PropsDialogoTabela {
  /** Tabela a alterar; `null` = nova. */
  inicial: DadosTabela | null;
  aoConfirmar: (dados: DadosTabela) => void;
  aoFechar: () => void;
}

const NOMES_ALINHAMENTO: Readonly<Record<AlinhamentoColuna, string>> = { esquerda: 'À esquerda', centro: 'Centralizado', direita: 'À direita' };

const comTexto = (c: CampoTexto, texto: string): CampoTexto => ({ ...c, texto });

export function DialogoTabela(p: PropsDialogoTabela) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const nova = p.inicial === null;
  const [r, setR] = useState<RascunhoTabela>(() => (p.inicial ? rascunhoDe(p.inicial) : rascunhoNovo('tabela')));
  // Célula onde estão as operações (a última que teve o foco).
  const [ativa, setAtiva] = useState<{ l: number; c: number }>({ l: 0, c: 0 });
  const [motivo, setMotivo] = useState<string | null>(null);
  const refFocarCelula = useRef<{ l: number; c: number } | null>(null);

  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>(`#${CSS.escape(`${base}-titulo-campo`)}`)?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [base]);

  // Depois de uma operação, o foco volta para a célula ativa (o botão clicado pode ter sumido do lugar).
  useEffect(() => {
    const alvo = refFocarCelula.current;
    if (alvo === null) return;
    refFocarCelula.current = null;
    ref.current?.querySelector<HTMLInputElement>(`[data-celula="${alvo.l},${alvo.c}"]`)?.focus();
  });

  const nLinhas = r.grade.length;
  const nColunas = r.alinhamentos.length;
  // A célula ativa pode ter deixado de existir (excluída ou coberta): vale a primeira que começa até ela.
  const celulaAtiva = (() => {
    const l = Math.min(ativa.l, nLinhas - 1);
    const c = Math.min(ativa.c, nColunas - 1);
    for (let rr = l; rr >= 0; rr--) for (let cc = c; cc >= 0; cc--) if (r.grade[rr]![cc] !== null) return { l: rr, c: cc };
    return { l: 0, c: 0 };
  })();

  const operar = (res: ResultadoOperacao, foco: { l: number; c: number } = celulaAtiva) => {
    if (!res.ok) {
      setMotivo(`Não foi possível: ${res.motivo}.`);
      return;
    }
    setMotivo(null);
    setR(res.rascunho);
    const l = Math.max(0, Math.min(foco.l, res.rascunho.grade.length - 1));
    const c = Math.max(0, Math.min(foco.c, res.rascunho.alinhamentos.length - 1));
    setAtiva({ l, c });
    refFocarCelula.current = { l, c };
  };

  const validacao = validarTabela(r);
  const sinais = notaDeSinais(r);
  const { l: al, c: ac } = celulaAtiva;
  const nome = r.especie === 'quadro' ? 'quadro' : 'tabela';

  const botao = (rotulo: string, acao: () => void, titulo?: string) => (
    <button type="button" className="btn-formato" title={titulo ?? rotulo} onClick={acao}>
      {rotulo}
    </button>
  );

  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--tabela"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
      onClose={p.aoFechar}
    >
      <form
        className="dialogo__corpo"
        aria-labelledby={`${base}-titulo`}
        onSubmit={(e) => {
          e.preventDefault();
          if (validacao.ok) p.aoConfirmar(validacao.dados);
        }}
      >
        <h2 id={`${base}-titulo`}>{nova ? 'Inserir tabela ou quadro' : `Alterar ${nome}`}</h2>

        <fieldset className="tipos-trabalho">
          <legend>Espécie</legend>
          <label className="tipos-trabalho__opcao">
            <input type="radio" name={`${base}-especie`} checked={r.especie === 'tabela'} onChange={() => setR({ ...r, especie: 'tabela' })} />
            <span className="tipos-trabalho__nome">Tabela: dados numéricos, aberta nas laterais</span>
          </label>
          <label className="tipos-trabalho__opcao">
            <input type="radio" name={`${base}-especie`} checked={r.especie === 'quadro'} onChange={() => setR({ ...r, especie: 'quadro' })} />
            <span className="tipos-trabalho__nome">Quadro: conteúdo em texto, fechado</span>
          </label>
        </fieldset>

        <div className="elemento__campo">
          <label htmlFor={`${base}-titulo-campo`}>Título</label>
          <input
            id={`${base}-titulo-campo`}
            className="campo"
            value={r.titulo.texto}
            aria-describedby={`${base}-titulo-dica`}
            onChange={(ev) => setR({ ...r, titulo: comTexto(r.titulo, ev.target.value) })}
          />
          <span id={`${base}-titulo-dica`} className="dica">
            Sem o número: “{r.especie === 'quadro' ? 'Quadro' : 'Tabela'} 1 –” é posto sozinho, na ordem do texto.
          </span>
        </div>

        <fieldset className="elemento__grupo tabela-edicao">
          <legend>Conteúdo</legend>
          <div className="barra-formatacao" role="toolbar" aria-label={`Linhas, colunas e células (célula ativa: linha ${al + 1}, coluna ${ac + 1})`}>
            {botao('Linha acima', () => operar(inserirLinha(r, al), { l: al, c: ac }), 'Inserir linha acima da célula ativa')}
            {botao('Linha abaixo', () => operar(inserirLinha(r, al + (r.grade[al]![ac]?.linhas ?? 1)), { l: al + (r.grade[al]![ac]?.linhas ?? 1), c: ac }), 'Inserir linha abaixo da célula ativa')}
            {botao('Excluir linha', () => operar(excluirLinha(r, al)), 'Excluir a linha da célula ativa')}
            <span className="barra-formatacao__separador" aria-hidden="true" />
            {botao('Coluna à esquerda', () => operar(inserirColuna(r, ac), { l: al, c: ac }), 'Inserir coluna à esquerda da célula ativa')}
            {botao('Coluna à direita', () => operar(inserirColuna(r, ac + (r.grade[al]![ac]?.colunas ?? 1)), { l: al, c: ac + (r.grade[al]![ac]?.colunas ?? 1) }), 'Inserir coluna à direita da célula ativa')}
            {botao('Excluir coluna', () => operar(excluirColuna(r, ac)), 'Excluir a coluna da célula ativa')}
            <span className="barra-formatacao__separador" aria-hidden="true" />
            {botao('Mesclar à direita', () => operar(mesclar(r, al, ac, 'direita')), 'Juntar a célula ativa com a da direita')}
            {botao('Mesclar abaixo', () => operar(mesclar(r, al, ac, 'abaixo')), 'Juntar a célula ativa com a de baixo')}
            {botao('Separar', () => operar(separar(r, al, ac)), 'Desfazer a mesclagem da célula ativa')}
          </div>
          <div className="barra-formatacao" role="toolbar" aria-label="Sinais convencionais (IBGE)">
            <span className="tabela-edicao__rotulo" aria-hidden="true">
              Sinais:
            </span>
            {SINAIS_CONVENCIONAIS.map((s) => (
              <button
                key={s.sinal}
                type="button"
                className="btn-formato"
                title={s.significado}
                aria-label={`Sinal ${s.sinal}: ${s.significado}`}
                onClick={() => operar({ ok: true, rascunho: alterarCelula(r, al, ac, s.sinal) })}
              >
                {s.sinal}
              </button>
            ))}
          </div>
          {motivo !== null && (
            <p className="aviso" role="status">
              <Icone nome="alerta" />
              <span className="aviso__texto">{motivo}</span>
            </p>
          )}

          <div className="tabela-edicao__opcoes">
            <div className="elemento__campo">
              <label htmlFor={`${base}-cabecalho`}>Linhas de cabeçalho</label>
              <input
                id={`${base}-cabecalho`}
                className="campo campo--curto"
                type="number"
                min={0}
                max={nLinhas}
                value={r.linhasCabecalho}
                aria-describedby={`${base}-cabecalho-dica`}
                onChange={(ev) => {
                  const res = mudarCabecalho(r, Number(ev.target.value));
                  if (res.ok) {
                    setMotivo(null);
                    setR(res.rascunho);
                  } else setMotivo(`Não foi possível: ${res.motivo}.`);
                }}
              />
              <span id={`${base}-cabecalho-dica`} className="dica">
                Repetidas no alto de cada página quando a {nome} passa de uma página.
              </span>
            </div>
          </div>

          <div className="tabela-edicao__rolagem">
            <table className="tabela-edicao__grade">
              <thead>
                <tr>
                  {r.alinhamentos.map((a, c) => (
                    <th key={c} scope="col">
                      <select
                        className="campo"
                        aria-label={`Alinhamento da coluna ${c + 1}`}
                        value={a}
                        onChange={(ev) => setR({ ...r, alinhamentos: r.alinhamentos.map((x, i) => (i === c ? (ev.target.value as AlinhamentoColuna) : x)) })}
                      >
                        {(Object.keys(NOMES_ALINHAMENTO) as AlinhamentoColuna[]).map((k) => (
                          <option key={k} value={k}>
                            {NOMES_ALINHAMENTO[k]}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.grade.map((linha, l) => (
                  <tr key={l} className={l < r.linhasCabecalho ? 'tabela-edicao__linha--cabecalho' : undefined}>
                    {linha.map((cel, c) =>
                      cel === null ? null : (
                        <td key={c} colSpan={cel.colunas > 1 ? cel.colunas : undefined} rowSpan={cel.linhas > 1 ? cel.linhas : undefined}>
                          <input
                            className={`campo tabela-edicao__celula tabela-edicao__celula--${r.alinhamentos[c]}${l === al && c === ac ? ' tabela-edicao__celula--ativa' : ''}`}
                            data-celula={`${l},${c}`}
                            aria-label={`${l < r.linhasCabecalho ? 'Cabeçalho, linha' : 'Linha'} ${l + 1}, coluna ${c + 1}${cel.colunas > 1 || cel.linhas > 1 ? ` (mesclada: ${cel.linhas} × ${cel.colunas})` : ''}`}
                            value={cel.campo.texto}
                            onFocus={() => setAtiva({ l, c })}
                            onChange={(ev) => setR(alterarCelula(r, l, c, ev.target.value))}
                          />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dica">
            Números com vírgula decimal e ponto nos milhares (1.234,5). Célula sem dado: um sinal convencional. Chamada de nota específica entre parênteses, na célula: (1).
          </p>
        </fieldset>

        <div className="elemento__campo">
          <label htmlFor={`${base}-fonte`}>Fonte</label>
          <input
            id={`${base}-fonte`}
            className="campo"
            value={r.fonte.texto}
            aria-describedby={`${base}-fonte-dica`}
            onChange={(ev) => setR({ ...r, fonte: comTexto(r.fonte, ev.target.value) })}
          />
          <span id={`${base}-fonte-dica`} className="dica">
            Depois de “Fonte:”. Obrigatória; sem ela, a {nome} fica com pendência. Ex.: Elaborado pelo autor (2026).
          </span>
        </div>

        <div className="elemento__campo">
          <label htmlFor={`${base}-nota`}>Nota</label>
          <textarea id={`${base}-nota`} className="campo" rows={2} value={r.nota.texto} onChange={(ev) => setR({ ...r, nota: comTexto(r.nota, ev.target.value) })} />
          {sinais !== null && !r.nota.texto.includes(sinais) && (
            <button type="button" className="btn-secundario" onClick={() => setR(explicarSinaisNaNota(r))}>
              Explicar na nota os sinais usados
            </button>
          )}
        </div>

        <fieldset className="elemento__grupo">
          <legend>Notas específicas</legend>
          {r.notasEspecificas.length === 0 && <p className="dica">Nenhuma. A chamada “(1)” na célula remete à primeira nota.</p>}
          {r.notasEspecificas.map((n, i) => (
            <div key={i} className="elemento__campo tabela-edicao__nota">
              <label htmlFor={`${base}-ne-${i}`}>({i + 1})</label>
              <input
                id={`${base}-ne-${i}`}
                className="campo"
                value={n.texto}
                onChange={(ev) => setR({ ...r, notasEspecificas: r.notasEspecificas.map((x, k) => (k === i ? comTexto(x, ev.target.value) : x)) })}
              />
              <button
                type="button"
                className="btn-secundario"
                aria-label={`Retirar a nota específica ${i + 1}`}
                onClick={() => setR({ ...r, notasEspecificas: r.notasEspecificas.filter((_, k) => k !== i) })}
              >
                Retirar
              </button>
            </div>
          ))}
          <button type="button" className="btn-secundario" onClick={() => setR({ ...r, notasEspecificas: [...r.notasEspecificas, { texto: '' }] })}>
            Acrescentar nota específica
          </button>
        </fieldset>

        {!validacao.ok && (
          <ul className="avisos" aria-label={`O que impede gravar a ${nome}`}>
            {validacao.erros.map((e) => (
              <li key={`${e.campo}-${e.mensagem}`} className="aviso aviso--erro">
                <Icone nome="erro" />
                <span className="aviso__texto">
                  {e.campo}: {e.mensagem}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="dialogo__acoes">
          <button type="submit" className="btn-principal" disabled={!validacao.ok}>
            {nova ? `Inserir ${nome}` : `Alterar ${nome}`}
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
