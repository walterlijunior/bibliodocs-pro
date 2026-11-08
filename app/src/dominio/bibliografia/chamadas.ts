/**
 * Chamadas de citação no texto (M4-T03): RN-077 a RN-099, Manual cap. 3, p. 22–26.
 *
 * A chamada é gerada da obra a cada vez: o modelo guarda só a ligação (`InlineCitacao`), então mudar o ano ou o autor
 * da obra muda todas as chamadas (aceite do RF-07).
 *
 * - Parentética (RN-082, RN-083): (SOBRENOME, ano, p. X). Narrativa: Sobrenome (ano, p. X).
 * - Perfil 2002 (C-01, padrão, como o Manual): sobrenome em maiúsculas dentro dos parênteses. Opção 2023, PROVISÓRIA:
 *   sobrenome com só a inicial maiúscula também dentro dos parênteses.
 * - Dois ou três autores: "; " na parentética (RN-094, D-M4-02); "e" na narrativa (RN-093). Mais de três: o primeiro
 *   e "et al." (RN-095, D-M4-02), em itálico como nas referências (RN-185).
 * - Entrada pelo título: primeira palavra e reticências; artigo ou monossílabo inicial leva a palavra seguinte junto
 *   (RN-091).
 * - Várias obras separadas por "; " (RN-096, D-M4-03); sufixo a, b de mesmo autor e ano (D-M4-03).
 * - Volume antes da página: "1993, v. 2, p. 12" (Manual, p. 23, ex. CANDIDO).
 * - Sem página: "não paginado" (D-M4-04). Apud sem itálico, com a página das duas obras (RN-098, RN-099).
 * - Grifo dentro dos parênteses, depois da página (RN-090, como nos exemplos da p. 23).
 */
import type { Autor, Id, InlineCitacao, InlineDeTitulo, Obra, ObraCitada } from '../modelo';
import { autoresDeEntrada, LOCALE, maiusculas } from './autores';
import { anoDaReferencia } from './datas';
import { sufixosDeAno } from './ordenacao';
import { Montador, type AvisoReferencia, type TrechoReferencia } from './trechos';

/** C-01: "2002" segue o Manual (padrão do perfil UFT 2022); "2023" é opção provisória. */
export type EdicaoNbr10520 = '2002' | '2023';

export interface OpcoesChamada {
  edicaoNbr10520?: EdicaoNbr10520;
}

/** O que a chamada precisa saber do documento inteiro, calculado uma vez por lista de obras. */
export interface ContextoChamadas {
  obras: ReadonlyMap<Id, Obra>;
  /** D-M4-03. */
  sufixos: ReadonlyMap<Id, string>;
  /** Obras de autores diferentes com o mesmo sobrenome e o mesmo ano: sem decisão, só aviso (D-M4-03). */
  sobrenomeAmbiguo: ReadonlySet<Id>;
}

export interface ChamadaFormatada {
  citacao: Id;
  trechos: readonly TrechoReferencia[];
  avisos: readonly AvisoReferencia[];
}

export function contextoDeChamadas(obras: readonly Obra[]): ContextoChamadas {
  const porId = new Map(obras.map((o) => [o.id, o]));
  return { obras: porId, sufixos: sufixosDeAno(obras), sobrenomeAmbiguo: sobrenomesAmbiguos(obras) };
}

