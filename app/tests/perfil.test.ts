// M3-T02 (RF-05, RNF-11, RNF-13; ADR-0006, camada 2): o perfil em dados confere com a matriz e dirige o domínio.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { validarPerfil } from '../src/dominio/esquemas';
import { estruturaInicial, pendenciasPreTextuais, type Perfil, type PropriedadesFormatacao } from '../src/dominio/normas';

const bruto = JSON.parse(readFileSync(join(__dirname, '..', 'perfis', 'uft-2022', 'perfil.json'), 'utf8')) as unknown;
const matriz = readFileSync(join(__dirname, '..', '..', 'docs', 'MATRIZ_DE_REQUISITOS_NORMATIVOS.md'), 'utf8');

/** Colunas da linha de uma RN. Status vem pelo valor, porque o texto de outras colunas tem `|` escapado. */
function naMatriz(id: string): { fonte: string; status: string } | null {
  const linha = matriz.split(/\r?\n/).find((l) => l.startsWith(`| ${id} |`));
  if (!linha) return null;
  const status = /\| (CONFIRMADA|IMPLEMENTADA|AMBÍGUA|PENDENTE-FONTE|CONFLITO) \|/.exec(linha)?.[1] ?? '';
  return { fonte: linha.split('|')[3]!.trim(), status: status.replace('AMBÍGUA', 'AMBIGUA') };
}

const copia = (): Perfil & { regras: Perfil['regras'] } => structuredClone(bruto) as Perfil;
const comRegra = (mudanca: object): unknown => {
  const p = structuredClone(bruto) as { regras: object[] };
  p.regras[0] = { ...p.regras[0], ...mudanca };
  return p;
};

describe('esquema', () => {
  it('o perfil é válido', () => {
    expect(validarPerfil(bruto)).toEqual({ ok: true });
  });

  it.each([
    ['status desconhecido', { status: 'TALVEZ' }],
    ['id fora do padrão', { id: 'RN-1' }],
    ['alvo desconhecido', { alvo: 'capitulo' }],
    ['campo desconhecido', { extra: 1 }],
    ['medida negativa', { propriedades: { corpoPt: -1 } }],
    ['PENDENTE-FONTE sem ser provisória', { status: 'PENDENTE-FONTE', provisoria: undefined }],
    ['parâmetro que não existe', { parametros: ['naoExiste'] }],
    ['procedimento sem função', { tipo: 'procedimento', procedimento: undefined }],
  ])('recusa %s', (_nome, mudanca) => {
    expect(validarPerfil(comRegra(mudanca)).ok).toBe(false);
  });

  it('recusa campo desconhecido na raiz', () => {
    expect(validarPerfil({ ...(bruto as object), outro: 1 }).ok).toBe(false);
  });
});

