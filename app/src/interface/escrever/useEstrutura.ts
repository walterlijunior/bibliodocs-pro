/**
 * Estrutura das seções na interface (M2-T07; ADR-0007, seção 4): a seção ativa, as operações da lista (nova, recuar,
 * promover, subir, descer, excluir, arrastar), a navegação anterior/seguinte da barra superior e a ordem única de
 * desfazer, que liga a sessão (estrutura) aos editores das seções (texto).
 *
 * A seção ativa e os editores guardados ficam aqui, acima da aba Escrever: trocar de aba não perde o histórico de texto.
 */
import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { AcaoSecao, ResultadoEstrutura, SessaoTrabalho, TrabalhoDaSessao } from '../../aplicacao';
import { MemoriaEditores, type ControleEditor, type SentidoHistorico } from '../editor/EditorSecao';
import { escolhaDe, resolverAtiva, secaoVizinha, type EscolhaSecao } from './secoes';

/** Para onde vai o foco depois de uma mudança (objeto novo a cada pedido). */
export interface PedidoFoco {
  /** `editorSePerdido`: foco no editor só se ele saiu de onde estava (ex.: desfazer apagou a nota que tinha o foco). */
  alvo: 'editor' | 'editorSePerdido' | 'titulo' | 'arvore';
}

/** Onde está o foco agora: no editor (seção ou nota), na lista de seções, ou em outro lugar. */
function lugarDoFoco(editor: ControleEditor | null): 'editor' | 'arvore' | null {
  if (editor?.temFoco()) return 'editor';
  return document.activeElement?.closest('.escrever__secoes') ? 'arvore' : null;
}

/** Linha de estado da lista de seções: recusa de uma operação (erro) ou anúncio do que aconteceu. */
export interface AvisoSecoes {
  texto: string;
  erro: boolean;
}

/**
 * O mesmo texto repetido não muda o DOM, e o leitor de tela não anuncia de novo (excluir a "2" e depois a nova "2"):
 * o espaço inseparável no fim alterna (revisão do M2-T07, B6).
 */
function avisoNovo(anterior: AvisoSecoes | null, texto: string, erro: boolean): AvisoSecoes {
  return { texto: anterior?.texto === texto ? `${texto}\u00a0` : texto, erro };
}

export const ANUNCIO_EXCLUIDA = (indicativo: string) => `Seção ${indicativo} excluída. Ctrl+Z desfaz.`;

