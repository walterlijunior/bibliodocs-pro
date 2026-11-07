/**
 * Formatador de referência obra → trechos (M4-T02). Função pura: a mesma obra e as mesmas opções dão sempre os mesmos
 * trechos. Cada tipo de obra tem o seu padrão (Manual, 5.19); o M4-T02 entrega o livro (RN-194 a RN-199, RN-204,
 * RN-205, RN-191) e os elementos comuns. Os outros tipos da primeira leva (D-M4-06) chegam no M4-T04 e, até lá,
 * respondem com o aviso `TIPO_SEM_FORMATADOR`.
 */
import type { Obra, TipoObra } from '../modelo';
import { escreverAutoria, maiusculas, type OpcoesAutoria } from './autores';
import { anoDaReferencia, dataAbreviada } from './datas';
import { Montador, type AvisoReferencia, type ReferenciaFormatada } from './trechos';

export interface OpcoesReferencia extends OpcoesAutoria {
  /** Sufixo de mesmo autor e mesmo ano (D-M4-03), de `sufixosDeAno`. */
  sufixoAno?: string;
}

type Formatador = (obra: Obra, m: Montador, avisos: AvisoReferencia[], opcoes: OpcoesReferencia) => void;

const FORMATADORES: Partial<Record<TipoObra, Formatador>> = {
  livro: formatarLivro,
};

/** Tipos com formatador pronto, para a interface listar o que é suportado. */
export function tiposComFormatador(): TipoObra[] {
  return Object.keys(FORMATADORES) as TipoObra[];
}

export function formatarReferencia(obra: Obra, opcoes: OpcoesReferencia = {}): ReferenciaFormatada {
  const m = new Montador();
  const avisos: AvisoReferencia[] = [];
  const formatador = FORMATADORES[obra.tipo];
  if (!formatador) {
    avisos.push({
      codigo: 'TIPO_SEM_FORMATADOR',
      rn: 'D-M4-06',
      mensagem: `O tipo "${obra.tipo}" ainda não tem formatador de referência.`,
    });
    return { obra: obra.id, trechos: [], avisos };
  }
  formatador(obra, m, avisos, opcoes);
  m.aparar();
  return { obra: obra.id, trechos: m.trechos, avisos };
}

// ---------------------------------------------------------------------------------------------------------------
// Elementos comuns

/** Autoria (RN-180 a RN-187) ou, sem autoria, o título como entrada (RN-179). Fecha com ponto. */
export function escreverEntradaETitulo(obra: Obra, m: Montador, opcoes: OpcoesReferencia, padrao: readonly string[]): void {
  if (obra.autores && obra.autores.length > 0) {
    escreverAutoria(m, obra.autores, obra.funcao, opcoes);
    m.ponto(padrao);
    escreverTitulo(obra, m, ['RN-178']);
  } else {
    escreverTituloDeEntrada(obra, m);
  }
  m.ponto(padrao);
}

/** Título em negrito e subtítulo sem destaque depois de dois-pontos (RN-178). */
function escreverTitulo(obra: Pick<Obra, 'titulo' | 'subtitulo'>, m: Montador, origem: readonly string[]): void {
  m.inlines(obra.titulo, origem, ['negrito']);
  escreverSubtitulo(obra, m);
}

function escreverSubtitulo(obra: Pick<Obra, 'subtitulo'>, m: Montador): void {
  if (obra.subtitulo && obra.subtitulo.length > 0) {
    m.texto(': ', ['RN-178']);
    m.inlines(obra.subtitulo, ['RN-178']);
  }
}

/**
 * Entrada pelo título (RN-179): a primeira palavra em maiúsculas, sem negrito ("MANUAL de editoração de texto").
 * Título iniciado por artigo ("OS PERIGOS do uso") não tem regra escrita (PF-09 f): só a primeira palavra sobe.
 */
