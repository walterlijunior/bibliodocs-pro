// M4-T08: verificador da bibliografia. Aceite da skill citacoes-referencias: documento com 1 órfã (chamada escrita como
// texto, a órfã possível no formato v1) e 1 obra não citada é diagnosticado. Também: REFERÊNCIAS ausente, chamada
// ambígua, grafia divergente (D-M4-10), prenomes não uniformes (RN-182, C-B10) e os avisos dos formatadores.
import { describe, expect, it } from 'vitest';
import { chamadasEscritas, verificarBibliografia } from '../src/dominio/verificador';
import type { Autor, Documento, Inline, InlineCitacao, InlineTexto, Obra } from '../src/dominio/modelo';

const t = (texto: string): InlineTexto => ({ tipo: 'texto', texto });
const pessoa = (sobrenome: string, prenomes?: string): Autor => ({ tipo: 'pessoa', sobrenome, ...(prenomes ? { prenomes } : {}) });
const livro = (id: string, autores: Autor[], ano: number | undefined, titulo = 'Título'): Obra => ({
  id,
  tipo: 'livro',
  autores,
  titulo: [{ tipo: 'texto', texto: titulo }],
  local: 'Palmas',
  editora: 'EDUFT',
  ...(ano === undefined ? {} : { ano }),
});
const cita = (id: string, obra: string, extra: Partial<InlineCitacao> = {}): InlineCitacao => ({ tipo: 'citacao', id, forma: 'parentetica', obras: [{ obra }], ...extra });

function documento(conteudo: Inline[], obras: Obra[], comReferencias = true, incluirNaoCitadas = false): Documento {
  return {
    id: 'prj_verificador01',
    tipoTrabalho: 'generico',
    metadados: { titulo: [] },
    corpo: [{ id: 'sec_verifica0001', titulo: [t('Introdução') as never], blocos: [{ tipo: 'paragrafo', id: 'par_verifica0001', conteudo }], subsecoes: [] }],
    ...(comReferencias ? { posTextuais: [{ tipo: 'referencias', id: 'ele_referencias01', ...(incluirNaoCitadas ? { incluirNaoCitadas: true as const } : {}) }] } : {}),
    obras,
  } as Documento;
}

const lima = livro('obr_lima00000001', [pessoa('Lima', 'Ana')], 2020);
const souza = livro('obr_souza0000001', [pessoa('Souza', 'Bia')], 2019);
const codigos = (d: Documento) => verificarBibliografia(d).map((p) => p.codigo);

describe('aceite: 1 órfã e 1 não citada', () => {
  it('diagnostica a chamada escrita como texto e a obra que não foi citada', () => {
    const d = documento([t('Segundo '), cita('cta_verifica0001', lima.id), t(', e também (COSTA, 2001, p. 4).')], [lima, souza]);
    const r = verificarBibliografia(d);
    expect(r.map((p) => [p.codigo, p.local])).toEqual([
      ['CHAMADA_SEM_LIGACAO', { tipo: 'texto', secao: 'sec_verifica0001', no: 'par_verifica0001', trecho: '(COSTA, 2001, p. 4)' }],
      ['OBRA_NAO_CITADA', { tipo: 'obra', obra: souza.id }],
    ]);
    expect(r.every((p) => p.gravidade === 'aviso')).toBe(true);
    expect(r[1]!.mensagem).toContain('não sai na lista de referências');
  });

  it('sem problemas, a lista vem vazia', () => {
    expect(verificarBibliografia(documento([t('Texto '), cita('cta_verifica0001', lima.id), t('.')], [lima]))).toEqual([]);
  });
});