export function useEstrutura(sessao: SessaoTrabalho, trabalho: TrabalhoDaSessao | null, refEditor: RefObject<ControleEditor | null>) {
  const [memoria] = useState(() => new MemoriaEditores());
  const [escolha, setEscolha] = useState<EscolhaSecao | null>(null);
  const [pedidoFoco, setPedidoFoco] = useState<PedidoFoco | null>(null);
  const [aviso, setAviso] = useState<AvisoSecoes | null>(null);

  const fechado = trabalho === null;
  useEffect(() => {
    // Trabalho fechado: o texto dele não fica na memória (revisão do M2-T06, B4).
    if (fechado) memoria.limpar();
  }, [fechado, memoria]);

  const secoes = trabalho?.secoesEdicao ?? trabalho?.secoes ?? [];
  const geracao = trabalho?.geracao ?? -1;
  const ativa = trabalho === null ? null : resolverAtiva(secoes, escolha, geracao);
  const editavel = trabalho !== null && !trabalho.somenteLeitura;

  const escolher = useCallback(
    (id: string, foco: PedidoFoco['alvo'] | null = null) => {
      setEscolha(escolhaDe(secoes, id, geracao));
      setAviso(null);
      if (foco !== null) setPedidoFoco({ alvo: foco });
    },
    [secoes, geracao],
  );

  /** Depois de uma operação: mostra a seção dela (ou a vizinha, se deixou de existir), a recusa ou o anúncio. */
  const concluir = useCallback(
    (r: ResultadoEstrutura, foco: PedidoFoco['alvo'] | null, anuncio: string | null = null): boolean => {
      if (!r.ok) {
        setAviso((a) => avisoNovo(a, r.mensagem, true));
        return false;
      }
      // Outra entrada entrou na ordem única: o texto digitado a seguir na seção da tela é um passo novo.
      if (r.mudou) refEditor.current?.fecharGrupo();
      // As vizinhas vêm da lista de antes da mudança: se a seção sumiu, a mais próxima que ficou é a ativa.
      const id = r.secaoId ?? ativa?.id;
      if (id !== undefined) setEscolha(escolhaDe(secoes, id, geracao));
      setAviso((a) => (anuncio === null ? null : avisoNovo(a, anuncio, false)));
      if (foco !== null) setPedidoFoco({ alvo: foco });
      return true;
    },
    [ativa, secoes, geracao, refEditor],
  );

  const novaSecao = useCallback(
    () => concluir(sessao.novaSecao(ativa?.id ?? null), 'titulo'),
    [concluir, sessao, ativa],
  );

  const operar = useCallback(
    (acao: AcaoSecao, foco: PedidoFoco['alvo'] | null) => {
      if (ativa === null) return false;
      // Excluir pelo botão: o foco vai à seção que ficou no lugar (ou a "Nova seção", se não sobrou nenhuma), porque o
      // botão é desativado quando a última seção sai (revisão do M2-T07, M4).
      const focoFinal = acao === 'excluir' ? 'arvore' : foco;
      return concluir(sessao.operarSecao(acao, ativa.id), focoFinal, acao === 'excluir' ? ANUNCIO_EXCLUIDA(ativa.indicativo) : null);
    },
    [concluir, sessao, ativa],
  );

  const moverJunto = useCallback(
    (id: string, alvoId: string, lado: 'antes' | 'depois') => concluir(sessao.moverSecaoJuntoDe(id, alvoId, lado), 'arvore'),
    [concluir, sessao],
  );

  /**
   * Ordem única de desfazer. O texto da seção na tela é desfeito pelo editor dela; o de outra seção, no estado guardado,
   * e ela passa a ser a ativa. O foco volta para onde estava (editor ou lista).
   */
  const historico = useCallback(
    (sentido: SentidoHistorico): boolean => {
      if (!editavel) return false;
      const editor = refEditor.current;
      const lugar = lugarDoFoco(editor);
      const aplicarTexto = (secaoId: string, s: SentidoHistorico): boolean => {
        if (editor?.secaoId === secaoId) return s === 'desfazer' ? editor.desfazer() : editor.refazer();
        return memoria.aplicarHistorico(geracao, secaoId, s, (conteudo) => sessao.alterarSecao(secaoId, conteudo));
      };
      const r = sentido === 'desfazer' ? sessao.desfazer(aplicarTexto) : sessao.refazer(aplicarTexto);
      // Nada a desfazer não é erro: como no Word, a tecla simplesmente não faz nada.
      if (!r.ok) return false;
      // O foco segue a seção ativa: no editor, só muda se a seção mudou ou se ele se perdeu (dentro da nota, fica na nota;
      // revisão do M2-T07, M2); na lista, vai ao item da seção ativa (M3).
      const mesmaSecao = r.secaoId !== null && r.secaoId === editor?.secaoId;
      const foco = lugar === 'editor' ? (mesmaSecao ? 'editorSePerdido' : 'editor') : lugar;
      return concluir(r, foco);
    },
    [concluir, editavel, geracao, memoria, refEditor, sessao],
  );

  /** Seção anterior ou seguinte (barra superior, Ctrl+Page Up/Down). */
  const irPara = useCallback(
    (delta: -1 | 1): boolean => {
      const destino = secaoVizinha(secoes, ativa?.id ?? null, delta);
      if (destino === null) return false;
      escolher(destino.id, lugarDoFoco(refEditor.current));
      return true;
    },
    [ativa, escolher, refEditor, secoes],
  );

  return {
    memoria,
    ativa,
    escolher,
    novaSecao,
    operar,
    moverJunto,
    historico,
    irPara,
    podeAnterior: secaoVizinha(secoes, ativa?.id ?? null, -1) !== null,
    podeProxima: secaoVizinha(secoes, ativa?.id ?? null, 1) !== null,
    pedirFoco: useCallback((alvo: PedidoFoco['alvo']) => setPedidoFoco({ alvo }), []),
    pedidoFoco,
    /** O pedido foi atendido: voltar à aba depois não move o foco de novo. */
    consumirFoco: useCallback(() => setPedidoFoco(null), []),
    aviso,
    registrarTexto: (secaoId: string) => sessao.registrarTexto(secaoId),
  };
}

export type Estrutura = ReturnType<typeof useEstrutura>;
