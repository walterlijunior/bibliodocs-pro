// Casca da interface (M1-T10; docs/REFERENCIA_DE_LAYOUT.md, seção 4; decisões do usuário em docs/GUIA_VISUAL.md):
// barra superior com visor e busca, barra de menus, navegação (coleção + abas), barra lateral e grade de trabalhos.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiBiblioDocs, IdentificadorItem } from '../aplicacao';
import { AreaBiblioteca } from './biblioteca/AreaBiblioteca';
import { BarraLateral } from './biblioteca/BarraLateral';
import { PainelDetalhes } from './biblioteca/PainelDetalhes';
import { aplicarFiltro, buscar, contar, FILTRO_TODOS, mesmoFiltro, tituloDaLista, type Filtro } from './biblioteca/selecao';
import { useBiblioteca } from './biblioteca/useBiblioteca';
import { BarraMenus } from './casca/BarraMenus';
import { BarraSuperior } from './casca/BarraSuperior';
import { ABAS, COLECOES, type ComandoMenu, type IdAba, type IdColecao } from './casca/definicoes';
import { ID_PAINEL, idDaAba, Navegacao } from './casca/Navegacao';
import { acaoDoAtalho, avancar, iniciarHistorico, navegar, voltar } from './casca/teclado';
import type { EstadoVisor } from './casca/visor';
import { SimbolosSvg } from './Icones';

/** Lugar da interface guardado no histórico de Voltar/Avançar. */
interface Local {
  aba: IdAba;
  colecao: IdColecao;
  filtro: Filtro;
}

const mesmoLocal = (a: Local, b: Local): boolean => a.aba === b.aba && a.colecao === b.colecao && mesmoFiltro(a.filtro, b.filtro);

const VISOR_VAZIO: EstadoVisor = { tipo: 'vazio' };

export function Aplicativo({ api }: { api: ApiBiblioDocs }) {
  const bib = useBiblioteca(api);
  const { recarregar, escolherPasta, criar: criarNaBiblioteca } = bib;
  const [historico, setHistorico] = useState(() => iniciarHistorico<Local>({ aba: 'biblioteca', colecao: 'trabalhos', filtro: FILTRO_TODOS }));
  const [busca, setBusca] = useState('');
  const [modoLista, setModoLista] = useState(false);
  const [selecionado, setSelecionado] = useState<IdentificadorItem | null>(null);
  // Objeto novo a cada pedido, para focar de novo o mesmo cartão (ex.: ao fechar o painel).
  const [focarId, setFocarId] = useState<{ id: IdentificadorItem } | null>(null);
  const refBusca = useRef<HTMLInputElement>(null);
  const local = historico.atual;

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

  const criar = useCallback(async () => {
    const id = await criarNaBiblioteca();
    if (id === null) return;
    setBusca('');
    setHistorico((h) => navegar(h, { aba: 'biblioteca', colecao: 'trabalhos', filtro: FILTRO_TODOS }, mesmoLocal));
    setSelecionado(id);
    setFocarId({ id });
  }, [criarNaBiblioteca]);

  const comando = useCallback(
    (c: ComandoMenu) => {
      switch (c) {
        case 'novoTrabalho':
          void criar();
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
    [criar, escolherPasta, focarBusca, recarregar],
  );

  // Atalhos globais (Ctrl+F, Ctrl+N, Alt+setas, F5).
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
      if (acao === 'buscar') focarBusca();
      else if (acao === 'novoTrabalho') comando('novoTrabalho');
      else if (acao === 'voltar') setHistorico(voltar);
      else setHistorico(avancar);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [comando, focarBusca]);

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
          visor={VISOR_VAZIO}
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
        <BarraMenus aoComando={comando} />
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
                aoCriar={() => void criar()}
                aoTentarDeNovo={() => void recarregar()}
                aoEscolherPasta={() => comando('escolherPasta')}
              />
            ) : (
              <div className="estado">
                <h2>{local.aba === 'biblioteca' ? nomeColecao : nomeAba}</h2>
                <p>Esta área ainda não está disponível nesta versão.</p>
              </div>
            )}
          </main>
          {naBiblioteca && itemSelecionado !== null && <PainelDetalhes item={itemSelecionado} aoFechar={fecharDetalhes} />}
        </div>
      </div>
    </>
  );
}
