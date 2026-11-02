// Testes do M1-T08 (grupo SEG/IPC): remetente (C-11), argumentos (C-11), identificadores opacos e destinos só por
// diálogo (C-12), API do preload (C-10) e protocolo do processo leitor. Os manipuladores rodam sem o Electron; a
// leitura usa abrirProjeto de verdade, na mesma forma que o processo leitor responde.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACOES_EDICAO, CANAIS_EDICAO, CANAIS_PROJETOS, CANAIS_RECUPERACAO, type AcaoEdicao, type PacoteTransferivel, type ResultadoAbrir } from '../src/aplicacao';
import type { Manifesto } from '../src/dominio/esquemas';
import type { Documento } from '../src/dominio/modelo';
import { abrirProjeto, empacotarProjeto, salvarProjeto } from '../src/persistencia';
import { criarManipuladoresProjetos, ErroIpcRecusado, nomeSugerido, type DependenciasProjetos } from '../src/principal/ipc/manipuladores-projetos';
import { lerPacoteTransferivel } from '../src/principal/ipc/argumentos';
import { criarManipuladoresEdicao } from '../src/principal/ipc/manipuladores-edicao';
import { lerPedidoLeitor, lerRespostaLeitor, paraRespostaLeitor } from '../src/principal/ipc/protocolo-leitor';
import { remetentePermitido, type InfoRemetente } from '../src/principal/ipc/remetente';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';
import { criarApiBiblioDocs } from '../src/preload/api';

const fixtures = join(__dirname, 'fixtures', 'projeto-v1');
const lerFixture = <T>(nome: string): T => JSON.parse(readFileSync(join(fixtures, nome), 'utf8')) as T;

function pacote(titulo = 'Meu trabalho'): PacoteTransferivel {
  const manifesto = lerFixture<Manifesto>('manifesto-valido.json');
  manifesto.midias = [];
  const documento = lerFixture<Documento>('documento-valido.json');
  documento.metadados.titulo = [{ tipo: 'texto', texto: titulo }];
  return { manifesto, documento, midias: [] };
}

const JANELA = 7;
const LEGITIMO: InfoRemetente = { idConteudo: JANELA, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };

let pasta: string;
let logs: string[];
let dialogo: { abrir: string | null; salvar: string | null; chamadas: number };

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'bdp-ipc-'));
  logs = [];
  dialogo = { abrir: null, salvar: null, chamadas: 0 };
});
afterEach(() => rmSync(pasta, { recursive: true, force: true }));

function montar(extra: Partial<DependenciasProjetos> = {}) {
  return criarManipuladoresProjetos({
    origem: ORIGEM_PRODUCAO,
    conteudosPermitidos: () => new Set([JANELA]),
    escolherArquivoParaAbrir: async () => (dialogo.chamadas++, dialogo.abrir),
    escolherDestino: async () => (dialogo.chamadas++, dialogo.salvar),
    ler: async (c) => paraRespostaLeitor(await abrirProjeto(c, { pastaBackups: join(pasta, 'backups') })),
    salvar: (d, p) => salvarProjeto(d, p),
    log: (m) => logs.push(m),
    ...extra,
  });
}

const chamar = (m: ReturnType<typeof montar>, canal: string, r: InfoRemetente, ...args: unknown[]) =>
  m.manipuladores[canal as keyof typeof m.manipuladores](r, args);

async function salvarComoEm(m: ReturnType<typeof montar>, nome: string) {
  dialogo.salvar = join(pasta, nome);
  const r = (await chamar(m, CANAIS_PROJETOS.salvarComo, LEGITIMO, pacote())) as { ok: true; identificador: string };
  expect(r.ok).toBe(true);
  return r.identificador;
}

