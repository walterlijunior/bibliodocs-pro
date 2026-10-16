/**
 * Manipuladores da API `projetos` (M1-T08; ADR-0005, seção 3; C-11, C-12). Não importam o Electron: diálogos, leitura
 * e gravação entram por dependências, e os testes chamam os manipuladores direto (tests/ipc-projetos.test.ts).
 *
 * Toda chamada passa, nesta ordem, por:
 * 1. remetente permitido (janela do app, quadro principal, origem da interface);
 * 2. quantidade e forma exatas dos argumentos;
 * só então o diálogo, a leitura ou a gravação. Falhar em 1 ou 2 rejeita a promessa com `ErroIpcRecusado`, de
 * mensagem genérica; erros esperados (cancelado, arquivo em uso, inválido) voltam como resultado `ok: false`.
 */
import { basename, extname } from 'node:path';
import {
  CANAIS_PROJETOS,
  type CanalProjetos,
  type ResultadoAbrir,
  type ResultadoSalvar,
  type ResultadoSalvarComo,
} from '../../aplicacao';
import { LIMITES_V1, type ErroValidacao } from '../../dominio/esquemas';
import { textoPlano } from '../../dominio/modelo';
import { MENSAGENS_FALHA, type PacoteProjeto, type ResultadoSalvamento } from '../../persistencia';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { lerIdentificador, lerPacoteTransferivel } from './argumentos';
import type { RespostaLeitor } from './protocolo-leitor';
import { RegistroProjetos } from './registro-projetos';
import { remetentePermitido, type InfoRemetente } from './remetente';

export const EXTENSAO_PROJETO = '.bdp';

export interface DependenciasProjetos {
  origem: OrigemPermitida;
  /** Ids dos `webContents` das janelas do app (hoje, só a principal). */
  conteudosPermitidos: () => ReadonlySet<number>;
  /** Diálogo "Abrir" do principal; `null` se cancelado. */
  escolherArquivoParaAbrir: (idConteudo: number) => Promise<string | null>;
  /** Diálogo "Salvar como" do principal; `null` se cancelado. */
  escolherDestino: (idConteudo: number, nomeSugerido: string) => Promise<string | null>;
  /** Leitura isolada (processo leitor). */
  ler: (caminho: string) => Promise<RespostaLeitor>;
  salvar: (destino: string, pacote: PacoteProjeto) => Promise<ResultadoSalvamento>;
  registro?: RegistroProjetos;
  /** Registro técnico (nunca vai ao renderer). */
  log?: (mensagem: string) => void;
}

export class ErroIpcRecusado extends Error {
  constructor() {
    super('chamada recusada');
    this.name = 'ErroIpcRecusado';
  }
}

export type Manipulador = (remetente: InfoRemetente, argumentos: readonly unknown[]) => Promise<unknown>;

