/**
 * Tabela e quadro no motor (M5-T03). Só estrutura, texto e o que cada regra do perfil pede: a forma dos parágrafos vem
 * dos estilos `tituloElemento`, `rodapeElemento` e `celulaTabela`, que vêm do perfil.
 *
 * - Topo: "Tabela n – Título" (RN-052, RN-053; rótulo de `dominio/visuais`), num parágrafo antes da tabela e preso a ela
 *   pelo estilo (RN-050, RN-063).
 * - Moldura: tabela aberta com três traços, sem laterais, sem traços entre linhas nem entre colunas (RN-251 a RN-254);
 *   quadro fechado (RN-061). Cada traço só existe com a regra; sem regra, nenhum.
 * - Cabeçalho repetido em cada página (RN-292), também no quadro.
 * - Rodapé: Fonte → Nota → notas específicas (RN-277), chamada entre parênteses (RN-267, forma recomendada); uma linha
 *   depois do último parágrafo (RN-031, RN-308). Sem rodapé, sai um parágrafo vazio com esse espaço: a tabela nunca
 *   fica colada no que vem depois, e o Word sempre tem um parágrafo depois dela.
 * - Largura da tabela: a área útil da página.
 *
 * Equação (M5-T07): parágrafo próprio (RN-105) no estilo `equacao`; numerada, o número "(n)" vai depois de uma
 * tabulação à direita na largura útil (RN-106), e a forma do parágrafo vem do estilo (RN-107, RN-108/D-M5-05).
 */
import { celulasComColuna, larguraImpressaMm, lerInfoImagem, rodapeDoElemento, rotuloElemento, tamanhoGraficoMm, tituloComRotulo } from '../visuais';
import { numerarElementos, rotuloEquacao, type SequenciaElemento } from '../numeracao';
import type { AlinhamentoColuna, BlocoEquacao, BlocoGrafico, BlocoIlustracao, BlocoTabela, Id, InlineDeTitulo, Secao } from '../modelo';
import type { BlocoFormatado, CelulaFormatada, PaginaResolvida, TracosMoldura, TrechoFormatado } from './formatado';
import type { Perfil, RegraNormativa } from './perfil';

export interface ContextoVisuais {
  numeros: ReadonlyMap<Id, { sequencia: SequenciaElemento; numero: number }>;
  /** Número de cada equação numerada (RN-106). */
  equacoes: ReadonlyMap<Id, number>;
  rn: {
    numeracao: string | null;
    rotulo: string | null;
    ordemRodape: string | null;
    chamada: string | null;
    tresTracos: string | null;
    semVerticais: string | null;
    semEntreLinhas: string | null;
    semLaterais: string | null;
    quadroFechado: string | null;
    cabecalho: string | null;
    espaco: readonly string[];
    /** Regras do parágrafo da imagem (RN-059). */
    imagem: readonly string[];
    equacaoDestacada: string | null;
    numeroEquacao: string | null;
  };
  separador: string;
  espacoDepoisTw: number | null;
  larguraTw: number;
}

const ALINHAMENTO: Readonly<Record<AlinhamentoColuna, CelulaFormatada['alinhamento']>> = { esquerda: 'esquerda', centro: 'centralizado', direita: 'direita' };

const procedimento = (regras: readonly RegraNormativa[], nome: string): string | null => regras.find((r) => r.procedimento === nome)?.id ?? null;

/** Tudo o que o motor precisa saber antes de formatar as tabelas do corpo. `regras` são só as aplicáveis. */
export function contextoVisuais(corpo: readonly Secao[], regras: readonly RegraNormativa[], perfil: Perfil, pagina: PaginaResolvida): ContextoVisuais {
  const rnRotulo = procedimento(regras, 'rotuloDeElemento');
  const separador = perfil.parametros['separadorTitulo']?.valor;
  const rnEspaco = regras.filter((r) => r.parametros?.includes('espacoElementoPt')).map((r) => r.id);
  const espaco = perfil.parametros['espacoElementoPt']?.valor;
  const numeracao = numerarElementos(corpo);
  return {
    numeros: new Map(numeracao.elementos.map((e) => [e.bloco.id, { sequencia: e.sequencia, numero: e.numero }])),
    equacoes: new Map(numeracao.equacoes.map((e) => [e.bloco.id, e.numero])),
    rn: {
      numeracao: procedimento(regras, 'numeracaoDeElementos'),
      rotulo: rnRotulo,
      ordemRodape: procedimento(regras, 'ordemDoRodape'),
      chamada: procedimento(regras, 'chamadaDeNotaEspecifica'),
      tresTracos: procedimento(regras, 'tresTracosHorizontais'),
      semVerticais: procedimento(regras, 'semTracosVerticaisInternos'),
      semEntreLinhas: procedimento(regras, 'semTracosEntreLinhas'),
      semLaterais: procedimento(regras, 'semTracosLaterais'),
      quadroFechado: procedimento(regras, 'molduraFechada'),
      cabecalho: procedimento(regras, 'repetirCabecalho'),
      espaco: rnEspaco,
      imagem: regras.filter((r) => r.alvo === 'ilustracao.imagem').map((r) => r.id),
      equacaoDestacada: procedimento(regras, 'equacaoDestacada'),
      numeroEquacao: procedimento(regras, 'numeroDaEquacao'),
    },
    // Sem a regra, só um espaço entre o rótulo e o título.
    separador: rnRotulo !== null && typeof separador === 'string' ? separador : ' ',
    espacoDepoisTw: rnEspaco.length > 0 && typeof espaco === 'number' ? Math.round(espaco * 20) : null,
    larguraTw: Math.max(0, pagina.larguraTw - pagina.margemEsquerdaTw - pagina.margemDireitaTw),
  };
}

