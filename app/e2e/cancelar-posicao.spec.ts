/**
 * Especificação revista, Etapa 4 ("Cancelar sem perder a posição"): abrir a janela de tabela (colar e importar
 * planilha), de figura ou de gráfico com o cursor no fim de uma seção longa e cancelar (botão ou Esc) devolve o editor ao
 * mesmo trecho: a mesma seção, a mesma rolagem, o mesmo cursor ou seleção, sem inserir nada nem mudar o texto.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const estado = (p: Page) =>
  p.evaluate(() => {
    const s = getSelection()!;
    const area = document.querySelector('.escrever__texto')!;
    const ed = document.querySelector('[contenteditable="true"]')!;
    return {
      rolagem: Math.round(area.scrollTop),
      selecao: s.toString(),
      ancora: s.anchorNode?.textContent?.slice(0, 40) ?? null,
      deslocamento: s.anchorOffset,
      foco: ed.contains(document.activeElement) || ed === document.activeElement,
      texto: ed.textContent,
    };
  });

test('Etapa 4 revista: cancelar tabela, figura e gráfico volta ao mesmo ponto, sem mudar o texto', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  const barra = p.getByRole('toolbar', { name: 'Formatação do texto' });
  await editor.locator('h2').click();
  await p.keyboard.press('Control+End');
  for (let i = 1; i <= 40; i++) {
    await p.keyboard.press('Enter');
    await p.keyboard.type(`Parágrafo ${i} de um texto longo que enche a seção até passar do fim da tela.`);
  }
  // Cursor no meio da última palavra; depois, uma seleção.
  for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await estado(p)).rolagem).toBeGreaterThan(200);
  const casos: { botao: string; janela: RegExp; fechar: 'botao' | 'esc' }[] = [
    { botao: 'Tabela', janela: /^Inserir tabela/, fechar: 'botao' },
    { botao: 'Figura', janela: /^Inserir figura/, fechar: 'esc' },
    { botao: 'Gráfico', janela: /gráfico/i, fechar: 'botao' },
  ];
  for (const selecionar of [false, true]) {
    if (selecionar) for (let i = 0; i < 6; i++) await p.keyboard.press('Shift+ArrowLeft');
    for (const c of casos) {
      const antes = await estado(p);
      await barra.getByRole('button', { name: c.botao, exact: true }).click();
      const janela = p.getByRole('dialog', { name: c.janela });
      await expect(janela).toBeVisible();
      if (c.fechar === 'esc') await p.keyboard.press('Escape');
      else await janela.getByRole('button', { name: /^(Cancelar|Fechar)$/ }).first().click();
      await expect(janela).toBeHidden();
      await expect.poll(() => estado(p), { message: `${c.botao}${selecionar ? ' com seleção' : ''}` }).toEqual(antes);
    }
  }
  // Digitar continua no mesmo ponto.
  await p.keyboard.press('ArrowRight');
  await p.keyboard.type('#');
  // O cursor estava em "t|ela."; a seleção terminava ali, e a seta à direita a recolhe no fim.
  await expect(editor.locator('p').last()).toHaveText('Parágrafo 40 de um texto longo que enche a seção até passar do fim da t#ela.');
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
