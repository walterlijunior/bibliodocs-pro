/**
 * Recuperação após encerramento inesperado (ADR-0004, seção 4, "Salvamento automático e recuperação"; M1-T12).
 *
 * Arquivos em `%LOCALAPPDATA%\BiblioDocsPro\`:
 * - `recuperacao\<id>\atual.bdp` e `anterior.bdp`: o instantâneo mais recente e o anterior do projeto `<id>`, gravados
 *   pelo procedimento atômico (sem `.bak`);
 * - `sessao\<id>.lock`: trava de sessão, JSON com o PID, o horário e o caminho do arquivo do usuário. É ela que diz de
 *   qual arquivo o instantâneo veio;
 * - `recuperacao\<id>~<AAAAMMDD-HHMMSS>\` (e a trava `sessao\<id>~<…>.lock`): instantâneos de uma queda ainda não
 *   decidida, **reservados** quando o mesmo projeto volta a ser editado (o usuário escolheu "Decidir depois" e abriu o
 *   arquivo). Continuam oferecidos até o usuário escolher (revisão do M1-T12, A2);
 * - `recuperacao-antigos\`: o que o usuário descartou e os temporários órfãos. Fica 7 dias **contados do
 *   arquivamento** e depois é apagado; nada da recuperação é apagado na hora por uma escolha do usuário.
 *
 * Também procura, na pasta da biblioteca, os restos de uma gravação interrompida: `*.bdp.tmp-<pid>-*` (temporário
 * completo ou parcial), `*.bdp.bak.tmp-<pid>-*` (cópia do original, pode ser apagada) e `*.bdp.bak`. Os temporários do
 * próprio processo ficam de fora: podem ser de uma gravação em curso.
 *
 * Nenhuma função lança exceção; as decisões (oferecer, arquivar, apagar) ficam no principal
 * (`principal/ipc/manipuladores-recuperacao.ts`).
 */
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { PADRAO_ID } from '../../dominio/esquemas';
import { lerArquivoLimitado } from '../arquivo/projeto-em-disco';
import { gravarAtomico, type OpcoesGravacao } from '../arquivo/gravacao-atomica';
import { codigoErro, SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../arquivo/sistema-arquivos';
import { LIMITES_CONTEINER } from '../conteiner/limites';

/** Instantâneo mais recente e o anterior (o ADR-0004 guarda só os dois). */
export const NOME_INSTANTANEO = 'atual.bdp';
export const NOME_INSTANTANEO_ANTERIOR = 'anterior.bdp';
const EXTENSAO_TRAVA = '.lock';

/** Prazo dos itens em `recuperacao-antigos` (ADR-0004: temporário órfão apagado depois de 7 dias). */
export const PRAZO_ANTIGOS_MS = 7 * 24 * 60 * 60 * 1000;

/** Tamanho máximo lido de uma trava (o JSON tem algumas centenas de bytes). */
const LIMITE_TRAVA = 64 * 1024;

export interface PastasRecuperacao {
  /** `%LOCALAPPDATA%\BiblioDocsPro\recuperacao` */
  recuperacao: string;
  /** `%LOCALAPPDATA%\BiblioDocsPro\recuperacao-antigos` */
  antigos: string;
  /** `%LOCALAPPDATA%\BiblioDocsPro\sessao` */
  sessao: string;
}

export interface OpcoesRecuperacao {
  fs?: SistemaArquivos;
  /** Opções do `gravarAtomico` (esperas e sufixo aleatório nos testes). */
  gravacao?: Omit<OpcoesGravacao, 'fs' | 'semBak'>;
}

const esquemaTrava = z.strictObject({
  formato: z.literal('bibliodocs-trava-sessao'),
  pid: z.int().min(0),
  /** ISO 8601 (UTC). */
  desde: z.string().max(64),
  /** Arquivo do usuário aberto na sessão. */
  caminho: z
    .string()
    .min(1)
    .max(32_767)
    .refine((c) => isAbsolute(c) && !c.includes('\0')),
});

export type TravaSessao = Omit<z.infer<typeof esquemaTrava>, 'formato'>;

/**
 * Conjunto reservado: `<id>~AAAAMMDD-HHMMSS` (com `-2`, `-3`… se repetir), ou `<id>~AAAAMMDD-HHMMSS-cN` para a cópia
 * aberta sem arquivo (`nomeConjuntoReservado`), em espaço de nomes próprio (R-M3-02). O `~` não existe no `PADRAO_ID`.
 */
const RE_RESERVADO = /^([A-Za-z0-9_-]{8,64})~\d{8}-\d{6}(-c?\d{1,2})?$/;

/** Nome de um conjunto de instantâneos: o id do projeto ou um conjunto reservado dele. */
const idValido = (nome: string) => PADRAO_ID.test(nome) || RE_RESERVADO.test(nome);

/** Id do projeto de um conjunto (`<id>` ou `<id>~<carimbo>`). */
export const idDoConjunto = (nome: string): string => RE_RESERVADO.exec(nome)?.[1] ?? nome;

/** O conjunto é uma queda reservada (nunca pertence a uma sessão ativa). */
export const ehReservado = (nome: string): boolean => RE_RESERVADO.test(nome);
const pastaInstantaneos = (p: PastasRecuperacao, id: string) => join(p.recuperacao, id);
const arquivoTrava = (p: PastasRecuperacao, id: string) => join(p.sessao, `${id}${EXTENSAO_TRAVA}`);
const ignorar = () => undefined;

// ---------- trava de sessão ----------

/** Grava (ou regrava) a trava do projeto `id`. `false` se não conseguiu. */
export async function gravarTrava(pastas: PastasRecuperacao, id: string, trava: TravaSessao, opcoes: OpcoesRecuperacao = {}): Promise<boolean> {
  if (!idValido(id)) return false;
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  try {
    await fs.criarPasta(pastas.sessao);
  } catch {
    return false;
  }
  const json = JSON.stringify({ formato: 'bibliodocs-trava-sessao', ...trava });
  const r = await gravarAtomico(arquivoTrava(pastas, id), new TextEncoder().encode(json), { ...opcoes.gravacao, fs, semBak: true });
  if (!r.ok && r.temporario) await fs.apagar(r.temporario).catch(ignorar);
  return r.ok;
}

/** Trava do projeto `id`, ou `null` se não existe ou não é uma trava válida. */
export async function lerTrava(pastas: PastasRecuperacao, id: string, opcoes: OpcoesRecuperacao = {}): Promise<TravaSessao | null> {
  if (!idValido(id)) return null;
  const lido = await lerArquivoLimitado(arquivoTrava(pastas, id), opcoes.fs, { ...LIMITES_CONTEINER, bytesArquivo: LIMITE_TRAVA });
  if (!lido.ok) return null;
  try {
    const r = esquemaTrava.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(lido.bytes)));
    if (!r.success) return null;
    const { formato: _formato, ...trava } = r.data;
    return trava;
  } catch {
    return null;
  }
}

