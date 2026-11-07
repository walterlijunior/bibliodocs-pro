/**
 * Esquemas zod do formato de projeto v1 (`.bdp`, ADR-0004, seção 2): fonte da verdade do formato.
 * Todos os objetos são estritos (campo desconhecido é recusado) e toda string e lista tem limite.
 *
 * O JSON Schema publicado em `app/esquemas/projeto-v1/` é gerado daqui (`gerarJsonSchemasV1`).
 * As restrições que o JSON Schema não expressa estão em `RESTRICOES_SO_NO_CODIGO`.
 */
import { z } from 'zod';
import { FUNCOES_RESPONSAVEL, TIPOS_OBRA, TIPOS_TRABALHO } from '../modelo';
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
  })
  .meta({ id: 'InlineTexto' });

/**
 * Lista de trechos só de texto com marcas. Nota nesse lugar recebe `mensagemNota` (o resto cai no mapa de mensagens
 * da validação).
 */
function conteudoSoTexto(mensagemNota: string) {
  const tipoDe = (v: unknown) => (typeof v === 'object' && v !== null ? (v as { tipo?: unknown }).tipo : undefined);
  const trecho = z.discriminatedUnion('tipo', [esquemaInlineTexto], {
    error: (issue) => {
      const tipo = tipoDe(issue.input);
      if (tipo === 'nota') return mensagemNota;
      if (tipo === 'citacao') return 'citação não é permitida aqui: só no texto corrido';
      return undefined;
    },
  });
  return z.array(trecho).max(LIMITES_V1.inlinesPorConteudo);
}

/** Títulos e metadados. */
const conteudoTitulo = conteudoSoTexto('nota de rodapé não é permitida em título');

/** Nota de rodapé no ponto da chamada (RN-100); sem nota dentro de nota. */
export const esquemaInlineNota = z
  .strictObject({ tipo: z.literal('nota'), id, conteudo: conteudoSoTexto('nota de rodapé não pode conter outra nota') })
  .meta({ id: 'InlineNota' });

const paginaCitada = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[0-9A-Za-z][0-9A-Za-z .,–-]*$/, { error: 'página inválida: use números, letras e "-" (ex.: 27 ou 27-29)' });

export const esquemaObraCitada = z
  .strictObject({ obra: id, pagina: paginaCitada.optional(), semPaginacao: z.literal(true).optional() })
  .refine((o) => !(o.pagina !== undefined && o.semPaginacao), { error: 'página e "sem paginação" não podem ser usados juntos' })
  .meta({ id: 'ObraCitada' });

/** Chamada de citação ligada às obras (M4-T01; RN-077 a RN-099); só no texto corrido, por enquanto não em nota. */
export const esquemaInlineCitacao = z
  .strictObject({
    tipo: z.literal('citacao'),
    id,
    forma: z.enum(['parentetica', 'narrativa']),
    obras: z.array(esquemaObraCitada).min(1, { error: 'a citação precisa de pelo menos uma obra' }).max(LIMITES_V1.obrasPorCitacao),
    apud: esquemaObraCitada.optional(),
    grifo: z.enum(['nosso', 'doAutor']).optional(),
  })
  .meta({ id: 'InlineCitacao' });

export const esquemaInline = z.discriminatedUnion('tipo', [esquemaInlineTexto, esquemaInlineNota, esquemaInlineCitacao]).meta({ id: 'Inline' });

const conteudoInline = z.array(esquemaInline).max(LIMITES_V1.inlinesPorConteudo);

/** Alínea (RN-023) com subalíneas opcionais (RN-026); lista vazia de subalíneas é recusada (forma única). */
export const esquemaItemAlinea = z
  .strictObject({
    conteudo: conteudoInline,
    subalineas: z
      .array(conteudoInline)
      .min(1, { error: 'lista de subalíneas vazia: omita o campo quando não houver subalíneas' })
      .max(LIMITES_V1.subalineasPorAlinea)
      .optional(),
  })
  .meta({ id: 'ItemAlinea' });

