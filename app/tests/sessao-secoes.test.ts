// M2-T06 — texto das seções na sessão (ADR-0007, seção 3): `alterarSecao` troca a seção de forma imutável, soma a
// revisão, agenda o automático e o instantâneo, e só avisa a interface quando o visor ou a lista de seções mudam (R39).
import { describe, expect, it } from 'vitest';
import {
  ATRASO_INSTANTANEO_MS,
  ATRASO_SALVAMENTO_AUTOMATICO_MS,
  criarTrabalhoVazio,
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
    expect(resumirSecoes(corpoBase())).toEqual([
      { id: 'sec_introducao01', indicativo: '1', nivel: 1, titulo: 'Introdução' },
      { id: 'sec_metodo000001', indicativo: '2', nivel: 1, titulo: 'Método' },
      { id: 'sec_amostra00001', indicativo: '2.1', nivel: 2, titulo: 'Amostra' },
      { id: 'sec_coleta000001', indicativo: '2.2', nivel: 2, titulo: 'Coleta' },
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

describe('inserirSecaoNoFim (M2-T06)', () => {
  it('trabalho vazio ganha a seção 1; a seguinte é a 2; id repetido é trocado', () => {
    const { sessao } = montar({ corpo: [], ids: ['sec_primeira0001', 'sec_primeira0001', 'sec_segunda00001'] });
    expect(sessao.inserirSecaoNoFim()).toEqual({ ok: true, id: 'sec_primeira0001' });
    expect(sessao.inserirSecaoNoFim()).toEqual({ ok: true, id: 'sec_segunda00001' });
    expect(sessao.obterEstado().trabalho!.secoes).toEqual([
      { id: 'sec_primeira0001', indicativo: '1', nivel: 1, titulo: '' },
      { id: 'sec_segunda00001', indicativo: '2', nivel: 1, titulo: '' },
    ]);
    expect(sessao.temPendencias).toBe(true);
    expect(validarDocumentoV1(sessao.pacote!.documento).ok).toBe(true);
    // A seção nova recebe texto.
    sessao.alterarSecao('sec_segunda00001', { titulo: [{ tipo: 'texto', texto: 'Conclusão' }], blocos: [] });
    expect(sessao.obterEstado().trabalho!.secoes[1]!.titulo).toBe('Conclusão');
  });

  it('sem gerador de id ou sem trabalho em edição, recusa com mensagem', () => {
    const { sessao } = montar();
    expect(sessao.inserirSecaoNoFim()).toEqual({ ok: false, mensagem: MENSAGEM_NAO_EDITAVEL });
  });
});
