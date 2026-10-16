/**
 * Ligação do endurecimento do runtime com a API do Electron (M1-T02). As decisões ficam nas funções
 * puras de `politica-urls.ts`, `protocolo-caminho.ts` e `csp.ts`; este arquivo só as conecta aos
 * eventos e manipuladores do Electron. Itens do checklist (docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md):
 *
 * - C-3 `registrarEsquemaApp` (antes do ready) e `registrarProtocoloApp` (`protocol.handle`);
 * - C-4 CSP de produção no cabeçalho da resposta do `app://`; CSP de desenvolvimento por
 *   `onHeadersReceived`, só com o servidor dev;
 * - C-5 `will-navigate`, `will-redirect`, `will-frame-navigate`, `setWindowOpenHandler` → deny e
 *   `will-attach-webview` bloqueado, para todo webContents (`app.on('web-contents-created')`);
 * - C-6 `abrirLinkExterno` (só processo principal, só https de lista fixa, com confirmação);
 * - C-7 permissões negadas (request, check, device);
 * - C-8 `webRequest.onBeforeRequest` cancela o que estiver fora da política;
 * - C-15 DevTools fechadas se abertas num app empacotado (reforço do `devTools: !app.isPackaged`).
 */
import { readFile } from 'node:fs/promises';
import { app, dialog, protocol, shell, type BrowserWindow, type Session, type WebContents } from 'electron';
import { CSP_PRODUCAO, cspDesenvolvimento } from './csp';
import {
  ESQUEMA_APP,
  navegacaoPermitida,
  requisicaoPermitida,
  urlParaLog,
  validarLinkExterno,
  type OrigemPermitida,
} from './politica-urls';
import { resolverCaminhoProtocolo } from './protocolo-caminho';

/** Contexto de segurança decidido uma vez na inicialização. */
export interface ContextoSeguranca {
  /** Origem da interface: `app://interface` ou a origem http exata do servidor dev. */
  readonly origem: OrigemPermitida;
  /** `true` só com app não empacotado e ELECTRON_RENDERER_URL válida (loopback). */
  readonly desenvolvimento: boolean;
}

/**
 * C-3: registra `app:` como esquema privilegiado. Precisa rodar antes de `app.whenReady()`.
 * `standard` (URL hierárquica, origem própria), `secure` (contexto seguro, como https) e
 * `supportFetchAPI`. Sem `bypassCSP`, sem `corsEnabled`, sem service workers.
 */
export function registrarEsquemaApp(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ESQUEMA_APP, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Cabeçalhos comuns às respostas do `app://`. */
function cabecalhos(tipoMime?: string): Record<string, string> {
  const base: Record<string, string> = {
    'Content-Security-Policy': CSP_PRODUCAO,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
  if (tipoMime) base['Content-Type'] = tipoMime;
  return base;
}

/** C-3/C-4: serve `raiz` (out/interface) pelo `app://interface/`, com a CSP de produção em toda resposta. */
export function registrarProtocoloApp(sessao: Session, raiz: string): void {
  sessao.protocol.handle(ESQUEMA_APP, async (requisicao) => {
    const r = resolverCaminhoProtocolo(requisicao.url, raiz, requisicao.method);
    if (r.tipo === 'recusa') {
      return new Response(null, { status: r.status, headers: cabecalhos() });
    }
    try {
      const conteudo = await readFile(r.caminho);
      const corpo = requisicao.method === 'HEAD' ? null : new Uint8Array(conteudo);
      return new Response(corpo, { status: 200, headers: cabecalhos(r.tipoMime) });
    } catch {
      return new Response(null, { status: 404, headers: cabecalhos() });
    }
  });
}

const sessoesConfiguradas = new WeakSet<Session>();

/** C-7, C-8 e CSP de desenvolvimento (C-4) numa sessão. Idempotente. */
export function endurecerSessao(sessao: Session, contexto: ContextoSeguranca): void {
  if (sessoesConfiguradas.has(sessao)) return;
  sessoesConfiguradas.add(sessao);

  // C-7: nenhuma permissão (câmera, microfone, notificações, geolocalização, HID, USB, serial...).
  sessao.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false));
  sessao.setPermissionCheckHandler(() => false);
  sessao.setDevicePermissionHandler(() => false);

  // C-9: corretor desligado também na sessão (o `spellcheck:false` da janela vale só por webContents).
  sessao.setSpellCheckerEnabled(false);

  // C-8: rede bloqueada por padrão.
  sessao.webRequest.onBeforeRequest((detalhes, responder) => {
    const permitida = requisicaoPermitida(
      detalhes.url,
      contexto.origem,
      contexto.desenvolvimento,
      detalhes.resourceType,
    );
    if (!permitida) console.warn(`[seguranca] requisição bloqueada (${detalhes.resourceType}): ${urlParaLog(detalhes.url)}`);
    responder({ cancel: !permitida });
  });

  // C-4 (desenvolvimento): CSP mínima para o servidor Vite. Em produção a CSP vem do protocolo app://.
  if (contexto.desenvolvimento) {
    const csp = cspDesenvolvimento(contexto.origem);
    sessao.webRequest.onHeadersReceived((detalhes, responder) => {
      const cabecalhosResposta = { ...detalhes.responseHeaders };
      for (const nome of Object.keys(cabecalhosResposta)) {
        if (nome.toLowerCase() === 'content-security-policy') delete cabecalhosResposta[nome];
      }
      cabecalhosResposta['Content-Security-Policy'] = [csp];
      responder({ responseHeaders: cabecalhosResposta });
    });
  }
}

