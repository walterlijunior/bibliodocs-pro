/**
 * Elementos de cada tipo de trabalho, com a presença e as RN (M2-T02; RF-02). Transcreve a tabela "Ordem dos elementos
 * por tipo de trabalho" de `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md`; a ordem é a de `dominio/modelo/elementos`.
 *
 * Fica em TypeScript até o perfil existir em dados (M3): então passa a `perfis/uft-2022/` como
 * `Perfil.tiposTrabalho` (ADR-0005, seção 3), com o mesmo conteúdo. `tests/tipos-trabalho.test.ts` confere cada RN
 * contra a matriz.
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

export type PresencaElemento = 'obrigatorio' | 'condicional' | 'opcional' | 'sugerido' | 'naoDefinido';

export type ElementoTextualId = 'introducao' | 'desenvolvimento' | 'conclusao';

/** Seção criada no trabalho novo para um elemento textual. O título é editável; a caixa vem do perfil (M3). */
export interface SecaoInicial {
  titulo: string;
  subsecoes?: readonly SecaoInicial[];
}

interface Presenca {
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

const obr = (rn: readonly string[], fonte: string): Presenca => ({ presenca: 'obrigatorio', rn, fonte });
const opc = (rn: readonly string[], fonte: string): Presenca => ({ presenca: 'opcional', rn, fonte });
const sug = (modelo: string): Presenca => ({ presenca: 'sugerido', rn: [], fonte: `modelo UFT de ${modelo} (exemplo, não norma; C-B18)` });
const nd = (modelo: string): Presenca => ({
  presenca: 'naoDefinido',
  rn: [],
  fonte: `Manual sem estrutura para ${modelo}; ausente do modelo UFT`,
});

/** Quadro 5 do Manual (p. 30–31), comum a monografia, artigo-TCC, dissertação e tese (RN-110 a RN-114). */
const PRE_QUADRO_5: EstruturaTipo['preTextuais'] = {
  capa: obr(['RN-111', 'RN-117'], 'M, p. 30, Quadro 5; p. 31, 5.1'),
  folhaRosto: obr(['RN-111', 'RN-127'], 'M, p. 30, Quadro 5; p. 33, 5.3'),
  fichaCatalografica: obr(['RN-111', 'RN-135'], 'M, p. 34, 5.4 (ausente do Quadro 5, C-B1)'),
  errata: opc(['RN-112', 'RN-138'], 'M, p. 30, Quadro 5; p. 35, 5.5'),
  folhaAprovacao: obr(['RN-111', 'RN-140'], 'M, p. 30, Quadro 5; p. 36, 5.6'),
  dedicatoria: opc(['RN-112', 'RN-145'], 'M, p. 30, Quadro 5; p. 38, 5.7'),
  agradecimentos: {
    presenca: 'condicional',
    rn: ['RN-112', 'RN-147'],
    fonte: 'M, p. 30, Quadro 5; p. 39, 5.8 (obrigatório se bolsista)',
  },
  epigrafe: opc(['RN-112', 'RN-149'], 'M, p. 30, Quadro 5; p. 17'),
  resumo: obr(['RN-111', 'RN-150'], 'M, p. 30, Quadro 5; p. 40, 5.9'),
  abstract: obr(['RN-111', 'RN-157'], 'M, p. 30, Quadro 5; p. 41, 5.10'),
  listaIlustracoes: opc(['RN-112', 'RN-160'], 'M, p. 31, Quadro 5; p. 42, 5.11'),
  listaTabelas: opc(['RN-112', 'RN-163'], 'M, p. 31, Quadro 5; p. 43, 5.12'),
  listaSiglas: opc(['RN-112', 'RN-165'], 'M, p. 31, Quadro 5; p. 44, 5.13'),
  listaSimbolos: opc(['RN-112', 'RN-167'], 'M, p. 31, Quadro 5; p. 45, 5.14'),
  sumario: obr(['RN-111', 'RN-168'], 'M, p. 31, Quadro 5; p. 46, 5.15'),
};

const POS_QUADRO_5: EstruturaTipo['posTextuais'] = {
  referencias: obr(['RN-111', 'RN-175'], 'M, p. 31, Quadro 5; p. 49, 5.19'),
  glossario: opc(['RN-112', 'RN-230'], 'M, p. 31, Quadro 5; p. 64, cap. 6'),
  apendice: opc(['RN-112', 'RN-231'], 'M, p. 31, Quadro 5; p. 65, cap. 7'),
  anexo: opc(['RN-112', 'RN-234'], 'M, p. 31, Quadro 5; p. 66, cap. 8'),
  indice: opc(['RN-112', 'RN-238'], 'M, p. 31, Quadro 5; p. 67, cap. 9'),
};

const INTRODUCAO: SecaoInicial = { titulo: 'Introdução' };
const DESENVOLVIMENTO: SecaoInicial = { titulo: 'Desenvolvimento' };
const CONSIDERACOES_FINAIS: SecaoInicial = { titulo: 'Considerações finais' };

const TEXTUAIS_QUADRO_5: EstruturaTipo['textuais'] = [
  { elemento: 'introducao', ...obr(['RN-111', 'RN-172'], 'M, p. 31, Quadro 5; p. 47, 5.16'), secoes: [INTRODUCAO] },
  { elemento: 'desenvolvimento', ...obr(['RN-111', 'RN-173'], 'M, p. 31, Quadro 5; p. 48, 5.17'), secoes: [DESENVOLVIMENTO] },
  { elemento: 'conclusao', ...obr(['RN-111', 'RN-174'], 'M, p. 31, Quadro 5; p. 49, 5.18'), secoes: [CONSIDERACOES_FINAIS] },
];

const QUADRO_5: EstruturaTipo = { preTextuais: PRE_QUADRO_5, textuais: TEXTUAIS_QUADRO_5, posTextuais: POS_QUADRO_5 };

/**
 * Artigo como TCC: pré e pós-textuais do Quadro 5 (RN-116). O corpo do artigo não tem estrutura no Manual (PF-14):
 * as três seções entram como sugestão do modelo UFT de artigo, que traz introdução e considerações finais; o miolo do
 * modelo (objetivo, metodologia, resultados) fica sob o nome do Manual, "Desenvolvimento", e o autor o divide.
 */
const ARTIGO_TCC: EstruturaTipo = {
  preTextuais: PRE_QUADRO_5,
  textuais: [
    { elemento: 'introducao', ...sug('artigo (PF-14)'), secoes: [INTRODUCAO] },
    { elemento: 'desenvolvimento', ...sug('artigo (PF-14)'), secoes: [DESENVOLVIMENTO] },
    { elemento: 'conclusao', ...sug('artigo (PF-14)'), secoes: [CONSIDERACOES_FINAIS] },
  ],
  posTextuais: POS_QUADRO_5,
};

const REL = 'relatório técnico';
/** Relatório técnico: o Manual não define a estrutura (p. 30–31); elementos do modelo UFT (C-B18). */
const RELATORIO_TECNICO: EstruturaTipo = {
  preTextuais: {
    capa: sug(REL),
    folhaRosto: sug(REL),
    fichaCatalografica: sug(REL),
    errata: nd(REL),
    folhaAprovacao: {
      presenca: 'opcional',
      rn: [],
      fonte: 'decisão C-B11 do usuário (2026-10-15): opcional, configurável; M, p. 36, Fig. 7 cita "Relatório"',
    },
    dedicatoria: sug(REL),
    agradecimentos: sug(REL),
    epigrafe: nd(REL),
    resumo: sug(REL),
    abstract: sug(REL),
    listaIlustracoes: sug(REL),
    listaTabelas: sug(REL),
    listaSiglas: sug(REL),
    listaSimbolos: sug(REL),
    sumario: sug(REL),
  },
  textuais: [
    { elemento: 'introducao', ...sug(REL), secoes: [INTRODUCAO] },
    { elemento: 'desenvolvimento', ...sug(REL), secoes: [DESENVOLVIMENTO] },
    { elemento: 'conclusao', ...sug(REL), secoes: [CONSIDERACOES_FINAIS] },
  ],
  posTextuais: { referencias: sug(REL), glossario: nd(REL), apendice: sug(REL), anexo: sug(REL), indice: nd(REL) },
};

const PRJ = 'projeto de pesquisa';
/** Projeto de pesquisa: o Manual não define a estrutura; elementos do modelo UFT (C-B18). */
const PROJETO_PESQUISA: EstruturaTipo = {
  preTextuais: {
    capa: sug(PRJ),
    folhaRosto: sug(PRJ),
    fichaCatalografica: nd(PRJ),
    errata: nd(PRJ),
    folhaAprovacao: nd(PRJ),
    dedicatoria: nd(PRJ),
    agradecimentos: nd(PRJ),
    epigrafe: nd(PRJ),
    resumo: nd(PRJ),
    abstract: nd(PRJ),
    listaIlustracoes: sug(PRJ),
    listaTabelas: sug(PRJ),
    listaSiglas: nd(PRJ),
    listaSimbolos: nd(PRJ),
    sumario: sug(PRJ),
  },
  textuais: [
    { elemento: 'introducao', ...sug(PRJ), secoes: [INTRODUCAO] },
    {
      elemento: 'desenvolvimento',
      ...sug(PRJ),
      secoes: [
        { titulo: 'Objetivos', subsecoes: [{ titulo: 'Objetivo geral' }, { titulo: 'Objetivos específicos' }] },
        { titulo: 'Cronograma' },
      ],
    },
    { elemento: 'conclusao', ...nd(PRJ), secoes: [] },
  ],
  posTextuais: { referencias: sug(PRJ), glossario: nd(PRJ), apendice: sug(PRJ), anexo: sug(PRJ), indice: nd(PRJ) },
};

export const ESTRUTURA_POR_TIPO: Readonly<Record<TipoTrabalhoUft, EstruturaTipo>> = {
  monografia: QUADRO_5,
  'artigo-tcc': ARTIGO_TCC,
  dissertacao: QUADRO_5,
  tese: QUADRO_5,
  'relatorio-tecnico': RELATORIO_TECNICO,
  'projeto-pesquisa': PROJETO_PESQUISA,
};

/** Entra no trabalho novo: o exigido pelo Manual e o sugerido pelo modelo UFT. */
export const entraNoTrabalhoNovo = (p: PresencaElemento): boolean => p === 'obrigatorio' || p === 'sugerido';

export interface EstruturaInicial {
  preTextuais: ElementoPreTextualId[];
  secoes: SecaoInicial[];
  posTextuais: ElementoPosTextualId[];
}

/** Elementos e seções do trabalho novo do tipo, na ordem do Quadro 5. */
export function estruturaInicial(tipo: TipoTrabalhoUft): EstruturaInicial {
  const e = ESTRUTURA_POR_TIPO[tipo];
  return {
    preTextuais: ORDEM_PRE_TEXTUAIS.filter((id) => entraNoTrabalhoNovo(e.preTextuais[id].presenca)),
    secoes: e.textuais.filter((t) => entraNoTrabalhoNovo(t.presenca)).flatMap((t) => t.secoes),
    posTextuais: ORDEM_POS_TEXTUAIS.filter((id) => entraNoTrabalhoNovo(e.posTextuais[id].presenca)),
  };
}