describe('remetente (C-11)', () => {
  const permitidos = new Set([JANELA]);
  it.each<[string, InfoRemetente]>([
    ['outro webContents', { ...LEGITIMO, idConteudo: 99 }],
    ['iframe', { ...LEGITIMO, quadroPrincipal: false }],
    ['quadro destruído', { ...LEGITIMO, urlQuadro: null }],
    ['outra origem', { ...LEGITIMO, urlQuadro: 'https://exemplo.com/' }],
    ['host parecido', { ...LEGITIMO, urlQuadro: 'app://interface.evil/index.html' }],
    ['file:', { ...LEGITIMO, urlQuadro: 'file:///C:/index.html' }],
    ['credenciais', { ...LEGITIMO, urlQuadro: 'app://x@interface/index.html' }],
  ])('recusa %s', (_n, r) => {
    expect(remetentePermitido(r, ORIGEM_PRODUCAO, permitidos)).toBe(false);
  });

  it('aceita a janela principal na origem da interface', () => {
    expect(remetentePermitido(LEGITIMO, ORIGEM_PRODUCAO, permitidos)).toBe(true);
  });

  it.each(Object.values(CANAIS_PROJETOS))('%s: remetente não permitido rejeita antes de qualquer diálogo', async (canal) => {
    const m = montar();
    const args = canal === CANAIS_PROJETOS.abrir ? [] : canal === CANAIS_PROJETOS.salvar ? ['A'.repeat(22), pacote()] : [canal === CANAIS_PROJETOS.fechar ? 'A'.repeat(22) : pacote()];
    await expect(chamar(m, canal, { ...LEGITIMO, urlQuadro: 'https://exemplo.com/' }, ...args)).rejects.toBeInstanceOf(ErroIpcRecusado);
    expect(dialogo.chamadas).toBe(0);
    expect(logs.join()).toMatch(/remetente não permitido/);
  });
});

describe('argumentos (C-11)', () => {
  it.each<[string, string, unknown[]]>([
    ['abrir com argumento', CANAIS_PROJETOS.abrir, ['C:\\x.bdp']],
    ['salvar sem pacote', CANAIS_PROJETOS.salvar, ['A'.repeat(22)]],
    ['salvar com identificador curto', CANAIS_PROJETOS.salvar, ['abc', pacote()]],
    ['salvar com caminho no lugar do identificador', CANAIS_PROJETOS.salvar, ['C:\\Users\\x\\a.bdp', pacote()]],
    ['salvar com argumento a mais', CANAIS_PROJETOS.salvar, ['A'.repeat(22), pacote(), 'C:\\x.bdp']],
    ['salvarComo com destino', CANAIS_PROJETOS.salvarComo, [pacote(), 'C:\\x.bdp']],
    ['salvarComo com pacote nulo', CANAIS_PROJETOS.salvarComo, [null]],
    ['salvarComo com campo extra', CANAIS_PROJETOS.salvarComo, [{ ...pacote(), caminho: 'C:\\x.bdp' }]],
    ['salvarComo com mídias em Map', CANAIS_PROJETOS.salvarComo, [{ ...pacote(), midias: new Map() }]],
    ['salvarComo com bytes em array', CANAIS_PROJETOS.salvarComo, [{ ...pacote(), midias: [{ sha256: 'a'.repeat(64), bytes: [1, 2] }] }]],
    ['fechar com número', CANAIS_PROJETOS.fechar, [42]],
  ])('%s → rejeita', async (_n, canal, args) => {
    await expect(chamar(montar(), canal, LEGITIMO, ...args)).rejects.toBeInstanceOf(ErroIpcRecusado);
    expect(dialogo.chamadas).toBe(0);
  });

  it('mídia repetida é recusada', () => {
    const bytes = new Uint8Array([1]);
    const r = lerPacoteTransferivel({ ...pacote(), midias: [{ sha256: 'a'.repeat(64), bytes }, { sha256: 'a'.repeat(64), bytes }] });
    expect(r).toMatchObject({ ok: false, recusado: true });
  });

  it('conteúdo inválido do usuário volta como erro, sem abrir o diálogo', async () => {
    const p = pacote();
    (p.documento.metadados.titulo[0] as { texto: string }).texto = 'a\u0001b';
    const r = await chamar(montar(), CANAIS_PROJETOS.salvarComo, LEGITIMO, p);
    expect(r).toMatchObject({ ok: false, motivo: 'ERRO', codigo: 'PACOTE_INVALIDO' });
    expect(dialogo.chamadas).toBe(0);
  });

  it('manifesto de versão futura não é aceito para gravar', async () => {
    const p = pacote() as unknown as { manifesto: { versaoFormato: number } };
    p.manifesto.versaoFormato = 2;
    expect(await chamar(montar(), CANAIS_PROJETOS.salvarComo, LEGITIMO, p)).toMatchObject({ ok: false, codigo: 'PACOTE_INVALIDO' });
  });
});

