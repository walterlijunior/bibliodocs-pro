// M2-T05 — Colagem saneada para o modelo (ADR-0007, seção 5; R40). O HTML das fixtures em `fixtures/colagem/` foi
// escrito à mão no formato conhecido do Word, do LibreOffice, do Chrome, do Google Docs e do próprio app [HIPÓTESE de
// fidelidade: a captura real da área de transferência entra no E2E do M2-T06]. Em Node, a árvore vem de
// `apoio/html-minimo.ts`; no renderer, do `DOMParser` inerte de `colagem.ts`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EditorState, TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import { idsDoBloco, type Bloco, type Documento, type Inline } from '../src/dominio/modelo';
import { blocosParaSlice, docParaSecao, secaoParaDoc } from '../src/interface/editor/conversao';
import { lerHtmlColado, lerTextoColado, MENSAGENS_AVISO, type AvisoColagem } from '../src/interface/editor/html-colado';
import { pluginIdsUnicos } from '../src/interface/editor/plugins/ids-unicos';
import { lerHtmlMinimo } from './apoio/html-minimo';

const FIXTURES = ['word', 'libreoffice', 'chrome', 'google-docs', 'app'] as const;
const lerFixture = (nome: string): string => readFileSync(join(__dirname, 'fixtures', 'colagem', `${nome}.html`), 'utf8');

function sequencial(): (prefixo: string) => string {
  let n = 0;
  return (prefixo) => `${prefixo}_cola${String(++n).padStart(4, '0')}`;
}

const colar = (html: string) => lerHtmlColado(lerHtmlMinimo(html), sequencial());

/** Texto visível de um conteúdo, com as notas entre colchetes. */
const plano = (c: readonly Inline[]): string =>
  c.map((i) => (i.tipo === 'texto' ? i.texto : `[${plano(i.conteudo)}]`)).join('');

/** Resumo legível dos blocos: tipo e texto (alíneas com as subalíneas). */
function resumo(blocos: readonly Bloco[]): string[] {
  return blocos.flatMap((b) => {
    switch (b.tipo) {
      case 'paragrafo':
        return [`P: ${plano(b.conteudo)}`];
      case 'citacaoLonga':
        return [`C: ${plano(b.conteudo)}`];
      case 'quebraPagina':
        return ['Q'];
      case 'alineas':
        return b.itens.flatMap((item) => [`A: ${plano(item.conteudo)}`, ...(item.subalineas ?? []).map((s) => `  S: ${plano(s)}`)]);
    }
  });
}

function validarBlocos(blocos: Bloco[]): void {
  const documento: Documento = {
    id: 'prj_colagem001',
    tipoTrabalho: 'generico',
    metadados: { titulo: [] },
    corpo: [{ id: 'sec_colagem001', titulo: [], blocos, subsecoes: [] }],
  };
  const r = validarDocumentoV1(documento);
  expect(r.ok, r.ok ? '' : JSON.stringify(r.erros)).toBe(true);
}

describe('EDT — HTML colado vira só Bloco/Inline (todas as fixtures)', () => {
  it.each(FIXTURES)('%s: resultado válido no formato v1, ids novos e únicos, sem ids do HTML', (nome) => {
    const html = lerFixture(nome);
    const { blocos } = colar(html);
    expect(blocos.length).toBeGreaterThan(0);
    validarBlocos(blocos);
    const ids = blocos.flatMap(idsDoBloco);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toContain('_cola');
    // Ida e volta pelo editor: a fatia colada é aceita pelo esquema e volta igual.
    const doc = secaoParaDoc({ titulo: [], blocos });
    doc.check();
    expect(docParaSecao(doc).blocos).toEqual(blocos);
  });
});

