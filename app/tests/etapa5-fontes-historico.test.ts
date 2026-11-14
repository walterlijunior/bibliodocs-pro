// Etapa 5 da especificação de atualização — fontes de pesquisa, citações e histórico: PDF local e link na obra, ligar
// citação escrita ("Segundo Silva (2007)") à obra certa, lista de referências pelos vínculos e o histórico do trabalho
// (aceite: duas citações da mesma obra e uma de outra obra do mesmo autor; apagar uma, depois a outra; restaurar).
import { EditorState, TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { criarTrabalhoVazio, mudancasDeCitacao, prepararObra, reconhecedorDeChamadas, SessaoTrabalho, validarObra, type PacoteTransferivel } from '../src/aplicacao';
import type { Bloco, Documento, Inline, InlineCitacao, Obra, Secao } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { exportarDocx } from '../src/exportacao/docx';
import { docParaSecao } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';
import { citacaoEscritaSelecionada, inserirCitacao } from '../src/interface/editor/citacoes';
import { caminhoPdfValido, criarManipuladoresFontes, MENSAGEM_PDF_AUSENTE } from '../src/principal/ipc/manipuladores-fontes';
import { CANAIS_FONTES } from '../src/aplicacao';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';
import { abrirDocx } from './apoio/docx-normalizado';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const obra = (id: string, titulo: string, ano: number, sobrenome = 'Silva'): Obra => ({
  id,
  tipo: 'livro',
  autores: [{ tipo: 'pessoa', sobrenome, prenomes: 'João' }],
  titulo: [t(titulo)],
  local: 'Palmas',
  editora: 'EDUFT',
  ano,
});
const cit = (id: string, obraId: string, forma: InlineCitacao['forma'] = 'parentetica'): InlineCitacao => ({ tipo: 'citacao', id, forma, obras: [{ obra: obraId }] });
const par = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
const sec = (id: string, blocos: Bloco[]): Secao => ({ id, titulo: [t('Seção')], blocos, subsecoes: [] });

function abrir(documento: Partial<Documento>, relogio = { ms: Date.UTC(2026, 10, 14, 12) }) {
  const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' });
  const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, ...documento }, midias: [] };
  const sessao = new SessaoTrabalho({
    api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} },
    agora: () => new Date((relogio.ms += 1000)),
    agendar: () => () => {},
  });
  sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
  return sessao;
}

// Os ids dos marcadores seguem um contador global do gerador: fora da comparação.
const docxDe = async (doc: Documento) => abrirDocx(await exportarDocx(formatar(doc, PERFIL)))['word/document.xml']!.replace(/w:id="\d+"/g, 'w:id');

describe('obra: PDF local e link', () => {
  it('o caminho do PDF fica na obra de qualquer tipo, não sai na referência e só aceita .pdf', () => {
    const o = { ...obra('obr_et5000000001', 'Livro', 2007), url: 'https://exemplo.org/livro', arquivoLocal: 'C:\\Pesquisa\\silva-2007.pdf' };
    expect(prepararObra(o).arquivoLocal).toBe('C:\\Pesquisa\\silva-2007.pdf');
    expect(prepararObra({ ...o, tipo: 'artigoPeriodico', periodico: 'Revista' }).arquivoLocal).toBe('C:\\Pesquisa\\silva-2007.pdf');
    expect(validarObra(o).ok).toBe(true);
    expect(validarObra({ ...o, arquivoLocal: 'C:\\Pesquisa\\silva.exe' }).ok).toBe(false);
    expect(validarObra(obra('obr_et5000000002', 'Sem link nem arquivo', 2001)).ok).toBe(true);
  });

  it('a referência não muda com o PDF', async () => {
    const corpo = [sec('sec_et5000000001', [par('par_et5000000001', cit('cit_et5000000001', 'obr_et5000000001'))])];
    const posTextuais = [{ tipo: 'referencias' as const, id: 'pos_et5000000001' }];
    const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' }).documento;
    const sem = await docxDe({ ...base, corpo, posTextuais, obras: [obra('obr_et5000000001', 'Livro', 2007)] });
    const com = await docxDe({ ...base, corpo, posTextuais, obras: [{ ...obra('obr_et5000000001', 'Livro', 2007), arquivoLocal: 'C:\\x\\silva.pdf' }] });
    expect(com).toBe(sem);
    expect(com).not.toContain('silva.pdf');
  });
});

