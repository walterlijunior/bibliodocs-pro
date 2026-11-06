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
      origem: readonly string[];
    }
  /** Caixa de tamanho fixo (ficha catalográfica, RN-136). */
  | { tipo: 'quadro'; estilo: string; larguraTw: number; alturaTw: number; trechos: readonly TrechoFormatado[]; origem: readonly string[] }
  /** Sumário: o exportador grava como campo; o motor entrega indicativo e título, e a página é estimada na exportação. */
  | { tipo: 'sumario'; estilo: string; entradas: readonly EntradaSumario[]; origem: readonly string[] }
  /** Pedida pelo autor, não por uma regra: por isso `origem` fica vazia. */
  | { tipo: 'quebraPagina'; origem: readonly string[] };

export interface AvisoFormatacao {
  codigo:
    | 'NOTA_VAZIA'
    | 'CITACAO_VAZIA'
    | 'ALINEA_VAZIA'
    | 'SECAO_ALEM_DO_LIMITE'
    | 'BRASAO_AUSENTE'
    | 'FICHA_VAZIA'
    | 'FORMA_SEM_FONTE'
    | 'ELEMENTO_ADIADO'
    | 'LETRA_SEM_FONTE'
    | 'ROTULO_PROVISORIO'
    | 'CITACAO_ADIADA';
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