describe('EDT — o que cada origem preserva', () => {
  it('Word: marcas por tag e por style, nota de rodapé no ponto da chamada, alíneas com subalínea', () => {
    const { blocos, avisos } = colar(lerFixture('word'));
    expect(resumo(blocos)).toEqual([
      'P: 1 INTRODUÇÃO',
      'P: O pequi (Caryocar brasiliense) é um fruto do cerrado, estudado por Silva[Ver Flora do Cerrado, p. 23.] desde 2010.',
      'P: A fórmula H2O e o 1o lugar; apud e negrito por dentro.',
      'A: primeira alínea;',
      '  S: subalínea;',
      'A: segunda alínea.',
      'P: Linha um\nlinha dois com controle',
      'P: Legenda solta',
      'P: visível',
    ]);
    expect(new Set(avisos)).toEqual(new Set<AvisoColagem>(['titulo', 'imagem', 'tabela']));
    const segundo = blocos[1]!;
    expect(segundo.tipo === 'paragrafo' && segundo.conteudo).toEqual([
      { tipo: 'texto', texto: 'O pequi (' },
      { tipo: 'texto', texto: 'Caryocar brasiliense', marcas: ['italico'] },
      { tipo: 'texto', texto: ') é um fruto do ' },
      { tipo: 'texto', texto: 'cerrado', marcas: ['negrito'] },
      { tipo: 'texto', texto: ', estudado por Silva' },
      {
        tipo: 'nota',
        id: 'nta_cola0001',
        conteudo: [
          { tipo: 'texto', texto: 'Ver ' },
          { tipo: 'texto', texto: 'Flora do Cerrado', marcas: ['italico'] },
          { tipo: 'texto', texto: ', p. 23.' },
        ],
      },
      { tipo: 'texto', texto: ' desde 2010.' },
    ]);
    const terceiro = blocos[2]!;
    expect(terceiro.tipo === 'paragrafo' && terceiro.conteudo.filter((i) => i.tipo === 'texto' && i.marcas)).toEqual([
      { tipo: 'texto', texto: '2', marcas: ['subscrito'] },
      { tipo: 'texto', texto: 'o', marcas: ['sobrescrito'] },
      { tipo: 'texto', texto: 'apud', marcas: ['italico'] },
      { tipo: 'texto', texto: 'negrito por dentro', marcas: ['negrito'] },
    ]);
  });

  it('LibreOffice: font/sup, nota de rodapé, lista aninhada vira alínea e subalíneas; terceiro nível avisado; imagem remota descartada', () => {
    const { blocos, avisos } = colar(lerFixture('libreoffice'));
    expect(resumo(blocos)).toEqual([
      'P: Texto com itálico, negrito e x2.[Nota do LibreOffice.]',
      'A: item um;',
      '  S: subitem;',
      '  S: terceiro nível;',
      'A: item dois.',
      'P: Depois da imagem',
    ]);
    expect(new Set(avisos)).toEqual(new Set<AvisoColagem>(['listaFunda', 'imagem']));
  });

  it('Chrome: style com itálico e negrito, espaços colapsados, script e iframe fora, blockquote vira citação, pre preserva', () => {
    const { blocos, avisos } = colar(lerFixture('chrome'));
    expect(resumo(blocos)).toEqual([
      'P: Título da página',
      'P: Trecho itálico e negrito com espaços e link.',
      'C: Citação longa copiada da web.',
      'A: ponto um',
      '  S: ponto dentro',
      'A: ponto dois',
      'P: linha 1\n  linha 2',
    ]);
    const segundo = blocos[1]!;
    expect(segundo.tipo === 'paragrafo' && segundo.conteudo[1]).toEqual({
      tipo: 'texto',
      texto: 'itálico e negrito',
      marcas: ['italico', 'negrito'],
    });
    expect(new Set(avisos)).toEqual(new Set<AvisoColagem>(['titulo', 'imagem', 'tabela']));
    expect(JSON.stringify(blocos)).not.toContain('alert');
  });

  it('Google Docs: o <b style="font-weight:normal"> de fora não põe negrito em tudo', () => {
    const { blocos, avisos } = colar(lerFixture('google-docs'));
    expect(blocos).toEqual([
      {
        tipo: 'paragrafo',
        id: 'par_cola0001',
        conteudo: [
          { tipo: 'texto', texto: 'Texto normal, ' },
          { tipo: 'texto', texto: 'negrito', marcas: ['negrito'] },
          { tipo: 'texto', texto: ' e itálico', marcas: ['italico'] },
          { tipo: 'texto', texto: '3', marcas: ['sobrescrito'] },
        ],
      },
      { tipo: 'paragrafo', id: 'par_cola0002', conteudo: [{ tipo: 'texto', texto: 'Segundo parágrafo.' }] },
    ]);
    expect(avisos).toEqual([]);
  });

  it('o próprio app: nota, alíneas, citação e quebra voltam com ids novos; o título copiado vira parágrafo sem aviso', () => {
    const { blocos, avisos } = colar(lerFixture('app'));
    expect(resumo(blocos)).toEqual([
      'P: Título da seção',
      'P: Texto com nota[conteúdo da nota] e fim.',
      'A: um;',
      '  S: sub;',
      'A: dois.',
      'C: Citação.',
      'Q',
      'P: Depois da quebra.',
    ]);
    expect(avisos).toEqual([]);
    expect(JSON.stringify(blocos)).not.toContain('original');
  });
});

