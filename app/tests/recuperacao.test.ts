// M1-T12 — recuperação (ADR-0004, seção 4; RNF-04 na parte de unidade): instantâneos, trava de sessão, restos de
// gravação na pasta da biblioteca, ofertas e escolhas; a sessão de edição manda o instantâneo até ~2 s depois de cada
// alteração. Disco real em pasta temporária; leitor e resumo rodam no próprio processo (mesma forma de resposta do
// processo leitor). "Matar o processo" = criar uma instância nova dos manipuladores sobre as mesmas pastas.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ATRASO_INSTANTANEO_MS,
  CANAIS_PROJETOS,
  FATOR_ESPACAMENTO_INSTANTANEO,
  CANAIS_RECUPERACAO,
  criarTrabalhoVazio,
  MENSAGEM_FALHA_INSTANTANEO,
  SessaoTrabalho,
  type OfertaRecuperacao,
  type PacoteTransferivel,
  type ResultadoAbrir,
  type ResultadoAbrirDescartada,
  type ResultadoListarDescartadas,
  type ResultadoInstantaneo,
  type ResultadoRecuperar,
} from '../src/aplicacao';
import { avisoRecuperado, quandoLegivel, textoOferta } from '../src/interface/biblioteca/recuperacao';
import {
  abrirProjeto,
  apagarInstantaneos,
  arquivar,
  arquivarInstantaneos,
  gravarInstantaneo,
  gravarTrava,
  IDADE_MINIMA_RESTO_MS,
  instantaneosDe,
  lerTrava,
  limparAntigos,
  listarTravas,
  MAX_RESTOS_POR_LISTAGEM,
  NOME_INSTANTANEO,
  NOME_INSTANTANEO_ANTERIOR,
  PRAZO_ANTIGOS_MS,
  procurarRestos,
  resumirProjeto,
  salvarProjeto,
  type PastasRecuperacao,
} from '../src/persistencia';
import { lerPacoteTransferivel } from '../src/principal/ipc/argumentos';
import { ErroIpcRecusado } from '../src/principal/ipc/chamada';
import { criarManipuladoresProjetos } from '../src/principal/ipc/manipuladores-projetos';
import { criarManipuladoresRecuperacao, MAX_VERSOES_DESCARTADAS, MENSAGEM_DESCARTADA_COM_OFERTA, MENSAGEM_DESCARTADA_ILEGIVEL, MENSAGEM_JA_ABERTO, MENSAGEM_OFERTA_VENCIDA, pastasRecuperacao } from '../src/principal/ipc/manipuladores-recuperacao';
import { paraRespostaLeitor } from '../src/principal/ipc/protocolo-leitor';
import type { InfoRemetente } from '../src/principal/ipc/remetente';
import { RegistroProjetos } from '../src/principal/ipc/registro-projetos';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';

const JANELA = 7;
const OUTRA_JANELA = 8;
const LEGITIMO: InfoRemetente = { idConteudo: JANELA, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };
const ID_PROJETO = 'prj_abcdefghijklmnop';
const OUTRO_PID = 999_999;

let raiz: string;
let biblioteca: string;
let pastas: PastasRecuperacao;
let logs: string[];

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'bdp-recuperacao-'));
  biblioteca = join(raiz, 'Trabalhos');
  mkdirSync(biblioteca);
  pastas = pastasRecuperacao(join(raiz, 'local'));
  logs = [];
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

function pacote(titulo: string, id = ID_PROJETO): PacoteTransferivel {
  const t = criarTrabalhoVazio({ id, agora: '2026-10-16T10:00:00.000Z', appVersao: '0.1.0' });
  return { ...t, documento: { ...t.documento, metadados: { titulo: [{ tipo: 'texto', texto: titulo }] } }, midias: [] };
}

const paraProjeto = (p: PacoteTransferivel) => {
  const r = lerPacoteTransferivel(p);
  if (!r.ok) throw new Error('pacote de teste inválido');
  return r.valor;
};

async function gravarTrabalho(nome: string, titulo: string, id = ID_PROJETO): Promise<string> {
  const caminho = join(biblioteca, nome);
  const r = await salvarProjeto(caminho, paraProjeto(pacote(titulo, id)));
  expect(r.ok).toBe(true);
  return caminho;
}

/** Deixa o arquivo com data de modificação no passado (o instantâneo gravado depois fica "mais novo"). */
const envelhecer = (caminho: string, segundos = 60) => {
  const t = (Date.now() - segundos * 1000) / 1000;
  utimesSync(caminho, t, t);
};

/** Uma "instância do app": registro dos projetos, manipuladores de projetos e de recuperação. */
/** Relógio do "app" 1 h à frente: os restos criados pelo teste já passaram da idade mínima de 10 min. */
const ADIANTE_MS = 60 * 60 * 1000;

function processo(pid = OUTRO_PID, extra: { salvar?: (d: string, p: PacoteProjetoTeste) => ReturnType<typeof salvarProjeto> } = {}) {
  const registro = new RegistroProjetos();
  const ler = async (c: string) => paraRespostaLeitor(await abrirProjeto(c, { pastaBackups: join(raiz, 'backups') }));
  const rec = criarManipuladoresRecuperacao({
    origem: ORIGEM_PRODUCAO,
    conteudosPermitidos: () => new Set([JANELA, OUTRA_JANELA]),
    pastas,
    projetos: registro,
    pastaBiblioteca: async () => biblioteca,
    ler,
    resumir: async (caminhos) => Promise.all(caminhos.map((c) => resumirProjeto(c))),
    salvar: extra.salvar ?? ((d, p) => salvarProjeto(d, p)),
    pid,
    agora: () => new Date(Date.now() + ADIANTE_MS),
    log: (m) => logs.push(m),
  });
  const proj = criarManipuladoresProjetos({
    origem: ORIGEM_PRODUCAO,
    conteudosPermitidos: () => new Set([JANELA]),
    escolherArquivoParaAbrir: async () => null,
    escolherDestino: async () => null,
    ler,
    salvar: extra.salvar ?? ((d, p) => salvarProjeto(d, p)),
    registro,
    antesDeGravar: rec.antesDeGravar,
    aoGravar: rec.aoGravar,
    aoFechar: rec.aoFechar,
    log: (m) => logs.push(m),
  });
  const chamar = (canal: string, ...args: unknown[]) => {
    const todos = { ...proj.manipuladores, ...rec.manipuladores } as Record<string, (r: InfoRemetente, a: unknown[]) => Promise<unknown>>;
    return todos[canal]!(LEGITIMO, args);
  };
  return {
    registro,
    rec,
    abrirArquivo: (caminho: string, idProjeto: string | null = ID_PROJETO) => registro.registrar(caminho, JANELA, idProjeto),
    instantaneo: (id: string, p: PacoteTransferivel) => chamar(CANAIS_RECUPERACAO.instantaneo, id, p) as Promise<ResultadoInstantaneo>,
    listar: async () => ((await chamar(CANAIS_RECUPERACAO.listar)) as { ofertas: OfertaRecuperacao[] }).ofertas,
    recuperar: (oferta: string) => chamar(CANAIS_RECUPERACAO.recuperar, oferta) as Promise<ResultadoRecuperar>,
    abrirSalvo: (oferta: string) => chamar(CANAIS_RECUPERACAO.abrirSalvo, oferta) as Promise<ResultadoAbrir>,
    listarDescartadas: async () => ((await chamar(CANAIS_RECUPERACAO.listarDescartadas)) as ResultadoListarDescartadas).versoes,
    abrirDescartada: (id: string) => chamar(CANAIS_RECUPERACAO.abrirDescartada, id) as Promise<ResultadoAbrirDescartada>,
    salvar: (id: string, p: PacoteTransferivel) => chamar(CANAIS_PROJETOS.salvar, id, p) as Promise<{ ok: boolean }>,
    fechar: (id: string) => chamar(CANAIS_PROJETOS.fechar, id),
    chamar,
  };
}

