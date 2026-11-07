/**
 * FUN-12 (RF-08, M4-T06): cadastro de obras na aba Escrever. A obra nova só entra pelo botão quando o formato a aceita;
 * a prévia mostra a referência como sairá no documento; alterar grava na hora o que é válido; excluir entra no desfazer;
 * salvar e reabrir mantém a obra.
 */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const REFERENCIA = 'CAGLIARI, Luiz Carlos. Alfabetização & Linguística. 10. ed. São Paulo: Scipione, 2003. 191 p.';

test('FUN-12: cadastrar, alterar, excluir com Ctrl+Z, salvar e reabrir uma obra', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  const bibliografia = p.getByRole('navigation', { name: 'Bibliografia' });
  await expect(bibliografia).toContainText('Nenhuma obra cadastrada.');

  await bibliografia.getByRole('button', { name: 'Nova obra' }).click();
  const formulario = p.getByRole('form', { name: 'Nova obra' });
  const incluir = formulario.getByRole('button', { name: 'Incluir obra' });
  await expect(formulario.getByLabel('Tipo de obra')).toHaveValue('livro');
  // Sem título, o formato recusaria: o botão espera e o campo vem assinalado.
  await expect(incluir).toBeDisabled();
  await expect(formulario.getByRole('list', { name: 'O que impede gravar a obra' })).toContainText('Título');

  await formulario.getByRole('button', { name: 'Acrescentar autoria' }).click();
  await formulario.getByLabel('Sobrenome').fill('Cagliari');
  await formulario.getByLabel('Prenomes').fill('Luiz Carlos');
  await formulario.getByLabel('Título', { exact: true }).fill('Alfabetização & Linguística');
  await formulario.getByLabel('Edição').fill('10');
  await formulario.getByLabel('Local de publicação').fill('São Paulo');
  await formulario.getByLabel('Editora').fill('Scipione');
  await formulario.getByLabel('Ano', { exact: true }).fill('2003');
  await formulario.getByLabel('Páginas').fill('191');

  // Prévia com o destaque do documento: título em negrito (RN-178).
  const previa = formulario.getByRole('region', { name: 'Como sai na lista de referências' });
  await expect(previa).toContainText(REFERENCIA);
  await expect(previa.locator('strong')).toHaveText('Alfabetização & Linguística');
  await incluir.click();
  await expect(bibliografia.getByRole('status')).toHaveText('Obra incluída. Ctrl+Z desfaz.');
  await expect(bibliografia.getByRole('button', { name: REFERENCIA })).toHaveAttribute('aria-current', 'true');

  // Obra do trabalho: o que é válido grava na hora; o inválido espera assinalado.
  const obra = p.getByRole('form', { name: 'Obra da bibliografia' });
  await obra.getByLabel('Ano', { exact: true }).fill('2004');
  await expect(bibliografia.getByRole('button', { name: REFERENCIA.replace('2003', '2004') })).toBeVisible();
  await obra.getByLabel('Endereço eletrônico').fill('exemplo.org');
  await expect(obra.getByRole('list', { name: 'O que impede gravar a obra' })).toContainText('Endereço eletrônico');
  await obra.getByLabel('Endereço eletrônico').fill('');
  await expect(obra.getByRole('list', { name: 'O que impede gravar a obra' })).toHaveCount(0);

  // Excluir entra no desfazer da lista.
  await obra.getByRole('button', { name: 'Excluir obra' }).click();
  await expect(bibliografia.getByRole('status')).toHaveText('Obra excluída. Ctrl+Z desfaz.');
  await expect(bibliografia).toContainText('Nenhuma obra cadastrada.');
  await bibliografia.getByRole('button', { name: 'Nova obra' }).focus();
  await p.keyboard.press('Control+Z');
  await expect(bibliografia.getByRole('button', { name: /^CAGLIARI/ })).toBeVisible();

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  expect(doc.obras).toEqual([
    expect.objectContaining({ tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Cagliari', prenomes: 'Luiz Carlos' }], edicao: 10, ano: 2004, paginas: '191' }),
  ]);

  // Reabrir mostra a obra com os campos.
  await p.keyboard.press('Control+W');
  await p.getByRole('option', { name: /Trabalho sem título|TCC/ }).first().dblclick();
  await p.getByRole('navigation', { name: 'Bibliografia' }).getByRole('button', { name: /^CAGLIARI/ }).click();
  await expect(p.getByRole('form', { name: 'Obra da bibliografia' }).getByLabel('Editora')).toHaveValue('Scipione');

  await x.fechar();
  expect(x.problemas).toEqual([]);
});
