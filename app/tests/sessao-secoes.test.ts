// M2-T06 e M2-T07 — texto e estrutura das seções na sessão (ADR-0007, seção 3): `alterarSecao` troca a seção de forma imutável, soma a
// revisão, agenda o automático e o instantâneo, e só avisa a interface quando o visor ou a lista de seções mudam (R39).
import { describe, expect, it } from 'vitest';
import {
  ATRASO_INSTANTANEO_MS,
  ATRASO_SALVAMENTO_AUTOMATICO_MS,
  criarTrabalhoVazio,
  MENSAGEM_NADA_A_DESFAZER,
  MENSAGEM_NADA_A_REFAZER,
  MENSAGEM_NAO_EDITAVEL,
  resumirSecoes,
  SessaoTrabalho,
  type PacoteEnvio,
  type PacoteTransferivel,
  type ResultadoInstantaneo,
} from '../src/aplicacao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Bloco, Secao } from '../src/dominio/modelo';

const ID = 'AAAAAAAAAAAAAAAAAAAAAA';

const secao = (id: string, titulo: string, subsecoes: Secao[] = [], blocos: Bloco[] = []): Secao => ({
  id,
  titulo: titulo === '' ? [] : [{ tipo: 'texto', texto: titulo }],
  blocos,
  subsecoes,
});

const paragrafo = (id: string, texto: string): Bloco => ({ tipo: 'paragrafo', id, conteudo: [{ tipo: 'texto', texto }] });

function pacote(corpo: Secao[]): PacoteTransferivel {
  const t = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-10-17T10:00:00.000Z', appVersao: '0.1.0' });
  return { ...t, documento: { ...t.documento, corpo }, midias: [] };
}

const corpoBase = (): Secao[] => [
  secao('sec_introducao01', 'Introdução', [], [paragrafo('par_aaaaaaaaaaaa', 'Começo.')]),
  secao('sec_metodo000001', 'Método', [secao('sec_amostra00001', 'Amostra'), secao('sec_coleta000001', 'Coleta')]),
];

function montar(opcoes: { corpo?: Secao[]; ids?: string[] } = {}) {
  const agendados: { ms: number; acao: () => void; cancelado: boolean }[] = [];
  const salvos: PacoteEnvio[] = [];
  const instantaneos: PacoteEnvio[] = [];
  const ids = [...(opcoes.ids ?? [])];
  const sessao = new SessaoTrabalho({
    api: {
      salvar: async (_id, p) => (salvos.push(p), { ok: true, nomeArquivo: 'Trabalho.bdp', avisos: [] }),
      salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }),
      fechar: async () => {},
    },
    agora: () => new Date(Date.UTC(2026, 9, 17, 13)),
    agendar: (acao, ms) => {
      const a = { ms, acao, cancelado: false };
      agendados.push(a);
      return () => void (a.cancelado = true);
    },
    instantaneo: async (_id, p): Promise<ResultadoInstantaneo> => (instantaneos.push(p), { ok: true }),
    ...(opcoes.ids ? { gerarIdSecao: () => ids.shift() ?? 'sec_acabaram0000' } : {}),
  });
  let emissoes = 0;
  sessao.assinar(() => (emissoes += 1));
  sessao.abrir({ identificador: ID, nomeArquivo: 'Trabalho.bdp', pacote: pacote(opcoes.corpo ?? corpoBase()), avisos: [], atualizacao: null });
  const ativos = () => agendados.filter((a) => !a.cancelado);
  return { sessao, salvos, instantaneos, ativos, emissoes: () => emissoes };
}

