/**
 * Porta `projetos` — contrato da API `window.bibliodocs.projetos.*` entre o renderer e o processo principal
 * (ADR-0005, seção 3, "Persistência e IPC"; M1-T08; checklist C-10 a C-12).
 *
 * Regras do contrato:
 * - o renderer nunca recebe nem envia caminhos: o arquivo aberto é um `IdentificadorProjeto` opaco, criado pelo
 *   principal depois de um diálogo, e o visor mostra só `nomeArquivo` (C-12; revisão M6-11);
 * - todo destino de gravação vem de um diálogo aberto pelo principal (`abrir` e `salvarComo`); `salvar` só grava no
 *   arquivo que o próprio renderer abriu ou salvou antes;
 * - só tipos que atravessam o `contextBridge` e o IPC sem conversão: objetos, arrays, strings, números e
 *   `Uint8Array` (sem `Map`, `Set` nem classes);
 * - nenhuma função lança exceção por erro esperado (arquivo em uso, cancelado, inválido); a rejeição da promessa fica
 *   para chamada recusada pelo principal (origem não permitida, argumento fora do contrato).
 */
import type { Manifesto } from '../../dominio/esquemas';
import type { Documento } from '../../dominio/modelo';
import type { ApiBiblioteca } from './biblioteca';
import type { ApiRecuperacao } from './recuperacao';

/** Nomes dos canais. O preload só invoca estes; o principal só registra estes. */
export const CANAIS_PROJETOS = {
  abrir: 'bibliodocs:projetos:abrir',
  salvar: 'bibliodocs:projetos:salvar',
  salvarComo: 'bibliodocs:projetos:salvar-como',
  fechar: 'bibliodocs:projetos:fechar',
} as const;

export type CanalProjetos = (typeof CANAIS_PROJETOS)[keyof typeof CANAIS_PROJETOS];

/** Identificador opaco de um arquivo aberto nesta sessão (22 caracteres base64url). Não revela o caminho. */
export type IdentificadorProjeto = string;

export interface MidiaTransferivel {
  /** Chave do manifesto (64 dígitos hexadecimais minúsculos). */
  sha256: string;
  bytes: Uint8Array;
}

/** Projeto como atravessa o IPC: o `PacoteProjeto` da persistência com as mídias em lista. */
export interface PacoteTransferivel {
  manifesto: Manifesto;
  documento: Documento;
  midias: MidiaTransferivel[];
  miniatura?: Uint8Array;
}

/** Projeto de versão futura: o manifesto mantém a versão do arquivo, e nada no contrato aceita gravá-lo. */
export type PacoteSomenteLeituraTransferivel = Omit<PacoteTransferivel, 'manifesto'> & {
  manifesto: Omit<Manifesto, 'versaoFormato'> & { versaoFormato: number };
};

/** Problema que não impede abrir (ex.: mídia descartada) ou salvar (ex.: falha no `.bak`). */
export interface AvisoProjeto {
  caminho: string;
  mensagem: string;
}

/** Erro de validação, com o caminho dentro do projeto (nunca um caminho do disco). */
export interface ErroProjeto {
  caminho: string;
  mensagem: string;
}

export interface ProjetoAberto {
  /** `null` quando o arquivo não tem a extensão `.bdp`: abre, mas só grava por "Salvar como". */
  identificador: IdentificadorProjeto | null;
  nomeArquivo: string;
  pacote: PacoteTransferivel;
  avisos: AvisoProjeto[];
  /** Arquivo de formato antigo atualizado na abertura; a cópia original ficou na pasta de backups do app. */
  atualizacao: { versaoOrigem: number; nomeBackup: string } | null;
}

export type ResultadoAbrir =
  | { ok: true; projeto: ProjetoAberto }
  | { ok: false; motivo: 'CANCELADO' }
  | { ok: false; motivo: 'ERRO'; nomeArquivo: string; mensagem: string; erros: ErroProjeto[] }
  | {
      ok: false;
      motivo: 'VERSAO_FUTURA';
      nomeArquivo: string;
      versaoFormato: number;
      /** Conteúdo para abrir só para leitura, ou `null` quando esta versão do app não o entende. */
      leitura: { pacote: PacoteSomenteLeituraTransferivel; avisos: AvisoProjeto[] } | null;
    };

export type FalhaSalvar =
  | { ok: false; motivo: 'CANCELADO' }
  | {
      ok: false;
      motivo: 'ERRO';
      /** Código estável para a interface decidir o que oferecer (ex.: `EM_USO` → "Salvar como…"). */
      codigo: string;
      /** Texto pt-BR para o visor. */
      mensagem: string;
      erros: ErroProjeto[];
    };

export type ResultadoSalvar = { ok: true; nomeArquivo: string; avisos: string[] } | FalhaSalvar;

/** `salvarComo` devolve o identificador do novo arquivo; o antigo continua válido até `fechar`. */
export type ResultadoSalvarComo =
  | { ok: true; identificador: IdentificadorProjeto; nomeArquivo: string; avisos: string[] }
  | FalhaSalvar;

export interface ApiProjetos {
  /** Mostra o diálogo de abrir e lê o arquivo escolhido. */
  abrir(): Promise<ResultadoAbrir>;
  /** Grava no arquivo de `identificador` (aberto ou salvo antes por esta janela). */
  salvar(identificador: IdentificadorProjeto, pacote: PacoteTransferivel): Promise<ResultadoSalvar>;
  /** Mostra o diálogo de salvar e grava no destino escolhido. */
  salvarComo(pacote: PacoteTransferivel): Promise<ResultadoSalvarComo>;
  /** Esquece o identificador (fechar o trabalho). Identificador desconhecido é ignorado. */
  fechar(identificador: IdentificadorProjeto): Promise<void>;
}

/** O que o preload expõe em `window.bibliodocs`. */
export interface ApiBiblioDocs {
  readonly projetos: ApiProjetos;
  readonly biblioteca: ApiBiblioteca;
  readonly recuperacao: ApiRecuperacao;
}
