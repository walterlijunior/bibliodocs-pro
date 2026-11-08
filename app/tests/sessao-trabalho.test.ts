// M1-T11 — sessão de edição: estado de salvamento do visor e salvamento automático (ADR-0004, opção 1 do usuário).
// API falsa e agendador manual: nenhuma espera real, nenhum Electron.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { pngDeTeste } from './corpus/corpus';
import { LIMITES_V1 } from '../src/dominio/esquemas';
import {
  ATRASO_INSTANTANEO_MS,
  ATRASO_SALVAMENTO_AUTOMATICO_MS,
  criarTrabalhoVazio,
  MENSAGEM_FALHA_INESPERADA,
  CODIGO_MIDIA_AUSENTE,
  MENSAGEM_SEM_DESTINO,
  paraEnvio,
  SessaoTrabalho,
  textoDoTitulo,
  tituloDoTexto,
  type ApiProjetos,
  type PacoteEnvio,
  type PacoteSomenteLeituraTransferivel,
  type PacoteTransferivel,
  type ProjetoAberto,
  type ResultadoSalvar,
  type ResultadoInstantaneo,
  type ResultadoSalvarComo,
} from '../src/aplicacao';

const ID = 'AAAAAAAAAAAAAAAAAAAAAA';
const ID_NOVO = 'BBBBBBBBBBBBBBBBBBBBBB';

function pacote(titulo = ''): PacoteTransferivel {
  const t = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-10-16T10:00:00.000Z', appVersao: '0.1.0' });
  return { ...t, documento: { ...t.documento, metadados: { titulo: titulo === '' ? [] : [{ tipo: 'texto', texto: titulo }] } }, midias: [] };
}

/** O pacote com uma seção de figuras que usam as mídias `shas` (M5-T06: só as mídias usadas vão para o arquivo). */
function comFiguras(p: PacoteTransferivel, ...shas: string[]): PacoteTransferivel {
  const blocos = shas.map((midia, i) => ({ tipo: 'ilustracao' as const, id: `ilu_figura00000${i}`, especie: 'figura' as const, titulo: [{ tipo: 'texto' as const, texto: 'F' }], midia }));
  return { ...p, documento: { ...p.documento, corpo: [{ id: 'sec_figuras000001', titulo: [{ tipo: 'texto', texto: 'S' }], subsecoes: [], blocos }] } };
}

function projeto(parcial: Partial<ProjetoAberto> = {}): ProjetoAberto {
  return { identificador: ID, nomeArquivo: 'Trabalho.bdp', pacote: pacote(), avisos: [], atualizacao: null, ...parcial };
}

/** Promessa controlada pelo teste. */
function adiada<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

/** Deixa as promessas pendentes andarem. */
const andar = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function montar(opcoes: { salvar?: (id: string, p: PacoteEnvio) => Promise<ResultadoSalvar>; salvarComo?: (p: PacoteTransferivel) => Promise<ResultadoSalvarComo> } = {}) {
  const chamadas = { salvar: [] as { id: string; pacote: PacoteEnvio }[], salvarComo: 0, fechar: [] as string[], aoSalvar: 0 };
  const agendados: { acao: () => void; ms: number; cancelado: boolean }[] = [];
  let relogio = Date.UTC(2026, 9, 16, 13, 0, 0);
  const api: Pick<ApiProjetos, 'salvar' | 'salvarComo' | 'fechar'> = {
    salvar: (id, p) => {
      chamadas.salvar.push({ id, pacote: p });
      // Como o principal: devolve o nome do arquivo daquele identificador.
      return opcoes.salvar ? opcoes.salvar(id, p) : Promise.resolve({ ok: true, nomeArquivo: id === ID_NOVO ? 'Novo.bdp' : 'Trabalho.bdp', avisos: [] });
    },
    salvarComo: (p) => {
      chamadas.salvarComo += 1;
      return opcoes.salvarComo ? opcoes.salvarComo(p) : Promise.resolve({ ok: true, identificador: ID_NOVO, nomeArquivo: 'Novo.bdp', avisos: [] });
    },
    fechar: (id) => {
      chamadas.fechar.push(id);
      return Promise.resolve();
    },
  };
  const sessao = new SessaoTrabalho({
    api,
    agora: () => new Date(relogio),
    agendar: (acao, ms) => {
      const a = { acao, ms, cancelado: false };
      agendados.push(a);
      return () => {
        a.cancelado = true;
      };
    },
    aoSalvar: () => {
      chamadas.aoSalvar += 1;
    },
  });
  const ativos = () => agendados.filter((a) => !a.cancelado);
  /** Dispara o salvamento automático pendente (como se os 30 s tivessem passado). */
  const dispararAutomatico = () => {
    const a = ativos();
    expect(a).toHaveLength(1);
    a[0]!.cancelado = true;
    a[0]!.acao();
  };
  return { sessao, chamadas, ativos, dispararAutomatico, avancarRelogio: (ms: number) => (relogio += ms) };
}

