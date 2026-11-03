/**
 * RNF-09 (M2-T11): axe-core sobre as telas que existem hoje, no Electron real. O axe é injetado pelo Playwright (fora
 * do pacote e sem afrouxar a CSP). Reprova violação séria ou crítica; as menores saem no anexo do teste.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, RAIZ_APP, type Ambiente } from './apoio/app';

interface Violacao {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: unknown[] }[];
}

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

test('Biblioteca, Novo trabalho, Versões descartadas, Escrever e Exportar sem violação séria', async ({}, info) => {
  const { pagina: p } = await abrirApp(amb);
  await conferirAxe(p, 'biblioteca-vazia', info);

  await p.getByRole('button', { name: 'Criar primeiro trabalho' }).click();
  await expect(p.getByRole('dialog', { name: 'Novo trabalho' })).toBeVisible();
  await conferirAxe(p, 'novo-trabalho', info);
  await p.getByRole('button', { name: 'Cancelar' }).click();

  await p.getByRole('menuitem', { name: 'Arquivo' }).click();
  await p.getByRole('menuitem', { name: 'Versões descartadas…' }).click();
  await expect(p.getByRole('dialog', { name: 'Versões descartadas' })).toBeVisible();
  await expect(p.getByText('Nenhuma versão descartada nos últimos 7 dias.')).toBeVisible();
  await conferirAxe(p, 'versoes-descartadas', info);
  await p.getByRole('button', { name: 'Fechar', exact: true }).click();

  await criarTrabalho(p);
  await expect(p.getByLabel('Título do trabalho')).toBeVisible();
  await conferirAxe(p, 'escrever', info);

  await p.keyboard.press('Control+E');
  await expect(p.getByRole('dialog', { name: 'Exportar DOCX' })).toBeVisible();
  await conferirAxe(p, 'exportar-docx', info);
});