const deInline = (c: readonly InlineDeTitulo[]): TrechoFormatado[] => c.map((i) => ({ tipo: 'texto', texto: i.texto, marcas: i.marcas ?? [] }));
const texto = (t: string): TrechoFormatado => ({ tipo: 'texto', texto: t, marcas: [] });
const so = (...rn: (string | null)[]): string[] => rn.filter((x): x is string => x !== null);

function tracos(b: BlocoTabela, c: ContextoVisuais): { tracos: TracosMoldura; origem: string[] } {
  if (b.especie === 'quadro') {
    const f = c.rn.quadroFechado !== null;
    return {
      tracos: { superior: f, inferior: f, esquerda: f, direita: f, entreLinhas: f, entreColunas: f, abaixoDoCabecalho: false },
      origem: so(c.rn.quadroFechado),
    };
  }
  const tres = c.rn.tresTracos !== null;
  return {
    tracos: { superior: tres, inferior: tres, esquerda: false, direita: false, entreLinhas: false, entreColunas: false, abaixoDoCabecalho: tres && b.linhasCabecalho > 0 },
    origem: so(c.rn.tresTracos, c.rn.semVerticais, c.rn.semEntreLinhas, c.rn.semLaterais),
  };
}

/**
 * Rodapé do elemento: Fonte → Nota → notas específicas (RN-277), chamada entre parênteses (RN-267); uma linha depois do
 * último parágrafo (RN-031, RN-308). Sem rodapé, um parágrafo vazio com esse espaço.
 */
function rodapeFormatado(b: BlocoTabela | BlocoIlustracao | BlocoGrafico, c: ContextoVisuais): BlocoFormatado[] {
  const rodape: BlocoFormatado[] = rodapeDoElemento(b).map((p): BlocoFormatado => {
    const prefixo = p.parte === 'notaEspecifica' ? `(${p.chamada}) ` : `${p.prefixo} `;
    const origem = p.parte === 'notaEspecifica' ? so(c.rn.ordemRodape, c.rn.chamada) : so(c.rn.ordemRodape);
    return { tipo: 'paragrafo', estilo: 'rodapeElemento', trechos: [texto(prefixo), ...deInline(p.conteudo)], origem };
  });
  if (rodape.length === 0) rodape.push({ tipo: 'paragrafo', estilo: 'rodapeElemento', trechos: [], origem: [] });
  if (c.espacoDepoisTw !== null) {
    const ultimo = rodape.at(-1)! as Extract<BlocoFormatado, { tipo: 'paragrafo' }>;
    rodape[rodape.length - 1] = { ...ultimo, depoisTw: c.espacoDepoisTw, origem: [...new Set([...ultimo.origem, ...c.rn.espaco])] };
  }

  return rodape;
}

/** Título, tabela e rodapé, nessa ordem (RN-242: topo, centro e rodapé). */
export function blocosTabela(b: BlocoTabela, c: ContextoVisuais): BlocoFormatado[] {
  const n = c.numeros.get(b.id);
  const titulo = c.rn.numeracao !== null && n !== undefined ? tituloComRotulo(rotuloElemento(n.sequencia, n.numero), b.titulo, c.separador) : b.titulo;
  const moldura = tracos(b, c);
  const repetir = c.rn.cabecalho !== null && b.linhasCabecalho > 0;

  const linhas: CelulaFormatada[][] = b.linhas.map(() => []);
  for (const { linha, coluna, celula } of celulasComColuna(b)) {
    linhas[linha]!.push({
      trechos: deInline(celula.conteudo),
      alinhamento: ALINHAMENTO[b.colunas[coluna]?.alinhamento ?? 'esquerda'],
      colunas: celula.colunas ?? 1,
      linhas: celula.linhas ?? 1,
    });
  }

  const rodape = rodapeFormatado(b, c);

  return [
    { tipo: 'paragrafo', estilo: 'tituloElemento', trechos: deInline(titulo), origem: so(c.rn.numeracao, c.rn.rotulo) },
    {
      tipo: 'tabela',
      estilo: 'celulaTabela',
      larguraTw: c.larguraTw,
      colunas: b.colunas.length,
      linhasCabecalho: b.linhasCabecalho,
      repetirCabecalho: repetir,
      tracos: moldura.tracos,
      linhas,
      origem: [...moldura.origem, ...so(repetir ? c.rn.cabecalho : null)],
    },
    ...rodape,
  ];
}