const salvamento = (s: SessaoTrabalho) => s.obterEstado().trabalho?.salvamento;

describe('título editável', () => {
  it('texto do título junta os trechos; sem mudança preserva as marcas; com mudança vira um trecho', () => {
    const italico = [
      { tipo: 'texto' as const, texto: 'Estudo de ' },
      { tipo: 'texto' as const, texto: 'Caryocar brasiliense', marcas: ['italico' as const] },
    ];
    expect(textoDoTitulo(italico)).toBe('Estudo de Caryocar brasiliense');
    expect(tituloDoTexto('Estudo de Caryocar brasiliense', italico)).toEqual(italico);
    expect(tituloDoTexto('Outro', italico)).toEqual([{ tipo: 'texto', texto: 'Outro' }]);
    expect(tituloDoTexto('', italico)).toEqual([]);
    // R-M2-03: o que o v1 recusa não entra no modelo.
    expect(tituloDoTexto('a\u000bb', [])).toEqual([{ tipo: 'texto', texto: 'ab' }]);
    expect(tituloDoTexto('\u000b', [])).toEqual([]);
    expect((tituloDoTexto('x'.repeat(LIMITES_V1.textoInline + 5), [])[0] as { texto: string }).texto).toHaveLength(LIMITES_V1.textoInline);
  });
});

