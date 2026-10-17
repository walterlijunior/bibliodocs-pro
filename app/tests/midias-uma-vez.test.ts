// M2-T01 (R-M1-01, R36) — mídias uma vez: o principal guarda os bytes das mídias de cada identificador, e o salvar e o
// instantâneo aceitam só a chave delas (`PacoteEnvio`). Também: o empacotamento assíncrono do instantâneo entra na fila
// da recuperação, e um instantâneo que chega durante um salvamento continua guardado (revisão A3).
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CANAIS_PROJETOS,
  CANAIS_RECUPERACAO,
  CODIGO_MIDIA_AUSENTE,
  criarTrabalhoVazio,
  type PacoteEnvio,
  type PacoteTransferivel,
  type ResultadoAbrir,
  type ResultadoInstantaneo,
  type ResultadoSalvar,
  type ResultadoSalvarComo,
} from '../src/aplicacao';
import type { Manifesto } from '../src/dominio/esquemas';
import {
  abrirProjeto,
  empacotarProjeto,
  instantaneosDe,
  lerProjeto,
  resumirProjeto,
  salvarProjeto,
  type PacoteProjeto,
  type ResultadoEmpacotamento,
} from '../src/persistencia';
import { lerPacoteTransferivel } from '../src/principal/ipc/argumentos';
import { ErroIpcRecusado } from '../src/principal/ipc/chamada';
import { criarManipuladoresProjetos } from '../src/principal/ipc/manipuladores-projetos';
import { criarManipuladoresRecuperacao, pastasRecuperacao } from '../src/principal/ipc/manipuladores-recuperacao';
import { paraRespostaLeitor } from '../src/principal/ipc/protocolo-leitor';
import type { InfoRemetente } from '../src/principal/ipc/remetente';
import { RegistroProjetos } from '../src/principal/ipc/registro-projetos';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';

const JANELA = 7;
const LEGITIMO: InfoRemetente = { idConteudo: JANELA, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };
const ID_PROJETO = 'prj_abcdefghijklmnop';

/** PNG mínimo (assinatura + `n` bytes distintos). */
function png(n: number): { sha256: string; bytes: Uint8Array; declarada: Manifesto['midias'][number] } {
  const bytes = new Uint8Array(8 + 16);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.fill(n, 8);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { sha256, bytes, declarada: { caminho: `midias/${sha256}.png`, sha256, bytes: bytes.length, tipo: 'image/png' } };
}

const A = png(1);
const B = png(2);
const C = png(3);

function pacote(titulo: string, midias = [A, B]): PacoteTransferivel {
  const t = criarTrabalhoVazio({ id: ID_PROJETO, agora: '2026-10-17T10:00:00.000Z', appVersao: '0.1.0' });
  return {
    manifesto: { ...t.manifesto, midias: midias.map((m) => m.declarada) },
    documento: { ...t.documento, metadados: { titulo: [{ tipo: 'texto', texto: titulo }] } },
    midias: midias.map(({ sha256, bytes }) => ({ sha256, bytes })),
  };
}

/** Só a chave das mídias em `referidas`. */
const envio = (p: PacoteTransferivel, referidas: readonly string[]): PacoteEnvio => ({
  ...p,
  midias: p.midias.map((m) => (referidas.includes(m.sha256) ? { sha256: m.sha256 } : m)),
});

const paraProjeto = (p: PacoteTransferivel): PacoteProjeto => {
  const r = lerPacoteTransferivel(p);
  if (!r.ok) throw new Error('pacote de teste inválido');
  return r.valor;
};

let raiz: string;
beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'bdp-midias-'));
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

describe('lerPacoteTransferivel com mídias conhecidas', () => {
  const conhecidas = new Map([[A.sha256, A.bytes]]);

  it('a mídia só referida recebe os bytes guardados', () => {
    const r = lerPacoteTransferivel(envio(pacote('x'), [A.sha256]), conhecidas);
    if (!r.ok) throw new Error('recusado');
    expect(r.valor.midias.get(A.sha256)).toBe(A.bytes);
    expect(r.valor.midias.get(B.sha256)).toEqual(B.bytes);
  });

  it('referida desconhecida → midiaAusente (não é recusa)', () => {
    expect(lerPacoteTransferivel(envio(pacote('x'), [A.sha256, B.sha256]), conhecidas)).toMatchObject({ ok: false, recusado: false, midiaAusente: true });
  });

  it('sem `conhecidas` (salvarComo), mídia sem bytes é forma errada', () => {
    expect(lerPacoteTransferivel(envio(pacote('x'), [A.sha256]))).toMatchObject({ ok: false, recusado: true });
  });

  it('referida e repetida continua recusada; os bytes guardados entram na soma do tamanho', () => {
    const p = { ...pacote('x', [A]), midias: [{ sha256: A.sha256 }, { sha256: A.sha256 }] };
    expect(lerPacoteTransferivel(p, conhecidas)).toMatchObject({ ok: false, recusado: true, motivo: 'mídia repetida' });
  });
});

