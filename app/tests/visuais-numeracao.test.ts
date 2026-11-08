// M5-T02: numeração por tipo, rótulo "Tabela n – Título", ordem do rodapé e pendências de tabelas, quadros e
// ilustrações. Cada caso cita a RN e a fonte (M = Manual UFT 2022; I = Normas de apresentação tabular do IBGE, 1993).
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import type { Bloco, BlocoEquacao, BlocoIlustracao, BlocoTabela, CelulaTabela, EspecieIlustracao, Secao } from '../src/dominio/modelo';
import { mapaNumerosElementos, numerarElementos, rotuloEquacao } from '../src/dominio/numeracao';
import { LINHAS_TABELA_LONGA, verificarVisuais } from '../src/dominio/verificador';
import {
  celulasComColuna,
  ehDadoNumerico,
  proporcaoNumerica,
  rodapeDoElemento,
  rotuloElemento,
  textoDaCelula,
  tituloComRotulo,
} from '../src/dominio/visuais';

const t = (texto: string) => [{ tipo: 'texto' as const, texto }];
const cel = (texto: string, extra: Partial<CelulaTabela> = {}): CelulaTabela => ({ conteudo: t(texto), ...extra });
const SEPARADOR = PERFIL.parametros['separadorTitulo']!.valor as string;

let seq = 0;
const novoId = (p: string) => `${p}_${String(++seq).padStart(12, '0')}`;

function tabela(especie: 'tabela' | 'quadro', extra: Partial<BlocoTabela> = {}): BlocoTabela {
  return {
    tipo: 'tabela',
    id: novoId('tab'),
    especie,
    titulo: t('Produção de soja no Tocantins, 2020'),
    colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'direita' }],
    linhasCabecalho: 1,
    linhas: [
      [cel('Município'), cel('Toneladas')],
      [cel('Palmas'), cel('1.234,5')],
    ],
    fonte: t('IBGE (2021).'),
    ...extra,
  };
}
function ilustracao(especie: EspecieIlustracao, extra: Partial<BlocoIlustracao> = {}): BlocoIlustracao {
  return { tipo: 'ilustracao', id: novoId('ilu'), especie, titulo: t('Título'), midia: 'a'.repeat(64), fonte: t('O autor (2026).'), ...extra };
}
const equacao = (numerada: boolean): BlocoEquacao => ({ tipo: 'equacao', id: novoId('eqc'), conteudo: t('x = y'), ...(numerada ? { numerada: true as const } : {}) });
/** Parágrafo que cita (remissiva) cada tabela, quadro e ilustração dos blocos: sem ele, cada um teria o aviso SEM_REMISSIVA. */
const citando = (blocos: Bloco[]): Bloco[] => {
  const alvos = blocos.filter((b) => b.tipo === 'tabela' || b.tipo === 'ilustracao');
  return alvos.length === 0 ? [] : [{ tipo: 'paragrafo', id: novoId('par'), conteudo: alvos.map((b) => ({ tipo: 'remissiva' as const, id: novoId('rem'), alvo: b.id })) }];
};
const secao = (blocos: Bloco[], subsecoes: Secao[] = []): Secao => ({ id: novoId('sec'), titulo: t('Seção'), blocos: [...blocos, ...citando(blocos)], subsecoes });
const secaoSemCitar = (blocos: Bloco[]): Secao => ({ id: novoId('sec'), titulo: t('Seção'), blocos, subsecoes: [] });