describe('destinos só por diálogo (C-12)', () => {
  it('salvarComo grava no destino do diálogo e devolve só identificador e nome', async () => {
    const m = montar();
    dialogo.salvar = join(pasta, 'Novo.bdp');
    const r = await chamar(m, CANAIS_PROJETOS.salvarComo, LEGITIMO, pacote());
    expect(r).toEqual({ ok: true, identificador: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/), nomeArquivo: 'Novo.bdp', avisos: [] });
    expect(JSON.stringify(r)).not.toContain(pasta);
    expect(readdirSync(pasta)).toEqual(['Novo.bdp']);
  });

  it('salvarComo cancelado não grava nada', async () => {
    expect(await chamar(montar(), CANAIS_PROJETOS.salvarComo, LEGITIMO, pacote())).toEqual({ ok: false, motivo: 'CANCELADO' });
    expect(readdirSync(pasta)).toEqual([]);
  });

  it('salvarComo recusa destino sem .bdp', async () => {
    dialogo.salvar = join(pasta, 'Novo.docx');
    expect(await chamar(montar(), CANAIS_PROJETOS.salvarComo, LEGITIMO, pacote())).toMatchObject({ codigo: 'EXTENSAO_INVALIDA' });
    expect(readdirSync(pasta)).toEqual([]);
  });

  it('salvar grava no arquivo do identificador, sem diálogo', async () => {
    const m = montar();
    const id = await salvarComoEm(m, 'A.bdp');
    const chamadas = dialogo.chamadas;
    const r = await chamar(m, CANAIS_PROJETOS.salvar, LEGITIMO, id, pacote('Outro título'));
    expect(r).toMatchObject({ ok: true, nomeArquivo: 'A.bdp' });
    expect(dialogo.chamadas).toBe(chamadas);
    const aberto = await abrirProjeto(join(pasta, 'A.bdp'));
    expect(aberto.ok && aberto.pacote.documento.metadados.titulo[0]?.texto).toBe('Outro título');
  });

  it('backup rotativo (M2-T10): só ao gravar por cima com salvar, antes de gravar, com o id do projeto; Salvar como não faz', async () => {
    const chamadas: { caminho: string; id: string; titulo: unknown }[] = [];
    const m = montar({
      antesDeSobrescrever: async (caminho, id) => {
        const lido = await abrirProjeto(caminho);
        chamadas.push({ caminho, id, titulo: lido.ok && lido.pacote.documento.metadados.titulo[0]?.texto });
      },
    });
    const id = await salvarComoEm(m, 'A.bdp');
    expect(chamadas).toEqual([]);
    const antes = await abrirProjeto(join(pasta, 'A.bdp'));
    await chamar(m, CANAIS_PROJETOS.salvar, LEGITIMO, id, pacote('Outro título'));
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.caminho).toBe(join(pasta, 'A.bdp'));
    // Viu a versão anterior: a cópia acontece antes de gravar.
    expect(chamadas[0]!.titulo).toBe(antes.ok && antes.pacote.documento.metadados.titulo[0]?.texto);
    expect(chamadas[0]!.id).toBe(antes.ok && antes.pacote.manifesto.id);
  });

  it('identificador desconhecido, de outra janela ou fechado não grava', async () => {
    const m = montar({ conteudosPermitidos: () => new Set([JANELA, 8]) });
    const id = await salvarComoEm(m, 'A.bdp');
    const antes = readFileSync(join(pasta, 'A.bdp'));
    for (const [r, i] of [
      [LEGITIMO, 'B'.repeat(22)],
      [{ ...LEGITIMO, idConteudo: 8 }, id],
    ] as const) {
      expect(await chamar(m, CANAIS_PROJETOS.salvar, r, i, pacote('X'))).toMatchObject({ ok: false, codigo: 'NAO_ABERTO' });
    }
    await chamar(m, CANAIS_PROJETOS.fechar, LEGITIMO, id);
    expect(await chamar(m, CANAIS_PROJETOS.salvar, LEGITIMO, id, pacote('X'))).toMatchObject({ codigo: 'NAO_ABERTO' });
    expect(readFileSync(join(pasta, 'A.bdp'))).toEqual(antes);
  });

  it('janela fechada esquece os identificadores dela', async () => {
    const m = montar();
    const id = await salvarComoEm(m, 'A.bdp');
    m.registro.esquecerDono(JANELA);
    expect(await chamar(m, CANAIS_PROJETOS.salvar, LEGITIMO, id, pacote())).toMatchObject({ codigo: 'NAO_ABERTO' });
  });
});

