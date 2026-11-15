/**
 * Aceite da Etapa 2 da especificação revista (2026-11-14):
 * - sublinhar e tirar o sublinhado pelo botão e por Ctrl+U; o sublinhado persiste ao reabrir e sai no DOCX;
 * - o divisor muda a largura do painel da estrutura pelo mouse e pelo teclado, com limites, e a largura volta ao reabrir;
 * - os campos de texto corrido mostram o estilo do perfil ao digitar (resumo justificado; natureza começando no meio).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('Etapa 2 revista: sublinhado, divisor do painel e estilo do perfil nos campos', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Editor revisto');

  // Sublinhado: botão liga, Ctrl+U desliga e liga de novo.
  await p.getByRole('treeitem', { name: /Introdução/ }).click();
  const editor = p.getByRole('textbox', { name: /Texto da seção 1/ });
  await editor.click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Antes ');
  const botao = p.getByRole('toolbar', { name: 'Formatação do texto' }).getByRole('button', { name: 'Sublinhado' });
  await botao.click();
  await expect(botao).toHaveAttribute('aria-pressed', 'true');
  await p.keyboard.type('sublinhado');
  await p.keyboard.press('Control+U');
  await expect(botao).toHaveAttribute('aria-pressed', 'false');
  await p.keyboard.type(' depois');
  await expect(editor.locator('u')).toHaveText('sublinhado');
  await p.keyboard.press('Shift+Home');
  // O editor lê a seleção do DOM no `selectionchange`, que chega depois da tecla (como no FUN-13): espera a seleção.
  await expect.poll(() => p.evaluate(() => getSelection()?.toString())).toBe('Antes sublinhado depois');
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  await p.keyboard.press('Control+U');
  await expect(editor.locator('u')).toHaveText('Antes sublinhado depois');
  await p.keyboard.press('Control+U');
  await expect(editor.locator('u')).toHaveCount(0);
  await p.keyboard.press('End');
  await expect.poll(() => p.evaluate(() => getSelection()?.isCollapsed)).toBe(true);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  await p.keyboard.press('Control+U');
  await p.keyboard.type(' fim');
  await expect(editor.locator('u')).toHaveText(' fim');

  // Divisor: as setas mudam a largura em passos e Home vai ao mínimo.
  const divisor = p.getByRole('separator', { name: 'Largura do painel da estrutura' });
  const painel = p.locator('#painel-estrutura');
  const inicial = (await painel.boundingBox())!.width;
  await divisor.focus();
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  await expect.poll(async () => Math.round((await painel.boundingBox())!.width - inicial)).toBe(40);
  await p.keyboard.press('Home');
  await expect(divisor).toHaveAttribute('aria-valuenow', '180');
  await expect.poll(async () => Math.round((await painel.boundingBox())!.width)).toBe(180);
  // Arrastar com o mouse; o limite de 45% da área segura o painel numa largura enorme.
  const caixa = (await divisor.boundingBox())!;
  await p.mouse.move(caixa.x + caixa.width / 2, caixa.y + 40);
  await p.mouse.down();
  await p.mouse.move(caixa.x + 120, caixa.y + 40, { steps: 5 });
  await p.mouse.up();
  await expect(divisor).toHaveAttribute('aria-valuenow', '296');
  await p.keyboard.press('End');
  const area = (await p.locator('.escrever').boundingBox())!.width;
  expect((await painel.boundingBox())!.width).toBeLessThanOrEqual(Math.ceil(area * 0.45) + 1);
  await divisor.focus();
  await p.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
  await expect(divisor).toHaveAttribute('aria-valuenow', '280');

  // Campos de texto corrido com o estilo do perfil.
  const elementos = p.getByRole('navigation', { name: 'Elementos pré-textuais' });
  await elementos.getByRole('button', { name: /^Folha de rosto/ }).click();
  const natureza = p.getByLabel('Natureza do trabalho');
  await expect(natureza).toHaveCSS('text-align', 'justify');
  const padding = Number.parseFloat(await natureza.evaluate((el) => getComputedStyle(el).paddingLeft));
  expect(padding).toBeGreaterThan((await natureza.boundingBox())!.width * 0.4);
  await natureza.fill('Monografia apresentada à Universidade Federal do Tocantins como requisito parcial.');
  await elementos.getByRole('button', { name: /^Resumo( |$)(?!em)/ }).click();
  await expect(p.getByLabel('Texto do resumo', { exact: true })).toHaveCSS('text-align', 'justify');

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  const json = lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json;
  expect(json).toContain('"sublinhado"');
  expect(x.problemas).toEqual([]);
  await x.fechar();

  // Reabrir: o sublinhado e a largura voltam; o DOCX sai com o sublinhado.
  const y = await abrirApp(amb);
  const q = y.pagina;
  await q.getByRole('option', { name: /^Editor revisto,/ }).dblclick();
  await q.getByRole('treeitem', { name: /Introdução/ }).click();
  await expect(q.getByRole('textbox', { name: /Texto da seção 1/ }).locator('u')).toHaveText(' fim');
  await expect(q.getByRole('separator', { name: 'Largura do painel da estrutura' })).toHaveAttribute('aria-valuenow', '280');
  const destino = join(amb.raiz, 'sublinhado.docx');
  await y.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await q.keyboard.press('Control+E');
  const dialogo = q.getByRole('dialog', { name: 'Exportar DOCX' });
  await dialogo.getByRole('button', { name: 'Exportar…' }).click();
  await expect(dialogo.getByRole('status')).toHaveText(/foi exportado/, { timeout: 60_000 });
  const doc = strFromU8(unzipSync(new Uint8Array(readFileSync(destino)))['word/document.xml']!);
  expect(doc).toMatch(/<w:u w:val="single"\/>[\s\S]*?<w:t[^>]*> fim<\/w:t>/);
  await y.fechar();
});
