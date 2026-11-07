/**
 * Um formatador por tipo de obra da primeira leva (D-M4-06), cada um com o padrão do Manual, 5.19 (M4-T02: livro;
 * M4-T04: os demais). O que falta na obra vira aviso, nunca texto inventado.
 */
import type { Obra, TipoObra } from '../modelo';
import { escreverAutoria, maiusculas } from './autores';
import {
  anoOuAviso,
  dataDaPublicacao,
  escreverAutoriaDoTodo,
  escreverDoi,
  escreverEdicao,
  escreverEntradaETitulo,
  escreverImprenta,
  escreverIn,
  escreverOnline,
  escreverSequencia,
  escreverTitulo,
  escreverTituloDeEntrada,
  escreverTotalDePaginas,
  paginasDaParte,
  temAutoria,
  type Contexto,
} from './elementos';

export type Formatador = (obra: Obra, ctx: Contexto) => void;

export const FORMATADORES: Record<TipoObra, Formatador> = {
  livro: formatarLivro,
  capitulo: formatarCapitulo,
  trabalhoAcademico: formatarTrabalhoAcademico,
  artigoPeriodico: formatarArtigoPeriodico,
  trabalhoEvento: formatarTrabalhoEvento,
  artigoJornal: formatarArtigoJornal,
  norma: formatarNorma,
  legislacao: formatarLegislacao,
  documentoOnline: formatarDocumentoOnline,
};

function faltando(ctx: Contexto, rn: string, elemento: string): void {
  ctx.avisos.push({ codigo: 'ELEMENTO_AUSENTE', rn, mensagem: `Falta ${elemento}.` });
}

/**
 * Livro (RN-194 a RN-199): AUTOR. **Título**: subtítulo. Tradução de Nome (RN-204). Edição. Local: Editora, ano.
 * Páginas. Disponível em … Acesso em … (RN-205). *E-book* (RN-191).
 *
 * Fora por falta de campo no modelo: coleção ou série (RN-194) e "Título original" (RN-204).
 */
function formatarLivro(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  escreverEntradaETitulo(obra, ctx, ['RN-194'], true);
  if (obra.traducao?.trim()) {
    m.texto(`Tradução de ${obra.traducao.trim()}`, ['RN-204']);
    m.ponto(['RN-204']);
  }
  escreverEdicao(m, obra);
  escreverImprenta(obra, ctx);
  escreverTotalDePaginas(m, obra);
  escreverOnline(m, obra, ctx.avisos);
  if (obra.ebook) {
    m.texto('E-book', ['RN-191'], ['italico']);
    m.ponto(['RN-191']);
  }
}

/**
 * Capítulo e verbete (RN-200 a RN-203): AUTOR. Título do capítulo. *In*: AUTOR DO LIVRO (org.). **Título do livro**:
 * subtítulo. Edição. Local: Editora, ano. v. X, p. inicial-final (ou "Cap. 2"). Sem autor no todo, o todo entra pelo
 * título e sem negrito ("*In*: DICIONÁRIO da língua portuguesa", RN-203).
 */
function formatarCapitulo(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  escreverEntradaETitulo(obra, ctx, ['RN-200'], false);
  escreverIn(m);
  const todo = obra.noTodo;
  if (!todo) faltando(ctx, 'RN-200', 'a obra no todo (o livro de que o capítulo faz parte)');
  else {
    if (temAutoria(todo.autores)) {
      escreverAutoriaDoTodo(m, todo.autores!, todo.funcao, ctx.opcoes);
      escreverTitulo(m, todo, ['negrito'], ['RN-178', 'RN-200']);
    } else {
      escreverTituloDeEntrada(m, todo);
    }
    m.ponto(['RN-200']);
  }
  escreverEdicao(m, obra);
  escreverImprenta(obra, ctx, 'RN-200');
  const volume = obra.volume?.trim();
  const paginas = paginasDaParte(obra.paginas);
  escreverSequencia(m, [volume ? { texto: `v. ${volume}`, origem: ['RN-203'] } : null, paginas ? { texto: paginas, origem: ['RN-200'] } : null], ['RN-203']);
  if (volume || paginas) m.ponto(['RN-200']);
  escreverOnline(m, obra, ctx.avisos);
}

