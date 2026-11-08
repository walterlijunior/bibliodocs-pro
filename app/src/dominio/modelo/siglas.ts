/** Percurso das siglas ligadas, na mesma ordem de leitura do motor (M6-T02). Sem decisões de formatação. */
import { conteudosDoBloco } from './percorrer';
import { secoesDeLeitura, type DocumentoDeLeitura } from './leitura';
import type { Inline, InlineSigla, Secao } from './tipos';

export interface OcorrenciaSigla {
  inline: InlineSigla;
  secao: string;
  no: string;
}

export function ocorrenciasDeSiglas(doc: DocumentoDeLeitura): OcorrenciaSigla[] {
  const saida: OcorrenciaSigla[] = [];
  const visitar = (secao: Secao) => {
    const conteudo = (itens: readonly Inline[], no: string) => {
      for (const i of itens) {
        if (i.tipo === 'sigla') saida.push({ inline: i, secao: secao.id, no });
        else if (i.tipo === 'nota') conteudo(i.conteudo, i.id);
      }
    };
    for (const b of secao.blocos) for (const c of conteudosDoBloco(b)) conteudo(c, b.id);
    secao.subsecoes.forEach(visitar);
  };
  secoesDeLeitura(doc).forEach(visitar);
  return saida;
}

/** Chave comparável dos cadastros. Preserva-se a grafia original no arquivo e na exportação. */
export const chaveDeSigla = (sigla: string): string => sigla.normalize('NFKC').trim().toLocaleUpperCase('pt-BR');
