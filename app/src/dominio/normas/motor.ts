/**
 * Motor normativo (M3-T03; ADR-0005, seção 3): `Documento` + `Perfil` → `DocumentoFormatado`. Puro e determinístico. É o
 * único lugar que lê regras: nenhuma medida fica no código, e a conversão de unidades é a única conta aqui.
 *
 * Regra `AMBIGUA` sem parâmetro decidido e `PENDENTE-FONTE` não provisória não são aplicadas; saem em `regrasAguardando`.
 */
import { contextoDeChamadas, formatarChamada, formatarReferencia, ordenarReferencias, type TrechoReferencia } from '../bibliografia';
import { rotuloAlinea, numerarSecoes } from '../numeracao';
import { citacoesDoDocumento, secoesDeLeitura, type Bloco, type Documento, type ElementoPreTextual, type Id, type Inline, type InlineDeTitulo, type Metadados } from '../modelo';
import { blocosCapa, blocosFolhaRosto, blocosPosTextuais, blocosPreTextual } from './motor-elementos';
import { listasDeElementos } from './motor-listas';
import { blocosGlossario, blocosListaSiglas, blocosListaSimbolos } from './motor-catalogos';
import { blocosEquacao, blocosGrafico, blocosIlustracao, blocosTabela, contextoVisuais } from './motor-visuais';
import { rotulosDeRemissiva, TEXTO_REMISSIVA_QUEBRADA } from '../visuais';
import type {
  AvisoFormatacao,
  BlocoFormatado,
  DocumentoFormatado,
  EstiloResolvido,
  PaginaResolvida,
  PropriedadesEstilo,
  SecaoFormatada,
  TrechoFormatado,
} from './formatado';
import type { AlvoRegra, Perfil, PropriedadesFormatacao, RegraNormativa } from './perfil';

export interface AjustesProjeto {
  /** Uma das `opcoes` do parâmetro `fonte`. Outro valor é ignorado: o trabalho não sai com fonte fora da norma. */
  fonte?: string;
}

/** 1 cm = 567 twips, a convenção do Word e da matriz (RN-003: 709; RN-004: 2268; RN-017: 4536). */
const cmParaTw = (cm: number): number => Math.round(cm * 567);
const ptParaTw = (pt: number): number => Math.round(pt * 20);

type Chave = keyof PropriedadesEstilo;
type Saida = { [K in Chave]?: PropriedadesEstilo[K] };

/** Tradução de cada propriedade da norma para a do estilo. As de página não valem para estilos. */
function traduzir(p: PropriedadesFormatacao): Saida {
  const s: Saida = {};
  if (p.corpoPt !== undefined) s.corpoMeioPt = Math.round(p.corpoPt * 2);
  if (p.entrelinha !== undefined) s.linha = p.entrelinha === 'simples' ? 240 : 360;
  if (p.alinhamento !== undefined) s.alinhamento = p.alinhamento;
  if (p.recuoPrimeiraLinhaCm !== undefined) s.recuoPrimeiraLinhaTw = cmParaTw(p.recuoPrimeiraLinhaCm);
  if (p.recuoEsquerdaCm !== undefined) s.recuoEsquerdaTw = cmParaTw(p.recuoEsquerdaCm);
  if (p.negrito !== undefined) s.negrito = p.negrito;
  if (p.italico !== undefined) s.italico = p.italico;
  if (p.sublinhado !== undefined) s.sublinhado = p.sublinhado;
  if (p.maiusculas !== undefined) s.maiusculas = p.maiusculas;
  if (p.quebraPaginaAntes !== undefined) s.quebraPaginaAntes = p.quebraPaginaAntes;
  if (p.manterComProximo !== undefined) s.manterComProximo = p.manterComProximo;
  return s;
}

interface DefinicaoEstilo {
  id: string;
  nome: string;
  /** Do mais geral ao mais específico: o alvo seguinte vence. */
  alvos: readonly AlvoRegra[];
  /** Propriedades do alvo que este estilo não herda. */
  semHerdar?: readonly Chave[];
  nivelEstrutura?: number;
  numerado?: true;
  /** Lê de `parametros` o que a regra deixou como valor de perfil. */
  parametros?: (v: (chave: string) => unknown) => Saida;
}

const espacoTitulos = (v: (c: string) => unknown): Saida => {
  const pt = v('espacoTitulosPt');
  return typeof pt === 'number' ? { antesTw: ptParaTw(pt), depoisTw: ptParaTw(pt) } : {};
};
const recuoLista = (recuo: string, deslocamento: string) => (v: (c: string) => unknown): Saida => {
  const r = v(recuo);
  const d = v(deslocamento);
  return typeof r === 'number' && typeof d === 'number' ? { recuoEsquerdaTw: cmParaTw(r + d), deslocamentoTw: cmParaTw(d) } : {};
};
const titulo = (n: 1 | 2 | 3 | 4 | 5, ordem: string): DefinicaoEstilo => ({
  id: `titulo${n}`,
  nome: `Título ${n} – Seção ${ordem}`,
  alvos: ['documento', 'titulo', `titulo.nivel${n}`],
  nivelEstrutura: n - 1,
  numerado: true,
  parametros: espacoTitulos,
});

