// Testes do M2-T08 (RF-04): campos dos elementos pré-textuais no formato v1, edição pela sessão, desfazer de incluir e
// retirar, e as pendências com a RN de cada uma.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aplicarCampos,
  aplicarDados,
  criarTrabalhoDoTipo,
  limparTexto,
  palavrasChaveDoTexto,
  SessaoTrabalho,
  type PacoteTransferivel,
} from '../src/aplicacao';
import { LIMITES_V1, validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Documento, ElementoPreTextual, Metadados, TipoTrabalhoUft } from '../src/dominio/modelo';
import { pendenciasPreTextuais as pendenciasComPerfil } from '../src/dominio/normas';
import { PERFIL_UFT_2022 } from '../src/aplicacao/perfil-padrao';
import { empacotarProjeto, lerProjeto } from '../src/persistencia';
const pendenciasPreTextuais = (d: Parameters<typeof pendenciasComPerfil>[0]) => pendenciasComPerfil(d, PERFIL_UFT_2022);

function novo(tipo: TipoTrabalhoUft) {
  let n = 0;
  return criarTrabalhoDoTipo({
    id: 'prj_abcdefghijklmnop',
    agora: '2026-11-02T10:00:00.000Z',
    appVersao: '0.1.0',
    tipo,
    novoId: (prefixo) => `${prefixo}_${String(++n).padStart(16, '0')}`,
  });
}

function montar(tipo: TipoTrabalhoUft = 'tese') {
  const t = novo(tipo);
  const pacote: PacoteTransferivel = { ...t, midias: [] };
  let n = 0;
  const sessao = new SessaoTrabalho({
    api: {
      salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }),
      salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }),
      fechar: async () => {},
    },
    agora: () => new Date(Date.UTC(2026, 10, 2)),
    agendar: () => () => {},
    gerarIdElemento: () => `ele_novo${String(++n).padStart(12, '0')}`,
  });
  sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null } as never);
  const pre = () => sessao.obterEstado().trabalho!.preTextuais!;
  const doc = () => sessao.pacote!.documento;
  const valido = () => expect(validarDocumentoV1(JSON.parse(JSON.stringify(doc()))).ok).toBe(true);
  const semTexto = () => false;
  return { sessao, pre, doc, valido, semTexto };
}

const palavras = (n: number) => Array.from({ length: n }, () => 'palavra').join(' ');

/** Documento da tese com tudo o que o Manual exige preenchido. */
function completo(): Documento {
  const d = novo('tese').documento;
  const metadados: Metadados = {
    titulo: [{ tipo: 'texto', texto: 'Título' }],
    autoria: 'A',
    instituicao: 'UFT',
    campus: 'Palmas',
    curso: 'Programa',
    local: 'Palmas, TO',
    ano: '2026',
    natureza: 'Tese apresentada para obtenção do título de Doutor.',
    orientador: { nome: 'O', titulacao: 'Prof. Dr.' },
  };
  const preTextuais = d.preTextuais!.map((e): ElementoPreTextual => {
    switch (e.tipo) {
      case 'fichaCatalografica':
        return { ...e, texto: 'Ficha' };
      case 'folhaAprovacao':
        return { ...e, dataAprovacao: '01/11/2026', banca: [{ nome: 'B', titulacao: 'Dra.', instituicao: 'UFT' }] };
      case 'resumo':
      case 'abstract':
        return { ...e, texto: palavras(200), palavrasChave: ['a', 'b'] };
      default:
        return e;
    }
  });
  return { ...d, metadados, preTextuais };
}

