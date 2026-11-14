/**
 * Etapa 7 da especificação de atualização (aceite): modelo de congresso ou evento em DOCX. Importa um modelo (gerado
 * aqui, com margens de 2,5 cm, Arial 11, entrelinha simples e seções), confere o que foi reconhecido, corrige um
 * aspecto, aplica sem mudar o texto, cria as seções que faltam, exporta e confere o DOCX exportado contra o modelo
 * original na própria tela.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

async function gravarModelo(caminho: string): Promise<void> {
  const d = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 }, paragraph: { spacing: { line: 240 }, alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 0 } } } },
      paragraphStyles: [{ id: 'Heading1', name: 'heading 1', basedOn: 'Normal', next: 'Normal', run: { bold: true, allCaps: true, size: 24 }, paragraph: { alignment: AlignmentType.LEFT } }],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } },
        children: [
          new Paragraph({ text: 'Use fonte Arial 11, margens de 2,5 cm e no máximo 10 páginas.' }),
          new Paragraph({ text: 'INTRODUÇÃO', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'RESULTADOS', heading: HeadingLevel.HEADING_1 }),
        ],
      },
    ],
  });
  writeFileSync(caminho, new Uint8Array(await Packer.toBuffer(d)));
}

test('Etapa 7: importar o modelo, aplicar, exportar e conferir o exportado contra o original', async () => {
  const modelo = join(amb.raiz, 'Modelo do Congresso.docx');
  await gravarModelo(modelo);
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p, 'Artigo como TCC');

  // Texto do autor antes do modelo.
  await p.getByRole('treeitem', { name: /^1 / }).first().click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  await editor.locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Texto do autor que não pode mudar.');

  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: 'Modelo de evento (DOCX)…' }).click();
  const painel = p.locator('.modelo-evento');
  await painel.getByLabel('Arquivo DOCX do modelo').setInputFiles(modelo);
  await expect(painel.getByRole('status')).toContainText('Modelo “Modelo do Congresso” lido');
  const linha = (aspecto: string) => painel.getByRole('row', { name: new RegExp(`^${aspecto}`) });
  await expect(linha('Margem superior')).toContainText('2,5 cm');
  await expect(linha('Fonte')).toContainText('Arial');
  await expect(linha('Entrelinha do texto')).toContainText('simples');
  await expect(painel).toContainText('Use fonte Arial 11, margens de 2,5 cm e no máximo 10 páginas.');
  await expect(painel.getByRole('region', { name: 'Seções do modelo' })).toContainText('RESULTADOS');

  await painel.getByRole('button', { name: 'Aplicar ao trabalho' }).click();
  await expect(painel.getByRole('status')).toContainText('aplicado');
  // Corrigir um aspecto: o tamanho do texto passa a 12 pt (e volta a 11 para conferir o exportado).
  const corpo = painel.getByLabel('Tamanho do texto no trabalho (pt)');
  await corpo.fill('12');
  await corpo.press('Tab');
  await expect(linha('Tamanho do texto')).toContainText('Corrigido por você');
  await corpo.fill('11');
  await corpo.press('Tab');
  await expect(linha('Tamanho do texto')).toContainText('Reconhecido no modelo');

  await painel.getByRole('button', { name: /^Criar as seções que faltam/ }).click();
  await expect(painel.getByRole('status')).toContainText('criada');

  // Exportar: a janela mostra a formatação do modelo, sem a escolha de fonte do Manual.
  const destino = join(amb.raiz, 'artigo.docx');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await p.keyboard.press('Control+E');
  const exportar = p.getByRole('dialog', { name: 'Exportar DOCX' });
  await expect(exportar).toContainText('Formatação do modelo “Modelo do Congresso”, fonte Arial.');
  await exportar.getByRole('button', { name: 'Exportar…' }).click();
  await expect(exportar.getByRole('status')).toHaveText(/“artigo\.docx” foi exportado/, { timeout: 60_000 });
  await exportar.getByRole('button', { name: 'Fechar' }).click();
  const xml = strFromU8(unzipSync(new Uint8Array(readFileSync(destino)))['word/document.xml']!);
  expect(xml).toContain('Texto do autor que não pode mudar.');
  expect(xml).toContain('w:top="1418"');

  // Conferir o exportado contra o modelo original, na tela.
  await painel.getByLabel('DOCX exportado para conferir').setInputFiles(destino);
  const conferencia = painel.getByRole('region', { name: /Exportado × modelo/ });
  await expect(conferencia).toContainText('conferem com o modelo');
});
