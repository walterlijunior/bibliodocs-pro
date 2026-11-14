/**
 * Etapa 6 da especificação de atualização (aceite): registro de atividades e cronograma. Registra uma atividade e uma
 * reunião, adapta o modelo (renomeia e acrescenta coluna), exporta o cronograma num DOCX avulso (diálogo do sistema
 * simulado) e confere que o quadro só entra no trabalho depois de "Incorporar registro/cronograma ao trabalho".
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import type { Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('Etapa 6: atividade e reunião, modelo adaptado, cronograma avulso e incorporação só quando pedida', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);

  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: 'Registro de atividades…' }).click();
  await expect(p.getByRole('tab', { name: 'Elementos', exact: true })).toHaveAttribute('aria-selected', 'true');
  const painel = p.locator('.registro');
  await painel.getByRole('button', { name: 'Começar com o modelo pronto' }).click();
  await expect(painel.getByRole('columnheader')).toHaveText(['Data', 'Tipo', 'Atividade desenvolvida', 'Encaminhamentos', 'Ações']);

  // Uma atividade e uma reunião com o orientador.
  await painel.getByRole('button', { name: 'Nova atividade' }).click();
  await painel.getByLabel('Atividade desenvolvida, linha 1').fill('Revisão bibliográfica');
  await painel.getByLabel('Data, linha 1').fill('2026-11-10');
  await painel.getByRole('button', { name: 'Nova reunião com o orientador' }).click();
  await expect(painel.getByLabel('Tipo, linha 2')).toHaveValue('Reunião com o orientador');
  await painel.getByLabel('Atividade desenvolvida, linha 2').fill('Definição do sumário');
  await painel.getByLabel('Data, linha 2').fill('2026-11-03');

  // Adaptar o modelo: "Encaminhamentos" vira "Próximos passos" e entra a coluna "Duração".
  await painel.getByText('Adaptar as colunas do modelo').click();
  await painel.getByLabel('Título da coluna 4').fill('Próximos passos');
  await painel.getByLabel('Título da coluna 4').press('Tab');
  await painel.getByRole('button', { name: 'Acrescentar coluna' }).click();
  await painel.getByLabel('Título da coluna 5').fill('Duração');
  await painel.getByLabel('Título da coluna 5').press('Tab');
  await painel.getByLabel('Duração, linha 2').fill('1 h');
  await painel.getByLabel('Duração, linha 2').press('Tab');
  await painel.getByRole('button', { name: 'Ordenar por data' }).click();
  await expect(painel.getByLabel('Atividade desenvolvida, linha 1')).toHaveValue('Definição do sumário');

  // Exportar o cronograma: um DOCX separado, só com o quadro.
  const avulso = join(amb.raiz, 'cronograma.docx');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, avulso);
  await painel.getByRole('button', { name: 'Exportar cronograma…' }).click();
  await expect(painel.getByRole('status')).toHaveText('Cronograma exportado em “cronograma.docx”.');
  expect(existsSync(avulso)).toBe(true);
  const xml = strFromU8(unzipSync(readFileSync(avulso))['word/document.xml']!);
  for (const texto of ['Revisão bibliográfica', 'Definição do sumário', 'Reunião com o orientador', 'Próximos passos', 'Duração', '1 h', '03/11/2026']) expect(xml).toContain(texto);
  expect(xml).not.toContain('Encaminhamentos');

  // Ainda fora do trabalho: o arquivo gravado tem o registro, mas nenhum apêndice com o quadro.
  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const ler = () => JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const antes = ler();
  expect(antes.registro?.linhas).toHaveLength(2);
  expect(antes.registro?.colunas.map((c) => c.titulo)).toEqual(['Data', 'Tipo', 'Atividade desenvolvida', 'Próximos passos', 'Duração']);
  const quadrosNosApendices = (d: Documento) => (d.posTextuais ?? []).flatMap((e) => (e.tipo === 'apendice' ? (e.blocos ?? []).filter((b) => b.tipo === 'tabela') : []));
  expect(quadrosNosApendices(antes)).toEqual([]);
  await expect(p.getByRole('region', { name: 'Registro e cronograma' })).toContainText('fora do trabalho');

  // Incorporar: o quadro entra num apêndice novo.
  await painel.getByRole('button', { name: 'Incorporar registro/cronograma ao trabalho' }).click();
  await expect(painel.getByRole('status')).toHaveText('Registro incorporado ao trabalho. Ctrl+Z desfaz.');
  await expect(painel).toContainText('Incorporado ao trabalho no APÊNDICE A');
  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const depois = ler();
  const quadros = quadrosNosApendices(depois);
  expect(quadros).toHaveLength(1);
  expect(quadros[0]).toMatchObject({ especie: 'quadro', titulo: [{ tipo: 'texto', texto: 'Registro de atividades e de orientação' }] });
  expect(depois.posTextuais?.find((e) => e.tipo === 'apendice')).toMatchObject({ titulo: 'Registro de atividades e de orientação' });
});
