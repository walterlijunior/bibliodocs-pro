// M4-T02 (RF-08): formatadores de referência. Cada caso traz a fonte do esperado (página do Manual UFT ou decisão
// D-M4 da matriz). Os exemplos do Manual que usam campos ainda ausentes do modelo (coleção, título original) ficam
// de fora e estão listados no relatório do M4.
import { describe, expect, it } from 'vitest';
import {
  anoDaReferencia,
  dataAbreviada,
  formatarReferencia,
  MESES_ABREVIADOS,
  nomeDeEntrada,
  ordenarReferencias,
  sufixosDeAno,
  textoDaReferencia,
  tiposComFormatador,
  type ReferenciaFormatada,
} from '../src/dominio/bibliografia';
import { TIPOS_OBRA, type Autor, type InlineDeTitulo, type Obra } from '../src/dominio/modelo';

const t = (texto: string): InlineDeTitulo[] => [{ tipo: 'texto', texto }];
const p = (sobrenome: string, prenomes?: string): Autor => ({ tipo: 'pessoa', sobrenome, ...(prenomes ? { prenomes } : {}) });
const e = (nome: string): Autor => ({ tipo: 'entidade', nome });
let seq = 0;
const livro = (campos: Partial<Obra> & Pick<Obra, 'titulo'>): Obra => ({ id: `obr_teste${String(++seq).padStart(4, '0')}`, tipo: 'livro', ...campos });

/** Texto com o destaque marcado: **negrito**, _itálico_. */
function marcado(ref: ReferenciaFormatada): string {
  return ref.trechos
    .map((x) => {
      let s = x.texto;
      if (x.marcas.includes('italico')) s = `_${s}_`;
      if (x.marcas.includes('negrito')) s = `**${s}**`;
      return s;
    })
    .join('')
    .replace(/\*\*\*\*/gu, '');
}

describe('livro: exemplos do Manual, 5.19.1 a 5.19.6', () => {
  it.each<[string, Obra, string]>([
    [
      'p. 50, 1 autor (RN-194)',
      livro({ autores: [p('Cagliari', 'Luiz Carlos')], titulo: t('Alfabetização & Linguística'), edicao: 10, local: 'São Paulo', editora: 'Scipione', ano: 2003, paginas: '191' }),
      'CAGLIARI, Luiz Carlos. **Alfabetização & Linguística**. 10. ed. São Paulo: Scipione, 2003. 191 p.',
    ],
    [
      'p. 50, até 3 autores com prenomes abreviados (RN-195, RN-183)',
      livro({ autores: [p('Passos', 'L. M. M.'), p('Fonseca', 'A.'), p('Chaves', 'M.')], titulo: t('Alegria de saber'), subtitulo: t('matemática, segunda série'), local: 'São Paulo', editora: 'Scipione', ano: 1995, paginas: '136' }),
      'PASSOS, L. M. M.; FONSECA, A.; CHAVES, M. **Alegria de saber**: matemática, segunda série. São Paulo: Scipione, 1995. 136 p.',
    ],
    [
      'p. 51, mais de 3 autores com et al. em itálico (RN-196, RN-184, RN-185)',
      livro({ autores: [p('Luckesi', 'Cipriano'), p('Barreto', 'Elói'), p('Cosma', 'José'), p('Baptista', 'Naidison')], titulo: t('Fazer universidade'), subtitulo: t('uma proposta metodológica'), local: 'São Paulo', editora: 'Cortez', ano: 2003, paginas: '232' }),
      'LUCKESI, Cipriano _et al._ **Fazer universidade**: uma proposta metodológica. São Paulo: Cortez, 2003. 232 p.',
    ],
    [
      'p. 51, coletânea com organizadora (RN-197, RN-186)',
      livro({ autores: [p('Rovai', 'Esméria')], funcao: 'org', titulo: t('Ensino vocacional'), subtitulo: t('uma pedagogia atual'), local: 'São Paulo', editora: 'Cortez', ano: 2005 }),
      'ROVAI, Esméria (org.). **Ensino vocacional**: uma pedagogia atual. São Paulo: Cortez, 2005.',
    ],
    [
      'p. 51, autor entidade (RN-198, RN-187)',
      livro({ autores: [e('Conferência Nacional dos Bispos do Brasil')], titulo: t('Projeto de vida'), subtitulo: t('caminho vocacional da Pastoral da Juventude latino-americana'), local: 'São Paulo', editora: 'CCJ', ano: 2003, paginas: '144' }),
      'CONFERÊNCIA NACIONAL DOS BISPOS DO BRASIL. **Projeto de vida**: caminho vocacional da Pastoral da Juventude latino-americana. São Paulo: CCJ, 2003. 144 p.',
    ],
    [
      'p. 51, sem autoria: entrada pelo título, sem negrito (RN-199, RN-179)',
      livro({ titulo: t('Manual de editoração de texto'), local: 'Rio de Janeiro', editora: 'Livros Técnicos', ano: 2000, paginas: '51' }),
      'MANUAL de editoração de texto. Rio de Janeiro: Livros Técnicos, 2000. 51 p.',
    ],
    [
      'p. 53, traduzido (RN-204; "Título original" ainda sem campo)',
      livro({ autores: [p('Bauman', 'Zygmunt'), p('May', 'Tim')], titulo: t('Aprendendo a pensar com a sociologia'), traducao: 'Alexandre Werneck', local: 'Rio de Janeiro', editora: 'Zahar', ano: 2010 }),
      'BAUMAN, Zygmunt; MAY, Tim. **Aprendendo a pensar com a sociologia**. Tradução de Alexandre Werneck. Rio de Janeiro: Zahar, 2010.',
    ],
    [
      'p. 53, exemplo 1, on-line (RN-205, RN-189, RN-190)',
      livro({ autores: [p('Anchieta', 'José de')], titulo: t('Arte de gramática da língua na costa do Brasil (1595)'), local: 'Salvador', editora: 'UFBA', ano: 1980, paginas: '66', url: 'https://www.bbm.usp.br/node/70', acesso: '2006-06-23' }),
      'ANCHIETA, José de. **Arte de gramática da língua na costa do Brasil (1595)**. Salvador: UFBA, 1980. 66 p. Disponível em: https://www.bbm.usp.br/node/70. Acesso em: 23 jun. 2006.',
    ],
    [
      'p. 53, exemplo 2, e-book (RN-191)',
      livro({ autores: [p('Godinho', 'Thais')], titulo: t('Vida organizada'), subtitulo: t('como definir prioridades e transformar seus sonhos em objetivos'), local: 'São Paulo', editora: 'Gente', ano: 2014, ebook: true }),
      'GODINHO, Thais. **Vida organizada**: como definir prioridades e transformar seus sonhos em objetivos. São Paulo: Gente, 2014. _E-book_.',
    ],
  ])('%s', (_fonte, obra, esperado) => {
    const ref = formatarReferencia(obra);
    expect(marcado(ref)).toBe(esperado);
    expect(ref.avisos).toEqual([]);
  });
});

