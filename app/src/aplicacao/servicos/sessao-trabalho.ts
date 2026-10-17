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
 * - arquivo sem identificador (não `.bdp`) só grava por "Salvar como…": o automático não abre diálogo.
 *
 * Puro (sem DOM e sem Node): a API, o relógio e o agendador entram por dependência, e os testes rodam em Node com
 * agendador manual (tests/sessao-trabalho.test.ts).
 */
import type { Inline, TipoTrabalhoId } from '../../dominio/modelo';
import type {
  ApiProjetos,
  IdentificadorProjeto,
  PacoteSomenteLeituraTransferivel,
  PacoteTransferivel,
  ProjetoAberto,
} from '../portas/projetos';

/** Espera do salvamento automático depois da última alteração (decisão do usuário, ADR-0004). */
export const ATRASO_SALVAMENTO_AUTOMATICO_MS = 30_000;

export const MENSAGEM_FALHA_INESPERADA =
  'O aplicativo não conseguiu falar com o processo de gravação. Tente de novo; se continuar, use “Salvar como…”.';
export const MENSAGEM_SEM_DESTINO =
  'Este arquivo não é um trabalho .bdp e não pode ser gravado no lugar. Use “Salvar como…” para guardar as alterações.';

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
}

type Aberto =
  | { modo: 'edicao'; identificador: IdentificadorProjeto | null; nomeArquivo: string; pacote: PacoteTransferivel }
  | { modo: 'leitura'; nomeArquivo: string; pacote: PacoteSomenteLeituraTransferivel };

/** Texto editável de um título: os trechos juntos, como foram digitados. */
export function textoDoTitulo(titulo: readonly Inline[]): string {
  return titulo.map((i) => i.texto).join('');
}

/**
 * Título digitado → `Inline[]`. Sem alteração no texto, devolve o original (preserva itálico de nome científico).
 * Com alteração, vira um trecho só, sem marcas: o editor de texto rico chega no M2 [HIPÓTESE aceitável no M1: nenhum
 * caminho do M1 cria título com marcas].
 */
export function tituloDoTexto(texto: string, atual: readonly Inline[]): Inline[] {
  if (texto === textoDoTitulo(atual)) return [...atual];
  return texto === '' ? [] : [{ tipo: 'texto', texto }];
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

  // ---------- abrir e fechar ----------

  /** Passa a editar `projeto`. O trabalho anterior é liberado sem gravar: chame `garantirSalvo` antes. */
  abrir(projeto: ProjetoAberto, avisos: AvisoSessao[] = []): void {
    this.#liberar();
    this.#aberto = { modo: 'edicao', identificador: projeto.identificador, nomeArquivo: projeto.nomeArquivo, pacote: projeto.pacote };
    this.#salvamento = { tipo: 'salvo', em: null };
    this.#avisos = [...avisos];
    if (projeto.identificador === null) this.#avisar({ nivel: 'alerta', texto: MENSAGEM_SEM_DESTINO, acoes: ['salvarComo'] });
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
      r = await this.#dep.api.salvar(identificador, pacote);
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
    if (antigo !== null && antigo !== r.identificador) this.#dep.api.fechar(antigo).catch(() => {});
    this.#avisos = this.#avisos.filter((x) => !x.acoes.includes('salvarComo'));
    this.#concluir(a, pacote, revisao, r.nomeArquivo, r.avisos);
    return true;
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
    this.#avisos = this.#avisos.filter((x) => x.nivel !== 'erro');
    for (const texto of avisos) this.#avisar({ nivel: 'alerta', texto, acoes: [] });
    this.#emitir();
    this.#dep.aoSalvar?.();
  }

  /** Para o agendamento (desmontar a interface). */
  encerrar(): void {
    this.#pararAutomatico();
  }
}
