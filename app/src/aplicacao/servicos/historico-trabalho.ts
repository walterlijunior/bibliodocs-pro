/**
 * Histórico do trabalho (Etapa 5 da especificação de atualização): pontos a que o autor pode voltar.
 *
 * Cada ponto guarda o **documento inteiro** daquele momento. O modelo nunca é alterado no lugar (cada mudança troca os
 * objetos do caminho), então guardar é guardar uma referência, sem cópia. Voltar a um ponto devolve junto o texto, as
 * citações ligadas, as obras e, por consequência, a lista de referências (que é derivada das citações).
 *
 * - Pontos entram antes das mudanças pertinentes (citação inserida ou retirada, obra incluída, importada ou excluída,
 *   seção excluída), ao salvar e antes de restaurar outro ponto (para poder voltar atrás da restauração).
 * - Só na memória, enquanto o trabalho está aberto; para estados de outros dias há as cópias de segurança.
 * - Limite de pontos: o mais antigo sai primeiro.
 *
 * Puro (sem DOM, sem Node).
 */
import { citacoesDoDocumento, conteudosDoBloco, type Bloco, type Documento, type Id, type InlineCitacao, type Obra } from '../../dominio/modelo';

export const LIMITE_PONTOS_HISTORICO = 100;

export interface PontoHistorico {
  id: number;
  /** ISO 8601. */
  em: string;
  descricao: string;
  /** Chamadas de citação no texto (também nas notas). */
  citacoes: number;
  /** Obras na lista de referências gerada. */
  referencias: number;
  /** Obras cadastradas no trabalho. */
  obras: number;
}

interface Ponto {
  id: number;
  em: string;
  descricao: string;
  documento: Documento;
}

/** Quantas citações e quantas obras na lista de referências (as citadas, ou todas com "incluir as não citadas"). */
export function resumoBibliografico(doc: Documento): { citacoes: number; referencias: number; obras: number } {
  const citacoes = citacoesDoDocumento(doc);
  const obras = doc.obras ?? [];
  const todas = doc.posTextuais?.some((e) => e.tipo === 'referencias' && e.incluirNaoCitadas === true) === true;
  const citadas = new Set<Id>();
  for (const c of citacoes) {
    for (const o of c.obras) citadas.add(o.obra);
    if (c.apud) citadas.add(c.apud.obra);
  }
  return { citacoes: citacoes.length, referencias: todas ? obras.length : obras.filter((o) => citadas.has(o.id)).length, obras: obras.length };
}

export class PontosDoHistorico {
  readonly #limite: number;
  #pontos: Ponto[] = [];
  #proximo = 1;

  constructor(limite = LIMITE_PONTOS_HISTORICO) {
    this.#limite = limite;
  }

  /**
   * Guarda o estado. O mesmo documento do último ponto não vira ponto novo: a descrição nova entra entre parênteses,
   * "Salvo (antes de retirar a citação de SILVA, 2007)", uma vez só.
   */
  registrar(descricao: string, documento: Documento, em: Date): void {
    const ultimo = this.#pontos.at(-1);
    if (ultimo?.documento === documento) {
      if (!ultimo.descricao.includes('(') && descricao.startsWith('Antes de ')) ultimo.descricao = `${ultimo.descricao} (${descricao.charAt(0).toLowerCase()}${descricao.slice(1)})`;
      return;
    }
    this.#pontos.push({ id: this.#proximo++, em: em.toISOString(), descricao, documento });
    if (this.#pontos.length > this.#limite) this.#pontos.shift();
  }

  /** Do mais novo ao mais antigo. */
  listar(): PontoHistorico[] {
    return [...this.#pontos].reverse().map((p) => ({ id: p.id, em: p.em, descricao: p.descricao, ...resumoBibliografico(p.documento) }));
  }

  documento(id: number): Documento | null {
    return this.#pontos.find((p) => p.id === id)?.documento ?? null;
  }

  limpar(): void {
    this.#pontos = [];
  }
}

/** As chamadas de citação dos blocos (também as das notas), pelo id. */
function citacoesDosBlocos(blocos: readonly Bloco[]): Map<Id, InlineCitacao> {
  const m = new Map<Id, InlineCitacao>();
  for (const b of blocos) {
    for (const c of conteudosDoBloco(b)) {
      for (const i of c) {
        if (i.tipo === 'citacao') m.set(i.id, i);
        else if (i.tipo === 'nota') for (const n of i.conteudo) if (n.tipo === 'citacao') m.set(n.id, n);
      }
    }
  }
  return m;
}

/**
 * Citações que entraram e que saíram de uma seção. Só os blocos que mudaram são lidos (os outros são o mesmo objeto
 * nas duas listas), então digitar num parágrafo grande não percorre a seção inteira.
 */
export function mudancasDeCitacao(antes: readonly Bloco[], depois: readonly Bloco[]): { inseridas: InlineCitacao[]; retiradas: InlineCitacao[] } {
  if (antes === depois) return { inseridas: [], retiradas: [] };
  const mesmos = new Set<Bloco>(antes);
  const ficaram = new Set<Bloco>();
  const novos: Bloco[] = [];
  for (const b of depois) {
    if (mesmos.has(b)) ficaram.add(b);
    else novos.push(b);
  }
  const velhos = antes.filter((b) => !ficaram.has(b));
  const a = citacoesDosBlocos(velhos);
  const d = citacoesDosBlocos(novos);
  return { inseridas: [...d.values()].filter((c) => !a.has(c.id)), retiradas: [...a.values()].filter((c) => !d.has(c.id)) };
}

/** "SILVA, 2007" (ou o começo do título, sem autoria) para descrever o ponto. */
export function rotuloCurtoObra(obra: Obra | undefined): string {
  if (!obra) return 'obra';
  const autor = obra.autores?.[0];
  const nome = autor === undefined ? obra.titulo.map((t) => t.texto).join('').slice(0, 40) : (autor.tipo === 'pessoa' ? autor.sobrenome : autor.nome).toLocaleUpperCase('pt-BR');
  return obra.ano !== undefined ? `${nome}, ${obra.ano}` : nome;
}

/** "a citação de SILVA, 2007" (várias obras: "a citação de SILVA, 2007; SOUZA, 2010"). */
export function descreverCitacao(c: InlineCitacao, obras: readonly Obra[]): string {
  const porId = new Map(obras.map((o) => [o.id, o]));
  return `a citação de ${c.obras.map((o) => rotuloCurtoObra(porId.get(o.obra))).join('; ')}`;
}
