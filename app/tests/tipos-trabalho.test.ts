// Testes do M2-T02 (RF-02): os seis tipos de trabalho UFT como dados — elementos e ordem por tipo, fonte de cada
// presença conferida na matriz normativa, trabalho novo por tipo, leitura dos elementos no `.bdp` e rótulos da
// interface.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { criarTrabalhoDoTipo, PREFIXO_ID_ELEMENTO, PREFIXO_ID_SECAO } from '../src/aplicacao';
import { PADRAO_ID, validarDocumentoV1, validarManifestoV1, type Manifesto } from '../src/dominio/esquemas';
import {
  MAXIMO_REPETICOES_ELEMENTO,
  ORDEM_POS_TEXTUAIS,
  ORDEM_PRE_TEXTUAIS,
  TIPOS_TRABALHO,
  TIPOS_TRABALHO_UFT,
  type Documento,
  type Secao,
  type TipoTrabalhoUft,
} from '../src/dominio/modelo';
import { PERFIL_UFT_2022 } from '../src/aplicacao/perfil-padrao';
import { entraNoTrabalhoNovo } from '../src/dominio/normas';

const ESTRUTURA_POR_TIPO = PERFIL_UFT_2022.tiposTrabalho;
import { ROTULOS_TIPO, rotuloTipo, TIPOS_NOVO_TRABALHO } from '../src/interface/biblioteca/selecao';
import { empacotarProjeto, lerProjeto } from '../src/persistencia';

const AGORA = '2026-10-17T10:00:00-03:00';

function novo(tipo: TipoTrabalhoUft) {
  let n = 0;
  return criarTrabalhoDoTipo({
    id: 'prj_Tipo000001',
    agora: AGORA,
    appVersao: '0.1.0',
    tipo,
    novoId: (prefixo) => `${prefixo}_${String(++n).padStart(16, '0')}`,
  });
}

const titulos = (secoes: readonly Secao[]): unknown[] =>
  secoes.map((s) => (s.subsecoes.length > 0 ? [s.titulo[0]?.texto, titulos(s.subsecoes)] : s.titulo[0]?.texto));

/** Status de cada RN na matriz (coluna Status). */
const STATUS_RN = (() => {
  const matriz = readFileSync(join(__dirname, '..', '..', 'docs', 'MATRIZ_DE_REQUISITOS_NORMATIVOS.md'), 'utf8');
  const status = new Map<string, string>();
  for (const linha of matriz.split('\n')) {
    const id = /^\| (RN-\d{3}) \|/.exec(linha)?.[1];
    const s = /\| (CONFIRMADA|IMPLEMENTADA|AMBÍGUA|PENDENTE-FONTE|CONFLITO) \|/.exec(linha)?.[1];
    if (id && s) status.set(id, s);
  }
  return status;
})();

const QUADRO_5_PRE = ['capa', 'folhaRosto', 'fichaCatalografica', 'folhaAprovacao', 'resumo', 'abstract', 'sumario'];
const QUADRO_5_CORPO = ['Introdução', 'Desenvolvimento', 'Considerações finais'];

