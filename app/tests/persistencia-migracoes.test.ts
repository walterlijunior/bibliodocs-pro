// Testes do grupo PER (M1-T07): migrações do formato de projeto — cadeia aplicada na ordem, fixtures por versão,
// versão futura recusada para edição e backup obrigatório antes de migrar (ADR-0004, seções 2 e 4).
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import {
  MIGRACOES_REGISTRADAS,
  migrarParaAtual,
  MIMETYPE_PROJETO,
  problemasDoRegistro,
  validarDocumentoV1,
  validarManifestoV1,
  VERSAO_FORMATO_ATUAL,
  versaoFormatoDeclarada,
  type JsonProjeto,
  type Migracao,
} from '../src/dominio/esquemas';
import {
  abrirProjeto,
  lerProjeto,
  nomeBackupMigracao,
  salvarProjeto,
  SISTEMA_ARQUIVOS_NODE,
  type PacoteProjeto,
  type PacoteSomenteLeitura,
  type SistemaArquivos,
} from '../src/persistencia';
import { MIGRACAO_FICTICIA_V0_V1 } from './apoio/migracao-ficticia';
import { montarZip, type EntradaBruta } from './apoio/zip-bruto';

const pastaMigracoes = join(__dirname, 'fixtures', 'migracoes');
const lerJson = (...partes: string[]): unknown => JSON.parse(readFileSync(join(...partes), 'utf8'));
const fixture = (de: number, lado: 'entrada' | 'saida'): JsonProjeto => {
  const pasta = join(pastaMigracoes, `v${de}-para-v${de + 1}`);
  return { manifesto: lerJson(pasta, `${lado}-manifesto.json`), documento: lerJson(pasta, `${lado}-documento.json`) };
};
const texto = (s: string) => new TextEncoder().encode(s);

/** `.bdp` montado à mão (o empacotador só escreve a versão atual). */
function bdp(json: JsonProjeto, extras: EntradaBruta[] = []): Uint8Array {
  return montarZip([
    { nome: 'mimetype', conteudo: texto(MIMETYPE_PROJETO), metodo: 0 },
    { nome: 'manifesto.json', conteudo: texto(JSON.stringify(json.manifesto)) },
    { nome: 'documento.json', conteudo: texto(JSON.stringify(json.documento)) },
    ...extras,
  ]);
}

function congelarFundo<T>(v: T): T {
  if (v !== null && typeof v === 'object') {
    for (const filho of Object.values(v)) congelarFundo(filho);
    Object.freeze(v);
  }
  return v;
}

/** Migração de marcação para testar a ordem: acrescenta `de` à lista `passos` do manifesto. */
const marcadora = (de: number): Migracao => ({
  de,
  migrar: (json) => {
    const m = json.manifesto as { passos?: number[] };
    return { manifesto: { ...m, versaoFormato: de + 1, passos: [...(m.passos ?? []), de] }, documento: json.documento };
  },
});

