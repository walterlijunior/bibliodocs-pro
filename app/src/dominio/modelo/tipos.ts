/**
 * Tipos do modelo semântico de documento — versão mínima do formato v1 (M1-T04; ADR-0005, seção 3).
 *
 * Invariantes (ADR-0005):
 * - sem números armazenados: seções, figuras e notas são numeradas por `dominio/numeracao`;
 * - sem HTML: texto rico é estrutura (`Inline[]`);
 * - nenhuma formatação: margens, fontes e recuos vêm do perfil pelo motor normativo;
 * - ids de seções e blocos únicos no documento (validado na leitura).
 *
 * O M2 acrescenta elementos pré/pós-textuais, alíneas, citações, notas, remissivas e siglas como
 * variantes novas destas uniões (mudança aditiva; ver o adendo técnico do M1-T04 no ADR-0004).
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

export type Inline = InlineTexto;

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

export type Bloco = BlocoParagrafo | BlocoQuebraPagina;

/** Seção do corpo. O nível é derivado da profundidade na árvore, nunca armazenado. */
export interface Secao {
  id: Id;
  titulo: Inline[];
  blocos: Bloco[];
  subsecoes: Secao[];
}

export interface Metadados {
  titulo: Inline[];
  subtitulo?: Inline[];
}

export interface Documento {
  id: Id;
  tipoTrabalho: TipoTrabalhoId;
  metadados: Metadados;
  corpo: Secao[];
}
