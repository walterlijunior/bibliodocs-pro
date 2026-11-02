/**
 * RNF-04 / FUN-10: encerrar o processo durante a edição (`taskkill /F /T`) e reabrir oferece a versão da última
 * alteração (instantâneo de até ~2 s antes); "Recuperar" e "Abrir o arquivo salvo"; fechamento normal sem oferta.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { abrirApp, arquivosBdp, criarAmbiente, criarTrabalho, lerDocumento, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const listar = (pasta: string): string[] => (existsSync(pasta) ? readdirSync(pasta) : []);

/** `recuperacao\<id>\atual.bdp`, se houver. */
function instantaneoAtual(amb: Ambiente): string | null {
  const pasta = join(amb.dados, 'recuperacao');
  for (const id of listar(pasta)) {
    const atual = join(pasta, id, 'atual.bdp');
    if (existsSync(atual)) return atual;
  }
  return null;
}

/** Espera o instantâneo trazer `titulo`; devolve o atraso medido pela data de gravação do `atual.bdp`. */
async function esperarInstantaneo(amb: Ambiente, titulo: string, desde: number): Promise<number> {
  await expect
    .poll(
      () => {
        const atual = instantaneoAtual(amb);
        try {
          return atual ? lerDocumento(atual).titulo : null;
        } catch {
          return null; // gravação em andamento
        }
      },
      { timeout: 10_000, intervals: [100] },
    )
    .toBe(titulo);
  return statSync(instantaneoAtual(amb)!).mtimeMs - desde;
}

const QUANDO = String.raw`(\d\d:\d\d|\d\d/\d\d/\d{4} às \d\d:\d\d)`;
const OFERTA = new RegExp(`^O BiblioDocs Pro foi fechado inesperadamente com .+ aberto\\. Recuperar a versão de ${QUANDO}\\?$`);

async function conferirOferta(p: Page): Promise<void> {
  await expect(p.getByText(OFERTA)).toBeVisible();
  for (const botao of ['Recuperar', 'Abrir o arquivo salvo', 'Decidir depois']) {
    await expect(p.getByRole('button', { name: botao, exact: true })).toBeVisible();
  }
}

test('RNF-04: matar o processo durante a edição e recuperar a última alteração', async () => {
  // 1. Trabalho salvo, depois uma alteração que só está na memória (e no instantâneo).
  const a = await abrirApp(amb);
  const campoA = a.pagina.getByLabel('Título do trabalho');
  await criarTrabalho(a.pagina);
  await campoA.fill('Versão salva');
  await a.pagina.keyboard.press('Control+S');
  await expect(a.pagina.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  const arquivo = join(amb.trabalhos, arquivosBdp(amb)[0]!);

  const alterado = Date.now();
  await campoA.fill('Versão da memória');
  const atraso = await esperarInstantaneo(amb, 'Versão da memória', alterado);
  test.info().annotations.push({ type: 'instantâneo', description: `${Math.round(atraso)} ms depois da alteração` });
  expect(atraso).toBeLessThan(3_000); // ~2 s do ADR-0004 mais a gravação (pelo mtime, sem a espera do teste)
  expect(listar(join(amb.dados, 'sessao')).filter((n) => n.endsWith('.lock'))).toHaveLength(1);

  await a.matar();
  expect(lerDocumento(arquivo).titulo).toBe('Versão salva');

  // 2. Reabrir → oferta → Recuperar: o texto da memória volta como alteração não salva.
  const b = await abrirApp(amb);
  await conferirOferta(b.pagina);
  await b.pagina.getByRole('button', { name: 'Recuperar', exact: true }).click();
  const campoB = b.pagina.getByLabel('Título do trabalho');
  await expect(campoB).toHaveValue('Versão da memória');
  await expect(b.pagina.locator('.visor [role="status"]')).toHaveText('Alterações não salvas');
  await expect(b.pagina.getByText(/^Versão recuperada de /)).toBeVisible();
  await b.pagina.keyboard.press('Control+S');
  await expect(b.pagina.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  expect(lerDocumento(arquivo).titulo).toBe('Versão da memória');
  await expect.poll(() => instantaneoAtual(amb)).toBeNull(); // gravar no arquivo apaga os instantâneos

  // 3. Segunda queda → "Abrir o arquivo salvo": abre o arquivo e guarda o instantâneo (não apaga).
  const alterado2 = Date.now();
  await campoB.fill('Segunda queda');
  await esperarInstantaneo(amb, 'Segunda queda', alterado2);
  await b.matar();

  const c = await abrirApp(amb);
  await conferirOferta(c.pagina);
  await c.pagina.getByRole('button', { name: 'Abrir o arquivo salvo', exact: true }).click();
  await expect(c.pagina.getByLabel('Título do trabalho')).toHaveValue('Versão da memória');
  await expect(c.pagina.locator('.visor [role="status"]')).toHaveText(/^Salvo/);
  expect(instantaneoAtual(amb)).toBeNull();
  expect(listar(join(amb.dados, 'recuperacao-antigos')).length).toBeGreaterThan(0);
  await c.pagina.keyboard.press('Control+W');
  await c.fechar();

  // 4. Fechamento normal: sem trava nem oferta na próxima abertura.
  expect(listar(join(amb.dados, 'sessao')).filter((n) => n.endsWith('.lock'))).toEqual([]);
  const d = await abrirApp(amb);
  await expect(d.pagina.getByRole('option', { name: /^Versão da memória,/ })).toBeVisible();
  await expect(d.pagina.getByText(OFERTA)).toHaveCount(0);
  await expect(d.pagina.getByRole('button', { name: 'Recuperar', exact: true })).toHaveCount(0);
  await d.fechar();

  for (const x of [a, b, c, d]) expect(x.problemas).toEqual([]);
});

test('Versões descartadas: abre como trabalho sem arquivo e não altera nada (M2-T11)', async () => {
  const a = await abrirApp(amb);
  await criarTrabalho(a.pagina);
  await a.pagina.getByLabel('Título do trabalho').fill('Versão guardada');
  await a.pagina.keyboard.press('Control+S');
  await expect(a.pagina.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  await a.fechar();

  const arquivo = join(amb.trabalhos, arquivosBdp(amb)[0]!);
  const antigos = join(amb.dados, 'recuperacao-antigos');
  mkdirSync(antigos, { recursive: true });
  const guardado = join(antigos, 'prj-20261102-120000-atual.bdp');
  copyFileSync(arquivo, guardado);
  const [bytesArquivo, bytesGuardado] = [readFileSync(arquivo), readFileSync(guardado)];

  const b = await abrirApp(amb);
  await b.pagina.getByRole('menuitem', { name: 'Arquivo' }).click();
  await b.pagina.getByRole('menuitem', { name: 'Versões descartadas…' }).click();
  await b.pagina.getByRole('button', { name: /^Abrir a versão de .* de Versão guardada$/ }).click();
  await expect(b.pagina.getByLabel('Título do trabalho')).toHaveValue('Versão guardada');
  await expect(b.pagina.getByText(/^Versão descartada de /)).toBeVisible();
  expect(readFileSync(arquivo).equals(bytesArquivo)).toBe(true);
  expect(readFileSync(guardado).equals(bytesGuardado)).toBe(true);
});
