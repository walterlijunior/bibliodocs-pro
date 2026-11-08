// M3-T04: seções, paginação, pré e pós-textuais no motor (RN-067, RN-068, RN-073, RN-117 a RN-158, RN-231 a RN-237).
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { criarTrabalhoDoTipo } from '../src/aplicacao/servicos/criar-trabalho';
import { formatar, type BlocoFormatado, type DocumentoFormatado, type DocumentoParaFormatar, type SecaoFormatada } from '../src/dominio/normas';
import type { ElementoPosTextual, ElementoPreTextual, Metadados, TipoTrabalhoUft } from '../src/dominio/modelo';

const M: Metadados = {
  titulo: [{ tipo: 'texto', texto: 'Título' }],
  subtitulo: [{ tipo: 'texto', texto: 'subtítulo' }],
  autoria: 'Ana Souza',
  instituicao: 'Universidade Federal do Tocantins',
  campus: 'Câmpus de Palmas',
  curso: 'Curso de Letras',
  local: 'Palmas, TO',
  ano: '2026',
  natureza: 'Monografia apresentada.',
  areaConcentracao: 'Linguística',
  orientador: { titulacao: 'Dra.', nome: 'Bia Lima' },
};
const pre = (...e: object[]) => e.map((x, i) => ({ id: `pre_${i}`, ...x })) as ElementoPreTextual[];
const pos = (...e: object[]) => e.map((x, i) => ({ id: `pos_${i}`, ...x })) as ElementoPosTextual[];
const fmt = (d: Partial<DocumentoParaFormatar>): DocumentoFormatado => formatar({ corpo: [], metadados: M, ...d }, PERFIL);
const texto = (b: BlocoFormatado): string =>
  b.tipo === 'paragrafo' || b.tipo === 'quadro' ? b.trechos.map((t) => (t.tipo === 'texto' ? t.texto : '')).join('') : '';
const secao = (d: DocumentoFormatado, papel: SecaoFormatada['papel']) => {
  const s = d.secoes.find((x) => x.papel === papel);
  if (!s) throw new Error(papel);
  return s;
};
const paragrafos = (s: SecaoFormatada) => s.blocos.filter((b): b is Extract<BlocoFormatado, { tipo: 'paragrafo' }> => b.tipo === 'paragrafo');

describe('página e notas', () => {
  const d = fmt({});
  it('A4 e margens em twips (DOC-01, DOC-02)', () => {
    expect(d.pagina).toMatchObject({ larguraTw: 11906, alturaTw: 16838, margemSuperiorTw: 1701, margemEsquerdaTw: 1701, margemInferiorTw: 1134, margemDireitaTw: 1134 });
    expect(d.pagina.origem).toEqual(expect.arrayContaining(['RN-002', 'RN-018', 'RN-072']));
  });
  it('cabeçalho a 1,25 cm e filete de 5 cm, com RN (D-M3-05, D-M3-08)', () => {
    expect(d.pagina.cabecalhoTw).toBe(709);
    expect(d.notas).toEqual({ numeracao: 'continua', fileteTw: 2835, origem: ['RN-102', 'RN-104'] });
  });
});

describe('seções e paginação', () => {
  const d = fmt({
    preTextuais: pre({ tipo: 'capa' }, { tipo: 'folhaRosto' }, { tipo: 'fichaCatalografica', texto: 'x' }, { tipo: 'resumo', texto: 'r' }),
    posTextuais: pos({ tipo: 'referencias' }),
  });
  it('capa, folha de rosto, ficha, pré, textual e pós, nessa ordem', () => {
    expect(d.secoes.map((s) => s.papel)).toEqual(['capa', 'folhaRosto', 'ficha', 'preTextual', 'textual', 'posTextual']);
  });
  it('a capa não conta; a contagem começa na folha de rosto e não recomeça mais (RN-067, RN-073)', () => {
    expect(d.secoes.map((s) => s.reiniciarEm)).toEqual([undefined, 1, undefined, undefined, undefined, undefined]);
  });
  it('o número só aparece do texto em diante (RN-068)', () => {
    expect(d.secoes.map((s) => s.exibirNumero)).toEqual([false, false, false, false, true, true]);
  });
  it('sem capa, a primeira seção é a que começa em 1; trabalho sem pré-textuais só tem o texto', () => {
    expect(fmt({ preTextuais: pre({ tipo: 'folhaRosto' }) }).secoes[0]).toMatchObject({ papel: 'folhaRosto', reiniciarEm: 1 });
    expect(fmt({}).secoes).toEqual([expect.objectContaining({ papel: 'textual', reiniciarEm: 1, exibirNumero: true })]);
  });
  it('a primeira quebra da seção sai, para não sobrar folha em branco; as outras ficam', () => {
    const s = secao(fmt({ preTextuais: pre({ tipo: 'errata', texto: 'e' }, { tipo: 'resumo', texto: 'r' }) }), 'preTextual');
    const titulos = paragrafos(s).filter((b) => b.estilo === 'tituloSemIndicativo');
    expect(titulos[0]).not.toHaveProperty('novaPagina');
    expect(titulos[1]!.novaPagina).toBe(true);
  });
});

