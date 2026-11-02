// Testes do M1-T09 (grupo PER/BIB): biblioteca de trabalhos — varredura e índice-cache recriável, criar, abrir,
// renomear, duplicar, excluir para a Lixeira com confirmação, pasta configurável, aviso de OneDrive, recusas de IPC e
// protocolo de resumo do processo leitor. Disco real em pasta temporária; a Lixeira e os diálogos são falsos.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CANAIS_BIBLIOTECA,
  CANAIS_PROJETOS,
  criarTrabalhoVazio,
  type ItemBiblioteca,
  type PacoteTransferivel,
  type ResultadoAbrir,
  type ResultadoCriar,
  type ResultadoItem,
  type ResultadoListar,
} from '../src/aplicacao';
import { validarDocumentoV1, validarManifestoV1, type Manifesto } from '../src/dominio/esquemas';
import type { Documento } from '../src/dominio/modelo';
import {
  abrirProjeto,
  comSufixo,
  lerIndice,
  limparNomeArquivo,
  pastaNaNuvem,
  resumirProjeto,
  salvarProjeto,
  validarNomeTrabalho,
  type PacoteProjeto,
  type ResumoProjeto,
} from '../src/persistencia';
import { ErroIpcRecusado } from '../src/principal/ipc/chamada';
import { criarManipuladoresBiblioteca, type DependenciasBiblioteca } from '../src/principal/ipc/manipuladores-biblioteca';
import { criarManipuladoresProjetos } from '../src/principal/ipc/manipuladores-projetos';
import { lerPedidoResumo, lerRespostaResumo, MAX_ARQUIVOS_RESUMO, paraRespostaLeitor } from '../src/principal/ipc/protocolo-leitor';
import { RegistroProjetos } from '../src/principal/ipc/registro-projetos';
import type { InfoRemetente } from '../src/principal/ipc/remetente';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';
import { criarApiBiblioDocs } from '../src/preload/api';

const fixtures = join(__dirname, 'fixtures', 'projeto-v1');
const lerFixture = <T>(nome: string): T => JSON.parse(readFileSync(join(fixtures, nome), 'utf8')) as T;

const JANELA = 7;
const LEGITIMO: InfoRemetente = { idConteudo: JANELA, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };
const OUTRA_JANELA: InfoRemetente = { ...LEGITIMO, idConteudo: 8 };
const AGORA = new Date('2026-10-16T12:00:00.000Z');

let raiz: string;
let pastaPadrao: string;
let dados: string;
let lixeira: string[];
let confirmar: boolean;
let resumidos: string[];
let falharResumo: boolean;
let pastaDialogo: string | null;
let ids: number;

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'bdp-bib-'));
  pastaPadrao = join(raiz, 'Documentos', 'BiblioDocs Pro', 'Trabalhos');
  dados = join(raiz, 'dados');
  lixeira = [];
  confirmar = true;
  resumidos = [];
  falharResumo = false;
  pastaDialogo = null;
  ids = 0;
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

function pacote(titulo: string, id = 'prj_Exemplo01'): PacoteProjeto {
  const manifesto = lerFixture<Manifesto>('manifesto-valido.json');
  manifesto.midias = [];
  manifesto.id = id;
  const documento = lerFixture<Documento>('documento-valido.json');
  documento.id = id;
  documento.metadados.titulo = [{ tipo: 'texto', texto: titulo }];
  return { manifesto, documento, midias: new Map() };
}

async function gravarProjeto(pasta: string, nome: string, titulo: string, id = 'prj_Exemplo01') {
  mkdirSync(pasta, { recursive: true });
  const r = await salvarProjeto(join(pasta, nome), pacote(titulo, id));
  expect(r.ok).toBe(true);
}

/** Monta a biblioteca e os projetos com o mesmo registro de abertos, como no `registrar.ts`. */
function montar(extra: Partial<DependenciasBiblioteca> = {}) {
  const ler = async (c: string) => paraRespostaLeitor(await abrirProjeto(c, { pastaBackups: join(dados, 'backups') }));
  const salvar = (d: string, p: PacoteProjeto) => salvarProjeto(d, p);
  const proj = criarManipuladoresProjetos({
    origem: ORIGEM_PRODUCAO,
    conteudosPermitidos: () => new Set([JANELA, 8]),
    escolherArquivoParaAbrir: async () => null,
    escolherDestino: async () => null,
    ler,
    salvar,
    log: () => undefined,
  });
  const bib = criarManipuladoresBiblioteca({
    origem: ORIGEM_PRODUCAO,
    conteudosPermitidos: () => new Set([JANELA, 8]),
    pastaPadrao,
    arquivoIndice: join(dados, 'biblioteca.json'),
    arquivoPreferencias: join(dados, 'preferencias.json'),
    ambiente: {},
    escolherPasta: async () => pastaDialogo,
    confirmarExclusao: async () => confirmar,
    enviarParaLixeira: async (c) => {
      // Lixeira falsa: tira o arquivo da pasta, como o shell.trashItem.
      const destino = join(raiz, `lixeira-${lixeira.length}`);
      renameSync(c, destino);
      lixeira.push(c);
    },
    resumir: async (caminhos) => {
      if (falharResumo) return null;
      resumidos.push(...caminhos);
      return Promise.all(caminhos.map((c) => resumirProjeto(c)));
    },
    ler,
    salvar,
    projetos: proj.registro,
    gerarIdProjeto: () => `prj_Gerado${String(++ids).padStart(4, '0')}`,
    agora: () => AGORA,
    appVersao: '0.1.0',
    log: () => undefined,
    ...extra,
  });
  const chamar = <T>(canal: string, r: InfoRemetente, ...args: unknown[]) =>
    bib.manipuladores[canal as keyof typeof bib.manipuladores](r, args) as Promise<T>;
  const chamarProjetos = <T>(canal: string, r: InfoRemetente, ...args: unknown[]) =>
    proj.manipuladores[canal as keyof typeof proj.manipuladores](r, args) as Promise<T>;
  return { bib, proj, chamar, chamarProjetos };
}

type Montagem = ReturnType<typeof montar>;

async function listar(m: Montagem, r = LEGITIMO) {
  const l = await m.chamar<ResultadoListar>(CANAIS_BIBLIOTECA.listar, r);
  if (!l.ok) throw new Error(`listar falhou: ${l.mensagem}`);
  return l;
}

