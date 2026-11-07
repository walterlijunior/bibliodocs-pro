// M4-T05 (RF-07, RF-08): lista REFERÊNCIAS e chamadas no motor. A lista sai das obras citadas (RN-078, RN-175),
// ordenada (RN-176), no estilo das referências (RN-034) com uma linha simples entre elas (RN-177, N-M3-10). O perfil
// escolhe a edição da NBR 10520 (C-01) e "et al." ou todos os autores (C-B12).
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 } from '../src/aplicacao/perfil-padrao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Autor, Documento, InlineCitacao, Obra } from '../src/dominio/modelo';
import { formatar, type BlocoFormatado, type DocumentoFormatado, type Perfil } from '../src/dominio/normas';

const t = (texto: string) => [{ tipo: 'texto' as const, texto }];
const p = (sobrenome: string, prenomes: string): Autor => ({ tipo: 'pessoa', sobrenome, prenomes });
const livro = (id: string, autores: Autor[], titulo: string, ano: number): Obra => ({ id, tipo: 'livro', autores, titulo: t(titulo), local: 'Palmas', editora: 'EDUFT', ano });
const citar = (id: string, obra: string, extra: Partial<InlineCitacao> = {}): InlineCitacao => ({ tipo: 'citacao', id, forma: 'parentetica', obras: [{ obra }], ...extra });

const OBRAS = [
  livro('obr_zeta000001', [p('Zeta', 'Ana')], 'Último', 2001),
  livro('obr_lima000001', [p('Lima', 'Ana')], 'Beta', 2020),
  livro('obr_lima000002', [p('Lima', 'Ana')], 'Alfa', 2020),
  livro('obr_naocitada1', [p('Costa', 'Rui')], 'Não citada', 1999),
  livro('obr_muitos0001', [p('Luckesi', 'Cipriano'), p('B', 'B.'), p('C', 'C.'), p('D', 'D.')], 'Fazer universidade', 2003),
];

function documento(campos: Partial<Documento> = {}): Documento {
  return {
    id: 'doc_motorref01',
    tipoTrabalho: 'monografia',
    metadados: { titulo: t('Trabalho') },
    corpo: [
      {
        id: 'sec_motorref01',
        titulo: t('Introdução'),
        subsecoes: [],
        blocos: [
          {
            tipo: 'paragrafo',
            id: 'par_motorref01',
            conteudo: [
              { tipo: 'texto', texto: 'Texto ' },
              citar('cta_motorref01', 'obr_lima000001', { obras: [{ obra: 'obr_lima000001' }, { obra: 'obr_lima000002', pagina: '3' }] }),
              { tipo: 'texto', texto: ' e ' },
              citar('cta_motorref02', 'obr_muitos0001', { forma: 'narrativa' }),
              { tipo: 'texto', texto: ' e ' },
              citar('cta_motorref03', 'obr_naocitada1', { obras: [{ obra: 'obr_zeta000001' }], apud: { obra: 'obr_lima000002' } }),
              { tipo: 'texto', texto: '.' },
            ],
          },
        ],
      },
    ],
    posTextuais: [{ tipo: 'referencias', id: 'pos_motorref01' }],
    obras: OBRAS,
    ...campos,
  };
}

const paragrafos = (f: DocumentoFormatado, estilo: string) =>
  f.secoes.flatMap((s) => s.blocos).filter((b): b is Extract<BlocoFormatado, { tipo: 'paragrafo' }> => b.tipo === 'paragrafo' && b.estilo === estilo);
const texto = (b: Extract<BlocoFormatado, { tipo: 'paragrafo' }>) => b.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('');
const comPerfil = (mudar: Record<string, unknown>): Perfil => {
  const c = structuredClone(PERFIL_UFT_2022) as unknown as { parametros: Record<string, { valor: unknown }> };
  for (const [k, v] of Object.entries(mudar)) c.parametros[k]!.valor = v;
  return c as unknown as Perfil;
};