describe('citações × referências', () => {
  it('citação sem o elemento REFERÊNCIAS é erro e vem primeiro', () => {
    const r = verificarBibliografia(documento([t('A '), cita('cta_verifica0001', lima.id), t(' (COSTA, 2001)')], [lima], false));
    expect(r.map((p) => [p.codigo, p.gravidade])).toEqual([
      ['REFERENCIAS_AUSENTES', 'erro'],
      ['CHAMADA_SEM_LIGACAO', 'aviso'],
    ]);
  });

  it('a citação dentro da nota e a do apud contam como citação', () => {
    const nota: Inline = { tipo: 'nota', id: 'nta_verifica0001', conteudo: [t('Ver '), cita('cta_verifica0002', souza.id)] };
    expect(codigos(documento([cita('cta_verifica0001', lima.id), nota], [lima, souza]))).toEqual([]);
    expect(codigos(documento([cita('cta_verifica0001', lima.id, { apud: { obra: souza.id } })], [lima, souza]))).toEqual([]);
  });

  it('chamada escrita dentro da nota aponta para a nota', () => {
    const nota: Inline = { tipo: 'nota', id: 'nta_verifica0001', conteudo: [t('Conforme Costa (2001).')] };
    const r = verificarBibliografia(documento([cita('cta_verifica0001', lima.id), nota], [lima]));
    expect(r.map((p) => p.local)).toEqual([{ tipo: 'texto', secao: 'sec_verifica0001', no: 'nta_verifica0001', trecho: 'Costa (2001)' }]);
  });

  it('obra não citada com "incluir as não citadas" avisa que sai na lista', () => {
    const r = verificarBibliografia(documento([cita('cta_verifica0001', lima.id)], [lima, souza], true, true));
    expect(r.map((p) => p.codigo)).toEqual(['OBRA_NAO_CITADA']);
    expect(r[0]!.mensagem).toContain('Sai na lista');
  });

  it('chamada ambígua: autores diferentes com mesmo sobrenome e ano', () => {
    const outra = livro('obr_lima00000002', [pessoa('Lima', 'Bruno')], 2020, 'Outro');
    const r = verificarBibliografia(documento([cita('cta_verifica0001', lima.id), cita('cta_verifica0002', outra.id)], [lima, outra]));
    expect(r.map((p) => [p.codigo, p.local])).toEqual([
      ['CHAMADA_AMBIGUA', { tipo: 'obra', obra: lima.id }],
      ['CHAMADA_AMBIGUA', { tipo: 'obra', obra: outra.id }],
    ]);
  });

  it('mesmo autor e ano ganha a, b sozinho: nada a avisar', () => {
    const outra = livro('obr_lima00000002', [pessoa('Lima', 'Ana')], 2020, 'Outro');
    expect(codigos(documento([cita('cta_verifica0001', lima.id), cita('cta_verifica0002', outra.id)], [lima, outra]))).toEqual([]);
  });

  it('avisos dos formatadores: obra sem ano na chamada e na referência', () => {
    const semAno = livro('obr_semano000001', [pessoa('Costa', 'Rui')], undefined);
    const r = verificarBibliografia(documento([cita('cta_verifica0001', semAno.id)], [semAno]));
    expect(r.map((p) => [p.codigo, p.local.tipo])).toEqual([
      ['CHAMADA_COM_AVISO', 'texto'],
      ['REFERENCIA_INCOMPLETA', 'obra'],
    ]);
    expect(r[0]!.mensagem).toMatch(/^\(COSTA\): /u);
  });
});

describe('consistência das obras', () => {
  const citarTodas = (obras: Obra[]) => documento(obras.map((o, i) => cita(`cta_verifica000${i}`, o.id)), obras);

  it('grafia divergente (D-M4-10): acento no sobrenome ou prenomes por extenso diferentes', () => {
    const a = livro('obr_grafia000001', [pessoa('Cagliari', 'Luiz Carlos')], 2003);
    const b = livro('obr_grafia000002', [pessoa('Cagliári', 'Luiz Carlos')], 2004);
    const c = livro('obr_grafia000003', [pessoa('Cagliari', 'Luis Carlos')], 2005);
    const r = verificarBibliografia(citarTodas([a, b, c]));
    expect(r.map((p) => p.codigo)).toEqual(['GRAFIA_DIVERGENTE']);
    expect(r[0]!.mensagem).toContain('Cagliari, Luiz Carlos; Cagliári, Luiz Carlos; Cagliari, Luis Carlos');
  });

  it('só maiúsculas diferentes, ou iniciais diferentes, não é grafia divergente', () => {
    const a = livro('obr_grafia000001', [pessoa('Cagliari', 'Luiz Carlos')], 2003);
    const b = livro('obr_grafia000002', [pessoa('CAGLIARI', 'Luiz Carlos')], 2004);
    const c = livro('obr_grafia000003', [pessoa('Cagliari', 'Maria')], 2005);
    expect(codigos(citarTodas([a, b, c]))).toEqual([]);
  });

  it('prenomes por extenso e abreviados na mesma lista (RN-182): um aviso, sem chamar de grafia divergente', () => {
    const a = livro('obr_grafia000001', [pessoa('Cagliari', 'Luiz Carlos')], 2003);
    const b = livro('obr_grafia000002', [pessoa('Cagliari', 'L. C.')], 2004);
    const c = livro('obr_grafia000003', [pessoa('Passos', 'L. M. M.')], 2005);
    const r = verificarBibliografia(citarTodas([a, b, c]));
    expect(r.map((p) => [p.codigo, p.origem])).toEqual([['PRENOMES_NAO_UNIFORMES', ['RN-182', 'C-B10']]]);
    expect(r[0]!.mensagem).toBe('A lista mistura prenomes por extenso (Cagliari, Luiz Carlos) e abreviados (Cagliari, L. C.; Passos, L. M. M.). Escolha uma forma para todas as referências.');
  });

  it('a obra não citada (fora da lista) não entra na uniformidade dos prenomes', () => {
    const a = livro('obr_grafia000001', [pessoa('Cagliari', 'Luiz Carlos')], 2003);
    const b = livro('obr_grafia000002', [pessoa('Passos', 'L. M. M.')], 2005);
    expect(codigos(documento([cita('cta_verifica0001', a.id)], [a, b]))).toEqual(['OBRA_NAO_CITADA']);
  });
});

