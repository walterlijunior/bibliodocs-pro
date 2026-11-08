/**
 * Chamada de citação no editor (M4-T07): mostra o texto da chamada como sairá no documento, "(CAGLIARI, 2003, p. 12)",
 * com o itálico do "et al.". O texto vem do formatador da tela (`RegistroChamadas`), que muda quando as obras mudam: as
 * chamadas na tela se redesenham sem mexer no documento nem no histórico.
 *
 * - Papel `doc-biblioref` (DPUB-ARIA), com o nome "Citação: (CAGLIARI, 2003, p. 12)".
 * - Clique seleciona; duplo clique (ou Enter, ou Ctrl+Shift+C, com a chamada selecionada) abre a janela da citação.
 * - Chamada com aviso (obra sem ano, sobrenome repetido…) fica sublinhada, com o aviso no `title`.
 * - Texto sempre por `textContent` (nunca HTML).
 */
import { DOMSerializer, type Node as NoPm, type Slice } from 'prosemirror-model';
import type { EditorProps, NodeView } from 'prosemirror-view';
import type { ChamadaNaTela, DadosCitacao, FormatadorDeChamadas } from '../../aplicacao';
import { dadosDaChamada } from './citacoes';
import { esquemaEditor } from './esquema';
import type { RegistroRemissivas } from './remissiva-view';

/** O formatador atual e as chamadas na tela, para redesenhar quando as obras mudam. */
export class RegistroChamadas {
  #formatar: FormatadorDeChamadas | null = null;
  readonly #vistas = new Set<ChamadaView>();

  definir(formatar: FormatadorDeChamadas): void {
    if (formatar === this.#formatar) return;
    this.#formatar = formatar;
    for (const v of this.#vistas) v.desenhar();
  }

  formatar(dados: DadosCitacao): ChamadaNaTela | null {
    return this.#formatar?.(dados) ?? null;
  }

  registrar(v: ChamadaView): void {
    this.#vistas.add(v);
  }

  esquecer(v: ChamadaView): void {
    this.#vistas.delete(v);
  }
}

export class ChamadaView implements NodeView {
  dom: HTMLElement;
  #no: NoPm;
  readonly #registro: RegistroChamadas;
  readonly #aoAbrir: () => void;

  constructor(no: NoPm, registro: RegistroChamadas, aoAbrir: () => void) {
    this.#no = no;
    this.#registro = registro;
    this.#aoAbrir = aoAbrir;
    this.dom = document.createElement('span');
    this.dom.className = 'bd-citacao';
    this.dom.setAttribute('role', 'doc-biblioref');
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.#aoAbrir();
    });
    registro.registrar(this);
    this.desenhar();
  }

  desenhar(): void {
    const r = this.#registro.formatar(dadosDaChamada(this.#no));
    const texto = r?.texto ?? 'citação';
    this.dom.replaceChildren(
      ...(r?.trechos ?? [{ texto, marcas: [] as readonly string[] }]).map((t) => {
        if (!(t.marcas as readonly string[]).includes('italico')) return document.createTextNode(t.texto);
        const em = document.createElement('em');
        em.textContent = t.texto;
        return em;
      }),
    );
    const avisos = r?.avisos ?? [];
    this.dom.classList.toggle('bd-citacao--aviso', avisos.length > 0);
    this.dom.setAttribute('aria-label', `Citação: ${texto}${avisos.length > 0 ? `. ${avisos.map((a) => a.mensagem).join(' ')}` : ''}`);
    if (avisos.length > 0) this.dom.title = avisos.map((a) => a.mensagem).join('\n');
    else this.dom.removeAttribute('title');
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
    return evento.type === 'dblclick';
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.#registro.esquecer(this);
  }
}

/**
 * Cópia com o texto da chamada (em vez da palavra "citação" do `toDOM`): colar no Word leva "(CAGLIARI, 2003)"; colar de
 * volta no editor traz o texto e a sugestão de ligar à obra (a colagem nunca cria citação sozinha). A remissiva (M5-T08)
 * leva o texto dela, "Tabela 3", e volta como texto.
 */
export function copiaComChamadas(registro: RegistroChamadas, remissivas?: RegistroRemissivas): Pick<EditorProps, 'clipboardSerializer' | 'clipboardTextSerializer'> {
  const base = DOMSerializer.fromSchema(esquemaEditor);
  const texto = (no: NoPm): string => registro.formatar(dadosDaChamada(no))?.texto ?? '';
  const textoRemissiva = (no: NoPm): string => remissivas?.texto(String(no.attrs['alvo'])) ?? '';
  const serializador = new DOMSerializer(
    {
      ...base.nodes,
      chamadaCitacao: (no) => {
        const span = document.createElement('span');
        span.textContent = texto(no);
        return span;
      },
      remissiva: (no) => {
        const span = document.createElement('span');
        span.textContent = textoRemissiva(no);
        return span;
      },
    },
    base.marks,
  );
  return {
    clipboardSerializer: serializador,
    clipboardTextSerializer: (fatia: Slice) =>
      fatia.content.textBetween(0, fatia.content.size, '\n\n', (folha) =>
        folha.type.name === 'chamadaCitacao' ? texto(folha) : folha.type.name === 'remissiva' ? textoRemissiva(folha) : folha.type.name === 'quebraLinha' ? '\n' : '',
      ),
  };
}
