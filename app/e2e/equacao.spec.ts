/**
 * FUN-17 (M5-T07; RN-105, RN-106, D-M5-14): equação no editor. Alt+= faz do parágrafo uma equação numerada, com
 * sobrescrito pelo atalho; "Numerar (n)" tira e põe o número; Enter no fim volta ao texto; o botão desliga e Ctrl+Z desfaz; o `.bdp`
 * guarda a equação com as marcas e a numeração.
 */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { BlocoEquacao, Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('FUN-17: equação numerada com expoente, número desligado e religado, Enter no fim e salvar', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  const barra = p.getByRole('toolbar', { name: 'Formatação do texto' });
  const botaoEquacao = barra.getByRole('button', { name: 'Equação', exact: true });

  // Parágrafo novo depois do título.
  await editor.locator('h2').click();
  await expect(editor).toBeFocused();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('E = mc');
  await p.keyboard.press('Alt+=');
  const equacoes = editor.locator('.bd-equacao');
  await expect(equacoes).toHaveCount(1);
  await expect(equacoes.first()).toHaveAttribute('data-numerada', 'sim');
  await expect(botaoEquacao).toHaveAttribute('aria-pressed', 'true');

  await p.keyboard.press('Control+Shift+=');
  await p.keyboard.type('2');
  await expect(equacoes.first().locator('sup')).toHaveText('2');

  const numerar = barra.getByRole('button', { name: 'Numerar (n)' });
  await expect(numerar).toHaveAttribute('aria-pressed', 'true');
  await numerar.click();
  await expect(equacoes.first()).toHaveAttribute('data-numerada', 'nao');
  await numerar.click();
  await expect(equacoes.first()).toHaveAttribute('data-numerada', 'sim');

  // Enter no fim: parágrafo de texto depois da equação; o botão "Numerar" some fora dela.
  await p.keyboard.press('Control+Shift+=');
  await p.keyboard.press('End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Depois.');
  await expect(editor.locator('p.bd-paragrafo', { hasText: 'Depois.' })).toHaveCount(1);
  await expect(numerar).toHaveCount(0);
  await expect(botaoEquacao).toHaveAttribute('aria-pressed', 'false');

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const eqs = doc.corpo[0]!.blocos.filter((b): b is BlocoEquacao => b.tipo === 'equacao');
  expect(eqs).toHaveLength(1);
  expect(eqs[0]!.numerada).toBe(true);
  expect(eqs[0]!.conteudo).toEqual([
    { tipo: 'texto', texto: 'E = mc' },
    { tipo: 'texto', texto: '2', marcas: ['sobrescrito'] },
  ]);

  // O botão desliga a equação (volta a parágrafo, com o texto) e Ctrl+Z a traz de volta.
  await equacoes.first().click();
  await botaoEquacao.click();
  await expect(equacoes).toHaveCount(0);
  await expect(editor.locator('p.bd-paragrafo', { hasText: 'E = mc2' })).toHaveCount(1);
  await p.keyboard.press('Control+Z');
  await expect(equacoes).toHaveCount(1);
  await expect(equacoes.first()).toHaveAttribute('data-numerada', 'sim');
});
