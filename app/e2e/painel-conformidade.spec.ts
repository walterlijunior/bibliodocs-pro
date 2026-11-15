/**
 * Aceite da Etapa 6 da especificação revista (painel de conformidade), com o trabalho das dez não conformidades do M7:
 * - filtrar só tabelas, depois só citações e fontes;
 * - a interface distingue o que o aplicativo verificou do que exige revisão, e explica a cobertura;
 * - "Ir ao local" abre o item; "Voltar ao relatório" refaz a verificação: a ocorrência corrigida some ("Resolvido") e a
 *   não corrigida continua, com o foco nela.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { IDENTIFICADOR_FORMATO, VERSAO_FORMATO_ATUAL, type Manifesto } from '../src/dominio/esquemas';
import { empacotarProjeto } from '../src/persistencia';
import { documentoDezFalhasM7, IMAGENS_CONFORMIDADE } from '../tests/corpus/conformidade';
import { abrirApp, criarAmbiente, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

test('Etapa 6 revista: filtros por categoria, verificado × revisar, corrigir pelo local e voltar ao relatório', async () => {
  const documento = documentoDezFalhasM7();
  documento.metadados.titulo = [{ tipo: 'texto', texto: 'Painel de conformidade' }];
  const midias = new Map(IMAGENS_CONFORMIDADE);
  const agora = '2026-11-15T00:00:00.000Z';
  const manifesto: Manifesto = {
    formato: IDENTIFICADOR_FORMATO, versaoFormato: VERSAO_FORMATO_ATUAL, appVersao: '0.1.0', id: documento.id,
    criadoEm: agora, atualizadoEm: agora, perfil: { id: 'uft-2022', versao: '1.0.0' }, tipoTrabalho: documento.tipoTrabalho,
    midias: [...midias].map(([sha256, dados]) => ({ caminho: `midias/${sha256}.png`, sha256, bytes: dados.length, tipo: 'image/png' as const })),
  };
  for (const [sha, dados] of midias) expect(createHash('sha256').update(dados).digest('hex')).toBe(sha);
  const r = empacotarProjeto({ manifesto, documento, midias });
  if (!r.ok) throw new Error('pacote inválido');
  writeFileSync(join(amb.trabalhos, 'Painel de conformidade.bdp'), r.bytes);

  const x = await abrirApp(amb);
  const p = x.pagina;
  await p.getByRole('option', { name: /^Painel de conformidade,/u }).dblclick();
  await expect(p.getByLabel('Título do trabalho')).toHaveValue('Painel de conformidade');
  await p.getByRole('tab', { name: 'Conformidade', exact: true }).click();
  const painel = p.getByRole('region', { name: 'Relatório de conformidade' });
  const itens = painel.locator('.conformidade__item');
  await expect(itens).toHaveCount(10);

  // Só tabelas: as duas da Norma Tabular.
  const categorias = painel.getByRole('group', { name: /^Categorias/ });
  await categorias.getByRole('checkbox', { name: /^Tabelas \(/ }).check();
  await expect(itens).toHaveCount(2);
  for (const c of await itens.all()) await expect(c).toHaveAttribute('data-categoria', 'tabelas');
  // Depois, só citações e fontes.
  await categorias.getByRole('checkbox', { name: /^Tabelas \(/ }).uncheck();
  await categorias.getByRole('checkbox', { name: /^Citações \(/ }).check();
  await categorias.getByRole('checkbox', { name: /^Fontes e referências \(/ }).check();
  await expect(itens).toHaveCount(2);
  await expect(painel).toContainText('Silva (2020)');
  for (const c of await itens.all()) expect(['citacoes', 'referencias']).toContain(await c.getAttribute('data-categoria'));
  await categorias.getByRole('button', { name: 'Mostrar todas as categorias' }).click();
  await expect(itens).toHaveCount(10);

  // Verificado × revisar, e o que cada verificação cobre.
  await expect(itens.getByText('Verificado pelo aplicativo', { exact: true })).toHaveCount(2);
  await expect(itens.getByText('Exige revisão sua', { exact: true })).toHaveCount(8);
  await painel.getByText('O que esta verificação cobre').click();
  await expect(painel.getByRole('table', { name: 'Cobertura das verificações' })).toContainText('Aplicado na exportação');

  // Ir ao local de uma ocorrência de tabela e voltar sem corrigir: continua, com o foco nela.
  const celula = itens.filter({ hasText: 'n/d' });
  await celula.getByRole('button', { name: 'Ir ao local' }).click();
  const voltar = p.getByRole('region', { name: 'Revisão de conformidade' });
  await expect(voltar).toBeVisible();
  await voltar.getByRole('button', { name: 'Voltar ao relatório' }).click();
  await expect(painel.getByRole('status').filter({ hasText: /^Ainda aparece:/ })).toBeVisible();
  await expect(painel.locator('.conformidade__item').filter({ hasText: 'n/d' })).toBeFocused();

  // Corrigir a ficha catalográfica pelo local e voltar: resolvida, e o relatório tem uma a menos.
  const ficha = painel.locator('.conformidade__item').filter({ hasText: 'Ficha catalográfica' });
  await ficha.getByRole('button', { name: 'Ir ao local' }).click();
  await p.getByLabel('Texto da ficha', { exact: true }).fill('Dados internacionais de catalogação na publicação (fictícios).');
  await p.getByRole('region', { name: 'Revisão de conformidade' }).getByRole('button', { name: 'Voltar ao relatório' }).click();
  await expect(painel.getByRole('status').filter({ hasText: /^Resolvido: Ficha catalográfica/ })).toBeVisible();
  await expect(painel.locator('.conformidade__item')).toHaveCount(9);
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