describe('migrarParaAtual — cadeia (função pura)', () => {
  it('fixture v0 → saída esperada v1, e a saída passa na validação v1', () => {
    const r = migrarParaAtual(fixture(0, 'entrada'), [MIGRACAO_FICTICIA_V0_V1]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.json).toEqual(fixture(0, 'saida'));
    expect(r.passos).toEqual([0, 1]);
    expect(validarManifestoV1(r.json.manifesto).ok).toBe(true);
    expect(validarDocumentoV1(r.json.documento).ok).toBe(true);
  });

  it('nenhuma migração (registradas e fictícia) altera a entrada: JSON congelado da fixture', () => {
    for (const m of [...MIGRACOES_REGISTRADAS, MIGRACAO_FICTICIA_V0_V1]) {
      const entrada = congelarFundo(fixture(m.de, 'entrada'));
      const copia = structuredClone(entrada);
      expect(migrarParaAtual(entrada, [m], m.de + 1).ok).toBe(true);
      expect(entrada).toEqual(copia);
    }
  });

  it('aplica na ordem das versões, mesmo com o registro fora de ordem, e só a partir da versão do arquivo', () => {
    const registro = [marcadora(2), marcadora(0), marcadora(1)];
    const desde0 = migrarParaAtual({ manifesto: { versaoFormato: 0 }, documento: {} }, registro, 3);
    expect(desde0).toMatchObject({ ok: true, passos: [0, 1, 2, 3], json: { manifesto: { versaoFormato: 3, passos: [0, 1, 2] } } });
    const desde1 = migrarParaAtual({ manifesto: { versaoFormato: 1 }, documento: {} }, registro, 3);
    expect(desde1).toMatchObject({ ok: true, passos: [1, 2, 3], json: { manifesto: { passos: [1, 2] } } });
  });

  it('versão atual, ausente ou de outro tipo passa sem migrar (a validação aponta o erro depois)', () => {
    for (const versaoFormato of [VERSAO_FORMATO_ATUAL, undefined, '0', 0.5, -1]) {
      const json = { manifesto: { versaoFormato }, documento: {} };
      expect(migrarParaAtual(json, [MIGRACAO_FICTICIA_V0_V1])).toEqual({ ok: true, json, passos: [] });
    }
  });

  it('versão antiga sem migração registrada é recusada com mensagem pt-BR', () => {
    expect(migrarParaAtual(fixture(0, 'entrada'), [])).toEqual({
      ok: false,
      erros: [{ caminho: 'manifesto.versaoFormato', mensagem: 'projeto em formato antigo demais (versão 0) para esta versão do BiblioDocs Pro' }],
    });
  });

  it('exceção dentro da migração vira erro; migração que não produz a versão seguinte também', () => {
    const lanca: Migracao = { de: 0, migrar: () => { throw new Error('x'); } };
    const naoAvanca: Migracao = { de: 0, migrar: (j) => ({ ...j }) };
    const msg = (m: Migracao) => {
      const r = migrarParaAtual(fixture(0, 'entrada'), [m]);
      return r.ok ? '' : r.erros[0]!.mensagem;
    };
    expect(msg(lanca)).toBe('falha ao atualizar o formato do projeto da versão 0 para a 1');
    expect(msg(naoAvanca)).toBe('a atualização da versão 0 não produziu a versão 1');
  });

  it('registro incoerente não migra nada', () => {
    const r = migrarParaAtual({ manifesto: { versaoFormato: 0 }, documento: {} }, [marcadora(0), marcadora(0)], 1);
    expect(r).toMatchObject({ ok: false, erros: [{ mensagem: 'o aplicativo tem um registro de migrações incoerente' }] });
  });

  it('aninhamento patológico é recusado antes de chamar a migração (sem estourar a pilha)', () => {
    let fundo: unknown = [];
    for (let i = 0; i < 100_000; i++) fundo = [fundo];
    let chamada = false;
    const espia: Migracao = { de: 0, migrar: (j) => ((chamada = true), j) };
    const r = migrarParaAtual({ manifesto: { versaoFormato: 0 }, documento: { corpo: fundo } }, [espia]);
    expect(r.ok).toBe(false);
    expect(chamada).toBe(false);
  });
});

describe('registro de migrações', () => {
  it('problemasDoRegistro aponta repetição, buraco e fim fora da versão atual', () => {
    expect(problemasDoRegistro([], 1)).toEqual([]);
    expect(problemasDoRegistro([marcadora(0), marcadora(1)], 2)).toEqual([]);
    expect(problemasDoRegistro([marcadora(0), marcadora(0)], 1)).toContain('duas migrações a partir da versão 0');
    expect(problemasDoRegistro([marcadora(0), marcadora(2)], 3)).toContain('falta a migração da versão 1');
    expect(problemasDoRegistro([marcadora(0)], 2)).toContain('a cadeia termina na versão 1, não na 2');
  });

  it('o registro de produção é coerente (no v1, vazio)', () => {
    expect(problemasDoRegistro(MIGRACOES_REGISTRADAS)).toEqual([]);
    expect(VERSAO_FORMATO_ATUAL === 1 ? MIGRACOES_REGISTRADAS : []).toEqual([]);
  });

  it('existe fixture para a versão atual e para cada migração registrada (RNF-16)', () => {
    const atual = join(__dirname, 'fixtures', `projeto-v${VERSAO_FORMATO_ATUAL}`);
    expect(existsSync(join(atual, 'manifesto-valido.json'))).toBe(true);
    expect(existsSync(join(atual, 'documento-valido.json'))).toBe(true);
    for (const m of [...MIGRACOES_REGISTRADAS, MIGRACAO_FICTICIA_V0_V1]) {
      const pasta = join(pastaMigracoes, `v${m.de}-para-v${m.de + 1}`);
      expect(readdirSync(pasta).filter((n) => n.endsWith('.json')).sort(), pasta).toEqual([
        'entrada-documento.json',
        'entrada-manifesto.json',
        'saida-documento.json',
        'saida-manifesto.json',
      ]);
      const r = migrarParaAtual(fixture(m.de, 'entrada'), [m], m.de + 1);
      expect(r.ok && r.json, pasta).toEqual(fixture(m.de, 'saida'));
    }
  });

  it('versaoFormatoDeclarada só aceita inteiro não negativo', () => {
    expect(versaoFormatoDeclarada({ versaoFormato: 3 })).toBe(3);
    for (const m of [null, [], 'x', {}, { versaoFormato: '1' }, { versaoFormato: 1.5 }, { versaoFormato: -2 }, { versaoFormato: 2 ** 60 }]) {
      expect(versaoFormatoDeclarada(m)).toBeNull();
    }
  });
});

