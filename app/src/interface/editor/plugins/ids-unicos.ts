/**
 * Ids únicos no documento do editor (M2-T05; ADR-0007, seção 2; adendo do M2-T04, R38). Um id repetido faz a leitura
 * do `.bdp` recusar o arquivo inteiro, então toda transação que muda o documento passa por aqui.
 *
 * Casos: o Enter divide o parágrafo e copia os `attrs`; colar e arrastar dentro do app copiam nós; um nó novo nasce com
 * `id: null`. Quem fica com o id antigo é o nó que já existia (a posição antiga dele, mapeada pela transação); os outros
 * recebem id novo. Assim, dividir um parágrafo mantém o id na parte que tem o começo do texto, e colar uma cópia antes do original não
 * tira o id do original (as remissivas do M6 apontam para ele).
 */
import type { Node as NoPm } from 'prosemirror-model';
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Mapping } from 'prosemirror-transform';
import { PREFIXO_ID } from '../esquema';
import { gerarId as gerarIdPadrao, PADRAO_ID_EDITOR, type GeradorId } from '../ids';

export const chaveIdsUnicos = new PluginKey('idsUnicos');

interface Ocorrencia {
  pos: number;
  no: NoPm;
}

/** Ocorrências de cada id (inválidos e nulos em `semId`), em ordem de leitura. */
function coletar(doc: NoPm): { porId: Map<string, Ocorrencia[]>; semId: Ocorrencia[] } {
  const porId = new Map<string, Ocorrencia[]>();
  const semId: Ocorrencia[] = [];
  doc.descendants((no, pos) => {
    if (!(no.type.name in PREFIXO_ID)) return true;
    const id: unknown = no.attrs['id'];
    if (typeof id === 'string' && PADRAO_ID_EDITOR.test(id)) {
      const lista = porId.get(id);
      if (lista) lista.push({ pos, no });
      else porId.set(id, [{ pos, no }]);
    } else {
      semId.push({ pos, no });
    }
    return true;
  });
  return { porId, semId };
}

function posicoesAntigas(doc: NoPm, ids: ReadonlySet<string>): Map<string, number> {
  const mapa = new Map<string, number>();
  doc.descendants((no, pos) => {
    const id: unknown = no.attrs['id'];
    if (typeof id === 'string' && ids.has(id) && !mapa.has(id)) mapa.set(id, pos);
    return true;
  });
  return mapa;
}

/**
 * Transação que dá id novo aos nós sem id válido e às cópias de id repetido, ou `null` se nada precisa mudar.
 * `anterior` e `mapeamento` dizem qual ocorrência já existia; sem eles, fica a primeira em ordem de leitura.
 */
export function corrigirIds(
  estado: EditorState,
  gerar: GeradorId = gerarIdPadrao,
  anterior?: { doc: NoPm; mapeamento: Mapping },
): Transaction | null {
  const { porId, semId } = coletar(estado.doc);
  const repetidos = [...porId].filter(([, lista]) => lista.length > 1);
  if (repetidos.length === 0 && semId.length === 0) return null;

  const antigas = anterior ? posicoesAntigas(anterior.doc, new Set(repetidos.map(([id]) => id))) : new Map<string, number>();
  const trocar: Ocorrencia[] = [...semId];
  for (const [id, lista] of repetidos) {
    // Mapeia o início do conteúdo (não o do nó): no Enter no começo do parágrafo, o id fica com a parte que tem o
    // texto, e não com o parágrafo vazio criado antes dela.
    const dentro = lista[0]!.no.isLeaf ? 0 : 1;
    const antiga = antigas.get(id);
    const mapeada = antiga === undefined || !anterior ? undefined : anterior.mapeamento.mapResult(antiga + dentro, 1);
    const fica = mapeada && !mapeada.deleted ? lista.find((o) => o.pos + dentro === mapeada.pos) : undefined;
    const mantida = fica ?? lista[0]!;
    for (const o of lista) if (o !== mantida) trocar.push(o);
  }

  const usados = new Set(porId.keys());
  const tr = estado.tr;
  for (const o of trocar) {
    let novo: string;
    do novo = gerar(PREFIXO_ID[o.no.type.name]!);
    while (usados.has(novo));
    usados.add(novo);
    tr.setNodeAttribute(o.pos, 'id', novo);
  }
  return tr;
}

/** Plugin que aplica `corrigirIds` depois de toda transação que muda o documento. */
export function pluginIdsUnicos(gerar: GeradorId = gerarIdPadrao): Plugin {
  return new Plugin({
    key: chaveIdsUnicos,
    appendTransaction(transacoes, velho, novo) {
      if (!transacoes.some((t) => t.docChanged)) return null;
      const mapeamento = new Mapping();
      for (const t of transacoes) mapeamento.appendMapping(t.mapping);
      return corrigirIds(novo, gerar, { doc: velho.doc, mapeamento });
    },
  });
}
