// Etapa 6 da especificação de atualização — registro de atividades e cronograma: modelo pronto e adaptável, separado do
// manuscrito, exportação avulsa e incorporação num apêndice (aceite: uma atividade e uma reunião, modelo adaptado,
// exportação separada e o quadro no trabalho só depois de incorporar).
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { criarTrabalhoVazio, documentoDoCronograma, linhaNova, ordenarPorData, quadroDoRegistro, registroPadrao, SessaoTrabalho, type PacoteTransferivel } from '../src/aplicacao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Documento, RegistroAtividades } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { exportarDocx } from '../src/exportacao/docx';
import { abrirDocx } from './apoio/docx-normalizado';

let n = 0;
const gerar = (p: string) => `${p}_et6teste${String(++n).padStart(5, '0')}`;
const t = (texto: string) => ({ tipo: 'texto' as const, texto });

function registroComDuasLinhas(): RegistroAtividades {
  const r = registroPadrao(gerar);
  const atividade = linhaNova(r, gerar('rln'), '2026-11-10', 'Atividade');
  atividade.valores[2] = 'Revisão bibliográfica';
  const reuniao = linhaNova(r, gerar('rln'), '2026-11-03', 'Reunião com o orientador');
  reuniao.valores[2] = 'Definição do sumário';
  return { ...r, linhas: [atividade, reuniao] };
}

function abrir(documento: Partial<Documento>) {
  const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' });
  const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, ...documento }, midias: [] };
  const s = new SessaoTrabalho({
    api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} },
    agora: () => new Date(0),
    agendar: () => () => {},
    gerarIdElemento: () => gerar('ele'),
  });
  s.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
  return s;
}

const xml = async (doc: Documento) => abrirDocx(await exportarDocx(formatar(doc, PERFIL)))['word/document.xml']!;
const corpo = [{ id: 'sec_et6000000001', titulo: [t('Introdução')], blocos: [{ tipo: 'paragrafo' as const, id: 'par_et6000000001', conteudo: [t('Texto do trabalho.')] }], subsecoes: [] }];

