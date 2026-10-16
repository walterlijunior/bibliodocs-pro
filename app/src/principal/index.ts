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
 * - C-22 (parte 1) instância única: a segunda instância só foca a janela existente.
 * Ficam para depois: C-10–C-12 (IPC, M1-T08), C-13/C-14/C-16/C-17 (empacotamento, M1-T14),
 * C-18/C-19/C-20 (verificação de dependências e varreduras, M1-T03), trava por projeto (persistência).
 */
import { join } from 'node:path';
import { app, BrowserWindow, Menu, session } from 'electron';
import {
  endurecerSessao,
  endurecerTodosOsConteudos,
  registrarEsquemaApp,
  registrarProtocoloApp,
  type ContextoSeguranca,
} from './seguranca/endurecimento';
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
  void janela.loadURL(urlInicial);
  return janela;
}

function iniciar(): void {
  // C-22 (parte 1): instância única.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.enableSandbox();
  registrarEsquemaApp(); // C-3: precisa ser antes do ready.

  const { contexto, urlInicial } = decidirContexto();
  endurecerTodosOsConteudos(contexto);

  let janelaPrincipal: BrowserWindow | null = null;
  const abrirJanela = (): void => {
    janelaPrincipal = criarJanelaPrincipal(urlInicial);
    janelaPrincipal.on('closed', () => {
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
    // C-15: no app empacotado não há menu (logo, nem item nem atalho de DevTools). Menus reais: M1-T10.
    if (app.isPackaged) Menu.setApplicationMenu(null);

    abrirJanela();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) abrirJanela();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

iniciar();
