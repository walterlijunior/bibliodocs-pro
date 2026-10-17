/**
 * Serviço `criarTrabalho` (ADR-0005, seção 3) — versão do M1-T09: trabalho vazio do tipo genérico. Os tipos UFT, com
 * seus elementos obrigatórios, entram no M2 com o perfil (RF-02).
 *
 * Puro: o id e a hora vêm de quem chama (o principal usa `randomBytes` e o relógio).
 */
import { IDENTIFICADOR_FORMATO, VERSAO_FORMATO_ATUAL, type Manifesto } from '../../dominio/esquemas';
import type { Documento } from '../../dominio/modelo';

/**
 * Perfil gravado nos trabalhos novos. [HIPÓTESE] a versão `1.0.0` fica até o perfil existir em dados (M3), quando
 * passa a vir de `perfis/uft-2022/`.
 */
export const PERFIL_PADRAO: Manifesto['perfil'] = { id: 'uft-2022', versao: '1.0.0' };

export interface DadosNovoTrabalho {
  /** Novo id do projeto (`PADRAO_ID`); vale para o manifesto e o documento. */
  id: string;
  /** Data e hora ISO 8601 com fuso. */
  agora: string;
  appVersao: string;
}

export interface TrabalhoNovo {
  manifesto: Manifesto;
  documento: Documento;
}

/** Trabalho sem título, sem seções e sem mídias. */
export function criarTrabalhoVazio(dados: DadosNovoTrabalho): TrabalhoNovo {
  return {
    manifesto: {
      formato: IDENTIFICADOR_FORMATO,
      versaoFormato: VERSAO_FORMATO_ATUAL,
      appVersao: dados.appVersao,
      id: dados.id,
      criadoEm: dados.agora,
      atualizadoEm: dados.agora,
      perfil: { ...PERFIL_PADRAO },
      tipoTrabalho: 'generico',
      midias: [],
    },
    documento: { id: dados.id, tipoTrabalho: 'generico', metadados: { titulo: [] }, corpo: [] },
  };
}
