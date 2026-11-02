/**
 * Apoio dos testes E2E (M1-T13; ADR-0006, camada 8): abre o build de produção (`out/`, servido por `app://`) num
 * Electron dirigido pelo Playwright, com os dados isolados numa pasta temporária.
 *
 * - `LOCALAPPDATA` redirecionado: biblioteca.json, preferências, recuperação, backups e trava de sessão ficam na pasta
 *   do teste (o app lê a variável em `pastaDadosLocais`); `preferencias.json` aponta a biblioteca para `trabalhos\`.
 * - Cada abertura grava um net-log do Chromium (`--log-net-log`), lido por `atividadeDeRede`.
 * - Perfil do Chromium (`userData`, onde fica também a trava da instância única) em `perfil\` com `--user-data-dir`:
 *   nada vai para `%APPDATA%\BiblioDocs Pro` do usuário, e os E2E rodam mesmo com o app aberto (revisão do M1-T13).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { textoPlano, type Inline } from '../../src/dominio/modelo';

export const RAIZ_APP = resolve(__dirname, '..', '..');

export interface Ambiente {
  readonly raiz: string;
  /** Valor de `LOCALAPPDATA` para o app. */
  readonly local: string;
  /** `LOCALAPPDATA\BiblioDocsPro`. */
  readonly dados: string;
  /** Pasta da biblioteca. */
  readonly trabalhos: string;
  /** Chaves e variáveis que todo Electron deste ambiente recebe (também a segunda instância). */
  readonly argsBase: readonly string[];
  readonly env: Record<string, string>;
  /** Encerra o que o teste deixou aberto (falha no meio) e apaga a pasta. */
  apagar(): Promise<void>;
}

/** Processos abertos por ambiente, para a limpeza encerrar o que uma falha deixou aberto. */
const abertos = new WeakMap<Ambiente, Set<AppAberto>>();

export function criarAmbiente(): Ambiente {
  if (!existsSync(join(RAIZ_APP, 'out', 'principal', 'index.js'))) {
    throw new Error('Build ausente: rode `npm run build` antes (o `npm run test:e2e` já faz isso).');
  }
  const raiz = mkdtempSync(join(tmpdir(), 'bdp-e2e-'));
  const local = join(raiz, 'local');
  const dados = join(local, 'BiblioDocsPro');
  const trabalhos = join(raiz, 'trabalhos');
  mkdirSync(dados, { recursive: true });
  mkdirSync(trabalhos);
  writeFileSync(
    join(dados, 'preferencias.json'),
    JSON.stringify({ formato: 'bibliodocs-preferencias', versao: 1, pastaBiblioteca: trabalhos }),
  );
  // Sem ELECTRON_RENDERER_URL: sempre o build de produção (`app://`), nunca o servidor dev.
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && e[0] !== 'ELECTRON_RENDERER_URL'),
  );
  const amb: Ambiente = {
    raiz,
    local,
    dados,
    trabalhos,
    argsBase: ['.', `--user-data-dir=${join(raiz, 'perfil')}`],
    env: { ...env, LOCALAPPDATA: local },
    async apagar() {
      for (const x of abertos.get(amb) ?? []) await x.matar();
      rmSync(raiz, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    },
  };
  abertos.set(amb, new Set());
  return amb;
}

export interface AppAberto {
  readonly app: ElectronApplication;
  readonly pagina: Page;
  readonly pid: number;
  readonly netLog: string;
  /** Erros de console, exceções da página e violações de CSP desde a abertura. */
  readonly problemas: string[];
  /** URLs pedidas pela página depois da abertura (o ouvinte entra quando a página já carregou). */
  readonly requisicoes: string[];
  /** Documento e recursos da carga inicial (`performance`), lidos na abertura: controle positivo de `requisicoes`. */
  readonly recursos: string[];
  /** Fecha a janela como o usuário (a recuperação termina antes de sair) e espera o processo acabar. */
  fechar(): Promise<void>;
  /** Encerramento inesperado: `taskkill /F /T` na árvore do processo. */
  matar(): Promise<void>;
}

let aberturas = 0;

