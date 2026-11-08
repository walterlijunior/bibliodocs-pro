// M5-T01: tabela, quadro, ilustração e equação no formato v1 (aditivo; adendo do M5-T01 no ADR-0004). As fixtures
// inválidas novas (tabela-*, ilustracao-*, equacao-*) rodam com as demais em modelo-m2.test.ts.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { descreverErros, LIMITES_V1, MIMETYPE_PROJETO, validarDocumentoV1, type Manifesto } from '../src/dominio/esquemas';
import { idsDoBloco, problemaNaGrade, type BlocoTabela, type CelulaTabela, type Documento } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { exportarDocx } from '../src/exportacao/docx';
import { blocoParaNo, docParaSecao, noParaBloco, secaoParaDoc } from '../src/interface/editor/conversao';
import { empacotarProjeto, lerProjeto, type PacoteProjeto } from '../src/persistencia';

const pastaFixtures = join(__dirname, 'fixtures', 'projeto-v1');
const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(join(pastaFixtures, nome), 'utf8')) as T;
const sha = (d: Uint8Array) => createHash('sha256').update(d).digest('hex');

/** A imagem da fixture `documento-bordas-m5.json` (o sha256 está gravado nela). */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 5, 5, 5]);
const SHA_PNG = sha(PNG);

function pacoteM5(documento: Documento = lerJson<Documento>('documento-bordas-m5.json')): PacoteProjeto {
  const manifesto: Manifesto = {
    ...lerJson<Manifesto>('manifesto-valido.json'),
    id: documento.id,
    midias: [{ caminho: `midias/${SHA_PNG}.png`, sha256: SHA_PNG, bytes: PNG.length, tipo: 'image/png' }],
  };
  return { manifesto, documento, midias: new Map([[SHA_PNG, PNG]]) };
}

/** ZIP montado sem passar por `empacotarProjeto` (que recusaria antes), para testar só a leitura. */
function zipCru(p: PacoteProjeto, midias: ReadonlyMap<string, Uint8Array> = p.midias): Uint8Array {
  const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
  const arquivos: Zippable = {
    mimetype: [new TextEncoder().encode(MIMETYPE_PROJETO), { level: 0 }],
    'manifesto.json': enc(p.manifesto),
    'documento.json': enc(p.documento),
  };
  for (const m of p.manifesto.midias) arquivos[m.caminho] = [midias.get(m.sha256)!, { level: 0 }];
  return zipSync(arquivos, { mtime: new Date(1980, 0, 1) });
}

const celula = (texto: string, extra: Partial<CelulaTabela> = {}): CelulaTabela => ({ conteudo: [{ tipo: 'texto', texto }], ...extra });
const grade = (linhas: CelulaTabela[][], colunas: number, linhasCabecalho = 0) => ({
  colunas: Array.from({ length: colunas }, () => ({ alinhamento: 'esquerda' as const })),
  linhas,
  linhasCabecalho,
});

describe('fixture documento-bordas-m5.json', () => {
  const doc = lerJson<Documento>('documento-bordas-m5.json');

  it('passa e sai idêntica', () => {
    const r = validarDocumentoV1(doc);
    if (!r.ok) throw new Error(descreverErros(r.erros));
    expect(r.valor).toEqual(doc);
  });

  it('tem tabela, quadro, ilustração e equação, numerada e não', () => {
    const blocos = [...doc.corpo[0]!.blocos, ...doc.corpo[0]!.subsecoes[0]!.blocos];
    const tipos = blocos.map((b) => (b.tipo === 'tabela' ? b.especie : b.tipo === 'equacao' ? `equacao${b.numerada ? 'Numerada' : ''}` : b.tipo));
    expect(new Set(tipos)).toEqual(new Set(['paragrafo', 'tabela', 'quadro', 'ilustracao', 'equacaoNumerada', 'equacao']));
  });

  it('o id do elemento conta nas operações de seção (alvo das remissivas do M5-T08)', () => {
    expect(idsDoBloco(doc.corpo[0]!.blocos[1]!)).toEqual(['tab_bordm5001']);
  });

  it('empacotar → ler (.bdp) devolve o documento e a imagem idênticos', () => {
    const r = empacotarProjeto(pacoteM5());
    if (!r.ok) throw new Error(descreverErros(r.erros));
    const lido = lerProjeto(r.bytes);
    if (!lido.ok) throw new Error(descreverErros(lido.erros));
    expect(lido.avisos).toEqual([]);
    expect(lido.pacote.documento).toEqual(doc);
    expect(lido.pacote.midias.get(SHA_PNG)).toEqual(PNG);
  });

  it('arquivo v1 antigo, sem os blocos novos, continua abrindo igual', () => {
    const antigo = lerJson<Documento>('documento-bordas-m4.json');
    const r = empacotarProjeto({ ...pacoteM5(antigo), manifesto: { ...pacoteM5(antigo).manifesto, midias: [] }, midias: new Map() });
    if (!r.ok) throw new Error(descreverErros(r.erros));
    const lido = lerProjeto(r.bytes);
    expect(lido.ok && lido.pacote.documento).toEqual(antigo);
  });
});