const porNome = (itens: ItemBiblioteca[], nome: string) => {
  const i = itens.find((x) => x.nomeArquivo === nome);
  if (!i) throw new Error(`item ${nome} ausente`);
  return i;
};

const arquivos = (pasta = pastaPadrao) => readdirSync(pasta).sort();

describe('nomes de arquivo', () => {
  it.each<[string, string]>([
    ['Meu TCC', 'Meu TCC.bdp'],
    ['  Meu TCC.BDP  ', 'Meu TCC.bdp'],
    ['Capítulo 1 — revisão', 'Capítulo 1 — revisão.bdp'],
    ['x'.repeat(80), `${'x'.repeat(80)}.bdp`],
  ])('aceita %j → %j', (digitado, esperado) => {
    expect(validarNomeTrabalho(digitado)).toEqual({ ok: true, nomeArquivo: esperado });
  });

  it.each(['', '   ', '.bdp', 'a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a|b', 'a\u0001b', 'fim.', 'CON', 'nul', 'com1', 'LPT9', 'aux.txt', 'x'.repeat(81)])(
    'recusa %j com mensagem',
    (digitado) => {
      const r = validarNomeTrabalho(digitado);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.mensagem.length).toBeGreaterThan(0);
    },
  );

  it('limpa o título para o nome sugerido e preserva sufixos dentro do limite', () => {
    expect(limparNomeArquivo('Ocorrência: estudo/caso?')).toBe('Ocorrência estudo caso.bdp');
    expect(limparNomeArquivo('con')).toBe('Trabalho.bdp');
    const longo = comSufixo('y'.repeat(80), ' (cópia)');
    expect([...longo]).toHaveLength(80);
    expect(longo.endsWith(' (cópia)')).toBe(true);
  });
});

describe('aviso de OneDrive (R16)', () => {
  const casa = join(tmpdir(), 'usuario');
  it.each<[string, Record<string, string | undefined>, boolean]>([
    ['pasta dentro da variável OneDrive', { OneDrive: join(casa, 'OneDrive') }, true],
    ['Documentos redirecionados (OneDriveCommercial)', { OneDriveCommercial: join(casa, 'OneDrive - UFT') }, true],
    ['nome de pasta do cliente, sem variável', {}, true],
    ['pasta comum', { OneDrive: join(casa, 'OneDrive') }, false],
    ['nome parecido', { OneDrive: join(casa, 'OneDrive') }, false],
  ])('%s', (caso, ambiente, esperado) => {
    const pasta = {
      'pasta dentro da variável OneDrive': join(casa, 'OneDrive', 'Documentos', 'BiblioDocs Pro', 'Trabalhos'),
      'Documentos redirecionados (OneDriveCommercial)': join(casa, 'OneDrive - UFT', 'Documentos'),
      'nome de pasta do cliente, sem variável': join(casa, 'OneDrive - Pessoal', 'Trabalhos'),
      'pasta comum': join(casa, 'Documentos', 'Trabalhos'),
      'nome parecido': join(casa, 'OneDriveX', 'Trabalhos'),
    }[caso]!;
    expect(pastaNaNuvem(pasta, ambiente)).toBe(esperado);
  });

  it('listar marca a pasta na nuvem', async () => {
    const m = montar({ ambiente: { OneDrive: join(raiz, 'Documentos') } });
    expect((await listar(m)).pasta).toEqual({ nome: 'Trabalhos', padrao: true, naNuvem: true });
    expect((await listar(montar())).pasta.naNuvem).toBe(false);
  });
});

