// Testes do M1-T14: configuração do empacotamento (C-13, C-14, C-16, C-17) e ganchos do pacote.
// Conferem a configuração e os ganchos; o pacote gerado é conferido pela fumaça registrada no relatório do M1
// (fuses lidos do .exe, ASAR adulterado recusado, instalar/abrir/desinstalar).
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const raizApp = join(__dirname, '..');
const exigir = createRequire(__filename);
const lerFonte = (relativo: string): string => readFileSync(join(raizApp, relativo), 'utf8');

interface Configuracao {
  files: string[];
  electronDist: string;
  afterPack: string;
  npmRebuild: boolean;
  asar: boolean;
  electronFuses: Record<string, boolean>;
  win: { target: { target: string; arch: string[] }[]; icon: string };
  nsis: Record<string, unknown>;
  publish: unknown;
}

const config = exigir(join(raizApp, 'electron-builder.config.cjs')) as Configuracao;
const pacote = JSON.parse(lerFonte('package.json')) as {
  name: string;
  author?: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};

describe('fuses e ASAR (C-13, C-14)', () => {
  it('os fuses são exatamente os do checklist', () => {
    expect(config.electronFuses).toEqual({
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      enableEmbeddedAsarIntegrityValidation: true,
      onlyLoadAppFromAsar: true,
      grantFileProtocolExtraPrivileges: false,
    });
  });

  it('o app vai num ASAR, sem mapas de código e só com o build', () => {
    expect(config.asar).toBe(true);
    expect(config.files).toContain('out/**/*');
    expect(config.files).toContain('!out/**/*.map');
    expect(config.files.filter((f) => !f.startsWith('!'))).toEqual(['out/**/*', 'package.json']);
  });

  it('usa o Electron já instalado, sem baixar e sem recompilar módulos', () => {
    expect(config.electronDist).toBe('node_modules/electron/dist');
    expect(config.npmRebuild).toBe(false);
  });
});

