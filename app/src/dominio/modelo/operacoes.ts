/**
 * Operações estruturais puras sobre a árvore de seções do corpo (M2-T03; ADR-0007, seção 1; RF-03).
 *
 * - Nenhuma operação altera a entrada: o caminho até a seção mexida é copiado e o resto é compartilhado. A seção
 *   passada a `inserirSecao` passa a pertencer à árvore (não a altere depois).
 * - Nada lança exceção: o resultado traz `ok: false` com `codigo` e `mensagem` pt-BR para a interface.
 * - Toda operação aceita devolve o seu `inverso`, que restaura o corpo anterior (desfazer/refazer, ADR-0005 §3).
 * - A seção leva junto as suas subseções e os seus blocos. O nível continua derivado da profundidade.
 * - Supõe ids únicos no corpo, como a leitura do arquivo garante (`dominio/esquemas`).
 *
 * Decisões (adendo do M2-T03 no ADR-0007):
 * - `destino.indice` conta as posições da lista de destino **sem** a seção que se move;
 * - recuar = virar a última subseção da seção anterior, com as suas subseções; promover = como no modo de tópicos do
 *   Word (decisão do usuário, 2026-10-17): a seção vira a irmã logo depois da mãe e as irmãs seguintes passam a ser
 *   subseções dela, de modo que a ordem do texto nunca muda;
 * - o limite de níveis recusa só o que leva a seção mais fundo do que a quinária e mais fundo do que ela já estava:
 *   um arquivo que já passa do limite pode ser corrigido promovendo seções;
 * - um inverso só pula os limites quando é o próprio objeto devolvido por uma operação aceita (registro interno, não
 *   um campo que o chamador possa montar); por isso o histórico guarda o inverso como recebeu, sem copiar.
 */
import type { Bloco, Id, Secao } from './tipos';

/**
 * Seções vão da primária à quinária: não se ultrapassa a quinária (RN-041; Manual UFT, p. 28, cap. 4). Acima dela o
 * assunto se divide em alíneas (RN-028; Manual UFT, p. 16, seção 2.5).
 */
export const NIVEL_MAXIMO_SECAO = 5;

/** Seções numa mesma lista: limite do formato v1 (`LIMITES_V1.secoesPorNivel` usa este valor). */
export const MAXIMO_SECOES_POR_NIVEL = 1_000;

/** Lugar na árvore: `paiId: null` é a lista de seções primárias. */
export interface DestinoSecao {
  paiId: Id | null;
  indice: number;
}

export type OperacaoSecao =
  | { tipo: 'inserir'; secao: Secao; destino: DestinoSecao }
  | { tipo: 'remover'; id: Id }
  | { tipo: 'mover'; id: Id; destino: DestinoSecao }
  | { tipo: 'recuar'; id: Id }
  | { tipo: 'promover'; id: Id };

/**
 * Inverso de promover: a seção volta a ser a última subseção da anterior e as suas `devolver` últimas subseções voltam
 * a ser irmãs logo depois dela. Só existe como inverso.
 */
export interface RebaixarSecao {
  tipo: 'rebaixar';
  id: Id;
  devolver: number;
}

export type InversoSecao = OperacaoSecao | RebaixarSecao;

export type CodigoRecusaSecao =
  | 'SECAO_INEXISTENTE'
  | 'DESTINO_INEXISTENTE'
  | 'POSICAO_INVALIDA'
  | 'DESTINO_DENTRO_DA_PROPRIA'
  | 'NIVEL_EXCEDIDO'
  | 'SECOES_DEMAIS'
  | 'SEM_SECAO_ANTERIOR'
  | 'JA_PRIMARIA'
  | 'ID_REPETIDO';

export type ResultadoOperacaoSecao =
  /** `mudou: false` (mover para o mesmo lugar): nada a desfazer nem a salvar. */
  | { ok: true; corpo: Secao[]; inverso: InversoSecao; mudou: boolean }
  | { ok: false; codigo: CodigoRecusaSecao; mensagem: string };

export const MENSAGENS_RECUSA_SECAO: Readonly<Record<CodigoRecusaSecao, string>> = {
  SECAO_INEXISTENTE: 'A seção não foi encontrada no trabalho.',
  DESTINO_INEXISTENTE: 'O lugar de destino não foi encontrado no trabalho.',
  POSICAO_INVALIDA: 'A posição de destino não existe.',
  DESTINO_DENTRO_DA_PROPRIA: 'Uma seção não pode ir para dentro dela mesma.',
  NIVEL_EXCEDIDO:
    'O Manual da UFT não permite seções além da quinária (cinco níveis). Para dividir mais o assunto, use alíneas.',
  SECOES_DEMAIS: `Um mesmo nível comporta no máximo ${MAXIMO_SECOES_POR_NIVEL} seções.`,
  SEM_SECAO_ANTERIOR: 'Não há seção anterior no mesmo nível para receber esta como subseção.',
  JA_PRIMARIA: 'A seção já é primária.',
  ID_REPETIDO: 'A seção inserida repete um identificador que já existe no trabalho.',
};

