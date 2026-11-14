/**
 * Registro de atividades e cronograma (Etapa 6 da especificação de atualização). Puro.
 *
 * - Modelo pronto (D-E6-01): Data, Tipo (atividade ou reunião com o orientador), Atividade desenvolvida e
 *   Encaminhamentos. O autor renomeia, acrescenta e retira colunas conforme o pedido do orientador ou da banca.
 * - Separado do manuscrito: o registro fica em `Documento.registro` e o motor o ignora. Só entra no documento quando
 *   incorporado: vira um quadro (cópia do registro naquele momento) num apêndice, material elaborado pelo autor
 *   (D-E6-02). "Atualizar no trabalho" refaz a cópia; "Retirar do trabalho" a tira.
 * - "Exportar cronograma": um documento avulso, só com o quadro, que passa pelo mesmo exportador do trabalho.
 */
import type { BlocoTabela, ColunaRegistro, Documento, ElementoPosTextual, Id, LinhaRegistro, RegistroAtividades } from '../../dominio/modelo';
import { incluirPosTextual } from '../../dominio/modelo';

export const TITULO_PADRAO_REGISTRO = 'Registro de atividades e de orientação';
export const FONTE_PADRAO_REGISTRO = 'Elaborado pelo autor.';
export const TITULO_APENDICE_REGISTRO = 'Registro de atividades e de orientação';
export const NATUREZAS = ['Atividade', 'Reunião com o orientador'] as const;

export function registroPadrao(gerarId: (prefixo: string) => string): RegistroAtividades {
  const col = (titulo: string, tipo: ColunaRegistro['tipo']): ColunaRegistro => ({ id: gerarId('rcl'), titulo, tipo });
  return { colunas: [col('Data', 'data'), col('Tipo', 'natureza'), col('Atividade desenvolvida', 'texto'), col('Encaminhamentos', 'texto')], linhas: [] };
}

/** Linha nova com a data de hoje na primeira coluna de data e a natureza na primeira coluna de tipo. */
export function linhaNova(r: RegistroAtividades, id: Id, hoje: string, natureza: (typeof NATUREZAS)[number]): LinhaRegistro {
  let data = false;
  let tipo = false;
  return {
    id,
    valores: r.colunas.map((c) => {
      if (c.tipo === 'data' && !data) return (data = true), hoje;
      if (c.tipo === 'natureza' && !tipo) return (tipo = true), natureza;
      return '';
    }),
  };
}

