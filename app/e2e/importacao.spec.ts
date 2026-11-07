/**
 * FUN-15 (RF-08, M4-T09): importar um arquivo RIS. A janela mostra os registros antes de gravar, com as válidas marcadas
 * e o tipo sem formatador desativado; só as escolhidas entram, num passo só do Ctrl+Z; salvar grava as obras.
 */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, RAIZ_APP, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('FUN-15: importar RIS com conferência, escolher, desfazer e salvar', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  const bibliografia = p.getByRole('navigation', { name: 'Bibliografia' });
  await expect(bibliografia.getByRole('button', { name: 'Importar BibTeX ou RIS…' })).toBeVisible();
  await bibliografia.getByLabel('Arquivo BibTeX ou RIS').setInputFiles(join(RAIZ_APP, 'tests', 'fixtures', 'importacao', 'exemplo.ris'));

  const janela = p.getByRole('dialog', { name: 'Importar obras' });
  await expect(janela).toContainText('“exemplo.ris” (RIS): 5 registros, 1 que não pode ser importado. Confira antes de importar.');
  const registros = janela.getByRole('list', { name: 'Registros do arquivo' }).locator(':scope > li');
  await expect(registros).toHaveCount(5);
  await expect(registros.nth(0).getByRole('checkbox')).toBeChecked();
  await expect(registros.nth(0)).toContainText('CAGLIARI, Luiz Carlos. Alfabetização & Linguística. 10. ed. São Paulo: Scipione, 2003.');
  await expect(registros.nth(0)).toContainText('Ficou de fora do arquivo: SN.');
  await expect(registros.nth(4).getByRole('checkbox')).toBeDisabled();
  await expect(registros.nth(4)).toContainText('Tipo "RPRT" sem formatador');

  // Tira a tese; importa as outras três.
  await registros.nth(3).getByRole('checkbox').uncheck();
  await janela.getByRole('button', { name: 'Importar 3 obras' }).click();
  await expect(janela).toBeHidden();
  await expect(bibliografia.getByRole('status')).toHaveText('3 obras importadas. Ctrl+Z desfaz.');
  await expect(bibliografia.getByRole('listitem')).toHaveCount(3);

  // Um Ctrl+Z tira as três; Ctrl+Y devolve.
  await bibliografia.getByRole('button', { name: 'Nova obra' }).focus();
  await p.keyboard.press('Control+Z');
  await expect(bibliografia).toContainText('Nenhuma obra cadastrada.');
  await p.keyboard.press('Control+Y');
  await expect(bibliografia.getByRole('listitem')).toHaveCount(3);

  // O mesmo arquivo de novo: as três já estão no trabalho e vêm desmarcadas.
  await bibliografia.getByLabel('Arquivo BibTeX ou RIS').setInputFiles(join(RAIZ_APP, 'tests', 'fixtures', 'importacao', 'exemplo.ris'));
  await expect(janela.getByRole('button', { name: 'Importar 1 obra' })).toBeEnabled();
  await expect(registros.nth(0)).toContainText('Já está no trabalho');
  await janela.getByRole('button', { name: 'Cancelar' }).click();

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  expect(doc.obras!.map((o) => o.tipo)).toEqual(['livro', 'capitulo', 'artigoPeriodico']);

  await x.fechar();
  expect(x.problemas).toEqual([]);
});
