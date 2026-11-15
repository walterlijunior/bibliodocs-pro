/**
 * Etapa 2 da especificação de atualização — títulos pelo painel Seções (D-E2-04) e busca no documento (D-E2-05).
 * Cria uma subseção pelo painel, escreve nela, renomeia pelo painel (F2), confere o número e o título na página, acha o
 * texto pela busca (Ctrl+F, sem acento) e vai até ele; o sumário e o DOCX exportado mostram o título novo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('Etapa 2: subseção criada e renomeada pelo painel, achada pela busca, no sumário e no DOCX', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await p.getByRole('button', { name: 'Nova seção' }).click();
  // A seção nova abre o campo do título no painel; Enter grava e leva ao texto.
  const campo = p.getByRole('textbox', { name: 'Título da seção 2' });
  await expect(campo).toBeFocused();
  await p.keyboard.type('Metodo');
  await p.keyboard.press('Enter');
  await p.getByRole('button', { name: 'Recuar seção' }).click();
  await expect(p.getByRole('treeitem', { name: '1.1 Metodo' })).toBeVisible();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1.1' });
  await editor.locator('p').first().click();
  await p.keyboard.type('A coleta usou questionário e observação.');

  // Renomear pelo painel (F2): a página mostra número e título da estrutura; o título não se edita na página.
  await p.getByRole('treeitem', { name: '1.1 Metodo' }).click();
  await p.keyboard.press('F2');
  await p.getByRole('textbox', { name: 'Título da seção 1.1' }).fill('Metodologia');
  await p.keyboard.press('Enter');
  await expect(p.getByRole('treeitem', { name: '1.1 Metodologia' })).toBeVisible();
  await expect(editor.locator('h2')).toHaveText('Metodologia');
  expect(await editor.locator('h2').evaluate((h) => getComputedStyle(h, '::before').content)).toBe('"1.1 "');

  // Busca (Ctrl+F na aba Escrever), sem acento: vai ao trecho.
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await p.keyboard.press('Control+F');
  const busca = p.getByRole('searchbox', { name: 'Buscar no documento' });
  await expect(busca).toBeFocused();
  await busca.fill('questionario');
  const resultados = p.getByRole('list', { name: 'Resultados da busca' });
  await expect(resultados.getByRole('button')).toHaveCount(1);
  await expect(resultados).toContainText('1.1 Metodologia');
  await resultados.getByRole('button').first().click();
  await expect(p.getByRole('treeitem', { name: '1.1 Metodologia' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => p.evaluate(() => getSelection()?.toString())).toBe('questionário');

  // Exportar: o título novo no corpo e no sumário.
  const destino = join(amb.raiz, 'secoes.docx');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await p.keyboard.press('Control+E');
  const exportar = p.getByRole('dialog', { name: 'Exportar DOCX' });
  await exportar.getByRole('button', { name: 'Exportar…' }).click();
  await expect(exportar.getByRole('status')).toHaveText(/foi exportado/, { timeout: 60_000 });
  const doc = strFromU8(unzipSync(new Uint8Array(readFileSync(destino)))['word/document.xml']!);
  expect(doc.match(/METODOLOGIA|Metodologia/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(doc).not.toMatch(/>Metodo</);
  expect(x.problemas).toEqual([]);
});
