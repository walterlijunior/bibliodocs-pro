/**
 * Varredura da pasta da biblioteca (M1-T09): lista os `.bdp` (só arquivos comuns do primeiro nível, sem seguir links),
 * reaproveita o resumo do índice quando o tamanho e a data de modificação não mudaram e pede o resumo dos demais.
 *
 * Temporários (`*.bdp.tmp-*`) e `.bak` ficam de fora pela extensão; a recuperação deles é do M1-T12.
 */
import { join } from 'node:path';
import { SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../arquivo/sistema-arquivos';
import { FORMATO_INDICE, LIMITE_ITENS_BIBLIOTECA, type EntradaIndice, type IndiceBiblioteca, type ResumoProjeto } from './indice';
import { ehArquivoProjeto } from './nomes';

/** Arquivos por pedido ao processo leitor: o tempo máximo do leitor vale por lote. */
export const ARQUIVOS_POR_LOTE = 50;

/**
 * Resume os caminhos, na mesma ordem. `null` quando o pedido inteiro falhou (o leitor caiu ou demorou); a varredura
 * então refaz o lote um arquivo por vez.
 */
export type Resumir = (caminhos: string[]) => Promise<ResumoProjeto[] | null>;

export interface ResultadoVarredura {
  /** Arquivos para mostrar, em ordem de nome. */
  entradas: EntradaIndice[];
  /** Índice novo (sem os arquivos cujo resumo falhou). */
  indice: IndiceBiblioteca;
  /** O índice novo difere do anterior (vale gravar). */
  alterado: boolean;
  avisos: string[];
}

const ordemNome = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true }).compare;

/**
 * Prazo total de uma varredura (revisão do M1-T09, M2): passado o prazo, o que falta resumir aparece como inválido,
 * com aviso, e fica para a próxima listagem (o que já foi lido entra no índice). Cobre um arquivo que esgota o tempo
 * do leitor duas vezes (lote e sozinho: 2 × 60 s) com folga.
 */
export const PRAZO_VARREDURA_MS = 180_000;

export interface OpcoesVarredura {
  prazoMs?: number;
  /** Relógio monotônico em ms (injetável nos testes). */
  agora?: () => number;
}

/** Lança se a pasta não puder ser listada (quem chamou responde "pasta inacessível"). */
export async function varrerPasta(
  pasta: string,
  anterior: IndiceBiblioteca,
  resumir: Resumir,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
  opcoes: OpcoesVarredura = {},
): Promise<ResultadoVarredura> {
  const avisos: string[] = [];
  let nomes = (await fs.listarPasta(pasta))
    .filter((e) => e.arquivoComum && !e.link && ehArquivoProjeto(e.nome))
    .map((e) => e.nome)
    .sort(ordemNome);
  if (nomes.length > LIMITE_ITENS_BIBLIOTECA) {
    avisos.push(`A pasta tem ${nomes.length} trabalhos; só os ${LIMITE_ITENS_BIBLIOTECA} primeiros (por nome) aparecem na lista.`);
    nomes = nomes.slice(0, LIMITE_ITENS_BIBLIOTECA);
  }

  const cache = new Map(anterior.entradas.map((e) => [e.nomeArquivo, e]));
  const entradas: EntradaIndice[] = [];
  const pendentes: EntradaIndice[] = [];
  for (const nomeArquivo of nomes) {
    let info;
    try {
      info = await fs.info(join(pasta, nomeArquivo));
    } catch {
      continue; // Sumiu entre listar e conferir.
    }
    if (!info.arquivoComum) continue;
    const guardada = cache.get(nomeArquivo);
    if (guardada && guardada.bytes === info.bytes && guardada.modificadoEmMs === info.modificadoEmMs) {
      entradas.push(guardada);
    } else {
      const nova: EntradaIndice = { nomeArquivo, bytes: info.bytes, modificadoEmMs: info.modificadoEmMs, resumo: { estado: 'invalido' } };
      entradas.push(nova);
      pendentes.push(nova);
    }
  }

  const agora = opcoes.agora ?? (() => performance.now());
  const inicio = agora();
  const noPrazo = () => agora() - inicio < (opcoes.prazoMs ?? PRAZO_VARREDURA_MS);
  const caminho = (e: EntradaIndice) => join(pasta, e.nomeArquivo);
  /** Sem resumo agora (leitor falhou ou prazo acabou): aparecem como inválidos e não entram no índice. */
  const falharam = new Set<EntradaIndice>();
  const atrasados = new Set<EntradaIndice>();

  for (let i = 0; i < pendentes.length; i += ARQUIVOS_POR_LOTE) {
    const lote = pendentes.slice(i, i + ARQUIVOS_POR_LOTE);
    if (!noPrazo()) {
      lote.forEach((e) => atrasados.add(e));
      continue;
    }
    const resumos = await resumir(lote.map(caminho));
    if (resumos) {
      lote.forEach((e, j) => (e.resumo = resumos[j]!));
      continue;
    }
    // Lote perdido (revisão do M1-T09, M3): refaz um por um, para que um arquivo que derruba o leitor não leve os
    // outros junto. Se só alguns falham, eles ficam no índice como inválidos (não são tentados de novo até mudarem);
    // se todos falham, o problema é o leitor, e nada entra no índice.
    const sozinhos: EntradaIndice[] = [];
    for (const e of lote) {
      if (!noPrazo()) {
        atrasados.add(e);
        continue;
      }
      const r = (await resumir([caminho(e)]))?.[0];
      if (r) e.resumo = r;
      else sozinhos.push(e);
    }
    const algumLido = lote.some((e) => !atrasados.has(e) && !sozinhos.includes(e));
    if (!algumLido) sozinhos.forEach((e) => falharam.add(e));
  }
  if (falharam.size > 0) avisos.push(`Não foi possível ler ${falharam.size} trabalho(s) agora; a lista tenta de novo na próxima vez.`);
  if (atrasados.size > 0) {
    avisos.push(`A lista está incompleta: ${atrasados.size} trabalho(s) ainda não foram lidos. Atualize a lista para continuar.`);
    atrasados.forEach((e) => falharam.add(e));
  }

  const indice: IndiceBiblioteca = { formato: FORMATO_INDICE, versao: 1, pasta, entradas: entradas.filter((e) => !falharam.has(e)) };
  return { entradas, indice, alterado: JSON.stringify(indice) !== JSON.stringify(anterior), avisos };
}
