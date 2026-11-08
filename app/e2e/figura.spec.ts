/**
 * FUN-16 (RF-10, M5-T06): figura no editor. O botão "Figura" abre a janela; sem imagem e sem título nada é gravado; a
 * imagem de baixa resolução no tamanho impresso gera aviso (aceite do RF-10), que some ao reduzir a largura; a figura
 * aparece no texto com a imagem; Ctrl+Z e Ctrl+Y; a mesma imagem em duas figuras é uma mídia só no `.bdp`.
 */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import type { BlocoIlustracao, Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, RAIZ_APP, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const FIGURAS = join(RAIZ_APP, 'tests', 'fixtures', 'figuras');

test('FUN-16: inserir figura com aviso de resolução, desfazer, repetir a imagem e salvar uma mídia só', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  const barra = p.getByRole('toolbar', { name: 'Formatação do texto' });
  await barra.getByRole('button', { name: 'Figura', exact: true }).click();

  const janela = p.getByRole('dialog', { name: 'Inserir figura' });
  const inserir = janela.getByRole('button', { name: 'Inserir figura' });
  await expect(inserir).toBeDisabled();
  const faltas = janela.getByRole('list', { name: 'O que impede gravar a figura' });
  await expect(faltas).toContainText('Imagem');
  await expect(faltas).toContainText('Título');

  // 300 × 200 px sem resolução no arquivo: natural de 79 mm a 96 ppi, abaixo do mínimo (aceite do RF-10).
  await janela.getByLabel('Arquivo de imagem').setInputFiles(join(FIGURAS, 'pequena-300x200.png'));
  await expect(janela.getByRole('status')).toHaveText('300 × 200 px. Sai com 79 mm de largura, a 96 ppi.');
  await expect(janela.getByText(/^Resolução baixa: a imagem fica com 96 ppi/)).toBeVisible();
  await janela.getByLabel('Largura (mm)').fill('40');
  await expect(janela.getByRole('status')).toHaveText('300 × 200 px. Sai com 40 mm de largura, a 190 ppi.');
  await expect(janela.getByText(/^Resolução baixa/)).toHaveCount(0);

  await janela.getByLabel('Espécie').selectOption('fotografia');
  await janela.getByLabel('Título', { exact: true }).fill('Degradê de teste');
  await janela.getByLabel('Fonte', { exact: true }).fill('Elaborada pelo autor (2026).');
  await expect(faltas).toHaveCount(0);
  await inserir.click();
  await expect(janela).toBeHidden();

  const figuras = editor.locator('.bd-figura');
  await expect(figuras).toHaveCount(1);
  await expect(figuras.first()).toHaveAttribute('aria-label', 'Fotografia: Degradê de teste');
  // A imagem carregou (blob: permitido na CSP) e ocupa 40/160 da largura do texto.
  await expect.poll(() => figuras.first().locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(300);
  await expect(figuras.first()).toContainText('Fonte: Elaborada pelo autor (2026).');
  await expect(editor).toBeFocused();

  await p.keyboard.press('Control+Z');
  await expect(figuras).toHaveCount(0);
  await p.keyboard.press('Control+Y');
  await expect(figuras).toHaveCount(1);

  // A mesma imagem numa segunda figura, inserida a partir do título: uma mídia só no arquivo.
  await editor.locator('h2').click();
  await barra.getByRole('button', { name: 'Figura', exact: true }).click();
  const outra = p.getByRole('dialog', { name: 'Inserir figura' });
  await outra.getByLabel('Arquivo de imagem').setInputFiles(join(FIGURAS, 'pequena-300x200.png'));
  await outra.getByLabel('Título', { exact: true }).fill('A mesma imagem');
  await outra.getByLabel('Largura (mm)').fill('30');
  await outra.getByRole('button', { name: 'Inserir figura' }).click();
  await expect(figuras).toHaveCount(2);

  // Duplo clique altera: troca a imagem por uma nítida.
  await figuras.first().locator('img').dblclick();
  const alterar = p.getByRole('dialog', { name: 'Alterar figura' });
  await alterar.getByLabel('Arquivo de imagem').setInputFiles(join(FIGURAS, 'nitida-1200x800-300ppi.png'));
  await expect(alterar.getByRole('status')).toHaveText('1200 × 800 px, 300 ppi no arquivo. Sai com 30 mm de largura, a 1016 ppi.');
  await alterar.getByRole('button', { name: 'Alterar figura' }).click();
  await expect.poll(() => figuras.first().locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1200);
  // E volta à pequena: Ctrl+Z.
  await p.keyboard.press('Control+Z');
  await expect.poll(() => figuras.first().locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(300);

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const arquivo = join(amb.trabalhos, arquivosBdp(amb)[0]!);
  const doc = JSON.parse(lerDocumento(arquivo).json) as Documento;
  const fig = doc.corpo[0]!.blocos.filter((b): b is BlocoIlustracao => b.tipo === 'ilustracao');
  expect(fig.map((f) => [f.especie, f.larguraMm])).toEqual([
    ['figura', 30],
    ['fotografia', 40],
  ]);
  expect(fig[0]!.midia).toBe(fig[1]!.midia);
  // Só a imagem usada, uma vez (a nítida foi desfeita e não vai para o arquivo).
  const midias = Object.keys(unzipSync(readFileSync(arquivo), { filter: (f) => f.name.startsWith('midias/') }));
  expect(midias).toEqual([`midias/${fig[0]!.midia}.png`]);
});