describe('trabalho novo de cada tipo (RF-02)', () => {
  it.each<[TipoTrabalhoUft, string[], unknown[], string[]]>([
    ['monografia', QUADRO_5_PRE, QUADRO_5_CORPO, ['referencias']],
    ['dissertacao', QUADRO_5_PRE, QUADRO_5_CORPO, ['referencias']],
    ['tese', QUADRO_5_PRE, QUADRO_5_CORPO, ['referencias']],
    // RN-116: pré e pós do Quadro 5; o corpo do artigo é sugestão do modelo (PF-14).
    ['artigo-tcc', QUADRO_5_PRE, QUADRO_5_CORPO, ['referencias']],
    // C-B18: elementos presentes no modelo UFT, todos editáveis.
    [
      'relatorio-tecnico',
      ['capa', 'folhaRosto', 'fichaCatalografica', 'dedicatoria', 'agradecimentos', 'resumo', 'abstract', 'listaIlustracoes', 'listaTabelas', 'listaSiglas', 'listaSimbolos', 'sumario'],
      QUADRO_5_CORPO,
      ['referencias', 'apendice', 'anexo'],
    ],
    [
      'projeto-pesquisa',
      ['capa', 'folhaRosto', 'listaIlustracoes', 'listaTabelas', 'sumario'],
      ['Introdução', ['Objetivos', ['Objetivo geral', 'Objetivos específicos']], 'Cronograma'],
      ['referencias', 'apendice', 'anexo'],
    ],
  ])('%s: elementos e seções na ordem do Quadro 5', (tipo, pre, corpo, pos) => {
    const { manifesto, documento } = novo(tipo);
    expect(manifesto.tipoTrabalho).toBe(tipo);
    expect(documento.tipoTrabalho).toBe(tipo);
    expect(documento.preTextuais?.map((e) => e.tipo)).toEqual(pre);
    expect(titulos(documento.corpo)).toEqual(corpo);
    expect(documento.posTextuais?.map((e) => e.tipo)).toEqual(pos);
    expect(documento.metadados).toEqual({ titulo: [] });
  });

  it.each(TIPOS_TRABALHO_UFT)('%s: contém exatamente o obrigatório e o sugerido, nada de opcional ou sem fonte', (tipo) => {
    const e = ESTRUTURA_POR_TIPO[tipo];
    const { documento } = novo(tipo);
    expect(documento.preTextuais?.map((x) => x.tipo)).toEqual(ORDEM_PRE_TEXTUAIS.filter((id) => entraNoTrabalhoNovo(e.preTextuais[id].presenca)));
    expect(documento.posTextuais?.map((x) => x.tipo)).toEqual(ORDEM_POS_TEXTUAIS.filter((id) => entraNoTrabalhoNovo(e.posTextuais[id].presenca)));
    for (const x of documento.preTextuais ?? []) expect(['obrigatorio', 'sugerido']).toContain(e.preTextuais[x.tipo].presenca);
  });

  it.each(TIPOS_TRABALHO_UFT)('%s: passa nos validadores do v1 e sai idêntico do .bdp', (tipo) => {
    const { manifesto, documento } = novo(tipo);
    expect(validarManifestoV1(manifesto).ok).toBe(true);
    const r = validarDocumentoV1(JSON.parse(JSON.stringify(documento)));
    expect(r).toEqual({ ok: true, valor: documento });
    const bytes = empacotarProjeto({ manifesto, documento, midias: new Map() });
    if (!bytes.ok) throw new Error(JSON.stringify(bytes.erros));
    const lido = lerProjeto(bytes.bytes);
    if (!lido.ok) throw new Error(JSON.stringify(lido.erros));
    expect(JSON.stringify(lido.pacote.documento)).toBe(JSON.stringify(documento));
  });

  it('ids de elementos e seções novos, no formato do esquema, com o prefixo de cada um', () => {
    const { documento } = novo('projeto-pesquisa');
    const pilha = [...documento.corpo];
    const secoes: string[] = [];
    for (let s = pilha.pop(); s !== undefined; s = pilha.pop()) secoes.push(s.id), pilha.push(...s.subsecoes);
    const elementos = [...(documento.preTextuais ?? []), ...(documento.posTextuais ?? [])].map((e) => e.id);
    for (const id of [...secoes, ...elementos]) expect(id).toMatch(PADRAO_ID);
    expect(secoes.every((id) => id.startsWith(`${PREFIXO_ID_SECAO}_`))).toBe(true);
    expect(elementos.every((id) => id.startsWith(`${PREFIXO_ID_ELEMENTO}_`))).toBe(true);
    expect(new Set([...secoes, ...elementos]).size).toBe(secoes.length + elementos.length);
  });
});

