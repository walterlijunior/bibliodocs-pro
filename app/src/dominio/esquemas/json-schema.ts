/**
 * Exportação do JSON Schema (draft 2020-12) do formato v1 a partir dos esquemas zod (ADR-0004, seção 2).
 * Os arquivos versionados em `app/esquemas/projeto-v1/` são conferidos contra esta saída em
 * `tests/esquemas-json-schema.test.ts`; para regravá-los: `npm run esquemas:gerar`.
 */
import { z } from 'zod';
import { esquemaDocumentoV1, esquemaManifestoV1, RESTRICOES_SO_NO_CODIGO } from './projeto-v1';

export type ArquivoJsonSchema = 'documento.schema.json' | 'manifesto.schema.json';

function gerar(esquema: z.ZodType, nome: string, titulo: string): Record<string, unknown> {
  // `io: 'input'` descreve o que pode estar no arquivo (entrada da validação).
  const gerado = z.toJSONSchema(esquema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'throw' });
  const { $schema, ...resto } = gerado;
  return {
    $schema,
    $id: `urn:bibliodocs:esquemas:projeto-v1:${nome}`,
    title: titulo,
    description: `Gerado a partir dos esquemas zod (app/src/dominio/esquemas). Restrições só no código: ${RESTRICOES_SO_NO_CODIGO.join('; ')}.`,
    ...resto,
  };
}

export function gerarJsonSchemasV1(): Record<ArquivoJsonSchema, Record<string, unknown>> {
  return {
    'documento.schema.json': gerar(esquemaDocumentoV1, 'documento', 'BiblioDocs Pro — documento.json (formato v1)'),
    'manifesto.schema.json': gerar(esquemaManifestoV1, 'manifesto', 'BiblioDocs Pro — manifesto.json (formato v1)'),
  };
}
