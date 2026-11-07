/**
 * Datas das referências (M4-T02): meses abreviados do Anexo do Manual (RN-190, p. 72) e ano com as marcas de data
 * incerta (RN-193, RN-097; D-M4-04, D-M4-05, provisórias).
 */
import type { Obra } from '../modelo';

/** Português, Anexo do Manual, p. 72. "maio" não se abrevia. Os outros idiomas da tabela têm erros (RN-190). */
export const MESES_ABREVIADOS = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'] as const;

/** "2006-06-23" → "23 jun. 2006"; `null` se a data não for AAAA-MM-DD válida. */
export function dataAbreviada(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return null;
  return `${dia} ${MESES_ABREVIADOS[mes - 1]} ${ano}`;
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Ano como sai na referência: "2003", "[2016?]" (provável), "[2016]" (certo, não impresso). O sufixo de mesmo autor
 * e ano (D-M4-03) vai colado ao ano: "2020a".
 */
export function anoDaReferencia(obra: Pick<Obra, 'ano' | 'anoIncerto'>, sufixo = ''): string | null {
  if (obra.ano === undefined) return null;
  const ano = `${obra.ano}${sufixo}`;
  if (obra.anoIncerto === 'provavel') return `[${ano}?]`;
  if (obra.anoIncerto === 'naoImpresso') return `[${ano}]`;
  return ano;
}