/**
 * Monografia, dissertação e tese (RN-206): AUTOR. **Título**: subtítulo. Ano. 222 f. Natureza – Universidade,
 * Programa, Cidade, ano. Ordem Universidade, Programa como o exemplo da p. 53 (C-B15); folhas na forma "222 f."
 * (D-M4-05; a lista da p. 70 grafa "222f.").
 */
function formatarTrabalhoAcademico(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  escreverEntradaETitulo(obra, ctx, ['RN-206'], true);
  const ano = anoOuAviso(obra, ctx, 'RN-206');
  if (ano) {
    m.texto(ano.texto, ano.origem);
    m.ponto(['RN-206']);
  }
  if (obra.folhas !== undefined) {
    m.texto(`${obra.folhas} f.`, ['RN-206', 'D-M4-05']);
    m.ponto(['RN-206']);
  }
  const natureza = obra.natureza?.trim();
  if (natureza) {
    m.texto(natureza, ['RN-206']);
    m.texto(' – ', ['RN-206']);
  } else faltando(ctx, 'RN-206', 'a natureza do trabalho (por exemplo, "Dissertação (Mestrado em Educação)")');
  if (!obra.instituicao?.trim()) faltando(ctx, 'RN-206', 'a instituição');
  escreverSequencia(
    m,
    [
      obra.instituicao?.trim() ? { texto: obra.instituicao.trim(), origem: ['RN-206', 'C-B15'] } : null,
      obra.programa?.trim() ? { texto: obra.programa.trim(), origem: ['RN-206', 'C-B15'] } : null,
      obra.local?.trim() ? { texto: obra.local.trim(), origem: ['RN-206'] } : null,
      ano ? { texto: ano.texto, origem: ano.origem } : null,
    ],
    ['RN-206'],
  );
  m.ponto(['RN-206']);
  escreverOnline(m, obra, ctx.avisos);
}

/**
 * Artigo de periódico (RN-212 a RN-214): AUTOR. Título do artigo. **Título do Periódico**, local, v. X, n. Y,
 * p. A-B, data. DOI. Disponível em … Acesso em … Sem autoria, entrada pelo título (RN-213, "MUITO por fazer").
 */
function formatarArtigoPeriodico(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  escreverEntradaETitulo(obra, ctx, ['RN-212'], false);
  const periodico = obra.periodico?.trim();
  if (!periodico) faltando(ctx, 'RN-212', 'o título do periódico');
  const volume = obra.volume?.trim();
  const numero = obra.numero?.trim();
  const paginas = paginasDaParte(obra.paginas);
  escreverSequencia(
    m,
    [
      periodico ? { texto: periodico, origem: ['RN-212', 'RN-178'], marcas: ['negrito'] } : null,
      obra.local?.trim() ? { texto: obra.local.trim(), origem: ['RN-212'] } : null,
      volume ? { texto: `v. ${volume}`, origem: ['RN-212'] } : null,
      numero ? { texto: `n. ${numero}`, origem: ['RN-212'] } : null,
      paginas ? { texto: paginas, origem: ['RN-212'] } : null,
      dataDaPublicacao(obra, ctx, 'RN-212'),
    ],
    ['RN-212'],
  );
  m.ponto(['RN-212']);
  escreverDoi(m, obra);
  escreverOnline(m, obra, ctx.avisos);
}

/**
 * Trabalho em evento (RN-209, com o evento de RN-207): AUTOR. Título. *In*: NOME DO EVENTO, número., ano, local.
 * **Anais** [...]. Local: editora, ano. p. inicial-final. O título dos anais vem de `noTodo.titulo` ("Anais
 * eletrônicos"); sem ele, "Anais".
 */
