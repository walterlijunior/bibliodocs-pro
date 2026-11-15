// Etapa 6 da especificação de atualização — visão geral do painel de conformidade (D-E6-05): por categoria, quantos
// itens há no trabalho, quantos estão sem ocorrência e quantos têm pendência ou aviso ("Tabelas (0)" contava
// ocorrências); tabelas e quadros com as menções ligadas; o estado muda ao inserir, mover e ligar.
import { describe, expect, it } from 'vitest';
import { criarTrabalhoVazio, SessaoTrabalho, type PacoteTransferivel } from '../src/aplicacao';
import type { Bloco, BlocoTabela, Documento, Inline, Secao } from '../src/dominio/modelo';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const tabela = (id: string, especie: 'tabela' | 'quadro', titulo: string, fonte?: string): BlocoTabela => ({
  tipo: 'tabela',
  id,
  especie,
  titulo: [t(titulo)],
  colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'direita' }],
  linhasCabecalho: 1,
  linhas: [[{ conteudo: [t('Item')] }, { conteudo: [t('Valor')] }], [{ conteudo: [t('A')] }, { conteudo: [t('1')] }]],
  ...(fonte ? { fonte: [t(fonte)] } : {}),
});
const rem = (id: string, alvo: string, texto?: string): Inline => ({ tipo: 'remissiva', id, alvo, ...(texto ? { texto } : {}) });
const par = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
const sec = (id: string, blocos: Bloco[]): Secao => ({ id, titulo: [t('Seção')], blocos, subsecoes: [] });

function abrir(documento: Partial<Documento>) {
  const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-15T10:00:00.000Z', appVersao: '0.1.0' });
  const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, ...documento }, midias: [] };
  const sessao = new SessaoTrabalho({ api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} }, agora: () => new Date(0), agendar: () => () => {} });
  sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
  return sessao;
}
const visao = (s: SessaoTrabalho) => s.inventarioConformidade(s.verificarConformidade());
const linha = (s: SessaoTrabalho, c: string) => visao(s).categorias.find((x) => x.categoria === c)!;

describe('visão geral da conformidade', () => {
  const tab = tabela('tab_e6000000001', 'tabela', 'Valores', 'Elaboração própria.');
  const qua = tabela('tab_e6000000002', 'quadro', 'Critérios');
  const texto = par('par_e6000000001', t('Ver '), rem('rem_e6000000001', tab.id), t(' e '), rem('rem_e6000000002', qua.id, 'o quadro a seguir'), t('.'));

  it('conta tabelas e quadros no trabalho, sem ocorrência e com ocorrência; a tabela válida aparece verificada', () => {
    const s = abrir({ corpo: [sec('sec_e6000000001', [texto, tab, qua])] });
    expect(linha(s, 'tabelas')).toMatchObject({ noTrabalho: 1, verificados: 1, comOcorrencia: 0 });
    // O quadro sem fonte tem pendência: conta como "com ocorrência", e a ocorrência fica no elemento.
    expect(linha(s, 'quadros')).toMatchObject({ noTrabalho: 1, verificados: 0, comOcorrencia: 1 });
    const q = visao(s).elementos.find((e) => e.id === qua.id)!;
    expect(q.ocorrencias.length).toBeGreaterThan(0);
    expect(q.mencoes).toEqual([{ secao: 'sec_e6000000001', bloco: 'par_e6000000001', remissiva: 'rem_e6000000002', semNumero: 'o quadro a seguir' }]);
    const e = visao(s).elementos.find((x) => x.id === tab.id)!;
    expect([e.rotulo, e.mencoes.map((m) => m.remissiva), e.ocorrencias]).toEqual(['Tabela 1', ['rem_e6000000001'], []]);
    // Texto e siglas não têm itens contáveis.
    expect(linha(s, 'texto').noTrabalho).toBeNull();
  });

  it('acompanha o editor: nova tabela antes da citada renumera; tirar a menção a deixa sem menção', () => {
    const s = abrir({ corpo: [sec('sec_e6000000001', [texto, tab, qua])] });
    const nova = tabela('tab_e6000000003', 'tabela', 'Nova', 'Fonte.');
    s.alterarSecao('sec_e6000000001', { titulo: [t('Seção')], blocos: [nova, texto, tab, qua] });
    expect(visao(s).elementos.filter((e) => e.categoria === 'tabelas').map((e) => [e.rotulo, e.mencoes.length])).toEqual([
      ['Tabela 1', 0],
      ['Tabela 2', 1],
    ]);
    expect(linha(s, 'tabelas').noTrabalho).toBe(2);
    s.alterarSecao('sec_e6000000001', { titulo: [t('Seção')], blocos: [nova, par('par_e6000000001', t('Sem menção.')), tab, qua] });
    expect(visao(s).elementos.find((e) => e.id === tab.id)!.mencoes).toEqual([]);
  });

  it('citações e referências contam os itens do trabalho', () => {
    const s = abrir({
      corpo: [sec('sec_e6000000001', [par('par_e6000000002', { tipo: 'citacao', id: 'cta_e6000000001', obras: [{ obra: 'obr_e6000000001' }] } as Inline)])],
      obras: [{ id: 'obr_e6000000001', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Silva', prenomes: 'Ana' }], titulo: [t('Livro')], local: 'Palmas', editora: 'E', ano: 2020 }],
    });
    expect(linha(s, 'citacoes').noTrabalho).toBe(1);
    expect(linha(s, 'referencias').noTrabalho).toBe(1);
  });
});
