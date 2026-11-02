// M3-T03 (RF-05; DOC-02 a DOC-06): motor puro. Formatação sem RN reprova; o perfil dirige os valores.
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { formatar, type Perfil } from '../src/dominio/normas';
import type { BlocoFormatado, EstiloResolvido, TrechoFormatado } from '../src/dominio/normas/formatado';
import type { Documento, Inline, Secao } from '../src/dominio/modelo';

const texto = (t: string, ...marcas: ('italico' | 'negrito')[]): Inline => ({ tipo: 'texto', texto: t, ...(marcas.length ? { marcas } : {}) });
const nota = (id: string, t: string): Inline => ({ tipo: 'nota', id, conteudo: t === '' ? [] : [{ tipo: 'texto', texto: t }] });
const secao = (id: string, titulo: string, blocos: Secao['blocos'] = [], subsecoes: Secao[] = []): Secao => ({
  id,
  titulo: [{ tipo: 'texto', texto: titulo }],
  blocos,
  subsecoes,
});
const doc = (...corpo: Secao[]): Pick<Documento, 'corpo'> => ({ corpo });
const estilo = (id: string, p: Perfil = PERFIL, fonte?: string): EstiloResolvido => {
  const e = formatar(doc(), p, fonte ? { fonte } : {}).estilos.find((x) => x.id === id);
  if (!e) throw new Error(id);
  return e;
};
const mudarPerfil = (f: (p: { regras: { id: string; status: string; parametros?: string[]; propriedades?: object }[]; parametros: Record<string, { valor: unknown; opcoes?: unknown[] }> }) => void): Perfil => {
  const p = structuredClone(PERFIL) as unknown as Parameters<typeof f>[0];
  f(p);
  return p as unknown as Perfil;
};
const paragrafos = (bs: readonly BlocoFormatado[]) => bs.filter((b): b is Extract<BlocoFormatado, { tipo: 'paragrafo' }> => b.tipo === 'paragrafo');

describe('toda formatação tem RN (RF-05)', () => {
  const rnDoPerfil = new Set(PERFIL.regras.map((r) => r.id));
  const { estilos } = formatar(doc(), PERFIL);

  it.each(estilos.map((e) => [e.id, e] as const))('%s: cada propriedade tem origem existente no perfil, e vice-versa', (_id, e) => {
    expect(Object.keys(e.origem).sort()).toEqual(Object.keys(e.propriedades).sort());
    for (const rns of Object.values(e.origem)) {
      expect(rns!.length).toBeGreaterThan(0);
      for (const rn of rns!) expect(rnDoPerfil.has(rn), rn).toBe(true);
    }
  });

  it('todo bloco e toda nota citam só RN do perfil', () => {
    const d = formatar(
      doc(secao('s1', 'A', [
        { tipo: 'alineas', id: 'b1', itens: [{ conteudo: [texto('x'), nota('n1', 'y')], subalineas: [[texto('z')]] }] },
      ])),
      PERFIL,
    );
    const ver = (origem: readonly string[]) => origem.forEach((rn) => expect(rnDoPerfil.has(rn), rn).toBe(true));
    for (const b of d.blocos) {
      ver(b.origem);
      if (b.tipo === 'paragrafo') for (const t of b.trechos) if (t.tipo === 'nota') ver(t.origem);
    }
  });

  it('sem nenhuma regra de estilo no perfil, o estilo sai vazio: nada vem do código', () => {
    const p = mudarPerfil((x) => {
      x.regras = [];
    });
    for (const e of formatar(doc(), p).estilos) {
      expect(e.propriedades).toEqual({});
      expect(e.origem).toEqual({});
    }
  });
});