/** `argsExtras`: chaves do Chromium para este teste (ex.: `--force-device-scale-factor=1.5`). */
export async function abrirApp(amb: Ambiente, argsExtras: readonly string[] = []): Promise<AppAberto> {
  const netLog = join(amb.raiz, `net-${++aberturas}.json`);
  const app = await _electron.launch({ args: [...amb.argsBase, `--log-net-log=${netLog}`, ...argsExtras], cwd: RAIZ_APP, env: amb.env });
  const processo = app.process();
  const pid = processo.pid;
  if (pid === undefined) throw new Error('O Electron não informou o pid.');
  const terminou = new Promise<void>((ok) => (processo.exitCode !== null ? ok() : processo.once('exit', () => ok())));
  let vivo = true;
  void terminou.then(() => (vivo = false));
  const encerrarArvore = async () => {
    // O processo pode sair entre a conferência e o taskkill: falha do taskkill não interrompe a limpeza.
    try {
      if (vivo) execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
    } catch {
      /* já saiu */
    }
    await terminou;
  };

  let pagina: Page;
  try {
    pagina = await app.firstWindow();
    await pagina.waitForLoadState('domcontentloaded');
  } catch (e) {
    await encerrarArvore(); // sem janela: não deixar um Electron órfão segurando a instância única
    throw e;
  }
  const problemas: string[] = [];
  const requisicoes: string[] = [];
  pagina.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) problemas.push(`console: ${m.text()}`);
  });
  pagina.on('pageerror', (e) => problemas.push(`exceção: ${e.message}`));
  pagina.on('request', (r) => requisicoes.push(r.url()));
  const recursos = await pagina.evaluate(() => [
    location.href,
    ...performance.getEntriesByType('resource').map((e) => e.name),
  ]);

  const aberto: AppAberto = {
    app,
    pagina,
    pid,
    netLog,
    problemas,
    requisicoes,
    recursos,
    async fechar() {
      // Fechar a janela (não `app.close()`): passa pelo `beforeunload` e pelo `window-all-closed` do app.
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
      await terminou;
      abertos.get(amb)?.delete(aberto);
    },
    async matar() {
      await encerrarArvore();
      abertos.get(amb)?.delete(aberto);
    },
  };
  abertos.get(amb)?.add(aberto);
  return aberto;
}

/**
 * Cria um trabalho pelo diálogo "Novo trabalho" (M2-T02): clica o botão (padrão: "Criar primeiro trabalho"), marca o
 * tipo pelo rótulo e confirma. Volta com o campo do título focado.
 */
export async function criarTrabalho(p: Page, tipo = 'TCC (monografia)', botao = 'Criar primeiro trabalho'): Promise<void> {
  await p.getByRole('button', { name: botao }).click();
  const dialogo = p.getByRole('dialog', { name: 'Novo trabalho' });
  await dialogo.getByRole('radio', { name: tipo, exact: true }).check();
  await dialogo.getByRole('button', { name: 'Criar trabalho' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(p.getByLabel('Título do trabalho')).toBeFocused();
}

/** Arquivos `.bdp` da biblioteca. */
export const arquivosBdp = (amb: Ambiente): string[] => readdirSync(amb.trabalhos).filter((n) => n.endsWith('.bdp'));

/** `documento.json` de dentro de um `.bdp`: o texto bruto e o título em texto plano. */
export function lerDocumento(caminho: string): { json: string; titulo: string } {
  const entradas = unzipSync(readFileSync(caminho), { filter: (f) => f.name === 'documento.json' });
  const bruto = entradas['documento.json'];
  if (!bruto) throw new Error(`documento.json ausente em ${caminho}`);
  const json = strFromU8(bruto);
  const documento = JSON.parse(json) as { metadados: { titulo: Inline[] } };
  return { json, titulo: textoPlano(documento.metadados.titulo) };
}

/**
 * Atividade de rede registrada no net-log: resoluções de nome, sockets e requisições de URL (as `app://` não entram
 * no net-log). `tipos` serve de controle positivo: prova que a captura funcionou.
 */
export interface AtividadeRede {
  readonly resolucoes: string[];
  readonly sockets: string[];
  readonly urls: string[];
  readonly tipos: ReadonlySet<string>;
}

export function atividadeDeRede(arquivo: string): AtividadeRede {
  const log = JSON.parse(readFileSync(arquivo, 'utf8')) as {
    constants: { logEventTypes: Record<string, number> };
    events: { type: number; params?: Record<string, unknown> }[];
  };
  const nomes = new Map(Object.entries(log.constants.logEventTypes).map(([nome, n]) => [n, nome]));
  const resolucoes: string[] = [];
  const sockets: string[] = [];
  const urls: string[] = [];
  const tipos = new Set<string>();
  for (const e of log.events) {
    const nome = nomes.get(e.type) ?? String(e.type);
    tipos.add(nome);
    const p = e.params ?? {};
    if (nome === 'HOST_RESOLVER_MANAGER_REQUEST') resolucoes.push(String(p['host']));
    else if (/^(TCP|UDP|SOCKET)_CONNECT$/.test(nome)) sockets.push(String(p['address']));
    else if (nome === 'URL_REQUEST_START_JOB') urls.push(String(p['url']));
  }
  return { resolucoes, sockets, urls, tipos };
}
