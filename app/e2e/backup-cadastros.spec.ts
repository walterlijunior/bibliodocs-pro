/**
 * Etapa 10 da especificação de atualização — backup e restauração dos cadastros (D-E10-01), no Electron real:
 * uma instalação com uma instituição própria (logotipo, dois câmpus) grava o backup na pasta escolhida; uma instalação
 * limpa restaura e passa a ter a instituição no catálogo (`catalogo.json`); um arquivo inválido numa instalação com
 * dados é recusado e o catálogo continua igual.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { abrirApp, criarAmbiente, RAIZ_APP, type Ambiente } from './apoio/app';

const inicial = JSON.parse(readFileSync(join(RAIZ_APP, 'catalogos', 'catalogo-inicial.json'), 'utf8')) as { instituicoes: Record<string, unknown>[] };
const modelo = inicial.instituicoes[0]! as { campi: Record<string, unknown>[] };
const TESTE = {
  ...modelo,
  id: 'ins-teste',
  nome: 'Universidade de Teste',
  sigla: 'UT',
  logotipo: { sha256: 'a'.repeat(64), tipo: 'image/png', dados: 'iVBORw0KGgo=' },
  campi: [
    { ...modelo.campi[0], id: 'cam-norte', nome: 'Câmpus Norte', cursos: [] },
    { ...modelo.campi[0], id: 'cam-sul', nome: 'Câmpus Sul', cursos: [] },
  ],
};

const ambientes: Ambiente[] = [];
test.afterEach(async () => {
  for (const a of ambientes.splice(0)) a.apagar();
});

async function menu(p: Page, item: string): Promise<void> {
  await p.getByRole('menuitem', { name: 'Arquivo', exact: true }).click();
  await p.getByRole('menuitem', { name: item }).click();
}

test('Etapa 10: criar o backup numa instalação e restaurar numa instalação limpa; arquivo inválido não muda nada', async () => {
  // 1) Instalação com a instituição de teste.
  const a = criarAmbiente();
  ambientes.push(a);
  writeFileSync(join(a.dados, 'catalogo.json'), JSON.stringify({ catalogo: { formato: 'bibliodocs-catalogo', versao: 1, instituicoes: [...inicial.instituicoes, TESTE] }, removidos: [] }));
  const x = await abrirApp(a);
  const destino = join(a.raiz, 'pendrive-backup.bdbackup.json');
  await x.app.evaluate(({ dialog }, caminho) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: caminho })) as typeof dialog.showSaveDialog;
  }, destino);
  await menu(x.pagina, 'Criar backup de cadastros e configurações…');
  const criar = x.pagina.getByRole('dialog', { name: 'Criar backup de cadastros e configurações' });
  await expect(criar).toContainText('Não entram: trabalhos (.bdp)');
  await criar.getByRole('button', { name: 'Escolher onde gravar…' }).click();
  await expect(criar.getByRole('status')).toContainText('Backup gravado em “pendrive-backup.bdbackup.json”');
  expect(existsSync(destino)).toBe(true);
  const backup = readFileSync(destino, 'utf8');
  expect(JSON.parse(backup)).toMatchObject({ formato: 'bibliodocs-backup', versao: 1 });
  expect(backup).toContain('Universidade de Teste');
  await criar.getByRole('button', { name: 'Fechar' }).click();
  expect(x.problemas).toEqual([]);
  await x.app.close();

  // 2) Instalação limpa: restaurar.
  const b = criarAmbiente();
  ambientes.push(b);
  const y = await abrirApp(b);
  await menu(y.pagina, 'Restaurar backup de cadastros e configurações…');
  const rest = y.pagina.getByRole('dialog', { name: 'Restaurar backup de cadastros e configurações' });
  await rest.getByLabel('Arquivo de backup').setInputFiles(destino);
  await expect(rest.getByRole('region', { name: 'O que será restaurado' })).toContainText('Entram: Universidade de Teste (UT).');
  await rest.getByRole('button', { name: 'Restaurar' }).click();
  await expect(rest.getByRole('status')).toContainText('Cadastros restaurados.');
  await expect.poll(() => (existsSync(join(b.dados, 'catalogo.json')) ? readFileSync(join(b.dados, 'catalogo.json'), 'utf8') : '')).toContain('Câmpus Sul');
  const restaurado = readFileSync(join(b.dados, 'catalogo.json'), 'utf8');

  // 3) Arquivo inválido numa instalação com dados: recusado, catálogo igual.
  const invalido = join(b.raiz, 'quebrado.bdbackup.json');
  writeFileSync(invalido, '{"formato":"bibliodocs-backup","versao":1,"conteudo":{}}');
  await rest.getByLabel('Arquivo de backup').setInputFiles(invalido);
  await expect(rest.getByRole('status')).toContainText('Nada foi alterado.');
  expect(readFileSync(join(b.dados, 'catalogo.json'), 'utf8')).toBe(restaurado);

  // O cadastro restaurado aparece pelo acesso visível do menu Arquivo.
  await rest.getByRole('button', { name: 'Fechar' }).click();
  await menu(y.pagina, 'Cadastrar instituição (catálogo acadêmico)…');
  await expect(y.pagina.getByRole('dialog').getByRole('combobox', { name: 'Instituição' })).toContainText('Universidade de Teste (UT)');
  expect(y.problemas).toEqual([]);
});
