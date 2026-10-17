// Testes do grupo PER (M2-T04): alíneas e subalíneas (RN-023 a RN-026), citação longa como bloco (RN-004) e nota de
// rodapé como inline com conteúdo (RN-100) — esquema, fixtures válidas e inválidas, ids únicos e ida e volta `.bdp`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { conteudosDoBloco, idsDoBloco, inserirSecao, textoPlano, type Bloco, type Documento, type InlineTexto, type Secao } from '../src/dominio/modelo';
import { rotuloAlinea } from '../src/dominio/numeracao';
import { descreverErros, LIMITES_V1, validarDocumentoV1, type ErroValidacao, type Manifesto } from '../src/dominio/esquemas';
import { empacotarProjeto, lerProjeto } from '../src/persistencia';

const pastaFixtures = join(__dirname, 'fixtures', 'projeto-v1');
const lerJson = <T>(...partes: string[]): T => JSON.parse(readFileSync(join(pastaFixtures, ...partes), 'utf8')) as T;

interface FixtureInvalida {
  descricao: string;
  erros: ErroValidacao[];
  documento: unknown;
}

const VALIDAS = ['documento-valido.json', 'documento-bordas-m2.json'];
const INVALIDAS = readdirSync(join(pastaFixtures, 'invalidos'))
  .filter((n) => n.endsWith('.json'))
  .sort();

const texto = (t: string): InlineTexto => ({ tipo: 'texto', texto: t });

describe('fixtures válidas do M2', () => {
  it.each(VALIDAS)('%s passa e sai idêntica', (nome) => {
    const json = lerJson<Documento>(nome);
    const r = validarDocumentoV1(json);
    if (!r.ok) throw new Error(descreverErros(r.erros));
    expect(r.valor).toEqual(json);
  });

  it('as fixtures válidas cobrem cada tipo novo de bloco e de inline', () => {
    const tipos = new Set<string>();
    for (const nome of VALIDAS) {
      const pilha = [...lerJson<Documento>(nome).corpo];
      for (let s = pilha.pop(); s !== undefined; s = pilha.pop()) {
        for (const b of s.blocos) {
          tipos.add(b.tipo);
          for (const c of conteudosDoBloco(b)) for (const i of c) tipos.add(i.tipo);
          if (b.tipo === 'alineas' && b.itens.some((i) => i.subalineas)) tipos.add('subalinea');
        }
        pilha.push(...s.subsecoes);
      }
    }
    expect([...tipos].sort()).toEqual(['alineas', 'citacaoLonga', 'nota', 'paragrafo', 'quebraPagina', 'subalinea', 'texto']);
  });

  it.each(VALIDAS)('%s: empacotar → ler (.bdp) devolve o documento idêntico', (nome) => {
    const documento = lerJson<Documento>(nome);
    const manifesto = { ...lerJson<Manifesto>('manifesto-valido.json'), id: documento.id, midias: [] };
    const bytes = empacotarProjeto({ manifesto, documento, midias: new Map() });
    if (!bytes.ok) throw new Error(JSON.stringify(bytes.erros));
    const lido = lerProjeto(bytes.bytes);
    if (!lido.ok) throw new Error(JSON.stringify(lido.erros));
    expect(lido.pacote.documento).toEqual(documento);
    expect(JSON.stringify(lido.pacote.documento)).toBe(JSON.stringify(documento));
  });
});

describe('fixtures inválidas do M2', () => {
  it('há uma fixture inválida para cada recusa nova', () => {
    expect(INVALIDAS.length).toBeGreaterThanOrEqual(14);
  });

  it.each(INVALIDAS)('%s é recusada com caminho e mensagem pt-BR', (nome) => {
    const f = lerJson<FixtureInvalida>('invalidos', nome);
    const r = validarDocumentoV1(f.documento);
    expect(r.ok, f.descricao).toBe(false);
    if (!r.ok) expect(r.erros).toEqual(f.erros);
  });
});

