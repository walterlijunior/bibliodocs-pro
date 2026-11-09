/**
 * FUN-09 (M7-T04, aceite do RF-15, D-M7-05): no Electron real, o trabalho com dez não conformidades plantadas mostra as
 * dez na janela, e o controle correto não mostra nenhuma.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { IDENTIFICADOR_FORMATO, VERSAO_FORMATO_ATUAL, type Manifesto } from '../src/dominio/esquemas';
import type { Documento } from '../src/dominio/modelo';
import { empacotarProjeto } from '../src/persistencia';
import { documentoCorretoM7, documentoDezFalhasM7, IMAGENS_CONFORMIDADE } from '../tests/corpus/conformidade';
import { abrirApp, criarAmbiente, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

function gravar(nome: string, documento: Documento): void {
  const midias = new Map(IMAGENS_CONFORMIDADE);
  const agora = '2026-11-08T00:00:00.000Z';
  const manifesto: Manifesto = {
    formato: IDENTIFICADOR_FORMATO, versaoFormato: VERSAO_FORMATO_ATUAL, appVersao: '0.1.0', id: documento.id,
    criadoEm: agora, atualizadoEm: agora, perfil: { id: 'uft-2022', versao: '1.0.0' }, tipoTrabalho: documento.tipoTrabalho,
    midias: [...midias].map(([sha256, dados]) => ({ caminho: `midias/${sha256}.png`, sha256, bytes: dados.length, tipo: 'image/png' as const })),
  };
  for (const [sha, dados] of midias) expect(createHash('sha256').update(dados).digest('hex')).toBe(sha);
  const r = empacotarProjeto({ manifesto, documento, midias });
  if (!r.ok) throw new Error(`pacote inválido: ${nome}`);
  writeFileSync(join(amb.trabalhos, `${nome}.bdp`), r.bytes);
}

test('FUN-09 (M7-T04): dez não conformidades detectadas e controle correto sem nenhuma', async () => {
  const falho = documentoDezFalhasM7();
  falho.metadados.titulo = [{ tipo: 'texto', texto: 'Aceite com falhas' }];
  gravar('Aceite com falhas', falho);
  const correto = { ...documentoCorretoM7(), id: 'prj_conformidade0002' };
  correto.metadados.titulo = [{ tipo: 'texto', texto: 'Aceite correto' }];
  gravar('Aceite correto', correto);

  const x = await abrirApp(amb);
  const p = x.pagina;
  const dialogo = p.getByRole('dialog', { name: 'Verificar conformidade' });

  await p.getByRole('option', { name: /^Aceite com falhas,/u }).dblclick();
  await expect(p.getByLabel('Título do trabalho')).toHaveValue('Aceite com falhas');
  await p.getByRole('button', { name: 'Verificar conformidade' }).click();
  await expect(dialogo.getByRole('status').first()).toHaveText('2 pendências e 8 avisos.');
  await expect(dialogo.getByRole('listitem')).toHaveCount(10);
  for (const grupo of ['Elementos pré-textuais (1)', 'Texto e seções (2)', 'Citações e referências (2)', 'Tabelas, quadros, ilustrações e equações (2)', 'Apresentação das tabelas (Norma Tabular do IBGE) (2)', 'Siglas (1)']) {
    await expect(dialogo.getByRole('heading', { name: grupo, exact: true })).toBeVisible();
  }
  await dialogo.getByRole('button', { name: 'Fechar' }).click();
  await expect(dialogo).toBeHidden();
  await x.fechar();

  const y = await abrirApp(amb);
  await y.pagina.getByRole('option', { name: /^Aceite correto,/u }).dblclick();
  await expect(y.pagina.getByLabel('Título do trabalho')).toHaveValue('Aceite correto');
  await y.pagina.getByRole('button', { name: 'Verificar conformidade' }).click();
  const d2 = y.pagina.getByRole('dialog', { name: 'Verificar conformidade' });
  await expect(d2.getByRole('status').first()).toHaveText('Nenhuma pendência encontrada nas verificações executadas.');
  await expect(d2.getByRole('listitem')).toHaveCount(0);
  await y.fechar();
});