const andar = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('lista de seções (M2-T06)', () => {
  it('em ordem de leitura, com indicativo e nível calculados (nunca gravados)', () => {
    // M2-T07: mãe, posição entre as irmãs e quantas são (aria-level/posinset/setsize na árvore).
    expect(resumirSecoes(corpoBase())).toEqual([
      { id: 'sec_introducao01', indicativo: '1', nivel: 1, titulo: 'Introdução', paiId: null, posicao: 1, irmas: 2 },
      { id: 'sec_metodo000001', indicativo: '2', nivel: 1, titulo: 'Método', paiId: null, posicao: 2, irmas: 2 },
      { id: 'sec_amostra00001', indicativo: '2.1', nivel: 2, titulo: 'Amostra', paiId: 'sec_metodo000001', posicao: 1, irmas: 2 },
      { id: 'sec_coleta000001', indicativo: '2.2', nivel: 2, titulo: 'Coleta', paiId: 'sec_metodo000001', posicao: 2, irmas: 2 },
    ]);
    const { sessao } = montar();
    expect(sessao.obterEstado().trabalho?.secoes.map((s) => s.indicativo)).toEqual(['1', '2', '2.1', '2.2']);
  });

  it('cada abertura muda a geração; `secao` acha subseções e devolve null para id desconhecido', () => {
    const { sessao } = montar();
    const g1 = sessao.obterEstado().trabalho!.geracao;
    expect(sessao.secao('sec_coleta000001')?.titulo).toEqual([{ tipo: 'texto', texto: 'Coleta' }]);
    expect(sessao.secao('sec_naoexiste0001')).toBeNull();
    sessao.abrir({ identificador: ID, nomeArquivo: 'Trabalho.bdp', pacote: pacote(corpoBase()), avisos: [], atualizacao: null });
    expect(sessao.obterEstado().trabalho!.geracao).toBe(g1 + 1);
  });
});

describe('alterarSecao (M2-T06)', () => {
  it('troca só o caminho até a seção, soma a revisão e agenda automático e instantâneo', () => {
    const { sessao, ativos } = montar();
    const antes = sessao.pacote!.documento.corpo;
    const blocos = [paragrafo('par_bbbbbbbbbbbb', 'Texto novo.')];
    sessao.alterarSecao('sec_coleta000001', { titulo: [{ tipo: 'texto', texto: 'Coleta' }], blocos });
    const depois = sessao.pacote!.documento.corpo;
    expect(depois).not.toBe(antes);
    expect(depois[0]).toBe(antes[0]); // a Introdução não foi copiada
    expect(depois[1]!.subsecoes[0]).toBe(antes[1]!.subsecoes[0]);
    expect(depois[1]!.subsecoes[1]!.blocos).toBe(blocos);
    expect(antes[1]!.subsecoes[1]!.blocos).toEqual([]); // a entrada não mudou
    expect(sessao.obterEstado().trabalho!.salvamento).toEqual({ tipo: 'naoSalvo' });
    expect(ativos().map((a) => a.ms).sort((a, b) => a - b)).toEqual([ATRASO_INSTANTANEO_MS, ATRASO_SALVAMENTO_AUTOMATICO_MS]);
    expect(validarDocumentoV1(sessao.pacote!.documento).ok).toBe(true);
  });

  it('emite só quando o visor ou o título na lista mudam (não a cada tecla)', () => {
    const { sessao, emissoes } = montar();
    const inicial = emissoes();
    const titulo = [{ tipo: 'texto' as const, texto: 'Introdução' }];
    sessao.alterarSecao('sec_introducao01', { titulo, blocos: [paragrafo('par_aaaaaaaaaaaa', 'C')] });
    expect(emissoes()).toBe(inicial + 1); // Salvo → Alterações não salvas
    const estado = sessao.obterEstado();
    for (const texto of ['Co', 'Com', 'Come']) sessao.alterarSecao('sec_introducao01', { titulo, blocos: [paragrafo('par_aaaaaaaaaaaa', texto)] });
    expect(emissoes()).toBe(inicial + 1);
    expect(sessao.obterEstado()).toBe(estado);
    sessao.alterarSecao('sec_introducao01', { titulo: [{ tipo: 'texto', texto: 'Introdução geral' }], blocos: [] });
    expect(emissoes()).toBe(inicial + 2);
    expect(sessao.obterEstado().trabalho!.secoes[0]!.titulo).toBe('Introdução geral');
    // A lista nova reaproveita as outras seções.
    expect(sessao.obterEstado().trabalho!.secoes[1]).toBe(estado.trabalho!.secoes[1]);
  });

  it('o mesmo conteúdo (mesmos arrays) não conta como alteração; seção desconhecida e só leitura são ignoradas', () => {
    const { sessao, ativos } = montar();
    const s = sessao.secao('sec_introducao01')!;
    sessao.alterarSecao('sec_introducao01', { titulo: s.titulo, blocos: s.blocos });
    sessao.alterarSecao('sec_naoexiste0001', { titulo: [], blocos: [] });
    expect(sessao.temPendencias).toBe(false);
    expect(ativos()).toEqual([]);
    sessao.abrirSomenteLeitura('Futuro.bdp', { ...pacote(corpoBase()), versaoFormato: 2 } as never);
    sessao.alterarSecao('sec_introducao01', { titulo: [], blocos: [] });
    expect(sessao.secao('sec_introducao01')?.titulo).toEqual(s.titulo);
  });

  it('o salvamento grava o texto digitado; alteração durante a gravação continua pendente', async () => {
    const { sessao, salvos } = montar();
    sessao.alterarSecao('sec_amostra00001', { titulo: [{ tipo: 'texto', texto: 'Amostra' }], blocos: [paragrafo('par_cccccccccccc', 'Um.')] });
    const gravando = sessao.salvar();
    sessao.alterarSecao('sec_amostra00001', { titulo: [{ tipo: 'texto', texto: 'Amostra' }], blocos: [paragrafo('par_cccccccccccc', 'Dois.')] });
    expect(await gravando).toBe(true);
    await andar();
    expect(salvos[0]!.documento.corpo[1]!.subsecoes[0]!.blocos).toEqual([paragrafo('par_cccccccccccc', 'Um.')]);
    expect(sessao.obterEstado().trabalho!.salvamento).toEqual({ tipo: 'naoSalvo' });
    expect(await sessao.garantirSalvo()).toBe(true);
    expect(salvos.at(-1)!.documento.corpo[1]!.subsecoes[0]!.blocos).toEqual([paragrafo('par_cccccccccccc', 'Dois.')]);
  });

  it('o instantâneo leva o texto mais recente', async () => {
    const { sessao, instantaneos, ativos } = montar();
    sessao.alterarSecao('sec_introducao01', { titulo: [], blocos: [paragrafo('par_aaaaaaaaaaaa', 'A')] });
    sessao.alterarSecao('sec_introducao01', { titulo: [], blocos: [paragrafo('par_aaaaaaaaaaaa', 'AB')] });
    ativos().find((a) => a.ms === ATRASO_INSTANTANEO_MS)!.acao();
    await andar();
    expect(instantaneos).toHaveLength(1);
    expect(instantaneos[0]!.documento.corpo[0]!.blocos).toEqual([paragrafo('par_aaaaaaaaaaaa', 'AB')]);
  });
});

