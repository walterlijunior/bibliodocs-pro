// Árvore de seções da aba Escrever (M2-T07; ADR-0007, seções 1 e 4; RF-03). Padrão ARIA "tree" com a lista plana e
// `aria-level`/`aria-posinset`/`aria-setsize` (o leitor de tela anuncia o número, o nível e a posição), foco móvel e
// sem recolher. Componente próprio, sem biblioteca (a decisão do ADR-0007, seção 7, está no adendo do M2-T07).
//
// Teclas na árvore: setas, Home e End movem a seleção; Enter vai ao texto; F2 renomeia (título no editor); Delete
// exclui; Alt+Shift+setas sobem, descem, recuam e promovem (as teclas do modo de tópicos do Word); Ctrl+Z e Ctrl+Y
// seguem a ordem única de desfazer. Com o mouse: clicar escolhe; arrastar e soltar põe antes ou depois de outra seção.
import { useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from 'react';
import type { AcaoSecao, ResumoSecao } from '../../aplicacao';
import { temModificador } from '../casca/teclado';
import type { SentidoHistorico } from '../editor/EditorSecao';
import { destinoTeclaArvore, ladoDoSoltar } from './secoes';
import type { AvisoSecoes, PedidoFoco } from './useEstrutura';

/** Tipo do dado arrastado: só uma seção desta lista é aceita ao soltar (texto ou arquivo de fora, não). */
const TIPO_ARRASTE = 'application/x-bibliodocs-secao';

const TECLAS_OPERACAO: Readonly<Record<string, AcaoSecao>> = {
  ArrowUp: 'acima',
  ArrowDown: 'abaixo',
  ArrowRight: 'recuar',
  ArrowLeft: 'promover',
};

/** A dica cita a tecla que vale na lista (com o foco numa seção), não no botão: sem `aria-keyshortcuts` aqui. */
interface BotaoSecao {
  acao: AcaoSecao;
  texto: string;
  rotulo: string;
  dica: string;
}

const BOTOES: readonly BotaoSecao[] = [
  { acao: 'acima', texto: 'Subir', rotulo: 'Subir seção', dica: 'Subir seção (na lista: Alt+Shift+↑)' },
  { acao: 'abaixo', texto: 'Descer', rotulo: 'Descer seção', dica: 'Descer seção (na lista: Alt+Shift+↓)' },
  { acao: 'recuar', texto: 'Recuar', rotulo: 'Recuar seção', dica: 'Recuar: vira subseção da seção anterior (na lista: Alt+Shift+→)' },
  { acao: 'promover', texto: 'Promover', rotulo: 'Promover seção', dica: 'Promover: sobe um nível (na lista: Alt+Shift+←)' },
  { acao: 'excluir', texto: 'Excluir', rotulo: 'Excluir seção', dica: 'Excluir a seção e as subseções (na lista: Delete; Ctrl+Z desfaz)' },
];

export const tituloNaLista = (s: ResumoSecao): string => (s.titulo.trim() === '' ? 'Sem título' : s.titulo);

export interface PropsArvoreSecoes {
  secoes: readonly ResumoSecao[];
  ativaId: string | null;
  somenteLeitura: boolean;
  aviso: AvisoSecoes | null;
  /** Raiz da árvore, para a aba pôr o foco no item ativo. */
  refArvore: RefObject<HTMLUListElement | null>;
  aoEscolher: (id: string, foco: PedidoFoco['alvo'] | null) => void;
  aoNova: () => void;
  aoOperar: (acao: AcaoSecao, foco: PedidoFoco['alvo'] | null) => void;
  aoMover: (id: string, alvoId: string, lado: 'antes' | 'depois') => void;
  aoHistorico: (sentido: SentidoHistorico) => boolean;
  /** Enter: foco no texto da seção; F2: no título dela. */
  aoIrAoTexto: (alvo: 'editor' | 'titulo') => void;
}

export function ArvoreSecoes(p: PropsArvoreSecoes) {
  const { secoes, ativaId, somenteLeitura } = p;
  const arrastada = useRef<string | null>(null);
  const [soltar, setSoltar] = useState<{ id: string; lado: 'antes' | 'depois' } | null>(null);
  const indiceAtivo = secoes.findIndex((s) => s.id === ativaId);
  const ativa = secoes[indiceAtivo] ?? null;

  const teclaNoItem = (e: KeyboardEvent<HTMLLIElement>, indice: number) => {
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const acao = TECLAS_OPERACAO[e.key];
      if (acao === undefined) return;
      e.preventDefault();
      if (!somenteLeitura) p.aoOperar(acao, 'arvore');
      return;
    }
    if (temModificador(e) || e.shiftKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      p.aoIrAoTexto('editor');
      return;
    }
    if (e.key === 'F2' && !somenteLeitura) {
      e.preventDefault();
      p.aoIrAoTexto('titulo');
      return;
    }
    if (e.key === 'Delete' && !somenteLeitura) {
      e.preventDefault();
      p.aoOperar('excluir', 'arvore');
      return;
    }
    const destino = destinoTeclaArvore(secoes, indice, e.key);
    if (destino === null) return;
    e.preventDefault();
    p.aoEscolher(secoes[destino]!.id, 'arvore');
  };

  // Ctrl+Z e Ctrl+Y na lista ou nos botões dela: a mesma ordem única do editor.
  const teclaNaLista = (e: KeyboardEvent<HTMLElement>) => {
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    const tecla = e.key.toLowerCase();
    const sentido: SentidoHistorico | null = tecla === 'z' ? (e.shiftKey ? 'refazer' : 'desfazer') : tecla === 'y' && !e.shiftKey ? 'refazer' : null;
    if (sentido === null) return;
    e.preventDefault();
    p.aoHistorico(sentido);
  };

  const arrastarSobre = (e: DragEvent<HTMLLIElement>, id: string) => {
    if (arrastada.current === null || !e.dataTransfer.types.includes(TIPO_ARRASTE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const caixa = e.currentTarget.getBoundingClientRect();
    const lado = ladoDoSoltar(e.clientY, caixa.top, caixa.height);
    if (soltar?.id !== id || soltar.lado !== lado) setSoltar({ id, lado });
  };

  const soltarEm = (e: DragEvent<HTMLLIElement>, id: string) => {
    const origem = arrastada.current;
    if (origem === null || !e.dataTransfer.types.includes(TIPO_ARRASTE)) return;
    e.preventDefault();
    const caixa = e.currentTarget.getBoundingClientRect();
    arrastada.current = null;
    setSoltar(null);
    p.aoMover(origem, id, ladoDoSoltar(e.clientY, caixa.top, caixa.height));
  };

  return (
    <nav className="escrever__secoes" aria-labelledby="titulo-lista-secoes" onKeyDown={teclaNaLista}>
      <h2 id="titulo-lista-secoes">Seções</h2>
      {secoes.length === 0 ? (
        <p className="dica">Este trabalho ainda não tem seções.</p>
      ) : (
        <ul className="arvore-secoes" role="tree" aria-labelledby="titulo-lista-secoes" ref={p.refArvore}>
          {secoes.map((s, i) => {
            const selecionada = s.id === ativa?.id;
            const classeSoltar = soltar?.id === s.id ? ` arvore-secoes__item--soltar-${soltar.lado}` : '';
            return (
              <li
                key={s.id}
                role="treeitem"
                className={`arvore-secoes__item arvore-secoes__item--nivel${Math.min(s.nivel, 5)}${classeSoltar}`}
                aria-level={s.nivel}
                aria-posinset={s.posicao}
                aria-setsize={s.irmas}
                aria-selected={selecionada}
                // Foco móvel: só o item ativo (ou o primeiro) entra na ordem do Tab.
                tabIndex={selecionada || (ativa === null && i === 0) ? 0 : -1}
                data-id={s.id}
                draggable={!somenteLeitura}
                onClick={() => p.aoEscolher(s.id, 'arvore')}
                onKeyDown={(e) => teclaNoItem(e, i)}
                onDragStart={(e) => {
                  arrastada.current = s.id;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData(TIPO_ARRASTE, s.id);
                }}
                onDragOver={(e) => arrastarSobre(e, s.id)}
                onDragLeave={() => {
                  if (soltar?.id === s.id) setSoltar(null);
                }}
                onDrop={(e) => soltarEm(e, s.id)}
                onDragEnd={() => {
                  arrastada.current = null;
                  setSoltar(null);
                }}
              >
                <span className="arvore-secoes__numero">{s.indicativo}</span>{' '}
                <span className="arvore-secoes__titulo">{tituloNaLista(s)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {!somenteLeitura && (
        <div className="acoes-secao" role="group" aria-label="Estrutura das seções">
          <button type="button" className="btn-secundario acoes-secao__nova" onClick={p.aoNova} title="Nova seção depois da seção escolhida, no mesmo nível">
            Nova seção
          </button>
          {BOTOES.map((b) => (
            <button
              key={b.acao}
              type="button"
              className="btn-formato"
              aria-label={b.rotulo}
              title={b.dica}
              // Só sem seção. Recuar a primeira ou promover uma primária ficam ativos e mostram o motivo da recusa: um
              // botão desativado logo depois do clique tiraria o foco dele (WCAG 2.4.3).
              disabled={ativa === null}
              onClick={() => p.aoOperar(b.acao, null)}
            >
              {b.texto}
            </button>
          ))}
        </div>
      )}
      <p className={p.aviso?.erro ? 'dica dica--erro' : 'dica'} role="status">
        {p.aviso?.texto ?? ''}
      </p>
    </nav>
  );
}
