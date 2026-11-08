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

/**
 * Tipos de trabalho do Manual UFT (M2-T02). Os elementos e a ordem de cada um estão em `dominio/normas/tipos-trabalho`.
 */
export type TipoTrabalhoUft = 'monografia' | 'artigo-tcc' | 'dissertacao' | 'tese' | 'relatorio-tecnico' | 'projeto-pesquisa';

/** `generico` é o tipo dos trabalhos criados no M1: não tem elementos pré nem pós-textuais e não é mais oferecido. */
export type TipoTrabalhoId = 'generico' | TipoTrabalhoUft;

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

/**
 * Obra citada e o ponto citado: página ou intervalo ("27", "27-29"), ou documento sem paginação (D-M4-04). Volume da obra
 * em vários volumes antes da página: "(CANDIDO, 1993, v. 2, p. 12)" (Manual, p. 23; M4-T07).
 */
export interface ObraCitada {
  obra: Id;
  volume?: string;
  pagina?: string;
  semPaginacao?: true;
}

/**
 * Chamada de citação no ponto do texto (RF-07; RN-077 a RN-099; M4-T01). Guarda só a ligação com a obra, nunca o texto
 * da chamada: mudar o ano da obra muda todas as chamadas. Toda obra citada existe em `Documento.obras` (validado na
 * leitura), então não existe citação sem obra. Várias obras na mesma chamada: `obras` com mais de uma (RN-096).
 */
export interface InlineCitacao {
  tipo: 'citacao';
  id: Id;
  /** `parentetica`: (SOBRENOME, ano, p. X); `narrativa`: Sobrenome (ano, p. X) (RN-083). */
  forma: 'parentetica' | 'narrativa';
  obras: ObraCitada[];
  /** Citação de citação: `obras` é o original, `apud` a obra consultada (RN-098). */
  apud?: ObraCitada;
  /** RN-090. */
  grifo?: 'nosso' | 'doAutor';
}

/** Trecho do texto corrido. */
export type Inline = InlineTexto | InlineNota | InlineCitacao;

/**
 * Trecho do conteúdo de uma nota: tudo menos outra nota. Texto e, desde o M4-T07, chamada de citação (a nota que cita a
 * fonte). O M6 (remissiva, sigla) também alarga aqui e em `esquemaInlineNota`.
 */
export type InlineDeNota = InlineTexto | InlineCitacao;

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

/** Alinhamento do conteúdo de uma coluna da tabela ou do quadro (M5-T01). */
export type AlinhamentoColuna = 'esquerda' | 'centro' | 'direita';

/** Coluna da tabela ou do quadro: por enquanto só o alinhamento (P-C4: números à direita, escolha do autor). */
export interface ColunaTabela {
  alinhamento: AlinhamentoColuna;
}

/**
 * Célula da grade, no modelo do HTML: cada linha lista só as células que começam nela, e a posição coberta por uma
 * célula mesclada de cima ou da esquerda não aparece. `colunas` e `linhas` (≥ 2) estendem a célula para a direita e
 * para baixo; ausentes valem 1 (forma única). A grade é conferida na leitura: toda linha cobre exatamente as colunas
 * declaradas, nenhuma célula sai da grade nem se sobrepõe a outra, e a mesclagem não atravessa o fim do cabeçalho.
 */
export interface CelulaTabela {
  /** Texto com marcas (sobrescrito para chamada de nota específica, RN-275), sem nota de rodapé nem citação. */
  conteudo: InlineDeTitulo[];
  colunas?: number;
  linhas?: number;
}

/**
 * Tabela (dado numérico como informação central, IBGE; RN-241) ou quadro (informação textual, fechado; RN-061, RN-062).
 * O autor escolhe a espécie (D-M5-10). Número, rótulo ("Tabela 3 – ...") e formato vêm do motor, nunca são gravados
 * (ADR-0005). Ausência de fonte é pendência do verificador (RN-056), não recusa: o autor salva o trabalho incompleto.
 */
