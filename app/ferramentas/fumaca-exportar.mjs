// Fumaça do pacote (M3-T11): dirige o .exe de `npm run dist:fumaca` por CDP e exporta um DOCX de verdade, com fuses e ASAR
// ligados. Dados em pasta temporária. O destino vem de BIBLIODOCS_FUMACA_DESTINO_DOCX, que só o artefato de fumaça lê.
// Encerra só o processo que ele mesmo abriu. Uso: npm run fumaca:exportar
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

const raizApp = resolve(import.meta.dirname, '..');
const exe = join(raizApp, 'release-fumaca', 'win-unpacked', 'BiblioDocs Pro.exe');
if (!existsSync(exe)) throw new Error('Rode antes `npm run dist:fumaca`.');
const raiz = mkdtempSync(join(tmpdir(), 'bdp-fumaca-'));
const dados = join(raiz, 'local', 'BiblioDocsPro');
const trabalhos = join(raiz, 'trabalhos');
const destino = join(raiz, 'saida.docx');
mkdirSync(dados, { recursive: true });
mkdirSync(trabalhos);
writeFileSync(join(dados, 'preferencias.json'), JSON.stringify({ formato: 'bibliodocs-preferencias', versao: 1, pastaBiblioteca: trabalhos }));
const porta = 9334;
const filho = spawn(exe, [`--remote-debugging-port=${porta}`, `--user-data-dir=${join(raiz, 'perfil')}`], {
  env: { ...process.env, LOCALAPPDATA: join(raiz, 'local'), BIBLIODOCS_FUMACA_DESTINO_DOCX: destino },
  stdio: 'ignore',
});
let sucesso = false;
try {
  let navegador;
  for (let i = 0; i < 40 && !navegador; i++) {
    await new Promise((r) => setTimeout(r, 500));
    navegador = await chromium.connectOverCDP(`http://127.0.0.1:${porta}`).catch(() => undefined);
  }
  if (!navegador) throw new Error('o .exe não abriu a porta de depuração');
  const pagina = navegador.contexts()[0].pages()[0];
  await pagina.getByRole('button', { name: 'Criar primeiro trabalho' }).click();
  await pagina.getByRole('dialog', { name: 'Novo trabalho' }).getByRole('button', { name: 'Criar trabalho' }).click();
  await pagina.getByLabel('Título do trabalho').fill('Trabalho do pacote');
  await pagina.keyboard.press('Control+E');
  const dialogo = pagina.getByRole('dialog', { name: 'Exportar DOCX' });
  const inicio = Date.now();
  await dialogo.getByRole('button', { name: 'Exportar…' }).click();
  await dialogo.getByRole('status').filter({ hasText: 'foi exportado' }).waitFor({ timeout: 60_000 });
  const doc = strFromU8(unzipSync(new Uint8Array(readFileSync(destino)))['word/document.xml']);
  if (!doc.includes('Trabalho do pacote')) throw new Error('o título não está no arquivo');
  console.log(`[fumaca] exportou pelo pacote em ${Date.now() - inicio} ms, ${readFileSync(destino).length} bytes`);
  await navegador.close();
  sucesso = true;
} finally {
  try {
    execFileSync('taskkill', ['/PID', String(filho.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    // já saiu
  }
  await new Promise((r) => setTimeout(r, 1000));
  rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
process.exit(sucesso ? 0 : 1);
