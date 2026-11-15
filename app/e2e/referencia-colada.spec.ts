/**
 * Etapa 5 da especificação de atualização — referência pronta colada de um portal (D-E5-06) e os tipos novos (D-E5-05).
 * Cola a referência de um artigo, converte em campos com a prévia do que foi lido, preenche os campos vazios, inclui a
 * obra e confere a referência montada pelo perfil; depois marca "usar o texto colado" e confere que a lista usa o texto
 * como veio. Cadastra também demonstrações financeiras com autoria de entidade e período.
 */
import { expect, test } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const COLADA = 'SOUZA, M. A.; LIMA, V. C. Os motores do greenwashing. Revista de Gestão, Berkeley, v. 54, n. 1, p. 64-87, 2011.';

test('Etapa 5: referência colada convertida em campos ou usada como veio; demonstrações financeiras', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  const bibliografia = p.getByRole('navigation', { name: 'Bibliografia' });
  await bibliografia.getByRole('button', { name: 'Nova obra' }).click();
  const formulario = p.getByRole('form', { name: 'Nova obra' });
  await formulario.getByText('Referência pronta (colada de um portal)').click();
  await formulario.getByLabel('Texto da referência').fill(COLADA);
  await formulario.getByRole('button', { name: 'Converter em campos…' }).click();
  const lido = formulario.getByRole('region', { name: 'O que foi lido' });
  await expect(lido).toContainText('Artigo de periódico (confira)');
  await expect(lido).toContainText('Revista de Gestão');
  await formulario.getByRole('button', { name: 'Preencher os campos vazios' }).click();
  await expect(formulario.getByLabel('Tipo de obra')).toHaveValue('artigoPeriodico');
  await expect(formulario.getByLabel('Título do periódico ou jornal')).toHaveValue('Revista de Gestão');
  const previa = formulario.getByRole('region', { name: 'Como sai na lista de referências' });
  await expect(previa).toContainText('SOUZA, M. A.; LIMA, V. C. Os motores do greenwashing. Revista de Gestão, Berkeley, v. 54, n. 1, p. 64-87, 2011.');
  await formulario.getByRole('button', { name: 'Incluir obra' }).click();
  await expect(bibliografia.getByRole('status')).toHaveText('Obra incluída. Ctrl+Z desfaz.');

  // Usar o texto colado: a prévia passa a ser o texto como veio, com o aviso.
  const obra = p.getByRole('form', { name: 'Obra da bibliografia' });
  await obra.getByLabel('Texto da referência').fill(`${COLADA} Texto do portal.`);
  await obra.getByLabel('Usar este texto na lista de referências, como foi colado').check();
  await expect(obra.getByRole('region', { name: 'Como sai na lista de referências' })).toContainText(`${COLADA} Texto do portal.`);

  // Demonstrações financeiras com entidade e período.
  await bibliografia.getByRole('button', { name: 'Nova obra' }).click();
  const nova = p.getByRole('form', { name: 'Nova obra' });
  await nova.getByLabel('Tipo de obra').selectOption('demonstracaoFinanceira');
  await nova.getByRole('button', { name: 'Acrescentar autoria' }).click();
  await nova.getByLabel('Autoria de').selectOption('entidade');
  await nova.getByLabel('Nome da entidade').fill('EMPRESA EXEMPLO S.A.');
  await nova.getByLabel('Título', { exact: true }).fill('Demonstrações financeiras');
  await nova.getByLabel('Período').fill('Exercício de 2024');
  await nova.getByLabel('Local de publicação').fill('São Paulo');
  await nova.getByLabel('Editora').fill('Empresa Exemplo');
  await nova.getByLabel('Ano', { exact: true }).fill('2025');
  await expect(nova.getByRole('region', { name: 'Como sai na lista de referências' })).toContainText('EMPRESA EXEMPLO S.A. Demonstrações financeiras. Exercício de 2024. São Paulo: Empresa Exemplo, 2025.');
  await nova.getByRole('button', { name: 'Incluir obra' }).click();
  await expect(bibliografia.getByRole('status')).toHaveText('Obra incluída. Ctrl+Z desfaz.');
  expect(x.problemas).toEqual([]);
});
