/**
 * Regras puras de teclado da casca (M1-T10): atalhos globais, movimento na grade 2D, nos menus e nas abas, e o
 * histórico de Voltar/Avançar. Sem DOM, para ser testado em Node.
 */

export interface Tecla {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey?: boolean;
}

export type AcaoGlobal = 'buscar' | 'novoTrabalho' | 'voltar' | 'avancar';

/** Atalho global da janela; `null` deixa a tecla seguir para o controle em foco. */
export function acaoDoAtalho(t: Tecla): AcaoGlobal | null {
  const tecla = t.key.length === 1 ? t.key.toLowerCase() : t.key;
  if (t.ctrlKey && !t.altKey && !t.shiftKey && tecla === 'f') return 'buscar';
  if (t.ctrlKey && !t.altKey && !t.shiftKey && tecla === 'n') return 'novoTrabalho';
  if (t.altKey && !t.ctrlKey && !t.shiftKey && tecla === 'ArrowLeft') return 'voltar';
  if (t.altKey && !t.ctrlKey && !t.shiftKey && tecla === 'ArrowRight') return 'avancar';
  return null;
}

/**
 * Tecla com Ctrl, Alt ou Windows pertence aos atalhos globais (ex.: Alt+Seta = Voltar): os controles com setas
 * (grade, abas, menus) a ignoram, senão a mesma tecla faria duas coisas.
 */
export function temModificador(t: Pick<Tecla, 'ctrlKey' | 'altKey' | 'metaKey'>): boolean {
  return t.ctrlKey || t.altKey || t.metaKey === true;
}

/** Próximo índice na grade de capas (setas em 2D, Home/End); `null` = tecla não é de movimento. */
export function proximoIndiceGrade(tecla: string, atual: number, total: number, colunas: number): number | null {
  if (total <= 0) return null;
  const n = Math.max(1, colunas);
  const ultimo = total - 1;
  switch (tecla) {
    case 'ArrowRight':
      return Math.min(atual + 1, ultimo);
    case 'ArrowLeft':
      return Math.max(atual - 1, 0);
    case 'ArrowDown':
      return Math.min(atual + n, ultimo);
    case 'ArrowUp':
      return Math.max(atual - n, 0);
    case 'Home':
      return 0;
    case 'End':
      return ultimo;
    default:
      return null;
  }
}

/** Movimento circular (abas, barra de menus, itens de um menu). */
export function moverCiclico(atual: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (((atual + delta) % total) + total) % total;
}

/** Próxima aba no padrão ARIA de abas (setas circulares, Home, End); `null` = não é tecla de aba. */
export function proximaAba(tecla: string, atual: number, total: number): number | null {
  switch (tecla) {
    case 'ArrowRight':
      return moverCiclico(atual, 1, total);
    case 'ArrowLeft':
      return moverCiclico(atual, -1, total);
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

/** Histórico de navegação (Voltar/Avançar), imutável: cada função devolve um histórico novo. */
export interface Historico<T> {
  readonly passado: readonly T[];
  readonly atual: T;
  readonly futuro: readonly T[];
}

export const LIMITE_HISTORICO = 50;

export function iniciarHistorico<T>(atual: T): Historico<T> {
  return { passado: [], atual, futuro: [] };
}

/** Ir para um lugar novo descarta o "Avançar"; ir para o mesmo lugar não muda nada. */
export function navegar<T>(h: Historico<T>, destino: T, igual: (a: T, b: T) => boolean): Historico<T> {
  if (igual(h.atual, destino)) return h;
  return { passado: [...h.passado, h.atual].slice(-LIMITE_HISTORICO), atual: destino, futuro: [] };
}

export function voltar<T>(h: Historico<T>): Historico<T> {
  const anterior = h.passado.at(-1);
  if (anterior === undefined) return h;
  return { passado: h.passado.slice(0, -1), atual: anterior, futuro: [h.atual, ...h.futuro] };
}

export function avancar<T>(h: Historico<T>): Historico<T> {
  const [proximo, ...resto] = h.futuro;
  if (proximo === undefined) return h;
  return { passado: [...h.passado, h.atual], atual: proximo, futuro: resto };
}
