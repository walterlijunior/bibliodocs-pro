/**
 * Remissiva na tela (M5-T08; RF-11): o texto vem do registro, alimentado pela lista de elementos da sessão, e muda quando
 * a numeração muda, sem mexer no documento nem no histórico.
 *
 * - O texto, com o nome acessível "Remissiva: Tabela 3" (sem papel de link: não navega); quebrada, mostra
 *   "[remissiva quebrada]" sublinhado, com o aviso no `title` e no nome acessível.
 * - Clique seleciona; duplo clique (ou Enter, com a remissiva selecionada) abre a janela para trocar o alvo.
 * - Texto sempre por `textContent` (nunca HTML).
 */
import type { Node as NoPm } from 'prosemirror-model';
import type { NodeView } from 'prosemirror-view';
import { TEXTO_QUEBRADA } from './remissivas';

/** Texto de cada alvo, vindo da lista de elementos da sessão, e as remissivas na tela, para redesenhar. */
export class RegistroRemissivas {
  #rotulos: ReadonlyMap<string, string> = new Map();
  /** Remissivas e legendas de tabela na tela (a legenda mostra "Tabela 2 –" com o mesmo rótulo, Etapa 4). */
  readonly #vistas = new Set<{ desenhar(): void }>();

  definir(rotulos: ReadonlyMap<string, string>): void {
    if (rotulos === this.#rotulos) return;
    this.#rotulos = rotulos;
    for (const v of this.#vistas) v.desenhar();
  }

  /** "Tabela 3"; `null` = quebrada. */
  rotulo(alvo: string): string | null {
    return this.#rotulos.get(alvo) ?? null;
  }

  /** O texto que a remissiva mostra e leva na cópia. */
  texto(alvo: string): string {
    return this.rotulo(alvo) ?? TEXTO_QUEBRADA;
  }

  registrar(v: { desenhar(): void }): void {
    this.#vistas.add(v);
  }

  esquecer(v: { desenhar(): void }): void {
    this.#vistas.delete(v);
  }
}

export class RemissivaView implements NodeView {
  dom: HTMLElement;
  #no: NoPm;
  readonly #registro: RegistroRemissivas;

  constructor(no: NoPm, registro: RegistroRemissivas, aoAbrir: () => void) {
    this.#no = no;
    this.#registro = registro;
    this.dom = document.createElement('span');
    this.dom.className = 'bd-remissiva';
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('dblclick', (e) => {
      e.preventDefault();
      aoAbrir();
    });
    registro.registrar(this);
    this.desenhar();
  }

  desenhar(): void {
    const alvo = String(this.#no.attrs['alvo']);
    const rotulo = this.#registro.rotulo(alvo);
    const livre = typeof this.#no.attrs['texto'] === 'string' ? (this.#no.attrs['texto'] as string) : null;
    // Menção sem número (Etapa 4): o texto do autor, mesmo quebrada (o aviso diz que perdeu o elemento).
    this.dom.textContent = livre ?? rotulo ?? TEXTO_QUEBRADA;
    this.dom.classList.toggle('bd-remissiva--quebrada', rotulo === null);
    this.dom.classList.toggle('bd-remissiva--sem-numero', livre !== null);
    const aviso = 'O elemento citado foi excluído ou a equação ficou sem número. Clique duas vezes para escolher outro.';
    let nome: string;
    if (livre !== null) nome = rotulo === null ? `Menção sem número quebrada: ${livre}. ${aviso}` : `Menção sem número a ${rotulo}: ${livre}`;
    else nome = rotulo === null ? `Remissiva quebrada. ${aviso}` : `Remissiva: ${rotulo}`;
    this.dom.setAttribute('aria-label', nome);
    if (rotulo === null) this.dom.title = aviso;
    else if (livre !== null) this.dom.title = `Menção sem número ligada a ${rotulo}`;
    else this.dom.removeAttribute('title');
  }

  update(no: NoPm): boolean {
    if (no.type !== this.#no.type) return false;
    const mudou = no.attrs['alvo'] !== this.#no.attrs['alvo'] || no.attrs['texto'] !== this.#no.attrs['texto'];
    this.#no = no;
    if (mudou) this.desenhar();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(evento: Event): boolean {
    return evento.type === 'dblclick';
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.#registro.esquecer(this);
  }
}
