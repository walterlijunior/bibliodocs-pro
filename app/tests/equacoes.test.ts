// M5-T07 (RN-105 a RN-108; D-M5-05, D-M5-06, D-M5-14) — equações: motor (parágrafo próprio, "(n)" numa tabulação à
// direita na largura útil, numeração contínua entre seções, só das numeradas), conversão do editor (ida e volta exata) e
// comandos (Alt+= liga e desliga, "Numerar", Enter no fim, Backspace no começo). O DOCX é conferido em
// regressao-docx.test.ts (documento difícil). Toda seção produzida pelos comandos passa pelo esquema v1.
import { TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Bloco, BlocoEquacao, Inline, Secao } from '../src/dominio/modelo';
import { formatar, type Perfil } from '../src/dominio/normas';
import type { BlocoFormatado, DocumentoFormatado } from '../src/dominio/normas/formatado';
import { TECLAS_SECAO } from '../src/interface/editor/comandos';
import { alternarEquacao, alternarNumeroEquacao, enterNaEquacao, equacaoNumerada, estaEmEquacao, voltarNoComeco } from '../src/interface/editor/comandos-blocos';
import { blocoParaNo, docParaSecao, noParaBloco, normalizarSecao, secaoParaDoc, type ConteudoSecao } from '../src/interface/editor/conversao';
import { criarEstadoSecao } from '../src/interface/editor/estado';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const eq = (id: string, texto: string, numerada = true): BlocoEquacao => ({ tipo: 'equacao', id, conteudo: [t(texto)], ...(numerada ? { numerada: true as const } : {}) });
const sec = (id: string, blocos: Bloco[], subsecoes: Secao[] = []): Secao => ({ id, titulo: [t('Seção')], blocos, subsecoes });
type Paragrafo = Extract<BlocoFormatado, { tipo: 'paragrafo' }>;
const equacoes = (f: DocumentoFormatado): Paragrafo[] =>
  f.secoes.flatMap((s) => s.blocos).filter((b): b is Paragrafo => b.tipo === 'paragrafo' && (b.estilo === 'equacao' || b.trechos.some((x) => x.tipo === 'texto' && x.texto.startsWith('x'))));
const texto = (b: Paragrafo) => b.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('');
const semRegras = (...ids: string[]): Perfil => ({ ...PERFIL, regras: PERFIL.regras.filter((r) => !ids.includes(r.id)) });

describe('motor (RN-105, RN-106, RN-108)', () => {
  const corpo = [sec('s1', [eq('eqc_a', 'x = 1'), eq('eqc_b', 'x = 2', false)], [sec('s2', [eq('eqc_c', 'x = 3')])]), sec('s3', [eq('eqc_d', 'x = 4')])];

  it('numera só as marcadas, contínuo no documento, com "\\t(n)" e a parada à direita na área útil', () => {
    const f = formatar({ corpo }, PERFIL);
    const e = equacoes(f);
    expect(e.map(texto)).toEqual(['x = 1\t(1)', 'x = 2', 'x = 3\t(2)', 'x = 4\t(3)']);
    expect(e.map((b) => b.tabulacaoDireitaTw)).toEqual([11906 - 1701 - 1134, undefined, 9071, 9071]);
    expect(e[0]!.origem).toEqual(['RN-105', 'RN-106']);
    expect(e[1]!.origem).toEqual(['RN-105']);
    expect(f.avisos).toEqual([]);
  });

  it('estilo: corpo sem recuo de primeira linha, alinhado à esquerda pelo parâmetro da RN-108 (D-M5-05)', () => {
    const s = formatar({ corpo }, PERFIL).estilos.find((x) => x.id === 'equacao')!;
    expect(s.propriedades.alinhamento).toBe('esquerda');
    expect(s.origem.alinhamento).toEqual(['RN-108']);
    expect(s.propriedades.recuoPrimeiraLinhaTw).toBeUndefined();
    expect(s.propriedades.linha).toBe(360); // RN-107: entrelinha automática, que cresce com o expoente
  });

  it('sem a RN-106 sai sem número; sem a RN-105, como parágrafo do corpo', () => {
    expect(equacoes(formatar({ corpo }, semRegras('RN-106'))).map(texto)).toEqual(['x = 1', 'x = 2', 'x = 3', 'x = 4']);
    const sem105 = equacoes(formatar({ corpo }, semRegras('RN-105')));
    expect(sem105.map((b) => b.estilo)).toEqual(['corpo', 'corpo', 'corpo', 'corpo']);
  });

  it('equação vazia gera aviso, sem impedir a exportação', () => {
    const f = formatar({ corpo: [sec('s1', [{ tipo: 'equacao', id: 'eqc_vazia', conteudo: [], numerada: true }])] }, PERFIL);
    expect(f.avisos.map((a) => [a.codigo, a.id])).toEqual([['EQUACAO_VAZIA', 'eqc_vazia']]);
  });
});