describe('formato v1 com campos', () => {
  it('documento completo passa nos validadores e sai idêntico do .bdp', () => {
    const documento = completo();
    expect(validarDocumentoV1(JSON.parse(JSON.stringify(documento)))).toEqual({ ok: true, valor: documento });
    const t = novo('tese');
    const bytes = empacotarProjeto({ manifesto: t.manifesto, documento, midias: new Map() });
    if (!bytes.ok) throw new Error(JSON.stringify(bytes.erros));
    const lido = lerProjeto(bytes.bytes);
    if (!lido.ok) throw new Error(JSON.stringify(lido.erros));
    expect(JSON.stringify(lido.pacote.documento)).toBe(JSON.stringify(documento));
  });

  it.each<[string, (d: Documento) => void]>([
    ['campo de outro tipo (texto na capa)', (d) => void ((d.preTextuais![0] as Record<string, unknown>).texto = 'x')],
    ['texto vazio (a forma única é ausente)', (d) => void ((d.preTextuais![2] as Record<string, unknown>).texto = '')],
    ['autoria vazia', (d) => void (d.metadados.autoria = '')],
    ['bolsista falso', (d) => void ((d.metadados as unknown as Record<string, unknown>).bolsista = false)],
    ['caractere de controle', (d) => void (d.metadados.autoria = 'a\u0001b')],
    ['palavra-chave vazia', (d) => void ((d.preTextuais!.find((e) => e.tipo === 'resumo') as { palavrasChave: string[] }).palavrasChave = [''])],
    ['idioma desconhecido', (d) => void ((d.preTextuais!.find((e) => e.tipo === 'abstract') as Record<string, unknown>).idioma = 'de')],
    ['banca vazia', (d) => void ((d.preTextuais!.find((e) => e.tipo === 'folhaAprovacao') as { banca: unknown[] }).banca = [])],
  ])('recusa %s', (_caso, estragar) => {
    const d = completo();
    estragar(d);
    expect(validarDocumentoV1(JSON.parse(JSON.stringify(d))).ok).toBe(false);
  });

  it('arquivo do M2-T02, só com o lugar dos elementos, continua válido', () => {
    expect(validarDocumentoV1(JSON.parse(JSON.stringify(novo('tese').documento))).ok).toBe(true);
  });
});

describe('edição pura', () => {
  it('campo vazio sai do objeto; sem mudança devolve o mesmo objeto', () => {
    const m: Metadados = { titulo: [], autoria: 'A' };
    expect(aplicarDados(m, { campo: 'autoria', valor: '' })).toEqual({ titulo: [] });
    expect(aplicarDados(m, { campo: 'autoria', valor: 'A' })).toBe(m);
    expect(aplicarDados(m, { campo: 'bolsista', valor: true })).toEqual({ titulo: [], autoria: 'A', bolsista: true });
    expect(aplicarDados({ titulo: [], bolsista: true }, { campo: 'bolsista', valor: false })).toEqual({ titulo: [] });
    expect(aplicarDados(m, { campo: 'orientador', valor: { nome: '', titulacao: '' } })).toBe(m);
    expect(aplicarDados(m, { campo: 'orientador', valor: { nome: 'O', titulacao: '' } }).orientador).toEqual({ nome: 'O' });
  });

  it('campo que o tipo não tem é ignorado', () => {
    const capa: ElementoPreTextual = { tipo: 'capa', id: 'ele_0000000000000001' };
    expect(aplicarCampos(capa, { texto: 'x' })).toBe(capa);
    const resumo: ElementoPreTextual = { tipo: 'resumo', id: 'ele_0000000000000002', texto: 'x' };
    expect(aplicarCampos(resumo, { dataAprovacao: 'x' })).toBe(resumo);
    expect(aplicarCampos(resumo, { texto: '' })).toEqual({ tipo: 'resumo', id: 'ele_0000000000000002' });
  });

  it('limpa o que tornaria o arquivo inválido: controle, CRLF, limite e par substituto cortado', () => {
    expect(limparTexto('a\u0001b\r\nc\td', 100)).toBe('ab\nc\td');
    expect(limparTexto('a\uD83D', 100)).toBe('a');
    expect(limparTexto('abcd', 2)).toBe('ab');
    expect(limparTexto('a😀', 2)).toBe('a');
    const m = aplicarDados({ titulo: [] }, { campo: 'autoria', valor: 'x'.repeat(LIMITES_V1.campoCurto + 5) });
    expect(m.autoria).toHaveLength(LIMITES_V1.campoCurto);
  });

  it('palavras-chave: ponto e vírgula separa; vazios e ponto final saem', () => {
    expect(palavrasChaveDoTexto(' Pequi; Cerrado. ;; Tocantins ')).toEqual(['Pequi', 'Cerrado', 'Tocantins']);
    expect(palavrasChaveDoTexto('')).toEqual([]);
  });
});

