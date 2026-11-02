/**
 * Operações de disco usadas pelo salvamento atômico e pela abertura de projetos. Ficam atrás desta interface para
 * que os testes injetem falhas (EPERM, ENOSPC, queda entre passos) sem tocar no código de produção.
 */
import { constants } from 'node:fs';
import { chmod, copyFile, link, lstat, mkdir, open, readdir, rename, rmdir, unlink, utimes } from 'node:fs/promises';

export interface ArquivoAberto {
  /** Tamanho atual pelo próprio descritor (não pelo caminho, que pode ter mudado). */
  tamanho(): Promise<number>;
  /** Se o próprio descritor é de arquivo comum (fecha a janela entre conferir o caminho e abri-lo). */
  arquivoComum(): Promise<boolean>;
  /** Identidade do arquivo pelo descritor (`dev:ino`), para conferir que é o mesmo conferido pelo caminho. */
  identidade(): Promise<string>;
  /** Lê até `quantidade` bytes a partir de `posicao`; devolve quantos leu. */
  ler(destino: Uint8Array, deslocamento: number, quantidade: number, posicao: number): Promise<number>;
  gravarTudo(dados: Uint8Array): Promise<void>;
  sincronizar(): Promise<void>;
  fechar(): Promise<void>;
}

export interface InfoCaminho {
  arquivoComum: boolean;
  pasta: boolean;
  link: boolean;
  /** Atributo somente leitura (no Windows, o bit de escrita ausente no `mode`). */
  somenteLeitura: boolean;
  bytes: number;
  /** Data de modificação (ms desde 1970), para o índice da biblioteca saber se o arquivo mudou. */
  modificadoEmMs: number;
  /** Identidade do arquivo no volume (`dev:ino`): dois nomes do mesmo arquivo têm a mesma. */
  identidade: string;
}

/** Entrada de uma pasta, sem seguir link simbólico. */
export interface EntradaPasta {
  nome: string;
  arquivoComum: boolean;
  /** Pasta (sem seguir link). */
  pasta: boolean;
  link: boolean;
}

export interface SistemaArquivos {
  /** Cria um arquivo novo para gravação; falha com EEXIST se já existir (não segue nem sobrescreve nada). */
  criarExclusivo(caminho: string): Promise<ArquivoAberto>;
  abrirLeitura(caminho: string): Promise<ArquivoAberto>;
  /** Informação do próprio caminho, sem seguir link simbólico. Erro ENOENT se não existir. */
  info(caminho: string): Promise<InfoCaminho>;
  renomear(de: string, para: string): Promise<void>;
  /** Link físico novo para o arquivo; falha com EEXIST se `para` já existir (nunca sobrescreve). */
  vincular(de: string, para: string): Promise<void>;
  /** Copia para um caminho novo; falha se `para` já existir. */
  copiar(de: string, para: string): Promise<void>;
  /** `fsync` de um arquivo já gravado (a cópia do `.bak`). */
  sincronizar(caminho: string): Promise<void>;
  /** Tira o atributo somente leitura. */
  tornarGravavel(caminho: string): Promise<void>;
  apagar(caminho: string): Promise<void>;
  /** Cria a pasta e as que faltarem acima dela; não falha se já existir. */
  criarPasta(caminho: string): Promise<void>;
  /** Entradas diretas da pasta (sem descer em subpastas). */
  listarPasta(caminho: string): Promise<EntradaPasta[]>;
  /** Apaga uma pasta **vazia** (falha com ENOTEMPTY se houver algo dentro; nunca apaga em cascata). */
  apagarPasta(caminho: string): Promise<void>;
  /** Muda a data de modificação (ms desde 1970). A cópia mantém a data da origem; o arquivamento precisa da sua. */
  definirModificacao(caminho: string, ms: number): Promise<void>;
}

async function embrulhar(caminho: string, flags: string | number): Promise<ArquivoAberto> {
  const h = await open(caminho, flags, 0o600);
  return {
    tamanho: async () => (await h.stat()).size,
    arquivoComum: async () => (await h.stat()).isFile(),
    identidade: async () => {
      const s = await h.stat({ bigint: true });
      return `${s.dev}:${s.ino}`;
    },
    ler: async (destino, deslocamento, quantidade, posicao) => (await h.read(destino, deslocamento, quantidade, posicao)).bytesRead,
    gravarTudo: (dados) => h.writeFile(dados),
    sincronizar: () => h.sync(),
    fechar: () => h.close(),
  };
}

export const SISTEMA_ARQUIVOS_NODE: SistemaArquivos = {
  criarExclusivo: (caminho) => embrulhar(caminho, 'wx'),
  abrirLeitura: (caminho) => embrulhar(caminho, constants.O_RDONLY),
  info: async (caminho) => {
    const s = await lstat(caminho, { bigint: true });
    return {
      arquivoComum: s.isFile(),
      pasta: s.isDirectory(),
      link: s.isSymbolicLink(),
      somenteLeitura: (s.mode & 0o200n) === 0n,
      bytes: Number(s.size),
      modificadoEmMs: Number(s.mtimeMs),
      identidade: `${s.dev}:${s.ino}`,
    };
  },
  renomear: (de, para) => rename(de, para),
  vincular: (de, para) => link(de, para),
  copiar: (de, para) => copyFile(de, para, constants.COPYFILE_EXCL),
  sincronizar: async (caminho) => {
    const h = await open(caminho, 'r+');
    try {
      await h.sync();
    } finally {
      await h.close();
    }
  },
  tornarGravavel: (caminho) => chmod(caminho, 0o644),
  apagar: (caminho) => unlink(caminho),
  criarPasta: async (caminho) => void (await mkdir(caminho, { recursive: true })),
  listarPasta: async (caminho) =>
    (await readdir(caminho, { withFileTypes: true })).map((d) => ({ nome: d.name, arquivoComum: d.isFile(), pasta: d.isDirectory(), link: d.isSymbolicLink() })),
  apagarPasta: (caminho) => rmdir(caminho),
  definirModificacao: (caminho, ms) => utimes(caminho, ms / 1000, ms / 1000),
};

/** Código de erro do Node (`EPERM`, `ENOENT`...) ou `undefined`. */
export function codigoErro(erro: unknown): string | undefined {
  const c = (erro as { code?: unknown } | null)?.code;
  return typeof c === 'string' ? c : undefined;
}

/**
 * O que um erro pode levar ao log (R-M1-07): o código (`ENOENT`) ou o tipo (`TypeError`). Nunca a mensagem, que no Node
 * traz o caminho completo, e o caminho tem o nome de usuário do Windows e o título do trabalho.
 */
export function descreverErro(erro: unknown): string {
  return codigoErro(erro) ?? (erro instanceof Error ? erro.name : 'erro');
}