describe('chamadas escritas como texto', () => {
  it.each([
    ['(SILVA, 2001)', ['(SILVA, 2001)']],
    ['(SILVA, 2001, p. 27-29)', ['(SILVA, 2001, p. 27-29)']],
    ['(SILVA NETO; SOUZA, [2016?], p. 3)', ['(SILVA NETO; SOUZA, [2016?], p. 3)']],
    ['(Silva, 2001a)', ['(Silva, 2001a)']],
    ['Aranha e Martins (1993) dizem', ['Aranha e Martins (1993)']],
    ['Lima et al. (2010, p. 5)', ['Lima et al. (2010, p. 5)']],
    ['Como Lima, Costa e Souza (2010)', ['Lima, Costa e Souza (2010)']],
    ['Para Silva Neto (2001)', ['Silva Neto (2001)']],
    ['(ANTEPROJETO..., 1987, p. 55)', ['(ANTEPROJETO..., 1987, p. 55)']],
  ])('%s', (texto, esperado) => {
    expect(chamadasEscritas([t(texto)])).toEqual(esperado);
  });

  it.each(['(ver capítulo 2)', '(em 2001)', 'em 2001 (dois mil e um)', '(p. 2001)', 'a fórmula (x, 2001)'])('não confunde: %s', (texto) => {
    expect(chamadasEscritas([t(texto)])).toEqual([]);
  });

  it('não atravessa a chamada ligada nem a nota', () => {
    expect(chamadasEscritas([t('(SILVA'), cita('cta_verifica0001', 'obr_x'), t(', 2001)')])).toEqual([]);
  });
});

describe('revisão de segurança do M4 (R-M4-07)', () => {
  it('lista longa de nomes sem parêntese não custa tempo quadrático', () => {
    const t0 = performance.now();
    chamadasEscritas([t('Aaaa, '.repeat(20_000))]);
    expect(performance.now() - t0).toBeLessThan(800);
  });
});

describe('grafia divergente estreitada (D-M4-10, N-M4-11)', () => {
  const citarTodas2 = (obras: Obra[]) => documento(obras.map((o, i) => cita(`cta_estreita${String(i).padStart(4, '0')}`, o.id)), obras);
  it('mesma inicial com prenomes bem diferentes não é a mesma pessoa', () => {
    const a = livro('obr_estreita00001', [pessoa('Silva', 'Ana')], 2001);
    const b = livro('obr_estreita00002', [pessoa('Silva', 'Antônio')], 2002);
    expect(codigos(citarTodas2([a, b]))).toEqual([]);
  });
  it('acento no prenome é grafia divergente', () => {
    const a = livro('obr_estreita00001', [pessoa('Silva', 'Antônio')], 2001);
    const b = livro('obr_estreita00002', [pessoa('Silva', 'Antonio')], 2002);
    expect(codigos(citarTodas2([a, b]))).toEqual(['GRAFIA_DIVERGENTE']);
  });
});
