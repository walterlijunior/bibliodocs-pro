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
import { basename } from 'node:path';
import {
  CANAIS_PROJETOS,
  type CanalProjetos,
  type ResultadoAbrir,
  type ResultadoSalvar,
  type ResultadoSalvarComo,
} from '../../aplicacao';
import { LIMITES_V1, type ErroValidacao } from '../../dominio/esquemas';
import { textoPlano } from '../../dominio/modelo';
import { ehArquivoProjeto, EXTENSAO_PROJETO, limparNomeArquivo, MENSAGENS_FALHA, type PacoteProjeto, type ResultadoSalvamento } from '../../persistencia';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { lerIdentificador, lerPacoteTransferivel } from './argumentos';
import { criarConferencia, ErroIpcRecusado, type Manipulador } from './chamada';
import type { RespostaLeitor } from './protocolo-leitor';
import { RegistroProjetos } from './registro-projetos';

export { EXTENSAO_PROJETO };

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
  /**
   * Antes de gravar no arquivo do usuário: a recuperação devolve a marca dos instantâneos já gravados daquele projeto
   * (M1-T12). Depois de gravar, `aoGravar` apaga os instantâneos só se nenhum outro chegou durante a gravação.
   */
  antesDeGravar?: (idProjeto: string) => number;
  aoGravar?: (caminho: string, idProjeto: string, dono: number, marca: number) => Promise<void>;
  /** Depois de fechar um arquivo: a sessão de recuperação dele termina (M1-T12). */
  aoFechar?: (caminho: string, dono: number) => Promise<void>;
  /** Registro técnico (nunca vai ao renderer). */
  log?: (mensagem: string) => void;
}

export { ErroIpcRecusado, type Manipulador };

/** Nome sugerido no "Salvar como": o título do trabalho, limpo para o Windows, com `.bdp`. */
export function nomeSugerido(pacote: PacoteProjeto): string {
  return limparNomeArquivo(textoPlano(pacote.documento.metadados.titulo));
}

const MENSAGEM_EXTENSAO = 'Não foi possível salvar: o nome do arquivo precisa terminar em .bdp.';
const MENSAGEM_NAO_ABERTO = 'Não foi possível salvar: este trabalho não está mais aberto. Use “Salvar como…”.';

/** A lista de erros que volta ao renderer tem limite (revisão do M1-T08, S8-06). */
const limitarErros = <T>(erros: readonly T[]): T[] => erros.slice(0, LIMITES_V1.errosRelatados);

const erroPacote = (erros: ErroValidacao[]) =>
  ({ ok: false, motivo: 'ERRO', codigo: 'PACOTE_INVALIDO', mensagem: MENSAGENS_FALHA.PACOTE_INVALIDO, erros: limitarErros(erros) }) as const;

const ehProjeto = (caminho: string) => ehArquivoProjeto(basename(caminho));

function paraResultadoSalvar(r: ResultadoSalvamento, log: (m: string) => void): ResultadoSalvar {
  if (r.ok) return { ok: true, nomeArquivo: basename(r.caminho), avisos: r.avisos };
  log(`[ipc] salvamento falhou: ${r.codigo}${r.detalhe ? ` (${r.detalhe})` : ''}`);
  return { ok: false, motivo: 'ERRO', codigo: r.codigo, mensagem: r.mensagem, erros: 'erros' in r ? limitarErros(r.erros) : [] };
}

/**
 * Resultado de `abrir` para um arquivo já lido pelo processo leitor; registra o identificador de gravação quando o
 * arquivo é um `.bdp` lido sem erro. Usado também pela biblioteca (abrir da lista).
 */
export function respostaAbrir(caminho: string, lido: RespostaLeitor, registro: RegistroProjetos, dono: number): ResultadoAbrir {
  const nomeArquivo = basename(caminho);
  if (lido.ok) {
    // Arquivo aberto com outra extensão (filtro "*.*" no diálogo) não vira destino de `salvar` (S8-04).
    const identificador = ehProjeto(caminho) ? registro.registrar(caminho, dono, lido.pacote.manifesto.id) : null;
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
}

export function criarManipuladoresProjetos(dep: DependenciasProjetos): {
  manipuladores: Readonly<Record<CanalProjetos, Manipulador>>;
  registro: RegistroProjetos;
} {
  const registro = dep.registro ?? new RegistroProjetos();
  const log = dep.log ?? ((m: string) => console.warn(m));

  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, log);

  const pacoteOuRecusa = (canal: CanalProjetos, valor: unknown) => {
    const p = lerPacoteTransferivel(valor);
    if (!p.ok && p.recusado) return recusarArgumento(canal, `pacote (${p.motivo})`);
    return p;
  };

  const abrir: Manipulador = async (r, argumentos): Promise<ResultadoAbrir> => {
    conferir(CANAIS_PROJETOS.abrir, r, argumentos, 0);
    const caminho = await dep.escolherArquivoParaAbrir(r.idConteudo);
    if (caminho === null) return { ok: false, motivo: 'CANCELADO' };
    return respostaAbrir(caminho, await dep.ler(caminho), registro, r.idConteudo);
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
    // O id é o que o principal registrou ao abrir; o do pacote só vale se ainda não havia um (revisão do M1-T12, M1).
    const idProjeto = registro.idProjeto(id, r.idConteudo) ?? p.valor.manifesto.id;
    const marca = dep.antesDeGravar?.(idProjeto) ?? 0;
    const s = paraResultadoSalvar(await dep.salvar(destino, p.valor), log);
    if (s.ok) await dep.aoGravar?.(destino, idProjeto, r.idConteudo, marca);
    return s;
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
    const idProjeto = p.valor.manifesto.id;
    const marca = dep.antesDeGravar?.(idProjeto) ?? 0;
    const s = paraResultadoSalvar(await dep.salvar(destino, p.valor), log);
    if (!s.ok) return s;
    await dep.aoGravar?.(destino, idProjeto, r.idConteudo, marca);
    // O arquivo novo foi gravado pelo principal com este id.
    return { ...s, identificador: registro.registrar(destino, r.idConteudo, idProjeto) };
  };

  const fechar: Manipulador = async (r, argumentos): Promise<void> => {
    const canal = CANAIS_PROJETOS.fechar;
    conferir(canal, r, argumentos, 1);
    const id = lerIdentificador(argumentos[0]) ?? recusarArgumento(canal, 'identificador');
    const caminho = registro.caminho(id, r.idConteudo);
    registro.esquecer(id, r.idConteudo);
    // Outro identificador da mesma janela para o mesmo arquivo (abrir de novo) mantém a sessão de recuperação.
    if (caminho !== null && !registro.contemDe(caminho, r.idConteudo)) await dep.aoFechar?.(caminho, r.idConteudo);
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
