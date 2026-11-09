/**
 * Tabela e quadro no texto da seção (M5-T04): mostra o título, a grade (com as mesclagens e o alinhamento das colunas),
 * a fonte e as notas. A forma final (traços, corpo 10, rótulo numerado) vem do motor, na Pré-visualização e no DOCX.
 *
 * - Clique seleciona; duplo clique, o botão "Editar", ou Enter com a tabela selecionada abrem a janela da tabela.
 * - Tabelas grandes mostram as primeiras linhas e dizem quantas faltam, para o texto continuar leve.
 * - Texto sempre por `textContent` (nunca HTML).
 */
import type { Node as NoPm } from 'prosemirror-model';
import type { NodeView } from 'prosemirror-view';
import { prefixoFonte, type DadosTabela } from '../../aplicacao';
import type { InlineDeTitulo } from '../../dominio/modelo';
import { dadosDoNo } from './tabelas';

/** Linhas mostradas no texto; o resto fica na janela. */
export const LINHAS_NA_PREVIA = 30;

function trechos(conteudo: readonly InlineDeTitulo[] | undefined): Node[] {
  return (conteudo ?? []).map((i) => {
    const m = i.marcas ?? [];
    let no: Node = document.createTextNode(i.texto);
    for (const [marca, tag] of [['italico', 'em'], ['negrito', 'strong'], ['sobrescrito', 'sup'], ['subscrito', 'sub']] as const) {
      if (!m.includes(marca)) continue;
      const el = document.createElement(tag);
      el.append(no);
      no = el;
    }
    return no;
  });
}

const textoDe = (c: readonly InlineDeTitulo[] | undefined): string => (c ?? []).map((i) => i.texto).join('');

export const nomeDaEspecie = (d: Pick<DadosTabela, 'especie'>): string => (d.especie === 'quadro' ? 'Quadro' : 'Tabela');

export class TabelaView implements NodeView {
  dom: HTMLElement;
  #no: NoPm;
  readonly #aoAbrir: () => void;

  constructor(no: NoPm, aoAbrir: () => void) {
    this.#no = no;
    this.#aoAbrir = aoAbrir;
    this.dom = document.createElement('div');
    this.dom.className = 'bd-tabela';
    this.dom.contentEditable = 'false';
    this.dom.setAttribute('role', 'group');
    this.dom.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.#aoAbrir();
    });
    this.desenhar();
  }

  desenhar(): void {
    const d = dadosDoNo(this.#no);
    const nome = nomeDaEspecie(d);
    this.dom.classList.toggle('bd-tabela--quadro', d.especie === 'quadro');
    this.dom.setAttribute('aria-label', `${nome}: ${textoDe(d.titulo)}`);

    const cabeca = document.createElement('div');
    cabeca.className = 'bd-tabela__cabeca';
    const titulo = document.createElement('p');
    titulo.className = 'bd-tabela__titulo';
    const rotulo = document.createElement('span');
    rotulo.className = 'bd-tabela__rotulo';
    rotulo.textContent = `${nome} – `;
    titulo.append(rotulo, ...trechos(d.titulo));
    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'btn-secundario bd-tabela__editar';
    editar.textContent = 'Editar';
    editar.setAttribute('aria-label', `Editar ${nome.toLowerCase()}`);
    editar.addEventListener('click', (e) => {
      e.preventDefault();
      this.#aoAbrir();
    });
    cabeca.append(titulo, editar);

    const tabela = document.createElement('table');
    tabela.className = 'bd-tabela__grade';
    const cab = document.createElement('thead');
    const corpo = document.createElement('tbody');
    const mostradas = d.linhas.slice(0, Math.max(LINHAS_NA_PREVIA, d.linhasCabecalho));
    // Coluna de cada célula: as posições cobertas por mesclagem de cima são puladas (o mesmo modelo do HTML).
    const cobertas = new Array<number>(d.colunas.length).fill(0);
    mostradas.forEach((linha, l) => {
      const tr = document.createElement('tr');
      let c = 0;
      for (const cel of linha) {
        while (c < d.colunas.length && cobertas[c]! > 0) c++;
        const td = document.createElement(l < d.linhasCabecalho ? 'th' : 'td');
        if (l < d.linhasCabecalho) td.setAttribute('scope', 'col');
        const colunas = cel.colunas ?? 1;
        const linhas = cel.linhas ?? 1;
        if (colunas > 1) td.colSpan = colunas;
        if (linhas > 1) td.rowSpan = linhas;
        td.className = `bd-tabela__celula--${d.colunas[c]?.alinhamento ?? 'esquerda'}`;
        td.append(...trechos(cel.conteudo));
        tr.append(td);
        for (let k = c; k < Math.min(d.colunas.length, c + colunas); k++) cobertas[k] = linhas;
        c += colunas;
      }
      for (let k = 0; k < cobertas.length; k++) cobertas[k] = Math.max(0, cobertas[k]! - 1);
      (l < d.linhasCabecalho ? cab : corpo).append(tr);
    });
    tabela.append(...(d.linhasCabecalho > 0 ? [cab] : []), corpo);

    const rodape: HTMLElement[] = [];
    const linhaRodape = (prefixo: string, conteudo: readonly InlineDeTitulo[] | undefined) => {
      const p = document.createElement('p');
      p.className = 'bd-tabela__rodape';
      p.append(document.createTextNode(prefixo), ...trechos(conteudo));
      rodape.push(p);
    };
    const faltam = d.linhas.length - mostradas.length;
    if (faltam > 0) {
      const p = document.createElement('p');
      p.className = 'bd-tabela__mais dica';
      p.textContent = faltam === 1 ? 'Mais 1 linha: abra a janela da tabela para ver tudo.' : `Mais ${faltam} linhas: abra a janela da tabela para ver tudo.`;
      rodape.push(p);
    }
    if (d.fonte) linhaRodape(`${prefixoFonte({ tipo: 'tabela', especie: d.especie, fonte: d.fonte })} `, d.fonte);
    else {
      const p = document.createElement('p');
      p.className = 'bd-tabela__rodape bd-tabela__pendente';
      p.textContent = 'Falta a fonte.';
      rodape.push(p);
    }
    if (d.nota) linhaRodape('Nota: ', d.nota);
    (d.notasEspecificas ?? []).forEach((n, i) => linhaRodape(`(${i + 1}) `, n));

    this.dom.replaceChildren(cabeca, tabela, ...rodape);
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

  /** O botão e o duplo clique são da tabela; o resto (clique para selecionar, arrastar) fica com o editor. */
  stopEvent(evento: Event): boolean {
    if (evento.type === 'dblclick') return true;
    return evento.target instanceof HTMLElement && evento.target.closest('button') !== null;
  }

  ignoreMutation(): boolean {
    return true;
  }
}