/** Caracteres que o Windows não aceita em nome de arquivo, e controles. */
const PROIBIDOS_NOME = /[<>:"/\\|?*\u0000-\u001F]/gu;
const NOMES_RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const NOME_PADRAO = 'Trabalho';
const MAX_NOME = 80;

/** Nome sugerido no "Salvar como": o título do trabalho, limpo para o Windows, com `.bdp`. */
export function nomeSugerido(pacote: PacoteProjeto): string {
  let nome = textoPlano(pacote.documento.metadados.titulo).replace(PROIBIDOS_NOME, ' ').replace(/\s+/gu, ' ').trim();
  nome = [...nome].slice(0, MAX_NOME).join('').replace(/[ .]+$/u, '');
  if (nome === '' || NOMES_RESERVADOS.test(nome)) nome = NOME_PADRAO;
  return `${nome}${EXTENSAO_PROJETO}`;
}

const MENSAGEM_EXTENSAO = 'Não foi possível salvar: o nome do arquivo precisa terminar em .bdp.';
const MENSAGEM_NAO_ABERTO = 'Não foi possível salvar: este trabalho não está mais aberto. Use “Salvar como…”.';

/** A lista de erros que volta ao renderer tem limite (revisão do M1-T08, S8-06). */
const limitarErros = <T>(erros: readonly T[]): T[] => erros.slice(0, LIMITES_V1.errosRelatados);

const erroPacote = (erros: ErroValidacao[]) =>
  ({ ok: false, motivo: 'ERRO', codigo: 'PACOTE_INVALIDO', mensagem: MENSAGENS_FALHA.PACOTE_INVALIDO, erros: limitarErros(erros) }) as const;

const ehProjeto = (caminho: string) => extname(caminho).toLowerCase() === EXTENSAO_PROJETO;

function paraResultadoSalvar(r: ResultadoSalvamento, log: (m: string) => void): ResultadoSalvar {
  if (r.ok) return { ok: true, nomeArquivo: basename(r.caminho), avisos: r.avisos };
  log(`[ipc] salvamento falhou: ${r.codigo}${r.detalhe ? ` (${r.detalhe})` : ''}`);
  return { ok: false, motivo: 'ERRO', codigo: r.codigo, mensagem: r.mensagem, erros: 'erros' in r ? limitarErros(r.erros) : [] };
}

export function criarManipuladoresProjetos(dep: DependenciasProjetos): {
  manipuladores: Readonly<Record<CanalProjetos, Manipulador>>;
  registro: RegistroProjetos;
} {
  const registro = dep.registro ?? new RegistroProjetos();
  const log = dep.log ?? ((m: string) => console.warn(m));

  /** Passos 1 e 2: remetente e quantidade de argumentos. */
  const conferir = (canal: CanalProjetos, r: InfoRemetente, argumentos: readonly unknown[], quantidade: number): void => {
    if (!remetentePermitido(r, dep.origem, dep.conteudosPermitidos())) {
      log(`[ipc] ${canal} recusado: remetente não permitido (conteúdo ${r.idConteudo})`);
      throw new ErroIpcRecusado();
    }
    if (argumentos.length !== quantidade) {
      log(`[ipc] ${canal} recusado: ${argumentos.length} argumento(s), esperado ${quantidade}`);
      throw new ErroIpcRecusado();
    }
  };
  const recusarArgumento = (canal: CanalProjetos, qual: string): never => {
    log(`[ipc] ${canal} recusado: ${qual} fora do contrato`);
    throw new ErroIpcRecusado();
  };

  const pacoteOuRecusa = (canal: CanalProjetos, valor: unknown) => {
    const p = lerPacoteTransferivel(valor);
    if (!p.ok && p.recusado) return recusarArgumento(canal, `pacote (${p.motivo})`);
    return p;
  };

  const abrir: Manipulador = async (r, argumentos): Promise<ResultadoAbrir> => {
    conferir(CANAIS_PROJETOS.abrir, r, argumentos, 0);
    const caminho = await dep.escolherArquivoParaAbrir(r.idConteudo);
    if (caminho === null) return { ok: false, motivo: 'CANCELADO' };
    const nomeArquivo = basename(caminho);
    const lido = await dep.ler(caminho);
    if (lido.ok) {
      // Arquivo aberto com outra extensão (filtro "*.*" no diálogo) não vira destino de `salvar` (S8-04).
      const identificador = ehProjeto(caminho) ? registro.registrar(caminho, r.idConteudo) : null;
      const atualizacao =
        lido.migracao.length > 0 && lido.nomeBackup !== null ? { versaoOrigem: lido.migracao[0]!, nomeBackup: lido.nomeBackup } : null;
      return { ok: true, projeto: { identificador, nomeArquivo, pacote: lido.pacote, avisos: lido.avisos, atualizacao } };
    }
    if (lido.versaoFutura) {
      // Sem identificador: um arquivo de versão futura nunca recebe destino de gravação.
      return { ok: false, motivo: 'VERSAO_FUTURA', nomeArquivo, ...lido.versaoFutura };
    }
    return {
      ok: false,
      motivo: 'ERRO',
      nomeArquivo,
      mensagem: `Não foi possível abrir “${nomeArquivo}”: ${lido.erros[0]?.mensagem ?? 'arquivo inválido'}.`,
      erros: limitarErros(lido.erros),
    };
  };

  const salvar: Manipulador = async (r, argumentos): Promise<ResultadoSalvar> => {
    const canal = CANAIS_PROJETOS.salvar;
    conferir(canal, r, argumentos, 2);
    const id = lerIdentificador(argumentos[0]) ?? recusarArgumento(canal, 'identificador');
    const p = pacoteOuRecusa(canal, argumentos[1]);
    const destino = registro.caminho(id, r.idConteudo);
    if (destino === null) {
      return { ok: false, motivo: 'ERRO', codigo: 'NAO_ABERTO', mensagem: MENSAGEM_NAO_ABERTO, erros: [] };
    }
    if (!p.ok) return erroPacote(p.erros);
    return paraResultadoSalvar(await dep.salvar(destino, p.valor), log);
  };

  const salvarComo: Manipulador = async (r, argumentos): Promise<ResultadoSalvarComo> => {
    const canal = CANAIS_PROJETOS.salvarComo;
    conferir(canal, r, argumentos, 1);
    const p = pacoteOuRecusa(canal, argumentos[0]);
    // Conteúdo inválido não chega a abrir o diálogo: o usuário não escolhe destino para algo que não vai gravar.
    if (!p.ok) return erroPacote(p.erros);
    const destino = await dep.escolherDestino(r.idConteudo, nomeSugerido(p.valor));
    if (destino === null) return { ok: false, motivo: 'CANCELADO' };
    if (!ehProjeto(destino)) {
      return { ok: false, motivo: 'ERRO', codigo: 'EXTENSAO_INVALIDA', mensagem: MENSAGEM_EXTENSAO, erros: [] };
    }
    const s = paraResultadoSalvar(await dep.salvar(destino, p.valor), log);
    if (!s.ok) return s;
    return { ...s, identificador: registro.registrar(destino, r.idConteudo) };
  };

  const fechar: Manipulador = async (r, argumentos): Promise<void> => {
    const canal = CANAIS_PROJETOS.fechar;
    conferir(canal, r, argumentos, 1);
    registro.esquecer(lerIdentificador(argumentos[0]) ?? recusarArgumento(canal, 'identificador'), r.idConteudo);
  };

  return {
    manipuladores: Object.freeze({
      [CANAIS_PROJETOS.abrir]: abrir,
      [CANAIS_PROJETOS.salvar]: salvar,
      [CANAIS_PROJETOS.salvarComo]: salvarComo,
      [CANAIS_PROJETOS.fechar]: fechar,
    }),
    registro,
  };
}
