/**
 * Consumo de tokens da sessão do aplicativo (Etapa 8): cada envio ao serviço de IA, com o uso que o provedor informou
 * e os limites por minuto dos cabeçalhos. Fica fora dos componentes para sobreviver à troca de aba (aplicar uma
 * sugestão leva à aba Escrever). Só na memória: fechar o aplicativo zera a sessão; o uso do mês fica no principal.
 */
import { useSyncExternalStore } from 'react';
import type { LimitesInformados, UsoInformado } from '../../aplicacao';

export interface EnvioRegistrado {
  em: string;
  operacao: string;
  etapa: string;
  /** `null` = o provedor não informou. */
  uso: UsoInformado | null;
  estimativa: number;
}

interface Estado {
  envios: readonly EnvioRegistrado[];
  limites: LimitesInformados | null;
  usoMes: { mes: string; tokens: number } | null;
}

let estado: Estado = { envios: [], limites: null, usoMes: null };
const ouvintes = new Set<() => void>();

export const consumo = {
  registrar(envio: EnvioRegistrado, limites: LimitesInformados | null, usoMes: { mes: string; tokens: number }): void {
    estado = { envios: [...estado.envios, envio].slice(-200), limites: limites ?? estado.limites, usoMes };
    for (const o of ouvintes) o();
  },
  definirUsoMes(usoMes: { mes: string; tokens: number }): void {
    estado = { ...estado, usoMes };
    for (const o of ouvintes) o();
  },
  assinar(o: () => void): () => void {
    ouvintes.add(o);
    return () => ouvintes.delete(o);
  },
  ler: (): Estado => estado,
};

export const useConsumo = (): Estado => useSyncExternalStore(consumo.assinar, consumo.ler);
