/**
 * FUN-14 (M4-T08, aceite do M4: verificador de órfãs e não citadas): a conferência da bibliografia acha a chamada
 * escrita como texto e a obra não citada; "Ir ao texto" seleciona o trecho no editor; "Abrir obra" abre o formulário.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

async function cadastrar(p: Page, sobrenome: string, titulo: string, ano: string): Promise<void> {
  await p.getByRole('navigation', { name: 'Bibliografia' }).getByRole('button', { name: 'Nova obra' }).click();
  const f = p.getByRole('form', { name: 'Nova obra' });
  await f.getByRole('button', { name: 'Acrescentar autoria' }).click();
  await f.getByLabel('Sobrenome').fill(sobrenome);
  await f.getByLabel('Título', { exact: true }).fill(titulo);
  await f.getByLabel('Ano', { exact: true }).fill(ano);
  await f.getByRole('button', { name: 'Incluir obra' }).click();
}

test('FUN-14: conferência com uma órfã e uma não citada, ir ao texto e abrir a obra', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await cadastrar(p, 'Lima', 'Alfa', '2020');
  await cadastrar(p, 'Souza', 'Beta', '2019');

  // Texto: uma citação ligada a Lima e uma chamada escrita à mão.
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  await editor.locator('h2').click();
  await expect(editor).toBeFocused();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Segundo ');
  await p.keyboard.press('Control+Shift+C');
  await p.getByRole('dialog', { name: 'Inserir citação' }).getByRole('button', { name: 'Inserir citação' }).click();
  await expect(editor).toBeFocused();
  await p.keyboard.type(', e também (COSTA, 2001, p. 4).');

  const bibliografia = p.getByRole('navigation', { name: 'Bibliografia' });
  await bibliografia.getByRole('button', { name: 'Conferir citações e referências' }).click();
  const painel = p.getByRole('region', { name: 'Conferência da bibliografia' });
  await expect(painel.getByRole('status')).toHaveText('2 avisos na bibliografia.');
  const itens = painel.getByRole('list', { name: 'Problemas da bibliografia' }).getByRole('listitem');
  await expect(itens).toHaveCount(2);
  await expect(itens.nth(0)).toContainText('Chamada escrita como texto');
  await expect(itens.nth(0)).toContainText('"(COSTA, 2001, p. 4)" parece uma chamada escrita como texto');
  await expect(itens.nth(1)).toContainText('Obra não citada');
  await expect(itens.nth(1)).toContainText('SOUZA');

  // Ir ao texto: o editor volta com o trecho selecionado.
  await itens.nth(0).getByRole('button', { name: 'Ir ao texto' }).click();
  await expect(painel).toBeHidden();
  await expect(editor).toBeFocused();
  await expect.poll(() => p.evaluate(() => window.getSelection()?.toString())).toBe('(COSTA, 2001, p. 4)');

  // Abrir obra: o formulário da obra não citada.
  await bibliografia.getByRole('button', { name: 'Conferir citações e referências' }).click();
  await painel.getByRole('listitem').nth(1).getByRole('button', { name: 'Abrir obra' }).click();
  await expect(p.getByRole('form', { name: 'Obra da bibliografia' }).getByLabel('Sobrenome')).toHaveValue('Souza');

  await x.fechar();
  expect(x.problemas).toEqual([]);
});
