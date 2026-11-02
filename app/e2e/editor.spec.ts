/**
 * EDT-06 a EDT-08 (M2-T06; ADR-0007, seções 3 a 5): o editor de seção no Electron real.
 *
 * - EDT-06: criar seção, digitar (acentos pelo teclado, `insertText` e composição de IME pelo CDP), itálico, desfazer e
 *   refazer, nota de rodapé, Ctrl+S, fechar e reabrir: o arquivo e a tela têm exatamente o que foi digitado;
 * - EDT-07: colagem com a área de transferência real (HTML das fixtures do Word, do LibreOffice e do Chrome escrito pelo
 *   `clipboard` do Electron): só `Bloco`/`Inline` do modelo, aviso das imagens, nenhuma requisição para a imagem
 *   remota no net-log, nenhum script; "Colar sem formatação" pelo menu Editar (B5);
 * - EDT-08: em todos, nenhum erro de console, exceção ou violação de CSP (`x.problemas`);
 * - EDT-09 (M2-T07): árvore de seções pelo teclado (subir, recuar, promover, excluir, setas, Enter), arrastar e soltar,
 *   botões "Seção anterior/Próxima seção" e Ctrl+Page Up, e a ordem única de desfazer (estrutura e texto de outra
 *   seção); o arquivo salvo tem a ordem e os títulos da tela.
 *
 * As fixtures de colagem foram escritas à mão no formato conhecido [HIPÓTESE de fidelidade]: a conferência com a cópia
 * real do Word e do LibreOffice fica no roteiro manual do relatório do M2.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Bloco, Documento } from '../src/dominio/modelo';
import {
  abrirApp,
  arquivosBdp,
  atividadeDeRede,
  criarAmbiente,
  criarTrabalho,
  lerDocumento,
  RAIZ_APP,
  type Ambiente,
  type AppAberto,
} from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const fixture = (nome: string) => readFileSync(join(RAIZ_APP, 'tests', 'fixtures', 'colagem', nome), 'utf8');
const corpoDoArquivo = (amb: Ambiente): Documento['corpo'] => {
  const nomes = arquivosBdp(amb);
  expect(nomes).toHaveLength(1);
  return (JSON.parse(lerDocumento(join(amb.trabalhos, nomes[0]!)).json) as Documento).corpo;
};

/**
 * Trabalho com uma seção só, o cursor no título dela. Desde o M2-T02 o trabalho nasce com as seções do tipo: o teste
 * exclui as três do TCC pela árvore (Delete) antes de criar a sua.
 */
async function trabalhoComSecao(x: AppAberto): Promise<Page> {
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Editor');
  await expect.poll(() => arvore(p)).toEqual(['1 Introdução', '2 Desenvolvimento', '3 Considerações finais']);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  for (let i = 0; i < 3; i++) await p.keyboard.press('Delete');
  await expect(p.getByRole('treeitem')).toHaveCount(0);
  await p.getByRole('button', { name: 'Nova seção' }).click();
  await expect(p.getByRole('textbox', { name: 'Texto da seção 1' })).toBeFocused();
  return p;
}

/** Nome dos itens da árvore, na ordem da tela ("2.1 Coleta"). */
const arvore = (p: Page) => p.getByRole('treeitem').allTextContents();

const editor = (p: Page) => p.getByRole('textbox', { name: 'Texto da seção 1' });

/** Área de transferência do sistema com HTML e texto (como a cópia de um editor de texto). */
async function escrever(x: AppAberto, html: string, texto: string): Promise<void> {
  await x.app.evaluate(({ clipboard, ClipboardItem }, d) => clipboard.write([new ClipboardItem({ 'text/html': d.html, 'text/plain': d.texto })]), {
    html,
    texto,
  });
}

async function colarHtml(x: AppAberto, html: string, texto: string): Promise<void> {
  await escrever(x, html, texto);
  await x.pagina.keyboard.press('Control+V');
}

