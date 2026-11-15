/**
 * Aceite da Etapa 3 da especificação revista (2026-11-14), na interface:
 * - titulação do orientador por seletor (Doutora, Dra.) e "outra titulação"; volta ao reabrir;
 * - "Lista de quadros" no seletor dos elementos pré-textuais, entre a lista de ilustrações e a de tabelas;
 * - grupos de siglas: criar, renomear, reordenar, pôr uma sigla num grupo e marcar "Separar por grupos".
 * A saída no DOCX (lista de quadros sincronizada, siglas agrupadas, caixa por campo) está nos testes do motor.
 */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';
import type { Documento } from '../src/dominio/modelo';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('Etapa 3 revista: titulação por seletor, lista de quadros e grupos de siglas', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Pré-textuais revistos');
  const doc = () => JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const salvar = async () => {
    await p.keyboard.press('Control+S');
    await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  };
  const nav = p.getByRole('navigation', { name: 'Elementos pré-textuais' });

  // Titulação do orientador: seletor e "outra".
  await nav.getByRole('button', { name: /^Folha de rosto/ }).click();
  const orientador = p.getByRole('group', { name: /^Orientador/ });
  await orientador.getByLabel('Titulação', { exact: true }).selectOption({ label: 'Doutora (Dra.)' });
  await orientador.getByLabel('Nome', { exact: true }).fill('Bia Lima');
  await salvar();
  expect(doc().metadados.orientador).toEqual({ titulacao: 'Dra.', nome: 'Bia Lima' });
  await orientador.getByLabel('Titulação', { exact: true }).selectOption({ label: 'Outra titulação…' });
  await orientador.getByLabel('Titulação: outra').fill('Prof.ª Livre-Docente');
  await salvar();
  expect(doc().metadados.orientador?.titulacao).toBe('Prof.ª Livre-Docente');

  // Lista de quadros no seletor, na ordem do Quadro 5 com a lista de quadros depois da de ilustrações.
  await nav.getByLabel('Incluir elemento').selectOption({ label: 'Lista de quadros' });
  await nav.getByRole('button', { name: 'Incluir', exact: true }).click();
  await expect(p.getByText('Os quadros do trabalho saem nesta lista')).toBeVisible();

  // Lista de siglas com a opção de grupos.
  await nav.getByLabel('Incluir elemento').selectOption({ label: 'Lista de abreviaturas e siglas' });
  await nav.getByRole('button', { name: 'Incluir', exact: true }).click();
  await p.getByRole('checkbox', { name: /^Separar por grupos/ }).check();
  await salvar();
  const tipos = doc().preTextuais!.map((e) => e.tipo);
  expect(tipos.indexOf('listaQuadros')).toBeGreaterThan(-1);
  expect(doc().preTextuais).toContainEqual(expect.objectContaining({ tipo: 'listaSiglas', agrupada: true }));

  // Grupos de siglas na janela Cadastros.
  await p.getByRole('tab', { name: 'Elementos', exact: true }).click();
  await p.getByRole('tabpanel').getByRole('button', { name: 'Siglas, símbolos e glossário…' }).click();
  const cad = p.getByRole('dialog', { name: 'Siglas, símbolos e glossário' });
  for (const [sigla, extenso] of [['ABNT', 'Associação Brasileira de Normas Técnicas'], ['BEN', 'Balanço Energético Nacional']]) {
    await cad.getByLabel('Sigla', { exact: true }).fill(sigla!);
    await cad.getByLabel('Forma por extenso').fill(extenso!);
    await cad.getByRole('button', { name: 'Gravar cadastro' }).click();
  }
  for (const nome of ['Documentos', 'Siglas de Organizações e Normas']) {
    await cad.getByPlaceholder('Nome do novo grupo').fill(nome);
    await cad.getByRole('button', { name: 'Novo grupo' }).click();
  }
  await cad.getByLabel('Nome do grupo 1').fill('Siglas de Documentos e Termos Técnicos');
  await cad.getByLabel('Nome do grupo 1').blur();
  await expect(cad.getByRole('status')).toHaveText('Grupo renomeado para “Siglas de Documentos e Termos Técnicos”.');
  await cad.getByRole('button', { name: 'Subir o grupo Siglas de Organizações e Normas' }).click();
  await expect(cad.getByLabel('Nome do grupo 1')).toHaveValue('Siglas de Organizações e Normas');
  await cad.getByLabel('Grupo de ABNT').selectOption({ label: 'Siglas de Organizações e Normas' });
  await cad.getByLabel('Grupo de BEN').selectOption({ label: 'Siglas de Documentos e Termos Técnicos' });
  await cad.getByRole('button', { name: 'Fechar' }).click();
  await salvar();
  const d = doc();
  expect(d.gruposSiglas!.map((g) => g.nome)).toEqual(['Siglas de Organizações e Normas', 'Siglas de Documentos e Termos Técnicos']);
  expect(d.siglas!.find((s) => s.sigla === 'ABNT')!.grupo).toBe(d.gruposSiglas![0]!.id);
  expect(d.siglas!.find((s) => s.sigla === 'BEN')!.grupo).toBe(d.gruposSiglas![1]!.id);
  expect(x.problemas).toEqual([]);
  await x.fechar();

  // Reabrir: a titulação "outra" continua como foi digitada.
  const y = await abrirApp(amb);
  await y.pagina.getByRole('option', { name: /^Pré-textuais revistos,/ }).dblclick();
  await y.pagina.getByRole('navigation', { name: 'Elementos pré-textuais' }).getByRole('button', { name: /^Folha de rosto/ }).click();
  const o2 = y.pagina.getByRole('group', { name: /^Orientador/ });
  await expect(o2.getByLabel('Titulação: outra')).toHaveValue('Prof.ª Livre-Docente');
  await y.fechar();
});