function formatarTrabalhoEvento(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  escreverEntradaETitulo(obra, ctx, ['RN-209'], false);
  escreverIn(m);
  const evento = obra.evento;
  if (!evento) faltando(ctx, 'RN-209', 'o evento');
  else {
    escreverSequencia(
      m,
      [
        { texto: maiusculas(evento.nome.trim()), origem: ['RN-207'] },
        evento.numero !== undefined ? { texto: `${evento.numero}.`, origem: ['RN-207'] } : null,
        evento.ano !== undefined ? { texto: String(evento.ano), origem: ['RN-207'] } : null,
        evento.local?.trim() ? { texto: evento.local.trim(), origem: ['RN-207'] } : null,
      ],
      ['RN-207'],
    );
    m.ponto(['RN-207']);
  }
  if (obra.noTodo?.titulo.length) m.inlines(obra.noTodo.titulo, ['RN-207'], ['negrito']);
  else m.texto('Anais', ['RN-207'], ['negrito']);
  m.texto(' [...]', ['RN-207']);
  m.ponto(['RN-207']);
  // Sem ano de publicação, vale o ano do evento.
  escreverImprenta(obra.ano === undefined && evento?.ano !== undefined ? { ...obra, ano: evento.ano } : obra, ctx, 'RN-209');
  const paginas = paginasDaParte(obra.paginas);
  if (paginas) {
    m.texto(paginas, ['RN-209']);
    m.ponto(['RN-209']);
  }
  escreverOnline(m, obra, ctx.avisos);
}

/**
 * Artigo de jornal (RN-215 a RN-218):
 * - com autor e seção: AUTOR. Título. **Jornal**, local, data. Seção, p. X. (RN-215)
 * - com autor, sem seção: AUTOR. Título. **Jornal**, local, p. X, data. (RN-216)
 * - sem autor: TÍTULO. **Jornal**, local, data, seção, p. X. (RN-217, como o exemplo "CLIMA de campanha", p. 57)
 * - on-line: + Disponível em … Acesso em … (RN-218)
 */
function formatarArtigoJornal(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  const comAutor = temAutoria(obra.autores);
  escreverEntradaETitulo(obra, ctx, [comAutor ? 'RN-215' : 'RN-217'], false);
  const jornal = obra.periodico?.trim();
  if (!jornal) faltando(ctx, 'RN-215', 'o título do jornal');
  const secao = obra.secao?.trim();
  const paginas = paginasDaParte(obra.paginas);
  const cabeca = [
    jornal ? { texto: jornal, origem: ['RN-215', 'RN-178'], marcas: ['negrito' as const] } : null,
    obra.local?.trim() ? { texto: obra.local.trim(), origem: ['RN-215'] } : null,
  ];
  const data = dataDaPublicacao(obra, ctx, 'RN-215');
  const pag = paginas ? { texto: paginas, origem: ['RN-215'] } : null;
  const sec = secao ? { texto: secao, origem: ['RN-215'] } : null;
  if (!comAutor) {
    escreverSequencia(m, [...cabeca, data, sec, pag ? { ...pag, origem: ['RN-217'] } : null], ['RN-217']);
    m.ponto(['RN-217']);
  } else if (secao) {
    escreverSequencia(m, [...cabeca, data], ['RN-215']);
    m.ponto(['RN-215']);
    escreverSequencia(m, [sec, pag], ['RN-215']);
    m.ponto(['RN-215']);
  } else {
    escreverSequencia(m, [...cabeca, pag ? { ...pag, origem: ['RN-216'] } : null, data], ['RN-216']);
    m.ponto(['RN-216']);
  }
  escreverOnline(m, obra, ctx.avisos);
}

/**
 * Norma técnica (RN-222): ENTIDADE. **NBR 6023**: título: subtítulo. Local: editora, ano. Páginas. Sem número de
 * norma, o título leva o negrito.
 */
function formatarNorma(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  const numero = obra.identificacao?.trim();
  if (!numero || !temAutoria(obra.autores)) {
    if (!numero) faltando(ctx, 'RN-222', 'o número da norma');
    escreverEntradaETitulo(obra, ctx, ['RN-222'], true);
  } else {
    escreverAutoria(m, obra.autores!, obra.funcao, ctx.opcoes);
    m.ponto(['RN-222']);
    m.texto(numero, ['RN-222', 'RN-178'], ['negrito']);
    m.texto(': ', ['RN-222']);
    escreverTitulo(m, obra, [], ['RN-222']);
    m.ponto(['RN-222']);
  }
  escreverEdicao(m, obra);
  escreverImprenta(obra, ctx, 'RN-222');
  escreverTotalDePaginas(m, obra, 'RN-222');
  escreverOnline(m, obra, ctx.avisos);
}

