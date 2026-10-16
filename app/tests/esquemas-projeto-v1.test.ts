// Testes do grupo PER (M1-T04): esquemas zod do formato v1 e mensagens em pt-BR (ADR-0004, seções 2 e 3).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type { Documento } from '../src/dominio/modelo';
import {
  descreverErros,
  esquemaDocumentoV1,
  LIMITES_V1,
  profundidadeJsonExcede,
  validarDocumentoV1,
  validarManifestoV1,
  type ErroValidacao,
  type ResultadoValidacao,
} from '../src/dominio/esquemas';

const pastaFixtures = join(__dirname, 'fixtures', 'projeto-v1');
const lerFixture = (nome: string): Record<string, any> => JSON.parse(readFileSync(join(pastaFixtures, nome), 'utf8'));

function erros<T>(r: ResultadoValidacao<T>): ErroValidacao[] {
  expect(r.ok, 'deveria ter sido recusado').toBe(false);
  return r.ok ? [] : r.erros;
}

/** Corpo com `n` níveis de seção encadeados. */
function corpoComProfundidade(n: number): unknown[] {
  let secao: Record<string, unknown> | null = null;
  for (let nivel = n; nivel >= 1; nivel--) {
    secao = { id: `sec_nivel${String(nivel).padStart(3, '0')}`, titulo: [], blocos: [], subsecoes: secao ? [secao] : [] };
  }
  return secao ? [secao] : [];
}

// Palavras em inglês que denunciariam mensagem sem tradução.
const INGLES = /\b(expected|received|invalid input|unrecognized|too (big|small)|required)\b/i;

describe('modelo × esquema (contrato)', () => {
  it('o tipo inferido do esquema é exatamente o tipo Documento do modelo', () => {
    expectTypeOf<z.infer<typeof esquemaDocumentoV1>>().toEqualTypeOf<Documento>();
  });
});