describe('listar e índice-cache', () => {
  it('cria a pasta padrão e lista só os .bdp comuns do primeiro nível, em ordem de nome', async () => {
    await gravarProjeto(pastaPadrao, 'b.bdp', 'Segundo');
    await gravarProjeto(pastaPadrao, 'A.bdp', 'Primeiro');
    await gravarProjeto(pastaPadrao, '10 final.bdp', 'Décimo');
    await gravarProjeto(pastaPadrao, '2 meio.bdp', 'Dois');
    writeFileSync(join(pastaPadrao, 'notas.txt'), 'x');
    writeFileSync(join(pastaPadrao, 'b.bdp.bak'), 'x');
    writeFileSync(join(pastaPadrao, 'b.bdp.tmp-1-abc'), 'x');
    mkdirSync(join(pastaPadrao, 'pasta.bdp'));
    await gravarProjeto(join(pastaPadrao, 'sub'), 'dentro.bdp', 'Subpasta');
    writeFileSync(join(pastaPadrao, 'quebrado.bdp'), 'não é zip');

    const l = await listar(montar());
    expect(l.itens.map((i) => i.nomeArquivo)).toEqual(['2 meio.bdp', '10 final.bdp', 'A.bdp', 'b.bdp', 'quebrado.bdp']);
    expect(porNome(l.itens, 'A.bdp')).toMatchObject({ titulo: 'Primeiro', estado: 'ok', tipoTrabalho: 'generico' });
    expect(porNome(l.itens, 'quebrado.bdp')).toMatchObject({ titulo: '', estado: 'invalido', tipoTrabalho: null, criadoEm: null });
    expect(l.itens.every((i) => /^[A-Za-z0-9_-]{22}$/.test(i.identificador))).toBe(true);
    expect(JSON.stringify(l)).not.toContain(raiz);
  });

  it('pasta padrão vazia é criada e listada', async () => {
    const l = await listar(montar());
    expect(l.itens).toEqual([]);
    expect(existsSync(pastaPadrao)).toBe(true);
  });

  it('não resume de novo o que não mudou; resume só o arquivo alterado', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await gravarProjeto(pastaPadrao, 'b.bdp', 'Dois');
    const m = montar();
    await listar(m);
    expect(resumidos).toHaveLength(2);
    resumidos = [];
    await listar(m);
    expect(resumidos).toEqual([]);

    await gravarProjeto(pastaPadrao, 'b.bdp', 'Dois, revisado, com título mais longo');
    const l = await listar(montar()); // sessão nova: o índice vem do disco
    expect(resumidos).toEqual([join(pastaPadrao, 'b.bdp')]);
    expect(porNome(l.itens, 'b.bdp').titulo).toBe('Dois, revisado, com título mais longo');
  });

  it('apagar o índice e reabrir recria a mesma lista (critério de aceite)', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await gravarProjeto(pastaPadrao, 'b.bdp', 'Dois');
    const antes = await listar(montar());
    const indice = join(dados, 'biblioteca.json');
    expect(existsSync(indice)).toBe(true);
    rmSync(indice);

    resumidos = [];
    const depois = await listar(montar());
    expect(resumidos).toHaveLength(2);
    const semId = (l: ResultadoListar & { ok: true }) => l.itens.map(({ identificador: _, ...resto }) => resto);
    expect(semId(depois)).toEqual(semId(antes));
    expect(existsSync(indice)).toBe(true);
  });

  it.each<[string, string]>([
    ['corrompido', '{ isto não é json'],
    ['de outro formato', JSON.stringify({ formato: 'outro', versao: 1, pasta: '', entradas: [] })],
    ['com campo a mais', JSON.stringify({ formato: 'bibliodocs-biblioteca', versao: 1, pasta: '', entradas: [], extra: 1 })],
  ])('índice %s é descartado e recriado', async (_caso, conteudo) => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    mkdirSync(dados, { recursive: true });
    writeFileSync(join(dados, 'biblioteca.json'), conteudo);
    const l = await listar(montar());
    expect(porNome(l.itens, 'a.bdp').titulo).toBe('Um');
    expect((await lerIndice(join(dados, 'biblioteca.json'), pastaPadrao)).descarte).toBeNull();
  });

  it('índice de outra pasta não é aproveitado', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await listar(montar());
    const indice = JSON.parse(readFileSync(join(dados, 'biblioteca.json'), 'utf8')) as { pasta: string; entradas: { resumo: { titulo: string } }[] };
    indice.pasta = join(raiz, 'outra');
    indice.entradas[0]!.resumo.titulo = 'Título falso do cache';
    writeFileSync(join(dados, 'biblioteca.json'), JSON.stringify(indice));
    expect(porNome((await listar(montar())).itens, 'a.bdp').titulo).toBe('Um');
  });

  it('o índice é cache: um título falso nele só aparece enquanto o arquivo não muda', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await listar(montar());
    const caminhoIndice = join(dados, 'biblioteca.json');
    writeFileSync(caminhoIndice, readFileSync(caminhoIndice, 'utf8').replace('"Um"', '"Editado"'));
    expect(porNome((await listar(montar())).itens, 'a.bdp').titulo).toBe('Editado');
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um de novo');
    expect(porNome((await listar(montar())).itens, 'a.bdp').titulo).toBe('Um de novo');
  });

  it('falha do leitor: aparece como inválido, com aviso, e é tentado de novo na próxima vez', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    falharResumo = true;
    const l1 = await listar(m);
    expect(porNome(l1.itens, 'a.bdp').estado).toBe('invalido');
    expect(l1.avisos.join(' ')).toContain('tenta de novo');
    falharResumo = false;
    const l2 = await listar(m);
    expect(porNome(l2.itens, 'a.bdp')).toMatchObject({ estado: 'ok', titulo: 'Um' });
    expect(l2.avisos).toEqual([]);
  });

  it('identificadores ficam estáveis entre listagens e valem só para a janela que listou', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const id1 = (await listar(m)).itens[0]!.identificador;
    const id2 = (await listar(m)).itens[0]!.identificador;
    expect(id2).toBe(id1);
    const r = await m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.duplicar, OUTRA_JANELA, id1);
    expect(r).toMatchObject({ ok: false, codigo: 'NAO_ENCONTRADO' });
  });

  it('o tamanho do índice não cresce com listagens repetidas', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    for (let i = 0; i < 5; i++) await listar(m);
    expect(m.bib.itens.tamanho).toBe(1);
  });
});

describe('criar', () => {
  it('cria um trabalho do tipo pedido, válido, já aberto, com nome livre', async () => {
    let n = 0;
    const m = montar({ gerarId: (prefixo) => `${prefixo}_Id${String(++n).padStart(6, '0')}` });
    const r1 = await m.chamar<ResultadoCriar>(CANAIS_BIBLIOTECA.criar, LEGITIMO, 'projeto-pesquisa');
    const r2 = await m.chamar<ResultadoCriar>(CANAIS_BIBLIOTECA.criar, LEGITIMO, 'tese');
    if (!r1.ok || !r2.ok) throw new Error('criar falhou');
    expect([r1.projeto.nomeArquivo, r2.projeto.nomeArquivo]).toEqual(['Trabalho sem título.bdp', 'Trabalho sem título (2).bdp']);
    expect(r1.item).toMatchObject({ nomeArquivo: 'Trabalho sem título.bdp', estado: 'ok', titulo: '', criadoEm: AGORA.toISOString() });

    const lido = await abrirProjeto(join(pastaPadrao, 'Trabalho sem título.bdp'));
    if (!lido.ok) throw new Error('arquivo criado inválido');
    expect(lido.pacote.manifesto.id).toBe('prj_Gerado0001');
    expect(lido.pacote.manifesto.tipoTrabalho).toBe('projeto-pesquisa');
    const doc = lido.pacote.documento;
    expect(doc).toMatchObject({ id: 'prj_Gerado0001', tipoTrabalho: 'projeto-pesquisa', metadados: { titulo: [] } });
    expect(doc.preTextuais?.map((e) => e.tipo)).toEqual(['capa', 'folhaRosto', 'listaIlustracoes', 'listaTabelas', 'sumario']);
    expect(doc.preTextuais?.[0]?.id).toBe('ele_Id000001');
    expect(doc.corpo.map((s) => s.titulo[0]?.texto)).toEqual(['Introdução', 'Objetivos', 'Cronograma']);
    expect(doc.posTextuais?.map((e) => e.tipo)).toEqual(['referencias', 'apendice', 'anexo']);
    expect(r1.item.tipoTrabalho).toBe('projeto-pesquisa');
    expect(r2.projeto.pacote.manifesto.tipoTrabalho).toBe('tese');
    expect(r2.projeto.pacote.manifesto.id).toBe('prj_Gerado0002');

    // O identificador devolvido serve para salvar (fluxo do M1-T11).
    const p = r1.projeto.pacote as PacoteTransferivel;
    p.documento.metadados.titulo = [{ tipo: 'texto', texto: 'Novo título' }];
    const s = await m.chamarProjetos<{ ok: boolean }>(CANAIS_PROJETOS.salvar, LEGITIMO, r1.projeto.identificador, p);
    expect(s.ok).toBe(true);
    expect(porNome((await listar(m)).itens, 'Trabalho sem título.bdp').titulo).toBe('Novo título');
  });

  it('o serviço puro gera manifesto e documento que passam nos validadores do v1', () => {
    const t = criarTrabalhoVazio({ id: 'prj_Teste0001', agora: AGORA.toISOString(), appVersao: '0.1.0' });
    expect(validarManifestoV1(t.manifesto).ok).toBe(true);
    expect(validarDocumentoV1(t.documento).ok).toBe(true);
  });
});

