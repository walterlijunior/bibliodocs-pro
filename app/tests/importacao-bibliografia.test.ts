// M4-T09 (RF-08): importação de BibTeX e RIS. Leitor próprio: os registros dos tipos da primeira leva viram obras na
// forma única do cadastro, com a referência formatada; o que não tem lugar fica listado; tipo sem formatador fica "não
// suportado"; duplicadas são marcadas; a sessão importa num passo só do Ctrl+Z.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { criarTrabalhoDoTipo, prepararImportacao, SessaoTrabalho, type PacoteTransferivel } from '../src/aplicacao';
import { autorDeNome, detectarFormato, lerBibliografiaImportada, LIMITE_REGISTROS_IMPORTACAO, textoDoLatex } from '../src/dominio/bibliografia';
import { validarDocumentoV1 } from '../src/dominio/esquemas';

const fixture = (nome: string) => readFileSync(join(__dirname, 'fixtures', 'importacao', nome), 'utf8');
const resumo = (texto: string) =>
  prepararImportacao(texto, []).itens.map((i) => ({ origem: i.origem, referencia: i.referencia, importavel: i.importavel, ignorados: i.ignorados, avisos: i.avisos }));

describe('BibTeX', () => {
  const itens = resumo(fixture('exemplo.bib'));

  it('cada tipo da primeira leva vira a referência do Manual', () => {
    expect(itens.filter((i) => i.importavel).map((i) => [i.origem, i.referencia])).toEqual([
      ['cagliari2003', 'CAGLIARI, Luiz Carlos. Alfabetização & Linguística. 10. ed. São Paulo: Scipione, 2003. 191 p.'],
      ['lima2010', 'LIMA, Bia; COSTA NETO, Rui. Um capítulo: com subtítulo. In: SOUZA, Ana (ed.). Coletânea de exemplo. Palmas: Editora da UFT, 2010. p. 15-30.'],
      ['pereira2014', 'PEREIRA JÚNIOR, Carlos. Tese de exemplo. 2014. 222 f. Tese (Doutorado) – Universidade Federal do Tocantins, Palmas, 2014.'],
      ['dorea2020', 'DOREA, Ana et al. Artigo de exemplo. Revista Fictícia, Palmas, v. 3, n. 2, p. 10-20, 2020. DOI: 10.1000/xyz.'],
      ['evento2019', 'GRUPO DE PESQUISA FICTÍCIO. Trabalho em evento. In: ANAIS DO CONGRESSO DE EXEMPLO. Anais [...]. Palmas: [s. n.], 2019. p. 1-5.'],
      ['pagina2026', 'PÁGINA de exemplo. 2025. Disponível em: https://exemplo.org/pagina. Acesso em: 31 jan. 2026.'],
    ]);
  });

  it('lista o que não tem lugar, avisa o nome do evento e não importa tipo sem formatador nem entrada quebrada', () => {
    const por = (o: string) => itens.find((i) => i.origem === o)!;
    expect(por('cagliari2003').ignorados).toEqual(['isbn']);
    expect(por('dorea2020').ignorados).toEqual(['abstract', 'keywords']);
    expect(por('evento2019').avisos).toEqual(['O nome do evento veio do título dos anais: confira o nome, o número, o ano e o local do evento.']);
    expect(por('relatorio2000')).toMatchObject({ importavel: false, avisos: ['Tipo "@techreport" sem formatador na primeira leva (D-M4-06): não importado.'] });
    expect(por('quebrado').importavel).toBe(false);
    expect(prepararImportacao(fixture('exemplo.bib'), []).avisos).toEqual(['Entrada "quebrado" mal formada: o que vinha depois do problema foi ignorado.']);
  });

  it('acentos do LaTeX, chaves e símbolos', () => {
    expect(textoDoLatex("Alfabetiza{\\c{c}}{\\~a}o \\& Lingu{\\'\\i}stica")).toBe('Alfabetização & Linguística');
    expect(textoDoLatex('{\\"u}ber {\\`a} {\\^e}tre {\\textit{Caryocar}} 50\\%')).toBe('über à être Caryocar 50%');
  });

  it('autores: vírgula, ordem direta, parentesco (RN-181), entidade entre chaves (RN-187), "and others"', () => {
    expect(autorDeNome('Luiz Carlos Cagliari')).toEqual({ tipo: 'pessoa', sobrenome: 'Cagliari', prenomes: 'Luiz Carlos' });
    expect(autorDeNome('Roberto da Silva Neto')).toEqual({ tipo: 'pessoa', sobrenome: 'Silva Neto', prenomes: 'Roberto da' });
    expect(autorDeNome('Silva, Jr, José')).toEqual({ tipo: 'pessoa', sobrenome: 'Silva Jr', prenomes: 'José' });
    expect(autorDeNome('Platão')).toEqual({ tipo: 'pessoa', sobrenome: 'Platão' });
    const r = lerBibliografiaImportada('@book{x, author = {Lima, Ana and others}, title = {T}, year = 2001}');
    expect(r.registros[0]!.obra!.autores).toEqual([{ tipo: 'pessoa', sobrenome: 'Lima', prenomes: 'Ana' }]);
    expect(r.registros[0]!.avisos).toEqual(['O arquivo indica mais autores ("and others"), sem os nomes: confira a autoria.']);
  });

  it('livro só com editores entra pelos editores com (ed.); ano fora do padrão vem com aviso', () => {
    const [i] = resumo('@book{x, editor = {Costa, Rui}, title = {Coletânea}, year = {c2001}, publisher = {P}, address = {L}}');
    expect(i!.referencia).toBe('COSTA, Rui (ed.). Coletânea. L: P, 2001.');
    expect(i!.avisos).toEqual(['Ano lido de "c2001": 2001.']);
  });
});

