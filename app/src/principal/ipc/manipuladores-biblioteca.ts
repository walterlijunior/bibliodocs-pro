/**
 * Manipuladores da API `biblioteca` (M1-T09; ADR-0004, seções 4 e 5; RF-01). Como os de `projetos`, não importam o
 * Electron: diálogos, Lixeira, leitor e gravação entram por dependências (testes em tests/biblioteca.test.ts).
 *
 * Toda chamada passa por remetente e argumentos (`criarConferencia`) antes de tocar no disco, e as operações rodam
 * uma de cada vez (fila única), para que listar, abrir, renomear e excluir não se cruzem na mesma pasta. Os diálogos
 * (escolher pasta, confirmar exclusão) ficam fora da fila, e o que eles decidem é conferido de novo dentro dela.
 *
 * Decisões técnicas (registradas no relatório do M1-T09):
 * - renomear e excluir recusam um trabalho aberto no app (`ABERTO_NO_APP`): um salvamento automático em curso
 *   recriaria o arquivo com o nome antigo, ou depois da exclusão;
 * - duplicar lê o projeto no processo leitor e grava uma cópia com id novo (o id dá nome às pastas de backup e de
 *   recuperação; dois arquivos com o mesmo id misturariam essas pastas);
 * - excluir só envia para a Lixeira; se a Lixeira falha, nada é apagado.
 */
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import {
  CANAIS_BIBLIOTECA,
  criarTrabalhoDoTipo,
  type CanalBiblioteca,
  type FalhaBiblioteca,
  type ItemBiblioteca,
  type PastaBiblioteca,
  type ResultadoAbrir,
  type ResultadoCriar,
  type ResultadoEscolherPasta,
  type ResultadoExcluir,
  type ResultadoItem,
  type ResultadoListar,
} from '../../aplicacao';
import { ehTipoTrabalhoUft } from '../../dominio/modelo';
import {
  codigoErro,
  descreverErro,
  comSufixo,
  gravarIndice,
  gravarPreferencias,
  indiceVazio,
  lerIndice,
  lerPreferencias,
  nomeLivre,
  pastaNaNuvem,
  renomearSemSobrescrever,
  SISTEMA_ARQUIVOS_NODE,
  semExtensao,
  validarNomeTrabalho,
  varrerPasta,
  type EntradaIndice,
  type IndiceBiblioteca,
  type PacoteProjeto,
  type ResultadoSalvamento,
  type ResumoProjeto,
  type Resumir,
  type SistemaArquivos,
} from '../../persistencia';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { lerIdentificador, lerPacoteTransferivel, paraTransferivel } from './argumentos';
import { criarConferencia, criarFila, type Manipulador } from './chamada';
import { respostaAbrir } from './manipuladores-projetos';
import type { RespostaLeitor } from './protocolo-leitor';
import { RegistroProjetos } from './registro-projetos';

/** Tamanho máximo aceito para o nome digitado (o nome válido tem no máximo 80 caracteres). */
const MAX_ARGUMENTO_NOME = 1_000;
/** Nome do arquivo de um trabalho criado pelo app. */
export const NOME_TRABALHO_NOVO = 'Trabalho sem título';
const SUFIXO_COPIA = ' (cópia)';

