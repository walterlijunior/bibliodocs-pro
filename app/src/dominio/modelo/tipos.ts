/**
 * Tipos do modelo semântico de documento — versão mínima do formato v1 (M1-T04; ADR-0005, seção 3).
 *
 * Invariantes (ADR-0005):
 * - sem números armazenados: seções, figuras e notas são numeradas por `dominio/numeracao`;
 * - sem HTML: texto rico é estrutura (`Inline[]`);
 * - nenhuma formatação: margens, fontes e recuos vêm do perfil pelo motor normativo;
 * - ids de seções, blocos e notas únicos no documento (validado na leitura).
 *
 * O M2-T04 acrescentou alíneas, citação longa e nota de rodapé (adendo do M2-T04 no ADR-0007). Os marcos seguintes
 * acrescentam pré/pós-textuais, citações, remissivas e siglas como variantes novas destas uniões (mudança aditiva; ver o
 * adendo técnico do M1-T04 no ADR-0004).
 */

/** Identificador estável (nanoid ou equivalente), nunca reaproveitado. */
export type Id = string;

/** Tipos de trabalho. No M1 só existe o genérico; os tipos UFT entram no M2 com o perfil. */
export type TipoTrabalhoId = 'generico';

export type MarcaTexto = 'italico' | 'negrito' | 'sobrescrito' | 'subscrito';

export interface InlineTexto {
  tipo: 'texto';
  /** Texto apto a XML 1.0; `\t` é tabulação e `\n` é quebra de linha manual dentro do parágrafo. */
  texto: string;
  /** Sem repetição; no máximo uma entre sobrescrito e subscrito. */
  marcas?: MarcaTexto[];
}

/**
 * Nota de rodapé no ponto da chamada (RN-100: a chamada fica logo após a última palavra do trecho). O conteúdo vai
 * dentro do próprio inline: apagar a chamada apaga a nota, e não existe nota sem chamada. O número é derivado da ordem
 * no documento, nunca gravado.
 */
export interface InlineNota {
  tipo: 'nota';
  id: Id;
  conteudo: InlineDeNota[];
}

/** Trecho do texto corrido. */
export type Inline = InlineTexto | InlineNota;

/**
 * Trecho do conteúdo de uma nota: tudo menos outra nota. Hoje só texto; o M4 (citação) e o M6 (remissiva, sigla)
 * alargam aqui e em `esquemaInlineNota`.
 */
export type InlineDeNota = InlineTexto;

/** Trecho de título de seção e de metadado: sem nota de rodapé no M2 (alargar junto com o esquema `conteudoTitulo`). */
export type InlineDeTitulo = InlineTexto;

export interface BlocoParagrafo {
  tipo: 'paragrafo';
  id: Id;
  conteudo: Inline[];
}

/** Quebra de página explícita; o verificador avisa quando a regra não a permite. */
export interface BlocoQuebraPagina {
  tipo: 'quebraPagina';
  id: Id;
}

/**
 * Alínea: letra minúscula seguida de parêntese, "a)" (RN-023). A letra é derivada da posição
 * (`dominio/numeracao/rotuloAlinea`), nunca gravada. Pontuação (RN-024) é aviso do verificador, não regra do modelo.
 */
export interface ItemAlinea {
  conteudo: Inline[];
  /**
   * Subalíneas da alínea (RN-026), um só nível. Ausente quando não há: a lista vazia é recusada na leitura, para que
   * cada documento tenha uma forma só.
   */
  subalineas?: Inline[][];
}

/** Lista de alíneas, para assuntos sem título próprio dentro da seção (RN-028). */
export interface BlocoAlineas {
  tipo: 'alineas';
  id: Id;
  /** Pelo menos uma alínea. */
  itens: ItemAlinea[];
}

/**
 * Citação direta com mais de três linhas, em bloco destacado (RN-004). A forma (recuo, corpo, entrelinha) vem do
 * perfil. A chamada "(AUTOR, ano, p.)" fica no próprio conteúdo ou no parágrafo anterior (RN-084); o inline de
 * citação ligado à obra chega no M4.
 */
export interface BlocoCitacaoLonga {
  tipo: 'citacaoLonga';
  id: Id;
  conteudo: Inline[];
}

export type Bloco = BlocoParagrafo | BlocoAlineas | BlocoCitacaoLonga | BlocoQuebraPagina;

/** Seção do corpo. O nível é derivado da profundidade na árvore, nunca armazenado. */
export interface Secao {
  id: Id;
  titulo: InlineDeTitulo[];
  blocos: Bloco[];
  subsecoes: Secao[];
}

export interface Metadados {
  titulo: InlineDeTitulo[];
  subtitulo?: InlineDeTitulo[];
}

export interface Documento {
  id: Id;
  tipoTrabalho: TipoTrabalhoId;
  metadados: Metadados;
  corpo: Secao[];
}