describe('capa (RN-117 a RN-125)', () => {
  const s = secao(fmt({ preTextuais: pre({ tipo: 'capa' }) }), 'capa');
  it('ordem e grupos da Figura 3, distribuídos na altura', () => {
    expect(s.alinhamentoVertical).toBe('distribuido');
    expect(paragrafos(s).map((b) => [b.estilo, texto(b)])).toEqual([
      ['capaInstituicao', 'Universidade Federal do Tocantins\nCâmpus de Palmas\nCurso de Letras'],
      ['capaAutoria', 'Ana Souza'],
      ['capaTitulo', 'Título\nsubtítulo'],
      ['capaLocalAno', 'Palmas, TO\n2026'],
    ]);
  });
  it('avisa da falta do brasão (RN-118), e campo vazio não gera parágrafo', () => {
    const d = formatar({ corpo: [], metadados: { titulo: [] }, preTextuais: pre({ tipo: 'capa' }) }, PERFIL);
    expect(d.avisos.map((a) => a.codigo)).toContain('BRASAO_AUSENTE');
    expect(secao(d, 'capa').blocos).toEqual([]);
  });
  it('forma pelos estilos: maiúsculas e negrito; local e ano em caixa mista e negrito (C-B2)', () => {
    const e = (id: string) => fmt({}).estilos.find((x) => x.id === id)!.propriedades;
    expect(e('capaTitulo')).toMatchObject({ maiusculas: true, negrito: true, alinhamento: 'centralizado', corpoMeioPt: 24, linha: 360 });
    expect(e('capaLocalAno')).toMatchObject({ negrito: true, alinhamento: 'centralizado' });
    expect(e('capaLocalAno').maiusculas).toBeUndefined();
  });
  it('volume entra depois do título, se houver', () => {
    const c = secao(formatar({ corpo: [], metadados: { ...M, volume: 'Volume 2' }, preTextuais: pre({ tipo: 'capa' }) }, PERFIL), 'capa');
    expect(texto(paragrafos(c)[2]!)).toBe('Título\nsubtítulo\nVolume 2');
  });
});

describe('folha de rosto e ficha', () => {
  it('ordem do Manual; natureza recuada; orientador como "Titulação/Nome" (RN-127, RN-131, RN-132)', () => {
    const s = secao(fmt({ preTextuais: pre({ tipo: 'folhaRosto' }) }), 'folhaRosto');
    expect(paragrafos(s).map((b) => [b.estilo, texto(b)])).toEqual([
      ['rostoAutoria', 'Ana Souza'],
      ['rostoTitulo', 'Título\nsubtítulo'],
      ['naturezaTrabalho', 'Monografia apresentada.\nÁrea de concentração: Linguística\nOrientador (a): Dra./Bia Lima'],
      ['rostoLocalAno', 'Palmas, TO\n2026'],
    ]);
  });
  it('ficha: página própria, no pé, deitada: 12,5 cm de largura × 7,5 cm de altura (RN-071, RN-135, RN-136; Manual, Fig. 6, p. 35)', () => {
    const s = secao(fmt({ preTextuais: pre({ tipo: 'fichaCatalografica', texto: 'Dados' }) }), 'ficha');
    expect(s.alinhamentoVertical).toBe('inferior');
    expect(s.blocos[0]).toMatchObject({ tipo: 'quadro', larguraTw: 7088, alturaTw: 4253 });
    expect(texto(s.blocos[0]!)).toBe('Dados');
  });
  it('ficha vazia reserva a página e avisa', () => {
    const d = fmt({ preTextuais: pre({ tipo: 'fichaCatalografica' }) });
    expect(secao(d, 'ficha').blocos).toHaveLength(1);
    expect(d.avisos.map((a) => a.codigo)).toContain('FICHA_VAZIA');
  });
});

