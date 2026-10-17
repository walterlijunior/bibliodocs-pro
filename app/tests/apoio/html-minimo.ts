// Leitor de HTML mínimo para os testes da colagem (M2-T05). Monta a árvore `NoHtml` que `lerHtmlColado` percorre, sem
// dependência nova (ADR-0007: nada de happy-dom). Cobre o que as fixtures usam, como o parser do navegador:
// - comentários `<!-- -->` e os "comentários falsos" `<![if !supportLists]>`/`<![endif]>` do Word;
// - `<!DOCTYPE>`, atributos com aspas simples, duplas ou sem aspas, elementos vazios (br, hr, img…);
// - texto bruto em `script`/`style`; entidades nomeadas comuns e numéricas;
// - fechamento implícito: `</x>` fecha até o `x` aberto mais próximo; fechamento sem abertura é ignorado.
// Não é um parser HTML completo: as fixtures que precisarem de mais devem ganhar caso aqui, com teste.
import type { NoHtml } from '../../src/interface/editor/html-colado';

export class ElementoMinimo implements NoHtml {
  readonly nodeType = 1;
  readonly nodeValue = null;
  readonly childNodes: NoHtml[] = [];
  readonly nodeName: string;

  constructor(
    nome: string,
    private readonly atributos: ReadonlyMap<string, string>,
  ) {
    this.nodeName = nome.toUpperCase();
  }

  getAttribute(nome: string): string | null {
    return this.atributos.get(nome.toLowerCase()) ?? null;
  }
}

class NoSimples implements NoHtml {
  readonly childNodes: NoHtml[] = [];
  constructor(
    readonly nodeType: number,
    readonly nodeName: string,
    readonly nodeValue: string,
  ) {}
}

const VAZIOS = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'col', 'area', 'base', 'wbr', 'source', 'embed']);
const TEXTO_BRUTO = new Set(['script', 'style', 'textarea', 'title']);
const ENTIDADES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", shy: '­' };

const decodificar = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (todo, ent: string) => {
    if (ent[0] === '#') {
      const cp = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : todo;
    }
    return ENTIDADES[ent.toLowerCase()] ?? todo;
  });

const R_ATRIBUTO = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** Árvore do HTML, com um elemento `BODY` como raiz (como `documento.body` no renderer). */
export function lerHtmlMinimo(html: string): ElementoMinimo {
  const raiz = new ElementoMinimo('body', new Map());
  const pilha: ElementoMinimo[] = [raiz];
  const topo = (): ElementoMinimo => pilha[pilha.length - 1]!;
  let i = 0;
  while (i < html.length) {
    const menor = html.indexOf('<', i);
    if (menor < 0 || menor > i) {
      const fim = menor < 0 ? html.length : menor;
      topo().childNodes.push(new NoSimples(3, '#text', decodificar(html.slice(i, fim))));
      i = fim;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      const fim = html.indexOf('-->', i + 4);
      const ate = fim < 0 ? html.length : fim + 3;
      topo().childNodes.push(new NoSimples(8, '#comment', html.slice(i + 4, fim < 0 ? ate : fim)));
      i = ate;
      continue;
    }
    if (html[i + 1] === '!' || html[i + 1] === '?') {
      const fim = html.indexOf('>', i);
      const ate = fim < 0 ? html.length : fim + 1;
      topo().childNodes.push(new NoSimples(8, '#comment', html.slice(i + 2, ate - 1)));
      i = ate;
      continue;
    }
    const fechamento = /^<\/([^\s>]+)\s*>/.exec(html.slice(i));
    if (fechamento) {
      const nome = fechamento[1]!.toLowerCase();
      const k = pilha.map((e) => e.nodeName.toLowerCase()).lastIndexOf(nome);
      if (k > 0) pilha.length = k;
      i += fechamento[0].length;
      continue;
    }
    const abertura = /^<([a-zA-Z][^\s/>]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/.exec(html.slice(i));
    if (!abertura) {
      topo().childNodes.push(new NoSimples(3, '#text', '<'));
      i++;
      continue;
    }
    const nome = abertura[1]!.toLowerCase();
    const atributos = new Map<string, string>();
    for (const m of abertura[2]!.matchAll(R_ATRIBUTO)) {
      const chave = m[1]!.toLowerCase();
      if (!atributos.has(chave)) atributos.set(chave, decodificar(m[2] ?? m[3] ?? m[4] ?? ''));
    }
    const el = new ElementoMinimo(nome, atributos);
    topo().childNodes.push(el);
    i += abertura[0].length;
    if (TEXTO_BRUTO.has(nome)) {
      const fim = html.toLowerCase().indexOf(`</${nome}`, i);
      const ate = fim < 0 ? html.length : fim;
      el.childNodes.push(new NoSimples(3, '#text', html.slice(i, ate)));
      i = fim < 0 ? ate : html.indexOf('>', fim) + 1;
      continue;
    }
    if (!VAZIOS.has(nome) && abertura[3] !== '/') pilha.push(el);
  }
  return raiz;
}