describe('autores (RN-180 a RN-187)', () => {
  it.each<[string, Autor, string]>([
    ['p. 50: sufixo de parentesco sobe com o sobrenome (RN-181)', p('Silva Neto', 'Roberto da'), 'SILVA NETO, Roberto da'],
    ['p. 50: partícula fica nos prenomes (RN-180)', p('Silva', 'José Antônio Costa da'), 'SILVA, José Antônio Costa da'],
    ['p. 50: TOURINHO FILHO, F. C.', p('Tourinho Filho', 'F. C.'), 'TOURINHO FILHO, F. C.'],
    ['p. 50: CRETELLA JÚNIOR com acento', p('Cretella Júnior', 'José'), 'CRETELLA JÚNIOR, José'],
    ['sem prenome', p('Platão'), 'PLATÃO'],
    ['entidade em maiúsculas (RN-187)', e('Universidade Federal do Tocantins'), 'UNIVERSIDADE FEDERAL DO TOCANTINS'],
  ])('%s', (_fonte, autor, esperado) => {
    expect(nomeDeEntrada(autor)).toBe(esperado);
  });

  it('C-B12: a opção lista todos os autores em vez de et al.', () => {
    const obra = livro({ autores: [p('A', 'Um'), p('B', 'Dois'), p('C', 'Três'), p('D', 'Quatro')], titulo: t('X'), local: 'L', editora: 'E', ano: 2000 });
    expect(textoDaReferencia(formatarReferencia(obra, { listarTodosAutores: true }))).toBe('A, Um; B, Dois; C, Três; D, Quatro. X. L: E, 2000.');
    expect(textoDaReferencia(formatarReferencia(obra))).toBe('A, Um et al. X. L: E, 2000.');
  });

  it('RN-186: plural de organizadores e coordenadores; ed. e comp. sem plural no Manual', () => {
    const base = { autores: [p('A', 'Um'), p('B', 'Dois')], titulo: t('X'), local: 'L', editora: 'E', ano: 2000 };
    expect(textoDaReferencia(formatarReferencia(livro({ ...base, funcao: 'org' })))).toMatch(/^A, Um; B, Dois \(orgs\.\)\. X/u);
    expect(textoDaReferencia(formatarReferencia(livro({ ...base, funcao: 'coord' })))).toMatch(/\(coords\.\)\. X/u);
    expect(textoDaReferencia(formatarReferencia(livro({ ...base, funcao: 'ed' })))).toMatch(/\(ed\.\)\. X/u);
  });
});

