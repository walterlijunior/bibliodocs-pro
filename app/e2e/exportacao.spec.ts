/**
 * RF-06 (M3-T08): do menu ao arquivo, no Electron real, pelo processo utilitário. O diálogo nativo de salvar é trocado no
 * principal; o resto é o caminho de verdade. Depois abre o XML gravado.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('Ctrl+E exporta o trabalho aberto, com a fonte escolhida e os avisos', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Trabalho exportado');
  await expect(p.locator('.visor [role="status"]')).toBeVisible();

  const destino = join(amb.raiz, 'saida.docx');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);

  await p.keyboard.press('Control+E');
  const dialogo = p.getByRole('dialog', { name: 'Exportar DOCX' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('radio', { name: 'Arial' }).check();
  await dialogo.getByRole('button', { name: 'Exportar…' }).click();
  await expect(dialogo.getByRole('status')).toHaveText(/“saida\.docx” foi exportado/, { timeout: 60_000 });
  await expect(dialogo.getByRole('list', { name: 'Avisos da exportação' })).toContainText('brasão');

  expect(existsSync(destino)).toBe(true);
  const z = unzipSync(new Uint8Array(readFileSync(destino)));
  const doc = strFromU8(z['word/document.xml']!);
  expect(doc).toContain('Trabalho exportado');
  expect(strFromU8(z['word/styles.xml']!)).toContain('w:ascii="Arial"');
  expect(doc).toContain('RESUMO');

  await dialogo.getByRole('button', { name: 'Fechar' }).click();
  await expect(dialogo).toBeHidden();
  expect(x.problemas).toEqual([]);
});

test('sem trabalho aberto, Exportar DOCX fica desativado; cancelar o diálogo nativo não grava', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await p.getByRole('menuitem', { name: 'Exportar' }).click();
  await expect(p.getByRole('menuitem', { name: 'Exportar DOCX…' })).toBeDisabled();
  await p.keyboard.press('Escape');

  await criarTrabalho(p);
  await x.app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = (async () => ({ canceled: true, filePath: '' })) as typeof dialog.showSaveDialog;
  });
  await p.keyboard.press('Control+E');
  const dialogo = p.getByRole('dialog', { name: 'Exportar DOCX' });
  await dialogo.getByRole('button', { name: 'Exportar…' }).click();
  await expect(dialogo.getByRole('button', { name: 'Exportar…' })).toBeEnabled();
  await expect(dialogo.getByRole('alert')).toHaveCount(0);
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
});