describe('instalador (C-16, C-17)', () => {
  it('NSIS por usuário, sem elevação, sem apagar os dados do usuário', () => {
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
    expect(config.nsis).toMatchObject({
      oneClick: true,
      perMachine: false,
      allowElevation: false,
      packElevateHelper: false,
      deleteAppDataOnUninstall: false,
    });
  });

  it('só o alvo dist:fumaca (pasta, saída própria) leva a marca que libera as chaves da fumaça (A-1)', () => {
    expect(JSON.stringify(config)).not.toContain('bibliodocsFumaca');
    const comMarca = Object.entries(pacote.scripts).filter(([, s]) => s.includes('bibliodocsFumaca'));
    expect(comMarca.map(([nome]) => nome)).toEqual(['dist:fumaca']);
    const fumaca = pacote.scripts['dist:fumaca'] ?? '';
    expect(fumaca).toContain('--win dir');
    expect(fumaca).not.toContain('nsis');
    expect(fumaca).toContain('-c.directories.output=release-fumaca');
  });

  it('sem atualização automática: publish nulo, sem electron-updater, sem autoUpdater no código', () => {
    expect(config.publish).toBeNull();
    expect(Object.keys(pacote.dependencies)).not.toContain('electron-updater');
    for (const script of [pacote.scripts['dist'], pacote.scripts['dist:pasta']]) {
      expect(script).toContain('--publish never');
      expect(script).toContain('--config electron-builder.config.cjs');
    }
    const fontes = (pasta: string): string[] =>
      readdirSync(join(raizApp, pasta), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? fontes(join(pasta, e.name)) : /\.tsx?$/.test(e.name) ? [join(pasta, e.name)] : [],
      );
    for (const arquivo of fontes('src')) expect(lerFonte(arquivo), arquivo).not.toMatch(/autoUpdater|electron-updater/);
  });

  it('o gancho NSIS apaga a cópia do instalador na pasta <name>-updater, ao instalar e ao desinstalar', () => {
    expect(config.nsis['include']).toBe('empacotamento/instalador.nsh');
    const nsh = lerFonte('empacotamento/instalador.nsh');
    const pasta = `$LOCALAPPDATA\\${pacote.name}-updater`;
    for (const macro of ['customInstall', 'customUnInstall']) {
      const corpo = new RegExp(`!macro ${macro}\\r?\\n([\\s\\S]*?)!macroend`).exec(nsh)?.[1] ?? '';
      expect(corpo, macro).toContain(`RMDir "${pasta}"`);
      expect(corpo, macro).toMatch(/^\s*Delete "\$LOCALAPPDATA\\/m);
      // RMDir /r apagaria o que estivesse na pasta; só a pasta vazia sai.
      expect(corpo, macro).not.toContain('/r');
    }
  });

  it('o exe não herda "GitHub, Inc." como empresa: o package.json tem author', () => {
    expect(pacote.author).toBe('BiblioDocs Pro');
  });
});

describe('ícone do app', () => {
  it('o .exe usa o pequi (não o ícone padrão do Electron): .ico com 16 a 256 px em PNG, gerado dos SVGs', () => {
    expect(config.win.icon).toBe('recursos-build/icone.ico');
    const ico = readFileSync(join(raizApp, config.win.icon));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const n = ico.readUInt16LE(4);
    const lados: number[] = [];
    for (let i = 0; i < n; i++) {
      const e = 6 + 16 * i;
      lados.push(ico.readUInt8(e) || 256);
      const inicio = ico.readUInt32LE(e + 12);
      const tamanho = ico.readUInt32LE(e + 8);
      expect(inicio + tamanho).toBeLessThanOrEqual(ico.length);
      // Assinatura PNG em cada entrada.
      expect(ico.subarray(inicio, inicio + 8).toString('hex')).toBe('89504e470d0a1a0a');
    }
    expect(lados).toEqual([16, 24, 32, 48, 64, 128, 256]);
    for (const svg of ['icone.svg', 'icone-pequeno.svg']) {
      expect(lerFonte(join('recursos-build', svg))).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/);
    }
    expect(pacote.scripts['icone:gerar']).toBe('electron empacotamento/gerar-icone.cjs');
  });
});

describe('gancho afterPack', () => {
  let pasta: string | undefined;
  afterEach(() => {
    if (pasta) rmSync(pasta, { recursive: true, force: true });
    pasta = undefined;
  });

  it('apaga default_app.asar e version e mantém o resto', async () => {
    pasta = mkdtempSync(join(tmpdir(), 'bdp-apos-empacotar-'));
    mkdirSync(join(pasta, 'resources'));
    for (const nome of ['resources/default_app.asar', 'resources/app.asar', 'version', 'BiblioDocs Pro.exe']) {
      writeFileSync(join(pasta, nome), 'x');
    }
    const gancho = exigir(join(raizApp, config.afterPack)) as { default: (c: { appOutDir: string }) => Promise<void> };
    await gancho.default({ appOutDir: pasta });
    expect(readdirSync(pasta).sort()).toEqual(['BiblioDocs Pro.exe', 'resources']);
    expect(readdirSync(join(pasta, 'resources'))).toEqual(['app.asar']);
    // Sem os arquivos (segunda execução), não falha.
    await expect(gancho.default({ appOutDir: pasta })).resolves.toBeUndefined();
  });
});

describe('atalho do destino na fumaça (M3-T11)', () => {
  it('a variável só vale no pacote com a marca de fumaça, que o instalador não tem', () => {
    const fonte = lerFonte('src/principal/ipc/registrar.ts');
    expect(fonte).toContain("if (destinoFumaca && app.isPackaged && ehArtefatoDeFumaca()) return destinoFumaca;");
    expect(fonte.match(/BIBLIODOCS_FUMACA_DESTINO_DOCX/g)).toHaveLength(1);
    expect(pacote.scripts['dist']).not.toContain('bibliodocsFumaca');
  });
});
