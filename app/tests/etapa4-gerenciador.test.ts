// Etapa 4 da especificação de atualização — gerenciador de elementos e referências cruzadas: menção sem número (texto do
// autor ligado ao elemento), ligar menção escrita ("Quadro 1" digitado), contagens e prévia da sessão, e o aceite (três
// quadros com renumeração 1, 2 → 2, 3 e as fontes nos quadros certos; menção sem número; tabela importada de CSV;
// apêndice citado no DOCX).
import { EditorState, TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { aplicarPlanilha, converterPlanilha, criarTrabalhoVazio, dadosDoRascunho, lerCsv, rascunhoNovo, SessaoTrabalho, type PacoteTransferivel } from '../src/aplicacao';
import { opcoesSugeridas } from '../src/aplicacao/servicos/planilha';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Bloco, BlocoTabela, Documento, Inline, Secao } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { alvoPorRotulo, alvosDeRemissiva, mencoesEscritas, TEXTO_REMISSIVA_QUEBRADA } from '../src/dominio/visuais';
import { avaliarConformidade } from '../src/dominio/verificador/conformidade';
import { exportarDocx } from '../src/exportacao/docx';
import { docParaSecao, secaoParaDoc } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';
import { alterarRemissiva, inserirRemissiva, mencaoEscritaSelecionada, remissivaSelecionada } from '../src/interface/editor/remissivas';
import { abrirDocx } from './apoio/docx-normalizado';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const quadro = (id: string, titulo: string, fonte: string): BlocoTabela => ({
  tipo: 'tabela',
  id,
  especie: 'quadro',
  titulo: [t(titulo)],
  colunas: [{ alinhamento: 'esquerda' }],
  linhasCabecalho: 0,
  linhas: [[{ conteudo: [t('Conteúdo')] }]],
  fonte: [t(fonte)],
});
const rem = (id: string, alvo: string, texto?: string): Inline => ({ tipo: 'remissiva', id, alvo, ...(texto !== undefined ? { texto } : {}) });
const par = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
const sec = (id: string, blocos: Bloco[]): Secao => ({ id, titulo: [t('Seção')], blocos, subsecoes: [] });

const textoDoCorpo = (doc: Pick<Documento, 'corpo' | 'posTextuais'>) =>
  formatar(doc, PERFIL)
    .secoes.flatMap((s) => s.blocos)
    .filter((b) => b.tipo === 'paragrafo' && b.estilo === 'corpo')
    .map((b) => (b.tipo === 'paragrafo' ? b.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('') : ''));

function abrir(documento: Partial<Documento>) {
  const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' });
  const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, ...documento }, midias: [] };
  const sessao = new SessaoTrabalho({ api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} }, agora: () => new Date(0), agendar: () => () => {} });
  sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
  return sessao;
}

describe('formato: menção sem número', () => {
  const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' }).documento;
  const comTexto = (texto: unknown) => ({ ...base, corpo: [sec('sec_et4000000001', [par('par_et4000000001', { tipo: 'remissiva', id: 'rem_et4000000001', alvo: 'tab_et4000000001', texto } as Inline)])] });

  it('aceita o texto do autor e recusa vazio, só espaços, quebra de linha e texto longo', () => {
    expect(validarDocumentoV1(comTexto('o quadro a seguir')).ok).toBe(true);
    for (const ruim of ['', '   ', 'a\nb', 'x'.repeat(201)]) expect(validarDocumentoV1(comTexto(ruim)).ok).toBe(false);
  });
});

