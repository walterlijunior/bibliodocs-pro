/**
 * Texto plano de um conteúdo `Inline[]`, sem marcas. Usado onde a formatação não cabe: nome de arquivo sugerido,
 * índice da biblioteca, busca (pendência do M1-T04 para o M1-T08/T09).
 */
import type { Inline } from './tipos';

/**
 * Junta os textos; tabulação e quebra de linha manual viram espaço, e espaços repetidos viram um só. A nota de rodapé
 * fica de fora (não é parte da frase em que está).
 */
export function textoPlano(conteudo: readonly Inline[]): string {
  return conteudo
    .map((i) => (i.tipo === 'texto' ? i.texto : ''))
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();
}
