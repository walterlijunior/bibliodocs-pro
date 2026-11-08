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
 * - RESOLUCAO_BAIXA (aviso, M5-T06): imagem com menos de 150 ppi no tamanho impresso (RNF-17, D-M5-09); só com os
 *   bytes das imagens nas opções.
 *
 * - REMISSIVA_QUEBRADA (pendência, M5-T08): remissiva cujo alvo não existe ou é equação sem número (RF-11).
 * - TABELA_SEM_CABECALHO (aviso, M5-T10, N-M5-02): espécie `tabela` sem linha de cabeçalho; a tabela tem cabeçalho e o
 *   2.º traço fica sob ele (RN-251, RN-255; IBGE p. 14–15, seções 4.3 e 4.4).
 * - EQUACAO_SEM_NUMERO (aviso, M5-T10, N-M5-04): o Manual pede equações numeradas (RN-106; p. 27, seção 3.5); tirar o
 *   número é permitido, com aviso (D-M5-52).
 * - GRAFICO_SEM_TABELA e GRAFICO_SEM_DADOS (pendência, M5-T09): gráfico gerado cuja tabela saiu do trabalho ou não tem
 *   número; GRAFICO_PARCIAL (aviso): parte da tabela ficou de fora (linha de total, séries a mais nos setores…).
 * - SEM_REMISSIVA (aviso, M5-T08): tabela, quadro ou ilustração que nenhuma remissiva cita (RN-060, PENDENTE-FONTE, por
 *   isso só aviso: D-M5-04). Equação fica de fora: a regra é de ilustração, estendida só à tabela pela D-M5-04.
 */
import { secoesDeLeitura, textoPlano, type Documento, type Id } from '../modelo';
import { numerarElementos, numerarSecoes } from '../numeracao';
import {
  larguraImpressaMm,
  larguraParaResolucaoMinimaMm,
  lerInfoImagem,
  proporcaoNumerica,
  RESOLUCAO_MINIMA_PPI,
  resolucaoEfetivaPpi,
  dadosDoGrafico,
  remissivasDoCorpo,
  rotuloElemento,
  rotulosDeRemissiva,
  temFonte,
} from '../visuais';

export type CodigoProblemaVisual =
  | 'SEM_TITULO'
  | 'SEM_FONTE'
  | 'TABELA_SEM_DADO_NUMERICO'
  | 'TABELA_LONGA'
  | 'RESOLUCAO_BAIXA'
  | 'REMISSIVA_QUEBRADA'
  | 'SEM_REMISSIVA'
  | 'GRAFICO_SEM_TABELA'
  | 'GRAFICO_SEM_DADOS'
  | 'GRAFICO_PARCIAL'
  | 'TABELA_SEM_CABECALHO'
  | 'EQUACAO_SEM_NUMERO';

export interface ProblemaVisual {
  codigo: CodigoProblemaVisual;
  /** `pendencia`: a norma exige e falta; `aviso`: recomendação ou heurística. */
  nivel: 'pendencia' | 'aviso';
  /** RN ou decisão de onde vem a conferência. */
  origem: readonly string[];
  mensagem: string;
  /** Seção e bloco do elemento (em REMISSIVA_QUEBRADA, o id da remissiva). */
  secao: Id;
  elemento: Id;
}

export interface OpcoesVerificacaoVisuais {
  /**
   * Acima de quantas linhas a tabela recebe o aviso de tabela longa. Valor técnico, não norma: cerca de uma página A4 de
   * área útil (24,7 cm) em corpo 10 simples, descontados título e rodapé. O motor do M5-T03 pode refinar.
   */
  linhasTabelaLonga?: number;
  /** Bytes das imagens pelo sha256, para conferir a resolução (M5-T06). */
  imagens?: ReadonlyMap<string, Uint8Array>;
  /** Largura da área útil em mm (`areaUtilMm` do perfil); padrão 160 (A4 com margens de 3 e 2 cm). */
  areaUtilMm?: number;
}

/** Aviso de resolução de uma imagem, ou `null` se está boa ou não se lê (mensagem sem o rótulo do elemento). */
export function avisoDeResolucao(bytes: Uint8Array, larguraMm: number | undefined, areaUtilMm: number): string | null {
  const info = lerInfoImagem(bytes);
  if (!info) return null;
  const ppi = resolucaoEfetivaPpi(info, larguraImpressaMm(info, larguraMm, areaUtilMm));
  if (ppi >= RESOLUCAO_MINIMA_PPI) return null;
  const ate = larguraParaResolucaoMinimaMm(info);
  return (
    `a imagem fica com ${Math.floor(ppi + 1e-6)} ppi no tamanho impresso (o mínimo é ${RESOLUCAO_MINIMA_PPI}) e pode sair borrada. ` +
    (ate >= 10 ? `Use uma imagem maior ou reduza a largura para até ${ate} mm.` : 'Use uma imagem maior.')
  );
}

