// Testes do grupo PER (M1-T04): o JSON Schema versionado em app/esquemas/projeto-v1/ está em sincronia com os
// esquemas zod e é fiel nas restrições estruturais (ADR-0004, seção 2).
// Para regravar os arquivos depois de mudar um esquema: `npm run esquemas:gerar` (roda este arquivo em modo de gravação).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gerarJsonSchemasV1, type ArquivoJsonSchema } from '../src/dominio/esquemas';

const pastaEsquemas = join(__dirname, '..', 'esquemas', 'projeto-v1');
const gerados = gerarJsonSchemasV1();
const arquivos = Object.keys(gerados) as ArquivoJsonSchema[];
const modoGravacao = process.env.npm_lifecycle_event === 'esquemas:gerar';

if (modoGravacao) {
  mkdirSync(pastaEsquemas, { recursive: true });
  for (const nome of arquivos) writeFileSync(join(pastaEsquemas, nome), `${JSON.stringify(gerados[nome], null, 2)}\n`, 'utf8');
}

type No = Record<string, unknown>;

/** Visita todo subesquema (properties, items, oneOf/anyOf, $defs). */
function visitar(no: unknown, caminho: string, f: (no: No, caminho: string) => void): void {
  if (no === null || typeof no !== 'object') return;
  const n = no as No;
  f(n, caminho);
  for (const [chave, filho] of Object.entries((n.properties as No | undefined) ?? {})) visitar(filho, `${caminho}.${chave}`, f);
  for (const [chave, filho] of Object.entries((n.$defs as No | undefined) ?? {})) visitar(filho, `$defs.${chave}`, f);
  if (n.items) visitar(n.items, `${caminho}[]`, f);
  for (const k of ['oneOf', 'anyOf', 'allOf'] as const) {
    (n[k] as unknown[] | undefined)?.forEach((filho, i) => visitar(filho, `${caminho}|${k}${i}`, f));
  }
}

describe.each(arquivos)('JSON Schema %s', (nome) => {
  const esquema = gerados[nome];

  it('o arquivo versionado é igual ao gerado dos esquemas zod (rode `npm run esquemas:gerar` se mudou)', () => {
    const arquivo = join(pastaEsquemas, nome);
    expect(existsSync(arquivo), `faltando ${arquivo}`).toBe(true);
    expect(JSON.parse(readFileSync(arquivo, 'utf8'))).toEqual(esquema);
  });

  it('usa o draft 2020-12 e tem $id local (sem URL de rede)', () => {
    expect(esquema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(esquema.$id).toMatch(/^urn:bibliodocs:/);
  });

  it('todo objeto é fechado: additionalProperties false', () => {
    visitar(esquema, '$', (no, caminho) => {
      if (no.type === 'object') expect(no.additionalProperties, caminho).toBe(false);
    });
  });

  it('toda lista tem maxItems e toda string tem maxLength, pattern, const ou enum', () => {
    visitar(esquema, '$', (no, caminho) => {
      if (no.type === 'array') expect(no.maxItems, caminho).toBeTypeOf('number');
      if (no.type === 'string') {
        const limitada = ['maxLength', 'pattern', 'const', 'enum'].some((k) => k in no);
        expect(limitada, caminho).toBe(true);
      }
    });
  });

  it('as uniões de tipo usam oneOf com discriminador constante', () => {
    const defs = (esquema.$defs ?? {}) as Record<string, No>;
    const resolver = (opcao: No): No => (typeof opcao.$ref === 'string' ? defs[opcao.$ref.replace('#/$defs/', '')]! : opcao);
    visitar(esquema, '$', (no, caminho) => {
      for (const opcao of (no.oneOf as No[] | undefined) ?? []) {
        expect((resolver(opcao).properties as No | undefined)?.tipo, caminho).toHaveProperty('const');
      }
    });
  });
});

it('documento.schema.json exige marcas únicas e texto apto a XML 1.0', () => {
  const texto = JSON.stringify(gerados['documento.schema.json']);
  expect(texto).toContain('"uniqueItems":true');
  expect(texto).toContain('\\\\p{Cs}');
});

it('documento.schema.json define Secao como $defs recursiva e nomeia os trechos, a alínea e os elementos', () => {
  const defs = gerados['documento.schema.json'].$defs as Record<string, No>;
  expect(Object.keys(defs).sort()).toEqual(['Autor', 'ElementoPosTextual', 'ElementoPreTextual', 'Inline', 'InlineCitacao', 'InlineNota', 'InlineTexto', 'ItemAlinea', 'Obra', 'ObraCitada', 'Secao']);
  expect(JSON.stringify(defs.Secao)).toContain('"$ref":"#/$defs/Secao"');
});