type PacoteProjetoTeste = Parameters<typeof salvarProjeto>[1];
const pastaInstantaneos = () => join(pastas.recuperacao, ID_PROJETO);
const reservados = () => arquivosDe(pastas.recuperacao).filter((n) => n.startsWith(`${ID_PROJETO}~`));
const arquivosDe = (pasta: string) => (existsSync(pasta) ? readdirSync(pasta).sort() : []);
const tituloDe = (p: { documento: { metadados: { titulo: { texto: string }[] } } }) => p.documento.metadados.titulo.map((t) => t.texto).join('');

describe('persistência da recuperação', () => {
  it('instantâneo: guarda só o mais recente e o anterior, sem .bak nem temporário', async () => {
    for (const n of [1, 2, 3]) expect((await gravarInstantaneo(pastas, ID_PROJETO, new Uint8Array([n]))).ok).toBe(true);
    expect(arquivosDe(pastaInstantaneos())).toEqual([NOME_INSTANTANEO_ANTERIOR, NOME_INSTANTANEO].sort());
    expect([...readFileSync(join(pastaInstantaneos(), NOME_INSTANTANEO))]).toEqual([3]);
    expect([...readFileSync(join(pastaInstantaneos(), NOME_INSTANTANEO_ANTERIOR))]).toEqual([2]);
    expect((await instantaneosDe(pastas, ID_PROJETO)).map((i) => i.caminho.endsWith(NOME_INSTANTANEO))).toEqual([true, false]);
  });

  it('id fora do padrão nunca vira nome de pasta', async () => {
    expect((await gravarInstantaneo(pastas, '..\\..\\x', new Uint8Array([1]))).ok).toBe(false);
    expect(await gravarTrava(pastas, '../x', { pid: 1, desde: 'x', caminho: join(raiz, 'a.bdp') })).toBe(false);
    expect(existsSync(pastas.recuperacao)).toBe(false);
  });

  it('trava: ida e volta; conteúdo inválido ou com campo extra → null', async () => {
    const trava = { pid: 42, desde: '2026-10-16T13:00:00.000Z', caminho: join(biblioteca, 'A.bdp') };
    expect(await gravarTrava(pastas, ID_PROJETO, trava)).toBe(true);
    expect(await lerTrava(pastas, ID_PROJETO)).toEqual(trava);
    expect(await listarTravas(pastas)).toEqual([ID_PROJETO]);
    // Regravar não cria .bak.
    expect(await gravarTrava(pastas, ID_PROJETO, { ...trava, pid: 43 })).toBe(true);
    expect(arquivosDe(pastas.sessao)).toEqual([`${ID_PROJETO}.lock`]);

    const arquivo = join(pastas.sessao, `${ID_PROJETO}.lock`);
    writeFileSync(arquivo, '{"formato":"bibliodocs-trava-sessao","pid":1,"desde":"x","caminho":"relativo.bdp"}');
    expect(await lerTrava(pastas, ID_PROJETO)).toBeNull();
    writeFileSync(arquivo, JSON.stringify({ formato: 'bibliodocs-trava-sessao', ...trava, extra: 1 }));
    expect(await lerTrava(pastas, ID_PROJETO)).toBeNull();
    writeFileSync(arquivo, 'não é json');
    expect(await lerTrava(pastas, ID_PROJETO)).toBeNull();
  });

  it('apagar remove os instantâneos e a pasta; arquivar move sem sobrescrever', async () => {
    await gravarInstantaneo(pastas, ID_PROJETO, new Uint8Array([1]));
    await gravarInstantaneo(pastas, ID_PROJETO, new Uint8Array([2]));
    const agora = Date.UTC(2026, 9, 16, 13, 0, 0);
    await arquivarInstantaneos(pastas, ID_PROJETO, agora);
    expect(existsSync(pastaInstantaneos())).toBe(false);
    expect(arquivosDe(pastas.antigos)).toEqual([`${ID_PROJETO}-20261016-130000-anterior.bdp`, `${ID_PROJETO}-20261016-130000-atual.bdp`]);

    await gravarInstantaneo(pastas, ID_PROJETO, new Uint8Array([3]));
    await arquivarInstantaneos(pastas, ID_PROJETO, agora);
    expect(arquivosDe(pastas.antigos)).toContain(`${ID_PROJETO}-20261016-130000-atual.bdp-2`);
    expect([...readFileSync(join(pastas.antigos, `${ID_PROJETO}-20261016-130000-atual.bdp`))]).toEqual([2]);

    await gravarInstantaneo(pastas, ID_PROJETO, new Uint8Array([4]));
    await apagarInstantaneos(pastas, ID_PROJETO);
    expect(existsSync(pastaInstantaneos())).toBe(false);
  });

  it('limparAntigos apaga só o que passou de 7 dias', async () => {
    mkdirSync(pastas.antigos, { recursive: true });
    writeFileSync(join(pastas.antigos, 'velho'), 'x');
    writeFileSync(join(pastas.antigos, 'novo'), 'x');
    const oitoDias = (Date.now() - 8 * 24 * 3600 * 1000) / 1000;
    utimesSync(join(pastas.antigos, 'velho'), oitoDias, oitoDias);
    await limparAntigos(pastas, Date.now());
    expect(arquivosDe(pastas.antigos)).toEqual(['novo']);
    expect(PRAZO_ANTIGOS_MS).toBe(7 * 24 * 3600 * 1000);
  });

  it('restos: separa temporário, cópia do .bak e .bak; ignora os temporários do próprio processo', async () => {
    for (const n of ['A.bdp.tmp-123-ab12', 'A.bdp.tmp-77-ff', 'B.bdp.bak.tmp-123-cd', 'B.bdp.bak.tmp-77-ee', 'C.bdp.bak', 'C.bdp', 'x.txt.tmp-1-a']) {
      writeFileSync(join(biblioteca, n), 'x');
    }
    const r = await procurarRestos(biblioteca, 77, Date.now() + IDADE_MINIMA_RESTO_MS + 1000);
    expect(r.temporarios).toEqual([{ caminho: join(biblioteca, 'A.bdp.tmp-123-ab12'), original: join(biblioteca, 'A.bdp') }]);
    expect(r.copiasBak).toEqual([join(biblioteca, 'B.bdp.bak.tmp-123-cd')]);
    expect(r.baks).toEqual([{ caminho: join(biblioteca, 'C.bdp.bak'), original: join(biblioteca, 'C.bdp') }]);
  });

  it('restos: mais novos que 10 min ficam de fora (gravação em curso em outro PC); no máximo 100 por listagem', async () => {
    writeFileSync(join(biblioteca, 'A.bdp.tmp-123-ab'), 'x');
    expect((await procurarRestos(biblioteca, 77, Date.now())).temporarios).toEqual([]);
    expect((await procurarRestos(biblioteca, 77, Date.now() + IDADE_MINIMA_RESTO_MS + 1000)).temporarios).toHaveLength(1);
    for (let i = 0; i < MAX_RESTOS_POR_LISTAGEM + 20; i++) writeFileSync(join(biblioteca, `T${i}.bdp.bak`), 'x');
    const r = await procurarRestos(biblioteca, 77, Date.now() + IDADE_MINIMA_RESTO_MS + 1000);
    expect(r.temporarios.length + r.baks.length + r.copiasBak.length).toBe(MAX_RESTOS_POR_LISTAGEM);
  });

  it('arquivado conta 7 dias da data do arquivamento, não da data do arquivo (revisão A1)', async () => {
    const velho = join(raiz, 'velho.bdp');
    writeFileSync(velho, 'x');
    const dezDias = (Date.now() - 10 * 24 * 3600 * 1000) / 1000;
    utimesSync(velho, dezDias, dezDias);
    const destino = await arquivar(pastas, velho, 'velho.bdp', Date.now());
    expect(destino).not.toBeNull();
    await limparAntigos(pastas, Date.now());
    expect(arquivosDe(pastas.antigos)).toEqual(['velho.bdp']);
    await limparAntigos(pastas, Date.now() + PRAZO_ANTIGOS_MS + 1000);
    expect(arquivosDe(pastas.antigos)).toEqual([]);
  });
});

