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
 * - texto das seções (M2-T06; ADR-0007, seção 3): o editor manda cada alteração na hora (`alterarSecao`), e a sessão
 *   só avisa a interface quando muda o que ela mostra (estado do visor, título de uma seção na lista): uma emissão por
 *   tecla re-renderizaria a casca inteira (R39).
 * - estrutura das seções (M2-T07; ADR-0007, seção 4): inserir, excluir, mover, recuar e promover passam pelas operações
 *   puras de `dominio/modelo`; cada uma aceita entra no `HistoricoEdicao` com o seu inverso. Desfazer e refazer seguem
 *   a ordem única: a entrada de texto é aplicada por quem tem o editor (função recebida), a de estrutura aqui. A
 *   `geracao` não muda numa operação estrutural (os editores guardados continuam valendo).
 *
 * Puro (sem DOM e sem Node): a API, o relógio e o agendador entram por dependência, e os testes rodam em Node com
 * agendador manual (tests/sessao-trabalho.test.ts).
 */
import {
  aplicarOperacaoSecao,
  inserirSecao,
  localizarSecao,
  moverJuntoDe,
  moverParaBaixo,
  moverParaCima,
  promoverSecao,
  recuarSecao,
  removerSecao,
  ehTipoTrabalhoUft,
  ORDEM_PRE_TEXTUAIS,
  type Documento,
  type ElementoPreTextual,
  type ElementoPreTextualId,
  type Id,
  type InlineDeTitulo,
  type InversoSecao,
  type Metadados,
  type ResultadoOperacaoSecao,
  type Secao,
  type TipoTrabalhoId,
} from '../../dominio/modelo';
import { ESTRUTURA_POR_TIPO, pendenciasPreTextuais, type PendenciaPreTextual } from '../../dominio/normas';
import { numerarSecoes } from '../../dominio/numeracao';
import type { ApiRecuperacao } from '../portas/recuperacao';
import { HistoricoEdicao, type EntradaHistorico, type InversoElemento } from './historico-edicao';
import { aplicarCampos, aplicarDados, comElemento, type AlteracaoDados, type CamposElemento } from './pre-textuais';
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

/** Seção na lista da aba Escrever: o número vem da posição (nunca do modelo, RN-039). */
export interface ResumoSecao {
  id: Id;
  /** Ex.: "2.1". */
  indicativo: string;
  /** 1 = primária. */
  nivel: number;
  titulo: string;
  paiId: Id | null;
  /** Posição entre as irmãs (base 1) e quantas irmãs há, contando ela (para o leitor de tela). */
  posicao: number;
  irmas: number;
}

/** O que o editor de uma seção edita (as subseções ficam na árvore). */
export type ConteudoDaSecao = Pick<Secao, 'titulo' | 'blocos'>;

/** Elemento pré-textual na lista da aba Escrever (M2-T08). */
export interface ResumoElemento {
  id: Id;
  tipo: ElementoPreTextualId;
  /** Sugestão do modelo UFT, não exigida pelo Manual (C-B18). */
  sugerido: boolean;
  /** Pendências (sem contar os avisos) deste elemento. */
  pendencias: number;
}

/** Dados dos formulários pré-textuais (M2-T08). Os objetos só mudam quando o conteúdo deles muda. */
export interface PreTextuaisDaSessao {
  dados: Metadados;
  subtitulo: string;
  lista: readonly ElementoPreTextual[];
  resumos: readonly ResumoElemento[];
  /** Tipos que o autor pode incluir, na ordem do Quadro 5. */
  ausentes: readonly ElementoPreTextualId[];
  pendencias: readonly PendenciaPreTextual[];
}

export interface TrabalhoDaSessao {
  /**
   * Muda a cada trabalho aberto (também ao reabrir o mesmo arquivo ou recuperar): o editor descarta o que guardou do
   * anterior (ADR-0007, seção 3, item 7).
   */
  geracao: number;
  nomeArquivo: string;
  /** Título como texto editável (concatenação dos trechos, sem marcas). */
  titulo: string;
  tipoTrabalho: TipoTrabalhoId | string;
  somenteLeitura: boolean;
  /** Pode gravar no próprio arquivo (tem identificador e não é só leitura). */
  podeSalvar: boolean;
  salvamento: SalvamentoSessao;
  /** Seções do corpo em ordem de leitura. */
  secoes: readonly ResumoSecao[];
  /** `null` nos tipos sem elementos (genérico, tipo de versão futura). */
  preTextuais: PreTextuaisDaSessao | null;
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
  /** Id de seção nova (`sec_` + 16 caracteres, dentro do `PADRAO_ID`). Sem ele, a sessão não cria seções. */
  gerarIdSecao?: () => string;
  /** Id de elemento novo no formato do esquema (M2-T08). */
  gerarIdElemento?: () => string;
}

