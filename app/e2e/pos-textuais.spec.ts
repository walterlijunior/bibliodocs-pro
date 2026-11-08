/**
 * FUN-20 (M6-T05, ligado na revisão do M6, R-M6-02; RF-14): a tela "Elementos pós-textuais" no app. Incluir um apêndice
 * abre o conteúdo dele no editor; o texto digitado vai para o `.bdp` dentro do
 * apêndice; retirar e Ctrl+Z trazem de volta com o conteúdo. O título é escrito na linha de título do editor.
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

test('FUN-20: incluir apêndice, dar título, escrever, retirar e desfazer', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  const pos = p.getByRole('navigation', { name: 'Elementos pós-textuais' });
  await expect(pos).toBeVisible();

  await pos.getByRole('combobox', { name: 'Incluir pós-textual' }).selectOption('apendice');
  await pos.getByRole('button', { name: 'Incluir pós-textual' }).click();
  const apendice = pos.getByRole('button', { name: /^APÊNDICE A/ });
  await expect(apendice).toBeVisible();

  // O apêndice novo abre no editor, com o foco na linha de título (o título é escrito ali, como nas seções).
  const editor = p.locator('.bd-editor');
  await p.keyboard.type('Roteiro de entrevista');
  await expect(pos.getByRole('button', { name: 'APÊNDICE A – Roteiro de entrevista', exact: true })).toBeVisible();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Pergunta 1: como começou?');

  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as Documento;
  const ap = doc.posTextuais?.find((e) => e.tipo === 'apendice');
  expect(ap && 'titulo' in ap ? ap.titulo : null).toBe('Roteiro de entrevista');
  expect(JSON.stringify(ap && 'blocos' in ap ? ap.blocos : [])).toContain('Pergunta 1: como começou?');

  // Retirar e desfazer: volta com o conteúdo.
  await pos.getByRole('button', { name: 'Retirar APÊNDICE A – Roteiro de entrevista' }).click();
  await expect(pos.getByRole('button', { name: /^APÊNDICE A/ })).toHaveCount(0);
  await p.keyboard.press('Control+Z');
  await expect(pos.getByRole('button', { name: 'APÊNDICE A – Roteiro de entrevista', exact: true })).toBeVisible();
  await pos.getByRole('button', { name: 'APÊNDICE A – Roteiro de entrevista', exact: true }).click();
  await expect(editor).toContainText('Pergunta 1: como começou?');
  expect(x.problemas).toEqual([]);
});