describe('recuperação: instantâneo do trabalho aberto (RNF-04, unidade)', () => {
  it('processo morto durante a edição → a próxima abertura oferece a versão do instantâneo, com o título editado', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    const id = antes.abrirArquivo(caminho);
    expect(await antes.instantaneo(id, pacote('Editado 1'))).toEqual({ ok: true });
    expect(await antes.instantaneo(id, pacote('Editado 2'))).toEqual({ ok: true });
    expect((await lerTrava(pastas, ID_PROJETO))?.pid).toBe(111);
    // O próprio processo não oferece a sessão que está ativa.
    expect(await antes.listar()).toEqual([]);

    // O processo morre (nada roda); o app abre de novo.
    const depois = processo(222);
    const ofertas = await depois.listar();
    expect(ofertas).toHaveLength(1);
    expect(ofertas[0]).toMatchObject({ tipo: 'instantaneo', nomeArquivo: 'Trabalho.bdp', titulo: 'Editado 2', arquivoSalvoExiste: true });
    expect(JSON.stringify(ofertas)).not.toContain(raiz); // nenhum caminho vai ao renderer

    const r = await depois.recuperar(ofertas[0]!.identificador);
    if (!r.ok) throw new Error(r.mensagem);
    expect(r.tipo).toBe('instantaneo');
    expect(tituloDe(r.projeto.pacote)).toBe('Editado 2');
    expect(r.projeto.nomeArquivo).toBe('Trabalho.bdp');
    expect(depois.registro.caminho(r.projeto.identificador!, JANELA)).toBe(caminho);
    // O arquivo do usuário não muda ao recuperar: o conteúdo vai para ele no próximo salvamento.
    const noDisco = await abrirProjeto(caminho);
    expect(noDisco.ok && tituloDe(noDisco.pacote)).toBe('Salvo');
    expect((await lerTrava(pastas, ID_PROJETO))?.pid).toBe(222);
    expect(await depois.listar()).toEqual([]);

    // Ao salvar no arquivo, os instantâneos somem.
    expect((await depois.salvar(r.projeto.identificador!, pacote('Editado 2'))).ok).toBe(true);
    expect(existsSync(pastaInstantaneos())).toBe(false);
  });

  it('a oferta usa o instantâneo anterior quando o mais recente não abre', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    const id = antes.abrirArquivo(caminho);
    await antes.instantaneo(id, pacote('Bom'));
    await antes.instantaneo(id, pacote('Ruim'));
    writeFileSync(join(pastaInstantaneos(), NOME_INSTANTANEO), 'corrompido');
    const depois = processo(222);
    const [oferta] = await depois.listar();
    expect(oferta?.titulo).toBe('Bom');
    const r = await depois.recuperar(oferta!.identificador);
    expect(r.ok && tituloDe(r.projeto.pacote)).toBe('Bom');
  });

  it('salvar no arquivo apaga os instantâneos: depois de uma queda não há o que oferecer', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    const p = processo(111);
    const id = p.abrirArquivo(caminho);
    await p.instantaneo(id, pacote('Editado'));
    expect((await p.salvar(id, pacote('Editado'))).ok).toBe(true);
    expect(existsSync(pastaInstantaneos())).toBe(false);
    expect(await processo(222).listar()).toEqual([]);
    expect(await listarTravas(pastas)).toEqual([]); // trava órfã sem instantâneo é limpa na listagem
  });

  it('fechar a janela normalmente (alterações descartadas) guarda os instantâneos 7 dias e não oferece nada', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const p = processo(111);
    const id = p.abrirArquivo(caminho);
    await p.instantaneo(id, pacote('Descartado'));
    await p.rec.encerrarDono(JANELA, true);
    expect(existsSync(pastaInstantaneos())).toBe(false);
    expect(arquivosDe(pastas.antigos).some((n) => n.startsWith(ID_PROJETO))).toBe(true);
    expect(await listarTravas(pastas)).toEqual([]);
    expect(await processo(222).listar()).toEqual([]);
  });

  it('fechar o trabalho descartando também termina a sessão; fechar um identificador repetido não', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const p = processo(111);
    const id = p.abrirArquivo(caminho);
    const repetido = p.abrirArquivo(caminho);
    await p.instantaneo(id, pacote('Editado'));
    await p.fechar(repetido);
    expect(existsSync(join(pastaInstantaneos(), NOME_INSTANTANEO))).toBe(true);
    await p.fechar(id);
    expect(existsSync(pastaInstantaneos())).toBe(false);
    expect(await listarTravas(pastas)).toEqual([]);
  });

  it('janela que cai ou recarrega: a sessão some sem limpar e a mesma instância oferece a recuperação', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const p = processo(111);
    const id = p.abrirArquivo(caminho);
    await p.instantaneo(id, pacote('Na memória'));
    await p.rec.encerrarDono(JANELA, false);
    p.registro.esquecerDono(JANELA);
    const ofertas = await p.listar();
    expect(ofertas.map((o) => o.titulo)).toEqual(['Na memória']);
  });

  it('instantâneo pedido antes do fechamento nunca é gravado depois da limpeza (fila única)', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    const p = processo(111);
    const id = p.abrirArquivo(caminho);
    await p.instantaneo(id, pacote('1'));
    const [a, b] = await Promise.all([p.instantaneo(id, pacote('2')), p.fechar(id)]);
    // O fechamento esquece o identificador na hora; o instantâneo, ao chegar a vez dele na fila, já não grava.
    expect(a).toEqual({ ok: false, codigo: 'NAO_ABERTO' });
    expect(b).toBeUndefined();
    expect(existsSync(pastaInstantaneos())).toBe(false);
    // Depois de fechado, o identificador não vale mais.
    expect(await p.instantaneo(id, pacote('3'))).toEqual({ ok: false, codigo: 'NAO_ABERTO' });
    expect(existsSync(pastaInstantaneos())).toBe(false);
  });

  it('arquivo mais novo que o instantâneo (relógio, sincronização): oferecido mesmo assim, nada arquivado sem decisão (M3)', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    const p = processo(111);
    await p.instantaneo(p.abrirArquivo(caminho), pacote('Velho'));
    envelhecer(join(pastaInstantaneos(), NOME_INSTANTANEO));
    expect((await processo(222).listar()).map((o) => o.titulo)).toEqual(['Velho']);
    expect(arquivosDe(pastas.antigos)).toEqual([]);
  });

  it('salvamento não apaga instantâneo que chegou durante a gravação; a sessão manda outro depois (revisão A3)', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    let liberar!: () => void;
    const p = processo(111, {
      salvar: async (d, pac) => {
        await new Promise<void>((ok) => (liberar = ok));
        return salvarProjeto(d, pac);
      },
    });
    const id = p.abrirArquivo(caminho);
    await p.instantaneo(id, pacote('Antes'));
    const salvando = p.salvar(id, pacote('Antes'));
    await new Promise((ok) => setImmediate(ok));
    expect(await p.instantaneo(id, pacote('Durante'))).toEqual({ ok: true });
    liberar();
    expect((await salvando).ok).toBe(true);
    const [oferta] = await processo(222).listar();
    expect(oferta?.titulo).toBe('Durante');
  });

  it('"Abrir o arquivo salvo": abre o arquivo e guarda o instantâneo por 7 dias', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Editado'));
    const depois = processo(222);
    const [oferta] = await depois.listar();
    const r = await depois.abrirSalvo(oferta!.identificador);
    if (!r.ok) throw new Error('não abriu');
    expect(tituloDe(r.projeto.pacote)).toBe('Salvo');
    expect(existsSync(pastaInstantaneos())).toBe(false);
    expect(arquivosDe(pastas.antigos).filter((n) => n.startsWith(ID_PROJETO))).toHaveLength(1);
    expect(await depois.listar()).toEqual([]);
    // A oferta usada não vale de novo.
    expect(await depois.recuperar(oferta!.identificador)).toEqual({ ok: false, mensagem: MENSAGEM_OFERTA_VENCIDA });
  });

  it('arquivo do usuário sumiu: oferta sem "Abrir o arquivo salvo"; recuperar grava no mesmo caminho ao salvar', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Editado'));
    rmSync(caminho);
    const depois = processo(222);
    const [oferta] = await depois.listar();
    expect(oferta?.arquivoSalvoExiste).toBe(false);
    expect((await depois.abrirSalvo(oferta!.identificador)).ok).toBe(false);
    const r = await depois.recuperar(oferta!.identificador);
    if (!r.ok) throw new Error(r.mensagem);
    expect((await depois.salvar(r.projeto.identificador!, r.projeto.pacote)).ok).toBe(true);
    const lido = await abrirProjeto(caminho);
    expect(lido.ok && tituloDe(lido.pacote)).toBe('Editado');
  });

  it('oferta adiada e trabalho editado de novo: a queda fica reservada e continua oferecida (revisão A2)', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Da queda'));
    const depois = processo(222);
    expect(await depois.listar()).toHaveLength(1);
    // "Decidir depois", abre o arquivo pela biblioteca, edita e salva (o salvamento apaga só os instantâneos da sessão).
    const id = depois.abrirArquivo(caminho);
    await depois.instantaneo(id, pacote('Nova edição'));
    expect(reservados()).toHaveLength(1);
    expect((await depois.salvar(id, pacote('Nova edição'))).ok).toBe(true);
    expect(arquivosDe(pastas.antigos)).toEqual([]);
    await depois.fechar(id);
    const ofertas = await depois.listar();
    expect(ofertas.map((o) => o.titulo)).toEqual(['Da queda']);
    // Recuperar a queda reservada: vira o conjunto da sessão e fica protegida até o próximo salvamento.
    const r = await depois.recuperar(ofertas[0]!.identificador);
    if (!r.ok) throw new Error(r.mensagem);
    expect(tituloDe(r.projeto.pacote)).toBe('Da queda');
    expect(reservados()).toEqual([]);
    expect(existsSync(join(pastaInstantaneos(), NOME_INSTANTANEO))).toBe(true);
  });

  it('pacote com id diferente do registrado ao abrir é recusado (revisão M1)', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    const p = processo(111);
    const id = p.abrirArquivo(caminho);
    expect(await p.instantaneo(id, pacote('x', 'prj_outrooutrooutro'))).toEqual({ ok: false, codigo: 'PACOTE_INVALIDO' });
    expect(existsSync(join(pastas.recuperacao, 'prj_outrooutrooutro'))).toBe(false);
  });

  it('caminho de origem que agora guarda outro trabalho não é sobrescrito: recupera sem destino (revisão M2)', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Da queda'));
    rmSync(caminho);
    await gravarTrabalho('Trabalho.bdp', 'Outro trabalho', 'prj_outrooutrooutro');
    const depois = processo(222);
    const [oferta] = await depois.listar();
    const r = await depois.recuperar(oferta!.identificador);
    if (!r.ok) throw new Error(r.mensagem);
    expect(r.projeto.identificador).toBeNull();
    expect(r.projeto.avisos.map((a) => a.mensagem).join(' ')).toContain('agora guarda outro trabalho');
  });

  it('recuperar com o arquivo aberto no app é recusado (revisão B3)', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Da queda'));
    const depois = processo(222);
    const [oferta] = await depois.listar();
    depois.abrirArquivo(caminho);
    expect(await depois.recuperar(oferta!.identificador)).toEqual({ ok: false, mensagem: MENSAGEM_JA_ABERTO });
  });

  it('projeto já em edição nesta instância (instantâneo novo depois de listar) não é recuperado por cima', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Da queda'));
    const depois = processo(222);
    const [oferta] = await depois.listar();
    await depois.instantaneo(depois.abrirArquivo(caminho), pacote('Em edição'));
    expect(await depois.recuperar(oferta!.identificador)).toEqual({ ok: false, mensagem: MENSAGEM_JA_ABERTO });
    expect((await depois.abrirSalvo(oferta!.identificador)).ok).toBe(false);
  });
});

