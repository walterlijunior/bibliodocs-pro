/**
 * RNF-02/RNF-03 (R23): zero atividade de rede num uso completo, pelo net-log do Chromium (nenhuma resolução de nome,
 * nenhum socket, só URLs `app://`). SEG-03 (achado M-1 do M1-T02): as defesas do runtime no Electron real.
 * Rodar a cada troca de versão do Electron.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { abrirApp, atividadeDeRede, criarAmbiente, criarTrabalho, RAIZ_APP, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

/** Nenhuma resolução de nome, socket nem requisição de URL de rede no net-log (as `app://` não aparecem nele). */
function semRede(netLog: string): void {
  const rede = atividadeDeRede(netLog);
  // Controle positivo: o net-log foi gravado e tem os eventos de configuração da pilha de rede.
  expect([...rede.tipos], 'net-log capturado').toEqual(expect.arrayContaining(['PROXY_CONFIG_CHANGED', 'DNS_CONFIG_CHANGED']));
  expect(rede.resolucoes, 'resoluções de nome').toEqual([]);
  expect(rede.sockets, 'sockets').toEqual([]);
  expect(rede.urls, 'requisições de URL').toEqual([]);
}

test('zero requisições de rede: criar, salvar, buscar, fechar e reabrir', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Trabalho sem rede');
  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);
  await p.keyboard.press('Control+W');
  await p.keyboard.press('Control+F');
  await p.keyboard.type('sem rede');
  await expect(p.getByRole('option', { name: /^Trabalho sem rede,/ })).toBeVisible();
  await p.keyboard.press('Escape');
  await p.getByRole('option', { name: /^Trabalho sem rede,/ }).dblclick();
  await expect(p.getByLabel('Título do trabalho')).toHaveValue('Trabalho sem rede');
  // Heurística: tempo para as verificações de fundo do Chromium (proxy, DNS, IPv6) aparecerem. Sem a chave
  // `no-proxy-server` elas surgem já na abertura (mutação detectada no M1-T13).
  await p.waitForTimeout(3_000);
  await x.fechar();

  semRede(x.netLog);
  expect(x.recursos).toContain('app://interface/index.html');
  for (const r of [...x.recursos, ...x.requisicoes]) expect(r).toMatch(/^app:\/\/interface\//);
  expect(x.problemas).toEqual([]);
});