describe('RIS', () => {
  const itens = resumo(fixture('exemplo.ris'));

  it('cada tipo da primeira leva vira a referência do Manual', () => {
    expect(itens.map((i) => [i.origem, i.referencia, i.importavel])).toEqual([
      ['registro 1', 'CAGLIARI, Luiz Carlos. Alfabetização & Linguística. 10. ed. São Paulo: Scipione, 2003.', true],
      ['registro 2', 'LIMA, Bia. Um capítulo. In: SOUZA, Ana (ed.). Coletânea de exemplo. Palmas: EDUFT, 2010. p. 15-30.', true],
      ['registro 3', 'DOREA, Ana. Artigo de exemplo. Revista Fictícia, v. 3, n. 2, p. 10-20, 2020. DOI: 10.1000/xyz. Disponível em: https://exemplo.org/artigo. Acesso em: 31 jan. 2026.', true],
      ['registro 4', 'PEREIRA JÚNIOR, Carlos. Tese de exemplo. 2014. Tese (Doutorado em Educação) – Universidade Federal do Tocantins, Palmas, 2014.', true],
      ['registro 5', '', false],
    ]);
    expect(itens[0]!.ignorados).toEqual(['SN']);
    expect(itens[2]!.ignorados).toEqual(['AB']);
  });

  it('registro sem ER fecha no próximo TY ou no fim', () => {
    const r = lerBibliografiaImportada('TY  - BOOK\nTI  - Um\nTY  - BOOK\nTI  - Dois\n');
    expect(r.registros.map((x) => x.obra?.titulo[0]?.texto)).toEqual(['Um', 'Dois']);
    expect(r.avisos).toHaveLength(2);
  });
});

