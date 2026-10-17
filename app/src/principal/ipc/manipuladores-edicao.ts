/**
 * Manipulador do canal `edicao` (M2-T06; porta em `aplicacao/portas/edicao.ts`): confere o remetente e a ação (C-11) e
 * pede o comando ao `webContents` de quem chamou. Puro: o Electron entra por `executar`.
 */
import { ACOES_EDICAO, CANAIS_EDICAO, type AcaoEdicao } from '../../aplicacao/portas/edicao';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { criarConferencia, type Manipulador } from './chamada';

export interface DependenciasEdicao {
  origem: OrigemPermitida;
  conteudosPermitidos: () => ReadonlySet<number>;
  /** Comando no `webContents` de id `idConteudo`. */
  executar: (idConteudo: number, acao: AcaoEdicao) => void;
  log?: (mensagem: string) => void;
}

const ehAcao = (v: unknown): v is AcaoEdicao => typeof v === 'string' && (ACOES_EDICAO as readonly string[]).includes(v);

export function criarManipuladoresEdicao(dep: DependenciasEdicao): Record<string, Manipulador> {
  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, dep.log ?? ((m) => console.warn(m)));
  const executar: Manipulador = async (r, argumentos) => {
    const canal = CANAIS_EDICAO.executar;
    conferir(canal, r, argumentos, 1);
    const acao = argumentos[0];
    if (!ehAcao(acao)) return recusarArgumento(canal, 'ação');
    dep.executar(r.idConteudo, acao);
    return undefined;
  };
  return { [CANAIS_EDICAO.executar]: executar };
}
