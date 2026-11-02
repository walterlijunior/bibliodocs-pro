/**
 * Manipuladores da API `recuperacao` (M1-T12; ADR-0004, seção 4, "Salvamento automático e recuperação"). Como os de
 * `projetos` e `biblioteca`, não importam o Electron (testes em tests/recuperacao.test.ts).
 *
 * Sessões: um projeto passa a ter **sessão ativa** neste processo no primeiro instantâneo (ou ao ser recuperado). A
 * sessão grava a trava `sessao\<id>.lock` e acaba quando o trabalho é fechado ou a janela fecha normalmente; aí os
 * instantâneos que sobraram (alterações descartadas pelo usuário) vão para `recuperacao-antigos` e a trava é apagada.
 * Se a janela cai, recarrega ou o processo morre, a sessão some sem limpar: os conjuntos de instantâneos sem sessão
 * ativa são o que a listagem oferece. Com instância única (`requestSingleInstanceLock`), uma trava sem sessão ativa
 * neste processo é sempre órfã; o PID fica registrado para diagnóstico.
 *
 * Nada da queda é apagado ou arquivado sem uma escolha do usuário (revisão do M1-T12, A2 e M3): se o projeto volta a
 * ser editado antes da escolha, os instantâneos da queda são **reservados** (`<id>~<carimbo>`) e continuam oferecidos.
 *
 * Ganchos chamados pelos manipuladores de `projetos`:
 * - `antesDeGravar` + `aoGravar`: o trabalho foi gravado no arquivo do usuário → os instantâneos daquele projeto são
 *   apagados, **se** nenhum instantâneo novo chegou durante a gravação (revisão A3);
 * - `aoFechar`: o trabalho foi fechado (depois de gravar, ou descartando as alterações) → fim da sessão.
 *
 * O id do projeto é sempre o registrado pelo principal ao abrir ou gravar o arquivo, nunca o que o renderer manda
 * (revisão M1). Tudo que mexe na pasta de recuperação roda numa fila única, na ordem de chegada.
 */
import { basename, join } from 'node:path';
import {
  CANAIS_RECUPERACAO,
  type AvisoProjeto,
  type CanalRecuperacao,
  type OfertaRecuperacao,
  type ResultadoAbrir,
  type ResultadoAbrirDescartada,
  type ResultadoInstantaneo,
  type ResultadoListarDescartadas,
  type VersaoDescartada,
  type ResultadoListarRecuperacao,
  type ResultadoRecuperar,
  type TipoOferta,
} from '../../aplicacao';
import {
  apagarInstantaneos,
  apagarTrava,
  ARQUIVOS_POR_LOTE,
  arquivar,
  arquivarInstantaneos,
  chaveCaminho,
  ehArquivoProjeto,
  ehReservado,
  empacotarProjeto,
  gravarInstantaneo,
  gravarTrava,
  idDoConjunto,
  instantaneosDe,
  lerTrava,
  limparAntigos,
  listarIdsComInstantaneos,
  listarTravas,
  NOME_INSTANTANEO_ANTERIOR,
  procurarRestos,
  promoverConjunto,
  reservarInstantaneos,
  SISTEMA_ARQUIVOS_NODE,
  type Empacotar,
  type OpcoesGravacao,
  type PacoteProjeto,
  type PastasRecuperacao,
  type ResultadoSalvamento,
  type ResumoProjeto,
  type Resumir,
  type SistemaArquivos,
  descreverErro,
} from '../../persistencia';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { lerIdentificador, lerPacoteTransferivel, mapaMidias } from './argumentos';
import { criarConferencia, criarFila, type Manipulador } from './chamada';
import { respostaAbrir } from './manipuladores-projetos';
import type { RespostaLeitor } from './protocolo-leitor';
import { RegistroProjetos } from './registro-projetos';

