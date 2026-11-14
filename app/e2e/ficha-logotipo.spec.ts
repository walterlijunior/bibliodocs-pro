/**
 * Aceite da Etapa 3 da especificação de atualização (ficha catalográfica e logotipo):
 * - o trabalho é salvo e exportado com a página da ficha reservada; quando a ficha fica pronta, o texto entra por
 *   arquivo, sem recriar o trabalho, e sai na caixa da ficha no DOCX;
 * - o logotipo cadastrado no catálogo vai para a capa (RN-118) ao escolher a instituição, e o aviso de brasão some.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import type { ElectronApplication } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

// PNG de 1 × 1 pixel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const FICHA = 'S586a  Silva, Maria da.\n   Estudo de caso. / Maria da Silva. – Palmas, TO, 2026.\n   80 f.';

const elemento = (p: Page, nome: RegExp) => p.getByRole('navigation', { name: 'Elementos pré-textuais' }).getByRole('button', { name: nome });

async function exportar(app: ElectronApplication, p: Page, nome: string) {
  const destino = join(amb.raiz, nome);
  await app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await p.keyboard.press('Control+E');
  const d = p.getByRole('dialog', { name: 'Exportar DOCX' });
  await d.getByRole('button', { name: 'Exportar…' }).click();
  await expect(d.getByRole('status')).toHaveText(/foi exportado/, { timeout: 60_000 });
  const avisos = await d.getByRole('list', { name: 'Avisos da exportação' }).innerText();
  await d.getByRole('button', { name: 'Fechar' }).click();
  return { avisos, z: unzipSync(new Uint8Array(readFileSync(destino))) };
}

test('Etapa 3: página da ficha reservada; a ficha chega depois por arquivo, sem recriar o trabalho', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Com ficha depois');
  await p.keyboard.press('Control+S');

  const antes = await exportar(x.app, p, 'antes.docx');
  expect(antes.avisos).toContain('Ficha catalográfica sem texto: a página foi reservada');

  await elemento(p, /^Ficha catalográfica/).click();
  await p.locator('.importar-ficha input[type="file"]').setInputFiles({ name: 'ficha.txt', mimeType: 'text/plain', buffer: Buffer.from(FICHA.replace(/\n/g, '\r\n'), 'utf8') });
  await expect(p.getByLabel('Texto da ficha')).toHaveValue(FICHA);
  await expect(p.getByText('Texto da ficha importado de “ficha.txt”.')).toBeVisible();
  // Arquivo de novo, com texto no campo: pede confirmação e mantém o atual se a autora preferir.
  await p.locator('.importar-ficha input[type="file"]').setInputFiles({ name: 'outra.txt', mimeType: 'text/plain', buffer: Buffer.from('Outra ficha') });
  await p.getByRole('button', { name: 'Manter o texto atual' }).click();
  await expect(p.getByLabel('Texto da ficha')).toHaveValue(FICHA);
  await p.keyboard.press('Control+S');

  const depois = await exportar(x.app, p, 'depois.docx');
  expect(depois.avisos).not.toContain('Ficha catalográfica sem texto');
  expect(strFromU8(depois.z['word/document.xml']!)).toContain('Estudo de caso. / Maria da Silva.');
  expect(x.problemas).toEqual([]);
  await x.fechar();
});

test('Etapa 3: logotipo do catálogo vai para a capa (RN-118) ao escolher a instituição', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await elemento(p, /^Capa/).click();
  await p.getByRole('button', { name: 'Catálogo acadêmico…' }).click();
  const cat = p.getByRole('dialog', { name: 'Catálogo acadêmico' });
  await cat.getByLabel('Instituição', { exact: true }).selectOption({ label: 'Universidade Federal do Tocantins (UFT)' });
  await cat.locator('.catalogo__logotipo input[type="file"]').setInputFiles({ name: 'brasao.png', mimeType: 'image/png', buffer: PNG });
  await expect(cat.getByRole('img', { name: 'Logotipo de UFT' })).toBeVisible();
  await cat.getByRole('button', { name: 'Guardar' }).click();
  await expect(cat).toHaveCount(0);

  await p.getByLabel('Instituição do catálogo').selectOption({ label: 'Universidade Federal do Tocantins (UFT)' });
  await p.keyboard.press('Control+S');
  const r = await exportar(x.app, p, 'com-brasao.docx');
  expect(r.avisos).not.toContain('sem o brasão');
  expect(Object.keys(r.z).some((n) => n.startsWith('word/media/'))).toBe(true);
  expect(strFromU8(r.z['word/document.xml']!)).toContain('descr="Brasão: Universidade Federal do Tocantins"');
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
