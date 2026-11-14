// Aba Escrever: o trabalho aberto com o título editável, os botões Salvar e Fechar e os avisos da sessão (M1-T11: erro
// ao salvar com "Salvar como…", arquivo sem .bdp, versão futura). M2-T06: a lista das seções, numeradas pela posição,
// e o editor da seção escolhida (uma seção por vez, decisão da preparação do M2). M2-T07: a árvore de seções, com nova,
// subir, descer, recuar, promover, excluir e arrastar (`ArvoreSecoes`); a seção ativa e a ordem única de desfazer vêm
// de `useEstrutura`, acima da aba. M2-T08: a lista dos elementos pré-textuais e o formulário do escolhido, no lugar do
// editor da seção. M4-T06: a bibliografia (lista das obras e o formulário da obra, também no lugar do editor). M4-T07: a
// janela da citação, pedida pelo editor. M4-T08: a conferência da bibliografia, no lugar do editor, com "Ir ao texto" e
// "Abrir obra". M4-T09: importar BibTeX ou RIS, com a janela que mostra o que entra. Texto sempre como texto (nunca HTML).
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { formatadorDeChamadas, LIMITE_BYTES_IMPORTACAO, prepararImportacao, reconhecedorDeChamadas, type ItemImportacao, type PreviaImportacao, type LocalProblema, type ProblemaBibliografia, type AcaoAviso, type AlteracaoDados, type AvisoSessao, type CamposElemento, type ConteudoDaSecao, type DadosDoCatalogo, type OpcoesAplicarCatalogo, type EstadoSessao, type ResultadoMidia, type ResultadoObra } from '../../aplicacao';
import type { ChamadaNoEditor, CitacaoEscrita } from '../editor/citacoes';
import type { FiguraNoEditor, TabelaNoEditor } from '../editor/tabelas';
import type { ElementoPreTextualId, Obra, Secao, TipoTrabalhoId, VinculoInstitucional } from '../../dominio/modelo';
import { rotuloTipo } from '../biblioteca/selecao';
import { EditorSecao, type ControleEditor } from '../editor/EditorSecao';
import { Icone, Pequi } from '../Icones';
import { AjudaContextual, TextoAjuda } from '../casca/AjudaContextual';
import { ArvoreSecoes } from './ArvoreSecoes';
import { ConferenciaBibliografia } from './ConferenciaBibliografia';
import { DialogoCitacao } from './DialogoCitacao';
import { DialogoFigura } from './DialogoFigura';
import { DialogoRemissiva } from './DialogoRemissiva';
import { ListaVisuais, PainelElemento, PainelMencoes, type NovoElemento } from './GerenciadorElementos';
import { PainelRegistro } from './PainelRegistro';
import { PainelModelo } from './PainelModelo';
import { PainelIA } from '../ia/PainelIA';
import { DialogoGrafico } from './DialogoGrafico';
import type { GraficoNoEditor } from '../editor/tabelas';
import { areaUtilDoPerfilMm } from '../../aplicacao';
import type { BlocoTabela } from '../../dominio/modelo';
import type { RemissivaNoEditor } from '../editor/remissivas';
import { DialogoTabela } from './DialogoTabela';
import { DialogoImportacao } from './DialogoImportacao';
import { FormularioObra, ListaObras } from './Bibliografia';
import { FormularioElemento, ListaElementos, ROTULOS_ELEMENTO } from './PreTextuais';
import { PosTextuais } from './PosTextuais';
import type { ElementoPosTextual } from '../../dominio/modelo';
import type { Estrutura, PedidoFoco } from './useEstrutura';
import type { CadastrosDocumento } from '../../aplicacao';
import { Cadastros } from './Cadastros';
import { DialogoSigla } from './DialogoSigla';
import { Conformidade } from './Conformidade';
import { modoDoLocal, proximaComLocal, type ModoTrabalho } from './navegacao';
import type { ApiIa, DadosTabela, DestinoRegistro, MencoesDoTexto, NaoConformidade, RelatorioConformidade, ResultadoExportar } from '../../aplicacao';
import type { ModeloEvento, RegistroAtividades, RegrasModelo } from '../../dominio/modelo';

export const ID_CAMPO_TITULO = 'campo-titulo';
export { modoDoLocal, proximaComLocal, type ModoTrabalho } from './navegacao';

const TITULOS_MODO: Readonly<Record<ModoTrabalho, string>> = {
  escrever: 'Escrever',
  elementos: 'Elementos',
  referencias: 'Referências',
  conformidade: 'Conformidade',
};

/**
 * Ação do gerenciador de elementos (Etapa 4) que acontece no editor, na aba Escrever, quando a seção dela estiver na
 * tela: editar o elemento, ligar uma menção escrita, inserir remissiva ou criar um elemento no cursor.
 */
type AcaoNoEditor =
  | { tipo: 'editar'; id: string; bloco: 'tabela' | 'ilustracao' | 'grafico' | 'equacao' | string }
  | { tipo: 'ligar'; bloco: string; trecho: string }
  | { tipo: 'remissiva'; alvo: string }
  | { tipo: 'novo'; qual: NovoElemento }
  /** Etapa 8: sugestão da IA aceita pelo autor (título, fonte ou nota; as células são as mesmas). */
  | { tipo: 'sugestaoTabela'; id: string; dados: DadosTabela };