export interface DependenciasRecuperacao {
  origem: OrigemPermitida;
  conteudosPermitidos: () => ReadonlySet<number>;
  pastas: PastasRecuperacao;
  /** Registro dos projetos abertos (o mesmo dos canais `projetos`). */
  projetos: RegistroProjetos;
  /** Pasta atual da biblioteca, onde se procuram os restos de gravação; `null` se não houver. */
  pastaBiblioteca: () => Promise<string | null>;
  /** Leitura isolada (processo leitor). */
  ler: (caminho: string) => Promise<RespostaLeitor>;
  /** Resumo isolado (processo leitor), para conferir se cada arquivo abre. */
  resumir: Resumir;
  salvar: (destino: string, pacote: PacoteProjeto) => Promise<ResultadoSalvamento>;
  /** Empacotamento do instantâneo; o principal passa o do worker (M2-T01). Padrão: `empacotarProjeto` aqui mesmo. */
  empacotar?: Empacotar;
  /** PID deste processo (fica na trava; os temporários dele não são restos). */
  pid: number;
  agora: () => Date;
  fs?: SistemaArquivos;
  gravacao?: Omit<OpcoesGravacao, 'fs' | 'semBak'>;
  /** Registro das ofertas (injetável nos testes). */
  ofertas?: RegistroProjetos;
  log?: (mensagem: string) => void;
}

export const MENSAGEM_OFERTA_VENCIDA = 'Esta recuperação não está mais disponível. A lista de recuperações foi atualizada.';
export const MENSAGEM_JA_ABERTO = 'Este trabalho já está aberto no BiblioDocs Pro. Feche-o antes de recuperar.';
const MENSAGEM_ILEGIVEL = 'Não foi possível ler a versão recuperada. Os arquivos de recuperação foram mantidos.';
const MENSAGEM_JA_ABRE = 'O arquivo já abre normalmente e não foi alterado.';
const MENSAGEM_SEM_GUARDAR = 'Não foi possível guardar o arquivo danificado antes de restaurar. Nada foi alterado.';
/** Versões listadas no máximo por vez: cada uma é lida pelo processo leitor. */
export const MAX_VERSOES_DESCARTADAS = 100;
export const MENSAGEM_DESCARTADA_ILEGIVEL = 'Não foi possível abrir esta versão. Ela pode ter passado do prazo de 7 dias.';
const MENSAGEM_DISCO = 'Não foi possível preparar a recuperação por um erro no disco. Nada foi apagado.';

interface SessaoAtiva {
  /** Arquivo do usuário (vazio quando a versão recuperada não tem arquivo conhecido). */
  caminho: string;
  dono: number;
}

interface OfertaInterna {
  tipo: TipoOferta;
  dono: number;
  /** Conjunto dos instantâneos (`<id>` ou `<id>~<carimbo>`; só `instantaneo`). */
  conjunto: string | null;
  /** Arquivos com a versão recuperável, do mais recente ao mais antigo. */
  candidatos: string[];
  /** Arquivo do usuário, quando conhecido. */
  original: string | null;
  publica: Omit<OfertaRecuperacao, 'identificador'>;
}

