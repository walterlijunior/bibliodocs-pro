/**
 * Esquemas zod do formato de projeto v1 (`.bdp`, ADR-0004, seção 2): fonte da verdade do formato.
 * Todos os objetos são estritos (campo desconhecido é recusado) e toda string e lista tem limite.
 *
 * O JSON Schema publicado em `app/esquemas/projeto-v1/` é gerado daqui (`gerarJsonSchemasV1`).
 * As restrições que o JSON Schema não expressa estão em `RESTRICOES_SO_NO_CODIGO`.
 */
import { z } from 'zod';
import { LIMITES_V1 } from './limites';

export const VERSAO_FORMATO_ATUAL = 1;
export const IDENTIFICADOR_FORMATO = 'bibliodocs-projeto';
/** Conteúdo da entrada `mimetype` do ZIP (1.ª entrada, sem compressão). */
export const MIMETYPE_PROJETO = 'application/vnd.bibliodocs.projeto+zip';

export const PADRAO_ID = /^[A-Za-z0-9_-]{8,64}$/;
const PADRAO_SHA256 = /^[0-9a-f]{64}$/;
const PADRAO_CAMINHO_MIDIA = /^midias\/[0-9a-f]{64}\.(png|jpg)$/;
const PADRAO_VERSAO_SEMVER = /^\d{1,5}\.\d{1,5}\.\d{1,5}(-[0-9A-Za-z.-]{1,32})?$/;
const PADRAO_ID_PERFIL = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const id = z.string().regex(PADRAO_ID, { error: 'identificador inválido: use de 8 a 64 letras, dígitos, "_" ou "-"' });
const dataHora = z.iso.datetime({ offset: true, error: 'data e hora inválida: use o formato ISO 8601 com fuso (ex.: 2026-10-16T10:00:00-03:00)' });

// ---------- documento.json ----------

export const esquemaMarcaTexto = z.enum(['italico', 'negrito', 'sobrescrito', 'subscrito']);

/**
 * Texto que pode ir para XML 1.0 (DOCX): recusa controles C0 exceto tabulação e quebra de linha (`\n` = quebra de
 * linha manual dentro do parágrafo; `\r` não é aceito), U+FFFE, U+FFFF e surrogates isolados.
 */
export const PADRAO_TEXTO_XML = /^[^\u0000-\u0008\u000B-\u001F\uFFFE\uFFFF\p{Cs}]*$/u;

export const esquemaInlineTexto = z
  .strictObject({
    tipo: z.literal('texto'),
    texto: z
      .string()
      .max(LIMITES_V1.textoInline)
      .regex(PADRAO_TEXTO_XML, { error: 'o texto contém caractere de controle ou inválido (só tabulação e quebra de linha são aceitas)' }),
    marcas: z.array(esquemaMarcaTexto).max(4).meta({ uniqueItems: true }).optional(),
  })
  .superRefine((t, ctx) => {
    const marcas = t.marcas ?? [];
    if (new Set(marcas).size !== marcas.length) {
      ctx.addIssue({ code: 'custom', path: ['marcas'], message: 'marca repetida' });
    }
    if (marcas.includes('sobrescrito') && marcas.includes('subscrito')) {
      ctx.addIssue({ code: 'custom', path: ['marcas'], message: 'sobrescrito e subscrito não podem ser usados juntos' });
    }
  });

export const esquemaInline = z.discriminatedUnion('tipo', [esquemaInlineTexto]);

const conteudoInline = z.array(esquemaInline).max(LIMITES_V1.inlinesPorConteudo);

export const esquemaBloco = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('paragrafo'), id, conteudo: conteudoInline }),
  z.strictObject({ tipo: z.literal('quebraPagina'), id }),
]);

export const esquemaSecao = z
  .strictObject({
    id,
    titulo: conteudoInline,
    blocos: z.array(esquemaBloco).max(LIMITES_V1.blocosPorSecao),
    get subsecoes() {
      return z.array(esquemaSecao).max(LIMITES_V1.secoesPorNivel);
    },
  })
  .meta({ id: 'Secao' });

