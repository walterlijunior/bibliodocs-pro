/**
 * Aceite de "Ajustar tamanho e posição" (Etapa 4 da especificação revista; opção 1 do usuário, D-E4-05): na prévia da
 * página, a figura muda de largura pelas alças (teclado e mouse) e pelos tamanhos prontos, continua centralizada, e só
 * "Aplicar" muda a janela da figura; as posições fora da norma ficam desativadas. A largura escolhida vai para o arquivo
 * e para o DOCX. Tabela: só a prévia.
 */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import type { BlocoIlustracao, Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, RAIZ_APP, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('Etapa 4 revista: ajustar a largura da figura na prévia da página e conferir no DOCX', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const barra = p.getByRole('toolbar', { name: 'Formatação do texto' });
  await barra.getByRole('button', { name: 'Figura', exact: true }).click();
  const janela = p.getByRole('dialog', { name: 'Inserir figura' });
  await janela.getByLabel('Arquivo de imagem').setInputFiles(join(RAIZ_APP, 'tests', 'fixtures', 'figuras', 'pequena-300x200.png'));
  await janela.getByLabel('Título', { exact: true }).fill('Figura ajustada');
  await janela.getByLabel('Fonte', { exact: true }).fill('O autor (2026).');

  // Cancelar não muda nada.
  await janela.getByRole('button', { name: 'Ajustar tamanho e posição…' }).click();
  const ajuste = p.getByRole('dialog', { name: 'Ajustar tamanho e posição' });
  const alca = ajuste.getByRole('slider', { name: 'Largura da figura' });
  await expect(alca).toHaveAttribute('aria-valuenow', '79');
  await alca.focus();
  await p.keyboard.press('Shift+ArrowRight');
  await expect(alca).toHaveAttribute('aria-valuenow', '89');
  await ajuste.getByRole('button', { name: 'Cancelar' }).click();
  await expect(ajuste).toBeHidden();
  await expect(janela.getByLabel('Largura (mm)')).toHaveValue('');

  // Posições fora da norma desativadas; a figura fica centralizada ao mudar de tamanho.
  await janela.getByRole('button', { name: 'Ajustar tamanho e posição…' }).click();
  await expect(ajuste.getByRole('radio', { name: 'Centralizada, no fluxo do texto' })).toBeChecked();
  for (const r of ['Superior esquerda', 'Superior direita', 'Com o texto ao redor']) await expect(ajuste.getByRole('radio', { name: r })).toBeDisabled();
  await expect(ajuste).toContainText('RN-059');
  const centro = async () => {
    const pag = (await ajuste.locator('.ajuste__area').boundingBox())!;
    const el = (await ajuste.locator('.ajuste__elemento').boundingBox())!;
    return Math.abs(el.x + el.width / 2 - (pag.x + pag.width / 2));
  };
  await ajuste.getByRole('button', { name: 'Metade' }).click();
  await expect(alca).toHaveAttribute('aria-valuenow', '80');
  expect(await centro()).toBeLessThan(1.5);
  // Arrastar a alça direita para a direita aumenta dos dois lados.
  const caixa = (await alca.boundingBox())!;
  await p.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await p.mouse.down();
  await p.mouse.move(caixa.x + caixa.width / 2 + 20, caixa.y + caixa.height / 2, { steps: 4 });
  await p.mouse.up();
  const arrastada = Number(await alca.getAttribute('aria-valuenow'));
  expect(arrastada).toBeGreaterThan(90);
  expect(await centro()).toBeLessThan(1.5);
  await ajuste.getByRole('button', { name: 'Largura do texto' }).click();
  await expect(alca).toHaveAttribute('aria-valuenow', '160');
  await ajuste.getByLabel('Largura (mm)').fill('120');
  await ajuste.getByRole('button', { name: 'Aplicar' }).click();
  await expect(ajuste).toBeHidden();
  await expect(janela.getByLabel('Largura (mm)')).toHaveValue('120');
  await janela.getByRole('button', { name: 'Inserir figura' }).click();
  await expect(janela).toBeHidden();

  // Tabela: só a prévia, sem controle de largura.
  await p.getByRole('textbox', { name: 'Texto da seção 1' }).locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await barra.getByRole('button', { name: 'Tabela', exact: true }).click();
  const tabela = p.getByRole('dialog', { name: /^Inserir tabela/ });
  await tabela.getByRole('button', { name: 'Ajustar tamanho e posição…' }).click();
  await expect(ajuste).toContainText('A tabela ocupa a largura do texto');
  await expect(ajuste.getByRole('slider')).toHaveCount(0);
  await ajuste.getByRole('button', { name: 'Cancelar' }).click();
  await tabela.getByRole('button', { name: 'Cancelar' }).click();

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const fig = doc.corpo[0]!.blocos.find((b): b is BlocoIlustracao => b.tipo === 'ilustracao')!;
  expect(fig.larguraMm).toBe(120);

  // No DOCX: 120 mm = 4.320.000 EMU (36.000 EMU por mm), a menos do arredondamento por pixel da biblioteca.
  const destino = join(amb.raiz, 'ajuste.docx');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await p.keyboard.press('Control+E');
  const exportar = p.getByRole('dialog', { name: 'Exportar DOCX' });
  await exportar.getByRole('button', { name: 'Exportar…' }).click();
  await expect(exportar.getByRole('status')).toHaveText(/foi exportado/, { timeout: 60_000 });
  const xml = strFromU8(unzipSync(new Uint8Array(readFileSync(destino)))['word/document.xml']!);
  const cx = Number(/<wp:extent cx="(\d+)"/.exec(xml)?.[1]);
  expect(Math.abs(cx / 36_000 - 120)).toBeLessThan(0.1);
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
