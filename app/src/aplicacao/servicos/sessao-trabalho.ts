/**
 * Serviço `SessaoTrabalho` (M1-T11; ADR-0004, seção 4, "Salvamento" item 7 e "Comportamento do salvamento automático"):
 * o trabalho aberto no renderer, o estado de salvamento mostrado no visor e o salvamento automático escolhido pelo
 * usuário (opção 1): grava no arquivo ~30 s depois da última alteração, ao trocar de trabalho e ao fechar; Ctrl+S
 * grava na hora.
 *
 * Regras:
 * - nenhuma falha silenciosa (S-11): todo erro vira `salvamento: erro` com a mensagem do principal, e um aviso que
 *   oferece "Salvar como…";
 * - um salvamento por vez: pedido durante outro espera o primeiro e grava de novo só se houve alteração no meio;
 * - alteração feita durante a gravação mantém "Alterações não salvas" e reagenda o automático;
 * - trabalho de versão futura abre só para leitura: o tipo `PacoteSomenteLeituraTransferivel` nunca chega a `salvar`;
 * - arquivo sem identificador (não `.bdp`) só grava por "Salvar como…": o automático não abre diálogo;
 * - recuperação (M1-T12): até cerca de 2 s depois de uma alteração, o pacote vai para o instantâneo de recuperação
 *   (`%LOCALAPPDATA%`, nunca o arquivo do usuário). É um limite, não uma espera que recomeça a cada tecla: quem digita
 *   sem parar também tem instantâneos. Um por vez; falha vira aviso, sem tirar o "Salvo"/"Alterações não salvas".
 *   Documento que demora a empacotar e gravar espaça os instantâneos (4 × a duração do último), para não ocupar o
 *   processo principal o tempo todo (revisão do M1-T12, M5);
 * - mídias uma vez (M2-T01, R36): o instantâneo e o salvar mandam só a chave das mídias que o principal já tem daquele
 *   identificador (as do arquivo aberto e as enviadas antes com sucesso); se ele responder `MIDIA_AUSENTE`, o mesmo
 *   pedido volta com os bytes de todas.
 *
 * Puro (sem DOM e sem Node): a API, o relógio e o agendador entram por dependência, e os testes rodam em Node com
 * agendador manual (tests/sessao-trabalho.test.ts).
 */
import type { InlineDeTitulo, TipoTrabalhoId } from '../../dominio/modelo';
import type { ApiRecuperacao } from '../portas/recuperacao';
import {
  CODIGO_MIDIA_AUSENTE,
  type ApiProjetos,
  type IdentificadorProjeto,
  type PacoteEnvio,
  type PacoteSomenteLeituraTransferivel,
  type PacoteTransferivel,
  type ProjetoAberto,
} from '../portas/projetos';

/** Espera do salvamento automático depois da última alteração (decisão do usuário, ADR-0004). */
export const ATRASO_SALVAMENTO_AUTOMATICO_MS = 30_000;
/** Limite entre uma alteração e o instantâneo de recuperação (ADR-0004: "com espera de cerca de 2 s"). */
export const ATRASO_INSTANTANEO_MS = 2_000;
/** Instantâneos lentos (documento grande) espaçam os seguintes: atraso = máx(2 s, 4 × duração do último). */
export const FATOR_ESPACAMENTO_INSTANTANEO = 4;

export const MENSAGEM_FALHA_INESPERADA =
  'O aplicativo não conseguiu falar com o processo de gravação. Tente de novo; se continuar, use “Salvar como…”.';
export const MENSAGEM_SEM_DESTINO =
  'Este arquivo não é um trabalho .bdp e não pode ser gravado no lugar. Use “Salvar como…” para guardar as alterações.';
export const MENSAGEM_FALHA_INSTANTANEO =
  'A cópia de recuperação não pôde ser gravada. O trabalho continua sendo salvo no arquivo; se puder, salve com Ctrl+S.';

export type SalvamentoSessao =
  /** `em` = hora da última gravação nesta sessão; `null` logo depois de abrir. */
  | { tipo: 'salvo'; em: Date | null }
  | { tipo: 'salvando' }
  | { tipo: 'naoSalvo' }
  | { tipo: 'erro'; codigo: string; mensagem: string }
  | { tipo: 'somenteLeitura' };

/** Ação que a interface oferece junto do aviso. */
export type AcaoAviso = 'salvarComo' | 'descartar';

