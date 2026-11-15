// Etapa 2 da especificação de atualização — busca no documento (D-E2-05): sem diferença de maiúsculas nem de acentos,
// nos títulos e no texto (também em tabelas e notas lidas como conteúdo do bloco), com a seção e o contexto.
import { describe, expect, it } from 'vitest';
import { buscarNoDocumento } from '../src/aplicacao';
import type { Secao } from '../src/dominio/modelo';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const corpo: Secao[] = [
  {
    id: 'sec_bs000000001',
    titulo: [t('Introdução')],
    blocos: [{ tipo: 'paragrafo', id: 'par_bs000000001', conteudo: [t('A função do pequi na alimentação. Outra FUNÇÃO.')] }],
    subsecoes: [{ id: 'sec_bs000000002', titulo: [t('Função social')], blocos: [], subsecoes: [] }],
  },
];

describe('busca no documento', () => {
  it('acha sem acento e sem maiúsculas, no texto e no título, com a seção e o trecho original', () => {
    const r = buscarNoDocumento(corpo, 'funcao');
    expect(r.map((x) => [x.indicativo, x.noTitulo, x.trecho])).toEqual([
      ['1', false, 'função'],
      ['1', false, 'FUNÇÃO'],
      ['1.1', true, 'Função'],
    ]);
    expect(r[0]).toMatchObject({ bloco: 'par_bs000000001', antes: 'A ', depois: ' do pequi na alimentação. Outra FUNÇÃO.' });
  });

  it('termo curto ou ausente não lista nada', () => {
    expect(buscarNoDocumento(corpo, 'a')).toEqual([]);
    expect(buscarNoDocumento(corpo, 'inexistente')).toEqual([]);
  });
});
