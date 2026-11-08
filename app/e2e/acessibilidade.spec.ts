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

test('Biblioteca, Novo trabalho, Versões descartadas, Escrever, cadastro de obra, citação, conferência, importação e Exportar sem violação séria', async ({}, info) => {
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

  // M4-T06: cadastro de obra com autoria, prévia e campos assinalados.
  await p.getByRole('navigation', { name: 'Bibliografia' }).getByRole('button', { name: 'Nova obra' }).click();
  await p.getByRole('button', { name: 'Acrescentar autoria' }).click();
  await expect(p.getByRole('list', { name: 'O que impede gravar a obra' })).toBeVisible();
  await conferirAxe(p, 'cadastro-obra', info);
  await p.getByLabel('Sobrenome').fill('Lima');
  await p.getByLabel('Título', { exact: true }).fill('Alfa');
  await p.getByLabel('Ano', { exact: true }).fill('2020');
  await p.getByRole('button', { name: 'Incluir obra' }).click();

  // M4-T07: janela da citação, com a prévia da chamada.
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await p.getByRole('textbox', { name: 'Texto da seção 1' }).locator('h2').click();
  await expect(p.getByRole('textbox', { name: 'Texto da seção 1' })).toBeFocused();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Control+Shift+C');
  await expect(p.getByRole('dialog', { name: 'Inserir citação' })).toContainText('(LIMA, 2020)');
  await conferirAxe(p, 'janela-citacao', info);
  await p.getByRole('button', { name: 'Cancelar' }).click();

  // M4-T08: conferência da bibliografia (a obra não foi citada: um aviso).
  await p.getByRole('button', { name: 'Conferir citações e referências' }).click();
  await expect(p.getByRole('region', { name: 'Conferência da bibliografia' })).toContainText('Obra não citada');
  await conferirAxe(p, 'conferencia-bibliografia', info);
  await p.getByRole('region', { name: 'Conferência da bibliografia' }).getByRole('button', { name: 'Fechar' }).click();

  // M4-T09: janela da importação.
  await p.getByLabel('Arquivo BibTeX ou RIS').setInputFiles(join(RAIZ_APP, 'tests', 'fixtures', 'importacao', 'exemplo.ris'));
  await expect(p.getByRole('dialog', { name: 'Importar obras' })).toContainText('5 registros');
  await conferirAxe(p, 'importar-obras', info);
  await p.getByRole('dialog', { name: 'Importar obras' }).getByRole('button', { name: 'Cancelar' }).click();

  await p.keyboard.press('Control+E');
  await expect(p.getByRole('dialog', { name: 'Exportar DOCX' })).toBeVisible();
  await conferirAxe(p, 'exportar-docx', info);
  await p.getByRole('button', { name: 'Cancelar' }).click();

  await p.getByRole('menuitem', { name: 'Ajuda' }).click();
  await p.getByRole('menuitem', { name: 'Sobre o BiblioDocs Pro' }).click();
  const sobre = p.getByRole('dialog', { name: 'Sobre o BiblioDocs Pro' });
  await expect(sobre).toContainText('Versão 0.1.0');
  await expect(sobre).toContainText('docx 9.15.1 (MIT)');
  await conferirAxe(p, 'sobre', info);
});

test('Janela da tabela (M5-T04) sem violação séria', async ({}, info) => {
  const { pagina: p } = await abrirApp(amb);
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await p.getByRole('toolbar', { name: 'Formatação do texto' }).getByRole('button', { name: 'Tabela', exact: true }).click();
  const janela = p.getByRole('dialog', { name: 'Inserir tabela ou quadro' });
  await expect(janela.getByRole('list', { name: 'O que impede gravar a tabela' })).toBeVisible();
  await conferirAxe(p, 'janela-tabela', info);
  // M5-T05: prévia da planilha com opções e relatório.
  await janela.getByLabel('Arquivo CSV').setInputFiles(join(RAIZ_APP, 'tests', 'fixtures', 'planilha', 'municipios.csv'));
  await expect(janela.getByRole('region', { name: 'Prévia dos dados da planilha' })).toBeVisible();
  await conferirAxe(p, 'previa-planilha', info);
  await janela.getByLabel('Título', { exact: true }).fill('Exemplo');
  await janela.getByRole('button', { name: 'Inserir tabela' }).click();
  await expect(p.locator('.bd-tabela')).toHaveCount(1);
  await conferirAxe(p, 'tabela-no-texto', info);
});
