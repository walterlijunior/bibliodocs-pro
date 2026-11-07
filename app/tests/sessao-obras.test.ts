// M4-T06 (RF-08): cadastro de obras na sessão e funções do serviço. Só a obra que o formato v1 aceita é gravada;
// excluir obra citada é recusado; incluir e excluir entram no desfazer; cada tipo só guarda os seus campos.
import { describe, expect, it } from 'vitest';
import { CAMPOS_DO_TIPO, criarTrabalhoDoTipo, obraVazia, prepararObra, previaDaObra, SessaoTrabalho, validarObra, type PacoteTransferivel } from '../src/aplicacao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import { TIPOS_OBRA, type InlineCitacao, type Obra } from '../src/dominio/modelo';

const t = (texto: string) => [{ tipo: 'texto' as const, texto }];

function montar() {
  let n = 0;
  const trabalho = criarTrabalhoDoTipo({ id: 'prj_abcdefghijklmnop', agora: '2026-11-07T10:00:00.000Z', appVersao: '0.1.0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
  const pacote: PacoteTransferivel = { ...trabalho, midias: [] };
  let k = 0;
  const sessao = new SessaoTrabalho({
    api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => {} },
    agora: () => new Date(Date.UTC(2026, 10, 7)),
    agendar: () => () => {},
    gerarIdObra: () => `obr_nova${String(++k).padStart(12, '0')}`,
  });
  sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null } as never);
  const doc = () => sessao.pacote!.documento;
  const valido = () => expect(validarDocumentoV1(JSON.parse(JSON.stringify(doc()))).ok).toBe(true);
  const obras = () => sessao.obterEstado().trabalho!.obras;
  const semTexto = () => false;
  return { sessao, doc, valido, obras, semTexto };
}

const livro = (titulo: string, sobrenome = 'Lima'): Obra => ({
  id: 'rascunho',
  tipo: 'livro',
  autores: [{ tipo: 'pessoa', sobrenome, prenomes: 'Ana' }],
  titulo: t(titulo),
  local: 'Palmas',
  editora: 'EDUFT',
  ano: 2020,
});

/** Põe uma chamada à obra no primeiro parágrafo do texto (como o editor fará no M4-T07). */
function citar(s: ReturnType<typeof montar>, obra: string) {
  const d = s.doc();
  const secao = d.corpo[0]!;
  const chamada: InlineCitacao = { tipo: 'citacao', id: 'cta_abcdefghijkl', forma: 'parentetica', obras: [{ obra }] };
  s.sessao.alterarSecao(secao.id, { titulo: secao.titulo, blocos: [{ tipo: 'paragrafo', id: 'par_abcdefghijkl', conteudo: [{ tipo: 'texto', texto: 'Texto ' }, chamada] }] });
}

describe('incluir, alterar e excluir obra', () => {
  it('a obra incluída ganha id novo, entra no documento e na lista, com a referência formatada', () => {
    const s = montar();
    const r = s.sessao.incluirObra(livro('Alfa'));
    expect(r).toEqual({ ok: true, id: 'obr_nova000000000001' });
    expect(s.doc().obras).toHaveLength(1);
    expect(s.obras().map((o) => o.referencia)).toEqual(['LIMA, Ana. Alfa. Palmas: EDUFT, 2020.']);
    s.valido();
  });

  it('a lista sai na ordem das referências, e o objeto só muda quando as obras mudam', () => {
    const s = montar();
    s.sessao.incluirObra(livro('Zeta', 'Zuben'));
    s.sessao.incluirObra(livro('Alfa', 'Abreu'));
    const antes = s.obras();
    expect(antes.map((o) => o.obra.autores![0])).toMatchObject([{ sobrenome: 'Abreu' }, { sobrenome: 'Zuben' }]);
    s.sessao.alterarTitulo('Outro título');
    expect(s.obras()).toBe(antes);
  });

  it('obra inválida não é gravada: sem título, data de acesso fora do padrão', () => {
    const s = montar();
    expect(s.sessao.incluirObra({ ...livro('Alfa'), titulo: [] }).ok).toBe(false);
    expect(s.sessao.incluirObra({ ...livro('Alfa'), acesso: '07/11/2026' }).ok).toBe(false);
    expect(s.doc().obras).toBeUndefined();
    const r = s.sessao.incluirObra(livro('Alfa'));
    const id = r.ok ? r.id : '';
    expect(s.sessao.alterarObra({ ...s.doc().obras![0]!, titulo: [{ tipo: 'texto', texto: '   ' }] }).ok).toBe(false);
    expect(s.doc().obras![0]!.titulo).toEqual(t('Alfa'));
    expect(s.sessao.alterarObra({ ...s.doc().obras![0]!, ano: 2021 })).toEqual({ ok: true, id });
    expect(s.doc().obras![0]!.ano).toBe(2021);
    s.valido();
  });

  it('excluir obra não citada entra no desfazer; Ctrl+Z a devolve ao mesmo lugar', () => {
    const s = montar();
    s.sessao.incluirObra(livro('A'));
    const r = s.sessao.incluirObra(livro('B'));
    s.sessao.incluirObra(livro('C'));
    const id = r.ok ? r.id : '';
    expect(s.sessao.excluirObra(id).ok).toBe(true);
    expect(s.doc().obras!.map((o) => o.titulo[0]!.texto)).toEqual(['A', 'C']);
    expect(s.sessao.desfazer(s.semTexto).ok).toBe(true);
    expect(s.doc().obras!.map((o) => o.titulo[0]!.texto)).toEqual(['A', 'B', 'C']);
    expect(s.sessao.refazer(s.semTexto).ok).toBe(true);
    expect(s.doc().obras!.map((o) => o.titulo[0]!.texto)).toEqual(['A', 'C']);
    s.valido();
  });

  it('desfazer a inclusão tira a obra; a lista vazia some do documento', () => {
    const s = montar();
    s.sessao.incluirObra(livro('A'));
    s.sessao.desfazer(s.semTexto);
    expect(s.doc().obras).toBeUndefined();
    expect('obras' in s.doc()).toBe(false);
    s.valido();
  });

  it('obra citada não é excluída, nem pelo desfazer da inclusão (RN-078)', () => {
    const s = montar();
    const r = s.sessao.incluirObra(livro('A'));
    const id = r.ok ? r.id : '';
    citar(s, id);
    expect(s.sessao.citacoesDaObra(id)).toBe(1);
    expect(s.sessao.excluirObra(id)).toEqual({ ok: false, mensagem: 'Esta obra é citada uma vez no texto. Retire as citações antes de excluí-la.' });
    // O desfazer da inclusão (depois do texto) é pulado: a obra fica.
    s.sessao.desfazer(() => false);
    expect(s.doc().obras).toHaveLength(1);
    s.valido();
  });

  it('id novo nunca repete o de uma citação, seção ou elemento', () => {
    const s = montar();
    const secao = s.doc().corpo[0]!.id;
    let i = 0;
    const ids = [secao, 'obr_livre0000000001'];
    const sessao = new SessaoTrabalho({
      api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => {} },
      agora: () => new Date(),
      agendar: () => () => {},
      gerarIdObra: () => ids[i++]!,
    });
    sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote: s.sessao.pacote!, avisos: [], atualizacao: null } as never);
    expect(sessao.incluirObra(livro('A'))).toEqual({ ok: true, id: 'obr_livre0000000001' });
  });

  it('em só leitura nada muda', () => {
    const s = montar();
    const pacote = s.sessao.pacote!;
    s.sessao.abrirSomenteLeitura('T.bdp', { ...pacote } as never);
    expect(s.sessao.incluirObra(livro('A')).ok).toBe(false);
  });
});

