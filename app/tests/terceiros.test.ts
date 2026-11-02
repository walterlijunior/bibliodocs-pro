// Testes do M2-T11 (C-19, RNF-15, R-M1-04): inventário de licenças de produção e TERCEIROS.txt no pacote.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Pacote {
  caminho: string;
  nome: string;
  versao: string;
  licenca: string;
}
const raizApp = join(__dirname, '..');
const exigir = createRequire(__filename);
const { DESTINO, gerarTexto, licencasRecusadas, pacotesDeProducao } = exigir(join(raizApp, 'empacotamento', 'terceiros.cjs')) as {
  DESTINO: string;
  gerarTexto(p: Pacote[]): string;
  licencasRecusadas(p: Pacote[]): Pacote[];
  pacotesDeProducao(t: unknown): Pacote[];
};
const trava = JSON.parse(readFileSync(join(raizApp, 'package-lock.json'), 'utf8')) as { packages: Record<string, unknown> };
const producao = pacotesDeProducao(trava);
const comLicenca = (licenca: string): Pacote => ({ caminho: 'node_modules/x', nome: 'x', versao: '1.0.0', licenca });

describe('inventário de licenças', () => {
  it('produção tem os pacotes esperados e nada de desenvolvimento', () => {
    const nomes = producao.map((p) => p.nome);
    for (const n of ['react', 'react-dom', 'scheduler', 'zod', 'fflate', 'prosemirror-view', 'orderedmap']) expect(nomes).toContain(n);
    for (const n of ['electron', 'vite', 'vitest', 'typescript', '@playwright/test']) expect(nomes).not.toContain(n);
  });

  it('nenhuma dependência de produção tem licença recusada', () => {
    expect(licencasRecusadas(producao)).toEqual([]);
  });

  it.each(['GPL-3.0', 'AGPL-3.0-only', 'LGPL-2.1', 'MIT OR GPL-3.0', 'MPL-2.0', 'UNLICENSED', ''])('recusa a licença "%s"', (l) => {
    expect(licencasRecusadas([comLicenca(l)])).toHaveLength(1);
  });

  it('a licença do lockfile é a mesma do pacote instalado', () => {
    for (const p of producao) {
      const instalado = JSON.parse(readFileSync(join(raizApp, p.caminho, 'package.json'), 'utf8')) as { license?: string };
      expect(instalado.license, p.nome).toBe(p.licenca);
    }
  });
});

describe('TERCEIROS.txt', () => {
  const texto = readFileSync(DESTINO, 'utf8').replace(/\r\n/g, '\n');

  it('está em dia com o lockfile', () => {
    expect(texto).toBe(gerarTexto(producao));
  });

  it('cita cada pacote com versão e licença, e o Electron e o Chromium', () => {
    for (const p of producao) expect(texto).toContain(`${p.nome} ${p.versao} (${p.licenca})`);
    expect(texto).toContain('LICENSE.electron.txt');
    expect(texto).toContain('LICENSES.chromium.html');
  });

  it('entra no pacote, ao lado das licenças do Electron', () => {
    const config = exigir(join(raizApp, 'electron-builder.config.cjs')) as { extraFiles: { from: string; to: string }[] };
    expect(config.extraFiles).toContainEqual({ from: 'recursos-build/TERCEIROS.txt', to: 'TERCEIROS.txt' });
  });
});