export interface BlocoTabela {
  tipo: 'tabela';
  id: Id;
  especie: 'tabela' | 'quadro';
  /** Título sem o rótulo (RN-055); obrigatório e não vazio. */
  titulo: InlineDeTitulo[];
  colunas: ColunaTabela[];
  /** Quantas das primeiras linhas formam o cabeçalho (repetido em cada página, RN-292); 0 = sem cabeçalho. */
  linhasCabecalho: number;
  linhas: CelulaTabela[][];
  /** Texto depois de "Fonte:" (RN-056, RN-269). */
  fonte?: InlineDeTitulo[];
  /** Nota geral (RN-272), depois da fonte (RN-277). */
  nota?: InlineDeTitulo[];
  /** Notas específicas, na ordem das chamadas (RN-273, RN-275). Ausente quando não há (lista vazia é recusada). */
  notasEspecificas?: InlineDeTitulo[][];
}

/**
 * Palavra designativa da ilustração (RN-049, Manual p. 18: desenho, esquema, fluxograma, fotografia, gráfico, mapa,
 * organograma, planta, quadro, retrato e "Figura" dos exemplos). O quadro é `BlocoTabela` com `especie: 'quadro'`
 * (RN-061), por isso não está aqui.
 */
export type EspecieIlustracao =
  | 'figura'
  | 'desenho'
  | 'esquema'
  | 'fluxograma'
  | 'fotografia'
  | 'grafico'
  | 'mapa'
  | 'organograma'
  | 'planta'
  | 'retrato';

/** Ilustração com imagem (M5-T01): a imagem é a mídia do `.bdp` com esse sha256 (ADR-0004, seção 1). */
export interface BlocoIlustracao {
  tipo: 'ilustracao';
  id: Id;
  especie: EspecieIlustracao;
  titulo: InlineDeTitulo[];
  /** sha256 da mídia (`midias/<sha256>.png|jpg`); a leitura recusa mídia que não está no pacote. */
  midia: string;
  /** Largura impressa em milímetros; ausente = largura natural limitada à área útil (D-M5-09, no motor). */
  larguraMm?: number;
  fonte?: InlineDeTitulo[];
  nota?: InlineDeTitulo[];
}

/**
 * Equação em texto linear com sobrescrito e subscrito (D-M5-06; RN-105 a RN-107). O número "(n)" vem da posição
 * entre as equações numeradas (M5-T07), nunca gravado.
 */
export interface BlocoEquacao {
  tipo: 'equacao';
  id: Id;
  conteudo: InlineDeTitulo[];
  /** Ausente = sem número (forma única: `false` é recusado). */
  numerada?: true;
}

export type Bloco = BlocoParagrafo | BlocoAlineas | BlocoCitacaoLonga | BlocoQuebraPagina | BlocoTabela | BlocoIlustracao | BlocoEquacao;

/** Seção do corpo. O nível é derivado da profundidade na árvore, nunca armazenado. */
export interface Secao {
  id: Id;
  titulo: InlineDeTitulo[];
  blocos: Bloco[];
  subsecoes: Secao[];
}

/**
 * Elementos pré-textuais, na ordem do Quadro 5 do Manual (RN-113). A lombada fica de fora: é parte física do trabalho
 * impresso, sem efeito no DOCX (RN-126, PENDENTE-FONTE).
 */
export type ElementoPreTextualId =
  | 'capa'
  | 'folhaRosto'
  | 'fichaCatalografica'
  | 'errata'
  | 'folhaAprovacao'
  | 'dedicatoria'
  | 'agradecimentos'
  | 'epigrafe'
  | 'resumo'
  | 'abstract'
  | 'listaIlustracoes'
  | 'listaTabelas'
  | 'listaSiglas'
  | 'listaSimbolos'
  | 'sumario';

/** Elementos pós-textuais, na ordem do Quadro 5 (RN-114). Apêndice e anexo podem se repetir. */
export type ElementoPosTextualId = 'referencias' | 'glossario' | 'apendice' | 'anexo' | 'indice';

