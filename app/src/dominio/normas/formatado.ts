/**
 * `DocumentoFormatado` (M3-T03; ADR-0005, seção 3): o que o exportador, a pré-visualização e o verificador consomem.
 * Tudo já resolvido, em unidades do OOXML (twips e meios-pontos), e cada propriedade diz de que RN veio (RF-05). Só
 * tipos: `exportacao/docx` e `interface` podem importar este arquivo.
 *
 * O M3-T04 acrescenta seções, paginação e os pré e pós-textuais.
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

export type BlocoFormatado =
  | {
      tipo: 'paragrafo';
      estilo: string;
      trechos: readonly TrechoFormatado[];
      /** Indicativo da seção ("1.1"), já resolvido (RN-039). */
      indicativo?: string;
      lista?: ItemDeLista;
      origem: readonly string[];
    }
  /** Pedida pelo autor, não por uma regra: por isso `origem` fica vazia. */
  | { tipo: 'quebraPagina'; origem: readonly string[] };

export interface AvisoFormatacao {
  codigo: 'NOTA_VAZIA' | 'CITACAO_VAZIA' | 'ALINEA_VAZIA' | 'SECAO_ALEM_DO_LIMITE';
  /** Id do elemento no modelo. */
  id: string;
  mensagem: string;
}

export interface DocumentoFormatado {
  perfil: { id: string; versao: string };
  estilos: readonly EstiloResolvido[];
  blocos: readonly BlocoFormatado[];
  /** Regras do perfil que não foram aplicadas por falta de decisão ou de fonte. */
  regrasAguardando: readonly string[];
  avisos: readonly AvisoFormatacao[];
}