describe('novaSecao (M2-T06, M2-T07)', () => {
  it('trabalho vazio ganha a seção 1; a seguinte é a 2; id repetido é trocado', () => {
    const { sessao } = montar({ corpo: [], ids: ['sec_primeira0001', 'sec_primeira0001', 'sec_segunda00001'] });
    expect(sessao.novaSecao()).toEqual({ ok: true, mudou: true, secaoId: 'sec_primeira0001' });
    expect(sessao.novaSecao('sec_primeira0001')).toEqual({ ok: true, mudou: true, secaoId: 'sec_segunda00001' });
    expect(sessao.obterEstado().trabalho!.secoes.map((s) => [s.id, s.indicativo, s.titulo])).toEqual([
      ['sec_primeira0001', '1', ''],
      ['sec_segunda00001', '2', ''],
    ]);
    expect(sessao.temPendencias).toBe(true);
    expect(validarDocumentoV1(sessao.pacote!.documento).ok).toBe(true);
    // A seção nova recebe texto.
    sessao.alterarSecao('sec_segunda00001', { titulo: [{ tipo: 'texto', texto: 'Conclusão' }], blocos: [] });
    expect(sessao.obterEstado().trabalho!.secoes[1]!.titulo).toBe('Conclusão');
  });

  it('entra logo depois da seção escolhida e das subseções dela, no mesmo nível', () => {
    const { sessao } = montar({ ids: ['sec_novaaposmet1', 'sec_novaaposamo1'] });
    sessao.novaSecao('sec_metodo000001');
    sessao.novaSecao('sec_amostra00001');
    expect(sessao.obterEstado().trabalho!.secoes.map((s) => `${s.indicativo} ${s.id}`)).toEqual([
      '1 sec_introducao01',
      '2 sec_metodo000001',
      '2.1 sec_amostra00001',
      '2.2 sec_novaaposamo1',
      '2.3 sec_coleta000001',
      '3 sec_novaaposmet1',
    ]);
  });

  it('sem gerador de id ou sem trabalho em edição, recusa com mensagem', () => {
    const { sessao } = montar();
    expect(sessao.novaSecao()).toEqual({ ok: false, mensagem: MENSAGEM_NAO_EDITAVEL });
  });
});