describe('fonte de cada presença (regra 3 do CLAUDE.md)', () => {
  const entradas = TIPOS_TRABALHO_UFT.flatMap((tipo) => {
    const e = ESTRUTURA_POR_TIPO[tipo];
    return [
      ...ORDEM_PRE_TEXTUAIS.map((id) => ({ tipo, elemento: id, ...e.preTextuais[id] })),
      ...e.textuais.map((t) => ({ tipo, ...t })),
      ...ORDEM_POS_TEXTUAIS.map((id) => ({ tipo, elemento: id, ...e.posTextuais[id] })),
    ];
  });

  it('a matriz foi lida (sanidade do leitor)', () => {
    expect(STATUS_RN.size).toBeGreaterThan(300);
  });

  it('obrigatório, condicional e opcional citam RN; toda RN citada existe e está CONFIRMADA', () => {
    for (const x of entradas) {
      const onde = `${x.tipo}/${x.elemento}`;
      if (x.presenca === 'sugerido' || x.presenca === 'naoDefinido') {
        expect(x.rn, onde).toEqual([]);
        continue;
      }
      // A folha de aprovação do relatório é opcional por decisão do usuário (C-B11), sem RN própria.
      if (!(x.tipo === 'relatorio-tecnico' && x.elemento === 'folhaAprovacao')) expect(x.rn.length, onde).toBeGreaterThan(0);
      for (const rn of x.rn) expect(STATUS_RN.get(rn), `${onde} ${rn}`).toBe('CONFIRMADA');
    }
  });

  it('cada presença diz onde conferir', () => {
    for (const x of entradas) expect(x.fonte, `${x.tipo}/${x.elemento}`).toMatch(/^(M, p\. \d|modelo UFT|Manual sem estrutura|decisão C-B11)/);
  });

  it('só os tipos do Quadro 5 têm obrigatórios; relatório e projeto não têm nenhum (C-B18)', () => {
    const comObrigatorio = new Set(entradas.filter((x) => x.presenca === 'obrigatorio').map((x) => x.tipo));
    expect([...comObrigatorio].sort()).toEqual(['artigo-tcc', 'dissertacao', 'monografia', 'tese']);
  });

  it('artigo-TCC: corpo como sugestão (PF-14), pré e pós iguais aos da monografia (RN-116)', () => {
    const artigo = ESTRUTURA_POR_TIPO['artigo-tcc'];
    expect(artigo.textuais.map((t) => t.presenca)).toEqual(['sugerido', 'sugerido', 'sugerido']);
    expect(artigo.preTextuais).toEqual(ESTRUTURA_POR_TIPO.monografia.preTextuais);
    expect(artigo.posTextuais).toEqual(ESTRUTURA_POR_TIPO.monografia.posTextuais);
  });
});