type Resultado = ResultadoOperacaoSecao;

function recusa(codigo: CodigoRecusaSecao): Resultado {
  return { ok: false, codigo, mensagem: MENSAGENS_RECUSA_SECAO[codigo] };
}

/** Inversos emitidos por operações aceitas: só eles pulam os limites ao serem aplicados. */
const inversosEmitidos = new WeakSet<InversoSecao>();

function aceito(corpo: Secao[], inverso: InversoSecao, mudou = true): Resultado {
  inversosEmitidos.add(inverso);
  return { ok: true, corpo, inverso, mudou };
}

/** Onde a seção está: posições (base 0) desde a lista primária, id do pai, índice na lista e nível (1 = primária). */
export interface LocalSecao {
  secao: Secao;
  caminho: readonly number[];
  paiId: Id | null;
  indice: number;
  nivel: number;
}

/** Busca iterativa (a árvore lida de arquivo pode ter até 64 níveis). */
export function localizarSecao(corpo: readonly Secao[], id: Id): LocalSecao | null {
  const pilha: { lista: readonly Secao[]; caminho: number[]; paiId: Id | null }[] = [{ lista: corpo, caminho: [], paiId: null }];
  for (let item = pilha.pop(); item !== undefined; item = pilha.pop()) {
    for (let i = 0; i < item.lista.length; i++) {
      const s = item.lista[i]!;
      const caminho = [...item.caminho, i];
      if (s.id === id) return { secao: s, caminho, paiId: item.paiId, indice: i, nivel: caminho.length };
      if (s.subsecoes.length > 0) pilha.push({ lista: s.subsecoes, caminho, paiId: s.id });
    }
  }
  return null;
}

/** Níveis ocupados pela seção e suas subseções (1 = sem subseções). */
export function alturaSecao(secao: Secao): number {
  let altura = 0;
  const pilha: { s: Secao; nivel: number }[] = [{ s: secao, nivel: 1 }];
  for (let item = pilha.pop(); item !== undefined; item = pilha.pop()) {
    if (item.nivel > altura) altura = item.nivel;
    for (const f of item.s.subsecoes) pilha.push({ s: f, nivel: item.nivel + 1 });
  }
  return altura;
}

/** Ids de seções e blocos; devolve quantos foram vistos (com repetição). */
function idsDaSecao(secao: Secao, ids: Set<Id>): number {
  let vistos = 0;
  const pilha: Secao[] = [secao];
  for (let s = pilha.pop(); s !== undefined; s = pilha.pop()) {
    ids.add(s.id);
    for (const b of s.blocos as readonly Bloco[]) ids.add(b.id);
    vistos += 1 + s.blocos.length;
    pilha.push(...s.subsecoes);
  }
  return vistos;
}

/** A lista que tem o dono em `caminhoDono` (vazio = lista primária). */
function listaEm(corpo: readonly Secao[], caminhoDono: readonly number[]): readonly Secao[] {
  let lista = corpo;
  for (const i of caminhoDono) lista = lista[i]!.subsecoes;
  return lista;
}

/** Troca a lista cujo dono está em `caminhoDono` pelo resultado de `f`, copiando só o caminho. */
function trocarLista(corpo: readonly Secao[], caminhoDono: readonly number[], f: (lista: readonly Secao[]) => Secao[]): Secao[] {
  const reconstruir = (lista: readonly Secao[], k: number): Secao[] => {
    if (k === caminhoDono.length) return f(lista);
    const copia = lista.slice();
    const s = copia[caminhoDono[k]!]!;
    copia[caminhoDono[k]!] = { ...s, subsecoes: reconstruir(s.subsecoes, k + 1) };
    return copia;
  };
  return reconstruir(corpo, 0);
}

/** Dono da lista de destino: caminho e nível que a seção ganha nela, ou `null` se o pai não existe. */
function donoDoDestino(corpo: readonly Secao[], paiId: Id | null): { caminho: readonly number[]; nivel: number } | null {
  if (paiId === null) return { caminho: [], nivel: 1 };
  const pai = localizarSecao(corpo, paiId);
  return pai === null ? null : { caminho: pai.caminho, nivel: pai.nivel + 1 };
}

function posicaoValida(indice: number, tamanho: number): boolean {
  return Number.isInteger(indice) && indice >= 0 && indice <= tamanho;
}