/** 1 px a 96 ppi = 15 twips; a imagem vai em pixels para o DOCX, mas o tamanho é decidido aqui, em twips. */
const MM_EM_TW = 1440 / 25.4;

/**
 * Título, imagem e rodapé da ilustração (M5-T06; RN-052, RN-059, D-M5-09). A largura é a do autor ou a natural, limitada
 * à área útil; a altura segue a proporção da imagem. Sem os bytes (ou com cabeçalho ilegível), sai sem a imagem.
 */
export function blocosIlustracao(b: BlocoIlustracao, c: ContextoVisuais, bytes: Uint8Array | undefined): { blocos: BlocoFormatado[]; ausente: boolean } {
  const n = c.numeros.get(b.id);
  const titulo = c.rn.numeracao !== null && n !== undefined ? tituloComRotulo(rotuloElemento(n.sequencia, n.numero), b.titulo, c.separador) : b.titulo;
  const info = bytes ? lerInfoImagem(bytes) : null;
  const blocos: BlocoFormatado[] = [{ tipo: 'paragrafo', estilo: 'tituloElemento', trechos: deInline(titulo), origem: so(c.rn.numeracao, c.rn.rotulo) }];
  if (bytes && info) {
    const larguraMm = larguraImpressaMm(info, b.larguraMm, (c.larguraTw * 25.4) / 1440);
    const larguraTw = Math.round(larguraMm * MM_EM_TW);
    blocos.push({
      tipo: 'imagem',
      estilo: 'imagemElemento',
      dados: bytes,
      formato: info.tipo === 'image/png' ? 'png' : 'jpg',
      larguraTw,
      alturaTw: Math.round((larguraTw * info.alturaPx) / info.larguraPx),
      descricao: titulo.map((i) => i.texto).join(''),
      origem: c.rn.imagem,
    });
  }
  blocos.push(...rodapeFormatado(b, c));
  return { blocos, ausente: !(bytes && info) };
}

/**
 * Gráfico gerado de tabela (M5-T09; D-M5-08): como a ilustração, título, imagem e rodapé. O PNG é desenhado pela interface
 * (canvas) e chega pronto, pelo id do bloco; o tamanho impresso é o do domínio (`tamanhoGraficoMm`), e a altura segue a
 * proporção do PNG. Sem o PNG (ou ilegível), sai sem a imagem.
 */
export function blocosGrafico(b: BlocoGrafico, c: ContextoVisuais, png: Uint8Array | undefined): { blocos: BlocoFormatado[]; ausente: boolean } {
  const n = c.numeros.get(b.id);
  const titulo = c.rn.numeracao !== null && n !== undefined ? tituloComRotulo(rotuloElemento(n.sequencia, n.numero), b.titulo, c.separador) : b.titulo;
  const info = png ? lerInfoImagem(png) : null;
  const blocos: BlocoFormatado[] = [{ tipo: 'paragrafo', estilo: 'tituloElemento', trechos: deInline(titulo), origem: so(c.rn.numeracao, c.rn.rotulo) }];
  if (png && info && info.tipo === 'image/png') {
    const larguraTw = Math.round(tamanhoGraficoMm(b, (c.larguraTw * 25.4) / 1440).larguraMm * MM_EM_TW);
    blocos.push({
      tipo: 'imagem',
      estilo: 'imagemElemento',
      dados: png,
      formato: 'png',
      larguraTw,
      alturaTw: Math.round((larguraTw * info.alturaPx) / info.larguraPx),
      descricao: titulo.map((i) => i.texto).join(''),
      origem: c.rn.imagem,
    });
  }
  blocos.push(...rodapeFormatado(b, c));
  return { blocos, ausente: !(png && info && info.tipo === 'image/png') };
}

/**
 * Equação (M5-T07): o texto num parágrafo só dela (RN-105); numerada, "	(n)" com a parada à direita na largura útil
 * (RN-106). Sem a RN-106 no perfil, sai sem número; sem a RN-105, como parágrafo do corpo.
 */
export function blocosEquacao(b: BlocoEquacao, c: ContextoVisuais): BlocoFormatado[] {
  const n = c.rn.numeroEquacao !== null ? c.equacoes.get(b.id) : undefined;
  return [
    {
      tipo: 'paragrafo',
      estilo: c.rn.equacaoDestacada !== null ? 'equacao' : 'corpo',
      trechos: [...deInline(b.conteudo), ...(n !== undefined ? [texto(`	${rotuloEquacao(n)}`)] : [])],
      ...(n !== undefined ? { tabulacaoDireitaTw: c.larguraTw } : {}),
      origem: so(c.rn.equacaoDestacada, n !== undefined ? c.rn.numeroEquacao : null),
    },
  ];
}
