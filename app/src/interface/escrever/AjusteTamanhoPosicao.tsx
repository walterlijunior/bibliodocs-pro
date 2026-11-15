/**
 * "Ajustar tamanho e posição" (Etapa 4 da especificação revista; decisão do usuário em 2026-11-15, opção 1, D-E4-05):
 * prévia da página do perfil (margens e linhas de texto acima e abaixo) com o elemento no lugar em que a exportação o
 * põe: centralizado e no fluxo do texto (RN-059). Figura e gráfico mudam de largura pelas alças (arrastar com o mouse ou
 * setas do teclado; a figura continua centralizada), pelo campo em milímetros ou pelos atalhos. Tabela e quadro ocupam a
 * largura do texto: só a prévia. As posições que a norma não prevê (cantos, texto ao redor) aparecem desativadas, com a
 * explicação. "Aplicar" devolve a largura; "Cancelar" e Esc não mudam nada.
 */
import { useEffect, useId, useRef, useState, type PointerEvent as EventoPonteiro } from 'react';
import type { PaginaMm } from '../../aplicacao';
import { aoFecharDialogo } from '../casca/dialogo';

export type TipoAjuste = 'figura' | 'grafico' | 'tabela' | 'quadro';

export interface PropsAjusteTamanhoPosicao {
  tipo: TipoAjuste;
  pagina: PaginaMm;
  /** Largura escolhida; `undefined` = a natural (figura) ou a padrão (gráfico). */
  larguraMm: number | undefined;
  /** Largura que vale quando `larguraMm` está ausente. */
  larguraPadraoMm: number;
  /** Altura ÷ largura do elemento (para desenhar a caixa). */
  proporcao: number;
  limites: { minimo: number; maximo: number };
  /** Imagem do elemento para a prévia (URL de objeto ou dados). */
  imagem?: string | null;
  /** O que se chama "tamanho natural" para este tipo (figura: o da imagem; gráfico: o padrão). */
  rotuloPadrao?: string;
  aoAplicar: (larguraMm: number | undefined) => void;
  aoCancelar: () => void;
}

const NOMES: Readonly<Record<TipoAjuste, string>> = { figura: 'a figura', grafico: 'o gráfico', tabela: 'a tabela', quadro: 'o quadro' };
const DE: Readonly<Record<TipoAjuste, string>> = { figura: 'da figura', grafico: 'do gráfico', tabela: 'da tabela', quadro: 'do quadro' };
/** Largura da página desenhada, em px de CSS. */
const LARGURA_DESENHO = 340;
const LINHAS_TEXTO = 5;

