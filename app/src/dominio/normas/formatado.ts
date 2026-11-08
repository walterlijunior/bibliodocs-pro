/**
 * `DocumentoFormatado` (M3-T03; ADR-0005, seção 3): o que o exportador, a pré-visualização e o verificador consomem.
 * Tudo já resolvido, em unidades do OOXML (twips e meios-pontos), e cada propriedade diz de que RN veio (RF-05). Só
 * tipos: `exportacao/docx` e `interface` podem importar este arquivo.
 *
 * Seções, paginação e pré e pós-textuais desde o M3-T04.
 */
import type { MarcaTexto } from '../modelo';

export interface PropriedadesEstilo {
  fonte?: string;
  corpoMeioPt?: number;
  /** 240 = simples; 360 = 1,5 (`w:line`, `lineRule=auto`). */
  linha?: number;
  alinhamento?: 'esquerda' | 'direita' | 'centralizado' | 'justificado';
  recuoPrimeiraLinhaTw?: number;
  recuoEsquerdaTw?: number;
  deslocamentoTw?: number;
  antesTw?: number;
  depoisTw?: number;
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  maiusculas?: boolean;
  quebraPaginaAntes?: boolean;
  manterComProximo?: boolean;
}

export interface EstiloResolvido {
  /** Estável: o exportador e os instantâneos dependem dele. */
  id: string;
  /** Nome que o usuário vê no Word. */
  nome: string;
  propriedades: PropriedadesEstilo;
  /** RN de cada propriedade presente em `propriedades`. */
  origem: Partial<Record<keyof PropriedadesEstilo, readonly string[]>>;
  /** Nível de estrutura do Word (`w:outlineLvl`), de 0 a 4, nos títulos. */
  nivelEstrutura?: number;
  /** A numeração progressiva acompanha o estilo; títulos sem indicativo entram no sumário sem número. */
  numerado?: true;
}

export type TrechoFormatado =
  | { tipo: 'texto'; texto: string; marcas: readonly MarcaTexto[] }
  | { tipo: 'nota'; numero: number; trechos: readonly TrechoFormatado[]; estilo: string; origem: readonly string[] };

export interface ItemDeLista {
  /** Identifica a lista no documento: cada uma recomeça em "a)". */
  lista: number;
  /** 0 = alínea; 1 = subalínea. */
  nivel: 0 | 1;
  /** Rótulo resolvido ("a)", "–"); `null` se o perfil não tem a regra. */
  rotulo: string | null;
  /** Posição na lista, a partir de 0, para o exportador conferir o rótulo com a numeração do Word. */
  posicao: number;
}

export interface EntradaSumario {
  /** De 1 a 5 (RN-169). */
  nivel: number;
  /** Vazio em títulos sem indicativo, como REFERÊNCIAS. */
  indicativo: string;
  texto: string;
  /** Marcador do título no corpo. */
  ancora: string;
}

export type BlocoFormatado =
  | {
      tipo: 'paragrafo';
      estilo: string;
      trechos: readonly TrechoFormatado[];
      /** Indicativo da seção ("1.1"), já resolvido (RN-039). */
      indicativo?: string;
      lista?: ItemDeLista;
      /** Marcador para o sumário apontar a página. */
      ancora?: string;
      /** Começa em página nova; o estilo não diz porque depende do elemento (RN-148, RN-151, RN-171). */
      novaPagina?: true;
      /** Espaço antes só deste parágrafo (dedicatória abaixo do meio da folha, RN-146). */
      antesTw?: number;
      /** Espaço depois só deste parágrafo (uma linha depois do rodapé da tabela, RN-031, RN-308). */
      depoisTw?: number;
      /**
       * Recuo esquerdo só deste parágrafo: a fonte e a nota da figura e do gráfico começam rente à borda esquerda da
       * imagem centralizada, não na margem (RN-057, decisão C-A4; Manual p. 17, Quadro 1, e exemplo da p. 19).
       */
      recuoEsquerdaTw?: number;
      /** Parada de tabulação à direita, a partir da margem esquerda (número da equação, RN-106; M5-T07). */
      tabulacaoDireitaTw?: number;
      /** Segunda coluna de uma lista de siglas ou símbolos (M6). Medida já resolvida pelo motor. */
      tabulacaoEsquerdaTw?: number;
      origem: readonly string[];
    }
  /** Caixa de tamanho fixo (ficha catalográfica, RN-136). */
  | { tipo: 'quadro'; estilo: string; larguraTw: number; alturaTw: number; trechos: readonly TrechoFormatado[]; origem: readonly string[] }
  /** Sumário: o exportador grava como campo; o motor entrega indicativo e título, e a página é estimada na exportação. */
  | { tipo: 'sumario'; estilo: string; entradas: readonly EntradaSumario[]; origem: readonly string[] }
  /** Lista de elementos: texto resolvido pelo motor e página do marcador, estimada pelo exportador (M6-T01). */
  | { tipo: 'listaElementos'; estilo: string; entradas: readonly { trechos: readonly TrechoFormatado[]; ancora: string }[]; tabulacaoDireitaTw: number; origem: readonly string[] }
  /** Pedida pelo autor, não por uma regra: por isso `origem` fica vazia. */
  | { tipo: 'quebraPagina'; origem: readonly string[] }
  /** Tabela ou quadro nativo do Word (M5-T03). Título e rodapé são parágrafos à parte, antes e depois. */
  | BlocoTabelaFormatado
  /** Imagem da ilustração num parágrafo só dela (M5-T06). Título e rodapé são parágrafos à parte, antes e depois. */
  | BlocoImagemFormatado;