describe('sessão', () => {
  it('campos alterados continuam válidos para gravar; id de elemento desconhecido não faz nada', () => {
    const { sessao, pre, doc, valido } = montar();
    sessao.alterarDados({ campo: 'autoria', valor: 'Ana' });
    sessao.alterarDados({ campo: 'orientador', valor: { nome: 'O' } });
    sessao.alterarSubtitulo('Sub');
    const resumo = pre().lista.find((e) => e.tipo === 'resumo')!;
    sessao.alterarElemento(resumo.id, { texto: 'Texto', palavrasChave: ['a'] });
    expect(doc().metadados).toMatchObject({ autoria: 'Ana', orientador: { nome: 'O' }, subtitulo: [{ tipo: 'texto', texto: 'Sub' }] });
    expect(doc().preTextuais!.find((e) => e.tipo === 'resumo')).toMatchObject({ texto: 'Texto', palavrasChave: ['a'] });
    valido();
    sessao.alterarSubtitulo('');
    expect(doc().metadados.subtitulo).toBeUndefined();
    const antes = doc();
    sessao.alterarElemento('ele_naoexiste00000', { texto: 'x' });
    expect(doc()).toBe(antes);
    expect(sessao.obterEstado().trabalho!.salvamento.tipo).toBe('naoSalvo');
  });

  it('incluir entra na ordem do Quadro 5 e não repete; desfazer e refazer', () => {
    const { sessao, pre, doc, valido, semTexto } = montar();
    expect(pre().ausentes).toContain('errata');
    const id = sessao.incluirElemento('errata');
    expect(id).not.toBeNull();
    expect(doc().preTextuais!.map((e) => e.tipo).slice(0, 5)).toEqual(['capa', 'folhaRosto', 'fichaCatalografica', 'errata', 'folhaAprovacao']);
    expect(pre().ausentes).not.toContain('errata');
    expect(sessao.incluirElemento('errata')).toBeNull();
    valido();
    expect(sessao.desfazer(semTexto)).toMatchObject({ ok: true, secaoId: null });
    expect(doc().preTextuais!.some((e) => e.tipo === 'errata')).toBe(false);
    sessao.refazer(semTexto);
    expect(doc().preTextuais!.find((e) => e.tipo === 'errata')?.id).toBe(id);
  });

  it('retirar leva o texto junto, e Ctrl+Z traz de volta sem desfazer o que foi digitado depois', () => {
    const { sessao, pre, doc, valido, semTexto } = montar();
    const resumo = pre().lista.find((e) => e.tipo === 'resumo')!;
    sessao.alterarElemento(resumo.id, { texto: 'Importante' });
    expect(sessao.retirarElemento(resumo.id)).toBe(true);
    expect(sessao.retirarElemento(resumo.id)).toBe(false);
    expect(pre().ausentes).toContain('resumo');
    sessao.alterarDados({ campo: 'autoria', valor: 'Depois' });
    sessao.desfazer(semTexto);
    expect(doc().preTextuais!.find((e) => e.tipo === 'resumo')).toMatchObject({ texto: 'Importante' });
    expect(doc().metadados.autoria).toBe('Depois');
    valido();
  });

  it('retirar todos deixa a lista ausente (forma única), com a chave no lugar da leitura ao voltar', () => {
    const { sessao, pre, doc, valido, semTexto } = montar();
    for (const e of [...pre().lista]) sessao.retirarElemento(e.id);
    expect('preTextuais' in doc()).toBe(false);
    valido();
    sessao.desfazer(semTexto);
    expect(Object.keys(doc())).toEqual(['id', 'tipoTrabalho', 'metadados', 'preTextuais', 'corpo', 'posTextuais']);
  });

  it('elemento novo não reaproveita id em uso (B2 do M2-T03)', () => {
    const t = novo('tese');
    const usado = t.documento.corpo[0]!.id;
    const ids = [usado, t.documento.preTextuais![0]!.id, 'ele_livre0000000000'];
    const sessao = new SessaoTrabalho({
      api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => {} },
      agora: () => new Date(),
      agendar: () => () => {},
      gerarIdElemento: () => ids.shift()!,
    });
    sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote: { ...t, midias: [] }, avisos: [], atualizacao: null } as never);
    expect(sessao.incluirElemento('errata')).toBe('ele_livre0000000000');
  });

  it('o tipo genérico não tem painel; digitar numa seção não refaz as pendências', () => {
    const { sessao, pre } = montar();
    const antes = pre();
    sessao.alterarTitulo('x');
    expect(pre()).not.toBe(antes);
    const depois = pre();
    const secaoId = sessao.pacote!.documento.corpo[0]!.id;
    sessao.alterarSecao(secaoId, { titulo: [{ tipo: 'texto', texto: 'Outro' }], blocos: [] });
    expect(pre()).toBe(depois);
  });
});

