/**
 * FUN-09 parcial (M7-T03): janela do verificador de conformidade no Electron real. Resumo com pendências e avisos, grupos
 * por família, filtro, local legível, "Ir ao local" no texto e num pré-textual, axe sem violação séria.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, RAIZ_APP, type Ambiente } from './apoio/app';

interface Violacao { id: string; impact: string | null; help: string; nodes: { target: unknown[] }[] }
const FONTE_AXE = readFileSync(join(RAIZ_APP, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
async function conferirAxe(p: Page, tela: string, info: TestInfo): Promise<void> {
  const violacoes = await p.evaluate(async (fonte) => {
    if (!('axe' in window)) (0, eval)(fonte);
    const axe = (window as unknown as { axe: { run(alvo: Document, opcoes: unknown): Promise<{ violations: unknown[] }> } }).axe;
    return (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations;
  }, FONTE_AXE) as Violacao[];
  const resumo = violacoes.map((v) => `${v.impact ?? '?'} ${v.id}: ${v.help} (${v.nodes.map((n) => JSON.stringify(n.target)).join(', ')})`);
  await info.attach(`axe-${tela}.txt`, { body: resumo.join('\n') || 'sem violações' });
  expect(resumo.filter((_, i) => ['serious', 'critical'].includes(violacoes[i]!.impact ?? '')), tela).toEqual([]);
}

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('FUN-09 (M7-T03): verificar, filtrar, ir ao local no texto e no pré-textual, sem violação séria', async ({}, info) => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);

  // Texto com supressão fora do padrão dentro de citação (RN-086).
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  await editor.locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Disse que "a pesquisa (...) avançou" ontem.');

  await p.getByRole('button', { name: 'Verificar conformidade' }).click();
  const dialogo = p.getByRole('dialog', { name: 'Verificar conformidade' });
  await expect(dialogo.getByRole('status').first()).toHaveText(/^\d+ pendências? e \d+ avisos?\.$/u);
  await expect(dialogo.getByRole('heading', { name: /^Elementos pré-textuais \(\d+\)$/u })).toBeVisible();
  const texto = dialogo.getByRole('region', { name: /^Texto e seções/u });
  const supressao = texto.getByRole('listitem').filter({ hasText: 'RN-086' });
  await expect(supressao).toContainText('Local: Seção 1 Introdução: “(...)”');
  await expect(supressao).toContainText('o Manual indica supressões por [...]');
  await conferirAxe(p, 'verificar-conformidade', info);

  // Filtro: só pendências esconde os avisos; só avisos esconde as pendências.
  await dialogo.getByRole('radio', { name: /^Pendências \(\d+\)$/u }).check();
  await expect(dialogo.getByRole('listitem').filter({ hasText: /^Aviso/u })).toHaveCount(0);
  await expect(dialogo.getByRole('listitem').filter({ hasText: /^Pendência/u }).first()).toBeVisible();
  await dialogo.getByRole('radio', { name: /^Avisos \(\d+\)$/u }).check();
  await expect(dialogo.getByRole('listitem').filter({ hasText: /^Pendência/u })).toHaveCount(0);

  // Ir ao local no texto: o editor volta com o trecho selecionado.
  await supressao.getByRole('button', { name: 'Ir ao local' }).click();
  await expect(dialogo).toBeHidden();
  await expect(editor).toBeFocused();
  await expect.poll(() => p.evaluate(() => window.getSelection()?.toString())).toBe('(...)');

  // Ir ao local num pré-textual: a janela fecha e o elemento é aberto. Desta vez ela abre pelo F7 (menu Verificar, E7-T03).
  await p.keyboard.press('F7');
  const pre = dialogo.getByRole('region', { name: /^Elementos pré-textuais/u }).getByRole('listitem').first();
  const local = (await pre.getByText(/^Local: /u).textContent())!.replace('Local: ', '');
  await pre.getByRole('button', { name: 'Ir ao local' }).click();
  await expect(dialogo).toBeHidden();
  await expect(p.getByText(local, { exact: false }).first()).toBeVisible();
  await x.fechar();
});
