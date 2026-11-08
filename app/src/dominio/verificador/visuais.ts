/**
 * Pendências e avisos de tabelas, quadros e ilustrações (M5-T02). Só diagnostica; nunca muda o documento nem impede de
 * salvar (o trabalho incompleto é válido). O verificador completo é do M7.
 *
 * - SEM_FONTE (pendência): fonte obrigatória mesmo para produção do autor. Ilustração e quadro: RN-056 (Manual p. 18).
 *   Tabela: RN-269 e RN-274 (IBGE p. 20; dispensa não adotada, C-C3).
 * - SEM_TITULO (pendência): o formato já recusa título vazio; aqui fica o título só com espaços. Tabela: RN-246 e
 *   RN-063; ilustração e quadro: RN-050 e RN-051.
 * - TABELA_SEM_DADO_NUMERICO (aviso, só espécie `tabela`): menos de metade das células de dados com número ou sinal
 *   convencional; sugere "quadro" (RN-241, D-M5-10; limite técnico, ver `dominio/visuais/dados-numericos`).
 * - TABELA_LONGA (aviso, só espécie `tabela`): recomenda-se que a tabela caiba numa página (RN-297, IBGE p. 30). O app
 *   não pagina (D-M5-03): o critério é o número de linhas, valor técnico ajustável em `OpcoesVerificacaoVisuais`.
 *
 * Fora daqui: elemento sem remissiva no texto (RN-060, D-M5-04) é do M5-T08.
 */
import { textoPlano, type Documento, type Id } from '../modelo';
import { numerarElementos } from '../numeracao';
import { proporcaoNumerica, rotuloElemento, temFonte } from '../visuais';

export type CodigoProblemaVisual = 'SEM_TITULO' | 'SEM_FONTE' | 'TABELA_SEM_DADO_NUMERICO' | 'TABELA_LONGA';

export interface ProblemaVisual {
  codigo: CodigoProblemaVisual;
  /** `pendencia`: a norma exige e falta; `aviso`: recomendação ou heurística. */
  nivel: 'pendencia' | 'aviso';
  /** RN ou decisão de onde vem a conferência. */
  origem: readonly string[];
  mensagem: string;
  /** Seção e bloco do elemento. */
  secao: Id;
  elemento: Id;
}

export interface OpcoesVerificacaoVisuais {
  /**
   * Acima de quantas linhas a tabela recebe o aviso de tabela longa. Valor técnico, não norma: cerca de uma página A4 de
   * área útil (24,7 cm) em corpo 10 simples, descontados título e rodapé. O motor do M5-T03 pode refinar.
   */
  linhasTabelaLonga?: number;
}

/** Valor padrão de {@link OpcoesVerificacaoVisuais.linhasTabelaLonga}. */
export const LINHAS_TABELA_LONGA = 40;
/** Abaixo desta proporção de células numéricas, o aviso da RN-241 (limite técnico registrado na matriz). */
export const PROPORCAO_NUMERICA_MINIMA = 0.5;

/** Problemas de cada elemento, na ordem do documento. */
export function verificarVisuais(doc: Pick<Documento, 'corpo'>, opcoes: OpcoesVerificacaoVisuais = {}): ProblemaVisual[] {
  const limiteLinhas = opcoes.linhasTabelaLonga ?? LINHAS_TABELA_LONGA;
  const lista: ProblemaVisual[] = [];
  for (const { bloco, secao, sequencia, numero } of numerarElementos(doc.corpo).elementos) {
    const rotulo = rotuloElemento(sequencia, numero);
    const tabela = sequencia === 'tabela';
    const add = (codigo: CodigoProblemaVisual, nivel: ProblemaVisual['nivel'], origem: string[], mensagem: string) =>
      lista.push({ codigo, nivel, origem, mensagem: `${rotulo}: ${mensagem}`, secao, elemento: bloco.id });

    if (textoPlano(bloco.titulo) === '') {
      add('SEM_TITULO', 'pendencia', tabela ? ['RN-246', 'RN-063'] : ['RN-050', 'RN-051'], 'falta o título.');
    }
    if (!temFonte(bloco)) {
      add(
        'SEM_FONTE',
        'pendencia',
        tabela ? ['RN-269', 'RN-274'] : ['RN-056'],
        'falta a fonte; ela é obrigatória mesmo quando o conteúdo é do próprio autor.',
      );
    }
    if (bloco.tipo !== 'tabela' || bloco.especie !== 'tabela') continue;
    const proporcao = proporcaoNumerica(bloco);
    if (proporcao !== null && proporcao < PROPORCAO_NUMERICA_MINIMA) {
      add(
        'TABELA_SEM_DADO_NUMERICO',
        'aviso',
        ['RN-241', 'D-M5-10'],
        'a maior parte dos dados não é numérica; conteúdo predominantemente textual vai em quadro.',
      );
    }
    if (bloco.linhas.length > limiteLinhas) {
      add(
        'TABELA_LONGA',
        'aviso',
        ['RN-297', 'D-M5-03'],
        `${bloco.linhas.length} linhas; recomenda-se que a tabela caiba em uma página. Divida-a ou confira a quebra no documento exportado.`,
      );
    }
  }
  return lista;
}
