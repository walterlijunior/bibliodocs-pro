/**
 * FUN-14 (RF-09, M5-T04): tabela e quadro no editor. O botão "Tabela" abre a janela; sem título, nada é gravado; a grade
 * ganha linha, mesclagem e sinal convencional; a nota explica os sinais; a tabela aparece no texto; Ctrl+Z e Ctrl+Y
 * desfazem e refazem com o texto; duplo clique altera; o menu Inserir abre a mesma janela; salvar grava a tabela válida.
 */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { BlocoTabela, Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('FUN-14: inserir, desfazer, alterar e salvar uma tabela', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);

  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  await editor.locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Texto antes.');
  await p.getByRole('toolbar', { name: 'Formatação do texto' }).getByRole('button', { name: 'Tabela', exact: true }).click();

  const janela = p.getByRole('dialog', { name: 'Inserir tabela ou quadro' });
  await expect(janela.getByLabel('Título', { exact: true })).toBeFocused();
  // Sem título, o formato recusaria: o botão espera e o campo vem assinalado.
  const inserir = janela.getByRole('button', { name: 'Inserir tabela' });
  await expect(inserir).toBeDisabled();
  await expect(janela.getByRole('list', { name: 'O que impede gravar a tabela' })).toContainText('Título');
  await janela.getByLabel('Título', { exact: true }).fill('Produção fictícia por região');

  const celula = (l: number, c: number, cab = false) => janela.getByLabel(`${cab ? 'Cabeçalho, linha' : 'Linha'} ${l}, coluna ${c}`, { exact: true });
  await celula(1, 1, true).fill('Região');
  await celula(1, 2, true).fill('2021');
  await celula(1, 3, true).fill('2022');
  await celula(2, 1).fill('Norte');
  await celula(2, 2).fill('1.234,5');
  await celula(2, 3).fill('-');
  await celula(3, 1).fill('Sul');
  await celula(3, 2).fill('987,1');
  // Sinal pelo botão, na célula ativa.
  await celula(3, 3).focus();
  await janela.getByRole('button', { name: /^Sinal \.\.\.:/ }).click();
  await expect(celula(3, 3)).toHaveValue('...');
  // Linha abaixo da ativa; mesclar as duas colunas de números dela.
  await janela.getByRole('button', { name: 'Linha abaixo' }).click();
  await expect(celula(4, 3)).toBeFocused();
  await celula(4, 1).fill('Total');
  await celula(4, 2).focus();
  await janela.getByRole('button', { name: 'Mesclar à direita' }).click();
  await expect(janela.getByLabel('Linha 4, coluna 2 (mesclada: 1 × 2)')).toBeVisible();
  await janela.getByLabel('Linha 4, coluna 2 (mesclada: 1 × 2)').fill('2.221,6');
  // Mesclar o que não dá: o motivo aparece e nada muda.
  await celula(4, 1).focus();
  await janela.getByRole('button', { name: 'Mesclar abaixo' }).click();
  await expect(janela.getByRole('status')).toHaveText('Não foi possível: não há célula abaixo.');

  await janela.getByRole('button', { name: 'Explicar na nota os sinais usados' }).click();
  await expect(janela.getByLabel('Nota', { exact: true })).toHaveValue(/^Sinais convencionais utilizados:\n– Dado numérico igual a zero/);
  await janela.getByLabel('Fonte', { exact: true }).fill('Dados fictícios de teste (2026).');
  await expect(janela.getByRole('list', { name: 'O que impede gravar a tabela' })).toHaveCount(0);
  await inserir.click();
  await expect(janela).toBeHidden();

  // No texto, com o foco de volta no editor.
  const tabelas = editor.locator('.bd-tabela');
  await expect(tabelas).toHaveCount(1);
  await expect(tabelas.first()).toHaveAttribute('aria-label', 'Tabela: Produção fictícia por região');
  await expect(tabelas.first().locator('td')).toContainText(['Norte', '1.234,5', '–']);
  await expect(editor).toBeFocused();

  // Ctrl+Z tira a tabela; Ctrl+Y devolve.
  await p.keyboard.press('Control+Z');
  await expect(tabelas).toHaveCount(0);
  await expect(editor).toContainText('Texto antes.');
  await p.keyboard.press('Control+Y');
  await expect(tabelas).toHaveCount(1);

  // Duplo clique altera: vira quadro.
  await tabelas.first().locator('table').dblclick();
  const alterar = p.getByRole('dialog', { name: /^Alterar (tabela|quadro)$/ });
  await expect(alterar).toHaveAccessibleName('Alterar tabela');
  await expect(alterar.getByLabel('Título', { exact: true })).toHaveValue('Produção fictícia por região');
  await alterar.getByLabel('Quadro: conteúdo em texto, fechado').check();
  await alterar.getByRole('button', { name: 'Alterar quadro' }).click();
  await expect(tabelas.first()).toHaveClass(/bd-tabela--quadro/);

  // O menu Inserir abre a mesma janela; Esc fecha sem mudar nada.
  await p.getByRole('menuitem', { name: 'Inserir' }).click();
  await p.getByRole('menuitem', { name: 'Tabela ou quadro…' }).click();
  await expect(p.getByRole('dialog', { name: 'Alterar quadro' })).toBeVisible();
  await p.keyboard.press('Escape');
  await expect(p.getByRole('dialog')).toHaveCount(0);

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const t = doc.corpo[0]!.blocos.find((b): b is BlocoTabela => b.tipo === 'tabela')!;
  expect(t).toMatchObject({ especie: 'quadro', linhasCabecalho: 1, fonte: [{ tipo: 'texto', texto: 'Dados fictícios de teste (2026).' }] });
  expect(t.linhas.map((l) => l.map((c) => c.conteudo.map((i) => i.texto).join('')))).toEqual([
    ['Região', '2021', '2022'],
    ['Norte', '1.234,5', '–'],
    ['Sul', '987,1', '...'],
    ['Total', '2.221,6'],
  ]);
  expect(t.linhas[3]![1]).toMatchObject({ colunas: 2 });
});
