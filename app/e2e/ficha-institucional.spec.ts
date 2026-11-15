/**
 * Aceite da Etapa 3 da especificação de atualização, "Ficha institucional, contribuições e importação":
 * - a ficha de teste (uma instituição, dois câmpus, cursos distintos, uma disciplina, um docente e um manual) é importada
 *   com prévia; os filtros e os vínculos aparecem no seletor do trabalho;
 * - reimportar a mesma ficha não inclui nada;
 * - a ficha é exportada para outro computador (arquivo `.bdficha.json` válido);
 * - o perfil só aparece para uso depois de revisado e entra no trabalho pela prévia do modelo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const FONTE = { url: 'https://www.exemplo.edu.br/cursos', consultadoEm: '2026-11-14' };
const FICHA = {
  formato: 'bibliodocs-ficha-institucional',
  versao: 1,
  instituicao: { nome: 'Universidade Federal de Teste', sigla: 'UFTE' },
  fontes: { instituicao: FONTE, campi: FONTE, cursos: FONTE },
  campi: [
    { chave: 'norte', nome: 'Campus Norte', especie: 'campus', cidade: 'Araguaína', uf: 'TO' },
    { chave: 'sul', nome: 'Campus Sul', especie: 'campus', cidade: 'Gurupi', uf: 'TO' },
  ],
  cursos: [
    { chave: 'historia', nome: 'História', nivel: 'graduacao', grau: 'licenciatura', campi: ['norte', 'sul'] },
    { chave: 'agronomia', nome: 'Agronomia', nivel: 'graduacao', grau: 'bacharelado', campi: ['sul'] },
  ],
  disciplinas: [{ chave: 'metodologia', nome: 'Metodologia Científica', cursos: ['historia'] }],
  docentes: [{ chave: 'ana', nome: 'Ana Souza', titulacao: 'Dra.', cursos: ['historia', 'agronomia'] }],
  manuais: [{ chave: 'manual', titulo: 'Manual de Trabalhos Acadêmicos', url: 'https://www.exemplo.edu.br/manual.pdf', edicao: '2. ed.', data: '2024' }],
  perfis: [{ chave: 'perfil-tcc', nome: 'TCC da UFTE', manual: 'manual', secao: 'Seção 3.2', regras: { margemSuperiorCm: 2.5 }, instrucoes: ['No máximo 60 páginas.'], cursos: ['agronomia'], tipos: ['monografia'] }],
};

test('Etapa 3: importar a ficha com prévia, reimportar sem duplicar, exportar e usar o perfil revisado', async () => {
  const arquivo = join(amb.raiz, 'ficha-UFTE.bdficha.json');
  writeFileSync(arquivo, JSON.stringify(FICHA));
  const exportada = join(amb.raiz, 'exportada.bdficha.json');

  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('navigation', { name: 'Elementos pré-textuais' }).getByRole('button', { name: /^Capa/ }).click();

  // Importar: a prévia mostra o que entra e os vínculos; nada muda antes de "Incluir no catálogo".
  await p.getByRole('button', { name: 'Catálogo acadêmico…' }).click();
  const cat = p.getByRole('dialog', { name: 'Catálogo acadêmico' });
  await cat.getByLabel('Arquivo da ficha institucional').setInputFiles(arquivo);
  const previa = cat.getByRole('region', { name: /Prévia da importação/ });
  await expect(previa).toContainText('Incluir — Instituição: Universidade Federal de Teste (UFTE)');
  await expect(previa).toContainText('Agronomia (graduação) → Câmpus Campus Sul');
  await expect(previa.getByRole('group', { name: 'Campos que a ficha não traz' })).toContainText('logotipo');
  await previa.getByRole('button', { name: 'Incluir no catálogo' }).click();
  await expect(cat.getByRole('group', { name: 'Ficha institucional' }).getByRole('status').last()).toContainText('Ficha incluída no catálogo');
  await expect(cat.getByLabel('Instituição', { exact: true })).toHaveValue(/ufte|universidade-federal-de-teste/);

  // O perfil chega sem revisão; as regras e a fonte aparecem antes de marcar.
  await expect(cat).toContainText('TCC da UFTE — ainda não revisado');
  await cat.getByRole('button', { name: 'Ver as regras' }).click();
  await expect(cat).toContainText('Fonte: Manual de Trabalhos Acadêmicos, 2. ed., Seção 3.2');
  await expect(cat.getByRole('row', { name: /^Margem superior/ })).toContainText('2,5 cm');
  await cat.getByRole('button', { name: 'Marcar como revisado' }).click();
  await expect(cat).toContainText('TCC da UFTE — revisado');
  await cat.getByRole('button', { name: 'Guardar' }).click();
  await expect(cat).toHaveCount(0);
  expect(readFileSync(join(amb.dados, 'catalogo.json'), 'utf8')).toContain('Universidade Federal de Teste');

  // Reimportar a mesma ficha: nada entra; exportar grava uma ficha válida com os mesmos registros.
  await p.getByRole('button', { name: 'Catálogo acadêmico…' }).click();
  await cat.getByLabel('Instituição', { exact: true }).selectOption({ label: 'Universidade Federal de Teste (UFTE)' });
  await cat.getByLabel('Arquivo da ficha institucional').setInputFiles(arquivo);
  await expect(previa).toContainText('nada será incluído nem alterado');
  await expect(previa.getByRole('button', { name: 'Incluir no catálogo' })).toBeDisabled();
  await previa.getByRole('button', { name: 'Cancelar importação' }).click();
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, exportada);
  await cat.getByRole('button', { name: 'Exportar ficha da UFTE…' }).click();
  await expect(cat.getByRole('group', { name: 'Ficha institucional' }).getByRole('status').last()).toContainText('exportada.bdficha.json');
  const ficha = JSON.parse(readFileSync(exportada, 'utf8')) as typeof FICHA;
  expect(ficha.formato).toBe('bibliodocs-ficha-institucional');
  expect(ficha.campi).toHaveLength(2);
  expect(ficha.cursos.map((c) => c.nome).sort()).toEqual(['Agronomia', 'História']);
  expect(ficha.docentes).toHaveLength(1);
  await cat.getByRole('button', { name: 'Cancelar' }).click();

  // Os filtros e os vínculos no trabalho: Campus Sul tem Agronomia; a docente vale nos dois cursos.
  await p.getByLabel('Instituição do catálogo').selectOption({ label: 'Universidade Federal de Teste (UFTE)' });
  await p.getByLabel('Câmpus ou polo do catálogo').selectOption({ label: 'Campus Norte' });
  await expect(p.getByLabel('Curso ou programa do catálogo').locator('option')).toHaveText(['Escolha…', 'História (graduação)']);
  await p.getByLabel('Câmpus ou polo do catálogo').selectOption({ label: 'Campus Sul' });
  await p.getByLabel('Curso ou programa do catálogo').selectOption({ label: 'Agronomia (graduação)' });
  await expect(p.getByLabel('Local')).toHaveValue('Gurupi, TO');

  // O perfil revisado aparece no painel do modelo e entra pela prévia.
  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: 'Modelo de evento (DOCX)…' }).click();
  const painel = p.locator('.modelo-evento');
  await painel.getByRole('button', { name: 'Usar este perfil' }).click();
  await expect(painel.getByRole('row', { name: /^Margem superior/ })).toContainText('2,5 cm');
  await expect(painel).toContainText('No máximo 60 páginas.');
  await painel.getByRole('button', { name: 'Aplicar ao trabalho' }).click();
  await expect(painel.getByRole('status')).toContainText('aplicado');
  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  const doc = JSON.parse(lerDocumento(join(amb.trabalhos, arquivosBdp(amb)[0]!)).json) as { modelo?: { nome: string; regras: Record<string, unknown> } };
  expect(doc.modelo).toMatchObject({ nome: 'TCC da UFTE (UFTE)', regras: { margemSuperiorCm: 2.5 } });
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