describe('recuperação: restos de gravação na pasta da biblioteca', () => {
  it('temporário de outro processo com original íntegro → guardado 7 dias, sem oferta', async () => {
    const caminho = await gravarTrabalho('A.bdp', 'Original');
    const tmp = `${caminho}.tmp-${OUTRO_PID + 1}-ab12`;
    writeFileSync(tmp, readFileSync(caminho));
    expect(await processo().listar()).toEqual([]);
    expect(existsSync(tmp)).toBe(false);
    expect(arquivosDe(pastas.antigos)).toEqual(['A.bdp.tmp-1000000-ab12']);
  });

  it('original danificado e temporário completo → oferta; restaurar grava o original e guarda o danificado', async () => {
    const caminho = await gravarTrabalho('A.bdp', 'Completo');
    const tmp = `${caminho}.tmp-123-ab12`;
    writeFileSync(tmp, readFileSync(caminho));
    writeFileSync(caminho, 'danificado');
    const p = processo();
    const [oferta, ...resto] = await p.listar();
    expect(resto).toEqual([]);
    expect(oferta).toMatchObject({ tipo: 'temporario', nomeArquivo: 'A.bdp', titulo: 'Completo', arquivoSalvoExiste: true });
    const r = await p.recuperar(oferta!.identificador);
    if (!r.ok) throw new Error(r.mensagem);
    expect(r.tipo).toBe('temporario');
    const lido = await abrirProjeto(caminho);
    expect(lido.ok && tituloDe(lido.pacote)).toBe('Completo');
    expect(existsSync(tmp)).toBe(false);
    expect(arquivosDe(pastas.antigos)).toEqual(['A.bdp-danificado']);
    expect(p.registro.caminho(r.projeto.identificador!, JANELA)).toBe(caminho);
  });

  it('restaurar sem conseguir guardar o danificado não muda nada: o .bak íntegro continua (revisão A4)', async () => {
    const a = await gravarTrabalho('A.bdp', 'Primeira');
    await salvarProjeto(a, paraProjeto(pacote('Segunda')));
    writeFileSync(a, 'danificado');
    envelhecer(`${a}.bak`, 3600);
    const p = processo();
    const [oferta] = await p.listar();
    mkdirSync(join(raiz, 'local'), { recursive: true });
    writeFileSync(pastas.antigos, 'arquivo no lugar da pasta'); // criar recuperacao-antigos falha
    const r = await p.recuperar(oferta!.identificador);
    expect(r.ok).toBe(false);
    expect(readFileSync(a, 'utf8')).toBe('danificado');
    const bak = await abrirProjeto(`${a}.bak`);
    expect(bak.ok && tituloDe(bak.pacote)).toBe('Primeira');
  });

  it('restaurar com falha ao gravar devolve o original danificado ao lugar (revisão A4)', async () => {
    const caminho = await gravarTrabalho('A.bdp', 'Completo');
    writeFileSync(`${caminho}.tmp-123-ab12`, readFileSync(caminho));
    writeFileSync(caminho, 'danificado');
    const p = processo(OUTRO_PID, { salvar: async () => ({ ok: false, codigo: 'SEM_ESPACO', mensagem: 'sem espaço', temporario: null, duracaoMs: 0 }) });
    const [oferta] = await p.listar();
    expect(await p.recuperar(oferta!.identificador)).toEqual({ ok: false, mensagem: 'sem espaço' });
    expect(readFileSync(caminho, 'utf8')).toBe('danificado');
    expect(existsSync(`${caminho}.tmp-123-ab12`)).toBe(true);
  });

  it('temporário incompleto com original danificado → sem oferta, temporário guardado', async () => {
    await gravarTrabalho('A.bdp', 'x');
    writeFileSync(join(biblioteca, 'A.bdp'), 'danificado');
    writeFileSync(join(biblioteca, 'A.bdp.tmp-123-ab12'), 'parcial');
    expect(await processo().listar()).toEqual([]);
    expect(arquivosDe(pastas.antigos)).toEqual(['A.bdp.tmp-123-ab12']);
  });

  it('.bak íntegro com original danificado → oferta; original ausente (excluído) → nada', async () => {
    const a = await gravarTrabalho('A.bdp', 'Primeira');
    await salvarProjeto(a, paraProjeto(pacote('Segunda'))); // cria o .bak com "Primeira"
    writeFileSync(a, 'danificado');
    const b = await gravarTrabalho('B.bdp', 'B1', 'prj_bbbbbbbbbbbbbbbb');
    await salvarProjeto(b, paraProjeto(pacote('B2', 'prj_bbbbbbbbbbbbbbbb')));
    rmSync(b); // usuário mandou B para a Lixeira; o .bak fica
    const p = processo();
    const ofertas = await p.listar();
    expect(ofertas.map((o) => [o.tipo, o.nomeArquivo, o.titulo])).toEqual([['bak', 'A.bdp', 'Primeira']]);
    const r = await p.recuperar(ofertas[0]!.identificador);
    if (!r.ok) throw new Error(r.mensagem);
    const lido = await abrirProjeto(a);
    expect(lido.ok && tituloDe(lido.pacote)).toBe('Primeira');
    // O .bak íntegro continua no lugar (o danificado foi para recuperacao-antigos, não para o .bak).
    const bak = await abrirProjeto(`${a}.bak`);
    expect(bak.ok && tituloDe(bak.pacote)).toBe('Primeira');
  });

  it('restaurar confere de novo: arquivo que voltou a abrir não é sobrescrito', async () => {
    const a = await gravarTrabalho('A.bdp', 'Primeira');
    await salvarProjeto(a, paraProjeto(pacote('Segunda')));
    const bom = readFileSync(a);
    writeFileSync(a, 'danificado');
    const p = processo();
    const [oferta] = await p.listar();
    writeFileSync(a, bom); // consertado por fora
    const r = await p.recuperar(oferta!.identificador);
    expect(r.ok).toBe(false);
    const lido = await abrirProjeto(a);
    expect(lido.ok && tituloDe(lido.pacote)).toBe('Segunda');
  });

  it('cópia do .bak de outro processo é apagada; restos de arquivo aberto no app ficam intocados', async () => {
    const a = await gravarTrabalho('A.bdp', 'A');
    writeFileSync(`${a}.bak.tmp-123-cd`, 'x');
    const b = await gravarTrabalho('B.bdp', 'B', 'prj_bbbbbbbbbbbbbbbb');
    writeFileSync(`${b}.tmp-123-ab`, 'x');
    const p = processo();
    p.abrirArquivo(b);
    expect(await p.listar()).toEqual([]);
    expect(existsSync(`${a}.bak.tmp-123-cd`)).toBe(false);
    expect(existsSync(`${b}.tmp-123-ab`)).toBe(true);
  });
});