export async function apagarTrava(pastas: PastasRecuperacao, id: string, opcoes: OpcoesRecuperacao = {}): Promise<void> {
  if (!idValido(id)) return;
  await (opcoes.fs ?? SISTEMA_ARQUIVOS_NODE).apagar(arquivoTrava(pastas, id)).catch(ignorar);
}

/** Ids com trava gravada. */
export async function listarTravas(pastas: PastasRecuperacao, opcoes: OpcoesRecuperacao = {}): Promise<string[]> {
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  try {
    return (await fs.listarPasta(pastas.sessao))
      .filter((e) => e.arquivoComum && !e.link && e.nome.endsWith(EXTENSAO_TRAVA))
      .map((e) => e.nome.slice(0, -EXTENSAO_TRAVA.length))
      .filter(idValido);
  } catch {
    return [];
  }
}

// ---------- instantâneos ----------

export type ResultadoInstantaneo = { ok: true; caminho: string } | { ok: false; detalhe?: string };

/**
 * Grava o instantâneo do projeto `id`: o atual passa a ser o anterior (substituindo o que havia) e `bytes` vira o
 * atual, pelo procedimento atômico. Se a gravação falha, o anterior continua no lugar.
 */
export async function gravarInstantaneo(
  pastas: PastasRecuperacao,
  id: string,
  bytes: Uint8Array,
  opcoes: OpcoesRecuperacao = {},
): Promise<ResultadoInstantaneo> {
  if (!idValido(id)) return { ok: false, detalhe: 'id' };
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const pasta = pastaInstantaneos(pastas, id);
  try {
    await fs.criarPasta(pasta);
  } catch (e) {
    return { ok: false, detalhe: codigoErro(e) ?? 'criar pasta' };
  }
  const atual = join(pasta, NOME_INSTANTANEO);
  try {
    await fs.renomear(atual, join(pasta, NOME_INSTANTANEO_ANTERIOR));
  } catch {
    // Sem atual (primeiro instantâneo) ou anterior preso: o atual é substituído pela troca atômica mesmo assim.
  }
  const r = await gravarAtomico(atual, bytes, { ...opcoes.gravacao, fs, semBak: true });
  if (r.ok) return { ok: true, caminho: r.caminho };
  if (r.temporario) await fs.apagar(r.temporario).catch(ignorar);
  return { ok: false, detalhe: r.detalhe ?? r.codigo };
}

