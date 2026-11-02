/**
 * Elementos pré e pós-textuais no modelo (M2-T02): a ordem canônica e quais se repetem. Fatos de estrutura, usados
 * pela leitura do `.bdp` e pelas operações; a obrigatoriedade por tipo de trabalho, com as RN, fica em
 * `dominio/normas/tipos-trabalho` (o modelo não conhece regras RN, ADR-0005).
 */
import type { Documento, ElementoPosTextual, ElementoPosTextualId, ElementoPreTextualId, Id, TipoTrabalhoId, TipoTrabalhoUft } from './tipos';

/** Os seis tipos oferecidos ao criar um trabalho, na ordem em que aparecem para o usuário. */
export const TIPOS_TRABALHO_UFT: readonly TipoTrabalhoUft[] = [
  'monografia',
  'artigo-tcc',
  'dissertacao',
  'tese',
  'relatorio-tecnico',
  'projeto-pesquisa',
];

export const TIPOS_TRABALHO: readonly TipoTrabalhoId[] = ['generico', ...TIPOS_TRABALHO_UFT];

export const ehTipoTrabalhoUft = (v: unknown): v is TipoTrabalhoUft => TIPOS_TRABALHO_UFT.includes(v as TipoTrabalhoUft);

/** Ordem do Quadro 5 do Manual UFT (p. 30–31), com a ficha no verso da folha de rosto (p. 34, 5.4). */
export const ORDEM_PRE_TEXTUAIS: readonly ElementoPreTextualId[] = [
  'capa',
  'folhaRosto',
  'fichaCatalografica',
  'errata',
  'folhaAprovacao',
  'dedicatoria',
  'agradecimentos',
  'epigrafe',
  'resumo',
  'abstract',
  'listaIlustracoes',
  'listaTabelas',
  'listaSiglas',
  'listaSimbolos',
  'sumario',
];

/** Ordem do Quadro 5 (p. 31). */
export const ORDEM_POS_TEXTUAIS: readonly ElementoPosTextualId[] = ['referencias', 'glossario', 'apendice', 'anexo', 'indice'];

/** Os únicos elementos que aparecem mais de uma vez (APÊNDICE A, B…; ANEXO A, B…). */
export const ELEMENTOS_REPETIVEIS: ReadonlySet<ElementoPosTextualId> = new Set(['apendice', 'anexo']);

/** Apêndices e anexos num trabalho: A–Z e depois letras dobradas (RN-232, RN-235) dão folga de sobra. */
export const MAXIMO_REPETICOES_ELEMENTO = 200;

/**
 * Lista com o elemento novo no lugar dele no Quadro 5 (RN-114): apêndice novo depois dos apêndices que já existem.
 * `null` = o tipo já está na lista e não se repete, ou chegou ao limite de repetições.
 */
export function incluirPosTextual(lista: readonly ElementoPosTextual[], tipo: ElementoPosTextualId, id: Id): ElementoPosTextual[] | null {
  const iguais = lista.filter((e) => e.tipo === tipo).length;
  if (iguais >= (ELEMENTOS_REPETIVEIS.has(tipo) ? MAXIMO_REPETICOES_ELEMENTO : 1)) return null;
  const posicao = ORDEM_POS_TEXTUAIS.indexOf(tipo);
  const i = lista.findIndex((e) => ORDEM_POS_TEXTUAIS.indexOf(e.tipo) > posicao);
  const novo = { tipo, id } as ElementoPosTextual;
  return i < 0 ? [...lista, novo] : [...lista.slice(0, i), novo, ...lista.slice(i)];
}

/** Lista sem o elemento; a mesma lista se o id não está nela. */
export function retirarPosTextual(lista: ElementoPosTextual[], id: Id): ElementoPosTextual[] {
  return lista.some((e) => e.id === id) ? lista.filter((e) => e.id !== id) : lista;
}

export interface ProblemaElementos {
  lista: 'preTextuais' | 'posTextuais';
  indice: number;
  motivo: 'tipoSemElementos' | 'foraDeOrdem' | 'repetido' | 'repeticoesDemais';
}

/**
 * Primeiro problema das listas de elementos do documento, ou `null`. Confere: o tipo `generico` não tem elementos;
 * cada lista segue a ordem canônica; só apêndice e anexo se repetem, até `MAXIMO_REPETICOES_ELEMENTO`.
 * Elemento obrigatório ausente **não** é problema do modelo: é pendência do verificador (RF-04).
 */
export function problemaNosElementos(doc: Pick<Documento, 'tipoTrabalho' | 'preTextuais' | 'posTextuais'>): ProblemaElementos | null {
  const conferir = <T extends string>(
    lista: 'preTextuais' | 'posTextuais',
    itens: readonly { tipo: T }[] | undefined,
    ordem: readonly T[],
    repetiveis: ReadonlySet<T>,
  ) => {
    if (itens === undefined) return null;
    if (doc.tipoTrabalho === 'generico' && itens.length > 0) return { lista, indice: 0, motivo: 'tipoSemElementos' } as const;
    let anterior = -1;
    let repeticoes = 0;
    for (const [indice, e] of itens.entries()) {
      const posicao = ordem.indexOf(e.tipo);
      if (posicao < anterior) return { lista, indice, motivo: 'foraDeOrdem' } as const;
      if (posicao === anterior) {
        if (!repetiveis.has(e.tipo)) return { lista, indice, motivo: 'repetido' } as const;
        if (++repeticoes >= MAXIMO_REPETICOES_ELEMENTO) return { lista, indice, motivo: 'repeticoesDemais' } as const;
      } else {
        repeticoes = 0;
      }
      anterior = posicao;
    }
    return null;
  };
  return (
    conferir('preTextuais', doc.preTextuais, ORDEM_PRE_TEXTUAIS, new Set()) ??
    conferir('posTextuais', doc.posTextuais, ORDEM_POS_TEXTUAIS, ELEMENTOS_REPETIVEIS)
  );
}
