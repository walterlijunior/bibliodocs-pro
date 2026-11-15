/**
 * Janela da remissiva (M5-T08; RF-11): escolhe a tabela, o quadro, a ilustração ou a equação numerada citada no texto. A
 * lista vem da sessão, na ordem do documento, com o rótulo e o título ("Tabela 3 – Vendas"). O texto da remissiva
 * acompanha a numeração: mudar o elemento de lugar muda o número em todo o texto.
 *
 * - Remissiva existente: o alvo atual vem marcado; quebrada, a janela avisa e pede outro.
 * - Sem elementos no trabalho: só a explicação e "Fechar".
 * - Etapa 4: "Como aparece no texto": com o número (o rótulo, que acompanha a numeração) ou sem número, com o texto do
 *   autor ("o quadro a seguir"), que fica ligado ao elemento. Com uma menção já escrita selecionada ("Quadro 1"), a
 *   janela "liga" a menção: escolhe o elemento de mesmo rótulo e troca o trecho pela remissiva; trecho que não é rótulo
 *   vira o texto da menção sem número.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { alvoPorRotulo, type ElementoNaSessao } from '../../aplicacao';

/** Como a remissiva aparece: `texto` nulo = rótulo; senão, menção sem número com esse texto. */
export interface FormaRemissiva {
  texto: string | null;
}

export interface PropsDialogoRemissiva {
  elementos: readonly ElementoNaSessao[];
  /** Alvo da remissiva a alterar; `null` = remissiva nova. */
  alvoAtual: string | null;
  /** Texto da menção sem número da remissiva a alterar. */
  textoAtual?: string | null;
  /** Menção escrita selecionada no texto, a ligar (só em remissiva nova). */
  mencaoEscrita?: string | null;
  aoConfirmar: (alvo: string, forma: FormaRemissiva) => void;
  aoFechar: () => void;
}

const LIMITE_TEXTO = 200;

export function DialogoRemissiva(p: PropsDialogoRemissiva) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const { elementos, alvoAtual } = p;
  const mencao = alvoAtual === null ? (p.mencaoEscrita ?? null) : null;
  const casada = mencao !== null ? alvoPorRotulo(elementos, mencao) : null;
  const quebrada = alvoAtual !== null && !elementos.some((e) => e.id === alvoAtual);
  const [escolhido, setEscolhido] = useState<string | null>(quebrada ? null : (alvoAtual ?? casada?.id ?? elementos[0]?.id ?? null));
  // Menção escrita que não é rótulo ("o quadro a seguir"): sem número, com o texto dela.
  const textoInicial = p.textoAtual ?? (mencao !== null && casada === null ? mencao : null);
  const [semNumero, setSemNumero] = useState(textoInicial !== null);
  const [texto, setTexto] = useState(textoInicial ?? '');
  const textoValido = texto.trim() !== '';
  const nova = alvoAtual === null;
  const acao = mencao !== null ? 'Ligar menção' : nova ? 'Inserir remissiva' : 'Alterar remissiva';

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      (d.querySelector<HTMLInputElement>('input:checked') ?? d.querySelector<HTMLInputElement>('input') ?? d.querySelector<HTMLButtonElement>('button'))?.focus();
    }
    return () => d?.close();
  }, []);

  const confirmar = () => {
    if (escolhido === null || (semNumero && !textoValido)) return;
    p.aoConfirmar(escolhido, { texto: semNumero ? texto.trim() : null });
  };

  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--remissiva"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
    >
      <form
        className="dialogo__corpo"
        onSubmit={(e) => {
          e.preventDefault();
          confirmar();
        }}
      >
        <h2 id={`${base}-titulo`}>{acao}</h2>
        {elementos.length === 0 ? (
          <p>O trabalho ainda não tem seção, apêndice, tabela, quadro, figura nem equação numerada para citar.</p>
        ) : (
          <>
            {quebrada && <p role="alert">Esta remissiva está quebrada: o elemento citado foi excluído ou a equação ficou sem número. Escolha outro.</p>}
            <fieldset className="tipos-trabalho lista-rolavel remissiva__lista">
              <legend>Elemento citado</legend>
              {elementos.map((e) => (
                <label key={e.id} className="tipos-trabalho__opcao">
                  <input type="radio" name={`${base}-alvo`} value={e.id} checked={escolhido === e.id} onChange={() => setEscolhido(e.id)} />
                  <span className="tipos-trabalho__nome">{e.descricao}</span>
                </label>
              ))}
            </fieldset>
            {mencao !== null && (
              <p className="dialogo__nota">
                {casada !== null
                  ? `“${mencao}” será trocado pela remissiva a ${casada.rotulo}, que acompanha a numeração.`
                  : `“${mencao}” não é o rótulo de nenhum elemento: escolha o elemento; o texto fica como menção sem número.`}
              </p>
            )}
            <fieldset className="tipos-trabalho remissiva__forma">
              <legend>Como aparece no texto</legend>
              <label className="tipos-trabalho__opcao">
                <input type="radio" name={`${base}-forma`} checked={!semNumero} onChange={() => setSemNumero(false)} />
                <span className="tipos-trabalho__nome">Com o número (“Quadro 2”, “Tabela 3”), que acompanha a numeração</span>
              </label>
              <label className="tipos-trabalho__opcao">
                <input type="radio" name={`${base}-forma`} checked={semNumero} onChange={() => setSemNumero(true)} />
                <span className="tipos-trabalho__nome">Sem número, com o meu texto (“o quadro a seguir”)</span>
              </label>
              {semNumero && (
                <>
                  <label htmlFor={`${base}-texto`}>Texto da menção</label>
                  <input
                    id={`${base}-texto`}
                    className="campo"
                    type="text"
                    value={texto}
                    maxLength={LIMITE_TEXTO}
                    aria-invalid={!textoValido}
                    aria-describedby={`${base}-dica-texto`}
                    onChange={(ev) => setTexto(ev.target.value.replace(/[\u0000-\u001F]+/g, ' '))}
                  />
                  <p className="dialogo__nota" id={`${base}-dica-texto`}>
                    O texto não muda com a numeração; a ligação com o elemento fica registrada e aparece no gerenciador da aba Elementos.
                  </p>
                </>
              )}
            </fieldset>
            <p className="dialogo__nota">Com número, no texto aparece só o rótulo (“2.1” na seção, “Tabela 3”, “(2)” na equação, “APÊNDICE A”).</p>
          </>
        )}
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            {elementos.length === 0 ? 'Fechar' : 'Cancelar'}
          </button>
          {elementos.length > 0 && (
            <button type="submit" className="btn-principal" disabled={escolhido === null || (semNumero && !textoValido)}>
              {acao}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
