/** M6-T01: opção da lista de ilustrações percorre a sessão e o arquivo real. */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => { amb = criarAmbiente(); });
test.afterEach(async () => amb.apagar());

test('lista única é salva e preservada ao desfazer a retirada do elemento', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  const nav = p.getByRole('navigation', { name: 'Elementos pré-textuais' });
  const existente = nav.getByRole('button', { name: 'Lista de ilustrações', exact: true });
  if (await existente.count() === 0) {
    await nav.getByLabel('Incluir elemento').selectOption('listaIlustracoes');
    await nav.getByRole('button', { name: 'Incluir', exact: true }).click();
  } else await existente.click();
  const opcao = p.getByRole('checkbox', { name: 'Usar lista única de ilustrações' });
  await expect(opcao).not.toBeChecked();
  await opcao.check();
  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const salvo = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  expect(salvo.preTextuais).toContainEqual(expect.objectContaining({ tipo: 'listaIlustracoes', listaUnica: true }));
  await p.getByRole('button', { name: 'Retirar do trabalho', exact: true }).click();
  await expect(opcao).toHaveCount(0);
  await nav.getByLabel('Incluir elemento').focus();
  await p.keyboard.press('Control+Z');
  await nav.getByRole('button', { name: 'Lista de ilustrações', exact: true }).click();
  await expect(opcao).toBeChecked();
  expect(x.problemas).toEqual([]);
});
