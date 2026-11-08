/**
 * Remissivas (M5-T08; RF-11): o que pode ser alvo e o texto de cada uma, derivado da numeração a cada vez (nunca gravado).
 *
 * - Alvos: toda tabela, quadro, ilustração e gráfico gerado (M5-T09) (cada palavra designativa com a sua contagem, RN-052, D-M5-07) e as equações
 *   numeradas (RN-106). Equação sem número não é alvo: a remissiva a ela fica quebrada.
 * - Texto: o rótulo, "Tabela 3", "Gráfico 1"; na equação, o número entre parênteses, "(2)", como se escreve "a equação
 *   (2)" (D-M5-42). O resto da frase é do autor.
 * - Remissiva quebrada (alvo que não existe ou equação sem número) não é erro de leitura: é pendência do verificador
 *   (ADR-0005, invariantes).
 */
import { conteudosDoBloco, secoesDaEntrada, textoPlano, type EntradaDeLeitura, type Id, type InlineRemissiva } from '../modelo';
import { numerarElementos, numerarSecoes, rotuloEquacao, rotulosPosTextuais } from '../numeracao';
import { rotuloElemento } from './rotulos';

export interface AlvoRemissiva {
  id: Id;
  /** Seção onde o elemento está. */
  secao: Id;
  tipo: 'tabela' | 'ilustracao' | 'grafico' | 'equacao' | 'secao' | 'apendice' | 'anexo';
  /** Texto da remissiva: "Tabela 3", "(2)". */
  rotulo: string;
  /** Para escolher o alvo: "Tabela 3 – Título", "Equação (2) – E = mc2". */
  descricao: string;
}

/** Os alvos possíveis, na ordem do documento. */
export function alvosDeRemissiva(entrada: EntradaDeLeitura): AlvoRemissiva[] {
  const corpo = secoesDaEntrada(entrada);
  const { elementos, equacoes } = numerarElementos(entrada);
  const porId = new Map<Id, AlvoRemissiva>();
  if ('corpo' in entrada) {
    for (const n of numerarSecoes(entrada.corpo)) {
      const titulo = textoPlano(n.secao.titulo);
      porId.set(n.secao.id, { id: n.secao.id, secao: n.secao.id, tipo: 'secao', rotulo: n.alemDoLimite ? titulo : n.indicativo, descricao: `${n.alemDoLimite ? '' : `${n.indicativo} `}${titulo}` });
    }
    const rotulos = rotulosPosTextuais(entrada.posTextuais ?? []);
    for (const e of entrada.posTextuais ?? []) if (e.tipo === 'apendice' || e.tipo === 'anexo') {
      const rotulo = rotulos.get(e.id)!;
      porId.set(e.id, { id: e.id, secao: e.id, tipo: e.tipo, rotulo, descricao: e.titulo ? `${rotulo} – ${e.titulo}` : rotulo });
    }
  }
  for (const e of elementos) {
    const rotulo = rotuloElemento(e.sequencia, e.numero);
    const titulo = textoPlano(e.bloco.titulo);
    porId.set(e.bloco.id, { id: e.bloco.id, secao: e.secao, tipo: e.bloco.tipo, rotulo, descricao: titulo === '' ? rotulo : `${rotulo} – ${titulo}` });
  }
  for (const e of equacoes) {
    const rotulo = rotuloEquacao(e.numero);
    const texto = textoPlano(e.bloco.conteudo);
    porId.set(e.bloco.id, { id: e.bloco.id, secao: e.secao, tipo: 'equacao', rotulo, descricao: texto === '' ? `Equação ${rotulo}` : `Equação ${rotulo} – ${texto}` });
  }
  // Ordem de leitura com os dois tipos intercalados.
  const ordem: AlvoRemissiva[] = [];
  for (const { secao } of numerarSecoes(corpo)) {
    if (porId.has(secao.id)) ordem.push(porId.get(secao.id)!);
    for (const b of secao.blocos) if (porId.has(b.id)) ordem.push(porId.get(b.id)!);
  }
  return ordem;
}

export interface RemissivaNoTexto {
  remissiva: InlineRemissiva;
  /** Seção e bloco onde a remissiva está escrita. */
  secao: Id;
  bloco: Id;
}

/** As remissivas do texto corrido, na ordem de leitura. */
export function remissivasDoCorpo(entrada: EntradaDeLeitura): RemissivaNoTexto[] {
  const corpo = secoesDaEntrada(entrada);
  const lista: RemissivaNoTexto[] = [];
  for (const { secao } of numerarSecoes(corpo)) {
    for (const bloco of secao.blocos) {
      for (const conteudo of conteudosDoBloco(bloco)) {
        for (const i of conteudo) if (i.tipo === 'remissiva') lista.push({ remissiva: i, secao: secao.id, bloco: bloco.id });
      }
    }
  }
  return lista;
}

/** Texto de cada alvo pelo id (o que a remissiva mostra); alvo ausente = remissiva quebrada. */
export function rotulosDeRemissiva(corpo: EntradaDeLeitura): ReadonlyMap<Id, string> {
  return new Map(alvosDeRemissiva(corpo).map((a) => [a.id, a.rotulo]));
}

/** Texto da remissiva quebrada, no editor e no arquivo exportado, para o autor achar (D-M5-43). */
export const TEXTO_REMISSIVA_QUEBRADA = '[remissiva quebrada]';