describe('abrir da lista', () => {
  it('abre e registra o identificador de gravação', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const item = (await listar(m)).itens[0]!;
    const r = await m.chamar<ResultadoAbrir>(CANAIS_BIBLIOTECA.abrir, LEGITIMO, item.identificador);
    if (!r.ok) throw new Error('abrir falhou');
    expect(r.projeto.nomeArquivo).toBe('a.bdp');
    expect(r.projeto.identificador).not.toBe(item.identificador);
    expect(m.proj.registro.caminho(r.projeto.identificador!, JANELA)).toBe(join(pastaPadrao, 'a.bdp'));
  });

  it('o identificador do item não serve para salvar, nem o do projeto para a biblioteca', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const item = (await listar(m)).itens[0]!;
    const s = await m.chamarProjetos<{ ok: boolean; codigo?: string }>(CANAIS_PROJETOS.salvar, LEGITIMO, item.identificador, {
      ...pacote('X'),
      midias: [],
    });
    expect(s).toMatchObject({ ok: false, codigo: 'NAO_ABERTO' });
    const aberto = await m.chamar<ResultadoAbrir>(CANAIS_BIBLIOTECA.abrir, LEGITIMO, item.identificador);
    if (!aberto.ok) throw new Error('abrir falhou');
    const e = await m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.excluir, LEGITIMO, aberto.projeto.identificador);
    expect(e).toMatchObject({ ok: false, codigo: 'NAO_ENCONTRADO' });
  });
});

describe('renomear', () => {
  it('renomeia mantendo o identificador e o resumo', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const item = (await listar(m)).itens[0]!;
    const r = await m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.renomear, LEGITIMO, item.identificador, '  Capítulo final ');
    expect(r).toMatchObject({ ok: true, item: { identificador: item.identificador, nomeArquivo: 'Capítulo final.bdp', titulo: 'Um' } });
    expect(arquivos()).toEqual(['Capítulo final.bdp']);
    resumidos = [];
    expect((await listar(m)).itens.map((i) => i.nomeArquivo)).toEqual(['Capítulo final.bdp']);
    expect(resumidos).toEqual([]); // o índice já sabia do nome novo
  });

  it('só a caixa muda', async () => {
    await gravarProjeto(pastaPadrao, 'tcc.bdp', 'Um');
    const m = montar();
    const item = (await listar(m)).itens[0]!;
    expect(await m.chamar(CANAIS_BIBLIOTECA.renomear, LEGITIMO, item.identificador, 'TCC')).toMatchObject({ ok: true });
    expect(arquivos()).toEqual(['TCC.bdp']);
  });

  it('nunca sobrescreve outro trabalho', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await gravarProjeto(pastaPadrao, 'b.bdp', 'Dois');
    const m = montar();
    const a = porNome((await listar(m)).itens, 'a.bdp');
    const r = await m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.renomear, LEGITIMO, a.identificador, 'B');
    expect(r).toMatchObject({ ok: false, codigo: 'JA_EXISTE' });
    expect(porNome((await listar(m)).itens, 'b.bdp').titulo).toBe('Dois');
  });

  it('nome inválido volta com mensagem e não toca no disco', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const a = (await listar(m)).itens[0]!;
    const r = await m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.renomear, LEGITIMO, a.identificador, 'a/b');
    expect(r).toMatchObject({ ok: false, codigo: 'NOME_INVALIDO' });
    expect(arquivos()).toEqual(['a.bdp']);
  });

  it('recusa renomear trabalho aberto no app; depois de fechar, renomeia', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const a = (await listar(m)).itens[0]!;
    const aberto = await m.chamar<ResultadoAbrir>(CANAIS_BIBLIOTECA.abrir, LEGITIMO, a.identificador);
    if (!aberto.ok) throw new Error('abrir falhou');
    expect(await m.chamar(CANAIS_BIBLIOTECA.renomear, LEGITIMO, a.identificador, 'b')).toMatchObject({ ok: false, codigo: 'ABERTO_NO_APP' });
    await m.chamarProjetos(CANAIS_PROJETOS.fechar, LEGITIMO, aberto.projeto.identificador);
    expect(await m.chamar(CANAIS_BIBLIOTECA.renomear, LEGITIMO, a.identificador, 'b')).toMatchObject({ ok: true });
  });

  it('arquivo apagado por fora → NAO_ENCONTRADO', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const a = (await listar(m)).itens[0]!;
    rmSync(join(pastaPadrao, 'a.bdp'));
    expect(await m.chamar(CANAIS_BIBLIOTECA.renomear, LEGITIMO, a.identificador, 'b')).toMatchObject({ ok: false, codigo: 'NAO_ENCONTRADO' });
  });

  it('chamadas simultâneas para o mesmo nome: uma vence, a outra recebe JA_EXISTE (fila única)', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await gravarProjeto(pastaPadrao, 'b.bdp', 'Dois');
    const m = montar();
    const l = await listar(m);
    const rs = await Promise.all(
      ['a.bdp', 'b.bdp'].map((n) => m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.renomear, LEGITIMO, porNome(l.itens, n).identificador, 'c')),
    );
    expect(rs.map((r) => (r.ok ? 'ok' : r.codigo)).sort()).toEqual(['JA_EXISTE', 'ok']);
    expect(arquivos()).toHaveLength(2);
  });
});

