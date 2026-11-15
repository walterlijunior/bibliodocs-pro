/**
 * Divisor do painel da estrutura (Etapa 2 da especificação revista): arrastar com o mouse ou usar as setas (Home e End
 * vão aos limites) muda a largura do painel lateral da aba Escrever. A largura fica neste computador.
 *
 * Limites: de `LARGURA_MIN` a `LARGURA_MAX` px e, em qualquer janela, no máximo 45% da área (o CSS aplica com `clamp`,
 * então o painel nunca encobre o editor numa janela estreita, nem depois de a janela encolher).
 */
import { useEffect, useRef, type CSSProperties } from 'react';

export const LARGURA_MIN = 180;
export const LARGURA_MAX = 560;
export const LARGURA_PADRAO = 260;
const PASSO = 20;
const CHAVE = 'bibliodocs.larguraEstrutura';

export const limitarLargura = (n: number): number => Math.round(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, n)));

export function lerLarguraEstrutura(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE));
    return Number.isFinite(n) && n > 0 ? limitarLargura(n) : LARGURA_PADRAO;
  } catch {
    return LARGURA_PADRAO;
  }
}

export function gravarLarguraEstrutura(n: number): void {
  try {
    localStorage.setItem(CHAVE, String(n));
  } catch {
    /* armazenamento indisponível: vale só nesta sessão */
  }
}

/** Variável CSS da largura, para o contêiner da grade. */
export const estiloLargura = (n: number): CSSProperties => ({ ['--largura-estrutura' as string]: `${n}px` });

export interface PropsDivisorEstrutura {
  largura: number;
  /** Id do painel que o divisor controla. */
  controla: string;
  aoMudar: (n: number) => void;
}

export function DivisorEstrutura(p: PropsDivisorEstrutura) {
  const ref = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ x: number; inicial: number } | null>(null);
  // Largura de fato desenhada (o CSS pode ter limitado a 45% da área numa janela estreita).
  const desenhada = () => {
    const painel = document.getElementById(p.controla);
    return painel instanceof HTMLElement ? painel.getBoundingClientRect().width : p.largura;
  };

  useEffect(() => () => void (arraste.current = null), []);

  return (
    <div
      ref={ref}
      className="escrever__divisor"
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura do painel da estrutura"
      aria-controls={p.controla}
      aria-valuemin={LARGURA_MIN}
      aria-valuemax={LARGURA_MAX}
      aria-valuenow={p.largura}
      aria-valuetext={`${p.largura} pixels`}
      tabIndex={0}
      title="Arraste para mudar a largura do painel (ou use as setas)"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        arraste.current = { x: e.clientX, inicial: desenhada() };
      }}
      onPointerMove={(e) => {
        const a = arraste.current;
        if (a) p.aoMudar(limitarLargura(a.inicial + e.clientX - a.x));
      }}
      onPointerUp={(e) => {
        arraste.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => void (arraste.current = null)}
      onDoubleClick={() => p.aoMudar(LARGURA_PADRAO)}
      onKeyDown={(e) => {
        const base = Math.min(p.largura, Math.round(desenhada()));
        const novo =
          e.key === 'ArrowLeft' ? base - PASSO : e.key === 'ArrowRight' ? base + PASSO : e.key === 'Home' ? LARGURA_MIN : e.key === 'End' ? LARGURA_MAX : null;
        if (novo === null) return;
        e.preventDefault();
        p.aoMudar(limitarLargura(novo));
      }}
    />
  );
}
