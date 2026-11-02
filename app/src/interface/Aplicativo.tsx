// Casca da interface (M1-T10; docs/REFERENCIA_DE_LAYOUT.md, seção 4; decisões do usuário em docs/GUIA_VISUAL.md):
// barra superior com visor e busca, barra de menus, navegação (coleção + abas), barra lateral e grade de trabalhos.
// M1-T11: fluxo criar → editar título → salvar → fechar → abrir, com o estado de salvamento no visor e o salvamento
// automático do ADR-0004 (sessão de edição em aplicacao/servicos/sessao-trabalho.ts).
// M1-T12: ao iniciar, a Biblioteca mostra o que há para recuperar (instantâneo de um trabalho que estava aberto quando o
// app foi fechado inesperadamente, gravação interrompida, `.bak` íntegro de um arquivo que não abre).
// M2-T06: o editor de seção na aba Escrever e os menus Editar e Inserir › Nota de rodapé.
// M2-T07: árvore de seções, ordem única de desfazer (texto e estrutura), "Seção anterior/Próxima seção" na barra
// superior e Trabalho › Estrutura de seções… (`escrever/useEstrutura.ts`).
// M2-T02: "Novo trabalho" abre o diálogo de escolha do tipo; o trabalho nasce com os elementos e as seções do tipo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AcaoAviso,
  AcaoEdicao,
  ApiBiblioDocs,
  IdentificadorItem,
  IdentificadorOferta,
  OfertaRecuperacao,
  ResultadoAbrir,
  ResultadoAbrirDescartada,
  ResultadoRecuperar,
  VersaoDescartada,
} from '../aplicacao';
import type { TipoTrabalhoUft } from '../dominio/modelo';
import { AreaBiblioteca } from './biblioteca/AreaBiblioteca';
import { BarraLateral } from './biblioteca/BarraLateral';
import { DialogoNovoTrabalho } from './biblioteca/DialogoNovoTrabalho';
import { DialogoVersoesDescartadas } from './biblioteca/DialogoVersoesDescartadas';
import { PainelDetalhes } from './biblioteca/PainelDetalhes';
import { avisoRecuperado, textoDescartada } from './biblioteca/recuperacao';
import { aplicarFiltro, buscar, contar, FILTRO_TODOS, mesmoFiltro, tituloDaLista, type Filtro } from './biblioteca/selecao';
import { FALHA_INESPERADA, useBiblioteca } from './biblioteca/useBiblioteca';
import { BarraMenus } from './casca/BarraMenus';
import { BarraSuperior } from './casca/BarraSuperior';
import { ABAS, COLECOES, comandosDesativados, type ComandoMenu, type IdAba, type IdColecao } from './casca/definicoes';
import { ID_PAINEL, idDaAba, Navegacao } from './casca/Navegacao';
import { acaoDoAtalho, avancar, iniciarHistorico, navegar, voltar } from './casca/teclado';
import { visorDoTrabalho } from './casca/visor';
import type { ControleEditor } from './editor/EditorSecao';
import { avisoSomenteLeitura, avisosDaAbertura, mensagemVersaoFutura } from './escrever/aberturas';
import { AreaEscrever, ID_CAMPO_TITULO } from './escrever/AreaEscrever';
import { useEstrutura } from './escrever/useEstrutura';
import { useSessao } from './escrever/useSessao';
import { SimbolosSvg } from './Icones';

/** Lugar da interface guardado no histórico de Voltar/Avançar. */
interface Local {
  aba: IdAba;
  colecao: IdColecao;
  filtro: Filtro;
}

/** O comando do menu Editar não chegou ao principal (o atalho do teclado não depende dele). */
export const MENSAGEM_FALHA_EDICAO = 'O comando de edição não pôde ser executado. Tente o atalho do teclado (Ctrl+C, Ctrl+V…).';

const mesmoLocal = (a: Local, b: Local): boolean => a.aba === b.aba && a.colecao === b.colecao && mesmoFiltro(a.filtro, b.filtro);

