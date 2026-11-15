/**
 * "Importar planilha" por aba (Etapa 4 da especificação de atualização). Funções puras sobre a pasta lida por
 * `importacao/xlsx.ts`:
 *
 * - `sugerirIntervalos`: a área preenchida da aba e, quando a aba tem vários elementos, um intervalo para cada um.
 *   Os elementos se separam por uma **linha-título** (uma só célula com texto, sem mesclagem, depois de linha vazia ou
 *   no topo: "2022", "2023"…) ou por **linhas vazias** quando a parte seguinte repete o cabeçalho da primeira ou o
 *   intervalo vazio tem três linhas ou mais. Uma ou duas linhas vazias, sem cabeçalho repetido, são espaçamento da
 *   própria tabela e não separam nada (como em "2024", de grupo em grupo).
 * - `planilhaDoIntervalo`: o intervalo escolhido no formato da colagem (`PlanilhaLida`), que segue para a mesma prévia
 *   e a mesma conversão da colagem (`converterPlanilha`). As células vazias ficam vazias, o zero fica "0" e o texto
 *   ("N/A") fica como está; a mesclagem cortada pelo intervalo é reduzida a ele; as colunas inteiramente vazias do
 *   intervalo saem por padrão (a planilha pode deixar colunas sem uso entre as preenchidas), com aviso.
 *
 * Nada aqui altera o arquivo de origem: a pasta é só lida.
 */
import { crescerParaMesclagens, letrasColuna, type AbaXlsx, type CelulaXlsx, type IntervaloXlsx } from '../../importacao/xlsx';
import type { CelulaPlanilha, EstiloOrigem, PlanilhaLida } from './planilha';

export { lerIntervalo, lerPastaXlsx, LIMITE_BYTES_XLSX, letrasColuna, textoIntervalo } from '../../importacao/xlsx';
export type { AbaXlsx, CelulaXlsx, IntervaloXlsx, PastaXlsx, ResultadoLerXlsx } from '../../importacao/xlsx';

/** De onde veio a tabela importada; vai para o bloco (`BlocoTabela.origem`). */
export interface OrigemPlanilha {
  arquivo: string;
  aba: string;
  intervalo: string;
}

export interface IntervaloSugerido {
  intervalo: IntervaloXlsx;
  /** "Área preenchida" ou "Elemento 2 de 3 (linha-título “2023”)". */
  rotulo: string;
}

export interface OpcoesIntervalo {
  /** Retira as colunas sem nenhuma célula com valor (padrão: sim). */
  retirarColunasVazias: boolean;
  /** Retira as linhas sem nenhuma célula com valor (padrão: não: a sequência de linhas da origem fica). */
  retirarLinhasVazias: boolean;
}

export const OPCOES_INTERVALO_PADRAO: OpcoesIntervalo = { retirarColunasVazias: true, retirarLinhasVazias: false };

/** Mapa "l,c" → célula. */
function indice(aba: AbaXlsx): Map<string, CelulaXlsx> {
  const m = new Map<string, CelulaXlsx>();
  for (const x of aba.celulas) m.set(`${x.l},${x.c}`, x);
  return m;
}

const temValor = (x: CelulaXlsx | undefined): boolean => x !== undefined && (x.texto.trim() !== '' || x.semResultado === true);

/** Menor retângulo com valor dentro de `i` (com as mesclagens que o tocam); `null` = nada. */
function aparar(i: IntervaloXlsx, celulas: Map<string, CelulaXlsx>, mesclagens: readonly IntervaloXlsx[]): IntervaloXlsx | null {
  let a: IntervaloXlsx | null = null;
  for (let l = i.l1; l <= i.l2; l++) {
    for (let c = i.c1; c <= i.c2; c++) {
      if (!temValor(celulas.get(`${l},${c}`))) continue;
      a = a ? { l1: Math.min(a.l1, l), c1: Math.min(a.c1, c), l2: Math.max(a.l2, l), c2: Math.max(a.c2, c) } : { l1: l, c1: c, l2: l, c2: c };
    }
  }
  if (!a) return null;
  const crescido = crescerParaMesclagens(a, mesclagens);
  // A mesclagem não puxa o intervalo para fora da parte (não junta dois elementos).
  return { l1: Math.max(crescido.l1, i.l1), c1: Math.max(crescido.c1, i.c1), l2: Math.min(crescido.l2, i.l2), c2: Math.min(crescido.c2, i.c2) };
}