describe('sessão de edição: estados do visor', () => {
  it('abrir → "salvo" sem hora; alterar → "Alterações não salvas" e agenda o automático de 30 s', () => {
    const { sessao, ativos } = montar();
    expect(sessao.obterEstado().trabalho).toBeNull();
    sessao.abrir(projeto());
    expect(salvamento(sessao)).toEqual({ tipo: 'salvo', em: null });
    expect(ativos()).toHaveLength(0);

    sessao.alterarTitulo('Qualidade da água');
    expect(sessao.obterEstado().trabalho?.titulo).toBe('Qualidade da água');
    expect(salvamento(sessao)).toEqual({ tipo: 'naoSalvo' });
    expect(ativos().map((a) => a.ms)).toEqual([ATRASO_SALVAMENTO_AUTOMATICO_MS]);
    expect(ATRASO_SALVAMENTO_AUTOMATICO_MS).toBe(30_000);
  });

  it('cada alteração reinicia a contagem (30 s depois da última)', () => {
    const { sessao, ativos } = montar();
    sessao.abrir(projeto());
    sessao.alterarTitulo('Q');
    sessao.alterarTitulo('Qu');
    sessao.alterarTitulo('Qua');
    expect(ativos()).toHaveLength(1);
  });

  it('mesmo texto não conta como alteração', () => {
    const { sessao, ativos } = montar();
    sessao.abrir(projeto({ pacote: pacote('Igual') }));
    sessao.alterarTitulo('Igual');
    expect(salvamento(sessao)?.tipo).toBe('salvo');
    expect(ativos()).toHaveLength(0);
    expect(sessao.temPendencias).toBe(false);
  });

  it('automático: "Salvando…" e depois "Salvo" com a hora; grava o título e a data de atualização', async () => {
    const g = adiada<ResultadoSalvar>();
    const { sessao, chamadas, dispararAutomatico } = montar({ salvar: () => g.promessa });
    sessao.abrir(projeto());
    sessao.alterarTitulo('Qualidade da água');
    dispararAutomatico();
    await andar();
    expect(salvamento(sessao)).toEqual({ tipo: 'salvando' });
    expect(chamadas.salvar).toHaveLength(1);
    expect(chamadas.salvar[0]!.id).toBe(ID);
    expect(chamadas.salvar[0]!.pacote.documento.metadados.titulo).toEqual([{ tipo: 'texto', texto: 'Qualidade da água' }]);
    expect(chamadas.salvar[0]!.pacote.manifesto.atualizadoEm).toBe('2026-10-16T13:00:00.000Z');

    g.resolver({ ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] });
    await andar();
    const s = salvamento(sessao);
    expect(s?.tipo).toBe('salvo');
    expect(s?.tipo === 'salvo' && s.em?.toISOString()).toBe('2026-10-16T13:00:00.000Z');
    expect(sessao.pacote?.manifesto.atualizadoEm).toBe('2026-10-16T13:00:00.000Z');
    expect(sessao.temPendencias).toBe(false);
    expect(chamadas.aoSalvar).toBe(1);
  });

  it('erro de gravação aparece no visor e nos avisos com "Salvar como…" (nenhuma falha silenciosa)', async () => {
    const { sessao, ativos } = montar({
      salvar: async () => ({
        ok: false,
        motivo: 'ERRO',
        codigo: 'EM_USO',
        mensagem: 'Não foi possível salvar: o arquivo está em uso por outro programa.',
        erros: [],
      }),
    });
    sessao.abrir(projeto());
    sessao.alterarTitulo('X');
    expect(await sessao.salvar()).toBe(false);
    expect(salvamento(sessao)).toEqual({ tipo: 'erro', codigo: 'EM_USO', mensagem: 'Não foi possível salvar: o arquivo está em uso por outro programa.' });
    expect(sessao.obterEstado().avisos).toEqual([
      { nivel: 'erro', texto: 'Não foi possível salvar: o arquivo está em uso por outro programa.', acoes: ['salvarComo'] },
    ]);
    expect(sessao.temPendencias).toBe(true);
    await andar();
    // O automático tenta de novo em 30 s (arquivo preso por pouco tempo, ex.: OneDrive); o erro segue no visor.
    expect(ativos()).toHaveLength(1);
    expect(salvamento(sessao)?.tipo).toBe('erro');
    // Nova alteração tira o erro do visor e reinicia a contagem.
    sessao.alterarTitulo('XY');
    expect(salvamento(sessao)).toEqual({ tipo: 'naoSalvo' });
    expect(ativos()).toHaveLength(1);
  });

  it('chamada recusada (promessa rejeitada) também vira erro no visor', async () => {
    const { sessao } = montar({ salvar: () => Promise.reject(new Error('recusado')) });
    sessao.abrir(projeto());
    sessao.alterarTitulo('X');
    expect(await sessao.salvar()).toBe(false);
    expect(salvamento(sessao)).toEqual({ tipo: 'erro', codigo: 'FALHA_INESPERADA', mensagem: MENSAGEM_FALHA_INESPERADA });
  });

  it('avisos do .bak não impedem "Salvo"; o erro anterior some depois de salvar', async () => {
    let falhar = true;
    const { sessao } = montar({
      salvar: async () =>
        falhar
          ? { ok: false, motivo: 'ERRO', codigo: 'FALHA_DISCO', mensagem: 'Disco cheio.', erros: [] }
          : { ok: true, nomeArquivo: 'Trabalho.bdp', avisos: ['A cópia de segurança (.bak) não foi atualizada.'] },
    });
    sessao.abrir(projeto());
    sessao.alterarTitulo('X');
    await sessao.salvar();
    falhar = false;
    expect(await sessao.salvar()).toBe(true);
    expect(salvamento(sessao)?.tipo).toBe('salvo');
    expect(sessao.obterEstado().avisos).toEqual([{ nivel: 'alerta', texto: 'A cópia de segurança (.bak) não foi atualizada.', acoes: [] }]);
  });
});