describe('rastreabilidade (RNF-11)', () => {
  it.each(PERFIL.regras.map((r) => [r.id, r] as const))('%s: status e fonte iguais aos da matriz', (id, r) => {
    expect(naMatriz(id)).toEqual({ fonte: r.fonte, status: r.status });
  });

  it('nenhuma regra do perfil está em CONFLITO, e PENDENTE-FONTE é sempre provisória', () => {
    for (const r of PERFIL.regras) {
      expect(r.status).not.toBe('CONFLITO');
      if (r.status === 'PENDENTE-FONTE') expect(r.provisoria, r.id).toBe(true);
    }
  });

  it('regra ambígua ou provisória sempre tem parâmetro com valor decidido', () => {
    for (const r of PERFIL.regras.filter((x) => x.status === 'AMBIGUA' || x.provisoria)) {
      expect(r.parametros?.length, r.id).toBeGreaterThan(0);
      for (const c of r.parametros!) expect(PERFIL.parametros[c]?.valor, `${r.id} ${c}`).toBeDefined();
    }
  });

  it('todo parâmetro cita RN existente, e toda regra citada usa o parâmetro', () => {
    for (const [chave, p] of Object.entries(PERFIL.parametros)) {
      for (const rn of p.rn) {
        expect(naMatriz(rn), `${chave} ${rn}`).not.toBeNull();
        const regra = PERFIL.regras.find((r) => r.id === rn);
        if (regra) expect(regra.parametros, `${chave} em ${rn}`).toContain(chave);
      }
    }
  });

  it('o valor padrão está entre as opções', () => {
    for (const [chave, p] of Object.entries(PERFIL.parametros)) if (p.opcoes) expect(p.opcoes, chave).toContain(p.valor);
  });

  it('as decisões do usuário de 2026-11-02 estão no perfil', () => {
    const v = (c: string) => PERFIL.parametros[c]?.valor;
    expect(v('fonte')).toBe('Times New Roman');
    expect(PERFIL.parametros['fonte']?.opcoes).toEqual(['Times New Roman', 'Arial']);
    expect(v('espacoTitulosPt')).toBe(18);
    expect(v('paginacaoPosTextual')).toBe('continua');
    expect(v('recuoAlineaCm')).toBe(1.25);
    expect(v('distanciaCabecalhoCm')).toBe(1.25);
    expect(v('espacoCitacaoLongaPt')).toBe(18);
    expect(v('numeracaoNotas')).toBe('continua');
    expect(v('fileteNotasCm')).toBe(5);
    expect(v('capaDistribuicao')).toBe('figura-3');
  });

  it('duas regras nunca dão valores diferentes à mesma propriedade do mesmo alvo', () => {
    const vistos = new Map<string, unknown>();
    for (const r of PERFIL.regras) {
      for (const [p, valor] of Object.entries(r.propriedades ?? {})) {
        const chave = `${r.alvo}.${p as keyof PropriedadesFormatacao}`;
        if (vistos.has(chave)) expect(valor, `${chave} em ${r.id}`).toBe(vistos.get(chave));
        vistos.set(chave, valor);
      }
    }
  });

  it('os valores conferem com o Manual nos pontos do DOC-01 a DOC-06', () => {
    const props = (id: string) => PERFIL.regras.find((r) => r.id === id)?.propriedades;
    expect(props('RN-018')).toEqual({ larguraMm: 210, alturaMm: 297 });
    expect(props('RN-002')).toEqual({ margemSuperiorCm: 3, margemEsquerdaCm: 3, margemInferiorCm: 2, margemDireitaCm: 2 });
    expect(props('RN-003')).toMatchObject({ recuoPrimeiraLinhaCm: 1.25, alinhamento: 'justificado' });
    expect(props('RN-004')).toMatchObject({ recuoEsquerdaCm: 4, corpoPt: 10, entrelinha: 'simples' });
    expect(props('RN-010')).toMatchObject({ maiusculas: true, negrito: true });
    expect(props('RN-014')).toMatchObject({ sublinhado: true });
  });
});

describe('o domínio é dirigido pelos dados (RNF-13)', () => {
  it('estrutura de um perfil fictício muda o trabalho novo, sem código', () => {
    const p = copia() as unknown as { tiposTrabalho: Record<string, { textuais: { secoes: { titulo: string }[] }[] }> };
    p.tiposTrabalho['monografia']!.textuais[0]!.secoes[0]!.titulo = 'Abertura';
    expect(estruturaInicial('monografia', p as unknown as Perfil).secoes[0]!.titulo).toBe('Abertura');
    expect(estruturaInicial('monografia', PERFIL).secoes[0]!.titulo).not.toBe('Abertura');
  });

  it('o limite de palavras-chave vem do perfil', () => {
    const doc = {
      tipoTrabalho: 'artigo-tcc',
      metadados: { titulo: [] },
      preTextuais: [{ id: 'pre_abcdefghijklmnop', tipo: 'resumo', palavrasChave: ['a', 'b', 'c'] }],
    } as unknown as Parameters<typeof pendenciasPreTextuais>[0];
    const rn155 = (perfil: Perfil) => pendenciasPreTextuais(doc, perfil).some((x) => x.rn === 'RN-155');
    expect(rn155(PERFIL)).toBe(false);
    const p = copia() as unknown as { parametros: Record<string, { valor: unknown }> };
    p.parametros['palavrasChaveMaximo']!.valor = 2;
    expect(rn155(p as unknown as Perfil)).toBe(true);
  });
});
