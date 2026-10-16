// Testes do grupo PER (M1-T05): contêiner .bdp — ida e volta, mimetype, nomes permitidos, limites contra zip bomb,
// integridade e mídias (ADR-0004, seções 1 a 3).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { Documento } from '../src/dominio/modelo';
import { MIMETYPE_PROJETO, type Manifesto } from '../src/dominio/esquemas';
import { empacotarProjeto, lerProjeto, LIMITES_CONTEINER, type LimitesConteiner, type PacoteProjeto } from '../src/persistencia';
import { montarZip, type EntradaBruta } from './apoio/zip-bruto';

const pastaFixtures = join(__dirname, 'fixtures', 'projeto-v1');
const lerFixture = <T>(nome: string): T => JSON.parse(readFileSync(join(pastaFixtures, nome), 'utf8')) as T;
const texto = (s: string) => new TextEncoder().encode(s);
const sha = (d: Uint8Array) => createHash('sha256').update(d).digest('hex');
const json = (v: unknown) => texto(JSON.stringify(v));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6]);

function pacoteValido(): PacoteProjeto {
  const documento = lerFixture<Documento>('documento-valido.json');
  const manifesto = lerFixture<Manifesto>('manifesto-valido.json');
  const midias = new Map<string, Uint8Array>();
  manifesto.midias = [PNG, JPEG].map((dados) => {
    const h = sha(dados);
    midias.set(h, dados);
    const png = dados === PNG;
    return { caminho: `midias/${h}.${png ? 'png' : 'jpg'}`, sha256: h, bytes: dados.length, tipo: png ? 'image/png' : 'image/jpeg' } as const;
  });
  return { manifesto, documento, midias, miniatura: PNG };
}

function bytesValidos(p: PacoteProjeto = pacoteValido()): Uint8Array {
  const r = empacotarProjeto(p);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.bytes;
}

/** Entradas brutas de um pacote válido, para adulterar uma delas. */
function entradasBrutas(p: PacoteProjeto = pacoteValido()): EntradaBruta[] {
  return [
    { nome: 'mimetype', conteudo: texto(MIMETYPE_PROJETO), metodo: 0 },
    { nome: 'manifesto.json', conteudo: json(p.manifesto) },
    { nome: 'documento.json', conteudo: json(p.documento) },
    ...p.manifesto.midias.map((m) => ({ nome: m.caminho, conteudo: p.midias.get(m.sha256)!, metodo: 0 as const })),
  ];
}

function recusa(bytes: Uint8Array, limites: LimitesConteiner = LIMITES_CONTEINER) {
  const r = lerProjeto(bytes, limites);
  expect(r.ok, 'deveria ter sido recusado').toBe(false);
  return r.ok ? [] : r.erros;
}