describe('valores do perfil UFT 2022 em unidades do OOXML', () => {
  it('corpo: 12 pt, 1,5, justificado, recuo de 1,25 cm (RN-001, RN-003, RN-029)', () => {
    expect(estilo('corpo').propriedades).toEqual({
      fonte: 'Times New Roman',
      corpoMeioPt: 24,
      linha: 360,
      alinhamento: 'justificado',
      recuoPrimeiraLinhaTw: 709,
    });
    expect(estilo('corpo').origem.recuoPrimeiraLinhaTw).toEqual(['RN-003']);
    expect(estilo('corpo').origem.linha).toEqual(['RN-029']);
  });

  it('citação longa: 4 cm, 10 pt, simples, 18 pt em volta (RN-004, RN-088)', () => {
    expect(estilo('citacaoLonga').propriedades).toEqual({
      fonte: 'Times New Roman',
      corpoMeioPt: 20,
      linha: 240,
      alinhamento: 'justificado',
      recuoEsquerdaTw: 2268,
      antesTw: 360,
      depoisTw: 360,
    });
    expect(estilo('citacaoLonga').origem.antesTw).toEqual(['RN-088']);
  });

  it.each([
    ['titulo1', { maiusculas: true, negrito: true, quebraPaginaAntes: true }, 0],
    ['titulo2', { negrito: true }, 1],
    ['titulo3', {}, 2],
    ['titulo4', { italico: true }, 3],
    ['titulo5', { sublinhado: true }, 4],
  ])('%s segue o Quadro 1 e fica com 18 pt em volta (RN-010 a RN-014, RN-033)', (id, destaque, nivel) => {
    const e = estilo(id);
    expect(e.propriedades).toEqual({
      fonte: 'Times New Roman',
      corpoMeioPt: 24,
      linha: 360,
      alinhamento: 'esquerda',
      manterComProximo: true,
      antesTw: 360,
      depoisTw: 360,
      ...destaque,
    });
    expect(e.nivelEstrutura).toBe(nivel);
    expect(e.origem.antesTw).toEqual(['RN-033']);
  });

  it('sem indicativo: centralizado, maiúsculas, negrito; não herda o "à esquerda" dos títulos (RN-007, RN-045)', () => {
    expect(estilo('tituloSemIndicativo').propriedades).toMatchObject({ alinhamento: 'centralizado', maiusculas: true, negrito: true });
  });

  it('nota: 10 pt, simples, justificada (RN-016)', () => {
    expect(estilo('textoNota').propriedades).toEqual({ fonte: 'Times New Roman', corpoMeioPt: 20, linha: 240, alinhamento: 'justificado' });
  });

  it('alínea: letra a 1,25 cm, sem o recuo de parágrafo; subalínea mais recuada (RN-027, RN-026)', () => {
    const a = estilo('alinea').propriedades;
    const s = estilo('subalinea').propriedades;
    expect(a).toMatchObject({ recuoEsquerdaTw: 1134, deslocamentoTw: 425, linha: 360, alinhamento: 'justificado' });
    expect(a.recuoEsquerdaTw! - a.deslocamentoTw!).toBe(709);
    expect(a.recuoPrimeiraLinhaTw).toBeUndefined();
    expect(s.recuoPrimeiraLinhaTw).toBeUndefined();
    expect(s.recuoEsquerdaTw!).toBeGreaterThan(a.recuoEsquerdaTw!);
    expect(estilo('alinea').origem.recuoEsquerdaTw).toEqual(['RN-027']);
  });

  it('natureza do trabalho: 8 cm = 4536 twips, como a matriz (RN-017)', () => {
    expect(estilo('naturezaTrabalho').propriedades.recuoEsquerdaTw).toBe(4536);
  });
});