export interface BlocoImagemFormatado {
  tipo: 'imagem';
  /** Estilo do parágrafo da imagem (alinhamento da RN-059). */
  estilo: string;
  dados: Uint8Array;
  formato: 'png' | 'jpg';
  larguraTw: number;
  alturaTw: number;
  /** Texto alternativo: o título com o rótulo. */
  descricao: string;
  origem: readonly string[];
}

/** Traços da moldura; cada um só existe com a regra que o pede (tabela: RN-251 a RN-254; quadro: RN-061). */
export interface TracosMoldura {
  superior: boolean;
  inferior: boolean;
  esquerda: boolean;
  direita: boolean;
  /** Entre todas as linhas (quadro fechado). */
  entreLinhas: boolean;
  /** Entre todas as colunas (quadro fechado). */
  entreColunas: boolean;
  /** Abaixo da última linha de cabeçalho (2.º traço da tabela, RN-251). */
  abaixoDoCabecalho: boolean;
}

export interface CelulaFormatada {
  trechos: readonly TrechoFormatado[];
  /** Alinhamento da coluna, escolhido pelo autor no modelo. */
  alinhamento: 'esquerda' | 'centralizado' | 'direita';
  /** Colunas e linhas ocupadas (1 = sem mesclagem). */
  colunas: number;
  linhas: number;
}

export interface BlocoTabelaFormatado {
  tipo: 'tabela';
  /** Estilo dos parágrafos das células. */
  estilo: string;
  /** Largura da tabela: a área útil da página. */
  larguraTw: number;
  colunas: number;
  linhasCabecalho: number;
  /** As linhas de cabeçalho se repetem em cada página (RN-292). */
  repetirCabecalho: boolean;
  tracos: TracosMoldura;
  /** Modelo do HTML: cada linha lista só as células que começam nela. */
  linhas: readonly (readonly CelulaFormatada[])[];
  origem: readonly string[];
}

export interface AvisoFormatacao {
  codigo:
    | 'SIGLA_QUEBRADA'
    | 'NOTA_VAZIA'
    | 'CITACAO_VAZIA'
    | 'ALINEA_VAZIA'
    | 'SECAO_ALEM_DO_LIMITE'
    | 'BRASAO_AUSENTE'
    | 'FICHA_VAZIA'
    | 'FORMA_SEM_FONTE'
    | 'ELEMENTO_ADIADO'
    | 'IMAGEM_AUSENTE'
    | 'EQUACAO_VAZIA'
    | 'GRAFICO_NAO_DESENHADO'
    | 'LETRA_SEM_FONTE'
    | 'ROTULO_PROVISORIO'
    | 'CHAMADA_COM_AVISO'
    | 'REFERENCIA_COM_AVISO'
    | 'REFERENCIAS_AUSENTES'
    | 'REFERENCIAS_VAZIAS';
  /** Id do elemento no modelo. */
  id: string;
  mensagem: string;
}

export interface PaginaResolvida {
  larguraTw: number;
  alturaTw: number;
  margemSuperiorTw: number;
  margemInferiorTw: number;
  margemEsquerdaTw: number;
  margemDireitaTw: number;
  /** Distância do número à borda (RN-072). */
  cabecalhoTw: number;
  origem: readonly string[];
}

export interface SecaoFormatada {
  papel: 'capa' | 'folhaRosto' | 'ficha' | 'preTextual' | 'textual' | 'posTextual';
  /** Só quando recomeça a contagem; sem ele, continua da seção anterior (RN-067, RN-073). */
  reiniciarEm?: number;
  /** Mostra o número no cabeçalho (RN-068). */
  exibirNumero: boolean;
  /** `distribuido`: espalha os parágrafos na altura (RN-125); `inferior`: encosta no pé (RN-135). */
  alinhamentoVertical?: 'distribuido' | 'inferior';
  blocos: readonly BlocoFormatado[];
  origem: readonly string[];
}

export interface DocumentoFormatado {
  perfil: { id: string; versao: string };
  /** Propriedades do arquivo: título e autor em texto simples. */
  metadados: { titulo: string; autor: string };
  estilos: readonly EstiloResolvido[];
  /** Vale para todas as seções. */
  pagina: PaginaResolvida;
  /** Numeração contínua e filete curto (RN-102, RN-104). */
  notas: { numeracao: string; fileteTw: number | null; origem: readonly string[] };
  /** Sinal da subalínea (RN-026, D-M3-10); `null` sem a regra ou sem o parâmetro. */
  listas: { marcadorSubalinea: string | null };
  secoes: readonly SecaoFormatada[];
  /** Regras do perfil que não foram aplicadas por falta de decisão ou de fonte. */
  regrasAguardando: readonly string[];
  avisos: readonly AvisoFormatacao[];
}
