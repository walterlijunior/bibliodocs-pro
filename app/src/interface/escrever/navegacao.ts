/**
 * Abas do trabalho aberto (F-E6-01) e o caminho das não conformidades até elas. Funções puras, sem React.
 */
import type { NaoConformidade } from '../../aplicacao';

/**
 * Parte do trabalho aberto que a área mostra: a aba Escrever (tudo, com o editor), Elementos (pré-textuais,
 * pós-textuais, elementos visuais e cadastros), Referências (obras e conferência) e Conformidade (relatório na página).
 */
export type ModoTrabalho = 'escrever' | 'elementos' | 'referencias' | 'conformidade';

/** Aba onde fica o local de uma não conformidade. */
export function modoDoLocal(local: NaoConformidade['local']): ModoTrabalho {
  return local.tipo === 'preTextual' ? 'elementos' : local.tipo === 'obra' ? 'referencias' : 'escrever';
}

/**
 * Próxima não conformidade com local, depois da de índice `atual` (−1 = do começo), dando a volta no fim. `ordem` é a
 * posição dela entre as que têm local (1 = primeira). `null` se nenhuma tem local.
 */
export function proximaComLocal(problemas: readonly NaoConformidade[], atual: number): { indice: number; ordem: number; total: number } | null {
  const comLocal = problemas.flatMap((c, i) => (c.local.tipo === 'trabalho' ? [] : [i]));
  if (comLocal.length === 0) return null;
  const pos = Math.max(0, comLocal.findIndex((i) => i > atual));
  return { indice: comLocal[pos]!, ordem: pos + 1, total: comLocal.length };
}