describe('parâmetros e ajustes mudam a saída', () => {
  it('Arial por trabalho; fonte fora das opções é ignorada (D-M3-01)', () => {
    expect(estilo('corpo', PERFIL, 'Arial').propriedades.fonte).toBe('Arial');
    expect(estilo('corpo', PERFIL, 'Comic Sans').propriedades.fonte).toBe('Times New Roman');
  });

  it.each([
    ['espacoTitulosPt', 'titulo2', 'antesTw', 12, 240],
    ['espacoCitacaoLongaPt', 'citacaoLonga', 'depoisTw', 6, 120],
    ['recuoAlineaCm', 'alinea', 'recuoEsquerdaTw', 2, 1559],
    ['recuoSubalineaCm', 'subalinea', 'recuoEsquerdaTw', 3, 1985],
  ] as const)('%s muda %s', (param, id, prop, valor, esperado) => {
    const p = mudarPerfil((x) => {
      x.parametros[param]!.valor = valor;
    });
    expect(estilo(id, p).propriedades[prop]).toBe(esperado);
  });

  it('um perfil fictício muda o corpo sem código (RNF-13)', () => {
    const p = mudarPerfil((x) => {
      x.regras.find((r) => r.id === 'RN-029')!.propriedades = { entrelinha: 'simples' };
    });
    expect(estilo('corpo', p).propriedades.linha).toBe(240);
  });
});

describe('regra sem decisão não é aplicada', () => {
  it('no perfil real nada fica aguardando', () => {
    expect(formatar(doc(), PERFIL).regrasAguardando).toEqual([]);
  });

  it('ambígua sem valor: sem espaço nos títulos, e aparece em regrasAguardando', () => {
    const p = mudarPerfil((x) => {
      delete x.parametros['espacoTitulosPt']!.valor;
    });
    const d = formatar(doc(), p);
    expect(d.regrasAguardando).toContain('RN-033');
    expect(d.estilos.find((e) => e.id === 'titulo1')!.propriedades.antesTw).toBeUndefined();
  });

  it('PENDENTE-FONTE sem ser provisória não é aplicada', () => {
    const p = mudarPerfil((x) => {
      delete (x.regras.find((r) => r.id === 'RN-088') as { provisoria?: boolean }).provisoria;
    });
    const d = formatar(doc(), p);
    expect(d.regrasAguardando).toContain('RN-088');
    expect(d.estilos.find((e) => e.id === 'citacaoLonga')!.propriedades.antesTw).toBeUndefined();
  });
});

