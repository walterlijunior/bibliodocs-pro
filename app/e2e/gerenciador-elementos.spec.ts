/**
 * Etapa 4 da especificação de atualização (aceite): gerenciador de elementos e referências cruzadas. Dois quadros
 * criados pelo gerenciador; a menção "Quadro 1" já escrita é ligada ao quadro; uma menção sem número ("o quadro
 * seguinte") ligada ao segundo; um terceiro quadro antes dos dois renumera 1, 2 → 2, 3 no texto e no gerenciador, com a
 * fonte de cada um no quadro certo; a menção escrita sem ligação aparece em "Menções no texto" e é ligada de lá. O
 * `.bdp` guarda só as ligações e o texto da menção sem número.
 */
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Documento, Inline } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

async function preencherQuadro(p: Page, titulo: string, fonte: string): Promise<void> {
  const janela = p.getByRole('dialog', { name: 'Inserir tabela ou quadro' });
  await janela.getByLabel('Quadro: conteúdo em texto, fechado').check();
  await janela.getByLabel('Título', { exact: true }).fill(titulo);
  await janela.getByLabel('Cabeçalho, linha 1, coluna 1', { exact: true }).fill('Item');
  await janela.getByLabel('Linha 2, coluna 1', { exact: true }).fill(`Conteúdo de ${titulo}`);
  await janela.getByLabel('Fonte', { exact: true }).fill(fonte);
  await janela.getByRole('button', { name: 'Inserir quadro' }).click();
  await expect(janela).toBeHidden();
}

