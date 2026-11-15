/**
 * Especificação revista, Etapa 4 (captura A): na janela "Ligar menção", o rótulo "Como aparece no texto" e a mensagem
 * sobre a menção escrita ocupavam a mesma área. Com uma menção longa selecionada, em janela pequena, com e sem a opção
 * "Sem número" marcada: nenhum bloco se sobrepõe a outro e o botão de confirmar fica visível e utilizável.
 */
import { expect, test, type Locator } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const MENCAO = 'o quadro que aparece logo depois deste parágrafo, com as etapas do procedimento descritas uma a uma';

async function semSobreposicao(blocos: Locator[]): Promise<void> {
  const caixas = [];
  for (const b of blocos) caixas.push((await b.boundingBox())!);
  for (let i = 0; i < caixas.length; i++)
    for (let j = i + 1; j < caixas.length; j++) {
      const a = caixas[i]!;
      const c = caixas[j]!;
      const cruza = a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height - 0.5 && c.y < a.y + a.height - 0.5;
      expect(cruza, `blocos ${i} e ${j} se sobrepõem`).toBe(false);
    }
}

test('Etapa 4 revista: "Ligar menção" sem sobreposição, com mensagem longa e janela pequena', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  const barra = p.getByRole('toolbar', { name: 'Formatação do texto' });
  await editor.locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type(MENCAO);
  // Um quadro para citar (alguns, para a lista ficar comprida).
  for (const titulo of ['Primeiro', 'Segundo', 'Terceiro', 'Quarto', 'Quinto', 'Sexto']) {
    // O cursor volta ao parágrafo (com um quadro selecionado, o botão abriria "Alterar quadro").
    await editor.locator('p', { hasText: MENCAO }).click();
    await p.keyboard.press('End');
    await barra.getByRole('button', { name: 'Tabela', exact: true }).click();
    const janela = p.getByRole('dialog', { name: 'Inserir tabela ou quadro' });
    await janela.getByLabel('Quadro: conteúdo em texto, fechado').check();
    await janela.getByLabel('Título', { exact: true }).fill(`${titulo} quadro com um título bem comprido para ocupar mais de uma linha na lista`);
    await janela.getByLabel('Cabeçalho, linha 1, coluna 1', { exact: true }).fill('Item');
    await janela.getByLabel('Linha 2, coluna 1', { exact: true }).fill('Conteúdo');
    await janela.getByLabel('Fonte', { exact: true }).fill('O autor.');
    await janela.getByRole('button', { name: 'Inserir quadro' }).click();
    await expect(janela).toBeHidden();
  }

  // Janela pequena.
  // Seleciona a menção escrita e abre a remissiva.
  await editor.locator('p', { hasText: MENCAO }).click();
  // A menção quebra em duas linhas (Shift+Home iria só ao começo da linha): seleção pelo DOM, lida pelo editor.
  await p.evaluate((texto) => {
    const no = [...document.querySelectorAll('[contenteditable] p')].find((e) => e.textContent === texto)!.firstChild!;
    const r = document.createRange();
    r.setStart(no, 0);
    r.setEnd(no, texto.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
  }, MENCAO);
  await expect.poll(() => p.evaluate(() => getSelection()?.toString())).toBe(MENCAO);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  // A menor janela permitida (1024 × 700) com a escala de 150% do Windows: cerca de 680 × 440 px de CSS.
  await x.app.evaluate(({ BrowserWindow }) => {
    const j = BrowserWindow.getAllWindows()[0]!;
    j.setSize(1024, 700);
    j.webContents.setZoomFactor(1.5);
  });
  await expect.poll(() => p.evaluate(() => window.innerHeight)).toBeLessThan(470);

  await barra.getByRole('button', { name: 'Remissiva' }).click();
  const ligar = p.getByRole('dialog', { name: 'Ligar menção' });
  await expect(ligar).toBeVisible();

  const lista = ligar.getByRole('group', { name: 'Elemento citado' });
  const mensagem = ligar.getByText(`“${MENCAO}” não é o rótulo de nenhum elemento`);
  const forma = ligar.getByRole('group', { name: 'Como aparece no texto' });
  const legenda = forma.locator('legend');
  const opcaoCom = ligar.getByRole('radio', { name: /^Com o número/ });
  const opcaoSem = ligar.getByRole('radio', { name: /^Sem número/ });
  const confirmar = ligar.getByRole('button', { name: 'Ligar menção' });

  // Com "Sem número" marcado (a menção não é rótulo): mensagem, legenda e opções separadas.
  await expect(opcaoSem).toBeChecked();
  await mensagem.scrollIntoViewIfNeeded();
  await semSobreposicao([lista, mensagem, legenda, opcaoCom.locator('..'), opcaoSem.locator('..')]);
  await expect(confirmar).toBeInViewport();
  await expect(ligar.getByRole('button', { name: 'Cancelar' })).toBeInViewport();

  // Com "Com o número": o mesmo, e a ação continua acessível.
  await opcaoCom.check();
  await semSobreposicao([lista, mensagem, legenda, opcaoCom.locator('..'), opcaoSem.locator('..')]);
  await expect(confirmar).toBeInViewport();
  await ligar.getByRole('radio').first().check();
  await confirmar.click();
  await expect(ligar).toBeHidden();
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