export interface InstantaneoNoDisco {
  caminho: string;
  modificadoEmMs: number;
}

/** Instantâneos do projeto `id`, do mais recente para o anterior (só os que existem como arquivo comum). */
export async function instantaneosDe(pastas: PastasRecuperacao, id: string, opcoes: OpcoesRecuperacao = {}): Promise<InstantaneoNoDisco[]> {
  if (!idValido(id)) return [];
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const encontrados: InstantaneoNoDisco[] = [];
  for (const nome of [NOME_INSTANTANEO, NOME_INSTANTANEO_ANTERIOR]) {
    const caminho = join(pastaInstantaneos(pastas, id), nome);
    try {
      const info = await fs.info(caminho);
      if (info.arquivoComum) encontrados.push({ caminho, modificadoEmMs: info.modificadoEmMs });
    } catch {
      // ausente
    }
  }
  return encontrados;
}

/** Conjuntos (`<id>` e `<id>~<carimbo>`) que têm uma pasta de instantâneos (vazia ou não). */
export async function listarIdsComInstantaneos(pastas: PastasRecuperacao, opcoes: OpcoesRecuperacao = {}): Promise<string[]> {
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  try {
    return (await fs.listarPasta(pastas.recuperacao)).filter((e) => e.pasta && !e.link && idValido(e.nome)).map((e) => e.nome);
  } catch {
    return [];
  }
}

/** Apaga os instantâneos do projeto `id` (salvamento no arquivo do usuário) e a pasta, se ficou vazia. */
export async function apagarInstantaneos(pastas: PastasRecuperacao, id: string, opcoes: OpcoesRecuperacao = {}): Promise<void> {
  if (!idValido(id)) return;
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const pasta = pastaInstantaneos(pastas, id);
  for (const nome of [NOME_INSTANTANEO, NOME_INSTANTANEO_ANTERIOR]) await fs.apagar(join(pasta, nome)).catch(ignorar);
  await fs.apagarPasta(pasta).catch(ignorar);
}

const carimbo = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\..*$/, '');

/**
 * Move os instantâneos do conjunto `id` para `recuperacao-antigos` (`<id>-<AAAAMMDD-HHMMSS>-atual.bdp`...), onde ficam
 * 7 dias. Usado quando o usuário descarta a versão recuperada ("Abrir o arquivo salvo", fechar sem salvar).
 */
export async function arquivarInstantaneos(pastas: PastasRecuperacao, id: string, agoraMs: number, opcoes: OpcoesRecuperacao = {}): Promise<void> {
  if (!idValido(id)) return;
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const pasta = pastaInstantaneos(pastas, id);
  for (const nome of [NOME_INSTANTANEO, NOME_INSTANTANEO_ANTERIOR]) {
    await arquivar(pastas, join(pasta, nome), `${id.replace('~', '-')}-${carimbo(agoraMs)}-${nome}`, agoraMs, fs);
  }
  await fs.apagarPasta(pasta).catch(ignorar);
}

/**
 * Reserva os instantâneos (e a trava) do projeto `id` como `<id>~<carimbo>`: o projeto volta a ser editado antes de o
 * usuário decidir a oferta da queda, e os instantâneos novos não podem substituí-los (revisão do M1-T12, A2).
 * `false` se não conseguiu (os instantâneos continuam no lugar e quem chamou não deve gravar por cima).
 */
export async function reservarInstantaneos(pastas: PastasRecuperacao, id: string, agoraMs: number, opcoes: OpcoesRecuperacao = {}): Promise<boolean> {
  if (!PADRAO_ID.test(id)) return false;
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  for (let ordem = 1; ordem <= 20; ordem++) {
    const nome = `${id}~${carimbo(agoraMs)}${ordem === 1 ? '' : `-${ordem}`}`;
    const destino = pastaInstantaneos(pastas, nome);
    try {
      await fs.info(destino);
      continue; // nome já usado
    } catch (e) {
      if (codigoErro(e) !== 'ENOENT') return false;
    }
    try {
      await fs.renomear(pastaInstantaneos(pastas, id), destino);
    } catch {
      return false;
    }
    await fs.renomear(arquivoTrava(pastas, id), arquivoTrava(pastas, nome)).catch(ignorar);
    return true;
  }
  return false;
}

