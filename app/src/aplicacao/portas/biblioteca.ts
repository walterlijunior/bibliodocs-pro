/**
 * Porta `biblioteca` — contrato da API `window.bibliodocs.biblioteca.*` (M1-T09; ADR-0004, seções 4 e 5; RF-01).
 *
 * A biblioteca é a pasta de trabalhos (padrão `Documentos\BiblioDocs Pro\Trabalhos\`, configurável) mais um índice em
 * cache (`%LOCALAPPDATA%\BiblioDocsPro\biblioteca.json`), recriável a partir dos `.bdp`.
 *
 * Mesmas regras da porta `projetos`:
 * - o renderer nunca recebe nem envia caminhos: cada arquivo da lista tem um `IdentificadorItem` opaco, que vale só
 *   nos canais desta porta e só para a janela que listou; a pasta aparece só pelo nome;
 * - a confirmação de excluir é um diálogo do principal (o renderer não consegue pulá-la), e excluir é enviar para a
 *   Lixeira, nunca apagar;
 * - nenhuma função lança por erro esperado; a rejeição fica para chamada recusada (origem, argumento fora do contrato).
 */
import type { TipoTrabalhoUft } from '../../dominio/modelo';
import type { ProjetoAberto, ResultadoAbrir } from './projetos';

export const CANAIS_BIBLIOTECA = {
  listar: 'bibliodocs:biblioteca:listar',
  escolherPasta: 'bibliodocs:biblioteca:escolher-pasta',
  criar: 'bibliodocs:biblioteca:criar',
  abrir: 'bibliodocs:biblioteca:abrir',
  renomear: 'bibliodocs:biblioteca:renomear',
  duplicar: 'bibliodocs:biblioteca:duplicar',
  excluir: 'bibliodocs:biblioteca:excluir',
} as const;

export type CanalBiblioteca = (typeof CANAIS_BIBLIOTECA)[keyof typeof CANAIS_BIBLIOTECA];

/** Identificador opaco de um arquivo da lista (22 caracteres base64url), estável enquanto a janela existir. */
export type IdentificadorItem = string;

/** `versaoFutura`: criado por uma versão mais nova do app; `invalido`: não pôde ser lido como projeto. */
export type EstadoItem = 'ok' | 'versaoFutura' | 'invalido';

export interface ItemBiblioteca {
  identificador: IdentificadorItem;
  nomeArquivo: string;
  /** Título em texto plano; vazio quando o trabalho não tem título ou não pôde ser lido. */
  titulo: string;
  estado: EstadoItem;
  /** Campos do manifesto; `null` quando `estado` não é `ok`. */
  tipoTrabalho: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  /** Data de modificação do arquivo no disco (ms desde 1970). */
  modificadoEm: number;
  bytes: number;
}

export interface PastaBiblioteca {
  /** Só o nome da pasta, nunca o caminho. */
  nome: string;
  /** A pasta é a padrão (não foi escolhida pelo usuário). */
  padrao: boolean;
  /** A pasta é sincronizada pelo OneDrive (risco R16): a interface mostra um aviso. */
  naNuvem: boolean;
}

export type CodigoFalhaBiblioteca =
  | 'PASTA_INACESSIVEL'
  | 'NAO_ENCONTRADO'
  | 'NOME_INVALIDO'
  | 'JA_EXISTE'
  | 'ABERTO_NO_APP'
  | 'EM_USO'
  | 'ILEGIVEL'
  | 'VERSAO_FUTURA'
  | 'LIXEIRA_FALHOU'
  | 'SEM_NOME_LIVRE'
  | 'FALHA_DISCO'
  /** Códigos do salvamento atômico (`CodigoFalhaGravacao`), repassados ao criar e ao duplicar. */
  | (string & {});

export interface FalhaBiblioteca {
  ok: false;
  motivo: 'ERRO';
  codigo: CodigoFalhaBiblioteca;
  /** Texto pt-BR para a interface. */
  mensagem: string;
}

export type ResultadoListar =
  | { ok: true; pasta: PastaBiblioteca; itens: ItemBiblioteca[]; avisos: string[] }
  | FalhaBiblioteca;

export type ResultadoEscolherPasta = ResultadoListar | { ok: false; motivo: 'CANCELADO' };

export type ResultadoCriar = { ok: true; projeto: ProjetoAberto; item: ItemBiblioteca } | FalhaBiblioteca;

export type ResultadoItem = { ok: true; item: ItemBiblioteca } | FalhaBiblioteca;

export type ResultadoExcluir = { ok: true } | { ok: false; motivo: 'CANCELADO' } | FalhaBiblioteca;

export interface ApiBiblioteca {
  /** Lista os `.bdp` da pasta da biblioteca (cria a pasta padrão se faltar). */
  listar(): Promise<ResultadoListar>;
  /** Mostra o diálogo de escolher pasta; a escolha vale para as próximas sessões. */
  escolherPasta(): Promise<ResultadoEscolherPasta>;
  /**
   * Cria um trabalho do tipo na pasta, com os elementos e as seções iniciais do tipo (M2-T02), e já o abre. Tipo fora
   * de `TIPOS_TRABALHO_UFT` rejeita a chamada.
   */
  criar(tipo: TipoTrabalhoUft): Promise<ResultadoCriar>;
  /** Abre um arquivo da lista (mesmo resultado de `projetos.abrir`, sem o diálogo). */
  abrir(item: IdentificadorItem): Promise<ResultadoAbrir>;
  /** Renomeia o arquivo; `novoNome` sem a extensão (`.bdp` no fim é aceito e ignorado). */
  renomear(item: IdentificadorItem, novoNome: string): Promise<ResultadoItem>;
  /** Copia o trabalho com identidade nova (`<nome> (cópia).bdp`). */
  duplicar(item: IdentificadorItem): Promise<ResultadoItem>;
  /** Pede confirmação e envia o arquivo para a Lixeira. */
  excluir(item: IdentificadorItem): Promise<ResultadoExcluir>;
}