/** Do que o perfil fala, só o que vira estilo. O catálogo é fechado: um `id` novo é decisão de código, não de dados. */
const ESTILOS: readonly DefinicaoEstilo[] = [
  { id: 'corpo', nome: 'Corpo do texto', alvos: ['documento', 'corpo.paragrafo'] },
  titulo(1, 'primária'),
  titulo(2, 'secundária'),
  titulo(3, 'terciária'),
  titulo(4, 'quaternária'),
  titulo(5, 'quinária'),
  { id: 'tituloSemIndicativo', nome: 'Título sem indicativo', alvos: ['documento', 'titulo.semIndicativo'] },
  // Com nível de estrutura, para continuar no sumário quando o autor o atualizar no Word; os pré-textuais ficam fora dele.
  { id: 'tituloPosTextual', nome: 'Título pós-textual', alvos: ['documento', 'titulo.semIndicativo'], nivelEstrutura: 0 },
  {
    id: 'citacaoLonga',
    nome: 'Citação longa',
    alvos: ['documento', 'citacao.longa'],
    parametros: (v) => {
      const pt = v('espacoCitacaoLongaPt');
      return typeof pt === 'number' ? { antesTw: ptParaTw(pt), depoisTw: ptParaTw(pt) } : {};
    },
  },
  { id: 'textoNota', nome: 'Texto de nota', alvos: ['documento', 'nota.texto'] },
  {
    id: 'alinea',
    nome: 'Alínea',
    alvos: ['documento', 'corpo.paragrafo', 'alinea'],
    semHerdar: ['recuoPrimeiraLinhaTw'],
    parametros: recuoLista('recuoAlineaCm', 'deslocamentoAlineaCm'),
  },
  {
    id: 'subalinea',
    nome: 'Subalínea',
    alvos: ['documento', 'corpo.paragrafo', 'alinea', 'subalinea'],
    semHerdar: ['recuoPrimeiraLinhaTw'],
    parametros: recuoLista('recuoSubalineaCm', 'deslocamentoSubalineaCm'),
  },
  { id: 'naturezaTrabalho', nome: 'Natureza do trabalho', alvos: ['documento', 'folhaRosto.natureza'] },
  { id: 'agradecimentos', nome: 'Agradecimentos', alvos: ['documento', 'preTextual.agradecimentos'] },
  { id: 'dedicatoria', nome: 'Dedicatória', alvos: ['documento', 'preTextual.dedicatoria'] },
  { id: 'resumo', nome: 'Resumo', alvos: ['documento', 'preTextual.resumo'] },
  { id: 'capaInstituicao', nome: 'Capa – Instituição', alvos: ['documento', 'capa', 'capa.instituicao'] },
  { id: 'capaAutoria', nome: 'Capa – Autoria', alvos: ['documento', 'capa', 'capa.autoria'] },
  { id: 'capaTitulo', nome: 'Capa – Título', alvos: ['documento', 'capa', 'capa.titulo'] },
  { id: 'capaLocalAno', nome: 'Capa – Local e ano', alvos: ['documento', 'capa', 'capa.localAno'] },
  { id: 'rostoAutoria', nome: 'Folha de rosto – Autoria', alvos: ['documento', 'folhaRosto', 'folhaRosto.autoria'] },
  { id: 'rostoTitulo', nome: 'Folha de rosto – Título', alvos: ['documento', 'folhaRosto', 'folhaRosto.titulo'] },
  { id: 'rostoLocalAno', nome: 'Folha de rosto – Local e ano', alvos: ['documento', 'folhaRosto.localAno'] },
  { id: 'fichaCatalografica', nome: 'Ficha catalográfica', alvos: ['documento', 'fichaCatalografica'] },
  { id: 'aprovacaoIdentificacao', nome: 'Aprovação – Identificação', alvos: ['documento', 'folhaAprovacao.identificacao'] },
  { id: 'aprovacaoNatureza', nome: 'Aprovação – Natureza', alvos: ['documento', 'folhaAprovacao.natureza'] },
  { id: 'aprovacaoData', nome: 'Aprovação – Data', alvos: ['documento', 'folhaAprovacao.data'] },
  { id: 'aprovacaoBanca', nome: 'Aprovação – Banca', alvos: ['documento', 'folhaAprovacao.banca'] },
  { id: 'entradaSumario', nome: 'Entrada do sumário', alvos: ['documento', 'sumario.entrada'] },
  // Revisão do M6 (N-M6-09): o glossário segue o corpo, sem o recuo de primeira linha, como o exemplo da p. 64 de onde
  // veio a forma "Termo: definição" (D-M6-06, provisória).
  { id: 'entradaGlossario', nome: 'Entrada de glossário', alvos: ['documento', 'corpo.paragrafo'], semHerdar: ['recuoPrimeiraLinhaTw'] },
  { id: 'entradaLista', nome: 'Entrada de lista de ilustrações ou tabelas', alvos: ['documento', 'lista.entrada'] },
  { id: 'identificacaoPosTextual', nome: 'Identificação de apêndice e anexo', alvos: ['documento', 'posTextual.identificacao'] },
  {
    id: 'referencia',
    nome: 'Referência',
    alvos: ['documento', 'referencia'],
    // RN-177: uma linha em branco em espaço simples entre as referências (N-M3-10).
    parametros: (v) => {
      const pt = v('espacoEntreReferenciasPt');
      return typeof pt === 'number' ? { depoisTw: ptParaTw(pt) } : {};
    },
  },
  { id: 'numeroPagina', nome: 'Número da página', alvos: ['documento', 'paginacao.numero'] },
  // M5-T03: tabela e quadro (e, no M5-T06, ilustração). Uma linha antes do título (RN-031, RN-308).
  {
    id: 'tituloElemento',
    nome: 'Título de tabela e ilustração',
    alvos: ['documento', 'elemento', 'elemento.titulo'],
    parametros: (v) => {
      const pt = v('espacoElementoPt');
      return typeof pt === 'number' ? { antesTw: ptParaTw(pt) } : {};
    },
  },
  { id: 'rodapeElemento', nome: 'Fonte e nota de tabela e ilustração', alvos: ['documento', 'elemento', 'elemento.rodape'] },
  // M5-T06: o parágrafo da imagem não herda entrelinha nem recuo do texto: com 1,5 o Word aumenta a linha da imagem
  // (D-M5-34); o alinhamento vem da RN-059.
  {
    id: 'imagemElemento',
    nome: 'Imagem de ilustração',
    alvos: ['documento', 'elemento', 'ilustracao.imagem'],
    semHerdar: ['linha', 'recuoPrimeiraLinhaTw', 'antesTw', 'depoisTw'],
  },
  // M5-T07: equação em parágrafo próprio (RN-105), sem o recuo de primeira linha do texto e alinhada pelo parâmetro da
  // RN-108 (D-M5-05: margem esquerda). Mantém a entrelinha do corpo: com `lineRule=auto` o Word já aumenta a linha que
  // tem expoente ou índice, o que a RN-107 permite.
  {
    id: 'equacao',
    nome: 'Equação',
    alvos: ['documento', 'corpo.paragrafo', 'equacao'],
    semHerdar: ['recuoPrimeiraLinhaTw'],
    parametros: (v) => {
      const a = v('alinhamentoEquacao');
      return a === 'esquerda' || a === 'centralizado' ? { alinhamento: a } : {};
    },
  },
  {
    id: 'celulaTabela',
    nome: 'Célula de tabela e quadro',
    alvos: ['documento', 'tabela.celula'],
    parametros: (v) => {
      const pt = v('corpoTabelaPt');
      return typeof pt === 'number' ? { corpoMeioPt: Math.round(pt * 2) } : {};
    },
  },
];