describe('sessão de edição: concorrência', () => {
  it('alteração durante a gravação fica pendente e reagenda o automático', async () => {
    const g = adiada<ResultadoSalvar>();
    const { sessao, ativos } = montar({ salvar: () => g.promessa });
    sessao.abrir(projeto());
    sessao.alterarTitulo('A');
    const p = sessao.salvar();
    await andar();
    sessao.alterarTitulo('AB');
    expect(salvamento(sessao)).toEqual({ tipo: 'salvando' });
    g.resolver({ ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] });
    expect(await p).toBe(true);
    await andar();
    expect(salvamento(sessao)).toEqual({ tipo: 'naoSalvo' });
    expect(sessao.temPendencias).toBe(true);
    expect(ativos()).toHaveLength(1);
  });

  it('Ctrl+S durante a gravação espera a primeira e grava uma vez mais só se houve mudança', async () => {
    const pendentes: ReturnType<typeof adiada<ResultadoSalvar>>[] = [];
    const { sessao, chamadas } = montar({
      salvar: () => {
        const g = adiada<ResultadoSalvar>();
        pendentes.push(g);
        return g.promessa;
      },
    });
    sessao.abrir(projeto());
    sessao.alterarTitulo('A');
    const p1 = sessao.salvar();
    const p2 = sessao.salvar(); // nada mudou no meio
    await andar();
    expect(chamadas.salvar).toHaveLength(1);
    pendentes[0]!.resolver({ ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] });
    expect(await p1).toBe(true);
    expect(await p2).toBe(true);
    expect(chamadas.salvar).toHaveLength(1);

    sessao.alterarTitulo('AB');
    const p3 = sessao.salvar();
    await andar();
    sessao.alterarTitulo('ABC');
    const p4 = sessao.salvar();
    await andar();
    expect(chamadas.salvar).toHaveLength(2);
    pendentes[1]!.resolver({ ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] });
    await p3;
    await andar();
    expect(chamadas.salvar).toHaveLength(3);
    expect(chamadas.salvar[2]!.pacote.documento.metadados.titulo).toEqual([{ tipo: 'texto', texto: 'ABC' }]);
    pendentes[2]!.resolver({ ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] });
    expect(await p4).toBe(true);
    expect(salvamento(sessao)?.tipo).toBe('salvo');
  });

  it('Ctrl+S sem alteração não grava', async () => {
    const { sessao, chamadas } = montar();
    sessao.abrir(projeto());
    expect(await sessao.salvar()).toBe(true);
    expect(chamadas.salvar).toHaveLength(0);
  });
});