describe('lerProjeto — versões do formato', () => {
  it('arquivo v0 é migrado na leitura e informa o caminho percorrido', () => {
    const r = lerProjeto(bdp(fixture(0, 'entrada')), undefined, [MIGRACAO_FICTICIA_V0_V1]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migracao).toEqual([0, 1]);
    expect(r.pacote.manifesto).toEqual(fixture(0, 'saida').manifesto);
    expect(r.pacote.documento).toEqual(fixture(0, 'saida').documento);
  });

  it('arquivo v0 sem migração registrada (registro de produção) é recusado', () => {
    const r = lerProjeto(bdp(fixture(0, 'entrada')));
    expect(r).toMatchObject({ ok: false, erros: [{ caminho: 'manifesto.versaoFormato' }] });
  });

  it('arquivo migrado com problema na saída é recusado pela validação v1', () => {
    const quebrada: Migracao = { de: 0, migrar: (j) => ({ ...MIGRACAO_FICTICIA_V0_V1.migrar(j), documento: { id: 'x' } }) };
    const r = lerProjeto(bdp(fixture(0, 'entrada')), undefined, [quebrada]);
    expect(r.ok).toBe(false);
  });

  it('versão futura: recusa a edição e oferece a leitura quando o conteúdo é compreensível', () => {
    const futuro = fixture(0, 'saida');
    (futuro.manifesto as { versaoFormato: number }).versaoFormato = VERSAO_FORMATO_ATUAL + 1;
    const r = lerProjeto(bdp(futuro));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toEqual([{ caminho: 'manifesto.versaoFormato', mensagem: 'projeto criado por uma versão mais nova do BiblioDocs Pro' }]);
    expect(r.versaoFutura?.versaoFormato).toBe(VERSAO_FORMATO_ATUAL + 1);
    expect(r.versaoFutura?.leitura?.pacote.documento).toEqual(futuro.documento);
  });

  it('versão futura com conteúdo desconhecido: recusa sem leitura', () => {
    const futuro = fixture(0, 'saida');
    Object.assign(futuro.documento as object, { campoDoV2: true });
    (futuro.manifesto as { versaoFormato: number }).versaoFormato = 7;
    const r = lerProjeto(bdp(futuro));
    expect(r).toMatchObject({ ok: false, versaoFutura: { versaoFormato: 7, leitura: null } });
  });

  it('versão futura com arquivo que o v1 não suporta recebe a mensagem de versão nova, não a de conteúdo', () => {
    const futuro = fixture(0, 'saida');
    (futuro.manifesto as { versaoFormato: number }).versaoFormato = 2;
    const r = lerProjeto(bdp(futuro, [{ nome: 'bibliografia.json', conteudo: texto('{}') }]));
    expect(r).toMatchObject({
      ok: false,
      erros: [{ mensagem: 'projeto criado por uma versão mais nova do BiblioDocs Pro' }],
      versaoFutura: { versaoFormato: 2, leitura: null },
    });
  });
});