const regraAplicavel = (r: RegraNormativa, perfil: Perfil): boolean => {
  const decidida = (r.parametros ?? []).length > 0 && r.parametros!.every((c) => perfil.parametros[c]?.valor !== undefined);
  if (r.status === 'PENDENTE-FONTE') return r.provisoria === true && decidida;
  if (r.status === 'AMBIGUA') return decidida;
  return true;
};

function resolverEstilo(d: DefinicaoEstilo, regras: readonly RegraNormativa[], perfil: Perfil, ajustes: AjustesProjeto): EstiloResolvido {
  const propriedades: Record<string, unknown> = {};
  const origem: Record<string, readonly string[]> = {};
  const lidos = new Map<string, string[]>();
  for (const r of regras) for (const c of r.parametros ?? []) lidos.set(c, [...(lidos.get(c) ?? []), r.id]);

  for (const alvo of d.alvos) {
    const herdado = new Set<string>();
    for (const r of regras) {
      if (r.alvo !== alvo || !r.propriedades) continue;
      for (const [chave, valor] of Object.entries(traduzir(r.propriedades))) {
        if (d.semHerdar?.includes(chave as Chave)) continue;
        propriedades[chave] = valor;
        // Dentro do mesmo alvo, duas regras dando o mesmo valor somam origem; alvo mais específico substitui.
        origem[chave] = herdado.has(chave) ? [...(origem[chave] ?? []), r.id] : [r.id];
        herdado.add(chave);
      }
    }
  }

  if (lidos.has('fonte') && d.alvos.includes('documento')) {
    const p = perfil.parametros['fonte'];
    if (p) {
      const pedida = ajustes.fonte;
      propriedades['fonte'] = pedida !== undefined && p.opcoes?.includes(pedida) ? pedida : p.valor;
      origem['fonte'] = lidos.get('fonte')!;
    }
  }
  if (d.parametros) {
    const usados = new Set<string>();
    const ler = (c: string): unknown => {
      usados.add(c);
      return lidos.has(c) ? perfil.parametros[c]?.valor : undefined;
    };
    const saida = d.parametros(ler);
    const rn = [...usados].flatMap((c) => lidos.get(c) ?? []);
    for (const [chave, valor] of Object.entries(saida)) {
      propriedades[chave] = valor;
      origem[chave] = [...new Set(rn)];
    }
  }
  return {
    id: d.id,
    nome: d.nome,
    propriedades: propriedades as PropriedadesEstilo,
    origem,
    ...(d.nivelEstrutura !== undefined ? { nivelEstrutura: d.nivelEstrutura } : {}),
    ...(d.numerado ? { numerado: true as const } : {}),
  };
}

const temProcedimento = (regras: readonly RegraNormativa[], nome: string): string | null =>
  regras.find((r) => r.procedimento === nome)?.id ?? null;

const textoVazio = (c: readonly Inline[]): boolean => c.every((i) => i.tipo === 'texto' && i.texto.trim() === '');