describe('sessão de edição: trocar e fechar', () => {
  it('fechar grava antes, esquece o identificador e limpa o visor', async () => {
    const { sessao, chamadas, ativos } = montar();
    sessao.abrir(projeto());
    sessao.alterarTitulo('Final');
    expect(await sessao.fechar()).toBe(true);
    expect(chamadas.salvar).toHaveLength(1);
    expect(chamadas.fechar).toEqual([ID]);
    expect(sessao.obterEstado()).toEqual({ trabalho: null, avisos: [] });
    expect(ativos()).toHaveLength(0);
  });

  it('fechar com falha ao gravar não fecha e oferece "Salvar como…" e descartar', async () => {
    const { sessao, chamadas } = montar({ salvar: async () => ({ ok: false, motivo: 'ERRO', codigo: 'EM_USO', mensagem: 'Em uso.', erros: [] }) });
    sessao.abrir(projeto());
    sessao.alterarTitulo('X');
    expect(await sessao.fechar()).toBe(false);
    expect(sessao.obterEstado().trabalho).not.toBeNull();
    expect(chamadas.fechar).toEqual([]);
    expect(sessao.obterEstado().avisos.at(-1)?.acoes).toEqual(['salvarComo', 'descartar']);
    expect(await sessao.fechar({ descartar: true })).toBe(true);
    expect(chamadas.fechar).toEqual([ID]);
  });

  it('garantirSalvo antes de trocar: grava se precisa, e dá outra volta se o texto mudou no meio', async () => {
    let n = 0;
    const { sessao, chamadas } = montar({
      salvar: async () => {
        n += 1;
        if (n === 1) sessao.alterarTitulo('mudou durante');
        return { ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] };
      },
    });
    sessao.abrir(projeto());
    expect(await sessao.garantirSalvo()).toBe(true);
    expect(chamadas.salvar).toHaveLength(0);
    sessao.alterarTitulo('X');
    expect(await sessao.garantirSalvo()).toBe(true);
    expect(chamadas.salvar).toHaveLength(2);
    expect(sessao.temPendencias).toBe(false);
  });

  it('abrir outro trabalho libera o identificador anterior e o agendamento', () => {
    const { sessao, chamadas, ativos } = montar();
    sessao.abrir(projeto());
    sessao.alterarTitulo('X');
    sessao.abrir(projeto({ identificador: ID_NOVO, nomeArquivo: 'Outro.bdp' }));
    expect(chamadas.fechar).toEqual([ID]);
    expect(ativos()).toHaveLength(0);
    expect(sessao.obterEstado().trabalho?.nomeArquivo).toBe('Outro.bdp');
    expect(sessao.temPendencias).toBe(false);
  });

  it('descartar durante a gravação: o resultado atrasado não ressuscita o trabalho', async () => {
    const g = adiada<ResultadoSalvar>();
    const { sessao } = montar({ salvar: () => g.promessa });
    sessao.abrir(projeto());
    sessao.alterarTitulo('X');
    const p = sessao.salvar();
    await andar();
    expect(await sessao.fechar({ descartar: true })).toBe(true);
    g.resolver({ ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] });
    expect(await p).toBe(false);
    expect(sessao.obterEstado().trabalho).toBeNull();
  });
});