/** C-5 e C-15 num webContents (janela, DevTools, qualquer outro). */
function endurecerConteudo(conteudo: WebContents, contexto: ContextoSeguranca): void {
  const bloquearSeFora = (evento: { preventDefault(): void }, url: string, tipo: string): void => {
    if (!navegacaoPermitida(url, contexto.origem, contexto.desenvolvimento)) {
      evento.preventDefault();
      console.warn(`[seguranca] ${tipo} bloqueado: ${urlParaLog(url)}`);
    }
  };
  conteudo.on('will-navigate', (evento) => bloquearSeFora(evento, evento.url, 'will-navigate'));
  conteudo.on('will-redirect', (evento) => bloquearSeFora(evento, evento.url, 'will-redirect'));
  conteudo.on('will-frame-navigate', (evento) => bloquearSeFora(evento, evento.url, 'will-frame-navigate'));
  conteudo.setWindowOpenHandler(() => ({ action: 'deny' }));
  conteudo.on('will-attach-webview', (evento) => evento.preventDefault());

  if (app.isPackaged) {
    conteudo.on('devtools-opened', () => conteudo.closeDevTools());
  }
}

/**
 * Aplica C-5/C-7/C-8/C-15 a todo webContents criado daqui em diante (e à sessão dele).
 * Chamar antes de criar a primeira janela.
 */
export function endurecerTodosOsConteudos(contexto: ContextoSeguranca): void {
  app.on('web-contents-created', (_evento, conteudo) => {
    endurecerSessao(conteudo.session, contexto);
    endurecerConteudo(conteudo, contexto);
  });
}

/**
 * C-6: abre um link no navegador padrão. Só no processo principal; ainda sem IPC (M1-T08).
 * Valida contra a lista fixa (`HOSTS_EXTERNOS_PERMITIDOS`) e pede confirmação ao usuário.
 * Nunca deve receber URL vinda de conteúdo de documento.
 *
 * @returns `true` se o link foi entregue ao sistema.
 */
export async function abrirLinkExterno(janela: BrowserWindow | null, urlTexto: string): Promise<boolean> {
  const validacao = validarLinkExterno(urlTexto);
  if (!validacao.permitido) {
    console.warn(`[seguranca] link externo recusado: ${validacao.motivo}`);
    return false;
  }
  const opcoes = {
    type: 'question' as const,
    buttons: ['Abrir no navegador', 'Cancelar'],
    defaultId: 1,
    cancelId: 1,
    title: 'Abrir link externo',
    message: 'Abrir este endereço no navegador?',
    detail: validacao.url,
    noLink: true,
  };
  const { response } = janela ? await dialog.showMessageBox(janela, opcoes) : await dialog.showMessageBox(opcoes);
  if (response !== 0) return false;
  await shell.openExternal(validacao.url);
  return true;
}