describe('recuperação: contrato IPC (C-11, C-12)', () => {
  it('remetente não permitido e argumentos fora do contrato são recusados antes do disco', async () => {
    const p = processo();
    const caminho = await gravarTrabalho('A.bdp', 'A');
    const id = p.abrirArquivo(caminho);
    const rec = p.rec.manipuladores;
    const estranho: InfoRemetente = { ...LEGITIMO, urlQuadro: 'https://exemplo.com/' };
    await expect(rec[CANAIS_RECUPERACAO.listar](estranho, [])).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(rec[CANAIS_RECUPERACAO.instantaneo](estranho, [id, pacote('x')])).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(p.chamar(CANAIS_RECUPERACAO.listar, 'extra')).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(p.chamar(CANAIS_RECUPERACAO.instantaneo, caminho, pacote('x'))).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(p.chamar(CANAIS_RECUPERACAO.instantaneo, id, { ...pacote('x'), caminho })).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(p.chamar(CANAIS_RECUPERACAO.recuperar, caminho)).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(p.chamar(CANAIS_RECUPERACAO.abrirSalvo)).rejects.toBeInstanceOf(ErroIpcRecusado);
    expect(existsSync(pastas.recuperacao)).toBe(false);
  });

  it('identificador desconhecido ou de outra janela → NAO_ABERTO; pacote inválido → PACOTE_INVALIDO', async () => {
    const p = processo();
    const caminho = await gravarTrabalho('A.bdp', 'A');
    const deOutra = p.registro.registrar(caminho, JANELA + 1);
    expect(await p.instantaneo('A'.repeat(22), pacote('x'))).toEqual({ ok: false, codigo: 'NAO_ABERTO' });
    expect(await p.instantaneo(deOutra, pacote('x'))).toEqual({ ok: false, codigo: 'NAO_ABERTO' });
    const invalido = pacote('x');
    (invalido.manifesto as { versaoFormato: number }).versaoFormato = 99;
    expect(await p.instantaneo(p.abrirArquivo(caminho), invalido)).toEqual({ ok: false, codigo: 'PACOTE_INVALIDO' });
  });

  it('oferta listada por uma janela não vale para outra', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Editado'));
    const depois = processo(222);
    const [oferta] = await depois.listar();
    const outraJanela: InfoRemetente = { ...LEGITIMO, idConteudo: OUTRA_JANELA };
    const rec = depois.rec.manipuladores;
    expect(await rec[CANAIS_RECUPERACAO.recuperar](outraJanela, [oferta!.identificador])).toEqual({ ok: false, mensagem: MENSAGEM_OFERTA_VENCIDA });
    expect(await rec[CANAIS_RECUPERACAO.abrirSalvo](outraJanela, [oferta!.identificador])).toMatchObject({ ok: false, mensagem: MENSAGEM_OFERTA_VENCIDA });
    // A janela que listou continua podendo usá-la.
    expect((await depois.recuperar(oferta!.identificador)).ok).toBe(true);
  });

  it('instantâneo com id de outro projeto na pasta não é oferecido', async () => {
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    envelhecer(caminho);
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Editado'));
    // Conteúdo trocado por um pacote de outro id.
    writeFileSync(join(pastaInstantaneos(), NOME_INSTANTANEO), readFileSync(await gravarTrabalho('Outro.bdp', 'Outro', 'prj_outrooutrooutro')));
    expect((await processo(222).listar()).filter((o) => o.tipo === 'instantaneo')).toEqual([]);
  });
});