describe('RegistroProjetos guarda as mídias por identificador', () => {
  it('em memória compartilhável, só para o dono, e some ao esquecer', () => {
    const r = new RegistroProjetos();
    const id = r.registrar('C:\\t\\a.bdp', JANELA, ID_PROJETO, new Map([[A.sha256, A.bytes]]));
    const guardada = r.midias(id, JANELA)!.get(A.sha256)!;
    expect(guardada.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(guardada).toEqual(A.bytes);
    expect(r.midias(id, 99)).toBeNull();

    r.trocarMidias(id, 99, new Map([[B.sha256, B.bytes]])); // outro dono: ignorado
    expect([...r.midias(id, JANELA)!.keys()]).toEqual([A.sha256]);
    r.trocarMidias(id, JANELA, new Map([[A.sha256, A.bytes], [B.sha256, B.bytes]]));
    expect([...r.midias(id, JANELA)!.keys()]).toEqual([A.sha256, B.sha256]);
    expect(r.midias(id, JANELA)!.get(A.sha256)).toBe(guardada); // reaproveita a cópia compartilhada
    r.trocarMidias(id, JANELA, new Map([[B.sha256, B.bytes]]));
    expect([...r.midias(id, JANELA)!.keys()]).toEqual([B.sha256]); // a que saiu do pacote sai daqui

    r.esquecer(id, JANELA);
    expect(r.midias(id, JANELA)).toBeNull();
  });
});

/** Projetos + recuperação sobre o mesmo registro, como no `registrar.ts`. */
function app(opcoes: { empacotar?: (p: PacoteProjeto) => Promise<ResultadoEmpacotamento> } = {}) {
  const registro = new RegistroProjetos();
  const dialogo = { abrir: null as string | null, salvar: null as string | null };
  const ler = async (c: string) => paraRespostaLeitor(await abrirProjeto(c, { pastaBackups: join(raiz, 'backups') }));
  const salvar = (d: string, p: PacoteProjeto) => salvarProjeto(d, p, opcoes.empacotar ? { empacotar: opcoes.empacotar } : {});
  const pastas = pastasRecuperacao(join(raiz, 'local'));
  const rec = criarManipuladoresRecuperacao({
    origem: ORIGEM_PRODUCAO,
    conteudosPermitidos: () => new Set([JANELA]),
    pastas,
    projetos: registro,
    pastaBiblioteca: async () => null,
    ler,
    resumir: async (cs) => Promise.all(cs.map((c) => resumirProjeto(c))),
    salvar,
    ...(opcoes.empacotar ? { empacotar: opcoes.empacotar } : {}),
    pid: 1,
    agora: () => new Date(),
    log: () => undefined,
  });
  const proj = criarManipuladoresProjetos({
    origem: ORIGEM_PRODUCAO,
    conteudosPermitidos: () => new Set([JANELA]),
    escolherArquivoParaAbrir: async () => dialogo.abrir,
    escolherDestino: async () => dialogo.salvar,
    ler,
    salvar,
    registro,
    antesDeGravar: rec.antesDeGravar,
    aoGravar: rec.aoGravar,
    aoFechar: rec.aoFechar,
    log: () => undefined,
  });
  const todos = { ...proj.manipuladores, ...rec.manipuladores } as Record<string, (r: InfoRemetente, a: unknown[]) => Promise<unknown>>;
  const chamar = (canal: string, ...args: unknown[]) => todos[canal]!(LEGITIMO, args);
  return {
    registro,
    rec,
    pastas,
    dialogo,
    abrir: async (caminho: string) => {
      dialogo.abrir = caminho;
      const r = (await chamar(CANAIS_PROJETOS.abrir)) as ResultadoAbrir;
      if (!r.ok || r.projeto.identificador === null) throw new Error('não abriu');
      return r.projeto.identificador;
    },
    salvar: (id: string, p: PacoteEnvio) => chamar(CANAIS_PROJETOS.salvar, id, p) as Promise<ResultadoSalvar>,
    salvarComo: (p: unknown) => chamar(CANAIS_PROJETOS.salvarComo, p) as Promise<ResultadoSalvarComo>,
    instantaneo: (id: string, p: PacoteEnvio) => chamar(CANAIS_RECUPERACAO.instantaneo, id, p) as Promise<ResultadoInstantaneo>,
    fechar: (id: string) => chamar(CANAIS_PROJETOS.fechar, id),
  };
}

const midiasDoArquivo = (caminho: string) => {
  const r = lerProjeto(new Uint8Array(readFileSync(caminho)));
  if (!r.ok) throw new Error('arquivo inválido');
  return r.pacote.midias;
};

async function arquivoCom(nome: string, p: PacoteTransferivel): Promise<string> {
  const caminho = join(raiz, nome);
  expect((await salvarProjeto(caminho, paraProjeto(p))).ok).toBe(true);
  return caminho;
}

describe('salvar e instantâneo com mídias só referidas', () => {
  it('abrir guarda as mídias do arquivo; salvar só com as chaves grava as mesmas mídias', async () => {
    const x = app();
    const caminho = await arquivoCom('t.bdp', pacote('Antes'));
    const id = await x.abrir(caminho);
    expect([...x.registro.midias(id, JANELA)!.keys()].sort()).toEqual([A.sha256, B.sha256].sort());

    expect(await x.salvar(id, envio(pacote('Depois'), [A.sha256, B.sha256]))).toMatchObject({ ok: true });
    const gravadas = midiasDoArquivo(caminho);
    expect(gravadas.get(A.sha256)).toEqual(A.bytes);
    expect(gravadas.get(B.sha256)).toEqual(B.bytes);
  });

  it('mídia nova vai com os bytes uma vez; depois basta a chave', async () => {
    const x = app();
    const id = await x.abrir(await arquivoCom('t.bdp', pacote('Antes')));
    expect(await x.salvar(id, envio(pacote('Com C', [A, B, C]), [A.sha256, B.sha256]))).toMatchObject({ ok: true });
    expect(await x.instantaneo(id, envio(pacote('De novo', [A, B, C]), [A.sha256, B.sha256, C.sha256]))).toEqual({ ok: true });
  });

  it('mídia nova que chega por um instantâneo também passa a ser conhecida', async () => {
    const x = app();
    const id = await x.abrir(await arquivoCom('t.bdp', pacote('Antes')));
    expect(await x.instantaneo(id, envio(pacote('Com C', [A, B, C]), [A.sha256, B.sha256]))).toEqual({ ok: true });
    expect(await x.salvar(id, envio(pacote('Com C', [A, B, C]), [A.sha256, B.sha256, C.sha256]))).toMatchObject({ ok: true });
  });

  it('bytes que não conferem com a chave nunca são guardados (revisão F1); mídia removida sai do registro (F2)', async () => {
    const x = app();
    const id = await x.abrir(await arquivoCom('t.bdp', pacote('Antes')));
    const falsa = { ...pacote('Com C', [A, B, C]) };
    falsa.midias = falsa.midias.map((m) => (m.sha256 === C.sha256 ? { sha256: C.sha256, bytes: B.bytes.slice() } : m));
    expect(await x.salvar(id, envio(falsa, [A.sha256, B.sha256]))).toMatchObject({ ok: false, codigo: 'PACOTE_INVALIDO' });
    expect(await x.instantaneo(id, envio(falsa, [A.sha256, B.sha256]))).toEqual({ ok: false, codigo: 'PACOTE_INVALIDO' });
    expect(x.registro.midias(id, JANELA)!.has(C.sha256)).toBe(false);
    // Com os bytes certos, C passa a ser conhecida.
    expect(await x.salvar(id, envio(pacote('Com C', [A, B, C]), [A.sha256, B.sha256]))).toMatchObject({ ok: true });
    expect(await x.salvar(id, envio(pacote('Só chaves', [A, B, C]), [A.sha256, B.sha256, C.sha256]))).toMatchObject({ ok: true });
    // C removida: some do registro; referi-la de novo (desfazer) pede o reenvio.
    expect(await x.instantaneo(id, envio(pacote('Sem C', [A, B]), [A.sha256, B.sha256]))).toEqual({ ok: true });
    expect(x.registro.midias(id, JANELA)!.has(C.sha256)).toBe(false);
    expect(await x.salvar(id, envio(pacote('Volta C', [A, B, C]), [A.sha256, B.sha256, C.sha256]))).toMatchObject({ codigo: CODIGO_MIDIA_AUSENTE });
  });

  it('referida que o principal não tem → MIDIA_AUSENTE e nada é gravado', async () => {
    const x = app();
    const caminho = await arquivoCom('t.bdp', pacote('Antes'));
    const antes = readFileSync(caminho);
    const id = await x.abrir(caminho);
    const p = envio(pacote('Com C', [A, B, C]), [A.sha256, B.sha256, C.sha256]);
    expect(await x.salvar(id, p)).toMatchObject({ ok: false, motivo: 'ERRO', codigo: CODIGO_MIDIA_AUSENTE });
    expect(await x.instantaneo(id, p)).toEqual({ ok: false, codigo: 'MIDIA_AUSENTE' });
    expect(readFileSync(caminho).equals(antes)).toBe(true);
    expect(await instantaneosDe(x.pastas, ID_PROJETO)).toEqual([]);
  });

  it('identificador desconhecido com mídia referida → NAO_ABERTO (não recusa a chamada)', async () => {
    const x = app();
    const p = envio(pacote('x'), [A.sha256]);
    expect(await x.salvar('A'.repeat(22), p)).toMatchObject({ ok: false, codigo: 'NAO_ABERTO' });
    expect(await x.instantaneo('A'.repeat(22), p)).toEqual({ ok: false, codigo: 'NAO_ABERTO' });
  });

  it('salvarComo exige os bytes e registra as mídias com o identificador novo; fechar as esquece', async () => {
    const x = app();
    await expect(x.salvarComo(envio(pacote('x'), [A.sha256]))).rejects.toBeInstanceOf(ErroIpcRecusado);
    x.dialogo.salvar = join(raiz, 'novo.bdp');
    const r = await x.salvarComo(pacote('Novo'));
    if (!r.ok) throw new Error('não salvou');
    expect(await x.salvar(r.identificador, envio(pacote('Novo 2'), [A.sha256, B.sha256]))).toMatchObject({ ok: true });
    await x.fechar(r.identificador);
    expect(x.registro.midias(r.identificador, JANELA)).toBeNull();
  });

  it('instantâneo só com as chaves guarda o pacote inteiro na recuperação', async () => {
    const x = app();
    const id = await x.abrir(await arquivoCom('t.bdp', pacote('Antes')));
    expect(await x.instantaneo(id, envio(pacote('Memória'), [A.sha256, B.sha256]))).toEqual({ ok: true });
    const [atual] = await instantaneosDe(x.pastas, ID_PROJETO);
    expect(midiasDoArquivo(atual!.caminho).get(B.sha256)).toEqual(B.bytes);
  });
});

describe('empacotamento assíncrono do instantâneo (worker)', () => {
  it('usa o empacotador injetado; instantâneo que chega durante o salvamento continua guardado (A3)', async () => {
    let liberar!: () => void;
    const portao = new Promise<void>((ok) => (liberar = ok));
    let chamadas = 0;
    const empacotar = async (p: PacoteProjeto) => {
      chamadas++;
      await portao;
      return empacotarProjeto(p);
    };
    const x = app({ empacotar });
    const caminho = await arquivoCom('t.bdp', pacote('Antes'));
    const id = await x.abrir(caminho);

    const marca = x.rec.antesDeGravar(ID_PROJETO); // o salvamento começou
    const inst = x.instantaneo(id, envio(pacote('Durante'), [A.sha256, B.sha256]));
    const gravou = x.rec.aoGravar(caminho, ID_PROJETO, JANELA, marca); // e terminou antes de o instantâneo empacotar
    liberar();
    expect(await inst).toEqual({ ok: true });
    await gravou;
    expect(chamadas).toBe(1);
    expect(await instantaneosDe(x.pastas, ID_PROJETO)).toHaveLength(1);
  });

  it('empacotador que falha → PACOTE_INVALIDO no instantâneo e no salvar, sem gravar', async () => {
    const falha: ResultadoEmpacotamento = { ok: false, erros: [{ caminho: 'empacotamento', mensagem: 'falhou' }] };
    const x = app({ empacotar: async () => falha });
    const caminho = await arquivoCom('t.bdp', pacote('Antes'));
    const antes = readFileSync(caminho);
    const id = await x.abrir(caminho);
    const p = envio(pacote('x'), [A.sha256, B.sha256]);
    expect(await x.instantaneo(id, p)).toEqual({ ok: false, codigo: 'PACOTE_INVALIDO' });
    expect(await x.salvar(id, p)).toMatchObject({ ok: false, codigo: 'PACOTE_INVALIDO' });
    expect(readFileSync(caminho).equals(antes)).toBe(true);
  });
});