describe('sessão de edição: Salvar como, arquivo sem .bdp e versão futura', () => {
  it('Salvar como troca o identificador, esquece o antigo e mostra o nome novo', async () => {
    const { sessao, chamadas } = montar();
    sessao.abrir(projeto());
    sessao.alterarTitulo('X');
    expect(await sessao.salvarComo()).toBe(true);
    expect(chamadas.fechar).toEqual([ID]);
    expect(sessao.obterEstado().trabalho?.nomeArquivo).toBe('Novo.bdp');
    expect(salvamento(sessao)?.tipo).toBe('salvo');
    sessao.alterarTitulo('XY');
    await sessao.salvar();
    expect(chamadas.salvar.at(-1)?.id).toBe(ID_NOVO);
  });

  it('Salvar como com o diálogo aberto: o automático espera a vez e grava no arquivo novo (revisão do M1-T11)', async () => {
    const dialogo = adiada<ResultadoSalvarComo>();
    const { sessao, chamadas, ativos } = montar({ salvarComo: () => dialogo.promessa });
    sessao.abrir(projeto());
    sessao.alterarTitulo('A');
    const p = sessao.salvarComo();
    expect(ativos()).toHaveLength(0); // o automático pendente foi parado
    await andar();
    // Usuário digita com o diálogo aberto: aparece como não salvo e o automático é agendado...
    sessao.alterarTitulo('AB');
    expect(salvamento(sessao)).toEqual({ tipo: 'naoSalvo' });
    expect(ativos()).toHaveLength(1);
    // ...e dispara antes de o diálogo fechar: espera na fila, sem gravar no arquivo antigo.
    const agendado = ativos()[0]!;
    agendado.cancelado = true;
    agendado.acao(); // o automático chama salvar()
    const automatico = sessao.salvar(); // e um Ctrl+S junto: ambos esperam o diálogo
    await andar();
    expect(chamadas.salvar).toHaveLength(0);
    dialogo.resolver({ ok: true, identificador: ID_NOVO, nomeArquivo: 'Novo.bdp', avisos: [] });
    expect(await p).toBe(true);
    await automatico;
    await andar();
    expect(chamadas.salvar.map((c) => c.id)).toEqual([ID_NOVO]);
    expect(chamadas.salvar[0]!.pacote.documento.metadados.titulo).toEqual([{ tipo: 'texto', texto: 'AB' }]);
    expect(sessao.obterEstado().trabalho?.nomeArquivo).toBe('Novo.bdp');
    expect(salvamento(sessao)?.tipo).toBe('salvo');
    expect(sessao.temPendencias).toBe(false);
  });

  it('Salvar como cancelado não muda nada', async () => {
    const { sessao } = montar({ salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }) });
    sessao.abrir(projeto());
    sessao.alterarTitulo('X');
    expect(await sessao.salvarComo()).toBe(false);
    expect(salvamento(sessao)).toEqual({ tipo: 'naoSalvo' });
    expect(sessao.obterEstado().avisos).toEqual([]);
  });

  it('arquivo sem identificador: o automático não agenda, salvar orienta "Salvar como…", e ele resolve', async () => {
    const { sessao, chamadas, ativos } = montar();
    sessao.abrir(projeto({ identificador: null, nomeArquivo: 'antigo.zip' }));
    expect(sessao.obterEstado().trabalho?.podeSalvar).toBe(false);
    expect(sessao.obterEstado().avisos.map((a) => a.texto)).toEqual([MENSAGEM_SEM_DESTINO]);
    sessao.alterarTitulo('X');
    expect(salvamento(sessao)).toEqual({ tipo: 'naoSalvo' });
    expect(ativos()).toHaveLength(0);
    expect(await sessao.salvar()).toBe(false);
    expect(chamadas.salvar).toHaveLength(0);
    expect(await sessao.fechar()).toBe(false);
    expect(await sessao.salvarComo()).toBe(true);
    expect(sessao.obterEstado().trabalho?.podeSalvar).toBe(true);
    expect(sessao.obterEstado().avisos).toEqual([]);
    expect(await sessao.fechar()).toBe(true);
  });

  it('versão futura: só leitura, sem edição, sem gravação e sem pendências', async () => {
    const { sessao, chamadas, ativos } = montar();
    const p = pacote('Do futuro');
    const leitura: PacoteSomenteLeituraTransferivel = { ...p, manifesto: { ...p.manifesto, versaoFormato: 9 } };
    sessao.abrirSomenteLeitura('futuro.bdp', leitura);
    const t = sessao.obterEstado().trabalho;
    expect(t?.somenteLeitura).toBe(true);
    expect(t?.podeSalvar).toBe(false);
    expect(t?.titulo).toBe('Do futuro');
    expect(t?.salvamento).toEqual({ tipo: 'somenteLeitura' });
    sessao.alterarTitulo('Mudado');
    expect(sessao.obterEstado().trabalho?.titulo).toBe('Do futuro');
    expect(await sessao.salvar()).toBe(false);
    expect(await sessao.salvarComo()).toBe(false);
    expect(chamadas.salvar).toHaveLength(0);
    expect(chamadas.salvarComo).toBe(0);
    expect(ativos()).toHaveLength(0);
    expect(sessao.pacote).toBeNull();
    expect(await sessao.fechar()).toBe(true);
    expect(chamadas.fechar).toEqual([]);
  });

  it('o estado é o mesmo objeto até a próxima mudança e os ouvintes são avisados', () => {
    const { sessao } = montar();
    let avisos = 0;
    const sair = sessao.assinar(() => (avisos += 1));
    const antes = sessao.obterEstado();
    expect(sessao.obterEstado()).toBe(antes);
    sessao.abrir(projeto());
    expect(sessao.obterEstado()).not.toBe(antes);
    expect(avisos).toBe(1);
    sair();
    sessao.alterarTitulo('X');
    expect(avisos).toBe(1);
  });
});