describe('documento.json v1', () => {
  it('a fixture válida passa e sai idêntica', () => {
    const json = lerFixture('documento-valido.json');
    const r = validarDocumentoV1(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toEqual(json);
  });

  it('ida e volta por JSON.stringify mantém o documento válido e igual', () => {
    const r = validarDocumentoV1(lerFixture('documento-valido.json'));
    if (!r.ok) throw new Error(descreverErros(r.erros));
    const r2 = validarDocumentoV1(JSON.parse(JSON.stringify(r.valor)));
    expect(r2).toEqual(r);
  });

  it('campo extra na raiz é recusado com mensagem pt-BR', () => {
    const json = { ...lerFixture('documento-valido.json'), html: '<b>x</b>' };
    expect(erros(validarDocumentoV1(json))).toEqual([{ caminho: 'documento', mensagem: 'campo não permitido: "html"' }]);
  });

  it('campo extra aninhado é recusado com o caminho exato', () => {
    const json = lerFixture('documento-valido.json');
    json.corpo[0].subsecoes[0].numero = '1.1';
    expect(erros(validarDocumentoV1(json))).toEqual([
      { caminho: 'documento.corpo[0].subsecoes[0]', mensagem: 'campo não permitido: "numero"' },
    ]);
  });

  it('tipo errado é recusado', () => {
    const json = lerFixture('documento-valido.json');
    json.corpo[0].blocos[0].conteudo[0].texto = 42;
    const [e] = erros(validarDocumentoV1(json));
    expect(e?.caminho).toBe('documento.corpo[0].blocos[0].conteudo[0].texto');
    expect(e?.mensagem).toMatch(/esperava um texto, recebeu um número/);
  });

  it('campo obrigatório ausente é recusado', () => {
    const json = lerFixture('documento-valido.json');
    delete json.corpo[1].subsecoes;
    expect(erros(validarDocumentoV1(json))).toEqual([{ caminho: 'documento.corpo[1].subsecoes', mensagem: 'campo obrigatório ausente' }]);
  });

  it('tipo de bloco desconhecido é recusado', () => {
    const json = lerFixture('documento-valido.json');
    json.corpo[0].blocos.push({ tipo: 'html', id: 'blc_00000001', conteudo: '<script>' });
    const [e] = erros(validarDocumentoV1(json));
    expect(e?.caminho).toBe('documento.corpo[0].blocos[2].tipo');
    expect(e?.mensagem).not.toMatch(INGLES);
  });

  it('marca e tipo de trabalho fora da enumeração são recusados', () => {
    const json = lerFixture('documento-valido.json');
    json.tipoTrabalho = 'tese';
    json.metadados.titulo[1].marcas = ['sublinhado'];
    const lista = erros(validarDocumentoV1(json));
    expect(lista.map((e) => e.caminho).sort()).toEqual(['documento.metadados.titulo[1].marcas[0]', 'documento.tipoTrabalho']);
  });

  it('id fora do padrão é recusado com explicação', () => {
    const json = lerFixture('documento-valido.json');
    json.corpo[0].id = '../x';
    expect(erros(validarDocumentoV1(json))[0]?.mensagem).toMatch(/^identificador inválido/);
  });

  it('texto acima do limite é recusado', () => {
    const json = lerFixture('documento-valido.json');
    json.metadados.subtitulo[0].texto = 'a'.repeat(LIMITES_V1.textoInline + 1);
    const [e] = erros(validarDocumentoV1(json));
    expect(e?.caminho).toBe('documento.metadados.subtitulo[0].texto');
    expect(e?.mensagem).toMatch(/Grande demais/);
  });

  it('tabulação, quebra de linha e caracteres fora do BMP são aceitos no texto', () => {
    const json = lerFixture('documento-valido.json');
    json.metadados.subtitulo[0].texto = 'col1\tcol2\nlinha 2 — 😀 ≥ ∑';
    expect(validarDocumentoV1(json).ok).toBe(true);
  });

  it.each([
    ['NUL', '\u0000'],
    ['retorno de carro', '\r'],
    ['tabulação vertical', '\u000B'],
    ['U+FFFF', '￿'],
    ['surrogate isolado', '\uD800'],
  ])('caractere proibido em XML 1.0 (%s) é recusado no texto', (_nome, caractere) => {
    const json = lerFixture('documento-valido.json');
    json.corpo[0].blocos[0].conteudo[0].texto = `antes${caractere}depois`;
    expect(erros(validarDocumentoV1(json))).toEqual([
      {
        caminho: 'documento.corpo[0].blocos[0].conteudo[0].texto',
        mensagem: 'o texto contém caractere de controle ou inválido (só tabulação e quebra de linha são aceitas)',
      },
    ]);
  });

  it.each([
    [['italico', 'italico'], 'marca repetida'],
    [['sobrescrito', 'subscrito'], 'sobrescrito e subscrito não podem ser usados juntos'],
  ])('marcas %j são recusadas', (marcas, mensagem) => {
    const json = lerFixture('documento-valido.json');
    json.metadados.titulo[1].marcas = marcas;
    expect(erros(validarDocumentoV1(json))).toEqual([{ caminho: 'documento.metadados.titulo[1].marcas', mensagem }]);
  });

  it('id de seção repetido é recusado apontando a segunda ocorrência', () => {
    const json = lerFixture('documento-valido.json');
    json.corpo[1].id = json.corpo[0].subsecoes[0].id;
    expect(erros(validarDocumentoV1(json))).toEqual([{ caminho: 'documento.corpo[1].id', mensagem: 'identificador repetido no documento' }]);
  });

  it('id de bloco igual ao de uma seção é recusado', () => {
    const json = lerFixture('documento-valido.json');
    json.corpo[0].blocos[1].id = json.corpo[0].id;
    expect(erros(validarDocumentoV1(json))).toEqual([
      { caminho: 'documento.corpo[0].blocos[1].id', mensagem: 'identificador repetido no documento' },
    ]);
  });

  it(`aceita ${LIMITES_V1.profundidadeSecoes} níveis de seção`, () => {
    const json = { ...lerFixture('documento-valido.json'), corpo: corpoComProfundidade(LIMITES_V1.profundidadeSecoes) };
    expect(validarDocumentoV1(json).ok).toBe(true);
  });

  it(`recusa ${LIMITES_V1.profundidadeSecoes + 1} níveis de seção apontando a seção excedente`, () => {
    const json = { ...lerFixture('documento-valido.json'), corpo: corpoComProfundidade(LIMITES_V1.profundidadeSecoes + 1) };
    const [e] = erros(validarDocumentoV1(json));
    expect(e?.mensagem).toBe(`seções aninhadas demais (limite de ${LIMITES_V1.profundidadeSecoes} níveis)`);
    expect(e?.caminho.match(/subsecoes/g)).toHaveLength(LIMITES_V1.profundidadeSecoes);
  });

  it('aninhamento JSON patológico (100.000 níveis) é recusado sem estourar a pilha', () => {
    let v: unknown = [];
    for (let i = 0; i < 100_000; i++) v = [v];
    const json = { ...lerFixture('documento-valido.json'), corpo: v };
    expect(erros(validarDocumentoV1(json))).toEqual([
      { caminho: 'documento', mensagem: `estrutura aninhada demais (limite de ${LIMITES_V1.profundidadeJson} níveis)` },
    ]);
  });

  it.each([null, 'texto', 7, []])('raiz que não é objeto (%j) é recusada', (raiz) => {
    expect(validarDocumentoV1(raiz).ok).toBe(false);
  });
});

describe('manifesto.json v1', () => {
  it('a fixture válida passa', () => {
    const json = lerFixture('manifesto-valido.json');
    const r = validarManifestoV1(json);
    expect(r).toEqual({ ok: true, valor: json });
  });

  it('campo extra é recusado', () => {
    const json = { ...lerFixture('manifesto-valido.json'), executar: 'cmd.exe' };
    expect(erros(validarManifestoV1(json))).toEqual([{ caminho: 'manifesto', mensagem: 'campo não permitido: "executar"' }]);
  });

  it('versão de formato diferente de 1 é recusada pelo esquema v1', () => {
    const json = { ...lerFixture('manifesto-valido.json'), versaoFormato: 2 };
    const [e] = erros(validarManifestoV1(json));
    expect(e?.caminho).toBe('manifesto.versaoFormato');
  });

  it('data sem fuso horário é recusada', () => {
    const json = { ...lerFixture('manifesto-valido.json'), criadoEm: '2026-10-16T09:00:00' };
    expect(erros(validarManifestoV1(json))[0]?.mensagem).toMatch(/^data e hora inválida/);
  });

  it('caminho de mídia com ".." é recusado', () => {
    const json = lerFixture('manifesto-valido.json');
    json.midias[0].caminho = '../../Windows/x.png';
    expect(erros(validarManifestoV1(json))[0]?.mensagem).toMatch(/^caminho de mídia inválido/);
  });

  it('caminho incoerente com sha256 ou tipo é recusado', () => {
    const json = lerFixture('manifesto-valido.json');
    json.midias[0].tipo = 'image/jpeg';
    expect(erros(validarManifestoV1(json))).toEqual([
      { caminho: 'manifesto.midias[0].caminho', mensagem: `o caminho da mídia deve ser midias/${json.midias[0].sha256}.jpg (sha256 e tipo declarados)` },
    ]);
  });

  it('SVG não é tipo de mídia aceito', () => {
    const json = lerFixture('manifesto-valido.json');
    json.midias[0].tipo = 'image/svg+xml';
    expect(erros(validarManifestoV1(json))[0]?.caminho).toBe('manifesto.midias[0].tipo');
  });

  it('mídia repetida é recusada', () => {
    const json = lerFixture('manifesto-valido.json');
    json.midias.push({ ...json.midias[0] });
    expect(erros(validarManifestoV1(json))).toEqual([{ caminho: 'manifesto.midias[1].sha256', mensagem: 'mídia repetida no manifesto' }]);
  });

  it('tamanho de mídia acima do limite é recusado', () => {
    const json = lerFixture('manifesto-valido.json');
    json.midias[0].bytes = LIMITES_V1.bytesMidia + 1;
    expect(erros(validarManifestoV1(json))[0]?.caminho).toBe('manifesto.midias[0].bytes');
  });
});

describe('mensagens', () => {
  it('nenhuma mensagem de um documento muito inválido fica em inglês', () => {
    const lixo = {
      id: 1,
      tipoTrabalho: null,
      metadados: { titulo: 'x', extra: 1 },
      corpo: [{ id: 'abc', titulo: [{ tipo: 'texto' }], blocos: [{ tipo: 'x' }], subsecoes: {} }],
      outro: true,
    };
    const lista = erros(validarDocumentoV1(lixo));
    expect(lista.length).toBeGreaterThan(4);
    for (const e of lista) expect(e.mensagem, `${e.caminho}: ${e.mensagem}`).not.toMatch(INGLES);
  });

  it(`descreverErros lista no máximo ${LIMITES_V1.errosRelatados} erros e resume o restante`, () => {
    const muitos = Array.from({ length: LIMITES_V1.errosRelatados + 3 }, (_, i) => ({ caminho: `x[${i}]`, mensagem: 'erro' }));
    const linhas = descreverErros(muitos).split('\n');
    expect(linhas).toHaveLength(LIMITES_V1.errosRelatados + 1);
    expect(linhas.at(-1)).toBe('… e mais 3 erros');
  });

  it('profundidadeJsonExcede conta objetos e listas, não valores simples', () => {
    expect(profundidadeJsonExcede({ a: [{ b: 1 }] }, 3)).toBe(false);
    expect(profundidadeJsonExcede({ a: [{ b: [] }] }, 3)).toBe(true);
    expect(profundidadeJsonExcede('texto', 0)).toBe(false);
  });
});
