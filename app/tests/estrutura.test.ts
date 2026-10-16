// Teste de estrutura do M1-T01: os módulos do ADR-0005 existem, cada um com index.ts.
// As regras de importação (fronteiras) são testadas no M1-T03.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raizApp = join(__dirname, '..');

const MODULOS_ADR_0005 = [
  'principal',
  'persistencia',
  'integracoes',
  'aplicacao',
  'interface',
  'exportacao/docx',
  'importacao',
  'dominio/modelo',
  'dominio/normas',
  'dominio/bibliografia',
  'dominio/visuais',
  'dominio/numeracao',
  'dominio/verificador',
  'dominio/esquemas',
] as const;

describe('estrutura de módulos (ADR-0005, seção 1)', () => {
  it.each(MODULOS_ADR_0005)('src/%s/index.ts existe e descreve as regras de dependência', (modulo) => {
    const arquivo = join(raizApp, 'src', modulo, 'index.ts');
    expect(existsSync(arquivo), `faltando ${arquivo}`).toBe(true);
    expect(readFileSync(arquivo, 'utf8')).toContain('Regras de dependência');
  });

  it('a pasta de dados perfis/uft-2022 existe fora de src/', () => {
    expect(existsSync(join(raizApp, 'perfis', 'uft-2022'))).toBe(true);
  });

  it('o package.json fixa versões exatas (sem ^ ou ~)', () => {
    const pacote = JSON.parse(readFileSync(join(raizApp, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const versoes = { ...pacote.dependencies, ...pacote.devDependencies };
    expect(Object.keys(versoes).length).toBeGreaterThan(0);
    for (const [nome, versao] of Object.entries(versoes)) {
      expect(versao, nome).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