/**
 * O conjunto `nome` passa a ser o do projeto (`recuperacao\<id>`): a versão recuperada vira a sessão ativa e continua
 * protegida até o próximo salvamento. Se já há um conjunto `<id>` (outra queda não decidida), ele é reservado antes.
 * `false` se não conseguiu (nada foi perdido; quem chamou não deve continuar).
 */
export async function promoverConjunto(pastas: PastasRecuperacao, nome: string, agoraMs: number, opcoes: OpcoesRecuperacao = {}): Promise<boolean> {
  if (!idValido(nome)) return false;
  const id = idDoConjunto(nome);
  if (nome === id) return true;
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const ocupado = await fs.info(pastaInstantaneos(pastas, id)).then(
    () => true,
    () => false,
  );
  if (ocupado && !(await reservarInstantaneos(pastas, id, agoraMs, opcoes))) return false;
  try {
    await fs.renomear(pastaInstantaneos(pastas, nome), pastaInstantaneos(pastas, id));
  } catch {
    return false;
  }
  await fs.renomear(arquivoTrava(pastas, nome), arquivoTrava(pastas, id)).catch(ignorar);
  return true;
}

/**
 * Move `caminho` para `recuperacao-antigos/<nome>` sem sobrescrever nada (`-2`, `-3`... se o nome existe). Entre
 * volumes diferentes (biblioteca em outro disco) copia e apaga. A data de modificação passa a ser a do arquivamento
 * (`agoraMs`): é dela que contam os 7 dias (revisão do M1-T12, A1; a cópia manteria a data da origem). Devolve o
 * caminho em `recuperacao-antigos`, ou `null` se o arquivo continua onde estava.
 */
export async function arquivar(
  pastas: PastasRecuperacao,
  caminho: string,
  nome: string,
  agoraMs: number,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
): Promise<string | null> {
  try {
    const info = await fs.info(caminho);
    if (!info.arquivoComum) return null;
    await fs.criarPasta(pastas.antigos);
  } catch {
    return null;
  }
  for (let ordem = 1; ordem <= 20; ordem++) {
    const destino = join(pastas.antigos, ordem === 1 ? nome : `${nome}-${ordem}`);
    try {
      // Copiar com exclusividade (falha se o destino existe) e só então apagar: o `rename` sobrescreveria um arquivo
      // de mesmo nome e não cruza volumes.
      await fs.copiar(caminho, destino);
    } catch (e) {
      if (codigoErro(e) === 'EEXIST') continue;
      return null;
    }
    try {
      await fs.definirModificacao(destino, agoraMs);
      await fs.apagar(caminho);
      return destino;
    } catch {
      await fs.apagar(destino).catch(ignorar);
      return null;
    }
  }
  return null;
}

/** Maior `ordem` aceita por `nomeConjuntoReservado` (o nome tem de continuar válido no `RE_RESERVADO`, R-M3-01). */
export const ORDEM_MAXIMA_RESERVADO = 99;

/**
 * Nome de conjunto reservado novo: instantâneos que não pertencem a uma sessão de arquivo (R-M2-04). `ordem` vai de 1 a
 * `ORDEM_MAXIMA_RESERVADO`; fora disso, `RangeError` (um nome inválido deixaria a cópia sem instantâneo, R-M3-01).
 */
export const nomeConjuntoReservado = (id: string, agoraMs: number, ordem: number): string => {
  if (!Number.isInteger(ordem) || ordem < 1 || ordem > ORDEM_MAXIMA_RESERVADO) throw new RangeError('ordem');
  return `${id}~${carimbo(agoraMs)}-c${ordem}`;
};

/**
 * Guarda uma cópia em `recuperacao-antigos`, sem tirar o original: o que está para ser substituído por escolha do usuário
 * continua à mão por 7 dias (R-M2-06). `null` se não copiou; nunca lança.
 */
