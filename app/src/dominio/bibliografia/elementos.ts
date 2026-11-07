/**
 * Elementos comuns das referências (M4-T02, M4-T04): entrada, título, edição, imprenta, páginas, data, on-line.
 * Cada função escreve no montador e fecha o elemento com ponto quando o padrão do Manual pede.
 */
import type { Autor, FuncaoResponsavel, InlineDeTitulo, Obra } from '../modelo';
import { escreverAutoria, maiusculas, type OpcoesAutoria } from './autores';
import { anoDaReferencia, dataAbreviada } from './datas';
import type { AvisoReferencia, Montador } from './trechos';

export interface OpcoesReferencia extends OpcoesAutoria {
  /** Sufixo de mesmo autor e mesmo ano (D-M4-03), de `sufixosDeAno`. */
  sufixoAno?: string;
}

/** O que cada formatador recebe. */
export interface Contexto {
  m: Montador;
  avisos: AvisoReferencia[];
  opcoes: OpcoesReferencia;
}

/**
 * Autoria e título (RN-178 a RN-187), ou, sem autoria, o título como entrada (RN-179). Fecha com ponto.
 * `destaque`: o título leva negrito (livro, trabalho acadêmico) ou não (capítulo, artigo, trabalho em evento, em que o
 * negrito vai no todo, no periódico ou nos anais).
 */
export function escreverEntradaETitulo(obra: Obra, { m, opcoes }: Contexto, padrao: readonly string[], destaque: boolean): void {
  if (temAutoria(obra.autores)) {
    escreverAutoria(m, obra.autores!, obra.funcao, opcoes);
    m.ponto(padrao);
    escreverTitulo(m, obra, destaque ? ['negrito'] : [], destaque ? ['RN-178'] : padrao);
  } else {
    escreverTituloDeEntrada(m, obra);
  }
  m.ponto(padrao);
}

export function temAutoria(autores: readonly Autor[] | undefined): boolean {
  return autores !== undefined && autores.length > 0;
}

/** Título com o destaque pedido e subtítulo sem destaque depois de dois-pontos (RN-178). */
export function escreverTitulo(
  m: Montador,
  obra: { titulo: readonly InlineDeTitulo[]; subtitulo?: readonly InlineDeTitulo[] },
  marcas: readonly ('negrito')[],
  origem: readonly string[],
): void {
  m.inlines(obra.titulo, origem, marcas);
  escreverSubtitulo(m, obra);
}

function escreverSubtitulo(m: Montador, obra: { subtitulo?: readonly InlineDeTitulo[] }): void {
  if (obra.subtitulo && obra.subtitulo.length > 0) {
    m.texto(': ', ['RN-178']);
    m.inlines(obra.subtitulo, ['RN-178']);
  }
}

/**
 * Entrada pelo título (RN-179): a primeira palavra em maiúsculas, sem negrito ("MANUAL de editoração de texto").
 * Título iniciado por artigo ("OS PERIGOS do uso") não tem regra escrita (PF-09 f): só a primeira palavra sobe.
 */
export function escreverTituloDeEntrada(m: Montador, obra: { titulo: readonly InlineDeTitulo[]; subtitulo?: readonly InlineDeTitulo[] }): void {
  let dentroDaPrimeira = true;
  let comecou = false;
  for (const i of obra.titulo) {
    let texto = '';
    for (const ch of i.texto) {
      if (!dentroDaPrimeira) texto += ch;
      else if (/\s/u.test(ch)) {
        // Espaço antes da primeira palavra não entra; o primeiro depois dela encerra a palavra.
        if (comecou) {
          dentroDaPrimeira = false;
          texto += ch;
        }
      } else {
        comecou = true;
        texto += maiusculas(ch);
      }
    }
    m.texto(texto, ['RN-179'], i.marcas ?? []);
  }
  escreverSubtitulo(m, obra);
}

/** Responsável pelo todo ("FERREIRA, Naura Syria Carapeto (org.)") seguido de ponto. */
export function escreverAutoriaDoTodo(m: Montador, autores: readonly Autor[], funcao: FuncaoResponsavel | undefined, opcoes: OpcoesAutoria): void {
  escreverAutoria(m, autores, funcao, opcoes);
  m.ponto(['RN-200']);
}

/** "*In*: " (RN-188). */
export function escreverIn(m: Montador): void {
  m.texto('In', ['RN-188'], ['italico']);
  m.texto(': ', ['RN-188']);
}

/** "10. ed." (RN-192); a 1.ª edição é omitida (D-M4-05, provisório). */
export function escreverEdicao(m: Montador, obra: Pick<Obra, 'edicao'>): void {
  if (obra.edicao !== undefined && obra.edicao > 1) {
    m.texto(`${obra.edicao}. ed.`, ['RN-192', 'D-M4-05']);
    m.ponto(['RN-192']);
  }
}

