/**
 * Projeto no disco: empacotar + salvamento atômico, e abertura com limite de tamanho conferido antes de ler
 * (pendência do M1-T05 para o M1-T06). Abrir um projeto de formato antigo exige o backup do arquivo original antes
 * de entregar a versão migrada (ADR-0004, seções 2 e 4; M1-T07).
 */
import { join } from 'node:path';
import type { ErroValidacao, Migracao } from '../../dominio/esquemas';
import { LIMITES_CONTEINER, type LimitesConteiner } from '../conteiner/limites';
import { empacotarProjeto, lerProjeto, type PacoteProjeto, type ResultadoEmpacotamento, type ResultadoLeituraProjeto } from '../conteiner/pacote';
import { gravarAtomico, MENSAGENS_FALHA, type OpcoesGravacao, type ResultadoGravacao } from './gravacao-atomica';
import { codigoErro, SISTEMA_ARQUIVOS_NODE, type ArquivoAberto, type SistemaArquivos } from './sistema-arquivos';

/** Resultado do salvamento; em `PACOTE_INVALIDO` traz os erros de validação para o visor detalhar. */
export type ResultadoSalvamento = ResultadoGravacao | (Extract<ResultadoGravacao, { ok: false }> & { erros: ErroValidacao[] });

/** Empacotamento usado no salvamento; o principal passa o do worker (M2-T01), para não travar a própria thread. */
export type Empacotar = (pacote: PacoteProjeto) => ResultadoEmpacotamento | Promise<ResultadoEmpacotamento>;

/**
 * Empacota e grava. Se o pacote é recusado, nada é gravado e o documento em memória não é tocado: quem chamou
 * mostra a mensagem e continua com o documento aberto.
 */
export async function salvarProjeto(
  destino: string,
  pacote: PacoteProjeto,
  opcoes: OpcoesGravacao & { limites?: LimitesConteiner; empacotar?: Empacotar } = {},
): Promise<ResultadoSalvamento> {
  const inicio = performance.now();
  const r = opcoes.empacotar ? await opcoes.empacotar(pacote) : empacotarProjeto(pacote, opcoes.limites);
  if (!r.ok) {
    return {
      ok: false,
      codigo: 'PACOTE_INVALIDO',
      mensagem: MENSAGENS_FALHA.PACOTE_INVALIDO,
      temporario: null,
      duracaoMs: performance.now() - inicio,
      erros: r.erros,
    };
  }
  return gravarAtomico(destino, r.bytes, opcoes);
}

export interface OpcoesAbertura {
  fs?: SistemaArquivos;
  limites?: LimitesConteiner;
  migracoes?: readonly Migracao[];
  /**
   * Pasta dos backups (`%LOCALAPPDATA%\BiblioDocsPro\backups`). Sem ela, um projeto que precise de migração não
   * abre: o backup antes de migrar é obrigatório.
   */
  pastaBackups?: string;
  agora?: () => Date;
  /** Opções do `gravarAtomico` do backup (esperas e sufixo aleatório, nos testes). */
  gravacao?: Omit<OpcoesGravacao, 'fs'>;
}

export type ResultadoAbertura =
  | (Extract<ResultadoLeituraProjeto, { ok: true }> & {
      /** Cópia do arquivo original gravada antes da migração; `null` se o arquivo já estava na versão atual. */
      backupMigracao: string | null;
    })
  | Extract<ResultadoLeituraProjeto, { ok: false }>;

const erroArquivo = (mensagem: string): Extract<ResultadoLeituraProjeto, { ok: false }> => ({ ok: false, erros: [{ caminho: 'arquivo', mensagem }] });

const MENSAGEM_SEM_BACKUP =
  'não foi possível guardar a cópia de segurança exigida antes de atualizar o formato do projeto; o arquivo não foi alterado';

const doisDigitos = (n: number, tamanho = 2) => String(n).padStart(tamanho, '0');

/**
 * `AAAAMMDD-HHMMSS-mmm-formato-v<N>.bdp`, na hora local (o nome é lido pelo usuário); `-2`, `-3`... antes de `.bdp`
 * quando o nome já existe.
 */
export function nomeBackupMigracao(quando: Date, versaoOrigem: number, ordem = 1): string {
  const d = quando;
  const data = `${d.getFullYear()}${doisDigitos(d.getMonth() + 1)}${doisDigitos(d.getDate())}`;
  const hora = `${doisDigitos(d.getHours())}${doisDigitos(d.getMinutes())}${doisDigitos(d.getSeconds())}-${doisDigitos(d.getMilliseconds(), 3)}`;
  return `${data}-${hora}-formato-v${versaoOrigem}${ordem > 1 ? `-${ordem}` : ''}.bdp`;
}

/** Tentativas de nome livre para o backup (mesmo id aberto no mesmo milissegundo, relógio que volta). */
const NOMES_BACKUP_TENTADOS = 20;

/**
 * Grava os bytes originais em `<pastaBackups>/<id>/` com `gravarAtomico` (cópia nova, não o `.bak`, que o próximo
 * salvamento substitui). O id vem do manifesto já validado (`PADRAO_ID`), então serve de nome de pasta.
 * Nunca substitui um backup existente: procura um nome livre antes (revisão do M1-T07, B1).
 */
