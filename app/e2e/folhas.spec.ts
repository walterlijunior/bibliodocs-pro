/**
 * Etapa 2 da especificação de atualização — folhas no editor (D-E2-07): com vários parágrafos, o texto segue para a
 * folha seguinte (um espaçador só de tela antes do primeiro bloco da folha 2); o arquivo guarda só os parágrafos, e o
 * espaçador acompanha o desfazer e o refazer do texto.
 */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('Etapa 2: o texto segue para a folha seguinte, só na tela', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '2 Desenvolvimento' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 2' });
  await editor.locator('p').first().click();
  const frase = 'Texto corrido para encher a folha e ver o salto para a folha seguinte no editor, com as margens do perfil. '.repeat(3);
  for (let i = 0; i < 9; i++) {
    await p.keyboard.insertText(`Parágrafo ${i + 1}. ${frase}`);
    if (i < 8) await p.keyboard.press('Enter');
  }
  const saltos = editor.locator('.bd-salto-folha');
  await expect(saltos).toHaveCount(1);
  // O parágrafo depois do salto começa na folha 2: abaixo do fim da folha 1 (altura da folha com o zoom).
  const posicoes = await editor.evaluate((ed) => {
    const salto = ed.querySelector<HTMLElement>('.bd-salto-folha')!;
    const depois = salto.nextElementSibling as HTMLElement;
    const zoom = Number.parseFloat(getComputedStyle(ed).getPropertyValue('--zoom-editor')) || 1;
    return { topo: depois.offsetTop, folha: 297 * (96 / 25.4) * zoom };
  });
  expect(posicoes.topo).toBeGreaterThan(posicoes.folha);

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const blocos = doc.corpo[1]!.blocos;
  expect(blocos.map((b) => b.tipo)).toEqual(Array.from({ length: 9 }, () => 'paragrafo'));
  // O desfazer é do texto (o espaçador não entra no histórico): sem o texto do parágrafo 9, tudo cabe numa folha e o
  // salto some; refazer o traz de volta.
  await p.keyboard.press('Control+Z');
  await expect(saltos).toHaveCount(0);
  await p.keyboard.press('Control+Y');
  await expect(saltos).toHaveCount(1);
  expect(x.problemas).toEqual([]);
});
