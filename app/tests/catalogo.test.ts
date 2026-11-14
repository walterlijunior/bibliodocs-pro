// Etapa 3 da especificação de atualização — catálogo acadêmico: dados iniciais da UFT (válidos, com fonte), seletores
// dependentes (o câmpus filtra os cursos: critério de aceite), revisão da escolha, tipos de trabalho do nível, textos
// institucionais, mesclagem com o catálogo do usuário, aplicação ao trabalho (dados do autor intactos) e o canal IPC que
// lê e grava o catálogo do usuário.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aplicarDadosDoCatalogo,
  CANAIS_CATALOGO,
  CATALOGO_INICIAL,
  campiDisponiveis,
  cursosDisponiveis,
  dadosInstitucionais,
  gravarCurso,
  idDoNome,
  idsDoCatalogo,
  idsRetirados,
  mesclarCatalogo,
  retirarRegistro,
  revisarSelecao,
  tiposDeTrabalhoDoNivel,
  type Catalogo,
  type Curso,
  type ResultadoGravarCatalogo,
  type ResultadoLerCatalogo,
} from '../src/aplicacao';
import { validarCatalogo, validarDocumentoV1, type CatalogoValidado } from '../src/dominio/esquemas';
import type { Metadados } from '../src/dominio/modelo';
import { criarManipuladoresCatalogo, MENSAGEM_CATALOGO_ILEGIVEL } from '../src/principal/ipc/manipuladores-catalogo';
import type { InfoRemetente } from '../src/principal/ipc/remetente';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';

// O tipo do domínio e o do esquema batem nos dois sentidos.
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const tiposBatem: Igual<Catalogo, CatalogoValidado> = true;

const UFT = 'uft';
const PALMAS = 'uft-palmas';
const GURUPI = 'uft-gurupi';
const CC = 'uft-palmas-ciencia-da-computacao';