export interface AvisoSessao {
  nivel: 'erro' | 'alerta' | 'info';
  texto: string;
  acoes: AcaoAviso[];
}

export interface TrabalhoDaSessao {
  nomeArquivo: string;
  /** Título como texto editável (concatenação dos trechos, sem marcas). */
  titulo: string;
  tipoTrabalho: TipoTrabalhoId | string;
  somenteLeitura: boolean;
  /** Pode gravar no próprio arquivo (tem identificador e não é só leitura). */
  podeSalvar: boolean;
  salvamento: SalvamentoSessao;
}

export interface EstadoSessao {
  trabalho: TrabalhoDaSessao | null;
  avisos: AvisoSessao[];
}

/** Cancela um agendamento. */
export type Cancelar = () => void;

export interface DependenciasSessao {
  api: Pick<ApiProjetos, 'salvar' | 'salvarComo' | 'fechar'>;
  agora: () => Date;
  agendar: (acao: () => void, ms: number) => Cancelar;
  atrasoAutomaticoMs?: number;
  /** Chamado depois de cada gravação bem-sucedida (a biblioteca relê o índice). */
  aoSalvar?: () => void;
  /** Instantâneo de recuperação (M1-T12). Sem ele, a sessão não grava instantâneos. */
  instantaneo?: ApiRecuperacao['instantaneo'];
  atrasoInstantaneoMs?: number;
}

export interface OpcoesAbrir {
  /**
   * Versão recuperada que ainda não está no arquivo (instantâneo): abre como "Alterações não salvas" e o automático
   * a grava no arquivo em 30 s.
   */
  naoSalvo?: boolean;
}

type Aberto =
  | {
      modo: 'edicao';
      identificador: IdentificadorProjeto | null;
      nomeArquivo: string;
      pacote: PacoteTransferivel;
      /** Chaves das mídias que o principal já tem para `identificador` (vão sem os bytes). */
      midiasNoPrincipal: Set<string>;
    }
  | { modo: 'leitura'; nomeArquivo: string; pacote: PacoteSomenteLeituraTransferivel };

/** Texto editável de um título: os trechos juntos, como foram digitados. */
export function textoDoTitulo(titulo: readonly InlineDeTitulo[]): string {
  return titulo.map((i) => i.texto).join('');
}

/**
 * Título digitado → `InlineDeTitulo[]`. Sem alteração no texto, devolve o original (preserva itálico de nome científico).
 * Com alteração, vira um trecho só, sem marcas: o editor de texto rico chega no M2 [HIPÓTESE aceitável no M1: nenhum
 * caminho do M1 cria título com marcas].
 */
export function tituloDoTexto(texto: string, atual: readonly InlineDeTitulo[]): InlineDeTitulo[] {
  if (texto === textoDoTitulo(atual)) return [...atual];
  return texto === '' ? [] : [{ tipo: 'texto', texto }];
}

const chavesDasMidias = (p: PacoteTransferivel | null): Set<string> => new Set(p?.midias.map((m) => m.sha256));

/** As mídias em `conhecidas` vão só com a chave. */
export function paraEnvio(p: PacoteTransferivel, conhecidas: ReadonlySet<string>): PacoteEnvio {
  return { ...p, midias: p.midias.map((m) => (conhecidas.has(m.sha256) ? { sha256: m.sha256 } : m)) };
}

export class SessaoTrabalho {
  readonly #dep: DependenciasSessao;
  readonly #ouvintes = new Set<() => void>();
  #aberto: Aberto | null = null;
  #salvamento: SalvamentoSessao = { tipo: 'salvo', em: null };
  #avisos: AvisoSessao[] = [];
  /** Conta as alterações; `#revisaoSalva` é a revisão gravada por último. */
  #revisao = 0;
  #revisaoSalva = 0;
  #gravacao: Promise<boolean> | null = null;
  #cancelarAutomatico: Cancelar | null = null;
  #cancelarInstantaneo: Cancelar | null = null;
  #instantaneoEmCurso = false;
  /** Duração do último instantâneo (ms), para espaçar os seguintes em documentos grandes. */
  #duracaoInstantaneo = 0;
  #estado: EstadoSessao = { trabalho: null, avisos: [] };

  constructor(dep: DependenciasSessao) {
    this.#dep = dep;
  }

  // ---------- leitura do estado (forma de `useSyncExternalStore`) ----------

