/**
 * Janela da citação (M4-T07; RF-07): escolhe as obras citadas, a forma da chamada, o volume e a página, a obra
 * consultada (apud) e o destaque. A prévia mostra a chamada como sairá no texto; só a citação que o formato aceita é
 * inserida. Com a chamada já no texto, a janela altera ou retira. Texto sempre como texto (nunca HTML).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { validarCitacao, type DadosCitacao, type FormatadorDeChamadas, type ObraNaLista } from '../../aplicacao';
import type { ObraCitada } from '../../dominio/modelo';
import { Icone } from '../Icones';

/** Limite de obras na mesma chamada no editor (o formato aceita mais; a chamada ficaria ilegível). */
const MAX_OBRAS_NA_CHAMADA = 10;
const LIMITE_ROTULO = 140;

export interface PropsDialogoCitacao {
  obras: readonly ObraNaLista[];
  /** Citação a alterar; `null` = nova. */
  inicial: DadosCitacao | null;
  formatar: FormatadorDeChamadas;
  aoConfirmar: (dados: DadosCitacao) => void;
  aoRetirar: () => void;
  aoFechar: () => void;
  /** Sem obras: leva ao cadastro (fecha a janela). */
  aoCadastrarObra: () => void;
}

const rotuloObra = (o: ObraNaLista): string => (o.referencia.length > LIMITE_ROTULO ? `${o.referencia.slice(0, LIMITE_ROTULO)}…` : o.referencia);

/** "citacao.obras[1].pagina" → "Obra citada 2, página" (com uma obra só, "Obra citada", como a legenda). */
function campoDoErro(caminho: string, obrasNaChamada: number): string {
  const m = /^citacao(?:\.obras\[(\d+)\]|\.(apud))?(?:\.(\w+))?/.exec(caminho);
  if (!m) return 'Citação';
  const onde = m[1] !== undefined ? (obrasNaChamada > 1 ? `Obra citada ${Number(m[1]) + 1}` : 'Obra citada') : m[2] ? 'Obra consultada (apud)' : 'Citação';
  const campo = { obra: 'obra', volume: 'volume', pagina: 'página', semPaginacao: 'sem paginação', obras: 'obras' }[m[3] ?? ''];
  return campo ? `${onde}, ${campo}` : onde;
}

