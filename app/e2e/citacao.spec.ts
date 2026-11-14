/**
 * FUN-13 (RF-07, M4-T07): citação no editor. Ctrl+Shift+C abre a janela; a chamada entra ligada à obra e mostra o texto
 * do documento; mudar o ano da obra muda a chamada; Ctrl+Z e Ctrl+Y desfazem e refazem com o texto; duplo clique altera;
 * obra citada não se exclui; copiar leva o texto da chamada; texto colado com "(AUTOR, ano)" sugere a ligação; citação dentro da nota; salvar grava a ligação.
 */
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Documento, Inline } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

async function cadastrarObra(p: Page): Promise<void> {
  await p.getByRole('navigation', { name: 'Bibliografia' }).getByRole('button', { name: 'Nova obra' }).click();
  const f = p.getByRole('form', { name: 'Nova obra' });
  await f.getByRole('button', { name: 'Acrescentar autoria' }).click();
  await f.getByLabel('Sobrenome').fill('Cagliari');
  await f.getByLabel('Prenomes').fill('Luiz Carlos');
  await f.getByLabel('Título', { exact: true }).fill('Alfabetização & Linguística');
  await f.getByLabel('Local de publicação').fill('São Paulo');
  await f.getByLabel('Editora').fill('Scipione');
  await f.getByLabel('Ano', { exact: true }).fill('2003');
  await f.getByRole('button', { name: 'Incluir obra' }).click();
}

