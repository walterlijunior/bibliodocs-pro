/**
 * Módulo `dominio/visuais` — Tabela, Quadro, Figura, Grafico e Equacao (dados).
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Importa dominio/modelo e dominio/numeracao (regra 2).
 *
 * M5-T02: rótulo ("Tabela 1 – Título"), ordem do rodapé e leitura das células para o verificador.
 */
export {
  larguraImpressaMm,
  larguraParaResolucaoMinimaMm,
  lerInfoImagem,
  PPI_PADRAO,
  RESOLUCAO_MINIMA_PPI,
  resolucaoEfetivaPpi,
  type InfoImagem,
} from './imagem';
export { celulasComColuna, ehDadoNumerico, proporcaoNumerica, textoDaCelula } from './dados-numericos';
export { PALAVRA_DESIGNATIVA, rodapeDoElemento, rotuloElemento, temFonte, tituloComRotulo, type ParteRodape } from './rotulos';