/**
 * Resultado de uma operação estrutural ou de desfazer/refazer. `secaoId` = a seção a mostrar depois (a criada, a movida,
 * a do texto desfeito), ou `null` se ela não existe mais (desfazer a criação, excluir).
 */
export type ResultadoEstrutura = { ok: true; mudou: boolean; secaoId: Id | null } | { ok: false; mensagem: string };

/** Operações da lista de seções (botões, teclas e menu). */
export type AcaoSecao = 'recuar' | 'promover' | 'acima' | 'abaixo' | 'excluir';

/**
 * Aplica desfazer ou refazer ao texto de uma seção (o `prosemirror-history` dela). `false` = não havia o passo (a
 * entrada é descartada e a seguinte é tentada).
 */
export type AplicarTexto = (secaoId: Id, sentido: 'desfazer' | 'refazer') => boolean;

export const MENSAGEM_NAO_EDITAVEL = 'Este trabalho não pode ser alterado.';
export const MENSAGEM_NADA_A_DESFAZER = 'Não há o que desfazer.';
export const MENSAGEM_NADA_A_REFAZER = 'Não há o que refazer.';

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

/** Lista da aba Escrever, em ordem de leitura. */
export function resumirSecoes(corpo: readonly Secao[]): ResumoSecao[] {
  const numeradas = numerarSecoes(corpo);
  const irmas = new Map<Id | null, number>();
  for (const n of numeradas) irmas.set(n.paiId, (irmas.get(n.paiId) ?? 0) + 1);
  return numeradas.map((n) => ({
    id: n.secao.id,
    indicativo: n.indicativo,
    nivel: n.nivel,
    titulo: textoDoTitulo(n.secao.titulo),
    paiId: n.paiId,
    posicao: Number(n.indicativo.slice(n.indicativo.lastIndexOf('.') + 1)),
    irmas: irmas.get(n.paiId)!,
  }));
}

/** Seção de que trata uma operação ou um inverso. */
const idDaOperacao = (op: InversoSecao): Id => (op.tipo === 'inserir' ? op.secao.id : op.id);

/** Troca a seção do `caminho` por `nova`, copiando só o caminho até ela. */
function trocarSecao(lista: readonly Secao[], caminho: readonly number[], nova: Secao): Secao[] {
  const [i, ...resto] = caminho as [number, ...number[]];
  const copia = [...lista];
  const atual = copia[i]!;
  copia[i] = resto.length === 0 ? nova : { ...atual, subsecoes: trocarSecao(atual.subsecoes, resto, nova) };
  return copia;
}

/** Caminho (posições base 0) de cada seção. Iterativo: a árvore lida de arquivo pode ter até 64 níveis. */
function caminhosDasSecoes(corpo: readonly Secao[]): Map<Id, number[]> {
  const mapa = new Map<Id, number[]>();
  const pilha: { lista: readonly Secao[]; caminho: number[] }[] = [{ lista: corpo, caminho: [] }];
  for (let item = pilha.pop(); item !== undefined; item = pilha.pop()) {
    const { lista, caminho: prefixo } = item;
    lista.forEach((s, i) => {
      const caminho = [...prefixo, i];
      mapa.set(s.id, caminho);
      if (s.subsecoes.length > 0) pilha.push({ lista: s.subsecoes, caminho });
    });
  }
  return mapa;
}

