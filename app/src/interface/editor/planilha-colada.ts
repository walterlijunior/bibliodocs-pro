/**
 * Tabela colada do Excel ou do LibreOffice (M5-T05; RF-09; D-M5-01). Lê a primeira `<table>` do HTML da área de
 * transferência, na árvore mínima `NoHtml` (o `Document` inerte de `colagem.ts` no renderer; `apoio/html-minimo.ts` nos
 * testes), e entrega a grade no modelo do HTML, com `colspan` e `rowspan`. A conversão (números, datas, vazios) é da
 * camada de aplicação (`aplicacao/servicos/planilha.ts`).
 *
 * Nada aqui lê `innerHTML`, carrega recurso ou executa código: o texto vem dos nós de texto e o `<br>` vira quebra.
 * As planilhas copiam o valor como aparece na tela ("1.234,5"), que é o que vai para a tabela.
 */
import type { CelulaPlanilha, EstiloOrigem, PlanilhaLida } from '../../aplicacao';
import type { AlinhamentoColuna } from '../../dominio/modelo';
import { ATRIBUTO_ESTILO, type NoHtml } from './html-colado';

interface ElementoHtml extends NoHtml {
  getAttribute(nome: string): string | null;
}

const ELEMENTO = 1;
const TEXTO = 3;
/** Além disto, a árvore é ignorada (HTML colado pode ser arbitrariamente fundo). */
const PROFUNDIDADE_MAXIMA = 256;
const IGNORADOS = new Set(['head', 'style', 'script', 'template', 'title', 'colgroup', 'col']);

const ehElemento = (no: NoHtml): no is ElementoHtml => no.nodeType === ELEMENTO;
const nomeDe = (no: NoHtml): string => no.nodeName.toLowerCase();
const filhos = (no: NoHtml): NoHtml[] => Array.from(no.childNodes);

const oculto = (el: ElementoHtml): boolean => /(?:^|;)\s*display\s*:\s*none/i.test(el.getAttribute(ATRIBUTO_ESTILO) ?? el.getAttribute('style') ?? '');

/** Todas as `<table>` fora de outra tabela, em ordem. */
function tabelas(raiz: NoHtml): ElementoHtml[] {
  const achadas: ElementoHtml[] = [];
  const pilha: { no: NoHtml; prof: number }[] = [{ no: raiz, prof: 0 }];
  while (pilha.length > 0) {
    const { no, prof } = pilha.pop()!;
    if (!ehElemento(no) || prof > PROFUNDIDADE_MAXIMA || IGNORADOS.has(nomeDe(no))) continue;
    if (nomeDe(no) === 'table') {
      achadas.push(no);
      continue;
    }
    const f = filhos(no);
    for (let i = f.length - 1; i >= 0; i--) pilha.push({ no: f[i]!, prof: prof + 1 });
  }
  return achadas;
}

/** Texto da célula: espaços do HTML colapsados, `<br>` e fim de parágrafo como quebra de linha. */
function textoDe(celula: NoHtml): string {
  const partes: string[] = [];
  // `null` na pilha: fim de parágrafo (vem depois dos filhos, que são desempilhados antes).
  const pilha: ({ no: NoHtml; prof: number } | null)[] = [{ no: celula, prof: 0 }];
  while (pilha.length > 0) {
    const item = pilha.pop()!;
    if (item === null) {
      partes.push('\n');
      continue;
    }
    const { no, prof } = item;
    if (no.nodeType === TEXTO) {
      partes.push((no.nodeValue ?? '').replace(/[ \t\n\r\f]+/g, ' '));
      continue;
    }
    if (!ehElemento(no) || prof > PROFUNDIDADE_MAXIMA || IGNORADOS.has(nomeDe(no)) || oculto(no)) continue;
    const nome = nomeDe(no);
    if (nome === 'br') {
      partes.push('\n');
      continue;
    }
    if (nome === 'p' || nome === 'div') pilha.push(null);
    const f = filhos(no);
    for (let i = f.length - 1; i >= 0; i--) pilha.push({ no: f[i]!, prof: prof + 1 });
  }
  return partes
    .join('')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    // R-M5-02: primeiro junta as quebras repetidas (linear) e só depois tira as das pontas, que agora são no máximo uma
    // de cada lado: `/\n+$/` numa sequência longa de quebras custava tempo quadrático (80 mil <br> = 2 s).
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n/, '')
    .replace(/\n$/, '');
}