/** Listas geradas dos pré-textuais, para o aviso de lista vazia (N-M6-15). */
const NOME_LISTA = {
  listaIlustracoes: 'A LISTA DE ILUSTRAÇÕES',
  listaTabelas: 'A LISTA DE TABELAS',
  listaSiglas: 'A LISTA DE ABREVIATURAS E SIGLAS',
  listaSimbolos: 'A LISTA DE SÍMBOLOS',
} as const;

export type DocumentoParaFormatar = Pick<Documento, 'corpo'> &
  Partial<Pick<Documento, 'metadados' | 'preTextuais' | 'posTextuais' | 'obras' | 'siglas' | 'simbolos' | 'glossario'>> & {
    /** Bytes das imagens das ilustrações, pelo sha256 (M5-T06). Sem a imagem, a ilustração sai sem ela, com aviso. */
    imagens?: ReadonlyMap<string, Uint8Array>;
    /** PNG de cada gráfico gerado, pelo id do bloco, desenhado pela interface (M5-T09). Sem ele, sai sem a imagem. */
    graficos?: ReadonlyMap<string, Uint8Array>;
  };

/** Largura da área útil da página do perfil, em mm (largura impressa máxima de uma ilustração, D-M5-09). */
export function areaUtilMm(perfil: Perfil): number {
  const p = paginaDe(perfil.regras.filter((r) => regraAplicavel(r, perfil)), perfil);
  return ((p.larguraTw - p.margemEsquerdaTw - p.margemDireitaTw) * 25.4) / 1440;
}

/** Trechos da bibliografia como runs: vizinhos com o mesmo destaque viram um só (a RN de cada um não vai para o DOCX). */
function deReferencia(t: readonly TrechoReferencia[]): TrechoFormatado[] {
  const saida: { tipo: 'texto'; texto: string; marcas: readonly TrechoReferencia['marcas'][number][] }[] = [];
  for (const x of t) {
    const ultimo = saida.at(-1);
    if (ultimo && ultimo.marcas.length === x.marcas.length && ultimo.marcas.every((m, i) => m === x.marcas[i])) ultimo.texto += x.texto;
    else saida.push({ tipo: 'texto', texto: x.texto, marcas: x.marcas });
  }
  return saida;
}

/** Papel em mm: 1 mm = 1440/25,4 twips, sem a aproximação de 567/cm (RN-018: 11906 × 16838). */
const mmParaTw = (mm: number): number => Math.round((mm * 1440) / 25.4);

function paginaDe(regras: readonly RegraNormativa[], perfil: Perfil): PaginaResolvida {
  const props: PropriedadesFormatacao = {};
  const origem: string[] = [];
  for (const r of regras) {
    if (r.alvo !== 'pagina' || !r.propriedades) continue;
    Object.assign(props, r.propriedades);
    origem.push(r.id);
  }
  const rnCabecalho = regras.find((r) => r.parametros?.includes('distanciaCabecalhoCm'));
  const cab = rnCabecalho ? perfil.parametros['distanciaCabecalhoCm']?.valor : undefined;
  return {
    larguraTw: mmParaTw(props.larguraMm ?? 0),
    alturaTw: mmParaTw(props.alturaMm ?? 0),
    margemSuperiorTw: cmParaTw(props.margemSuperiorCm ?? 0),
    margemInferiorTw: cmParaTw(props.margemInferiorCm ?? 0),
    margemEsquerdaTw: cmParaTw(props.margemEsquerdaCm ?? 0),
    margemDireitaTw: cmParaTw(props.margemDireitaCm ?? 0),
    cabecalhoTw: typeof cab === 'number' ? cmParaTw(cab) : 0,
    origem: rnCabecalho ? [...origem, rnCabecalho.id] : origem,
  };
}

/** A seção já começa em página nova: a primeira quebra pediria uma folha em branco à toa. */
function semQuebraNaPrimeira(blocos: readonly BlocoFormatado[]): BlocoFormatado[] {
  const [primeiro, ...resto] = blocos;
  if (primeiro?.tipo !== 'paragrafo' || !primeiro.novaPagina) return [...blocos];
  const { novaPagina: _n, ...sem } = primeiro;
  return [sem, ...resto];
}