function secaoNoCaminho(corpo: readonly Secao[], caminho: readonly number[]): Secao | undefined {
  let lista = corpo;
  let s: Secao | undefined;
  for (const i of caminho) {
    s = lista[i];
    if (s === undefined) return undefined;
    lista = s.subsecoes;
  }
  return s;
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
  #geracao = 0;
  /** Caminho de cada seção do corpo aberto; refeito só quando a estrutura muda (alterar o texto não muda caminhos). */
  #caminhos = new Map<Id, number[]>();
  /** Lista de seções da interface, refeita só quando um título ou a estrutura mudam. */
  #secoes: readonly ResumoSecao[] = [];
  /** Ordem única de desfazer do trabalho aberto (texto e estrutura); esvazia a cada `geracao`. */
  readonly #historico = new HistoricoEdicao();

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
              geracao: this.#geracao,
              nomeArquivo: a.nomeArquivo,
              titulo: textoDoTitulo(a.pacote.documento.metadados.titulo),
              tipoTrabalho: a.pacote.manifesto.tipoTrabalho,
              somenteLeitura: a.modo === 'leitura',
              podeSalvar: a.modo === 'edicao' && a.identificador !== null,
              salvamento: this.#salvamento,
              secoes: this.#secoes,
              preTextuais: this.#preTextuais(a.pacote.documento),
            },
      avisos: this.#avisos,
    };
    for (const o of this.#ouvintes) o();
  }

  #cachePreTextuais: { metadados: Metadados; lista: unknown; resultado: PreTextuaisDaSessao | null } | null = null;

  /** Recalculado só quando os dados ou os elementos mudam: digitar numa seção não refaz as pendências. */
  #preTextuais(doc: Documento): PreTextuaisDaSessao | null {
    const c = this.#cachePreTextuais;
    if (c !== null && c.metadados === doc.metadados && c.lista === doc.preTextuais) return c.resultado;
    let resultado: PreTextuaisDaSessao | null = null;
    if (ehTipoTrabalhoUft(doc.tipoTrabalho)) {
      const estrutura = ESTRUTURA_POR_TIPO[doc.tipoTrabalho].preTextuais;
      const lista = doc.preTextuais ?? [];
      const pendencias = pendenciasPreTextuais(doc);
      const presentes = new Set(lista.map((e) => e.tipo));
      resultado = {
        dados: doc.metadados,
        subtitulo: textoDoTitulo(doc.metadados.subtitulo ?? []),
        lista,
        resumos: lista.map((e) => ({
          id: e.id,
          tipo: e.tipo,
          sugerido: estrutura[e.tipo].presenca === 'sugerido',
          pendencias: pendencias.filter((p) => p.elemento === e.tipo && p.nivel === 'pendencia').length,
        })),
        ausentes: ORDEM_PRE_TEXTUAIS.filter((t) => !presentes.has(t)),
        pendencias,
      };
    }
    this.#cachePreTextuais = { metadados: doc.metadados, lista: doc.preTextuais, resultado };
    return resultado;
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
    this.#novaGeracao(projeto.pacote.documento.corpo);
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
    this.#novaGeracao(pacote.documento.corpo);
    this.#salvamento = { tipo: 'somenteLeitura' };
    this.#avisos = [...avisos];
    this.#emitir();
  }

  #novaGeracao(corpo: readonly Secao[]): void {
    this.#geracao += 1;
    this.#caminhos = caminhosDasSecoes(corpo);
    this.#secoes = resumirSecoes(corpo);
    this.#historico.limpar();
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
    this.#caminhos = new Map();
    this.#secoes = [];
    this.#historico.limpar();
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
    this.#marcarAlteracao();
    this.#emitir();
  }

  // ---------- dados de identificação e elementos pré-textuais (M2-T08) ----------

  /** Campo de identificação (capa, folha de rosto). Como o título, usa o desfazer do próprio campo. */
  alterarDados(alteracao: AlteracaoDados): void {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return;
    const atual = a.pacote.documento.metadados;
    const novos = aplicarDados(atual, alteracao);
    if (novos !== atual) this.#trocarMetadados(a, novos);
  }

  alterarSubtitulo(texto: string): void {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return;
    const atual = a.pacote.documento.metadados;
    if (texto === textoDoTitulo(atual.subtitulo ?? [])) return;
    const { subtitulo: _antigo, ...resto } = atual;
    this.#trocarMetadados(a, texto === '' ? resto : { ...resto, subtitulo: tituloDoTexto(texto, atual.subtitulo ?? []) });
  }

  #trocarMetadados(a: Extract<Aberto, { modo: 'edicao' }>, metadados: Metadados): void {
    a.pacote = { ...a.pacote, documento: { ...a.pacote.documento, metadados } };
    this.#marcarAlteracao();
    this.#emitir();
  }

  /** Campos de um elemento presente. Usa o desfazer do próprio campo. */
  alterarElemento(id: Id, campos: CamposElemento): void {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return;
    const lista = a.pacote.documento.preTextuais ?? [];
    const atual = lista.find((e) => e.id === id);
    if (atual === undefined) return;
    const novo = aplicarCampos(atual, campos);
    if (novo !== atual) this.#trocarElementos(a, lista.map((e) => (e === atual ? novo : e)));
  }

  /** Inclui o elemento no lugar dele no Quadro 5. Entra no desfazer. Devolve o id, ou `null` se não pôde. */
  incluirElemento(tipo: ElementoPreTextualId): Id | null {
    const a = this.#aberto;
    const gerar = this.#dep.gerarIdElemento;
    if (a?.modo !== 'edicao' || gerar === undefined || !ehTipoTrabalhoUft(a.pacote.documento.tipoTrabalho)) return null;
    const lista = a.pacote.documento.preTextuais ?? [];
    if (lista.some((e) => e.tipo === tipo)) return null;
    let id = gerar();
    while (this.#idEmUso(a, id)) id = gerar();
    this.#historico.registrar({ tipo: 'elemento', inverso: { acao: 'retirar', id } });
    this.#trocarElementos(a, comElemento(lista, { tipo, id } as ElementoPreTextual));
    return id;
  }

  /** Retira o elemento com o que foi escrito nele. Entra no desfazer (Ctrl+Z o traz de volta com o texto). */
  retirarElemento(id: Id): boolean {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return false;
    const lista = a.pacote.documento.preTextuais ?? [];
    const elemento = lista.find((e) => e.id === id);
    if (elemento === undefined) return false;
    this.#historico.registrar({ tipo: 'elemento', inverso: { acao: 'incluir', elemento } });
    this.#trocarElementos(a, lista.filter((e) => e !== elemento));
    return true;
  }

  /** Lista vazia fica ausente (forma única; o esquema recusa `[]`). */
  #trocarElementos(a: Extract<Aberto, { modo: 'edicao' }>, lista: ElementoPreTextual[]): void {
    const { preTextuais: _antigos, ...resto } = a.pacote.documento;
    // A ordem das chaves é a da leitura: `preTextuais` antes de `corpo`.
    const { id, tipoTrabalho, metadados, ...demais } = resto;
    a.pacote = { ...a.pacote, documento: { id, tipoTrabalho, metadados, ...(lista.length > 0 && { preTextuais: lista }), ...demais } };
    this.#marcarAlteracao();
    this.#emitir();
  }

  /** Ids são únicos no documento inteiro: um repetido torna o `.bdp` ilegível (R38; B2 do M2-T03). */
  #idEmUso(a: Extract<Aberto, { modo: 'edicao' }>, id: Id): boolean {
    const d = a.pacote.documento;
    return this.#caminhos.has(id) || (d.preTextuais ?? []).some((e) => e.id === id) || (d.posTextuais ?? []).some((e) => e.id === id);
  }

  /** Desfaz ou refaz uma inclusão ou retirada; devolve a entrada que a anula, ou `null` se já não se aplica. */
  #aplicarInversoElemento(a: Extract<Aberto, { modo: 'edicao' }>, inverso: InversoElemento): EntradaHistorico | null {
    const lista = a.pacote.documento.preTextuais ?? [];
    if (inverso.acao === 'incluir') {
      if (lista.some((e) => e.tipo === inverso.elemento.tipo)) return null;
      this.#trocarElementos(a, comElemento(lista, inverso.elemento));
      return { tipo: 'elemento', inverso: { acao: 'retirar', id: inverso.elemento.id } };
    }
    const elemento = lista.find((e) => e.id === inverso.id);
    if (elemento === undefined) return null;
    this.#trocarElementos(a, lista.filter((e) => e !== elemento));
    return { tipo: 'elemento', inverso: { acao: 'incluir', elemento } };
  }

  /**
   * Conta uma alteração e agenda o automático e o instantâneo. `true` = o visor mudou (é preciso emitir).
   * Durante a gravação o visor continua em "Salvando…"; o resultado decide o próximo estado. (Com o diálogo do
   * "Salvar como…" aberto ainda não há gravação no disco: a alteração aparece como não salva.)
   */
  #marcarAlteracao(): boolean {
    this.#revisao += 1;
    const tipo = this.#salvamento.tipo;
    if (tipo !== 'salvando') this.#salvamento = { tipo: 'naoSalvo' };
    this.#agendarAutomatico();
    this.#agendarInstantaneo();
    return tipo !== 'salvando' && tipo !== 'naoSalvo';
  }

  /** Seção do trabalho aberto (também em só leitura), ou `null`. */
  secao(id: Id): Secao | null {
    const a = this.#aberto;
    const caminho = this.#caminhos.get(id);
    if (a === null || caminho === undefined) return null;
    return secaoNoCaminho(a.pacote.documento.corpo, caminho) ?? null;
  }

  /**
   * Texto da seção vindo do editor, uma chamada por transação que muda o documento (ADR-0007, seção 3). Os arrays
   * recebidos passam a pertencer ao modelo: quem chama não os altera depois. Só emite quando o visor ou o título da
   * seção na lista mudam.
   */
  alterarSecao(id: Id, conteudo: ConteudoDaSecao): void {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return;
    const caminho = this.#caminhos.get(id);
    const corpo = a.pacote.documento.corpo;
    const atual = caminho === undefined ? undefined : secaoNoCaminho(corpo, caminho);
    if (caminho === undefined || atual === undefined) return;
    if (atual.titulo === conteudo.titulo && atual.blocos === conteudo.blocos) return;
    const nova: Secao = { ...atual, titulo: conteudo.titulo, blocos: conteudo.blocos };
    a.pacote = { ...a.pacote, documento: { ...a.pacote.documento, corpo: trocarSecao(corpo, caminho, nova) } };
    let emitir = this.#marcarAlteracao();
    const texto = textoDoTitulo(nova.titulo);
    if (texto !== textoDoTitulo(atual.titulo)) {
      this.#secoes = this.#secoes.map((s) => (s.id === id ? { ...s, titulo: texto } : s));
      emitir = true;
    }
    if (emitir) this.#emitir();
  }

  // ---------- estrutura das seções e desfazer (M2-T07) ----------

  /**
   * Seção nova e vazia logo depois de `aposId` (e das subseções dela), no mesmo nível; sem `aposId` (ou com um que não
   * existe), no fim do corpo. Entra no desfazer.
   */
  novaSecao(aposId: Id | null = null): ResultadoEstrutura {
    const a = this.#aberto;
    const gerar = this.#dep.gerarIdSecao;
    if (a?.modo !== 'edicao' || gerar === undefined) return { ok: false, mensagem: MENSAGEM_NAO_EDITAVEL };
    const corpo = a.pacote.documento.corpo;
    let id = gerar();
    while (this.#idEmUso(a, id)) id = gerar();
    const apos = aposId === null ? null : localizarSecao(corpo, aposId);
    const destino = apos === null ? { paiId: null, indice: corpo.length } : { paiId: apos.paiId, indice: apos.indice + 1 };
    return this.#aplicarEstrutura(a, inserirSecao(corpo, { id, titulo: [], blocos: [], subsecoes: [] }, destino), id);
  }

  /** Recuar, promover, subir, descer ou excluir a seção `id` (com as suas subseções). Entra no desfazer. */
  operarSecao(acao: AcaoSecao, id: Id): ResultadoEstrutura {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return { ok: false, mensagem: MENSAGEM_NAO_EDITAVEL };
    const corpo = a.pacote.documento.corpo;
    const operacoes: Record<AcaoSecao, () => ResultadoOperacaoSecao> = {
      recuar: () => recuarSecao(corpo, id),
      promover: () => promoverSecao(corpo, id),
      acima: () => moverParaCima(corpo, id),
      abaixo: () => moverParaBaixo(corpo, id),
      excluir: () => removerSecao(corpo, id),
    };
    return this.#aplicarEstrutura(a, operacoes[acao](), acao === 'excluir' ? null : id);
  }

  /** Leva a seção para logo antes ou depois de `alvoId` (arrastar e soltar). Entra no desfazer. */
  moverSecaoJuntoDe(id: Id, alvoId: Id, lado: 'antes' | 'depois'): ResultadoEstrutura {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return { ok: false, mensagem: MENSAGEM_NAO_EDITAVEL };
    return this.#aplicarEstrutura(a, moverJuntoDe(a.pacote.documento.corpo, id, alvoId, lado), id);
  }

  /**
   * Resultado de uma operação nova: troca o corpo, refaz caminhos e lista, conta a alteração e guarda o inverso.
   * `mudou: false` não soma revisão nem empilha desfazer (adendo do M2-T03).
   */
  #aplicarEstrutura(a: Extract<Aberto, { modo: 'edicao' }>, r: ResultadoOperacaoSecao, secaoId: Id | null): ResultadoEstrutura {
    if (!r.ok) return { ok: false, mensagem: r.mensagem };
    if (!r.mudou) return { ok: true, mudou: false, secaoId };
    this.#historico.registrar({ tipo: 'estrutura', inverso: r.inverso });
    this.#trocarCorpo(a, r.corpo);
    return { ok: true, mudou: true, secaoId };
  }

  #trocarCorpo(a: Extract<Aberto, { modo: 'edicao' }>, corpo: Secao[]): void {
    a.pacote = { ...a.pacote, documento: { ...a.pacote.documento, corpo } };
    this.#caminhos = caminhosDasSecoes(corpo);
    this.#secoes = resumirSecoes(corpo);
    this.#marcarAlteracao();
    this.#emitir();
  }

  /**
   * O texto da seção ganhou um passo novo no `prosemirror-history` dela (o editor avisa quando a profundidade de
   * desfazer muda numa transação que não é de desfazer/refazer): entra na ordem única.
   */
  registrarTexto(secaoId: Id): void {
    if (this.#aberto?.modo === 'edicao' && this.#caminhos.has(secaoId)) this.#historico.registrar({ tipo: 'texto', secaoId });
  }

  get podeDesfazer(): boolean {
    return this.#aberto?.modo === 'edicao' && this.#historico.podeDesfazer;
  }

  get podeRefazer(): boolean {
    return this.#aberto?.modo === 'edicao' && this.#historico.podeRefazer;
  }

  /** Desfaz a última alteração do trabalho, de texto ou de estrutura (Ctrl+Z). */
  desfazer(aplicarTexto: AplicarTexto): ResultadoEstrutura {
    return this.#percorrerHistorico('desfazer', aplicarTexto);
  }

  /** Refaz o último desfeito (Ctrl+Y). */
  refazer(aplicarTexto: AplicarTexto): ResultadoEstrutura {
    return this.#percorrerHistorico('refazer', aplicarTexto);
  }

  #percorrerHistorico(sentido: 'desfazer' | 'refazer', aplicarTexto: AplicarTexto): ResultadoEstrutura {
    const a = this.#aberto;
    if (a?.modo !== 'edicao') return { ok: false, mensagem: MENSAGEM_NAO_EDITAVEL };
    for (let e = this.#historico.topo(sentido); e !== undefined; e = this.#historico.topo(sentido)) {
      const contraria = this.#aplicarEntrada(a, e, sentido, aplicarTexto);
      if (contraria === null) {
        // O passo já não existe (o histórico de cada seção guarda até 100 eventos): segue para a entrada anterior.
        this.#historico.descartar(sentido);
        continue;
      }
      this.#historico.concluir(sentido, contraria);
      const id = e.tipo === 'texto' ? e.secaoId : e.tipo === 'estrutura' ? idDaOperacao(e.inverso) : null;
      return { ok: true, mudou: true, secaoId: id !== null && this.#caminhos.has(id) ? id : null };
    }
    return { ok: false, mensagem: sentido === 'desfazer' ? MENSAGEM_NADA_A_DESFAZER : MENSAGEM_NADA_A_REFAZER };
  }

  /** Aplica a entrada; devolve a que a anula, ou `null` se ela não pôde ser aplicada. */
  #aplicarEntrada(
    a: Extract<Aberto, { modo: 'edicao' }>,
    e: EntradaHistorico,
    sentido: 'desfazer' | 'refazer',
    aplicarTexto: AplicarTexto,
  ): EntradaHistorico | null {
    if (e.tipo === 'texto') return this.#caminhos.has(e.secaoId) && aplicarTexto(e.secaoId, sentido) ? e : null;
    if (e.tipo === 'elemento') return this.#aplicarInversoElemento(a, e.inverso);
    // O inverso vai como foi recebido (só ele restaura além dos limites).
    const r = aplicarOperacaoSecao(a.pacote.documento.corpo, e.inverso);
    if (!r.ok) return null;
    if (r.mudou) this.#trocarCorpo(a, r.corpo);
    return { tipo: 'estrutura', inverso: r.inverso };
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