describe('principal: abrir o PDF', () => {
  const r = { idConteudo: 1, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };
  const criar = (existe: boolean, erro = '') => {
    const abertos: string[] = [];
    const m = criarManipuladoresFontes({
      origem: ORIGEM_PRODUCAO,
      conteudosPermitidos: () => new Set([1]),
      escolher: async () => 'C:\\Pesquisa\\a.pdf',
      ehArquivo: async () => existe,
      abrir: async (c) => {
        abertos.push(c);
        return erro;
      },
      log: () => {},
    });
    return { m, abertos };
  };

  it('só caminho absoluto, local, curto e .pdf', () => {
    expect(caminhoPdfValido('C:\\Pesquisa\\a.pdf')).toBe(true);
    expect(caminhoPdfValido('C:\\Pesquisa\\a.PDF')).toBe(true);
    for (const ruim of ['a.pdf', 'C:\\x\\a.exe', '\\\\servidor\\a.pdf', 'C:\\x\\a.pdf\u0000.exe', 42, 'C:\\' + 'x'.repeat(2001) + '.pdf']) expect(caminhoPdfValido(ruim)).toBe(false);
  });

  it('abre o arquivo que existe; o ausente volta com a mensagem; caminho fora do contrato é recusado', async () => {
    const { m, abertos } = criar(true);
    await expect(m[CANAIS_FONTES.abrirPdf](r, ['C:\\Pesquisa\\a.pdf'])).resolves.toEqual({ ok: true });
    expect(abertos).toEqual(['C:\\Pesquisa\\a.pdf']);
    await expect(m[CANAIS_FONTES.abrirPdf](r, ['C:\\Windows\\calc.exe'])).rejects.toThrow();
    const ausente = criar(false);
    await expect(ausente.m[CANAIS_FONTES.abrirPdf](r, ['C:\\Pesquisa\\a.pdf'])).resolves.toEqual({ ok: false, mensagem: MENSAGEM_PDF_AUSENTE });
    expect(ausente.abertos).toEqual([]);
    await expect(m[CANAIS_FONTES.escolherPdf](r, [])).resolves.toEqual({ caminho: 'C:\\Pesquisa\\a.pdf' });
  });
});

describe('editor: ligar a citação escrita', () => {
  const obras = [obra('obr_et5000000001', 'Primeiro', 2007), obra('obr_et5000000002', 'Segundo', 2010), obra('obr_et5000000003', 'Homônimo', 2007, 'Silva')];
  const so2 = [obras[0]!, obras[1]!];
  // "Segundo Silva (2007), e (SILVA, 2010)." — texto do parágrafo a partir de 4 (título "T" ocupa 0–3).
  const conteudo = { titulo: [t('T')], blocos: [par('par_et5000000001', t('Segundo Silva (2007), e (SILVA, 2010).'))] };
  const estado = (de: number, ate: number): EditorState => {
    const e = criarEstadoSecao(conteudo, { gerarId: (p) => `${p}_et5teste00001` });
    return e.apply(e.tr.setSelection(TextSelection.create(e.doc, de, ate)));
  };
  const de = 4 + 'Segundo '.length;
  const ate = de + 'Silva (2007)'.length;

  it('a narrativa selecionada é reconhecida pela obra única que a produz', () => {
    const r = citacaoEscritaSelecionada(estado(de, ate), reconhecedorDeChamadas(so2));
    expect(r).toEqual({ texto: 'Silva (2007)', dados: { forma: 'narrativa', obras: [{ obra: 'obr_et5000000001' }] } });
  });

  it('com duas obras de mesmo autor e ano, não adivinha: o autor escolhe na janela', () => {
    expect(citacaoEscritaSelecionada(estado(de, ate), reconhecedorDeChamadas(obras))).toEqual({ texto: 'Silva (2007)', dados: null });
  });

  it('texto sem cara de chamada não é citação escrita', () => {
    expect(citacaoEscritaSelecionada(estado(4, 4 + 'Segundo'.length), reconhecedorDeChamadas(so2))).toBeNull();
  });

  it('ligar troca o trecho pela chamada ligada', () => {
    let e = estado(de, ate);
    expect(inserirCitacao({ forma: 'narrativa', obras: [{ obra: 'obr_et5000000003' }] }, true)(e, (tr) => (e = e.apply(tr)))).toBe(true);
    expect(docParaSecao(e.doc).blocos[0]).toEqual(par('par_et5000000001', t('Segundo '), { ...cit('cta_et5teste00001', 'obr_et5000000003', 'narrativa') }, t(', e (SILVA, 2010).')));
  });
});

