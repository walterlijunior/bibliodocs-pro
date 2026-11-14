/**
 * Aceite da Etapa 2 da especificação de atualização (editor, interface e ajuda):
 * - no mesmo trabalho, um parágrafo justificado com recuo (o padrão do perfil), um trecho centralizado e as duas listas
 *   (com marcadores e numerada), pelos botões e pelos atalhos;
 * - as escolhas persistem ao fechar e reabrir o aplicativo e saem certas no DOCX exportado;
 * - os controles principais têm nome que descreve a ação, e a ajuda abre e fecha pelo teclado;
 * - a aba Escrever não mostra a lateral da Biblioteca, a estrutura se recolhe, e o zoom muda o tamanho do texto.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const PARAGRAFO = 'Parágrafo do corpo, justificado e com recuo de primeira linha, como pede o Manual da UFT.';
const CENTRO = 'Trecho centralizado';

async function escreverNaIntroducao(p: Page) {
  await p.getByRole('treeitem', { name: /Introdução/ }).click();
  const editor = p.getByRole('textbox', { name: /Texto da seção 1/ });
  await editor.click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  return editor;
}

test('Etapa 2: parágrafo justificado com recuo, trecho centralizado e as duas listas persistem e saem no DOCX', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Parágrafos e listas');
  const editor = await escreverNaIntroducao(p);

  await p.keyboard.type(PARAGRAFO);
  await p.keyboard.press('Enter');
  await p.keyboard.type(CENTRO);
  // Botão: centraliza só o parágrafo do cursor; a barra mostra a escolha.
  await p.getByRole('button', { name: 'Centralizar' }).click();
  await expect(p.getByRole('button', { name: 'Centralizar' })).toHaveAttribute('aria-pressed', 'true');
  await p.keyboard.press('Enter');
  // Atalho: Ctrl+J volta o parágrafo novo (que herdou o centralizado) ao padrão do perfil.
  await p.keyboard.press('Control+J');
  await expect(p.getByRole('button', { name: 'Justificar' })).toHaveAttribute('aria-pressed', 'true');
  await p.keyboard.type('Primeiro marcador');
  await p.getByRole('button', { name: 'Lista com marcadores' }).click();
  await p.keyboard.press('Enter');
  await p.keyboard.type('Segundo marcador');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Enter'); // item vazio: sai da lista
  await p.keyboard.type('Primeiro passo');
  await p.keyboard.press('Control+Shift+7');
  await expect(p.getByRole('button', { name: 'Lista numerada' })).toHaveAttribute('aria-pressed', 'true');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Segundo passo');

  await expect(editor.locator('p.bd-paragrafo', { hasText: PARAGRAFO })).not.toHaveClass(/bd-alinhar|bd-sem-recuo/);
  await expect(editor.locator('p.bd-paragrafo', { hasText: CENTRO })).toHaveClass(/bd-alinhar-centralizado/);
  await expect(editor.locator('ul.bd-lista li')).toHaveText(['Primeiro marcador', 'Segundo marcador']);
  await expect(editor.locator('ol.bd-lista li')).toHaveText(['Primeiro passo', 'Segundo passo']);
  // Na tela, o parágrafo do perfil aparece justificado e com recuo; o trecho, centralizado.
  const estilo = (texto: string) =>
    editor.locator('p.bd-paragrafo', { hasText: texto }).evaluate((el) => [getComputedStyle(el).textAlign, getComputedStyle(el).textIndent]);
  expect(await estilo(PARAGRAFO)).toEqual(['justify', expect.stringMatching(/^4[67](\.\d+)?px$/)]);
  expect((await estilo(CENTRO))[0]).toBe('center');

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  const arquivo = join(amb.trabalhos, arquivosBdp(amb)[0]!);
  const salvo = JSON.parse(lerDocumento(arquivo).json) as { corpo: { blocos: Record<string, unknown>[] }[] };
  const blocos = salvo.corpo[0]!.blocos;
  expect(blocos.find((b) => b['tipo'] === 'paragrafo' && JSON.stringify(b).includes(CENTRO))).toMatchObject({ alinhamento: 'centralizado' });
  expect(blocos.find((b) => JSON.stringify(b).includes(PARAGRAFO))).not.toHaveProperty('alinhamento');
  expect(blocos.filter((b) => b['tipo'] === 'lista').map((b) => b['numerada'] ?? false)).toEqual([false, true]);
  await x.fechar();

  // Reabrir o aplicativo: as escolhas voltam iguais.
  const y = await abrirApp(amb);
  const q = y.pagina;
  await q.getByRole('option', { name: /^Parágrafos e listas,/ }).dblclick();
  await q.getByRole('treeitem', { name: /Introdução/ }).click();
  const ed2 = q.getByRole('textbox', { name: /Texto da seção 1/ });
  await expect(ed2.locator('p.bd-paragrafo', { hasText: CENTRO })).toHaveClass(/bd-alinhar-centralizado/);
  await expect(ed2.locator('p.bd-paragrafo', { hasText: PARAGRAFO })).not.toHaveClass(/bd-alinhar|bd-sem-recuo/);
  await expect(ed2.locator('ul.bd-lista li')).toHaveText(['Primeiro marcador', 'Segundo marcador']);
  await expect(ed2.locator('ol.bd-lista li')).toHaveText(['Primeiro passo', 'Segundo passo']);

  // Exportar: o DOCX traz o centralizado e as duas numerações; o parágrafo do perfil fica com o estilo (justificado, 1,25 cm).
  const destino = join(amb.raiz, 'paragrafos.docx');
  await y.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await q.keyboard.press('Control+E');
  const dialogo = q.getByRole('dialog', { name: 'Exportar DOCX' });
  await dialogo.getByRole('button', { name: 'Exportar…' }).click();
  await expect(dialogo.getByRole('status')).toHaveText(/foi exportado/, { timeout: 60_000 });
  await dialogo.getByRole('button', { name: 'Fechar' }).click();
  const z = unzipSync(new Uint8Array(readFileSync(destino)));
  const doc = strFromU8(z['word/document.xml']!);
  const paragrafo = (texto: string) => (doc.match(/<w:p>.*?<\/w:p>|<w:p .*?<\/w:p>/gs) ?? []).find((x) => x.includes(texto)) ?? '';
  expect(paragrafo(CENTRO)).toContain('<w:jc w:val="center"/>');
  expect(paragrafo(PARAGRAFO)).toContain('w:val="corpo"');
  expect(paragrafo(PARAGRAFO)).not.toContain('<w:jc ');
  const numeracao = strFromU8(z['word/numbering.xml']!);
  expect(numeracao).toContain('w:lvlText w:val="•"');
  expect(numeracao).toContain('w:lvlText w:val="%1."');
  for (const t of ['Primeiro marcador', 'Primeiro passo']) expect(paragrafo(t)).toContain('<w:numPr>');
  expect(/<w:numId w:val="(\d+)"/.exec(paragrafo('Primeiro marcador'))?.[1]).not.toBe(/<w:numId w:val="(\d+)"/.exec(paragrafo('Primeiro passo'))?.[1]);
  expect(y.problemas).toEqual([]);
  await y.fechar();
});

test('Etapa 2: controles com nomes de editor, ajuda pelo teclado, estrutura recolhível e zoom', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  // Os símbolos de reprodução saíram: as setas de seção têm o nome escrito; "Pré-visualizar" sem função não existe mais.
  await expect(p.getByRole('button', { name: 'Seção anterior' })).toBeVisible();
  await expect(p.getByRole('button', { name: 'Próxima seção' })).toBeVisible();
  await expect(p.getByRole('button', { name: /Pré-visualizar/ })).toHaveCount(0);
  await expect(p.getByRole('slider', { name: 'Zoom do texto' })).toBeDisabled();
  await expect(p.getByRole('complementary', { name: 'Biblioteca' })).toBeVisible();

  await criarTrabalho(p);
  // Na aba Escrever, a lateral da Biblioteca não aparece.
  await expect(p.getByRole('complementary', { name: 'Biblioteca' })).toHaveCount(0);
  await escreverNaIntroducao(p);
  for (const nome of ['Novo parágrafo', 'Alinhar à esquerda', 'Centralizar', 'Alinhar à direita', 'Justificar', 'Recuo da primeira linha', 'Lista com marcadores', 'Lista numerada', 'Alíneas']) {
    await expect(p.getByRole('toolbar', { name: 'Formatação do texto' }).getByRole('button', { name: nome, exact: true })).toHaveCount(1);
  }

  // Ajuda pelo teclado: Enter abre, o texto fica ligado ao botão, Esc fecha e o foco continua no botão.
  const ajuda = p.getByRole('button', { name: 'Ajuda: Parágrafo' });
  await ajuda.focus();
  await p.keyboard.press('Enter');
  await expect(ajuda).toHaveAttribute('aria-expanded', 'true');
  const balao = p.locator(`#${CSS_escape(await ajuda.getAttribute('aria-controls'))}`);
  await expect(balao).toBeVisible();
  await expect(balao).toContainText('1,25 cm');
  await expect(ajuda).toHaveAttribute('aria-describedby', (await ajuda.getAttribute('aria-controls'))!);
  await p.keyboard.press('Escape');
  await expect(balao).toHaveCount(0);
  await expect(ajuda).toHaveAttribute('aria-expanded', 'false');
  await expect(ajuda).toBeFocused();
  // Também ao passar o mouse.
  await p.getByRole('button', { name: 'Ajuda: Listas' }).hover();
  await expect(p.getByRole('note').filter({ hasText: 'Alíneas' })).toBeVisible();
  await p.mouse.move(0, 0);

  // Estrutura recolhível: some e volta, e o botão diz o estado.
  const estrutura = p.getByRole('button', { name: 'Ocultar estrutura' });
  await estrutura.click();
  await expect(p.getByRole('navigation', { name: 'Seções' })).toBeHidden();
  await p.getByRole('button', { name: 'Mostrar estrutura' }).click();
  await expect(p.getByRole('navigation', { name: 'Seções' })).toBeVisible();

  // Zoom: com o trabalho aberto, muda o tamanho do texto do editor.
  const zoom = p.getByRole('slider', { name: 'Zoom do texto' });
  await expect(zoom).toBeEnabled();
  const tamanho = () => p.locator('.bd-editor').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const antes = await tamanho();
  await zoom.focus();
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  await expect(zoom).toHaveAttribute('aria-valuetext', '120%');
  expect(await tamanho()).toBeCloseTo(antes * 1.2, 0);
  expect(x.problemas).toEqual([]);
  await x.fechar();
});

/** `CSS.escape` do lado do teste (ids do React têm ":"). */
function CSS_escape(id: string | null): string {
  return (id ?? '').replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