describe('editor: conversão', () => {
  it('ida e volta exata, com marcas, quebra de linha e numerada ou não', () => {
    const conteudo: ConteudoSecao = {
      titulo: [t('T')],
      blocos: [
        { tipo: 'equacao', id: 'eqc_conv0001', numerada: true, conteudo: [t('E = mc'), { tipo: 'texto', texto: '2', marcas: ['sobrescrito'] }] },
        { tipo: 'equacao', id: 'eqc_conv0002', conteudo: [{ tipo: 'texto', texto: 'x', marcas: ['italico'] }, t('\n= 1')] },
      ],
    };
    expect(docParaSecao(secaoParaDoc(conteudo))).toEqual(normalizarSecao(conteudo));
    const no = blocoParaNo(conteudo.blocos[1]!);
    expect(no.attrs['numerada']).toBe(false);
    expect(noParaBloco(no)).toEqual(conteudo.blocos[1]);
  });
});

let contador = 0;
const gerarId = (prefixo: string) => `${prefixo}_eqteste${String(++contador).padStart(9, '0')}`;
const executar = (estado: EditorState, comando: Command): EditorState => {
  let saida = estado;
  expect(comando(estado, (tr) => (saida = estado.apply(tr)))).toBe(true);
  return saida;
};
const cursorEm = (estado: EditorState, pos: number): EditorState => estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, pos)));
const blocos = (estado: EditorState): Bloco[] => docParaSecao(estado.doc).blocos;
function valida(estado: EditorState): void {
  const r = validarDocumentoV1({ id: 'prj_abcdefghijklmnop', tipoTrabalho: 'generico', metadados: { titulo: [] }, corpo: [{ id: 'sec_equacoes0001', ...docParaSecao(estado.doc), subsecoes: [] }] });
  expect(r.ok, JSON.stringify(r)).toBe(true);
}

// Título "T" (posições 0–3); o primeiro bloco começa em 3 e o texto dele em 4.
const comParagrafo = (...conteudo: Inline[]): ConteudoSecao => ({
  titulo: [t('T')],
  blocos: [{ tipo: 'paragrafo', id: 'par_eqteste00001', conteudo }],
});

describe('editor: comandos (Alt+=, Numerar, Enter, Backspace)', () => {
  it('Alt+= faz do parágrafo uma equação numerada (D-M5-14), com o mesmo id, e desfaz de volta', () => {
    let e = cursorEm(criarEstadoSecao(comParagrafo(t('x + y = z')), { gerarId }), 5);
    expect(TECLAS_SECAO['Alt-=']).toBe(alternarEquacao);
    e = executar(e, alternarEquacao);
    expect(blocos(e)).toEqual([{ tipo: 'equacao', id: 'par_eqteste00001', numerada: true, conteudo: [t('x + y = z')] }]);
    expect(estaEmEquacao(e)).toBe(true);
    expect(equacaoNumerada(e)).toBe(true);
    valida(e);
    e = executar(e, alternarEquacao);
    expect(blocos(e)).toEqual([{ tipo: 'paragrafo', id: 'par_eqteste00001', conteudo: [t('x + y = z')] }]);
  });

  it('parágrafo com nota não vira equação (equação só tem texto)', () => {
    const e = cursorEm(criarEstadoSecao(comParagrafo(t('a'), { tipo: 'nota', id: 'nta_eqteste00001', conteudo: [t('n')] }), { gerarId }), 4);
    expect(alternarEquacao(e)).toBe(false);
  });

  it('"Numerar" tira e põe o número; fora da equação não se aplica', () => {
    let e = cursorEm(criarEstadoSecao(comParagrafo(t('x')), { gerarId }), 4);
    expect(alternarNumeroEquacao(e)).toBe(false);
    e = executar(e, alternarEquacao);
    e = executar(e, alternarNumeroEquacao);
    expect(blocos(e)).toEqual([{ tipo: 'equacao', id: 'par_eqteste00001', conteudo: [t('x')] }]);
    valida(e);
    e = executar(e, alternarNumeroEquacao);
    expect(equacaoNumerada(e)).toBe(true);
  });

  it('Enter no fim abre parágrafo depois; no meio, não age (o Enter padrão divide)', () => {
    let e = executar(cursorEm(criarEstadoSecao(comParagrafo(t('x = 1')), { gerarId }), 4), alternarEquacao);
    expect(enterNaEquacao(cursorEm(e, 6))).toBe(false);
    e = executar(cursorEm(e, 9), enterNaEquacao);
    const b = blocos(e);
    expect(b.map((x) => x.tipo)).toEqual(['equacao', 'paragrafo']);
    expect(e.selection.$from.parent.type.name).toBe('paragrafo');
    valida(e);
  });

  it('Backspace no começo devolve a equação a parágrafo', () => {
    let e = executar(cursorEm(criarEstadoSecao(comParagrafo(t('x')), { gerarId }), 4), alternarEquacao);
    e = executar(cursorEm(e, 4), voltarNoComeco);
    expect(blocos(e).map((x) => x.tipo)).toEqual(['paragrafo']);
  });
});