describe('duplicar', () => {
  it('grava uma cópia com id novo e o mesmo conteúdo', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const a = (await listar(m)).itens[0]!;
    const r1 = await m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.duplicar, LEGITIMO, a.identificador);
    const r2 = await m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.duplicar, LEGITIMO, a.identificador);
    expect(r1).toMatchObject({ ok: true, item: { nomeArquivo: 'a (cópia).bdp', titulo: 'Um', criadoEm: AGORA.toISOString() } });
    expect(r2).toMatchObject({ ok: true, item: { nomeArquivo: 'a (cópia) (2).bdp' } });

    const original = await abrirProjeto(join(pastaPadrao, 'a.bdp'));
    const copia = await abrirProjeto(join(pastaPadrao, 'a (cópia).bdp'));
    if (!original.ok || !copia.ok) throw new Error('leitura falhou');
    expect(copia.pacote.manifesto.id).toBe('prj_Gerado0001');
    expect(copia.pacote.documento.id).toBe('prj_Gerado0001');
    expect(copia.pacote.documento.corpo).toEqual(original.pacote.documento.corpo);
    expect(copia.pacote.documento.metadados).toEqual(original.pacote.documento.metadados);
    expect(original.pacote.manifesto.id).toBe('prj_Exemplo01');
  });

  it('duas cópias simultâneas recebem nomes diferentes (fila única)', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const a = (await listar(m)).itens[0]!;
    const rs = await Promise.all([1, 2].map(() => m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.duplicar, LEGITIMO, a.identificador)));
    expect(rs.every((r) => r.ok)).toBe(true);
    expect(arquivos()).toEqual(['a (cópia) (2).bdp', 'a (cópia).bdp', 'a.bdp']);
  });

  it('arquivo inválido não é duplicado', async () => {
    mkdirSync(pastaPadrao, { recursive: true });
    writeFileSync(join(pastaPadrao, 'ruim.bdp'), 'x');
    const m = montar();
    const item = (await listar(m)).itens[0]!;
    expect(await m.chamar(CANAIS_BIBLIOTECA.duplicar, LEGITIMO, item.identificador)).toMatchObject({ ok: false, codigo: 'ILEGIVEL' });
    expect(arquivos()).toEqual(['ruim.bdp']);
  });
});

describe('excluir (Lixeira com confirmação)', () => {
  it('cancelar não toca no arquivo', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar();
    const a = (await listar(m)).itens[0]!;
    confirmar = false;
    expect(await m.chamar(CANAIS_BIBLIOTECA.excluir, LEGITIMO, a.identificador)).toEqual({ ok: false, motivo: 'CANCELADO' });
    expect(arquivos()).toEqual(['a.bdp']);
    expect(lixeira).toEqual([]);
  });

  it('confirmar envia para a Lixeira, tira do índice e invalida o identificador', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await gravarProjeto(pastaPadrao, 'b.bdp', 'Dois');
    const m = montar();
    const a = porNome((await listar(m)).itens, 'a.bdp');
    expect(await m.chamar(CANAIS_BIBLIOTECA.excluir, LEGITIMO, a.identificador)).toEqual({ ok: true });
    expect(lixeira).toEqual([join(pastaPadrao, 'a.bdp')]);
    expect(arquivos()).toEqual(['b.bdp']);
    const indice = await lerIndice(join(dados, 'biblioteca.json'), pastaPadrao);
    expect(indice.indice.entradas.map((e) => e.nomeArquivo)).toEqual(['b.bdp']);
    expect(await m.chamar(CANAIS_BIBLIOTECA.excluir, LEGITIMO, a.identificador)).toMatchObject({ ok: false, codigo: 'NAO_ENCONTRADO' });
  });

  it('trabalho aberto não é excluído e nem chega a pedir confirmação', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    let perguntou = false;
    const m = montar({ confirmarExclusao: async () => ((perguntou = true), true) });
    const a = (await listar(m)).itens[0]!;
    await m.chamar(CANAIS_BIBLIOTECA.abrir, LEGITIMO, a.identificador);
    expect(await m.chamar(CANAIS_BIBLIOTECA.excluir, LEGITIMO, a.identificador)).toMatchObject({ ok: false, codigo: 'ABERTO_NO_APP' });
    expect(perguntou).toBe(false);
    expect(arquivos()).toEqual(['a.bdp']);
  });

  it('Lixeira falhou: nada é apagado', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const m = montar({ enviarParaLixeira: () => Promise.reject(new Error('sem lixeira neste volume')) });
    const a = (await listar(m)).itens[0]!;
    expect(await m.chamar(CANAIS_BIBLIOTECA.excluir, LEGITIMO, a.identificador)).toMatchObject({ ok: false, codigo: 'LIXEIRA_FALHOU' });
    expect(arquivos()).toEqual(['a.bdp']);
  });
});

describe('pasta configurável', () => {
  it('cancelar mantém a pasta', async () => {
    const m = montar();
    expect(await m.chamar(CANAIS_BIBLIOTECA.escolherPasta, LEGITIMO)).toEqual({ ok: false, motivo: 'CANCELADO' });
    expect(existsSync(join(dados, 'preferencias.json'))).toBe(false);
  });

  it('a pasta escolhida vale para a sessão seguinte e não depende do índice', async () => {
    const outra = join(raiz, 'Minha pasta');
    await gravarProjeto(outra, 'x.bdp', 'Na outra pasta');
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Na padrão');
    const m = montar();
    pastaDialogo = outra;
    const r = await m.chamar<ResultadoListar>(CANAIS_BIBLIOTECA.escolherPasta, LEGITIMO);
    expect(r).toMatchObject({ ok: true, pasta: { nome: 'Minha pasta', padrao: false } });
    if (r.ok) expect(r.itens.map((i) => i.nomeArquivo)).toEqual(['x.bdp']);

    rmSync(join(dados, 'biblioteca.json'));
    const l = await listar(montar());
    expect(l.pasta.nome).toBe('Minha pasta');
    expect(l.itens.map((i) => i.titulo)).toEqual(['Na outra pasta']);

    pastaDialogo = pastaPadrao;
    const volta = await montar().chamar<ResultadoListar>(CANAIS_BIBLIOTECA.escolherPasta, LEGITIMO);
    expect(volta).toMatchObject({ ok: true, pasta: { padrao: true } });
    expect(JSON.parse(readFileSync(join(dados, 'preferencias.json'), 'utf8'))).toMatchObject({ pastaBiblioteca: null });
  });

  it('pasta escolhida que sumiu → PASTA_INACESSIVEL (sem cair na padrão)', async () => {
    const outra = join(raiz, 'Temporária');
    mkdirSync(outra);
    pastaDialogo = outra;
    await montar().chamar(CANAIS_BIBLIOTECA.escolherPasta, LEGITIMO);
    rmSync(outra, { recursive: true });
    const r = await montar().chamar<ResultadoListar>(CANAIS_BIBLIOTECA.listar, LEGITIMO);
    expect(r).toMatchObject({ ok: false, codigo: 'PASTA_INACESSIVEL' });
    if (!r.ok) expect(r.mensagem).toContain('Temporária');
    expect(existsSync(pastaPadrao)).toBe(false);
  });

  it('preferências inválidas → pasta padrão', async () => {
    mkdirSync(dados, { recursive: true });
    writeFileSync(join(dados, 'preferencias.json'), '{"formato":"bibliodocs-preferencias","versao":1,"pastaBiblioteca":5}');
    expect((await listar(montar())).pasta.padrao).toBe(true);
  });
});

