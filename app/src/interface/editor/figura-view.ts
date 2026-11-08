/**
 * Figura no texto da seção (M5-T06; RF-10): título com a palavra designativa, a imagem na largura proporcional à da
 * página, a fonte e a nota, e o aviso de resolução baixa (RNF-17). A forma final vem do motor, no DOCX.
 *
 * - Clique seleciona; duplo clique, o botão "Editar" ou Enter com a figura selecionada abrem a janela da figura.
 * - A imagem vem da sessão (`lerMidia`) como `blob:` (a CSP permite); a URL é revogada ao trocar e ao destruir.
 * - Texto sempre por `textContent` (nunca HTML).
 */
import type { Node as NoPm } from 'prosemirror-model';
import type { NodeView } from 'prosemirror-view';
import { avaliarImagem, ESPECIES_FIGURA, lerInfoImagem } from '../../aplicacao';
import type { InlineDeTitulo } from '../../dominio/modelo';
import { dadosDaFigura } from './tabelas';

const textoDe = (c: readonly InlineDeTitulo[] | undefined): string => (c ?? []).map((i) => i.texto).join('');
const nomeDaEspecie = (especie: string): string => ESPECIES_FIGURA.find((e) => e.especie === especie)?.nome ?? 'Figura';

export class FiguraView implements NodeView {
  dom: HTMLElement;
  #no: NoPm;
  #url: string | null = null;
  readonly #aoAbrir: () => void;
  readonly #lerMidia: (sha256: string) => Uint8Array | null;

  constructor(no: NoPm, lerMidia: (sha256: string) => Uint8Array | null, aoAbrir: () => void) {
    this.#no = no;
    this.#lerMidia = lerMidia;
    this.#aoAbrir = aoAbrir;
    this.dom = document.createElement('div');
    this.dom.className = 'bd-figura';
    this.dom.contentEditable = 'false';
    this.dom.setAttribute('role', 'figure');
    this.dom.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.#aoAbrir();
    });
    this.desenhar();
  }

  desenhar(): void {
    const d = dadosDaFigura(this.#no);
    const nome = nomeDaEspecie(d.especie);
    const titulo = textoDe(d.titulo);
    this.dom.setAttribute('aria-label', `${nome}: ${titulo}`);

    const cabeca = document.createElement('div');
    cabeca.className = 'bd-tabela__cabeca';
    const p = document.createElement('p');
    p.className = 'bd-tabela__titulo';
    const rotulo = document.createElement('span');
    rotulo.className = 'bd-tabela__rotulo';
    rotulo.textContent = `${nome} – `;
    p.append(rotulo, document.createTextNode(titulo));
    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'btn-secundario bd-tabela__editar';
    editar.textContent = 'Editar';
    editar.setAttribute('aria-label', `Editar ${nome.toLowerCase()}`);
    editar.addEventListener('click', (e) => {
      e.preventDefault();
      this.#aoAbrir();
    });
    cabeca.append(p, editar);

    const partes: HTMLElement[] = [cabeca];
    if (this.#url !== null) URL.revokeObjectURL(this.#url);
    this.#url = null;
    const bytes = this.#lerMidia(d.midia);
    const info = bytes ? lerInfoImagem(bytes) : null;
    if (bytes && info) {
      const caixa = document.createElement('div');
      caixa.className = 'bd-figura__caixa';
      const img = document.createElement('img');
      img.className = 'bd-figura__imagem';
      this.#url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: info.tipo }));
      img.src = this.#url;
      img.alt = titulo;
      const av = avaliarImagem(info, bytes, d.larguraMm ?? null);
      // Largura relativa à área útil, como sairá na página (CSSOM: a CSP não bloqueia).
      img.style.width = `${Math.min(100, (av.larguraMm / av.areaUtilMm) * 100).toFixed(1)}%`;
      caixa.append(img);
      partes.push(caixa);
      if (av.aviso !== null) {
        const aviso = document.createElement('p');
        aviso.className = 'bd-tabela__rodape bd-tabela__pendente';
        aviso.textContent = `Resolução baixa: ${av.aviso}`;
        partes.push(aviso);
      }
    } else {
      const falta = document.createElement('p');
      falta.className = 'bd-tabela__rodape bd-tabela__pendente';
      falta.textContent = 'A imagem não está disponível.';
      partes.push(falta);
    }
    const rodape = (prefixo: string, c: readonly InlineDeTitulo[] | undefined) => {
      const r = document.createElement('p');
      r.className = 'bd-tabela__rodape';
      r.textContent = `${prefixo}${textoDe(c)}`;
      partes.push(r);
    };
    if (d.fonte) rodape('Fonte: ', d.fonte);
    else {
      const f = document.createElement('p');
      f.className = 'bd-tabela__rodape bd-tabela__pendente';
      f.textContent = 'Falta a fonte.';
      partes.push(f);
    }
    if (d.nota) rodape('Nota: ', d.nota);
    this.dom.replaceChildren(...partes);
  }

  update(no: NoPm): boolean {
    if (no.type !== this.#no.type) return false;
    const mudou = no.attrs['dados'] !== this.#no.attrs['dados'];
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
    if (evento.type === 'dblclick') return true;
    return evento.target instanceof HTMLElement && evento.target.closest('button') !== null;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    if (this.#url !== null) URL.revokeObjectURL(this.#url);
  }
}