describe('ida e volta', () => {
  it('empacotar → ler devolve conteúdo idêntico, sem avisos', () => {
    const p = pacoteValido();
    const r = lerProjeto(bytesValidos(p));
    expect(r).toEqual({ ok: true, pacote: p, avisos: [] });
  });

  it('o mesmo conteúdo gera os mesmos bytes (data fixa nas entradas)', () => {
    expect(bytesValidos()).toEqual(bytesValidos());
  });

  it('mimetype é a 1.ª entrada, sem compressão, com o texto do formato logo após o cabeçalho', () => {
    const b = bytesValidos();
    const v = new DataView(b.buffer, b.byteOffset);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(8, true)).toBe(0); // método 0
    expect(new TextDecoder().decode(b.subarray(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(b.subarray(38, 38 + MIMETYPE_PROJETO.length))).toBe(MIMETYPE_PROJETO);
  });

  it('o pacote montado à mão com a mesma estrutura também é lido (o leitor não depende do fflate para escrever)', () => {
    const p = pacoteValido();
    delete p.miniatura;
    expect(lerProjeto(montarZip(entradasBrutas(p)))).toEqual({ ok: true, pacote: p, avisos: [] });
  });
});

describe('empacotar recusa pacote inválido (nada é escrito)', () => {
  it('documento com campo extra', () => {
    const p = pacoteValido();
    (p.documento as unknown as Record<string, unknown>).html = '<b>';
    const r = empacotarProjeto(p);
    expect(r.ok).toBe(false);
  });

  it('id ou tipo do manifesto diferente do documento', () => {
    const p = pacoteValido();
    p.documento.id = 'outro_id_123';
    expect(empacotarProjeto(p)).toEqual({ ok: false, erros: [{ caminho: 'manifesto.id', mensagem: 'id do manifesto diferente do id do documento' }] });
  });

  it('mídia com conteúdo que não bate com sha256, tamanho ou tipo', () => {
    const p = pacoteValido();
    const h = p.manifesto.midias[0]!.sha256;
    (p.midias as Map<string, Uint8Array>).set(h, JPEG);
    const r = empacotarProjeto(p);
    expect(r.ok ? [] : r.erros.map((e) => e.mensagem)).toEqual([
      'sha256 não confere com o conteúdo da mídia',
      'tamanho não confere com o conteúdo da mídia',
      'conteúdo da mídia não corresponde ao tipo declarado',
    ]);
  });

  it('mídia sem declaração, mídia declarada sem conteúdo e miniatura que não é PNG', () => {
    const p = pacoteValido();
    const m = p.midias as Map<string, Uint8Array>;
    m.delete(p.manifesto.midias[1]!.sha256);
    m.set('f'.repeat(64), PNG);
    p.miniatura = JPEG;
    const r = empacotarProjeto(p);
    expect(r.ok ? [] : r.erros.map((e) => `${e.caminho}: ${e.mensagem}`)).toEqual([
      'manifesto.midias[1]: mídia declarada sem conteúdo',
      `midias/${'f'.repeat(64)}: mídia não declarada no manifesto`,
      'miniatura.png: a miniatura não é PNG',
    ]);
  });
});

describe('ler recusa estrutura inválida', () => {
  it.each([
    ['vazio', new Uint8Array(0)],
    ['bytes aleatórios', new Uint8Array(500).map((_, i) => (i * 37) % 251)],
  ])('arquivo que não é ZIP (%s)', (_n, bytes) => {
    expect(recusa(bytes)[0]?.mensagem).toMatch(/^não é um projeto válido/);
  });

  it('arquivo truncado', () => {
    const b = bytesValidos();
    expect(recusa(b.subarray(0, b.length - 5))[0]?.caminho).toBe('arquivo');
  });

  it('ZIP com comentário no fim', () => {
    expect(recusa(montarZip(entradasBrutas(), { comentario: 'oi' }))[0]?.mensagem).toMatch(/^não é um projeto válido/);
  });

  it.each(['../fora.json', 'midias/../documento.json', '/absoluto.json', 'C:/x.json', 'midias\\x.png', 'midias/', 'script.js', 'midias/abc.png', 'midias/' + 'a'.repeat(64) + '.svg', 'Documento.json'])(
    'nome não permitido: %s',
    (nome) => {
      const e = [...entradasBrutas(), { nome, conteudo: texto('x') }];
      expect(recusa(montarZip(e))).toEqual([{ caminho: nome, mensagem: 'nome de entrada não permitido no pacote' }]);
    },
  );

  it('nome repetido', () => {
    const e = entradasBrutas();
    expect(recusa(montarZip([...e, e[2]!]))).toEqual([{ caminho: 'documento.json', mensagem: 'entrada repetida no pacote' }]);
  });

  it('mimetype ausente, fora da 1.ª posição ou comprimido', () => {
    const [mime, ...resto] = entradasBrutas();
    expect(recusa(montarZip(resto))[0]?.caminho).toBe('mimetype');
    expect(recusa(montarZip([...resto, mime!]))[0]?.caminho).toBe('mimetype');
    expect(recusa(montarZip([{ ...mime!, metodo: 8 }, ...resto]))[0]?.caminho).toBe('mimetype');
  });

  it('mimetype de outro formato', () => {
    const [, ...resto] = entradasBrutas();
    const outro = { nome: 'mimetype', conteudo: texto('application/vnd.oasis.opendocument.text'), metodo: 0 as const };
    // Texto mais longo que o do formato: recusado pelo limite de tamanho da entrada.
    expect(recusa(montarZip([outro, ...resto]))[0]?.caminho).toBe('mimetype');
    const mesmoTamanho = { ...outro, conteudo: texto('x'.repeat(MIMETYPE_PROJETO.length)) };
    expect(recusa(montarZip([mesmoTamanho, ...resto]))).toEqual([{ caminho: 'mimetype', mensagem: 'este arquivo não é um projeto do BiblioDocs Pro' }]);
  });

  it('arquivo obrigatório ausente', () => {
    const e = entradasBrutas().filter((x) => x.nome !== 'documento.json');
    expect(recusa(montarZip(e))).toEqual([{ caminho: 'documento.json', mensagem: 'arquivo obrigatório ausente no pacote' }]);
  });

  it.each(['bibliografia.json', 'ajustes.json'])('%s ainda não é suportado no v1', (nome) => {
    const e = [...entradasBrutas(), { nome, conteudo: texto('{}') }];
    expect(recusa(montarZip(e))).toEqual([{ caminho: nome, mensagem: 'conteúdo não suportado nesta versão do formato' }]);
  });

  it('entrada criptografada e método de compressão desconhecido', () => {
    const e = entradasBrutas();
    expect(recusa(montarZip(e.map((x, i) => (i === 2 ? { ...x, flags: 1 } : x))))[0]?.mensagem).toBe('entrada criptografada não é aceita');
    const metodo12 = e.map((x, i) => (i === 2 ? { ...x, metodo: 12 as unknown as 0 } : x));
    expect(recusa(montarZip(metodo12))[0]?.mensagem).toBe('método de compressão não suportado (12)');
  });

  it('entradas sobrepostas (cabeçalho central apontando para os dados de outra entrada)', () => {
    const e = entradasBrutas();
    e[2] = { ...e[2]!, localDe: 1 };
    expect(recusa(montarZip(e))[0]?.mensagem).toBe('cabeçalho local ausente, sobreposto, fora de ordem ou com lacuna');
  });

  it('dados de uma entrada cobrindo o cabeçalho local da seguinte (sobreposição)', () => {
    const e = entradasBrutas().map((x) => (x.nome === 'manifesto.json' ? { ...x, comprimido: deflateSync(x.conteudo).length + 10 } : x));
    expect(recusa(montarZip(e))).toEqual([{ caminho: 'documento.json', mensagem: 'cabeçalho local ausente, sobreposto, fora de ordem ou com lacuna' }]);
  });

  it('CRC-32 errado', () => {
    const e = entradasBrutas().map((x) => (x.nome === 'documento.json' ? { ...x, crc: 12345 } : x));
    expect(recusa(montarZip(e))).toEqual([{ caminho: 'documento.json', mensagem: 'CRC-32 não confere (arquivo corrompido)' }]);
  });

  it('JSON inválido e texto fora de UTF-8', () => {
    const e = entradasBrutas();
    const ruim = (conteudo: Uint8Array) => montarZip(e.map((x) => (x.nome === 'documento.json' ? { ...x, conteudo } : x)));
    expect(recusa(ruim(texto('{"id":')))).toEqual([{ caminho: 'documento.json', mensagem: 'JSON inválido ou texto fora de UTF-8' }]);
    expect(recusa(ruim(new Uint8Array([0x7b, 0xff, 0x7d])))[0]?.mensagem).toBe('JSON inválido ou texto fora de UTF-8');
  });

  it('erros de esquema aparecem com o caminho do JSON', () => {
    const p = pacoteValido();
    (p.documento as unknown as Record<string, unknown>).numero = 1;
    expect(recusa(montarZip(entradasBrutas(p)))).toEqual([{ caminho: 'documento', mensagem: 'campo não permitido: "numero"' }]);
  });

  it('id do manifesto diferente do documento', () => {
    const p = pacoteValido();
    p.manifesto.id = 'outro_id_123';
    expect(recusa(montarZip(entradasBrutas(p)))[0]?.mensagem).toBe('id do manifesto diferente do id do documento');
  });

  it('versão de formato futura recebe mensagem própria', () => {
    const p = pacoteValido();
    (p.manifesto as unknown as Record<string, unknown>).versaoFormato = 2;
    expect(recusa(montarZip(entradasBrutas(p)))).toEqual([
      { caminho: 'manifesto.versaoFormato', mensagem: 'projeto criado por uma versão mais nova do BiblioDocs Pro' },
    ]);
  });

  it('bytes → JSON.parse → validação: aninhamento patológico dentro do arquivo é recusado sem estourar a pilha', () => {
    const p = pacoteValido();
    const profundo = `{"id":"${p.documento.id}","tipoTrabalho":"generico","metadados":{"titulo":[]},"corpo":${'['.repeat(200_000)}${']'.repeat(200_000)}}`;
    const e = entradasBrutas(p).map((x) => (x.nome === 'documento.json' ? { ...x, conteudo: texto(profundo) } : x));
    const limites = { ...LIMITES_CONTEINER, razaoCompressao: 100_000 };
    expect(recusa(montarZip(e), limites)[0]?.mensagem).toMatch(/^estrutura aninhada demais/);
  });
});

describe('limites contra zip bomb', () => {
  it('razão de compressão acima de 200:1 é recusada antes de descomprimir', () => {
    const p = pacoteValido();
    const e = entradasBrutas(p).map((x) => (x.nome === 'documento.json' ? { ...x, conteudo: texto(JSON.stringify(p.documento) + ' '.repeat(5_000_000)) } : x));
    expect(recusa(montarZip(e))).toEqual([{ caminho: 'documento.json', mensagem: 'razão de compressão acima do limite (200:1)' }]);
  });

  it('tamanho declarado menor que o real: descompressão interrompida', () => {
    const p = pacoteValido();
    const conteudo = texto(JSON.stringify(p.documento) + ' '.repeat(50_000));
    const e = entradasBrutas(p).map((x) => (x.nome === 'documento.json' ? { ...x, conteudo, descomprimido: 1_000 } : x));
    expect(recusa(montarZip(e))).toEqual([{ caminho: 'documento.json', mensagem: 'conteúdo maior que o tamanho declarado (possível zip bomb)' }]);
  });

  it('tamanho declarado maior que o real é recusado', () => {
    const e = entradasBrutas().map((x) => (x.nome === 'manifesto.json' ? { ...x, descomprimido: x.conteudo.length + 10 } : x));
    expect(recusa(montarZip(e))[0]?.mensagem).toBe('conteúdo com tamanho diferente do declarado');
  });

  it('entrada sem compressão com tamanhos divergentes', () => {
    const e = entradasBrutas().map((x, i) => (i === 0 ? { ...x, descomprimido: 5 } : x));
    expect(recusa(montarZip(e))[0]?.mensagem).toBe('entrada sem compressão com tamanhos divergentes');
  });

  it('limites de arquivo, entradas, JSON, mídia e soma (com limites reduzidos)', () => {
    const b = bytesValidos();
    const L = LIMITES_CONTEINER;
    expect(recusa(b, { ...L, bytesArquivo: b.length - 1 })[0]?.mensagem).toMatch(/^arquivo grande demais/);
    expect(recusa(b, { ...L, entradas: 3 })[0]?.mensagem).toBe('entradas demais no pacote (6; limite 3)');
    expect(recusa(b, { ...L, bytesJson: 100 })[0]?.mensagem).toMatch(/^entrada grande demais/);
    expect(recusa(b, { ...L, bytesMidia: 4 })[0]?.mensagem).toMatch(/^entrada grande demais/);
    expect(recusa(b, { ...L, bytesDescomprimidosTotal: 100 })[0]?.mensagem).toMatch(/^conteúdo descomprimido grande demais/);
  });

  it('os limites padrão são os do ADR-0004', () => {
    expect(LIMITES_CONTEINER).toMatchObject({
      bytesArquivo: 1024 ** 3,
      entradas: 5_000,
      bytesJson: 64 * 1024 ** 2,
      bytesMidia: 64 * 1024 ** 2,
      bytesDescomprimidosTotal: 2 * 1024 ** 3,
      razaoCompressao: 200,
    });
  });
});

describe('mídias: divergência descarta a mídia com aviso, sem derrubar o projeto', () => {
  function comMidiaAdulterada(conteudo: Uint8Array) {
    const p = pacoteValido();
    const alvo = p.manifesto.midias[0]!;
    const e = entradasBrutas(p).map((x) => (x.nome === alvo.caminho ? { ...x, conteudo } : x));
    return { p, alvo, r: lerProjeto(montarZip(e)) };
  }

  it('sha256 divergente', () => {
    const outro = PNG.slice();
    outro[12] = 99;
    const { alvo, r } = comMidiaAdulterada(outro);
    if (!r.ok) throw new Error('deveria abrir');
    expect(r.avisos).toEqual([{ caminho: alvo.caminho, mensagem: 'sha256 não confere com o manifesto; mídia descartada' }]);
    expect(r.pacote.manifesto.midias.map((m) => m.sha256)).not.toContain(alvo.sha256);
    expect(r.pacote.midias.has(alvo.sha256)).toBe(false);
    expect(r.pacote.midias.size).toBe(1);
  });

  it('assinatura binária diferente do tipo declarado (bytes e sha256 coerentes)', () => {
    const p = pacoteValido();
    const falsoPng = texto('<svg onload=alert(1)>');
    const h = sha(falsoPng);
    p.manifesto.midias = [{ caminho: `midias/${h}.png`, sha256: h, bytes: falsoPng.length, tipo: 'image/png' }];
    const e = entradasBrutas({ ...p, midias: new Map([[h, falsoPng]]) });
    const r = lerProjeto(montarZip(e));
    expect(r.ok && r.avisos).toEqual([{ caminho: `midias/${h}.png`, mensagem: 'conteúdo não corresponde ao tipo declarado; mídia descartada' }]);
  });

  it('mídia declarada e ausente; mídia presente e não declarada', () => {
    const p = pacoteValido();
    const [m0, m1] = p.manifesto.midias;
    const e = entradasBrutas(p).filter((x) => x.nome !== m0!.caminho);
    const extraNome = `midias/${'e'.repeat(64)}.png`;
    e.push({ nome: extraNome, conteudo: PNG, metodo: 0 });
    const r = lerProjeto(montarZip(e));
    if (!r.ok) throw new Error('deveria abrir');
    expect(r.avisos).toEqual([
      { caminho: m0!.caminho, mensagem: 'mídia declarada e ausente no pacote; mídia descartada' },
      { caminho: extraNome, mensagem: 'mídia não declarada no manifesto; descartada' },
    ]);
    expect([...r.pacote.midias.keys()]).toEqual([m1!.sha256]);
  });

  it('miniatura que não é PNG é descartada com aviso', () => {
    const e: Zippable = {};
    for (const x of entradasBrutas()) e[x.nome] = [x.conteudo, { level: x.metodo === 0 ? 0 : 6 }];
    e['miniatura.png'] = JPEG;
    const r = lerProjeto(zipSync(e));
    expect(r.ok && r.avisos).toEqual([{ caminho: 'miniatura.png', mensagem: 'a miniatura não é PNG; descartada' }]);
    expect(r.ok && r.pacote.miniatura).toBeUndefined();
  });
});

describe('correções da revisão de segurança do M1-T05', () => {
  const repetitivo = (n: number) => {
    const p = pacoteValido();
    p.documento.corpo[0]!.blocos = Array.from({ length: n }, (_, i) => ({
      tipo: 'paragrafo' as const,
      id: `par_rep_${String(i).padStart(4, '0')}`,
      conteudo: [{ tipo: 'texto' as const, texto: '_'.repeat(100_000) }],
    }));
    return p;
  };

  it('A1: empacotar recusa o que a leitura recusaria (texto repetitivo acima do piso da razão)', () => {
    const r = empacotarProjeto(repetitivo(20));
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.erros[0]!.mensagem).toBe('o projeto passaria do limite de leitura: razão de compressão acima do limite (200:1)');
  });

  it('A1: texto repetitivo abaixo do piso de 1 MB é salvo e relido', () => {
    const p = repetitivo(5);
    expect(lerProjeto(bytesValidos(p))).toEqual({ ok: true, pacote: p, avisos: [] });
  });

  it('A2: mídia não declarada não é descomprimida (dados inválidos viram só aviso)', () => {
    const lixo = { nome: `midias/${'d'.repeat(64)}.png`, conteudo: texto('x'), sufixo: new Uint8Array([0xff, 0xff, 0xff]) };
    const r = lerProjeto(montarZip([...entradasBrutas(), lixo]));
    expect(r.ok && r.avisos).toEqual([{ caminho: lixo.nome, mensagem: 'mídia não declarada no manifesto; descartada' }]);
  });

  it('A2: bibliografia.json é recusado sem ser descomprimido', () => {
    const e = [...entradasBrutas(), { nome: 'bibliografia.json', conteudo: texto('{}'), crc: 1 }];
    expect(recusa(montarZip(e))).toEqual([{ caminho: 'bibliografia.json', mensagem: 'conteúdo não suportado nesta versão do formato' }]);
  });

  it('A3: manifesto inválido encerra a leitura antes do documento', () => {
    const p = pacoteValido();
    (p.manifesto as unknown as Record<string, unknown>).extra = 1;
    const e = entradasBrutas(p).map((x) => (x.nome === 'documento.json' ? { ...x, crc: 1 } : x));
    expect(recusa(montarZip(e))).toEqual([{ caminho: 'manifesto', mensagem: 'campo não permitido: "extra"' }]);
  });

  it('A3: manifesto acima de 2 MB é recusado antes de descomprimir', () => {
    const e = entradasBrutas().map((x) => (x.nome === 'manifesto.json' ? { ...x, descomprimido: 2 * 1024 * 1024 + 1 } : x));
    expect(recusa(montarZip(e))[0]?.mensagem).toMatch(/^entrada grande demais \(2097153 bytes; limite 2097152\)/);
  });

  it('A4: bytes depois do fim do fluxo deflate são recusados', () => {
    const e = entradasBrutas().map((x) => (x.nome === 'documento.json' ? { ...x, sufixo: texto('ESCONDIDO') } : x));
    expect(recusa(montarZip(e))).toEqual([{ caminho: 'documento.json', mensagem: 'dados extras após o fim da compressão' }]);
  });

  it('A4: lacuna entre entradas é recusada', () => {
    const e = entradasBrutas().map((x) => (x.nome === 'documento.json' ? { ...x, lacunaAntes: 64 } : x));
    expect(recusa(montarZip(e))[0]?.mensagem).toBe('cabeçalho local ausente, sobreposto, fora de ordem ou com lacuna');
  });

  it('A4: lacuna entre a última entrada e o diretório central é recusada', () => {
    expect(recusa(montarZip(entradasBrutas(), { lacunaFinal: 32 }))).toEqual([
      { caminho: 'arquivo', mensagem: 'dados não declarados entre as entradas e o diretório central' },
    ]);
  });

  it('A5: mídia comprimida (deflate) também sai em memória própria, fora do pool de Buffer', () => {
    const e = entradasBrutas().map((x) => (x.nome.startsWith('midias/') ? { ...x, metodo: 8 as const } : x));
    const r = lerProjeto(montarZip(e));
    if (!r.ok) throw new Error('deveria abrir');
    expect(r.avisos).toEqual([]);
    for (const d of r.pacote.midias.values()) expect(d.buffer.byteLength).toBe(d.length);
  });

  it('A4: descritor de dados (flag 8) é recusado', () => {
    const e = entradasBrutas().map((x) => (x.nome === 'documento.json' ? { ...x, flags: 8 } : x));
    expect(recusa(montarZip(e))[0]?.mensagem).toBe('opções de ZIP não suportadas');
  });

  it('A5: o pacote lido não compartilha memória com o Buffer de entrada', () => {
    const entrada = Buffer.from(bytesValidos());
    const r = lerProjeto(entrada);
    if (!r.ok) throw new Error('deveria abrir');
    const antes = [...r.pacote.midias.values()].map((d) => [...d]);
    entrada.fill(0);
    expect([...r.pacote.midias.values()].map((d) => [...d])).toEqual(antes);
    for (const d of r.pacote.midias.values()) expect(d.buffer.byteLength).toBe(d.length);
  });

  it('mídia declarada com CRC errado é descartada com aviso (não derruba o projeto)', () => {
    const p = pacoteValido();
    const alvo = p.manifesto.midias[0]!;
    const e = entradasBrutas(p).map((x) => (x.nome === alvo.caminho ? { ...x, crc: 7 } : x));
    const r = lerProjeto(montarZip(e));
    expect(r.ok && r.avisos).toEqual([{ caminho: alvo.caminho, mensagem: 'CRC-32 não confere (arquivo corrompido); mídia descartada' }]);
  });
});
