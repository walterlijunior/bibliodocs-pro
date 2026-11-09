/** M7-T04: aceite do RF-15 ampliado (D-M7-05) — dez não conformidades de seis famílias e o controle correto. */
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import { avaliarConformidade, textoRelatorioConformidade } from '../src/dominio/verificador/conformidade';
import { DEZ_FALHAS_M7, documentoCorretoM7, documentoDezFalhasM7, IMAGENS_CONFORMIDADE } from './corpus/conformidade';

const opcoes = { imagens: IMAGENS_CONFORMIDADE };

describe('RF-15 (M7-T04): aceite ampliado', () => {
  it('controle correto: válido, sem nenhum problema e sem regra fora da análise', () => {
    const d = documentoCorretoM7();
    expect(validarDocumentoV1(d).ok).toBe(true);
    expect(avaliarConformidade(d, PERFIL, opcoes)).toEqual({ problemas: [], diagnosticos: [] });
  });

  it('as dez detectadas, uma por regra, em seis famílias, sem nada a mais', () => {
    const d = documentoDezFalhasM7();
    expect(validarDocumentoV1(d).ok).toBe(true);
    const antes = JSON.stringify(d);
    const r = avaliarConformidade(d, PERFIL, opcoes);
    expect(r.diagnosticos).toEqual([]);
    expect(r.problemas.map((p) => p.codigo).sort()).toEqual([...DEZ_FALHAS_M7].sort());
    expect(new Set(r.problemas.map((p) => p.familia))).toEqual(new Set(['preTextual', 'bibliografia', 'visual', 'tabela', 'texto', 'sigla']));
    expect(r.problemas.filter((p) => p.gravidade === 'erro').map((p) => p.codigo).sort()).toEqual(['PRE_TEXTUAL_INCOMPLETO', 'SEM_FONTE']);
    for (const p of r.problemas) {
      expect(p.origem.length, p.codigo).toBeGreaterThan(0);
      expect(p.sugestao.length, p.codigo).toBeGreaterThan(15);
      expect(p.rotuloLocal, p.codigo).not.toMatch(/(?:sec|par|tab|ilu|equ|obr)_/u);
    }
    expect(r.problemas.find((p) => p.codigo === 'TITULO_CAIXA_ALTA')!.rotuloLocal).toBe('Seção 1.1 METODOLOGIA DA PESQUISA: “METODOLOGIA DA PESQUISA”');
    expect(r.problemas.find((p) => p.codigo === 'TABELA_SERIE_TEMPORAL')!.rotuloLocal).toBe('Seção 1 Introdução — Tabela 1: “2020–2022”');
    expect(JSON.stringify(d)).toBe(antes);
    expect(textoRelatorioConformidade(d, r.problemas, r.diagnosticos)).toContain('Resultado: 2 erro(s), 8 aviso(s).');
  });

  it('corrigir cada falha isolada a tira do relatório (cada uma é independente)', () => {
    const correto = documentoCorretoM7();
    const falho = documentoDezFalhasM7();
    // Trocar a subseção falha pela correta tira as duas do texto e a da sigla, e nada mais.
    falho.corpo[0]!.subsecoes = correto.corpo[0]!.subsecoes;
    const r = avaliarConformidade(falho, PERFIL, opcoes);
    expect(r.problemas.map((p) => p.codigo).sort()).toEqual(DEZ_FALHAS_M7.filter((c) => !['SUPRESSAO_FORA_DO_PADRAO', 'TITULO_CAIXA_ALTA', 'SIGLA_SEM_CADASTRO'].includes(c)).sort());
  });
});