describe('demais pré-textuais', () => {
  const blocos = (...e: object[]) => paragrafos(secao(fmt({ preTextuais: pre(...e) }), 'preTextual'));
  it('folha de aprovação: identificação, natureza, data, banca (RN-140 a RN-144)', () => {
    const b = blocos({ tipo: 'folhaAprovacao', dataAprovacao: '10/12/2026', banca: [{ titulacao: 'Dra.', nome: 'Bia', instituicao: 'UFT' }, {}] });
    expect(b.map((x) => x.estilo)).toEqual([
      'aprovacaoIdentificacao', 'aprovacaoIdentificacao', 'aprovacaoNatureza', 'aprovacaoNatureza', 'aprovacaoData', 'aprovacaoData', 'aprovacaoBanca', 'aprovacaoBanca',
    ]);
    expect(texto(b[4]!)).toBe('Data de aprovação: 10/12/2026');
    expect(texto(b.at(-1)!)).toBe('Dra. Bia, UFT');
  });
  it('sem data, deixa o espaço para preencher, como a Figura 7', () => {
    expect(blocos({ tipo: 'folhaAprovacao' }).map(texto)).toContain('Data de aprovação: ____/____/_____');
  });
  it('dedicatória sem título, abaixo do meio da folha (RN-145, RN-146)', () => {
    const b = blocos({ tipo: 'dedicatoria', texto: 'A você' });
    expect(b[0]).toMatchObject({ estilo: 'dedicatoria', antesTw: Math.round((16838 - 1701 - 1134) / 2) });
    expect(b).toHaveLength(1);
  });
  it('dedicatória vazia não gera nada', () => {
    expect(fmt({ preTextuais: pre({ tipo: 'dedicatoria' }) }).secoes.map((s) => s.papel)).toEqual(['textual']);
  });
  it('agradecimentos com título; cada linha, um parágrafo (RN-148)', () => {
    expect(blocos({ tipo: 'agradecimentos', texto: 'um\n\ndois' }).map((x) => [x.estilo, texto(x)])).toEqual([
      ['tituloSemIndicativo', 'AGRADECIMENTOS'],
      ['agradecimentos', 'um'],
      ['agradecimentos', 'dois'],
    ]);
  });
  it('folha de aprovação e epígrafe começam em página nova quando não são o primeiro elemento', () => {
    const b = blocos({ tipo: 'errata', texto: 'e' }, { tipo: 'folhaAprovacao' }, { tipo: 'epigrafe', texto: 'x' });
    expect(b.filter((x) => x.novaPagina).map((x) => x.estilo)).toEqual(['aprovacaoIdentificacao', 'corpo']);
  });
  it('epígrafe sai como corpo, com aviso de forma sem fonte (RN-037)', () => {
    const d = fmt({ preTextuais: pre({ tipo: 'epigrafe', texto: 'e' }) });
    expect(paragrafos(secao(d, 'preTextual'))[0]).toMatchObject({ estilo: 'corpo' });
    expect(d.avisos.map((a) => a.codigo)).toEqual(['FORMA_SEM_FONTE']);
  });
  it('resumo: título, texto simples, palavras-chave separadas e finalizadas por ponto (RN-151, RN-153, RN-156)', () => {
    const b = blocos({ tipo: 'resumo', texto: 'Texto', palavrasChave: ['Um.', ' Dois '] });
    expect(b.map(texto)).toEqual(['RESUMO', 'Texto', 'Palavras-chave: Um. Dois.']);
    expect(fmt({}).estilos.find((e) => e.id === 'resumo')!.propriedades).toMatchObject({ linha: 240, corpoMeioPt: 24, alinhamento: 'justificado' });
  });
  it.each([
    [undefined, 'ABSTRACT', 'Keywords: A.'],
    ['es', 'RESUMEN', 'Palabras clave: A.'],
    ['fr', 'RÉSUMÉ', 'Mots-clés: A.'],
  ])('resumo estrangeiro em %s (RN-157, RN-158)', (idioma, titulo, pc) => {
    expect(blocos({ tipo: 'abstract', ...(idioma ? { idioma } : {}), palavrasChave: ['A'] }).map(texto)).toEqual([titulo, pc]);
  });
  it('sumário com indicativo e título de cada seção, até a quinária (RN-169, RN-170, RN-171)', () => {
    let sec = { id: 'n6', titulo: [{ tipo: 'texto' as const, texto: 'Seis' }], blocos: [], subsecoes: [] as never[] };
    for (let i = 5; i >= 1; i--) sec = { id: `n${i}`, titulo: [{ tipo: 'texto', texto: `N${i}` }], blocos: [], subsecoes: [sec as never] };
    const s = secao(fmt({ corpo: [sec as never], preTextuais: pre({ tipo: 'sumario' }) }), 'preTextual');
    const b = s.blocos[1] as Extract<BlocoFormatado, { tipo: 'sumario' }>;
    expect(texto(s.blocos[0]!)).toBe('SUMÁRIO');
    expect(b.entradas).toHaveLength(5);
    expect(b.entradas[1]).toMatchObject({ nivel: 2, indicativo: '1.1', texto: 'N2' });
  });
  it('lista de tabelas sem tabelas não reserva folha vazia', () => {
    const d = fmt({ preTextuais: pre({ tipo: 'listaTabelas' }) });
    expect(d.secoes.map((s) => s.papel)).toEqual(['textual']);
    // Revisão do M6 (N-M6-15): a lista incluída e vazia some do arquivo, mas avisa.
    expect(d.avisos.map((a) => a.codigo)).toEqual(['LISTA_VAZIA']);
  });
});