describe('elementos comuns', () => {
  it('RN-190: meses do Anexo, p. 72; "maio" sem abreviar; dia sem zero à esquerda', () => {
    expect(MESES_ABREVIADOS).toEqual(['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']);
    expect(dataAbreviada('1999-03-08')).toBe('8 mar. 1999'); // p. 52, verbete POLÍTICA
    expect(dataAbreviada('2016-05-30')).toBe('30 maio 2016');
    expect(dataAbreviada('2020-02-30')).toBeNull();
    expect(dataAbreviada('2024-02-29')).toBe('29 fev. 2024');
    expect(dataAbreviada('12/08/2020')).toBeNull();
  });

  it('D-M4-04 e D-M4-05: ano provável, ano não impresso e sufixo', () => {
    expect(anoDaReferencia({ ano: 2016 })).toBe('2016');
    expect(anoDaReferencia({ ano: 2016, anoIncerto: 'provavel' })).toBe('[2016?]');
    expect(anoDaReferencia({ ano: 2016, anoIncerto: 'naoImpresso' })).toBe('[2016]'); // p. 60
    expect(anoDaReferencia({ ano: 2020 }, 'a')).toBe('2020a');
    expect(anoDaReferencia({})).toBeNull();
  });

  it('D-M4-05: sem local "[S. l.]", sem editora "[s. n.]", 1.ª edição omitida', () => {
    const ref = formatarReferencia(livro({ autores: [p('Lima', 'Ana')], titulo: t('Obra'), edicao: 1, ano: 2001 }));
    expect(textoDaReferencia(ref)).toBe('LIMA, Ana. Obra. [S. l.]: [s. n.], 2001.');
    expect(ref.trechos.find((x) => x.texto.includes('[S. l.]'))?.origem).toContain('D-M4-05');
  });

  it('título com marcas do usuário mantém o itálico e ganha o negrito; subtítulo sem negrito (RN-178)', () => {
    const ref = formatarReferencia(
      livro({ autores: [p('Lima', 'Ana')], titulo: [{ tipo: 'texto', texto: 'Estudo de ' }, { tipo: 'texto', texto: 'Caryocar brasiliense', marcas: ['italico'] }], subtitulo: t('um caso'), local: 'Palmas', editora: 'EDUFT', ano: 2016 }),
    );
    const especie = ref.trechos.find((x) => x.texto === 'Caryocar brasiliense');
    expect(especie?.marcas).toEqual(['italico', 'negrito']);
    expect(ref.trechos.find((x) => x.texto.endsWith('um caso'))?.marcas).toEqual([]);
  });

  it('entrada pelo título: só a primeira palavra sobe, mesmo partida em dois trechos (RN-179, PF-09 f)', () => {
    const ref = formatarReferencia(livro({ titulo: [{ tipo: 'texto', texto: '  Ma' }, { tipo: 'texto', texto: 'nual de', marcas: ['italico'] }], local: 'L', editora: 'E', ano: 2000 }));
    expect(textoDaReferencia(ref)).toBe('MANUAL de. L: E, 2000.');
    expect(ref.trechos.every((x) => !x.marcas.includes('negrito'))).toBe(true);
  });

  it('título terminado em interrogação não ganha ponto', () => {
    const ref = formatarReferencia(livro({ autores: [p('Lima', 'Ana')], titulo: t('O que é ciência?'), local: 'L', editora: 'E', ano: 2000 }));
    expect(textoDaReferencia(ref)).toBe('LIMA, Ana. O que é ciência? L: E, 2000.');
  });

  it('cada trecho diz de que RN veio', () => {
    const ref = formatarReferencia(livro({ autores: [p('Cagliari', 'Luiz Carlos')], titulo: t('Alfabetização'), edicao: 10, local: 'São Paulo', editora: 'Scipione', ano: 2003 }));
    for (const x of ref.trechos) expect(x.origem.length).toBeGreaterThan(0);
    expect(ref.trechos.find((x) => x.texto === 'Alfabetização')?.origem).toEqual(['RN-178']);
  });

  it('avisa o que falta, sem recusar', () => {
    const semAno = formatarReferencia(livro({ autores: [p('Lima', 'Ana')], titulo: t('Obra'), local: 'L', editora: 'E' }));
    expect(textoDaReferencia(semAno)).toBe('LIMA, Ana. Obra. L: E.');
    expect(semAno.avisos.map((a) => a.codigo)).toEqual(['ANO_AUSENTE']);
    const semAcesso = formatarReferencia(livro({ titulo: t('Obra'), local: 'L', editora: 'E', ano: 2000, url: 'https://x.org' }));
    expect(semAcesso.avisos.map((a) => a.codigo)).toEqual(['ACESSO_AUSENTE']);
    const semUrl = formatarReferencia(livro({ titulo: t('Obra'), local: 'L', editora: 'E', ano: 2000, acesso: '2020-01-01' }));
    expect(semUrl.avisos.map((a) => a.codigo)).toEqual(['URL_AUSENTE']);
  });

  it('os nove tipos da primeira leva têm formatador; tipo desconhecido avisa em vez de inventar (D-M4-06)', () => {
    expect([...tiposComFormatador()].sort()).toEqual([...TIPOS_OBRA].sort());
    const ref = formatarReferencia({ id: 'obr_x0000001', tipo: 'mapa' as Obra['tipo'], titulo: t('X') });
    expect(ref.trechos).toEqual([]);
    expect(ref.avisos.map((a) => a.codigo)).toEqual(['TIPO_SEM_FORMATADOR']);
  });

  it('é pura: a obra não muda e a saída se repete', () => {
    const obra = livro({ autores: [p('Lima', 'Ana')], titulo: t('Obra'), ano: 2000 });
    const copia = structuredClone(obra);
    expect(formatarReferencia(obra)).toEqual(formatarReferencia(obra));
    expect(obra).toEqual(copia);
  });
});

