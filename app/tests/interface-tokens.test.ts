// M1-T10 — tokens de tema: contraste WCAG 2.2 (1.4.3 texto ≥ 4,5:1; 1.4.11 não texto ≥ 3:1) dos pares usados pela
// interface, nos temas claro e escuro; componentes sem cor solta (só var(--...)); sem marca de terceiros (UI-02).
// Pares e fórmula iguais aos de analise/poc-ui/contraste.py (Etapa 4).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pastaInterface = join(__dirname, '..', 'src', 'interface');
const tokensCss = readFileSync(join(pastaInterface, 'estilos', 'tokens.css'), 'utf8');

function bloco(seletor: string): Record<string, string> {
  const inicio = tokensCss.indexOf(`${seletor} {`);
  expect(inicio, `bloco ${seletor}`).toBeGreaterThanOrEqual(0);
  const corpo = tokensCss.slice(inicio, tokensCss.indexOf('}', inicio));
  return Object.fromEntries([...corpo.matchAll(/--cor-([a-z-]+):\s*(#[0-9A-Fa-f]{6});/g)].map((m) => [m[1]!, m[2]!]));
}

const linear = (c8: number): number => {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminancia = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};
const razao = (a: string, b: string): number => {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
};

const TEXTO = 4.5;
const NAO_TEXTO = 3;
const PARES: readonly [string, string, number][] = [
  ['texto', 'fundo', TEXTO],
  ['texto', 'superficie', TEXTO],
  ['texto-barras', 'barras', TEXTO],
  ['texto-sec', 'fundo', TEXTO],
  ['texto-sec', 'superficie', TEXTO],
  ['sobre-destaque', 'destaque', TEXTO],
  ['sobre-destaque', 'destaque-hover', TEXTO],
  ['destaque-texto', 'fundo', TEXTO],
  ['destaque-texto', 'superficie', TEXTO],
  ['sobre-secundaria', 'secundaria', TEXTO],
  ['sucesso', 'fundo', TEXTO],
  ['alerta', 'fundo', TEXTO],
  ['erro', 'fundo', TEXTO],
  ['sucesso', 'superficie', TEXTO],
  ['alerta', 'superficie', TEXTO],
  ['erro', 'superficie', TEXTO],
  ['foco', 'fundo', NAO_TEXTO],
  ['foco', 'superficie', NAO_TEXTO],
  ['foco-barras', 'barras', NAO_TEXTO],
  ['borda-controle', 'fundo', NAO_TEXTO],
  ['borda-controle', 'superficie', NAO_TEXTO],
  ['borda-barras', 'barras', NAO_TEXTO],
  ['indicador-ativo', 'barras', NAO_TEXTO],
];

describe('tokens de tema (paleta A — Cerrado claro)', () => {
  it('fórmula de contraste confere com valores conhecidos', () => {
    expect(razao('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
    expect(razao('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it.each([
    ['claro', ':root'],
    ['escuro', ':root[data-tema="escuro"]'],
  ])('tema %s: todos os pares atingem o mínimo da WCAG', (_tema, seletor) => {
    const cores = bloco(seletor);
    const reprovados = PARES.filter(([fg, bg, min]) => {
      expect(cores[fg], `--cor-${fg}`).toBeDefined();
      expect(cores[bg], `--cor-${bg}`).toBeDefined();
      return razao(cores[fg]!, cores[bg]!) < min;
    }).map(([fg, bg, min]) => `${fg} sobre ${bg}: ${razao(cores[fg]!, cores[bg]!).toFixed(2)} < ${min}`);
    expect(reprovados).toEqual([]);
  });

  it('a cor de foco é azul (decisão do usuário) e diferente do destaque e do sucesso', () => {
    const c = bloco(':root');
    expect(c['foco']).toBe('#1F5FBF');
    expect(c['foco']).not.toBe(c['destaque']);
    expect(c['foco']).not.toBe(c['sucesso']);
  });

  it('fora de tokens.css não há cor escrita à mão (hex, rgb ou hsl) nos estilos e componentes', () => {
    const arquivos: string[] = [];
    const varrer = (pasta: string) => {
      for (const e of readdirSync(pasta, { withFileTypes: true })) {
        const caminho = join(pasta, e.name);
        if (e.isDirectory()) varrer(caminho);
        else if (/\.(css|tsx?)$/.test(e.name) && e.name !== 'tokens.css') arquivos.push(caminho);
      }
    };
    varrer(pastaInterface);
    const corSolta = /#[0-9a-fA-F]{3,8}\b(?![-\w])|\brgba?\(|\bhsla?\(/;
    const achados = arquivos.flatMap((a) =>
      readFileSync(a, 'utf8')
        .split('\n')
        .map((linha, i) => ({ a, i: i + 1, linha }))
        // Ids de símbolo SVG ("#i-erro", "#pequi") não são cor; comentários também não.
        .filter(({ linha }) => corSolta.test(linha.replace(/\/\/.*$|\/\*.*?\*\//g, '')) && !/href=/.test(linha)),
    );
    // A cor de fundo da janela (antes do primeiro quadro) fica no principal, não na interface.
    expect(achados.map(({ a, i, linha }) => `${a}:${i}: ${linha.trim()}`)).toEqual([]);
  });
});

describe('UI-02: nenhum elemento de marca de terceiros na interface', () => {
  it('src/interface não cita Apple, iTunes nem maçã', () => {
    const achados: string[] = [];
    const varrer = (pasta: string) => {
      for (const e of readdirSync(pasta, { withFileTypes: true })) {
        const caminho = join(pasta, e.name);
        if (e.isDirectory()) varrer(caminho);
        else if (/apple|itunes|maçã|maca/i.test(readFileSync(caminho, 'utf8'))) achados.push(caminho);
      }
    };
    varrer(pastaInterface);
    expect(achados).toEqual([]);
  });
});