/** Ano com as marcas de incerteza e o sufixo; avisa se falta. */
export function anoOuAviso(obra: Obra, { avisos, opcoes }: Contexto, rn: string): { texto: string; origem: string[] } | null {
  const ano = anoDaReferencia(obra, opcoes.sufixoAno);
  if (ano === null) {
    avisos.push({ codigo: 'ANO_AUSENTE', rn, mensagem: 'A obra não tem ano de publicação.' });
    return null;
  }
  return { texto: ano, origem: obra.anoIncerto ? ['RN-193', 'D-M4-04', 'D-M4-05'] : [rn] };
}

/**
 * Imprenta "Local: Editora, ano." (RN-194). Sem local, "[S. l.]"; sem editora, "[s. n.]" (RN-193, D-M4-05,
 * provisório). Ano incerto entre colchetes (D-M4-04).
 */
export function escreverImprenta(obra: Obra, ctx: Contexto, rn = 'RN-194'): void {
  const { m } = ctx;
  const local = obra.local?.trim();
  const editora = obra.editora?.trim();
  m.texto(local || '[S. l.]', local ? [rn] : ['RN-193', 'D-M4-05']);
  m.texto(': ', [rn]);
  m.texto(editora || '[s. n.]', editora ? [rn] : ['RN-193', 'D-M4-05']);
  const ano = anoOuAviso(obra, ctx, rn);
  if (ano) {
    m.texto(', ', [rn]);
    m.texto(ano.texto, ano.origem);
  }
  m.ponto([rn]);
}

/** Total de páginas: "191 p." (RN-194). Intervalo digitado ("39-68") sai como "p. 39-68" (RN-200). */
export function escreverTotalDePaginas(m: Montador, obra: Pick<Obra, 'paginas'>, rn = 'RN-194'): void {
  const p = obra.paginas?.trim();
  if (!p) return;
  if (/^\d+$/u.test(p)) m.texto(`${p} p.`, [rn]);
  else m.texto(`p. ${p}`, ['RN-200']);
  m.ponto([rn]);
}

/** Páginas da parte: "p. 39-68", "p. 248" (RN-200, RN-209, RN-212). Texto que não começa por número fica como digitado ("Cap. 2"). */
export function paginasDaParte(paginas: string | undefined): string | null {
  const p = paginas?.trim();
  if (!p) return null;
  return /^\d/u.test(p) ? `p. ${p}` : p;
}

/** Data da publicação do fascículo ou do jornal, como no documento; sem ela, o ano. */
export function dataDaPublicacao(obra: Obra, ctx: Contexto, rn: string): { texto: string; origem: string[] } | null {
  const data = obra.dataPublicacao?.trim();
  if (data) return { texto: `${data}${ctx.opcoes.sufixoAno ?? ''}`, origem: [rn] };
  return anoOuAviso(obra, ctx, rn);
}

/** "DOI: …" antes do endereço, como no exemplo DANTAS, p. 56 (RN-212; PF-09 i). */
export function escreverDoi(m: Montador, obra: Pick<Obra, 'doi'>): void {
  const doi = obra.doi?.trim();
  if (!doi) return;
  m.texto(`DOI: ${doi}`, ['RN-212']);
  m.ponto(['RN-212']);
}

/** "Disponível em: URL. Acesso em: 23 jun. 2006." (RN-189, RN-190). */
export function escreverOnline(m: Montador, obra: Pick<Obra, 'url' | 'acesso'>, avisos: AvisoReferencia[]): void {
  const url = obra.url?.trim();
  if (!url) {
    if (obra.acesso) avisos.push({ codigo: 'URL_AUSENTE', rn: 'RN-189', mensagem: 'Há data de acesso sem o endereço eletrônico.' });
    return;
  }
  m.texto(`Disponível em: ${url}`, ['RN-189']);
  m.ponto(['RN-189']);
  const acesso = obra.acesso ? dataAbreviada(obra.acesso) : null;
  if (acesso === null) {
    avisos.push({ codigo: 'ACESSO_AUSENTE', rn: 'RN-189', mensagem: 'Documento on-line sem a data de acesso.' });
    return;
  }
  m.texto(`Acesso em: ${acesso}`, ['RN-189', 'RN-190']);
  m.ponto(['RN-189']);
}

/** Lista de partes "a, b, c" com a origem de cada uma, sem as vazias. */
export function escreverSequencia(m: Montador, partes: readonly ({ texto: string; origem: readonly string[]; marcas?: readonly ('negrito' | 'italico')[] } | null)[], separador: readonly string[]): void {
  partes
    .filter((x): x is NonNullable<typeof x> => x !== null && x.texto !== '')
    .forEach((x, i) => {
      if (i > 0) m.texto(', ', separador);
      m.texto(x.texto, x.origem, x.marcas ?? []);
    });
}