/**
 * Legislação (RN-223; destaque pelo C-B16):
 * - publicada em veículo oficial: JURISDIÇÃO. Título. Ementa. **Veículo**: seção, local, n. X, p. Y, data.
 * - obra autônoma: JURISDIÇÃO. Identificação. **Título**: subtítulo. Ementa. Local: Editora, ano. Páginas.
 *   ("BRASIL. Constituição (1988). **Constituição da República Federativa do Brasil**: 1988.")
 */
function formatarLegislacao(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  const jurisdicao = obra.jurisdicao?.trim();
  if (jurisdicao) {
    m.texto(maiusculas(jurisdicao), ['RN-223']);
    m.ponto(['RN-223']);
  } else if (temAutoria(obra.autores)) {
    escreverAutoria(m, obra.autores!, obra.funcao, ctx.opcoes);
    m.ponto(['RN-223']);
  } else faltando(ctx, 'RN-223', 'a jurisdição ou a entidade');
  const identificacao = obra.identificacao?.trim();
  if (identificacao) {
    m.texto(identificacao, ['RN-223']);
    m.ponto(['RN-223']);
  }
  const veiculo = obra.publicacao?.trim();
  escreverTitulo(m, obra, veiculo ? [] : ['negrito'], veiculo ? ['RN-223'] : ['RN-223', 'C-B16']);
  m.ponto(['RN-223']);
  if (obra.ementa?.trim()) {
    m.texto(obra.ementa.trim(), ['RN-223']);
    m.ponto(['RN-223']);
  }
  if (veiculo) {
    m.texto(veiculo, ['RN-223', 'C-B16'], ['negrito']);
    if (obra.secao?.trim()) m.texto(`: ${obra.secao.trim()}`, ['RN-223']);
    const numero = obra.numero?.trim();
    const paginas = paginasDaParte(obra.paginas);
    const resto = [
      obra.local?.trim() ? { texto: obra.local.trim(), origem: ['RN-223'] } : null,
      numero ? { texto: `n. ${numero}`, origem: ['RN-223'] } : null,
      paginas ? { texto: paginas, origem: ['RN-223'] } : null,
      dataDaPublicacao(obra, ctx, 'RN-223'),
    ];
    if (resto.some((x) => x !== null)) m.texto(', ', ['RN-223']);
    escreverSequencia(m, resto, ['RN-223']);
    m.ponto(['RN-223']);
  } else {
    escreverEdicao(m, obra);
    escreverImprenta(obra, ctx, 'RN-223');
    escreverTotalDePaginas(m, obra, 'RN-223');
  }
  escreverOnline(m, obra, ctx.avisos);
}

/**
 * Documento on-line sem outro tipo (RN-189). O Manual não tem padrão próprio, só o acréscimo de endereço e acesso a
 * qualquer tipo: AUTOR. **Título**: subtítulo. Local: Editora, ano (só se houver algum dos três). Disponível em …
 * Acesso em … Provisório.
 */
function formatarDocumentoOnline(obra: Obra, ctx: Contexto): void {
  const { m } = ctx;
  escreverEntradaETitulo(obra, ctx, ['RN-189'], true);
  if (obra.local?.trim() || obra.editora?.trim()) escreverImprenta(obra, ctx, 'RN-189');
  else if (obra.ano !== undefined) {
    const ano = anoOuAviso(obra, ctx, 'RN-189')!;
    m.texto(ano.texto, ano.origem);
    m.ponto(['RN-189']);
  }
  if (!obra.url?.trim()) faltando(ctx, 'RN-189', 'o endereço eletrônico');
  escreverOnline(m, obra, ctx.avisos);
}
