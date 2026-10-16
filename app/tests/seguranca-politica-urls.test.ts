// Testes do M1-T02: política de URLs (C-5 navegação, C-6 link externo, C-8 rede, origem dev).
import { describe, expect, it } from 'vitest';
import {
  HOSTS_EXTERNOS_PERMITIDOS,
  ORIGEM_PRODUCAO,
  URL_INICIAL_PRODUCAO,
  navegacaoPermitida,
  origemDeDesenvolvimento,
  requisicaoPermitida,
  urlNaOrigem,
  urlParaLog,
  validarLinkExterno,
} from '../src/principal/seguranca/politica-urls';

describe('urlParaLog (sem dado do usuário no log)', () => {
  it.each([
    ['https://user:senha@exemplo.com:8443/caminho?nome=Maria#trecho', 'https://exemplo.com:8443'],
    ['app://interface/assets/index.js?x=1', 'app://interface'],
    ['data:text/plain,segredo', 'data:'],
    ['blob:app://interface/0f0e', 'blob:'],
    ['file:///C:/Users/fulano/tcc.bdp', 'file:'],
    ['javascript:alert(document.cookie)', 'javascript:'],
    ['url quebrada', '<URL inválida>'],
  ])('%s → %s', (url, esperado) => {
    expect(urlParaLog(url)).toBe(esperado);
  });
});

const ORIGEM_DEV = { protocolo: 'http:', host: 'localhost:5173' };

describe('origemDeDesenvolvimento', () => {
  it('aceita http de loopback e guarda host:porta', () => {
    expect(origemDeDesenvolvimento('http://localhost:5173/')).toEqual(ORIGEM_DEV);
    expect(origemDeDesenvolvimento('http://127.0.0.1:5174')).toEqual({ protocolo: 'http:', host: '127.0.0.1:5174' });
    expect(origemDeDesenvolvimento('http://[::1]:5173/')).toEqual({ protocolo: 'http:', host: '[::1]:5173' });
  });

  it.each([
    undefined,
    '',
    'nao é url',
    'https://localhost:5173/',
    'http://exemplo.com:5173/',
    'http://localhost.evil.com:5173/',
    'http://user:senha@localhost:5173/',
    'file:///C:/app/index.html',
    'app://interface/index.html',
  ])('recusa %s', (url) => {
    expect(origemDeDesenvolvimento(url)).toBeNull();
  });
});

describe('navegacaoPermitida (C-5) em produção', () => {
  it.each([URL_INICIAL_PRODUCAO, 'app://interface/', 'app://interface/outra.html#x', 'app://INTERFACE/index.html'])(
    'permite %s',
    (url) => {
      expect(navegacaoPermitida(url, ORIGEM_PRODUCAO, false)).toBe(true);
    },
  );

  it.each([
    'http://localhost:5173/',
    'https://www.uft.edu.br/',
    'file:///C:/Windows/win.ini',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'about:blank',
    'app://outro/index.html',
    'app://interface.evil/index.html',
    'app://interface:8080/index.html',
    'app://user:senha@interface/index.html',
    'devtools://devtools/bundled/inspector.html',
    'appx://interface/index.html',
    'nao é url',
    '',
  ])('bloqueia %s', (url) => {
    expect(navegacaoPermitida(url, ORIGEM_PRODUCAO, false)).toBe(false);
  });
});

describe('navegacaoPermitida (C-5) em desenvolvimento', () => {
  it('permite a origem dev exata e devtools:', () => {
    expect(navegacaoPermitida('http://localhost:5173/', ORIGEM_DEV, true)).toBe(true);
    expect(navegacaoPermitida('http://localhost:5173/src/x.tsx', ORIGEM_DEV, true)).toBe(true);
    expect(navegacaoPermitida('devtools://devtools/bundled/inspector.html', ORIGEM_DEV, true)).toBe(true);
  });

  it.each([
    'http://localhost:5174/',
    'http://localhost/',
    'https://localhost:5173/',
    'http://127.0.0.1:5173/',
    'http://localhost.evil.com:5173/',
    'app://interface/index.html',
    'file:///C:/x.html',
    'javascript:alert(1)',
  ])('bloqueia %s', (url) => {
    expect(navegacaoPermitida(url, ORIGEM_DEV, true)).toBe(false);
  });
});