export const esquemaBloco = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('paragrafo'), id, conteudo: conteudoInline }),
  z.strictObject({
    tipo: z.literal('alineas'),
    id,
    itens: z
      .array(esquemaItemAlinea)
      .min(1, { error: 'a lista de alíneas precisa de pelo menos uma alínea' })
      .max(LIMITES_V1.itensPorAlineas),
  }),
  z.strictObject({ tipo: z.literal('citacaoLonga'), id, conteudo: conteudoInline }),
  z.strictObject({ tipo: z.literal('quebraPagina'), id }),
]);

export const esquemaSecao = z
  .strictObject({
    id,
    titulo: conteudoTitulo,
    blocos: z.array(esquemaBloco).max(LIMITES_V1.blocosPorSecao),
    get subsecoes() {
      return z.array(esquemaSecao).max(LIMITES_V1.secoesPorNivel);
    },
  })
  .meta({ id: 'Secao' });

export const esquemaTipoTrabalho = z.enum(TIPOS_TRABALHO);

const mensagemCampo = { error: 'o texto contém caractere de controle ou inválido (só tabulação e quebra de linha são aceitas)' };
const textoDeCampo = (limite: number) => z.string().min(1).max(limite).regex(PADRAO_TEXTO_XML, mensagemCampo);
const campoCurto = textoDeCampo(LIMITES_V1.campoCurto);
const campoLongo = textoDeCampo(LIMITES_V1.textoInline);
const palavrasChave = z.array(campoCurto).min(1).max(LIMITES_V1.palavrasChave);

const soLugar = <T extends string>(tipo: T) => z.strictObject({ tipo: z.literal(tipo), id });
const comTexto = <T extends string>(tipo: T) => z.strictObject({ tipo: z.literal(tipo), id, texto: campoLongo.optional() });

/** Elemento pré-textual com os campos dele (M2-T08; `ElementoPreTextual` em `dominio/modelo`). */
export const esquemaElementoPreTextual = z
  .discriminatedUnion('tipo', [
    soLugar('capa'),
    soLugar('folhaRosto'),
    comTexto('fichaCatalografica'),
    comTexto('errata'),
    z.strictObject({
      tipo: z.literal('folhaAprovacao'),
      id,
      dataAprovacao: campoCurto.optional(),
      banca: z
        .array(z.strictObject({ nome: campoCurto.optional(), titulacao: campoCurto.optional(), instituicao: campoCurto.optional() }))
        .min(1)
        .max(LIMITES_V1.membrosBanca)
        .optional(),
    }),
    soLugar('listaIlustracoes'),
    soLugar('listaTabelas'),
    soLugar('listaSiglas'),
    soLugar('listaSimbolos'),
    soLugar('sumario'),
    comTexto('dedicatoria'),
    comTexto('agradecimentos'),
    comTexto('epigrafe'),
    z.strictObject({ tipo: z.literal('resumo'), id, texto: campoLongo.optional(), palavrasChave: palavrasChave.optional() }),
    z.strictObject({ tipo: z.literal('abstract'), id, idioma: z.enum(['en', 'es', 'fr']).optional(), texto: campoLongo.optional(), palavrasChave: palavrasChave.optional() }),
  ])
  .meta({ id: 'ElementoPreTextual' });
/** Lugar de um pós-textual (M2-T09); apêndice e anexo têm título, e a letra vem da posição. */
export const esquemaElementoPosTextual = z
  .discriminatedUnion('tipo', [
    z.strictObject({ tipo: z.literal('referencias'), id, incluirNaoCitadas: z.literal(true).optional() }),
    soLugar('glossario'),
    z.strictObject({ tipo: z.literal('apendice'), id, titulo: campoCurto.optional() }),
    z.strictObject({ tipo: z.literal('anexo'), id, titulo: campoCurto.optional() }),
    soLugar('indice'),
  ])
  .meta({ id: 'ElementoPosTextual' });

const pessoaTitulada = z.strictObject({ nome: campoCurto.optional(), titulacao: campoCurto.optional() });

const tituloObra = conteudoTitulo.min(1, { error: 'o título da obra não pode ficar vazio' });
export const esquemaAutor = z
  .discriminatedUnion('tipo', [
    z.strictObject({ tipo: z.literal('pessoa'), sobrenome: campoCurto, prenomes: campoCurto.optional() }),
    z.strictObject({ tipo: z.literal('entidade'), nome: campoCurto }),
  ])
  .meta({ id: 'Autor' });