describe('formato, limites e duplicadas', () => {
  it('detecta o formato; texto que não é nem um nem outro', () => {
    expect(detectarFormato('TY  - BOOK\nER  - ')).toBe('ris');
    expect(detectarFormato('@article{a, title={x}}')).toBe('bibtex');
    expect(lerBibliografiaImportada('qualquer coisa')).toEqual({ formato: null, registros: [], avisos: ['O arquivo não parece BibTeX nem RIS.'] });
  });

  it('chaves aninhadas demais não travam; registros acima do limite são cortados', () => {
    const fundo = `@book{x, title = {${'{'.repeat(100)}a${'}'.repeat(100)}}}`;
    expect(lerBibliografiaImportada(fundo).avisos[0]).toContain('mal formada');
    const muitos = Array.from({ length: LIMITE_REGISTROS_IMPORTACAO + 5 }, (_, k) => `TY  - BOOK\nTI  - T${k}\nER  - `).join('\n');
    const r = lerBibliografiaImportada(muitos);
    expect(r.registros).toHaveLength(LIMITE_REGISTROS_IMPORTACAO);
    expect(r.avisos.at(-1)).toContain('mais de');
  });

  it('marca a obra que já está no trabalho e a repetida no arquivo, sem distinguir acentos e maiúsculas', () => {
    const existente = { id: 'obr_existente0001', tipo: 'livro' as const, autores: [{ tipo: 'pessoa' as const, sobrenome: 'CAGLIARI' }], titulo: [{ tipo: 'texto' as const, texto: 'Alfabetizacao & linguistica' }], ano: 2003 };
    const p = prepararImportacao(`${fixture('exemplo.ris')}\nTY  - BOOK\nAU  - Lima, Bia\nTI  - Um capítulo\nPY  - 2010\nER  - `, [existente]);
    // O 6.º repete o registro 2 (mesmo título, ano e autor), embora o tipo seja outro.
    expect(p.itens.map((i) => i.duplicada)).toEqual([true, false, false, false, false, true]);
    const q = prepararImportacao('TY  - BOOK\nTI  - Igual\nPY  - 2001\nER  - \nTY  - BOOK\nTI  - IGUAL\nPY  - 2001\nER  - ', []);
    expect(q.itens.map((i) => i.duplicada)).toEqual([false, true]);
  });
});

describe('importar na sessão', () => {
  function montar() {
    let n = 0;
    const trabalho = criarTrabalhoDoTipo({ id: 'prj_abcdefghijklmnop', agora: '2026-11-07T10:00:00.000Z', appVersao: '0.1.0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
    const pacote: PacoteTransferivel = { ...trabalho, midias: [] };
    let k = 0;
    const sessao = new SessaoTrabalho({
      api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => {} },
      agora: () => new Date(Date.UTC(2026, 10, 7)),
      agendar: () => () => {},
      gerarIdObra: () => `obr_imp${String(++k).padStart(13, '0')}`,
    });
    sessao.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null } as never);
    return sessao;
  }

  it('importa as escolhidas com ids novos, num passo só do Ctrl+Z; refazer devolve todas', () => {
    const sessao = montar();
    const obras = prepararImportacao(fixture('exemplo.bib'), []).itens.flatMap((i) => (i.importavel && i.obra ? [i.obra] : []));
    const r = sessao.importarObras(obras);
    expect(r).toEqual({ ok: true, ids: obras.map((_, k) => `obr_imp${String(k + 1).padStart(13, '0')}`), recusadas: 0 });
    const doc = () => sessao.pacote!.documento;
    expect(doc().obras).toHaveLength(6);
    expect(validarDocumentoV1(JSON.parse(JSON.stringify(doc()))).ok).toBe(true);
    sessao.desfazer(() => false);
    expect(doc().obras).toBeUndefined();
    sessao.refazer(() => false);
    expect(doc().obras).toHaveLength(6);
  });

  it('obra inválida não entra; nenhuma válida: recusa', () => {
    const sessao = montar();
    expect(sessao.importarObras([{ id: 'x', tipo: 'livro', titulo: [] }])).toEqual({ ok: false, mensagem: 'Nenhuma das obras escolhidas pode ser gravada.' });
    const r = sessao.importarObras([{ id: 'x', tipo: 'livro', titulo: [] }, { id: 'y', tipo: 'livro', titulo: [{ tipo: 'texto', texto: 'Válida' }] }]);
    expect(r.ok && r.recusadas).toBe(1);
  });
});
