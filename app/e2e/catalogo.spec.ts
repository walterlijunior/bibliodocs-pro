/**
 * Aceite da Etapa 3 da especificação de atualização (cadastro acadêmico):
 * - escolher a instituição e depois o câmpus mostra só os cursos daquele câmpus, e o curso limita os tipos de trabalho;
 * - o trabalho nasce com os dados institucionais e os guarda no arquivo; reabre igual;
 * - um trabalho criado à mão recebe depois os dados do catálogo, sem perder os dados da autora;
 * - o catálogo aceita um docente novo, que vira orientador na folha de rosto e continua lá depois de reabrir o app.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { abrirApp, arquivosBdp, criarAmbiente, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const FOTOS = process.env['BDP_FOTOS'];
const metadados = (amb: Ambiente) =>
  (JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as { metadados: Record<string, unknown> }).metadados;
const opcoes = (p: Page, rotulo: string) => p.getByLabel(rotulo, { exact: true }).locator('option').allTextContents();
const elemento = (p: Page, nome: RegExp) => p.getByRole('navigation', { name: 'Elementos pré-textuais' }).getByRole('button', { name: nome });

test('Etapa 3: o câmpus filtra os cursos, o curso limita os tipos, e o trabalho nasce com os dados institucionais', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await p.getByRole('button', { name: 'Criar primeiro trabalho' }).click();
  const d = p.getByRole('dialog', { name: 'Novo trabalho' });
  await expect(d.getByLabel('Câmpus ou polo', { exact: true })).toBeDisabled();
  await d.getByLabel('Instituição', { exact: true }).selectOption({ label: 'Universidade Federal do Tocantins (UFT)' });
  await d.getByLabel('Câmpus ou polo', { exact: true }).selectOption({ label: 'Palmas' });
  const cursosPalmas = await opcoes(p, 'Curso ou programa');
  expect(cursosPalmas).toContain('Ciência da Computação (graduação)');
  expect(cursosPalmas).not.toContain('Agronomia (graduação)');
  await d.getByLabel('Câmpus ou polo', { exact: true }).selectOption({ label: 'Gurupi' });
  expect(await opcoes(p, 'Curso ou programa')).toContain('Agronomia (graduação)');
  expect(await opcoes(p, 'Curso ou programa')).not.toContain('Ciência da Computação (graduação)');
  await d.getByLabel('Câmpus ou polo', { exact: true }).selectOption({ label: 'Palmas' });
  await d.getByLabel('Curso ou programa', { exact: true }).selectOption({ label: 'Ciência da Computação (graduação)' });
  // Graduação: TCC, artigo, relatório e projeto; sem dissertação nem tese.
  await expect(d.getByRole('radio', { name: 'Dissertação', exact: true })).toHaveCount(0);
  await expect(d.getByRole('radio', { name: 'Tese', exact: true })).toHaveCount(0);
  await d.getByRole('radio', { name: 'TCC (monografia)', exact: true }).check();
  if (FOTOS) await p.screenshot({ path: join(FOTOS, 'e3-novo-trabalho.png') });
  await d.getByRole('button', { name: 'Criar trabalho' }).click();
  await expect(p.getByLabel('Título do trabalho')).toBeFocused();
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo/);

  expect(metadados(amb)).toMatchObject({
    instituicao: 'Universidade Federal do Tocantins',
    campus: 'Câmpus Universitário de Palmas',
    curso: 'Curso de Graduação em Ciência da Computação',
    local: 'Palmas, TO',
    vinculo: { instituicao: 'uft', campus: 'uft-palmas', curso: 'uft-palmas-ciencia-da-computacao' },
  });

  // A capa mostra a escolha e os textos; a origem do registro aparece.
  await elemento(p, /^Capa/).click();
  await expect(p.getByLabel('Curso ou programa do catálogo')).toHaveValue('uft-palmas-ciencia-da-computacao');
  await expect(p.getByLabel('Câmpus', { exact: true })).toHaveValue('Câmpus Universitário de Palmas');
  await expect(p.getByText(/Fonte: www\.uft\.edu\.br\/graduacao\/cursos, consultada em 14\/11\/2026/)).toBeVisible();
  if (FOTOS) await p.screenshot({ path: join(FOTOS, 'e3-capa.png') });
  expect(x.problemas).toEqual([]);
  await x.fechar();

  const y = await abrirApp(amb);
  await y.pagina.getByRole('option', { name: /Sem título|TCC/ }).first().dblclick();
  await elemento(y.pagina, /^Capa/).click();
  await expect(y.pagina.getByLabel('Câmpus ou polo do catálogo')).toHaveValue('uft-palmas');
  await expect(y.pagina.getByLabel('Local')).toHaveValue('Palmas, TO');
  await y.fechar();
});

test('Etapa 3: trabalho criado à mão recebe os dados do catálogo; docente novo vira orientador e o catálogo persiste', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await p.getByRole('button', { name: 'Criar primeiro trabalho' }).click();
  await p.getByRole('dialog', { name: 'Novo trabalho' }).getByRole('button', { name: 'Criar trabalho' }).click();
  await p.getByLabel('Título do trabalho').fill('Trabalho digitado');
  await elemento(p, /^Capa/).click();
  await p.getByLabel('Autoria').fill('Maria da Silva');
  await p.getByLabel('Instituição', { exact: true }).fill('Instituição digitada');
  await p.getByLabel('Ano do depósito').fill('2026');

  // Recebe os dados do catálogo: a instituição e o câmpus trocam; autoria, título e ano ficam.
  await p.getByLabel('Instituição do catálogo').selectOption({ label: 'Universidade Federal do Tocantins (UFT)' });
  await p.getByLabel('Câmpus ou polo do catálogo').selectOption({ label: 'Porto Nacional' });
  await expect(p.getByLabel('Instituição', { exact: true })).toHaveValue('Universidade Federal do Tocantins');
  await expect(p.getByLabel('Autoria')).toHaveValue('Maria da Silva');

  // Catálogo: grau e docente novo no curso de História de Porto Nacional.
  await p.getByRole('button', { name: 'Catálogo acadêmico…' }).click();
  const cat = p.getByRole('dialog', { name: 'Catálogo acadêmico' });
  await cat.getByLabel('Curso ou programa', { exact: true }).selectOption({ label: 'História' });
  await cat.getByLabel('Grau').selectOption({ label: 'Licenciatura' });
  await cat.getByLabel('Titulação').fill('Dr.');
  await cat.getByLabel('Nome do docente').fill('João Pereira');
  await cat.getByRole('button', { name: 'Incluir docente' }).click();
  await cat.getByRole('button', { name: 'Guardar' }).click();
  await expect(cat).toHaveCount(0);
  expect(existsSync(join(amb.dados, 'catalogo.json'))).toBe(true);
  expect(readFileSync(join(amb.dados, 'catalogo.json'), 'utf8')).toContain('João Pereira');

  await p.getByLabel('Curso ou programa do catálogo').selectOption({ label: 'História (graduação)' });
  await elemento(p, /^Folha de rosto/).click();
  await p.getByLabel('Orientador(a) do catálogo', { exact: true }).selectOption({ label: 'Dr. João Pereira' });
  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  expect(metadados(amb)).toMatchObject({
    autoria: 'Maria da Silva',
    ano: '2026',
    curso: 'Curso de Graduação em História',
    orientador: { nome: 'João Pereira', titulacao: 'Dr.' },
    natureza: expect.stringMatching(/^Monografia apresentada à Universidade Federal do Tocantins \(UFT\), Câmpus Universitário de Porto Nacional, .*título de licenciado em História\.$/),
  });
  expect(x.problemas).toEqual([]);
  await x.fechar();

  // O catálogo do usuário volta ao reabrir.
  const y = await abrirApp(amb);
  await y.pagina.getByRole('option', { name: /^Trabalho digitado,/ }).dblclick();
  await elemento(y.pagina, /^Folha de rosto/).click();
  await expect(y.pagina.getByLabel('Orientador(a) do catálogo', { exact: true })).toHaveValue(/joao-pereira/);
  await y.fechar();
});