/** Indicativo e título de cada seção, na ordem de leitura. */
const lista = (sessao: SessaoTrabalho) => sessao.obterEstado().trabalho!.secoes.map((s) => `${s.indicativo} ${s.titulo}`);

describe('operações estruturais na sessão (M2-T07, RF-03)', () => {
  it('subir, descer, recuar, promover e excluir renumeram a lista e contam como alteração', () => {
    const { sessao, ativos } = montar();
    expect(sessao.operarSecao('acima', 'sec_coleta000001')).toEqual({ ok: true, mudou: true, secaoId: 'sec_coleta000001' });
    expect(lista(sessao)).toEqual(['1 Introdução', '2 Método', '2.1 Coleta', '2.2 Amostra']);
    expect(sessao.obterEstado().trabalho!.salvamento).toEqual({ tipo: 'naoSalvo' });
    expect(ativos().length).toBe(2);
    // A primeira das irmãs sobe para a seção anterior à mãe (2.1 → 1.1).
    sessao.operarSecao('acima', 'sec_coleta000001');
    expect(lista(sessao)).toEqual(['1 Introdução', '1.1 Coleta', '2 Método', '2.1 Amostra']);
    sessao.operarSecao('abaixo', 'sec_coleta000001');
    expect(lista(sessao)).toEqual(['1 Introdução', '2 Método', '2.1 Coleta', '2.2 Amostra']);
    sessao.operarSecao('promover', 'sec_coleta000001');
    expect(lista(sessao)).toEqual(['1 Introdução', '2 Método', '3 Coleta', '3.1 Amostra']);
    sessao.operarSecao('recuar', 'sec_coleta000001');
    expect(lista(sessao)).toEqual(['1 Introdução', '2 Método', '2.1 Coleta', '2.1.1 Amostra']);
    expect(sessao.operarSecao('excluir', 'sec_metodo000001')).toEqual({ ok: true, mudou: true, secaoId: null });
    expect(lista(sessao)).toEqual(['1 Introdução']);
    expect(validarDocumentoV1(sessao.pacote!.documento).ok).toBe(true);
  });

  it('recusa com a mensagem do domínio, sem alterar nada nem empilhar desfazer', () => {
    const { sessao } = montar();
    const r = sessao.operarSecao('promover', 'sec_introducao01');
    expect(r).toEqual({ ok: false, mensagem: 'A seção já é primária.' });
    expect(sessao.operarSecao('acima', 'sec_introducao01')).toMatchObject({ ok: false, mensagem: expect.stringContaining('primeira') });
    expect(sessao.operarSecao('recuar', 'sec_amostra00001')).toMatchObject({ ok: false });
    expect(sessao.temPendencias).toBe(false);
    expect(sessao.podeDesfazer).toBe(false);
  });

  it('arrastar para junto de outra seção; soltar sobre ela mesma não muda nada', () => {
    const { sessao } = montar();
    expect(sessao.moverSecaoJuntoDe('sec_coleta000001', 'sec_coleta000001', 'antes')).toEqual({ ok: true, mudou: false, secaoId: 'sec_coleta000001' });
    expect(sessao.temPendencias).toBe(false);
    sessao.moverSecaoJuntoDe('sec_introducao01', 'sec_coleta000001', 'depois');
    expect(lista(sessao)).toEqual(['1 Método', '1.1 Amostra', '1.2 Coleta', '1.3 Introdução']);
    expect(sessao.moverSecaoJuntoDe('sec_metodo000001', 'sec_amostra00001', 'antes')).toMatchObject({ ok: false });
  });

  it('só leitura não opera', () => {
    const { sessao } = montar();
    sessao.abrirSomenteLeitura('Futuro.bdp', { ...pacote(corpoBase()), versaoFormato: 2 } as never);
    expect(sessao.operarSecao('excluir', 'sec_introducao01')).toEqual({ ok: false, mensagem: MENSAGEM_NAO_EDITAVEL });
    expect(sessao.moverSecaoJuntoDe('sec_introducao01', 'sec_metodo000001', 'depois')).toEqual({ ok: false, mensagem: MENSAGEM_NAO_EDITAVEL });
    expect(sessao.desfazer(() => true)).toEqual({ ok: false, mensagem: MENSAGEM_NAO_EDITAVEL });
  });
});