describe('sumário e títulos', () => {
  it('título 1 fica em maiúsculas no texto e na entrada; títulos pós-textuais entram no fim; âncoras batem', () => {
    const d = fmt({
      corpo: [{ id: 's', titulo: [{ tipo: 'texto', texto: 'Introdução à ação' }], blocos: [], subsecoes: [] }],
      preTextuais: pre({ tipo: 'sumario' }),
      posTextuais: pos({ tipo: 'referencias' }),
    });
    const t = paragrafos(secao(d, 'textual'))[0]!;
    expect(texto(t)).toBe('INTRODUÇÃO À AÇÃO');
    const e = (secao(d, 'preTextual').blocos[1] as Extract<BlocoFormatado, { tipo: 'sumario' }>).entradas;
    expect(e.map((x) => [x.indicativo, x.texto])).toEqual([['1', 'INTRODUÇÃO À AÇÃO'], ['', 'REFERÊNCIAS']]);
    expect(e[0]!.ancora).toBe(t.ancora);
    expect(e[1]!.ancora).toBe(paragrafos(secao(d, 'posTextual'))[0]!.ancora);
    expect(new Set(e.map((x) => x.ancora)).size).toBe(2);
  });
  it('só o título pós-textual entra na estrutura; o pré-textual fica fora do sumário, e nenhum dos dois é numerado', () => {
    const e = (id: string) => fmt({}).estilos.find((x) => x.id === id)!;
    expect(e('tituloPosTextual')).toMatchObject({ nivelEstrutura: 0 });
    expect(e('tituloPosTextual').numerado).toBeUndefined();
    expect(e('tituloSemIndicativo').nivelEstrutura).toBeUndefined();
    expect(e('titulo1').numerado).toBe(true);
  });
  it('metadados do arquivo vêm do trabalho', () => {
    expect(fmt({}).metadados).toEqual({ titulo: 'Título', autor: 'Ana Souza' });
  });
});