describe('abrirProjeto — backup obrigatório antes de migrar', () => {
  let pasta: string;
  beforeEach(() => {
    pasta = mkdtempSync(join(tmpdir(), 'bdp-migrar-'));
  });
  afterEach(() => rmSync(pasta, { recursive: true, force: true }));

  const quando = new Date(2026, 9, 16, 9, 5, 7, 42);
  const gravarV0 = () => {
    const caminho = join(pasta, 'antigo.bdp');
    const bytes = bdp(fixture(0, 'entrada'));
    writeFileSync(caminho, bytes);
    return { caminho, bytes };
  };

  it('grava cópia idêntica do original em backups/<id>/ antes de entregar o projeto migrado; o original não muda', async () => {
    const { caminho, bytes } = gravarV0();
    const backups = join(pasta, 'backups');
    const r = await abrirProjeto(caminho, { migracoes: [MIGRACAO_FICTICIA_V0_V1], pastaBackups: backups, agora: () => quando });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migracao).toEqual([0, 1]);
    expect(r.backupMigracao).toBe(join(backups, 'prj_Antigo0001', '20261016-090507-042-formato-v0.bdp'));
    expect(new Uint8Array(readFileSync(r.backupMigracao!))).toEqual(bytes);
    expect(new Uint8Array(readFileSync(caminho))).toEqual(bytes);
    expect(readdirSync(dirname(r.backupMigracao!))).toEqual(['20261016-090507-042-formato-v0.bdp']);
  });

  it('sem pasta de backups o projeto antigo não abre', async () => {
    const { caminho } = gravarV0();
    const r = await abrirProjeto(caminho, { migracoes: [MIGRACAO_FICTICIA_V0_V1] });
    expect(r).toEqual({
      ok: false,
      erros: [
        {
          caminho: 'arquivo',
          mensagem: 'não foi possível guardar a cópia de segurança exigida antes de atualizar o formato do projeto; o arquivo não foi alterado',
        },
      ],
    });
  });

  it('falha ao criar a pasta ou ao gravar o backup: o projeto não abre e o original fica intacto', async () => {
    const { caminho, bytes } = gravarV0();
    const falhaPasta: SistemaArquivos = { ...SISTEMA_ARQUIVOS_NODE, criarPasta: () => Promise.reject(Object.assign(new Error('EACCES'), { code: 'EACCES' })) };
    const falhaGravar: SistemaArquivos = {
      ...SISTEMA_ARQUIVOS_NODE,
      criarExclusivo: () => Promise.reject(Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' })),
    };
    for (const fs of [falhaPasta, falhaGravar]) {
      const r = await abrirProjeto(caminho, { fs, migracoes: [MIGRACAO_FICTICIA_V0_V1], pastaBackups: join(pasta, 'backups') });
      expect(r.ok).toBe(false);
    }
    expect(new Uint8Array(readFileSync(caminho))).toEqual(bytes);
  });

  it('arquivo na versão atual não gera backup', async () => {
    const caminho = join(pasta, 'atual.bdp');
    const saida = fixture(0, 'saida');
    writeFileSync(caminho, bdp(saida));
    const backups = join(pasta, 'backups');
    const r = await abrirProjeto(caminho, { migracoes: [MIGRACAO_FICTICIA_V0_V1], pastaBackups: backups });
    expect(r).toMatchObject({ ok: true, migracao: [], backupMigracao: null });
    expect(existsSync(backups)).toBe(false);
  });

  it('o projeto migrado, salvo de novo, vira v1 e reabre sem migrar', async () => {
    const { caminho } = gravarV0();
    const r = await abrirProjeto(caminho, { migracoes: [MIGRACAO_FICTICIA_V0_V1], pastaBackups: join(pasta, 'backups') });
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    expect((await salvarProjeto(caminho, r.pacote)).ok).toBe(true);
    const de_novo = await abrirProjeto(caminho, { migracoes: [MIGRACAO_FICTICIA_V0_V1] });
    expect(de_novo).toMatchObject({ ok: true, migracao: [], backupMigracao: null });
    if (de_novo.ok) expect(de_novo.pacote.documento).toEqual(fixture(0, 'saida').documento);
  });

  it('versão futura no disco: nada de backup e a edição é recusada', async () => {
    const caminho = join(pasta, 'futuro.bdp');
    const futuro = fixture(0, 'saida');
    (futuro.manifesto as { versaoFormato: number }).versaoFormato = 2;
    writeFileSync(caminho, bdp(futuro));
    const backups = join(pasta, 'backups');
    const r = await abrirProjeto(caminho, { pastaBackups: backups });
    expect(r).toMatchObject({ ok: false, versaoFutura: { versaoFormato: 2 } });
    expect(existsSync(backups)).toBe(false);
  });

  it('nome do backup: AAAAMMDD-HHMMSS-mmm-formato-v<N>.bdp na hora local', () => {
    expect(nomeBackupMigracao(new Date(2027, 0, 2, 3, 4, 5, 6), 3)).toBe('20270102-030405-006-formato-v3.bdp');
  });
});