/** Intervalos sugeridos para a aba: a área preenchida e, se houver mais de um elemento, cada um. */
export function sugerirIntervalos(aba: AbaXlsx): IntervaloSugerido[] {
  const area = aba.preenchida;
  if (!area) return [];
  const cel = indice(aba);
  const valoresDaLinha = (l: number) => {
    const v: { c: number; texto: string }[] = [];
    for (let c = area.c1; c <= area.c2; c++) {
      const x = cel.get(`${l},${c}`);
      if (temValor(x)) v.push({ c, texto: x!.texto.trim() });
    }
    return v;
  };
  const coberta = (l: number) => aba.mesclagens.some((m) => m.l1 < l && m.l2 >= l && m.c1 <= area.c2 && m.c2 >= area.c1);
  const vazia = (l: number) => valoresDaLinha(l).length === 0 && !coberta(l);
  const mescladaNaHorizontal = (l: number, c: number) => aba.mesclagens.some((m) => m.l1 === l && m.c1 === c && m.c2 > m.c1);

  // 1) Linhas-título: uma só célula com valor, sem mesclagem horizontal, no topo ou depois de linha vazia, com conteúdo logo abaixo.
  const titulos: { l: number; texto: string }[] = [];
  for (let l = area.l1; l < area.l2; l++) {
    const v = valoresDaLinha(l);
    if (v.length !== 1 || mescladaNaHorizontal(l, v[0]!.c) || coberta(l)) continue;
    if (v[0]!.texto.length > 80) continue;
    const antesVazia = l === area.l1 || vazia(l - 1);
    if (antesVazia && !vazia(l + 1)) titulos.push({ l, texto: v[0]!.texto });
  }
  let partes: { intervalo: IntervaloXlsx; titulo?: string }[] = [];
  if (titulos.length >= 2 || (titulos.length === 1 && titulos[0]!.l > area.l1)) {
    if (titulos[0]!.l > area.l1) partes.push({ intervalo: { ...area, l2: titulos[0]!.l - 1 } });
    titulos.forEach((t, k) => {
      const fim = k + 1 < titulos.length ? titulos[k + 1]!.l - 1 : area.l2;
      if (fim > t.l) partes.push({ intervalo: { ...area, l1: t.l + 1, l2: fim }, titulo: t.texto });
    });
  } else partes.push({ intervalo: titulos.length === 1 ? { ...area, l1: titulos[0]!.l + 1 } : area });

  // 2) Linhas vazias: separam quando o intervalo vazio tem 2+ linhas ou a parte seguinte repete o cabeçalho.
  const divididas: typeof partes = [];
  for (const p of partes) {
    const i = p.intervalo;
    const cabecalho = valoresDaLinha(i.l1);
    let inicio = i.l1;
    let l = i.l1 + 1;
    while (l <= i.l2) {
      if (!vazia(l)) {
        l++;
        continue;
      }
      let fimVazio = l;
      while (fimVazio + 1 <= i.l2 && vazia(fimVazio + 1)) fimVazio++;
      const seguinte = fimVazio + 1;
      if (seguinte > i.l2) break;
      const proxima = valoresDaLinha(seguinte);
      const iguais = proxima.filter((x) => cabecalho.some((h) => h.c === x.c && h.texto === x.texto)).length;
      const repete = cabecalho.length >= 2 && iguais * 2 >= cabecalho.length;
      if (fimVazio - l + 1 >= 3 || repete) {
        divididas.push({ intervalo: { ...i, l1: inicio, l2: l - 1 }, ...(inicio === i.l1 && p.titulo ? { titulo: p.titulo } : {}) });
        inicio = seguinte;
      }
      l = seguinte;
    }
    divididas.push({ intervalo: { ...i, l1: inicio }, ...(inicio === i.l1 && p.titulo ? { titulo: p.titulo } : {}) });
  }
  partes = divididas
    .map((p) => ({ ...p, intervalo: aparar(p.intervalo, cel, aba.mesclagens) }))
    .filter((p): p is { intervalo: IntervaloXlsx; titulo?: string } => p.intervalo !== null);

  if (partes.length <= 1) return [{ intervalo: partes[0]?.intervalo ?? area, rotulo: 'Área preenchida' }];
  return partes.map((p, k) => ({
    intervalo: p.intervalo,
    rotulo: `Elemento ${k + 1} de ${partes.length}${p.titulo ? ` (depois de “${p.titulo.length > 30 ? `${p.titulo.slice(0, 30)}…` : p.titulo}”)` : ''}`,
  }));
}

export interface PlanilhaDoIntervalo {
  lida: PlanilhaLida;
  /** Intervalo efetivamente lido (o pedido, crescido só se nada mudou: a mesclagem cortada é reduzida, não puxada). */
  intervalo: IntervaloXlsx;
  colunasRetiradas: string[];
  linhasRetiradas: number[];
}

const plural = (n: number, um: string, varios: string): string => (n === 1 ? um : varios.replace('#', String(n)));
const listaCurta = (itens: readonly string[]): string => (itens.length > 8 ? `${itens.slice(0, 8).join(', ')} e mais ${itens.length - 8}` : itens.join(', '));

