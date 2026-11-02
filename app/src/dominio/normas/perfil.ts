/**
 * Perfil normativo em dados (M3-T02; ADR-0005, seção 3). O conteúdo fica em `perfis/<id>/perfil.json`, conferido contra
 * a matriz por `tests/perfil.test.ts`; o esquema zod está em `dominio/esquemas/perfil.ts`. O domínio só recebe o perfil
 * por parâmetro, e por isso um perfil novo não exige código (RNF-13).
 *
 * Medidas nas unidades da norma (cm, mm, pt): a conversão para twips é do motor.
 */
import type { TipoTrabalhoUft } from '../modelo';
import type { EstruturaTipo } from './tipos-trabalho';

export type AlvoRegra =
  | 'documento'
  | 'pagina'
  | 'corpo.paragrafo'
  | 'citacao.longa'
  | 'titulo'
  | 'titulo.nivel1'
  | 'titulo.nivel2'
  | 'titulo.nivel3'
  | 'titulo.nivel4'
  | 'titulo.nivel5'
  | 'titulo.semIndicativo'
  | 'nota.texto'
  | 'nota.numeracao'
  | 'nota.filete'
  | 'alinea'
  | 'subalinea'
  | 'capa'
  | 'folhaRosto.natureza'
  | 'preTextual.agradecimentos'
  | 'preTextual.resumo'
  | 'posTextual.apendice'
  | 'posTextual.anexo'
  | 'referencia'
  | 'paginacao'
  | 'paginacao.numero';

export interface PropriedadesFormatacao {
  larguraMm?: number;
  alturaMm?: number;
  margemSuperiorCm?: number;
  margemInferiorCm?: number;
  margemEsquerdaCm?: number;
  margemDireitaCm?: number;
  corpoPt?: number;
  entrelinha?: 'simples' | '1,5';
  alinhamento?: 'esquerda' | 'direita' | 'centralizado' | 'justificado';
  recuoPrimeiraLinhaCm?: number;
  recuoEsquerdaCm?: number;
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  maiusculas?: boolean;
  quebraPaginaAntes?: boolean;
  manterComProximo?: boolean;
}

export interface ParametroPerfil {
  valor: unknown;
  opcoes?: readonly unknown[];
  ajustavel: boolean;
  rn: readonly string[];
  /** `norma`, `provisorio` ou `decisao-usuario-AAAA-MM-DD`. */
  origem: string;
}

export interface RegraNormativa {
  id: string;
  /** Espelha a matriz; `AMBIGUA` sem parâmetro decidido não é aplicada. */
  status: 'CONFIRMADA' | 'IMPLEMENTADA' | 'AMBIGUA' | 'PENDENTE-FONTE';
  fonte: string;
  tipo: 'estilo' | 'estrutura' | 'procedimento' | 'verificacao';
  alvo: AlvoRegra;
  propriedades?: PropriedadesFormatacao;
  /** Função registrada no código, para `procedimento` e `verificacao`. */
  procedimento?: string;
  parametros?: readonly string[];
  /** PENDENTE-FONTE com decisão do usuário (política de fontes, regra 2.2). */
  provisoria?: boolean;
}

export interface Perfil {
  id: string;
  versao: string;
  nome: string;
  fontes: readonly { id: string; citacao: string; arquivo: string }[];
  parametros: Readonly<Record<string, ParametroPerfil>>;
  regras: readonly RegraNormativa[];
  tiposTrabalho: Readonly<Record<TipoTrabalhoUft, EstruturaTipo>>;
}