export interface PropsAreaEscrever {
  /** Aba do trabalho (F-E6-01); sem ela, Escrever. */
  modo?: ModoTrabalho;
  /** Leva a outra aba do trabalho ("Ir ao local" na aba Conformidade, F8, elemento visual na aba Elementos). */
  aoIrParaModo?: (modo: ModoTrabalho) => void;
  /** Trabalho › Dados do trabalho… (`dados`) e Elementos pré-textuais… (`lista`); atendido, `aoAtenderPedidoElementos`. */
  pedidoElementos?: { alvo: 'dados' | 'lista' } | null;
  aoAtenderPedidoElementos?: () => void;
  /** Verificar › Ir para a próxima não conformidade (F8): maior que 0 quando pedido; atendido, volta a 0. */
  pedidoProximaNC?: number;
  aoAtenderPedidoProximaNC?: () => void;
  aoAtualizarCadastros?: (dados: CadastrosDocumento) => ResultadoObra;
  /** Elementos pós-textuais (M6-T05; ligado na revisão do M6, R-M6-02): incluir, retirar, renomear e ordenar. */
  posTextuais?: {
    incluir: (tipo: ElementoPosTextual['tipo']) => string | null;
    retirar: (id: string) => boolean;
    renomear: (id: string, titulo: string) => boolean;
    mover: (id: string, sentido: 'cima' | 'baixo') => boolean;
  };
  conformidade?: { verificar: () => RelatorioConformidade; exportar: () => Promise<ResultadoExportar> };
  /** Gerenciador de elementos (Etapa 4): menções escritas sem ligação e menções sem número. */
  mencoes?: () => MencoesDoTexto;
  /** Etapa 6: registro de atividades e cronograma. */
  registro?: {
    alterar: (r: RegistroAtividades | null) => ResultadoObra;
    incorporar: (destino: DestinoRegistro) => ResultadoObra;
    atualizar: () => ResultadoObra;
    retirar: () => ResultadoObra;
    exportar: () => Promise<ResultadoExportar>;
  };
  /** Etapa 7: modelo de congresso ou evento importado de DOCX. */
  modeloEvento?: {
    aplicar: (m: ModeloEvento | null) => ResultadoObra;
    criarSecoes: () => number;
    secoesQueFaltam: () => string[];
  };
  /** Etapa 8: assistente de IA. */
  ia?: {
    api: ApiIa;
    idTrabalho: string;
    aplicarModelo: (regras: Partial<RegrasModelo>) => ResultadoObra;
    aoMudarRetomada: () => void;
  };
  /** Tarefa de IA interrompida neste trabalho (texto do aviso), com o botão que abre o assistente. */
  avisoRetomadaIa?: string | null;
  /** Trabalho › Assistente de IA…: maior que 0 quando pedido. */
  pedidoIa?: number;
  aoAtenderPedidoIa?: () => void;
  /** Trabalho › Modelo de evento (DOCX)…: maior que 0 quando pedido. */
  pedidoModelo?: number;
  aoAtenderPedidoModelo?: () => void;
  /** Trabalho › Registro de atividades…: maior que 0 quando pedido (quem pediu já escolheu a aba Elementos). */
  pedidoRegistro?: number;
  aoAtenderPedidoRegistro?: () => void;
  /** E7-T03: maior que 0 quando Verificar › Verificar conformidade (F7) pediu a janela; atendido, volta a 0. */
  pedidoConformidade?: number;
  aoAtenderPedidoConformidade?: () => void;
  estado: EstadoSessao;
  /** Rótulo do botão de descartar: "Fechar sem salvar" ou, quando o usuário pediu para sair, "Sair sem salvar". */
  rotuloDescartar: string;
  ocupado: boolean;
  aoAlterarTitulo: (texto: string) => void;
  aoSalvar: () => void;
  aoFechar: () => void;
  aoAcao: (acao: AcaoAviso) => void;
  aoCriar: () => void;
  aoAbrir: () => void;
  aoIrParaBiblioteca: () => void;
  /** Seção do trabalho aberto, para o editor montar. */
  lerSecao: (id: string) => Secao | null;
  aoAlterarSecao: (id: string, conteudo: ConteudoDaSecao) => void;
  /** Seção ativa, operações da árvore e desfazer (M2-T07). */
  estrutura: Pick<
    Estrutura,
    | 'memoria'
    | 'ativa'
    | 'escolher'
    | 'novaSecao'
    | 'operar'
    | 'moverJunto'
    | 'historico'
    | 'pedirFoco'
    | 'pedidoFoco'
    | 'consumirFoco'
    | 'aviso'
    | 'registrarTexto'
  >;
  /** Dados de identificação e elementos pré-textuais (M2-T08). */
  elementos: {
    alterarDados: (a: AlteracaoDados) => void;
    /** Etapa 3: dados institucionais escolhidos no catálogo, de uma vez. */
    aplicarCatalogo?: (dados: DadosDoCatalogo, vinculo: VinculoInstitucional | null, opcoes?: OpcoesAplicarCatalogo) => void;
    alterarSubtitulo: (texto: string) => void;
    alterar: (id: string, campos: CamposElemento) => void;
    incluir: (tipo: ElementoPreTextualId) => string | null;
    retirar: (id: string) => boolean;
  };
  /** Bibliografia (M4-T06). */
  obras: {
    incluir: (obra: Obra) => ResultadoObra;
    alterar: (obra: Obra) => ResultadoObra;
    excluir: (id: string) => ResultadoObra;
    /** Conferência da bibliografia do trabalho aberto (M4-T08). */
    verificar: () => readonly ProblemaBibliografia[];
    /** Importação (M4-T09): inclui as obras num passo só do desfazer. */
    importar: (obras: readonly Obra[]) => { ok: true; ids: string[]; recusadas: number } | { ok: false; mensagem: string };
    /** Etapa 5: quantas citações do texto apontam para a obra. */
    citacoes?: (id: string) => number;
    /** Etapa 5: PDF da obra no computador. */
    pdf?: { escolher: () => Promise<string | null>; abrir: (caminho: string) => Promise<{ ok: true } | { ok: false; mensagem: string }> };
  };
  /** O formulário de um elemento está no lugar do editor: o menu Inserir › Nota de rodapé fica desativado. */
  aoMudarFormulario?: (aberto: boolean) => void;
  /** O editor da seção aberta, para os menus Editar e Inserir. */
  controleEditor: RefObject<ControleEditor | null>;
  /** Imagens do trabalho (M5-T06): guardar a de uma figura nova e ler para mostrar. */
  midias: {
    incluir: (bytes: Uint8Array, sha256: string) => ResultadoMidia;
    ler: (sha256: string) => Uint8Array | null;
  };
}

const DICA_SALVAR = 'As alterações são salvas sozinhas 30 segundos depois da última edição, ao trocar de trabalho e ao fechar. Ctrl+S salva na hora.';
const ID_PAINEL_ESTRUTURA = 'painel-estrutura';
/** Painel da estrutura oculto (Etapa 2): conveniência deste computador. */
const CHAVE_ESTRUTURA = 'bibliodocs.estruturaOculta';

function lerEstruturaOculta(): boolean {
  try {
    return localStorage.getItem(CHAVE_ESTRUTURA) === '1';
  } catch {
    return false;
  }
}

