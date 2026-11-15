/** Listas de ilustrações, quadros e tabelas (M6-T01; Manual, p. 42–43; D-M6-01/02; lista de quadros: D-E3-11).
 * A ordem e os números vêm da mesma numeração das legendas; o texto é a própria legenda formatada.
 * A página pertence ao layout, por isso só a âncora chega ao exportador.
 */
import type { ElementoPreTextual, Secao } from '../modelo';
import { numerarElementos, type SequenciaElemento } from '../numeracao';
import { PALAVRA_DESIGNATIVA } from '../visuais/rotulos';
import type { BlocoFormatado } from './formatado';
import type { Perfil, RegraNormativa } from './perfil';

type Legenda = Extract<BlocoFormatado, { tipo: 'paragrafo' }>;

export function listasDeElementos(
  e: Extract<ElementoPreTextual, { tipo: 'listaIlustracoes' | 'listaQuadros' | 'listaTabelas' }>,
  corpo: readonly Secao[],
  legendas: ReadonlyMap<string, Legenda>,
  regras: readonly RegraNormativa[],
  perfil: Perfil,
  larguraTw: number,
  /** O trabalho tem a lista de quadros: os quadros não entram na lista de ilustrações. */
  opcoes: { quadrosProprios?: boolean } = {},
): BlocoFormatado[] {
  const tabelas = e.tipo === 'listaTabelas';
  const procedimento = tabelas ? 'listaDeTabelas' : 'listaDeIlustracoes';
  const rn = regras.filter((r) => r.procedimento === procedimento).map((r) => r.id);
  if (rn.length === 0) return [];
  const todos = numerarElementos(corpo).elementos;
  const entradasDe = (lista: typeof todos) =>
    lista.flatMap((i) => {
      const legenda = legendas.get(i.bloco.id);
      return legenda?.ancora ? [{ trechos: legenda.trechos, ancora: legenda.ancora }] : [];
    });
  const blocosDaLista = (entradas: ReturnType<typeof entradasDe>, titulo: string, origem: string[], ehTabelas: boolean): BlocoFormatado[] =>
    // Lista opcional sem elementos não reserva uma folha vazia.
    entradas.length === 0
      ? []
      : [
          { tipo: 'paragrafo', estilo: 'tituloSemIndicativo', trechos: [{ tipo: 'texto', texto: titulo, marcas: [] }], novaPagina: true, origem: ['RN-007', 'RN-045', 'RN-162', ...(ehTabelas ? ['RN-044', 'RN-163'] : [])] },
          { tipo: 'listaElementos', estilo: 'entradaLista', entradas, tabulacaoDireitaTw: larguraTw, origem },
        ];
  // Lista de quadros escolhida pelo autor (D-E3-11): os quadros saem dela, e não da lista de ilustrações.
  if (e.tipo === 'listaQuadros') {
    return blocosDaLista(entradasDe(todos.filter((n) => n.sequencia === 'quadro')), 'LISTA DE QUADROS', [...rn, ...regras.filter((r) => r.procedimento === 'listasPorEspecie').map((r) => r.id)], false);
  }
  const itens = todos.filter((n) => (n.sequencia === 'tabela') === tabelas && !(opcoes.quadrosProprios && n.sequencia === 'quadro'));
  const contagem = new Map<SequenciaElemento, number>();
  for (const i of itens) contagem.set(i.sequencia, (contagem.get(i.sequencia) ?? 0) + 1);
  const separar = regras.find((r) => r.procedimento === 'listasPorEspecie');
  const minimo = separar ? perfil.parametros['minimoListaPropria']?.valor : undefined;
  const proprias = !tabelas && !e.listaUnica && typeof minimo === 'number' && minimo > 0
    ? new Set([...contagem].filter(([, n]) => n >= minimo).map(([s]) => s))
    : new Set<SequenciaElemento>();
  // As espécies próprias seguem sua primeira ocorrência. As restantes mantêm a ordem na lista geral (D-M6-02).
  const grupos: (SequenciaElemento | null)[] = [null, ...proprias];
  return grupos.flatMap((grupo): BlocoFormatado[] => {
    const entradas = entradasDe(itens.filter((i) => grupo === null ? !proprias.has(i.sequencia) : i.sequencia === grupo));
    const titulo = tabelas ? 'LISTA DE TABELAS' : grupo === null ? 'LISTA DE ILUSTRAÇÕES' : `LISTA DE ${PALAVRA_DESIGNATIVA[grupo].toLocaleUpperCase('pt-BR')}S`;
    return blocosDaLista(entradas, titulo, [...rn, ...(!tabelas && separar ? [separar.id] : [])], tabelas);
  });
}