describe('sessão de edição: instantâneo de recuperação', () => {
  function montar(resposta: () => Promise<ResultadoInstantaneo> = async () => ({ ok: true })) {
    const enviados: { id: string; titulo: string }[] = [];
    const agendados: { acao: () => void; ms: number; cancelado: boolean }[] = [];
    const sessao = new SessaoTrabalho({
      api: {
        salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }),
        salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }),
        fechar: async () => undefined,
      },
      agora: () => new Date(Date.UTC(2026, 9, 16, 13)),
      agendar: (acao, ms) => {
        const a = { acao, ms, cancelado: false };
        agendados.push(a);
        return () => {
          a.cancelado = true;
        };
      },
      instantaneo: (id, p) => {
        enviados.push({ id, titulo: tituloDe(p) });
        return resposta();
      },
    });
    const disparar = (ms: number) => {
      const a = agendados.filter((x) => !x.cancelado && x.ms === ms);
      expect(a).toHaveLength(1);
      a[0]!.cancelado = true;
      a[0]!.acao();
    };
    const pendentes = (ms: number) => agendados.filter((x) => !x.cancelado && x.ms === ms).length;
    const total = (ms: number) => agendados.filter((x) => x.ms === ms).length;
    return { sessao, enviados, disparar, pendentes, total };
  }
  const andar = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const ID = 'AAAAAAAAAAAAAAAAAAAAAA';
  const aberto = (identificador: string | null = ID) => ({ identificador, nomeArquivo: 'T.bdp', pacote: pacote('Início'), avisos: [], atualizacao: null });

  it('limite de ~2 s: digitar sem parar não adia o instantâneo; manda o conteúdo mais recente', async () => {
    const { sessao, enviados, disparar, pendentes, total } = montar();
    sessao.abrir(aberto());
    sessao.alterarTitulo('a');
    sessao.alterarTitulo('ab');
    sessao.alterarTitulo('abc');
    expect(pendentes(ATRASO_INSTANTANEO_MS)).toBe(1);
    // O agendamento é o da primeira tecla: não recomeça a cada alteração.
    expect(total(ATRASO_INSTANTANEO_MS)).toBe(1);
    expect(ATRASO_INSTANTANEO_MS).toBe(2_000);
    disparar(ATRASO_INSTANTANEO_MS);
    await andar();
    expect(enviados).toEqual([{ id: ID, titulo: 'abc' }]);
  });

  it('alteração durante o envio agenda outro; sem alteração pendente (já salvo) nada é enviado', async () => {
    let liberar!: () => void;
    const { sessao, enviados, disparar, pendentes } = montar(() => new Promise((ok) => (liberar = () => ok({ ok: true }))));
    sessao.abrir(aberto());
    sessao.alterarTitulo('1');
    disparar(ATRASO_INSTANTANEO_MS);
    sessao.alterarTitulo('12'); // durante o envio: não agenda em paralelo
    expect(pendentes(ATRASO_INSTANTANEO_MS)).toBe(0);
    liberar();
    await andar();
    expect(pendentes(ATRASO_INSTANTANEO_MS)).toBe(1);
    await sessao.salvar();
    disparar(ATRASO_INSTANTANEO_MS);
    await andar();
    expect(enviados.map((e) => e.titulo)).toEqual(['1']);
  });

  it('falha vira aviso uma vez; o próximo instantâneo bem-sucedido o retira', async () => {
    let ok = false;
    const { sessao, disparar } = montar(async () => (ok ? { ok: true } : { ok: false, codigo: 'FALHA_DISCO' }));
    sessao.abrir(aberto());
    sessao.alterarTitulo('x');
    disparar(ATRASO_INSTANTANEO_MS);
    await andar();
    sessao.alterarTitulo('xy');
    disparar(ATRASO_INSTANTANEO_MS);
    await andar();
    expect(sessao.obterEstado().avisos.filter((a) => a.texto === MENSAGEM_FALHA_INSTANTANEO)).toHaveLength(1);
    expect(sessao.obterEstado().trabalho?.salvamento).toEqual({ tipo: 'naoSalvo' });
    ok = true;
    sessao.alterarTitulo('xyz');
    disparar(ATRASO_INSTANTANEO_MS);
    await andar();
    expect(sessao.obterEstado().avisos).toEqual([]);
  });

  it('sem identificador (arquivo não .bdp) ou só leitura: sem instantâneo; fechar cancela o agendado', async () => {
    const { sessao, pendentes } = montar();
    sessao.abrir(aberto(null));
    sessao.alterarTitulo('x');
    expect(pendentes(ATRASO_INSTANTANEO_MS)).toBe(0);
    sessao.abrir(aberto());
    sessao.alterarTitulo('x');
    expect(pendentes(ATRASO_INSTANTANEO_MS)).toBe(1);
    await sessao.fechar({ descartar: true });
    expect(pendentes(ATRASO_INSTANTANEO_MS)).toBe(0);
  });

  it('documento lento espaça os instantâneos: 4 × a duração do último (revisão M5)', async () => {
    let relogio = 0;
    const agendados: number[] = [];
    const sessao = new SessaoTrabalho({
      api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => undefined },
      agora: () => new Date(relogio),
      agendar: (acao, ms) => {
        agendados.push(ms);
        if (ms === ATRASO_INSTANTANEO_MS || ms === 4 * 1500) queueMicrotask(acao);
        return () => undefined;
      },
      instantaneo: async () => {
        relogio += 1500;
        return { ok: true };
      },
    });
    sessao.abrir(aberto());
    sessao.alterarTitulo('a');
    await andar();
    sessao.alterarTitulo('ab');
    expect(agendados.filter((ms) => ms !== 30_000)).toEqual([ATRASO_INSTANTANEO_MS, 4 * 1500]);
    expect(FATOR_ESPACAMENTO_INSTANTANEO).toBe(4);
  });

  it('alteração feita durante o salvamento ganha instantâneo depois dele (revisão A3)', async () => {
    let liberar!: () => void;
    const enviados: string[] = [];
    const agendados: { acao: () => void; ms: number; cancelado: boolean }[] = [];
    const sessao = new SessaoTrabalho({
      api: {
        salvar: () => new Promise((ok) => (liberar = () => ok({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }))),
        salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }),
        fechar: async () => undefined,
      },
      agora: () => new Date(0),
      agendar: (acao, ms) => {
        const a = { acao, ms, cancelado: false };
        agendados.push(a);
        return () => (a.cancelado = true);
      },
      instantaneo: async (_id, p) => (enviados.push(tituloDe(p)), { ok: true }),
    });
    sessao.abrir(aberto());
    sessao.alterarTitulo('1');
    const instantaneo1 = agendados.find((a) => a.ms === ATRASO_INSTANTANEO_MS)!;
    instantaneo1.cancelado = true;
    instantaneo1.acao();
    await andar();
    const salvando = sessao.salvar();
    await andar();
    sessao.alterarTitulo('12');
    liberar();
    await salvando;
    const pendente = agendados.filter((a) => !a.cancelado && a.ms === ATRASO_INSTANTANEO_MS);
    expect(pendente).toHaveLength(1);
    pendente[0]!.acao();
    await andar();
    expect(enviados).toEqual(['1', '12']);
  });

  it('versão recuperada abre como "Alterações não salvas" e agenda o automático', () => {
    const { sessao, pendentes } = montar();
    sessao.abrir(aberto(), [], { naoSalvo: true });
    expect(sessao.obterEstado().trabalho?.salvamento).toEqual({ tipo: 'naoSalvo' });
    expect(sessao.temPendencias).toBe(true);
    expect(pendentes(30_000)).toBe(1);
  });
});

