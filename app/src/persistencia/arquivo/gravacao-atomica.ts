/**
 * Salvamento atômico (ADR-0004, seção 4, com o adendo técnico do M1-T06).
 *
 * Passos:
 * 1. Conferir o destino: se existe, precisa ser arquivo comum (nem pasta, nem link) e não somente leitura.
 * 2. Gravar `<destino>.tmp-<pid>-<aleatório>` no mesmo diretório, criado com exclusividade; `fsync`; fechar.
 * 3. Se o destino existe, **copiar** o destino para `<destino>.bak` (cópia exclusiva `.bak.tmp-*`, tirar o somente
 *    leitura, `fsync`, `rename`). O destino continua no lugar o tempo todo: não há janela em que o trabalho do
 *    usuário não existe no disco.
 * 4. Renomear o temporário sobre o destino (troca atômica no mesmo volume; a durabilidade da troca depois de uma
 *    queda de energia não é garantida no Windows, só que o resultado é o original ou o novo, íntegros).
 * Os passos 3 e 4 repetem com espera crescente em `EPERM`, `EBUSY` e `EACCES` (arquivo aberto por outro programa,
 * antivírus, OneDrive), dividindo **um único orçamento** de esperas (revisão M6-02). O passo 2 repete só em `EBUSY`.
 * Se as tentativas do passo 4 se esgotam, o original fica intacto e o temporário permanece para a recuperação
 * (M1-T12); o temporário de uma falha anterior do mesmo destino nesta sessão é apagado no salvamento seguinte, para
 * não acumular cópias (M6-04). Falha no `.bak` não impede salvar: vira aviso.
 *
 * Nada lança exceção: tudo devolve `{ ok, ... }` com mensagem em pt-BR para o visor.
 */
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as aguardarMs } from 'node:timers/promises';
import { codigoErro, SISTEMA_ARQUIVOS_NODE, type ArquivoAberto, type SistemaArquivos } from './sistema-arquivos';

/**
 * Esperas entre as tentativas: até 6 tentativas e cerca de 1,55 s de espera **somados** (leitura do ADR-0004, passo 6,
 * registrada no adendo do M1-T06). O orçamento vale para o salvamento inteiro, não para cada passo.
 */
export const ESPERAS_TENTATIVAS_MS: readonly number[] = [50, 100, 200, 400, 800];
const CODIGOS_TRANSITORIOS = new Set(['EPERM', 'EBUSY', 'EACCES']);

export type CodigoFalhaGravacao =
  | 'EM_USO'
  | 'SEM_PERMISSAO'
  | 'SOMENTE_LEITURA'
  | 'SEM_ESPACO'
  | 'PASTA_INEXISTENTE'
  | 'DESTINO_INVALIDO'
  | 'PACOTE_INVALIDO'
  | 'FALHA_E_S';

export const MENSAGENS_FALHA: Readonly<Record<CodigoFalhaGravacao, string>> = {
  EM_USO: 'Não foi possível salvar: o arquivo está em uso por outro programa. Feche-o e tente de novo, ou use “Salvar como…”.',
  SEM_PERMISSAO: 'Não foi possível salvar: sem permissão para gravar nesta pasta. Use “Salvar como…” em outra pasta.',
  SOMENTE_LEITURA:
    'Não foi possível salvar: o arquivo está marcado como somente leitura. Desmarque essa opção nas propriedades do arquivo ou use “Salvar como…”.',
  SEM_ESPACO: 'Não foi possível salvar: não há espaço livre suficiente no disco.',
  PASTA_INEXISTENTE: 'Não foi possível salvar: a pasta de destino não existe mais.',
  DESTINO_INVALIDO: 'Não foi possível salvar: o destino não é um arquivo comum.',
  PACOTE_INVALIDO: 'Não foi possível salvar: o trabalho tem dados que o formato .bdp não aceita.',
  FALHA_E_S: 'Não foi possível salvar por um erro de gravação no disco.',
};

export type ResultadoGravacao =
  | {
      ok: true;
      caminho: string;
      /** Caminho do `.bak` atualizado neste salvamento, ou `null` (arquivo novo ou falha no `.bak`). */
      bak: string | null;
      avisos: string[];
      /** Tentativas do passo 4 (1 = sem repetição). */
      tentativas: number;
      duracaoMs: number;
    }
  | {
      ok: false;
      codigo: CodigoFalhaGravacao;
      mensagem: string;
      /** Código do sistema (`EPERM`...), para o registro técnico; não vai para o visor. */
      detalhe?: string;
      /** Temporário completo deixado no disco para a recuperação, ou `null`. O original nunca é alterado. */
      temporario: string | null;
      duracaoMs: number;
    };