/** "2026-11-14" → "14/11/2026"; outro texto fica como está. */
export function dataBr(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Linhas em ordem de data (sem data, no fim, na ordem em que foram escritas). */
export function ordenarPorData(r: RegistroAtividades): RegistroAtividades {
  const i = r.colunas.findIndex((c) => c.tipo === 'data');
  if (i < 0) return r;
  const chave = (l: LinhaRegistro) => l.valores[i] || '9999-99-99';
  return { ...r, linhas: [...r.linhas].sort((a, b) => (chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0)) };
}

/** O quadro do registro (cabeçalho com os títulos das colunas; datas em dd/mm/aaaa). */
export function quadroDoRegistro(r: RegistroAtividades, id: Id): BlocoTabela {
  const celula = (texto: string) => ({ conteudo: texto === '' ? [] : [{ tipo: 'texto' as const, texto }] });
  const linhas = r.linhas.length > 0 ? r.linhas : [{ id: 'vazia', valores: r.colunas.map(() => '') }];
  return {
    tipo: 'tabela',
    id,
    especie: 'quadro',
    titulo: [{ tipo: 'texto', texto: r.titulo ?? TITULO_PADRAO_REGISTRO }],
    colunas: r.colunas.map(() => ({ alinhamento: 'esquerda' as const })),
    linhasCabecalho: 1,
    linhas: [r.colunas.map((c) => celula(c.titulo)), ...linhas.map((l) => r.colunas.map((c, j) => celula(c.tipo === 'data' ? dataBr(l.valores[j] ?? '') : (l.valores[j] ?? ''))))],
    fonte: [{ tipo: 'texto', texto: r.fonte ?? FONTE_PADRAO_REGISTRO }],
  };
}

/** Documento avulso do cronograma: tipo genérico, uma seção com o quadro. `null` sem registro. */
export function documentoDoCronograma(doc: Documento): Documento | null {
  const r = doc.registro;
  if (!r) return null;
  const titulo = doc.metadados.titulo.map((t) => t.texto).join('').trim();
  const nome = `${r.titulo ?? TITULO_PADRAO_REGISTRO}${titulo ? ` – ${titulo}` : ''}`;
  return {
    id: doc.id,
    tipoTrabalho: 'generico',
    metadados: { titulo: [{ tipo: 'texto', texto: `Cronograma – ${titulo || 'trabalho sem título'}` }] },
    corpo: [{ id: 'sec_cronograma01', titulo: [{ tipo: 'texto', texto: nome }], blocos: [quadroDoRegistro(r, 'tab_cronograma01')], subsecoes: [] }],
  };
}

export type DestinoRegistro = { tipo: 'novoApendice' } | { tipo: 'apendice'; id: Id };

/** O apêndice e o quadro incorporados, se ainda existem no trabalho. */
export function incorporacaoAtual(doc: Documento): { apendice: Id; bloco: Id } | null {
  const em = doc.registro?.incorporadoEm;
  if (!em) return null;
  const ap = doc.posTextuais?.find((e) => e.id === em.apendice);
  if (!ap || ap.tipo !== 'apendice' || !(ap.blocos ?? []).some((b) => b.id === em.bloco)) return null;
  return { apendice: em.apendice, bloco: em.bloco };
}

/**
 * Pós-textuais com o quadro do registro no destino (no fim do apêndice escolhido, ou num apêndice novo depois dos
 * outros) e o registro com o lugar anotado. `null` = destino que não existe.
 */
export function incorporar(doc: Documento, destino: DestinoRegistro, ids: { apendice: Id; bloco: Id }): { posTextuais: ElementoPosTextual[]; registro: RegistroAtividades } | null {
  const r = doc.registro;
  if (!r) return null;
  const quadro = quadroDoRegistro(r, ids.bloco);
  let lista = [...(doc.posTextuais ?? [])];
  let apendice: Id;
  if (destino.tipo === 'novoApendice') {
    const nova = incluirPosTextual(lista, 'apendice', ids.apendice);
    if (nova === null) return null;
    lista = nova.map((e) => (e.id === ids.apendice && e.tipo === 'apendice' ? { ...e, titulo: TITULO_APENDICE_REGISTRO, blocos: [quadro] } : e));
    apendice = ids.apendice;
  } else {
    const alvo = lista.find((e) => e.id === destino.id);
    if (!alvo || alvo.tipo !== 'apendice') return null;
    lista = lista.map((e) => (e.id === destino.id && e.tipo === 'apendice' ? { ...e, blocos: [...(e.blocos ?? []), quadro] } : e));
    apendice = destino.id;
  }
  return { posTextuais: lista, registro: { ...r, incorporadoEm: { apendice, bloco: ids.bloco, ...(destino.tipo === 'novoApendice' ? { apendiceCriado: true as const } : {}) } } };
}

/** Refaz o quadro incorporado com o registro atual. `null` = não está incorporado. */
export function atualizarIncorporado(doc: Documento): ElementoPosTextual[] | null {
  const atual = incorporacaoAtual(doc);
  if (!atual || !doc.registro) return null;
  const quadro = quadroDoRegistro(doc.registro, atual.bloco);
  return (doc.posTextuais ?? []).map((e) => (e.id === atual.apendice && e.tipo === 'apendice' ? { ...e, blocos: (e.blocos ?? []).map((b) => (b.id === atual.bloco ? quadro : b)) } : e));
}

/** Tira o quadro; o apêndice criado para ele sai junto se ficou vazio. */
export function retirarIncorporado(doc: Documento): ElementoPosTextual[] | null {
  const atual = incorporacaoAtual(doc);
  if (!atual) return null;
  const criado = doc.registro?.incorporadoEm?.apendiceCriado === true;
  return (doc.posTextuais ?? []).flatMap((e): ElementoPosTextual[] => {
    if (e.id !== atual.apendice || e.tipo !== 'apendice') return [e];
    const blocos = (e.blocos ?? []).filter((b) => b.id !== atual.bloco);
    if (blocos.length === 0 && criado) return [];
    const { blocos: _b, ...resto } = e;
    return [{ ...resto, ...(blocos.length > 0 ? { blocos } : {}) }];
  });
}
