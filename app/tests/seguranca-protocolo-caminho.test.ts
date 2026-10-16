// Testes do M1-T02: resolução de caminho do protocolo app:// (C-3).
import { isAbsolute, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolverCaminhoProtocolo } from '../src/principal/seguranca/protocolo-caminho';

const RAIZ = resolve(__dirname, '..', 'out', 'interface');

function dentroDaRaiz(caminho: string): boolean {
  const rel = relative(RAIZ, caminho);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

describe('resolverCaminhoProtocolo (C-3)', () => {
  it('raiz e caminho terminado em / servem index.html', () => {
    for (const url of ['app://interface/', 'app://interface', 'app://interface/?x=1#y']) {
      const r = resolverCaminhoProtocolo(url, RAIZ);
      expect(r, url).toEqual({ tipo: 'arquivo', caminho: join(RAIZ, 'index.html'), tipoMime: 'text/html; charset=utf-8' });
    }
    const sub = resolverCaminhoProtocolo('app://interface/assets/', RAIZ);
    expect(sub).toMatchObject({ tipo: 'arquivo', caminho: join(RAIZ, 'assets', 'index.html') });
  });

  it('arquivo comum com tipo MIME', () => {
    expect(resolverCaminhoProtocolo('app://interface/assets/index-abc.js', RAIZ)).toEqual({
      tipo: 'arquivo',
      caminho: join(RAIZ, 'assets', 'index-abc.js'),
      tipoMime: 'text/javascript; charset=utf-8',
    });
    expect(resolverCaminhoProtocolo('app://INTERFACE/estilo.css', RAIZ)).toMatchObject({ tipo: 'arquivo' });
    expect(resolverCaminhoProtocolo('app://interface/nome%20com%20espa%C3%A7o.png', RAIZ)).toMatchObject({
      tipo: 'arquivo',
      caminho: join(RAIZ, 'nome com espaço.png'),
    });
  });

  it.each([
    'app://interface/../../Windows/win.ini',
    'app://interface/assets/../../segredo.html',
    'app://interface/%2e%2e/%2e%2e/segredo.html',
    'app://interface/%2E%2E/segredo.html',
    'app://interface/.%2e/segredo.html',
  ])('traversal %s nunca sai da raiz', (url) => {
    // O parser WHATWG já remove segmentos ".." (inclusive %2e%2e); o que sobra precisa estar dentro da raiz.
    const r = resolverCaminhoProtocolo(url, RAIZ);
    if (r.tipo === 'arquivo') expect(dentroDaRaiz(r.caminho), r.caminho).toBe(true);
  });

  it.each([
    ['app://interface/..%5c..%5cWindows%5cwin.ini', 400],
    ['app://interface/a%5Cb.js', 400],
    ['app://interface/a\\..\\..\\b.js', 400],
    ['app://interface/%252e%252e/x.js', 400], // codificação dupla
    ['app://interface/a%2f..%2f..%2fb.js', 400],
    ['app://interface/C:/Windows/win.ini', 400],
    ['app://interface/C%3A/Windows/win.ini', 400],
    ['app://interface//etc/passwd.txt', 400],
    ['app://interface/a%00.js', 400],
    ['app://interface/%E0%A4%A.js', 400],
    ['app://interface/x.exe', 404],
    ['app://interface/assets/index.js.map', 404], // sourcemap nunca é servido (revisão M1-T02, B-6)
    ['app://interface/sem-extensao', 404],
    ['app://outro/index.html', 404],
    ['app://interface.evil/index.html', 404],
    ['app://interface:8080/index.html', 404],
    ['app://u:s@interface/index.html', 400],
    ['file:///C:/Windows/win.ini', 404],
    ['http://interface/index.html', 404],
    ['nao é url', 400],
  ] as const)('recusa %s com status %i', (url, status) => {
    const r = resolverCaminhoProtocolo(url, RAIZ);
    expect(r.tipo, url).toBe('recusa');
    if (r.tipo === 'recusa') expect(r.status, `${url}: ${r.motivo}`).toBe(status);
  });

  it('só GET e HEAD', () => {
    expect(resolverCaminhoProtocolo('app://interface/', RAIZ, 'HEAD').tipo).toBe('arquivo');
    expect(resolverCaminhoProtocolo('app://interface/', RAIZ, 'POST')).toMatchObject({ tipo: 'recusa', status: 405 });
  });
});
