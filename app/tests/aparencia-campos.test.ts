// Especificação revista, Etapa 2: os campos de texto corrido mostram o estilo do perfil ao digitar.
import { describe, expect, it } from 'vitest';
import { aparenciaDosCampos } from '../src/aplicacao';

describe('Aparência dos campos de texto corrido', () => {
  it('no perfil UFT, o resumo é justificado, a natureza começa no meio da área útil e a dedicatória começa no meio', () => {
    const a = aparenciaDosCampos();
    expect(a.resumo.alinhamento).toBe('justificado');
    expect(a.natureza.recuoEsquerdaPct).toBeGreaterThanOrEqual(45);
    expect(a.natureza.recuoEsquerdaPct).toBeLessThanOrEqual(55);
    expect(a.natureza.maiusculas).toBe(false);
    expect(a.agradecimentos.alinhamento).toBe('justificado');
    expect(a.dedicatoria.recuoEsquerdaPct).toBe(50);
    expect(a.errata.recuoPrimeiraLinhaPct).toBeGreaterThan(0);
  });

  it('o modelo aplicado muda o alinhamento do texto', () => {
    const a = aparenciaDosCampos({ nome: 'Evento', importadoEm: '2026-11-15T00:00:00.000Z', reconhecidas: {}, regras: { alinhamento: 'esquerda' } });
    expect(a.errata.alinhamento).toBe('esquerda');
  });
});