export interface DependenciasBiblioteca {
  origem: OrigemPermitida;
  conteudosPermitidos: () => ReadonlySet<number>;
  /** `Documentos\BiblioDocs Pro\Trabalhos` (criada se faltar). */
  pastaPadrao: string;
  /** `%LOCALAPPDATA%\BiblioDocsPro\biblioteca.json`. */
  arquivoIndice: string;
  /** `%LOCALAPPDATA%\BiblioDocsPro\preferencias.json`. */
  arquivoPreferencias: string;
  /** Variáveis de ambiente, para detectar o OneDrive. */
  ambiente: Readonly<Record<string, string | undefined>>;
  /** Diálogo de escolher pasta; `null` se cancelado. */
  escolherPasta: (idConteudo: number) => Promise<string | null>;
  /** Diálogo de confirmação do principal: `true` só se o usuário confirmou excluir. */
  confirmarExclusao: (idConteudo: number, nomeArquivo: string) => Promise<boolean>;
  /** `shell.trashItem`: lança se não conseguiu. */
  enviarParaLixeira: (caminho: string) => Promise<void>;
  /** Resumo isolado (processo leitor). */
  resumir: Resumir;
  /** Leitura isolada (processo leitor), para abrir e duplicar. */
  ler: (caminho: string) => Promise<RespostaLeitor>;
  salvar: (destino: string, pacote: PacoteProjeto) => Promise<ResultadoSalvamento>;
  /** Registro dos projetos abertos (o mesmo dos canais `projetos`). */
  projetos: RegistroProjetos;
  /** Id novo de projeto (`PADRAO_ID`). */
  gerarIdProjeto: () => string;
  /** Id novo de elemento ou seção com o prefixo (`PADRAO_ID`); padrão: prefixo + 16 caracteres aleatórios. */
  gerarId?: (prefixo: string) => string;
  agora: () => Date;
  appVersao: string;
  fs?: SistemaArquivos;
  /** Registro dos itens listados (injetável nos testes). */
  itens?: RegistroProjetos;
  log?: (mensagem: string) => void;
}

const falha = (codigo: string, mensagem: string): FalhaBiblioteca => ({ ok: false, motivo: 'ERRO', codigo, mensagem });

const MENSAGEM_NAO_ENCONTRADO = 'Este trabalho não está mais na pasta. Atualize a lista.';

function falhaDisco(e: unknown, acao: string): FalhaBiblioteca {
  switch (codigoErro(e)) {
    case 'ENOENT':
      return falha('NAO_ENCONTRADO', MENSAGEM_NAO_ENCONTRADO);
    case 'EPERM':
    case 'EACCES':
    case 'EBUSY':
      return falha('EM_USO', `Não foi possível ${acao}: o arquivo está em uso por outro programa ou sem permissão. Feche-o e tente de novo.`);
    default:
      return falha('FALHA_DISCO', `Não foi possível ${acao} por um erro no disco.`);
  }
}