test('FUN-13: inserir, acompanhar a obra, desfazer, alterar, colar e salvar uma citação', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await cadastrarObra(p);

  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  // Parágrafo novo depois do título (o título não aceita citação).
  await editor.locator('h2').click();
  await expect(editor).toBeFocused();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Como diz o autor ');

  // Ctrl+Shift+C: a janela vem com a obra e a forma entre parênteses; a prévia acompanha a página.
  await p.keyboard.press('Control+Shift+C');
  const janela = p.getByRole('dialog', { name: 'Inserir citação' });
  await expect(janela.getByLabel('Obra', { exact: true })).toHaveValue(/^obr_/);
  await janela.getByLabel('Página', { exact: true }).fill('(12)');
  await expect(janela.getByRole('list', { name: 'O que impede inserir a citação' })).toContainText('Obra citada, página');
  await expect(janela.getByRole('button', { name: 'Inserir citação' })).toBeDisabled();
  await janela.getByLabel('Página', { exact: true }).fill('12');
  const previa = janela.getByRole('region', { name: 'Como sai no texto' });
  await expect(previa.locator('p')).toHaveText('(CAGLIARI, 2003, p. 12)');
  await janela.getByRole('button', { name: 'Inserir citação' }).click();
  await expect(janela).toBeHidden();

  // A chamada no texto, com o foco de volta no editor.
  const chamadas = editor.locator('.bd-citacao');
  await expect(chamadas).toHaveText(['(CAGLIARI, 2003, p. 12)']);
  await expect(chamadas.first()).toHaveAttribute('aria-label', 'Citação: (CAGLIARI, 2003, p. 12)');
  await expect(editor).toBeFocused();
  await p.keyboard.type('.');
  await expect(editor.locator('p').first()).toHaveText('Como diz o autor (CAGLIARI, 2003, p. 12).');

  // Ctrl+Z tira o ponto e depois a chamada; Ctrl+Y devolve.
  await p.keyboard.press('Control+Z');
  await p.keyboard.press('Control+Z');
  await expect(chamadas).toHaveCount(0);
  await p.keyboard.press('Control+Y');
  await expect(chamadas).toHaveText(['(CAGLIARI, 2003, p. 12)']);

  // Mudar o ano da obra muda a chamada (aceite do RF-07).
  const bibliografia = p.getByRole('navigation', { name: 'Bibliografia' });
  await bibliografia.getByRole('button', { name: /^CAGLIARI/ }).click();
  await p.getByRole('form', { name: 'Obra da bibliografia' }).getByLabel('Ano', { exact: true }).fill('2004');
  // Obra citada não se exclui.
  await p.getByRole('button', { name: 'Excluir obra' }).click();
  await expect(p.getByRole('form', { name: 'Obra da bibliografia' })).toContainText('Esta obra é citada uma vez no texto.');
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await expect(chamadas).toHaveText(['(CAGLIARI, 2004, p. 12)']);

  // Duplo clique abre a chamada; muda para a forma narrativa.
  await chamadas.first().dblclick();
  const alterar = p.getByRole('dialog', { name: 'Alterar citação' });
  await expect(alterar.getByLabel('Página', { exact: true })).toHaveValue('12');
  await alterar.getByLabel('No texto: Sobrenome (ano)').check();
  await alterar.getByRole('button', { name: 'Alterar citação' }).click();
  await expect(chamadas).toHaveText(['Cagliari (2004, p. 12)']);

  // Texto colado com a chamada escrita: a sugestão espera o aceite e liga num passo só.
  await editor.locator('p').first().click();
  await p.keyboard.press('End');
  await p.keyboard.press('Enter');
  await x.app.evaluate(({ clipboard }) => clipboard.writeText('Segundo (CAGLIARI, 2004), e (SILVA, 2001).'));
  await p.keyboard.press('Control+V');
  const sugestao = p.getByRole('group', { name: 'Chamadas no texto colado' });
  await expect(sugestao).toContainText('O texto colado tem uma chamada escrita de obra da bibliografia: (CAGLIARI, 2004).');
  await sugestao.getByRole('button', { name: 'Ligar às obras' }).click();
  await expect(sugestao).toBeHidden();
  await expect(chamadas).toHaveText(['Cagliari (2004, p. 12)', '(CAGLIARI, 2004)']);
  await expect(editor.locator('p').nth(1)).toHaveText('Segundo (CAGLIARI, 2004), e (SILVA, 2001).');

  // Copiar leva o texto da chamada (não a palavra "citação").
  await p.keyboard.press('Control+A');
  await p.keyboard.press('Control+C');
  await expect.poll(() => x.app.evaluate(({ clipboard }) => clipboard.readText())).toContain('Como diz o autor Cagliari (2004, p. 12)');

  // Citação dentro da nota de rodapé: Ctrl+Shift+C no texto da nota insere na nota, e o foco volta para ela.
  // Ctrl+End desfaz o Ctrl+A pelo teclado e põe o cursor no fim do segundo (e último) parágrafo. Um clique dentro da
  // seleção inteira, seguido logo de teclas, às vezes chegava antes de o editor registrar a seleção nova (CI, 2026-11-13).
  await p.keyboard.press('Control+End');
  await expect.poll(() => p.evaluate(() => window.getSelection()?.isCollapsed)).toBe(true);
  await p.keyboard.press('Control+Alt+F');
  const textoNota = p.getByRole('textbox', { name: 'Texto da nota de rodapé' });
  await expect(textoNota).toBeFocused();
  await p.keyboard.type('Ver ');
  await p.keyboard.press('Control+Shift+C');
  const naNota = p.getByRole('dialog', { name: 'Inserir citação' });
  await naNota.getByLabel('Página', { exact: true }).fill('3');
  await naNota.getByRole('button', { name: 'Inserir citação' }).click();
  await expect(textoNota).toBeFocused();
  await p.keyboard.type('.');
  await expect(textoNota).toHaveText('Ver (CAGLIARI, 2004, p. 3).');
  await expect(textoNota.locator('.bd-citacao')).toHaveAttribute('aria-label', 'Citação: (CAGLIARI, 2004, p. 3)');
  await p.keyboard.press('Escape');

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const obra = doc.obras![0]!.id;
  const inlines = doc.corpo[0]!.blocos.flatMap((b) => (b.tipo === 'paragrafo' ? b.conteudo : [])) as Inline[];
  expect(inlines.filter((i) => i.tipo === 'citacao').map((i) => ({ ...i, id: '' }))).toEqual([
    { tipo: 'citacao', id: '', forma: 'narrativa', obras: [{ obra, pagina: '12' }] },
    { tipo: 'citacao', id: '', forma: 'parentetica', obras: [{ obra }] },
  ]);
  const nota = inlines.find((i) => i.tipo === 'nota');
  expect(nota?.tipo === 'nota' && nota.conteudo.map((i) => (i.tipo === 'citacao' ? { ...i, id: '' } : i))).toEqual([
    { tipo: 'texto', texto: 'Ver ' },
    { tipo: 'citacao', id: '', forma: 'parentetica', obras: [{ obra, pagina: '3' }] },
    { tipo: 'texto', texto: '.' },
  ]);

  await x.fechar();
  expect(x.problemas).toEqual([]);
});
