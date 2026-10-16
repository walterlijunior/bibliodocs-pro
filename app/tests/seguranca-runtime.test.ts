// Testes do M1-T02: CSP (C-4) e verificação estática do processo principal (C-2, C-9, C-15, C-21, C-22).
// A verificação estática lê o código-fonte; não substitui o teste E2E do M1-T13.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSP_PRODUCAO, cspDesenvolvimento } from '../src/principal/seguranca/csp';

const raizApp = join(__dirname, '..');
const lerFonte = (relativo: string): string => readFileSync(join(raizApp, relativo), 'utf8');

/** Texto exato do checklist C-4 (docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md). */
const CSP_DO_CHECKLIST =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; " +
  "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

describe('CSP (C-4)', () => {
  it('produção é exatamente a do checklist', () => {
    expect(CSP_PRODUCAO).toBe(CSP_DO_CHECKLIST);
  });

  it('produção não tem unsafe-*, curinga nem origem remota', () => {
    expect(CSP_PRODUCAO).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes|wasm-unsafe-eval/);
    expect(CSP_PRODUCAO).not.toMatch(/\*|https?:|wss?:/);
  });

  it('desenvolvimento libera só a origem dev exata e nunca unsafe-eval', () => {
    const csp = cspDesenvolvimento({ protocolo: 'http:', host: 'localhost:5173' });
    expect(csp).toContain("script-src http://localhost:5173 'unsafe-inline'");
    expect(csp).toContain('connect-src http://localhost:5173 ws://localhost:5173');
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toMatch(/unsafe-eval|\*|https:/);
  });

  it('o index.html não traz CSP própria nem script inline (a CSP vem do protocolo)', () => {
    const html = lerFonte('src/interface/index.html');
    expect(html).not.toMatch(/Content-Security-Policy/i);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  });
});

describe('processo principal (verificação estática)', () => {
  const principal = lerFonte('src/principal/index.ts');

  it.each([
    'contextIsolation: true',
    'sandbox: true',
    'nodeIntegration: false',
    'nodeIntegrationInWorker: false',
    'nodeIntegrationInSubFrames: false',
    'navigateOnDragDrop: false',
    'webSecurity: true',
    'webviewTag: false',
    'allowRunningInsecureContent: false',
    'experimentalFeatures: false',
    'spellcheck: false',
    'devTools: !app.isPackaged',
    'app.enableSandbox()',
    'app.requestSingleInstanceLock()',
    "app.on('second-instance'",
    'Menu.setApplicationMenu(null)',
    'registrarEsquemaApp()',
  ])('index.ts contém %s', (trecho) => {
    expect(principal).toContain(trecho);
  });

  it('índice e módulos de segurança não usam loadFile, file://, enableBlinkFeatures nem crashReporter', () => {
    const pasta = join(raizApp, 'src', 'principal');
    const arquivos = ['index.ts', ...readdirSync(join(pasta, 'seguranca')).map((a) => join('seguranca', a))];
    for (const arquivo of arquivos) {
      const codigo = readFileSync(join(pasta, arquivo), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(codigo, arquivo).not.toMatch(/loadFile\(|file:\/\/|enableBlinkFeatures|crashReporter|nodeIntegration:\s*true/);
      expect(codigo, arquivo).not.toMatch(/allowRunningInsecureContent:\s*true|webSecurity:\s*false|sandbox:\s*false/);
    }
  });

  it('endurecimento.ts liga navegação, janelas, webview, permissões e rede', () => {
    const ligacao = lerFonte('src/principal/seguranca/endurecimento.ts');
    for (const trecho of [
      "'will-navigate'",
      "'will-redirect'",
      "'will-frame-navigate'",
      "'will-attach-webview'",
      "setWindowOpenHandler(() => ({ action: 'deny' }))",
      "app.on('web-contents-created'",
      'setPermissionRequestHandler',
      'setPermissionCheckHandler(() => false)',
      'setDevicePermissionHandler(() => false)',
      'webRequest.onBeforeRequest',
      'detalhes.resourceType',
      'setSpellCheckerEnabled(false)',
      'protocol.registerSchemesAsPrivileged',
      '.protocol.handle(',
      "'Content-Security-Policy': CSP_PRODUCAO",
      'dialog.showMessageBox',
    ]) {
      expect(ligacao, trecho).toContain(trecho);
    }
    expect(ligacao).not.toMatch(/bypassCSP:\s*true|corsEnabled:\s*true|allowServiceWorkers:\s*true/);
    // Logs só com urlParaLog (protocolo//host), nunca a URL inteira.
    expect(ligacao).not.toMatch(/console\.\w+\([^)]*\burl\.slice\(|console\.\w+\([^)]*\$\{(detalhes\.)?url\}/);
  });

  it('módulos puros de segurança não importam electron', () => {
    for (const arquivo of ['politica-urls.ts', 'protocolo-caminho.ts', 'csp.ts']) {
      expect(lerFonte(join('src/principal/seguranca', arquivo)), arquivo).not.toMatch(/from ['"]electron['"]/);
    }
  });
});

describe('.gitignore (C-21)', () => {
  it.each(['*.pfx', '*.p12', '*.spc', '.env', '.env.*'])('ignora %s', (padrao) => {
    const linhas = lerFonte('.gitignore').split(/\r?\n/).map((l) => l.trim());
    expect(linhas).toContain(padrao);
  });
});
