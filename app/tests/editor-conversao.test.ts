// M2-T05 — Esquema do editor e conversão modelo ↔ editor (ADR-0007, seções 2 e 3; R38). Roda em Node: só
// `prosemirror-model`, sem view. Ida e volta em todas as fixtures, no documento grande e em documentos aleatórios com
// semente; o resultado passa por `Node.check()` e pelo `validarDocumentoV1`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DOMOutputSpec, Node as NoPm } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { LIMITES_V1, PADRAO_ID, PADRAO_TEXTO_XML, validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Bloco, Documento, Inline, InlineTexto, MarcaTexto, Secao } from '../src/dominio/modelo';
import {
  blocosParaSlice,
  CARACTERES_FORA_DO_XML,
  docParaSecao,
  ErroConversao,
  LIMITE_TEXTO_INLINE,
  normalizarConteudo,
  normalizarSecao,
  secaoParaDoc,
  type ConteudoSecao,
} from '../src/interface/editor/conversao';
import { esquemaEditor, ORDEM_MARCAS, PREFIXO_ID } from '../src/interface/editor/esquema';
import { PADRAO_ID_EDITOR } from '../src/interface/editor/ids';
import { gerarDocumentoGrande } from './apoio/documento-grande';

const pastaFixtures = join(__dirname, 'fixtures', 'projeto-v1');
const lerDocumento = (nome: string): Documento =>
  JSON.parse(readFileSync(join(pastaFixtures, nome), 'utf8')) as Documento;

function todasAsSecoes(corpo: readonly Secao[]): Secao[] {
  const saida: Secao[] = [];
  const pilha = [...corpo].reverse();
  while (pilha.length > 0) {
    const s = pilha.pop()!;
    saida.push(s);
    for (let i = s.subsecoes.length - 1; i >= 0; i--) pilha.push(s.subsecoes[i]!);
  }
  return saida;
}

/** Troca título e blocos de cada seção pelo que a função devolve (mesma árvore). */
function trocarConteudo(corpo: readonly Secao[], f: (s: Secao) => ConteudoSecao): Secao[] {
  return corpo.map((s) => ({ ...s, ...f(s), subsecoes: trocarConteudo(s.subsecoes, f) }));
}

const idaEVolta = (s: ConteudoSecao): ConteudoSecao => {
  const doc = secaoParaDoc(s);
  doc.check();
  return docParaSecao(doc);
};

const conteudo = (s: Secao): ConteudoSecao => ({ titulo: s.titulo, blocos: s.blocos });

/** [nome, documento, já está na forma canônica] — o gerador do documento grande deixa textos vizinhos sem marca. */
const DOCUMENTOS: [string, Documento, boolean][] = [
  ['documento-valido.json', lerDocumento('documento-valido.json'), true],
  ['documento-bordas-m2.json', lerDocumento('documento-bordas-m2.json'), true],
  ['documento grande (20 páginas)', gerarDocumentoGrande({ paginas: 20, midias: 0 }).pacote.documento, false],
];

describe('EDT — ida e volta modelo → editor → modelo nas fixtures', () => {
  it.each(DOCUMENTOS)('%s: cada seção volta na forma canônica e o documento continua válido', (_nome, documento, canonico) => {
    const secoes = todasAsSecoes(documento.corpo);
    expect(secoes.length).toBeGreaterThan(0);
    for (const s of secoes) expect(idaEVolta(conteudo(s))).toEqual(normalizarSecao(conteudo(s)));
    const refeito = { ...documento, corpo: trocarConteudo(documento.corpo, (s) => idaEVolta(conteudo(s))) };
    // As fixtures JSON já estão na forma canônica: para elas a ida e volta é exata.
    if (canonico) expect(refeito).toEqual(documento);
    const r = validarDocumentoV1(refeito);
    expect(r.ok, r.ok ? '' : JSON.stringify(r.erros)).toBe(true);
  });

  it('as fixtures e as seções aleatórias exercitam todos os nós e marcas do esquema', () => {
    const vistos = new Set<string>();
    const aleatorias = SEMENTES.map(secaoAleatoria);
    for (const secoes of [...DOCUMENTOS.map(([, d]) => todasAsSecoes(d.corpo)), aleatorias]) {
      for (const s of secoes) {
        secaoParaDoc(conteudo(s)).descendants((no) => {
          vistos.add(no.type.name);
          for (const m of no.marks) vistos.add(m.type.name);
          return true;
        });
      }
    }
    const esperados = [...Object.keys(esquemaEditor.nodes), ...Object.keys(esquemaEditor.marks)].filter((n) => n !== 'secaoDoc');
    expect(esperados.filter((n) => !vistos.has(n))).toEqual([]);
  });
});