export function DialogoCitacao(p: PropsDialogoCitacao) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const nova = p.inicial === null;
  const primeira = p.obras[0]?.obra.id ?? '';
  const [rascunho, setRascunho] = useState<DadosCitacao>(() => p.inicial ?? { forma: 'parentetica', obras: [{ obra: primeira }] });

  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('select, button')?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  const obras = useMemo(() => p.obras.map((o) => o.obra), [p.obras]);
  const validacao = validarCitacao(rascunho, obras);
  const previa = p.formatar(validacao.ok ? validacao.dados : rascunho);
  const semObras = p.obras.length === 0;

  const mudarObra = (i: number, c: ObraCitada) => setRascunho({ ...rascunho, obras: rascunho.obras.map((x, k) => (k === i ? c : x)) });

  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--citacao"
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
        <h2 id={`${base}-titulo`}>{nova ? 'Inserir citação' : 'Alterar citação'}</h2>
        {semObras ? (
          <>
            <p>Nenhuma obra cadastrada. Cadastre a obra na Bibliografia antes de citá-la.</p>
            <div className="dialogo__acoes">
              <button type="button" className="btn-principal" onClick={p.aoCadastrarObra}>
                Cadastrar obra
              </button>
              <button type="button" className="btn-secundario" onClick={p.aoFechar}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <fieldset className="tipos-trabalho">
              <legend>Forma da chamada</legend>
              <label className="tipos-trabalho__opcao">
                <input type="radio" name={`${base}-forma`} checked={rascunho.forma === 'parentetica'} onChange={() => setRascunho({ ...rascunho, forma: 'parentetica' })} />
                <span className="tipos-trabalho__nome">Entre parênteses: (SOBRENOME, ano)</span>
              </label>
              <label className="tipos-trabalho__opcao">
                <input type="radio" name={`${base}-forma`} checked={rascunho.forma === 'narrativa'} onChange={() => setRascunho({ ...rascunho, forma: 'narrativa' })} />
                <span className="tipos-trabalho__nome">No texto: Sobrenome (ano)</span>
              </label>
            </fieldset>

            {rascunho.obras.map((c, i) => (
              <PontoCitado
                key={i}
                legenda={rascunho.obras.length > 1 ? `Obra citada ${i + 1}` : 'Obra citada'}
                obras={p.obras}
                valor={c}
                aoMudar={(v) => mudarObra(i, v)}
                aoRetirar={rascunho.obras.length > 1 ? () => setRascunho({ ...rascunho, obras: rascunho.obras.filter((_, k) => k !== i) }) : undefined}
              />
            ))}
            {rascunho.obras.length < MAX_OBRAS_NA_CHAMADA && (
              <button type="button" className="btn-secundario" onClick={() => setRascunho({ ...rascunho, obras: [...rascunho.obras, { obra: primeira }] })}>
                Acrescentar obra na mesma chamada
              </button>
            )}

            <label className="elemento__marcar">
              <input
                type="checkbox"
                checked={rascunho.apud !== undefined}
                onChange={(ev) => {
                  const { apud: _apud, ...resto } = rascunho;
                  setRascunho(ev.target.checked ? { ...resto, apud: { obra: p.obras.find((o) => !rascunho.obras.some((c) => c.obra === o.obra.id))?.obra.id ?? primeira } } : resto);
                }}
              />
              Citação de citação (apud): a obra acima é o original, não consultado
            </label>
            {rascunho.apud !== undefined && <PontoCitado legenda="Obra consultada (apud)" obras={p.obras} valor={rascunho.apud} aoMudar={(apud) => setRascunho({ ...rascunho, apud })} />}

            <div className="elemento__campo">
              <label htmlFor={`${base}-grifo`}>Destaque no trecho citado</label>
              <select
                id={`${base}-grifo`}
                className="campo"
                value={rascunho.grifo ?? ''}
                onChange={(ev) => {
                  const { grifo: _grifo, ...resto } = rascunho;
                  setRascunho(ev.target.value === '' ? resto : { ...resto, grifo: ev.target.value as 'nosso' | 'doAutor' });
                }}
              >
                <option value="">Sem destaque</option>
                <option value="nosso">Destaque meu: grifo nosso</option>
                <option value="doAutor">Destaque do original: grifo do autor</option>
              </select>
            </div>

            <section className="obra__previa" aria-labelledby={`${base}-previa`}>
              <h3 id={`${base}-previa`}>Como sai no texto</h3>
              <p className="obra__referencia">
                {previa.trechos.map((x, i) => (
                  <span key={i}>{x.marcas.includes('italico') ? <em>{x.texto}</em> : x.texto}</span>
                ))}
              </p>
            </section>

            {!validacao.ok && (
              <ul className="avisos" aria-label="O que impede inserir a citação">
                {validacao.erros.map((e) => (
                  <li key={`${e.caminho}-${e.mensagem}`} className="aviso aviso--erro">
                    <Icone nome="erro" />
                    <span className="aviso__texto">
                      {campoDoErro(e.caminho, rascunho.obras.length)}: {e.mensagem}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {previa.avisos.length > 0 && (
              <ul className="avisos" aria-label="Avisos da chamada">
                {previa.avisos.map((a) => (
                  <li key={a.codigo} className="aviso">
                    <Icone nome="alerta" />
                    <span className="aviso__texto">
                      {a.mensagem} ({a.rn})
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="dialogo__acoes">
              <button type="submit" className="btn-principal" disabled={!validacao.ok}>
                {nova ? 'Inserir citação' : 'Alterar citação'}
              </button>
              {!nova && (
                <button type="button" className="btn-secundario" onClick={p.aoRetirar}>
                  Retirar citação
                </button>
              )}
              <button type="button" className="btn-secundario" onClick={p.aoFechar}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}

function PontoCitado(p: { legenda: string; obras: readonly ObraNaLista[]; valor: ObraCitada; aoMudar: (v: ObraCitada) => void; aoRetirar?: () => void }) {
  const base = useId();
  const { valor } = p;
  const texto = (campo: 'volume' | 'pagina', v: string): ObraCitada => {
    const { [campo]: _antigo, ...resto } = valor;
    return v === '' ? resto : { ...resto, [campo]: v };
  };
  return (
    <fieldset className="elemento__grupo">
      <legend>{p.legenda}</legend>
      <div className="elemento__campo">
        <label htmlFor={`${base}-obra`}>Obra</label>
        <select id={`${base}-obra`} className="campo" value={valor.obra} onChange={(ev) => p.aoMudar({ ...valor, obra: ev.target.value })}>
          {!p.obras.some((o) => o.obra.id === valor.obra) && <option value={valor.obra}>Obra que não está na bibliografia</option>}
          {p.obras.map((o) => (
            <option key={o.obra.id} value={o.obra.id}>
              {rotuloObra(o)}
            </option>
          ))}
        </select>
      </div>
      <div className="elemento__campo">
        <label htmlFor={`${base}-volume`}>Volume</label>
        <input id={`${base}-volume`} className="campo" value={valor.volume ?? ''} aria-describedby={`${base}-volume-dica`} onChange={(ev) => p.aoMudar(texto('volume', ev.target.value))} />
        <span id={`${base}-volume-dica`} className="dica">
          Só para obra em vários volumes: v. 2.
        </span>
      </div>
      <div className="elemento__campo">
        <label htmlFor={`${base}-pagina`}>Página</label>
        <input
          id={`${base}-pagina`}
          className="campo"
          value={valor.pagina ?? ''}
          disabled={valor.semPaginacao === true}
          aria-describedby={`${base}-pagina-dica`}
          onChange={(ev) => p.aoMudar(texto('pagina', ev.target.value))}
        />
        <span id={`${base}-pagina-dica`} className="dica">
          Página ou intervalo (27 ou 27-29). Obrigatória na citação direta.
        </span>
      </div>
      <label className="elemento__marcar">
        <input
          type="checkbox"
          checked={valor.semPaginacao === true}
          onChange={(ev) => {
            const { semPaginacao: _s, pagina: _p, ...resto } = valor;
            p.aoMudar(ev.target.checked ? { ...resto, semPaginacao: true } : resto);
          }}
        />
        Documento sem paginação
      </label>
      {p.aoRetirar && (
        <button type="button" className="btn-secundario" onClick={p.aoRetirar}>
          Tirar esta obra da chamada
        </button>
      )}
    </fieldset>
  );
}