export function criarManipuladoresRecuperacao(dep: DependenciasRecuperacao) {
  const fs = dep.fs ?? SISTEMA_ARQUIVOS_NODE;
  const empacotar = dep.empacotar ?? empacotarProjeto;
  const log = dep.log ?? ((m: string) => console.warn(m));
  const op = { fs, ...(dep.gravacao ? { gravacao: dep.gravacao } : {}) };
  const { pastas } = dep;
  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, log);
  const emFila = criarFila();
  const sessoes = new Map<string, SessaoAtiva>();
  /** Instantâneos gravados por projeto nesta execução (marca do `antesDeGravar`). */
  const geracoes = new Map<string, number>();
  /** Identificador → caminho fictício `oferta:<n>`; os dados ficam em `internas`. */
  const registroOfertas = dep.ofertas ?? new RegistroProjetos();
  const internas = new Map<string, OfertaInterna>();
  /** Identificador → caminho em `recuperacao-antigos`; valem só para a janela e a listagem mais recente. */
  const descartadas = new Map<string, { caminho: string; dono: number; quando: number }>();
  let contador = 0;

  const agoraMs = () => dep.agora().getTime();
  const iniciarSessao = async (idProjeto: string, caminho: string, dono: number) => {
    sessoes.set(idProjeto, { caminho, dono });
    if (caminho === '') return;
    const ok = await gravarTrava(pastas, idProjeto, { pid: dep.pid, desde: dep.agora().toISOString(), caminho }, op);
    if (!ok) log(`[recuperacao] trava de ${idProjeto} não gravada`);
  };
  /** Fim normal de uma sessão: o que sobrou foi descartado pelo usuário e fica 7 dias em `recuperacao-antigos`. */
  const terminarSessao = async (idProjeto: string) => {
    sessoes.delete(idProjeto);
    await arquivarInstantaneos(pastas, idProjeto, agoraMs(), op);
    await apagarTrava(pastas, idProjeto, op);
  };
  const esquecerDescartadas = (dono: number) => {
    for (const [id, d] of descartadas) {
      if (d.dono !== dono) continue;
      descartadas.delete(id);
      registroOfertas.esquecer(id, dono);
    }
  };
  const esquecerOfertas = (dono: number) => {
    esquecerDescartadas(dono);
    for (const [id, o] of internas) {
      if (o.dono !== dono) continue;
      internas.delete(id);
      registroOfertas.esquecer(id, dono);
    }
  };
  const infoArquivo = async (caminho: string) => {
    try {
      const i = await fs.info(caminho);
      return i.arquivoComum ? i : null;
    } catch {
      return null;
    }
  };

  // ---------- ganchos ----------

  /** Marca tirada antes de gravar no arquivo do usuário (síncrona: nada entra entre ela e o início da gravação). */
  const antesDeGravar = (idProjeto: string): number => geracoes.get(idProjeto) ?? 0;

  /** O trabalho `idProjeto` foi gravado em `caminho` (salvar ou "Salvar como…"). */
  const aoGravar = (caminho: string, idProjeto: string, dono: number, marca: number): Promise<void> =>
    emFila(async () => {
      // Instantâneo gravado durante a gravação tem alterações que o arquivo não tem: fica (revisão A3). Sem sessão, os
      // instantâneos são de uma queda ainda não decidida, e só a escolha do usuário os tira (R-M2-01).
      if (sessoes.has(idProjeto) && (geracoes.get(idProjeto) ?? 0) === marca) await apagarInstantaneos(pastas, idProjeto, op);
      const s = sessoes.get(idProjeto);
      if (s && s.dono === dono && chaveCaminho(s.caminho) !== chaveCaminho(caminho)) await iniciarSessao(idProjeto, caminho, dono);
    });

  /** O arquivo `caminho` foi fechado pela janela `dono`. */
  const aoFechar = (caminho: string, dono: number): Promise<void> =>
    emFila(async () => {
      const chave = chaveCaminho(caminho);
      for (const [id, s] of [...sessoes]) if (s.dono === dono && s.caminho !== '' && chaveCaminho(s.caminho) === chave) await terminarSessao(id);
    });

  /**
   * A janela `dono` deixou de existir. `limpo`: fechou normalmente (as sessões terminam); senão (caiu, recarregou), as
   * sessões somem sem limpar e os instantâneos viram ofertas. Chamar duas vezes não faz mal.
   */
  const encerrarDono = (dono: number, limpo: boolean): Promise<void> =>
    emFila(async () => {
      esquecerOfertas(dono);
      for (const [id, s] of [...sessoes]) {
        if (s.dono !== dono) continue;
        if (limpo) await terminarSessao(id);
        else sessoes.delete(id);
      }
    });

  /** Espera a fila esvaziar (antes de o app sair). */
  const aguardar = (): Promise<void> => emFila(async () => undefined);

  // ---------- resumos ----------

  async function resumirTodos(caminhos: readonly string[]): Promise<Map<string, ResumoProjeto | null>> {
    const resumos = new Map<string, ResumoProjeto | null>();
    const unicos = [...new Set(caminhos)];
    for (let i = 0; i < unicos.length; i += ARQUIVOS_POR_LOTE) {
      const lote = unicos.slice(i, i + ARQUIVOS_POR_LOTE);
      const r = await dep.resumir(lote);
      if (r !== null) {
        lote.forEach((c, j) => resumos.set(c, r[j] ?? null));
        continue;
      }
      // Lote caiu: um por vez, para um arquivo ruim não esconder os outros.
      for (const c of lote) resumos.set(c, (await dep.resumir([c]))?.[0] ?? null);
    }
    return resumos;
  }

  // ---------- listar ----------

  async function ofertasDeInstantaneos(dono: number): Promise<OfertaInterna[]> {
    const ofertas: OfertaInterna[] = [];
    const pendentes = [];
    const ativo = (conjunto: string) => !ehReservado(conjunto) && sessoes.has(conjunto);
    for (const conjunto of await listarIdsComInstantaneos(pastas, op)) {
      if (ativo(conjunto)) continue;
      const instantaneos = await instantaneosDe(pastas, conjunto, op);
      if (instantaneos.length === 0) {
        await apagarInstantaneos(pastas, conjunto, op); // pasta vazia
        continue;
      }
      pendentes.push({ conjunto, id: idDoConjunto(conjunto), instantaneos, trava: await lerTrava(pastas, conjunto, op) });
    }
    const resumos = await resumirTodos(pendentes.flatMap((p) => p.instantaneos.map((i) => i.caminho)));
    for (const p of pendentes) {
      const validos = p.instantaneos.filter((i) => {
        const r = resumos.get(i.caminho);
        return r?.estado === 'ok' && r.id === p.id;
      });
      const melhor = validos[0];
      // Ilegível (ou leitor indisponível): fica onde está, sem oferta, e é registrado. Nada é apagado sem decisão.
      if (melhor === undefined) {
        log(`[recuperacao] instantâneos de ${p.conjunto} ilegíveis; mantidos`);
        continue;
      }
      // Oferecido mesmo que o arquivo do usuário seja mais novo (relógio, sincronização): quem decide é o usuário (M3).
      const arquivo = p.trava ? await infoArquivo(p.trava.caminho) : null;
      const resumo = resumos.get(melhor.caminho);
      ofertas.push({
        tipo: 'instantaneo',
        dono,
        conjunto: p.conjunto,
        candidatos: validos.map((v) => v.caminho),
        original: p.trava?.caminho ?? null,
        publica: {
          tipo: 'instantaneo',
          nomeArquivo: p.trava ? basename(p.trava.caminho) : 'Trabalho recuperado.bdp',
          titulo: resumo?.estado === 'ok' ? resumo.titulo : '',
          quando: melhor.modificadoEmMs,
          arquivoSalvoExiste: arquivo !== null,
        },
      });
    }
    // Trava sem instantâneo e sem sessão: o app parou sem alteração pendente; não há o que oferecer.
    for (const conjunto of await listarTravas(pastas, op)) {
      if (!ativo(conjunto) && (await instantaneosDe(pastas, conjunto, op)).length === 0) await apagarTrava(pastas, conjunto, op);
    }
    return ofertas;
  }

  async function ofertasDaBiblioteca(dono: number): Promise<OfertaInterna[]> {
    const pasta = await dep.pastaBiblioteca().catch(() => null);
    if (pasta === null) return [];
    const restos = await procurarRestos(pasta, dep.pid, agoraMs(), fs);
    // Cópia incompleta do original: o original continua no lugar.
    for (const c of restos.copiasBak) await fs.apagar(c).catch(() => undefined);
    // Arquivo aberto no app: não se mexe nele nem nos restos dele.
    const temporarios = restos.temporarios.filter((t) => !dep.projetos.contem(t.original));
    const baks = restos.baks.filter((b) => !dep.projetos.contem(b.original));
    if (temporarios.length === 0 && baks.length === 0) return [];

    const originais = await resumirTodos([...temporarios.map((t) => t.caminho), ...temporarios.map((t) => t.original), ...baks.map((b) => b.original)]);
    const naoAbre = (c: string) => originais.get(c)?.estado === 'invalido';
    const ofertas: OfertaInterna[] = [];
    const oferecer = async (tipo: TipoOferta, candidato: string, original: string, resumo: ResumoProjeto | null | undefined) => {
      const info = await infoArquivo(candidato);
      if (info === null || resumo?.estado !== 'ok') return;
      ofertas.push({
        tipo,
        dono,
        conjunto: null,
        candidatos: [candidato],
        original,
        publica: { tipo, nomeArquivo: basename(original), titulo: resumo.titulo, quando: info.modificadoEmMs, arquivoSalvoExiste: (await infoArquivo(original)) !== null },
      });
    };

    for (const t of temporarios) {
      // Leitura que falhou (leitor caiu): decide na próxima listagem.
      if (originais.get(t.original) == null || originais.get(t.caminho) == null) continue;
      const temporarioOk = originais.get(t.caminho)?.estado === 'ok';
      if (temporarioOk && naoAbre(t.original)) {
        await oferecer('temporario', t.caminho, t.original, originais.get(t.caminho));
        continue;
      }
      // Original íntegro (o temporário é de um salvamento que não terminou) ou temporário incompleto: 7 dias guardado.
      if ((await arquivar(pastas, t.caminho, basename(t.caminho), agoraMs(), fs)) !== null) log('[recuperacao] temporário órfão guardado em recuperacao-antigos');
    }

    // `.bak` só importa quando o original existe e não abre (original ausente = trabalho excluído pelo usuário).
    const candidatosBak = [];
    for (const b of baks) if (naoAbre(b.original) && (await infoArquivo(b.original)) !== null) candidatosBak.push(b);
    const resumosBak = await resumirTodos(candidatosBak.map((b) => b.caminho));
    for (const b of candidatosBak) await oferecer('bak', b.caminho, b.original, resumosBak.get(b.caminho));
    return ofertas;
  }

  const listar: Manipulador = async (r, argumentos): Promise<ResultadoListarRecuperacao> => {
    conferir(CANAIS_RECUPERACAO.listar, r, argumentos, 0);
    return emFila(async () => {
      await limparAntigos(pastas, agoraMs(), op);
      esquecerOfertas(r.idConteudo);
      const todas = [...(await ofertasDeInstantaneos(r.idConteudo)), ...(await ofertasDaBiblioteca(r.idConteudo))];
      const publicas: OfertaRecuperacao[] = [];
      for (const o of todas) {
        const identificador = registroOfertas.registrar(`oferta:${++contador}`, r.idConteudo);
        internas.set(identificador, o);
        publicas.push({ identificador, ...o.publica });
      }
      publicas.sort((a, b) => b.quando - a.quando);
      return { ofertas: publicas };
    });
  };

  // ---------- instantâneo ----------

  const instantaneo: Manipulador = async (r, argumentos): Promise<ResultadoInstantaneo> => {
    const canal = CANAIS_RECUPERACAO.instantaneo;
    conferir(canal, r, argumentos, 2);
    const id = lerIdentificador(argumentos[0]) ?? recusarArgumento(canal, 'identificador');
    const p = lerPacoteTransferivel(argumentos[1], dep.projetos.midias(id, r.idConteudo) ?? new Map());
    if (!p.ok && p.recusado) return recusarArgumento(canal, `pacote (${p.motivo})`);
    if (dep.projetos.caminho(id, r.idConteudo) === null) return { ok: false, codigo: 'NAO_ABERTO' };
    if (!p.ok) return { ok: false, codigo: p.midiaAusente ? 'MIDIA_AUSENTE' : 'PACOTE_INVALIDO' };
    // O id que nomeia a pasta é o registrado pelo principal; pacote de outro id é recusado (revisão M1).
    const idProjeto = dep.projetos.idProjeto(id, r.idConteudo) ?? p.valor.manifesto.id;
    if (p.valor.manifesto.id !== idProjeto) return { ok: false, codigo: 'PACOTE_INVALIDO' };
    const pacote = p.valor;
    // Empacotar (no worker, M2-T01) dentro da fila: instantâneos e ganchos continuam na ordem de chegada, como quando o
    // empacotamento era síncrono.
    return emFila(async () => {
      const empacotado = await empacotar(pacote);
      if (!empacotado.ok) return { ok: false, codigo: 'PACOTE_INVALIDO' };
      // Conferido pelo empacotamento: as mídias dele viram as conhecidas (revisão do M2-T01, F1).
      dep.projetos.trocarMidias(id, r.idConteudo, pacote.midias);
      // Fechado enquanto esperava a vez: não grava nada depois da limpeza do fechamento.
      const caminho = dep.projetos.caminho(id, r.idConteudo);
      if (caminho === null) return { ok: false, codigo: 'NAO_ABERTO' };
      const s = sessoes.get(idProjeto);
      if (s === undefined) {
        // Instantâneos de uma queda ainda não decidida: reservados (continuam oferecidos), nunca substituídos (A2).
        const restantes = await instantaneosDe(pastas, idProjeto, op);
        if (restantes.length > 0 && !(await reservarInstantaneos(pastas, idProjeto, agoraMs(), op))) {
          log(`[recuperacao] não foi possível reservar os instantâneos de ${idProjeto}; instantâneo novo não gravado`);
          return { ok: false, codigo: 'FALHA_DISCO' };
        }
        await iniciarSessao(idProjeto, caminho, r.idConteudo);
      } else if (s.dono !== r.idConteudo || chaveCaminho(s.caminho) !== chaveCaminho(caminho)) {
        await iniciarSessao(idProjeto, caminho, r.idConteudo);
      }
      const g = await gravarInstantaneo(pastas, idProjeto, empacotado.bytes, op);
      if (g.ok) {
        geracoes.set(idProjeto, (geracoes.get(idProjeto) ?? 0) + 1);
        return { ok: true };
      }
      log(`[recuperacao] instantâneo de ${idProjeto} falhou: ${g.detalhe ?? 'erro'}`);
      return { ok: false, codigo: 'FALHA_DISCO' };
    });
  };

  // ---------- recuperar e abrir o salvo ----------

  const ofertaDe = (canal: CanalRecuperacao, r: { idConteudo: number }, valor: unknown) => {
    const id = lerIdentificador(valor) ?? recusarArgumento(canal, 'oferta');
    const o = internas.get(id);
    return o !== undefined && o.dono === r.idConteudo ? { id, o } : null;
  };
  const retirar = (id: string, dono: number) => {
    internas.delete(id);
    registroOfertas.esquecer(id, dono);
  };

  /**
   * O arquivo de origem ainda pode receber a versão recuperada? Só se falta (a pasta é a mesma), não abre, ou é o
   * mesmo projeto. Outro projeto no mesmo caminho (renomeado, substituído) nunca é sobrescrito (revisão M2).
   */
  async function origemAceita(original: string, idProjeto: string): Promise<boolean> {
    if ((await infoArquivo(original)) === null) return true;
    const r = (await dep.resumir([original]))?.[0];
    return r !== undefined && (r.estado === 'invalido' || (r.estado === 'ok' && r.id === idProjeto));
  }

  async function recuperarInstantaneo(id: string, o: OfertaInterna, dono: number): Promise<ResultadoRecuperar> {
    const conjunto = o.conjunto!;
    const idProjeto = idDoConjunto(conjunto);
    const original = o.original;
    if (sessoes.has(idProjeto) || (original !== null && dep.projetos.contem(original))) return { ok: false, mensagem: MENSAGEM_JA_ABERTO };
    let lido: Extract<RespostaLeitor, { ok: true }> | null = null;
    for (const c of o.candidatos) {
      const l = await dep.ler(c);
      if (l.ok && l.pacote.manifesto.id === idProjeto) {
        lido = l;
        break;
      }
    }
    if (lido === null) return { ok: false, mensagem: MENSAGEM_ILEGIVEL };
    // A versão recuperada vira o conjunto da sessão (protegida até o próximo salvamento).
    if (!(await promoverConjunto(pastas, conjunto, agoraMs(), op))) return { ok: false, mensagem: MENSAGEM_DISCO };
    const avisos: AvisoProjeto[] = [...lido.avisos];
    let identificador: string | null = null;
    if (original !== null && ehArquivoProjeto(basename(original))) {
      if (await origemAceita(original, idProjeto)) identificador = dep.projetos.registrar(original, dono, idProjeto, mapaMidias(lido.pacote.midias));
      else {
        avisos.push({
          caminho: 'arquivo',
          mensagem: `O arquivo “${basename(original)}” agora guarda outro trabalho e não foi alterado. Use “Salvar como…” para guardar a versão recuperada.`,
        });
      }
    }
    await iniciarSessao(idProjeto, identificador !== null ? original! : '', dono);
    retirar(id, dono);
    return {
      ok: true,
      tipo: 'instantaneo',
      quando: o.publica.quando,
      projeto: { identificador, nomeArquivo: o.publica.nomeArquivo, pacote: lido.pacote, avisos, atualizacao: null },
    };
  }

  async function restaurar(id: string, o: OfertaInterna, dono: number): Promise<ResultadoRecuperar> {
    const original = o.original!;
    const candidato = o.candidatos[0]!;
    if (dep.projetos.contem(original)) return { ok: false, mensagem: MENSAGEM_JA_ABERTO };
    // Confere de novo: outra oferta pode já ter restaurado o arquivo, ou o usuário o consertou por fora.
    const agora = (await dep.resumir([original]))?.[0];
    if (agora === undefined) return { ok: false, mensagem: MENSAGEM_ILEGIVEL };
    if (agora.estado !== 'invalido') {
      retirar(id, dono);
      return { ok: false, mensagem: MENSAGEM_JA_ABRE };
    }
    const lido = await dep.ler(candidato);
    if (!lido.ok) return { ok: false, mensagem: MENSAGEM_ILEGIVEL };
    const pacote = lerPacoteTransferivel(lido.pacote);
    if (!pacote.ok) return { ok: false, mensagem: MENSAGEM_ILEGIVEL };
    // O arquivo que não abre vai para `recuperacao-antigos` (7 dias), e não para o `.bak`: o `.bak` íntegro fica. Se
    // não der para guardá-lo, nada muda (revisão A4).
    let guardado: string | null = null;
    if ((await infoArquivo(original)) !== null) {
      guardado = await arquivar(pastas, original, `${basename(original)}-danificado`, agoraMs(), fs);
      if (guardado === null) return { ok: false, mensagem: MENSAGEM_SEM_GUARDAR };
    }
    const s = await dep.salvar(original, pacote.valor);
    if (!s.ok) {
      // O arquivo volta ao lugar como estava (danificado, mas é o do usuário); a cópia em `recuperacao-antigos` fica.
      if (guardado !== null) await fs.copiar(guardado, original).catch((e: unknown) => log(`[recuperacao] original não devolvido: ${descreverErro(e)}`));
      return { ok: false, mensagem: s.mensagem };
    }
    if (o.tipo === 'temporario') await fs.apagar(candidato).catch(() => undefined);
    retirar(id, dono);
    return {
      ok: true,
      tipo: o.tipo,
      quando: o.publica.quando,
      projeto: {
        identificador: dep.projetos.registrar(original, dono, pacote.valor.manifesto.id, pacote.valor.midias),
        nomeArquivo: basename(original),
        pacote: lido.pacote,
        avisos: lido.avisos,
        atualizacao: null,
      },
    };
  }

  const recuperar: Manipulador = async (r, argumentos): Promise<ResultadoRecuperar> => {
    const canal = CANAIS_RECUPERACAO.recuperar;
    conferir(canal, r, argumentos, 1);
    lerIdentificador(argumentos[0]) ?? recusarArgumento(canal, 'oferta');
    return emFila(async () => {
      const achada = ofertaDe(canal, r, argumentos[0]);
      if (achada === null) return { ok: false, mensagem: MENSAGEM_OFERTA_VENCIDA };
      const { id, o } = achada;
      return o.tipo === 'instantaneo' ? recuperarInstantaneo(id, o, r.idConteudo) : restaurar(id, o, r.idConteudo);
    });
  };

  const abrirSalvo: Manipulador = async (r, argumentos): Promise<ResultadoAbrir> => {
    const canal = CANAIS_RECUPERACAO.abrirSalvo;
    conferir(canal, r, argumentos, 1);
    lerIdentificador(argumentos[0]) ?? recusarArgumento(canal, 'oferta');
    return emFila(async () => {
      const achada = ofertaDe(canal, r, argumentos[0]);
      const erro = (nomeArquivo: string, mensagem: string): ResultadoAbrir => ({ ok: false, motivo: 'ERRO', nomeArquivo, mensagem, erros: [] });
      if (achada === null) return erro('', MENSAGEM_OFERTA_VENCIDA);
      const { id, o } = achada;
      const nome = o.publica.nomeArquivo;
      if (o.tipo !== 'instantaneo' || o.original === null) return erro(nome, `O arquivo salvo de “${nome}” não foi encontrado.`);
      const conjunto = o.conjunto!;
      if (sessoes.has(idDoConjunto(conjunto)) || dep.projetos.contem(o.original)) return erro(nome, MENSAGEM_JA_ABERTO);
      const lido = await dep.ler(o.original);
      const resposta = respostaAbrir(o.original, lido, dep.projetos, r.idConteudo);
      // Só depois de o arquivo abrir a versão recuperada sai da lista (para `recuperacao-antigos`, 7 dias).
      if (resposta.ok) {
        await arquivarInstantaneos(pastas, conjunto, agoraMs(), op);
        await apagarTrava(pastas, conjunto, op);
        retirar(id, r.idConteudo);
      }
      return resposta;
    });
  };

  // ---------- versões descartadas (M2-T11) ----------

  const listarDescartadas: Manipulador = async (r, argumentos): Promise<ResultadoListarDescartadas> => {
    conferir(CANAIS_RECUPERACAO.listarDescartadas, r, argumentos, 0);
    return emFila(async () => {
      esquecerDescartadas(r.idConteudo);
      await limparAntigos(pastas, agoraMs(), op);
      const arquivos: { caminho: string; modificadoEmMs: number }[] = [];
      try {
        for (const e of await fs.listarPasta(pastas.antigos)) {
          if (!e.arquivoComum || e.link) continue;
          const caminho = join(pastas.antigos, e.nome);
          const i = await infoArquivo(caminho);
          if (i !== null) arquivos.push({ caminho, modificadoEmMs: i.modificadoEmMs });
        }
      } catch {
        return { versoes: [], incompleta: false }; // pasta ainda não existe ou não abre
      }
      arquivos.sort((a, b) => b.modificadoEmMs - a.modificadoEmMs);
      const lote = arquivos.slice(0, MAX_VERSOES_DESCARTADAS);
      const resumos = await resumirTodos(lote.map((a) => a.caminho));
      let incompleta = false;
      const versoes: VersaoDescartada[] = [];
      lote.forEach((a) => {
        const resumo = resumos.get(a.caminho);
        if (resumo === null || resumo === undefined) incompleta = true; // o leitor falhou: não é o mesmo que não haver versão
        if (resumo?.estado !== 'ok') return; // danificado ou de versão futura: não abre aqui
        const identificador = registroOfertas.registrar(`descartada:${++contador}`, r.idConteudo);
        descartadas.set(identificador, { caminho: a.caminho, dono: r.idConteudo, quando: a.modificadoEmMs });
        // `atualizadoEm` é a data do último salvamento, não a do texto: vale a hora em que a versão foi guardada (R-M2-09).
        versoes.push({
          identificador,
          titulo: resumo.titulo,
          quando: a.modificadoEmMs,
          anterior: basename(a.caminho).includes(`-${NOME_INSTANTANEO_ANTERIOR}`),
        });
      });
      return { versoes, incompleta };
    });
  };

  const abrirDescartada: Manipulador = async (r, argumentos): Promise<ResultadoAbrirDescartada> => {
    const canal = CANAIS_RECUPERACAO.abrirDescartada;
    conferir(canal, r, argumentos, 1);
    const id = lerIdentificador(argumentos[0]) ?? recusarArgumento(canal, 'versão');
    return emFila(async () => {
      const d = descartadas.get(id);
      if (d === undefined || d.dono !== r.idConteudo) return { ok: false, mensagem: MENSAGEM_DESCARTADA_ILEGIVEL };
      const lido = await dep.ler(d.caminho);
      if (!lido.ok) return { ok: false, mensagem: MENSAGEM_DESCARTADA_ILEGIVEL };
      const idProjeto = lido.pacote.manifesto.id;
      if (sessoes.has(idProjeto)) return { ok: false, mensagem: MENSAGEM_JA_ABERTO };
      return {
        ok: true,
        quando: d.quando,
        projeto: { identificador: null, nomeArquivo: 'Versão descartada.bdp', pacote: lido.pacote, avisos: [...lido.avisos], atualizacao: null },
      };
    });
  };

  return {
    manipuladores: Object.freeze({
      [CANAIS_RECUPERACAO.instantaneo]: instantaneo,
      [CANAIS_RECUPERACAO.listar]: listar,
      [CANAIS_RECUPERACAO.recuperar]: recuperar,
      [CANAIS_RECUPERACAO.abrirSalvo]: abrirSalvo,
      [CANAIS_RECUPERACAO.listarDescartadas]: listarDescartadas,
      [CANAIS_RECUPERACAO.abrirDescartada]: abrirDescartada,
    }) as Readonly<Record<CanalRecuperacao, Manipulador>>,
    antesDeGravar,
    aoGravar,
    aoFechar,
    encerrarDono,
    aguardar,
  };
}

/** Pastas de recuperação dentro de `%LOCALAPPDATA%\BiblioDocsPro`. */
export const pastasRecuperacao = (dadosLocais: string): PastasRecuperacao => ({
  recuperacao: join(dadosLocais, 'recuperacao'),
  antigos: join(dadosLocais, 'recuperacao-antigos'),
  sessao: join(dadosLocais, 'sessao'),
});