describe('motor: menção sem número', () => {
  it('sai com o texto do autor, que não muda com a numeração; quebrada também conserva o texto', () => {
    const a = quadro('tab_et4000000001', 'A', 'O autor.');
    const p = par('par_et4000000001', t('Veja '), rem('rem_et4000000001', a.id, 'o quadro a seguir'), t(' e o '), rem('rem_et4000000002', a.id), t('.'));
    expect(textoDoCorpo({ corpo: [sec('sec_et4000000001', [p, a])] })).toEqual(['Veja o quadro a seguir e o Quadro 1.']);
    const quebrada = par('par_et4000000001', rem('rem_et4000000001', 'tab_naoexiste001', 'o quadro a seguir'), t(' e '), rem('rem_et4000000002', 'tab_naoexiste001'));
    expect(textoDoCorpo({ corpo: [sec('sec_et4000000001', [quebrada])] })).toEqual([`o quadro a seguir e ${TEXTO_REMISSIVA_QUEBRADA}`]);
  });

  it('a menção sem número quebrada é pendência do verificador, como a remissiva', () => {
    const doc = { ...criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' }).documento, corpo: [sec('sec_et4000000001', [par('par_et4000000001', rem('rem_et4000000001', 'tab_naoexiste001', 'o quadro a seguir'))])] };
    expect(avaliarConformidade(doc, PERFIL).problemas.map((x) => x.codigo)).toContain('REMISSIVA_QUEBRADA');
  });
});

describe('menções escritas sem ligação', () => {
  const a = quadro('tab_et4000000001', 'A', 'F1');
  const b = quadro('tab_et4000000002', 'B', 'F2');
  const corpo = [sec('sec_et4000000001', [par('par_et4000000001', t('Como no quadro 2 e no '), { tipo: 'texto', texto: 'Quadro', marcas: ['italico'] }, t(' 1, e no Quadro 9; ver '), rem('rem_et4000000001', a.id), t(' e APÊNDICE A; anexo a parte.')), a, b])];
  const posTextuais = [{ tipo: 'apendice' as const, id: 'ape_et4000000001', titulo: 'Roteiro', blocos: [] }];

  it('acha os rótulos digitados (sem diferença de maiúsculas, mesmo com marca no meio) e o elemento de cada um', () => {
    expect(mencoesEscritas({ corpo, posTextuais }).map((m) => [m.trecho, m.alvo])).toEqual([
      ['quadro 2', 'tab_et4000000002'],
      ['Quadro 1', 'tab_et4000000001'],
      ['Quadro 9', null],
      ['APÊNDICE A', 'ape_et4000000001'],
    ]);
  });

  it('o rótulo casa sem acento e sem diferença de maiúsculas; seção e equação não entram', () => {
    const alvos = alvosDeRemissiva({ corpo, posTextuais });
    expect(alvoPorRotulo(alvos, ' apendice  a ')?.id).toBe('ape_et4000000001');
    expect(alvoPorRotulo(alvos, 'QUADRO 2')?.id).toBe('tab_et4000000002');
    expect(alvoPorRotulo(alvos, '1')).toBeNull();
  });
});

describe('editor: ligar a menção escrita e escrever sem número', () => {
  const conteudo = { titulo: [t('T')], blocos: [par('par_et4000000001', t('Ver Quadro 1 aqui'))] };
  // Título "T": 0–3; texto do parágrafo a partir de 4: "Ver " 4–8, "Quadro 1" 8–16.
  const estado = (de: number, ate = de): EditorState => {
    const e = criarEstadoSecao(conteudo, { gerarId: (p) => `${p}_et4teste00001` });
    return e.apply(e.tr.setSelection(TextSelection.create(e.doc, de, ate)));
  };

  it('a menção selecionada é o trecho; seleção vazia ou com espaço só não é', () => {
    expect(mencaoEscritaSelecionada(estado(8, 16))).toBe('Quadro 1');
    expect(mencaoEscritaSelecionada(estado(8))).toBeNull();
    expect(mencaoEscritaSelecionada(estado(7, 8))).toBeNull();
  });

  it('ligar troca o trecho pela remissiva; a ida e volta conserva tudo', () => {
    let e = estado(8, 16);
    expect(inserirRemissiva('tab_et4000000002', { substituir: true })(e, (tr) => (e = e.apply(tr)))).toBe(true);
    expect(docParaSecao(e.doc).blocos[0]).toEqual(par('par_et4000000001', t('Ver '), rem('rem_et4teste00001', 'tab_et4000000002'), t(' aqui')));
  });

  it('sem número: guarda o texto; alterar pode voltar ao rótulo ou manter a forma', () => {
    let e = estado(8, 16);
    inserirRemissiva('tab_et4000000001', { substituir: true, texto: 'o quadro a seguir' })(e, (tr) => (e = e.apply(tr)));
    const bloco = docParaSecao(e.doc).blocos[0];
    expect(bloco).toEqual(par('par_et4000000001', t('Ver '), rem('rem_et4teste00001', 'tab_et4000000001', 'o quadro a seguir'), t(' aqui')));
    expect(docParaSecao(secaoParaDoc(docParaSecao(e.doc)))).toEqual(docParaSecao(e.doc));
    alterarRemissiva('rem_et4teste00001', 'tab_et4000000002')(e, (tr) => (e = e.apply(tr)));
    expect(remissivaSelecionada(e)).toEqual({ id: 'rem_et4teste00001', pos: 8, alvo: 'tab_et4000000002', texto: 'o quadro a seguir' });
    alterarRemissiva('rem_et4teste00001', 'tab_et4000000002', null)(e, (tr) => (e = e.apply(tr)));
    expect(remissivaSelecionada(e)).toEqual({ id: 'rem_et4teste00001', pos: 8, alvo: 'tab_et4000000002' });
  });

  it('sem substituir, a remissiva entra no fim da seleção, como antes', () => {
    let e = estado(8, 16);
    inserirRemissiva('tab_et4000000001')(e, (tr) => (e = e.apply(tr)));
    expect(docParaSecao(e.doc).blocos[0]).toEqual(par('par_et4000000001', t('Ver Quadro 1'), rem('rem_et4teste00001', 'tab_et4000000001'), t(' aqui')));
  });
});

describe('aceite da Etapa 4', () => {
  const q1 = quadro('tab_et4000000001', 'Primeiro', 'Fonte do primeiro.');
  const q2 = quadro('tab_et4000000002', 'Segundo', 'Fonte do segundo.');
  const texto = par('par_et4000000001', t('Ver '), rem('rem_et4000000001', q1.id), t(', '), rem('rem_et4000000002', q2.id), t(' e '), rem('rem_et4000000003', q2.id, 'o quadro seguinte'), t('.'));

  it('dois quadros ligados; um terceiro antes deles: 1 e 2 passam a 2 e 3, o texto acompanha e as fontes ficam nos quadros certos', async () => {
    const s = abrir({ corpo: [sec('sec_et4000000001', [texto, q1, q2])] });
    const rotulos = () => s.obterEstado().trabalho!.elementos.filter((e) => e.tipo === 'tabela').map((e) => [e.id, e.rotulo, e.remissivas, e.semNumero]);
    expect(rotulos()).toEqual([
      [q1.id, 'Quadro 1', 1, 0],
      [q2.id, 'Quadro 2', 2, 1],
    ]);
    const q0 = quadro('tab_et4000000000', 'Novo', 'Fonte do novo.');
    s.alterarSecao('sec_et4000000001', { titulo: [t('Seção')], blocos: [q0, texto, q1, q2] });
    expect(rotulos()).toEqual([
      [q0.id, 'Quadro 1', 0, 0],
      [q1.id, 'Quadro 2', 1, 0],
      [q2.id, 'Quadro 3', 2, 1],
    ]);
    const doc = s.pacote!.documento;
    expect(textoDoCorpo(doc)).toEqual(['Ver Quadro 2, Quadro 3 e o quadro seguinte.']);
    const xml = abrirDocx(await exportarDocx(formatar(doc, PERFIL)))['word/document.xml']!;
    const ordem = (x: string) => xml.indexOf(x);
    expect(xml).toContain('Quadro 1 – ');
    expect(xml).toContain('Quadro 3 – ');
    // Cada título vem antes da sua fonte e depois da fonte do anterior: título, legenda e fonte continuam juntos.
    expect(ordem('>Novo<')).toBeLessThan(ordem('Fonte do novo.'));
    expect(ordem('Fonte do novo.')).toBeLessThan(ordem('>Primeiro<'));
    expect(ordem('>Primeiro<')).toBeLessThan(ordem('Fonte do primeiro.'));
    expect(ordem('Fonte do primeiro.')).toBeLessThan(ordem('>Segundo<'));
    expect(ordem('>Segundo<')).toBeLessThan(ordem('Fonte do segundo.'));
    expect(xml).toContain('o quadro seguinte');
  });

  it('a sessão lista as menções sem número e as escritas sem ligação; o bloco vai junto para a prévia', () => {
    const s = abrir({ corpo: [sec('sec_et4000000001', [texto, par('par_et4000000002', t('Como no Quadro 1.')), q1, q2])] });
    const m = s.mencoesDoTexto();
    expect(m.semNumero.map((r) => [r.remissiva.texto, r.remissiva.alvo, r.secao])).toEqual([['o quadro seguinte', q2.id, 'sec_et4000000001']]);
    expect(m.escritas.map((x) => [x.trecho, x.alvo, x.bloco])).toEqual([['Quadro 1', q1.id, 'par_et4000000002']]);
    expect(s.obterEstado().trabalho!.elementos.find((e) => e.id === q1.id)?.bloco).toEqual(q1);
  });

  it('tabela importada de CSV: células e dados conservados, numerada e no DOCX', async () => {
    const lida = lerCsv('Ano;Total\n2023;1.234\n2024;2.345,5\n');
    const conv = converterPlanilha(lida, 'tabela', opcoesSugeridas(lida));
    const rascunho = { ...aplicarPlanilha(rascunhoNovo('tabela'), conv), titulo: { texto: 'Matrículas' }, fonte: { texto: 'Secretaria.' } };
    const tabela: BlocoTabela = { ...dadosDoRascunho(rascunho), id: 'tab_et4importada1' } as BlocoTabela;
    expect(tabela.linhasCabecalho).toBe(1);
    expect(tabela.linhas.map((l) => l.map((c) => c.conteudo.map((i) => i.texto).join('')))).toEqual([
      ['Ano', 'Total'],
      ['2023', '1.234'],
      ['2024', '2.345,5'],
    ]);
    const s = abrir({ corpo: [sec('sec_et4000000001', [par('par_et4000000001', t('Ver '), rem('rem_et4000000001', tabela.id)), tabela])] });
    expect(validarDocumentoV1(s.pacote!.documento).ok).toBe(true);
    expect(textoDoCorpo(s.pacote!.documento)).toEqual(['Ver Tabela 1']);
    const xml = abrirDocx(await exportarDocx(formatar(s.pacote!.documento, PERFIL)))['word/document.xml']!;
    expect(xml).toContain('Tabela 1 – ');
    expect(xml).toContain('Matrículas');
    expect(xml).toContain('2.345,5');
  });

  it('apêndice citado: a remissiva e o elemento pós-textual saem no DOCX', async () => {
    const posTextuais = [{ tipo: 'apendice' as const, id: 'ape_et4000000001', titulo: 'Roteiro de entrevista', blocos: [par('par_et4000000009', t('Perguntas.'))] }];
    const doc = { corpo: [sec('sec_et4000000001', [par('par_et4000000001', t('Ver '), rem('rem_et4000000001', 'ape_et4000000001'), t('.'))])], posTextuais };
    expect(textoDoCorpo(doc)[0]).toBe('Ver APÊNDICE A.');
    const xml = abrirDocx(await exportarDocx(formatar(doc, PERFIL)))['word/document.xml']!;
    expect(xml).toContain('Roteiro de entrevista');
    expect(xml).toContain('Perguntas.');
  });
});