describe('abrir', () => {
  it('cancelado', async () => {
    expect(await chamar(montar(), CANAIS_PROJETOS.abrir, LEGITIMO)).toEqual({ ok: false, motivo: 'CANCELADO' });
  });

  it('abre o arquivo do diálogo; o pacote volta sem Map e sem caminho; salvar usa o mesmo arquivo', async () => {
    const m = montar();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const { createHash } = await import('node:crypto');
    const h = createHash('sha256').update(png).digest('hex');
    const p = pacote();
    p.manifesto.midias = [{ caminho: `midias/${h}.png`, sha256: h, bytes: png.length, tipo: 'image/png' }];
    p.midias = [{ sha256: h, bytes: png }];
    dialogo.salvar = join(pasta, 'Com mídia.bdp');
    expect(await chamar(m, CANAIS_PROJETOS.salvarComo, LEGITIMO, p)).toMatchObject({ ok: true });

    dialogo.abrir = join(pasta, 'Com mídia.bdp');
    const r = (await chamar(m, CANAIS_PROJETOS.abrir, LEGITIMO)) as Extract<ResultadoAbrir, { ok: true }>;
    expect(r.ok).toBe(true);
    expect(r.projeto.nomeArquivo).toBe('Com mídia.bdp');
    expect(r.projeto.atualizacao).toBeNull();
    expect(Array.isArray(r.projeto.pacote.midias)).toBe(true);
    expect(r.projeto.pacote.midias[0]?.bytes).toEqual(png);
    expect(JSON.stringify(r)).not.toContain(pasta);
    expect(await chamar(m, CANAIS_PROJETOS.salvar, LEGITIMO, r.projeto.identificador, r.projeto.pacote)).toMatchObject({ ok: true });
  });

  it('arquivo válido com outra extensão abre sem identificador (só "Salvar como") (S8-04)', async () => {
    const m = montar();
    const id = await salvarComoEm(m, 'A.bdp');
    writeFileSync(join(pasta, 'A.zip'), readFileSync(join(pasta, 'A.bdp')));
    m.registro.esquecerDono(JANELA);
    dialogo.abrir = join(pasta, 'A.zip');
    const r = await chamar(m, CANAIS_PROJETOS.abrir, LEGITIMO);
    expect(r).toMatchObject({ ok: true, projeto: { identificador: null, nomeArquivo: 'A.zip' } });
    expect(m.registro.tamanho).toBe(0);
    expect(id).not.toBeNull();
  });

  it('lista de erros devolvida ao renderer tem limite (S8-06)', async () => {
    const erros = Array.from({ length: 500 }, (_, i) => ({ caminho: `x${i}`, mensagem: 'm' }));
    const m = montar({ ler: async () => ({ ok: false, erros }) });
    dialogo.abrir = join(pasta, 'x.bdp');
    const r = (await chamar(m, CANAIS_PROJETOS.abrir, LEGITIMO)) as { erros: unknown[] };
    expect(r.erros).toHaveLength(50);
  });

  it('arquivo inválido volta como ERRO com o nome, sem identificador', async () => {
    writeFileSync(join(pasta, 'ruim.bdp'), 'não é zip');
    dialogo.abrir = join(pasta, 'ruim.bdp');
    const m = montar();
    const r = await chamar(m, CANAIS_PROJETOS.abrir, LEGITIMO);
    expect(r).toMatchObject({ ok: false, motivo: 'ERRO', nomeArquivo: 'ruim.bdp' });
    expect(JSON.stringify(r)).not.toContain(pasta);
    expect(m.registro.tamanho).toBe(0);
  });

  it('versão futura: só leitura, sem identificador', async () => {
    const m = montar({
      ler: async () => ({ ok: false, erros: [{ caminho: 'manifesto.versaoFormato', mensagem: 'versão nova' }], versaoFutura: { versaoFormato: 9, leitura: null } }),
    });
    dialogo.abrir = join(pasta, 'futuro.bdp');
    expect(await chamar(m, CANAIS_PROJETOS.abrir, LEGITIMO)).toEqual({
      ok: false,
      motivo: 'VERSAO_FUTURA',
      nomeArquivo: 'futuro.bdp',
      versaoFormato: 9,
      leitura: null,
    });
    expect(m.registro.tamanho).toBe(0);
  });
});