function inserirNaLista(lista: readonly Secao[], indice: number, ...secoes: Secao[]): Secao[] {
  return [...lista.slice(0, indice), ...secoes, ...lista.slice(indice)];
}

function retirarDaLista(lista: readonly Secao[], indice: number): Secao[] {
  return [...lista.slice(0, indice), ...lista.slice(indice + 1)];
}

/** Insere uma seção nova (com suas subseções e blocos) no destino. */
export function inserirSecao(corpo: readonly Secao[], secao: Secao, destino: DestinoSecao): Resultado {
  return inserir(corpo, secao, destino, false);
}

function inserir(corpo: readonly Secao[], secao: Secao, destino: DestinoSecao, restaurar: boolean): Resultado {
  const dono = donoDoDestino(corpo, destino.paiId);
  if (dono === null) return recusa('DESTINO_INEXISTENTE');
  const lista = listaEm(corpo, dono.caminho);
  if (!posicaoValida(destino.indice, lista.length)) return recusa('POSICAO_INVALIDA');
  if (!restaurar && dono.nivel + alturaSecao(secao) - 1 > NIVEL_MAXIMO_SECAO) return recusa('NIVEL_EXCEDIDO');
  if (!restaurar && lista.length >= MAXIMO_SECOES_POR_NIVEL) return recusa('SECOES_DEMAIS');
  const novos = new Set<Id>();
  const vistos = idsDaSecao(secao, novos);
  const existentes = new Set<Id>();
  for (const s of corpo) idsDaSecao(s, existentes);
  if (novos.size !== vistos || [...novos].some((id) => existentes.has(id))) return recusa('ID_REPETIDO');
  return aceito(
    trocarLista(corpo, dono.caminho, (l) => inserirNaLista(l, destino.indice, secao)),
    { tipo: 'remover', id: secao.id },
  );
}

/** Remove a seção e tudo o que está dentro dela. */
export function removerSecao(corpo: readonly Secao[], id: Id): Resultado {
  const local = localizarSecao(corpo, id);
  if (local === null) return recusa('SECAO_INEXISTENTE');
  return aceito(
    trocarLista(corpo, local.caminho.slice(0, -1), (l) => retirarDaLista(l, local.indice)),
    { tipo: 'inserir', secao: local.secao, destino: { paiId: local.paiId, indice: local.indice } },
  );
}

/**
 * Move a seção (com suas subseções) para o destino. `destino.indice` conta as posições da lista de destino sem a
 * seção movida; mover para o mesmo lugar é aceito com `mudou: false`.
 */
export function moverSecao(corpo: readonly Secao[], id: Id, destino: DestinoSecao): Resultado {
  return mover(corpo, id, destino, false);
}

function mover(corpo: readonly Secao[], id: Id, destino: DestinoSecao, restaurar: boolean): Resultado {
  const local = localizarSecao(corpo, id);
  if (local === null) return recusa('SECAO_INEXISTENTE');
  if (destino.paiId !== null) {
    if (destino.paiId === id || localizarSecao(local.secao.subsecoes, destino.paiId) !== null) {
      return recusa('DESTINO_DENTRO_DA_PROPRIA');
    }
  }
  const semEla = trocarLista(corpo, local.caminho.slice(0, -1), (l) => retirarDaLista(l, local.indice));
  const dono = donoDoDestino(semEla, destino.paiId);
  if (dono === null) return recusa('DESTINO_INEXISTENTE');
  const lista = listaEm(semEla, dono.caminho);
  if (!posicaoValida(destino.indice, lista.length)) return recusa('POSICAO_INVALIDA');
  const altura = alturaSecao(local.secao);
  const fundo = dono.nivel + altura - 1;
  if (!restaurar && fundo > NIVEL_MAXIMO_SECAO && fundo > local.nivel + altura - 1) return recusa('NIVEL_EXCEDIDO');
  if (!restaurar && lista.length >= MAXIMO_SECOES_POR_NIVEL) return recusa('SECOES_DEMAIS');
  const inverso: InversoSecao = { tipo: 'mover', id, destino: { paiId: local.paiId, indice: local.indice } };
  if (destino.paiId === local.paiId && destino.indice === local.indice) return aceito(corpo.slice(), inverso, false);
  return aceito(trocarLista(semEla, dono.caminho, (l) => inserirNaLista(l, destino.indice, local.secao)), inverso);
}

/** Recua um nível: a seção vira a última subseção da seção anterior no mesmo nível (ex.: 2 → 1.3). */
export function recuarSecao(corpo: readonly Secao[], id: Id): Resultado {
  const local = localizarSecao(corpo, id);
  if (local === null) return recusa('SECAO_INEXISTENTE');
  if (local.indice === 0) return recusa('SEM_SECAO_ANTERIOR');
  const anterior = listaEm(corpo, local.caminho.slice(0, -1))[local.indice - 1]!;
  return moverSecao(corpo, id, { paiId: anterior.id, indice: anterior.subsecoes.length });
}