describe('mídia da ilustração', () => {
  it('sha256 que não está no manifesto: a leitura recusa', () => {
    const p = pacoteM5();
    const semMidia: PacoteProjeto = { ...p, manifesto: { ...p.manifesto, midias: [] }, midias: new Map() };
    const r = lerProjeto(zipCru(semMidia));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros).toEqual([
        { caminho: 'documento.corpo[0].blocos[4].midia', mensagem: 'a ilustração aponta para uma imagem que não está no pacote' },
        { caminho: 'documento.corpo[0].subsecoes[0].blocos[1].midia', mensagem: 'a ilustração aponta para uma imagem que não está no pacote' },
      ]);
    }
  });

  it('o empacotamento também recusa (nunca grava um arquivo que não abriria)', () => {
    const p = pacoteM5();
    const r = empacotarProjeto({ ...p, manifesto: { ...p.manifesto, midias: [] }, midias: new Map() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.map((e) => e.mensagem)).toContain('a ilustração aponta para uma imagem que não está no pacote');
  });

  it('imagem declarada mas danificada (sha256 divergente) e usada: a leitura recusa', () => {
    const danificada = PNG.slice();
    danificada[9] = 6;
    const r = lerProjeto(zipCru(pacoteM5(), new Map([[SHA_PNG, danificada]])));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]).toEqual({ caminho: 'documento.corpo[0].blocos[4].midia', mensagem: 'a imagem da ilustração está danificada no pacote e foi descartada' });
  });

  it('mídia sem ilustração continua aceita (como antes do M5)', () => {
    const p = pacoteM5(lerJson<Documento>('documento-bordas-m4.json'));
    expect(empacotarProjeto(p).ok).toBe(true);
  });
});

describe('grade da tabela (problemaNaGrade)', () => {
  it('aceita mesclagem no cabeçalho e no corpo, e linha toda coberta por mesclagens de cima', () => {
    const t = grade(
      [
        [celula('a', { linhas: 2 }), celula('b', { colunas: 2 })],
        [celula('c'), celula('d')],
        [celula('e', { linhas: 2, colunas: 3 })],
        [],
      ],
      3,
      2,
    );
    expect(problemaNaGrade(t)).toBeNull();
  });

  it.each([
    ['cabeçalho maior que a tabela', grade([[celula('a')]], 1, 2), { motivo: 'cabecalhoMaiorQueTabela', caminho: ['linhasCabecalho'] }],
    ['célula a mais na linha', grade([[celula('a'), celula('b')]], 1), { motivo: 'passaDaUltimaColuna', caminho: ['linhas', 0, 1] }],
    ['linha vazia sem mesclagem de cima', grade([[celula('a')], []], 1), { motivo: 'linhaIncompleta', caminho: ['linhas', 1] }],
    [
      'mesclagem horizontal sobre vertical',
      grade([[celula('a'), celula('b', { linhas: 2 })], [celula('c', { colunas: 2 })]], 2),
      { motivo: 'sobreposta', caminho: ['linhas', 1, 0] },
    ],
    ['mesclagem vertical além da grade', grade([[celula('a', { linhas: 3 })], []], 1), { motivo: 'passaDaUltimaLinha', caminho: ['linhas', 0, 0] }],
    ['atravessa o cabeçalho', grade([[celula('a', { linhas: 2 })], []], 1, 1), { motivo: 'atravessaCabecalho', caminho: ['linhas', 0, 0] }],
  ])('%s', (_nome, t, esperado) => {
    expect(problemaNaGrade(t)).toEqual(esperado);
  });
});

