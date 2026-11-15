/**
 * Etapa 4 da especificação de atualização — "Importar planilha" por aba, no Electron real. A pasta de trabalho é montada
 * no teste (sem arquivo de usuário): uma aba com três quadros, uma com colunas vazias no meio e uma auxiliar.
 *
 * Roteiro: um quadro importado e citado no texto; depois, três quadros de outra aba importados antes dele numa
 * operação só. A menção e a legenda passam de "Quadro 1" a "Quadro 4", a origem (arquivo, aba, intervalo) fica no
 * `.bdp`, o DOCX sai com os valores da planilha (a fórmula pelo resultado) e um Ctrl+Z desfaz a importação inteira.
 * Cancelar a janela não insere nada.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';
import { linha, n, s, xlsxSintetico } from '../tests/apoio/xlsx-sintetico';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const TEXTOS = ['Critério', 'Descrição', 'Pontuação', 'Existência', 'Linha um\nlinha dois', 'N/A', 'TOTAL', 'Empresa', 'Eletrobras', 'Neoenergia', 'Sigla'];
const PLANILHA = {
  name: 'Quadros de teste.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: Buffer.from(
    xlsxSintetico(
      [
        {
          nome: 'Critérios',
          linhas: [
            linha(1, s('A1', 0, 2), s('B1', 1, 2), s('C1', 2, 2)),
            linha(2, s('A2', 3, 5), s('B2', 4, 5), n('C2', 1, 5)),
            linha(4, s('A4', 0, 2), s('B4', 1, 2), s('C4', 2, 2)),
            linha(5, s('A5', 3, 5), s('B5', 5, 5), n('C5', 0, 5)),
            linha(6, s('A6', 6, 5), `<c r="C6" s="5"><f>SUM(C5:C5)+8</f><v>8</v></c>`),
            linha(10, s('A10', 0, 2), s('C10', 2, 2)),
            linha(11, s('A11', 3, 5), n('C11', 4, 5)),
          ].join(''),
          mesclagens: ['A6:B6'],
        },
        { nome: 'Empresas', linhas: [linha(1, s('A1', 7), s('C1', 1)), linha(2, s('A2', 8), s('C2', 9))].join('') },
        { nome: 'SIGLAS', linhas: linha(1, s('A1', 10)) },
      ],
      TEXTOS,
    ),
  ),
};

async function abrirImportacao(p: Page): Promise<ReturnType<Page['getByRole']>> {
  await p.getByRole('tab', { name: 'Elementos', exact: true }).click();
  await p.getByRole('button', { name: 'Importar planilha…' }).click();
  const janela = p.getByRole('dialog', { name: 'Importar planilha' });
  await expect(janela).toBeVisible();
  await janela.getByLabel('Planilha do Excel').setInputFiles(PLANILHA);
  await expect(janela.getByRole('group', { name: 'Abas' })).toBeVisible();
  return janela;
}

test('Etapa 4: importar por aba, vários elementos de uma vez, renumerando a menção já escrita', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  await editor.locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Ver ');

  // 1) Aba "Empresas": a coluna B, vazia, sai; o quadro entra no cursor.
  let janela = await abrirImportacao(p);
  await expect(janela.getByRole('checkbox', { name: /SIGLAS/ })).not.toBeChecked();
  await janela.getByRole('checkbox', { name: /Empresas/ }).check();
  await expect(janela.getByRole('heading', { name: 'Elemento 1: Empresas › A1:C2' })).toBeVisible();
  await expect(janela.getByText('A coluna B do intervalo não tem nenhuma célula com valor e ficou de fora.')).toBeVisible();
  await expect(janela.getByRole('button', { name: 'Inserir' })).toBeDisabled();
  await janela.getByLabel('Título (sem o número)').fill('Original');
  await janela.getByLabel('Fonte').fill('Fonte da original.');
  await janela.getByRole('button', { name: 'Inserir' }).click();
  await expect(janela).toBeHidden();
  const quadros = editor.locator('.bd-tabela');
  await expect(quadros).toHaveCount(1);
  await expect(quadros.first()).toHaveAttribute('aria-label', 'Quadro: Original');

  // Menção ligada ao quadro, no fim de "Ver ".
  await editor.locator('p', { hasText: 'Ver' }).click();
  await p.keyboard.press('End');
  await p.getByRole('tab', { name: 'Elementos', exact: true }).click();
  await p.getByRole('button', { name: /Quadro 1 – Original/ }).click();
  await expect(p.getByText('Quadros de teste.xlsx › aba “Empresas” › A1:C2')).toBeVisible();
  await p.getByRole('button', { name: 'Inserir remissiva no cursor' }).click();
  const remissiva = editor.locator('.bd-remissiva');
  await expect(remissiva).toHaveText('Quadro 1');
  // A legenda no editor traz o número, como a menção.
  await expect(quadros.first().locator('.bd-tabela__titulo')).toHaveText('Quadro 1 – Original');

  // 2) Cancelar não insere nada.
  janela = await abrirImportacao(p);
  await janela.getByRole('checkbox', { name: /Critérios/ }).check();
  await janela.getByRole('button', { name: 'Cancelar' }).click();
  await expect(janela).toBeHidden();
  await expect(quadros).toHaveCount(1);

  // 3) Três quadros da aba "Critérios" antes do original: cursor no título da seção.
  await editor.locator('h2').click();
  janela = await abrirImportacao(p);
  await janela.getByRole('checkbox', { name: /Critérios/ }).check();
  for (const [k, intervalo] of ['A1:C2', 'A4:C6', 'A10:C11'].entries()) await expect(janela.getByRole('heading', { name: `Elemento ${k + 1}: Critérios › ${intervalo}` })).toBeVisible();
  // A fórmula entra pelo resultado; a quebra de linha da célula fica.
  await expect(janela.getByText(/célula com fórmula entrou com o resultado gravado/)).toBeVisible();
  const titulos = janela.getByLabel('Título (sem o número)');
  for (const [k, t] of ['Primeiro', 'Segundo', 'Terceiro'].entries()) await titulos.nth(k).fill(t);
  await janela.getByRole('button', { name: 'Inserir 3 elementos' }).click();
  await expect(janela).toBeHidden();
  await expect(quadros).toHaveCount(4);
  await expect(quadros.nth(3)).toHaveAttribute('aria-label', 'Quadro: Original');
  await expect(remissiva).toHaveText('Quadro 4');
  await expect(quadros.nth(3).locator('.bd-tabela__titulo')).toHaveText('Quadro 4 – Original');
  for (const [k, t] of ['Primeiro', 'Segundo', 'Terceiro'].entries()) await expect(quadros.nth(k).locator('.bd-tabela__titulo')).toHaveText(`Quadro ${k + 1} – ${t}`);

  // O .bdp guarda a origem de cada quadro.
  await p.keyboard.press('Control+S');
  await expect.poll(() => arquivosBdp(amb).length).toBe(1);
  const origens = () => {
    const d = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as { corpo: { blocos: { tipo: string; origem?: unknown }[] }[] };
    return d.corpo.flatMap((sec) => sec.blocos).filter((b) => b.tipo === 'tabela').map((b) => b.origem);
  };
  await expect
    .poll(origens)
    .toEqual([
      { arquivo: 'Quadros de teste.xlsx', aba: 'Critérios', intervalo: 'A1:C2' },
      { arquivo: 'Quadros de teste.xlsx', aba: 'Critérios', intervalo: 'A4:C6' },
      { arquivo: 'Quadros de teste.xlsx', aba: 'Critérios', intervalo: 'A10:C11' },
      { arquivo: 'Quadros de teste.xlsx', aba: 'Empresas', intervalo: 'A1:C2' },
    ]);

  // DOCX: legenda e menção renumeradas, valores da planilha.
  const destino = join(amb.raiz, 'importada.docx');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await p.keyboard.press('Control+E');
  const exportar = p.getByRole('dialog', { name: 'Exportar DOCX' });
  await exportar.getByRole('button', { name: 'Exportar…' }).click();
  await expect(exportar.getByRole('status')).toHaveText(/foi exportado/, { timeout: 60_000 });
  await exportar.getByRole('button', { name: 'Fechar' }).click();
  const doc = strFromU8(unzipSync(new Uint8Array(readFileSync(destino)))['word/document.xml']!);
  expect(doc).toMatch(/Quadro 4 – <\/w:t><\/w:r><w:r><w:t xml:space="preserve">Original/);
  expect(doc).toMatch(/Ver <\/w:t>[\s\S]{0,200}Quadro 4/);
  expect(doc).toMatch(/Linha um<\/w:t><\/w:r><w:r><w:br\/><w:t xml:space="preserve">linha dois/);
  expect(doc).toContain('>N/A<');
  expect(doc).toContain('<w:gridSpan w:val="2"/>');

  // Um Ctrl+Z desfaz os três quadros importados juntos; a menção volta a "Quadro 1".
  await quadros.nth(2).locator('table').click();
  await p.keyboard.press('Control+Z');
  await expect(quadros).toHaveCount(1);
  await expect(remissiva).toHaveText('Quadro 1');
  await expect(quadros.first().locator('.bd-tabela__titulo')).toHaveText('Quadro 1 – Original');
  expect(x.problemas).toEqual([]);
});
