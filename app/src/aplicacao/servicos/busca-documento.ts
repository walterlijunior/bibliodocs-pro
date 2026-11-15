/**
 * Busca no documento (Etapa 2 da especificação de atualização, D-E2-05): procura um termo nos títulos e no texto das
 * seções do corpo, sem diferença de maiúsculas nem de acentos ("funcao" acha "Função"), e devolve cada ocorrência com
 * a seção (indicativo e título), o bloco, o trecho exato como está no texto e um pedaço do contexto, para a lista de
 * resultados e o salto ao trecho. Puro.
 */
import { numerarSecoes } from '../../dominio/numeracao/secoes';
import { conteudosDoBloco } from '../../dominio/modelo';
import type { Id, Inline, Secao } from '../../dominio/modelo';

export interface ResultadoBusca {
  secao: Id;
  /** "2.1" (vazio além do limite de numeração). */
  indicativo: string;
  tituloSecao: string;
  /** Bloco onde está; no título, o id da seção. */
  bloco: Id;
  noTitulo: boolean;
  /** O trecho como está no texto (com acentos e maiúsculas). */
  trecho: string;
  antes: string;
  depois: string;
}

export const LIMITE_RESULTADOS_BUSCA = 500;
const CONTEXTO = 40;

/** Texto sem acento e em minúsculas, com o índice de cada caractere no original. */
function normalizado(texto: string): { t: string; idx: number[] } {
  let t = '';
  const idx: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const base = texto[i]!.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (const ch of base) {
      t += ch;
      idx.push(i);
    }
  }
  return { t, idx };
}

const textoDe = (c: readonly Inline[]): string => c.map((i) => (i.tipo === 'texto' ? i.texto : i.tipo === 'remissiva' ? (i.texto ?? '') : '')).join('');

function ocorrencias(texto: string, termo: string): { de: number; ate: number }[] {
  const { t, idx } = normalizado(texto);
  const saida: { de: number; ate: number }[] = [];
  for (let k = t.indexOf(termo); k >= 0 && saida.length < LIMITE_RESULTADOS_BUSCA; k = t.indexOf(termo, k + Math.max(1, termo.length))) {
    const de = idx[k]!;
    const ate = idx[k + termo.length - 1]! + 1;
    saida.push({ de, ate });
  }
  return saida;
}

export function buscarNoDocumento(corpo: readonly Secao[], termo: string): ResultadoBusca[] {
  const alvo = normalizado(termo.trim()).t;
  if (alvo.length < 2) return [];
  const saida: ResultadoBusca[] = [];
  for (const { secao, indicativo, alemDoLimite } of numerarSecoes(corpo)) {
    const tituloSecao = textoDe(secao.titulo);
    const ind = alemDoLimite ? '' : indicativo;
    const registrar = (texto: string, bloco: Id, noTitulo: boolean) => {
      for (const o of ocorrencias(texto, alvo)) {
        if (saida.length >= LIMITE_RESULTADOS_BUSCA) return;
        saida.push({
          secao: secao.id,
          indicativo: ind,
          tituloSecao,
          bloco,
          noTitulo,
          trecho: texto.slice(o.de, o.ate),
          antes: texto.slice(Math.max(0, o.de - CONTEXTO), o.de).replace(/\s+/g, ' '),
          depois: texto.slice(o.ate, o.ate + CONTEXTO).replace(/\s+/g, ' '),
        });
      }
    };
    registrar(tituloSecao, secao.id, true);
    for (const b of secao.blocos) for (const c of conteudosDoBloco(b)) registrar(textoDe(c), b.id, false);
  }
  return saida;
}