describe('limites do M2', () => {
  const comBloco = (b: unknown) => {
    const json = lerJson<Record<string, any>>('documento-valido.json');
    json.corpo[1].blocos = [b];
    return json;
  };

  it(`aceita ${LIMITES_V1.itensPorAlineas} alíneas e recusa uma a mais`, () => {
    const itens = (n: number) => Array.from({ length: n }, () => ({ conteudo: [] }));
    expect(validarDocumentoV1(comBloco({ tipo: 'alineas', id: 'aln_limite01', itens: itens(LIMITES_V1.itensPorAlineas) })).ok).toBe(true);
    const r = validarDocumentoV1(comBloco({ tipo: 'alineas', id: 'aln_limite01', itens: itens(LIMITES_V1.itensPorAlineas + 1) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.map((e) => e.caminho)).toEqual(['documento.corpo[1].blocos[0].itens']);
  });

  it(`recusa ${LIMITES_V1.subalineasPorAlinea + 1} subalíneas numa alínea`, () => {
    const subalineas = Array.from({ length: LIMITES_V1.subalineasPorAlinea + 1 }, () => []);
    const r = validarDocumentoV1(comBloco({ tipo: 'alineas', id: 'aln_limite01', itens: [{ conteudo: [], subalineas }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.map((e) => e.caminho)).toEqual(['documento.corpo[1].blocos[0].itens[0].subalineas']);
  });

  it(`a estrutura mais funda do M2 cabe no aninhamento JSON com ${LIMITES_V1.profundidadeSecoes} níveis de seção`, () => {
    // Subalínea com nota cujo texto tem marcas, na seção mais funda que a leitura aceita.
    const nota = { tipo: 'nota', id: 'nta_fundo001', conteudo: [{ tipo: 'texto', texto: 'x', marcas: ['italico'] }] };
    const bloco = { tipo: 'alineas', id: 'aln_fundo001', itens: [{ conteudo: [], subalineas: [[nota]] }] };
    let secao: Record<string, unknown> | null = null;
    for (let nivel = LIMITES_V1.profundidadeSecoes; nivel >= 1; nivel--) {
      const blocos: unknown[] = secao ? [] : [bloco];
      secao = { id: `sec_nivel${String(nivel).padStart(3, '0')}`, titulo: [], blocos, subsecoes: secao ? [secao] : [] };
    }
    const r = validarDocumentoV1({ ...lerJson<Record<string, unknown>>('documento-valido.json'), corpo: [secao] });
    if (!r.ok) throw new Error(descreverErros(r.erros));
  });
});

describe('rótulo das alíneas (RN-023, RN-025 com C-A6)', () => {
  it('segue o alfabeto e depois dobra a letra: aa), bb), cc)', () => {
    expect([0, 1, 2, 25, 26, 27, 28, 51].map(rotuloAlinea)).toEqual(['a)', 'b)', 'c)', 'z)', 'aa)', 'bb)', 'cc)', 'zz)']);
  });

  it('depois de zz) triplica a letra', () => {
    expect(rotuloAlinea(52)).toBe('aaa)');
  });

  it('os rótulos são únicos até o limite de alíneas e casam com o critério de RN-023 até zz)', () => {
    const rotulos = Array.from({ length: LIMITES_V1.itensPorAlineas }, (_, i) => rotuloAlinea(i));
    expect(new Set(rotulos).size).toBe(rotulos.length);
    for (const r of rotulos.slice(0, 52)) expect(`${r} texto`).toMatch(/^[a-z]{1,2}\) /);
  });

  it.each([-1, 1.5, Number.NaN])('posição %d é recusada', (i) => {
    expect(() => rotuloAlinea(i)).toThrow(RangeError);
  });
});

describe('percursos do bloco', () => {
  const alineas: Bloco = {
    tipo: 'alineas',
    id: 'aln_percurso1',
    itens: [
      { conteudo: [texto('a'), { tipo: 'nota', id: 'nta_percurso1', conteudo: [] }], subalineas: [[texto('a1')], [texto('a2')]] },
      { conteudo: [texto('b')] },
    ],
  };

  it('conteúdos em ordem de leitura: alínea e depois as suas subalíneas', () => {
    expect(conteudosDoBloco(alineas).map((c) => textoPlano(c))).toEqual(['a', 'a1', 'a2', 'b']);
    expect(conteudosDoBloco({ tipo: 'quebraPagina', id: 'qbr_percurso1' })).toEqual([]);
  });

  it('ids do bloco incluem os das notas', () => {
    expect(idsDoBloco(alineas)).toEqual(['aln_percurso1', 'nta_percurso1']);
    const citacao: Bloco = { tipo: 'citacaoLonga', id: 'cit_percurso1', conteudo: [{ tipo: 'nota', id: 'nta_percurso2', conteudo: [] }] };
    expect(idsDoBloco(citacao)).toEqual(['cit_percurso1', 'nta_percurso2']);
  });

  it('texto plano deixa a nota de fora', () => {
    expect(textoPlano([texto('Cerrado'), { tipo: 'nota', id: 'nta_percurso1', conteudo: [texto('nota')] }, texto('.')])).toBe('Cerrado.');
  });
});

describe('operações de seção conferem os ids das notas', () => {
  const comNota = (secaoId: string, ...notaIds: string[]): Secao => ({
    id: secaoId,
    titulo: [],
    blocos: [{ tipo: 'paragrafo', id: `par_${secaoId.slice(4)}`, conteudo: notaIds.map((id) => ({ tipo: 'nota', id, conteudo: [] })) }],
    subsecoes: [],
  });

  it('inserir seção com nota de id já usado no corpo é recusado', () => {
    const r = inserirSecao([comNota('sec_existente', 'nta_comum001')], comNota('sec_novaaaaa', 'nta_comum001'), { paiId: null, indice: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe('ID_REPETIDO');
  });

  it('inserir seção com duas notas de mesmo id é recusado', () => {
    const r = inserirSecao([], comNota('sec_novaaaaa', 'nta_dupla001', 'nta_dupla001'), { paiId: null, indice: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe('ID_REPETIDO');
  });

  it('inserir seção com notas de ids novos é aceito', () => {
    const r = inserirSecao([comNota('sec_existente', 'nta_comum001')], comNota('sec_novaaaaa', 'nta_outra001'), { paiId: null, indice: 1 });
    expect(r.ok).toBe(true);
  });
});