describe('EDT — bordas da leitura', () => {
  it('caracteres fora do XML 1.0 são removidos; tabulação no texto corrido vira espaço', () => {
    const { blocos } = colar('<p>a\u0001b\u0008c￾d\uD800e\tf</p>');
    expect(resumo(blocos)).toEqual(['P: abcde f']);
  });

  it('parágrafos vazios, só com &nbsp; ou só com quebra não viram blocos', () => {
    expect(colar('<p>&nbsp;</p><p> </p><p><br></p><div></div>').blocos).toEqual([]);
  });

  it('chamada de nota do Word sem o texto da nota: chamada descartada, com aviso', () => {
    const { blocos, avisos } = colar(
      `<p>texto<a style='mso-footnote-id:ftn9' href="#_ftn9"><span class=MsoFootnoteReference>[9]</span></a> fim</p>`,
    );
    expect(resumo(blocos)).toEqual(['P: texto fim']);
    expect(avisos).toEqual(['notaPerdida']);
  });

  it('nota de fim do Word vira nota de rodapé, com aviso', () => {
    const { blocos, avisos } = colar(
      `<p>texto<a style='mso-endnote-id:edn1' href="#_edn1">[i]</a>.</p>` +
        `<div style='mso-element:endnote-list'><div style='mso-element:endnote' id=edn1><p><a style='mso-endnote-id:edn1' href="#_ednref1">[i]</a> Fim.</p></div></div>`,
    );
    expect(resumo(blocos)).toEqual(['P: texto[Fim.].']);
    expect(avisos).toEqual(['notaDeFim']);
  });

  it('nota do Word com dois parágrafos vira uma nota com quebra de linha (nota de um parágrafo, B7)', () => {
    const { blocos } = colar(
      `<p>x<a style='mso-footnote-id:ftn1'>[1]</a></p><div style='mso-element:footnote' id=ftn1><p>um</p><p>dois</p></div>`,
    );
    expect(resumo(blocos)).toEqual(['P: x[um\ndois]']);
  });

  it('HTML muito fundo não estoura a pilha: o que passa do limite vira texto', () => {
    const fundo = `${'<span>'.repeat(2_000)}fundo${'</span>'.repeat(2_000)}`;
    expect(resumo(colar(`<p>início ${fundo}</p>`).blocos)).toEqual(['P: início fundo']);
  });

  it('sobrescrito e subscrito nunca ficam juntos; o mais interno vence', () => {
    const { blocos } = colar('<p><sup>a<sub>b</sub></sup><span style="vertical-align:super"><sub>c</sub></span></p>');
    validarBlocos(blocos);
    const p = blocos[0]!;
    expect(p.tipo === 'paragrafo' && p.conteudo).toEqual([
      { tipo: 'texto', texto: 'a', marcas: ['sobrescrito'] },
      { tipo: 'texto', texto: 'bc', marcas: ['subscrito'] },
    ]);
  });

  it('texto puro: linha em branco separa parágrafos; quebra simples vira espaço', () => {
    const { blocos, avisos } = lerTextoColado('linha um\r\nlinha dois\n\n  \n\tsegundo\u0007 parágrafo  \n\n\n', sequencial());
    expect(resumo(blocos)).toEqual(['P: linha um linha dois', 'P: segundo parágrafo']);
    expect(avisos).toEqual([]);
    validarBlocos(blocos);
  });

  it('título numerado do Word (h1/h2 com mso-list) continua parágrafo, não vira alínea', () => {
    const { blocos, avisos } = colar(
      "<h1 style='mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>1<span>&nbsp; </span></span><![endif]>INTRODUÇÃO</h1>" +
        "<h2 style='mso-list:l1 level2 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>1.1<span>&nbsp; </span></span><![endif]>Objetivo</h2>",
    );
    expect(resumo(blocos)).toEqual(['P: INTRODUÇÃO', 'P: Objetivo']);
    expect(avisos).toEqual(['titulo']);
  });

  it('âncora e lista de comentários do Word não entram no texto', () => {
    const { blocos } = colar(
      "<p>texto<span class=MsoCommentReference><a class=msocomanchor id=_anchor_1 href='#_msocom_1' name=_msoanchor_1>[WJ1]</a></span> fim" +
        "<span class=MsoCommentReference><span style='mso-special-character:comment'>&nbsp;</span></span></p>" +
        "<div style='mso-element:comment-list'><div style='mso-element:comment'><p>comentário</p></div></div>",
    );
    expect(resumo(blocos)).toEqual(['P: texto fim']);
  });

  it('quebras e brancos no fim do parágrafo (o <br> final do Chrome) são tirados; no meio ficam', () => {
    expect(resumo(colar('<p>linha<br></p><p>x<br><br> </p><p>a<br>b</p>').blocos)).toEqual(['P: linha', 'P: x', 'P: a\nb']);
  });

  it('todo aviso tem mensagem em pt-BR', () => {
    for (const m of Object.values(MENSAGENS_AVISO)) expect(m.length).toBeGreaterThan(10);
  });
});