type SoLugar<T> = T extends string ? { tipo: T; id: Id } : never;
type ComTexto<T> = T extends string ? { tipo: T; id: Id; texto?: string } : never;

/** Língua do resumo estrangeiro (RN-157); ausente = inglês. */
export type IdiomaResumo = 'en' | 'es' | 'fr';

/** Membro da banca (RN-140). Todos os campos são opcionais: a falta é pendência, não erro do arquivo. */
export interface MembroBanca {
  nome?: string;
  titulacao?: string;
  instituicao?: string;
}

/**
 * Elemento pré-textual com o que é só dele (M2-T08). O que capa, folha de rosto e folha de aprovação repetem fica em
 * `Metadados`. Texto simples (`\n` separa parágrafos). Listas e sumário não têm campos: são gerados (M6). Campo vazio
 * fica ausente.
 */
export type ElementoPreTextual =
  | SoLugar<'capa' | 'folhaRosto' | 'listaIlustracoes' | 'listaTabelas' | 'listaSiglas' | 'listaSimbolos' | 'sumario'>
  | ComTexto<'fichaCatalografica' | 'errata' | 'dedicatoria' | 'agradecimentos' | 'epigrafe'>
  | { tipo: 'folhaAprovacao'; id: Id; dataAprovacao?: string; banca?: MembroBanca[] }
  | { tipo: 'resumo'; id: Id; texto?: string; palavrasChave?: string[] }
  | { tipo: 'abstract'; id: Id; idioma?: IdiomaResumo; texto?: string; palavrasChave?: string[] };

/**
 * Lugar de um pós-textual no trabalho (M2-T09). A letra de apêndice e anexo vem da posição (`dominio/numeracao`), nunca
 * gravada; o conteúdo chega no M4 (referências) e no M6 (os demais).
 */
export type ElementoPosTextual =
  | SoLugar<'glossario' | 'indice'>
  /** A lista sai das obras citadas; `incluirNaoCitadas` põe também as demais obras da bibliografia (M4-T05). */
  | { tipo: 'referencias'; id: Id; incluirNaoCitadas?: true }
  | { tipo: 'apendice'; id: Id; titulo?: string }
  | { tipo: 'anexo'; id: Id; titulo?: string };

/** Pessoa com titulação (orientador, coorientador; RN-127, RN-132). */
export interface PessoaTitulada {
  nome?: string;
  titulacao?: string;
}

/** Dados de identificação (RN-117, RN-127, RN-140). Campo vazio fica ausente (M2-T08). */
export interface Metadados {
  titulo: InlineDeTitulo[];
  subtitulo?: InlineDeTitulo[];
  autoria?: string;
  instituicao?: string;
  campus?: string;
  curso?: string;
  volume?: string;
  local?: string;
  ano?: string;
  natureza?: string;
  areaConcentracao?: string;
  orientador?: PessoaTitulada;
  coorientador?: PessoaTitulada;
  /** RN-147: torna os agradecimentos obrigatórios. Só `true`; falso fica ausente. */
  bolsista?: true;
}

/**
 * Tipos de obra da primeira leva (D-M4-06). Os padrões de cada um estão no Manual, 5.19 (RN-189 a RN-223); os demais
 * tipos do 5.19 chegam numa segunda leva.
 */
export type TipoObra =
  | 'livro'
  | 'capitulo'
  | 'trabalhoAcademico'
  | 'artigoPeriodico'
  | 'trabalhoEvento'
  | 'artigoJornal'
  | 'norma'
  | 'legislacao'
  | 'documentoOnline';

/** Autor pessoal (RN-180, RN-181: "Filho", "Neto" fazem parte do sobrenome) ou entidade (RN-187). */
export type Autor = { tipo: 'pessoa'; sobrenome: string; prenomes?: string } | { tipo: 'entidade'; nome: string };

/** Função do responsável por obra coletiva (RN-186): (org.), (coord.), (ed.), (comp.). */
export type FuncaoResponsavel = 'org' | 'coord' | 'ed' | 'comp';

