// Grade de capas (ou lista) dos trabalhos: listbox com tabindex móvel e setas em 2D; Espaço e clique selecionam (painel
// de detalhes); Enter e duplo clique abrem o trabalho (M1-T11).
// Capa em miniatura simplificada (decisão do usuário): no M1 o app só conhece o título e as datas; a capa fiel
// (instituição, autoria, local) vem com o motor normativo. Texto sempre como texto (nunca HTML).
import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { IdentificadorItem, ItemBiblioteca } from '../../aplicacao';
import { Icone } from '../Icones';
import { proximoIndiceGrade, temModificador } from '../casca/teclado';
import { anoDoItem, avisoDoItem, formatarData, rotuloDoCartao, rotuloTipo, tituloExibido } from './selecao';

export interface PropsGrade {
  itens: readonly ItemBiblioteca[];
  modoLista: boolean;
  selecionado: IdentificadorItem | null;
  aoSelecionar: (id: IdentificadorItem) => void;
  /** Abrir o trabalho (Enter ou duplo clique); sem ele, Enter só seleciona. */
  aoAbrir?: (id: IdentificadorItem) => void;
  /** Cartão que deve receber o foco assim que aparecer (ex.: trabalho recém-criado); objeto novo = novo pedido. */
  focarId?: { id: IdentificadorItem } | null;
}

const ID_AJUDA = 'ajuda-grade';

/** Colunas reais da grade, lidas do CSS (auto-fill depende da largura da janela). */
function colunasDe(grade: HTMLElement | null): number {
  if (!grade) return 1;
  return Math.max(1, getComputedStyle(grade).gridTemplateColumns.split(' ').filter(Boolean).length);
}

export function GradeTrabalhos({ itens, modoLista, selecionado, aoSelecionar, aoAbrir, focarId }: PropsGrade) {
  const grade = useRef<HTMLUListElement>(null);
  const cartoes = useRef<(HTMLDivElement | null)[]>([]);
  const indiceSel = itens.findIndex((i) => i.identificador === selecionado);
  const ativo = useRef(Math.max(0, indiceSel));
  if (ativo.current >= itens.length) ativo.current = Math.max(0, indiceSel);

  useEffect(() => {
    if (!focarId) return;
    const i = itens.findIndex((x) => x.identificador === focarId.id);
    if (i >= 0) {
      ativo.current = i;
      cartoes.current[i]?.focus();
    }
  }, [focarId, itens]);

  const mover = (j: number) => {
    ativo.current = j;
    cartoes.current.forEach((c, k) => {
      if (c) c.tabIndex = k === j ? 0 : -1;
    });
    cartoes.current[j]?.focus();
  };

  const tecla = (e: KeyboardEvent, i: number, item: ItemBiblioteca) => {
    if (temModificador(e)) return;
    const j = proximoIndiceGrade(e.key, i, itens.length, modoLista ? 1 : colunasDe(grade.current));
    if (j !== null) {
      e.preventDefault();
      mover(j);
    } else if (e.key === 'Enter' && aoAbrir && !e.shiftKey) {
      e.preventDefault();
      aoAbrir(item.identificador);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      aoSelecionar(item.identificador);
    }
  };

  const tabAtivo = indiceSel >= 0 ? indiceSel : Math.min(ativo.current, itens.length - 1);
  return (
    <>
      <p className="sr-only" id={ID_AJUDA}>
        {aoAbrir
          ? 'Use as setas para percorrer os trabalhos, Espaço para ver os detalhes e Enter para abrir.'
          : 'Use as setas para percorrer os trabalhos e Espaço ou Enter para ver os detalhes.'}
      </p>
      <ul
        ref={grade}
        className={modoLista ? 'grade grade--lista' : 'grade'}
        role="listbox"
        aria-label="Trabalhos"
        aria-describedby={ID_AJUDA}
      >
        {itens.map((item, i) => (
          <li key={item.identificador} role="none">
            <div
              ref={(c) => {
                cartoes.current[i] = c;
              }}
              className="cartao"
              role="option"
              aria-selected={item.identificador === selecionado}
              aria-label={rotuloDoCartao(item)}
              tabIndex={i === tabAtivo ? 0 : -1}
              onClick={() => {
                ativo.current = i;
                aoSelecionar(item.identificador);
              }}
              onDoubleClick={aoAbrir ? () => aoAbrir(item.identificador) : undefined}
              onKeyDown={(e) => tecla(e, i, item)}
            >
              <Capa item={item} />
              <span className="cartao__titulo">{tituloExibido(item)}</span>
              <span className="cartao__meta">
                {item.estado === 'ok' ? <span className="selo">{rotuloTipo(item.tipoTrabalho)}</span> : <AvisoItem item={item} />}
              </span>
              {modoLista && <span className="cartao__meta">Modificado em {formatarData(item.modificadoEm)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function AvisoItem({ item }: { item: ItemBiblioteca }) {
  const aviso = avisoDoItem(item);
  if (aviso === null) return null;
  const nivel = item.estado === 'invalido' ? 'erro' : 'alerta';
  return (
    <span className={`status status--${nivel}`}>
      <Icone nome={nivel} />
      {aviso}
    </span>
  );
}

function Capa({ item }: { item: ItemBiblioteca }) {
  if (item.estado !== 'ok') {
    return (
      <div className="capa capa--indisponivel" aria-hidden="true">
        <Icone nome="alerta" />
        <span>{avisoDoItem(item)}</span>
      </div>
    );
  }
  return (
    <div className="capa" aria-hidden="true">
      <span className="capa__titulo">{item.titulo.trim() === '' ? 'Sem título' : item.titulo}</span>
      <span className="capa__rodape">{anoDoItem(item)}</span>
    </div>
  );
}
