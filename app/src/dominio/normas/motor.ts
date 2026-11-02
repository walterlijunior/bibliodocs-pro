/**
 * Motor normativo (M3-T03; ADR-0005, seção 3): `Documento` + `Perfil` → `DocumentoFormatado`. Puro e determinístico. É o
 * único lugar que lê regras: nenhuma medida fica no código, e a conversão de unidades é a única conta aqui.
 *
 * Regra `AMBIGUA` sem parâmetro decidido e `PENDENTE-FONTE` não provisória não são aplicadas; saem em `regrasAguardando`.
 */
import { rotuloAlinea, numerarSecoes } from '../numeracao';
import type { Bloco, Documento, Inline, InlineDeTitulo } from '../modelo';
import type {
  AvisoFormatacao,
  BlocoFormatado,
  DocumentoFormatado,
  EstiloResolvido,
  PropriedadesEstilo,
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
  { id: 'agradecimentos', nome: 'Agradecimentos e dedicatória', alvos: ['documento', 'preTextual.agradecimentos'] },
  { id: 'referencia', nome: 'Referência', alvos: ['documento', 'referencia'] },
  { id: 'numeroPagina', nome: 'Número da página', alvos: ['documento', 'paginacao.numero'] },
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
  };
}

const temProcedimento = (regras: readonly RegraNormativa[], nome: string): string | null =>
  regras.find((r) => r.procedimento === nome)?.id ?? null;

const textoVazio = (c: readonly Inline[]): boolean => c.every((i) => i.tipo === 'texto' && i.texto.trim() === '');

/** Corpo do documento em blocos, com as notas numeradas em ordem de leitura. Trata só o que tem RN aplicada. */
export function formatar(doc: Pick<Documento, 'corpo'>, perfil: Perfil, ajustes: AjustesProjeto = {}): DocumentoFormatado {
  const regras = perfil.regras.filter((r) => regraAplicavel(r, perfil));
  const regrasAguardando = perfil.regras.filter((r) => !regras.includes(r)).map((r) => r.id);
  const estilos = ESTILOS.map((d) => resolverEstilo(d, regras, perfil, ajustes));
  const avisos: AvisoFormatacao[] = [];
  const rnNumeracao = temProcedimento(regras, 'numeracaoProgressiva');
  const rnDestaque = temProcedimento(regras, 'indicativoComDestaqueDoTitulo');
  const rnAlinea = temProcedimento(regras, 'rotuloDeAlinea');
  const rnSubalinea = temProcedimento(regras, 'travessaoDeSubalinea');
  const rnNotas = perfil.regras.filter((r) => r.alvo === 'nota.numeracao' && regras.includes(r)).map((r) => r.id);
  let proximaNota = 0;
  let proximaLista = 0;

  const trechos = (conteudo: readonly Inline[]): TrechoFormatado[] =>
    conteudo.flatMap((i): TrechoFormatado[] => {
      if (i.tipo === 'texto') return [{ tipo: 'texto', texto: i.texto, marcas: i.marcas ?? [] }];
      // Nota vazia não vira `w:footnote` vazia nem conta na numeração (ADR-0007, B6): sai só com aviso.
      if (textoVazio(i.conteudo)) {
        avisos.push({ codigo: 'NOTA_VAZIA', id: i.id, mensagem: 'Nota de rodapé sem texto: não foi exportada.' });
        return [];
      }
      return [{ tipo: 'nota', numero: ++proximaNota, trechos: trechos(i.conteudo), estilo: 'textoNota', origem: rnNotas }];
    });
  const deTitulo = (conteudo: readonly InlineDeTitulo[]): TrechoFormatado[] => trechos(conteudo);

  const bloco = (b: Bloco): BlocoFormatado[] => {
    switch (b.tipo) {
      case 'paragrafo':
        return [{ tipo: 'paragrafo', estilo: 'corpo', trechos: trechos(b.conteudo), origem: [] }];
      case 'citacaoLonga':
        if (textoVazio(b.conteudo)) avisos.push({ codigo: 'CITACAO_VAZIA', id: b.id, mensagem: 'Citação longa sem texto.' });
        return [{ tipo: 'paragrafo', estilo: 'citacaoLonga', trechos: trechos(b.conteudo), origem: [] }];
      case 'quebraPagina':
        return [{ tipo: 'quebraPagina', origem: [] }];
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
              lista: { lista, nivel: 1, rotulo: rnSubalinea === null ? null : '–', posicao: s },
              origem: rnSubalinea === null ? [] : [rnSubalinea],
            })),
          ];
        });
      }
    }
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
        trechos: deTitulo(n.secao.titulo),
        ...(rnNumeracao !== null ? { indicativo: n.indicativo } : {}),
        origem: [rnNumeracao, rnDestaque].filter((x): x is string => x !== null),
      },
      ...n.secao.blocos.flatMap(bloco),
    ];
  });

  return { perfil: { id: perfil.id, versao: perfil.versao }, estilos, blocos, regrasAguardando, avisos };
}