describe('numeração contínua por tipo (RN-052, M p. 18 e listas p. 7–8; RN-244, I p. 12–13; D-M5-07)', () => {
  it('cada palavra designativa conta à parte e não reinicia por capítulo', () => {
    const tab1 = tabela('tabela');
    const qua1 = tabela('quadro');
    const fig1 = ilustracao('figura');
    const tab2 = tabela('tabela');
    const fig2 = ilustracao('figura');
    const qua2 = tabela('quadro');
    const corpo = [secao([tab1, qua1, fig1]), secao([tab2, fig2, qua2])];
    const n = numerarElementos(corpo).elementos.map((e) => rotuloElemento(e.sequencia, e.numero));
    expect(n).toEqual(['Tabela 1', 'Quadro 1', 'Figura 1', 'Tabela 2', 'Figura 2', 'Quadro 2']);
  });

  it('cada espécie de ilustração tem a sua sequência: Gráfico 1, Mapa 1 (RN-049 e RN-052, M p. 18)', () => {
    const corpo = [secao([ilustracao('figura'), ilustracao('grafico'), ilustracao('mapa'), ilustracao('grafico'), ilustracao('fotografia')])];
    expect(numerarElementos(corpo).elementos.map((e) => rotuloElemento(e.sequencia, e.numero))).toEqual([
      'Figura 1',
      'Gráfico 1',
      'Mapa 1',
      'Gráfico 2',
      'Fotografia 1',
    ]);
  });

  it('ordem de leitura: blocos da seção antes das subseções, em qualquer profundidade', () => {
    const a = tabela('tabela');
    const b = tabela('tabela');
    const c = tabela('tabela');
    const d = tabela('tabela');
    const corpo = [secao([a], [secao([b], [secao([c])])]), secao([d])];
    const mapa = mapaNumerosElementos(corpo);
    expect([a, b, c, d].map((x) => mapa.get(x.id))).toEqual([1, 2, 3, 4]);
  });

  it('tabela única também é numerada (RN-243, I p. 12; decisão C-C2)', () => {
    const unica = tabela('tabela');
    expect(mapaNumerosElementos([secao([unica])]).get(unica.id)).toBe(1);
  });

  it('documento sem elementos: listas vazias', () => {
    expect(numerarElementos([secao([])])).toEqual({ elementos: [], equacoes: [] });
  });
});

describe('equações numeradas (RN-105 e RN-106, M p. 27)', () => {
  it('só as marcadas `numerada` recebem (1), (2)…, em sequência própria', () => {
    const e1 = equacao(true);
    const solta = equacao(false);
    const e2 = equacao(true);
    const corpo = [secao([e1, tabela('tabela'), solta], [secao([e2])])];
    const { equacoes } = numerarElementos(corpo);
    expect(equacoes.map((e) => [e.bloco.id, rotuloEquacao(e.numero)])).toEqual([
      [e1.id, '(1)'],
      [e2.id, '(2)'],
    ]);
    expect(mapaNumerosElementos(corpo).has(solta.id)).toBe(false);
  });

  it('número inválido é erro de programação', () => {
    expect(() => rotuloEquacao(0)).toThrow(RangeError);
    expect(() => rotuloElemento('tabela', 1.5)).toThrow(RangeError);
  });
});

describe('rótulo "Tabela n – Título" (RN-051 e RN-053, M p. 18; RN-302, I Anexo B; decisão C-A5)', () => {
  it('o separador do perfil UFT 2022 é meia-risca U+2013 entre espaços', () => {
    expect(SEPARADOR).toBe(' – ');
  });

  it('palavra com inicial maiúscula, número arábico, separador e título com as marcas do autor (RN-054, M p. 17)', () => {
    const titulo = [{ tipo: 'texto' as const, texto: 'Ocorrências de ' }, { tipo: 'texto' as const, texto: 'Aedes aegypti', marcas: ['italico' as const] }];
    const r = tituloComRotulo(rotuloElemento('tabela', 3), titulo, SEPARADOR);
    expect(r).toEqual([{ tipo: 'texto', texto: 'Tabela 3 – ' }, ...titulo]);
    expect(rotuloElemento('quadro', 2)).toBe('Quadro 2');
    expect(rotuloElemento('grafico', 1)).toBe('Gráfico 1');
  });

  it('título só com espaços fica só com o rótulo (a falta é pendência)', () => {
    expect(tituloComRotulo('Figura 1', t('  '), SEPARADOR)).toEqual(t('Figura 1'));
  });
});

