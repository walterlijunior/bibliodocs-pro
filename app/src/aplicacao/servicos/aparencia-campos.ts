/**
 * Aparência dos campos de texto corrido na tela (especificação revista, Etapa 2): Natureza do trabalho, Resumo, Abstract,
 * Agradecimentos, Dedicatória, Epígrafe, Errata e Ficha catalográfica mostram, ao digitar, o alinhamento, os recuos, o
 * itálico e a caixa alta do estilo que a exportação usa para cada um, no perfil do trabalho (UFT ou com o modelo aplicado).
 * Recuos vão em porcentagem da área útil da página, para a proporção da tela seguir a do papel. O texto gravado não muda.
 */
import type { ModeloEvento } from '../../dominio/modelo';
import { areaUtilMm, estilosDoPerfil, perfilComModelo } from '../../dominio/normas';
import { PERFIL_UFT_2022 } from '../perfil-padrao';

export type CampoTextoCorrido = 'natureza' | 'resumo' | 'abstract' | 'agradecimentos' | 'dedicatoria' | 'epigrafe' | 'errata' | 'fichaCatalografica';

export interface AparenciaCampo {
  alinhamento: 'esquerda' | 'direita' | 'centralizado' | 'justificado';
  /** Recuo da primeira linha, em % da área útil. */
  recuoPrimeiraLinhaPct: number;
  /** Recuo à esquerda, em % da área útil (natureza: começa no meio da área). */
  recuoEsquerdaPct: number;
  italico: boolean;
  maiusculas: boolean;
}

/** Estilo de cada campo (o mesmo de `dominio/normas/motor-elementos.ts`). */
const ESTILO_DO_CAMPO: Readonly<Record<CampoTextoCorrido, string>> = {
  natureza: 'naturezaTrabalho',
  resumo: 'resumo',
  abstract: 'resumo',
  agradecimentos: 'agradecimentos',
  dedicatoria: 'dedicatoria',
  epigrafe: 'corpo',
  errata: 'corpo',
  fichaCatalografica: 'fichaCatalografica',
};

const TW_POR_MM = 567 / 10;
const pct = (tw: number | undefined, areaTw: number): number => (tw === undefined || areaTw <= 0 ? 0 : Math.max(0, Math.min(70, Math.round((tw / areaTw) * 1000) / 10)));

export function aparenciaDosCampos(modelo?: ModeloEvento): Readonly<Record<CampoTextoCorrido, AparenciaCampo>> {
  const perfil = perfilComModelo(PERFIL_UFT_2022, modelo);
  const estilos = estilosDoPerfil(perfil);
  const areaTw = areaUtilMm(perfil) * TW_POR_MM;
  const r = {} as Record<CampoTextoCorrido, AparenciaCampo>;
  for (const [campo, id] of Object.entries(ESTILO_DO_CAMPO) as [CampoTextoCorrido, string][]) {
    const p = estilos.find((e) => e.id === id)?.propriedades;
    r[campo] = {
      alinhamento: p?.alinhamento ?? 'esquerda',
      recuoPrimeiraLinhaPct: pct(p?.recuoPrimeiraLinhaTw, areaTw),
      recuoEsquerdaPct: pct(p?.recuoEsquerdaTw, areaTw),
      italico: p?.italico === true,
      maiusculas: p?.maiusculas === true,
    };
  }
  return r;
}
