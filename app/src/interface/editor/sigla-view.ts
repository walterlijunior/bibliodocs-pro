/** Texto da sigla derivado do cadastro, sem inserir texto calculado no documento nem no histórico. */
import type { Node as NoPm } from 'prosemirror-model';
import type { NodeView } from 'prosemirror-view';
import type { Sigla } from '../../dominio/modelo';
import { TEXTO_SIGLA_QUEBRADA } from './siglas';

export class RegistroSiglas {
  #cadastro: ReadonlyMap<string, Sigla> = new Map();
  readonly #vistas = new Set<SiglaView>();
  definir(siglas: readonly Sigla[]): void {
    this.#cadastro = new Map(siglas.map((s) => [s.id, s]));
    for (const v of this.#vistas) v.desenhar();
  }
  obter(id: string): Sigla | null { return this.#cadastro.get(id) ?? null; }
  texto(id: string): string { return this.obter(id)?.sigla ?? TEXTO_SIGLA_QUEBRADA; }
  registrar(v: SiglaView): void { this.#vistas.add(v); }
  esquecer(v: SiglaView): void { this.#vistas.delete(v); }
}

export class SiglaView implements NodeView {
  dom: HTMLElement;
  #no: NoPm;
  readonly #registro: RegistroSiglas;
  constructor(no: NoPm, registro: RegistroSiglas, abrir: () => void) {
    this.#no = no; this.#registro = registro;
    this.dom = document.createElement('span');
    this.dom.className = 'bd-sigla bd-remissiva';
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('dblclick', (ev) => { ev.preventDefault(); abrir(); });
    registro.registrar(this); this.desenhar();
  }
  desenhar(): void {
    const s = this.#registro.obter(String(this.#no.attrs['sigla']));
    this.dom.textContent = s?.sigla ?? TEXTO_SIGLA_QUEBRADA;
    this.dom.classList.toggle('bd-remissiva--quebrada', s === null);
    this.dom.title = s ? `${s.extenso} (${s.sigla})` : 'A sigla foi retirada do cadastro. Escolha outra para restaurar a ligação.';
    this.dom.setAttribute('aria-label', s ? `Sigla: ${s.sigla}. ${s.extenso}` : TEXTO_SIGLA_QUEBRADA);
  }
  update(no: NoPm): boolean {
    if (no.type !== this.#no.type) return false;
    this.#no = no; this.desenhar(); return true;
  }
  selectNode(): void { this.dom.classList.add('ProseMirror-selectednode'); }
  deselectNode(): void { this.dom.classList.remove('ProseMirror-selectednode'); }
  stopEvent(ev: Event): boolean { return ev.type === 'dblclick'; }
  ignoreMutation(): boolean { return true; }
  destroy(): void { this.#registro.esquecer(this); }
}
