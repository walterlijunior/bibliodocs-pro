/**
 * FUN-01 (RF-01): criar → editar o título → salvar → fechar → reabrir, com o conteúdo idêntico na tela e no arquivo.
 * Reabrir sem editar não regrava o arquivo (mesmo SHA-256), nem na mesma execução nem depois de reiniciar o app.
 * FUN-02 (RF-02, M2-T02): "Novo trabalho" pede o tipo num diálogo modal; o trabalho nasce com os elementos e as seções
 * do tipo.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Documento } from '../src/dominio/modelo';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

// Acentos, aspas curvas, travessão e "&": o título passa pelo IPC, pelo zod e pelo ZIP sem perda.
const TITULO = 'Análise “piloto” — São Félix do Tocantins: ação & reação';
const inicioDoNome = new RegExp(`^${TITULO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`);
const sha256 = (caminho: string) => createHash('sha256').update(readFileSync(caminho)).digest('hex');

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('FUN-01: criar, salvar, fechar e reabrir mantém o trabalho idêntico', async () => {
  const primeira = await abrirApp(amb);
  const p = primeira.pagina;
  const salvamento = p.locator('.visor [role="status"]');
  const campo = p.getByLabel('Título do trabalho');

  await criarTrabalho(p);
  await campo.fill(TITULO);
  await expect(salvamento).toHaveText('Alterações não salvas');
  await p.keyboard.press('Control+S');
  await expect(salvamento).toHaveText(/^Salvo às \d\d:\d\d$/);

  const nomes = arquivosBdp(amb);
  expect(nomes).toHaveLength(1);
  const arquivo = join(amb.trabalhos, nomes[0]!);
  expect(lerDocumento(arquivo).titulo).toBe(TITULO);
  const hashSalvo = sha256(arquivo);

  // Fechar o trabalho volta à Biblioteca com o foco no cartão; Enter reabre.
  await p.keyboard.press('Control+W');
  const cartao = p.getByRole('option', { name: inicioDoNome });
  await expect(cartao).toBeFocused();
  await p.keyboard.press('Enter');
  await expect(campo).toHaveValue(TITULO);
  await expect(salvamento).toHaveText(/^Salvo/);
  await p.keyboard.press('Control+W');
  await expect(cartao).toBeFocused();

  await primeira.fechar();
  expect(sha256(arquivo)).toBe(hashSalvo);
  expect(primeira.problemas).toEqual([]);

  // Reiniciar o app: o índice da biblioteca e o arquivo trazem o mesmo trabalho.
  const segunda = await abrirApp(amb);
  const q = segunda.pagina;
  const cartaoDeNovo = q.getByRole('option', { name: inicioDoNome });
  await expect(cartaoDeNovo).toBeVisible();
  await cartaoDeNovo.dblclick();
  await expect(q.getByLabel('Título do trabalho')).toHaveValue(TITULO);
  await expect(q.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  await expect(q.locator('.visor')).toContainText(TITULO);
  await q.keyboard.press('Control+W');
  await segunda.fechar();

  expect(arquivosBdp(amb)).toEqual(nomes);
  expect(sha256(arquivo)).toBe(hashSalvo);
  expect(segunda.problemas).toEqual([]);
  for (const x of [primeira, segunda]) {
    expect(x.recursos).toContain('app://interface/index.html');
    for (const r of [...x.recursos, ...x.requisicoes]) expect(r).toMatch(/^app:\/\/interface\//);
  }
});

test('FUN-02: o diálogo "Novo trabalho" cria o trabalho do tipo escolhido, com os elementos e as seções do tipo', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  const dialogo = p.getByRole('dialog', { name: 'Novo trabalho' });

  // Abre com o primeiro tipo marcado e focado; Esc cancela sem criar nada, e o foco volta ao botão.
  const botao = p.getByRole('button', { name: 'Criar primeiro trabalho' });
  await botao.click();
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole('radio')).toHaveCount(6);
  const monografia = dialogo.getByRole('radio', { name: 'TCC (monografia)', exact: true });
  await expect(monografia).toHaveAccessibleName('TCC (monografia)');
  await expect(monografia).toBeChecked();
  await expect(monografia).toBeFocused();
  await expect(monografia).toHaveAccessibleDescription(/Quadro 5/);
  // Atalho global não age por trás do diálogo (Ctrl+N não abre outro, Ctrl+F não sai do diálogo).
  await p.keyboard.press('Control+F');
  await expect(monografia).toBeFocused();
  await p.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(botao).toBeFocused();
  expect(arquivosBdp(amb)).toEqual([]);

  // Teclado: setas trocam o tipo, Enter cria.
  await p.keyboard.press('Control+N');
  await expect(monografia).toBeFocused();
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowDown');
  await expect(dialogo.getByRole('radio', { name: 'Projeto de pesquisa', exact: true })).toBeChecked();
  await p.keyboard.press('Enter');
  await expect(dialogo).toHaveCount(0);
  await expect(p.getByLabel('Título do trabalho')).toBeFocused();
  await expect(p.locator('.formulario__dados')).toContainText('Projeto de pesquisa');
  await expect
    .poll(() => p.getByRole('treeitem').allTextContents())
    .toEqual(['1 Introdução', '2 Objetivos', '2.1 Objetivo geral', '2.2 Objetivos específicos', '3 Cronograma']);

  // O trabalho é gravado ao nascer: o arquivo já tem o tipo e os elementos, sem Ctrl+S.
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  const nomes = arquivosBdp(amb);
  expect(nomes).toHaveLength(1);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, nomes[0]!)).json) as Documento;
  expect(doc.tipoTrabalho).toBe('projeto-pesquisa');
  expect(doc.preTextuais?.map((e) => e.tipo)).toEqual(['capa', 'folhaRosto', 'listaIlustracoes', 'listaTabelas', 'sumario']);
  expect(doc.posTextuais?.map((e) => e.tipo)).toEqual(['referencias', 'apendice', 'anexo']);

  // A Biblioteca mostra o tipo no cartão; o próximo "Novo trabalho" já vem com o último tipo marcado.
  await p.keyboard.press('Control+W');
  await expect(p.getByRole('option', { name: /Projeto de pesquisa/ })).toBeVisible();
  await p.getByRole('button', { name: 'Novo trabalho' }).click();
  // Reabre com o último tipo marcado e focado (revisão do M2-T02, M2).
  await expect(dialogo.getByRole('radio', { name: 'Projeto de pesquisa', exact: true })).toBeChecked();
  await expect(dialogo.getByRole('radio', { name: 'Projeto de pesquisa', exact: true })).toBeFocused();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toHaveCount(0);

  await x.fechar();
  expect(x.problemas).toEqual([]);
});

test('FUN-11: elementos pré-textuais — campos, pendências, retirar com Ctrl+Z, salvar e reabrir', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p, 'Tese');
  const elementos = p.getByRole('navigation', { name: 'Elementos pré-textuais' });
  const item = (nome: string | RegExp) => elementos.getByRole('button', { name: nome });

  // Trabalho novo: a capa aponta o que falta, com a RN; escrever tira a pendência.
  await item(/^Capa/).click();
  const pendenciasCapa = p.getByRole('list', { name: 'Pendências: Capa' });
  await expect(pendenciasCapa).toContainText('Capa: falta a autoria. (RN-117)');
  await p.getByLabel('Autoria').fill('Ana Souza');
  await expect(pendenciasCapa).not.toContainText('falta a autoria');
  await p.getByLabel('Instituição').fill('Universidade Federal do Tocantins');

  // O dado da capa é o mesmo da folha de rosto.
  await item(/^Folha de rosto/).click();
  await expect(p.getByLabel('Autoria')).toHaveValue('Ana Souza');
  await p.getByLabel('Natureza do trabalho').fill('Tese para o grau de Mestre.');
  await expect(p.getByRole('list', { name: 'Pendências: Folha de rosto' })).toContainText('RN-133');
  await p.getByLabel('Natureza do trabalho').fill('Tese para o grau de Doutor.');

  // Resumo: palavras-chave separadas por ponto e vírgula, sem perder o separador enquanto digita.
  await item(/^Resumo( |$)(?!em)/).click();
  await p.getByLabel('Texto do resumo', { exact: true }).fill('Texto curto do resumo.');
  await expect(p.getByRole('list', { name: 'Pendências: Resumo' })).toContainText('RN-154');
  const chaves = p.getByLabel('Palavras-chave', { exact: true });
  await chaves.pressSequentially('Pequi; Cerrado');
  await expect(chaves).toHaveValue('Pequi; Cerrado');

  // Retirar leva o texto; Ctrl+Z na lista traz de volta; obrigatório fora vira pendência do trabalho.
  await p.getByRole('button', { name: 'Retirar do trabalho' }).click();
  await expect(elementos.getByRole('status')).toHaveText('Resumo retirado. Ctrl+Z desfaz.');
  await expect(elementos.getByRole('list', { name: 'Pendências do trabalho' })).toContainText('Resumo: elemento obrigatório ausente.');
  await expect(elementos.getByRole('button').first()).toBeFocused();
  await p.keyboard.press('Control+Z');
  await expect(elementos.getByRole('list', { name: 'Pendências do trabalho' })).toHaveCount(0);
  await item(/^Resumo( |$)(?!em)/).click();
  await expect(p.getByLabel('Texto do resumo', { exact: true })).toHaveValue('Texto curto do resumo.');

  // Incluir entra no lugar do Quadro 5 e abre o formulário.
  await elementos.getByLabel('Incluir elemento').selectOption({ label: 'Dedicatória' });
  await elementos.getByRole('button', { name: 'Incluir', exact: true }).click();
  await p.getByLabel('Texto da dedicatória').fill('Aos meus pais.');

  // Escolher uma seção volta ao editor.
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await expect(p.getByRole('textbox', { name: 'Texto da seção 1' })).toBeVisible();

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const nomes = arquivosBdp(amb);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, nomes[0]!)).json) as Documento;
  expect(doc.metadados).toMatchObject({ autoria: 'Ana Souza', natureza: 'Tese para o grau de Doutor.' });
  expect(doc.preTextuais?.find((e) => e.tipo === 'resumo')).toMatchObject({ texto: 'Texto curto do resumo.', palavrasChave: ['Pequi', 'Cerrado'] });
  expect(doc.preTextuais?.map((e) => e.tipo)).toEqual(['capa', 'folhaRosto', 'fichaCatalografica', 'folhaAprovacao', 'dedicatoria', 'resumo', 'abstract', 'sumario']);

  // Reabrir mostra o mesmo.
  await p.keyboard.press('Control+W');
  await p.getByRole('option', { name: /Tese/ }).dblclick();
  await item(/^Dedicatória/).click();
  await expect(p.getByLabel('Texto da dedicatória')).toHaveValue('Aos meus pais.');

  await x.fechar();
  expect(x.problemas).toEqual([]);
});
