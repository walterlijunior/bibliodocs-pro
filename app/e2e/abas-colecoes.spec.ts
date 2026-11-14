/**
 * F-E6-01 no Electron real: abas Elementos, Referências e Conformidade com as funções do trabalho aberto, as coleções da
 * Biblioteca (Siglas e Modelos) e os itens de menu que não tinham ação (Dados do trabalho…, F8, F1, Atalhos de teclado).
 */
import { expect, test } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('F-E6-01: abas do trabalho, coleções da Biblioteca e menus', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  const painel = p.getByRole('tabpanel');
  const aba = (nome: string) => p.getByRole('tab', { name: nome, exact: true });

  // Sem trabalho aberto, as abas do trabalho convidam a abrir um.
  await aba('Elementos').click();
  await expect(painel.getByRole('heading', { name: 'Nenhum trabalho aberto' })).toBeVisible();
  await aba('Biblioteca').click();
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Qualidade da água');

  // Elementos: pré-textuais, pós-textuais e a lista de tabelas e figuras; sem árvore de seções nem lista de obras.
  await aba('Elementos').click();
  await expect(painel.getByRole('heading', { name: 'Elementos', level: 1 })).toBeVisible();
  await expect(painel.getByRole('navigation', { name: 'Elementos pré-textuais' })).toBeVisible();
  await expect(painel.getByRole('heading', { name: 'Tabelas, figuras e equações' })).toBeVisible();
  await expect(painel.getByRole('tree')).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Nova obra' })).toHaveCount(0);

  // Trabalho › Dados do trabalho… abre a folha de rosto (ou a capa) na aba Elementos.
  await aba('Escrever').click();
  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: 'Dados do trabalho…' }).click();
  await expect(aba('Elementos')).toHaveAttribute('aria-selected', 'true');
  await expect(painel.getByRole('form').filter({ has: p.getByRole('heading', { name: /Folha de rosto|Capa/u }) })).toBeVisible();

  // Siglas cadastradas na aba Elementos.
  await painel.getByRole('button', { name: 'Siglas, símbolos e glossário…' }).click();
  const cadastros = p.getByRole('dialog', { name: 'Siglas, símbolos e glossário' });
  await cadastros.getByLabel('Sigla', { exact: true }).fill('UFT');
  await cadastros.getByLabel('Forma por extenso').fill('Universidade Federal do Tocantins');
  await cadastros.getByRole('button', { name: 'Gravar cadastro' }).click();
  await cadastros.getByRole('button', { name: 'Fechar' }).click();

  // Referências: a lista de obras, sem a árvore de seções.
  await aba('Referências').click();
  await expect(painel.getByRole('heading', { name: 'Referências', level: 1 })).toBeVisible();
  await expect(painel.getByRole('button', { name: 'Nova obra' })).toBeVisible();
  await expect(painel.getByRole('tree')).toHaveCount(0);

  // Conformidade: o relatório na própria página; "Ir ao local" de um pré-textual leva à aba Elementos.
  await aba('Conformidade').click();
  const relatorio = painel.getByRole('region', { name: 'Relatório de conformidade' });
  await expect(relatorio.getByRole('status').first()).toHaveText(/^\d+ pendências? e \d+ avisos?\.$/u);
  await expect(p.getByRole('dialog')).toHaveCount(0);
  const pre = relatorio.getByRole('region', { name: /^Elementos pré-textuais/u }).getByRole('listitem').first();
  await pre.getByRole('button', { name: 'Ir ao local' }).click();
  await expect(aba('Elementos')).toHaveAttribute('aria-selected', 'true');
  await expect(painel.getByRole('form')).toBeVisible();

  // F8: a próxima não conformidade, com o anúncio "n de m".
  await p.keyboard.press('F8');
  await expect(painel.getByRole('status').filter({ hasText: / 1 de \d+ \(/u })).toBeVisible();
  await p.keyboard.press('F8');
  await expect(painel.getByRole('status').filter({ hasText: / 2 de \d+ \(/u })).toBeVisible();

  // Ajuda: F1 (guia rápido) e Atalhos de teclado.
  await p.keyboard.press('F1');
  const guia = p.getByRole('dialog', { name: 'Guia rápido' });
  await expect(guia).toContainText('Exportar DOCX');
  await guia.getByRole('button', { name: 'Fechar' }).click();
  await expect(guia).toHaveCount(0);
  await p.getByRole('menuitem', { name: 'Ajuda' }).click();
  await p.getByRole('menuitem', { name: 'Atalhos de teclado' }).click();
  const atalhos = p.getByRole('dialog', { name: 'Atalhos de teclado' });
  await expect(atalhos).toContainText('Ctrl+Shift+S');
  await expect(atalhos).toContainText('F8');
  await p.keyboard.press('Escape');
  await expect(atalhos).toHaveCount(0);

  // Coleções da Biblioteca: Siglas junta as siglas dos trabalhos salvos; Modelos cria um trabalho do tipo.
  await p.keyboard.press('Control+S');
  await aba('Biblioteca').click();
  await p.keyboard.press('F5');
  await p.getByRole('combobox', { name: 'Coleção' }).selectOption({ label: 'Siglas' });
  const siglas = painel.getByRole('list', { name: 'Siglas' });
  await expect(siglas.getByRole('listitem')).toHaveCount(1);
  await expect(siglas).toContainText('UFT — Universidade Federal do Tocantins');
  await expect(siglas.getByRole('button', { name: 'Abrir o trabalho Qualidade da água' })).toBeVisible();

  await p.getByRole('combobox', { name: 'Coleção' }).selectOption({ label: 'Modelos' });
  await expect(painel.getByRole('button', { name: /^Criar trabalho: /u })).toHaveCount(6);
  await painel.getByRole('button', { name: 'Criar trabalho: Tese' }).click();
  await expect(aba('Escrever')).toHaveAttribute('aria-selected', 'true');
  await expect(p.getByLabel('Título do trabalho')).toBeFocused();
  await x.fechar();
});
