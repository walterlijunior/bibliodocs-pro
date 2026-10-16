// M1-T03 — Varreduras de texto (ADR-0005 regras 7 e 8; checklist C-6, C-18, C-19 e C-20 de
// docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md). Comentários e conteúdo de strings são ignorados: o texto
// 'https:' das políticas de URL não é rede; o que conta são importações e chamadas.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARQUIVO_OPEN_EXTERNAL,
  formatarViolacao,
  varrerHtml,
  varrerOpenExternal,
  varrerRede,
  type Violacao,
} from './apoio/analisador-fontes';
import { lerFontesDoSrc } from './apoio/ler-fontes';

const raizApp = join(__dirname, '..');
const fontes = lerFontesDoSrc(raizApp);
const listar = (v: Violacao[]): string => v.map(formatarViolacao).join('\n');
const um = (arquivo: string, conteudo: string) => [{ arquivo, conteudo }];

describe('ARQ — regra 7 / C-20: sem HTML montado de dado nem código a partir de texto', () => {
  it('src/ não usa innerHTML, outerHTML, insertAdjacentHTML, dangerouslySetInnerHTML, document.write, eval nem Function', () => {
    const v = varrerHtml(fontes);
    expect(v, listar(v)).toEqual([]);
  });

  it.each([
    ['el.innerHTML = dado;', 'innerHTML'],
    ['el.outerHTML = dado;', 'outerHTML'],
    ["el.insertAdjacentHTML('beforeend', dado);", 'insertAdjacentHTML'],
    ['const x = <div dangerouslySetInnerHTML={{ __html: dado }} />;', 'dangerouslySetInnerHTML'],
    ['document.write(dado);', 'document.write'],
    ['document.writeln(dado);', 'document.write'],
    ['eval(codigo);', 'eval('],
    ['globalThis.eval(codigo);', 'eval('],
    ["const f = new Function('a', codigo);", 'new Function('],
    ['const f = Function(codigo);', 'Function('],
    ["el['innerHTML'] = dado;", 'colchetes'],
    ['range.createContextualFragment(dado);', 'createContextualFragment'],
    ['const x = <iframe srcDoc={dado} />;', 'srcdoc'],
  ])('detecta: %s', (conteudo, nome) => {
    const v = varrerHtml(um('src/interface/v.tsx', conteudo));
    expect(v.length, `não detectou ${nome}`).toBeGreaterThan(0);
    expect(formatarViolacao(v[0]!)).toContain('regra 7');
    expect(v.map((x) => x.motivo).join(' ')).toContain(nome);
  });

  it('não acusa comentários, strings nem nomes parecidos', () => {
    const conteudo = [
      '// nunca use innerHTML nem eval(x)',
      '/* dangerouslySetInnerHTML é proibido */',
      "const aviso = 'innerHTML e document.write são proibidos';",
      'const textContent = no.textContent;',
      'const avaliar = (x: number) => x;',
      'type F = Function;',
    ].join('\n');
    const v = varrerHtml(um('src/interface/ok.tsx', conteudo));
    expect(v, listar(v)).toEqual([]);
  });
});

describe('ARQ — regra 8: rede só em src/integracoes/revisao-texto (após o M7)', () => {
  it('src/ não importa módulos de rede nem chama fetch/XMLHttpRequest/WebSocket/net', () => {
    const v = varrerRede(fontes);
    expect(v, listar(v)).toEqual([]);
  });

  it('a política de URLs contém "https:" em strings e não é acusada (strings não são rede)', () => {
    const politica = fontes.find((f) => f.arquivo === 'src/principal/seguranca/politica-urls.ts');
    expect(politica?.conteudo).toContain("'https:'");
    expect(varrerRede([politica!])).toEqual([]);
  });

  it.each([
    ["import http from 'node:http';", 'módulo de rede'],
    ["import https from 'node:https';", 'módulo de rede'],
    ["import { createConnection } from 'node:net';", 'módulo de rede'],
    ["import { get } from 'http';", 'módulo de rede'],
    ["import * as https from 'https';", 'módulo de rede'],
    ["const net = require('net');", 'módulo de rede'],
    ["import { request } from 'undici';", 'módulo de rede'],
    ["import { app, net } from 'electron';", 'net do electron'],
    ["const { net } = require('electron'); net.request('x');", 'net.request'],
    ["const r = require('electron').net;", "require('electron').net"],
    ["await net.fetch('https://x');", 'fetch('],
    ["await fetch('https://x');", 'fetch('],
    ["await session.defaultSession.fetch('https://x');", 'fetch('],
    ['const x = new XMLHttpRequest();', 'XMLHttpRequest'],
    ["const w = new WebSocket('wss://x');", 'WebSocket'],
    ["navigator.sendBeacon('https://x', d);", 'sendBeacon'],
  ])('detecta: %s', (conteudo, nome) => {
    const v = varrerRede(um('src/principal/v.ts', conteudo));
    expect(v.length, `não detectou ${nome}`).toBeGreaterThan(0);
    expect(formatarViolacao(v[0]!)).toContain('regra 8');
    expect(v.map((x) => x.motivo).join(' ')).toContain(nome);
  });

  it('em src/integracoes/revisao-texto/ a rede é permitida', () => {
    const conteudo = "import { request } from 'undici';\nawait fetch('https://api.languagetool.org');";
    expect(varrerRede(um('src/integracoes/revisao-texto/cliente.ts', conteudo))).toEqual([]);
    expect(varrerRede(um('src/integracoes/conversao-pdf/cliente.ts', conteudo)).length).toBeGreaterThan(0);
  });

  it("não acusa strings com 'https:' nem comentários sobre fetch", () => {
    const conteudo = [
      "const PROTOCOLOS = ['https:'];",
      '// blob: só como imagem ou xhr/fetch',
      "const tipos = new Set(['xhr', 'fetch']);",
      "if (url.protocol === 'https:') {}",
    ].join('\n');
    const v = varrerRede(um('src/principal/seguranca/x.ts', conteudo));
    expect(v, listar(v)).toEqual([]);
  });
});