export function criarManipuladoresBiblioteca(dep: DependenciasBiblioteca): {
  manipuladores: Readonly<Record<CanalBiblioteca, Manipulador>>;
  itens: RegistroProjetos;
  /** Pasta atual da biblioteca (a recuperação procura nela os restos de gravação; M1-T12). */
  pastaAtual: () => Promise<string>;
} {
  const fs = dep.fs ?? SISTEMA_ARQUIVOS_NODE;
  const itens = dep.itens ?? new RegistroProjetos();
  const log = dep.log ?? ((m: string) => console.warn(m));
  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, log);
  const novoId = dep.gerarId ?? ((prefixo: string) => `${prefixo}_${randomBytes(12).toString('base64url')}`);
  const emFila = criarFila();

  // Estado da sessão: a pasta vem das preferências na 1.ª chamada; o índice fica em memória depois de lido.
  let pastaEscolhida: string | null | undefined;
  let indice: IndiceBiblioteca | null = null;

  const pastaAtual = async (): Promise<string> => {
    if (pastaEscolhida === undefined) {
      const { preferencias, descarte } = await lerPreferencias(dep.arquivoPreferencias, fs);
      if (descarte && descarte !== 'ausente') log(`[biblioteca] preferências descartadas: ${descarte}`);
      pastaEscolhida = preferencias.pastaBiblioteca;
    }
    return pastaEscolhida ?? dep.pastaPadrao;
  };

  const descreverPasta = (pasta: string): PastaBiblioteca => ({
    nome: basename(pasta),
    padrao: pasta === dep.pastaPadrao,
    naNuvem: pastaNaNuvem(pasta, dep.ambiente),
  });

  const guardarIndice = async (novo: IndiceBiblioteca): Promise<void> => {
    indice = novo;
    const r = await gravarIndice(dep.arquivoIndice, novo, fs);
    // Índice é cache: falhar ao gravá-lo não afeta o usuário (a próxima varredura refaz o trabalho).
    if (!r.ok) log(`[biblioteca] índice não gravado: ${r.codigo}${r.detalhe ? ` (${r.detalhe})` : ''}`);
  };

  const paraItem = (pasta: string, e: EntradaIndice, dono: number): ItemBiblioteca => {
    const ok = e.resumo.estado === 'ok' ? e.resumo : null;
    return {
      identificador: itens.idPara(join(pasta, e.nomeArquivo), dono),
      nomeArquivo: e.nomeArquivo,
      titulo: ok?.titulo ?? '',
      estado: e.resumo.estado,
      tipoTrabalho: ok?.tipoTrabalho ?? null,
      criadoEm: ok?.criadoEm ?? null,
      atualizadoEm: ok?.atualizadoEm ?? null,
      modificadoEm: e.modificadoEmMs,
      bytes: e.bytes,
    };
  };

  /**
   * Atualiza (ou acrescenta) a entrada de um arquivo no índice, a partir do disco. Nunca lança: o índice é cache, e uma
   * falha aqui (antivírus ou OneDrive mexendo no arquivo recém-gravado) não desfaz a operação (revisão do M1-T09, M1).
   * Sem o tamanho e a data reais, a entrada fica com zeros e é resumida de novo na próxima listagem.
   */
  const registrarNoIndice = async (pasta: string, nomeArquivo: string, resumo: ResumoProjeto, sai?: string): Promise<EntradaIndice> => {
    let bytes = 0;
    let modificadoEmMs = 0;
    try {
      const info = await fs.info(join(pasta, nomeArquivo));
      bytes = info.bytes;
      modificadoEmMs = info.modificadoEmMs;
    } catch (e) {
      log(`[biblioteca] arquivo não conferido após a operação: ${codigoErro(e) ?? 'erro'}`);
    }
    const entrada: EntradaIndice = { nomeArquivo, bytes, modificadoEmMs, resumo };
    const base = indice && indice.pasta === pasta ? indice : indiceVazio(pasta);
    const entradas = base.entradas.filter((e) => e.nomeArquivo !== nomeArquivo && e.nomeArquivo !== sai);
    await guardarIndice({ ...base, entradas: [...entradas, entrada] });
    return entrada;
  };

  /** Pasta pronta para uso: a padrão é criada se faltar; a escolhida precisa existir. */
  const prepararPasta = async (): Promise<{ ok: true; pasta: string } | FalhaBiblioteca> => {
    const pasta = await pastaAtual();
    try {
      if (pasta === dep.pastaPadrao) await fs.criarPasta(pasta);
      const info = await fs.info(pasta);
      if (info.pasta) return { ok: true, pasta };
    } catch (e) {
      log(`[biblioteca] pasta inacessível: ${codigoErro(e) ?? 'erro'}`);
    }
    return falha(
      'PASTA_INACESSIVEL',
      `Não foi possível acessar a pasta da biblioteca “${basename(pasta)}”. Verifique se ela existe ou escolha outra pasta.`,
    );
  };

  const listarAgora = async (dono: number): Promise<ResultadoListar> => {
    const p = await prepararPasta();
    if (!p.ok) return p;
    const { pasta } = p;
    if (!indice || indice.pasta !== pasta) {
      const lido = await lerIndice(dep.arquivoIndice, pasta, fs);
      if (lido.descarte && lido.descarte !== 'ausente') log(`[biblioteca] índice recriado: ${lido.descarte}`);
      indice = lido.indice;
    }
    let v;
    try {
      v = await varrerPasta(pasta, indice, dep.resumir, fs);
    } catch (e) {
      log(`[biblioteca] pasta não listada: ${codigoErro(e) ?? 'erro'}`);
      return falha('PASTA_INACESSIVEL', `Não foi possível listar a pasta “${basename(pasta)}”.`);
    }
    if (v.alterado) await guardarIndice(v.indice);
    else indice = v.indice;
    const caminhos = v.entradas.map((e) => join(pasta, e.nomeArquivo));
    itens.manterSo(dono, caminhos);
    return { ok: true, pasta: descreverPasta(pasta), itens: v.entradas.map((e) => paraItem(pasta, e, dono)), avisos: v.avisos };
  };

  /** Identificador de item no formato do contrato, ou recusa. O caminho é buscado já na fila, na hora de usar. */
  const idDoItem = (canal: CanalBiblioteca, valor: unknown): string => lerIdentificador(valor) ?? recusarArgumento(canal, 'identificador');

  const listar: Manipulador = async (r, argumentos) => {
    conferir(CANAIS_BIBLIOTECA.listar, r, argumentos, 0);
    return emFila(() => listarAgora(r.idConteudo));
  };

  const escolherPasta: Manipulador = async (r, argumentos): Promise<ResultadoEscolherPasta> => {
    conferir(CANAIS_BIBLIOTECA.escolherPasta, r, argumentos, 0);
    // O diálogo fica fora da fila: esquecido aberto, não trava as outras operações (revisão do M1-T09, M2).
    const escolhida = await dep.escolherPasta(r.idConteudo);
    if (escolhida === null) return { ok: false, motivo: 'CANCELADO' };
    return emFila(async () => {
      try {
        const info = await fs.info(escolhida);
        if (info.link) return falha('PASTA_INACESSIVEL', 'Atalhos e links de pasta não são aceitos. Escolha a pasta de destino.');
        if (!info.pasta) return falha('PASTA_INACESSIVEL', 'O item escolhido não é uma pasta.');
      } catch {
        return falha('PASTA_INACESSIVEL', 'Não foi possível acessar a pasta escolhida.');
      }
      const preferida = escolhida === dep.pastaPadrao ? null : escolhida;
      const g = await gravarPreferencias(dep.arquivoPreferencias, { formato: 'bibliodocs-preferencias', versao: 1, pastaBiblioteca: preferida }, fs);
      if (!g.ok) {
        log(`[biblioteca] preferências não gravadas: ${g.codigo}`);
        return falha('FALHA_DISCO', 'Não foi possível guardar a pasta escolhida. A biblioteca continua na pasta anterior.');
      }
      pastaEscolhida = preferida;
      indice = null;
      itens.limpar();
      return listarAgora(r.idConteudo);
    });
  };

  const criar: Manipulador = async (r, argumentos): Promise<ResultadoCriar> => {
    conferir(CANAIS_BIBLIOTECA.criar, r, argumentos, 1);
    const tipo = argumentos[0];
    if (!ehTipoTrabalhoUft(tipo)) return recusarArgumento(CANAIS_BIBLIOTECA.criar, 'tipo de trabalho');
    return emFila(async () => {
      const p = await prepararPasta();
      if (!p.ok) return p;
      let nome: string | null;
      try {
        nome = await nomeLivre(p.pasta, NOME_TRABALHO_NOVO, fs);
      } catch (e) {
        return falhaDisco(e, 'criar o trabalho');
      }
      if (!nome) return falha('SEM_NOME_LIVRE', 'Não foi possível escolher um nome livre para o trabalho novo.');
      const novo = criarTrabalhoDoTipo({
        id: dep.gerarIdProjeto(),
        agora: dep.agora().toISOString(),
        appVersao: dep.appVersao,
        tipo,
        novoId,
      });
      const pacote: PacoteProjeto = { ...novo, midias: new Map() };
      const destino = join(p.pasta, nome);
      const s = await dep.salvar(destino, pacote);
      if (!s.ok) return falha(s.codigo, s.mensagem.replace('Não foi possível salvar', 'Não foi possível criar o trabalho'));
      const resumo: ResumoProjeto = {
        estado: 'ok',
        id: novo.manifesto.id,
        titulo: '',
        tipoTrabalho: novo.manifesto.tipoTrabalho,
        criadoEm: novo.manifesto.criadoEm,
        atualizadoEm: novo.manifesto.atualizadoEm,
      };
      const entrada = await registrarNoIndice(p.pasta, nome, resumo);
      return {
        ok: true,
        projeto: {
          identificador: dep.projetos.registrar(destino, r.idConteudo, novo.manifesto.id, pacote.midias),
          nomeArquivo: nome,
          pacote: paraTransferivel(pacote),
          avisos: [],
          atualizacao: null,
        },
        item: paraItem(p.pasta, entrada, r.idConteudo),
      };
    });
  };

  const abrir: Manipulador = async (r, argumentos): Promise<ResultadoAbrir> => {
    const canal = CANAIS_BIBLIOTECA.abrir;
    conferir(canal, r, argumentos, 1);
    const id = idDoItem(canal, argumentos[0]);
    // Na fila: renomear ou excluir não acontece entre ler e registrar o arquivo aberto (revisão do M1-T09, M4).
    return emFila(async () => {
      const caminho = itens.caminho(id, r.idConteudo);
      if (caminho === null) return { ok: false, motivo: 'ERRO', nomeArquivo: '', mensagem: MENSAGEM_NAO_ENCONTRADO, erros: [] };
      return respostaAbrir(caminho, await dep.ler(caminho), dep.projetos, r.idConteudo);
    });
  };

  const renomear: Manipulador = async (r, argumentos): Promise<ResultadoItem> => {
    const canal = CANAIS_BIBLIOTECA.renomear;
    conferir(canal, r, argumentos, 2);
    const id = idDoItem(canal, argumentos[0]);
    const digitado = argumentos[1];
    if (typeof digitado !== 'string' || digitado.length > MAX_ARGUMENTO_NOME) return recusarArgumento(canal, 'nome');
    return emFila(async () => {
      const caminho = itens.caminho(id, r.idConteudo);
      if (caminho === null) return falha('NAO_ENCONTRADO', MENSAGEM_NAO_ENCONTRADO);
      const v = validarNomeTrabalho(digitado);
      if (!v.ok) return falha('NOME_INVALIDO', v.mensagem);
      if (dep.projetos.contem(caminho)) return falha('ABERTO_NO_APP', 'Feche o trabalho antes de renomeá-lo.');
      const pasta = dirname(caminho);
      const antigo = basename(caminho);
      const destino = join(pasta, v.nomeArquivo);
      const rn = await renomearSemSobrescrever(caminho, destino, fs);
      if (!rn.ok) {
        return rn.motivo === 'JA_EXISTE'
          ? falha('JA_EXISTE', `Já existe um trabalho chamado “${v.nomeArquivo}” nesta pasta.`)
          : falhaDisco(rn.erro, 'renomear o trabalho');
      }
      // O `.bak` acompanha (R-M1-02). Falhar aqui não desfaz o renomear: a cópia só fica com o nome antigo.
      if (await fs.info(`${caminho}.bak`).then(() => true, () => false)) {
        const bak = await renomearSemSobrescrever(`${caminho}.bak`, `${destino}.bak`, fs);
        if (!bak.ok) log(`[biblioteca] .bak não renomeado: ${bak.motivo === 'JA_EXISTE' ? 'já existe um com o nome novo' : (codigoErro(bak.erro) ?? 'erro')}`);
      }
      itens.trocarCaminho(caminho, destino);
      const anterior = indice?.entradas.find((e) => e.nomeArquivo === antigo)?.resumo ?? { estado: 'invalido' as const };
      const entrada = await registrarNoIndice(pasta, v.nomeArquivo, anterior, antigo);
      return { ok: true, item: paraItem(pasta, entrada, r.idConteudo) };
    });
  };

  const duplicar: Manipulador = async (r, argumentos): Promise<ResultadoItem> => {
    const canal = CANAIS_BIBLIOTECA.duplicar;
    conferir(canal, r, argumentos, 1);
    const id = idDoItem(canal, argumentos[0]);
    return emFila(async () => {
      const caminho = itens.caminho(id, r.idConteudo);
      if (caminho === null) return falha('NAO_ENCONTRADO', MENSAGEM_NAO_ENCONTRADO);
      const lido = await dep.ler(caminho);
      if (!lido.ok) {
        return lido.versaoFutura
          ? falha('VERSAO_FUTURA', 'Este trabalho foi criado por uma versão mais nova do BiblioDocs Pro e não pode ser duplicado nesta.')
          : falha('ILEGIVEL', `Não foi possível duplicar: ${lido.erros[0]?.mensagem ?? 'arquivo inválido'}.`);
      }
      const p = lerPacoteTransferivel(lido.pacote);
      if (!p.ok) return falha('ILEGIVEL', 'Não foi possível duplicar: o trabalho tem dados inválidos.');
      const novoId = dep.gerarIdProjeto();
      const agora = dep.agora().toISOString();
      const pacote: PacoteProjeto = {
        ...p.valor,
        manifesto: { ...p.valor.manifesto, id: novoId, criadoEm: agora, atualizadoEm: agora },
        documento: { ...p.valor.documento, id: novoId },
      };
      const pasta = dirname(caminho);
      let nome: string | null;
      try {
        nome = await nomeLivre(pasta, comSufixo(semExtensao(basename(caminho)), SUFIXO_COPIA), fs);
      } catch (e) {
        return falhaDisco(e, 'duplicar o trabalho');
      }
      if (!nome) return falha('SEM_NOME_LIVRE', 'Não foi possível escolher um nome livre para a cópia.');
      const s = await dep.salvar(join(pasta, nome), pacote);
      if (!s.ok) return falha(s.codigo, s.mensagem.replace('Não foi possível salvar', 'Não foi possível duplicar o trabalho'));
      const anterior = indice?.entradas.find((e) => e.nomeArquivo === basename(caminho))?.resumo;
      const resumo: ResumoProjeto = {
        estado: 'ok',
        id: novoId,
        titulo: anterior?.estado === 'ok' ? anterior.titulo : '',
        tipoTrabalho: pacote.manifesto.tipoTrabalho,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      const entrada = await registrarNoIndice(pasta, nome, resumo);
      return { ok: true, item: paraItem(pasta, entrada, r.idConteudo) };
    });
  };

  const excluir: Manipulador = async (r, argumentos): Promise<ResultadoExcluir> => {
    const canal = CANAIS_BIBLIOTECA.excluir;
    conferir(canal, r, argumentos, 1);
    const id = idDoItem(canal, argumentos[0]);
    const mensagemAberto = 'Feche o trabalho antes de excluí-lo.';
    // Confere antes de perguntar (não pergunta à toa) e de novo depois, já na fila: com o diálogo aberto, fora da fila,
    // o arquivo pode ter sido aberto, renomeado ou excluído (revisão do M1-T09, M2 e M4).
    const antes = itens.caminho(id, r.idConteudo);
    if (antes === null) return falha('NAO_ENCONTRADO', MENSAGEM_NAO_ENCONTRADO);
    if (dep.projetos.contem(antes)) return falha('ABERTO_NO_APP', mensagemAberto);
    if (!(await dep.confirmarExclusao(r.idConteudo, basename(antes)))) return { ok: false, motivo: 'CANCELADO' };
    return emFila(async () => {
      const caminho = itens.caminho(id, r.idConteudo);
      if (caminho === null) return falha('NAO_ENCONTRADO', MENSAGEM_NAO_ENCONTRADO);
      // Renomeado durante a pergunta: a confirmação foi para outro nome.
      if (caminho !== antes) return falha('NAO_ENCONTRADO', 'O trabalho mudou de nome. Confira a lista e tente de novo.');
      if (dep.projetos.contem(caminho)) return falha('ABERTO_NO_APP', mensagemAberto);
      const nomeArquivo = basename(caminho);
      try {
        await dep.enviarParaLixeira(caminho);
      } catch (e) {
        log(`[biblioteca] Lixeira falhou: ${descreverErro(e)}`);
        return falha('LIXEIRA_FALHOU', `Não foi possível enviar “${nomeArquivo}” para a Lixeira. Nada foi apagado.`);
      }
      // O `.bak` tem o texto anterior: vai junto para a Lixeira (R-M1-02). O trabalho já foi; falhar aqui só fica no registro.
      const bak = `${caminho}.bak`;
      if (await fs.info(bak).then(() => true, () => false)) {
        await dep.enviarParaLixeira(bak).catch((e: unknown) => log(`[biblioteca] .bak fora da Lixeira: ${codigoErro(e) ?? 'erro'}`));
      }
      itens.esquecerCaminho(caminho);
      if (indice) await guardarIndice({ ...indice, entradas: indice.entradas.filter((e) => e.nomeArquivo !== nomeArquivo) });
      return { ok: true };
    });
  };

  return {
    manipuladores: Object.freeze({
      [CANAIS_BIBLIOTECA.listar]: listar,
      [CANAIS_BIBLIOTECA.escolherPasta]: escolherPasta,
      [CANAIS_BIBLIOTECA.criar]: criar,
      [CANAIS_BIBLIOTECA.abrir]: abrir,
      [CANAIS_BIBLIOTECA.renomear]: renomear,
      [CANAIS_BIBLIOTECA.duplicar]: duplicar,
      [CANAIS_BIBLIOTECA.excluir]: excluir,
    }),
    itens,
    pastaAtual,
  };
}
