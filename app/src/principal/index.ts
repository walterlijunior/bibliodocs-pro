/**
 * Módulo `principal` — processo principal do Electron: janela, menus, protocolo e IPC.
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Roda só no processo principal (regra 6); pode usar electron e node:*.
 * - Não importa interface/.
 *
 * M1-T02 — endurecimento do runtime (checklist em docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md):
 * - C-2/C-9/C-15 webPreferences abaixo (isolamento, sandbox, sem Node, sem webview, sem corretor,
 *   DevTools só fora do pacote); `app.enableSandbox()` para todo renderer; crashReporter não iniciado;
 * - C-3/C-4 produção servida por `app://interface/` a partir de out/interface, com CSP no cabeçalho;
 *   desenvolvimento pela origem exata de ELECTRON_RENDERER_URL (só loopback) com CSP de dev;
 * - C-5/C-6/C-7/C-8 em seguranca/endurecimento.ts (navegação, links externos, permissões, rede);
 * - C-15 menu nulo no app empacotado (sem item nem atalho de DevTools);
 * - C-22 (parte 1) instância única: a segunda instância só foca a janela existente. Com ela, uma trava de sessão
 *   (`sessao\<id>.lock`, M1-T12) que não pertence a uma sessão ativa deste processo é sempre órfã.
 * M1-T08 — IPC tipado (C-10–C-12) em ipc/: só a janela principal chama a API, pela origem da interface.
 * C-13/C-14/C-16/C-17 ficam no empacotamento (electron-builder.config.cjs, M1-T14); C-18/C-19/C-20 nos testes
 * (M1-T03). M1-T14 (A-1): argumentos de linha de comando recusados no app empacotado (seguranca/argumentos.ts).
 * M1-T12 — recuperação (instantâneos, trava de sessão, restos de gravação) em ipc/manipuladores-recuperacao.ts.
 */
import { join } from 'node:path';
import { app, BrowserWindow, Menu, session } from 'electron';
import { ehArtefatoDeFumaca } from './seguranca/fumaca';
import { argumentoRecusado, SAIDA_ARGUMENTO_RECUSADO } from './seguranca/argumentos';
import {
  endurecerSessao,
  endurecerTodosOsConteudos,
  registrarEsquemaApp,
  registrarProtocoloApp,
  type ContextoSeguranca,
} from './seguranca/endurecimento';
import { registrarIpcProjetos } from './ipc/registrar';
import { ORIGEM_PRODUCAO, URL_INICIAL_PRODUCAO, origemDeDesenvolvimento } from './seguranca/politica-urls';

const TITULO = 'BiblioDocs Pro';

/** Decide, uma única vez, se o app usa o servidor dev ou o protocolo app://. */
function decidirContexto(): { contexto: ContextoSeguranca; urlInicial: string } {
  const urlDev = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL'];
  const origemDev = origemDeDesenvolvimento(urlDev);
  if (urlDev !== undefined && origemDev) {
    return { contexto: { origem: origemDev, desenvolvimento: true }, urlInicial: urlDev };
  }
  if (urlDev !== undefined) console.warn('[seguranca] ELECTRON_RENDERER_URL ignorada (não é http de loopback).');
  return { contexto: { origem: ORIGEM_PRODUCAO, desenvolvimento: false }, urlInicial: URL_INICIAL_PRODUCAO };
}

function criarJanelaPrincipal(urlInicial: string): BrowserWindow {
  const janela = new BrowserWindow({
    title: TITULO,
    width: 1280,
    height: 800,
    // UI-01: a casca (M1-T10) funciona de 1024×700 até tela cheia.
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#ECEAE4', // --cor-barras (tokens.css), evita o clarão branco antes do primeiro quadro
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      // C-2
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      navigateOnDragDrop: false,
      safeDialogs: true,
      // C-9
      spellcheck: false,
      // C-15
      devTools: !app.isPackaged,
    },
  });

  janela.once('ready-to-show', () => janela.show());
  if (!app.isPackaged) {
    janela.webContents.on('before-input-event', (_evento, entrada) => {
      if (entrada.type === 'keyDown' && entrada.key === 'F12') janela.webContents.toggleDevTools();
    });
  }
  void janela.loadURL(urlInicial);
  return janela;
}


function iniciar(): void {
  // A-1 (M1-T14): no app empacotado, chave de linha de comando fora da lista sai antes de tudo (ex.: a porta CDP de
  // `--remote-debugging-port`, que nenhum fuse cobre). Ver seguranca/argumentos.ts.
  if (app.isPackaged) {
    const recusado = argumentoRecusado(process.argv.slice(1), ehArtefatoDeFumaca());
    if (recusado !== null) {
      // Só o nome da chave: o valor pode trazer um caminho (R-M2-14).
      console.error(`[seguranca] argumento recusado: ${recusado.split('=')[0]}`);
      app.exit(SAIDA_ARGUMENTO_RECUSADO);
      return;
    }
  }

  // C-22 (parte 1): instância única.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.enableSandbox();
  // C-8/R23 (M1-T13): sem detecção automática de proxy. Sem esta chave o Chromium procura o WPAD (DNS `wpad` na
  // rede local) e testa o IPv6 logo ao iniciar, mesmo sem nenhuma requisição; o E2E de rede confere pelo net-log.
  // Quando houver função on-line (LanguageTool, após o M7), rever o proxy junto com o achado B-3.
  app.commandLine.appendSwitch('no-proxy-server');
  registrarEsquemaApp(); // C-3: precisa ser antes do ready.

  const { contexto, urlInicial } = decidirContexto();
  endurecerTodosOsConteudos(contexto);

  let janelaPrincipal: BrowserWindow | null = null;
  // C-11: só o webContents da janela principal (enquanto existir) chama a API.
  let ipc: ReturnType<typeof registrarIpcProjetos> | null = null;
  const abrirJanela = (): void => {
    janelaPrincipal = criarJanelaPrincipal(urlInicial);
    const idConteudo = janelaPrincipal.webContents.id;
    ipc?.vigiar(janelaPrincipal.webContents);
    janelaPrincipal.on('closed', () => {
      ipc?.encerrarJanela(idConteudo);
      janelaPrincipal = null;
    });
  };

  app.on('second-instance', () => {
    if (!janelaPrincipal) return;
    if (janelaPrincipal.isMinimized()) janelaPrincipal.restore();
    janelaPrincipal.focus();
  });

  void app.whenReady().then(() => {
    endurecerSessao(session.defaultSession, contexto);
    if (!contexto.desenvolvimento) {
      registrarProtocoloApp(session.defaultSession, join(__dirname, '../interface'));
    }
    // C-15: no app empacotado não há menu (logo, nem item nem atalho de DevTools). Os menus do app são desenhados
    // pela interface (M1-T10, barra de menus no estilo da referência), então o menu nativo também some no
    // desenvolvimento; ali as DevTools abrem com F12 (abaixo).
    Menu.setApplicationMenu(null);

    ipc = registrarIpcProjetos(contexto.origem, () =>
      janelaPrincipal && !janelaPrincipal.isDestroyed() ? new Set([janelaPrincipal.webContents.id]) : new Set<number>(),
    );

    abrirJanela();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) abrirJanela();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') return;
    // A limpeza da recuperação (instantâneos descartados, trava de sessão) termina antes de sair (M1-T12).
    void (ipc?.aguardarRecuperacao() ?? Promise.resolve()).finally(() => app.quit());
  });
}

iniciar();