/**
 * O intervalo da aba no formato da colagem. A grade segue o modelo do HTML: cada linha lista só as células que
 * começam nela; a posição coberta por mesclagem não aparece.
 */
export function planilhaDoIntervalo(aba: AbaXlsx, pedido: IntervaloXlsx, opcoes: OpcoesIntervalo = OPCOES_INTERVALO_PADRAO): PlanilhaDoIntervalo {
  const cel = indice(aba);
  const i = pedido;
  const avisos: string[] = [];
  // Mesclagem que começa fora do intervalo: o texto dela passa para a primeira célula que ficou dentro (antes de
  // decidir que colunas e linhas estão vazias).
  for (const m of aba.mesclagens) {
    if (m.l1 > i.l2 || m.l2 < i.l1 || m.c1 > i.c2 || m.c2 < i.c1) continue;
    const l = Math.max(m.l1, i.l1);
    const c = Math.max(m.c1, i.c1);
    const origem = cel.get(`${m.l1},${m.c1}`);
    if (origem && (l !== m.l1 || c !== m.c1)) cel.set(`${l},${c}`, { ...origem, l, c });
  }
  // Colunas e linhas que ficam.
  const colunaTemValor = (c: number) => {
    for (let l = i.l1; l <= i.l2; l++) if (temValor(cel.get(`${l},${c}`))) return true;
    return false;
  };
  const linhaTemValor = (l: number) => {
    for (let c = i.c1; c <= i.c2; c++) if (temValor(cel.get(`${l},${c}`))) return true;
    return false;
  };
  // Coluna ou linha só coberta por mesclagem de outra (sem valor próprio) também é "vazia": a mesclagem encolhe.
  const colunas: number[] = [];
  const colunasRetiradas: string[] = [];
  for (let c = i.c1; c <= i.c2; c++) {
    if (opcoes.retirarColunasVazias && !colunaTemValor(c)) colunasRetiradas.push(letrasColuna(c));
    else colunas.push(c);
  }
  const linhas: number[] = [];
  const linhasRetiradas: number[] = [];
  for (let l = i.l1; l <= i.l2; l++) {
    if (opcoes.retirarLinhasVazias && !linhaTemValor(l)) linhasRetiradas.push(l + 1);
    else linhas.push(l);
  }
  if (colunas.length === 0 || linhas.length === 0) {
    return { lida: { linhas: [], avisos: ['O intervalo não tem nenhuma célula com valor.'] }, intervalo: i, colunasRetiradas, linhasRetiradas };
  }

  // Mesclagens no intervalo, cortadas por ele.
  let cortadas = 0;
  const ancoras = new Map<string, { colunas: number; linhas: number }>();
  const cobertas = new Set<string>();
  for (const m of aba.mesclagens) {
    if (m.l1 > i.l2 || m.l2 < i.l1 || m.c1 > i.c2 || m.c2 < i.c1) continue;
    const r = { l1: Math.max(m.l1, i.l1), c1: Math.max(m.c1, i.c1), l2: Math.min(m.l2, i.l2), c2: Math.min(m.c2, i.c2) };
    if (r.l1 !== m.l1 || r.c1 !== m.c1 || r.l2 !== m.l2 || r.c2 !== m.c2) cortadas++;
    const ls = linhas.filter((l) => l >= r.l1 && l <= r.l2);
    const cs = colunas.filter((c) => c >= r.c1 && c <= r.c2);
    if (ls.length === 0 || cs.length === 0) continue;
    // A âncora é a célula de cima à esquerda que ficou; o texto é o da origem (célula de cima à esquerda da mesclagem).
    ancoras.set(`${ls[0]},${cs[0]}`, { colunas: cs.length, linhas: ls.length });
    for (const l of ls) for (const c of cs) if (l !== ls[0] || c !== cs[0]) cobertas.add(`${l},${c}`);
    const origem = cel.get(`${m.l1},${m.c1}`);
    if (origem && (ls[0] !== m.l1 || cs[0] !== m.c1)) cel.set(`${ls[0]},${cs[0]}`, { ...origem, l: ls[0]!, c: cs[0]! });
  }
  if (cortadas > 0) avisos.push(`${plural(cortadas, 'Uma célula mesclada passa', '# células mescladas passam')} do intervalo: ${cortadas === 1 ? 'foi reduzida' : 'foram reduzidas'} a ele.`);

  const estilo: EstiloOrigem = { celulas: 0, bordasVerticais: 0, bordasHorizontais: 0, negrito: 0, italico: 0, cores: 0 };
  const semResultado: string[] = [];
  const erros: string[] = [];
  let formulas = 0;
  const grade: CelulaPlanilha[][] = [];
  for (const l of linhas) {
    const linha: CelulaPlanilha[] = [];
    for (const c of colunas) {
      const k = `${l},${c}`;
      if (cobertas.has(k)) continue;
      const x = cel.get(k);
      const ancora = ancoras.get(k);
      const celula: CelulaPlanilha = { texto: x?.texto ?? '' };
      if (ancora && ancora.colunas > 1) celula.colunas = ancora.colunas;
      if (ancora && ancora.linhas > 1) celula.linhas = ancora.linhas;
      if (x?.alinhamento && x.texto !== '') celula.alinhamento = x.alinhamento;
      linha.push(celula);
      if (!x) continue;
      const end = `${letrasColuna(c)}${l + 1}`;
      if (x.semResultado) semResultado.push(end);
      if (x.tipo === 'erro') erros.push(`${end} (${x.texto})`);
      if (x.formula && !x.semResultado) formulas++;
      estilo.celulas++;
      if (x.bordas?.esquerda || x.bordas?.direita) estilo.bordasVerticais++;
      if (x.bordas?.cima || x.bordas?.baixo) estilo.bordasHorizontais++;
      if (x.negrito) estilo.negrito++;
      if (x.italico) estilo.italico++;
      if (x.cor) estilo.cores++;
    }
    grade.push(linha);
  }

  if (formulas > 0) avisos.push(`${plural(formulas, 'Uma célula com fórmula entrou', '# células com fórmula entraram')} com o resultado gravado na planilha, como aparece na tela (a fórmula não vem).`);
  if (semResultado.length > 0)
    avisos.push(`Sem resultado gravado no arquivo (fórmula nunca calculada ou salva sem cálculo): ${listaCurta(semResultado)}. ${semResultado.length === 1 ? 'A célula ficou vazia' : 'As células ficaram vazias'}: abra a planilha no Excel ou no LibreOffice, salve e importe de novo, ou digite o valor.`);
  if (erros.length > 0) avisos.push(`Células com erro da planilha, mantidas como texto: ${listaCurta(erros)}.`);
  if (colunasRetiradas.length > 0) avisos.push(`${plural(colunasRetiradas.length, 'A coluna', 'As colunas')} ${listaCurta(colunasRetiradas)} do intervalo não ${colunasRetiradas.length === 1 ? 'tem' : 'têm'} nenhuma célula com valor e ${colunasRetiradas.length === 1 ? 'ficou' : 'ficaram'} de fora.`);
  if (linhasRetiradas.length > 0) avisos.push(`${plural(linhasRetiradas.length, 'A linha', 'As linhas')} ${listaCurta(linhasRetiradas.map(String))} do intervalo ${linhasRetiradas.length === 1 ? 'estava vazia e ficou' : 'estavam vazias e ficaram'} de fora.`);
  const ocultasL = aba.linhasOcultas.filter((l) => linhas.includes(l)).map((l) => String(l + 1));
  const ocultasC = aba.colunasOcultas.filter((c) => colunas.includes(c)).map(letrasColuna);
  if (ocultasL.length > 0 || ocultasC.length > 0)
    avisos.push(`O intervalo tem ${[ocultasL.length > 0 ? `linhas ocultas na planilha (${listaCurta(ocultasL)})` : '', ocultasC.length > 0 ? `colunas ocultas (${listaCurta(ocultasC)})` : ''].filter(Boolean).join(' e ')}: elas entram na tabela. Ajuste o intervalo se não devem entrar.`);
  if (aba.celulasNaoLidas > 0) avisos.push(`A aba tem ${aba.celulasNaoLidas} células além do limite de leitura, que ficaram de fora.`);
  const quebras = grade.flat().filter((x) => x.texto.includes('\n')).length;
  if (quebras > 0) avisos.push(`${plural(quebras, 'Uma célula tem', '# células têm')} quebra de linha dentro do texto, mantida como na planilha.`);

  // Cabeçalho sugerido: célula mesclada para baixo na 1.ª linha indica corpo (rótulo de grupo, como "Ambiental"), não
  // cabeçalho; sem isso, vale a sugestão da colagem (1.ª linha sem números).
  const lida: PlanilhaLida = { linhas: grade, avisos, estiloOrigem: estilo };
  if ((grade[0] ?? []).some((x) => (x.linhas ?? 1) > 1)) lida.linhasCabecalho = 0;
  return { lida, intervalo: i, colunasRetiradas, linhasRetiradas };
}

/** O intervalo, depois de crescer para não cortar mesclagens (para o botão "Incluir as células mescladas inteiras"). */
export function intervaloSemCorte(aba: AbaXlsx, i: IntervaloXlsx): IntervaloXlsx {
  return crescerParaMesclagens(i, aba.mesclagens);
}

export const descreverOrigem = (o: OrigemPlanilha): string => `${o.arquivo} › ${o.aba} › ${o.intervalo}`;