export function Aplicativo({ api }: { api: ApiBiblioDocs }) {
  const bib = useBiblioteca(api);
  const { recarregar, escolherPasta, mostrarMensagem } = bib;
  const { sessao, estado: sessaoEstado } = useSessao(api, () => void recarregar());
  const [historico, setHistorico] = useState(() => iniciarHistorico<Local>({ aba: 'biblioteca', colecao: 'trabalhos', filtro: FILTRO_TODOS }));
  const [busca, setBusca] = useState('');
  const [modoLista, setModoLista] = useState(false);
  const [selecionado, setSelecionado] = useState<IdentificadorItem | null>(null);
  const [ofertas, setOfertas] = useState<readonly OfertaRecuperacao[]>([]);
  // Objeto novo a cada pedido, para focar de novo o mesmo cartão (ex.: ao fechar o painel).
  const [focarId, setFocarId] = useState<{ id: IdentificadorItem } | null>(null);
  const [focarTitulo, setFocarTitulo] = useState(0);
  const [focarPainel, setFocarPainel] = useState(0);
  // O usuário pediu para sair e a gravação falhou: o aviso oferece "Sair sem salvar".
  const [saidaPedida, setSaidaPedida] = useState(false);
  const permitirSaida = useRef(false);
  // Uma troca de trabalho por vez (criar, abrir): trava síncrona, ligada antes do primeiro `await` (revisão do M1-T11).
  const trocando = useRef(false);
  const saindo = useRef(false);
  const refBusca = useRef<HTMLInputElement>(null);
  const refEditor = useRef<ControleEditor | null>(null);
  const [comFormulario, setComFormulario] = useState(false);
  // Último elemento com foco fora da barra de menus: o menu tira o foco dele, e os itens de edição o devolvem antes de
  // agir (e decidem pelo lugar: campo de texto, ou a aba Escrever com a ordem única de desfazer).
  const ultimoFoco = useRef<HTMLElement | null>(null);
  const local = historico.atual;
  const trabalho = sessaoEstado.trabalho;
  const estrutura = useEstrutura(sessao, trabalho, refEditor);

  const ir = useCallback((parcial: Partial<Local>) => {
    setHistorico((h) => navegar(h, { ...h.atual, ...parcial }, mesmoLocal));
  }, []);

  const itensTodos = bib.estado.fase === 'pronta' ? bib.estado.itens : null;
  const contagens = useMemo(() => (itensTodos === null ? null : contar(itensTodos)), [itensTodos]);
  const itensVisiveis = useMemo(
    () => (itensTodos === null ? [] : buscar(aplicarFiltro(itensTodos, local.filtro), busca)),
    [itensTodos, local.filtro, busca],
  );
  const itemSelecionado = itensVisiveis.find((i) => i.identificador === selecionado) ?? null;

  const focarBusca = useCallback(() => {
    refBusca.current?.focus();
    refBusca.current?.select();
  }, []);

  useEffect(() => {
    if (focarTitulo > 0) document.getElementById(ID_CAMPO_TITULO)?.focus();
  }, [focarTitulo]);
  useEffect(() => {
    if (focarPainel > 0) document.getElementById(ID_PAINEL)?.focus();
  }, [focarPainel]);

  /**
   * Volta à Biblioteca depois de fechar o trabalho, com o foco no cartão selecionado (ou no painel): o que tinha o foco
   * na aba Escrever deixou de existir (revisão do M1-T11; WCAG 2.4.3).
   */
  const voltarABiblioteca = useCallback(() => {
    ir({ aba: 'biblioteca', colecao: 'trabalhos' });
    if (selecionado !== null && itensVisiveis.some((i) => i.identificador === selecionado)) setFocarId({ id: selecionado });
    else setFocarPainel((n) => n + 1);
  }, [ir, itensVisiveis, selecionado]);

  const irParaEscrever = useCallback(() => ir({ aba: 'escrever' }), [ir]);

  /** Roda `tarefa` se nenhuma outra troca de trabalho estiver em curso. */
  const exclusivo = useCallback(async (tarefa: () => Promise<void>) => {
    if (trocando.current) return;
    trocando.current = true;
    try {
      await tarefa();
    } finally {
      trocando.current = false;
    }
  }, []);

  /** Antes de trocar de trabalho: grava o atual (ADR-0004). Se não deu, mostra o motivo na aba Escrever. */
  const liberarAtual = useCallback(async (): Promise<boolean> => {
    if (await sessao.garantirSalvo()) return true;
    irParaEscrever();
    return false;
  }, [irParaEscrever, sessao]);

  /** Leva o resultado de uma abertura para a sessão (edição ou só leitura) ou para uma mensagem na Biblioteca. */
  const receberAbertura = useCallback(
    (r: ResultadoAbrir) => {
      if (r.ok) {
        sessao.abrir(r.projeto, avisosDaAbertura(r.projeto));
      } else if (r.motivo === 'CANCELADO') {
        return;
      } else if (r.motivo === 'VERSAO_FUTURA' && r.leitura !== null) {
        sessao.abrirSomenteLeitura(r.nomeArquivo, r.leitura.pacote, [
          avisoSomenteLeitura(r.nomeArquivo),
          ...r.leitura.avisos.map((a) => ({ nivel: 'alerta' as const, texto: a.mensagem, acoes: [] })),
        ]);
      } else {
        mostrarMensagem({ tipo: 'erro', texto: r.motivo === 'ERRO' ? r.mensagem : mensagemVersaoFutura(r.nomeArquivo, r.versaoFormato) });
        ir({ aba: 'biblioteca', colecao: 'trabalhos' });
        return;
      }
      setSaidaPedida(false);
      irParaEscrever();
      setFocarTitulo((n) => n + 1);
    },
    [ir, irParaEscrever, mostrarMensagem, sessao],
  );

  const { criar: criarNaBiblioteca, abrir: abrirNaBiblioteca } = bib;

  // Ofertas de recuperação: listadas ao iniciar e depois de cada escolha. Falha na listagem não impede usar o app.
  const listarOfertas = useCallback(async () => {
    try {
      return (await api.recuperacao.listar()).ofertas;
    } catch {
      return [];
    }
  }, [api]);
  useEffect(() => {
    let vivo = true;
    void listarOfertas().then((o) => {
      if (vivo) setOfertas(o);
    });
    return () => {
      vivo = false;
    };
  }, [listarOfertas]);

  const recuperar = useCallback(
    (id: IdentificadorOferta) =>
      exclusivo(async () => {
        if (!(await liberarAtual())) return;
        let r: ResultadoRecuperar;
        try {
          r = await api.recuperacao.recuperar(id);
        } catch {
          r = { ok: false, mensagem: FALHA_INESPERADA };
        }
        if (r.ok) {
          // Instantâneo: o conteúdo ainda não está no arquivo; temporário e .bak já foram restaurados nele.
          sessao.abrir(r.projeto, [avisoRecuperado(r.tipo, r.quando, new Date()), ...avisosDaAbertura(r.projeto)], {
            naoSalvo: r.tipo === 'instantaneo',
          });
          setSaidaPedida(false);
          irParaEscrever();
          setFocarTitulo((n) => n + 1);
        } else {
          mostrarMensagem({ tipo: 'erro', texto: r.mensagem });
        }
        setOfertas(await listarOfertas());
        if (r.ok && r.tipo !== 'instantaneo') void recarregar();
      }),
    [api, exclusivo, irParaEscrever, liberarAtual, listarOfertas, mostrarMensagem, recarregar, sessao],
  );

  const pedirDescartadas = useCallback(async () => {
    setDescartadas(null);
    setDescartadasIncompleta(false);
    try {
      const r = await api.recuperacao.listarDescartadas();
      setDescartadas((atual) => (atual === undefined ? undefined : r.versoes));
      setDescartadasIncompleta(r.incompleta);
    } catch {
      setDescartadas((atual) => (atual === undefined ? undefined : []));
      setDescartadasIncompleta(true);
      mostrarMensagem({ tipo: 'erro', texto: FALHA_INESPERADA });
    }
  }, [api, mostrarMensagem]);

  const abrirDescartada = useCallback(
    (id: IdentificadorOferta) =>
      exclusivo(async () => {
        setDescartadas(undefined);
        if (!(await liberarAtual())) return;
        let r: ResultadoAbrirDescartada;
        try {
          r = await api.recuperacao.abrirDescartada(id);
        } catch {
          r = { ok: false, mensagem: FALHA_INESPERADA };
        }
        if (!r.ok) {
          mostrarMensagem({ tipo: 'erro', texto: r.mensagem });
          return;
        }
        sessao.abrir(r.projeto, avisosDaAbertura(r.projeto), { naoSalvo: true, textoSemDestino: textoDescartada(r.quando, new Date()) });
        setSaidaPedida(false);
        irParaEscrever();
        setFocarTitulo((n) => n + 1);
      }),
    [api, exclusivo, irParaEscrever, liberarAtual, mostrarMensagem, sessao],
  );

  const abrirSalvo = useCallback(
    (id: IdentificadorOferta) =>
      exclusivo(async () => {
        if (!(await liberarAtual())) return;
        let r: ResultadoAbrir;
        try {
          r = await api.recuperacao.abrirSalvo(id);
        } catch {
          r = { ok: false, motivo: 'ERRO', nomeArquivo: '', mensagem: FALHA_INESPERADA, erros: [] };
        }
        receberAbertura(r);
        setOfertas(await listarOfertas());
      }),
    [api, exclusivo, liberarAtual, listarOfertas, receberAbertura],
  );

  // Diálogo de tipo: aberto por "Novo trabalho"; marca o último tipo escolhido na sessão.
  const [escolhendoTipo, setEscolhendoTipo] = useState(false);
  /** Diálogo "Versões descartadas": `undefined` fechado, `null` listando (M2-T11). */
  const [descartadas, setDescartadas] = useState<readonly VersaoDescartada[] | null | undefined>(undefined);
  const [descartadasIncompleta, setDescartadasIncompleta] = useState(false);
  const [ultimoTipo, setUltimoTipo] = useState<TipoTrabalhoUft>('monografia');

  // Com outra troca em curso o diálogo não abre: "Criar trabalho" não faria nada (revisão do M2-T02, M3).
  const pedirNovoTrabalho = useCallback(() => {
    if (!trocando.current) setEscolhendoTipo(true);
  }, []);

  const criar = useCallback(
    (tipo: TipoTrabalhoUft) =>
      exclusivo(async () => {
        if (!(await liberarAtual())) return;
        const r = await criarNaBiblioteca(tipo);
        if (r === null) return;
        sessao.abrir(r.projeto);
        setBusca('');
        setSelecionado(r.id);
        setSaidaPedida(false);
        irParaEscrever();
        setFocarTitulo((n) => n + 1);
      }),
    [criarNaBiblioteca, exclusivo, irParaEscrever, liberarAtual, sessao],
  );

  const abrirPorDialogo = useCallback(
    () =>
      exclusivo(async () => {
        if (!(await liberarAtual())) return;
        let r: ResultadoAbrir;
        try {
          r = await api.projetos.abrir();
        } catch {
          r = { ok: false, motivo: 'ERRO', nomeArquivo: '', mensagem: FALHA_INESPERADA, erros: [] };
        }
        receberAbertura(r);
      }),
    [api, exclusivo, liberarAtual, receberAbertura],
  );

  const abrirItem = useCallback(
    (id: IdentificadorItem) =>
      exclusivo(async () => {
        if (!(await liberarAtual())) return;
        setSelecionado(id);
        const r = await abrirNaBiblioteca(id);
        if (r !== null) receberAbertura(r);
      }),
    [abrirNaBiblioteca, exclusivo, liberarAtual, receberAbertura],
  );

  /** Sai do app depois de gravar; se não gravou, fica e oferece "Salvar como…" ou "Sair sem salvar". */
  const sairDepoisDeSalvar = useCallback(async () => {
    if (saindo.current) return;
    saindo.current = true;
    try {
      if (await sessao.fechar()) {
        permitirSaida.current = true;
        window.close();
      } else {
        setSaidaPedida(true);
        irParaEscrever();
      }
    } finally {
      saindo.current = false;
    }
  }, [irParaEscrever, sessao]);

  const fecharTrabalho = useCallback(async () => {
    if (await sessao.fechar()) {
      setSaidaPedida(false);
      voltarABiblioteca();
    } else {
      irParaEscrever();
    }
  }, [irParaEscrever, sessao, voltarABiblioteca]);

  const acaoDoAviso = useCallback(
    async (a: AcaoAviso) => {
      if (a === 'salvarComo') {
        if ((await sessao.salvarComo()) && saidaPedida) void sairDepoisDeSalvar();
        return;
      }
      await sessao.fechar({ descartar: true });
      if (saidaPedida) {
        permitirSaida.current = true;
        window.close();
      } else {
        voltarABiblioteca();
      }
    },
    [sairDepoisDeSalvar, saidaPedida, sessao, voltarABiblioteca],
  );

  // Fechar a janela (X, Alt+F4, Arquivo › Sair) grava antes (ADR-0004). No Electron, cancelar o `beforeunload`
  // impede o fechamento sem diálogo; a janela fecha de novo, com permissão, quando a gravação termina.
  useEffect(() => {
    const antesDeSair = (e: BeforeUnloadEvent) => {
      if (permitirSaida.current || !sessao.temPendencias) return;
      e.preventDefault();
      e.returnValue = false;
      void sairDepoisDeSalvar();
    };
    window.addEventListener('beforeunload', antesDeSair);
    return () => window.removeEventListener('beforeunload', antesDeSair);
  }, [sairDepoisDeSalvar, sessao]);

  useEffect(() => {
    const aoFocar = (e: FocusEvent) => {
      const alvo = e.target;
      if (alvo instanceof HTMLElement && alvo.closest('[role="menubar"]') === null) ultimoFoco.current = alvo;
    };
    window.addEventListener('focusin', aoFocar);
    return () => window.removeEventListener('focusin', aoFocar);
  }, []);

  /**
   * Itens do menu Editar. Na aba Escrever (editor, árvore de seções), Desfazer e Refazer seguem a ordem única do trabalho
   * (M2-T07; o histórico do navegador não conhece o ProseMirror nem a estrutura); o resto, e tudo nos campos de texto, é
   * o comando do Chromium pedido ao principal (`api.edicao`), o mesmo das teclas: a colagem passa pelo tratador do
   * editor (R40).
   */
  const { historico: historicoEdicao } = estrutura;
  const editar = useCallback(
    (acao: AcaoEdicao | 'colarSemFormatacao') => {
      const foco = ultimoFoco.current;
      if (foco?.isConnected) foco.focus();
      const editor = refEditor.current;
      const noEditor = editor !== null && editor.temFoco();
      const campo = foco instanceof HTMLInputElement || foco instanceof HTMLTextAreaElement;
      const naEscrita = foco?.isConnected === true && !campo && foco.closest('.escrever') !== null;
      if ((acao === 'desfazer' || acao === 'refazer') && naEscrita) return void historicoEdicao(acao);
      if (acao === 'colarSemFormatacao') {
        if (noEditor) editor.colarSemFormatacao();
        // Nos campos de uma linha só há texto: colar é o mesmo que colar sem formatação.
        acao = 'colar';
      }
      api.edicao.executar(acao).catch(() => mostrarMensagem({ tipo: 'erro', texto: MENSAGEM_FALHA_EDICAO }));
    },
    [api, historicoEdicao, mostrarMensagem],
  );

  const { irPara: irParaSecao, pedirFoco } = estrutura;

  const comando = useCallback(
    (c: ComandoMenu) => {
      switch (c) {
        case 'desfazer':
        case 'refazer':
        case 'recortar':
        case 'copiar':
        case 'colar':
        case 'colarSemFormatacao':
          editar(c);
          return;
        case 'inserirNota':
          refEditor.current?.inserirNota();
          return;
        case 'estruturaSecoes':
          irParaEscrever();
          pedirFoco('arvore');
          return;
        case 'secaoAnterior':
        case 'proximaSecao':
          irParaEscrever();
          irParaSecao(c === 'secaoAnterior' ? -1 : 1);
          return;
        case 'novoTrabalho':
          pedirNovoTrabalho();
          return;
        case 'abrir':
          void abrirPorDialogo();
          return;
        case 'salvar':
          void sessao.salvar();
          return;
        case 'salvarComo':
          void acaoDoAviso('salvarComo');
          return;
        case 'fecharTrabalho':
          void fecharTrabalho();
          return;
        case 'escolherPasta':
          setSelecionado(null);
          void escolherPasta();
          return;
        case 'atualizarBiblioteca':
          void recarregar();
          return;
        case 'versoesDescartadas':
          void pedirDescartadas();
          return;
        case 'sair':
          window.close();
          return;
        case 'buscar':
          focarBusca();
          return;
      }
    },
    [abrirPorDialogo, acaoDoAviso, editar, escolherPasta, pedirNovoTrabalho, fecharTrabalho, focarBusca, irParaEscrever, irParaSecao, pedirFoco, recarregar, sessao],
  );

  // Inserir › Nota de rodapé só com o editor na tela (revisão do M2-T06, B3: fora da aba o comando se perdia).
  const desativados = useMemo(() => {
    const d = new Set(comandosDesativados(trabalho));
    if (local.aba !== 'escrever' || comFormulario) d.add('inserirNota');
    return d;
  }, [trabalho, local.aba, comFormulario]);

  // Atalhos globais (Ctrl+F, Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+W, Alt+setas, F5).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      // Com o diálogo aberto, o resto da janela fica inerte: nenhum atalho global age por trás dele.
      if (escolhendoTipo || descartadas !== undefined) return;
      if (e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        comando('atualizarBiblioteca');
        return;
      }
      const acao = acaoDoAtalho(e);
      if (acao === null) return;
      e.preventDefault();
      if (acao === 'voltar') setHistorico(voltar);
      else if (acao === 'avancar') setHistorico(avancar);
      else if (!desativados.has(acao)) comando(acao);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [comando, descartadas, desativados, escolhendoTipo]);

  const fecharDetalhes = useCallback(() => {
    const id = selecionado;
    setSelecionado(null);
    if (id !== null) setFocarId({ id });
  }, [selecionado]);

  const nomeAba = ABAS.find((a) => a.id === local.aba)?.rotulo ?? '';
  const nomeColecao = COLECOES.find((c) => c.id === local.colecao)?.rotulo ?? '';
  const naBiblioteca = local.aba === 'biblioteca' && local.colecao === 'trabalhos';

  return (
    <>
      <SimbolosSvg />
      {escolhendoTipo && (
        <DialogoNovoTrabalho
          inicial={ultimoTipo}
          ocupado={bib.ocupado}
          aoCancelar={() => setEscolhendoTipo(false)}
          aoCriar={(tipo) => {
            setEscolhendoTipo(false);
            setUltimoTipo(tipo);
            void criar(tipo);
          }}
        />
      )}
      {descartadas !== undefined && (
        <DialogoVersoesDescartadas
          versoes={descartadas}
          incompleta={descartadasIncompleta}
          ocupado={bib.ocupado}
          aoAbrir={(id) => void abrirDescartada(id)}
          aoFechar={() => setDescartadas(undefined)}
        />
      )}
      <div className="app">
        <BarraSuperior
          visor={visorDoTrabalho(trabalho)}
          modoLista={modoLista}
          aoAlternarModo={() => setModoLista((m) => !m)}
          busca={busca}
          aoBuscar={(termo) => {
            setBusca(termo);
            // No M1 a busca só alcança os trabalhos: digitar leva à Biblioteca (a busca global vem com o editor).
            if (termo.trim() !== '') ir({ aba: 'biblioteca', colecao: 'trabalhos' });
          }}
          refBusca={refBusca}
          podeAnterior={estrutura.podeAnterior}
          podeProxima={estrutura.podeProxima}
          aoSecaoAnterior={() => comando('secaoAnterior')}
          aoProximaSecao={() => comando('proximaSecao')}
        />
        <BarraMenus aoComando={comando} desativados={desativados} />
        <Navegacao
          podeVoltar={historico.passado.length > 0}
          podeAvancar={historico.futuro.length > 0}
          aoVoltar={() => setHistorico(voltar)}
          aoAvancar={() => setHistorico(avancar)}
          colecao={local.colecao}
          aoEscolherColecao={(colecao) => ir({ colecao })}
          aba={local.aba}
          aoEscolherAba={(aba) => ir({ aba })}
        />
        <div className="conteudo">
          <BarraLateral
            contagens={contagens}
            filtro={local.filtro}
            aoFiltrar={(filtro) => ir({ filtro, aba: 'biblioteca', colecao: 'trabalhos' })}
            nomePasta={bib.estado.fase === 'pronta' ? bib.estado.pasta.nome : null}
          />
          <main className="principal" id={ID_PAINEL} role="tabpanel" aria-labelledby={idDaAba(local.aba)} tabIndex={-1}>
            {naBiblioteca ? (
              <AreaBiblioteca
                estado={bib.estado}
                titulo={tituloDaLista(local.filtro)}
                itens={itensVisiveis}
                buscando={busca.trim() !== ''}
                modoLista={modoLista}
                selecionado={selecionado}
                focarId={focarId}
                mensagem={bib.mensagem}
                ocupado={bib.ocupado}
                aoSelecionar={setSelecionado}
                aoAbrir={(id) => void abrirItem(id)}
                aoCriar={pedirNovoTrabalho}
                aoTentarDeNovo={() => void recarregar()}
                aoEscolherPasta={() => comando('escolherPasta')}
                ofertas={ofertas}
                aoRecuperar={(id) => void recuperar(id)}
                aoAbrirSalvo={(id) => void abrirSalvo(id)}
                aoAdiar={(id) => setOfertas((os) => os.filter((o) => o.identificador !== id))}
              />
            ) : local.aba === 'escrever' ? (
              <AreaEscrever
                estado={sessaoEstado}
                rotuloDescartar={saidaPedida ? 'Sair sem salvar' : 'Fechar sem salvar'}
                ocupado={bib.ocupado}
                aoAlterarTitulo={(texto) => {
                  setSaidaPedida(false);
                  sessao.alterarTitulo(texto);
                }}
                aoSalvar={() => void sessao.salvar()}
                aoFechar={() => void fecharTrabalho()}
                aoAcao={(a) => void acaoDoAviso(a)}
                aoCriar={pedirNovoTrabalho}
                aoAbrir={() => void abrirPorDialogo()}
                aoIrParaBiblioteca={() => ir({ aba: 'biblioteca', colecao: 'trabalhos' })}
                elementos={{
                  alterarDados: (a) => sessao.alterarDados(a),
                  alterarSubtitulo: (texto) => sessao.alterarSubtitulo(texto),
                  alterar: (id, campos) => sessao.alterarElemento(id, campos),
                  incluir: (tipo) => sessao.incluirElemento(tipo),
                  retirar: (id) => sessao.retirarElemento(id),
                }}
                lerSecao={(id) => sessao.secao(id)}
                aoAlterarSecao={(id, conteudo) => {
                  setSaidaPedida(false);
                  sessao.alterarSecao(id, conteudo);
                }}
                estrutura={estrutura}
                aoMudarFormulario={setComFormulario}
                controleEditor={refEditor}
              />
            ) : (
              <div className="estado">
                <h2>{local.aba === 'biblioteca' ? nomeColecao : nomeAba}</h2>
                <p>Esta área ainda não está disponível nesta versão.</p>
              </div>
            )}
          </main>
          {naBiblioteca && itemSelecionado !== null && (
            <PainelDetalhes
              item={itemSelecionado}
              aoFechar={fecharDetalhes}
              ocupado={bib.ocupado}
              aoAbrir={() => void abrirItem(itemSelecionado.identificador)}
              aoRenomear={async (novoNome) => {
                const r = await bib.renomear(itemSelecionado.identificador, novoNome);
                if (r.ok) setSelecionado(r.id);
                return r;
              }}
              aoDuplicar={async () => {
                const id = await bib.duplicar(itemSelecionado.identificador);
                if (id !== null) {
                  setSelecionado(id);
                  setFocarId({ id });
                }
              }}
              aoExcluir={async () => {
                // O foco vai para o cartão vizinho (o seguinte, ou o anterior se era o último).
                const i = itensVisiveis.findIndex((x) => x.identificador === itemSelecionado.identificador);
                const vizinho = itensVisiveis[i + 1] ?? itensVisiveis[i - 1] ?? null;
                if (!(await bib.excluir(itemSelecionado.identificador, itemSelecionado.nomeArquivo))) return;
                setSelecionado(null);
                if (vizinho !== null) setFocarId({ id: vizinho.identificador });
                else setFocarPainel((n) => n + 1);
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
