/**
 * Tabela colada do Excel ou do LibreOffice (M5-T05; RF-09; D-M5-01). Lê a primeira `<table>` do HTML da área de
 * transferência, na árvore mínima `NoHtml` (o `Document` inerte de `colagem.ts` no renderer; `apoio/html-minimo.ts` nos
 * testes), e entrega a grade no modelo do HTML, com `colspan` e `rowspan`. A conversão (números, datas, vazios) é da
 * camada de aplicação (`aplicacao/servicos/planilha.ts`).
 *
 * Nada aqui lê `innerHTML`, carrega recurso ou executa código: o texto vem dos nós de texto e o `<br>` vira quebra.
 * As planilhas copiam o valor como aparece na tela ("1.234,5"), que é o que vai para a tabela.
 */
import type { CelulaPlanilha, PlanilhaLida } from '../../aplicacao';
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
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{2,}/g, '\n');
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

/** A primeira tabela do HTML colado, ou `null` se não há tabela. */
export function planilhaDoHtml(raiz: NoHtml): PlanilhaLida | null {
  const todas = tabelas(raiz);
  const tabela = todas[0];
  if (!tabela) return null;
  const avisos = todas.length > 1 ? ['Havia mais de uma tabela no que foi colado: só a primeira foi lida.'] : [];
  const { linhas: trs, ocultas } = linhasDe(tabela);
  // Linhas ocultas na planilha (o Excel as copia com `display:none`) ficam de fora, como estavam na tela.
  if (ocultas > 0) avisos.push(ocultas === 1 ? 'Uma linha oculta na planilha ficou de fora.' : `${ocultas} linhas ocultas na planilha ficaram de fora.`);
  let cabecalho = 0;
  let aindaCabecalho = true;
  const linhas: CelulaPlanilha[][] = trs.map(({ tr, noCabecalho }) => {
    const celulas = filhos(tr).filter((c): c is ElementoHtml => ehElemento(c) && (nomeDe(c) === 'td' || nomeDe(c) === 'th') && !oculto(c));
    const deCabecalho = noCabecalho || (celulas.length > 0 && celulas.every((c) => nomeDe(c) === 'th'));
    if (aindaCabecalho && deCabecalho) cabecalho++;
    else aindaCabecalho = false;
    return celulas.map((c) => {
      const colunas = inteiro(c.getAttribute('colspan'));
      const linhasMescladas = inteiro(c.getAttribute('rowspan'));
      return { texto: textoDe(c), ...(colunas ? { colunas } : {}), ...(linhasMescladas ? { linhas: linhasMescladas } : {}) };
    });
  });
  return { linhas, ...(cabecalho > 0 ? { linhasCabecalho: cabecalho } : {}), avisos };
}
