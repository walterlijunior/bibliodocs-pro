// Casca da interface (M1-T10; docs/REFERENCIA_DE_LAYOUT.md, seção 4; decisões do usuário em docs/GUIA_VISUAL.md):
// barra superior com visor e busca, barra de menus, navegação (coleção + abas), barra lateral e grade de trabalhos.
// M1-T11: fluxo criar → editar título → salvar → fechar → abrir, com o estado de salvamento no visor e o salvamento
// automático do ADR-0004 (sessão de edição em aplicacao/servicos/sessao-trabalho.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AcaoAviso, ApiBiblioDocs, IdentificadorItem, ResultadoAbrir } from '../aplicacao';
import { AreaBiblioteca } from './biblioteca/AreaBiblioteca';
import { BarraLateral } from './biblioteca/BarraLateral';
import { PainelDetalhes } from './biblioteca/PainelDetalhes';
import { aplicarFiltro, buscar, contar, FILTRO_TODOS, mesmoFiltro, tituloDaLista, type Filtro } from './biblioteca/selecao';
import { FALHA_INESPERADA, useBiblioteca } from './biblioteca/useBiblioteca';
import { BarraMenus } from './casca/BarraMenus';
import { BarraSuperior } from './casca/BarraSuperior';
import { ABAS, COLECOES, comandosDesativados, type ComandoMenu, type IdAba, type IdColecao } from './casca/definicoes';
import { ID_PAINEL, idDaAba, Navegacao } from './casca/Navegacao';
import { acaoDoAtalho, avancar, iniciarHistorico, navegar, voltar } from './casca/teclado';
import { visorDoTrabalho } from './casca/visor';
import { avisoSomenteLeitura, avisosDaAbertura, mensagemVersaoFutura } from './escrever/aberturas';
import { AreaEscrever, ID_CAMPO_TITULO } from './escrever/AreaEscrever';
import { useSessao } from './escrever/useSessao';
import { SimbolosSvg } from './Icones';

/** Lugar da interface guardado no histórico de Voltar/Avançar. */
interface Local {
  aba: IdAba;
  colecao: IdColecao;
  filtro: Filtro;
}

const mesmoLocal = (a: Local, b: Local): boolean => a.aba === b.aba && a.colecao === b.colecao && mesmoFiltro(a.filtro, b.filtro);

export function Aplicativo({ api }: { api: ApiBiblioDocs }) {
  const bib = useBiblioteca(api);
  const { recarregar, escolherPasta, mostrarMensagem } = bib;
  const { sessao, estado: sessaoEstado } = useSessao(api, () => void recarregar());
  const [historico, setHistorico] = useState(() => iniciarHistorico<Local>({ aba: 'biblioteca', colecao: 'trabalhos', filtro: FILTRO_TODOS }));
  const [busca, setBusca] = useState('');
  const [modoLista, setModoLista] = useState(false);
  const [selecionado, setSelecionado] = useState<IdentificadorItem | null>(null);
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
  const local = historico.atual;
  const trabalho = sessaoEstado.trabalho;

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

  const criar = useCallback(
    () =>
      exclusivo(async () => {
        if (!(await liberarAtual())) return;
        const r = await criarNaBiblioteca();
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

  const comando = useCallback(
    (c: ComandoMenu) => {
      switch (c) {
        case 'novoTrabalho':
          void criar();
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
        case 'sair':
          window.close();
          return;
        case 'buscar':
          focarBusca();
          return;
      }
    },
    [abrirPorDialogo, acaoDoAviso, criar, escolherPasta, fecharTrabalho, focarBusca, recarregar, sessao],
  );

  const desativados = useMemo(() => comandosDesativados(trabalho), [trabalho]);

  // Atalhos globais (Ctrl+F, Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+W, Alt+setas, F5).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
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
  }, [comando, desativados]);

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
                aoCriar={() => void criar()}
                aoTentarDeNovo={() => void recarregar()}
                aoEscolherPasta={() => comando('escolherPasta')}
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
                aoCriar={() => void criar()}
                aoAbrir={() => void abrirPorDialogo()}
                aoIrParaBiblioteca={() => ir({ aba: 'biblioteca', colecao: 'trabalhos' })}
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
