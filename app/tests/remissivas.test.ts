// M5-T08 (RF-11; RN-060, D-M5-04, D-M5-42 a 46) — remissivas: alvos e texto derivados da numeração, motor e DOCX (texto
// que acompanha a renumeração; quebrada com aviso), comandos do editor (só no texto corrido; trocar o alvo) e a sessão
// (lista de elementos estável; aceite do RF-11: excluir elemento citado gera aviso de remissiva quebrada).
import { EditorState, TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { criarTrabalhoVazio, SessaoTrabalho, type PacoteTransferivel } from '../src/aplicacao';
import type { Bloco, BlocoEquacao, BlocoTabela, Inline, Secao } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { alvosDeRemissiva, TEXTO_REMISSIVA_QUEBRADA } from '../src/dominio/visuais';
import { exportarDocx } from '../src/exportacao/docx';
import { docParaSecao, secaoParaDoc } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';
import { alterarRemissiva, inserirRemissiva, podeInserirRemissiva, remissivaSelecionada, TEXTO_QUEBRADA } from '../src/interface/editor/remissivas';
import { abrirDocx } from './apoio/docx-normalizado';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const tab = (id: string, titulo: string, especie: 'tabela' | 'quadro' = 'tabela'): BlocoTabela => ({
  tipo: 'tabela',
  id,
  especie,
  titulo: [t(titulo)],
  colunas: [{ alinhamento: 'esquerda' }],
  linhasCabecalho: 0,
  linhas: [[{ conteudo: [t('1')] }]],
  fonte: [t('O autor.')],
});
const eq = (id: string, numerada = true): BlocoEquacao => ({ tipo: 'equacao', id, conteudo: [t('x = 1')], ...(numerada ? { numerada: true as const } : {}) });
const rem = (id: string, alvo: string): Inline => ({ tipo: 'remissiva', id, alvo });
const par = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
const sec = (id: string, blocos: Bloco[]): Secao => ({ id, titulo: [t('Seção')], blocos, subsecoes: [] });

describe('alvos e texto (D-M5-42)', () => {
  it('tabela, quadro e figura com a palavra designativa; equação numerada como "(n)"; sem número não é alvo; ordem do documento', () => {
    const corpo = [
      sec('sec_rem0000000001', [tab('tab_rem000000001', 'Vendas'), eq('eqc_rem000000001'), eq('eqc_rem000000002', false)]),
      sec('sec_rem0000000002', [tab('tab_rem000000002', 'Lista', 'quadro'), tab('tab_rem000000003', 'Custos')]),
    ];
    expect(alvosDeRemissiva(corpo).map((a) => [a.id, a.rotulo, a.descricao, a.secao])).toEqual([
      ['tab_rem000000001', 'Tabela 1', 'Tabela 1 – Vendas', 'sec_rem0000000001'],
      ['eqc_rem000000001', '(1)', 'Equação (1) – x = 1', 'sec_rem0000000001'],
      ['tab_rem000000002', 'Quadro 1', 'Quadro 1 – Lista', 'sec_rem0000000002'],
      ['tab_rem000000003', 'Tabela 2', 'Tabela 2 – Custos', 'sec_rem0000000002'],
    ]);
  });
});

describe('motor e DOCX (D-M5-44)', () => {
  const texto = (corpo: Secao[]) =>
    formatar({ corpo }, PERFIL)
      .secoes.flatMap((s) => s.blocos)
      .filter((b) => b.tipo === 'paragrafo' && b.estilo === 'corpo')
      .map((b) => (b.tipo === 'paragrafo' ? b.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('') : ''));

  it('o texto acompanha a numeração: a tabela que passa para a frente muda de número em todo o texto', () => {
    const a = tab('tab_rem000000001', 'A');
    const b = tab('tab_rem000000002', 'B');
    const p = par('par_rem000000001', t('Ver a '), rem('rem_rem000000001', b.id), t(' e a '), rem('rem_rem000000002', a.id), t('.'));
    expect(texto([sec('sec_rem0000000001', [p, a, b])])).toEqual(['Ver a Tabela 2 e a Tabela 1.']);
    expect(texto([sec('sec_rem0000000001', [p, b, a])])).toEqual(['Ver a Tabela 1 e a Tabela 2.']);
  });

  it('remissiva quebrada sai marcada (o aviso é do verificador, sem repetir no motor); equação sem número também quebra', async () => {
    const semNumero = eq('eqc_rem000000002', false);
    const corpo = [sec('sec_rem0000000001', [par('par_rem000000001', rem('rem_rem000000001', 'tab_naoexiste001'), t(' e '), rem('rem_rem000000002', semNumero.id)), semNumero])];
    const f = formatar({ corpo }, PERFIL);
    expect(f.avisos).toEqual([]);
    expect(texto(corpo)).toEqual([`${TEXTO_REMISSIVA_QUEBRADA} e ${TEXTO_REMISSIVA_QUEBRADA}`]);
    const doc = abrirDocx(await exportarDocx(f))['word/document.xml']!;
    expect(doc).toContain(TEXTO_REMISSIVA_QUEBRADA);
  });

  it('a cópia do texto da remissiva quebrada no editor é a mesma do domínio', () => {
    expect(TEXTO_QUEBRADA).toBe(TEXTO_REMISSIVA_QUEBRADA);
  });
});

describe('editor', () => {
  const conteudo = { titulo: [t('T')], blocos: [par('par_rem000000001', t('Ver ')), eq('eqc_rem000000001')] };
  // Título "T": 0–3; parágrafo a partir de 3, texto em 4 ("Ver " termina em 8); equação a partir de 9, texto em 10.
  const estado = (pos: number): EditorState => {
    const e = criarEstadoSecao(conteudo, { gerarId: (p) => `${p}_remteste000001` });
    return e.apply(e.tr.setSelection(TextSelection.create(e.doc, pos)));
  };

  it('insere no texto corrido, com id, e a ida e volta é exata; não no título nem na equação', () => {
    expect(podeInserirRemissiva(estado(2))).toBe(false);
    expect(podeInserirRemissiva(estado(11))).toBe(false);
    let e = estado(8);
    expect(inserirRemissiva('eqc_rem000000001')(e, (tr) => (e = e.apply(tr)))).toBe(true);
    const bloco = docParaSecao(e.doc).blocos[0]!;
    expect(bloco).toEqual(par('par_rem000000001', t('Ver '), rem('rem_remteste000001', 'eqc_rem000000001')));
    expect(docParaSecao(secaoParaDoc(docParaSecao(e.doc)))).toEqual(docParaSecao(e.doc));
  });

  it('trocar o alvo mantém o id e seleciona a remissiva', () => {
    let e = estado(8);
    inserirRemissiva('eqc_rem000000001')(e, (tr) => (e = e.apply(tr)));
    expect(alterarRemissiva('rem_remteste000001', 'tab_outra0000001')(e, (tr) => (e = e.apply(tr)))).toBe(true);
    expect(remissivaSelecionada(e)).toEqual({ id: 'rem_remteste000001', pos: 8, alvo: 'tab_outra0000001' });
  });
});

describe('sessão: lista de elementos e aceite do RF-11', () => {
  function abrir(corpo: Secao[]) {
    const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-08T10:00:00.000Z', appVersao: '0.1.0' });
    const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, corpo }, midias: [] };
    const sessao = new SessaoTrabalho({ api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} }, agora: () => new Date(0), agendar: () => () => {} });
    sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
    return sessao;
  }
  const a = tab('tab_rem000000001', 'A');
  const b = tab('tab_rem000000002', 'B');
  const p = par('par_rem000000001', t('Ver a '), rem('rem_rem000000001', b.id), t(' e '), rem('rem_rem000000002', b.id));

  it('lista com rótulo e contagem; digitar texto não troca o objeto; elemento novo troca', () => {
    const s = abrir([sec('sec_rem0000000001', [p, a, b])]);
    const lista = s.obterEstado().trabalho!.elementos;
    // Desde o M6 a seção também é alvo; aqui interessam as tabelas.
    expect(lista.filter((e) => e.tipo === 'tabela').map((e) => [e.rotulo, e.remissivas])).toEqual([
      ['Tabela 1', 0],
      ['Tabela 2', 2],
    ]);
    s.alterarSecao('sec_rem0000000001', { titulo: [t('Seção')], blocos: [par('par_rem000000001', t('Outro texto, '), rem('rem_rem000000001', b.id), t(' e '), rem('rem_rem000000002', b.id)), a, b] });
    expect(s.obterEstado().trabalho!.elementos).toBe(lista);
    s.alterarSecao('sec_rem0000000001', { titulo: [t('Seção')], blocos: [p, tab('tab_rem000000003', 'Nova'), a, b] });
    expect(s.obterEstado().trabalho!.elementos.filter((e) => e.tipo === 'tabela').map((e) => e.rotulo)).toEqual(['Tabela 1', 'Tabela 2', 'Tabela 3']);
  });

  it('excluir a tabela citada avisa quantas remissivas ficaram quebradas; a não citada não avisa', () => {
    const s = abrir([sec('sec_rem0000000001', [p, a, b])]);
    s.alterarSecao('sec_rem0000000001', { titulo: [t('Seção')], blocos: [p, b] });
    expect(s.obterEstado().avisos.map((x) => x.texto)).toEqual([]);
    s.alterarSecao('sec_rem0000000001', { titulo: [t('Seção')], blocos: [p] });
    expect(s.obterEstado().avisos.map((x) => [x.nivel, x.texto])).toEqual([['alerta', 'Tabela 1 excluída do texto: 2 remissivas ficaram quebradas. Ctrl+Z desfaz.']]);
    // A tabela volta (o Ctrl+Z devolve o texto da seção): o aviso sai.
    s.alterarSecao('sec_rem0000000001', { titulo: [t('Seção')], blocos: [p, b] });
    expect(s.obterEstado().avisos).toEqual([]);
  });

  it('equação citada que perde o número também avisa', () => {
    const e1 = eq('eqc_rem000000001');
    const pe = par('par_rem000000001', rem('rem_rem000000001', e1.id));
    const s = abrir([sec('sec_rem0000000001', [pe, e1])]);
    s.alterarSecao('sec_rem0000000001', { titulo: [t('Seção')], blocos: [pe, eq('eqc_rem000000001', false)] });
    expect(s.obterEstado().avisos.map((x) => x.texto)).toEqual(['Equação (1) sem número: 1 remissiva ficou quebrada. Ctrl+Z desfaz.']);
  });

  it('abrir outro trabalho não compara com o anterior', () => {
    const s = abrir([sec('sec_rem0000000001', [p, a, b])]);
    const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnoq', agora: '2026-11-08T10:00:00.000Z', appVersao: '0.1.0' });
    s.abrir({ identificador: 'BBBBBBBBBBBBBBBBBBBBBB', nomeArquivo: 'U.bdp', pacote: { ...base, midias: [] }, avisos: [], atualizacao: null });
    expect(s.obterEstado().avisos).toEqual([]);
    expect(s.obterEstado().trabalho!.elementos).toEqual([]);
  });
});

describe('sessão com apêndice e seção como alvos (revisão do M6: integração M6-T05/T06 com a lista da tela)', () => {
  it('a lista da tela tem a seção, o apêndice e a tabela de dentro do apêndice, numerada depois das do texto', () => {
    const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-08T10:00:00.000Z', appVersao: '0.1.0' });
    const corpo = [sec('sec_rem0000000001', [tab('tab_rem000000001', 'No texto')])];
    const posTextuais = [{ tipo: 'apendice' as const, id: 'ape_rem000000001', titulo: 'Questionário', blocos: [tab('tab_rem000000002', 'No apêndice')] }];
    const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, corpo, posTextuais }, midias: [] };
    const sessao = new SessaoTrabalho({ api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} }, agora: () => new Date(0), agendar: () => () => {} });
    sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
    const lista = sessao.obterEstado().trabalho!.elementos.map((e) => [e.tipo, e.rotulo]);
    expect(lista).toEqual([
      ['secao', '1'],
      ['tabela', 'Tabela 1'],
      ['apendice', 'APÊNDICE A'],
      ['tabela', 'Tabela 2'],
    ]);
  });
});