describe('recusas de IPC (C-11)', () => {
  const ID_FALSO = 'A'.repeat(22);
  it.each<[string, unknown[]]>([
    [CANAIS_BIBLIOTECA.listar, []],
    [CANAIS_BIBLIOTECA.escolherPasta, []],
    [CANAIS_BIBLIOTECA.criar, ['tese']],
    [CANAIS_BIBLIOTECA.abrir, [ID_FALSO]],
    [CANAIS_BIBLIOTECA.renomear, [ID_FALSO, 'x']],
    [CANAIS_BIBLIOTECA.duplicar, [ID_FALSO]],
    [CANAIS_BIBLIOTECA.excluir, [ID_FALSO]],
  ])('%s: remetente de fora e quantidade errada de argumentos são recusados antes do disco', async (canal, args) => {
    const m = montar();
    await expect(m.chamar(canal, { ...LEGITIMO, idConteudo: 99 }, ...args)).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(m.chamar(canal, { ...LEGITIMO, quadroPrincipal: false }, ...args)).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(m.chamar(canal, LEGITIMO, ...args, 'extra')).rejects.toBeInstanceOf(ErroIpcRecusado);
    expect(existsSync(pastaPadrao)).toBe(false);
  });

  it.each<[string, unknown[]]>([
    ['identificador com caminho', [CANAIS_BIBLIOTECA.abrir, 'C:\\Windows\\win.ini']],
    ['identificador não texto', [CANAIS_BIBLIOTECA.excluir, { id: 1 }]],
    ['nome não texto', [CANAIS_BIBLIOTECA.renomear, 'A'.repeat(22), 42]],
    ['nome gigante', [CANAIS_BIBLIOTECA.renomear, 'A'.repeat(22), 'x'.repeat(1_001)]],
    ['tipo genérico (não é mais oferecido)', [CANAIS_BIBLIOTECA.criar, 'generico']],
    ['tipo desconhecido', [CANAIS_BIBLIOTECA.criar, 'tcc']],
    ['tipo não texto', [CANAIS_BIBLIOTECA.criar, { tipo: 'tese' }]],
  ])('argumento fora do contrato: %s', async (_caso, [canal, ...args]) => {
    await expect(montar().chamar(canal as string, LEGITIMO, ...args)).rejects.toBeInstanceOf(ErroIpcRecusado);
  });

  it('identificador desconhecido é erro esperado, não recusa', async () => {
    const m = montar();
    expect(await m.chamar(CANAIS_BIBLIOTECA.duplicar, LEGITIMO, 'B'.repeat(22))).toMatchObject({ ok: false, codigo: 'NAO_ENCONTRADO' });
    expect(await m.chamar(CANAIS_BIBLIOTECA.abrir, LEGITIMO, 'B'.repeat(22))).toMatchObject({ ok: false, motivo: 'ERRO' });
  });
});

describe('protocolo de resumo do processo leitor', () => {
  const base = join(tmpdir(), 'x.bdp');
  const resumoOk: ResumoProjeto = { estado: 'ok', id: 'prj_Exemplo01', titulo: 'T', tipoTrabalho: 'generico', criadoEm: 'a', atualizadoEm: 'b' };

  it('pedido: só caminhos absolutos, entre 1 e o máximo', () => {
    expect(lerPedidoResumo({ resumir: [base] })).not.toBeNull();
    expect(lerPedidoResumo({ resumir: [] })).toBeNull();
    expect(lerPedidoResumo({ resumir: ['relativo.bdp'] })).toBeNull();
    expect(lerPedidoResumo({ resumir: [base], extra: 1 })).toBeNull();
    expect(lerPedidoResumo({ resumir: Array(MAX_ARQUIVOS_RESUMO + 1).fill(base) })).toBeNull();
    expect(lerPedidoResumo({ caminho: base, pastaBackups: base })).toBeNull();
  });

  it('resposta: tamanho igual ao pedido, campos estritos, título limitado', () => {
    expect(lerRespostaResumo({ resumos: [resumoOk, { estado: 'invalido' }] }, 2)).toHaveLength(2);
    expect(lerRespostaResumo({ resumos: [resumoOk] }, 2)).toBeNull();
    expect(lerRespostaResumo({ resumos: [{ ...resumoOk, caminho: 'C:\\x' }] }, 1)).toBeNull();
    expect(lerRespostaResumo({ resumos: [{ ...resumoOk, titulo: 'x'.repeat(501) }] }, 1)).toBeNull();
    expect(lerRespostaResumo({ resumos: [{ estado: 'versaoFutura', versaoFormato: 9 }] }, 1)).toHaveLength(1);
    expect(lerRespostaResumo({ ok: false, erros: [] }, 1)).toBeNull();
  });

  it('resumirProjeto lê título, tipo e datas sem gravar nada', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Título  com\tespaços');
    const antes = arquivos();
    expect(await resumirProjeto(join(pastaPadrao, 'a.bdp'))).toMatchObject({ estado: 'ok', titulo: 'Título com espaços', tipoTrabalho: 'generico' });
    expect(await resumirProjeto(join(pastaPadrao, 'nao-existe.bdp'))).toEqual({ estado: 'invalido' });
    expect(arquivos()).toEqual(antes);
  });
});

describe('preload (C-10) — biblioteca', () => {
  it('cada função usa só o seu canal fixo e repassa os argumentos', async () => {
    const chamadas: unknown[][] = [];
    const api = criarApiBiblioDocs(async (...a) => (chamadas.push(a), { ok: true }));
    await api.biblioteca.listar();
    await api.biblioteca.escolherPasta();
    await api.biblioteca.criar('tese');
    await api.biblioteca.abrir('i');
    await api.biblioteca.renomear('i', 'n');
    await api.biblioteca.duplicar('i');
    await api.biblioteca.excluir('i');
    const c = CANAIS_BIBLIOTECA;
    expect(chamadas).toEqual([[c.listar], [c.escolherPasta], [c.criar, 'tese'], [c.abrir, 'i'], [c.renomear, 'i', 'n'], [c.duplicar, 'i'], [c.excluir, 'i']]);
    expect(Object.isFrozen(api.biblioteca)).toBe(true);
  });
});