test('EDT-06: digitar, formatar, desfazer, nota, salvar e reabrir idêntico', async () => {
  const x = await abrirApp(amb);
  const p = await trabalhoComSecao(x);
  const visor = p.locator('.visor [role="status"]');

  await p.keyboard.type('Introdução');
  await expect(p.getByRole('treeitem', { selected: true })).toContainText('Introdução');
  await p.keyboard.press('Enter');
  // Teclado (acentos), insertText (como o IME entrega) e composição de IME pelo CDP (tecla morta + vogal).
  await p.keyboard.type('O pequi é do cerrado');
  await p.keyboard.insertText(', ação e ');
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.imeSetComposition', { text: '´', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: 'ú' });
  await p.keyboard.type('nico.');

  const texto = 'O pequi é do cerrado, ação e único.';
  await expect(editor(p).locator('p')).toHaveText(texto);

  // Nota de rodapé no fim do parágrafo (cursor no fim, nada selecionado): Ctrl+Alt+F abre o texto da nota com o foco;
  // Esc volta ao texto da seção, com o cursor logo depois da chamada.
  // Tecla minúscula, como o teclado manda sem Caps Lock (o "F" maiúsculo também está ligado).
  await p.keyboard.press('Control+Alt+f');
  const textoNota = p.getByRole('textbox', { name: 'Texto da nota de rodapé' });
  await expect(textoNota).toBeFocused();
  await p.keyboard.type('Fruto típico do Tocantins.');
  await p.keyboard.press('Escape');
  await expect(editor(p)).toBeFocused();
  await expect(textoNota).toHaveCount(0);
  await expect(editor(p).locator('.bd-nota')).toHaveAttribute('aria-label', 'Nota de rodapé: Fruto típico do Tocantins.');
  await expect(editor(p).locator('.bd-nota')).toHaveAttribute('role', 'doc-noteref');

  // Itálico em "cerrado", desfazer e refazer. A seleção é feita no DOM, como a do mouse: andar com as setas por cima da
  // chamada da nota (nó atômico) dá um número de passos que varia entre rodadas.
  await p.evaluate(() => {
    const no = document.querySelector('.bd-editor p')!.firstChild!;
    const inicio = (no.textContent ?? '').indexOf('cerrado');
    const faixa = document.createRange();
    faixa.setStart(no, inicio);
    faixa.setEnd(no, inicio + 'cerrado'.length);
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(faixa);
  });
  await expect(p.getByRole('button', { name: 'Itálico' })).toHaveAttribute('aria-pressed', 'false');
  await p.keyboard.press('Control+I');
  await expect(editor(p).locator('p em')).toHaveText('cerrado');
  await expect(p.getByRole('button', { name: 'Itálico' })).toHaveAttribute('aria-pressed', 'true');
  await p.keyboard.press('Control+Z');
  await expect(editor(p).locator('p em')).toHaveCount(0);
  await p.keyboard.press('Control+Y');
  await expect(editor(p).locator('p em')).toHaveText('cerrado');
  await expect(editor(p).locator('.bd-nota')).toHaveCount(1);

  await expect(visor).toHaveText('Alterações não salvas');
  await p.keyboard.press('Control+S');
  await expect(visor).toHaveText(/^Salvo às/);

  const esperado: Bloco = {
    tipo: 'paragrafo',
    id: expect.stringMatching(/^par_[A-Za-z0-9_-]{16}$/) as unknown as string,
    conteudo: [
      { tipo: 'texto', texto: 'O pequi é do ' },
      { tipo: 'texto', texto: 'cerrado', marcas: ['italico'] },
      { tipo: 'texto', texto: ', ação e único.' },
      {
        tipo: 'nota',
        id: expect.stringMatching(/^nta_/) as unknown as string,
        conteudo: [{ tipo: 'texto', texto: 'Fruto típico do Tocantins.' }],
      },
    ],
  };
  const corpo = corpoDoArquivo(amb);
  expect(corpo).toHaveLength(1);
  expect(corpo[0]!.titulo).toEqual([{ tipo: 'texto', texto: 'Introdução' }]);
  expect(corpo[0]!.blocos).toEqual([esperado]);

  // Fechar e reabrir: a tela mostra o mesmo texto, e o arquivo não muda.
  await p.keyboard.press('Control+W');
  await p.getByRole('option', { name: /^Editor,/ }).dblclick();
  await expect(editor(p).locator('h2')).toHaveText('Introdução');
  await expect(editor(p).locator('p em')).toHaveText('cerrado');
  await expect(editor(p).locator('p')).toContainText(texto);
  await expect(visor).toHaveText(/^Salvo/);
  await p.keyboard.press('Control+W');
  await x.fechar();
  expect(corpoDoArquivo(amb)).toEqual(corpo);
  expect(x.problemas).toEqual([]);
});