describe('ordem do rodapé: Fonte → Nota → notas específicas (RN-277, I p. 20–21; RN-058, M p. 18 e p. 20)', () => {
  it('tabela com tudo sai na ordem obrigatória, com a chamada de cada nota específica (RN-268, RN-276, I p. 19–21)', () => {
    const b = tabela('tabela', { nota: t('Dados preliminares.'), notasEspecificas: [t('Estimativa.'), t('Inclui distritos.')] });
    expect(rodapeDoElemento(b)).toEqual([
      { parte: 'fonte', prefixo: 'Fonte:', conteudo: t('IBGE (2021).') },
      { parte: 'nota', prefixo: 'Nota:', conteudo: t('Dados preliminares.') },
      { parte: 'notaEspecifica', chamada: 1, conteudo: t('Estimativa.') },
      { parte: 'notaEspecifica', chamada: 2, conteudo: t('Inclui distritos.') },
    ]);
  });

  it('ilustração: Fonte e Nota; campo sem texto não sai (RN-056, M p. 18)', () => {
    expect(rodapeDoElemento(ilustracao('figura', { nota: t('Foto de 2020.') })).map((p) => p.parte)).toEqual(['fonte', 'nota']);
    expect(rodapeDoElemento(ilustracao('figura', { fonte: t(' ') }))).toEqual([]);
  });
});

describe('leitura das células (heurística da RN-241, I p. 9)', () => {
  it('números pt-BR e do IBGE, porcentagem, moeda e sinais convencionais (RN-263, I p. 18) contam como numéricos', () => {
    for (const v of ['1.234,5', '117 960 301', '-0,08', '−3', '12,5%', 'R$ 10,00', '2020', '-', '–', '..', '...', 'X', 'x', '0,0']) {
      expect(ehDadoNumerico(v), v).toBe(true);
    }
    for (const v of ['Palmas', 'n/d', '—', 's/d', 'Sim', '10 a 20 anos', '']) expect(ehDadoNumerico(v), v).toBe(false);
  });

  it('a chamada de nota específica não faz parte do dado (RN-267, I p. 19)', () => {
    expect(textoDaCelula(cel('(1) 42,74'))).toBe('42,74');
    expect(textoDaCelula({ conteudo: [{ tipo: 'texto', texto: '42,74' }, { tipo: 'texto', texto: '2', marcas: ['sobrescrito'] }] })).toBe('42,74');
  });

  it('posição das células com mesclagem: a coberta de cima é pulada', () => {
    const g = { colunas: [0, 1, 2].map(() => ({ alinhamento: 'esquerda' as const })), linhas: [[cel('A', { linhas: 2 }), cel('B'), cel('C')], [cel('D'), cel('E')]] };
    expect(celulasComColuna(g).map((c) => [c.linha, c.coluna, textoDaCelula(c.celula)])).toEqual([
      [0, 0, 'A'],
      [0, 1, 'B'],
      [0, 2, 'C'],
      [1, 1, 'D'],
      [1, 2, 'E'],
    ]);
  });

  it('proporção ignora cabeçalho, coluna indicadora (RN-256, I p. 15–16) e células vazias', () => {
    const b = tabela('tabela', {
      linhas: [
        [cel('Município'), cel('Toneladas')],
        [cel('Palmas'), cel('10')],
        [cel('Gurupi'), cel('alta')],
        [cel('Araguaína'), cel('')],
      ],
    });
    expect(proporcaoNumerica(b)).toBe(0.5);
    expect(proporcaoNumerica(tabela('tabela', { linhas: [[cel('A'), cel('B')], [cel('x'), cel(' ')]] }))).toBeNull();
  });
});