describe('blocos', () => {
  it('títulos com indicativo e estilo do nível, em ordem de leitura (RN-039)', () => {
    const d = formatar(doc(secao('a', 'Um', [], [secao('b', 'Dois', [], [secao('c', 'Três')])]), secao('d', 'Quatro')), PERFIL);
    expect(paragrafos(d.blocos).map((b) => [b.estilo, b.indicativo])).toEqual([
      ['titulo1', '1'],
      ['titulo2', '1.1'],
      ['titulo3', '1.1.1'],
      ['titulo1', '2'],
    ]);
    expect(paragrafos(d.blocos)[0]!.origem).toEqual(['RN-039', 'RN-042']);
  });

  it('além do quinto nível sai como quinária, com aviso', () => {
    let s = secao('n6', 'Seis');
    for (let i = 5; i >= 1; i--) s = secao(`n${i}`, `N${i}`, [], [s]);
    const d = formatar(doc(s), PERFIL);
    expect(paragrafos(d.blocos).at(-1)).toMatchObject({ estilo: 'titulo5', indicativo: '1.1.1.1.1.1' });
    expect(d.avisos.map((a) => [a.codigo, a.id])).toEqual([['SECAO_ALEM_DO_LIMITE', 'n6']]);
  });

  it('parágrafo e citação mantêm o texto e as marcas do autor', () => {
    const d = formatar(
      doc(secao('s', 'T', [
        { tipo: 'paragrafo', id: 'p', conteudo: [texto('a'), texto('b', 'italico')] },
        { tipo: 'citacaoLonga', id: 'c', conteudo: [texto('cit')] },
        { tipo: 'quebraPagina', id: 'q' },
      ])),
      PERFIL,
    );
    const b = d.blocos;
    expect(b[1]).toEqual({
      tipo: 'paragrafo',
      estilo: 'corpo',
      trechos: [{ tipo: 'texto', texto: 'a', marcas: [] }, { tipo: 'texto', texto: 'b', marcas: ['italico'] }],
      origem: [],
    });
    expect(b[2]).toMatchObject({ estilo: 'citacaoLonga' });
    expect(b[3]).toEqual({ tipo: 'quebraPagina', origem: [] });
  });

  it('alíneas: cada lista recomeça em a), com aa) depois de z); subalínea com travessão (RN-023, RN-025, RN-026)', () => {
    const itens = Array.from({ length: 27 }, (_, i) => ({ conteudo: [texto(`i${i}`)] }));
    const d = formatar(
      doc(secao('s', 'T', [
        { tipo: 'alineas', id: 'l1', itens },
        { tipo: 'alineas', id: 'l2', itens: [{ conteudo: [texto('x')], subalineas: [[texto('s1')], [texto('s2')]] }] },
      ])),
      PERFIL,
    );
    const l = paragrafos(d.blocos).filter((b) => b.lista);
    expect(l[0]!.lista).toEqual({ lista: 0, nivel: 0, rotulo: 'a)', posicao: 0 });
    expect(l[26]!.lista?.rotulo).toBe('aa)');
    expect(l[27]!.lista).toEqual({ lista: 1, nivel: 0, rotulo: 'a)', posicao: 0 });
    expect(l[28]).toMatchObject({ estilo: 'subalinea', lista: { nivel: 1, rotulo: '–', posicao: 0 }, origem: ['RN-026'] });
    expect(l[29]!.lista).toMatchObject({ nivel: 1, posicao: 1 });
  });

  it('notas numeradas em ordem de leitura; a vazia sai, com aviso, e não conta (ADR-0007, B6)', () => {
    const d = formatar(
      doc(
        secao('s', 'T', [{ tipo: 'paragrafo', id: 'p', conteudo: [nota('n1', 'um'), nota('v', ''), nota('n2', 'dois')] }]),
        secao('z', 'U', [{ tipo: 'alineas', id: 'l', itens: [{ conteudo: [nota('n3', 'três')] }] }]),
      ),
      PERFIL,
    );
    const notas = paragrafos(d.blocos).flatMap((b) => b.trechos).filter((t): t is Extract<TrechoFormatado, { tipo: 'nota' }> => t.tipo === 'nota');
    expect(notas.map((n) => n.numero)).toEqual([1, 2, 3]);
    expect(notas[0]).toMatchObject({ estilo: 'textoNota', origem: ['RN-102'] });
    expect(d.avisos.map((a) => [a.codigo, a.id])).toEqual([['NOTA_VAZIA', 'v']]);
  });

  it.each([
    ['citação', { tipo: 'citacaoLonga', id: 'c', conteudo: [] }, 'CITACAO_VAZIA'],
    ['alínea', { tipo: 'alineas', id: 'c', itens: [{ conteudo: [] }] }, 'ALINEA_VAZIA'],
  ] as const)('%s vazia avisa', (_n, b, codigo) => {
    expect(formatar(doc(secao('s', 'T', [b as unknown as Secao['blocos'][number]])), PERFIL).avisos[0]?.codigo).toBe(codigo);
  });

  it('sem a regra de numeração, o título sai sem indicativo inventado', () => {
    const p = mudarPerfil((x) => {
      x.regras = x.regras.filter((r) => r.id !== 'RN-039');
    });
    expect(paragrafos(formatar(doc(secao('a', 'Um')), p).blocos)[0]).not.toHaveProperty('indicativo');
  });

  it('é determinístico, não altera a entrada e é serializável', () => {
    const d = doc(secao('s', 'T', [{ tipo: 'paragrafo', id: 'p', conteudo: [texto('a'), nota('n', 'b')] }]));
    const antes = structuredClone(d);
    const a = formatar(d, PERFIL);
    expect(formatar(d, PERFIL)).toEqual(a);
    expect(d).toEqual(antes);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});