export function formatarChamada(citacao: InlineCitacao, ctx: ContextoChamadas, opcoes: OpcoesChamada = {}): ChamadaFormatada {
  const m = new Montador();
  const avisos: AvisoReferencia[] = [];
  const edicao = opcoes.edicaoNbr10520 ?? '2002';
  const marcarAviso = (obra: Obra) => {
    if (ctx.sobrenomeAmbiguo.has(obra.id) && !avisos.some((a) => a.codigo === 'SOBRENOME_E_ANO_REPETIDOS')) {
      avisos.push({
        codigo: 'SOBRENOME_E_ANO_REPETIDOS',
        rn: 'RN-096',
        mensagem: 'Autores diferentes com o mesmo sobrenome e o mesmo ano: a chamada não distingue as obras.',
      });
    }
  };
  const obraDe = (c: ObraCitada): Obra | null => {
    const obra = ctx.obras.get(c.obra);
    if (!obra) {
      // A leitura recusa citação sem obra (M4-T01); aqui é só defesa.
      avisos.push({ codigo: 'OBRA_INEXISTENTE', rn: 'RN-078', mensagem: 'A citação aponta para uma obra que não está na bibliografia.' });
      return null;
    }
    marcarAviso(obra);
    return obra;
  };

  if (citacao.forma === 'narrativa') {
    if (citacao.obras.length > 1) {
      avisos.push({
        codigo: 'NARRATIVA_COM_VARIAS_OBRAS',
        rn: 'RN-096',
        mensagem: 'O Manual não mostra chamada narrativa com várias obras: cada obra sai com o seu autor e ano.',
      });
    }
    citacao.obras.forEach((c, i) => {
      if (i > 0) m.texto('; ', ['RN-096', 'D-M4-03']);
      const obra = obraDe(c);
      if (!obra) {
        m.texto('?', ['RN-078']);
        return;
      }
      escreverEntrada(m, obra, 'narrativa', edicao);
      const ultima = i === citacao.obras.length - 1;
      // Sem ano, volume, página, apud nem grifo, não há o que pôr entre parênteses: "Lima", não "Lima ()" (revisão N-M4-04).
      const vazia =
        anoDaReferencia(obra, ctx.sufixos.get(obra.id)) === null && !c.volume?.trim() && !c.pagina?.trim() && !c.semPaginacao && !(ultima && (citacao.apud || citacao.grifo));
      if (vazia) {
        escreverAnoEPagina(m, obra, c, ctx, avisos, false); // só o aviso de obra sem ano
        return;
      }
      m.texto(' (', ['RN-083']);
      escreverAnoEPagina(m, obra, c, ctx, avisos, false);
      if (ultima) escreverApudEGrifo(m, citacao, ctx, avisos, edicao, obraDe);
      m.texto(')', ['RN-083']);
    });
  } else {
    m.texto('(', ['RN-083']);
    citacao.obras.forEach((c, i) => {
      if (i > 0) m.texto('; ', ['RN-096', 'D-M4-03']);
      const obra = obraDe(c);
      if (!obra) {
        m.texto('?', ['RN-078']);
        return;
      }
      escreverEntrada(m, obra, 'parentetica', edicao);
      escreverAnoEPagina(m, obra, c, ctx, avisos, true);
    });
    escreverApudEGrifo(m, citacao, ctx, avisos, edicao, obraDe);
    m.texto(')', ['RN-083']);
  }
  return { citacao: citacao.id, trechos: m.trechos, avisos };
}

// ---------------------------------------------------------------------------------------------------------------

type Lugar = 'parentetica' | 'narrativa';

/** Autoria (RN-077, RN-082, RN-093 a RN-095) ou título (RN-091). */
function escreverEntrada(m: Montador, obra: Obra, lugar: Lugar, edicao: EdicaoNbr10520): void {
  const autores = autoresDeEntrada(obra);
  if (autores.length === 0) {
    m.texto(entradaPeloTitulo(obra.titulo), ['RN-091']);
    return;
  }
  const caixaAlta = lugar === 'parentetica' && edicao === '2002';
  const origemNome = lugar === 'parentetica' ? (edicao === '2002' ? ['RN-082'] : ['RN-082', 'C-01']) : ['RN-082'];
  const nome = (a: Autor) => (caixaAlta ? maiusculas(nomeCurto(a)) : nomeNarrativo(a));
  if (autores.length > 3) {
    m.texto(nome(autores[0]!), origemNome);
    m.texto(' ', ['RN-095']);
    m.texto('et al.', ['RN-095', 'D-M4-02', 'RN-185'], ['italico']);
    return;
  }
  autores.forEach((a, i) => {
    if (i > 0) {
      if (lugar === 'parentetica') m.texto('; ', ['RN-094', 'D-M4-02']);
      else m.texto(i === autores.length - 1 ? ' e ' : ', ', ['RN-093']);
    }
    m.texto(nome(a), origemNome);
  });
}

/** Sobrenome da pessoa ("SILVA NETO") ou nome da entidade (RN-077). */
function nomeCurto(a: Autor): string {
  return a.tipo === 'entidade' ? a.nome.trim() : a.sobrenome.trim();
}

const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/**
 * Sobrenome na chamada narrativa e na opção 2023: só a inicial maiúscula ("Sudbrack", "Silva Neto",
 * "Authier-Reiriz"). Sobrenome digitado em caixa mista fica como está; digitado todo em maiúsculas, desce. Nome de
 * entidade fica como digitado: siglas como "ABNT" não podem descer.
 */
function nomeNarrativo(a: Autor): string {
  const nome = nomeCurto(a);
  if (a.tipo === 'entidade' || nome !== maiusculas(nome)) return nome;
  return nome
    .toLocaleLowerCase(LOCALE)
    .replace(/[\p{L}]+/gu, (palavra, pos: number) =>
      pos > 0 && PARTICULAS.has(palavra) ? palavra : maiusculas(palavra[0]!) + palavra.slice(1),
    );
}

const ARTIGOS = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas']);

/**
 * RN-091: "(ANTEPROJETO..., 1987, p. 55)". Título iniciado por artigo ou monossílabo leva a palavra seguinte. O
 * monossílabo é reconhecido por ter um só grupo de vogais, o que erra em hiatos curtos ("rio"): aproximação.
 */