describe('modelo e formato', () => {
  it('modelo pronto com Data, Tipo, Atividade e Encaminhamentos; linha nova preenche a data e o tipo', () => {
    const r = registroComDuasLinhas();
    expect(r.colunas.map((c) => [c.titulo, c.tipo])).toEqual([
      ['Data', 'data'],
      ['Tipo', 'natureza'],
      ['Atividade desenvolvida', 'texto'],
      ['Encaminhamentos', 'texto'],
    ]);
    expect(r.linhas[1]!.valores).toEqual(['2026-11-03', 'Reunião com o orientador', 'Definição do sumário', '']);
    expect(ordenarPorData(r).linhas.map((l) => l.valores[0])).toEqual(['2026-11-03', '2026-11-10']);
  });

  it('o formato aceita o registro e recusa data inválida, valores fora das colunas e id repetido', () => {
    const base = { ...criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' }).documento };
    const r = registroComDuasLinhas();
    expect(validarDocumentoV1({ ...base, registro: r }).ok).toBe(true);
    const comLinha = (valores: string[], id = 'rln_et6outra00001') => ({ ...base, registro: { ...r, linhas: [...r.linhas, { id, valores }] } });
    expect(validarDocumentoV1(comLinha(['14/11/2026', '', '', ''])).ok).toBe(false);
    expect(validarDocumentoV1(comLinha(['', ''])).ok).toBe(false);
    expect(validarDocumentoV1(comLinha(['', '', '', ''], r.linhas[0]!.id)).ok).toBe(false);
  });

  it('o quadro tem o cabeçalho das colunas, as datas em dd/mm/aaaa e a fonte', () => {
    const q = quadroDoRegistro(registroComDuasLinhas(), 'tab_et6quadro0001');
    expect(q).toMatchObject({ especie: 'quadro', linhasCabecalho: 1, titulo: [t('Registro de atividades e de orientação')], fonte: [t('Elaborado pelo autor.')] });
    expect(q.linhas.map((l) => l.map((c) => c.conteudo.map((i) => i.texto).join('')))).toEqual([
      ['Data', 'Tipo', 'Atividade desenvolvida', 'Encaminhamentos'],
      ['10/11/2026', 'Atividade', 'Revisão bibliográfica', ''],
      ['03/11/2026', 'Reunião com o orientador', 'Definição do sumário', ''],
    ]);
  });
});

describe('aceite da Etapa 6', () => {
  it('registro e modelo adaptado ficam fora do texto; o cronograma exporta sozinho; incorporar põe o quadro num apêndice; retirar o tira', async () => {
    const s = abrir({ tipoTrabalho: 'monografia', corpo });
    // Registro com uma atividade e uma reunião; o modelo ganha uma coluna "Duração" e perde "Encaminhamentos".
    let r = registroComDuasLinhas();
    r = { ...r, colunas: [...r.colunas.slice(0, 3), { id: gerar('rcl'), titulo: 'Duração', tipo: 'texto' }], linhas: r.linhas.map((l) => ({ ...l, valores: [...l.valores.slice(0, 3), '2 h'] })) };
    expect(s.alterarRegistro(r).ok).toBe(true);
    const doc = () => s.pacote!.documento;
    // Fora do trabalho: o documento exportado não tem o quadro.
    expect(await xml(doc())).not.toContain('Revisão bibliográfica');
    expect(s.obterEstado().trabalho!.registroIncorporado).toBeNull();

    // Exportação avulsa: só o quadro, com as colunas adaptadas.
    const avulso = s.cronogramaParaExportar()!;
    expect(validarDocumentoV1(avulso.documento).ok).toBe(true);
    const x = await xml(avulso.documento);
    for (const texto of ['Duração', '2 h', 'Revisão bibliográfica', 'Reunião com o orientador', '03/11/2026']) expect(x).toContain(texto);
    expect(x).not.toContain('Encaminhamentos');
    expect(x).not.toContain('Texto do trabalho.');

    // Incorporar num apêndice novo: o quadro sai no documento, no APÊNDICE A.
    expect(s.incorporarRegistro({ tipo: 'novoApendice' }).ok).toBe(true);
    expect(s.obterEstado().trabalho!.registroIncorporado).toMatchObject({ rotulo: 'APÊNDICE A – Registro de atividades e de orientação' });
    const comQuadro = await xml(doc());
    expect(comQuadro).toContain('Registro de atividades e de orientação');
    expect(comQuadro).toContain('Revisão bibliográfica');

    // Mudança no registro só chega ao trabalho com "Atualizar no trabalho".
    const mudado = { ...doc().registro!, linhas: doc().registro!.linhas.map((l, i) => (i === 0 ? { ...l, valores: l.valores.map((v, j) => (j === 2 ? 'Escrita do capítulo 2' : v)) } : l)) };
    s.alterarRegistro(mudado);
    expect(await xml(doc())).not.toContain('Escrita do capítulo 2');
    expect(s.atualizarRegistroNoTrabalho().ok).toBe(true);
    expect(await xml(doc())).toContain('Escrita do capítulo 2');

    // Retirar: o apêndice criado para o quadro sai junto; o registro continua.
    expect(s.retirarRegistroDoTrabalho().ok).toBe(true);
    expect(doc().posTextuais ?? []).toEqual([]);
    expect(doc().registro?.linhas).toHaveLength(2);
    expect(await xml(doc())).not.toContain('Escrita do capítulo 2');
  });

  it('incorporar no fim de um apêndice existente mantém o conteúdo dele; retirar deixa o apêndice', () => {
    const posTextuais = [{ tipo: 'apendice' as const, id: 'ape_et6000000001', titulo: 'Roteiro', blocos: [{ tipo: 'paragrafo' as const, id: 'par_et6000000009', conteudo: [t('Perguntas.')] }] }];
    const s = abrir({ tipoTrabalho: 'monografia', corpo, posTextuais, registro: registroComDuasLinhas() });
    expect(s.incorporarRegistro({ tipo: 'apendice', id: 'ape_et6000000001' }).ok).toBe(true);
    const ap = () => s.pacote!.documento.posTextuais!.find((e) => e.id === 'ape_et6000000001');
    expect(ap()).toMatchObject({ blocos: [{ id: 'par_et6000000009' }, { tipo: 'tabela', especie: 'quadro' }] });
    // Ctrl+Z da incorporação devolve os pós-textuais.
    s.retirarRegistroDoTrabalho();
    expect(ap()).toMatchObject({ titulo: 'Roteiro', blocos: [{ id: 'par_et6000000009' }] });
    expect(s.incorporarRegistro({ tipo: 'apendice', id: 'ape_naoexiste0001' }).ok).toBe(false);
  });

  it('no tipo genérico (sem apêndices) a incorporação explica e não muda nada', () => {
    const s = abrir({ corpo, registro: registroComDuasLinhas() });
    const r = s.incorporarRegistro({ tipo: 'novoApendice' });
    expect(r).toMatchObject({ ok: false, mensagem: expect.stringContaining('tipo genérico') });
    expect(s.pacote!.documento.posTextuais).toBeUndefined();
  });

  it('sem registro não há cronograma a exportar', () => {
    const s = abrir({ corpo });
    expect(s.cronogramaParaExportar()).toBeNull();
    expect(documentoDoCronograma(s.pacote!.documento)).toBeNull();
  });
});
