/**
 * Verificações da Norma Tabular do IBGE (M7-T02). Só a espécie `tabela` (o quadro não segue a Norma Tabular, RN-241);
 * tudo aviso (D-M7-03): são recomendações da norma ou heurísticas sobre o texto. Nunca muda o documento.
 *
 * - TABELA_TITULO_SIGLA (RN-247; I, p. 13, 4.2.1): sigla de duas ou mais maiúsculas no título (numeral romano fora).
 * - TABELA_SEM_INDICADOR (RN-256; I, p. 15–16, 4.5): com cabeçalho e mais de uma coluna, a célula do cabeçalho da
 *   coluna indicadora está vazia.
 * - TABELA_CELULA_FORA_DOS_SINAIS (RN-263; I, p. 18, 4.8.1): célula de dados vazia ou com "n/d", "s/d", "N/A", "—"…
 *   numa coluna que tem números. Lista fechada de sinais: -, .., ..., X, 0 / 0,0.
 * - TABELA_FONTE_SIGLA (RN-271; I, p. 20, 4.10.2): fonte escrita só com uma sigla.
 * - TABELA_SERIE_TEMPORAL (RN-279; I, p. 21–22, 5.2): "aaaa–aaaa", "aaaa—aaaa" ou "aaaa a aaaa" no título ou na
 *   coluna indicadora; a série consecutiva se escreve com hífen (1981-1985), a não consecutiva com barra.
 * - TABELA_CLASSE_ABERTA (RN-284; I, p. 24, 6.4): primeira ou última classe da coluna indicadora aberta ("até z",
 *   "menos de z", "mais de w", "w ou mais").
 * - TABELA_TOTAL_DIVERGENTE (RN-287; I, p. 26–27, 7.4): linha "Total" diferente da soma das parcelas, sem nota geral.
 * - TABELA_SINAIS_DEMAIS (RN-298; I, p. 30, 9.2): tantos ou mais sinais convencionais que dados numéricos.
 * - TABELA_OUTROS_MAIOR (RN-299; I, p. 30, 9.3): linha "Outros/Outras" maior que alguma outra classificação.
 * - TABELA_TITULO_PONTO (RN-310, PENDENTE-FONTE, provisória): título terminado em ponto; os exemplos não têm.
 *
 * Fora daqui (D-M7-04): RN-257 (unidade "quando preciso" não é verificável sem falso positivo) e RN-270 ("Fontes" no
 * plural é do motor, não do autor).
 */
import { secoesDeLeitura, type BlocoTabela, type Documento, type Id, type Secao } from '../modelo';
import { celulasComColuna, ehDadoNumerico, textoDaCelula } from '../visuais';

export type CodigoProblemaTabela =
  | 'TABELA_TITULO_SIGLA'
  | 'TABELA_SEM_INDICADOR'
  | 'TABELA_CELULA_FORA_DOS_SINAIS'
  | 'TABELA_FONTE_SIGLA'
  | 'TABELA_SERIE_TEMPORAL'
  | 'TABELA_CLASSE_ABERTA'
  | 'TABELA_TOTAL_DIVERGENTE'
  | 'TABELA_SINAIS_DEMAIS'
  | 'TABELA_OUTROS_MAIOR'
  | 'TABELA_TITULO_PONTO';

export interface ProblemaTabela {
  codigo: CodigoProblemaTabela;
  origem: readonly string[];
  mensagem: string;
  secao: Id;
  elemento: Id;
  trecho?: string;
}

const SINAIS = new Set(['-', '–', '..', '...', '…', 'X', 'x']);
const SIGLA = /(?<![\p{L}\p{N}])\p{Lu}[\p{Lu}\p{N}]{1,19}(?![\p{L}\p{N}])/gu;
const ROMANO = /^[IVXLCDM]+$/u;
const SERIE = /(?<!\d)((?:1[5-9]|20)\d{2})\s*(?:[–—]|\sa\s)\s*((?:1[5-9]|20)\d{2})(?!\d)/u;
const CLASSE_ABERTA = /^(?:até|menos de|mais de)\s|\sou mais$/iu;
const TOTAL = /^total\b/iu;
const OUTROS = /^outr[oa]s\b/iu;

const plano = (c: readonly { texto: string }[] | undefined): string => (c ?? []).map((i) => i.texto).join('').replace(/\s+/gu, ' ').trim();

