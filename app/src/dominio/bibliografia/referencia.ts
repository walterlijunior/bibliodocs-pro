/**
 * Formatador de referência obra → trechos (M4-T02, M4-T04). Função pura: a mesma obra e as mesmas opções dão sempre
 * os mesmos trechos. O padrão de cada tipo está em `tipos-obra.ts`; os elementos comuns, em `elementos.ts`.
 */
import type { Obra, TipoObra } from '../modelo';
import type { OpcoesReferencia } from './elementos';
import { FORMATADORES } from './tipos-obra';
import { Montador, type AvisoReferencia, type ReferenciaFormatada } from './trechos';

export type { OpcoesReferencia } from './elementos';

/** Tipos com formatador pronto, para a interface listar o que é suportado. */
export function tiposComFormatador(): TipoObra[] {
  return Object.keys(FORMATADORES) as TipoObra[];
}

export function formatarReferencia(obra: Obra, opcoes: OpcoesReferencia = {}): ReferenciaFormatada {
  const m = new Montador();
  const avisos: AvisoReferencia[] = [];
  const formatador = FORMATADORES[obra.tipo] as (typeof FORMATADORES)[TipoObra] | undefined;
  if (!formatador) {
    // Tipo que chegue por arquivo de versão futura: aviso em vez de texto inventado (D-M4-06).
    avisos.push({ codigo: 'TIPO_SEM_FORMATADOR', rn: 'D-M4-06', mensagem: `O tipo "${String(obra.tipo)}" não tem formatador de referência.` });
    return { obra: obra.id, trechos: [], avisos };
  }
  formatador(obra, { m, avisos, opcoes });
  m.aparar();
  return { obra: obra.id, trechos: m.trechos, avisos };
}