export interface OpcoesGravacao {
  fs?: SistemaArquivos;
  esperas?: readonly number[];
  aguardar?: (ms: number) => Promise<void>;
  /** Sufixo aleatório dos temporários (injetável nos testes). */
  aleatorio?: () => string;
  agora?: () => number;
  /**
   * Não atualiza o `.bak` (passo 3): para arquivos do próprio app em `%LOCALAPPDATA%` (instantâneos de recuperação e
   * travas de sessão, M1-T12), que não são o trabalho do usuário e não precisam de cópia anterior.
   */
  semBak?: boolean;
}

class FalhaTentativas extends Error {
  constructor(readonly causa: unknown) {
    super('tentativas esgotadas');
  }
}

/** Orçamento de esperas dividido pelos passos de um mesmo salvamento. */
interface Orcamento {
  esperas: readonly number[];
  usadas: number;
  aguardar: (ms: number) => Promise<void>;
}

/** Executa `op`, repetindo em erro transitório enquanto houver orçamento; devolve o número de tentativas. */
async function comTentativas(op: () => Promise<void>, orcamento: Orcamento, codigos: ReadonlySet<string> = CODIGOS_TRANSITORIOS): Promise<number> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      await op();
      return tentativa;
    } catch (e) {
      if (!codigos.has(codigoErro(e) ?? '') || orcamento.usadas >= orcamento.esperas.length) throw new FalhaTentativas(e);
      await orcamento.aguardar(orcamento.esperas[orcamento.usadas++]!);
    }
  }
}

const causaDe = (e: unknown) => (e instanceof FalhaTentativas ? e.causa : e);

function classificar(erro: unknown, fase: 'criar' | 'trocar'): CodigoFalhaGravacao {
  const c = codigoErro(erro);
  if (c === 'ENOSPC' || c === 'EDQUOT') return 'SEM_ESPACO';
  // Na troca, ENOENT é o temporário que sumiu (antivírus), não a pasta (revisão M6-08).
  if (c === 'ENOENT') return fase === 'criar' ? 'PASTA_INEXISTENTE' : 'FALHA_E_S';
  if (c === 'EROFS') return 'SEM_PERMISSAO';
  if (c === 'EISDIR') return 'DESTINO_INVALIDO';
  if (c === 'EPERM' || c === 'EACCES' || c === 'EBUSY') return fase === 'criar' ? 'SEM_PERMISSAO' : 'EM_USO';
  return 'FALHA_E_S';
}

const filas = new Map<string, Promise<unknown>>();
/** Temporário deixado pela última falha de cada destino nesta sessão (revisão M6-04). */
const temporariosDeixados = new Map<string, string>();
const chaveDestino = (destino: string) => (process.platform === 'win32' ? resolve(destino).toLowerCase() : resolve(destino));
const SO_EBUSY: ReadonlySet<string> = new Set(['EBUSY']);

/** Salvamentos do mesmo destino (Ctrl+S e automático) rodam um de cada vez, na ordem de chegada. */
function enfileirar<T>(destino: string, tarefa: () => Promise<T>): Promise<T> {
  const chave = chaveDestino(destino);
  const anterior = filas.get(chave) ?? Promise.resolve();
  const atual = anterior.then(tarefa, tarefa);
  const fim = atual.then(
    () => undefined,
    () => undefined,
  );
  filas.set(chave, fim);
  void fim.then(() => {
    if (filas.get(chave) === fim) filas.delete(chave);
  });
  return atual;
}

async function fecharEApagar(fs: SistemaArquivos, arquivo: ArquivoAberto | null, caminho: string): Promise<void> {
  if (arquivo) await arquivo.fechar().catch(() => undefined);
  await fs.apagar(caminho).catch(() => undefined);
}

/** Grava `bytes` em `destino` pelo procedimento atômico. Nunca lança. */
export function gravarAtomico(destino: string, bytes: Uint8Array, opcoes: OpcoesGravacao = {}): Promise<ResultadoGravacao> {
  return enfileirar(destino, () => executar(destino, bytes, opcoes));
}

