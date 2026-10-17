/**
 * FUN-01 (RF-01): criar → editar o título → salvar → fechar → reabrir, com o conteúdo idêntico na tela e no arquivo.
 * Reabrir sem editar não regrava o arquivo (mesmo SHA-256), nem na mesma execução nem depois de reiniciar o app.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { abrirApp, arquivosBdp, criarAmbiente, lerDocumento, type Ambiente } from './apoio/app';

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

  await p.getByRole('button', { name: 'Criar primeiro trabalho' }).click();
  await expect(campo).toBeFocused();
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