export function entradaPeloTitulo(titulo: readonly InlineDeTitulo[]): string {
  const palavras = titulo
    .map((i) => i.texto)
    .join('')
    .trim()
    .split(/\s+/u)
    .filter((p) => p !== '');
  if (palavras.length === 0) return '...';
  const leva = palavrasDaEntrada(palavras.join(' '));
  const entrada = palavras
    .slice(0, leva)
    .join(' ')
    .replace(/[\s.,;:!?…]+$/u, '');
  return `${maiusculas(entrada)}...`;
}

/** Quantas palavras do título entram na entrada: 2 se a primeira é artigo ou monossílabo e há outra; senão 1. */
export function palavrasDaEntrada(titulo: string): 1 | 2 {
  const palavras = titulo.trim().split(/\s+/u).filter((p) => p !== '');
  if (palavras.length < 2) return 1;
  const nucleo = palavras[0]!.replace(/[^\p{L}]/gu, '').toLocaleLowerCase(LOCALE);
  return ARTIGOS.has(nucleo) || gruposDeVogais(nucleo) === 1 ? 2 : 1;
}

function gruposDeVogais(palavra: string): number {
  return (palavra.match(/[aeiouáéíóúâêôãõàü]+/gu) ?? []).length;
}

/** "2001, p. 27", "[2016?]", "2020a, não paginado"; na parentética, precedido de vírgula. */
function escreverAnoEPagina(m: Montador, obra: Obra, c: ObraCitada, ctx: ContextoChamadas, avisos: AvisoReferencia[], virgulaAntes: boolean): void {
  const partes: [string, string[]][] = [];
  const ano = anoDaReferencia(obra, ctx.sufixos.get(obra.id));
  if (ano === null) {
    if (!avisos.some((a) => a.codigo === 'ANO_AUSENTE')) {
      avisos.push({ codigo: 'ANO_AUSENTE', rn: 'RN-097', mensagem: 'A obra citada não tem ano: a chamada sai sem data.' });
    }
  } else {
    partes.push([ano, obra.anoIncerto ? ['RN-097', 'D-M4-04'] : ctx.sufixos.has(obra.id) ? ['RN-096', 'D-M4-03'] : ['RN-083']]);
  }
  if (c.volume?.trim()) partes.push([`v. ${c.volume.trim()}`, ['RN-083']]);
  if (c.semPaginacao) partes.push(['não paginado', ['RN-097', 'D-M4-04']]);
  else if (c.pagina?.trim()) partes.push([`p. ${c.pagina.trim()}`, ['RN-080', 'RN-083']]);
  partes.forEach(([texto, origem], i) => {
    if (i > 0 || virgulaAntes) m.texto(', ', ['RN-083']);
    m.texto(texto, origem);
  });
}

function escreverApudEGrifo(
  m: Montador,
  citacao: InlineCitacao,
  ctx: ContextoChamadas,
  avisos: AvisoReferencia[],
  edicao: EdicaoNbr10520,
  obraDe: (c: ObraCitada) => Obra | null,
): void {
  if (citacao.apud) {
    m.texto(' apud ', ['RN-098']);
    const consultada = obraDe(citacao.apud);
    if (!consultada) m.texto('?', ['RN-078']);
    else {
      // Na narrativa, a obra consultada fica dentro dos parênteses, com a grafia da parentética (RN-099).
      escreverEntrada(m, consultada, 'parentetica', edicao);
      escreverAnoEPagina(m, consultada, citacao.apud, ctx, avisos, true);
    }
  }
  if (citacao.grifo) m.texto(citacao.grifo === 'nosso' ? ', grifo nosso' : ', grifo do autor', ['RN-090']);
}

/**
 * Obras cuja chamada sairia igual sem serem do mesmo autor: mesmos sobrenomes na chamada (o primeiro, se mais de três)
 * e mesmo ano, com autoria completa diferente. Mesma autoria completa é caso de sufixo a, b (D-M4-03).
 */
function sobrenomesAmbiguos(obras: readonly Obra[]): Set<Id> {
  const grupos = new Map<string, Obra[]>();
  for (const o of obras) {
    const autores = autoresDeEntrada(o);
    if (autores.length === 0 || o.ano === undefined) continue;
    const naChamada = (autores.length > 3 ? autores.slice(0, 1) : autores).map((a) => maiusculas(nomeCurto(a)));
    const chave = `${naChamada.join(';')}${autores.length > 3 ? ' et al.' : ''}|${o.ano}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), o]);
  }
  const saida = new Set<Id>();
  for (const grupo of grupos.values()) {
    const autorias = new Set(grupo.map((o) => autoresDeEntrada(o).map(autoriaCompleta).join(';')));
    if (autorias.size > 1) for (const o of grupo) saida.add(o.id);
  }
  return saida;
}

function autoriaCompleta(a: Autor): string {
  return maiusculas(a.tipo === 'pessoa' ? `${a.sobrenome.trim()},${a.prenomes?.trim() ?? ''}` : a.nome.trim());
}
