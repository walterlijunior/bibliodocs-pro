/**
 * Numeração de tabelas, quadros, ilustrações e equações (M5-T02), derivada da ordem no documento e nunca gravada
 * (ADR-0005, seção 3).
 *
 * - Cada palavra designativa tem a sua sequência 1, 2, 3, em ordem de ocorrência, contínua no documento (não reinicia por
 *   capítulo): RN-052 (Manual, p. 18, seção 2.8; listas de figuras e de quadros das p. 7–8), RN-244 (IBGE, p. 12–13) e
 *   D-M5-07. A numeração subordinada ao capítulo ("Tabela 16.3") não é oferecida (D-M5-07; RN-245 é PENDENTE-FONTE).
 * - "Cada uma é identificada pela palavra designativa do seu tipo" (RN-049, Manual p. 18): Gráfico 1, Mapa 1 e Figura 1
 *   convivem, cada espécie com a sua contagem (RN-052: "por rótulo, números 1..n"). Quadro é espécie de `tabela`
 *   (D-M5-11) e tem uma sequência só, separada da de Tabela.
 * - Toda tabela é numerada, mesmo a única (RN-243, decisão C-C2).
 * - Equações: só as marcadas `numerada`, (1), (2)… numa sequência própria (RN-106; Manual p. 27, exemplo).
 * - Ordem de leitura: seção, os blocos dela e depois as subseções (pré-ordem, como o motor). Pré e pós-textuais não têm
 *   blocos no formato v1 (apêndice e anexo só guardam o título), então só o corpo entra na contagem.
 */
import type { BlocoEquacao, BlocoGrafico, BlocoIlustracao, BlocoTabela, EspecieIlustracao, Id } from '../modelo';
import { secoesDaEntrada, type EntradaDeLeitura } from '../modelo';
import { numerarSecoes } from './secoes';

/** Sequência de numeração: a espécie da tabela ou da ilustração (cada palavra designativa conta à parte). */
export type SequenciaElemento = BlocoTabela['especie'] | EspecieIlustracao;

export interface ElementoNumerado {
  /** Gráfico gerado de tabela (M5-T09) conta na sequência "Gráfico", com os gráficos com imagem (RN-049). */
  bloco: BlocoTabela | BlocoIlustracao | BlocoGrafico;
  secao: Id;
  sequencia: SequenciaElemento;
  /** 1, 2, 3… dentro da sequência. */
  numero: number;
}

export interface EquacaoNumerada {
  bloco: BlocoEquacao;
  secao: Id;
  numero: number;
}

export interface NumeracaoElementos {
  /** Tabelas, quadros e ilustrações na ordem do documento. */
  elementos: ElementoNumerado[];
  /** Só as equações com `numerada`, na ordem do documento. */
  equacoes: EquacaoNumerada[];
}

/** Numera os elementos do corpo em ordem de leitura. */
export function numerarElementos(entrada: EntradaDeLeitura): NumeracaoElementos {
  const corpo = secoesDaEntrada(entrada);
  const contagem = new Map<SequenciaElemento, number>();
  const elementos: ElementoNumerado[] = [];
  const equacoes: EquacaoNumerada[] = [];
  for (const { secao } of numerarSecoes(corpo)) {
    for (const bloco of secao.blocos) {
      if (bloco.tipo === 'tabela' || bloco.tipo === 'ilustracao' || bloco.tipo === 'grafico') {
        const sequencia: SequenciaElemento = bloco.tipo === 'grafico' ? 'grafico' : bloco.especie;
        const numero = (contagem.get(sequencia) ?? 0) + 1;
        contagem.set(sequencia, numero);
        elementos.push({ bloco, secao: secao.id, sequencia, numero });
      } else if (bloco.tipo === 'equacao' && bloco.numerada === true) {
        equacoes.push({ bloco, secao: secao.id, numero: equacoes.length + 1 });
      }
    }
  }
  return { elementos, equacoes };
}

/** Número de cada tabela, quadro, ilustração e equação numerada, por id do bloco (para rótulos e remissivas). */
export function mapaNumerosElementos(corpo: EntradaDeLeitura): ReadonlyMap<Id, number> {
  const { elementos, equacoes } = numerarElementos(corpo);
  return new Map([...elementos, ...equacoes].map((e) => [e.bloco.id, e.numero]));
}

/** Número da equação: algarismos arábicos entre parênteses, "(3)" (RN-106; Manual, p. 27). */
export function rotuloEquacao(numero: number): string {
  if (!Number.isInteger(numero) || numero < 1) throw new RangeError(`número de equação inválido: ${numero}`);
  return `(${numero})`;
}