/** Número pt-BR ("1.234,5", "117 960 301", "-3", "12%"); `null` se não for número. "-" e "–" sozinhos valem 0. */
function numero(t: string): { valor: number; casas: number } | null {
  if (t === '-' || t === '–') return { valor: 0, casas: 0 };
  const limpo = t.replace(/(?<=\d)[\s  ](?=\d)/gu, '').replace(/^(?:R\$|US\$|€)\s?/u, '').replace(/\s?%$/u, '').replace(/^[−–]/u, '-');
  if (!/^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:,\d+)?$/u.test(limpo)) return null;
  const casas = limpo.includes(',') ? limpo.split(',')[1]!.length : 0;
  return { valor: Number(limpo.replace(/\./gu, '').replace(',', '.')), casas };
}

/** Grade de textos já resolvida pela mesclagem: [linha][coluna] (célula coberta = null). */
function grade(t: BlocoTabela): (string | null)[][] {
  const g: (string | null)[][] = t.linhas.map(() => new Array<string | null>(t.colunas.length).fill(null));
  for (const { linha, coluna, celula } of celulasComColuna(t)) if (coluna < t.colunas.length) g[linha]![coluna] = textoDaCelula(celula);
  return g;
}

function conferirTabela(t: BlocoTabela, add: (p: Omit<ProblemaTabela, 'secao' | 'elemento'>) => void): void {
  const titulo = plano(t.titulo);
  const siglas = [...titulo.matchAll(SIGLA)].map((m) => m[0]).filter((s) => !ROMANO.test(s));
  if (siglas.length > 0) add({ codigo: 'TABELA_TITULO_SIGLA', origem: ['RN-247'], mensagem: `O título da tabela tem ${siglas.map((s) => `“${s}”`).join(', ')}; a natureza e a abrangência vão por extenso, sem abreviações.`, trecho: siglas[0]! });
  if (/\.$/u.test(titulo) && !/\.\.\.$|…$/u.test(titulo)) add({ codigo: 'TABELA_TITULO_PONTO', origem: ['RN-310'], mensagem: 'O título da tabela termina em ponto; nos exemplos da Norma Tabular e do Manual o título não tem ponto final.' });
  const serieTitulo = SERIE.exec(titulo);

  const fonte = plano(t.fonte);
  if (fonte !== '' && /^\p{Lu}[\p{Lu}\p{N}\-/]{1,19}\.?$/u.test(fonte)) add({ codigo: 'TABELA_FONTE_SIGLA', origem: ['RN-271'], mensagem: `A fonte está só como sigla (“${fonte}”); recomenda-se identificá-la por extenso.`, trecho: fonte });

  const g = grade(t);
  const cab = Math.min(t.linhasCabecalho, g.length);
  const dados = g.slice(cab);
  const nCol = t.colunas.length;
  if (cab > 0 && nCol > 1 && g.slice(0, cab).every((l) => (l[0] ?? '') === '') && g.slice(0, cab).some((l) => l[0] !== null)) {
    add({ codigo: 'TABELA_SEM_INDICADOR', origem: ['RN-256'], mensagem: 'O cabeçalho da coluna indicadora (a primeira) está vazio; ela deve dizer o que as linhas indicam.' });
  }

  const indicadores = nCol > 1 ? dados.map((l) => l[0] ?? '').filter((x) => x !== '') : [];
  const serieInd = indicadores.map((x) => SERIE.exec(x)).find((m) => m);
  const serie = serieTitulo ?? serieInd;
  if (serie) add({ codigo: 'TABELA_SERIE_TEMPORAL', origem: ['RN-279'], mensagem: `“${serie[0]}”: na série temporal consecutiva os pontos se ligam por hífen (${serie[1]}-${serie[2]}); na não consecutiva, por barra (${serie[1]}/${serie[2]}).`, trecho: serie[0] });

  const semTotal = indicadores.filter((x) => !TOTAL.test(x));
  const extremos = [semTotal[0], semTotal[semTotal.length - 1]].filter((x): x is string => !!x && CLASSE_ABERTA.test(x));
  if (extremos.length > 0) add({ codigo: 'TABELA_CLASSE_ABERTA', origem: ['RN-284'], mensagem: `Classe aberta na coluna indicadora (${[...new Set(extremos)].map((x) => `“${x}”`).join(', ')}); recomenda-se que a primeira e a última classe sejam fechadas.`, trecho: extremos[0]! });

  // Colunas de dados: fora da indicadora quando há mais de uma coluna.
  const colunasDados = nCol > 1 ? Array.from({ length: nCol - 1 }, (_, i) => i + 1) : [0];
  let sinais = 0;
  let numeros = 0;
  const foraDosSinais = new Set<string>();
  for (const c of colunasDados) {
    const coluna = dados.map((l) => l[c]).filter((x): x is string => x !== null);
    if (!coluna.some((x) => numero(x) !== null && !SINAIS.has(x))) continue;
    for (const x of coluna) {
      if (SINAIS.has(x)) sinais++;
      else if (ehDadoNumerico(x)) numeros++;
      else foraDosSinais.add(x === '' ? '(vazia)' : x);
    }
  }
  if (foraDosSinais.size > 0) add({ codigo: 'TABELA_CELULA_FORA_DOS_SINAIS', origem: ['RN-263'], mensagem: `Célula de dados com ${[...foraDosSinais].slice(0, 5).map((x) => x === '(vazia)' ? 'conteúdo vazio' : `“${x}”`).join(', ')}; nenhuma célula fica vazia e o dado ausente se indica pelos sinais convencionais (-, .., ..., X).`, ...(foraDosSinais.has('(vazia)') ? {} : { trecho: [...foraDosSinais][0]! }) });
  if (sinais > 0 && sinais >= numeros) add({ codigo: 'TABELA_SINAIS_DEMAIS', origem: ['RN-298'], mensagem: `A tabela tem ${sinais} sinal(is) convencional(is) e ${numeros} dado(s) numérico(s); recomenda-se haver mais dados que sinais.` });

  if (nCol > 1) {
    const iTotal = dados.findIndex((l) => TOTAL.test(l[0] ?? ''));
    const iOutros = dados.findIndex((l) => OUTROS.test(l[0] ?? ''));
    const temNota = plano(t.nota) !== '';
    let divergente: string | null = null;
    let outrosMaior = false;
    for (const c of colunasDados) {
      const valores = dados.map((l, i) => ({ i, n: l[c] == null ? null : numero(l[c]!) }));
      if (iTotal >= 0 && !temNota && divergente === null) {
        const total = valores[iTotal]!.n;
        const parcelas = valores.filter((v) => v.i !== iTotal);
        if (total && parcelas.length > 1 && parcelas.every((v) => v.n !== null)) {
          const casas = Math.max(total.casas, ...parcelas.map((v) => v.n!.casas));
          const soma = parcelas.reduce((s, v) => s + v.n!.valor, 0);
          const f = 10 ** casas;
          if (Math.round(soma * f) !== Math.round(total.valor * f)) divergente = `${(dados[iTotal]![c] ?? '')} na coluna ${c + 1}`;
        }
      }
      if (iOutros >= 0 && !outrosMaior) {
        const outros = valores[iOutros]!.n;
        if (outros && valores.some((v) => v.i !== iOutros && v.i !== iTotal && v.n !== null && v.n.valor < outros.valor)) outrosMaior = true;
      }
    }
    if (divergente) add({ codigo: 'TABELA_TOTAL_DIVERGENTE', origem: ['RN-287'], mensagem: `O total (${divergente}) difere da soma das parcelas; explique a divergência numa nota geral ou corrija a parcela arredondada.` });
    if (outrosMaior) add({ codigo: 'TABELA_OUTROS_MAIOR', origem: ['RN-299'], mensagem: `A linha “${dados[iOutros]![0]}” tem valor maior que outra classificação; recomenda-se que “Outros” reúna os dados menores.` });
  }
}

export function verificarTabelas(doc: Pick<Documento, 'corpo'> & Partial<Pick<Documento, 'posTextuais'>>): ProblemaTabela[] {
  const saida: ProblemaTabela[] = [];
  const visitar = (s: Secao) => {
    for (const b of s.blocos) {
      if (b.tipo !== 'tabela' || b.especie !== 'tabela') continue;
      conferirTabela(b, (p) => saida.push({ ...p, secao: s.id, elemento: b.id }));
    }
    for (const sub of s.subsecoes) visitar(sub);
  };
  for (const s of secoesDeLeitura(doc)) visitar(s);
  return saida;
}