describe('pós-textuais', () => {
  const blocos = (...e: object[]) => paragrafos(secao(fmt({ posTextuais: pos(...e) }), 'posTextual'));
  it('títulos centralizados sem indicativo, em página nova', () => {
    const b = blocos({ tipo: 'referencias' }, { tipo: 'glossario' }, { tipo: 'indice' });
    expect(b.map(texto)).toEqual(['REFERÊNCIAS', 'GLOSSÁRIO', 'ÍNDICE']);
    expect(b.map((x) => x.novaPagina)).toEqual([undefined, true, true]);
    expect(new Set(b.map((x) => x.estilo))).toEqual(new Set(['tituloPosTextual']));
  });
  it('um apêndice: título no singular e identificação à esquerda (C-B17, C-A5)', () => {
    expect(blocos({ tipo: 'apendice', titulo: 'Roteiro' }).map((x) => [x.estilo, texto(x)])).toEqual([
      ['tituloPosTextual', 'APÊNDICE'],
      ['identificacaoPosTextual', 'APÊNDICE A – Roteiro'],
    ]);
  });
  it('vários: plural uma só vez; apêndice e anexo contam separados; sem título, só a letra', () => {
    const b = blocos({ tipo: 'apendice', titulo: 'X' }, { tipo: 'apendice' }, { tipo: 'anexo', titulo: 'Y' });
    expect(b.map(texto)).toEqual(['APÊNDICES', 'APÊNDICE A – X', 'APÊNDICE B', 'ANEXO', 'ANEXO A – Y']);
  });
  it('depois de ZZ avisa: forma sem fonte (RN-232)', () => {
    const d = fmt({ posTextuais: pos(...Array.from({ length: 53 }, () => ({ tipo: 'anexo', titulo: 'Documento' }))) });
    expect(d.avisos.map((a) => a.codigo)).toEqual(['LETRA_SEM_FONTE']);
  });

  it('apêndice ou anexo sem título avisa (N-M6-01; RN-231, RN-234)', () => {
    const d = fmt({ posTextuais: pos({ tipo: 'apendice' }, { tipo: 'anexo', titulo: 'Documento' }) });
    expect(d.avisos.map((a) => [a.codigo, a.mensagem])).toEqual([['POS_TEXTUAL_SEM_TITULO', 'APÊNDICE A está sem título: o Manual pede "APÊNDICE A – Título" (RN-231).']]);
  });
});