/** Corpo do documento em blocos, com as notas numeradas em ordem de leitura, dentro das seções do trabalho. */
export function formatar(doc: DocumentoParaFormatar, perfil: Perfil, ajustes: AjustesProjeto = {}): DocumentoFormatado {
  const regras = perfil.regras.filter((r) => regraAplicavel(r, perfil));
  const regrasAguardando = perfil.regras.filter((r) => !regras.includes(r)).map((r) => r.id);
  const estilos = ESTILOS.map((d) => resolverEstilo(d, regras, perfil, ajustes));
  const avisos: AvisoFormatacao[] = [];
  const rnNumeracao = temProcedimento(regras, 'numeracaoProgressiva');
  const rnDestaque = temProcedimento(regras, 'indicativoComDestaqueDoTitulo');
  const rnAlinea = temProcedimento(regras, 'rotuloDeAlinea');
  const rnSubalinea = temProcedimento(regras, 'travessaoDeSubalinea');
  // D-M3-10: o sinal vem do perfil; sem ele, a subalínea sai sem marcador, como sem a regra.
  const marcador = perfil.parametros['marcadorSubalinea']?.valor;
  const marcadorSubalinea = rnSubalinea !== null && typeof marcador === 'string' && marcador !== '' ? marcador : null;
  const rnNotas = perfil.regras.filter((r) => r.alvo === 'nota.numeracao' && regras.includes(r)).map((r) => r.id);
  let proximaNota = 0;
  let proximaLista = 0;

  // Citações e referências (M4-T05). A lista sai das obras citadas, inclusive as do apud (RN-078), ou de todas as obras
  // se o autor pediu; sufixos a, b e chamadas vêm da mesma lista, para nunca divergirem.
  const rnChamada = temProcedimento(regras, 'chamadaAutorData');
  const rnAutoria = temProcedimento(regras, 'autoriaDaReferencia');
  const edicaoNbr10520 = rnChamada !== null && perfil.parametros['edicaoNbr10520']?.valor === '2023' ? '2023' : '2002';
  const listarTodosAutores = rnAutoria !== null && perfil.parametros['autoresReferencia']?.valor === 'todos';
  const citadas = new Set<Id>();
  for (const c of citacoesDoDocumento(doc)) {
    for (const o of c.obras) citadas.add(o.obra);
    if (c.apud) citadas.add(c.apud.obra);
  }
  const elementoReferencias = (doc.posTextuais ?? []).find((e) => e.tipo === 'referencias');
  const todasObras = doc.obras ?? [];
  const listadas = ordenarReferencias(elementoReferencias?.tipo === 'referencias' && elementoReferencias.incluirNaoCitadas ? todasObras : todasObras.filter((o) => citadas.has(o.id)), { listarTodosAutores });
  const contextoCitacoes = contextoDeChamadas(listadas);
  if (citadas.size > 0 && !elementoReferencias) {
    avisos.push({ codigo: 'REFERENCIAS_AUSENTES', id: doc.corpo[0]?.id ?? '', mensagem: 'Há citações no texto, mas o trabalho não tem o elemento REFERÊNCIAS (RN-078).' });
  }
  const blocosReferencias = (): BlocoFormatado[] => {
    if (listadas.length === 0) {
      avisos.push({ codigo: 'REFERENCIAS_VAZIAS', id: elementoReferencias?.id ?? '', mensagem: 'A lista de referências está vazia: nenhuma obra foi citada no texto.' });
      return [];
    }
    return listadas.map((o): BlocoFormatado => {
      const r = formatarReferencia(o, { listarTodosAutores, ...(contextoCitacoes.sufixos.has(o.id) ? { sufixoAno: contextoCitacoes.sufixos.get(o.id)! } : {}) });
      for (const a of r.avisos) avisos.push({ codigo: 'REFERENCIA_COM_AVISO', id: o.id, mensagem: `${a.mensagem} (${a.rn})` });
      return { tipo: 'paragrafo', estilo: 'referencia', trechos: deReferencia(r.trechos), origem: ['RN-176', 'RN-178', ...(rnAutoria !== null ? [rnAutoria] : [])] };
    });
  };

  // Remissivas (M5-T08): o texto vem da numeração, a cada exportação; como texto simples no DOCX (D-M5-44).
  const rotulosRemissiva = rotulosDeRemissiva(doc);
  const cadastroSiglas = new Map((doc.siglas ?? []).map((s) => [s.id, s]));
  const siglasUsadas = new Set<string>();
  const siglasPorExtenso = new Set<string>();
  const siglasPorExtensoNota = new Set<string>();
  let emNota = false;
  let emCitacaoLonga = false;
  const rnPrimeiraSigla = temProcedimento(regras, 'primeiraSiglaPorExtenso');
  const trechos = (conteudo: readonly Inline[]): TrechoFormatado[] =>
    conteudo.flatMap((i): TrechoFormatado[] => {
      if (i.tipo === 'texto') return [{ tipo: 'texto', texto: i.texto, marcas: i.marcas ?? [] }];
      if (i.tipo === 'sigla') {
        const s = cadastroSiglas.get(i.sigla);
        if (!s) {
          avisos.push({ codigo: 'SIGLA_QUEBRADA', id: i.id, mensagem: 'A sigla ligada no texto não está no cadastro (RN-046).' });
          return [{ tipo: 'texto', texto: '[sigla sem cadastro]', marcas: [] }];
        }
        // N-M6-02: a citação longa reproduz o original (Manual, p. 22, 3.1): a sigla sai como está e não gasta a primeira
        // ocorrência; continua contando como usada para a lista de siglas.
        if (emCitacaoLonga) {
          siglasUsadas.add(s.id);
          return [{ tipo: 'texto', texto: s.sigla, marcas: [] }];
        }
        // D-M6-11 (revisão do M6, N-M6-05): texto e notas contam à parte, para a forma por extenso aparecer no texto
        // corrido (Manual, p. 18: "na primeira vez em que aparecerem no texto") mesmo se a sigla surgiu antes numa nota.
        const ja = emNota ? siglasPorExtensoNota : siglasPorExtenso;
        const primeira = !ja.has(s.id);
        siglasUsadas.add(s.id);
        ja.add(s.id);
        // R-M6-09: tabulação ou quebra no cadastro não desalinham nem quebram o texto.
        const limpo = (t: string) => t.replace(/[\t\r\n]+/g, ' ');
        return [{ tipo: 'texto', texto: primeira && rnPrimeiraSigla !== null ? `${limpo(s.extenso)} (${limpo(s.sigla)})` : limpo(s.sigla), marcas: [] }];
      }
      if (i.tipo === 'remissiva') {
        const rotulo = rotulosRemissiva.get(i.alvo);
        // Quebrada: sai marcada, para o autor achar; quem avisa é o verificador (REMISSIVA_QUEBRADA), sem repetir aqui.
        if (rotulo !== undefined) return [{ tipo: 'texto', texto: rotulo, marcas: [] }];
        return [{ tipo: 'texto', texto: TEXTO_REMISSIVA_QUEBRADA, marcas: [] }];
      }
      // A chamada é gerada da obra a cada exportação (RF-07).
      if (i.tipo === 'citacao') {
        const c = formatarChamada(i, contextoCitacoes, { edicaoNbr10520 });
        for (const a of c.avisos) avisos.push({ codigo: 'CHAMADA_COM_AVISO', id: i.id, mensagem: `${a.mensagem} (${a.rn})` });
        return deReferencia(c.trechos);
      }
      // Nota vazia não vira `w:footnote` vazia nem conta na numeração (ADR-0007, B6): sai só com aviso.
      if (textoVazio(i.conteudo)) {
        avisos.push({ codigo: 'NOTA_VAZIA', id: i.id, mensagem: 'Nota de rodapé sem texto: não foi exportada.' });
        return [];
      }
      const numero = ++proximaNota;
      const antes = emNota;
      emNota = true;
      try {
        return [{ tipo: 'nota', numero, trechos: trechos(i.conteudo), estilo: 'textoNota', origem: rnNotas }];
      } finally {
        emNota = antes;
      }
    });
  // Em maiúsculas no próprio texto, além do estilo: o sumário do Word copia o texto, não a caixa do estilo (RN-010).
  const emMaiusculas = (estilo: string): boolean => estilos.find((e) => e.id === estilo)?.propriedades.maiusculas === true;
  const caixa = (estilo: string, texto: string): string => (emMaiusculas(estilo) ? texto.toLocaleUpperCase('pt-BR') : texto);
  const deTitulo = (conteudo: readonly InlineDeTitulo[], estilo: string): TrechoFormatado[] =>
    trechos(conteudo).map((t) => (t.tipo === 'texto' ? { ...t, texto: caixa(estilo, t.texto) } : t));
  const ancoras = new Map<string, string>();
  const ancoraDe = (id: string): string => {
    const atual = ancoras.get(id);
    if (atual) return atual;
    const nova = `_Toc_${ancoras.size + 1}`;
    ancoras.set(id, nova);
    return nova;
  };

  const pagina = paginaDe(regras, perfil);
  const leitura = secoesDeLeitura(doc);
  const visuais = contextoVisuais(leitura, regras, perfil, pagina);

  const converterBloco = (b: Bloco): BlocoFormatado[] => {
    switch (b.tipo) {
      case 'paragrafo':
        return [{ tipo: 'paragrafo', estilo: 'corpo', trechos: trechos(b.conteudo), origem: [] }];
      case 'citacaoLonga':
        if (textoVazio(b.conteudo)) avisos.push({ codigo: 'CITACAO_VAZIA', id: b.id, mensagem: 'Citação longa sem texto.' });
        emCitacaoLonga = true;
        try {
          return [{ tipo: 'paragrafo', estilo: 'citacaoLonga', trechos: trechos(b.conteudo), origem: [] }];
        } finally {
          emCitacaoLonga = false;
        }
      case 'quebraPagina':
        return [{ tipo: 'quebraPagina', origem: [] }];
      case 'tabela':
        return blocosTabela(b, visuais);
      case 'ilustracao': {
        const r = blocosIlustracao(b, visuais, doc.imagens?.get(b.midia));
        if (r.ausente) avisos.push({ codigo: 'IMAGEM_AUSENTE', id: b.id, mensagem: 'A imagem de uma ilustração não pôde ser lida e ficou de fora do arquivo exportado.' });
        return r.blocos;
      }
      case 'grafico': {
        const r = blocosGrafico(b, visuais, doc.graficos?.get(b.id));
        if (r.ausente) avisos.push({ codigo: 'GRAFICO_NAO_DESENHADO', id: b.id, mensagem: 'Um gráfico não pôde ser desenhado e saiu sem a imagem: confira a tabela de onde ele vem.' });
        return r.blocos;
      }
      case 'equacao':
        if (textoVazio(b.conteudo)) avisos.push({ codigo: 'EQUACAO_VAZIA', id: b.id, mensagem: 'Equação sem texto.' });
        return blocosEquacao(b, visuais);
      case 'alineas': {
        const lista = proximaLista++;
        return b.itens.flatMap((item, posicao): BlocoFormatado[] => {
          if (textoVazio(item.conteudo)) avisos.push({ codigo: 'ALINEA_VAZIA', id: b.id, mensagem: 'Alínea sem texto.' });
          return [
            {
              tipo: 'paragrafo',
              estilo: 'alinea',
              trechos: trechos(item.conteudo),
              lista: { lista, nivel: 0, rotulo: rnAlinea === null ? null : rotuloAlinea(posicao), posicao },
              origem: rnAlinea === null ? [] : [rnAlinea],
            },
            ...(item.subalineas ?? []).map((sub, s): BlocoFormatado => ({
              tipo: 'paragrafo',
              estilo: 'subalinea',
              trechos: trechos(sub),
              lista: { lista, nivel: 1, rotulo: marcadorSubalinea, posicao: s },
              origem: marcadorSubalinea === null ? [] : [rnSubalinea!],
            })),
          ];
        });
      }
    }
  };

  const legendas = new Map<string, Extract<BlocoFormatado, { tipo: 'paragrafo' }>>();
  const bloco = (b: Bloco): BlocoFormatado[] => {
    const saida = converterBloco(b);
    if ((b.tipo === 'tabela' || b.tipo === 'ilustracao' || b.tipo === 'grafico') && saida[0]?.tipo === 'paragrafo') {
      const legenda = { ...saida[0], ancora: `_Lista_${legendas.size + 1}` };
      legendas.set(b.id, legenda);
      saida[0] = legenda;
    }
    return saida;
  };
  const blocos = numerarSecoes(doc.corpo).flatMap((n): BlocoFormatado[] => {
    if (n.alemDoLimite) {
      avisos.push({ codigo: 'SECAO_ALEM_DO_LIMITE', id: n.secao.id, mensagem: `A seção ${n.indicativo} passa do quinto nível (RN-041) e saiu como quinária.` });
    }
    const nivel = Math.min(n.nivel, 5);
    return [
      {
        tipo: 'paragrafo',
        estilo: `titulo${nivel}`,
        trechos: deTitulo(n.secao.titulo, `titulo${nivel}`),
        ...(n.alemDoLimite ? {} : { ancora: ancoraDe(n.secao.id) }),
        ...(rnNumeracao !== null ? { indicativo: n.indicativo } : {}),
        origem: [rnNumeracao, rnDestaque].filter((x): x is string => x !== null),
      },
      ...n.secao.blocos.flatMap(bloco),
    ];
  });

  const gerarGlossario = () => {
    if (temProcedimento(regras, 'listaDeGlossario') === null) return [];
    if ((doc.glossario ?? []).length === 0) avisos.push({ codigo: 'LISTA_VAZIA', id: doc.posTextuais?.find((e) => e.tipo === 'glossario')?.id ?? '', mensagem: 'O GLOSSÁRIO está no trabalho, mas não tem termos: saiu só o título.' });
    if ((doc.glossario ?? []).length > 0) avisos.push({ codigo: 'FORMA_SEM_FONTE', id: doc.posTextuais?.find((e) => e.tipo === 'glossario')?.id ?? '', mensagem: 'A forma “Termo: definição” do glossário é provisória: exemplo do Manual, p. 64 (D-M6-06, PF-10).' });
    return blocosGlossario(doc.glossario ?? []);
  };
  const blocosPos = blocosPosTextuais(doc.posTextuais ?? [], avisos, blocosReferencias, gerarGlossario, (e) => (e.blocos ?? []).flatMap(bloco)).map((b, i): BlocoFormatado =>
    b.tipo === 'paragrafo' && b.estilo === 'tituloPosTextual' ? { ...b, ancora: ancoraDe(`pos:${i}`) } : b,
  );
  const titulosPos = blocosPos.flatMap((b) =>
    b.tipo === 'paragrafo' && b.estilo === 'tituloPosTextual' && b.ancora ? [{ ancora: b.ancora, texto: b.trechos.map((t) => (t.tipo === 'texto' ? t.texto : '')).join('') }] : [],
  );
  const entradas = (): BlocoFormatado => ({
    tipo: 'sumario',
    estilo: 'entradaSumario',
    entradas: numerarSecoes(doc.corpo)
      .filter((n) => !n.alemDoLimite) // RN-169: não passa da quinária
      .map((n) => ({
        nivel: n.nivel,
        indicativo: rnNumeracao === null ? '' : n.indicativo,
        texto: caixa(`titulo${n.nivel}`, n.secao.titulo.map((t) => t.texto).join('')),
        ancora: ancoraDe(n.secao.id),
      }))
      // Títulos sem indicativo depois do texto, como REFERÊNCIAS (RN-170 vale para os indicativos; a ordem é a do trabalho).
      .concat(titulosPos.map((t) => ({ nivel: 1, indicativo: '', texto: t.texto, ancora: t.ancora }))),
    origem: ['RN-169', 'RN-170', 'RN-171'],
  });
  const m: Metadados = doc.metadados ?? { titulo: [] };
  const pre: readonly ElementoPreTextual[] = doc.preTextuais ?? [];
  const tem = (t: ElementoPreTextual['tipo']) => pre.find((e) => e.tipo === t);
  const secoes: SecaoFormatada[] = [];
  const capa = tem('capa');
  if (capa) {
    // RN-118: o brasão é identidade visual da instituição; o arquivo ainda não existe no projeto.
    avisos.push({ codigo: 'BRASAO_AUSENTE', id: capa.id, mensagem: 'A capa saiu sem o brasão da UFT: o aplicativo ainda não tem o arquivo.' });
    const rn = temProcedimento(regras, 'distribuirCapa');
    secoes.push({ papel: 'capa', exibirNumero: false, ...(rn !== null ? { alinhamentoVertical: 'distribuido' as const } : {}), blocos: blocosCapa(m), origem: ['RN-067', ...(rn !== null ? [rn] : [])] });
  }
  if (tem('folhaRosto')) {
    // RN-314 (D-M3-11): só o desenho da Fig. 5 indica a distribuição; provisória, como a da capa.
    const rn = temProcedimento(regras, 'distribuirFolhaRosto');
    secoes.push({ papel: 'folhaRosto', exibirNumero: false, ...(rn !== null ? { alinhamentoVertical: 'distribuido' as const } : {}), blocos: blocosFolhaRosto(m), origem: ['RN-067', 'RN-068', ...(rn !== null ? [rn] : [])] });
  }
  const ficha = tem('fichaCatalografica');
  if (ficha) {
    const texto = ficha.tipo === 'fichaCatalografica' ? (ficha.texto ?? '') : '';
    if (texto.trim() === '') avisos.push({ codigo: 'FICHA_VAZIA', id: ficha.id, mensagem: 'Ficha catalográfica sem texto: a página foi reservada (RN-071).' });
    const dim = (c: string) => (typeof perfil.parametros[c]?.valor === 'number' ? cmParaTw(perfil.parametros[c]!.valor as number) : 0);
    secoes.push({
      papel: 'ficha',
      exibirNumero: false,
      alinhamentoVertical: 'inferior',
      blocos: [{ tipo: 'quadro', estilo: 'fichaCatalografica', larguraTw: dim('fichaLarguraCm'), alturaTw: dim('fichaAlturaCm'), trechos: texto === '' ? [] : [{ tipo: 'texto', texto, marcas: [] }], origem: ['RN-135', 'RN-136'] }],
      origem: ['RN-071', 'RN-135'],
    });
  }
  const meioDaAreaUtilTw = Math.round((pagina.alturaTw - pagina.margemSuperiorTw - pagina.margemInferiorTw) / 2) || null;
  // RN-315 (D-M3-12): rótulos de espanhol e francês só vêm do perfil, e saem com aviso de provisórios.
  const rnRotulos = temProcedimento(regras, 'rotuloPalavrasChaveEstrangeiro');
  const rotulos = perfil.parametros['rotulosPalavrasChave']?.valor as Partial<Record<'es' | 'fr', unknown>> | undefined;
  const rotulosPalavrasChave = {
    rn: rnRotulos,
    es: rnRotulos !== null && typeof rotulos?.es === 'string' ? rotulos.es : null,
    fr: rnRotulos !== null && typeof rotulos?.fr === 'string' ? rotulos.fr : null,
  };
  const blocosPre = pre.flatMap((e) => {
    const r = blocosPreTextual(e, m, {
      meioDaAreaUtilTw, avisos, entradas, rotulosPalavrasChave,
      listas: (elemento) => listasDeElementos(elemento, leitura, legendas, regras, perfil, visuais.larguraTw),
      siglas: () => temProcedimento(regras, 'listaDeSiglas') === null ? [] : blocosListaSiglas(doc.siglas ?? [], siglasUsadas, visuais.larguraTw),
      simbolos: () => temProcedimento(regras, 'listaDeSimbolos') === null ? [] : blocosListaSimbolos(doc.simbolos ?? [], visuais.larguraTw),
    });
    // N-M6-15, R-M6-09: lista incluída sem nenhum item não reserva folha, mas o autor fica sabendo.
    if (r.length === 0 && e.tipo in NOME_LISTA) avisos.push({ codigo: 'LISTA_VAZIA', id: e.id, mensagem: `${NOME_LISTA[e.tipo as keyof typeof NOME_LISTA]} está no trabalho, mas não tem itens e ficou de fora do arquivo.` });
    return r;
  });
  if (blocosPre.length > 0) secoes.push({ papel: 'preTextual', exibirNumero: false, blocos: semQuebraNaPrimeira(blocosPre), origem: ['RN-067', 'RN-068'] });
  secoes.push({ papel: 'textual', exibirNumero: true, blocos, origem: ['RN-068', 'RN-069'] });
  if (blocosPos.length > 0) secoes.push({ papel: 'posTextual', exibirNumero: true, blocos: semQuebraNaPrimeira(blocosPos), origem: ['RN-073'] });
  // RN-067: a capa não conta; a primeira folha depois dela é a 1, e as seguintes continuam.
  const primeira = secoes.find((x) => x.papel !== 'capa')!;
  secoes[secoes.indexOf(primeira)] = { ...primeira, reiniciarEm: 1 };

  const rnNotasFilete = regras.filter((r) => r.alvo === 'nota.filete').map((r) => r.id);
  const filete = perfil.parametros['fileteNotasCm']?.valor;
  return {
    perfil: { id: perfil.id, versao: perfil.versao },
    metadados: { titulo: m.titulo.map((t) => t.texto).join(''), autor: m.autoria ?? '' },
    estilos,
    pagina,
    notas: {
      numeracao: rnNotas.length > 0 ? String(perfil.parametros['numeracaoNotas']?.valor) : 'continua',
      fileteTw: rnNotasFilete.length > 0 && typeof filete === 'number' ? cmParaTw(filete) : null,
      origem: [...rnNotas, ...rnNotasFilete],
    },
    listas: { marcadorSubalinea },
    secoes,
    regrasAguardando,
    avisos,
  };
}