describe('EDT — colar no editor (EditorState, sem view)', () => {
  it('um parágrafo colado no meio de outro se junta a ele; o resultado é válido', () => {
    let s = EditorState.create({
      doc: secaoParaDoc({ titulo: [], blocos: [{ tipo: 'paragrafo', id: 'par_destino01', conteudo: [{ tipo: 'texto', texto: 'ab' }] }] }),
      plugins: [pluginIdsUnicos(sequencial())],
    });
    const { blocos } = colar('<p><i>X</i></p>');
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 4)).replaceSelection(blocosParaSlice(blocos)));
    expect(docParaSecao(s.doc).blocos).toEqual([
      {
        tipo: 'paragrafo',
        id: 'par_destino01',
        conteudo: [{ tipo: 'texto', texto: 'a' }, { tipo: 'texto', texto: 'X', marcas: ['italico'] }, { tipo: 'texto', texto: 'b' }],
      },
    ]);
  });

  it('a fixture do Word colada no meio de um parágrafo: documento válido e ids únicos', () => {
    let s = EditorState.create({
      doc: secaoParaDoc({ titulo: [], blocos: [{ tipo: 'paragrafo', id: 'par_destino01', conteudo: [{ tipo: 'texto', texto: 'ab' }] }] }),
      plugins: [pluginIdsUnicos(sequencial())],
    });
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 4)).replaceSelection(blocosParaSlice(colar(lerFixture('word')).blocos)));
    s.doc.check();
    const { blocos } = docParaSecao(s.doc);
    validarBlocos(blocos);
    expect(resumo(blocos)[0]).toBe('P: a1 INTRODUÇÃO');
    expect(resumo(blocos).at(-1)).toBe('P: visívelb');
  });
});

describe('EDT — leitor de HTML mínimo dos testes', () => {
  it('comentários, comentários falsos do Word, entidades, atributos e elementos vazios', () => {
    const raiz = lerHtmlMinimo(`<!DOCTYPE html><!--c--><![if x]><p class=a id="b" title='c'>x&amp;y&#233;&#x41;&nbsp;<br>z</p><![endif]>`);
    const nomes = Array.from(raiz.childNodes, (n) => n.nodeName);
    expect(nomes).toEqual(['#comment', '#comment', '#comment', 'P', '#comment']);
    const p = raiz.childNodes[3] as unknown as { getAttribute(n: string): string | null; childNodes: { nodeValue: string | null; nodeName: string }[] };
    expect([p.getAttribute('class'), p.getAttribute('id'), p.getAttribute('title')]).toEqual(['a', 'b', 'c']);
    expect(p.childNodes.map((n) => n.nodeValue ?? n.nodeName)).toEqual(['x&yéA ', 'BR', 'z']);
  });
});