describe('rastreabilidade nos seis tipos', () => {
  const tipos: TipoTrabalhoUft[] = ['monografia', 'artigo-tcc', 'dissertacao', 'tese', 'relatorio-tecnico', 'projeto-pesquisa'];
  const rn = new Set(PERFIL.regras.map((r) => r.id));
  it.each(tipos)('%s: trabalho novo formata; todo estilo usado existe; toda origem é RN', (tipo) => {
    let n = 0;
    const { documento } = criarTrabalhoDoTipo({ id: 'prj_Tipo000001', agora: new Date(0).toISOString(), appVersao: '0', tipo, novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
    const d = formatar(documento, PERFIL);
    const estilos = new Set(d.estilos.map((e) => e.id));
    expect(d.regrasAguardando).toEqual([]);
    for (const s of d.secoes) {
      for (const o of s.origem) expect(rn.has(o), `seção ${s.papel}: ${o}`).toBe(true);
      for (const b of s.blocos) {
        if (b.tipo !== 'quebraPagina') expect(estilos.has(b.estilo), b.estilo).toBe(true);
        for (const o of b.origem) expect(rn.has(o), `${b.tipo}: ${o}`).toBe(true);
      }
    }
    for (const e of d.estilos) expect(Object.keys(e.origem).sort()).toEqual(Object.keys(e.propriedades).sort());
  });
  it('a ordem das seções do trabalho novo é a do Quadro 5', () => {
    let n = 0;
    const { documento } = criarTrabalhoDoTipo({ id: 'prj_Tipo000001', agora: new Date(0).toISOString(), appVersao: '0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
    expect(formatar(documento, PERFIL).secoes.map((s) => s.papel)).toEqual(['capa', 'folhaRosto', 'ficha', 'preTextual', 'textual', 'posTextual']);
  });
});

describe('decisões do usuário de 2026-11-05 (revisão do M3: D-M3-10 a 12)', () => {
  type PerfilMutavel = { regras: { id: string }[]; parametros: Record<string, { valor: unknown }> };
  const semRegra = (id: string) => {
    const p = structuredClone(PERFIL) as unknown as PerfilMutavel;
    p.regras = p.regras.filter((r) => r.id !== id);
    return p as unknown as typeof PERFIL;
  };
  const com = (perfil: typeof PERFIL, d: Partial<DocumentoParaFormatar>) => formatar({ corpo: [], metadados: M, ...d }, perfil);

  it('capa e folha de rosto: distribuição vertical vem do perfil, provisória (RN-125, RN-314)', () => {
    const d = fmt({ preTextuais: pre({ tipo: 'capa' }, { tipo: 'folhaRosto' }) });
    expect(secao(d, 'capa')).toMatchObject({ alinhamentoVertical: 'distribuido', origem: ['RN-067', 'RN-125'] });
    expect(secao(d, 'folhaRosto')).toMatchObject({ alinhamentoVertical: 'distribuido', origem: ['RN-067', 'RN-068', 'RN-314'] });
    const sem = com(semRegra('RN-314'), { preTextuais: pre({ tipo: 'folhaRosto' }) });
    expect(secao(sem, 'folhaRosto').alinhamentoVertical).toBeUndefined();
    expect(secao(sem, 'folhaRosto').origem).toEqual(['RN-067', 'RN-068']);
  });

  it('banca centralizada pela RN-313, provisória; a RN-144 não dá mais o alinhamento', () => {
    const banca = fmt({}).estilos.find((e) => e.id === 'aprovacaoBanca')!;
    expect(banca.propriedades).toMatchObject({ alinhamento: 'centralizado' });
    expect(banca.origem['alinhamento']).toEqual(['RN-313']);
    const sem = com(semRegra('RN-313'), {}).estilos.find((e) => e.id === 'aprovacaoBanca')!;
    expect(sem.propriedades).not.toHaveProperty('alinhamento');
  });

  it('rótulo em espanhol ou francês sai do perfil com aviso de provisório (RN-315)', () => {
    const d = fmt({ preTextuais: pre({ tipo: 'abstract', idioma: 'es', palavrasChave: ['A'] }) });
    expect(paragrafos(secao(d, 'preTextual')).map(texto)).toEqual(['RESUMEN', 'Palabras clave: A.']);
    expect(d.avisos).toEqual([expect.objectContaining({ codigo: 'ROTULO_PROVISORIO', mensagem: expect.stringContaining('RN-315') })]);
    expect(fmt({ preTextuais: pre({ tipo: 'abstract', palavrasChave: ['A'] }) }).avisos).toEqual([]);
  });

  it('sem a RN-315, o rótulo é "Keywords" e o aviso diz que falta fonte', () => {
    const d = com(semRegra('RN-315'), { preTextuais: pre({ tipo: 'abstract', idioma: 'fr', palavrasChave: ['A'] }) });
    expect(paragrafos(secao(d, 'preTextual')).map(texto)).toEqual(['RÉSUMÉ', 'Keywords: A.']);
    expect(d.avisos.map((a) => a.codigo)).toEqual(['FORMA_SEM_FONTE']);
  });

  it('sinal da subalínea vem do parâmetro, e sem ele a subalínea sai sem marcador (RN-026, D-M3-10)', () => {
    const corpo = [{ id: 's', titulo: [{ tipo: 'texto' as const, texto: 'T' }], subsecoes: [], blocos: [{ tipo: 'alineas' as const, id: 'l', itens: [{ conteudo: [{ tipo: 'texto' as const, texto: 'x' }], subalineas: [[{ tipo: 'texto' as const, texto: 'y' }]] }] }] }];
    const sub = (d: DocumentoFormatado) => d.secoes.flatMap((s) => s.blocos).find((b) => b.tipo === 'paragrafo' && b.estilo === 'subalinea') as Extract<BlocoFormatado, { tipo: 'paragrafo' }>;
    const padrao = fmt({ corpo: corpo as never });
    expect(padrao.listas.marcadorSubalinea).toBe('–');
    expect(sub(padrao)).toMatchObject({ lista: { rotulo: '–' }, origem: ['RN-026'] });
    const p = structuredClone(PERFIL) as unknown as PerfilMutavel;
    p.parametros['marcadorSubalinea']!.valor = '-';
    expect(sub(com(p as unknown as typeof PERFIL, { corpo: corpo as never })).lista?.rotulo).toBe('-');
    const sem = com(semRegra('RN-026'), { corpo: corpo as never });
    expect(sem.listas.marcadorSubalinea).toBeNull();
    expect(sub(sem)).toMatchObject({ lista: { rotulo: null }, origem: [] });
  });
});