describe('elementos no documento.json', () => {
  const base = (): Documento => structuredClone(novo('tese').documento);
  const primeiroErro = (json: unknown) => {
    const r = validarDocumentoV1(json);
    return r.ok ? null : r.erros[0];
  };

  it('tipo genérico com elemento é recusado', () => {
    const d = base();
    d.tipoTrabalho = 'generico';
    expect(primeiroErro(d)).toEqual({
      caminho: 'documento.preTextuais[0].tipo',
      mensagem: 'o tipo de trabalho genérico não tem elementos pré nem pós-textuais',
    });
  });

  it('fora da ordem do Quadro 5 é recusado', () => {
    const d = base();
    d.preTextuais!.reverse();
    expect(primeiroErro(d)).toEqual({ caminho: 'documento.preTextuais[1].tipo', mensagem: 'elemento fora da ordem do Quadro 5 do Manual UFT' });
  });

  it('a ordem canônica é a do Quadro 5, item a item (tabela da matriz, linhas 1–24, sem a lombada)', () => {
    expect(ORDEM_PRE_TEXTUAIS).toEqual([
      'capa', 'folhaRosto', 'fichaCatalografica', 'errata', 'folhaAprovacao', 'dedicatoria', 'agradecimentos', 'epigrafe',
      'resumo', 'abstract', 'listaIlustracoes', 'listaTabelas', 'listaSiglas', 'listaSimbolos', 'sumario',
    ]);
    expect(ORDEM_POS_TEXTUAIS).toEqual(['referencias', 'glossario', 'apendice', 'anexo', 'indice']);
  });

  it('dois elementos vizinhos trocados são recusados', () => {
    const d = base();
    [d.preTextuais![0], d.preTextuais![1]] = [d.preTextuais![1]!, d.preTextuais![0]!];
    expect(primeiroErro(d)).toEqual({ caminho: 'documento.preTextuais[1].tipo', mensagem: 'elemento fora da ordem do Quadro 5 do Manual UFT' });
  });

  it('anexo também se repete; glossário não', () => {
    const d = base();
    d.posTextuais = [...d.posTextuais!, { tipo: 'anexo', id: 'ele_Anexo000001' }, { tipo: 'anexo', id: 'ele_Anexo000002' }];
    expect(primeiroErro(d)).toBeNull();
    const g = base();
    g.posTextuais = [...g.posTextuais!, { tipo: 'glossario', id: 'ele_Glossario01' }, { tipo: 'glossario', id: 'ele_Glossario02' }];
    expect(primeiroErro(g)?.mensagem).toBe('elemento repetido (só apêndice e anexo podem aparecer mais de uma vez)');
  });

  it('pré-textual repetido é recusado; apêndices e anexos se repetem até o limite', () => {
    const d = base();
    d.preTextuais!.splice(1, 0, { tipo: 'capa', id: 'ele_Repetida0001' });
    expect(primeiroErro(d)?.mensagem).toBe('elemento repetido (só apêndice e anexo podem aparecer mais de uma vez)');

    const ok = base();
    const apendices = (n: number) => Array.from({ length: n }, (_, i) => ({ tipo: 'apendice' as const, id: `ele_Apendice${String(i).padStart(4, '0')}` }));
    ok.posTextuais = [...ok.posTextuais!, ...apendices(MAXIMO_REPETICOES_ELEMENTO), { tipo: 'anexo', id: 'ele_Anexo000001' }];
    expect(primeiroErro(ok)).toBeNull();
    ok.posTextuais.splice(1, 0, { tipo: 'apendice', id: 'ele_ApendiceDemais' });
    expect(primeiroErro(ok)?.mensagem).toBe('apêndices ou anexos demais');
  });

  it('lista vazia, elemento desconhecido e campo a mais são recusados', () => {
    const vazia = base();
    vazia.posTextuais = [];
    expect(primeiroErro(vazia)?.caminho).toBe('documento.posTextuais');
    const desconhecido = base() as unknown as { preTextuais: { tipo: string }[] };
    desconhecido.preTextuais[0]!.tipo = 'lombada';
    expect(primeiroErro(desconhecido)?.caminho).toBe('documento.preTextuais[0].tipo');
    const extra = base() as unknown as { preTextuais: Record<string, unknown>[] };
    extra.preTextuais[0]!.titulo = 'CAPA';
    expect(primeiroErro(extra)?.caminho).toBe('documento.preTextuais[0]');
  });

  it('id de elemento repetido com seção (ou entre elementos) torna o documento inválido', () => {
    const d = base();
    d.corpo[0]!.id = d.preTextuais![0]!.id;
    expect(primeiroErro(d)).toEqual({ caminho: 'documento.corpo[0].id', mensagem: 'identificador repetido no documento' });
    const e = base();
    e.posTextuais![0]!.id = e.corpo[2]!.id;
    expect(primeiroErro(e)).toEqual({ caminho: 'documento.posTextuais[0].id', mensagem: 'identificador repetido no documento' });
  });

  it('manifesto aceita os seis tipos e recusa o resto', () => {
    const m = novo('tese').manifesto;
    for (const tipo of TIPOS_TRABALHO) expect(validarManifestoV1({ ...m, tipoTrabalho: tipo }).ok).toBe(true);
    expect(validarManifestoV1({ ...m, tipoTrabalho: 'tcc' } satisfies Omit<Manifesto, 'tipoTrabalho'> & { tipoTrabalho: string }).ok).toBe(false);
  });
});

describe('interface: tipos oferecidos e rótulos', () => {
  it('"Novo trabalho" oferece os seis tipos, na ordem do domínio, cada um com descrição', () => {
    expect(TIPOS_NOVO_TRABALHO.map((t) => t.id)).toEqual(TIPOS_TRABALHO_UFT);
    for (const t of TIPOS_NOVO_TRABALHO) expect(t.descricao.length).toBeGreaterThan(20);
  });

  it('todo tipo tem rótulo; tipo desconhecido aparece pelo id', () => {
    expect(Object.keys(ROTULOS_TIPO).sort()).toEqual([...TIPOS_TRABALHO].sort());
    expect(rotuloTipo('monografia')).toBe('TCC (monografia)');
    expect(rotuloTipo('tipo-futuro')).toBe('tipo-futuro');
    expect(rotuloTipo('toString')).toBe('toString');
  });
});
