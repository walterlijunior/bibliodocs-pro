/** Obras e citações no modelo (M4-T01): listas fechadas e percurso das chamadas. */
import { conteudosDoBloco } from './percorrer';
import type { Documento, FuncaoResponsavel, InlineCitacao, Secao, TipoObra } from './tipos';

/** Primeira leva de tipos (D-M4-06), na ordem em que o cadastro os oferece. */
export const TIPOS_OBRA: readonly TipoObra[] = [
  'livro',
  'capitulo',
  'trabalhoAcademico',
  'artigoPeriodico',
  'trabalhoEvento',
  'artigoJornal',
  'norma',
  'legislacao',
  'documentoOnline',
];

export const FUNCOES_RESPONSAVEL: readonly FuncaoResponsavel[] = ['org', 'coord', 'ed', 'comp'];

/** Todas as chamadas de citação do corpo, também as das notas (M4-T07), em ordem de leitura. */
export function citacoesDoDocumento(doc: Pick<Documento, 'corpo'>): InlineCitacao[] {
  const saida: InlineCitacao[] = [];
  const visitar = (s: Secao) => {
    for (const b of s.blocos) {
      for (const c of conteudosDoBloco(b)) {
        for (const i of c) {
          if (i.tipo === 'citacao') saida.push(i);
          else if (i.tipo === 'nota') for (const n of i.conteudo) if (n.tipo === 'citacao') saida.push(n);
        }
      }
    }
    s.subsecoes.forEach(visitar);
  };
  doc.corpo.forEach(visitar);
  return saida;
}
