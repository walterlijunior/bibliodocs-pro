/**
 * Conferência comum a todos os manipuladores IPC (C-11): remetente permitido e quantidade exata de argumentos, antes
 * de qualquer diálogo ou acesso ao disco. Falha rejeita a promessa com `ErroIpcRecusado`, de mensagem genérica; o
 * motivo vai só para o registro técnico.
 */
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { remetentePermitido, type InfoRemetente } from './remetente';

export class ErroIpcRecusado extends Error {
  constructor() {
    super('chamada recusada');
    this.name = 'ErroIpcRecusado';
  }
}

export type Manipulador = (remetente: InfoRemetente, argumentos: readonly unknown[]) => Promise<unknown>;

/**
 * Última barreira antes do `ipcMain.handle` (revisão do M1-T09, M1): exceção inesperada de um manipulador (defeito,
 * erro de disco não previsto) volta ao renderer como `ErroIpcRecusado`, de mensagem genérica. O Electron repassa
 * `error.message`, e mensagens do Node trazem o caminho do disco (`ENOENT ... lstat 'C:\…'`); o detalhe fica no log.
 */
export function blindar(canal: string, manipulador: Manipulador, log: (mensagem: string) => void): Manipulador {
  return async (remetente, argumentos) => {
    try {
      return await manipulador(remetente, argumentos);
    } catch (e) {
      if (!(e instanceof ErroIpcRecusado)) log(`[ipc] ${canal} falhou sem tratamento: ${e instanceof Error ? e.message : String(e)}`);
      throw e instanceof ErroIpcRecusado ? e : new ErroIpcRecusado();
    }
  };
}

export interface Conferencia {
  /** Passos 1 e 2: remetente e quantidade de argumentos. */
  conferir(canal: string, r: InfoRemetente, argumentos: readonly unknown[], quantidade: number): void;
  /** Argumento fora do contrato: registra e rejeita. */
  recusarArgumento(canal: string, qual: string): never;
}

export function criarConferencia(
  origem: OrigemPermitida,
  conteudosPermitidos: () => ReadonlySet<number>,
  log: (mensagem: string) => void,
): Conferencia {
  return {
    conferir(canal, r, argumentos, quantidade) {
      if (!remetentePermitido(r, origem, conteudosPermitidos())) {
        log(`[ipc] ${canal} recusado: remetente não permitido (conteúdo ${r.idConteudo})`);
        throw new ErroIpcRecusado();
      }
      if (argumentos.length !== quantidade) {
        log(`[ipc] ${canal} recusado: ${argumentos.length} argumento(s), esperado ${quantidade}`);
        throw new ErroIpcRecusado();
      }
    },
    recusarArgumento(canal, qual) {
      log(`[ipc] ${canal} recusado: ${qual} fora do contrato`);
      throw new ErroIpcRecusado();
    },
  };
}