test('EDT-07: colar do Word, do LibreOffice e do Chrome pela área de transferência real; colar sem formatação pelo menu', async () => {
  const x = await abrirApp(amb);
  const p = await trabalhoComSecao(x);
  await p.keyboard.type('Colagens');
  await p.keyboard.press('Enter');

  // Word: itálico de nome científico, sobrescrito, alíneas e a nota no ponto da chamada; a imagem é descartada.
  await colarHtml(x, fixture('word.html'), 'texto puro do Word');
  await expect(editor(p).locator('em', { hasText: 'Caryocar brasiliense' })).toHaveCount(1);
  await expect(editor(p).locator('ol.bd-alineas')).toHaveCount(1);
  await expect(editor(p).locator('.bd-nota')).toHaveCount(1);
  await expect(p.getByRole('status').filter({ hasText: 'As imagens coladas foram descartadas' })).toBeVisible();
  await expect(editor(p).locator('img, table, script, iframe, [style]')).toHaveCount(0);

  // LibreOffice: imagem remota (https) descartada sem pedir nada à rede.
  await p.keyboard.press('Control+End');
  await colarHtml(x, fixture('libreoffice.html'), 'texto puro do LibreOffice');
  await expect(editor(p)).toContainText('Depois da imagem');

  // Chrome: `<img onerror>` e `<script>` não rodam; a citação longa vira bloco.
  await p.keyboard.press('Control+End');
  await colarHtml(x, fixture('chrome.html'), 'texto puro do Chrome');
  await expect(editor(p).locator('blockquote')).toContainText('Citação longa copiada da web.');

  // Menu Editar › Colar sem formatação: o HTML da área de transferência é ignorado, fica só o texto.
  await p.keyboard.press('Control+End');
  await escrever(x, '<p><b>negrito do menu</b></p>', 'texto do menu');
  await p.getByRole('menuitem', { name: 'Editar' }).click();
  await p.getByRole('menuitem', { name: /^Colar sem formatação/ }).click();
  await expect(editor(p)).toContainText('texto do menu');
  await expect(editor(p).locator('strong', { hasText: 'negrito do menu' })).toHaveCount(0);
  // Menu Editar › Colar: com formatação.
  await escrever(x, '<p><b>negrito do menu</b></p>', 'negrito do menu');
  await p.getByRole('menuitem', { name: 'Editar' }).click();
  await p.getByRole('menuitem', { name: /^Colar(?! sem)/ }).click();
  await expect(editor(p).locator('strong', { hasText: 'negrito do menu' })).toHaveCount(1);

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const corpo = corpoDoArquivo(amb);
  const tipos = corpo[0]!.blocos.map((b) => b.tipo);
  expect(tipos).toContain('alineas');
  expect(tipos).toContain('citacaoLonga');
  // A nota do Word, com o título da obra em itálico, ficou no ponto da chamada.
  expect(JSON.stringify(corpo)).toContain('{"tipo":"texto","texto":"Flora do Cerrado","marcas":["italico"]}');
  // Ids únicos em blocos e notas (R38): a leitura do `.bdp` já recusaria, mas o teste mostra o motivo.
  const ids = JSON.stringify(corpo).match(/"id":"[^"]+"/g) ?? [];
  expect(new Set(ids).size).toBe(ids.length);

  await p.keyboard.press('Control+W');
  await x.fechar();
  const rede = atividadeDeRede(x.netLog);
  expect(rede.tipos.size).toBeGreaterThan(0); // controle positivo: o net-log foi gravado
  expect(rede.resolucoes.filter((h) => h.includes('exemplo.invalid'))).toEqual([]);
  expect(rede.urls.filter((u) => /exemplo\.invalid|^https?:|^file:/.test(u))).toEqual([]);
  expect(x.requisicoes.filter((u) => !u.startsWith('app://interface/'))).toEqual([]);
  expect(x.problemas).toEqual([]);
});

