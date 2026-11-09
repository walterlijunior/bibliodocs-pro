/**
 * Rótulo e rodapé de tabelas, quadros e ilustrações (M5-T02). Só texto e ordem: a forma (corpo, alinhamento, espaço)
 * vem do perfil pelo motor (M5-T03).
 *
 * - Rótulo: palavra designativa + número em arábicos (RN-049, RN-051; Manual p. 18, seção 2.8), com inicial maiúscula e
 *   sem caixa alta, como nos exemplos (RN-054: título sem caixa alta; Manual p. 19–20). Tabela: palavra "Tabela" (RN-063,
 *   RN-244).
 * - Título: rótulo + separador + título, "Tabela 1 – Título" (RN-051, RN-053, RN-302). O separador é o parâmetro
 *   `separadorTitulo` do perfil (" – ", U+2013 entre espaços, decisão C-A5): este módulo não importa o perfil (ADR-0005,
 *   regra 2), quem chama passa o valor.
 * - Rodapé: Fonte → Nota → notas específicas (RN-277, IBGE p. 20–21; RN-058, Manual p. 18 e exemplo da p. 20).
 */
import { textoPlano, type BlocoGrafico, type BlocoIlustracao, type BlocoTabela, type InlineDeTitulo } from '../modelo';
import type { SequenciaElemento } from '../numeracao';

/** Palavra designativa de cada sequência (RN-049; "Gráfico" com acento, como no Manual, p. 18). */
export const PALAVRA_DESIGNATIVA: Readonly<Record<SequenciaElemento, string>> = {
  tabela: 'Tabela',
  quadro: 'Quadro',
  figura: 'Figura',
  desenho: 'Desenho',
  esquema: 'Esquema',
  fluxograma: 'Fluxograma',
  fotografia: 'Fotografia',
  grafico: 'Gráfico',
  mapa: 'Mapa',
  organograma: 'Organograma',
  planta: 'Planta',
  retrato: 'Retrato',
};

/** "Tabela 3", "Gráfico 1" (RN-051, RN-244). */
export function rotuloElemento(sequencia: SequenciaElemento, numero: number): string {
  if (!Number.isInteger(numero) || numero < 1) throw new RangeError(`número de elemento inválido: ${numero}`);
  return `${PALAVRA_DESIGNATIVA[sequencia]} ${numero}`;
}

/**
 * Título completo: "Tabela 3 – " seguido do título com as marcas do autor (RN-051, RN-053). O rótulo sai sem marca
 * (RN-054). Título sem texto (só espaços) fica só com o rótulo; a falta é pendência do verificador (RN-246, RN-050).
 */
export function tituloComRotulo(rotulo: string, titulo: readonly InlineDeTitulo[], separador: string): InlineDeTitulo[] {
  if (textoPlano(titulo) === '') return [{ tipo: 'texto', texto: rotulo }];
  return [{ tipo: 'texto', texto: `${rotulo}${separador}` }, ...titulo];
}

/** Parte do rodapé do elemento, na ordem em que sai. */
export type ParteRodape =
  /** "Fonte:" (RN-056, RN-064, RN-269); "Fontes:" na tabela com mais de um responsável (RN-270). */
  | { parte: 'fonte'; prefixo: 'Fonte:' | 'Fontes:'; conteudo: readonly InlineDeTitulo[] }
  /** "Nota:" (RN-058; RN-275, nota geral). */
  | { parte: 'nota'; prefixo: 'Nota:'; conteudo: readonly InlineDeTitulo[] }
  /** Nota específica com o número da chamada, na ordem das chamadas (RN-268, RN-276); a forma da chamada é do motor. */
  | { parte: 'notaEspecifica'; chamada: number; conteudo: readonly InlineDeTitulo[] };

const temTexto = (c: readonly InlineDeTitulo[] | undefined): c is readonly InlineDeTitulo[] => c !== undefined && textoPlano(c) !== '';

/**
 * Palavra antes da fonte (N-M7-01). Na tabela (Norma Tabular), "Fontes:" quando a fonte tem mais de um responsável,
 * separados por ";" (RN-270; IBGE p. 20, 4.10.1; Anexo B, Tabela 6). Quadro e ilustração seguem o Manual, "Fonte:"
 * (RN-056). Decidido pela sessão principal por delegação do usuário (2026-11-08), provisório.
 */
export function prefixoFonte(bloco: { tipo: string; especie?: string; fonte?: readonly InlineDeTitulo[] }): 'Fonte:' | 'Fontes:' {
  return bloco.tipo === 'tabela' && bloco.especie === 'tabela' && bloco.fonte !== undefined && textoPlano(bloco.fonte).includes(';') ? 'Fontes:' : 'Fonte:';
}

/**
 * Rodapé na ordem obrigatória Fonte → Nota → notas específicas (RN-277; RN-058 para ilustrações, que não têm nota
 * específica). Campo sem texto não sai.
 */
export function rodapeDoElemento(bloco: BlocoTabela | BlocoIlustracao | BlocoGrafico): ParteRodape[] {
  const partes: ParteRodape[] = [];
  if (temTexto(bloco.fonte)) partes.push({ parte: 'fonte', prefixo: prefixoFonte(bloco), conteudo: bloco.fonte });
  if (temTexto(bloco.nota)) partes.push({ parte: 'nota', prefixo: 'Nota:', conteudo: bloco.nota });
  if (bloco.tipo === 'tabela') {
    (bloco.notasEspecificas ?? []).forEach((conteudo, i) => {
      if (temTexto(conteudo)) partes.push({ parte: 'notaEspecifica', chamada: i + 1, conteudo });
    });
  }
  return partes;
}

/** O elemento tem fonte com texto (RN-056, RN-274)? */
export const temFonte = (bloco: BlocoTabela | BlocoIlustracao | BlocoGrafico): boolean => temTexto(bloco.fonte);