describe('nome sugerido', () => {
  const nome = (t: string) => {
    const r = lerPacoteTransferivel(pacote(t));
    if (!r.ok) throw new Error('fixture inválida');
    return nomeSugerido(r.valor);
  };
  it.each([
    ['Meu trabalho', 'Meu trabalho.bdp'],
    ['A/B: C?', 'A B C.bdp'],
    ['  ', 'Trabalho.bdp'],
    ['CON', 'Trabalho.bdp'],
    ['fim. ', 'fim.bdp'],
    ['x'.repeat(200), `${'x'.repeat(80)}.bdp`],
  ])('%j → %j', (t, esperado) => expect(nome(t)).toBe(esperado));
});

describe('preload (C-10)', () => {
  it('cada função usa só o seu canal fixo e repassa os argumentos', async () => {
    const chamadas: unknown[][] = [];
    const api = criarApiBiblioDocs(async (...a) => (chamadas.push(a), { ok: true }));
    await api.projetos.abrir();
    await api.projetos.salvar('id', pacote());
    await api.projetos.salvarComo(pacote());
    await api.projetos.fechar('id');
    expect(chamadas.map((c) => c[0])).toEqual([CANAIS_PROJETOS.abrir, CANAIS_PROJETOS.salvar, CANAIS_PROJETOS.salvarComo, CANAIS_PROJETOS.fechar]);
    expect(chamadas.map((c) => c.length)).toEqual([1, 3, 2, 2]);
    expect(Object.isFrozen(api) && Object.isFrozen(api.projetos)).toBe(true);
    expect(Object.keys(api)).toEqual(['projetos', 'biblioteca', 'recuperacao', 'edicao']);
  });

  it('edicao (M2-T06): `executar` usa só o seu canal, manda só a ação e só com gesto do usuário', async () => {
    const chamadas: unknown[][] = [];
    let gesto = true;
    const api = criarApiBiblioDocs(async (...a) => (chamadas.push(a), undefined), () => gesto);
    await api.edicao.executar('colar');
    expect(chamadas).toEqual([[CANAIS_EDICAO.executar, 'colar']]);
    gesto = false;
    await api.edicao.executar('colar');
    expect(chamadas).toHaveLength(1);
    // Sem a função do preload, nada passa.
    const semGesto: unknown[][] = [];
    await criarApiBiblioDocs(async (...a) => (semGesto.push(a), undefined)).edicao.executar('copiar');
    expect(semGesto).toEqual([]);
    expect(Object.isFrozen(api.edicao)).toBe(true);
  });

  it('recuperacao (M1-T12): cada função usa só o seu canal fixo', async () => {
    const chamadas: unknown[][] = [];
    const api = criarApiBiblioDocs(async (...a) => (chamadas.push(a), { ok: true }));
    await api.recuperacao.instantaneo('id', pacote());
    await api.recuperacao.listar();
    await api.recuperacao.recuperar('of');
    await api.recuperacao.abrirSalvo('of');
    expect(chamadas.map((c) => c[0])).toEqual([
      CANAIS_RECUPERACAO.instantaneo,
      CANAIS_RECUPERACAO.listar,
      CANAIS_RECUPERACAO.recuperar,
      CANAIS_RECUPERACAO.abrirSalvo,
    ]);
    expect(chamadas.map((c) => c.length)).toEqual([3, 1, 2, 2]);
    expect(Object.isFrozen(api.recuperacao)).toBe(true);
  });

  it('o preload expõe só `bibliodocs` e nunca o ipcRenderer', () => {
    const fonte = readFileSync(join(__dirname, '..', 'src', 'preload', 'index.ts'), 'utf8');
    expect(fonte.match(/exposeInMainWorld\(/g)).toHaveLength(1);
    expect(fonte).toMatch(/exposeInMainWorld\(\s*'bibliodocs'/);
    expect(fonte).not.toMatch(/ipcRenderer\.(on|send|sendSync|postMessage)\b/);
    expect(fonte).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer\s*[,)]/);
  });
});