describe('C-6: shell.openExternal só em src/principal/seguranca/endurecimento.ts', () => {
  it('nenhum outro arquivo de src/ chama openExternal', () => {
    const v = varrerOpenExternal(fontes);
    expect(v, listar(v)).toEqual([]);
  });

  it('o arquivo autorizado de fato é o que chama openExternal (o teste não é vazio)', () => {
    const autorizado = fontes.find((f) => f.arquivo === ARQUIVO_OPEN_EXTERNAL);
    expect(autorizado?.conteudo).toMatch(/shell\.openExternal\(/);
  });

  it.each([
    ['src/principal/index.ts', 'await shell.openExternal(url);'],
    ['src/principal/outro.ts', "await shell['openExternal'](url);"],
    ['src/principal/outro.ts', 'const { openExternal } = shell;'],
  ])('detecta em %s: %s', (arquivo, conteudo) => {
    const v = varrerOpenExternal(um(arquivo, conteudo));
    expect(v.length).toBeGreaterThan(0);
    expect(formatarViolacao(v[0]!)).toContain('C-6');
  });
});

describe('C-18 / C-19: dependências fixadas e proibidas', () => {
  const pacote = JSON.parse(readFileSync(join(raizApp, 'package.json'), 'utf8')) as Record<string, unknown>;
  const caminhoLock = join(raizApp, 'package-lock.json');
  const SECOES = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;
  const PROIBIDAS = ['html2canvas', 'jspdf'];
  // As versões exatas (sem ^ ou ~) já são testadas em tests/estrutura.test.ts.

  it('package-lock.json existe e usa lockfileVersion >= 3', () => {
    expect(existsSync(caminhoLock)).toBe(true);
    const lock = JSON.parse(readFileSync(caminhoLock, 'utf8')) as { lockfileVersion?: number };
    expect(lock.lockfileVersion).toBeGreaterThanOrEqual(3);
  });

  it('o lockfile está em sincronia com as dependências diretas do package.json', () => {
    const lock = JSON.parse(readFileSync(caminhoLock, 'utf8')) as {
      packages: Record<string, Record<string, unknown>>;
    };
    const raiz = lock.packages[''] ?? {};
    for (const secao of ['dependencies', 'devDependencies'] as const) {
      expect(raiz[secao] ?? {}, secao).toEqual(pacote[secao] ?? {});
    }
  });

  it('todo pacote do lockfile tem versão (nada sem versão)', () => {
    const lock = JSON.parse(readFileSync(caminhoLock, 'utf8')) as {
      packages: Record<string, { version?: string; link?: boolean }>;
    };
    const semVersao = Object.entries(lock.packages)
      .filter(([caminho, info]) => caminho !== '' && !info.link && !info.version)
      .map(([caminho]) => caminho);
    expect(semVersao).toEqual([]);
  });

  it('sem html2canvas nem jspdf no package.json nem no lockfile (C-19)', () => {
    for (const secao of SECOES) {
      const deps = (pacote[secao] ?? {}) as Record<string, string>;
      for (const proibida of PROIBIDAS) expect(Object.keys(deps).map((d) => d.toLowerCase()), secao).not.toContain(proibida);
    }
    const lock = JSON.parse(readFileSync(caminhoLock, 'utf8')) as { packages: Record<string, unknown> };
    const encontradas = Object.keys(lock.packages).filter((caminho) =>
      PROIBIDAS.some((p) => caminho.toLowerCase().endsWith(`node_modules/${p}`)),
    );
    expect(encontradas).toEqual([]);
  });
});