describe('textos da recuperação', () => {
  const hoje = new Date(2026, 9, 16, 18, 0);
  const oferta = (parcial: Partial<OfertaRecuperacao>): OfertaRecuperacao => ({
    identificador: 'x',
    tipo: 'instantaneo',
    nomeArquivo: 'TCC.bdp',
    titulo: 'Qualidade da água',
    quando: new Date(2026, 9, 16, 15, 42).getTime(),
    arquivoSalvoExiste: true,
    ...parcial,
  });

  it('hora no mesmo dia; data e hora em outro dia', () => {
    expect(quandoLegivel(new Date(2026, 9, 16, 9, 5).getTime(), hoje)).toBe('09:05');
    expect(quandoLegivel(new Date(2026, 9, 14, 15, 42).getTime(), hoje)).toBe('14/10/2026 às 15:42');
  });

  it('oferta (texto do ADR-0004) e aviso do trabalho recuperado', () => {
    expect(textoOferta(oferta({}), hoje)).toBe(
      'O BiblioDocs Pro foi fechado inesperadamente com “Qualidade da água” (TCC.bdp) aberto. Recuperar a versão de 15:42?',
    );
    expect(textoOferta(oferta({ titulo: ' ', arquivoSalvoExiste: false }), hoje)).toContain('com “TCC.bdp” aberto');
    expect(textoOferta(oferta({ arquivoSalvoExiste: false }), hoje)).toMatch(/O arquivo salvo não foi encontrado\.$/);
    expect(textoOferta(oferta({ tipo: 'temporario', arquivoSalvoExiste: false }), hoje)).toMatch(/^“TCC.bdp” não foi encontrado, mas/);
    expect(textoOferta(oferta({ tipo: 'bak' }), hoje)).toContain('cópia de segurança (.bak) de 15:42 está íntegra');
    expect(avisoRecuperado('instantaneo', oferta({}).quando, hoje)).toMatchObject({ nivel: 'info', texto: expect.stringContaining('ainda não está no arquivo') });
    expect(avisoRecuperado('bak', oferta({}).quando, hoje).texto).toBe('O arquivo foi restaurado a partir da cópia de segurança (.bak) de 15:42.');
  });
});