/** Valor padrão de {@link OpcoesVerificacaoVisuais.linhasTabelaLonga}. */
export const LINHAS_TABELA_LONGA = 40;
/** Abaixo desta proporção de células numéricas, o aviso da RN-241 (limite técnico registrado na matriz). */
export const PROPORCAO_NUMERICA_MINIMA = 0.5;

/** Problemas de cada elemento, na ordem do documento. */
export function verificarVisuais(doc: Pick<Documento, 'corpo'> & Partial<Pick<Documento, 'posTextuais'>>, opcoes: OpcoesVerificacaoVisuais = {}): ProblemaVisual[] {
  const limiteLinhas = opcoes.linhasTabelaLonga ?? LINHAS_TABELA_LONGA;
  const lista: ProblemaVisual[] = [];
  const remissivas = remissivasDoCorpo(doc);
  const citados = new Set(remissivas.map((r) => r.remissiva.alvo));
  const { elementos } = numerarElementos(doc);
  const tabelas = new Map(elementos.flatMap((e) => (e.bloco.tipo === 'tabela' ? [[e.bloco.id, e.bloco] as const] : [])));
  for (const { bloco, secao, sequencia, numero } of elementos) {
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
    if (!citados.has(bloco.id)) {
      add('SEM_REMISSIVA', 'aviso', ['RN-060', 'D-M5-04'], 'não é citado no texto; use Inserir › Remissiva… onde o texto fala dele (recomendação provisória, sem fonte no Manual).');
    }
    if (bloco.tipo === 'grafico') {
      const d = dadosDoGrafico(bloco, tabelas.get(bloco.tabela));
      if (!d.ok) add(d.motivo === 'semTabela' ? 'GRAFICO_SEM_TABELA' : 'GRAFICO_SEM_DADOS', 'pendencia', ['RF-10', 'D-M5-49'], d.mensagem);
      else for (const a of d.avisos) add('GRAFICO_PARCIAL', 'aviso', ['D-M5-50'], a);
    }
    if (bloco.tipo === 'ilustracao') {
      const bytes = opcoes.imagens?.get(bloco.midia);
      const aviso = bytes ? avisoDeResolucao(bytes, bloco.larguraMm, opcoes.areaUtilMm ?? 160) : null;
      if (aviso !== null) add('RESOLUCAO_BAIXA', 'aviso', ['RNF-17', 'D-M5-09'], aviso);
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
    if (bloco.linhasCabecalho === 0) {
      add('TABELA_SEM_CABECALHO', 'aviso', ['RN-251', 'RN-255'], 'não tem linha de cabeçalho; a tabela tem cabeçalho, e o segundo traço fica abaixo dele.');
    }
    if (bloco.linhas.length > limiteLinhas) {
      add(
        'TABELA_LONGA',
        'aviso',
        ['RN-297', 'D-M5-03'],
        // N-M5-03: não sugerir dividir em tabelas numeradas à parte (a tabela continua uma só, IBGE p. 29, seção 8.3).
        `${bloco.linhas.length} linhas; recomenda-se que a tabela caiba em uma página. Se passar, o cabeçalho se repete, mas o título e o "continua", "continuação" e "conclusão" não: confira no documento exportado.`,
      );
    }
  }
  // N-M5-04: equação sem número (RN-106; D-M5-52), na ordem do documento.
  for (const { secao } of numerarSecoes(secoesDeLeitura(doc))) {
    for (const b of secao.blocos) {
      if (b.tipo !== 'equacao' || b.numerada === true) continue;
      lista.push({
        codigo: 'EQUACAO_SEM_NUMERO',
        nivel: 'aviso',
        origem: ['RN-106', 'D-M5-52'],
        mensagem: `Equação sem número${textoPlano(b.conteudo) === '' ? '' : ` (${textoPlano(b.conteudo)})`}: o Manual pede equações numeradas entre parênteses, à direita.`,
        secao: secao.id,
        elemento: b.id,
      });
    }
  }
  const rotulos = rotulosDeRemissiva(doc);
  for (const { remissiva, secao } of remissivas) {
    if (rotulos.has(remissiva.alvo)) continue;
    lista.push({
      codigo: 'REMISSIVA_QUEBRADA',
      nivel: 'pendencia',
      origem: ['RF-11'],
      mensagem: 'Remissiva quebrada: o elemento citado foi excluído ou a equação ficou sem número.',
      secao,
      elemento: remissiva.id,
    });
  }
  return lista;
}