async function executar(destino: string, bytes: Uint8Array, opcoes: OpcoesGravacao): Promise<ResultadoGravacao> {
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const esperas = opcoes.esperas ?? ESPERAS_TENTATIVAS_MS;
  const aguardar = opcoes.aguardar ?? ((ms: number) => aguardarMs(ms).then(() => undefined));
  const orcamento: Orcamento = { esperas, usadas: 0, aguardar };
  const aleatorio = opcoes.aleatorio ?? (() => randomBytes(4).toString('hex'));
  const agora = opcoes.agora ?? (() => performance.now());
  const inicio = agora();
  const falha = (codigo: CodigoFalhaGravacao, erro: unknown, temporario: string | null): ResultadoGravacao => {
    const r: ResultadoGravacao = { ok: false, codigo, mensagem: MENSAGENS_FALHA[codigo], temporario, duracaoMs: agora() - inicio };
    const detalhe = codigoErro(erro);
    if (detalhe) r.detalhe = detalhe;
    return r;
  };

  // 1. Destino.
  let existe = false;
  try {
    const info = await fs.info(destino);
    if (!info.arquivoComum) return falha('DESTINO_INVALIDO', undefined, null);
    // Sem isto o rename daria EPERM, gastaria as tentativas e diria "em uso" (revisão M6-01).
    if (info.somenteLeitura) return falha('SOMENTE_LEITURA', undefined, null);
    existe = true;
  } catch (e) {
    if (codigoErro(e) !== 'ENOENT') return falha(classificar(e, 'criar'), e, null);
  }

  // O temporário de uma falha anterior foi superado por este salvamento.
  const chave = chaveDestino(destino);
  const deixado = temporariosDeixados.get(chave);
  if (deixado) {
    temporariosDeixados.delete(chave);
    await fs.apagar(deixado).catch(() => undefined);
  }

  // 2. Temporário completo e sincronizado.
  const temporario = `${destino}.tmp-${process.pid}-${aleatorio()}`;
  let arquivo: ArquivoAberto | null = null;
  try {
    let criado: ArquivoAberto | undefined;
    await comTentativas(async () => {
      criado = await fs.criarExclusivo(temporario);
    }, orcamento, SO_EBUSY);
    arquivo = criado!;
    await arquivo.gravarTudo(bytes);
    await arquivo.sincronizar();
    const a = arquivo;
    arquivo = null;
    await a.fechar();
  } catch (e) {
    const causa = causaDe(e);
    // Se o erro veio da criação, o temporário não é nosso (EEXIST) ou não existe: apagar só o que criamos.
    if (arquivo || codigoErro(causa) !== 'EEXIST') await fecharEApagar(fs, arquivo, temporario);
    return falha(classificar(causa, 'criar'), causa, null);
  }

  // 3. Cópia de segurança do original; falha aqui só gera aviso.
  const avisos: string[] = [];
  let bak: string | null = null;
  if (existe && !opcoes.semBak) {
    const destinoBak = `${destino}.bak`;
    const temporarioBak = `${destinoBak}.tmp-${process.pid}-${aleatorio()}`;
    let copiado = false;
    try {
      await comTentativas(() => fs.copiar(destino, temporarioBak), orcamento);
      copiado = true;
      // A cópia herda o somente leitura; um .bak somente leitura travaria os salvamentos seguintes (revisão M6-01).
      await fs.tornarGravavel(temporarioBak);
      await fs.sincronizar(temporarioBak); // revisão M6-05
      await fs.tornarGravavel(destinoBak).catch(() => undefined);
      await comTentativas(() => fs.renomear(temporarioBak, destinoBak), orcamento);
      bak = destinoBak;
    } catch (e) {
      // EEXIST na cópia: o arquivo não é nosso e fica onde está (mesma regra do passo 2).
      if (copiado || codigoErro(causaDe(e)) !== 'EEXIST') await fs.apagar(temporarioBak).catch(() => undefined);
      avisos.push('A cópia de segurança (.bak) não pôde ser atualizada; o trabalho foi salvo mesmo assim.');
    }
  }

  // 4. Troca atômica.
  try {
    const tentativas = await comTentativas(() => fs.renomear(temporario, destino), orcamento);
    return { ok: true, caminho: destino, bak, avisos, tentativas, duracaoMs: agora() - inicio };
  } catch (e) {
    const causa = causaDe(e);
    temporariosDeixados.set(chave, temporario);
    return falha(classificar(causa, 'trocar'), causa, temporario);
  }
}