describe('registro de identificadores', () => {
  it('compara caminhos sem diferença de caixa no Windows', () => {
    const r = new RegistroProjetos();
    const id = r.registrar(join(raiz, 'A.bdp'), 1);
    expect(r.contem(join(raiz, process.platform === 'win32' ? 'a.bdp' : 'A.bdp'))).toBe(true);
    expect(r.idPara(join(raiz, 'A.bdp'), 1)).toBe(id);
    expect(r.idPara(join(raiz, 'A.bdp'), 2)).not.toBe(id);
    r.manterSo(1, []);
    expect(r.caminho(id, 1)).toBeNull();
    expect(r.tamanho).toBe(1);
  });
});

// ---------- Correções da revisão do `revisor-seguranca` (M1-T09) ----------

const nunca = <T>() => new Promise<T>(() => undefined);
const erroCodigo = (code: string) => Object.assign(new Error(`${code}: falso`), { code });

describe('revisão A1 — listagem grande sem custo quadrático', () => {
  it('registro: 5 000 idPara + manterSo em menos de 1 s', () => {
    const r = new RegistroProjetos();
    const caminhos = Array.from({ length: 5_000 }, (_, i) => join(raiz, `t${i}.bdp`));
    const t0 = performance.now();
    for (let rodada = 0; rodada < 2; rodada++) {
      caminhos.forEach((c) => r.idPara(c, JANELA));
      r.manterSo(JANELA, caminhos);
    }
    expect(performance.now() - t0).toBeLessThan(1_000);
    expect(r.tamanho).toBe(5_000);
  });

  it('listar 5 000 arquivos (resumo falso) termina rápido e mantém as chaves', async () => {
    mkdirSync(pastaPadrao, { recursive: true });
    for (let i = 0; i < 5_000; i++) writeFileSync(join(pastaPadrao, `t${String(i).padStart(4, '0')}.bdp`), 'x');
    const ok: ResumoProjeto = { estado: 'ok', id: 'prj_Exemplo01', titulo: 'T', tipoTrabalho: 'generico', criadoEm: 'a', atualizadoEm: 'b' };
    const m = montar({ resumir: async (cs) => cs.map(() => ok) });
    const t0 = performance.now();
    const l1 = await listar(m);
    const l2 = await listar(m);
    expect(l1.itens).toHaveLength(5_000);
    expect(l2.itens.map((i) => i.identificador)).toEqual(l1.itens.map((i) => i.identificador));
    expect(performance.now() - t0).toBeLessThan(15_000);
  }, 30_000);
});

describe('revisão M1 — exceção inesperada não leva caminho ao renderer', () => {
  it('blindar troca qualquer erro por ErroIpcRecusado genérico', async () => {
    const { blindar } = await import('../src/principal/ipc/chamada');
    const logs: string[] = [];
    const m = blindar('canal', async () => Promise.reject(new Error(`ENOENT: lstat '${raiz}\\x.bdp'`)), (l) => logs.push(l));
    const erro = await m(LEGITIMO, []).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroIpcRecusado);
    expect((erro as Error).message).toBe('chamada recusada');
    expect(logs.join(' ')).toContain('ENOENT');
    const recusa = blindar('canal', async () => Promise.reject(new ErroIpcRecusado()), (l) => logs.push(l));
    await expect(recusa(LEGITIMO, [])).rejects.toBeInstanceOf(ErroIpcRecusado);
  });

  it('criar: arquivo some logo depois de gravado → ainda ok, e a próxima lista resume de novo', async () => {
    const { SISTEMA_ARQUIVOS_NODE } = await import('../src/persistencia');
    let gravado = false;
    const fs = {
      ...SISTEMA_ARQUIVOS_NODE,
      info: async (c: string) => {
        if (gravado && c.endsWith('Trabalho sem título.bdp')) throw erroCodigo('ENOENT');
        return SISTEMA_ARQUIVOS_NODE.info(c);
      },
    };
    const m = montar({
      fs,
      salvar: async (d, p) => {
        const r = await salvarProjeto(d, p);
        gravado = true;
        return r;
      },
    });
    const r = await m.chamar<ResultadoCriar>(CANAIS_BIBLIOTECA.criar, LEGITIMO, 'monografia');
    expect(r).toMatchObject({ ok: true, item: { bytes: 0, modificadoEm: 0 } });
  });
});

describe('revisão M2/M4 — diálogos fora da fila e reconferência', () => {
  it('diálogo de pasta esquecido aberto não trava a listagem', async () => {
    const m = montar({ escolherPasta: () => nunca() });
    void m.chamar(CANAIS_BIBLIOTECA.escolherPasta, LEGITIMO);
    expect((await listar(m)).ok).toBe(true);
  });

  it('confirmação aberta não trava; renomeado durante a pergunta → não exclui', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    let responder: (v: boolean) => void = () => undefined;
    const m = montar({ confirmarExclusao: () => new Promise<boolean>((res) => (responder = res)) });
    const a = (await listar(m)).itens[0]!;
    const exclusao = m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.excluir, LEGITIMO, a.identificador);
    expect(await m.chamar(CANAIS_BIBLIOTECA.renomear, LEGITIMO, a.identificador, 'b')).toMatchObject({ ok: true });
    responder(true);
    expect(await exclusao).toMatchObject({ ok: false, codigo: 'NAO_ENCONTRADO' });
    expect(arquivos()).toEqual(['b.bdp']);
    expect(lixeira).toEqual([]);
  });

  it('aberto em outra janela durante a pergunta → não exclui', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    let responder: (v: boolean) => void = () => undefined;
    const m = montar({ confirmarExclusao: () => new Promise<boolean>((res) => (responder = res)) });
    const a = (await listar(m)).itens[0]!;
    const b = (await listar(m, OUTRA_JANELA)).itens[0]!;
    const exclusao = m.chamar<ResultadoItem>(CANAIS_BIBLIOTECA.excluir, LEGITIMO, a.identificador);
    expect((await m.chamar<ResultadoAbrir>(CANAIS_BIBLIOTECA.abrir, OUTRA_JANELA, b.identificador)).ok).toBe(true);
    responder(true);
    expect(await exclusao).toMatchObject({ ok: false, codigo: 'ABERTO_NO_APP' });
    expect(arquivos()).toEqual(['a.bdp']);
  });

  it('link de pasta escolhido é recusado com mensagem clara', async () => {
    const alvo = join(raiz, 'alvo');
    mkdirSync(alvo);
    const juncao = join(raiz, 'juncao');
    const { symlinkSync } = await import('node:fs');
    symlinkSync(alvo, juncao, 'junction');
    pastaDialogo = juncao;
    const r = await montar().chamar<ResultadoListar>(CANAIS_BIBLIOTECA.escolherPasta, LEGITIMO);
    expect(r).toMatchObject({ ok: false, codigo: 'PASTA_INACESSIVEL' });
    if (!r.ok) expect(r.mensagem).toContain('links');
  });
});