export const esquemaDocumentoV1 = z.strictObject({
  id,
  tipoTrabalho: z.enum(['generico']),
  metadados: z.strictObject({
    titulo: conteudoInline,
    subtitulo: conteudoInline.optional(),
  }),
  corpo: z.array(esquemaSecao).max(LIMITES_V1.secoesPorNivel),
});

// ---------- manifesto.json ----------

export const esquemaMidia = z
  .strictObject({
    caminho: z.string().regex(PADRAO_CAMINHO_MIDIA, { error: 'caminho de mídia inválido: use midias/<sha256>.png ou .jpg' }),
    sha256: z.string().regex(PADRAO_SHA256, { error: 'sha256 inválido: use 64 dígitos hexadecimais minúsculos' }),
    bytes: z.int().min(1).max(LIMITES_V1.bytesMidia),
    tipo: z.enum(['image/png', 'image/jpeg']),
  })
  .superRefine((m, ctx) => {
    const extensao = m.tipo === 'image/png' ? 'png' : 'jpg';
    if (m.caminho !== `midias/${m.sha256}.${extensao}`) {
      ctx.addIssue({
        code: 'custom',
        path: ['caminho'],
        message: `o caminho da mídia deve ser midias/${m.sha256}.${extensao} (sha256 e tipo declarados)`,
      });
    }
  });

export const esquemaManifestoV1 = z
  .strictObject({
    formato: z.literal(IDENTIFICADOR_FORMATO),
    versaoFormato: z.literal(VERSAO_FORMATO_ATUAL),
    appVersao: z.string().max(LIMITES_V1.textoCurto).regex(PADRAO_VERSAO_SEMVER, { error: 'versão do aplicativo inválida (ex.: 0.1.0)' }),
    id,
    criadoEm: dataHora,
    atualizadoEm: dataHora,
    perfil: z.strictObject({
      id: z.string().max(LIMITES_V1.textoCurto).regex(PADRAO_ID_PERFIL, { error: 'id de perfil inválido (ex.: uft-2022)' }),
      versao: z.string().max(LIMITES_V1.textoCurto).regex(PADRAO_VERSAO_SEMVER, { error: 'versão do perfil inválida (ex.: 1.0.0)' }),
    }),
    tipoTrabalho: z.enum(['generico']),
    midias: z.array(esquemaMidia).max(LIMITES_V1.midias),
  })
  .superRefine((m, ctx) => {
    const vistos = new Set<string>();
    m.midias.forEach((midia, i) => {
      if (vistos.has(midia.sha256)) {
        ctx.addIssue({ code: 'custom', path: ['midias', i, 'sha256'], message: 'mídia repetida no manifesto' });
      }
      vistos.add(midia.sha256);
    });
  });

export type Manifesto = z.infer<typeof esquemaManifestoV1>;
export type MidiaManifesto = z.infer<typeof esquemaMidia>;

/**
 * Restrições aplicadas pelo código e ausentes do JSON Schema gerado (diferenças de fidelidade, M1-T04).
 * O validador oficial do app é o código; o JSON Schema serve para documentação e ferramentas externas.
 */
export const RESTRICOES_SO_NO_CODIGO = [
  `profundidade da árvore de seções ≤ ${LIMITES_V1.profundidadeSecoes} e aninhamento JSON ≤ ${LIMITES_V1.profundidadeJson}`,
  'maxLength conta unidades UTF-16 no código e pontos de código no JSON Schema (o código é mais restritivo)',
  'caminho da mídia coerente com sha256 e tipo',
  'sha256 único na lista de mídias do manifesto',
  'ids únicos no documento (seções e blocos)',
  'sobrescrito e subscrito não podem ser usados juntos (uniqueItems cobre só as marcas repetidas)',
] as const;
