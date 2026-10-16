/**
 * Projeto no disco: empacotar + salvamento atômico, e abertura com limite de tamanho conferido antes de ler
 * (pendência do M1-T05 para o M1-T06).
 */
import type { ErroValidacao } from '../../dominio/esquemas';
import { LIMITES_CONTEINER, type LimitesConteiner } from '../conteiner/limites';
import { empacotarProjeto, lerProjeto, type PacoteProjeto, type ResultadoLeituraProjeto } from '../conteiner/pacote';
import { gravarAtomico, MENSAGENS_FALHA, type OpcoesGravacao, type ResultadoGravacao } from './gravacao-atomica';
import { codigoErro, SISTEMA_ARQUIVOS_NODE, type ArquivoAberto, type SistemaArquivos } from './sistema-arquivos';

/** Resultado do salvamento; em `PACOTE_INVALIDO` traz os erros de validação para o visor detalhar. */
export type ResultadoSalvamento = ResultadoGravacao | (Extract<ResultadoGravacao, { ok: false }> & { erros: ErroValidacao[] });

/**
 * Empacota e grava. Se o pacote é recusado, nada é gravado e o documento em memória não é tocado: quem chamou
 * mostra a mensagem e continua com o documento aberto.
 */
export async function salvarProjeto(
  destino: string,
  pacote: PacoteProjeto,
  opcoes: OpcoesGravacao & { limites?: LimitesConteiner } = {},
): Promise<ResultadoSalvamento> {
  const inicio = performance.now();
  const r = empacotarProjeto(pacote, opcoes.limites);
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

const erroArquivo = (mensagem: string): ResultadoLeituraProjeto => ({ ok: false, erros: [{ caminho: 'arquivo', mensagem }] });

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

/**
 * Lê e valida um `.bdp` do disco. O tamanho é conferido pelo caminho e de novo pelo descritor aberto, e a leitura
 * para no tamanho conferido: um arquivo que cresce durante a leitura é recusado, nunca lido além do limite.
 * Nunca lança.
 */
export async function abrirProjeto(
  caminho: string,
  opcoes: { fs?: SistemaArquivos; limites?: LimitesConteiner } = {},
): Promise<ResultadoLeituraProjeto> {
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const limites = opcoes.limites ?? LIMITES_CONTEINER;
  const grandeDemais = 'o arquivo é maior que o limite aceito para um projeto';
  let arquivo: ArquivoAberto | null = null;
  try {
    const info = await fs.info(caminho);
    if (!info.arquivoComum) return erroArquivo('o caminho não é um arquivo comum');
    if (info.bytes > limites.bytesArquivo) return erroArquivo(grandeDemais);

    arquivo = await fs.abrirLeitura(caminho);
    // O caminho pode ter virado link ou pasta entre a conferência e a abertura (revisão M6-07).
    if (!(await arquivo.arquivoComum())) return erroArquivo('o caminho não é um arquivo comum');
    const tamanho = await arquivo.tamanho();
    if (tamanho > limites.bytesArquivo) return erroArquivo(grandeDemais);
    const bytes = new Uint8Array(tamanho);
    let lidos = 0;
    while (lidos < tamanho) {
      const n = await arquivo.ler(bytes, lidos, tamanho - lidos, lidos);
      if (n === 0) return erroArquivo('o arquivo mudou durante a leitura');
      lidos += n;
    }
    if ((await arquivo.ler(new Uint8Array(1), 0, 1, tamanho)) !== 0) return erroArquivo('o arquivo mudou durante a leitura');
    return lerProjeto(bytes, limites);
  } catch (e) {
    return erroArquivo(mensagemAbertura(e));
  } finally {
    if (arquivo) await arquivo.fechar().catch(() => undefined);
  }
}
