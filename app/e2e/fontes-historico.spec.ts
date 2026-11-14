/**
 * Etapa 5 da especificação de atualização (aceite): fontes de pesquisa, citações e histórico. Duas obras do mesmo autor;
 * a segunda ganha um PDF do computador (diálogo do sistema simulado) e o aplicativo o abre pelo leitor do sistema
 * (simulado). No texto, duas citações da mesma obra (uma delas escrita à mão, "Silva (2007)", e ligada depois) e uma da
 * outra obra. Apagar uma das duas mantém a obra na lista; apagar a segunda a tira; a obra continua cadastrada. O
 * histórico do trabalho devolve o trecho, a ligação e a referência.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

async function cadastrarObra(p: Page, titulo: string, ano: string): Promise<void> {
  await p.getByRole('navigation', { name: 'Bibliografia' }).getByRole('button', { name: 'Nova obra' }).click();
  const f = p.getByRole('form', { name: 'Nova obra' });
  await f.getByRole('button', { name: 'Acrescentar autoria' }).click();
  await f.getByLabel('Sobrenome').fill('Silva');
  await f.getByLabel('Prenomes').fill('João');
  await f.getByLabel('Título', { exact: true }).fill(titulo);
  await f.getByLabel('Local de publicação').fill('Palmas');
  await f.getByLabel('Editora').fill('EDUFT');
  await f.getByLabel('Ano', { exact: true }).fill(ano);
  await f.getByRole('button', { name: 'Incluir obra' }).click();
  await expect(p.getByRole('form', { name: 'Obra da bibliografia' })).toBeVisible();
}

/** Abre a obra na lista e devolve o texto da contagem de citações. */
async function contagemDaObra(p: Page, ano: string) {
  await p.getByRole('navigation', { name: 'Bibliografia' }).getByRole('button', { name: new RegExp(`^SILVA.*${ano}\\.$`) }).click();
  return p.getByRole('form', { name: 'Obra da bibliografia' }).getByRole('region', { name: 'Link e PDF da obra' });
}

async function escolherObra(p: Page, nome: string, ano: string): Promise<void> {
  const janela = p.getByRole('dialog', { name: nome });
  const obra = janela.getByLabel('Obra', { exact: true });
  const valor = await obra.locator('option', { hasText: ano }).getAttribute('value');
  await obra.selectOption(valor!);
}

test('Etapa 5: PDF e link na obra, citação escrita ligada, referência pelos vínculos e histórico', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await cadastrarObra(p, 'Obra A', '2007');
  await cadastrarObra(p, 'Obra B', '2010');

  // PDF da obra B: o diálogo do sistema e o leitor de PDF são simulados no principal.
  const pdf = join(amb.raiz, 'silva-2010.pdf');
  writeFileSync(pdf, '%PDF-1.4\n%%EOF\n');
  await x.app.evaluate(({ dialog, shell }, caminho) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [caminho] })) as typeof dialog.showOpenDialog;
    (globalThis as { abertos?: string[] }).abertos = [];
    shell.openPath = (async (c: string) => {
      (globalThis as { abertos?: string[] }).abertos!.push(c);
      return '';
    }) as typeof shell.openPath;
  }, pdf);
  let acesso = await contagemDaObra(p, '2010');
  await acesso.getByRole('button', { name: 'Associar PDF…' }).click();
  await expect(acesso).toContainText('PDF: silva-2010.pdf');
  await acesso.getByRole('button', { name: 'Abrir PDF' }).click();
  await expect.poll(() => x.app.evaluate(() => (globalThis as { abertos?: string[] }).abertos)).toEqual([pdf]);
  await expect(acesso).toContainText('Nenhuma citação no texto');

  // Texto: citação da obra A pela janela, "Silva (2007)" escrita à mão e ligada, e citação da obra B.
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  await editor.locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Primeira ');
  await p.keyboard.press('Control+Shift+C');
  await escolherObra(p, 'Inserir citação', '2007');
  await p.getByRole('dialog', { name: 'Inserir citação' }).getByRole('button', { name: 'Inserir citação' }).click();
  await p.keyboard.type('. Segundo Silva (2007)');
  for (let i = 0; i < 'Silva (2007)'.length; i++) await p.keyboard.press('Shift+ArrowLeft');
  await expect.poll(() => p.evaluate(() => getSelection()?.toString())).toBe('Silva (2007)');
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  await p.keyboard.press('Control+Shift+C');
  const ligar = p.getByRole('dialog', { name: 'Ligar citação escrita' });
  await expect(ligar).toContainText('“Silva (2007)” será trocado pela chamada ligada à obra abaixo.');
  await expect(ligar.getByRole('region', { name: 'Como sai no texto' }).locator('p')).toHaveText('Silva (2007)');
  await ligar.getByRole('button', { name: 'Ligar citação' }).click();
  await expect(ligar).toBeHidden();
  await p.keyboard.type(', e outra ');
  await p.keyboard.press('Control+Shift+C');
  await escolherObra(p, 'Inserir citação', '2010');
  await p.getByRole('dialog', { name: 'Inserir citação' }).getByRole('button', { name: 'Inserir citação' }).click();
  const chamadas = editor.locator('.bd-citacao');
  await expect(chamadas).toHaveText(['(SILVA, 2007)', 'Silva (2007)', '(SILVA, 2010)']);
  await expect(editor.locator('p').last()).toHaveText('Primeira (SILVA, 2007). Segundo Silva (2007), e outra (SILVA, 2010)');

  // Apagar uma das duas citações da obra A: ela continua na lista de referências.
  await chamadas.first().click();
  await p.keyboard.press('Delete');
  await expect(chamadas).toHaveCount(2);
  acesso = await contagemDaObra(p, '2007');
  await expect(acesso).toContainText('1 citação no texto: a obra sai na lista de referências.');

  // Apagar a outra: a obra A sai da lista, mas continua cadastrada; a obra B não muda.
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await chamadas.first().click();
  await p.keyboard.press('Delete');
  await expect(chamadas).toHaveText(['(SILVA, 2010)']);
  acesso = await contagemDaObra(p, '2007');
  await expect(acesso).toContainText('Nenhuma citação no texto: a obra fica guardada aqui, mas não sai na lista de referências.');
  acesso = await contagemDaObra(p, '2010');
  await expect(acesso).toContainText('1 citação no texto');

  // Histórico: o estado antes da segunda exclusão volta com o trecho, a ligação e a referência.
  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: 'Histórico do trabalho…' }).click();
  const historico = p.getByRole('dialog', { name: 'Histórico do trabalho' });
  // O mais novo primeiro: antes da segunda exclusão, com as duas obras na lista.
  const ponto = historico.getByRole('radio', { name: /Antes de retirar a citação de SILVA, 2007/ }).first();
  await expect(ponto).toHaveAccessibleName(/2 citações, 2 referências na lista/);
  await ponto.check();
  await historico.getByRole('button', { name: 'Restaurar este estado' }).click();
  await expect(historico).toBeHidden();
  await expect(p.getByRole('list', { name: 'Avisos do trabalho' })).toContainText('Estado anterior restaurado');
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await expect(editor.locator('.bd-citacao')).toHaveText(['Silva (2007)', '(SILVA, 2010)']);
  acesso = await contagemDaObra(p, '2007');
  await expect(acesso).toContainText('1 citação no texto');

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  expect(doc.obras?.map((o) => [o.ano, o.arquivoLocal])).toEqual([
    [2007, undefined],
    [2010, pdf],
  ]);
});