export function AreaEscrever(p: PropsAreaEscrever) {
  const t = p.estado.trabalho;
  const e = p.estrutura;
  const [avisosEditor, setAvisosEditor] = useState<readonly string[]>([]);
  const [cadastrosAbertos, setCadastrosAbertos] = useState(false);
  // Etapa 2: painel da estrutura (elementos, seções, obras) recolhível na aba Escrever, lembrado neste computador.
  const [estruturaOculta, setEstruturaOculta] = useState(lerEstruturaOculta);
  const alternarEstrutura = () =>
    setEstruturaOculta((o) => {
      try {
        localStorage.setItem(CHAVE_ESTRUTURA, o ? '0' : '1');
      } catch {
        /* armazenamento indisponível: vale só nesta sessão */
      }
      return !o;
    });
  const semEstrutura = (p.modo ?? 'escrever') === 'escrever' && estruturaOculta;
  const [relatorioConformidade, setRelatorioConformidade] = useState<RelatorioConformidade | null>(null);
  const { pedidoConformidade = 0, aoAtenderPedidoConformidade } = p;
  const verificarConformidade = p.conformidade?.verificar;
  useEffect(() => {
    if (pedidoConformidade === 0 || !verificarConformidade) return;
    setRelatorioConformidade(verificarConformidade());
    aoAtenderPedidoConformidade?.();
  }, [pedidoConformidade, verificarConformidade, aoAtenderPedidoConformidade]);
  const [sugestaoPre, setSugestaoPre] = useState<ElementoPreTextualId | null>(null);
  const [pedidoSigla, setPedidoSigla] = useState<{ existente: { id: string; pos: number; sigla: string } | null } | null>(null);
  const pedirSigla = useCallback((existente: { id: string; pos: number; sigla: string } | null) => setPedidoSigla({ existente }), []);
  const refArvore = useRef<HTMLUListElement>(null);
  const refEscrever = useRef<HTMLDivElement>(null);
  const { controleEditor } = p;
  const modo = p.modo ?? 'escrever';
  // Relatório da aba Conformidade (na página, F-E6-01), refeito ao entrar na aba e ao abrir outro trabalho.
  const [relatorioAba, setRelatorioAba] = useState<RelatorioConformidade | null>(null);
  useEffect(() => {
    if (modo !== 'conformidade' || !verificarConformidade) return;
    setRelatorioAba(verificarConformidade());
  }, [modo, verificarConformidade, t?.geracao]);
  // F8: índice da última não conformidade visitada e o anúncio dela.
  const indiceNC = useRef(-1);
  const [anuncioNC, setAnuncioNC] = useState<string | null>(null);
  useEffect(() => {
    indiceNC.current = -1;
    setAnuncioNC(null);
  }, [t?.geracao]);
  useEffect(() => {
    setCadastrosAbertos(false); setRelatorioConformidade(null); setPedidoSigla(null); setSugestaoPre(null);
  }, [t?.geracao]);
  useEffect(() => {
    if (sugestaoPre !== null) refEscrever.current?.querySelector<HTMLSelectElement>('.elementos__incluir select')?.focus();
  }, [sugestaoPre]);
  const focarDepoisSigla = useRef(false);
  useEffect(() => {
    if (pedidoSigla !== null) focarDepoisSigla.current = true;
    else if (!cadastrosAbertos && focarDepoisSigla.current) {
      focarDepoisSigla.current = false;
      controleEditor.current?.focarSigla();
    }
  }, [pedidoSigla, cadastrosAbertos, controleEditor]);
  // Elemento na tela no lugar do editor. Outra seção ativa (árvore, barra superior, desfazer) volta ao editor.
  const [elementoId, setElementoId] = useState<string | null>(null);
  // Gerenciador (Etapa 4): o elemento visual escolhido na aba Elementos e a ação que espera o editor na aba Escrever.
  const [visualId, setVisualId] = useState<string | null>(null);
  // Etapa 6: o registro de atividades no lugar do editor (aba Elementos).
  const [registroAberto, setRegistroAberto] = useState(false);
  // Etapa 7: o modelo de evento no lugar do editor (aba Elementos).
  const [modeloAberto, setModeloAberto] = useState(false);
  // Etapa 8: o assistente de IA no lugar do editor (aba Elementos).
  const [iaAberto, setIaAberto] = useState(false);
  const abrirPainel = (qual: 'registro' | 'modelo' | 'ia' | null) => {
    setRegistroAberto(qual === 'registro');
    setModeloAberto(qual === 'modelo');
    setIaAberto(qual === 'ia');
  };
  const [acaoNoEditor, setAcaoNoEditor] = useState<{ secao: string; acao: AcaoNoEditor } | null>(null);
  const [anuncioElemento, setAnuncioElemento] = useState<string | null>(null);
  // Obra na tela no lugar do editor: a do trabalho (pelo id) ou o rascunho de uma nova.
  const [obraAberta, setObraAberta] = useState<{ id: string } | { nova: Obra } | null>(null);
  const [anuncioObra, setAnuncioObra] = useState<string | null>(null);
  const [contadorNova, setContadorNova] = useState(0);
  // Janela da citação (M4-T07): `existente` é a chamada selecionada no editor; `null`, uma nova no cursor.
  const [pedidoCitacao, setPedidoCitacao] = useState<{ existente: ChamadaNoEditor | null; escrita: CitacaoEscrita | null } | null>(null);
  const pedirCitacao = useCallback((existente: ChamadaNoEditor | null, escrita?: CitacaoEscrita | null) => setPedidoCitacao({ existente, escrita: escrita ?? null }), []);
  // Janela fechada (inserir, alterar, retirar ou cancelar): o foco volta pelo editor, que repõe a seleção dele (o
  // `focus()` do elemento deixaria o cursor fora do lugar). Roda depois da limpeza da janela.
  const focarAoFecharCitacao = useRef(false);
  useEffect(() => {
    if (pedidoCitacao === null && focarAoFecharCitacao.current) {
      focarAoFecharCitacao.current = false;
      controleEditor.current?.focarCitacao();
    }
    if (pedidoCitacao !== null) focarAoFecharCitacao.current = true;
  }, [pedidoCitacao, controleEditor]);
  // Janela da tabela (M5-T04): `existente` é a tabela selecionada; `null`, uma nova no cursor. Fechada, o foco volta ao editor.
  const [pedidoTabela, setPedidoTabela] = useState<{ existente: TabelaNoEditor | null } | null>(null);
  const pedirTabela = useCallback((existente: TabelaNoEditor | null) => setPedidoTabela({ existente }), []);
  const focarAoFecharTabela = useRef(false);
  useEffect(() => {
    if (pedidoTabela === null && focarAoFecharTabela.current) {
      focarAoFecharTabela.current = false;
      controleEditor.current?.focar();
    }
    if (pedidoTabela !== null) focarAoFecharTabela.current = true;
  }, [pedidoTabela, controleEditor]);
  // Janela da figura (M5-T06), como a da tabela.
  const [pedidoFigura, setPedidoFigura] = useState<{ existente: FiguraNoEditor | null } | null>(null);
  const pedirFigura = useCallback((existente: FiguraNoEditor | null) => setPedidoFigura({ existente }), []);
  const focarAoFecharFigura = useRef(false);
  useEffect(() => {
    if (pedidoFigura === null && focarAoFecharFigura.current) {
      focarAoFecharFigura.current = false;
      controleEditor.current?.focar();
    }
    if (pedidoFigura !== null) focarAoFecharFigura.current = true;
  }, [pedidoFigura, controleEditor]);
  // Janela da remissiva (M5-T08): `existente` é a remissiva selecionada; `null`, uma nova no cursor.
  const [pedidoRemissiva, setPedidoRemissiva] = useState<{ existente: RemissivaNoEditor | null; mencao: string | null } | null>(null);
  const pedirRemissiva = useCallback((existente: RemissivaNoEditor | null, mencao?: string | null) => setPedidoRemissiva({ existente, mencao: mencao ?? null }), []);
  const focarAoFecharRemissiva = useRef(false);
  useEffect(() => {
    if (pedidoRemissiva === null && focarAoFecharRemissiva.current) {
      focarAoFecharRemissiva.current = false;
      controleEditor.current?.focar();
    }
    if (pedidoRemissiva !== null) focarAoFecharRemissiva.current = true;
  }, [pedidoRemissiva, controleEditor]);
  const elementos = t?.elementos;
  const rotulosRemissiva = useMemo(() => new Map((elementos ?? []).map((x) => [x.id, x.rotulo])), [elementos]);
  const tabelasDoTrabalho = useMemo(() => new Map((elementos ?? []).flatMap((x): [string, BlocoTabela][] => (x.tabela ? [[x.id, x.tabela]] : []))), [elementos]);
  // Janela do gráfico (M5-T09), como a da figura.
  const [pedidoGrafico, setPedidoGrafico] = useState<{ existente: GraficoNoEditor | null } | null>(null);
  const pedirGrafico = useCallback((existente: GraficoNoEditor | null) => setPedidoGrafico({ existente }), []);
  const focarAoFecharGrafico = useRef(false);
  useEffect(() => {
    if (pedidoGrafico === null && focarAoFecharGrafico.current) {
      focarAoFecharGrafico.current = false;
      controleEditor.current?.focar();
    }
    if (pedidoGrafico !== null) focarAoFecharGrafico.current = true;
  }, [pedidoGrafico, controleEditor]);
  const listaObras = t?.obras;
  const obrasDoTrabalho = useMemo(() => (listaObras ?? []).map((o) => o.obra), [listaObras]);
  const formatarChamada = useMemo(() => formatadorDeChamadas(obrasDoTrabalho), [obrasDoTrabalho]);
  // Montado uma vez por lista de obras (revisão R-M4-03).
  const reconhecerChamadas = useMemo(() => reconhecedorDeChamadas(obrasDoTrabalho), [obrasDoTrabalho]);
  // Conferência da bibliografia (M4-T08) no lugar do editor, e o ponto do texto a mostrar depois de "Ir ao texto".
  const [conferencia, setConferencia] = useState<readonly ProblemaBibliografia[] | null>(null);
  const [irAoTexto, setIrAoTexto] = useState<Extract<LocalProblema, { tipo: 'texto' }> | null>(null);
  // Importação (M4-T09): o arquivo lido, à espera da escolha do usuário.
  const [importacao, setImportacao] = useState<{ nomeArquivo: string; previa: PreviaImportacao; aviso: string | null } | null>(null);
  const obrasAtuais = t?.obras;
  const lerArquivoImportado = useCallback(
    async (arquivo: File) => {
      if (arquivo.size > LIMITE_BYTES_IMPORTACAO) {
        setAnuncioObra(`“${arquivo.name}” é grande demais para importar (limite de ${LIMITE_BYTES_IMPORTACAO / 1024 / 1024} MB).`);
        return;
      }
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      let texto: string;
      let aviso: string | null = null;
      try {
        texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        texto = new TextDecoder('windows-1252').decode(bytes);
        aviso = 'O arquivo não está em UTF-8: foi lido como Windows-1252. Confira os acentos.';
      }
      setAnuncioObra(null);
      try {
        setImportacao({ nomeArquivo: arquivo.name, previa: prepararImportacao(texto, (obrasAtuais ?? []).map((o) => o.obra)), aviso });
      } catch {
        // Defesa: o leitor tem tetos, mas um arquivo de fora nunca derruba a tela em silêncio (R-M4-05).
        setAnuncioObra(`“${arquivo.name}” não pôde ser lido.`);
      }
    },
    [obrasAtuais],
  );
  const ativaId = e.ativa?.id ?? null;
  useEffect(() => {
    setElementoId(null);
    setObraAberta(null);
    setPedidoCitacao(null);
    setPedidoTabela(null);
    setPedidoFigura(null);
    setPedidoRemissiva(null);
    setPedidoGrafico(null);
    setConferencia(null);
  }, [ativaId, t?.geracao]);
  // Ao trocar de aba, o que estava no lugar do editor sai (salvo quando a troca veio de "Ir ao local", que já escolheu).
  const manterAoTrocar = useRef(false);
  useEffect(() => {
    if (manterAoTrocar.current) {
      manterAoTrocar.current = false;
      return;
    }
    setElementoId(null);
    setVisualId(null);
    setRegistroAberto(false);
    setModeloAberto(false);
    setIaAberto(false);
    setObraAberta(null);
    setConferencia(null);
    setSugestaoPre(null);
  }, [modo]);
  const { pedidoIa = 0, aoAtenderPedidoIa } = p;
  useEffect(() => {
    if (pedidoIa === 0 || modo !== 'elementos') return;
    aoAtenderPedidoIa?.();
    setElementoId(null);
    setVisualId(null);
    setRegistroAberto(false);
    setModeloAberto(false);
    setIaAberto(true);
  }, [pedidoIa, aoAtenderPedidoIa, modo]);
  const { pedidoModelo = 0, aoAtenderPedidoModelo } = p;
  useEffect(() => {
    if (pedidoModelo === 0 || modo !== 'elementos') return;
    aoAtenderPedidoModelo?.();
    setElementoId(null);
    setVisualId(null);
    setRegistroAberto(false);
    setModeloAberto(true);
  }, [pedidoModelo, aoAtenderPedidoModelo, modo]);
  const { pedidoRegistro = 0, aoAtenderPedidoRegistro } = p;
  useEffect(() => {
    if (pedidoRegistro === 0 || modo !== 'elementos') return;
    aoAtenderPedidoRegistro?.();
    setElementoId(null);
    setVisualId(null);
    setModeloAberto(false);
    setRegistroAberto(true);
  }, [pedidoRegistro, aoAtenderPedidoRegistro, modo]);
  const preLista = t?.preTextuais?.lista;
  const { aoIrParaModo } = p;
  const escolherSecao = e.escolher;
  /** "Ir ao local" de uma não conformidade; `trocarDeAba` leva à aba do local (aba Conformidade e F8). */
  const irAoLocal = useCallback(
    (local: NaoConformidade['local'], trocarDeAba: boolean) => {
      setRelatorioConformidade(null);
      setConferencia(null);
      setObraAberta(null);
      setElementoId(null);
      if (local.tipo === 'preTextual') {
        const id = preLista?.find((x) => x.tipo === local.elemento)?.id ?? null;
        setElementoId(id);
        if (id === null) setSugestaoPre(local.elemento);
      } else if (local.tipo === 'obra') setObraAberta({ id: local.obra });
      else if (local.tipo === 'texto') {
        setIrAoTexto({ ...local, trecho: local.trecho ?? '' });
        escolherSecao(local.secao, null);
      }
      const destino = modoDoLocal(local);
      if (trocarDeAba && destino !== modo && aoIrParaModo) {
        manterAoTrocar.current = true;
        aoIrParaModo(destino);
      }
    },
    [preLista, escolherSecao, modo, aoIrParaModo],
  );
  // Trabalho › Dados do trabalho… e Elementos pré-textuais… (quem pediu já escolheu a aba Elementos).
  const { pedidoElementos = null, aoAtenderPedidoElementos } = p;
  useEffect(() => {
    if (pedidoElementos === null || modo !== 'elementos') return;
    aoAtenderPedidoElementos?.();
    if (pedidoElementos.alvo === 'dados') {
      const lista = preLista ?? [];
      const alvo = lista.find((x) => x.tipo === 'folhaRosto') ?? lista.find((x) => x.tipo === 'capa') ?? null;
      if (alvo !== null) {
        setElementoId(alvo.id);
        return;
      }
      setAnuncioElemento('Este trabalho não tem capa nem folha de rosto: inclua uma delas para preencher os dados.');
    }
    refEscrever.current?.querySelector<HTMLElement>('.elementos__item, .elementos__incluir select')?.focus();
  }, [pedidoElementos, aoAtenderPedidoElementos, modo, preLista]);
  // F8: a próxima não conformidade com local, na aba dela.
  const { pedidoProximaNC = 0, aoAtenderPedidoProximaNC } = p;
  useEffect(() => {
    if (pedidoProximaNC === 0 || !verificarConformidade) return;
    aoAtenderPedidoProximaNC?.();
    const relatorio = verificarConformidade();
    if (modo === 'conformidade') setRelatorioAba(relatorio);
    const prox = proximaComLocal(relatorio.problemas, indiceNC.current);
    if (prox === null) {
      indiceNC.current = -1;
      setAnuncioNC(
        relatorio.problemas.length === 0
          ? 'Nenhuma não conformidade encontrada.'
          : 'As não conformidades encontradas valem para o trabalho todo, sem um local: veja a aba Conformidade.',
      );
      return;
    }
    indiceNC.current = prox.indice;
    const c = relatorio.problemas[prox.indice]!;
    setAnuncioNC(`${c.gravidade === 'erro' ? 'Pendência' : 'Aviso'} ${prox.ordem} de ${prox.total} (${c.rotuloLocal}): ${c.mensagem}`);
    irAoLocal(c.local, true);
  }, [pedidoProximaNC, aoAtenderPedidoProximaNC, verificarConformidade, modo, irAoLocal]);
  // A seção pedida já está no editor (os efeitos do filho rodam antes): seleciona o trecho.
  useEffect(() => {
    if (irAoTexto === null || controleEditor.current?.secaoId !== irAoTexto.secao) return;
    controleEditor.current.irPara(irAoTexto.no, irAoTexto.trecho);
    setIrAoTexto(null);
  }, [irAoTexto, ativaId, controleEditor]);
  // Ação do gerenciador (Etapa 4), quando a seção dela está no editor (depois da limpeza das janelas ao trocar de seção).
  useEffect(() => {
    const c = controleEditor.current;
    if (acaoNoEditor === null || modo !== 'escrever' || c === null || c.secaoId !== acaoNoEditor.secao) return;
    const { acao } = acaoNoEditor;
    setAcaoNoEditor(null);
    if (acao.tipo === 'editar') {
      c.irPara(acao.id);
      if (acao.bloco === 'tabela') c.pedirTabela();
      else if (acao.bloco === 'ilustracao') c.pedirFigura();
      else if (acao.bloco === 'grafico') c.pedirGrafico();
    } else if (acao.tipo === 'sugestaoTabela') {
      if (c.irPara(acao.id) && c.alterarTabela(acao.id, acao.dados)) setAvisosEditor(['Sugestão da IA aplicada à tabela. Ctrl+Z desfaz.']);
      else setAvisosEditor(['A tabela não está mais neste lugar: a sugestão não foi aplicada.']);
    } else if (acao.tipo === 'ligar') {
      if (c.irPara(acao.bloco, acao.trecho)) c.pedirRemissiva();
    } else if (acao.tipo === 'remissiva') {
      c.focar();
      if (!c.inserirRemissiva(acao.alvo)) setAvisosEditor(['O cursor não está no texto corrido: clique num parágrafo e insira a remissiva por Inserir › Remissiva….']);
    } else {
      c.focar();
      if (acao.qual === 'tabela') c.pedirTabela(true);
      else if (acao.qual === 'figura') c.pedirFigura(true);
      else c.pedirGrafico(true);
    }
  }, [acaoNoEditor, modo, ativaId, controleEditor]);
  const obraDaLista = obraAberta !== null && 'id' in obraAberta ? (t?.obras.find((o) => o.obra.id === obraAberta.id)?.obra ?? null) : null;
  const comObra = obraAberta !== null && ('nova' in obraAberta || obraDaLista !== null);
  const comConferencia = conferencia !== null;
  const comFormulario = comConferencia || comObra || (elementoId !== null && (t?.preTextuais?.lista.some((x) => x.id === elementoId) ?? false));
  const { aoMudarFormulario } = p;
  useEffect(() => {
    aoMudarFormulario?.(comFormulario);
    return () => aoMudarFormulario?.(false);
  }, [comFormulario, aoMudarFormulario]);
  const { pedidoFoco, consumirFoco } = e;
  // Depois de mudar de seção ou de estrutura: o foco vai ao editor (já montado: os efeitos do filho rodam antes), ao
  // título ou ao item ativo da árvore (sem seções, ao botão "Nova seção").
  useEffect(() => {
    if (pedidoFoco === null) return;
    if (pedidoFoco.alvo === 'editor') controleEditor.current?.focar();
    else if (pedidoFoco.alvo === 'editorSePerdido') {
      if (!controleEditor.current?.temFoco()) controleEditor.current?.focar();
    }
    else if (pedidoFoco.alvo === 'titulo') controleEditor.current?.focarTitulo();
    else {
      const item = refArvore.current?.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]');
      (item ?? refEscrever.current?.querySelector<HTMLElement>('.acoes-secao__nova'))?.focus();
    }
    consumirFoco();
  }, [pedidoFoco, consumirFoco, controleEditor]);

  if (t === null) {
    return (
      <div className="estado">
        <Pequi />
        <h2>Nenhum trabalho aberto</h2>
        <p>Abra um trabalho da Biblioteca ou comece um novo.</p>
        <div className="acoes">
          <button type="button" className="btn-principal" onClick={p.aoCriar} disabled={p.ocupado}>
            Novo trabalho
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoAbrir} disabled={p.ocupado}>
            Abrir…
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoIrParaBiblioteca}>
            Ir para a Biblioteca
          </button>
        </div>
      </div>
    );
  }

  const secoes = t.secoes;
  const ativa = e.ativa;
  const pre = t.preTextuais;
  const elementoAtivo = comObra || comConferencia ? null : (pre?.lista.find((x) => x.id === elementoId) ?? null);
  const visualAtivo = modo === 'elementos' && elementoAtivo === null ? (t.elementos.find((x) => x.id === visualId && x.bloco !== undefined) ?? null) : null;
  /** Leva à aba Escrever, na seção, e faz a ação do gerenciador quando o editor dela estiver na tela. */
  const noEditor = (secao: string, acao: AcaoNoEditor) => {
    setAcaoNoEditor({ secao, acao });
    escolher(secao, null);
    aoIrParaModo?.('escrever');
  };
  const escolher = (id: string, foco: PedidoFoco['alvo'] | null) => {
    setElementoId(null);
    setObraAberta(null);
    e.escolher(id, foco);
    setAvisosEditor([]);
  };

  return (
    <>
      <div className="principal__cab">
        <h1>{TITULOS_MODO[modo]}</h1>
        <div className="acoes">
          {modo === 'escrever' && (
            <button
              type="button"
              className="btn-secundario btn-com-icone"
              aria-expanded={!estruturaOculta}
              aria-controls={ID_PAINEL_ESTRUTURA}
              title="Mostra ou oculta a lista de elementos, seções e obras ao lado do texto"
              onClick={alternarEstrutura}
            >
              <Icone nome="estrutura" />
              {estruturaOculta ? 'Mostrar estrutura' : 'Ocultar estrutura'}
            </button>
          )}
          {p.conformidade && modo === 'escrever' && <button type="button" className="btn-secundario" onClick={() => setRelatorioConformidade(p.conformidade!.verificar())}>Verificar conformidade</button>}
          {p.aoAtualizarCadastros && (modo === 'escrever' || modo === 'elementos') && <button type="button" className="btn-secundario" onClick={() => setCadastrosAbertos(true)}>Siglas, símbolos e glossário…</button>}
          {t.podeSalvar && (
            <button type="button" className="btn-principal" onClick={p.aoSalvar} aria-keyshortcuts="Control+S">
              Salvar
            </button>
          )}
          {!t.somenteLeitura && !t.podeSalvar && (
            <button type="button" className="btn-principal" onClick={() => p.aoAcao('salvarComo')} aria-keyshortcuts="Control+Shift+S">
              Salvar como…
            </button>
          )}
          <button type="button" className="btn-secundario" onClick={p.aoFechar} aria-keyshortcuts="Control+W">
            Fechar trabalho
          </button>
        </div>
      </div>

      <ul className="avisos" aria-label="Avisos do trabalho" hidden={p.estado.avisos.length === 0}>
        {p.estado.avisos.map((a) => (
          <AvisoComAcoes key={a.texto} aviso={a} rotuloDescartar={p.rotuloDescartar} aoAcao={p.aoAcao} />
        ))}
      </ul>
      {p.avisoRetomadaIa && (
        <ul className="avisos" aria-label="Tarefa de IA interrompida">
          <li className="aviso aviso--info">
            <span className="aviso__texto" role="status">
              {p.avisoRetomadaIa}
            </span>
            <span className="aviso__acoes">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => {
                  if (modo === 'elementos') {
                    setElementoId(null);
                    setVisualId(null);
                    abrirPainel('ia');
                  } else {
                    manterAoTrocar.current = true;
                    abrirPainel('ia');
                    aoIrParaModo?.('elementos');
                  }
                }}
              >
                Abrir o assistente de IA
              </button>
            </span>
          </li>
        </ul>
      )}
      <p className="dica" role="status" hidden={anuncioNC === null}>
        {anuncioNC}
      </p>

      {modo === 'conformidade' ? (
        relatorioAba && p.conformidade ? (
          <Conformidade
            embutido
            relatorio={relatorioAba}
            aoAtualizar={() => setRelatorioAba(p.conformidade!.verificar())}
            aoExportar={p.conformidade.exportar}
            aoFechar={() => undefined}
            aoLocal={(local) => irAoLocal(local, true)}
          />
        ) : (
          <p className="dica">O verificador não está disponível para este trabalho.</p>
        )
      ) : (
      <>
      {modo === 'escrever' && <form className="formulario formulario--compacto formulario--linha" onSubmit={(ev) => ev.preventDefault()} aria-label="Dados do trabalho">
        <label htmlFor={ID_CAMPO_TITULO}>Título do trabalho</label>
        <input
          id={ID_CAMPO_TITULO}
          className="campo"
          type="text"
          value={t.titulo}
          placeholder="Sem título"
          readOnly={t.somenteLeitura}
          aria-describedby="dica-titulo"
          spellCheck={false}
          onChange={(ev) => p.aoAlterarTitulo(ev.target.value)}
        />
        <AjudaContextual titulo="Título e salvamento">
          <TextoAjuda>O título vai para a capa, a folha de rosto e o visor no alto da janela.</TextoAjuda>
          <TextoAjuda>{DICA_SALVAR}</TextoAjuda>
        </AjudaContextual>
        {/* A dica continua descrevendo o campo para leitores de tela; na tela, ela está na ajuda (Etapa 2). */}
        <p className={t.somenteLeitura ? 'dica' : 'dica sr-only'} id="dica-titulo">
          {t.somenteLeitura ? 'Somente leitura: este trabalho foi gravado por uma versão mais nova do BiblioDocs Pro.' : DICA_SALVAR}
        </p>
        <dl className="formulario__dados">
          <dt>Arquivo</dt>
          <dd>{t.nomeArquivo}</dd>
          <dt>Tipo</dt>
          <dd>{rotuloTipo(t.tipoTrabalho)}</dd>
        </dl>
      </form>}

      <div className={semEstrutura ? 'escrever escrever--sem-estrutura' : 'escrever'} ref={refEscrever}>
        <div className="escrever__coluna" id={ID_PAINEL_ESTRUTURA} hidden={semEstrutura}>
        {pre !== null && modo !== 'referencias' && (
          <ListaElementos
            elementos={pre.resumos}
            ausentes={pre.ausentes}
            pendenciasGerais={pre.pendencias.filter((x) => !pre.lista.some((el) => el.tipo === x.elemento))}
            ativoId={elementoAtivo?.id ?? null}
            somenteLeitura={t.somenteLeitura}
            anuncio={anuncioElemento}
            sugestaoInclusao={sugestaoPre}
            aoEscolher={(id) => {
              setAnuncioElemento(null);
              setObraAberta(null);
              setConferencia(null);
              setElementoId(id);
            }}
            aoIncluir={(tipo) => {
              const id = p.elementos.incluir(tipo);
              if (id !== null) {
                setObraAberta(null);
                setElementoId(id);
                setAnuncioElemento(`${ROTULOS_ELEMENTO[tipo]} incluído. Ctrl+Z desfaz.`);
              }
            }}
            aoHistorico={e.historico}
          />
        )}
        {modo === 'escrever' && <ArvoreSecoes
          secoes={secoes}
          ativaId={ativa?.id ?? null}
          somenteLeitura={t.somenteLeitura}
          aviso={e.aviso}
          refArvore={refArvore}
          aoEscolher={escolher}
          aoNova={() => {
            setAvisosEditor([]);
            e.novaSecao();
          }}
          aoOperar={(acao, foco) => e.operar(acao, foco)}
          aoMover={(id, alvo, lado) => e.moverJunto(id, alvo, lado)}
          aoHistorico={e.historico}
          aoIrAoTexto={e.pedirFoco}
        />}
        {p.posTextuais && modo !== 'referencias' && (
          <PosTextuais
            elementos={t.posTextuais ?? []}
            somenteLeitura={t.somenteLeitura}
            ativoId={ativa?.id ?? null}
            {...(t.rotulosPosTextuais ? { rotulos: t.rotulosPosTextuais } : {})}
            aoEscolher={(id) => {
              escolher(id, 'editor');
              // Apêndice e anexo são escritos no editor, que fica na aba Escrever.
              if (modo !== 'escrever') aoIrParaModo?.('escrever');
            }}
            aoIncluir={(tipo) => {
              const id = p.posTextuais!.incluir(tipo);
              // Apêndice e anexo têm conteúdo: o novo abre no editor.
              if (id !== null && (tipo === 'apendice' || tipo === 'anexo')) {
                escolher(id, 'titulo');
                if (modo !== 'escrever') aoIrParaModo?.('escrever');
              }
            }}
            aoRetirar={(id) => void p.posTextuais!.retirar(id)}
            aoRenomear={(id, titulo) => void p.posTextuais!.renomear(id, titulo)}
            aoMover={(id, sentido) => void p.posTextuais!.mover(id, sentido)}
            aoHistorico={e.historico}
          />
        )}
        {modo === 'elementos' && (
          <ListaVisuais
            elementos={t.elementos}
            ativoId={visualAtivo?.id ?? null}
            somenteLeitura={t.somenteLeitura}
            aoEscolher={(x) => {
              setElementoId(null);
              setRegistroAberto(false);
              setModeloAberto(false);
              setVisualId(x.id);
            }}
            aoMencoes={() => {
              setElementoId(null);
              setRegistroAberto(false);
              setModeloAberto(false);
              setVisualId(null);
            }}
            aoNovo={(qual) => {
              if (ativa === null) {
                setAnuncioElemento('Abra ou crie uma seção na aba Escrever: o elemento entra no ponto do cursor dela.');
                return;
              }
              setAcaoNoEditor({ secao: ativa.id, acao: { tipo: 'novo', qual } });
              aoIrParaModo?.('escrever');
            }}
          />
        )}
        {modo === 'elementos' && p.registro && (
          <section className="elementos" aria-labelledby="titulo-registro">
            <h2 id="titulo-registro">Registro e cronograma</h2>
            <button
              type="button"
              className="elementos__item"
              aria-current={registroAberto ? 'true' : undefined}
              onClick={() => {
                setElementoId(null);
                setVisualId(null);
                setModeloAberto(false);
                setRegistroAberto(true);
              }}
            >
              <span>Registro de atividades</span>
              <span className="elementos__marca">
                {t.registro ? `${t.registro.linhas.length === 1 ? '1 linha' : `${t.registro.linhas.length} linhas`}${t.registroIncorporado ? `, no ${t.registroIncorporado.rotulo}` : ', fora do trabalho'}` : 'não iniciado'}
              </span>
            </button>
          </section>
        )}
        {modo === 'elementos' && p.modeloEvento && (
          <section className="elementos" aria-labelledby="titulo-modelo-evento">
            <h2 id="titulo-modelo-evento">Formatação</h2>
            <button
              type="button"
              className="elementos__item"
              aria-current={modeloAberto ? 'true' : undefined}
              onClick={() => {
                setElementoId(null);
                setVisualId(null);
                setRegistroAberto(false);
                setModeloAberto(true);
              }}
            >
              <span>Modelo de evento (DOCX)</span>
              <span className="elementos__marca">{t.modelo ? `“${t.modelo.nome}”` : 'Manual da UFT'}</span>
            </button>
          </section>
        )}
        {modo === 'elementos' && p.ia && (
          <section className="elementos" aria-labelledby="titulo-assistente-ia">
            <h2 id="titulo-assistente-ia">Inteligência artificial</h2>
            <button
              type="button"
              className="elementos__item"
              aria-current={iaAberto ? 'true' : undefined}
              onClick={() => {
                setElementoId(null);
                setVisualId(null);
                abrirPainel('ia');
              }}
            >
              <span>Assistente de IA</span>
              {p.avisoRetomadaIa && <span className="elementos__marca elementos__marca--pendente">tarefa interrompida</span>}
            </button>
          </section>
        )}
        {modo !== 'elementos' && <ListaObras
          obras={t.obras}
          ativaId={obraDaLista?.id ?? null}
          somenteLeitura={t.somenteLeitura}
          anuncio={anuncioObra}
          aoEscolher={(id) => {
            setAnuncioObra(null);
            setElementoId(null);
            setConferencia(null);
            setObraAberta({ id });
          }}
          aoImportar={(arquivo) => void lerArquivoImportado(arquivo)}
          aoConferir={() => {
            setElementoId(null);
            setObraAberta(null);
            setConferencia(p.obras.verificar());
          }}
          aoNova={() => {
            setAnuncioObra(null);
            setElementoId(null);
            setConferencia(null);
            setContadorNova((n) => n + 1);
            setObraAberta({ nova: { id: 'obr_rascunho0001', tipo: 'livro', titulo: [] } });
          }}
          aoHistorico={e.historico}
        />}
        {importacao !== null && (
          <DialogoImportacao
            nomeArquivo={importacao.nomeArquivo}
            previa={importacao.previa}
            avisoArquivo={importacao.aviso}
            aoFechar={() => setImportacao(null)}
            aoImportar={(itens: readonly ItemImportacao[]) => {
              setImportacao(null);
              const r = p.obras.importar(itens.flatMap((i) => (i.obra ? [i.obra] : [])));
              if (!r.ok) setAnuncioObra(r.mensagem);
              else {
                const n = r.ids.length;
                setAnuncioObra(`${n === 1 ? '1 obra importada' : `${n} obras importadas`}${r.recusadas > 0 ? ` (${r.recusadas} recusada${r.recusadas === 1 ? '' : 's'})` : ''}. Ctrl+Z desfaz.`);
              }
            }}
          />
        )}
        </div>

        {cadastrosAbertos && p.aoAtualizarCadastros && <Cadastros dados={t.cadastros ?? {}} somenteLeitura={t.somenteLeitura} aoAlterar={p.aoAtualizarCadastros} aoFechar={() => setCadastrosAbertos(false)} />}
        {relatorioConformidade && p.conformidade && <Conformidade
          relatorio={relatorioConformidade}
          aoAtualizar={() => setRelatorioConformidade(p.conformidade!.verificar())}
          aoExportar={p.conformidade.exportar}
          aoFechar={() => setRelatorioConformidade(null)}
          aoLocal={(local) => irAoLocal(local, false)}
        />}
        <section
          className="escrever__texto"
          aria-labelledby={elementoAtivo || comObra || comConferencia ? undefined : 'titulo-secao-ativa'}
          aria-label={comConferencia ? 'Conferência da bibliografia' : comObra ? 'Obra da bibliografia' : elementoAtivo ? 'Elemento pré-textual' : undefined}
        >
          {conferencia !== null ? (
            <ConferenciaBibliografia
              problemas={conferencia}
              obras={t.obras}
              secoes={t.secoes}
              aoFechar={() => setConferencia(null)}
              aoAbrirObra={(id) => {
                setConferencia(null);
                setAnuncioObra(null);
                setObraAberta({ id });
              }}
              aoIrAoTexto={(local) => {
                setConferencia(null);
                setIrAoTexto(local);
                e.escolher(local.secao, null);
                if (modo !== 'escrever') aoIrParaModo?.('escrever');
              }}
            />
          ) : comObra && obraAberta !== null ? (
            <FormularioObra
              key={'nova' in obraAberta ? `nova-${contadorNova}` : obraAberta.id}
              obra={'nova' in obraAberta ? obraAberta.nova : obraDaLista!}
              nova={'nova' in obraAberta}
              somenteLeitura={t.somenteLeitura}
              aoIncluir={(obra) => {
                const r = p.obras.incluir(obra);
                if (r.ok) {
                  setObraAberta({ id: r.id });
                  setAnuncioObra('Obra incluída. Ctrl+Z desfaz.');
                }
                return r;
              }}
              aoAlterar={p.obras.alterar}
              aoExcluir={(id) => {
                const r = p.obras.excluir(id);
                if (r.ok) {
                  setObraAberta(null);
                  setAnuncioObra('Obra excluída. Ctrl+Z desfaz.');
                }
                return r;
              }}
              aoCancelar={() => setObraAberta(null)}
              {...(p.obras.pdf ? { pdf: p.obras.pdf } : {})}
              {...(p.obras.citacoes && obraDaLista ? { citacoes: p.obras.citacoes(obraDaLista.id) } : {})}
            />
          ) : elementoAtivo !== null && pre !== null ? (
            <FormularioElemento
              key={elementoAtivo.id}
              elemento={elementoAtivo}
              dados={pre.dados}
              subtitulo={pre.subtitulo}
              sugerido={pre.resumos.find((x) => x.id === elementoAtivo.id)?.sugerido === true}
              rotuloOrientador={t.tipoTrabalho === 'projeto-pesquisa' ? 'Coordenador(a)' : 'Orientador(a)'}
              tipoTrabalho={t.tipoTrabalho as TipoTrabalhoId}
              {...(p.elementos.aplicarCatalogo ? { aoAplicarCatalogo: p.elementos.aplicarCatalogo } : {})}
              pendencias={pre.pendencias.filter((x) => x.elemento === elementoAtivo.tipo)}
              somenteLeitura={t.somenteLeitura}
              aoAlterarDados={p.elementos.alterarDados}
              aoAlterarSubtitulo={p.elementos.alterarSubtitulo}
              aoAlterarElemento={p.elementos.alterar}
              aoRetirar={(id) => {
                if (p.elementos.retirar(id)) {
                  setElementoId(null);
                  setAnuncioElemento(`${ROTULOS_ELEMENTO[elementoAtivo.tipo]} retirado. Ctrl+Z desfaz.`);
                  refEscrever.current?.querySelector<HTMLElement>('.elementos__item')?.focus();
                }
              }}
            />
          ) : iaAberto && modo === 'elementos' && p.ia && elementoAtivo === null ? (
            <PainelIA
              api={p.ia.api}
              trabalho={{ id: p.ia.idTrabalho, nome: t.titulo || t.nomeArquivo }}
              tabelas={t.elementos.flatMap((x) => (x.tipo === 'tabela' && x.bloco?.tipo === 'tabela' ? [{ id: x.id, rotulo: x.rotulo, descricao: x.descricao, bloco: x.bloco as BlocoTabela }] : []))}
              modelo={t.modelo}
              somenteLeitura={t.somenteLeitura}
              aoAplicarTabela={(id, dados) => {
                const el = t.elementos.find((x) => x.id === id);
                if (el) noEditor(el.secao, { tipo: 'sugestaoTabela', id, dados });
              }}
              aoAplicarModelo={p.ia.aplicarModelo}
              aoMudarRetomada={p.ia.aoMudarRetomada}
            />
          ) : modeloAberto && modo === 'elementos' && p.modeloEvento && elementoAtivo === null ? (
            <PainelModelo
              modelo={t.modelo}
              somenteLeitura={t.somenteLeitura}
              secoesQueFaltam={p.modeloEvento.secoesQueFaltam()}
              aoAplicar={p.modeloEvento.aplicar}
              aoCriarSecoes={p.modeloEvento.criarSecoes}
            />
          ) : registroAberto && modo === 'elementos' && p.registro && elementoAtivo === null ? (
            <PainelRegistro
              registro={t.registro}
              incorporado={t.registroIncorporado ?? null}
              apendices={(t.posTextuais ?? []).flatMap((e) => (e.tipo === 'apendice' ? [{ id: e.id, rotulo: t.rotulosPosTextuais?.get(e.id) ?? 'APÊNDICE', titulo: e.titulo ?? '' }] : []))}
              somenteLeitura={t.somenteLeitura}
              aoAlterar={p.registro.alterar}
              aoIncorporar={p.registro.incorporar}
              aoAtualizar={p.registro.atualizar}
              aoRetirar={p.registro.retirar}
              aoExportar={p.registro.exportar}
            />
          ) : visualAtivo !== null ? (
            <PainelElemento
              elemento={visualAtivo}
              elementos={t.elementos}
              somenteLeitura={t.somenteLeitura}
              secaoDoCursor={ativa?.id ?? null}
              lerMidia={p.midias.ler}
              aoIrAoTexto={() => {
                setIrAoTexto({ tipo: 'texto', secao: visualAtivo.secao, no: visualAtivo.id, trecho: '' });
                escolher(visualAtivo.secao, null);
                aoIrParaModo?.('escrever');
              }}
              aoEditar={() => noEditor(visualAtivo.secao, { tipo: 'editar', id: visualAtivo.id, bloco: visualAtivo.bloco!.tipo })}
              aoRemissivaNoCursor={() => {
                if (ativa === null) return;
                setAcaoNoEditor({ secao: ativa.id, acao: { tipo: 'remissiva', alvo: visualAtivo.id } });
                aoIrParaModo?.('escrever');
              }}
              aoVoltar={() => setVisualId(null)}
            />
          ) : modo === 'elementos' && p.mencoes ? (
            <PainelMencoes
              mencoes={p.mencoes()}
              elementos={t.elementos}
              somenteLeitura={t.somenteLeitura}
              aoIr={(secao, no, trecho) => {
                setIrAoTexto({ tipo: 'texto', secao, no, trecho });
                escolher(secao, null);
                aoIrParaModo?.('escrever');
              }}
              aoLigar={(secao, bloco, trecho) => noEditor(secao, { tipo: 'ligar', bloco, trecho })}
            />
          ) : modo !== 'escrever' ? (
            <p className="dica" id="titulo-secao-ativa">
              {modo === 'elementos'
                ? 'Escolha um elemento na lista para preenchê-lo. Apêndices, anexos, tabelas e figuras abrem na aba Escrever.'
                : 'Escolha uma obra na lista, inclua uma nova ou use “Conferir” para comparar as citações com as obras.'}
            </p>
          ) : ativa === null ? (
            <p className="dica" id="titulo-secao-ativa">
              {t.somenteLeitura ? 'Este trabalho não tem seções.' : 'Use “Nova seção” para começar o texto.'}
            </p>
          ) : (
            <>
              <h2 className="escrever__numero" id="titulo-secao-ativa">
                Seção {ativa.indicativo}
              </h2>
              <EditorSecao
                secaoId={ativa.id}
                geracao={t.geracao}
                memoria={e.memoria}
                ler={p.lerSecao}
                somenteLeitura={t.somenteLeitura}
                rotulo={`Texto da seção ${ativa.indicativo}`}
                aoAlterar={p.aoAlterarSecao}
                aoRegistrarTexto={e.registrarTexto}
                aoHistorico={e.historico}
                aoAvisar={setAvisosEditor}
                controle={controleEditor}
                formatarChamada={formatarChamada}
                reconhecerChamadas={reconhecerChamadas}
                aoPedirCitacao={pedirCitacao}
                aoPedirTabela={pedirTabela}
                aoPedirFigura={pedirFigura}
                lerMidia={p.midias.ler}
                rotulosRemissiva={rotulosRemissiva}
                aoPedirRemissiva={pedirRemissiva}
                tabelasDoTrabalho={tabelasDoTrabalho}
                aoPedirGrafico={pedirGrafico}
                siglas={t.cadastros?.siglas ?? []}
                aoPedirSigla={pedirSigla}
              />
              {pedidoSigla !== null && <DialogoSigla
                siglas={t.cadastros?.siglas ?? []}
                atual={pedidoSigla.existente?.sigla ?? null}
                aoConfirmar={(id) => {
                  const existente = pedidoSigla.existente;
                  setPedidoSigla(null);
                  if (existente) controleEditor.current?.alterarSigla(existente.id, id);
                  else controleEditor.current?.inserirSigla(id);
                }}
                aoFechar={() => setPedidoSigla(null)}
                aoCadastrar={() => { setPedidoSigla(null); setCadastrosAbertos(true); }}
              />}
              {pedidoGrafico !== null && (
                <DialogoGrafico
                  elementos={t.elementos}
                  inicial={pedidoGrafico.existente?.dados ?? null}
                  areaUtilMm={areaUtilDoPerfilMm(t.modelo)}
                  aoConfirmar={(dados) => {
                    const x = pedidoGrafico.existente;
                    setPedidoGrafico(null);
                    if (x === null) controleEditor.current?.inserirGrafico(dados);
                    else controleEditor.current?.alterarGrafico(x.id, dados);
                  }}
                  aoFechar={() => setPedidoGrafico(null)}
                />
              )}
              {pedidoRemissiva !== null && (
                <DialogoRemissiva
                  elementos={t.elementos}
                  alvoAtual={pedidoRemissiva.existente?.alvo ?? null}
                  textoAtual={pedidoRemissiva.existente?.texto ?? null}
                  mencaoEscrita={pedidoRemissiva.mencao}
                  aoConfirmar={(alvo, forma) => {
                    const x = pedidoRemissiva.existente;
                    setPedidoRemissiva(null);
                    if (x === null) controleEditor.current?.inserirRemissiva(alvo, { ...(forma.texto !== null ? { texto: forma.texto } : {}), substituir: pedidoRemissiva.mencao !== null });
                    else controleEditor.current?.alterarRemissiva(x.id, alvo, forma.texto);
                  }}
                  aoFechar={() => setPedidoRemissiva(null)}
                />
              )}
              {pedidoFigura !== null && (
                <DialogoFigura
                  inicial={pedidoFigura.existente?.dados ?? null}
                  lerMidia={p.midias.ler}
                  aoConfirmar={(dados, imagem) => {
                    const x = pedidoFigura.existente;
                    if (imagem !== null) {
                      const r = p.midias.incluir(imagem.bytes, imagem.sha256);
                      if (!r.ok) {
                        setAvisosEditor([r.mensagem]);
                        return;
                      }
                    }
                    setPedidoFigura(null);
                    if (x === null) controleEditor.current?.inserirFigura(dados);
                    else controleEditor.current?.alterarFigura(x.id, dados);
                  }}
                  aoFechar={() => setPedidoFigura(null)}
                />
              )}
              {pedidoTabela !== null && (
                <DialogoTabela
                  inicial={pedidoTabela.existente?.dados ?? null}
                  aoConfirmar={(dados) => {
                    const x = pedidoTabela.existente;
                    setPedidoTabela(null);
                    if (x === null) controleEditor.current?.inserirTabela(dados);
                    else controleEditor.current?.alterarTabela(x.id, dados);
                  }}
                  aoFechar={() => setPedidoTabela(null)}
                />
              )}
              {pedidoCitacao !== null && (
                <DialogoCitacao
                  obras={t.obras}
                  inicial={pedidoCitacao.existente?.dados ?? null}
                  escrita={pedidoCitacao.escrita}
                  formatar={formatarChamada}
                  aoConfirmar={(dados) => {
                    const c = pedidoCitacao.existente;
                    setPedidoCitacao(null);
                    if (c === null) controleEditor.current?.inserirCitacao(dados, pedidoCitacao.escrita !== null);
                    else controleEditor.current?.alterarCitacao(c.id, dados);
                  }}
                  aoRetirar={() => {
                    const c = pedidoCitacao.existente;
                    setPedidoCitacao(null);
                    if (c !== null) controleEditor.current?.retirarCitacao(c.id);
                  }}
                  aoFechar={() => setPedidoCitacao(null)}
                  aoCadastrarObra={() => {
                    focarAoFecharCitacao.current = false;
                    setPedidoCitacao(null);
                    setAnuncioObra(null);
                    setElementoId(null);
                    setContadorNova((n) => n + 1);
                    setObraAberta({ nova: { id: 'obr_rascunho0001', tipo: 'livro', titulo: [] } });
                  }}
                />
              )}
            </>
          )}
          <ul className="avisos" aria-label="Avisos do editor" hidden={avisosEditor.length === 0}>
            {avisosEditor.map((texto) => (
              <li key={texto} className="aviso">
                <Icone nome="alerta" />
                <span className="aviso__texto" role="status">
                  {texto}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      </>
      )}
    </>
  );
}

const ROTULOS_ACAO: Record<Exclude<AcaoAviso, 'descartar'>, string> = { salvarComo: 'Salvar como…' };

function AvisoComAcoes({ aviso, rotuloDescartar, aoAcao }: { aviso: AvisoSessao; rotuloDescartar: string; aoAcao: (a: AcaoAviso) => void }) {
  const classe = aviso.nivel === 'erro' ? 'aviso aviso--erro' : aviso.nivel === 'info' ? 'aviso aviso--info' : 'aviso';
  const papel = aviso.nivel === 'erro' ? 'alert' : aviso.nivel === 'info' ? 'status' : undefined;
  const icone = aviso.nivel === 'erro' ? 'erro' : aviso.nivel === 'info' ? 'ok' : 'alerta';
  return (
    // O papel vivo fica no texto, não no <li> (que perderia o papel de item de lista).
    <li className={classe}>
      <Icone nome={icone} />
      <span className="aviso__texto" role={papel}>
        {aviso.texto}
      </span>
      {aviso.acoes.length > 0 && (
        <span className="aviso__acoes">
          {aviso.acoes.map((a) => (
            <button key={a} type="button" className="btn-secundario" onClick={() => aoAcao(a)}>
              {a === 'descartar' ? rotuloDescartar : ROTULOS_ACAO[a]}
            </button>
          ))}
        </span>
      )}
    </li>
  );
}
