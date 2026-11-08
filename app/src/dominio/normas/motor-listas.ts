/** Listas de ilustrações e tabelas (M6-T01; Manual, p. 42–43; D-M6-01/02).
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
  e: Extract<ElementoPreTextual, { tipo: 'listaIlustracoes' | 'listaTabelas' }>,
  corpo: readonly Secao[],
  legendas: ReadonlyMap<string, Legenda>,
  regras: readonly RegraNormativa[],
  perfil: Perfil,
  larguraTw: number,
): BlocoFormatado[] {
  const tabelas = e.tipo === 'listaTabelas';
  const procedimento = tabelas ? 'listaDeTabelas' : 'listaDeIlustracoes';
  const rn = regras.filter((r) => r.procedimento === procedimento).map((r) => r.id);
  if (rn.length === 0) return [];
  const itens = numerarElementos(corpo).elementos.filter((n) => (n.sequencia === 'tabela') === tabelas);
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
    const entradas = itens.filter((i) => grupo === null ? !proprias.has(i.sequencia) : i.sequencia === grupo)
      .flatMap((i) => {
        const legenda = legendas.get(i.bloco.id);
        return legenda?.ancora ? [{ trechos: legenda.trechos, ancora: legenda.ancora }] : [];
      });
    // Lista opcional sem elementos não reserva uma folha vazia.
    if (entradas.length === 0) return [];
    const titulo = tabelas ? 'LISTA DE TABELAS' : grupo === null ? 'LISTA DE ILUSTRAÇÕES' : `LISTA DE ${PALAVRA_DESIGNATIVA[grupo].toLocaleUpperCase('pt-BR')}S`;
    const origem = [...rn, ...(!tabelas && separar ? [separar.id] : [])];
    return [
      { tipo: 'paragrafo', estilo: 'tituloSemIndicativo', trechos: [{ tipo: 'texto', texto: titulo, marcas: [] }], novaPagina: true, origem: ['RN-007', 'RN-045', 'RN-162', ...(tabelas ? ['RN-044', 'RN-163'] : [])] },
      { tipo: 'listaElementos', estilo: 'entradaLista', entradas, tabulacaoDireitaTw: larguraTw, origem },
    ];
  });
}