describe('dados iniciais (catalogos/catalogo-inicial.json)', () => {
  it('passam no esquema, com ids únicos, e o tipo do domínio bate com o do esquema', () => {
    expect(tiposBatem).toBe(true);
    const r = validarCatalogo(JSON.parse(readFileSync(join(__dirname, '..', 'catalogos', 'catalogo-inicial.json'), 'utf8')));
    expect(r.ok, r.ok ? '' : r.erro).toBe(true);
  });

  it('UFT com os cinco câmpus atuais e o perfil UFT 2022; cada câmpus e curso com fonte oficial e data', () => {
    const uft = CATALOGO_INICIAL.instituicoes.find((i) => i.id === UFT)!;
    expect(uft.perfis).toEqual(['uft-2022']);
    expect(uft.campi.map((c) => c.nome)).toEqual(['Arraias', 'Gurupi', 'Miracema', 'Palmas', 'Porto Nacional']);
    for (const c of uft.campi) {
      expect(c.fonte?.url).toMatch(/^https:\/\/www\.uft\.edu\.br\//);
      for (const k of c.cursos) expect(k.fonte, k.id).toMatchObject({ url: 'https://www.uft.edu.br/graduacao/cursos', consultadoEm: '2026-11-14' });
    }
    expect(uft.campi.flatMap((c) => c.cursos)).toHaveLength(46);
  });

  it('USP, UnB e UFRGS: só a estrutura, sem perfil nem fonte confirmada', () => {
    for (const id of ['usp', 'unb', 'ufrgs']) {
      const i = CATALOGO_INICIAL.instituicoes.find((x) => x.id === id)!;
      expect(i.campi).toEqual([]);
      expect(i.perfis).toEqual([]);
      expect(i.fonte).toBeUndefined();
    }
  });

  it('o esquema recusa id repetido e campo desconhecido', () => {
    const repetido = structuredClone(CATALOGO_INICIAL);
    repetido.instituicoes[0]!.campi[1]!.id = PALMAS;
    expect(validarCatalogo(repetido)).toMatchObject({ ok: false, erro: expect.stringContaining('id repetido') });
    expect(validarCatalogo({ ...CATALOGO_INICIAL, extra: 1 }).ok).toBe(false);
  });
});

describe('seletores dependentes (aceite da Etapa 3)', () => {
  it('a instituição filtra os câmpus, e o câmpus mostra só os cursos cadastrados para ele', () => {
    expect(campiDisponiveis(CATALOGO_INICIAL, {}).length).toBe(0);
    expect(campiDisponiveis(CATALOGO_INICIAL, { instituicao: UFT }).map((c) => c.id)).toContain(PALMAS);
    const palmas = cursosDisponiveis(CATALOGO_INICIAL, { instituicao: UFT, campus: PALMAS });
    expect(palmas.map((c) => c.nome)).toContain('Ciência da Computação');
    expect(palmas.map((c) => c.nome)).not.toContain('Agronomia');
    expect(palmas.every((c) => c.id.startsWith(`${PALMAS}-`))).toBe(true);
    const gurupi = cursosDisponiveis(CATALOGO_INICIAL, { instituicao: UFT, campus: GURUPI });
    expect(gurupi.map((c) => c.nome)).toContain('Agronomia');
    expect(gurupi.map((c) => c.nome)).not.toContain('Ciência da Computação');
    // Câmpus de outra instituição não vale.
    expect(cursosDisponiveis(CATALOGO_INICIAL, { instituicao: 'usp', campus: PALMAS })).toEqual([]);
  });

  it('trocar o câmpus descarta o curso do câmpus anterior; trocar a instituição descarta tudo abaixo', () => {
    expect(revisarSelecao(CATALOGO_INICIAL, { instituicao: UFT, campus: GURUPI, curso: CC })).toEqual({
      selecao: { instituicao: UFT, campus: GURUPI },
      descartados: ['curso'],
    });
    expect(revisarSelecao(CATALOGO_INICIAL, { instituicao: 'unb', campus: PALMAS, curso: CC, orientador: 'x' })).toEqual({
      selecao: { instituicao: 'unb' },
      descartados: ['campus', 'curso', 'orientador'],
    });
  });

  it('tipos de trabalho do nível do curso; sem curso, todos', () => {
    expect(tiposDeTrabalhoDoNivel('graduacao')).toEqual(['monografia', 'artigo-tcc', 'relatorio-tecnico', 'projeto-pesquisa']);
    expect(tiposDeTrabalhoDoNivel('mestrado')).toContain('dissertacao');
    expect(tiposDeTrabalhoDoNivel('mestrado')).not.toContain('tese');
    expect(tiposDeTrabalhoDoNivel('doutorado')).toContain('tese');
    expect(tiposDeTrabalhoDoNivel(undefined)).toHaveLength(6);
  });
});

/** Catálogo com um docente e o grau no curso de Ciência da Computação, e um programa de mestrado em Palmas. */
function comDocentes(): Catalogo {
  const cc = cursosDisponiveis(CATALOGO_INICIAL, { instituicao: UFT, campus: PALMAS }).find((c) => c.id === CC)!;
  const curso: Curso = { ...cc, grau: 'bacharelado', docentes: [{ id: 'doc-ana', nome: 'Ana Souza', titulacao: 'Dra.', origem: 'usuario' }] };
  const mestrado: Curso = { id: 'uft-palmas-ppg-ciencias', nome: 'Ciências do Ambiente', nivel: 'mestrado', areaConcentracao: 'Meio ambiente', disciplinas: [], docentes: [], origem: 'usuario' };
  return gravarCurso(gravarCurso(CATALOGO_INICIAL, UFT, PALMAS, curso), UFT, PALMAS, mestrado);
}

describe('textos institucionais', () => {
  it('capa e folha de rosto no modelo do Manual (Fig. 3 e 5): câmpus, curso, local, orientador e natureza', () => {
    const d = dadosInstitucionais(comDocentes(), { instituicao: UFT, campus: PALMAS, curso: CC, orientador: 'doc-ana' }, 'monografia');
    expect(d).toEqual({
      instituicao: 'Universidade Federal do Tocantins',
      campus: 'Câmpus Universitário de Palmas',
      local: 'Palmas, TO',
      curso: 'Curso de Graduação em Ciência da Computação',
      orientador: { nome: 'Ana Souza', titulacao: 'Dra.' },
      natureza:
        'Monografia apresentada à Universidade Federal do Tocantins (UFT), Câmpus Universitário de Palmas, Curso de Graduação em Ciência da Computação, para obtenção do título de bacharel em Ciência da Computação.',
    });
  });

  it('programa de pós-graduação: "Programa de Pós-Graduação em", área de concentração e grau de Mestre', () => {
    const d = dadosInstitucionais(comDocentes(), { instituicao: UFT, campus: PALMAS, curso: 'uft-palmas-ppg-ciencias' }, 'dissertacao');
    expect(d.curso).toBe('Programa de Pós-Graduação em Ciências do Ambiente');
    expect(d.areaConcentracao).toBe('Meio ambiente');
    expect(d.natureza).toMatch(/^Dissertação apresentada ao Programa de Pós-Graduação em Ciências do Ambiente .* grau de Mestre em Ciências do Ambiente\.$/);
  });

  it('sem o grau do curso de graduação, a natureza não é proposta (sem lacuna no texto)', () => {
    expect(dadosInstitucionais(CATALOGO_INICIAL, { instituicao: UFT, campus: PALMAS, curso: CC }, 'monografia')).not.toHaveProperty('natureza');
  });
});

describe('mesclagem com o catálogo do usuário', () => {
  it('a correção do usuário vale, o acréscimo dele fica, o oficial novo aparece e o retirado some', () => {
    const usuario = comDocentes();
    const corrigido = { ...usuario, instituicoes: usuario.instituicoes.map((i) => (i.id === UFT ? { ...i, sigla: 'UFT-corrigida', campi: i.campi.filter((c) => c.id !== GURUPI) } : i)) };
    const inicialNovo: Catalogo = { ...CATALOGO_INICIAL, instituicoes: [...CATALOGO_INICIAL.instituicoes, { id: 'ufnt', nome: 'Universidade Federal do Norte do Tocantins', sigla: 'UFNT', perfis: [], campi: [], origem: 'oficial' }] };
    const m = mesclarCatalogo(inicialNovo, corrigido, idsRetirados(CATALOGO_INICIAL, retirarRegistro(CATALOGO_INICIAL, 'usp')));
    const uft = m.instituicoes.find((i) => i.id === UFT)!;
    expect(uft.sigla).toBe('UFT-corrigida');
    expect(cursosDisponiveis(m, { instituicao: UFT, campus: PALMAS }).some((c) => c.id === 'uft-palmas-ppg-ciencias')).toBe(true);
    // Gurupi foi tirado só do catálogo do usuário, não dos retirados: volta pelos dados iniciais.
    expect(uft.campi.some((c) => c.id === GURUPI)).toBe(true);
    expect(m.instituicoes.some((i) => i.id === 'ufnt')).toBe(true);
    expect(m.instituicoes.some((i) => i.id === 'usp')).toBe(false);
    expect(validarCatalogo(m).ok).toBe(true);
  });

  it('id novo pelo nome, sem acento e sem repetir', () => {
    expect(idDoNome('uft-palmas', 'Educação Física', new Set())).toBe('uft-palmas-educacao-fisica');
    expect(idDoNome('uft', 'Palmas', idsDoCatalogo(CATALOGO_INICIAL))).toBe('uft-palmas-2');
  });
});

describe('aplicar ao trabalho', () => {
  const base: Metadados = {
    titulo: [{ tipo: 'texto', texto: 'Meu título' }],
    autoria: 'Maria da Silva',
    ano: '2026',
    natureza: 'Natureza escrita pela autora.',
  };

  it('preenche os dados institucionais, guarda o vínculo e não toca nos dados da autora', () => {
    const sel = { instituicao: UFT, campus: PALMAS, curso: CC, orientador: 'doc-ana' };
    const m = aplicarDadosDoCatalogo(base, dadosInstitucionais(comDocentes(), sel, 'monografia'), sel);
    expect(m).toMatchObject({ autoria: 'Maria da Silva', ano: '2026', titulo: base.titulo, natureza: 'Natureza escrita pela autora.' });
    expect(m).toMatchObject({ instituicao: 'Universidade Federal do Tocantins', campus: 'Câmpus Universitário de Palmas', local: 'Palmas, TO', orientador: { nome: 'Ana Souza' }, vinculo: sel });
    const r = validarDocumentoV1({ id: 'prj_abcdefghijklmnop', tipoTrabalho: 'generico', metadados: m, corpo: [] });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    // Com a natureza vazia, a proposta entra; com `substituirNatureza`, substitui a da autora.
    expect(aplicarDadosDoCatalogo({ ...base, natureza: '' }, dadosInstitucionais(comDocentes(), sel, 'monografia'), sel).natureza).toMatch(/^Monografia apresentada/);
    expect(aplicarDadosDoCatalogo(base, dadosInstitucionais(comDocentes(), sel, 'monografia'), sel, { substituirNatureza: true }).natureza).toMatch(/^Monografia/);
  });

  it('trocar o câmpus tira o curso e o orientador que vinham da escolha anterior', () => {
    const cat = comDocentes();
    const antes = { instituicao: UFT, campus: PALMAS, curso: CC, orientador: 'doc-ana' };
    const m1 = aplicarDadosDoCatalogo(base, dadosInstitucionais(cat, antes, 'monografia'), antes);
    const depois = revisarSelecao(cat, { ...antes, campus: GURUPI }).selecao;
    const m2 = aplicarDadosDoCatalogo(m1, dadosInstitucionais(cat, depois, 'monografia'), depois as { instituicao: string });
    expect(m2).toMatchObject({ campus: 'Câmpus Universitário de Gurupi', local: 'Gurupi, TO', autoria: 'Maria da Silva' });
    expect(m2).not.toHaveProperty('curso');
    expect(m2).not.toHaveProperty('orientador');
  });

  it('digitado à mão (sem vínculo anterior): o que a escolha não tem continua como estava', () => {
    const manual: Metadados = { ...base, curso: 'Curso digitado', orientador: { nome: 'Prof. Fulano' } };
    const sel = { instituicao: UFT, campus: PALMAS };
    const m = aplicarDadosDoCatalogo(manual, dadosInstitucionais(CATALOGO_INICIAL, sel, 'monografia'), sel);
    expect(m).toMatchObject({ curso: 'Curso digitado', orientador: { nome: 'Prof. Fulano' }, campus: 'Câmpus Universitário de Palmas' });
    // Desfazer o vínculo mantém os textos.
    expect(aplicarDadosDoCatalogo(m, {}, null)).toMatchObject({ campus: 'Câmpus Universitário de Palmas', curso: 'Curso digitado' });
    expect(aplicarDadosDoCatalogo(m, {}, null)).not.toHaveProperty('vinculo');
  });
});

describe('canal IPC do catálogo do usuário', () => {
  const JANELA = 7;
  const LEGITIMO: InfoRemetente = { idConteudo: JANELA, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };
  let pasta = '';
  afterEach(() => rmSync(pasta, { recursive: true, force: true }));
  const criar = () => {
    pasta = mkdtempSync(join(tmpdir(), 'bdp-catalogo-'));
    const arquivo = join(pasta, 'catalogo.json');
    const m = criarManipuladoresCatalogo({ origem: ORIGEM_PRODUCAO, conteudosPermitidos: () => new Set([JANELA]), arquivo, log: () => undefined });
    return { arquivo, ler: m[CANAIS_CATALOGO.ler], gravar: m[CANAIS_CATALOGO.gravar] };
  };

  it('sem arquivo, lê nada; grava o catálogo válido e lê de volta igual', async () => {
    const x = criar();
    expect(await x.ler(LEGITIMO, [])).toEqual({ ok: true, usuario: null } satisfies ResultadoLerCatalogo);
    const usuario = { catalogo: comDocentes(), removidos: ['usp'] };
    expect(await x.gravar(LEGITIMO, [usuario])).toEqual({ ok: true } satisfies ResultadoGravarCatalogo);
    expect(await x.ler(LEGITIMO, [])).toEqual({ ok: true, usuario });
  });

  it('recusa catálogo inválido e remetente de fora; arquivo estragado vira aviso e fica intacto', async () => {
    const x = criar();
    await expect(x.gravar(LEGITIMO, [{ catalogo: { formato: 'outro' }, removidos: [] }])).rejects.toThrow();
    await expect(x.ler({ ...LEGITIMO, idConteudo: 99 }, [])).rejects.toThrow();
    writeFileSync(x.arquivo, '{ estragado');
    expect(await x.ler(LEGITIMO, [])).toEqual({ ok: false, mensagem: MENSAGEM_CATALOGO_ILEGIVEL });
    expect(readFileSync(x.arquivo, 'utf8')).toBe('{ estragado');
  });
});