describe('protocolo do processo leitor', () => {
  it('pedido só com caminhos absolutos e campos exatos', () => {
    const base = join(pasta, 'a.bdp');
    expect(lerPedidoLeitor({ caminho: base, pastaBackups: pasta })).not.toBeNull();
    expect(lerPedidoLeitor({ caminho: 'a.bdp', pastaBackups: pasta })).toBeNull();
    expect(lerPedidoLeitor({ caminho: base, pastaBackups: pasta, extra: 1 })).toBeNull();
    expect(lerPedidoLeitor({ caminho: `${base}\0`, pastaBackups: pasta })).toBeNull();
  });

  it('resposta fora do protocolo é descartada; resposta real passa', async () => {
    expect(lerRespostaLeitor(null)).toBeNull();
    expect(lerRespostaLeitor({ ok: true })).toBeNull();
    expect(lerRespostaLeitor({ ok: false, erros: [], caminhoCompleto: 'C:\\x' })).toBeNull();
    // S8-05: campos extras no pacote, sha256 fora do padrão e caminho no lugar do nome do backup.
    const base = { manifesto: { id: 'prj_Exemplo01', versaoFormato: 1 }, documento: {}, midias: [] };
    const ok = { ok: true, pacote: base, avisos: [], migracao: [], nomeBackup: null };
    expect(lerRespostaLeitor(ok)).not.toBeNull();
    expect(lerRespostaLeitor({ ...ok, pacote: { ...base, extra: 1 } })).toBeNull();
    expect(lerRespostaLeitor({ ...ok, pacote: { ...base, midias: [{ sha256: 'Z', bytes: new Uint8Array(1) }] } })).toBeNull();
    expect(lerRespostaLeitor({ ...ok, nomeBackup: 'C:\\Users\\x\\b.bdp' })).toBeNull();
    expect(lerRespostaLeitor({ ...ok, nomeBackup: 'b.bdp' })).not.toBeNull();
    const r = lerPacoteTransferivel(pacote());
    if (!r.ok) throw new Error('fixture inválida');
    const bytes = empacotarProjeto(r.valor);
    if (!bytes.ok) throw new Error('empacotar falhou');
    writeFileSync(join(pasta, 'a.bdp'), bytes.bytes);
    const resposta = paraRespostaLeitor(await abrirProjeto(join(pasta, 'a.bdp')));
    expect(lerRespostaLeitor(structuredClone(resposta))).not.toBeNull();
  });

  it('backup de migração vai só com o nome do arquivo (M6-11)', () => {
    const r = lerPacoteTransferivel(pacote());
    if (!r.ok) throw new Error('fixture inválida');
    const resposta = paraRespostaLeitor({ ok: true, pacote: r.valor, avisos: [], migracao: [0, 1], backupMigracao: join(pasta, 'id', 'x-formato-v0.bdp') });
    expect(resposta).toMatchObject({ ok: true, nomeBackup: 'x-formato-v0.bdp' });
    expect(JSON.stringify(resposta)).not.toContain(pasta);
  });
});

describe('canal edicao (M2-T06): menu Editar', () => {
  function montarEdicao() {
    const feitos: [number, AcaoEdicao][] = [];
    const m = criarManipuladoresEdicao({
      origem: ORIGEM_PRODUCAO,
      conteudosPermitidos: () => new Set([JANELA]),
      executar: (id, acao) => feitos.push([id, acao]),
      log: () => {},
    });
    return { executar: m[CANAIS_EDICAO.executar]!, feitos };
  }

  it('cada ação conhecida vai para o webContents de quem chamou', async () => {
    const { executar, feitos } = montarEdicao();
    for (const acao of ACOES_EDICAO) expect(await executar(LEGITIMO, [acao])).toBeUndefined();
    expect(feitos).toEqual(ACOES_EDICAO.map((a) => [JANELA, a]));
  });

  it('recusa remetente estranho, ação fora da lista e quantidade errada de argumentos', async () => {
    const { executar, feitos } = montarEdicao();
    const recusas: [InfoRemetente, unknown[]][] = [
      [{ ...LEGITIMO, idConteudo: 99 }, ['colar']],
      [{ ...LEGITIMO, quadroPrincipal: false }, ['colar']],
      [{ ...LEGITIMO, urlQuadro: 'https://exemplo.com/' }, ['copiar']],
      [LEGITIMO, ['colarEspecial']],
      [LEGITIMO, ['selectAll']],
      [LEGITIMO, [{ toString: () => 'colar' }]],
      [LEGITIMO, ['colar', 'extra']],
      [LEGITIMO, []],
    ];
    for (const [r, args] of recusas) await expect(executar(r, args)).rejects.toBeInstanceOf(ErroIpcRecusado);
    expect(feitos).toEqual([]);
  });
});