export async function copiarParaAntigos(pastas: PastasRecuperacao, caminho: string, nome: string, agoraMs: number, fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE): Promise<string | null> {
  try {
    await fs.criarPasta(pastas.antigos);
  } catch {
    return null;
  }
  for (let ordem = 1; ordem <= 20; ordem++) {
    const destino = join(pastas.antigos, ordem === 1 ? nome : `${nome}-${ordem}`);
    try {
      await fs.copiar(caminho, destino);
    } catch (e) {
      if (codigoErro(e) === 'EEXIST') continue;
      return null;
    }
    await fs.definirModificacao(destino, agoraMs).catch(ignorar);
    return destino;
  }
  return null;
}

/** Apaga de `recuperacao-antigos` o que tem mais de 7 dias. */
export async function limparAntigos(pastas: PastasRecuperacao, agoraMs: number, opcoes: OpcoesRecuperacao = {}): Promise<void> {
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  let entradas;
  try {
    entradas = await fs.listarPasta(pastas.antigos);
  } catch {
    return;
  }
  for (const e of entradas) {
    if (!e.arquivoComum || e.link) continue;
    const caminho = join(pastas.antigos, e.nome);
    try {
      const info = await fs.info(caminho);
      if (agoraMs - info.modificadoEmMs > PRAZO_ANTIGOS_MS) await fs.apagar(caminho);
    } catch {
      // fica para a próxima
    }
  }
}

// ---------- restos de gravação na pasta da biblioteca ----------

/**
 * Idade mínima de um resto para ser tratado: um temporário mais novo pode ser de uma gravação em curso em outro
 * computador que sincroniza a mesma pasta (OneDrive; revisão do M1-T12, M4).
 */
export const IDADE_MINIMA_RESTO_MS = 10 * 60 * 1000;
/** Restos tratados por listagem (o resto fica para a próxima). */
export const MAX_RESTOS_POR_LISTAGEM = 100;

export interface RestosGravacao {
  /** `X.bdp.tmp-<pid>-<aleatório>` de outro processo, com o `X.bdp` correspondente. */
  temporarios: { caminho: string; original: string }[];
  /** `X.bdp.bak.tmp-*` de outro processo: cópia incompleta do original, pode ser apagada. */
  copiasBak: string[];
  /** `X.bdp.bak`, com o `X.bdp` correspondente. */
  baks: { caminho: string; original: string }[];
}

const RE_TEMPORARIO = /^(.+\.bdp)\.tmp-(\d+)-[0-9a-z]+$/i;
const RE_COPIA_BAK = /^(.+\.bdp)\.bak\.tmp-(\d+)-[0-9a-z]+$/i;
const RE_BAK = /^(.+\.bdp)\.bak$/i;

/**
 * Restos de gravação no primeiro nível de `pasta` (sem seguir links). `pidAtual`: os temporários deste processo ficam
 * de fora. Só entram restos com mais de `IDADE_MINIMA_RESTO_MS`, até `MAX_RESTOS_POR_LISTAGEM` no total.
 */
export async function procurarRestos(
  pasta: string,
  pidAtual: number,
  agoraMs: number,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
): Promise<RestosGravacao> {
  const restos: RestosGravacao = { temporarios: [], copiasBak: [], baks: [] };
  let entradas;
  try {
    entradas = await fs.listarPasta(pasta);
  } catch {
    return restos;
  }
  let total = 0;
  for (const e of entradas) {
    if (!e.arquivoComum || e.link || total >= MAX_RESTOS_POR_LISTAGEM) continue;
    if (!RE_COPIA_BAK.test(e.nome) && !RE_TEMPORARIO.test(e.nome) && !RE_BAK.test(e.nome)) continue;
    const caminho = join(pasta, e.nome);
    try {
      if (agoraMs - (await fs.info(caminho)).modificadoEmMs < IDADE_MINIMA_RESTO_MS) continue;
    } catch {
      continue;
    }
    total += 1;
    let m = RE_COPIA_BAK.exec(e.nome);
    if (m) {
      if (Number(m[2]) !== pidAtual) restos.copiasBak.push(caminho);
      continue;
    }
    m = RE_TEMPORARIO.exec(e.nome);
    if (m) {
      if (Number(m[2]) !== pidAtual) restos.temporarios.push({ caminho, original: join(pasta, m[1]!) });
      continue;
    }
    m = RE_BAK.exec(e.nome);
    if (m) restos.baks.push({ caminho, original: join(pasta, m[1]!) });
  }
  return restos;
}