const inteiro = (v: string | null): number | undefined => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 1 ? n : undefined;
};

/** Linhas da tabela (em `thead`, `tbody`, `tfoot` ou direto), sem as de tabelas aninhadas. */
function linhasDe(tabela: ElementoHtml): { linhas: { tr: ElementoHtml; noCabecalho: boolean }[]; ocultas: number } {
  const linhas: { tr: ElementoHtml; noCabecalho: boolean }[] = [];
  let ocultas = 0;
  const incluir = (tr: ElementoHtml, noCabecalho: boolean) => (oculto(tr) ? ocultas++ : linhas.push({ tr, noCabecalho }));
  for (const f of filhos(tabela)) {
    if (!ehElemento(f)) continue;
    const nome = nomeDe(f);
    if (nome === 'tr') incluir(f, false);
    else if (oculto(f)) continue;
    else if (nome === 'thead' || nome === 'tbody' || nome === 'tfoot') {
      for (const tr of filhos(f)) if (ehElemento(tr) && nomeDe(tr) === 'tr') incluir(tr, nome === 'thead');
    }
  }
  return { linhas, ocultas };
}

/** Declarações CSS (`prop: valor`, minúsculas, sem `!important`). */
function declaracoes(css: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const d of css.split(';')) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const prop = d.slice(0, i).trim().toLowerCase();
    if (prop) mapa.set(prop, d.slice(i + 1).replace(/!\s*important/i, '').trim().toLowerCase());
  }
  return mapa;
}

/**
 * Estilos por classe das folhas `<style>` do HTML colado (o Excel põe bordas e alinhamento em classes como `.xl66`).
 * Lido como texto, antes de a neutralização tirar as folhas; só seletores de uma classe (`.xl66`, `td.xl66`) contam.
 */