/**
 * Promove um nível, como no modo de tópicos do Word: a seção vira a irmã logo depois da mãe e as irmãs que vinham
 * depois dela passam a ser as suas últimas subseções (ex.: em 2 [2.1, 2.2], promover 2.1 dá 3 [3.1 = antiga 2.2]).
 * A ordem do texto não muda e nenhuma seção desce de nível.
 */
export function promoverSecao(corpo: readonly Secao[], id: Id): Resultado {
  return promover(corpo, id, false);
}

function promover(corpo: readonly Secao[], id: Id, restaurar: boolean): Resultado {
  const local = localizarSecao(corpo, id);
  if (local === null) return recusa('SECAO_INEXISTENTE');
  if (local.paiId === null) return recusa('JA_PRIMARIA');
  const caminhoMae = local.caminho.slice(0, -1);
  const irmas = listaEm(corpo, caminhoMae);
  const seguintes = irmas.slice(local.indice + 1);
  const avo = listaEm(corpo, caminhoMae.slice(0, -1));
  if (!restaurar && (avo.length >= MAXIMO_SECOES_POR_NIVEL || local.secao.subsecoes.length + seguintes.length > MAXIMO_SECOES_POR_NIVEL)) {
    return recusa('SECOES_DEMAIS');
  }
  const promovida: Secao = { ...local.secao, subsecoes: [...local.secao.subsecoes, ...seguintes] };
  const indiceMae = caminhoMae[caminhoMae.length - 1]!;
  const novoCorpo = trocarLista(corpo, caminhoMae.slice(0, -1), (l) => {
    const copia = l.slice();
    copia[indiceMae] = { ...l[indiceMae]!, subsecoes: irmas.slice(0, local.indice) };
    return inserirNaLista(copia, indiceMae + 1, promovida);
  });
  return aceito(novoCorpo, { tipo: 'rebaixar', id, devolver: seguintes.length });
}

/** Inverso de promover (ver `RebaixarSecao`). */
function rebaixar(corpo: readonly Secao[], op: RebaixarSecao, restaurar: boolean): Resultado {
  const local = localizarSecao(corpo, op.id);
  if (local === null) return recusa('SECAO_INEXISTENTE');
  if (local.indice === 0) return recusa('SEM_SECAO_ANTERIOR');
  const subs = local.secao.subsecoes;
  if (!Number.isInteger(op.devolver) || op.devolver < 0 || op.devolver > subs.length) return recusa('POSICAO_INVALIDA');
  const anterior = listaEm(corpo, local.caminho.slice(0, -1))[local.indice - 1]!;
  const fica = subs.slice(0, subs.length - op.devolver);
  const devolvidas = subs.slice(subs.length - op.devolver);
  const rebaixada: Secao = { ...local.secao, subsecoes: fica };
  if (!restaurar) {
    const fundo = local.nivel + alturaSecao(rebaixada);
    if (fundo > NIVEL_MAXIMO_SECAO && fundo > local.nivel + alturaSecao(local.secao) - 1) return recusa('NIVEL_EXCEDIDO');
    if (anterior.subsecoes.length + 1 + devolvidas.length > MAXIMO_SECOES_POR_NIVEL) return recusa('SECOES_DEMAIS');
  }
  const novoCorpo = trocarLista(corpo, local.caminho.slice(0, -1), (l) => {
    const copia = retirarDaLista(l, local.indice);
    copia[local.indice - 1] = { ...anterior, subsecoes: [...anterior.subsecoes, rebaixada, ...devolvidas] };
    return copia;
  });
  return aceito(novoCorpo, { tipo: 'promover', id: op.id });
}

/**
 * Aplica uma operação descrita como dado, ou um inverso devolvido por uma operação aceita (desfazer e refazer).
 * Um inverso montado à mão passa pelos mesmos limites de uma operação nova.
 */
export function aplicarOperacaoSecao(corpo: readonly Secao[], op: InversoSecao): Resultado {
  const restaurar = inversosEmitidos.has(op);
  switch (op.tipo) {
    case 'inserir':
      return inserir(corpo, op.secao, op.destino, restaurar);
    case 'remover':
      return removerSecao(corpo, op.id);
    case 'mover':
      return mover(corpo, op.id, op.destino, restaurar);
    case 'recuar':
      return recuarSecao(corpo, op.id);
    case 'promover':
      return promover(corpo, op.id, restaurar);
    case 'rebaixar':
      return rebaixar(corpo, op, restaurar);
  }
}