describe('conferência da bibliografia (M4-T08)', () => {
  it('a sessão confere o trabalho aberto: obra não citada, depois citada', () => {
    const s = montar();
    const r = s.sessao.incluirObra(livro('A'));
    const id = r.ok ? r.id : '';
    expect(s.sessao.verificarBibliografia().map((x) => [x.codigo, x.local])).toEqual([['OBRA_NAO_CITADA', { tipo: 'obra', obra: id }]]);
    citar(s, id);
    expect(s.sessao.verificarBibliografia().map((x) => x.codigo)).not.toContain('OBRA_NAO_CITADA');
  });
});

describe('preparar e validar (forma única)', () => {
  it('cada tipo tem campos e todos começam por autoria ou entrada', () => {
    expect(Object.keys(CAMPOS_DO_TIPO).sort()).toEqual([...TIPOS_OBRA].sort());
    for (const tipo of TIPOS_OBRA) expect(CAMPOS_DO_TIPO[tipo]).toContain('titulo');
  });

  it('tira os campos de outro tipo, apara, e deixa ausente o que ficou vazio', () => {
    const o = prepararObra({
      id: 'obr_abcdefghij01',
      tipo: 'livro',
      autores: [{ tipo: 'pessoa', sobrenome: ' Lima ', prenomes: '' }, { tipo: 'pessoa', sobrenome: '', prenomes: '' }, { tipo: 'entidade', nome: '  ' }],
      titulo: [{ tipo: 'texto', texto: '  Alfa ' }],
      subtitulo: [{ tipo: 'texto', texto: '' }],
      periodico: 'Revista',
      local: '  ',
      ano: 2020,
      anoIncerto: 'provavel',
      edicao: 0,
      ebook: true,
    });
    expect(o).toEqual({ id: 'obr_abcdefghij01', tipo: 'livro', autores: [{ tipo: 'pessoa', sobrenome: 'Lima' }], titulo: t('Alfa'), ano: 2020, anoIncerto: 'provavel', ebook: true });
  });

  it('ano incerto sem ano sai; função sem autor sai; obra no todo vazia sai', () => {
    const o = prepararObra({ id: 'obr_abcdefghij01', tipo: 'capitulo', titulo: t('Cap'), anoIncerto: 'provavel', noTodo: { titulo: [] } });
    expect(o).toEqual({ id: 'obr_abcdefghij01', tipo: 'capitulo', titulo: t('Cap') });
  });

  it('a obra validada vem com as chaves na ordem do esquema', () => {
    const r = validarObra({ id: 'obr_abcdefghij01', ano: 2000, titulo: t('A'), tipo: 'livro' } as Obra);
    expect(r.ok && Object.keys(r.obra)).toEqual(['id', 'tipo', 'titulo', 'ano']);
  });

  it('prévia: referência formatada, avisos e o que impede gravar', () => {
    const sem = previaDaObra(obraVazia('obr_abcdefghij01', 'artigoPeriodico'));
    expect(sem.erros.map((e) => e.caminho)).toEqual(['obra.titulo']);
    const p = previaDaObra({ id: 'obr_abcdefghij01', tipo: 'artigoPeriodico', titulo: t('Muito por fazer'), ano: 2000 });
    expect(p.erros).toEqual([]);
    expect(p.trechos.map((x) => x.texto).join('')).toBe('MUITO por fazer. 2000.');
    expect(p.avisos.map((a) => a.codigo)).toEqual(['ELEMENTO_AUSENTE']);
  });
});