describe('lista REFERÊNCIAS', () => {
  it('o documento de teste é válido no formato v1', () => {
    expect(validarDocumentoV1(documento()).ok).toBe(true);
  });

  it('só as obras citadas, inclusive a do apud, em ordem alfabética e com os sufixos a, b (RN-078, RN-176, D-M4-03)', () => {
    const f = formatar(documento(), PERFIL_UFT_2022);
    expect(paragrafos(f, 'referencia').map(texto)).toEqual([
      'LIMA, Ana. Alfa. Palmas: EDUFT, 2020a.',
      'LIMA, Ana. Beta. Palmas: EDUFT, 2020b.',
      'LUCKESI, Cipriano et al. Fazer universidade. Palmas: EDUFT, 2003.',
      'ZETA, Ana. Último. Palmas: EDUFT, 2001.',
    ]);
    expect(f.avisos).toEqual([]);
  });

  it('a lista vem logo depois do título REFERÊNCIAS, na seção pós-textual', () => {
    const pos = formatar(documento(), PERFIL_UFT_2022).secoes.find((s) => s.papel === 'posTextual')!.blocos;
    expect(pos.map((b) => (b.tipo === 'paragrafo' ? b.estilo : b.tipo))).toEqual(['tituloPosTextual', 'referencia', 'referencia', 'referencia', 'referencia']);
  });

  it('chamadas e referências usam os mesmos sufixos', () => {
    const f = formatar(documento(), PERFIL_UFT_2022);
    expect(texto(paragrafos(f, 'corpo')[0]!)).toBe('Texto (LIMA, 2020b; LIMA, 2020a, p. 3) e Luckesi et al. (2003) e (ZETA, 2001 apud LIMA, 2020a).');
  });

  it('"et al." sai em itálico no texto e na lista (RN-185, D-M4-08)', () => {
    const f = formatar(documento(), PERFIL_UFT_2022);
    const italicos = (b: Extract<BlocoFormatado, { tipo: 'paragrafo' }>) => b.trechos.filter((x) => x.tipo === 'texto' && x.marcas.includes('italico')).map((x) => (x.tipo === 'texto' ? x.texto : ''));
    expect(italicos(paragrafos(f, 'corpo')[0]!)).toEqual(['et al.']);
    expect(italicos(paragrafos(f, 'referencia')[2]!)).toEqual(['et al.']);
  });

  it('título da obra em negrito na lista (RN-178)', () => {
    const ref = paragrafos(formatar(documento(), PERFIL_UFT_2022), 'referencia')[0]!;
    expect(ref.trechos.find((x) => x.tipo === 'texto' && x.texto === 'Alfa')).toMatchObject({ marcas: ['negrito'] });
  });

  it('com "incluir não citadas", entram todas as obras', () => {
    const f = formatar(documento({ posTextuais: [{ tipo: 'referencias', id: 'pos_motorref01', incluirNaoCitadas: true }] }), PERFIL_UFT_2022);
    expect(paragrafos(f, 'referencia').map(texto)[0]).toBe('COSTA, Rui. Não citada. Palmas: EDUFT, 1999.');
    expect(paragrafos(f, 'referencia')).toHaveLength(5);
  });

  it('estilo das referências: à esquerda, simples e uma linha simples depois (RN-034, RN-177)', () => {
    const e = formatar(documento(), PERFIL_UFT_2022).estilos.find((x) => x.id === 'referencia')!;
    expect(e.propriedades).toMatchObject({ alinhamento: 'esquerda', linha: 240, depoisTw: 240 });
    expect(e.origem.depoisTw).toEqual(['RN-177']);
  });

  it('sem o elemento REFERÊNCIAS, as chamadas saem e o motor avisa (RN-078)', () => {
    const f = formatar(documento({ posTextuais: [] }), PERFIL_UFT_2022);
    expect(paragrafos(f, 'referencia')).toEqual([]);
    expect(f.avisos.map((a) => a.codigo)).toEqual(['REFERENCIAS_AUSENTES']);
  });

  it('com o elemento e nenhuma citação, sai o título e o aviso de lista vazia', () => {
    const doc = documento();
    doc.corpo[0]!.blocos = [{ tipo: 'paragrafo', id: 'par_motorref01', conteudo: t('Sem citação.') }];
    const f = formatar(doc, PERFIL_UFT_2022);
    expect(paragrafos(f, 'tituloPosTextual').map(texto)).toEqual(['REFERÊNCIAS']);
    expect(f.avisos.map((a) => [a.codigo, a.id])).toEqual([['REFERENCIAS_VAZIAS', 'pos_motorref01']]);
  });

  it('o que falta na obra chega como aviso com o id da obra', () => {
    const doc = documento({ obras: OBRAS.map((o) => (o.id === 'obr_zeta000001' ? { ...o, ano: undefined } : o)) as Obra[] });
    const f = formatar(doc, PERFIL_UFT_2022);
    expect(f.avisos.filter((a) => a.codigo === 'REFERENCIA_COM_AVISO').map((a) => a.id)).toEqual(['obr_zeta000001']);
    expect(f.avisos.filter((a) => a.codigo === 'CHAMADA_COM_AVISO').map((a) => a.id)).toEqual(['cta_motorref03']);
  });
});

describe('o perfil escolhe (RNF-13)', () => {
  it('C-01: a opção 2023 põe o sobrenome em caixa mista dentro dos parênteses', () => {
    const f = formatar(documento(), comPerfil({ edicaoNbr10520: '2023' }));
    expect(texto(paragrafos(f, 'corpo')[0]!)).toBe('Texto (Lima, 2020b; Lima, 2020a, p. 3) e Luckesi et al. (2003) e (Zeta, 2001 apud Lima, 2020a).');
  });

  it('C-B12: "todos" lista os quatro autores na referência; a chamada segue com et al. (D-M4-02)', () => {
    const f = formatar(documento(), comPerfil({ autoresReferencia: 'todos' }));
    expect(paragrafos(f, 'referencia').map(texto)[2]).toBe('LUCKESI, Cipriano; B, B.; C, C.; D, D. Fazer universidade. Palmas: EDUFT, 2003.');
    expect(texto(paragrafos(f, 'corpo')[0]!)).toContain('Luckesi et al. (2003)');
  });

  it('sem o parâmetro de espaço, as referências ficam sem espaço depois', () => {
    const c = structuredClone(PERFIL_UFT_2022) as unknown as { parametros: Record<string, unknown> };
    delete c.parametros['espacoEntreReferenciasPt'];
    const e = formatar(documento(), c as unknown as Perfil).estilos.find((x) => x.id === 'referencia')!;
    expect(e.propriedades.depoisTw).toBeUndefined();
  });
});

describe('formato v1: incluirNaoCitadas é aditivo', () => {
  it('aceita true e recusa false ou outro campo', () => {
    const com = (r: object) => validarDocumentoV1(documento({ posTextuais: [{ tipo: 'referencias', id: 'pos_motorref01', ...r } as never] })).ok;
    expect(com({ incluirNaoCitadas: true })).toBe(true);
    expect(com({ incluirNaoCitadas: false })).toBe(false);
    expect(com({ outro: 1 })).toBe(false);
  });
});
