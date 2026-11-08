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
 */
import { numerarElementos, type SequenciaElemento } from '../numeracao';
import { celulasComColuna, rodapeDoElemento, rotuloElemento, tituloComRotulo } from '../visuais';
import type { AlinhamentoColuna, BlocoTabela, Id, InlineDeTitulo, Secao } from '../modelo';
import type { BlocoFormatado, CelulaFormatada, PaginaResolvida, TracosMoldura, TrechoFormatado } from './formatado';
import type { Perfil, RegraNormativa } from './perfil';

export interface ContextoVisuais {
  numeros: ReadonlyMap<Id, { sequencia: SequenciaElemento; numero: number }>;
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
  return {
    numeros: new Map(numerarElementos(corpo).elementos.map((e) => [e.bloco.id, { sequencia: e.sequencia, numero: e.numero }])),
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

  const rodape = rodapeDoElemento(b).map((p): BlocoFormatado => {
    const prefixo = p.parte === 'notaEspecifica' ? `(${p.chamada}) ` : `${p.prefixo} `;
    const origem = p.parte === 'notaEspecifica' ? so(c.rn.ordemRodape, c.rn.chamada) : so(c.rn.ordemRodape);
    return { tipo: 'paragrafo', estilo: 'rodapeElemento', trechos: [texto(prefixo), ...deInline(p.conteudo)], origem };
  });
  if (rodape.length === 0) rodape.push({ tipo: 'paragrafo', estilo: 'rodapeElemento', trechos: [], origem: [] });
  if (c.espacoDepoisTw !== null) {
    const ultimo = rodape.at(-1)! as Extract<BlocoFormatado, { tipo: 'paragrafo' }>;
    rodape[rodape.length - 1] = { ...ultimo, depoisTw: c.espacoDepoisTw, origem: [...new Set([...ultimo.origem, ...c.rn.espaco])] };
  }

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