describe('requisicaoPermitida (C-8)', () => {
  it('produção: só app://interface, data: e blob: da origem', () => {
    expect(requisicaoPermitida('app://interface/assets/index.js', ORIGEM_PRODUCAO, false)).toBe(true);
    expect(requisicaoPermitida('data:image/png;base64,AAAA', ORIGEM_PRODUCAO, false, 'image')).toBe(true);
    expect(requisicaoPermitida('blob:app://interface/0f0e-11', ORIGEM_PRODUCAO, false, 'image')).toBe(true);
    expect(requisicaoPermitida('blob:app://interface/0f0e-11', ORIGEM_PRODUCAO, false, 'xhr')).toBe(true);
  });

  it.each([
    ['data:text/html,<script>alert(1)</script>', 'subFrame'],
    ['data:text/javascript,alert(1)', 'script'],
    ['data:image/png;base64,AAAA', undefined],
    ['blob:app://interface/0f0e-11', 'script'],
    ['blob:app://interface/0f0e-11', 'subFrame'],
    ['blob:app://interface/0f0e-11', undefined],
  ])('data:/blob: só como imagem (blob: também xhr): bloqueia %s como %s', (url, tipo) => {
    expect(requisicaoPermitida(url, ORIGEM_PRODUCAO, false, tipo)).toBe(false);
  });

  it.each([
    'https://api.languagetool.org/v2/check',
    'http://localhost:5173/',
    'ws://localhost:5173/',
    'https://redirector.gvt1.com/edgedl/chrome/dict/pt-br-10-1.bdic',
    'file:///C:/Windows/win.ini',
    'devtools://devtools/bundled/inspector.html',
    'blob:https://evil.com/0f0e',
    'app://outro/x.js',
    'chrome-extension://abc/x.js',
    'url quebrada',
  ])('produção bloqueia %s', (url) => {
    expect(requisicaoPermitida(url, ORIGEM_PRODUCAO, false)).toBe(false);
  });

  it('desenvolvimento: origem http exata, ws do mesmo host:porta e devtools:', () => {
    expect(requisicaoPermitida('http://localhost:5173/@vite/client', ORIGEM_DEV, true)).toBe(true);
    expect(requisicaoPermitida('ws://localhost:5173/?token=abc', ORIGEM_DEV, true)).toBe(true);
    expect(requisicaoPermitida('devtools://devtools/bundled/inspector.html', ORIGEM_DEV, true)).toBe(true);
  });

  it.each([
    'ws://localhost:5174/',
    'wss://localhost:5173/',
    'http://localhost:5174/',
    'https://fonts.googleapis.com/css',
    'app://interface/index.html',
  ])('desenvolvimento bloqueia %s', (url) => {
    expect(requisicaoPermitida(url, ORIGEM_DEV, true)).toBe(false);
  });
});

describe('urlNaOrigem', () => {
  it('compara protocolo e host analisados, não prefixo de texto', () => {
    expect(urlNaOrigem('app://interface/x', ORIGEM_PRODUCAO)).toBe(true);
    expect(urlNaOrigem('app://interfacex/x', ORIGEM_PRODUCAO)).toBe(false);
    expect(urlNaOrigem('app:interface/x', ORIGEM_PRODUCAO)).toBe(false);
  });
});

describe('validarLinkExterno (C-6)', () => {
  const lista = ['exemplo.com', 'docs.exemplo.org'];

  it('a lista fixa do M1 começa vazia: nada é aberto', () => {
    expect(HOSTS_EXTERNOS_PERMITIDOS).toEqual([]);
    expect(validarLinkExterno('https://exemplo.com/').permitido).toBe(false);
  });

  it('aceita https com host exato da lista e devolve a URL serializada', () => {
    expect(validarLinkExterno('https://exemplo.com/a?b=1', lista)).toEqual({
      permitido: true,
      url: 'https://exemplo.com/a?b=1',
    });
    expect(validarLinkExterno('https://EXEMPLO.com/', lista).permitido).toBe(true);
  });

  it.each([
    'http://exemplo.com/',
    'https://exemplo.com.evil.com/',
    'https://evil.com/?exemplo.com',
    'https://sub.exemplo.com/',
    'https://usuario:senha@exemplo.com/',
    'https://exemplo.com@evil.com/',
    'https://exemplo.com:8443/',
    'file:///C:/Windows/System32/calc.exe',
    'javascript:alert(1)',
    'mailto:a@exemplo.com',
    'ms-settings:',
    'app://interface/index.html',
    'url quebrada',
  ])('recusa %s', (url) => {
    expect(validarLinkExterno(url, lista).permitido).toBe(false);
  });
});
