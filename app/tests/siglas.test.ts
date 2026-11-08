import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { criarTrabalhoDoTipo } from '../src/aplicacao/servicos/criar-trabalho';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Documento, Inline, InlineSigla } from '../src/dominio/modelo';
import { idsDoBloco, ocorrenciasDeSiglas } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { conferirSiglas } from '../src/dominio/verificador/siglas';
import { exportarDocx } from '../src/exportacao/docx';
import { empacotarProjeto, lerProjeto } from '../src/persistencia';

const entrada = { id: 'sgl_uft00001', sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' };
const uso = (n: number): InlineSigla => ({ tipo: 'sigla', id: `sgu_uso${String(n).padStart(6, '0')}`, sigla: entrada.id });
function criar(...conteudo: Inline[]) {
  let n = 0;
  const p = criarTrabalhoDoTipo({ id: 'prj_siglas0001', agora: '2026-11-08T10:00:00.000Z', appVersao: '0.1.0', tipo: 'monografia', novoId: (prefixo) => `${prefixo}_sgl${String(++n).padStart(6, '0')}` });
  const documento: Documento = { ...p.documento, preTextuais: [{ tipo: 'listaSiglas', id: 'pre_listasigla1' }], siglas: [entrada], corpo: [{ id: 'sec_siglas0001', titulo: [{ tipo: 'texto', texto: 'Introdução' }], blocos: [{ tipo: 'paragrafo', id: 'par_siglas0001', conteudo }], subsecoes: [] }] };
  return { ...p, documento };
}
const textos = (d: Documento) => formatar(d, PERFIL).secoes.flatMap((s) => s.blocos).flatMap((b) => b.tipo === 'paragrafo' ? [b.trechos.map((t) => t.tipo === 'texto' ? t.texto : t.trechos.map((x) => x.tipo === 'texto' ? x.texto : '').join('')).join('')] : []);

describe('M6-T02: formato de siglas e percurso', () => {
  it('antigo abre sem catálogo; novo preserva cadastro e referências no .bdp', () => {
    const p = criar(uso(1));
    expect(validarDocumentoV1(p.documento).ok).toBe(true);
    const { siglas: _, ...antigo } = criar().documento;
    expect(validarDocumentoV1(antigo).ok).toBe(true);
    const bytes = empacotarProjeto({ ...p, midias: new Map() });
    if (!bytes.ok) throw new Error(JSON.stringify(bytes.erros));
    const r = lerProjeto(bytes.bytes);
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    expect(r.pacote.documento).toEqual(p.documento);
  });
  it('recusa campo desconhecido, catálogo vazio e ids repetidos entre nó/cadastro/outros tipos', () => {
    const d = criar(uso(1)).documento;
    for (const siglas of [[], [{ ...entrada, extra: true }], [{ ...entrada, extenso: '' }], [{ ...entrada, id: 'par_siglas0001' }]]) expect(validarDocumentoV1({ ...d, siglas }).ok).toBe(false);
    expect(validarDocumentoV1(criar(uso(1), uso(1)).documento).ok).toBe(false);
  });
  it('sigla em nota entra nos ids e no percurso de leitura', () => {
    const d = criar({ tipo: 'nota', id: 'nta_siglas0001', conteudo: [uso(1)] }, uso(2)).documento;
    expect(validarDocumentoV1(d).ok).toBe(true);
    expect(ocorrenciasDeSiglas(d).map((o) => [o.inline.id, o.no])).toEqual([['sgu_uso000001', 'nta_siglas0001'], ['sgu_uso000002', 'par_siglas0001']]);
    expect(idsDoBloco(d.corpo[0]!.blocos[0]!)).toEqual(['par_siglas0001', 'nta_siglas0001', 'sgu_uso000001', 'sgu_uso000002']);
  });
});

describe('M6-T02: motor e DOCX', () => {
  // Revisão do M6 (D-M6-11): nota e texto corrido contam à parte; a primeira vez no texto também sai por extenso.
  it('RN-046/047: primeira por extenso e demais curtas; a nota tem a sua primeira ocorrência e o texto, a dele', async () => {
    const d = criar({ tipo: 'nota', id: 'nta_siglas0001', conteudo: [uso(1)] }, { tipo: 'texto', texto: ' ' }, uso(2)).documento;
    const f = formatar(d, PERFIL);
    const corpo = f.secoes.find((s) => s.papel === 'textual')!.blocos.find((b) => b.tipo === 'paragrafo' && b.estilo === 'corpo');
    expect(corpo?.tipo).toBe('paragrafo');
    if (corpo?.tipo !== 'paragrafo') throw new Error('corpo ausente');
    expect(corpo.trechos[0]).toMatchObject({ tipo: 'nota', trechos: [{ tipo: 'texto', texto: `${entrada.extenso} (UFT)` }] });
    expect(corpo.trechos[2]).toMatchObject({ tipo: 'texto', texto: `${entrada.extenso} (UFT)` });
    const z = unzipSync(await exportarDocx(f));
    expect(strFromU8(z['word/footnotes.xml']!)).toContain(`${entrada.extenso} (UFT)`);
    expect(strFromU8(z['word/document.xml']!)).toContain('LISTA DE ABREVIATURAS E SIGLAS');
  });
  it('RN-165/166: só usadas, ordem pt-BR, duas colunas por tabulação', () => {
    const d = criar(uso(1), { tipo: 'sigla', id: 'sgu_uso000003', sigla: 'sgl_abnt0001' }).documento;
    d.siglas!.push({ id: 'sgl_abnt0001', sigla: 'ABNT', extenso: 'Associação Brasileira de Normas Técnicas' }, { id: 'sgl_naousada1', sigla: 'ZZZ', extenso: 'Não usada' });
    expect(textos(d).slice(0, 3)).toEqual(['LISTA DE ABREVIATURAS E SIGLAS', 'ABNT\tAssociação Brasileira de Normas Técnicas', `UFT\t${entrada.extenso}`]);
    expect(textos(d).join('')).not.toContain('ZZZ');
  });
  it('mover ou excluir primeiro uso recalcula a forma por extenso; sem regra, não aplica expansão', () => {
    const d = criar(uso(2)).documento;
    expect(textos(d)).toContain(`${entrada.extenso} (UFT)`);
    const p = { ...PERFIL, regras: PERFIL.regras.filter((r) => r.id !== 'RN-046') };
    const f = formatar(d, p);
    const b = f.secoes.find((s) => s.papel === 'textual')!.blocos.at(-1);
    expect(b?.tipo === 'paragrafo' && b.trechos[0]).toMatchObject({ texto: 'UFT' });
  });
  it('referência quebrada não destrói o arquivo; lista vazia não cria folha', () => {
    const d = criar(uso(1)).documento;
    delete d.siglas;
    expect(validarDocumentoV1(d).ok).toBe(true);
    const f = formatar(d, PERFIL);
    expect(f.avisos).toContainEqual(expect.objectContaining({ codigo: 'SIGLA_QUEBRADA' }));
    expect(textos(d)).toContain('[sigla sem cadastro]');
    expect(textos(d)).not.toContain('LISTA DE ABREVIATURAS E SIGLAS');
  });
});

describe('M6-T03: sugestões conservadoras de siglas', () => {
  it('diagnostica ligada quebrada, maiúsculas sem cadastro e cadastrada sem ligação, sem alterar texto', () => {
    const d = criar({ tipo: 'texto', texto: 'UFT e ONU e ímãs.' }, { tipo: 'sigla', id: 'sgu_uso000003', sigla: 'sgl_naoexiste' }).documento;
    const antes = structuredClone(d);
    expect(conferirSiglas(d).map((p) => p.codigo)).toEqual(['SIGLA_QUEBRADA', 'SIGLA_SEM_LIGACAO', 'SIGLA_SEM_CADASTRO']);
    expect(d).toEqual(antes);
    expect(conferirSiglas(criar(uso(1)).documento)).toEqual([]);
  });
});

describe('RN-047, 2.ª parte (M6-T07): forma por extenso repetida depois da sigla', () => {
  const t = (texto: string): Inline => ({ tipo: 'texto', texto });
  const s = (id: string): Inline => ({ tipo: 'sigla', id, sigla: 'sgl_teste0000001' });
  const doc = (...paragrafos: Inline[][]): Pick<Documento, 'corpo' | 'siglas'> => ({
    siglas: [{ id: 'sgl_teste0000001', sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' }],
    corpo: [{ id: 'sec_teste0000001', titulo: [{ tipo: 'texto', texto: 'S' }], subsecoes: [], blocos: paragrafos.map((conteudo, i) => ({ tipo: 'paragrafo' as const, id: `par_teste000000${i}`, conteudo })) }],
  });
  const repetidas = (d: Pick<Documento, 'corpo' | 'siglas'>) => conferirSiglas(d).filter((p) => p.codigo === 'SIGLA_EXTENSO_REPETIDO');

  it('depois da primeira ocorrência ligada, a forma por extenso de novo gera aviso (sem diferenciar maiúsculas)', () => {
    const r = repetidas(doc([t('A '), s('sgu_teste0000001'), t(' cresce.')], [t('A universidade federal do tocantins tem campi.')]));
    expect(r.map((p) => [p.no, p.rn])).toEqual([['par_teste0000001', ['RN-047']]]);
    expect(r[0]!.mensagem).toBe('“Universidade Federal do Tocantins” já foi apresentado com a sigla UFT; nas ocorrências seguintes, use só a sigla.');
  });

  it('antes da primeira ocorrência ligada não há aviso', () => {
    expect(repetidas(doc([t('A Universidade Federal do Tocantins, antes.')], [s('sgu_teste0000001')]))).toEqual([]);
  });
});

describe('revisão do M6: RN-047 com limite de palavra e custo linear (R-M6-05, R-M6-07)', () => {
  const t = (texto: string): Inline => ({ tipo: 'texto', texto });
  const docCom = (siglas: Documento['siglas'], ...paragrafos: Inline[][]): Pick<Documento, 'corpo' | 'siglas'> => ({
    siglas,
    corpo: [{ id: 'sec_teste0000001', titulo: [{ tipo: 'texto', texto: 'S' }], subsecoes: [], blocos: paragrafos.map((conteudo, i) => ({ tipo: 'paragrafo' as const, id: `par_teste${String(i).padStart(7, '0')}`, conteudo })) }],
  });
  const repetidas = (d: Pick<Documento, 'corpo' | 'siglas'>) => conferirSiglas(d).filter((p) => p.codigo === 'SIGLA_EXTENSO_REPETIDO');

  it('"Unidade" apresentada não acusa "comunidade"; acusa "a unidade."; extenso com caractere especial não quebra a expressão', () => {
    const siglas = [
      { id: 'sgl_teste0000001', sigla: 'UN', extenso: 'Unidade' },
      { id: 'sgl_teste0000002', sigla: 'C++', extenso: 'Linguagem (C++)' },
    ];
    const s1: Inline = { tipo: 'sigla', id: 'sgu_teste0000001', sigla: 'sgl_teste0000001' };
    const s2: Inline = { tipo: 'sigla', id: 'sgu_teste0000002', sigla: 'sgl_teste0000002' };
    expect(repetidas(docCom(siglas, [s1, t(' '), s2], [t('A comunidade local.')]))).toEqual([]);
    expect(repetidas(docCom(siglas, [s1, t(' '), s2], [t('Na unidade. Em Linguagem (C++).')])).map((p) => p.trecho)).toEqual(['Unidade', 'Linguagem (C++)']);
  });

  it('5.000 siglas apresentadas × 4.000 parágrafos: linear (menos de 1,5 s)', () => {
    const siglas = Array.from({ length: 5000 }, (_, i) => ({ id: `sgl_carga${String(i).padStart(7, '0')}`, sigla: `S${i}`, extenso: `Forma extensa número ${i}` }));
    const ligadas: Inline[] = siglas.map((s, i) => ({ tipo: 'sigla', id: `sgu_carga${String(i).padStart(7, '0')}`, sigla: s.id }));
    const texto = Array.from({ length: 4000 }, () => [t('Texto comum de parágrafo sem forma extensa alguma, só para medir o custo.')]);
    const inicio = performance.now();
    conferirSiglas(docCom(siglas, ligadas, ...texto));
    expect(performance.now() - inicio).toBeLessThan(1500);
  });
});

describe('revisão do M6: citação longa e cadastro com tabulação (N-M6-02, R-M6-09)', () => {
  const t = (texto: string): Inline => ({ tipo: 'texto', texto });
  const sg = (id: string): Inline => ({ tipo: 'sigla', id, sigla: 'sgl_teste0000001' });
  const corpo = (blocos: Documento['corpo'][number]['blocos']): Documento['corpo'] => [{ id: 'sec_teste0000001', titulo: [{ tipo: 'texto', texto: 'S' }], subsecoes: [], blocos }];
  const textos = (d: ReturnType<typeof formatar>) => d.secoes.flatMap((s) => s.blocos).flatMap((b) => (b.tipo === 'paragrafo' ? [b.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('')] : []));
  const siglas = [{ id: 'sgl_teste0000001', sigla: 'UFT', extenso: 'Universidade\tFederal\ndo Tocantins' }];

  it('na citação longa a sigla sai como está e não gasta a primeira ocorrência; o texto depois traz a forma por extenso', () => {
    const d = formatar({ corpo: corpo([
      { tipo: 'citacaoLonga', id: 'cit_teste0000001', conteudo: [t('Segundo a '), sg('sgu_teste0000001'), t(', o cerrado.')] },
      { tipo: 'paragrafo', id: 'par_teste0000001', conteudo: [t('A '), sg('sgu_teste0000002'), t(' tem campi.')] },
    ]), siglas }, PERFIL);
    expect(textos(d)).toEqual(expect.arrayContaining(['Segundo a UFT, o cerrado.', 'A Universidade Federal do Tocantins (UFT) tem campi.']));
  });

  it('o verificador não sugere mexer na citação longa', () => {
    const r = conferirSiglas({ siglas, corpo: corpo([{ tipo: 'citacaoLonga', id: 'cit_teste0000001', conteudo: [t('Texto do original com ABNT e UFT.')] }]) });
    expect(r).toEqual([]);
  });
});

describe('revisão do M6: numeral romano (N-M6-13)', () => {
  it('"século XX" e "capítulo II" não viram sigla sem cadastro; "ABNT" vira', () => {
    const d: Pick<Documento, 'corpo' | 'siglas'> = { corpo: [{ id: 'sec_teste0000001', titulo: [{ tipo: 'texto', texto: 'S' }], subsecoes: [], blocos: [{ tipo: 'paragrafo', id: 'par_teste0000001', conteudo: [{ tipo: 'texto', texto: 'No século XX, o capítulo II cita a ABNT.' }] }] }] };
    expect(conferirSiglas(d).map((p) => p.trecho)).toEqual(['ABNT']);
  });
});

describe('sigla em nota de rodapé (D-M6-11, revisão do M6: N-M6-05)', () => {
  it('a sigla que aparece antes numa nota sai por extenso também na primeira vez no texto corrido', () => {
    const t = (texto: string) => ({ tipo: 'texto' as const, texto });
    const sg = (id: string): InlineSigla => ({ tipo: 'sigla', id, sigla: 'sgl_teste0000001' });
    const d = formatar({
      siglas: [{ id: 'sgl_teste0000001', sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' }],
      corpo: [{ id: 'sec_teste0000001', titulo: [{ tipo: 'texto', texto: 'S' }], subsecoes: [], blocos: [
        { tipo: 'paragrafo', id: 'par_teste0000001', conteudo: [t('Antes'), { tipo: 'nota', id: 'nta_teste0000001', conteudo: [t('Ver '), sg('sgu_teste0000001'), t('.')] }, t(' e a '), sg('sgu_teste0000002'), t(', depois a '), sg('sgu_teste0000003'), t('.')] },
      ] }],
    }, PERFIL);
    const p = d.secoes.flatMap((s) => s.blocos).find((b) => b.tipo === 'paragrafo' && b.estilo === 'corpo');
    if (p?.tipo !== 'paragrafo') throw new Error('parágrafo');
    const nota = p.trechos.find((x) => x.tipo === 'nota');
    expect(nota?.tipo === 'nota' && nota.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('')).toBe('Ver Universidade Federal do Tocantins (UFT).');
    expect(p.trechos.map((x) => (x.tipo === 'texto' ? x.texto : '')).join('')).toBe('Antes e a Universidade Federal do Tocantins (UFT), depois a UFT.');
  });
});