describe('versões descartadas (M2-T11; R-M1-10)', () => {
  /** Grava um trabalho em `recuperacao-antigos` com o nome dado. */
  async function guardar(nome: string, titulo: string, id = ID_PROJETO): Promise<string> {
    mkdirSync(pastas.antigos, { recursive: true });
    const caminho = join(pastas.antigos, nome);
    const r = await salvarProjeto(caminho, paraProjeto(pacote(titulo, id)));
    expect(r.ok).toBe(true);
    return caminho;
  }

  it('lista só o que abre, sem expor caminho, e sem pasta a lista é vazia', async () => {
    const p = processo();
    expect(await p.listarDescartadas()).toEqual([]);
    await guardar('a-atual.bdp', 'Rascunho');
    writeFileSync(join(pastas.antigos, 'b.bdp-danificado'), 'lixo');
    const versoes = await p.listarDescartadas();
    expect(versoes.map((v) => v.titulo)).toEqual(['Rascunho']);
    expect(JSON.stringify(versoes)).not.toContain(raiz);
    expect(JSON.stringify(versoes)).not.toContain('a-atual');
  });

  it('abre como trabalho sem arquivo e não altera nem retira nada', async () => {
    const guardado = await guardar('a-atual.bdp', 'Rascunho');
    const bytes = readFileSync(guardado);
    const p = processo();
    const [v] = await p.listarDescartadas();
    const r = await p.abrirDescartada(v!.identificador);
    if (!r.ok) throw new Error(r.mensagem);
    expect(tituloDe(r.projeto.pacote)).toBe('Rascunho');
    expect(r.projeto.identificador).toBeNull();
    expect(readFileSync(guardado).equals(bytes)).toBe(true);
    expect(await p.listarDescartadas()).toHaveLength(1);
  });

  it('o que passou de 7 dias sai da lista e é apagado', async () => {
    const guardado = await guardar('a-atual.bdp', 'Velho');
    envelhecer(guardado, PRAZO_ANTIGOS_MS / 1000 + 60);
    expect(await processo().listarDescartadas()).toEqual([]);
    expect(existsSync(guardado)).toBe(false);
  });

  it('identificador vencido, de listagem anterior ou de arquivo que sumiu não abre', async () => {
    const guardado = await guardar('a-atual.bdp', 'Rascunho');
    const p = processo();
    const [velha] = await p.listarDescartadas();
    const [nova] = await p.listarDescartadas();
    const recusa = { ok: false, mensagem: MENSAGEM_DESCARTADA_ILEGIVEL };
    expect(await p.abrirDescartada(velha!.identificador)).toEqual(recusa);
    rmSync(guardado);
    expect(await p.abrirDescartada(nova!.identificador)).toEqual(recusa);
  });

  it('com oferta do mesmo trabalho pendente, recusa, porque o "Salvar como…" apagaria a oferta', async () => {
    await guardar('a-atual.bdp', 'Rascunho');
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Editado'));
    const depois = processo(222);
    const [v] = await depois.listarDescartadas();
    expect(await depois.abrirDescartada(v!.identificador)).toEqual({ ok: false, mensagem: MENSAGEM_DESCARTADA_COM_OFERTA });
    expect(existsSync(join(pastaInstantaneos(), NOME_INSTANTANEO))).toBe(true);
  });

  it('lista no máximo o limite, as guardadas mais recentemente primeiro', async () => {
    const guardado = await guardar('modelo.bdp', 'Modelo');
    const bytes = readFileSync(guardado);
    for (let i = 0; i < MAX_VERSOES_DESCARTADAS + 2; i++) writeFileSync(join(pastas.antigos, `c${i}.bdp`), bytes);
    expect(await processo().listarDescartadas()).toHaveLength(MAX_VERSOES_DESCARTADAS);
  });

  it('a versão listada por uma janela não abre em outra', async () => {
    await guardar('a-atual.bdp', 'Rascunho');
    const p = processo();
    const [v] = await p.listarDescartadas();
    const outra: InfoRemetente = { ...LEGITIMO, idConteudo: OUTRA_JANELA };
    const m = p.rec.manipuladores[CANAIS_RECUPERACAO.abrirDescartada];
    expect(await m(outra, [v!.identificador])).toEqual({ ok: false, mensagem: MENSAGEM_DESCARTADA_ILEGIVEL });
  });

  it('com o mesmo trabalho aberto, recusa e avisa', async () => {
    await guardar('a-atual.bdp', 'Rascunho');
    const caminho = await gravarTrabalho('Trabalho.bdp', 'Salvo');
    const antes = processo(111);
    await antes.instantaneo(antes.abrirArquivo(caminho), pacote('Editado'));
    const depois = processo(222);
    const [oferta] = await depois.listar();
    expect((await depois.recuperar(oferta!.identificador)).ok).toBe(true);
    const [v] = await depois.listarDescartadas();
    expect(await depois.abrirDescartada(v!.identificador)).toEqual({ ok: false, mensagem: MENSAGEM_JA_ABERTO });
  });

  it('argumentos fora do contrato são recusados, e a versão some quando a janela fecha', async () => {
    await guardar('a-atual.bdp', 'Rascunho');
    const p = processo();
    await expect(p.chamar(CANAIS_RECUPERACAO.listarDescartadas, 'extra')).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(p.chamar(CANAIS_RECUPERACAO.abrirDescartada, 'C:\\x.bdp')).rejects.toBeInstanceOf(ErroIpcRecusado);
    const [v] = await p.listarDescartadas();
    await p.rec.encerrarDono(JANELA, true);
    expect(await p.abrirDescartada(v!.identificador)).toEqual({ ok: false, mensagem: MENSAGEM_DESCARTADA_ILEGIVEL });
  });
});