test('SEG-03: CSP, rede, navegação, janelas, protocolo app:// e instância única no Electron real', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await expect(p.getByRole('button', { name: 'Criar primeiro trabalho' })).toBeVisible();
  const urlInicial = p.url();
  expect(x.recursos.filter((r) => !r.startsWith('app://interface/'))).toEqual([]);
  expect(urlInicial).toBe('app://interface/index.html');

  // Renderer sem Node e só com a API do preload.
  const globais = await p.evaluate(() => ({
    require: typeof (globalThis as Record<string, unknown>)['require'],
    process: typeof (globalThis as Record<string, unknown>)['process'],
    module: typeof (globalThis as Record<string, unknown>)['module'],
    api: Object.keys((globalThis as unknown as { bibliodocs: object }).bibliodocs).sort(),
  }));
  expect(globais).toEqual({ require: 'undefined', process: 'undefined', module: 'undefined', api: ['biblioteca', 'edicao', 'exportacao', 'projetos', 'recuperacao'] });

  // C-4: a CSP de produção vem no cabeçalho do protocolo; script inline e eval são bloqueados.
  const sondasCsp = await p.evaluate(async () => {
    const violacoes: string[] = [];
    document.addEventListener('securitypolicyviolation', (e) => violacoes.push(e.effectiveDirective));
    const s = document.createElement('script');
    s.textContent = 'window.__inline = 1;';
    document.head.append(s);
    // O `eval` roda numa tarefa posterior: durante a própria avaliação do CDP (`Runtime.evaluate`/`callFunctionOn`)
    // o DevTools libera o eval por padrão (`allowUnsafeEvalBlockedByCSP`), o que mascararia a CSP.
    const evalBloqueado = await new Promise<boolean>((ok) =>
      setTimeout(() => {
        try {
          (0, eval)('1');
          ok(false);
        } catch {
          ok(true);
        }
      }, 0),
    );
    const functionBloqueado = await new Promise<boolean>((ok) =>
      setTimeout(() => {
        try {
          new Function('return 1')();
          ok(false);
        } catch {
          ok(true);
        }
      }, 0),
    );
    await new Promise((ok) => setTimeout(ok, 100));
    const resposta = await fetch('app://interface/index.html');
    return {
      inline: (window as unknown as { __inline?: number }).__inline ?? null,
      evalBloqueado,
      functionBloqueado,
      violacoes,
      csp: resposta.headers.get('content-security-policy'),
    };
  });
  expect(sondasCsp.inline).toBeNull();
  expect(sondasCsp.evalBloqueado).toBe(true);
  expect(sondasCsp.functionBloqueado).toBe(true);
  expect(sondasCsp.violacoes).toEqual(expect.arrayContaining(['script-src-elem', 'script-src']));
  expect(sondasCsp.violacoes.filter((v) => v === 'script-src')).toHaveLength(2); // eval e new Function
  expect(sondasCsp.csp).toContain("default-src 'none'");
  expect(sondasCsp.csp).toContain("script-src 'self'");

  // C-8: fetch remoto falha. C-3: a raiz servida é `out/interface`; os alvos de travessia EXISTEM ao lado dela
  // (`out/preload/index.cjs`, `out/principal/index.js`, `app/package.json`), então só uma recusa real dá != 200.
  // Medido no M1-T13: como `app` é esquema padrão, o Chromium resolve `%2e%2e` antes do pedido (a URL fica dentro
  // de `app://interface/` e dá 404); `%5c` e `%252e` chegam ao manipulador e dão 400. As checagens de `..` e da raiz
  // em `protocolo-caminho.ts` são defesa em profundidade, provadas pelos testes de unidade (SEG-01).
  const sondasRede = await p.evaluate(async () => {
    const status = async (url: string) => {
      try {
        return (await fetch(url)).status;
      } catch {
        return 'falhou';
      }
    };
    const travessias = [
      'app://interface/%2e%2e/preload/index.cjs',
      'app://interface/%2e%2e/principal/index.js',
      'app://interface/%2e%2e/%2e%2e/package.json',
      'app://interface/..%5cpreload%5cindex.cjs',
      'app://interface/assets/%2e%2e/%2e%2e/%2e%2e/package.json',
      'app://interface/%252e%252e/preload/index.cjs',
    ];
    return {
      remoto: await status('https://example.com/'),
      controle: await status('app://interface/index.html'),
      travessias: await Promise.all(travessias.map(async (u) => ({ u, normalizada: new URL(u).href, st: await status(u) }))),
      inexistente: await status('app://interface/nao-existe.js'),
    };
  });
  expect(sondasRede.remoto).toBe('falhou');
  // C-8 sem a CSP no caminho: o `net.fetch` do processo principal passa pelo filtro `webRequest` da sessão.
  const doPrincipal = await x.app.evaluate(async ({ net }) => {
    try {
      return `status ${(await net.fetch('https://example.com/')).status}`;
    } catch (e) {
      return String(e);
    }
  });
  expect(doPrincipal).toMatch(/ERR_BLOCKED_BY_CLIENT/);
  expect(sondasRede.controle).toBe(200);
  for (const t of sondasRede.travessias) {
    expect(t.normalizada, t.u).toMatch(/^app:\/\/interface\//);
    expect(t.normalizada, t.u).not.toMatch(/\/\.\.(\/|$)/);
    expect([400, 404], t.u).toContain(t.st);
  }
  // As que chegam cruas ao manipulador são recusadas por ele (400), não por falta de arquivo.
  expect(sondasRede.travessias.filter((t) => t.normalizada === t.u).map((t) => t.st)).toEqual([400, 400]);
  expect(sondasRede.inexistente).toBe(404);


  // C-5: window.open não cria janela; navegação para fora é barrada no `will-frame-navigate`/`will-navigate` (o
  // `webRequest` também a barraria, então a prova é o `defaultPrevented` visto por um ouvinte registrado depois do ouvinte do app).
  expect(await p.evaluate(() => window.open('https://example.com/') === null)).toBe(true);
  expect(await p.evaluate(() => window.open('app://interface/index.html') === null)).toBe(true);
  await x.app.evaluate(({ BrowserWindow }) => {
    const g = globalThis as unknown as { __navegacoes: string[] };
    g.__navegacoes = [];
    const conteudo = BrowserWindow.getAllWindows()[0]!.webContents;
    // O app barra já no `will-frame-navigate` (emitido antes); o `will-navigate` só chega se aquele deixar passar.
    for (const evento of ['will-frame-navigate', 'will-navigate'] as const) {
      conteudo.on(evento as 'will-navigate', (e) => g.__navegacoes.push(`${e.defaultPrevented ? 'barrada' : 'LIBERADA'} ${e.url}`));
    }
    conteudo.on('did-navigate', (_e, url) => g.__navegacoes.push(`navegou ${url}`));
  });
  await p.evaluate(() => {
    window.location.href = 'https://example.com/';
  });
  await p.evaluate(() => {
    window.location.href = 'file:///C:/Windows/win.ini';
  });
  await p.waitForTimeout(1_000);
  const navegacoes = await x.app.evaluate(() => (globalThis as unknown as { __navegacoes: string[] }).__navegacoes);
  expect(navegacoes).toContain('barrada https://example.com/');
  for (const n of navegacoes) expect(n).toMatch(/^barrada /);
  expect(p.url()).toBe(urlInicial);
  expect(x.app.windows()).toHaveLength(1);
  expect(await x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);

  // C-22: segunda instância (mesmo perfil) sai sozinha com código 0; a primeira, minimizada, é restaurada.
  await x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.minimize());
  await expect.poll(() => x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMinimized())).toBe(true);
  const caminhoElectron = createRequire(__filename)('electron') as string;
  const segunda = spawn(caminhoElectron, [...amb.argsBase], { cwd: RAIZ_APP, env: amb.env, stdio: 'ignore' });
  const codigo = await new Promise<number | null>((ok, falha) => {
    const prazo = setTimeout(() => {
      try {
        execFileSync('taskkill', ['/F', '/T', '/PID', String(segunda.pid)], { stdio: 'ignore' });
      } catch {
        /* já saiu */
      }
      falha(new Error('A segunda instância não saiu em 15 s.'));
    }, 15_000);
    segunda.once('exit', (c) => {
      clearTimeout(prazo);
      ok(c);
    });
  });
  expect(codigo).toBe(0);
  expect(await x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await expect.poll(() => x.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMinimized())).toBe(false);

  await x.fechar();
  // Mesmo com as sondas acima, nada chegou à rede (o bloqueio é antes da resolução de nome).
  semRede(x.netLog);
  // Os únicos problemas registrados são os provocados pelas sondas: violações de CSP e as recusas 400/404.
  for (const problema of x.problemas) {
    expect(problema).toMatch(/Content Security Policy|Failed to load resource: .*status of (400|404)|ERR_BLOCKED_BY_CLIENT|Failed to fetch|Not allowed to load local resource: file:/);
  }
});
