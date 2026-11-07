/**
 * Bloco de autoria das referências (M4-T02): RN-180 a RN-187.
 *
 * - Pessoa: SOBRENOME, Prenomes (RN-180). "Filho", "Júnior", "Neto", "Sobrinho" já estão no campo `sobrenome` e
 *   sobem junto (RN-181: SILVA NETO, Roberto da). Prenomes ficam como digitados (RN-182, C-B10, provisório).
 * - Até três autores separados por "; " (RN-183); mais de três, o primeiro e "et al." em itálico (RN-184, RN-185),
 *   ou todos, pela opção do C-B12.
 * - Entidade por extenso em maiúsculas (RN-187). Função de obra coletiva entre parênteses em minúsculas (RN-186).
 */
import type { Autor, FuncaoResponsavel, Obra } from '../modelo';
import type { Montador } from './trechos';

export const LOCALE = 'pt-BR';

export interface OpcoesAutoria {
  /** C-B12: lista todos os autores em vez de "et al." a partir do quarto. */
  listarTodosAutores?: boolean;
}

export function maiusculas(texto: string): string {
  return texto.toLocaleUpperCase(LOCALE);
}

/** "SILVA NETO, Roberto da" (RN-180, RN-181) ou "CONFERÊNCIA NACIONAL DOS BISPOS DO BRASIL" (RN-187). */
export function nomeDeEntrada(autor: Autor): string {
  if (autor.tipo === 'entidade') return maiusculas(autor.nome.trim());
  const sobrenome = maiusculas(autor.sobrenome.trim());
  const prenomes = autor.prenomes?.trim();
  return prenomes ? `${sobrenome}, ${prenomes}` : sobrenome;
}

const ABREVIATURA_FUNCAO: Record<FuncaoResponsavel, { um: string; varios: string }> = {
  // RN-186 lista o plural só de organizador e de coordenador ("org./orgs.", "coord./coords.").
  org: { um: 'org.', varios: 'orgs.' },
  coord: { um: 'coord.', varios: 'coords.' },
  ed: { um: 'ed.', varios: 'ed.' },
  comp: { um: 'comp.', varios: 'comp.' },
};

export function abreviaturaFuncao(funcao: FuncaoResponsavel, quantos: number): string {
  const a = ABREVIATURA_FUNCAO[funcao];
  return quantos > 1 ? a.varios : a.um;
}

/** Escreve a autoria sem o ponto final; quem chama fecha o elemento. */
export function escreverAutoria(
  m: Montador,
  autores: readonly Autor[],
  funcao: FuncaoResponsavel | undefined,
  opcoes: OpcoesAutoria = {},
): void {
  const abreviar = autores.length > 3 && !opcoes.listarTodosAutores;
  const mostrados = abreviar ? autores.slice(0, 1) : autores;
  mostrados.forEach((a, i) => {
    if (i > 0) m.texto('; ', ['RN-183']);
    m.texto(nomeDeEntrada(a), a.tipo === 'entidade' ? ['RN-187'] : ['RN-180', 'RN-181']);
  });
  if (abreviar) {
    m.texto(' ', ['RN-184']);
    m.texto('et al.', ['RN-184', 'RN-185'], ['italico']);
  }
  if (funcao) m.texto(` (${abreviaturaFuncao(funcao, autores.length)})`, ['RN-186']);
}

/**
 * Elemento de entrada da obra para ordenar e citar: os autores ou, na legislação sem autoria, a jurisdição como
 * entidade (RN-223: "BRASIL. Lei nº …"). Lista vazia: entrada pelo título.
 */
export function autoresDeEntrada(obra: Pick<Obra, 'tipo' | 'autores' | 'jurisdicao'>): readonly Autor[] {
  if (obra.autores && obra.autores.length > 0) return obra.autores;
  const jurisdicao = obra.jurisdicao?.trim();
  return obra.tipo === 'legislacao' && jurisdicao ? [{ tipo: 'entidade', nome: jurisdicao }] : [];
}