describe('pendências (RF-04)', () => {
  const dePendencia = (d: Pick<Documento, 'tipoTrabalho' | 'metadados' | 'preTextuais'>) => pendenciasPreTextuais(d).filter((p) => p.nivel === 'pendencia');

  it('documento completo não tem pendência nem aviso', () => {
    expect(pendenciasPreTextuais(completo())).toEqual([]);
  });

  it('trabalho novo aponta cada campo exigido, com a RN, na ordem do Quadro 5', () => {
    const lista = dePendencia(novo('monografia').documento);
    expect([...new Set(lista.map((p) => p.elemento))]).toEqual(['capa', 'folhaRosto', 'fichaCatalografica', 'folhaAprovacao', 'resumo', 'abstract']);
    expect(lista.filter((p) => p.elemento === 'capa').every((p) => p.rn === 'RN-117')).toBe(true);
    expect(lista.find((p) => p.elemento === 'resumo')?.rn).toBe('RN-150');
  });

  it.each<[keyof Metadados, string]>([
    ['instituicao', 'Capa: falta a instituição.'],
    ['campus', 'Capa: falta o câmpus.'],
    ['curso', 'Capa: falta o curso ou programa.'],
    ['natureza', 'Folha de rosto: falta a natureza do trabalho.'],
    ['orientador', 'Folha de rosto: falta o nome do(a) orientador(a).'],
  ])('sem %s', (campo, mensagem) => {
    const d = completo();
    delete d.metadados[campo];
    expect(dePendencia(d).map((p) => p.mensagem)).toContain(mensagem);
  });

  it('só espaços conta como vazio', () => {
    const d = completo();
    d.metadados.autoria = '   ';
    expect(dePendencia(d).map((p) => p.mensagem)).toContain('Capa: falta a autoria.');
  });

  it('obrigatório retirado vira pendência; opcional retirado não', () => {
    const d = completo();
    d.preTextuais = d.preTextuais!.filter((e) => e.tipo !== 'sumario');
    expect(dePendencia(d)).toEqual([{ elemento: 'sumario', rn: 'RN-168', nivel: 'pendencia', mensagem: 'Sumário: elemento obrigatório ausente.' }]);
    expect(pendenciasPreTextuais(completo()).some((p) => p.elemento === 'dedicatoria')).toBe(false);
  });

  it('banca: sem membro e membro incompleto (RN-140)', () => {
    const d = completo();
    const aprov = d.preTextuais!.find((e) => e.tipo === 'folhaAprovacao') as { banca?: unknown[] };
    delete aprov.banca;
    expect(dePendencia(d).map((p) => p.mensagem)).toEqual(['Folha de aprovação: falta a banca.']);
    aprov.banca = [{ nome: 'B' }];
    expect(dePendencia(d).map((p) => p.mensagem)).toEqual(['Folha de aprovação: falta a titulação do membro 1 da banca.', 'Folha de aprovação: falta a instituição do membro 1 da banca.']);
  });

  it('bolsista exige os agradecimentos (RN-147), ausentes ou vazios', () => {
    const d = completo();
    expect(dePendencia(d)).toEqual([]);
    d.metadados.bolsista = true;
    expect(dePendencia(d).map((p) => p.rn)).toEqual(['RN-147']);
    d.preTextuais = [...d.preTextuais!, { tipo: 'agradecimentos', id: 'ele_agradecimento1' }];
    expect(dePendencia(d).map((p) => p.mensagem)).toEqual(['Agradecimentos: falta o texto (obrigatório para autor bolsista).']);
  });

  it.each([[149, true], [150, false], [500, false], [501, true]])('resumo com %i palavras: aviso = %s (RN-154, C-B6)', (n, tem) => {
    const d = completo();
    (d.preTextuais!.find((e) => e.tipo === 'resumo') as { texto: string }).texto = palavras(n);
    expect(pendenciasPreTextuais(d).some((p) => p.rn === 'RN-154' && p.nivel === 'aviso')).toBe(tem);
  });

  it.each([[4, false], [5, true]])('%i palavras-chave: aviso = %s (RN-155, C-B7)', (n, tem) => {
    const d = completo();
    (d.preTextuais!.find((e) => e.tipo === 'abstract') as { palavrasChave: string[] }).palavrasChave = Array.from({ length: n }, (_, i) => `p${i}`);
    expect(pendenciasPreTextuais(d).some((p) => p.rn === 'RN-155' && p.nivel === 'aviso')).toBe(tem);
  });

  it('grau incoerente com o tipo (RN-133): tese com mestrado e dissertação com doutorado', () => {
    const tese = completo();
    tese.metadados.natureza = 'Tese para obtenção do grau de Mestre.';
    expect(pendenciasPreTextuais(tese).map((p) => p.rn)).toEqual(['RN-133']);
    const diss = { ...completo(), tipoTrabalho: 'dissertacao' as const };
    diss.metadados.natureza = 'Dissertação para o grau de Doutor.';
    expect(pendenciasPreTextuais(diss).map((p) => p.rn)).toEqual(['RN-133']);
    const certo = { ...completo(), tipoTrabalho: 'dissertacao' as const };
    certo.metadados.natureza = 'Dissertação para o grau de Mestre.';
    expect(pendenciasPreTextuais(certo)).toEqual([]);
  });

  it.each<TipoTrabalhoUft>(['relatorio-tecnico', 'projeto-pesquisa'])('%s: sugestão nunca vira pendência (C-B18)', (tipo) => {
    expect(pendenciasPreTextuais(novo(tipo).documento)).toEqual([]);
    expect(pendenciasPreTextuais({ ...novo(tipo).documento, preTextuais: [] })).toEqual([]);
  });

  it('relatório: o aviso sobre o que o autor escreveu continua valendo', () => {
    const d = novo('relatorio-tecnico').documento;
    d.preTextuais = d.preTextuais!.map((e) => (e.tipo === 'resumo' ? { ...e, texto: palavras(10) } : e));
    expect(pendenciasPreTextuais(d).map((p) => [p.rn, p.nivel])).toEqual([['RN-154', 'aviso']]);
  });

  it('tipo genérico não tem pendência', () => {
    expect(pendenciasPreTextuais({ tipoTrabalho: 'generico', metadados: { titulo: [] } })).toEqual([]);
  });

  it('toda RN citada existe na matriz e está CONFIRMADA ou IMPLEMENTADA', () => {
    const fonte = readFileSync(join(__dirname, '..', 'src', 'dominio', 'normas', 'pendencias-pre-textuais.ts'), 'utf8');
    const matriz = readFileSync(join(__dirname, '..', '..', 'docs', 'MATRIZ_DE_REQUISITOS_NORMATIVOS.md'), 'utf8');
    const citadas = new Set(fonte.match(/'RN-\d{3}'/g)!.map((r) => r.slice(1, -1)));
    expect(citadas.size).toBeGreaterThan(5);
    for (const rn of citadas) expect(matriz.split('\n').find((l) => l.startsWith(`| ${rn} |`)) ?? '', rn).toMatch(/\| (CONFIRMADA|IMPLEMENTADA) \|/);
  });
});