/** Obra no todo, de que a parte faz parte (capítulo, verbete: RN-200 a RN-203). */
export interface ObraNoTodo {
  autores?: Autor[];
  funcao?: FuncaoResponsavel;
  titulo: InlineDeTitulo[];
  subtitulo?: InlineDeTitulo[];
}

/** Evento em que o trabalho foi apresentado (RN-207, RN-209). */
export interface EventoObra {
  nome: string;
  numero?: number;
  ano?: number;
  local?: string;
}

/**
 * Obra da bibliografia do trabalho (RF-08; M4-T01). Campos de todos os tipos num registro só: cada tipo usa os seus
 * (tabela no formatador, M4-T02), e o que falta vira aviso, não recusa. Sem texto formatado: a referência é sempre
 * gerada. Campo vazio fica ausente.
 */
export interface Obra {
  id: Id;
  tipo: TipoObra;
  /** Sem autoria: entrada pelo título (RN-179, RN-199). */
  autores?: Autor[];
  funcao?: FuncaoResponsavel;
  /** Com marcas: nome científico em itálico, por exemplo. */
  titulo: InlineDeTitulo[];
  subtitulo?: InlineDeTitulo[];
  /** A 1.ª edição é omitida na referência (D-M4-05). */
  edicao?: number;
  /** Nome de quem traduziu (RN-204). */
  traducao?: string;
  local?: string;
  editora?: string;
  ano?: number;
  /** `provavel`: "[2016?]"; `naoImpresso`: "[2016]" (D-M4-04, D-M4-05). */
  anoIncerto?: 'provavel' | 'naoImpresso';
  /** Total ("192 p.") ou intervalo da parte ("15-30"). */
  paginas?: string;
  /** Trabalho acadêmico: "222 f." (D-M4-05). */
  folhas?: number;
  volume?: string;
  numero?: string;
  /** RN-191. */
  ebook?: true;
  noTodo?: ObraNoTodo;
  /** Título do periódico ou do jornal (RN-212, RN-215). */
  periodico?: string;
  /** Seção ou caderno do jornal (RN-215). */
  secao?: string;
  /** Data da publicação do jornal ou do fascículo, como no documento ("12 maio 2020"). */
  dataPublicacao?: string;
  evento?: EventoObra;
  /** Trabalho acadêmico (RN-206): natureza com grau e área, instituição e programa (C-B15). */
  natureza?: string;
  instituicao?: string;
  programa?: string;
  /** Norma e legislação (RN-222, RN-223): jurisdição ou entidade, número, ementa e onde foi publicada. */
  jurisdicao?: string;
  identificacao?: string;
  ementa?: string;
  publicacao?: string;
  /** Documento on-line (RN-189). `acesso` em AAAA-MM-DD. */
  url?: string;
  acesso?: string;
  doi?: string;
  /** Coleção ou série do livro, sem os parênteses (RN-194; M4-T06). */
  colecao?: string;
  /** Título na língua de origem do livro traduzido (RN-204; M4-T06). */
  tituloOriginal?: string;
  /** Suplemento do fascículo: "3" sai "Supl. 3" (exemplo DOREA, p. 56; M4-T06). */
  suplemento?: string;
  /** Ano do veículo oficial: "138" sai "ano 138" (exemplo da Lei 9.979, p. 60; M4-T06). */
  anoVeiculo?: string;
}

export interface Documento {
  id: Id;
  tipoTrabalho: TipoTrabalhoId;
  metadados: Metadados;
  /**
   * Na ordem do Quadro 5. Ausente quando não há elemento (a lista vazia é recusada na leitura, como `subalineas`);
   * sempre ausente no tipo `generico`.
   */
  preTextuais?: ElementoPreTextual[];
  corpo: Secao[];
  posTextuais?: ElementoPosTextual[];
  /** Obras da bibliografia (M4-T01). Ausente quando não há obra (a lista vazia é recusada na leitura). */
  obras?: Obra[];
}