function escreverTituloDeEntrada(obra: Pick<Obra, 'titulo' | 'subtitulo'>, m: Montador): void {
  let dentroDaPrimeira = true;
  let comecou = false;
  for (const i of obra.titulo) {
    let texto = '';
    for (const ch of i.texto) {
      if (dentroDaPrimeira) {
        if (/\s/u.test(ch)) {
          // Espaço antes da primeira palavra não entra; o primeiro depois dela encerra a palavra.
          if (comecou) {
            dentroDaPrimeira = false;
            texto += ch;
          }
        } else {
          comecou = true;
          texto += maiusculas(ch);
        }
      } else {
        texto += ch;
      }
    }
    m.texto(texto, ['RN-179'], i.marcas ?? []);
  }
  escreverSubtitulo(obra, m);
}

/** "10. ed." (RN-192); a 1.ª edição é omitida (D-M4-05, provisório). */
export function escreverEdicao(obra: Pick<Obra, 'edicao'>, m: Montador): void {
  if (obra.edicao !== undefined && obra.edicao > 1) {
    m.texto(`${obra.edicao}. ed.`, ['RN-192', 'D-M4-05']);
    m.ponto(['RN-192']);
  }
}

/**
 * Imprenta "Local: Editora, ano." (RN-194). Sem local, "[S. l.]"; sem editora, "[s. n.]" (RN-193, D-M4-05,
 * provisório). Ano incerto entre colchetes (D-M4-04).
 */
export function escreverImprenta(obra: Obra, m: Montador, avisos: AvisoReferencia[], opcoes: OpcoesReferencia): void {
  const local = obra.local?.trim();
  const editora = obra.editora?.trim();
  m.texto(local || '[S. l.]', local ? ['RN-194'] : ['RN-193', 'D-M4-05']);
  m.texto(': ', ['RN-194']);
  m.texto(editora || '[s. n.]', editora ? ['RN-194'] : ['RN-193', 'D-M4-05']);
  const ano = anoDaReferencia(obra, opcoes.sufixoAno);
  if (ano === null) {
    avisos.push({ codigo: 'ANO_AUSENTE', rn: 'RN-194', mensagem: 'A obra não tem ano de publicação.' });
  } else {
    m.texto(', ', ['RN-194']);
    m.texto(ano, obra.anoIncerto ? ['RN-193', 'D-M4-04', 'D-M4-05'] : ['RN-194']);
  }
  m.ponto(['RN-194']);
}

/** Total de páginas do livro: "191 p." (RN-194). Intervalo digitado ("39-68") sai como "p. 39-68" (RN-200). */
export function escreverPaginas(obra: Pick<Obra, 'paginas'>, m: Montador): void {
  const p = obra.paginas?.trim();
  if (!p) return;
  if (/^\d+$/u.test(p)) m.texto(`${p} p.`, ['RN-194']);
  else m.texto(`p. ${p}`, ['RN-200']);
  m.ponto(['RN-194']);
}

/** "Disponível em: URL. Acesso em: 23 jun. 2006." (RN-189, RN-190). */
export function escreverOnline(obra: Pick<Obra, 'url' | 'acesso'>, m: Montador, avisos: AvisoReferencia[]): void {
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

// ---------------------------------------------------------------------------------------------------------------
// Tipos

/**
 * Livro (RN-194 a RN-199): AUTOR. **Título**: subtítulo. Tradução de Nome (RN-204). Edição. Local: Editora, ano.
 * Páginas. Disponível em … Acesso em … (RN-205). *E-book* (RN-191).
 *
 * Fora por falta de campo no modelo: coleção ou série (RN-194) e "Título original" (RN-204).
 */
function formatarLivro(obra: Obra, m: Montador, avisos: AvisoReferencia[], opcoes: OpcoesReferencia): void {
  escreverEntradaETitulo(obra, m, opcoes, ['RN-194']);
  if (obra.traducao?.trim()) {
    m.texto(`Tradução de ${obra.traducao.trim()}`, ['RN-204']);
    m.ponto(['RN-204']);
  }
  escreverEdicao(obra, m);
  escreverImprenta(obra, m, avisos, opcoes);
  escreverPaginas(obra, m);
  escreverOnline(obra, m, avisos);
  if (obra.ebook) {
    m.texto('E-book', ['RN-191'], ['italico']);
    m.ponto(['RN-191']);
  }
}