/** xorshift32: documentos aleatórios reprodutíveis. */
function gerador(semente: number): () => number {
  let x = semente >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

const SEMENTES = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

function secaoAleatoria(semente: number): Secao {
  const r = gerador(semente);
  const escolha = <T>(lista: readonly T[]): T => lista[r() % lista.length]!;
  let n = 0;
  const id = (prefixo: string) => `${prefixo}_aleat${semente}x${++n}`;
  const PEDACOS = ['', 'a', 'pequi', ' ', '\n', '\t', 'ç ã é', 'x\ny', '😀', 'fim.\n'];
  const marcas = (): MarcaTexto[] | undefined => {
    const k = r() % 5;
    if (k === 0) return undefined;
    if (k === 1) return [];
    // Ordem bagunçada, mas válida (sem repetição; sobrescrito e subscrito não juntos).
    const fora = r() % 2 ? 'sobrescrito' : 'subscrito';
    const base = ORDEM_MARCAS.filter((m) => m !== fora).sort(() => (r() % 3) - 1);
    return base.slice(0, 1 + (r() % base.length));
  };
  const trecho = (): InlineTexto => {
    const m = marcas();
    const t = escolha(PEDACOS) + escolha(PEDACOS);
    return m === undefined ? { tipo: 'texto', texto: t } : { tipo: 'texto', texto: t, marcas: m };
  };
  const textos = (max: number): InlineTexto[] => Array.from({ length: r() % max }, trecho);
  const inlines = (max: number): Inline[] =>
    Array.from({ length: r() % max }, (): Inline => (r() % 6 === 0 ? { tipo: 'nota', id: id('nta'), conteudo: textos(4) } : trecho()));
  const bloco = (): Bloco => {
    switch (r() % 5) {
      case 0:
        return { tipo: 'quebraPagina', id: id('qbr') };
      case 1:
        return { tipo: 'citacaoLonga', id: id('cit'), conteudo: inlines(5) };
      case 2:
        return {
          tipo: 'alineas',
          id: id('aln'),
          itens: Array.from({ length: 1 + (r() % 3) }, () => {
            const subs = Array.from({ length: r() % 3 }, () => inlines(4));
            return subs.length > 0 ? { conteudo: inlines(4), subalineas: subs } : { conteudo: inlines(4) };
          }),
        };
      default:
        return { tipo: 'paragrafo', id: id('par'), conteudo: inlines(8) };
    }
  };
  return { id: id('sec'), titulo: textos(4), blocos: Array.from({ length: r() % 7 }, bloco), subsecoes: [] };
}

describe('EDT — ida e volta em seções aleatórias (sementes fixas)', () => {

  it('editor → modelo devolve a forma canônica, válida, e o caminho inverso é estável', () => {
    const corpo: Secao[] = [];
    for (const semente of SEMENTES) {
      const s = secaoAleatoria(semente);
      const canonica = normalizarSecao(conteudo(s));
      expect(normalizarSecao(canonica), `semente ${semente}: normalizar não é idempotente`).toEqual(canonica);
      const doc = secaoParaDoc(conteudo(s));
      doc.check();
      expect(docParaSecao(doc), `semente ${semente}`).toEqual(canonica);
      expect(secaoParaDoc(canonica).eq(doc), `semente ${semente}: doc da forma canônica difere`).toBe(true);
      corpo.push({ ...s, ...docParaSecao(doc) });
    }
    const documento: Documento = { id: 'prj_aleatorio1', tipoTrabalho: 'generico', metadados: { titulo: [] }, corpo };
    const r = validarDocumentoV1(documento);
    expect(r.ok, r.ok ? '' : JSON.stringify(r.erros.slice(0, 3))).toBe(true);
  });
});

describe('EDT — forma canônica', () => {
  it('junta vizinhos com as mesmas marcas, tira texto vazio, ordena marcas e omite marcas vazias', () => {
    expect(
      normalizarConteudo([
        { tipo: 'texto', texto: 'a', marcas: ['negrito', 'italico'] },
        { tipo: 'texto', texto: '' },
        { tipo: 'texto', texto: 'b', marcas: ['italico', 'negrito'] },
        { tipo: 'texto', texto: 'c', marcas: [] },
        { tipo: 'texto', texto: 'd' },
        { tipo: 'nota', id: 'nta_canonica1', conteudo: [{ tipo: 'texto', texto: 'x' }, { tipo: 'texto', texto: 'y' }] },
        { tipo: 'texto', texto: 'e' },
      ]),
    ).toEqual([
      { tipo: 'texto', texto: 'ab', marcas: ['italico', 'negrito'] },
      { tipo: 'texto', texto: 'cd' },
      { tipo: 'nota', id: 'nta_canonica1', conteudo: [{ tipo: 'texto', texto: 'xy' }] },
      { tipo: 'texto', texto: 'e' },
    ]);
  });

  it('texto acima do limite do formato vira trechos, sem partir par substituto', () => {
    expect(LIMITE_TEXTO_INLINE).toBe(LIMITES_V1.textoInline);
    const longo = `${'a'.repeat(LIMITE_TEXTO_INLINE - 1)}😀${'b'.repeat(10)}`;
    const partes = normalizarConteudo([{ tipo: 'texto', texto: longo, marcas: ['italico'] }]);
    expect(partes.map((p) => (p.tipo === 'texto' ? p.texto.length : 0))).toEqual([LIMITE_TEXTO_INLINE - 1, 12]);
    expect(partes.map((p) => (p.tipo === 'texto' ? p.texto : '')).join('')).toBe(longo);
    const doc = secaoParaDoc({ titulo: [], blocos: [{ tipo: 'paragrafo', id: 'par_longo0001', conteudo: partes }] });
    expect(docParaSecao(doc).blocos[0]).toEqual({ tipo: 'paragrafo', id: 'par_longo0001', conteudo: partes });
  });

  it('a quebra de linha guarda as marcas do trecho e volta como "\\n"', () => {
    const titulo: InlineTexto[] = [{ tipo: 'texto', texto: 'um\n\ndois\n', marcas: ['italico'] }];
    const doc = secaoParaDoc({ titulo, blocos: [] });
    expect(doc.firstChild!.childCount).toBe(5);
    expect(docParaSecao(doc).titulo).toEqual(titulo);
  });
});

describe('EDT — o esquema não representa nada fora do modelo', () => {
  it('título e nota não aceitam nota; alíneas exigem pelo menos uma alínea', () => {
    const nota = esquemaEditor.nodes['nota']!.create({ id: 'nta_esquema01' });
    expect(() => esquemaEditor.nodes['titulo']!.createChecked(null, [nota])).toThrow();
    expect(() => esquemaEditor.nodes['nota']!.createChecked({ id: 'nta_esquema02' }, [nota])).toThrow();
    expect(() => esquemaEditor.nodes['alineas']!.createChecked({ id: 'aln_esquema01' }, [])).toThrow();
    expect(() => esquemaEditor.nodes['paragrafo']!.createChecked({ id: 1 })).toThrow();
  });

  it('sobrescrito e subscrito se excluem; só as quatro marcas do modelo existem', () => {
    const { sobrescrito, subscrito } = esquemaEditor.marks;
    expect(sobrescrito!.excludes(subscrito!)).toBe(true);
    expect(subscrito!.excludes(sobrescrito!)).toBe(true);
    expect(Object.keys(esquemaEditor.marks)).toEqual([...ORDEM_MARCAS]);
  });

  it('nó de bloco sem id faz a conversão falhar com erro claro', () => {
    const doc = esquemaEditor.nodes['secaoDoc']!.create(null, [
      esquemaEditor.nodes['titulo']!.create(),
      esquemaEditor.nodes['paragrafo']!.create(),
    ]);
    expect(() => docParaSecao(doc)).toThrow(ErroConversao);
  });

  it('todo tipo com id tem prefixo, e os ids gerados seguem o PADRAO_ID', () => {
    expect(PADRAO_ID_EDITOR.source).toBe(PADRAO_ID.source);
    for (const [nome, tipo] of Object.entries(esquemaEditor.nodes)) {
      expect('id' in (tipo.spec.attrs ?? {}), nome).toBe(nome in PREFIXO_ID);
    }
  });

  it('a cópia da regra de caracteres do XML recusa exatamente o que o PADRAO_TEXTO_XML recusa', () => {
    const diferentes: number[] = [];
    for (let c = 0; c <= 0xffff; c++) {
      const ch = String.fromCharCode(c);
      const invalidoNoModelo = !PADRAO_TEXTO_XML.test(ch);
      const invalidoNaColagem = ch.replace(CARACTERES_FORA_DO_XML, '') === '';
      if (invalidoNoModelo !== invalidoNaColagem) diferentes.push(c);
    }
    expect(diferentes).toEqual([]);
    expect('😀'.replace(CARACTERES_FORA_DO_XML, '')).toBe('😀');
  });
});

/** Atributos de todos os elementos de uma saída de `toDOM`. */
function atributosDe(spec: DOMOutputSpec): Record<string, unknown>[] {
  if (!Array.isArray(spec)) return [];
  const [, segundo, ...resto] = spec as unknown[];
  const saida: Record<string, unknown>[] = [];
  const filhos = segundo && typeof segundo === 'object' && !Array.isArray(segundo) ? resto : [segundo, ...resto];
  if (segundo && typeof segundo === 'object' && !Array.isArray(segundo)) saida.push(segundo as Record<string, unknown>);
  for (const f of filhos) if (Array.isArray(f)) saida.push(...atributosDe(f as DOMOutputSpec));
  return saida;
}

describe('EDT — toDOM só com classes e data-* (CSP; ADR-0007, seção 2)', () => {
  it('nenhum nó nem marca emite style ou atributo de evento', () => {
    const amostras: [string, DOMOutputSpec][] = [];
    for (const [nome, tipo] of Object.entries(esquemaEditor.nodes)) {
      if (!tipo.spec.toDOM) continue;
      const no: NoPm = tipo.createAndFill(nome in PREFIXO_ID ? { id: 'par_amostra01' } : null)!;
      amostras.push([nome, tipo.spec.toDOM(no)]);
    }
    for (const [nome, tipo] of Object.entries(esquemaEditor.marks)) {
      amostras.push([nome, tipo.spec.toDOM!(tipo.create(), true)]);
    }
    expect(amostras.length).toBe(Object.keys(esquemaEditor.nodes).length - 2 + Object.keys(esquemaEditor.marks).length);
    for (const [nome, spec] of amostras) {
      for (const attrs of atributosDe(spec)) {
        const proibidos = Object.keys(attrs).filter((k) => k.toLowerCase() === 'style' || /^on/i.test(k));
        expect(proibidos, nome).toEqual([]);
        for (const k of Object.keys(attrs)) expect(k === 'class' || k.startsWith('data-'), `${nome}: ${k}`).toBe(true);
      }
    }
  });
});

describe('EDT — memo por identidade de nó (R39) e fatia de colagem', () => {
  it('blocos que a transação não tocou são o mesmo objeto do modelo', () => {
    const s = conteudo(todasAsSecoes(lerDocumento('documento-bordas-m2.json').corpo)[0]!);
    const doc = secaoParaDoc(s);
    const antes = docParaSecao(doc);
    const segundo = doc.child(2);
    const outro = segundo.type.create(segundo.attrs, esquemaEditor.text('mudou'));
    const depois = docParaSecao(doc.copy(doc.content.replaceChild(2, outro)));
    expect(depois.blocos[0]).toBe(antes.blocos[0]);
    expect(depois.blocos[1]).not.toBe(antes.blocos[1]);
    expect(depois.blocos[2]).toBe(antes.blocos[2]);
  });

  it('parágrafo na ponta da fatia fica aberto; outros blocos entram inteiros', () => {
    const par: Bloco = { tipo: 'paragrafo', id: 'par_fatia0001', conteudo: [{ tipo: 'texto', texto: 'p' }] };
    const cit: Bloco = { tipo: 'citacaoLonga', id: 'cit_fatia0001', conteudo: [] };
    expect(blocosParaSlice([]).size).toBe(0);
    const a = blocosParaSlice([par]);
    expect([a.openStart, a.openEnd]).toEqual([1, 1]);
    const b = blocosParaSlice([cit, par]);
    expect([b.openStart, b.openEnd]).toEqual([0, 1]);
  });
});