export function estilosDeClasse(html: string): Map<string, Map<string, string>> {
  const classes = new Map<string, Map<string, string>>();
  for (const bloco of html.slice(0, 2_000_000).matchAll(/<style(?=[\s>/])[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    // R-RV-02: só os primeiros 256 KB de cada folha (as do Excel têm poucos KB); regra sem "}" num texto enorme deixaria a
    // busca quadrática.
    const css = bloco[1]!.slice(0, 256 * 1024).replace(/<!--|-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Varredura linear (R-RV-02): seletor até "{", declarações até "}"; sem "}" a folha acaba ali.
    for (let i = 0; i < css.length; ) {
      const abre = css.indexOf('{', i);
      if (abre < 0) break;
      const fecha = css.indexOf('}', abre);
      if (fecha < 0) break;
      const corpo = declaracoes(css.slice(abre + 1, fecha));
      for (const parte of css.slice(i, abre).split(',')) {
        const nome = /(?:^|[^A-Za-z0-9_-])[a-z]*\.([A-Za-z0-9_-]+)$/.exec(parte.trim())?.[1];
        if (!nome) continue;
        const atual = classes.get(nome) ?? new Map<string, string>();
        for (const [k, v] of corpo) atual.set(k, v);
        classes.set(nome, atual);
      }
      i = fecha + 1;
    }
  }
  return classes;
}

const SEM_BORDA = /^(none|0|0pt|0px|hidden)\b|\bnone\b/;
const comBorda = (v: string | undefined): boolean => v !== undefined && v !== '' && !SEM_BORDA.test(v);
const ALINHAMENTOS: Readonly<Record<string, AlinhamentoColuna>> = { left: 'esquerda', start: 'esquerda', center: 'centro', centre: 'centro', right: 'direita', end: 'direita', justify: 'esquerda' };
/** Cor que não é destaque: as palavras do padrão, preto ou branco em hexadecimal, ou preto em notação funcional. */
const PALAVRAS_PADRAO = new Set(['windowtext', 'black', 'white', 'auto', 'inherit', 'initial', 'transparent', 'none']);
const corPadrao = (v: string | undefined): boolean => {
  if (v === undefined) return true;
  const t = v.trim().replace(/\s+/g, '');
  if (PALAVRAS_PADRAO.has(t)) return true;
  if (t.startsWith('#')) return /^(0{3}|0{6}|f{3}|f{6})$/.test(t.slice(1));
  return /^rgba?\(0,0,0(,1)?\)$/.test(t);
};

/** Estilo efetivo da célula: o da classe e, por cima, o `style` dela. */
function estiloDaCelula(c: ElementoHtml, classes: ReadonlyMap<string, ReadonlyMap<string, string>>): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const nome of (c.getAttribute('class') ?? '').split(/\s+/)) for (const [k, v] of classes.get(nome) ?? []) mapa.set(k, v);
  for (const [k, v] of declaracoes(c.getAttribute(ATRIBUTO_ESTILO) ?? c.getAttribute('style') ?? '')) mapa.set(k, v);
  return mapa;
}

/** A primeira tabela do HTML colado, ou `null` se não há tabela. `classes`: de `estilosDeClasse` (a folha do Excel). */
export function planilhaDoHtml(raiz: NoHtml, classes: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map()): PlanilhaLida | null {
  const todas = tabelas(raiz);
  const tabela = todas[0];
  if (!tabela) return null;
  const avisos = todas.length > 1 ? ['Havia mais de uma tabela no que foi colado: só a primeira foi lida.'] : [];
  const { linhas: trs, ocultas } = linhasDe(tabela);
  // Linhas ocultas na planilha (o Excel as copia com `display:none`) ficam de fora, como estavam na tela.
  if (ocultas > 0) avisos.push(ocultas === 1 ? 'Uma linha oculta na planilha ficou de fora.' : `${ocultas} linhas ocultas na planilha ficaram de fora.`);
  let cabecalho = 0;
  let aindaCabecalho = true;
  const estilo: EstiloOrigem = { celulas: 0, bordasVerticais: 0, bordasHorizontais: 0, negrito: 0, italico: 0, cores: 0 };
  const linhas: CelulaPlanilha[][] = trs.map(({ tr, noCabecalho }) => {
    const celulas = filhos(tr).filter((c): c is ElementoHtml => ehElemento(c) && (nomeDe(c) === 'td' || nomeDe(c) === 'th') && !oculto(c));
    const deCabecalho = noCabecalho || (celulas.length > 0 && celulas.every((c) => nomeDe(c) === 'th'));
    if (aindaCabecalho && deCabecalho) cabecalho++;
    else aindaCabecalho = false;
    return celulas.map((c) => {
      const colunas = inteiro(c.getAttribute('colspan'));
      const linhasMescladas = inteiro(c.getAttribute('rowspan'));
      const e = estiloDaCelula(c, classes);
      const alinhamento = ALINHAMENTOS[(e.get('text-align') ?? c.getAttribute('align') ?? '').trim().toLowerCase()];
      estilo.celulas++;
      const borda = e.get('border');
      if (comBorda(borda) || comBorda(e.get('border-left')) || comBorda(e.get('border-right'))) estilo.bordasVerticais++;
      if (comBorda(borda) || comBorda(e.get('border-top')) || comBorda(e.get('border-bottom'))) estilo.bordasHorizontais++;
      const peso = e.get('font-weight');
      if (peso !== undefined && (peso === 'bold' || peso === 'bolder' || Number(peso) >= 600)) estilo.negrito++;
      if ((e.get('font-style') ?? '').startsWith('italic')) estilo.italico++;
      const fundo = e.get('background-color') ?? e.get('background');
      if (!corPadrao(e.get('color')) || !corPadrao(fundo)) estilo.cores++;
      return { texto: textoDe(c), ...(colunas ? { colunas } : {}), ...(linhasMescladas ? { linhas: linhasMescladas } : {}), ...(alinhamento ? { alinhamento } : {}) };
    });
  });
  return { linhas, ...(cabecalho > 0 ? { linhasCabecalho: cabecalho } : {}), avisos, estiloOrigem: estilo };
}