describe('mídias uma vez (M2-T01)', () => {
  const M = { sha256: 'c'.repeat(64), bytes: new Uint8Array([1, 2, 3]) };
  const N = { sha256: 'd'.repeat(64), bytes: new Uint8Array([4]) };
  const comMidias = (identificador: string | null = ID) => projeto({ identificador, pacote: comFiguras({ ...pacote(), midias: [M] }, M.sha256) });
  const AUSENTE: ResultadoSalvar = { ok: false, motivo: 'ERRO', codigo: CODIGO_MIDIA_AUSENTE, mensagem: 'faltou', erros: [] };
  const OK_SALVAR: ResultadoSalvar = { ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] };

  it('M5-T06: o arquivo leva só as mídias usadas, com o manifesto refeito; a memória guarda as outras para o Ctrl+Z', async () => {
    const png = pngDeTeste(20, 10, 300);
    const sha = createHash('sha256').update(png).digest('hex');
    const { sessao, chamadas } = montar();
    sessao.abrir(projeto({ pacote: comFiguras({ ...pacote(), midias: [M] }, sha) }));
    expect(sessao.incluirMidia(png, sha)).toEqual({ ok: true, info: { tipo: 'image/png', larguraPx: 20, alturaPx: 10, ppi: expect.closeTo(300, 0) } });
    expect(sessao.incluirMidia(png, sha).ok).toBe(true); // a mesma imagem de novo: uma mídia só
    expect(sessao.lerMidia(sha)).toBe(png);
    expect(sessao.incluirMidia(new Uint8Array([1, 2, 3]), 'e'.repeat(64))).toEqual({ ok: false, mensagem: 'O arquivo não é uma imagem PNG ou JPEG que o app consiga ler.' });
    sessao.alterarTitulo('Um');
    expect(await sessao.salvar()).toBe(true);
    const enviado = chamadas.salvar[0]!.pacote;
    expect(enviado.midias).toEqual([{ sha256: sha, bytes: png }]);
    expect(enviado.manifesto.midias).toEqual([{ caminho: `midias/${sha}.png`, sha256: sha, bytes: png.length, tipo: 'image/png' }]);
    // M não é usada por nenhuma figura: fica fora do arquivo, mas a sessão ainda a tem.
    expect(sessao.lerMidia(M.sha256)).toBe(M.bytes);
    expect(sessao.pacoteAtual()!.midias.map((m) => m.sha256)).toEqual([sha]);
  });

  it('paraEnvio troca pela chave só as mídias conhecidas', () => {
    const p = { ...pacote(), midias: [M, N] };
    expect(paraEnvio(p, new Set([M.sha256])).midias).toEqual([{ sha256: M.sha256 }, N]);
    expect(p.midias).toEqual([M, N]); // não altera o pacote da sessão
  });

  it('salvar manda só a chave das mídias do arquivo aberto; MIDIA_AUSENTE → reenvia com os bytes uma vez', async () => {
    const respostas = [AUSENTE, OK_SALVAR, OK_SALVAR];
    const { sessao, chamadas } = montar({ salvar: async () => respostas.shift()! });
    sessao.abrir(comMidias());
    sessao.alterarTitulo('Um');
    expect(await sessao.salvar()).toBe(true);
    expect(chamadas.salvar.map((c) => c.pacote.midias)).toEqual([[{ sha256: M.sha256 }], [M]]);
    expect(salvamento(sessao)).toMatchObject({ tipo: 'salvo' });
    sessao.alterarTitulo('Dois');
    expect(await sessao.salvar()).toBe(true);
    expect(chamadas.salvar[2]!.pacote.midias).toEqual([{ sha256: M.sha256 }]);
  });

  it('arquivo sem identificador: o "Salvar como…" leva os bytes, e o identificador novo passa a receber só as chaves', async () => {
    const { sessao, chamadas } = montar();
    sessao.abrir(comMidias(null));
    sessao.alterarTitulo('Um');
    expect(await sessao.salvarComo()).toBe(true);
    sessao.alterarTitulo('Dois');
    expect(await sessao.salvar()).toBe(true);
    expect(chamadas.salvar).toEqual([{ id: ID_NOVO, pacote: expect.objectContaining({ midias: [{ sha256: M.sha256 }] }) }]);
  });

  it('instantâneo: MIDIA_AUSENTE → reenvia com os bytes; o seguinte vai só com a chave', async () => {
    const enviados: PacoteEnvio[] = [];
    const respostas: ResultadoInstantaneo[] = [{ ok: false, codigo: 'MIDIA_AUSENTE' }, { ok: true }, { ok: true }];
    const agendados: (() => void)[] = [];
    const sessao = new SessaoTrabalho({
      api: { salvar: async () => OK_SALVAR, salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => undefined },
      agora: () => new Date(),
      agendar: (acao, ms) => {
        if (ms === ATRASO_INSTANTANEO_MS) agendados.push(acao);
        return () => undefined;
      },
      instantaneo: async (_id, p) => (enviados.push(p), respostas.shift()!),
    });
    sessao.abrir(comMidias());
    sessao.alterarTitulo('Um');
    agendados.shift()!();
    await andar();
    sessao.alterarTitulo('Dois');
    agendados.shift()!();
    await andar();
    expect(enviados.map((p) => p.midias)).toEqual([[{ sha256: M.sha256 }], [M], [{ sha256: M.sha256 }]]);
    expect(sessao.obterEstado().avisos).toEqual([]);
  });
});

