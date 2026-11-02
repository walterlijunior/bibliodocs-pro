/**
 * Backups rotativos (M2-T10; ADR-0004, seção 4; R-M1-03): antes de gravar por cima do arquivo do usuário, a versão
 * anterior é copiada para `<pastaBackups>/<id>/AAAAMMDD-HHMMSS.bdp`, no máximo uma vez a cada 10 minutos. Ficam os 10
 * mais recentes e o mais recente de cada um dos últimos 7 dias.
 *
 * - Falha aqui nunca impede de salvar: o resultado diz o que houve, e nada lança exceção.
 * - A rotação só apaga o que tem exatamente o nome acima. Os `*-formato-v<N>.bdp` (backup antes de migrar, M1-T07) e
 *   qualquer outro arquivo da pasta ficam.
 * - A cópia passa por um temporário, para um nome definitivo nunca apontar para um arquivo pela metade.
 */
import { join } from 'node:path';
import { PADRAO_ID } from '../../dominio/esquemas';
import { codigoErro, SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from './sistema-arquivos';

export const INTERVALO_BACKUP_MS = 10 * 60 * 1000;
export const BACKUPS_RECENTES = 10;
export const DIAS_COM_BACKUP = 7;

const NOME = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.bdp$/;
const SUFIXO_TEMPORARIO = '.tmp';

const dois = (n: number) => String(n).padStart(2, '0');
const chaveDoDia = (d: Date) => `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}`;

/** Hora local: o nome é lido pelo usuário. */
export function nomeBackupRotativo(d: Date): string {
  return `${chaveDoDia(d)}-${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())}.bdp`;
}

/** Quando o backup foi feito, ou `null` se o nome não é de backup rotativo. */
export function dataDoBackup(nome: string): Date | null {
  const m = NOME.exec(nome);
  if (!m) return null;
  const [ano, mes, dia, hora, minuto, segundo] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const d = new Date(ano, mes - 1, dia, hora, minuto, segundo);
  // `new Date` aceita 31/02 e vira março: esse nome não foi gerado aqui.
  return nomeBackupRotativo(d) === nome ? d : null;
}

/** Dos nomes da pasta, os backups rotativos que saem. Puro; datas no futuro (relógio mudado) contam como recentes. */
export function backupsParaApagar(nomes: readonly string[], agora: Date): string[] {
  const backups = nomes
    .map((nome) => ({ nome, data: dataDoBackup(nome) }))
    .filter((b): b is { nome: string; data: Date } => b.data !== null)
    .sort((a, b) => b.data.getTime() - a.data.getTime());
  const diasValidos = new Set<string>();
  for (let i = 0; i < DIAS_COM_BACKUP; i++) {
    diasValidos.add(chaveDoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i)));
  }
  const diasVistos = new Set<string>();
  return backups
    .filter((b, i) => {
      const dia = chaveDoDia(b.data);
      const primeiroDoDia = diasValidos.has(dia) && !diasVistos.has(dia);
      if (primeiroDoDia) diasVistos.add(dia);
      return i >= BACKUPS_RECENTES && !primeiroDoDia;
    })
    .map((b) => b.nome);
}

export type ResultadoBackup =
  | { feito: true; nome: string; avisos: string[] }
  /** `SEM_ARQUIVO`: não há versão anterior. `INTERVALO`: o último tem menos de 10 minutos. */
  | { feito: false; motivo: 'SEM_ARQUIVO' | 'INTERVALO' | 'ID_INVALIDO' }
  /** `codigo` é só para o registro técnico (sem caminho). */
  | { feito: false; motivo: 'FALHOU'; codigo: string };

export async function fazerBackupRotativo(
  origem: string,
  pastaBackups: string,
  idProjeto: string,
  opcoes: { fs?: SistemaArquivos; agora?: () => Date } = {},
): Promise<ResultadoBackup> {
  const fs = opcoes.fs ?? SISTEMA_ARQUIVOS_NODE;
  const agora = (opcoes.agora ?? (() => new Date()))();
  // O id vira nome de pasta: nunca sai de `pastaBackups`.
  if (!PADRAO_ID.test(idProjeto)) return { feito: false, motivo: 'ID_INVALIDO' };
  const pasta = join(pastaBackups, idProjeto);
  let temporario: string | null = null;
  try {
    try {
      if (!(await fs.info(origem)).arquivoComum) return { feito: false, motivo: 'SEM_ARQUIVO' };
    } catch (e) {
      if (codigoErro(e) === 'ENOENT') return { feito: false, motivo: 'SEM_ARQUIVO' };
      throw e;
    }
    await fs.criarPasta(pasta);
    const nomes = (await fs.listarPasta(pasta)).filter((e) => e.arquivoComum).map((e) => e.nome);
    // Resto de uma queda anterior: cópia completa do texto que nada mais apagaria (R-M2-07).
    for (const n of nomes) if (n.endsWith(SUFIXO_TEMPORARIO)) await fs.apagar(join(pasta, n)).catch(() => undefined);
    const nome = nomeBackupRotativo(agora);
    const recente = nomes.some((n) => {
      const quando = dataDoBackup(n)?.getTime();
      return quando !== undefined && quando <= agora.getTime() && agora.getTime() - quando < INTERVALO_BACKUP_MS;
    });
    if (recente) return { feito: false, motivo: 'INTERVALO' };

    temporario = join(pasta, nome + SUFIXO_TEMPORARIO);
    await fs.copiar(origem, temporario);
    // A cópia herda o somente leitura, que impediria a rotação de apagá-la depois.
    await fs.tornarGravavel(temporario);
    await fs.sincronizar(temporario);
    await fs.renomear(temporario, join(pasta, nome));
    temporario = null;

    const avisos: string[] = [];
    for (const velho of backupsParaApagar([...nomes, nome], agora)) {
      await fs.apagar(join(pasta, velho)).catch((e: unknown) => void avisos.push(codigoErro(e) ?? 'erro'));
    }
    return { feito: true, nome, avisos };
  } catch (e) {
    if (temporario !== null) await fs.apagar(temporario).catch(() => undefined);
    return { feito: false, motivo: 'FALHOU', codigo: codigoErro(e) ?? 'erro' };
  }
}
