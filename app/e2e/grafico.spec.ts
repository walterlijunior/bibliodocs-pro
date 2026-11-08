/**
 * FUN-19 (M5-T09; RF-10, aceite: o gráfico acompanha a tabela): tabela vinda de CSV, gráfico gerado dela pela janela
 * (séries numéricas marcadas, a coluna de datas desativada), desenho no texto; mudar um número da tabela redesenha o
 * gráfico; a exportação leva o PNG desenhado no canvas, a 300 ppi, com o título "Gráfico 1 – …".
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { abrirApp, criarAmbiente, criarTrabalho, RAIZ_APP, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('FUN-19: gráfico gerado da tabela acompanha a tabela e sai no DOCX', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  const barra = p.getByRole('toolbar', { name: 'Formatação do texto' });

  await barra.getByRole('button', { name: 'Tabela', exact: true }).click();
  const tabela = p.getByRole('dialog', { name: 'Inserir tabela ou quadro' });
  await tabela.getByLabel('Título', { exact: true }).fill('Municípios fictícios');
  await tabela.getByLabel('Arquivo CSV').setInputFiles(join(RAIZ_APP, 'tests', 'fixtures', 'planilha', 'municipios.csv'));
  await tabela.getByRole('region', { name: 'Prévia dos dados da planilha' }).getByRole('button', { name: 'Usar estes dados' }).click();
  await tabela.getByRole('button', { name: 'Inserir tabela' }).click();
  await expect(tabela).toBeHidden();

  await barra.getByRole('button', { name: 'Gráfico', exact: true }).click();
  const janela = p.getByRole('dialog', { name: 'Inserir gráfico' });
  await expect(janela.getByLabel('Tabela de origem')).toHaveValue(/.+/);
  await expect(janela.getByLabel('Tabela de origem').locator('option:checked')).toHaveText('Tabela 1 – Municípios fictícios');
  await expect(janela.getByRole('checkbox', { name: 'População' })).toBeChecked();
  await expect(janela.getByRole('checkbox', { name: 'Área' })).toBeChecked();
  await expect(janela.getByRole('checkbox', { name: 'Atualização' })).toBeDisabled();
  const inserir = janela.getByRole('button', { name: 'Inserir gráfico' });
  await expect(janela.getByRole('list', { name: 'O que impede gravar o gráfico' })).toContainText('Título');
  await janela.getByRole('checkbox', { name: 'Área' }).uncheck();
  await janela.getByLabel('Título', { exact: true }).fill('População dos municípios');
  await janela.getByLabel('Fonte', { exact: true }).fill('IBGE (2024).');
  await inserir.click();
  await expect(janela).toBeHidden();

  const desenho = editor.locator('.bd-grafico canvas');
  await expect(desenho).toHaveCount(1);
  const assinatura = () => desenho.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  // Desenhou algo além do fundo branco.
  const escuros = await desenho.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! < 128) n++;
    return n;
  });
  expect(escuros).toBeGreaterThan(500);
  const antes = await assinatura();

  // Aceite do RF-10: outro número na tabela, outro desenho.
  await editor.locator('.bd-tabela').dblclick();
  const alterar = p.getByRole('dialog', { name: 'Alterar tabela' });
  await alterar.getByLabel('Linha 2, coluna 2', { exact: true }).fill('900.000');
  await alterar.getByRole('button', { name: 'Alterar tabela' }).click();
  await expect(alterar).toBeHidden();
  await expect.poll(assinatura).not.toBe(antes);

  // Exportação: o PNG do canvas vai para o DOCX.
  const destino = join(amb.raiz, 'grafico.docx');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await p.keyboard.press('Control+E');
  const exportar = p.getByRole('dialog', { name: 'Exportar DOCX' });
  await exportar.getByRole('button', { name: 'Exportar…' }).click();
  await expect(exportar.getByRole('status')).toHaveText(/“grafico\.docx” foi exportado/, { timeout: 60_000 });
  await expect(exportar.getByRole('list', { name: 'Avisos da exportação' })).not.toContainText('Um gráfico não pôde ser desenhado');
  expect(existsSync(destino)).toBe(true);
  const z = unzipSync(new Uint8Array(readFileSync(destino)));
  expect(strFromU8(z['word/document.xml']!).replace(/<[^>]+>/g, '')).toContain('Gráfico 1 – População dos municípios');
  const pngs = Object.keys(z).filter((n) => n.startsWith('word/media/') && n.endsWith('.png'));
  expect(pngs).toHaveLength(1);
  // 150 mm a 300 ppi: 1772 px de largura (cabeçalho IHDR).
  const png = z[pngs[0]!]!;
  expect(new DataView(png.buffer, png.byteOffset).getUint32(16)).toBe(1772);
  await exportar.getByRole('button', { name: 'Fechar' }).click();
  expect(x.problemas).toEqual([]);
});