test('Etapa 4: quadros renumerados com as menções ligadas, menção sem número e menção escrita ligada pelo gerenciador', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  const aba = (nome: string) => p.getByRole('tab', { name: nome, exact: true });
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1' });
  const barra = p.getByRole('toolbar', { name: 'Formatação do texto' });
  await editor.locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Ver Quadro 1');

  // Dois quadros criados pelo gerenciador, no ponto do cursor da aba Escrever.
  await aba('Elementos').click();
  await p.getByRole('button', { name: 'Nova tabela ou quadro…' }).click();
  await preencherQuadro(p, 'Primeiro', 'Fonte do primeiro.');
  const quadros = editor.locator('.bd-tabela');
  await expect(quadros).toHaveCount(1);
  // Com o primeiro selecionado, o novo entra depois dele (e não abre "Alterar quadro").
  await quadros.first().locator('table').click();
  await aba('Elementos').click();
  await p.getByRole('button', { name: 'Nova tabela ou quadro…' }).click();
  await preencherQuadro(p, 'Segundo', 'Fonte do segundo.');
  await expect(quadros).toHaveCount(2);
  await expect(quadros.nth(0)).toHaveAttribute('aria-label', 'Quadro: Primeiro');
  await expect(quadros.nth(1)).toHaveAttribute('aria-label', 'Quadro: Segundo');

  // Ligar a menção já escrita: seleciona "Quadro 1" e abre a remissiva.
  const paragrafo: Locator = editor.locator('p', { hasText: 'Ver Quadro 1' });
  await paragrafo.click();
  await p.keyboard.press('End');
  // O clique ainda pode estar sendo aplicado pelo editor: espera o cursor parado no fim do parágrafo.
  await expect.poll(() => p.evaluate(() => { const s = getSelection(); return s !== null && s.isCollapsed && s.anchorOffset === (s.anchorNode?.textContent ?? '').length && (s.anchorNode?.textContent ?? '').endsWith('Quadro 1'); })).toBe(true);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  for (let i = 0; i < 'Quadro 1'.length; i++) await p.keyboard.press('Shift+ArrowLeft');
  // O editor lê a seleção do DOM no `selectionchange`, que chega depois da tecla: espera a seleção completa.
  await expect.poll(() => p.evaluate(() => getSelection()?.toString())).toBe('Quadro 1');
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  await barra.getByRole('button', { name: 'Remissiva' }).click();
  const ligar = p.getByRole('dialog', { name: 'Ligar menção' });
  await expect(ligar.getByRole('radio', { name: 'Quadro 1 – Primeiro' })).toBeChecked();
  await ligar.getByRole('button', { name: 'Ligar menção' }).click();
  await expect(ligar).toBeHidden();
  const remissivas = editor.locator('.bd-remissiva');
  await expect(remissivas).toHaveCount(1);
  await expect(remissivas.first()).toHaveText('Quadro 1');

  // Menção sem número ligada ao segundo quadro.
  await p.keyboard.type(' e ');
  await barra.getByRole('button', { name: 'Remissiva' }).click();
  const inserir = p.getByRole('dialog', { name: 'Inserir remissiva' });
  await inserir.getByRole('radio', { name: 'Quadro 2 – Segundo' }).check();
  await inserir.getByRole('radio', { name: /^Sem número/ }).check();
  await inserir.getByLabel('Texto da menção').fill('o quadro seguinte');
  await inserir.getByRole('button', { name: 'Inserir remissiva' }).click();
  await expect(inserir).toBeHidden();
  const semNumero = editor.locator('.bd-remissiva--sem-numero');
  await expect(semNumero).toHaveText('o quadro seguinte');
  await expect(semNumero).toHaveAttribute('aria-label', 'Menção sem número a Quadro 2: o quadro seguinte');
  await p.keyboard.type('. Como no Quadro 2.');

  // Terceiro quadro antes dos dois (cursor no título: entra como 1.º bloco). O texto acompanha.
  await editor.locator('h2').click();
  await barra.getByRole('button', { name: 'Tabela', exact: true }).click();
  await preencherQuadro(p, 'Novo', 'Fonte do novo.');
  await expect(remissivas.first()).toHaveText('Quadro 2');
  await expect(semNumero).toHaveText('o quadro seguinte');
  await expect(semNumero).toHaveAttribute('aria-label', 'Menção sem número a Quadro 3: o quadro seguinte');

  // O gerenciador: ordem nova, contagens, fonte de cada quadro e as menções.
  await aba('Elementos').click();
  const lista = p.getByRole('region', { name: 'Tabelas, figuras e equações' });
  await expect(lista.getByRole('button', { name: /^Quadro \d – / })).toHaveText([
    /^Quadro 1 – Novo\s*sem remissiva no texto$/,
    /^Quadro 2 – Primeiro\s*1 remissiva$/,
    /^Quadro 3 – Segundo\s*1 remissiva \(1 sem número\)$/,
  ]);
  await lista.getByRole('button', { name: /^Quadro 2 – Primeiro/ }).click();
  const painel = p.locator('.gerenciador');
  await expect(painel.getByRole('heading', { name: 'Quadro 2 – Primeiro' })).toBeVisible();
  await expect(painel).toContainText('Fonte do primeiro.');
  await expect(painel.locator('table')).toContainText('Conteúdo de Primeiro');
  await lista.getByRole('button', { name: /^Quadro 3 – Segundo/ }).click();
  await expect(painel).toContainText('Fonte do segundo.');

  await lista.getByRole('button', { name: 'Menções no texto' }).click();
  const mencoes = p.getByRole('region', { name: 'Escritas sem ligação' });
  await expect(mencoes).toContainText('“Quadro 2” hoje é Quadro 2');
  await expect(p.getByRole('region', { name: 'Sem número (ligadas)' })).toContainText('“o quadro seguinte” ligada a Quadro 3');

  // "Ligar…" leva ao texto com a menção selecionada e abre a janela com o quadro de mesmo rótulo.
  await mencoes.getByRole('button', { name: 'Ligar “Quadro 2”' }).click();
  const ligar2 = p.getByRole('dialog', { name: 'Ligar menção' });
  await expect(ligar2.getByRole('radio', { name: 'Quadro 2 – Primeiro' })).toBeChecked();
  await ligar2.getByRole('button', { name: 'Ligar menção' }).click();
  await expect(remissivas).toHaveCount(3);
  await expect(editor.locator('p', { hasText: 'Como no' })).toHaveText('Ver Quadro 2 e o quadro seguinte. Como no Quadro 2.');

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const blocos = doc.corpo[0]!.blocos;
  const ids = blocos.filter((b) => b.tipo === 'tabela').map((b) => b.id);
  const par = blocos.find((b) => b.tipo === 'paragrafo' && b.conteudo.some((i) => i.tipo === 'remissiva'));
  const rems = par?.tipo === 'paragrafo' ? par.conteudo.filter((i): i is Extract<Inline, { tipo: 'remissiva' }> => i.tipo === 'remissiva') : [];
  expect(rems.map((r) => [r.alvo, r.texto])).toEqual([
    [ids[1], undefined],
    [ids[2], 'o quadro seguinte'],
    [ids[1], undefined],
  ]);
});