describe('ordem única de desfazer na sessão (M2-T07; ADR-0007, seção 4)', () => {
  it('desfaz e refaz a estrutura pelo inverso; a seção excluída volta com o texto', () => {
    const { sessao } = montar();
    const inicial = sessao.pacote!.documento.corpo;
    sessao.operarSecao('excluir', 'sec_introducao01');
    sessao.operarSecao('recuar', 'sec_coleta000001');
    const nada = () => false;
    expect(sessao.desfazer(nada)).toEqual({ ok: true, mudou: true, secaoId: 'sec_coleta000001' });
    expect(sessao.desfazer(nada)).toEqual({ ok: true, mudou: true, secaoId: 'sec_introducao01' });
    expect(sessao.pacote!.documento.corpo).toEqual(inicial);
    expect(sessao.desfazer(nada)).toEqual({ ok: false, mensagem: MENSAGEM_NADA_A_DESFAZER });
    expect(sessao.refazer(nada)).toEqual({ ok: true, mudou: true, secaoId: null }); // excluída de novo
    expect(lista(sessao)).toEqual(['1 Método', '1.1 Amostra', '1.2 Coleta']);
    expect(sessao.refazer(nada)).toMatchObject({ ok: true, secaoId: 'sec_coleta000001' });
    expect(lista(sessao)).toEqual(['1 Método', '1.1 Amostra', '1.1.1 Coleta']);
    expect(sessao.refazer(nada)).toEqual({ ok: false, mensagem: MENSAGEM_NADA_A_REFAZER });
  });

  it('a entrada de texto chama quem tem o editor; sem o passo, é descartada e a anterior é tentada', () => {
    const { sessao } = montar({ ids: ['sec_novasecao001'] });
    const chamadas: string[] = [];
    sessao.registrarTexto('sec_introducao01');
    sessao.novaSecao('sec_introducao01');
    sessao.registrarTexto('sec_novasecao001');
    sessao.registrarTexto('sec_naoexiste0001'); // ignorada: a seção não existe
    // O texto da seção nova: aplicado.
    expect(sessao.desfazer((id, s) => (chamadas.push(`${s} ${id}`), true))).toEqual({ ok: true, mudou: true, secaoId: 'sec_novasecao001' });
    // A criação: desfeita (a seção some, `secaoId` nulo).
    expect(sessao.desfazer(() => true)).toEqual({ ok: true, mudou: true, secaoId: null });
    // O texto da Introdução já não está no histórico da seção: descartado, e não há mais nada.
    expect(sessao.desfazer((id, s) => (chamadas.push(`${s} ${id}`), false))).toEqual({ ok: false, mensagem: MENSAGEM_NADA_A_DESFAZER });
    expect(chamadas).toEqual(['desfazer sec_novasecao001', 'desfazer sec_introducao01']);
    // Refazer: a criação e depois o texto da seção nova.
    expect(sessao.refazer(() => true)).toMatchObject({ ok: true, secaoId: 'sec_novasecao001' });
    expect(sessao.refazer((id, s) => (chamadas.push(`${s} ${id}`), true))).toMatchObject({ ok: true, secaoId: 'sec_novasecao001' });
    expect(chamadas.at(-1)).toBe('refazer sec_novasecao001');
  });

  it('alteração nova esvazia o refazer; reabrir esvazia tudo', () => {
    const { sessao } = montar();
    sessao.operarSecao('acima', 'sec_coleta000001');
    sessao.desfazer(() => true);
    expect(sessao.podeRefazer).toBe(true);
    sessao.registrarTexto('sec_coleta000001');
    expect(sessao.podeRefazer).toBe(false);
    expect(sessao.podeDesfazer).toBe(true);
    sessao.abrir({ identificador: ID, nomeArquivo: 'Trabalho.bdp', pacote: pacote(corpoBase()), avisos: [], atualizacao: null });
    expect(sessao.podeDesfazer).toBe(false);
  });

  it('a geração não muda numa operação estrutural (os editores guardados continuam valendo)', () => {
    const { sessao } = montar();
    const g = sessao.obterEstado().trabalho!.geracao;
    sessao.operarSecao('acima', 'sec_coleta000001');
    sessao.desfazer(() => true);
    expect(sessao.obterEstado().trabalho!.geracao).toBe(g);
  });
});