describe('ordenação (RN-176; D-M4-05) e sufixos (D-M4-03)', () => {
  const titulos = (lista: Obra[]) => ordenarReferencias(lista).map((o) => o.titulo[0]!.texto);

  it('alfabética pt-BR, acentos e caixa no primeiro nível, sobrenome antes dos prenomes', () => {
    const lista = [
      livro({ autores: [p('Silva Neto', 'Roberto da')], titulo: t('3') }),
      livro({ autores: [p('Ávila', 'Bruno')], titulo: t('1') }),
      livro({ autores: [p('Silva', 'José')], titulo: t('2') }),
      livro({ titulo: t('Manual de editoração') }),
      livro({ autores: [e('Conferência Nacional dos Bispos do Brasil')], titulo: t('Projeto') }),
      livro({ autores: [p('Zuben', 'A.')], titulo: t('5') }),
    ];
    expect(titulos(lista)).toEqual(['1', 'Projeto', 'Manual de editoração', '2', '3', '5']);
  });

  it('mesmo autor: por ano, depois pelo título; sem ano por último', () => {
    const a = [p('Lima', 'Ana')];
    const lista = [
      livro({ autores: a, titulo: t('Zeta'), ano: 2010 }),
      livro({ autores: a, titulo: t('Sem ano') }),
      livro({ autores: a, titulo: t('Beta'), ano: 2005 }),
      livro({ autores: a, titulo: t('Alfa'), ano: 2010 }),
    ];
    expect(titulos(lista)).toEqual(['Beta', 'Alfa', 'Zeta', 'Sem ano']);
  });

  it('autor sozinho antes do mesmo autor com coautores', () => {
    const lista = [livro({ autores: [p('Lima', 'Ana'), p('Costa', 'Rui')], titulo: t('Com') }), livro({ autores: [p('Lima', 'Ana')], titulo: t('Só') })];
    expect(titulos(lista)).toEqual(['Só', 'Com']);
  });

  it('sufixos a, b só para mesmo autor e mesmo ano, na ordem do título', () => {
    const a = [p('Lima', 'Ana')];
    const x = livro({ autores: a, titulo: t('Zeta'), ano: 2020 });
    const y = livro({ autores: a, titulo: t('Alfa'), ano: 2020 });
    const z = livro({ autores: a, titulo: t('Outra'), ano: 2021 });
    const w = livro({ autores: [p('Lima', 'Bia')], titulo: t('Bia'), ano: 2020 });
    const s1 = livro({ titulo: t('Anônima'), ano: 2020 });
    const s2 = livro({ titulo: t('Anônima'), ano: 2020 });
    const sufixos = sufixosDeAno([x, y, z, w, s1, s2]);
    expect(Object.fromEntries(sufixos)).toEqual({ [y.id]: 'a', [x.id]: 'b' });
    expect(textoDaReferencia(formatarReferencia(y, { sufixoAno: sufixos.get(y.id) }))).toBe('LIMA, Ana. Alfa. [S. l.]: [s. n.], 2020a.');
  });

  it('não altera a lista de entrada', () => {
    const lista = [livro({ titulo: t('B') }), livro({ titulo: t('A') })];
    const antes = lista.map((o) => o.id);
    ordenarReferencias(lista);
    expect(lista.map((o) => o.id)).toEqual(antes);
  });
});