export function AjusteTamanhoPosicao(p: PropsAjusteTamanhoPosicao) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const area = Math.round((p.pagina.larguraMm - p.pagina.margemEsquerdaMm - p.pagina.margemDireitaMm) * 10) / 10;
  const ajustavel = p.tipo === 'figura' || p.tipo === 'grafico';
  const [largura, setLargura] = useState<number | undefined>(p.larguraMm);
  const [texto, setTexto] = useState(p.larguraMm !== undefined ? String(p.larguraMm) : '');
  const arraste = useRef<{ x: number; inicial: number; lado: 1 | -1 } | null>(null);

  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('[role="slider"], .btn-secundario')?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus({ preventScroll: true });
    };
  }, []);

  const maximo = Math.min(p.limites.maximo, Math.floor(area));
  const limitar = (n: number) => Math.round(Math.min(maximo, Math.max(p.limites.minimo, n)));
  const efetiva = ajustavel ? Math.min(largura ?? p.larguraPadraoMm, area) : area;
  const escala = LARGURA_DESENHO / p.pagina.larguraMm;
  const mudar = (n: number | undefined) => {
    setLargura(n);
    setTexto(n === undefined ? '' : String(n));
  };
  const numero = texto.trim() === '' ? undefined : Number(texto.trim().replace(',', '.'));
  const valido = numero === undefined || (Number.isInteger(numero) && numero >= p.limites.minimo && numero <= p.limites.maximo);

  const comecar = (lado: 1 | -1) => (e: EventoPonteiro<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arraste.current = { x: e.clientX, inicial: efetiva, lado };
  };
  // Centralizada: puxar uma alça muda os dois lados (a largura cresce o dobro do deslocamento).
  const mover = (e: EventoPonteiro<HTMLDivElement>) => {
    const a = arraste.current;
    if (a) mudar(limitar(a.inicial + (2 * a.lado * (e.clientX - a.x)) / escala));
  };
  const soltar = (e: EventoPonteiro<HTMLDivElement>) => {
    arraste.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const alturaEl = Math.max(8, efetiva * p.proporcao);
  const caixa = {
    left: (p.pagina.margemEsquerdaMm + (area - efetiva) / 2) * escala,
    width: efetiva * escala,
    height: alturaEl * escala,
  };
  const linhas = (n: number, chave: string) =>
    Array.from({ length: n }, (_, i) => <span key={`${chave}${i}`} className="ajuste__linha" style={{ width: i === n - 1 ? '60%' : '100%' }} />);

  const alca = (lado: 1 | -1) =>
    ajustavel ? (
      <div
        className={`ajuste__alca ajuste__alca--${lado === 1 ? 'direita' : 'esquerda'}`}
        // A alça esquerda é só para o mouse: o teclado e o leitor de tela usam a direita (um controle só).
        {...(lado === 1 ? { role: 'slider', tabIndex: 0 } : { 'aria-hidden': true })}
        aria-label={lado === 1 ? `Largura ${DE[p.tipo]}` : undefined}
        aria-valuemin={p.limites.minimo}
        aria-valuemax={maximo}
        aria-valuenow={Math.round(efetiva)}
        aria-valuetext={`${Math.round(efetiva)} mm`}
        onPointerDown={comecar(lado)}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={() => void (arraste.current = null)}
        onKeyDown={(e) => {
          const passo = e.shiftKey ? 10 : 1;
          const n = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? efetiva + passo : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? efetiva - passo : e.key === 'Home' ? p.limites.minimo : e.key === 'End' ? maximo : null;
          if (n === null) return;
          e.preventDefault();
          mudar(limitar(n));
        }}
      />
    ) : null;

  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--ajuste"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoCancelar();
      }}
      onClose={aoFecharDialogo(p.aoCancelar)}
    >
      <div className="dialogo__corpo">
        <h2 id={`${base}-titulo`}>Ajustar tamanho e posição</h2>
        <div className="ajuste">
          <div
            className="ajuste__pagina"
            role="img"
            aria-label={`Prévia da página: ${NOMES[p.tipo]} com ${Math.round(efetiva)} mm de largura, centralizad${p.tipo === 'figura' || p.tipo === 'tabela' ? 'a' : 'o'}, entre parágrafos do texto`}
            style={{ width: LARGURA_DESENHO, height: p.pagina.alturaMm * escala }}
          >
            <div
              className="ajuste__area"
              style={{ left: p.pagina.margemEsquerdaMm * escala, right: p.pagina.margemDireitaMm * escala, top: p.pagina.margemSuperiorMm * escala, bottom: p.pagina.margemInferiorMm * escala }}
            >
              <div className="ajuste__texto">{linhas(LINHAS_TEXTO, 'a')}</div>
              <span className="ajuste__legenda" style={{ width: '45%' }} />
              <div className="ajuste__elemento" style={{ marginLeft: caixa.left - p.pagina.margemEsquerdaMm * escala, width: caixa.width, height: caixa.height }}>
                {p.imagem ? <img src={p.imagem} alt="" /> : <span className={p.tipo === 'tabela' || p.tipo === 'quadro' ? `ajuste__grade ajuste__grade--${p.tipo}` : 'ajuste__vazio'} />}
                {alca(-1)}
                {alca(1)}
              </div>
              <span className="ajuste__legenda" style={{ width: '30%' }} />
              <div className="ajuste__texto">{linhas(LINHAS_TEXTO, 'b')}</div>
            </div>
          </div>

          <div className="ajuste__controles">
            {ajustavel ? (
              <>
                <div className="elemento__campo">
                  <label htmlFor={`${base}-mm`}>Largura (mm)</label>
                  <input
                    id={`${base}-mm`}
                    className="campo campo--curto"
                    inputMode="numeric"
                    value={texto}
                    placeholder={String(Math.round(Math.min(p.larguraPadraoMm, area)))}
                    aria-invalid={!valido || undefined}
                    aria-describedby={`${base}-mm-dica`}
                    onChange={(e) => {
                      setTexto(e.target.value);
                      const t = e.target.value.trim();
                      const n = Number(t.replace(',', '.'));
                      if (t === '') setLargura(undefined);
                      else if (Number.isFinite(n) && n > 0) setLargura(n);
                    }}
                  />
                  <span id={`${base}-mm-dica`} className={valido ? 'dica' : 'dica dica--erro'}>
                    {valido ? `A área do texto tem ${String(area).replace('.', ',')} mm. Arraste as alças ou use as setas.` : `Use um número inteiro de ${p.limites.minimo} a ${p.limites.maximo} mm.`}
                  </span>
                </div>
                <div className="acoes" role="group" aria-label="Tamanhos prontos">
                  <button type="button" className="btn-secundario" onClick={() => mudar(Math.floor(area))}>
                    Largura do texto
                  </button>
                  <button type="button" className="btn-secundario" onClick={() => mudar(limitar(area / 2))}>
                    Metade
                  </button>
                  <button type="button" className="btn-secundario" onClick={() => mudar(undefined)}>
                    {p.rotuloPadrao ?? 'Tamanho natural'}
                  </button>
                </div>
              </>
            ) : (
              <p className="dica">
                {p.tipo === 'tabela' ? 'A tabela' : 'O quadro'} ocupa a largura do texto ({String(area).replace('.', ',')} mm); as colunas se ajustam ao conteúdo. Para mudar a
                distribuição, ajuste o conteúdo das colunas na grade.
              </p>
            )}

            <fieldset className="tipos-trabalho" aria-describedby={`${base}-posicao-dica`}>
              <legend>Posição</legend>
              <label className="tipos-trabalho__opcao">
                <input type="radio" name={`${base}-posicao`} defaultChecked />
                <span className="tipos-trabalho__nome">Centralizad{p.tipo === 'figura' || p.tipo === 'tabela' ? 'a' : 'o'}, no fluxo do texto</span>
              </label>
              {['Superior esquerda', 'Superior direita', 'Com o texto ao redor'].map((r) => (
                <label key={r} className="tipos-trabalho__opcao ajuste__indisponivel">
                  <input type="radio" name={`${base}-posicao`} disabled />
                  <span className="tipos-trabalho__nome">{r}</span>
                </label>
              ))}
              <p className="dica" id={`${base}-posicao-dica`}>
                O Manual da UFT põe ilustrações e tabelas centralizadas, entre parágrafos, com o título acima e a fonte abaixo (RN-059; p. 19–20). As outras
                posições não estão disponíveis neste perfil.
              </p>
            </fieldset>
          </div>
        </div>
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoCancelar}>
            Cancelar
          </button>
          {ajustavel && (
            <button type="button" className="btn-principal" disabled={!valido} onClick={() => p.aoAplicar(numero === undefined ? undefined : limitar(numero))}>
              Aplicar
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
