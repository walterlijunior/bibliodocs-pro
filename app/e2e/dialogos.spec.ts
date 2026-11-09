/**
 * E6-T04 (R-M1-10): os caminhos que passam por diálogo nativo, no Electron real. O diálogo do sistema é trocado no
 * processo principal pela resposta do teste (como em `exportacao.spec.ts`); a Lixeira é trocada por uma pasta do
 * ambiente, para o teste não deixar arquivos na Lixeira do usuário. O que se confere é o caminho do app até o diálogo e
 * o que ele faz com a resposta: Salvar como, Abrir, Excluir (cancelar e confirmar) e exportar o relatório de conformidade.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('E6-T04: Salvar como, Abrir, Excluir com confirmação e Lixeira, e relatório de conformidade', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Trabalho dos diálogos');
  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/Salvo/u, { timeout: 15_000 });

  // Salvar como: o arquivo novo é gravado onde o diálogo respondeu.
  const outra = join(amb.raiz, 'outra');
  mkdirSync(outra);
  const copia = join(outra, 'Cópia dos diálogos.bdp');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, copia);
  await p.keyboard.press('Control+Shift+S');
  await expect.poll(() => existsSync(copia), { timeout: 15_000 }).toBe(true);

  // Relatório de conformidade: o .txt é gravado onde o diálogo respondeu, com o resultado.
  const relatorio = join(amb.raiz, 'relatorio.txt');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, relatorio);
  await p.getByRole('button', { name: 'Verificar conformidade' }).click();
  const conf = p.getByRole('dialog', { name: 'Verificar conformidade' });
  await conf.getByRole('button', { name: 'Exportar relatório…' }).click();
  await expect(conf.getByRole('status').filter({ hasText: 'foi exportado' })).toHaveText('“relatorio.txt” foi exportado.');
  const texto = readFileSync(relatorio, 'utf8');
  expect(texto).toContain('Trabalho: Trabalho dos diálogos');
  expect(texto).toMatch(/^Resultado: \d+ erro\(s\), \d+ aviso\(s\)\.$/mu);
  await conf.getByRole('button', { name: 'Fechar' }).click();

  // Abrir: o diálogo responde com a cópia, e ela é a que fica aberta.
  await p.keyboard.press('Control+W');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [caminho] })) as typeof dialog.showOpenDialog;
  }, copia);
  await p.keyboard.press('Control+O');
  await expect(p.getByLabel('Título do trabalho')).toHaveValue('Trabalho dos diálogos', { timeout: 15_000 });
  await p.keyboard.press('Control+W');

  // Excluir: cancelar a confirmação não mexe no arquivo; confirmar manda para a "Lixeira" (pasta do ambiente).
  const lixeira = join(amb.raiz, 'lixeira');
  mkdirSync(lixeira);
  await x.app.evaluate(({ dialog, shell }, pasta) => {
    const g = globalThis as unknown as { __lixeira: string[] };
    g.__lixeira = [];
    dialog.showMessageBox = (async () => ({ response: 1, checkboxChecked: false })) as typeof dialog.showMessageBox;
    // `fs` do processo principal (sem `require` no contexto do evaluate): o teste não deixa nada na Lixeira do usuário.
    const nodeProc = process as unknown as { getBuiltinModule(nome: string): unknown };
    const fs = nodeProc.getBuiltinModule('node:fs') as typeof import('node:fs');
    const path = nodeProc.getBuiltinModule('node:path') as typeof import('node:path');
    shell.trashItem = (async (caminho: string) => {
      g.__lixeira.push(caminho);
      fs.renameSync(caminho, path.join(pasta, path.basename(caminho)));
    }) as typeof shell.trashItem;
  }, lixeira);
  const nomes = arquivosBdp(amb);
  expect(nomes.length).toBe(1);
  const cartao = p.getByRole('option', { name: /^Trabalho dos diálogos,/u });
  await cartao.click();
  await p.getByRole('button', { name: 'Excluir…' }).click();
  await expect(cartao).toBeVisible();
  expect(arquivosBdp(amb)).toEqual(nomes);

  await x.app.evaluate(({ dialog }) => {
    dialog.showMessageBox = (async () => ({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox;
  });
  await p.getByRole('button', { name: 'Excluir…' }).click();
  await expect(cartao).toHaveCount(0, { timeout: 15_000 });
  expect(arquivosBdp(amb)).toEqual([]);
  // O `.bak` com o texto anterior vai junto (R-M1-02).
  const esperados = [nomes[0]!, `${nomes[0]!}.bak`];
  expect(readdirSync(lixeira).sort()).toEqual(esperados);
  expect((await x.app.evaluate(() => (globalThis as unknown as { __lixeira: string[] }).__lixeira.map((c) => c.split(/[\\/]/u).pop()))).sort()).toEqual(esperados);
  expect(basename(copia)).toBe('Cópia dos diálogos.bdp');
  await x.fechar();
});
