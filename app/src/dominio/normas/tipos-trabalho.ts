/**
 * Elementos de cada tipo de trabalho, com a presença e as RN (M2-T02; RF-02). Os dados transcrevem a tabela "Ordem dos elementos
 * por tipo de trabalho" de `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md`; a ordem é a de `dominio/modelo/elementos`.
 *
 * Os dados ficam em `perfis/uft-2022/perfil.json`, como `Perfil.tiposTrabalho` (M3-T02; ADR-0005, seção 3). Aqui ficam
 * os tipos e o que se deriva deles. `tests/tipos-trabalho.test.ts` confere cada RN contra a matriz.
 *
 * Presença:
 * - `obrigatorio`: o Manual exige; entra no trabalho novo e a ausência é pendência do verificador (RF-04);
 * - `condicional`: obrigatório só em certa condição (agradecimentos de bolsista, RN-147); não entra no trabalho novo;
 * - `opcional`: o Manual prevê; não entra, o autor acrescenta;
 * - `sugerido`: o Manual não define para o tipo (PENDENTE-FONTE) e o modelo UFT traz; entra como sugestão editável, e
 *   o verificador nunca acusa a ausência (C-B18, estendida ao corpo do artigo-TCC no M2-T02);
 * - `naoDefinido`: o Manual não define e o modelo não traz; não entra, o autor pode acrescentar.
 * Elemento sem fonte não entra como definitivo: nenhum `obrigatorio` sem RN `CONFIRMADA`.
 */
import {
  ORDEM_POS_TEXTUAIS,
  ORDEM_PRE_TEXTUAIS,
  type ElementoPosTextualId,
  type ElementoPreTextualId,
  type TipoTrabalhoUft,
} from '../modelo';
import type { Perfil } from './perfil';

export type PresencaElemento = 'obrigatorio' | 'condicional' | 'opcional' | 'sugerido' | 'naoDefinido';

export type ElementoTextualId = 'introducao' | 'desenvolvimento' | 'conclusao';

/** Seção criada no trabalho novo para um elemento textual. O título é editável; a caixa vem do perfil (M3). */
export interface SecaoInicial {
  titulo: string;
  subsecoes?: readonly SecaoInicial[];
}

export interface Presenca {
  presenca: PresencaElemento;
  /** RN da matriz que sustentam a presença; vazio em `sugerido` e `naoDefinido`. */
  rn: readonly string[];
  /** Onde conferir: página e seção do Manual (M) ou o modelo UFT de onde veio a sugestão. */
  fonte: string;
}

export interface EstruturaTipo {
  preTextuais: Readonly<Record<ElementoPreTextualId, Presenca>>;
  /** Na ordem do texto; as seções iniciais entram quando a presença é `obrigatorio` ou `sugerido`. */
  textuais: readonly (Presenca & { elemento: ElementoTextualId; secoes: readonly SecaoInicial[] })[];
  posTextuais: Readonly<Record<ElementoPosTextualId, Presenca>>;
}

/** Entra no trabalho novo: o exigido pelo Manual e o sugerido pelo modelo UFT. */
export const entraNoTrabalhoNovo = (p: PresencaElemento): boolean => p === 'obrigatorio' || p === 'sugerido';

export interface EstruturaInicial {
  preTextuais: ElementoPreTextualId[];
  secoes: SecaoInicial[];
  posTextuais: ElementoPosTextualId[];
}

/** Elementos e seções do trabalho novo do tipo, na ordem do Quadro 5. */
export function estruturaInicial(tipo: TipoTrabalhoUft, perfil: Perfil): EstruturaInicial {
  const e = perfil.tiposTrabalho[tipo];
  return {
    preTextuais: ORDEM_PRE_TEXTUAIS.filter((id) => entraNoTrabalhoNovo(e.preTextuais[id].presenca)),
    secoes: e.textuais.filter((t) => entraNoTrabalhoNovo(t.presenca)).flatMap((t) => t.secoes),
    posTextuais: ORDEM_POS_TEXTUAIS.filter((id) => entraNoTrabalhoNovo(e.posTextuais[id].presenca)),
  };
}