describe('limites da tabela', () => {
  const comTabela = (t: Partial<BlocoTabela>) => {
    const doc = lerJson<Record<string, any>>('documento-bordas-m5.json');
    doc.corpo[0].blocos[1] = { ...doc.corpo[0].blocos[1], ...t };
    return doc;
  };

  it(`recusa mais de ${LIMITES_V1.colunasTabela} colunas (máximo do Word)`, () => {
    const n = LIMITES_V1.colunasTabela + 1;
    const r = validarDocumentoV1(comTabela({ ...grade([Array.from({ length: n }, () => celula('x'))], n), linhasCabecalho: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]?.caminho).toBe('documento.corpo[0].blocos[1].colunas');
  });

  it(`recusa grade com mais de ${LIMITES_V1.posicoesTabela} posições`, () => {
    const colunas = LIMITES_V1.colunasTabela;
    const linhas = Math.floor(LIMITES_V1.posicoesTabela / colunas) + 1;
    const linha = Array.from({ length: colunas }, () => celula(''));
    const r = validarDocumentoV1(comTabela({ ...grade(Array.from({ length: linhas }, () => linha), colunas), linhasCabecalho: 0 }));
    expect(r.ok ? [] : r.erros).toEqual([
      { caminho: 'documento.corpo[0].blocos[1].linhas', mensagem: `tabela grande demais (limite de ${LIMITES_V1.posicoesTabela} posições, linhas × colunas)` },
    ]);
  });
});

describe('editor: os blocos novos sobrevivem à ida e volta (a edição é do M5-T04, T06 e T07)', () => {
  const doc = lerJson<Documento>('documento-bordas-m5.json');

  it.each([doc.corpo[0]!, doc.corpo[0]!.subsecoes[0]!])('seção $id volta idêntica', (s) => {
    const conteudo = { titulo: s.titulo, blocos: s.blocos };
    expect(docParaSecao(secaoParaDoc(conteudo))).toEqual(conteudo);
  });

  it('o tipo vem do nó, não dos dados', () => {
    const no = blocoParaNo(doc.corpo[0]!.blocos[1]!);
    expect(no.type.name).toBe('tabela');
    expect(noParaBloco(no)).toEqual(doc.corpo[0]!.blocos[1]);
  });
});

describe('motor e DOCX: ilustração e equação ficam de fora com aviso até o M5-T06 e T07', () => {
  const doc = lerJson<Documento>('documento-bordas-m5.json');

  it('tabela e quadro saem (M5-T03); ilustração e equação geram ELEMENTO_ADIADO', async () => {
    const f = formatar({ corpo: doc.corpo, metadados: doc.metadados }, PERFIL);
    expect(f.secoes.flatMap((s) => s.blocos).filter((b) => b.tipo === 'tabela')).toHaveLength(3);
    expect(f.avisos.filter((a) => a.codigo === 'ELEMENTO_ADIADO').map((a) => [a.id, a.mensagem])).toEqual([
      ['ilu_bordm5001', 'A ilustração ainda não sai no arquivo exportado: chega numa tarefa seguinte do M5.'],
      ['eqc_bordm5001', 'A equação ainda não sai no arquivo exportado: chega numa tarefa seguinte do M5.'],
      ['ilu_bordm5002', 'A ilustração ainda não sai no arquivo exportado: chega numa tarefa seguinte do M5.'],
      ['eqc_bordm5002', 'A equação ainda não sai no arquivo exportado: chega numa tarefa seguinte do M5.'],
    ]);
    const bytes = await exportarDocx(f);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
