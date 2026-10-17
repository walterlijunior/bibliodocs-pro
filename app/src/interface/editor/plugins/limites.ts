/**
 * Limites de quantidade do formato v1 no editor (M2-T05; achado A1 da revisão). Um documento acima deles faria a leitura
 * do `.bdp` recusar o arquivo inteiro, então a transação que os ultrapassa é recusada (`filterTransaction`) e a colagem
 * confere antes e avisa (`colagem.ts`).
 *
 * Cópias de `LIMITES_V1` (a interface só importa tipos do domínio; `tests/editor-limites.test.ts` confere os valores).
 * A contagem de trechos é um teto do que a conversão produz: cada filho do ProseMirror vira no máximo um trecho, mais
 * um a cada `LIMITE_TEXTO_INLINE` caracteres (a divisão do texto longo).
 */
import type { Node as NoPm } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { LIMITE_TEXTO_INLINE } from '../conversao';

export const LIMITES_EDITOR = {
  inlinesPorConteudo: 10_000,
  blocosPorSecao: 10_000,
  itensPorAlineas: 1_000,
  subalineasPorAlinea: 1_000,
} as const;

export const chaveLimites = new PluginKey('limites');

/** Teto de trechos do modelo que um nó com conteúdo inline produz. */
function trechos(no: NoPm): number {
  let n = 0;
  no.forEach((filho) => {
    n += 1 + (filho.isText ? Math.floor((filho.text?.length ?? 0) / LIMITE_TEXTO_INLINE) : 0);
  });
  return n;
}

/** O documento da seção passa de algum limite de quantidade do v1? */
export function excedeLimites(doc: NoPm): boolean {
  if (doc.childCount - 1 > LIMITES_EDITOR.blocosPorSecao) return true;
  let excede = false;
  doc.descendants((no) => {
    if (excede) return false;
    if (no.type.name === 'alineas' && no.childCount > LIMITES_EDITOR.itensPorAlineas) excede = true;
    else if (no.type.name === 'alinea' && no.childCount - 1 > LIMITES_EDITOR.subalineasPorAlinea) excede = true;
    else if (no.inlineContent && trechos(no) > LIMITES_EDITOR.inlinesPorConteudo) excede = true;
    // Desce também nos blocos de texto, para chegar ao conteúdo das notas.
    return !excede;
  });
  return excede;
}

/** Recusa a transação que deixaria a seção acima de um limite. */
export function pluginLimites(): Plugin {
  return new Plugin({
    key: chaveLimites,
    filterTransaction: (tr) => !tr.docChanged || !excedeLimites(tr.doc),
  });
}
