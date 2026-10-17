/**
 * UI-01 (parcial) e UI-02: as quatro faixas da casca (`docs/REFERENCIA_DE_LAYOUT.md`, seção 4) inteiras, empilhadas
 * e sem rolagem horizontal da janela mínima (1024×700) até maximizada, em 100%, 125% e 150% de escala; a janela não
 * encolhe abaixo do mínimo; Ctrl+F foca a busca; foco de teclado visível; nenhum nome de marca de terceiros.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrirApp, criarAmbiente, type AppAberto, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const FAIXAS = ['.barra', '.menus', '.nav', '.conteudo'] as const;

/** As faixas aparecem na ordem, sem sobreposição, na largura toda da área útil e sem rolagem horizontal. */
async function conferirFaixas(p: Page): Promise<{ largura: number; altura: number }> {
  const medidas = await p.evaluate((seletores) => {
    const caixas = seletores.map((s) => {
      const r = document.querySelector(s)?.getBoundingClientRect();
      return r ? { s, topo: r.top, base: r.bottom, esq: r.left, dir: r.right, altura: r.height } : { s, ausente: true };
    });
    const raiz = document.documentElement;
    return { caixas, largura: raiz.clientWidth, altura: raiz.clientHeight, rolagem: raiz.scrollWidth, rolagemV: raiz.scrollHeight };
  }, [...FAIXAS]);

  expect(medidas.rolagem, 'rolagem horizontal').toBeLessThanOrEqual(medidas.largura);
  expect(medidas.rolagemV, 'rolagem vertical da janela').toBeLessThanOrEqual(medidas.altura);
  let base = 0;
  for (const c of medidas.caixas) {
    expect(c, `${c.s} presente`).not.toHaveProperty('ausente');
    if ('ausente' in c) continue;
    expect(c.altura, `${c.s} com altura`).toBeGreaterThan(0);
    expect(c.topo, `${c.s} abaixo da anterior`).toBeGreaterThanOrEqual(base - 0.5);
    expect(c.esq, `${c.s} começa na borda`).toBeLessThanOrEqual(0.5);
    expect(c.dir, `${c.s} vai até a borda`).toBeGreaterThanOrEqual(medidas.largura - 0.5);
    base = c.base;
  }
  expect(base, 'conteúdo termina dentro da janela').toBeLessThanOrEqual(medidas.altura + 0.5);
  return { largura: medidas.largura, altura: medidas.altura };
}

const tamanhoDaJanela = (x: AppAberto) => x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getSize());

for (const escala of [1, 1.25, 1.5]) {
  test(`UI-01: faixas da janela mínima à maximizada, escala ${escala * 100}%`, async () => {
    const x = await abrirApp(amb, escala === 1 ? [] : [`--force-device-scale-factor=${escala}`]);
    const p = x.pagina;
    await expect(p.getByRole('button', { name: 'Criar primeiro trabalho' })).toBeVisible();
    expect(await x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle())).toBe('BiblioDocs Pro');

    // Pedir menos que o mínimo: a janela para no mínimo (minWidth/minHeight). No Windows a borda do quadro soma
    // alguns pixels à largura (medido: 1026×700 em 125%), então a conferência aceita até 8 px a mais.
    await x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(800, 500));
    await expect.poll(async () => (await tamanhoDaJanela(x))[1]).toBeLessThanOrEqual(708);
    const [largura, altura] = await tamanhoDaJanela(x);
    expect(largura).toBeGreaterThanOrEqual(1024);
    expect(largura).toBeLessThanOrEqual(1032);
    expect(altura).toBeGreaterThanOrEqual(700);
    const minima = await conferirFaixas(p);

    await x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.maximize());
    await expect.poll(() => x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized())).toBe(true);
    await expect.poll(() => p.evaluate(() => document.documentElement.clientWidth)).toBeGreaterThan(minima.largura);
    await conferirFaixas(p);

    await x.fechar();
    expect(x.problemas).toEqual([]);
  });
}

test('UI-01: Ctrl+F foca a busca, foco de teclado visível e sem marca de terceiros (UI-02)', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await expect(p.getByRole('button', { name: 'Criar primeiro trabalho' })).toBeVisible();

  await p.keyboard.press('Control+F');
  await expect(p.getByLabel('Buscar trabalhos pelo título ou nome do arquivo')).toBeFocused();
  // Cores esperadas lidas dos tokens (tokens.css), convertidas pelo próprio navegador para rgb().
  const [corFoco, corFocoBarras] = await p.evaluate(() =>
    ['--cor-foco', '--cor-foco-barras'].map((t) => {
      const amostra = document.createElement('i');
      amostra.style.color = `var(${t})`;
      document.body.append(amostra);
      const cor = getComputedStyle(amostra).color;
      amostra.remove();
      return cor;
    }),
  );
  const anelBusca = await p.locator('.busca').evaluate((e) => {
    const s = getComputedStyle(e);
    return { estilo: s.outlineStyle, cor: s.outlineColor };
  });
  expect(anelBusca).toEqual({ estilo: 'solid', cor: corFocoBarras });

  // Tab a partir da busca: o próximo controle mostra o anel de foco do token --cor-foco/--cor-foco-barras.
  await p.keyboard.press('Tab');
  const foco = await p.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    if (!e || e === document.body) return null;
    const s = getComputedStyle(e);
    // O Chromium arredonda a espessura do contorno para pixels inteiros do dispositivo (2 px em 125% → 1,6 px CSS).
    const pixelsDoDispositivo = parseFloat(s.outlineWidth) * window.devicePixelRatio;
    return { visivel: e.matches(':focus-visible'), estilo: s.outlineStyle, cor: s.outlineColor, pixelsDoDispositivo };
  });
  expect(foco).not.toBeNull();
  expect(foco!.visivel).toBe(true);
  expect(foco!.estilo).toBe('solid');
  expect([corFoco, corFocoBarras]).toContain(foco!.cor);
  expect(foco!.pixelsDoDispositivo).toBeGreaterThanOrEqual(1.99);

  // UI-02: nenhum nome ou marca da referência de layout na interface.
  const texto = await p.evaluate(() => `${document.title} ${document.body.innerText} ${[...document.querySelectorAll('[aria-label],[title],[alt]')].map((e) => `${e.getAttribute('aria-label')} ${e.getAttribute('title')} ${e.getAttribute('alt')}`).join(' ')}`);
  expect(texto).not.toMatch(/apple|itunes|maçã/i);

  await x.fechar();
  expect(x.problemas).toEqual([]);
});