describe('histórico: mudanças de citação', () => {
  it('só os blocos que mudaram contam; as citações das notas também', () => {
    const a = par('par_et5000000001', cit('cit_et5000000001', 'obr_x'));
    const b = par('par_et5000000002', { tipo: 'nota', id: 'nta_et5000000001', conteudo: [cit('cit_et5000000002', 'obr_x')] });
    const b2 = par('par_et5000000002', t('sem nota'));
    const r = mudancasDeCitacao([a, b], [a, b2]);
    expect(r.retiradas.map((c) => c.id)).toEqual(['cit_et5000000002']);
    expect(r.inseridas).toEqual([]);
  });
});

describe('aceite da Etapa 5', () => {
  const a1 = obra('obr_et5000000001', 'Obra A', 2007);
  const a2 = obra('obr_et5000000002', 'Obra B', 2010);
  const p1 = par('par_et5000000001', t('Primeira '), cit('cit_et5000000001', a1.id), t('.'));
  const p2 = par('par_et5000000002', t('Segundo '), cit('cit_et5000000002', a1.id, 'narrativa'), t('.'));
  const p3 = par('par_et5000000003', t('Outra obra '), cit('cit_et5000000003', a2.id), t('.'));
  const posTextuais = [{ tipo: 'referencias' as const, id: 'pos_et5000000001' }];

  it('apagar uma das duas citações mantém a referência; apagar a outra tira só aquela obra; restaurar devolve trecho, vínculo e referência', async () => {
    const s = abrir({ corpo: [sec('sec_et5000000001', [p1, p2, p3])], posTextuais, obras: [a1, a2] });
    const lista = async () => {
      const xml = await docxDe(s.pacote!.documento);
      return ['Obra A', 'Obra B'].filter((x) => xml.includes(x));
    };
    expect(await lista()).toEqual(['Obra A', 'Obra B']);

    s.alterarSecao('sec_et5000000001', { titulo: [t('Seção')], blocos: [p2, p3] });
    expect(await lista()).toEqual(['Obra A', 'Obra B']);
    s.alterarSecao('sec_et5000000001', { titulo: [t('Seção')], blocos: [p3] });
    expect(await lista()).toEqual(['Obra B']);
    // A obra continua no gerenciador de fontes para consulta e reutilização.
    expect(s.obterEstado().trabalho!.obras.map((o) => o.obra.id)).toEqual([a1.id, a2.id]);

    const pontos = s.pontosDoHistorico();
    expect(pontos.map((x) => [x.descricao, x.citacoes, x.referencias])).toEqual([
      ['Antes de retirar a citação de SILVA, 2007', 2, 2],
      ['Trabalho aberto (antes de retirar a citação de SILVA, 2007)', 3, 2],
    ]);
    // O estado de quando o trabalho foi aberto é o de antes da 1.ª exclusão: um ponto só, com as duas descrições.
    expect(s.restaurarPonto(pontos[0]!.id)).toBe(true);
    const blocos = s.secao('sec_et5000000001')!.blocos;
    expect(blocos).toEqual([p2, p3]);
    expect(await lista()).toEqual(['Obra A', 'Obra B']);
    expect(s.obterEstado().trabalho!.salvamento.tipo).toBe('naoSalvo');
    // O estado de antes da restauração ficou no histórico.
    expect(s.pontosDoHistorico()[0]).toMatchObject({ descricao: 'Antes de restaurar um estado anterior', citacoes: 1, referencias: 1 });
  });

  it('restaurar começa uma nova geração (os editores recomeçam) e esvazia o desfazer', () => {
    const s = abrir({ corpo: [sec('sec_et5000000001', [p1, p2, p3])], posTextuais, obras: [a1, a2] });
    const g = s.obterEstado().trabalho!.geracao;
    s.alterarSecao('sec_et5000000001', { titulo: [t('Seção')], blocos: [p3] });
    s.registrarTexto('sec_et5000000001');
    expect(s.podeDesfazer).toBe(true);
    s.restaurarPonto(s.pontosDoHistorico().at(-1)!.id);
    expect(s.obterEstado().trabalho!.geracao).toBe(g + 1);
    expect(s.podeDesfazer).toBe(false);
  });

  it('obra incluída, excluída e seção excluída entram no histórico', () => {
    const s = abrir({ corpo: [sec('sec_et5000000001', [p3]), sec('sec_et5000000002', [])], posTextuais, obras: [a1, a2] });
    expect(s.excluirObra(a1.id).ok).toBe(true);
    expect(s.operarSecao('excluir', 'sec_et5000000002').ok).toBe(true);
    expect(s.pontosDoHistorico().map((x) => x.descricao)).toEqual(['Antes de excluir a seção 2 Seção', 'Trabalho aberto (antes de excluir a obra SILVA, 2007)']);
  });
});
