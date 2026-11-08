/**
 * Gráfico gerado de tabela no texto da seção (M5-T09; RF-10): título "Gráfico – Título", o desenho feito agora com os
 * dados da tabela, a fonte e a nota. Mudar a tabela redesenha o gráfico (aceite do RF-10): as tabelas do trabalho chegam
 * pelo `RegistroGraficos`, alimentado pela lista de elementos da sessão.
 *
 * - Clique seleciona; duplo clique, "Editar" ou Enter com o gráfico selecionado abrem a janela do gráfico.
 * - Sem a tabela ou sem número na tabela: o aviso no lugar do desenho.
 * - Texto sempre por `textContent` (nunca HTML).
 */
import type { Node as NoPm } from 'prosemirror-model';
import type { NodeView } from 'prosemirror-view';
import type { BlocoTabela, InlineDeTitulo } from '../../dominio/modelo';
import { dadosDoGrafico, tamanhoGraficoMm } from '../../aplicacao';
import { desenharEm } from './pintar-grafico';
import { dadosDoGrafico as camposDoNo } from './tabelas';

const textoDe = (c: readonly InlineDeTitulo[] | undefined): string => (c ?? []).map((i) => i.texto).join('');

/** Área útil padrão (A4, margens 3 e 2 cm) para o tamanho na tela; a exportação usa a do perfil. */
const AREA_UTIL_MM = 160;
/** Pixels de tela por milímetro do desenho (≈ 81 ppi, legível no editor). */
const PX_POR_MM = 3.2;

/** As tabelas do trabalho, pelo id, e os gráficos na tela, para redesenhar quando uma tabela muda. */
export class RegistroGraficos {
  #tabelas: ReadonlyMap<string, BlocoTabela> = new Map();
  readonly #vistas = new Set<GraficoView>();

  definir(tabelas: ReadonlyMap<string, BlocoTabela>): void {
    if (tabelas === this.#tabelas) return;
    const antes = this.#tabelas;
    this.#tabelas = tabelas;
    for (const v of this.#vistas) if (antes.get(v.tabela) !== tabelas.get(v.tabela)) v.desenhar();
  }

  tabela(id: string): BlocoTabela | null {
    return this.#tabelas.get(id) ?? null;
  }

  registrar(v: GraficoView): void {
    this.#vistas.add(v);
  }

  esquecer(v: GraficoView): void {
    this.#vistas.delete(v);
  }
}

export class GraficoView implements NodeView {
  dom: HTMLElement;
  #no: NoPm;
  readonly #registro: RegistroGraficos;
  readonly #aoAbrir: () => void;

  constructor(no: NoPm, registro: RegistroGraficos, aoAbrir: () => void) {
    this.#no = no;
    this.#registro = registro;
    this.#aoAbrir = aoAbrir;
    this.dom = document.createElement('div');
    this.dom.className = 'bd-figura bd-grafico';
    this.dom.contentEditable = 'false';
    this.dom.setAttribute('role', 'figure');
    this.dom.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.#aoAbrir();
    });
    registro.registrar(this);
    this.desenhar();
  }

  /** Id da tabela de onde vêm os dados. */
  get tabela(): string {
    return camposDoNo(this.#no).tabela;
  }

  desenhar(): void {
    const d = camposDoNo(this.#no);
    const titulo = textoDe(d.titulo);
    this.dom.setAttribute('aria-label', `Gráfico: ${titulo}`);

    const cabeca = document.createElement('div');
    cabeca.className = 'bd-tabela__cabeca';
    const p = document.createElement('p');
    p.className = 'bd-tabela__titulo';
    const rotulo = document.createElement('span');
    rotulo.className = 'bd-tabela__rotulo';
    rotulo.textContent = 'Gráfico – ';
    p.append(rotulo, document.createTextNode(titulo));
    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'btn-secundario bd-tabela__editar';
    editar.textContent = 'Editar';
    editar.setAttribute('aria-label', 'Editar gráfico');
    editar.addEventListener('click', (e) => {
      e.preventDefault();
      this.#aoAbrir();
    });
    cabeca.append(p, editar);
    const partes: HTMLElement[] = [cabeca];

    const tabela = this.#registro.tabela(d.tabela);
    const dados = dadosDoGrafico(d, tabela);
    if (dados.ok) {
      const { larguraMm, alturaMm } = tamanhoGraficoMm(d, AREA_UTIL_MM);
      const escala = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.className = 'bd-grafico__desenho';
      canvas.width = Math.round(larguraMm * PX_POR_MM * escala);
      canvas.height = Math.round(alturaMm * PX_POR_MM * escala);
      // Largura relativa à área útil, como sairá na página (CSSOM: a CSP não bloqueia).
      canvas.style.width = `${Math.min(100, (larguraMm / AREA_UTIL_MM) * 100).toFixed(1)}%`;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Desenho do gráfico com ${dados.categorias.length} categorias e ${dados.series.length === 1 ? '1 série' : `${dados.series.length} séries`}`);
      const ctx = canvas.getContext('2d');
      if (ctx) desenharEm(ctx, d, tabela, canvas.width, canvas.height, PX_POR_MM * 25.4 * escala, 'Times New Roman');
      const caixa = document.createElement('div');
      caixa.className = 'bd-figura__caixa';
      caixa.append(canvas);
      partes.push(caixa);
      for (const a of dados.avisos) {
        const x = document.createElement('p');
        x.className = 'bd-tabela__rodape bd-tabela__pendente';
        x.textContent = `Atenção: ${a}`;
        partes.push(x);
      }
    } else {
      const falta = document.createElement('p');
      falta.className = 'bd-tabela__rodape bd-tabela__pendente';
      falta.textContent = `Não dá para desenhar: ${dados.mensagem}`;
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
    this.#registro.esquecer(this);
  }
}