async function gravarBackupMigracao(
  bytes: Uint8Array,
  id: string,
  versaoOrigem: number,
  fs: SistemaArquivos,
  opcoes: OpcoesAbertura,
): Promise<string | null> {
  if (!opcoes.pastaBackups) return null;
  const pasta = join(opcoes.pastaBackups, id);
  try {
    await fs.criarPasta(pasta);
  } catch {
    return null;
  }
  const quando = (opcoes.agora ?? (() => new Date()))();
  let destino: string | null = null;
  for (let ordem = 1; ordem <= NOMES_BACKUP_TENTADOS && !destino; ordem++) {
    const candidato = join(pasta, nomeBackupMigracao(quando, versaoOrigem, ordem));
    try {
      await fs.info(candidato);
    } catch (e) {
      if (codigoErro(e) !== 'ENOENT') return null;
      destino = candidato;
    }
  }
  if (!destino) return null;
  const r = await gravarAtomico(destino, bytes, { ...opcoes.gravacao, fs });
  if (r.ok) return r.caminho;
  // O temporário deixado serve à recuperação de um salvamento; aqui o original está intacto, então é só lixo.
  if (r.temporario) await fs.apagar(r.temporario).catch(() => undefined);
  return null;
}

function mensagemAbertura(erro: unknown): string {
  switch (codigoErro(erro)) {
    case 'ENOENT':
      return 'o arquivo não foi encontrado';
    case 'EPERM':
    case 'EACCES':
      return 'sem permissão para ler o arquivo';
    case 'EBUSY':
      return 'o arquivo está bloqueado por outro programa';
    default:
      return 'não foi possível ler o arquivo';
  }
}

/** Bytes de um arquivo lido com o limite de tamanho, ou a mensagem pt-BR do motivo de não ter lido. */
export type ResultadoLeituraArquivo =
  | { ok: true; bytes: Uint8Array }
  /** `codigo`: código do sistema (`ENOENT`...), quando a falha veio do disco. */
  | { ok: false; mensagem: string; codigo?: string };

/**
 * Lê um arquivo inteiro sem passar do limite. O tamanho é conferido pelo caminho e de novo pelo descritor aberto, e a
 * leitura para no tamanho conferido: um arquivo que cresce durante a leitura é recusado, nunca lido além do limite.
 * Nunca lança. Usada pela abertura e pelo resumo da biblioteca (M1-T09).
 */
export async function lerArquivoLimitado(
  caminho: string,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
  limites: LimitesConteiner = LIMITES_CONTEINER,
): Promise<ResultadoLeituraArquivo> {
  const falha = (mensagem: string): ResultadoLeituraArquivo => ({ ok: false, mensagem });
  const grandeDemais = 'o arquivo é maior que o limite aceito para um projeto';
  let arquivo: ArquivoAberto | null = null;
  try {
    const info = await fs.info(caminho);
    if (!info.arquivoComum) return falha('o caminho não é um arquivo comum');
    if (info.bytes > limites.bytesArquivo) return falha(grandeDemais);

    arquivo = await fs.abrirLeitura(caminho);
    // O caminho pode ter virado link ou pasta entre a conferência e a abertura (revisão M6-07).
    if (!(await arquivo.arquivoComum())) return falha('o caminho não é um arquivo comum');
    // O caminho conferido e o descritor aberto precisam ser o mesmo arquivo (link trocado no meio; revisão do M1-T09, B6).
    if ((await arquivo.identidade()) !== info.identidade) return falha('o arquivo mudou durante a leitura');
    const tamanho = await arquivo.tamanho();
    if (tamanho > limites.bytesArquivo) return falha(grandeDemais);
    const bytes = new Uint8Array(tamanho);
    let lidos = 0;
    while (lidos < tamanho) {
      const n = await arquivo.ler(bytes, lidos, tamanho - lidos, lidos);
      if (n === 0) return falha('o arquivo mudou durante a leitura');
      lidos += n;
    }
    if ((await arquivo.ler(new Uint8Array(1), 0, 1, tamanho)) !== 0) return falha('o arquivo mudou durante a leitura');
    return { ok: true, bytes };
  } catch (e) {
    const codigo = codigoErro(e);
    return codigo ? { ok: false, mensagem: mensagemAbertura(e), codigo } : falha(mensagemAbertura(e));
  } finally {
    if (arquivo) await arquivo.fechar().catch(() => undefined);
  }
}

/** Lê e valida um `.bdp` do disco (leitura por `lerArquivoLimitado`). Nunca lança. */
export async function abrirProjeto(caminho: string, opcoes: OpcoesAbertura = {}): Promise<ResultadoAbertura> {
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const lido = await lerArquivoLimitado(caminho, fs, opcoes.limites);
  if (!lido.ok) return erroArquivo(lido.mensagem);
  const bytes = lido.bytes;
  try {
    const r = lerProjeto(bytes, opcoes.limites ?? LIMITES_CONTEINER, opcoes.migracoes);
    if (!r.ok) return r;
    if (r.migracao.length === 0) return { ...r, backupMigracao: null };
    const backup = await gravarBackupMigracao(bytes, r.pacote.manifesto.id, r.migracao[0]!, fs, opcoes);
    return backup ? { ...r, backupMigracao: backup } : erroArquivo(MENSAGEM_SEM_BACKUP);
  } catch (e) {
    return erroArquivo(mensagemAbertura(e));
  }
}
