// Faixa 2: barra de menus no padrão ARIA "menubar" (setas, Enter/Espaço, Esc, Home/End; tabindex móvel).
// Itens sem comando ficam visíveis com aria-disabled (continuam alcançáveis pelo teclado, como pede o padrão).
import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { atalhoAria, MENUS, type ComandoMenu, type ItemMenu } from './definicoes';
import { moverCiclico, temModificador } from './teclado';

export interface PropsBarraMenus {
  aoComando: (comando: ComandoMenu) => void;
  refPrimeiro?: Ref<HTMLButtonElement>;
}

const itensAtivaveis = (indiceMenu: number): ItemMenu[] =>
  (MENUS[indiceMenu]?.itens ?? []).filter((i): i is ItemMenu => i !== 'separador');

export function BarraMenus({ aoComando, refPrimeiro }: PropsBarraMenus) {
  const [focoMenu, setFocoMenu] = useState(0);
  const [aberto, setAberto] = useState<number | null>(null);
  const [focoItem, setFocoItem] = useState(0);
  const raiz = useRef<HTMLUListElement>(null);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const itens = useRef<(HTMLButtonElement | null)[]>([]);

  // Foco segue o estado: item do menu aberto ou o botão do menu.
  useEffect(() => {
    if (aberto !== null) itens.current[focoItem]?.focus();
  }, [aberto, focoItem]);

  // Clique fora fecha o menu.
  useEffect(() => {
    if (aberto === null) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(null);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const abrir = (i: number, ultimo = false) => {
    setFocoMenu(i);
    setAberto(i);
    setFocoItem(ultimo ? itensAtivaveis(i).length - 1 : 0);
  };
  const fechar = (devolverFoco: boolean) => {
    const i = aberto;
    setAberto(null);
    if (devolverFoco && i !== null) botoes.current[i]?.focus();
  };
  const irParaMenu = (i: number, manterAberto: boolean) => {
    if (manterAberto) abrir(i);
    else {
      setFocoMenu(i);
      botoes.current[i]?.focus();
    }
  };
  const executar = (item: ItemMenu) => {
    if (item.comando === undefined) return;
    fechar(true);
    aoComando(item.comando);
  };

  const teclaNoBotao = (e: KeyboardEvent, i: number) => {
    if (temModificador(e)) return;
    const total = MENUS.length;
    if (e.key === 'ArrowRight') irParaMenu(moverCiclico(i, 1, total), false);
    else if (e.key === 'ArrowLeft') irParaMenu(moverCiclico(i, -1, total), false);
    else if (e.key === 'Home') irParaMenu(0, false);
    else if (e.key === 'End') irParaMenu(total - 1, false);
    else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') abrir(i);
    else if (e.key === 'ArrowUp') abrir(i, true);
    else if (e.key === 'Escape' && aberto !== null) fechar(true);
    else return;
    e.preventDefault();
  };

  const teclaNoMenu = (e: KeyboardEvent, i: number) => {
    if (temModificador(e)) return;
    const lista = itensAtivaveis(i);
    if (e.key === 'ArrowDown') setFocoItem((f) => moverCiclico(f, 1, lista.length));
    else if (e.key === 'ArrowUp') setFocoItem((f) => moverCiclico(f, -1, lista.length));
    else if (e.key === 'Home') setFocoItem(0);
    else if (e.key === 'End') setFocoItem(lista.length - 1);
    else if (e.key === 'ArrowRight') abrir(moverCiclico(i, 1, MENUS.length));
    else if (e.key === 'ArrowLeft') abrir(moverCiclico(i, -1, MENUS.length));
    else if (e.key === 'Escape') fechar(true);
    else if (e.key === 'Tab') {
      setAberto(null);
      return; // o Tab segue seu caminho
    } else if (e.key === 'Enter' || e.key === ' ') {
      const item = lista[focoItem];
      if (item) executar(item);
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  itens.current = [];
  return (
    <ul className="menus" role="menubar" aria-label="Menu principal" ref={raiz}>
      {MENUS.map((menu, i) => {
        let indiceItem = -1;
        return (
          <li key={menu.rotulo} role="none">
            <button
              ref={(b) => {
                botoes.current[i] = b;
                if (i === 0 && refPrimeiro) {
                  if (typeof refPrimeiro === 'function') refPrimeiro(b);
                  else refPrimeiro.current = b;
                }
              }}
              className="menu-btn"
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={aberto === i}
              tabIndex={i === focoMenu ? 0 : -1}
              onClick={() => (aberto === i ? fechar(false) : abrir(i))}
              onMouseEnter={() => {
                if (aberto !== null && aberto !== i) abrir(i);
              }}
              onKeyDown={(e) => teclaNoBotao(e, i)}
            >
              {menu.rotulo}
            </button>
            {aberto === i && (
              <ul className="submenu" role="menu" aria-label={menu.rotulo} onKeyDown={(e) => teclaNoMenu(e, i)}>
                {menu.itens.map((item, j) => {
                  if (item === 'separador') {
                    return (
                      <li key={`sep-${j}`} role="separator">
                        <hr />
                      </li>
                    );
                  }
                  indiceItem += 1;
                  const k = indiceItem;
                  return (
                    <li key={item.rotulo} role="none">
                      <button
                        ref={(b) => {
                          itens.current[k] = b;
                        }}
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        aria-disabled={item.comando === undefined ? true : undefined}
                        aria-keyshortcuts={item.atalho ? atalhoAria(item.atalho) : undefined}
                        onClick={() => executar(item)}
                        onMouseEnter={() => setFocoItem(k)}
                      >
                        <span>{item.rotulo}</span>
                        {item.atalho && <kbd>{item.atalho}</kbd>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
