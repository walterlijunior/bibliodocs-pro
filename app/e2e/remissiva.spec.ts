/**
 * FUN-18 (M5-T08; RF-11, aceite): remissiva no editor. O botão "Remissiva" abre a janela com os elementos do trabalho; a
 * remissiva mostra o número atual e muda com a renumeração; o elemento citado que perde o número deixa a remissiva
 * quebrada, com aviso de remissiva quebrada (aceite do RF-11); Ctrl+Z traz o número e tira o aviso; o `.bdp` guarda só a
 * ligação com o alvo.
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

test('FUN-18: remissiva acompanha a numeração e avisa ao quebrar', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  const barra = p.getByRole('toolbar', { name: 'Formatação do texto' });

  // Duas equações numeradas, (1) e (2), e um parágrafo depois.
  await editor.locator('h2').click();
  await expect(editor).toBeFocused();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('a = b');
  await p.keyboard.press('Alt+=');
  await p.keyboard.press('Enter');
  await p.keyboard.type('x = y');
  await p.keyboard.press('Alt+=');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Ver a equação ');
  const equacoes = editor.locator('.bd-equacao');
  await expect(equacoes).toHaveCount(2);

  await barra.getByRole('button', { name: 'Remissiva' }).click();
  const janela = p.getByRole('dialog', { name: 'Inserir remissiva' });
  // Desde o M6 a janela lista também as seções (alvos de remissiva, D-M6-08); as duas equações estão lá.
  await expect(janela.getByRole('radio', { name: /^Equação/ })).toHaveCount(2);
  await expect(janela.getByRole('radio', { name: '1 Introdução' })).toBeVisible();
  await janela.getByRole('radio', { name: 'Equação (2) – x = y' }).check();
  await janela.getByRole('button', { name: 'Inserir remissiva' }).click();
  await expect(janela).toBeHidden();
  const remissiva = editor.locator('.bd-remissiva');
  await expect(remissiva).toHaveText('(2)');
  await expect(remissiva).toHaveAttribute('aria-label', 'Remissiva: (2)');
  await expect(editor).toBeFocused();

  // A primeira equação perde o número: a citada passa a ser (1), também na remissiva.
  const numerar = barra.getByRole('button', { name: 'Numerar (n)' });
  await equacoes.nth(0).click();
  await numerar.click();
  await expect(remissiva).toHaveText('(1)');

  // A citada perde o número: remissiva quebrada, com o aviso do aceite do RF-11.
  await equacoes.nth(1).click();
  await numerar.click();
  await expect(remissiva).toHaveText('[remissiva quebrada]');
  const avisos = p.getByRole('list', { name: 'Avisos do trabalho' });
  await expect(avisos).toContainText('Equação (1) sem número: 1 remissiva ficou quebrada. Ctrl+Z desfaz.');

  await p.keyboard.press('Control+Z');
  await expect(remissiva).toHaveText('(1)');
  await expect(avisos).toBeHidden();

  // Duplo clique na remissiva: a janela de alterar, com o alvo atual marcado.
  await remissiva.dblclick();
  const alterar = p.getByRole('dialog', { name: 'Alterar remissiva' });
  await expect(alterar.getByRole('radio', { name: 'Equação (1) – x = y' })).toBeChecked();
  await alterar.getByRole('button', { name: 'Cancelar' }).click();
  await expect(alterar).toBeHidden();

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const blocos = doc.corpo[0]!.blocos;
  const alvo = blocos.filter((b) => b.tipo === 'equacao')[1]!.id;
  const par = blocos.find((b) => b.tipo === 'paragrafo' && b.conteudo.some((i) => i.tipo === 'remissiva'));
  expect(par?.tipo === 'paragrafo' && par.conteudo.find((i) => i.tipo === 'remissiva')).toMatchObject({ tipo: 'remissiva', alvo });
});
