/**
 * Operações de disco usadas pelo salvamento atômico e pela abertura de projetos. Ficam atrás desta interface para
 * que os testes injetem falhas (EPERM, ENOSPC, queda entre passos) sem tocar no código de produção.
 */
import { constants } from 'node:fs';
import { chmod, copyFile, lstat, open, rename, unlink } from 'node:fs/promises';

export interface ArquivoAberto {
  /** Tamanho atual pelo próprio descritor (não pelo caminho, que pode ter mudado). */
  tamanho(): Promise<number>;
  /** Se o próprio descritor é de arquivo comum (fecha a janela entre conferir o caminho e abri-lo). */
  arquivoComum(): Promise<boolean>;
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
}

export interface SistemaArquivos {
  /** Cria um arquivo novo para gravação; falha com EEXIST se já existir (não segue nem sobrescreve nada). */
  criarExclusivo(caminho: string): Promise<ArquivoAberto>;
  abrirLeitura(caminho: string): Promise<ArquivoAberto>;
  /** Informação do próprio caminho, sem seguir link simbólico. Erro ENOENT se não existir. */
  info(caminho: string): Promise<InfoCaminho>;
  renomear(de: string, para: string): Promise<void>;
  /** Copia para um caminho novo; falha se `para` já existir. */
  copiar(de: string, para: string): Promise<void>;
  /** `fsync` de um arquivo já gravado (a cópia do `.bak`). */
  sincronizar(caminho: string): Promise<void>;
  /** Tira o atributo somente leitura. */
  tornarGravavel(caminho: string): Promise<void>;
  apagar(caminho: string): Promise<void>;
}

async function embrulhar(caminho: string, flags: string | number): Promise<ArquivoAberto> {
  const h = await open(caminho, flags, 0o600);
  return {
    tamanho: async () => (await h.stat()).size,
    arquivoComum: async () => (await h.stat()).isFile(),
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
    const s = await lstat(caminho);
    return { arquivoComum: s.isFile(), pasta: s.isDirectory(), link: s.isSymbolicLink(), somenteLeitura: (s.mode & 0o200) === 0, bytes: s.size };
  },
  renomear: (de, para) => rename(de, para),
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
};

/** Código de erro do Node (`EPERM`, `ENOENT`...) ou `undefined`. */
export function codigoErro(erro: unknown): string | undefined {
  const c = (erro as { code?: unknown } | null)?.code;
  return typeof c === 'string' ? c : undefined;
}