  assinar = (ouvinte: () => void): (() => void) => {
    this.#ouvintes.add(ouvinte);
    return () => this.#ouvintes.delete(ouvinte);
  };

  /** Mesmo objeto até a próxima mudança. */
  obterEstado = (): EstadoSessao => this.#estado;

  /** Há algo que ainda não está no arquivo (alteração pendente ou gravação em curso). */
  get temPendencias(): boolean {
    return this.#temAlteracoes() || (this.#aberto?.modo === 'edicao' && this.#gravacao !== null);
  }

  #temAlteracoes(): boolean {
    return this.#aberto?.modo === 'edicao' && this.#revisao !== this.#revisaoSalva;
  }

  /** Pacote atual (para "Salvar como…" e testes); `null` sem trabalho em edição. */
  get pacote(): PacoteTransferivel | null {
    return this.#aberto?.modo === 'edicao' ? this.#aberto.pacote : null;
  }

  #emitir(): void {
    const a = this.#aberto;
    this.#estado = {
      trabalho:
        a === null
          ? null
          : {
              nomeArquivo: a.nomeArquivo,
              titulo: textoDoTitulo(a.pacote.documento.metadados.titulo),
              tipoTrabalho: a.pacote.manifesto.tipoTrabalho,
              somenteLeitura: a.modo === 'leitura',
              podeSalvar: a.modo === 'edicao' && a.identificador !== null,
              salvamento: this.#salvamento,
            },
      avisos: this.#avisos,
    };
    for (const o of this.#ouvintes) o();
  }

  #avisar(aviso: AvisoSessao): void {
    this.#avisos = [...this.#avisos.filter((a) => a.texto !== aviso.texto), aviso];
  }

  limparAvisos(): void {
    if (this.#avisos.length === 0) return;
    this.#avisos = [];
    this.#emitir();
  }

  #pararAutomatico(): void {
    this.#cancelarAutomatico?.();
    this.#cancelarAutomatico = null;
  }

  #agendarAutomatico(): void {
    this.#pararAutomatico();
    const a = this.#aberto;
    if (a?.modo !== 'edicao' || a.identificador === null) return;
    this.#cancelarAutomatico = this.#dep.agendar(() => {
      this.#cancelarAutomatico = null;
      void this.salvar();
    }, this.#dep.atrasoAutomaticoMs ?? ATRASO_SALVAMENTO_AUTOMATICO_MS);
  }

  // ---------- instantâneo de recuperação ----------

  #pararInstantaneo(): void {
    this.#cancelarInstantaneo?.();
    this.#cancelarInstantaneo = null;
  }

  /** Agenda o instantâneo se nenhum estiver agendado ou em curso (limite, não espera que recomeça). */
  #agendarInstantaneo(): void {
    if (this.#dep.instantaneo === undefined || this.#cancelarInstantaneo !== null || this.#instantaneoEmCurso) return;
    const a = this.#aberto;
    if (a?.modo !== 'edicao' || a.identificador === null) return;
    this.#cancelarInstantaneo = this.#dep.agendar(() => {
      this.#cancelarInstantaneo = null;
      void this.#gravarInstantaneo(a);
    }, Math.max(this.#dep.atrasoInstantaneoMs ?? ATRASO_INSTANTANEO_MS, FATOR_ESPACAMENTO_INSTANTANEO * this.#duracaoInstantaneo));
  }

  async #gravarInstantaneo(a: Extract<Aberto, { modo: 'edicao' }>): Promise<void> {
    const enviar = this.#dep.instantaneo;
    const identificador = a.identificador;
    // Já gravado no arquivo (o salvamento apaga os instantâneos): nada a guardar.
    if (enviar === undefined || identificador === null || this.#aberto !== a || !this.#temAlteracoes()) return;
    const revisao = this.#revisao;
    this.#instantaneoEmCurso = true;
    const inicio = this.#dep.agora().getTime();
    let ok: boolean;
    try {
      ok = (await this.#enviarComMidias(a, a.pacote, (p) => enviar(identificador, p), (r) => !r.ok && r.codigo === CODIGO_MIDIA_AUSENTE)).ok;
    } catch {
      ok = false;
    }
    this.#duracaoInstantaneo = Math.max(0, this.#dep.agora().getTime() - inicio);
    this.#instantaneoEmCurso = false;
    if (this.#aberto !== a) return;
    const tinhaAviso = this.#avisos.some((x) => x.texto === MENSAGEM_FALHA_INSTANTANEO);
    if (!ok && !tinhaAviso) {
      this.#avisar({ nivel: 'alerta', texto: MENSAGEM_FALHA_INSTANTANEO, acoes: [] });
      this.#emitir();
    } else if (ok && tinhaAviso) {
      this.#avisos = this.#avisos.filter((x) => x.texto !== MENSAGEM_FALHA_INSTANTANEO);
      this.#emitir();
    }
    // Alteração feita durante o envio: outro instantâneo.
    if (this.#revisao !== revisao) this.#agendarInstantaneo();
  }

  // ---------- abrir e fechar ----------

  /** Passa a editar `projeto`. O trabalho anterior é liberado sem gravar: chame `garantirSalvo` antes. */
  abrir(projeto: ProjetoAberto, avisos: AvisoSessao[] = [], opcoes: OpcoesAbrir = {}): void {
    this.#liberar();
    const a: Aberto = {
      modo: 'edicao',
      identificador: projeto.identificador,
      nomeArquivo: projeto.nomeArquivo,
      pacote: projeto.pacote,
      // O principal guarda as mídias do arquivo que ele mesmo entregou com o identificador.
      midiasNoPrincipal: chavesDasMidias(projeto.identificador === null ? null : projeto.pacote),
    };
    this.#aberto = a;
    this.#salvamento = { tipo: 'salvo', em: null };
    this.#avisos = [...avisos];
    if (projeto.identificador === null) this.#avisar({ nivel: 'alerta', texto: MENSAGEM_SEM_DESTINO, acoes: ['salvarComo'] });
    if (opcoes.naoSalvo) {
      this.#revisao = 1;
      this.#salvamento = { tipo: 'naoSalvo' };
      this.#agendarAutomatico();
    }
    this.#emitir();
  }

  /** Mostra um trabalho de versão futura, sem edição nem gravação. */
  abrirSomenteLeitura(nomeArquivo: string, pacote: PacoteSomenteLeituraTransferivel, avisos: AvisoSessao[] = []): void {
    this.#liberar();
    this.#aberto = { modo: 'leitura', nomeArquivo, pacote };
    this.#salvamento = { tipo: 'somenteLeitura' };
    this.#avisos = [...avisos];
    this.#emitir();
  }

  #liberar(): void {
    this.#pararAutomatico();
    this.#pararInstantaneo();
    this.#instantaneoEmCurso = false;
    const a = this.#aberto;
    if (a?.modo === 'edicao' && a.identificador !== null) {
      // Esquecer o identificador não pode falhar de um jeito que importe: no pior caso ele morre com a janela.
      this.#dep.api.fechar(a.identificador).catch(() => {});
    }
    this.#aberto = null;
    this.#revisao = 0;
    this.#revisaoSalva = 0;
    this.#gravacao = null;
  }

  /**
   * Grava o que estiver pendente. `true` = nada ficou de fora (inclusive sem trabalho ou só leitura); `false` = há
   * alterações que não foram para o arquivo, com o motivo no visor e nos avisos.
   */
  async garantirSalvo(): Promise<boolean> {
    // Alteração feita enquanto gravava pede outra volta; o limite evita laço se o usuário não para de digitar.
    for (let volta = 0; volta < 5; volta++) {
      if (this.#gravacao !== null) await this.#gravacao;
      if (!this.#temAlteracoes()) return true;
      if (!(await this.salvar())) return false;
    }
    return !this.#temAlteracoes();
  }

  /** Fecha o trabalho gravando antes; com `descartar`, fecha mesmo com alterações pendentes. */
  async fechar(opcoes: { descartar?: boolean } = {}): Promise<boolean> {
    if (this.#aberto === null) return true;
    if (!opcoes.descartar && !(await this.garantirSalvo())) {
      this.#avisar({
        nivel: 'erro',
        texto: 'O trabalho não foi fechado porque as alterações não foram salvas.',
        acoes: ['salvarComo', 'descartar'],
      });
      this.#emitir();
      return false;
    }
    // Descartar durante uma gravação não a interrompe: o principal termina de gravar o pacote que já recebeu.
    this.#liberar();
    this.#salvamento = { tipo: 'salvo', em: null };
    this.#avisos = [];
    this.#emitir();
    return true;
  }

  // ---------- edição ----------

  alterarTitulo(texto: string): void {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return;
    const atual = a.pacote.documento.metadados.titulo;
    if (texto === textoDoTitulo(atual)) return;
    a.pacote = {
      ...a.pacote,
      documento: { ...a.pacote.documento, metadados: { ...a.pacote.documento.metadados, titulo: tituloDoTexto(texto, atual) } },
    };
    this.#revisao += 1;
    // Durante a gravação o visor continua em "Salvando…"; o resultado decide o próximo estado. (Com o diálogo do
    // "Salvar como…" aberto ainda não há gravação no disco: a alteração aparece como não salva.)
    if (this.#salvamento.tipo !== 'salvando') this.#salvamento = { tipo: 'naoSalvo' };
    this.#agendarAutomatico();
    this.#agendarInstantaneo();
    this.#emitir();
  }

  // ---------- gravação ----------

  /**
   * Grava no próprio arquivo (Ctrl+S e salvamento automático). `true` = a gravação deu certo ou não havia o que gravar
   * (alterações feitas durante a gravação continuam pendentes e reagendam o automático).
   */
  salvar(): Promise<boolean> {
    const a = this.#aberto;
    if (a === null || a.modo === 'leitura') return Promise.resolve(a === null);
    if (a.identificador === null) {
      this.#avisar({ nivel: 'alerta', texto: MENSAGEM_SEM_DESTINO, acoes: ['salvarComo'] });
      this.#emitir();
      return Promise.resolve(false);
    }
    // Um por vez: o pedido seguinte espera e grava de novo só se algo mudou no meio.
    return this.#enfileirar(a, async () => {
      const identificador = a.identificador;
      if (identificador === null) return false;
      if (!this.#temAlteracoes()) return true;
      return this.#gravar(a, identificador);
    });
  }

  /**
   * Fila única de gravações (salvar, automático e "Salvar como…"): cada uma espera a anterior, e nada roda se o
   * trabalho foi trocado ou descartado no meio. Revisão do M1-T11: o "Salvar como…" fora da fila deixava o automático
   * gravar no arquivo antigo com o diálogo aberto e trocar o nome do arquivo de volta.
   */
  #enfileirar(a: Extract<Aberto, { modo: 'edicao' }>, tarefa: () => Promise<boolean>): Promise<boolean> {
    const anterior = this.#gravacao;
    const gravacao = (async () => {
      if (anterior !== null) await anterior;
      if (this.#aberto !== a) return false;
      return tarefa();
    })();
    this.#gravacao = gravacao;
    void gravacao.finally(() => {
      if (this.#gravacao === gravacao) {
        this.#gravacao = null;
        // Alteração feita durante a gravação: o automático volta a contar.
        if (this.#aberto === a && this.#temAlteracoes() && this.#cancelarAutomatico === null) this.#agendarAutomatico();
      }
    });
    return gravacao;
  }

  async #gravar(a: Extract<Aberto, { modo: 'edicao' }>, identificador: IdentificadorProjeto): Promise<boolean> {
    this.#pararAutomatico();
    const revisao = this.#revisao;
    const pacote = this.#comDataAtualizada(a.pacote);
    this.#salvamento = { tipo: 'salvando' };
    this.#emitir();
    let r: Awaited<ReturnType<ApiProjetos['salvar']>>;
    try {
      const ausente = (x: typeof r) => !x.ok && x.motivo === 'ERRO' && x.codigo === CODIGO_MIDIA_AUSENTE;
      r = await this.#enviarComMidias(a, pacote, (p) => this.#dep.api.salvar(identificador, p), ausente);
    } catch {
      r = { ok: false, motivo: 'ERRO', codigo: 'FALHA_INESPERADA', mensagem: MENSAGEM_FALHA_INESPERADA, erros: [] };
    }
    if (this.#aberto !== a) return false; // fechado com `descartar` durante a gravação
    if (!r.ok) {
      const mensagem = r.motivo === 'ERRO' ? r.mensagem : MENSAGEM_FALHA_INESPERADA;
      this.#salvamento = { tipo: 'erro', codigo: r.motivo === 'ERRO' ? r.codigo : r.motivo, mensagem };
      this.#avisar({ nivel: 'erro', texto: mensagem, acoes: ['salvarComo'] });
      this.#emitir();
      return false;
    }
    this.#concluir(a, pacote, revisao, r.nomeArquivo, r.avisos);
    return true;
  }

  /** "Salvar como…": diálogo do principal; o trabalho passa a ser o arquivo novo. Entra na fila de gravações. */
  salvarComo(): Promise<boolean> {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return Promise.resolve(false);
    this.#pararAutomatico();
    return this.#enfileirar(a, () => this.#gravarComo(a));
  }

  async #gravarComo(a: Extract<Aberto, { modo: 'edicao' }>): Promise<boolean> {
    // O automático pode ter sido agendado de novo enquanto esperava a vez.
    this.#pararAutomatico();
    const revisao = this.#revisao;
    const pacote = this.#comDataAtualizada(a.pacote);
    let r: Awaited<ReturnType<ApiProjetos['salvarComo']>>;
    try {
      r = await this.#dep.api.salvarComo(pacote);
    } catch {
      r = { ok: false, motivo: 'ERRO', codigo: 'FALHA_INESPERADA', mensagem: MENSAGEM_FALHA_INESPERADA, erros: [] };
    }
    if (this.#aberto !== a) {
      if (r.ok) this.#dep.api.fechar(r.identificador).catch(() => {});
      return false;
    }
    if (!r.ok) {
      if (r.motivo === 'CANCELADO') return false;
      this.#salvamento = { tipo: 'erro', codigo: r.codigo, mensagem: r.mensagem };
      this.#avisar({ nivel: 'erro', texto: r.mensagem, acoes: ['salvarComo'] });
      this.#emitir();
      return false;
    }
    const antigo = a.identificador;
    a.identificador = r.identificador;
    // O principal guardou com o identificador novo as mídias do pacote gravado.
    a.midiasNoPrincipal = chavesDasMidias(pacote);
    if (antigo !== null && antigo !== r.identificador) this.#dep.api.fechar(antigo).catch(() => {});
    this.#avisos = this.#avisos.filter((x) => !x.acoes.includes('salvarComo'));
    this.#concluir(a, pacote, revisao, r.nomeArquivo, r.avisos);
    return true;
  }

  /**
   * Manda `pacote` com só a chave das mídias que o principal já tem; se ele responder que falta uma (`ausente`),
   * reenvia com os bytes de todas. Depois de um envio aceito, todas passam a ser conhecidas.
   */
  async #enviarComMidias<R extends { ok: boolean }>(
    a: Extract<Aberto, { modo: 'edicao' }>,
    pacote: PacoteTransferivel,
    enviar: (p: PacoteEnvio) => Promise<R>,
    ausente: (r: R) => boolean,
  ): Promise<R> {
    const conhecidas = a.midiasNoPrincipal;
    let r = await enviar(paraEnvio(pacote, conhecidas));
    if (ausente(r)) {
      conhecidas.clear();
      r = await enviar(paraEnvio(pacote, conhecidas));
    }
    if (r.ok) for (const m of pacote.midias) conhecidas.add(m.sha256);
    return r;
  }

  #comDataAtualizada(p: PacoteTransferivel): PacoteTransferivel {
    return { ...p, manifesto: { ...p.manifesto, atualizadoEm: this.#dep.agora().toISOString() } };
  }

  #concluir(a: Extract<Aberto, { modo: 'edicao' }>, gravado: PacoteTransferivel, revisao: number, nomeArquivo: string, avisos: string[]): void {
    // O manifesto gravado (com a data nova) passa a valer, preservando o que foi alterado durante a gravação.
    a.pacote = { ...a.pacote, manifesto: gravado.manifesto };
    a.nomeArquivo = nomeArquivo;
    this.#revisaoSalva = revisao;
    this.#salvamento = this.#revisao === revisao ? { tipo: 'salvo', em: this.#dep.agora() } : { tipo: 'naoSalvo' };
    // Avisos do `.bak` não bloqueiam "Salvo" (ADR-0004; pendência do M1-T06).
    // O aviso do instantâneo também sai: o conteúdo está no arquivo.
    this.#avisos = this.#avisos.filter((x) => x.nivel !== 'erro' && x.texto !== MENSAGEM_FALHA_INSTANTANEO);
    for (const texto of avisos) this.#avisar({ nivel: 'alerta', texto, acoes: [] });
    this.#emitir();
    this.#dep.aoSalvar?.();
  }

  /** Para o agendamento (desmontar a interface). */
  encerrar(): void {
    this.#pararAutomatico();
    this.#pararInstantaneo();
  }
}