/** Entrada que daria erro se fosse descomprimida (bytes depois do fim do deflate). */
const naoDescomprimivel = (nome: string): EntradaBruta => ({ nome, conteudo: texto('{}'), sufixo: texto('LIXO') });
const comVersao = (json: JsonProjeto, versaoFormato: number): JsonProjeto => ({
  manifesto: { ...(json.manifesto as object), versaoFormato },
  documento: json.documento,
});

describe('correções da revisão do M1-T07', () => {
  it('M1: versão futura com arquivo novo no pacote (JSON ou mídia de outro tipo) recebe a mensagem de versão nova, sem descomprimir', () => {
    const v2 = comVersao(fixture(0, 'saida'), 2);
    for (const nome of ['estilos.json', `midias/${'a'.repeat(64)}.svg`]) {
      expect(lerProjeto(bdp(v2, [naoDescomprimivel(nome)]))).toMatchObject({
        ok: false,
        erros: [{ mensagem: 'projeto criado por uma versão mais nova do BiblioDocs Pro' }],
        versaoFutura: { versaoFormato: 2, leitura: null },
      });
    }
  });

  it('M1: na versão atual, nome desconhecido continua recusado pelo nome, sem descomprimir', () => {
    expect(lerProjeto(bdp(fixture(0, 'saida'), [naoDescomprimivel('estilos.json')]))).toEqual({
      ok: false,
      erros: [{ caminho: 'estilos.json', mensagem: 'nome de entrada não permitido no pacote' }],
    });
  });

  it('M2: o pacote de leitura mantém a versão do arquivo e não pode ser salvo (nem na compilação, nem na execução)', async () => {
    const r = lerProjeto(bdp(comVersao(fixture(0, 'saida'), 2)));
    if (r.ok || !r.versaoFutura?.leitura) throw new Error('esperava leitura de versão futura');
    const leitura = r.versaoFutura.leitura.pacote;
    expect(leitura.manifesto.versaoFormato).toBe(2);
    expectTypeOf<PacoteSomenteLeitura>().not.toExtend<PacoteProjeto>();

    const pasta = mkdtempSync(join(tmpdir(), 'bdp-leitura-'));
    try {
      const destino = join(pasta, 'futuro.bdp');
      const s = await salvarProjeto(destino, leitura as unknown as PacoteProjeto);
      expect(s).toMatchObject({ ok: false, codigo: 'PACOTE_INVALIDO' });
      expect(existsSync(destino)).toBe(false);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it('B2: migração que devolve algo que não é objeto vira erro, sem lançar', () => {
    for (const saida of [null, undefined, { manifesto: null, documento: {} }, 42]) {
      const ruim: Migracao = { de: 0, migrar: () => saida as unknown as JsonProjeto };
      expect(migrarParaAtual(fixture(0, 'entrada'), [ruim])).toMatchObject({ ok: false, erros: [{ caminho: 'manifesto.versaoFormato' }] });
      expect(lerProjeto(bdp(fixture(0, 'entrada')), undefined, [ruim]).ok).toBe(false);
    }
  });

  it('B3: arquivo antigo é recusado antes de descomprimir o documento (sem migração, ou com conteúdo não suportado)', () => {
    const entrada = fixture(0, 'entrada');
    const semDocumento = (extras: EntradaBruta[]) =>
      montarZip([
        { nome: 'mimetype', conteudo: texto(MIMETYPE_PROJETO), metodo: 0 },
        { nome: 'manifesto.json', conteudo: texto(JSON.stringify(entrada.manifesto)) },
        naoDescomprimivel('documento.json'),
        ...extras,
      ]);
    expect(lerProjeto(semDocumento([]))).toEqual({
      ok: false,
      erros: [{ caminho: 'manifesto.versaoFormato', mensagem: 'projeto em formato antigo demais (versão 0) para esta versão do BiblioDocs Pro' }],
    });
    expect(lerProjeto(semDocumento([naoDescomprimivel('bibliografia.json')]), undefined, [MIGRACAO_FICTICIA_V0_V1])).toEqual({
      ok: false,
      erros: [{ caminho: 'bibliografia.json', mensagem: 'conteúdo não suportado nesta versão do formato' }],
    });
  });

  it('B4: migração que muda o id do projeto é recusada', () => {
    const trocaId: Migracao = {
      de: 0,
      migrar: (j) => {
        const r = MIGRACAO_FICTICIA_V0_V1.migrar(j);
        return { ...r, manifesto: { ...(r.manifesto as object), id: 'prj_Outro00001' } };
      },
    };
    expect(migrarParaAtual(fixture(0, 'entrada'), [trocaId])).toEqual({
      ok: false,
      erros: [{ caminho: 'manifesto.versaoFormato', mensagem: 'a atualização da versão 0 mudou a identificação do projeto' }],
    });
  });

  it('arquivo antigo com mídia: a mídia declarada atravessa a migração e é lida', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const h = createHash('sha256').update(png).digest('hex');
    const entrada = fixture(0, 'entrada');
    const midia = { caminho: `midias/${h}.png`, sha256: h, bytes: png.length, tipo: 'image/png' };
    const json = { manifesto: { ...(entrada.manifesto as object), midias: [midia] }, documento: entrada.documento };
    const r = lerProjeto(bdp(json, [{ nome: midia.caminho, conteudo: png, metodo: 0 }]), undefined, [MIGRACAO_FICTICIA_V0_V1]);
    expect(r).toMatchObject({ ok: true, avisos: [], migracao: [0, 1] });
    if (r.ok) expect(r.pacote.midias.get(h)).toEqual(png);
  });

  describe('backup', () => {
    let pasta: string;
    beforeEach(() => {
      pasta = mkdtempSync(join(tmpdir(), 'bdp-backup-'));
    });
    afterEach(() => rmSync(pasta, { recursive: true, force: true }));

    const quando = new Date(2026, 9, 16, 9, 5, 7, 42);
    const abrirV0 = (fs?: SistemaArquivos) => {
      const caminho = join(pasta, 'antigo.bdp');
      if (!existsSync(caminho)) writeFileSync(caminho, bdp(fixture(0, 'entrada')));
      return abrirProjeto(caminho, { fs, migracoes: [MIGRACAO_FICTICIA_V0_V1], pastaBackups: join(pasta, 'backups'), agora: () => quando });
    };

    it('B1: duas aberturas no mesmo milissegundo geram dois backups; nenhum é substituído', async () => {
      const a = await abrirV0();
      const b = await abrirV0();
      if (!a.ok || !b.ok) throw new Error('esperava abrir');
      expect(a.backupMigracao).not.toBe(b.backupMigracao);
      expect(readdirSync(join(pasta, 'backups', 'prj_Antigo0001')).sort()).toEqual([
        '20261016-090507-042-formato-v0-2.bdp',
        '20261016-090507-042-formato-v0.bdp',
      ]);
    });

    it('falha na troca do backup: o projeto não abre, o original fica intacto e não sobra temporário', async () => {
      const original = bdp(fixture(0, 'entrada'));
      const falhaTroca: SistemaArquivos = {
        ...SISTEMA_ARQUIVOS_NODE,
        renomear: () => Promise.reject(Object.assign(new Error('EIO'), { code: 'EIO' })),
      };
      const r = await abrirV0(falhaTroca);
      expect(r.ok).toBe(false);
      expect(new Uint8Array(readFileSync(join(pasta, 'antigo.bdp')))).toEqual(original);
      expect(readdirSync(join(pasta, 'backups', 'prj_Antigo0001'))).toEqual([]);
    });

    it('erro ao conferir o nome do backup (não ENOENT) não é tratado como nome livre: o projeto não abre', async () => {
      const semAcesso: SistemaArquivos = {
        ...SISTEMA_ARQUIVOS_NODE,
        info: (c) => (c.includes('backups') ? Promise.reject(Object.assign(new Error('EACCES'), { code: 'EACCES' })) : SISTEMA_ARQUIVOS_NODE.info(c)),
      };
      expect((await abrirV0(semAcesso)).ok).toBe(false);
      expect(readdirSync(join(pasta, 'backups', 'prj_Antigo0001'))).toEqual([]);
    });

    it('nome do backup com ordem: -2, -3... antes de .bdp', () => {
      expect(nomeBackupMigracao(new Date(2027, 0, 2, 3, 4, 5, 6), 3, 1)).toBe('20270102-030405-006-formato-v3.bdp');
      expect(nomeBackupMigracao(new Date(2027, 0, 2, 3, 4, 5, 6), 3, 4)).toBe('20270102-030405-006-formato-v3-4.bdp');
    });
  });
});
