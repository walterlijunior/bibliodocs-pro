/**
 * Serviço `criarTrabalho` (ADR-0005, seção 3). M1-T09: trabalho vazio do tipo genérico. M2-T02: trabalho de um tipo
 * UFT, com os elementos e as seções de `estruturaInicial` (RF-02): o obrigatório pelo Manual e o sugerido pelo modelo
 * UFT (C-B18), na ordem do Quadro 5.
 *
 * Puro: o id, a hora e os ids dos elementos vêm de quem chama (o principal usa `randomBytes` e o relógio).
 */
import { IDENTIFICADOR_FORMATO, VERSAO_FORMATO_ATUAL, type Manifesto } from '../../dominio/esquemas';
import type { Documento, Secao, TipoTrabalhoId, TipoTrabalhoUft } from '../../dominio/modelo';
import { estruturaInicial, type SecaoInicial } from '../../dominio/normas';
import { PERFIL_UFT_2022 } from '../perfil-padrao';

/**
 * Perfil gravado nos trabalhos novos. [HIPÓTESE] a versão `1.0.0` fica até o perfil existir em dados (M3), quando
 * passa a vir de `perfis/uft-2022/`.
 */
export const PERFIL_PADRAO: Manifesto['perfil'] = { id: 'uft-2022', versao: '1.0.0' };

/** Prefixos dos ids criados aqui (`<prefixo>_` + 16 caracteres, dentro do `PADRAO_ID`). */
export const PREFIXO_ID_ELEMENTO = 'ele';
export const PREFIXO_ID_SECAO = 'sec';

export interface DadosNovoTrabalho {
  /** Novo id do projeto (`PADRAO_ID`); vale para o manifesto e o documento. */
  id: string;
  /** Data e hora ISO 8601 com fuso. */
  agora: string;
  appVersao: string;
}

export interface DadosNovoTrabalhoDoTipo extends DadosNovoTrabalho {
  tipo: TipoTrabalhoUft;
  /** Id novo e único com o prefixo dado (`PREFIXO_ID_ELEMENTO`, `PREFIXO_ID_SECAO`). */
  novoId: (prefixo: string) => string;
}

export interface TrabalhoNovo {
  manifesto: Manifesto;
  documento: Documento;
}

function manifestoNovo(dados: DadosNovoTrabalho, tipoTrabalho: TipoTrabalhoId): Manifesto {
  return {
    formato: IDENTIFICADOR_FORMATO,
    versaoFormato: VERSAO_FORMATO_ATUAL,
    appVersao: dados.appVersao,
    id: dados.id,
    criadoEm: dados.agora,
    atualizadoEm: dados.agora,
    perfil: { ...PERFIL_PADRAO },
    tipoTrabalho,
    midias: [],
  };
}

/** Trabalho genérico sem título, sem seções e sem mídias (o tipo do M1, mantido para os testes e arquivos antigos). */
export function criarTrabalhoVazio(dados: DadosNovoTrabalho): TrabalhoNovo {
  return {
    manifesto: manifestoNovo(dados, 'generico'),
    documento: { id: dados.id, tipoTrabalho: 'generico', metadados: { titulo: [] }, corpo: [] },
  };
}

/** Trabalho novo do tipo: sem título, com os elementos e as seções iniciais do tipo, sem texto. */
export function criarTrabalhoDoTipo(dados: DadosNovoTrabalhoDoTipo): TrabalhoNovo {
  const e = estruturaInicial(dados.tipo, PERFIL_UFT_2022);
  const secao = (s: SecaoInicial): Secao => ({
    id: dados.novoId(PREFIXO_ID_SECAO),
    titulo: [{ tipo: 'texto', texto: s.titulo }],
    blocos: [],
    subsecoes: (s.subsecoes ?? []).map(secao),
  });
  const elemento = <T extends string>(tipo: T) => ({ tipo, id: dados.novoId(PREFIXO_ID_ELEMENTO) });
  // Listas vazias ficam ausentes (forma única do documento); a ordem das chaves é a da leitura.
  const documento: Documento = {
    id: dados.id,
    tipoTrabalho: dados.tipo,
    metadados: { titulo: [] },
    ...(e.preTextuais.length > 0 && { preTextuais: e.preTextuais.map(elemento) }),
    corpo: e.secoes.map(secao),
    ...(e.posTextuais.length > 0 && { posTextuais: e.posTextuais.map(elemento) }),
  };
  return { manifesto: manifestoNovo(dados, dados.tipo), documento };
}