describe('pendências e avisos com a RN', () => {
  it('tabela completa não gera nada', () => {
    expect(verificarVisuais({ corpo: [secao([tabela('tabela'), tabela('quadro'), ilustracao('figura')])] })).toEqual([]);
  });

  it('sem fonte: tabela RN-269/RN-274 (I p. 20; C-C3), quadro e ilustração RN-056 (M p. 18)', () => {
    const tab = tabela('tabela', { fonte: undefined });
    const qua = tabela('quadro', { fonte: t('  ') });
    const fig = ilustracao('mapa', { fonte: undefined });
    const s = secao([tab, qua, fig]);
    const r = verificarVisuais({ corpo: [s] });
    expect(r.map((p) => [p.codigo, p.nivel, p.origem, p.elemento, p.secao])).toEqual([
      ['SEM_FONTE', 'pendencia', ['RN-269', 'RN-274'], tab.id, s.id],
      ['SEM_FONTE', 'pendencia', ['RN-056'], qua.id, s.id],
      ['SEM_FONTE', 'pendencia', ['RN-056'], fig.id, s.id],
    ]);
    expect(r.map((p) => p.mensagem.split(':')[0])).toEqual(['Tabela 1', 'Quadro 1', 'Mapa 1']);
  });

  it('título só com espaços: tabela RN-246/RN-063 (I p. 13; M p. 20), ilustração RN-050/RN-051 (M p. 18)', () => {
    const r = verificarVisuais({ corpo: [secao([tabela('tabela', { titulo: t(' ') }), ilustracao('figura', { titulo: t('\t') })])] });
    expect(r.map((p) => [p.codigo, p.origem])).toEqual([
      ['SEM_TITULO', ['RN-246', 'RN-063']],
      ['SEM_TITULO', ['RN-050', 'RN-051']],
    ]);
  });

  it('"tabela" com dados textuais sugere quadro (RN-241, I p. 9; D-M5-10); o quadro textual não recebe aviso', () => {
    const linhas = [
      [cel('Autor'), cel('Ideia')],
      [cel('Lima'), cel('Leitura crítica')],
      [cel('Souza'), cel('Escrita')],
    ];
    const r = verificarVisuais({ corpo: [secao([tabela('tabela', { linhas }), tabela('quadro', { linhas })])] });
    expect(r.map((p) => [p.codigo, p.nivel, p.origem])).toEqual([['TABELA_SEM_DADO_NUMERICO', 'aviso', ['RN-241', 'D-M5-10']]]);
    expect(r[0]!.mensagem).toContain('quadro');
  });

  it('tabela longa: aviso acima do limite técnico (RN-297, I p. 30; D-M5-03), ajustável', () => {
    const linhas = (n: number) => [[cel('Ano'), cel('Valor')], ...Array.from({ length: n - 1 }, (_, i) => [cel(String(2000 + i)), cel(String(i))])];
    const noLimite = tabela('tabela', { linhas: linhas(LINHAS_TABELA_LONGA) });
    const longa = tabela('tabela', { linhas: linhas(LINHAS_TABELA_LONGA + 1) });
    const r = verificarVisuais({ corpo: [secao([noLimite, longa])] });
    expect(r.map((p) => [p.codigo, p.origem, p.elemento])).toEqual([['TABELA_LONGA', ['RN-297', 'D-M5-03'], longa.id]]);
    expect(verificarVisuais({ corpo: [secao([noLimite])] }, { linhasTabelaLonga: 10 }).map((p) => p.codigo)).toEqual(['TABELA_LONGA']);
  });
});

describe('remissivas no verificador (M5-T08; RF-11; RN-060, D-M5-04)', () => {
  it('elemento sem remissiva: aviso (RN-060 é PENDENTE-FONTE); equação fica de fora', () => {
    const tab = tabela('tabela');
    const fig = ilustracao('grafico');
    const s = secaoSemCitar([tab, fig, equacao(true)]);
    const r = verificarVisuais({ corpo: [s] });
    expect(r.map((p) => [p.codigo, p.nivel, p.origem, p.elemento])).toEqual([
      ['SEM_REMISSIVA', 'aviso', ['RN-060', 'D-M5-04'], tab.id],
      ['SEM_REMISSIVA', 'aviso', ['RN-060', 'D-M5-04'], fig.id],
    ]);
    expect(r[0]!.mensagem).toBe('Tabela 1: não é citado no texto; use Inserir › Remissiva… onde o texto fala dele.');
  });

  it('remissiva quebrada: alvo que não existe ou equação sem número (pendência, RF-11)', () => {
    const semNumero = equacao(false);
    const par: Bloco = {
      tipo: 'paragrafo',
      id: novoId('par'),
      conteudo: [
        { tipo: 'remissiva', id: 'rem_quebrada0001', alvo: 'tab_naoexiste0001' },
        { tipo: 'remissiva', id: 'rem_quebrada0002', alvo: semNumero.id },
      ],
    };
    const s = secaoSemCitar([par, semNumero]);
    expect(verificarVisuais({ corpo: [s] }).map((p) => [p.codigo, p.nivel, p.elemento, p.secao])).toEqual([
      ['REMISSIVA_QUEBRADA', 'pendencia', 'rem_quebrada0001', s.id],
      ['REMISSIVA_QUEBRADA', 'pendencia', 'rem_quebrada0002', s.id],
    ]);
  });
});