const autores = z.array(esquemaAutor).min(1).max(LIMITES_V1.autoresPorObra);
const funcao = z.enum(FUNCOES_RESPONSAVEL);
const inteiro = (maximo: number) => z.int().min(1).max(maximo);

/** Obra da bibliografia (M4-T01; `Obra` em `dominio/modelo`): campos de todos os tipos, todos opcionais menos o título. */
export const esquemaObra = z
  .strictObject({
    id,
    tipo: z.enum(TIPOS_OBRA),
    autores: autores.optional(),
    funcao: funcao.optional(),
    titulo: tituloObra,
    subtitulo: conteudoTitulo.min(1).optional(),
    edicao: inteiro(999).optional(),
    traducao: campoCurto.optional(),
    local: campoCurto.optional(),
    editora: campoCurto.optional(),
    ano: inteiro(9999).optional(),
    anoIncerto: z.enum(['provavel', 'naoImpresso']).optional(),
    paginas: campoCurto.optional(),
    folhas: inteiro(1_000_000).optional(),
    volume: campoCurto.optional(),
    numero: campoCurto.optional(),
    ebook: z.literal(true).optional(),
    noTodo: z
      .strictObject({ autores: autores.optional(), funcao: funcao.optional(), titulo: tituloObra, subtitulo: conteudoTitulo.min(1).optional() })
      .optional(),
    periodico: campoCurto.optional(),
    secao: campoCurto.optional(),
    dataPublicacao: campoCurto.optional(),
    evento: z.strictObject({ nome: campoCurto, numero: inteiro(10_000).optional(), ano: inteiro(9999).optional(), local: campoCurto.optional() }).optional(),
    natureza: campoCurto.optional(),
    instituicao: campoCurto.optional(),
    programa: campoCurto.optional(),
    jurisdicao: campoCurto.optional(),
    identificacao: campoCurto.optional(),
    ementa: campoLongo.optional(),
    publicacao: campoCurto.optional(),
    url: campoCurto.regex(/^https?:\/\/\S+$/, { error: 'endereço inválido: use http:// ou https://' }).optional(),
    acesso: z.iso.date({ error: 'data de acesso inválida: use AAAA-MM-DD' }).optional(),
    doi: campoCurto.optional(),
  })
  .refine((o) => o.anoIncerto === undefined || o.ano !== undefined, { error: 'ano incerto sem ano', path: ['anoIncerto'] })
  .meta({ id: 'Obra' });

export const esquemaDocumentoV1 = z.strictObject({
  id,
  tipoTrabalho: esquemaTipoTrabalho,
  metadados: z.strictObject({
    titulo: conteudoTitulo,
    subtitulo: conteudoTitulo.optional(),
    autoria: campoCurto.optional(),
    instituicao: campoCurto.optional(),
    campus: campoCurto.optional(),
    curso: campoCurto.optional(),
    volume: campoCurto.optional(),
    local: campoCurto.optional(),
    ano: campoCurto.optional(),
    natureza: campoCurto.optional(),
    areaConcentracao: campoCurto.optional(),
    orientador: pessoaTitulada.optional(),
    coorientador: pessoaTitulada.optional(),
    bolsista: z.literal(true).optional(),
  }),
  preTextuais: z.array(esquemaElementoPreTextual).min(1).max(LIMITES_V1.elementosPreTextuais).optional(),
  corpo: z.array(esquemaSecao).max(LIMITES_V1.secoesPorNivel),
  posTextuais: z.array(esquemaElementoPosTextual).min(1).max(LIMITES_V1.elementosPosTextuais).optional(),
  obras: z.array(esquemaObra).min(1, { error: 'lista de obras vazia: omita o campo quando não houver obras' }).max(LIMITES_V1.obras).optional(),
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
    tipoTrabalho: esquemaTipoTrabalho,
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
  'ids únicos no documento (elementos pré e pós-textuais, seções, blocos, notas, citações e obras)',
  'toda obra citada (e a do apud) existe na lista de obras',
  'obra citada não tem página e "sem paginação" juntos; ano incerto só com ano',
  'elementos pré e pós-textuais na ordem do Quadro 5, só apêndice e anexo repetidos, nenhum no tipo genérico',
  'sobrescrito e subscrito não podem ser usados juntos (uniqueItems cobre só as marcas repetidas)',
] as const;