test('EDT-09: árvore de seções — teclado, arrastar, barra superior e desfazer único', async () => {
  const x = await abrirApp(amb);
  const p = await trabalhoComSecao(x);
  await p.keyboard.type('Introdução');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Texto um.');
  // "Nova seção" entra depois da escolhida, no mesmo nível, com o cursor no título.
  for (const titulo of ['Método', 'Resultados']) {
    await p.getByRole('button', { name: 'Nova seção' }).click();
    await p.keyboard.type(titulo);
  }
  await expect.poll(() => arvore(p)).toEqual(['1 Introdução', '2 Método', '3 Resultados']);

  // Subir com Alt+Shift+↑ na árvore: o foco fica no item, com o número novo, nível e posição para o leitor de tela.
  await p.getByRole('treeitem', { name: '3 Resultados' }).click();
  await expect(p.getByRole('treeitem', { name: '3 Resultados' })).toBeFocused();
  await p.keyboard.press('Alt+Shift+ArrowUp');
  await expect.poll(() => arvore(p)).toEqual(['1 Introdução', '2 Resultados', '3 Método']);
  const resultados = p.getByRole('treeitem', { name: '2 Resultados' });
  await expect(resultados).toBeFocused();
  await expect(resultados).toHaveAttribute('aria-posinset', '2');
  await expect(resultados).toHaveAttribute('aria-setsize', '3');
  await expect(p.getByRole('textbox', { name: 'Texto da seção 2' })).toBeVisible();

  // Recuar (Alt+Shift+→) e promover (Alt+Shift+←); a primária não promove: mensagem, sem mudar nada.
  await p.keyboard.press('Alt+Shift+ArrowRight');
  await expect.poll(() => arvore(p)).toEqual(['1 Introdução', '1.1 Resultados', '2 Método']);
  await expect(p.getByRole('treeitem', { name: '1.1 Resultados' })).toHaveAttribute('aria-level', '2');
  await expect(p.getByRole('treeitem', { name: '1.1 Resultados' })).toBeFocused();
  await p.keyboard.press('Alt+Shift+ArrowLeft');
  await expect.poll(() => arvore(p)).toEqual(['1 Introdução', '2 Resultados', '3 Método']);
  await p.keyboard.press('Alt+Shift+ArrowLeft');
  await expect(p.getByRole('status').filter({ hasText: 'A seção já é primária.' })).toBeVisible();

  // Desfazer na árvore segue a ordem única: promover, recuar, subir; refazer volta um passo.
  await p.keyboard.press('Control+Z');
  await expect.poll(() => arvore(p)).toEqual(['1 Introdução', '1.1 Resultados', '2 Método']);
  await p.keyboard.press('Control+Z');
  await p.keyboard.press('Control+Z');
  await expect.poll(() => arvore(p)).toEqual(['1 Introdução', '2 Método', '3 Resultados']);
  await p.keyboard.press('Control+Y');
  await expect.poll(() => arvore(p)).toEqual(['1 Introdução', '2 Resultados', '3 Método']);

  // Setas e Enter: a seleção acompanha o foco; Enter leva ao texto da seção.
  await p.getByRole('treeitem', { selected: true }).focus();
  await p.keyboard.press('Home');
  await expect(p.getByRole('treeitem', { name: '1 Introdução' })).toBeFocused();
  await p.keyboard.press('Enter');
  await expect(p.getByRole('textbox', { name: 'Texto da seção 1' })).toBeFocused();

  // Texto de outra seção: digitar na 1, ir para a 3 pela barra superior e por Ctrl+Page Down, e desfazer pela árvore —
  // a seção 1 volta a ser a ativa, sem o texto.
  await p.keyboard.press('Control+End');
  await p.keyboard.type(' Mais.');
  await p.getByRole('button', { name: 'Próxima seção' }).click();
  await expect(p.getByRole('treeitem', { selected: true })).toHaveText('2 Resultados');
  await p.keyboard.press('Control+PageDown');
  await expect(p.getByRole('treeitem', { selected: true })).toHaveText('3 Método');
  await expect(p.getByRole('button', { name: 'Próxima seção' })).toBeDisabled();
  await p.keyboard.press('Control+PageUp');
  await expect(p.getByRole('treeitem', { selected: true })).toHaveText('2 Resultados');
  await p.getByRole('treeitem', { selected: true }).focus();
  await p.keyboard.press('Control+Z');
  await expect(p.getByRole('treeitem', { selected: true })).toHaveText('1 Introdução');
  await expect(p.getByRole('textbox', { name: 'Texto da seção 1' }).locator('p')).toHaveText('Texto um.');
  await p.keyboard.press('Control+Y');
  await expect(p.getByRole('textbox', { name: 'Texto da seção 1' }).locator('p')).toHaveText('Texto um. Mais.');

  // Arrastar "3 Método" para a metade de cima de "1 Introdução".
  const metodo = p.getByRole('treeitem', { name: '3 Método' });
  await metodo.dragTo(p.getByRole('treeitem', { name: '1 Introdução' }), { targetPosition: { x: 20, y: 3 } });
  await expect.poll(() => arvore(p)).toEqual(['1 Método', '2 Introdução', '3 Resultados']);

  // Excluir com Delete: anúncio, a vizinha vira a ativa; Ctrl+Z devolve a seção com o texto.
  await p.getByRole('treeitem', { name: '2 Introdução' }).click();
  await p.keyboard.press('Delete');
  await expect.poll(() => arvore(p)).toEqual(['1 Método', '2 Resultados']);
  await expect(p.getByRole('status').filter({ hasText: 'Seção 2 excluída. Ctrl+Z desfaz.' })).toBeVisible();
  await expect(p.getByRole('treeitem', { name: '2 Resultados' })).toBeFocused();
  await p.keyboard.press('Control+Z');
  await expect.poll(() => arvore(p)).toEqual(['1 Método', '2 Introdução', '3 Resultados']);
  await expect(p.getByRole('textbox', { name: 'Texto da seção 2' }).locator('p')).toHaveText('Texto um. Mais.');

  // Trabalho › Estrutura de seções… põe o foco na árvore.
  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: /^Estrutura de seções/ }).click();
  await expect(p.getByRole('treeitem', { selected: true })).toBeFocused();

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const corpo = corpoDoArquivo(amb);
  expect(corpo.map((s) => s.titulo.map((t) => t.texto).join(''))).toEqual(['Método', 'Introdução', 'Resultados']);
  expect(corpo[1]!.blocos).toHaveLength(1);
  await p.keyboard.press('Control+W');
  await x.fechar();
  expect(x.problemas).toEqual([]);
});