describe('trabalho sem arquivo com texto próprio (R-M2-04, R-M2-10)', () => {
  it('o aviso usa o texto pedido, e o falso "não é .bdp" não aparece', () => {
    const { sessao } = montar();
    sessao.abrir(projeto({ identificador: null }), [], { textoSemDestino: 'Versão descartada' });
    expect(sessao.obterEstado().avisos.map((a) => a.texto)).toEqual(['Versão descartada']);
    sessao.abrir(projeto({ identificador: null }));
    expect(sessao.obterEstado().avisos.map((a) => a.texto)).toEqual([MENSAGEM_SEM_DESTINO]);
  });
});

describe('trabalho sem arquivo com cópia de recuperação (R-M2-04)', () => {
  function montarComCopia() {
    const fechados: [string, boolean][] = [];
    const enviados: string[] = [];
    const agendados: { acao: () => void; cancelado: boolean }[] = [];
    const api: Pick<ApiProjetos, 'salvar' | 'salvarComo' | 'fechar'> = {
      salvar: () => Promise.reject(new Error('sem arquivo não salva')),
      salvarComo: () => Promise.resolve({ ok: true, identificador: ID_NOVO, nomeArquivo: 'Novo.bdp', avisos: [] }),
      fechar: () => Promise.resolve(),
    };
    const sessao = new SessaoTrabalho({
      api,
      agora: () => new Date(0),
      agendar: (acao) => {
        const a = { acao, cancelado: false };
        agendados.push(a);
        return () => void (a.cancelado = true);
      },
      instantaneo: async (id) => (enviados.push(id), { ok: true }),
      fecharSemArquivo: async (c, s) => void fechados.push([c, s]),
    });
    const disparar = () => agendados.filter((a) => !a.cancelado).forEach((a) => a.acao());
    return { sessao, fechados, enviados, disparar };
  }
  it('alteração manda instantâneo com o identificador da cópia', () => {
    const { sessao, enviados, disparar } = montarComCopia();
    sessao.abrir(projeto({ identificador: null, copiaRecuperacao: 'copia1' }));
    sessao.alterarTitulo('Novo');
    disparar();
    expect(enviados).toEqual(['copia1']);
  });
  it('sem cópia, trabalho sem arquivo continua sem instantâneo', () => {
    const { sessao, enviados, disparar } = montarComCopia();
    sessao.abrir(projeto({ identificador: null }));
    sessao.alterarTitulo('Novo');
    disparar();
    expect(enviados).toEqual([]);
  });
  it('trocar de trabalho encerra guardando; salvar como encerra apagando, e não encerra de novo', async () => {
    const { sessao, fechados } = montarComCopia();
    sessao.abrir(projeto({ identificador: null, copiaRecuperacao: 'c1' }));
    sessao.abrir(projeto({ identificador: null, copiaRecuperacao: 'c2' }));
    expect(fechados).toEqual([['c1', false]]);
    expect(await sessao.salvarComo()).toBe(true);
    expect(fechados).toEqual([['c1', false], ['c2', true]]);
    sessao.abrir(projeto());
    expect(fechados).toHaveLength(2);
  });
});