describe('revisão M3 — arquivo hostil não derruba o lote', () => {
  it('lote perdido é refeito um a um; só o hostil fica inválido no índice', async () => {
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await gravarProjeto(pastaPadrao, 'hostil.bdp', 'H');
    await gravarProjeto(pastaPadrao, 'z.bdp', 'Zê');
    let pedidos = 0;
    const m = montar({
      resumir: async (cs) => {
        pedidos++;
        if (cs.some((c) => c.includes('hostil'))) return null;
        return Promise.all(cs.map((c) => resumirProjeto(c)));
      },
    });
    const l = await listar(m);
    expect(l.itens.map((i) => [i.nomeArquivo, i.estado])).toEqual([
      ['a.bdp', 'ok'],
      ['hostil.bdp', 'invalido'],
      ['z.bdp', 'ok'],
    ]);
    expect(pedidos).toBe(4); // lote + 3 sozinhos
    pedidos = 0;
    await listar(montar({ resumir: async () => ((pedidos++), null) }));
    expect(pedidos).toBe(0); // tudo veio do índice, inclusive o hostil
  });

  it('prazo esgotado: lista parcial com aviso, e o restante fica para a próxima vez', async () => {
    const { varrerPasta, indiceVazio } = await import('../src/persistencia');
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    let t = 0;
    const v = await varrerPasta(pastaPadrao, indiceVazio(pastaPadrao), async () => [], undefined, { prazoMs: 10, agora: () => (t += 100) });
    expect(v.entradas.map((e) => e.resumo.estado)).toEqual(['invalido']);
    expect(v.indice.entradas).toEqual([]);
    expect(v.avisos.join(' ')).toContain('incompleta');
  });
});

describe('revisão B1/B2 — renomear nunca sobrescreve', () => {
  it('volume sem link físico: confere o destino antes do rename', async () => {
    const { renomearSemSobrescrever, SISTEMA_ARQUIVOS_NODE } = await import('../src/persistencia');
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    await gravarProjeto(pastaPadrao, 'b.bdp', 'Dois');
    const semLink = { ...SISTEMA_ARQUIVOS_NODE, vincular: async () => Promise.reject(erroCodigo('EPERM')) };
    const de = join(pastaPadrao, 'a.bdp');
    expect(await renomearSemSobrescrever(de, join(pastaPadrao, 'b.bdp'), semLink)).toEqual({ ok: false, motivo: 'JA_EXISTE' });
    expect(await renomearSemSobrescrever(de, join(pastaPadrao, 'c.bdp'), semLink)).toEqual({ ok: true });
    expect(arquivos()).toEqual(['b.bdp', 'c.bdp']);
  });

  it('nome antigo preso depois do link: desfaz o nome novo e devolve erro', async () => {
    const { renomearSemSobrescrever, SISTEMA_ARQUIVOS_NODE } = await import('../src/persistencia');
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const preso = {
      ...SISTEMA_ARQUIVOS_NODE,
      apagar: async (c: string) => (c.endsWith('a.bdp') ? Promise.reject(erroCodigo('EBUSY')) : SISTEMA_ARQUIVOS_NODE.apagar(c)),
    };
    const r = await renomearSemSobrescrever(join(pastaPadrao, 'a.bdp'), join(pastaPadrao, 'b.bdp'), preso);
    expect(r).toMatchObject({ ok: false, motivo: 'ERRO' });
    expect(arquivos()).toEqual(['a.bdp']);
  });

  it('troca só de caixa para um arquivo diferente (pasta sensível à caixa) → JA_EXISTE', async () => {
    const { renomearSemSobrescrever, SISTEMA_ARQUIVOS_NODE } = await import('../src/persistencia');
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const outraIdentidade = {
      ...SISTEMA_ARQUIVOS_NODE,
      info: async (c: string) => ({ ...(await SISTEMA_ARQUIVOS_NODE.info(c)), identidade: c.endsWith('A.bdp') ? 'outro' : 'este' }),
    };
    expect(await renomearSemSobrescrever(join(pastaPadrao, 'a.bdp'), join(pastaPadrao, 'A.bdp'), outraIdentidade)).toEqual({
      ok: false,
      motivo: 'JA_EXISTE',
    });
  });
});

describe('revisão B3/B4/B6', () => {
  it.each(['a‮b', 'a​b', 'a\uD800b', 'CONIN$', 'conout$'])('nome %j recusado', (n) => {
    expect(validarNomeTrabalho(n).ok).toBe(false);
  });

  it('título com invisíveis vira nome limpo', () => {
    expect(limparNomeArquivo('Meu‮ TCC\uD800')).toBe('Meu TCC.bdp');
  });

  it('preferência com caminho relativo → pasta padrão', async () => {
    mkdirSync(dados, { recursive: true });
    writeFileSync(join(dados, 'preferencias.json'), JSON.stringify({ formato: 'bibliodocs-preferencias', versao: 1, pastaBiblioteca: 'relativa' }));
    expect((await listar(montar())).pasta.padrao).toBe(true);
  });

  it('descritor de outro arquivo que o conferido pelo caminho → recusado', async () => {
    const { lerArquivoLimitado, SISTEMA_ARQUIVOS_NODE } = await import('../src/persistencia');
    await gravarProjeto(pastaPadrao, 'a.bdp', 'Um');
    const trocado = {
      ...SISTEMA_ARQUIVOS_NODE,
      abrirLeitura: async (c: string) => ({ ...(await SISTEMA_ARQUIVOS_NODE.abrirLeitura(c)), identidade: async () => '0:0' }),
    };
    expect(await lerArquivoLimitado(join(pastaPadrao, 'a.bdp'), trocado)).toMatchObject({ ok: false, mensagem: 'o arquivo mudou durante a leitura' });
    expect((await lerArquivoLimitado(join(pastaPadrao, 'a.bdp'))).ok).toBe(true);
  });
});
