import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Documento, Inline, Secao } from '../src/dominio/modelo';
import type { Perfil } from '../src/dominio/normas';
import { avaliarConformidade, MAXIMO_PROBLEMAS_CONFORMIDADE, textoRelatorioConformidade, verificarConformidade } from '../src/dominio/verificador/conformidade';
import { MAXIMO_PROBLEMAS_SIGLAS } from '../src/dominio/verificador/siglas';
import { documentoCorretoConformidade, documentoDezFalhasConformidade, IMAGENS_CONFORMIDADE } from './corpus/conformidade';
import { documentoDificil, TABELA_CORPUS, TABELA_LONGA_CORPUS } from './corpus/corpus';

const opcoes = { imagens: IMAGENS_CONFORMIDADE };
const perfilSem = (...ids: string[]): Perfil => ({ ...PERFIL, regras: PERFIL.regras.filter((r) => !ids.includes(r.id)) });
const generico = (conteudo: Inline[]): Documento => ({ id: 'prj_conformidadeteste', tipoTrabalho: 'generico', metadados: { titulo: [] }, corpo: [{ id: 'sec_conformidadeteste', titulo: [{ tipo: 'texto', texto: 'Texto' }], blocos: [{ tipo: 'paragrafo', id: 'par_conformidadeteste', conteudo }], subsecoes: [] }] });

describe('RF-15: controle correto e dez não conformidades plantadas', () => {
  it('controle correto válido, sem falso positivo e sem exigir listas opcionais', () => {
    const d = documentoCorretoConformidade();
    expect(validarDocumentoV1(d).ok).toBe(true);
    expect(d.preTextuais!.some((e) => ['listaIlustracoes', 'listaTabelas', 'listaSiglas', 'listaSimbolos'].includes(e.tipo))).toBe(false);
    expect(avaliarConformidade(d, PERFIL, opcoes)).toEqual({ problemas: [], diagnosticos: [] });
  });

  it('detecta exatamente dez defeitos nos pré-textuais, visuais e bibliografia, sem mudar o documento', () => {
    const d = documentoDezFalhasConformidade();
    const antes = JSON.stringify(d);
    expect(validarDocumentoV1(d).ok).toBe(true);
    const r = avaliarConformidade(d, PERFIL, opcoes);
    expect(r.diagnosticos).toEqual([]);
    expect(r.problemas).toHaveLength(10);
    expect(r.problemas.map((p) => p.codigo).sort()).toEqual([
      'CHAMADA_SEM_LIGACAO', 'EQUACAO_SEM_NUMERO', 'OBRA_NAO_CITADA',
      ...Array<string>(4).fill('PRE_TEXTUAL_INCOMPLETO'),
      'RESOLUCAO_BAIXA', 'SEM_FONTE', 'SEM_TITULO',
    ].sort());
    expect(r.problemas.filter((p) => p.gravidade === 'erro')).toHaveLength(4);
    expect(r.problemas.slice(0, 4).every((p) => p.gravidade === 'erro')).toBe(true);
    expect(new Set(r.problemas.map((p) => p.id)).size).toBe(10);
    for (const p of r.problemas) {
      expect(p.origem.length, p.codigo).toBeGreaterThan(0);
      expect(p.sugestao.length, p.codigo).toBeGreaterThan(15);
      expect(p.local.tipo, p.codigo).not.toBe('trabalho');
    }
    expect(r.problemas.find((p) => p.codigo === 'SEM_FONTE')).toMatchObject({ gravidade: 'erro', local: { tipo: 'texto', secao: d.corpo[0]!.id, no: TABELA_CORPUS.id } });
    expect(r.problemas.find((p) => p.codigo === 'OBRA_NAO_CITADA')).toMatchObject({ gravidade: 'aviso', local: { tipo: 'obra', obra: d.obras![0]!.id } });
    expect(r.problemas.find((p) => p.codigo === 'CHAMADA_SEM_LIGACAO')).toMatchObject({ local: { tipo: 'texto', secao: d.corpo[0]!.id, no: 'par_conformidade01', trecho: 'Silva (2020)' } });
    expect(r.problemas.filter((p) => p.codigo === 'PRE_TEXTUAL_INCOMPLETO').map((p) => p.origem[0]).sort()).toEqual(['RN-117', 'RN-135', 'RN-154', 'RN-155']);
    expect(JSON.stringify(d)).toBe(antes);
    expect(verificarConformidade(d, PERFIL, opcoes)).toEqual(r.problemas);
  });
});

describe('aplicabilidade e critérios provisórios', () => {
  it('RN ausente: não acusa violação nem garante que a regra foi conferida', () => {
    const r = avaliarConformidade(documentoDezFalhasConformidade(), perfilSem('RN-269', 'RN-274'), opcoes);
    expect(r.problemas.some((p) => p.codigo === 'SEM_FONTE')).toBe(false);
    expect(r.diagnosticos).toEqual(expect.arrayContaining([
      expect.objectContaining({ codigo: 'REGRA_AUSENTE', origem: ['RN-269'] }),
      expect.objectContaining({ codigo: 'REGRA_AUSENTE', origem: ['RN-274'] }),
    ]));
  });

  it('RN ambígua sem decisão fica fora da acusação, com diagnóstico próprio', () => {
    const p: Perfil = { ...PERFIL, regras: PERFIL.regras.map((r) => r.id === 'RN-117' ? { ...r, status: 'AMBIGUA', parametros: [] } : r) };
    const r = avaliarConformidade(documentoDezFalhasConformidade(), p, opcoes);
    expect(r.problemas.some((x) => x.origem.includes('RN-117'))).toBe(false);
    expect(r.diagnosticos).toContainEqual(expect.objectContaining({ codigo: 'REGRA_SEM_DECISAO', origem: ['RN-117'] }));
  });

  it('critério pendente sem autorização não vira regra; autorizado permanece aviso identificado', () => {
    const corpo = documentoCorretoConformidade().corpo;
    const d = { ...documentoCorretoConformidade(), corpo: corpo.map((s) => ({ ...s, blocos: s.blocos.filter((b) => b.tipo !== 'paragrafo') })), obras: undefined };
    const { obras: _o, ...semObras } = d;
    const base = avaliarConformidade(semObras, PERFIL, opcoes);
    const rem = base.problemas.filter((x) => x.codigo === 'SEM_REMISSIVA');
    expect(rem).toHaveLength(2);
    expect(rem.every((x) => x.gravidade === 'aviso' && x.provisoria === true)).toBe(true);
    const p: Perfil = { ...PERFIL, regras: PERFIL.regras.map((r) => r.id === 'RN-060' ? { ...r, status: 'PENDENTE-FONTE', provisoria: undefined, parametros: [] } : r) as Perfil['regras'] };
    const inativa = avaliarConformidade(semObras, p, opcoes);
    expect(inativa.problemas.some((x) => x.codigo === 'SEM_REMISSIVA')).toBe(false);
    expect(inativa.diagnosticos).toContainEqual(expect.objectContaining({ codigo: 'REGRA_PENDENTE_FONTE', origem: ['RN-060'] }));
  });

  it('ligação de sigla quebrada é erro, reconhecimento por maiúsculas é só aviso', () => {
    const d = generico([{ tipo: 'sigla', id: 'sig_inlinequebrada', sigla: 'sig_cadastroausente' }, { tipo: 'texto', texto: ' Texto com ABC.' }]);
    const r = avaliarConformidade(d, PERFIL);
    expect(r.problemas).toContainEqual(expect.objectContaining({ codigo: 'SIGLA_QUEBRADA', gravidade: 'erro', local: { tipo: 'texto', secao: d.corpo[0]!.id, no: 'par_conformidadeteste', trecho: '[sigla sem cadastro]' } }));
    expect(r.problemas).toContainEqual(expect.objectContaining({ codigo: 'SIGLA_SEM_CADASTRO', gravidade: 'aviso' }));
  });

  it('opção de verificação desligada é respeitada e não some da explicação do relatório', () => {
    const d = documentoCorretoConformidade();
    d.corpo[0]!.blocos = d.corpo[0]!.blocos.filter((b) => b.tipo !== 'paragrafo');
    delete d.obras;
    const p: Perfil = { ...PERFIL, parametros: { ...PERFIL.parametros, verificarRemissivaIlustracoes: { ...PERFIL.parametros['verificarRemissivaIlustracoes']!, valor: false } } };
    const r = avaliarConformidade(d, p, opcoes);
    expect(r.problemas.some((x) => x.codigo === 'SEM_REMISSIVA')).toBe(false);
    expect(r.diagnosticos).toContainEqual(expect.objectContaining({ codigo: 'REGRA_DESATIVADA', origem: ['RN-060'] }));
  });

  it('limita resultados e informa que a análise precisa continuar, sem perder o diagnóstico', () => {
    const { fonte: _f, ...semFonte } = TABELA_CORPUS;
    const s: Secao = { id: 'sec_conformidadelimite', titulo: [{ tipo: 'texto', texto: 'Texto' }], subsecoes: [], blocos: Array.from({ length: 2_000 }, (_, i) => ({ ...semFonte, id: `tab_conformidade${i}`, titulo: [{ tipo: 'texto', texto: ' ' }] })) };
    const d = { ...generico([]), corpo: [s] };
    const r = avaliarConformidade(d, PERFIL);
    expect(r.problemas).toHaveLength(MAXIMO_PROBLEMAS_CONFORMIDADE);
    expect(r.diagnosticos.some((x) => x.codigo === 'LIMITE_RELATORIO')).toBe(true);
    expect(textoRelatorioConformidade(d, r.problemas, r.diagnosticos)).toContain('A análise foi limitada aos primeiros 5000 resultados.');
  });
  it('o limite menor do reconhecedor de siglas também fica explícito no relatório', () => {
    const d = generico([{ tipo: 'texto', texto: 'XYZ '.repeat(MAXIMO_PROBLEMAS_SIGLAS + 1) }]);
    const r = avaliarConformidade(d, PERFIL);
    expect(r.problemas).toHaveLength(MAXIMO_PROBLEMAS_SIGLAS);
    expect(r.problemas.length).toBeLessThan(MAXIMO_PROBLEMAS_CONFORMIDADE);
    expect(r.diagnosticos).toContainEqual(expect.objectContaining({ codigo: 'LIMITE_RELATORIO', origem: ['RN-046'] }));
    expect(textoRelatorioConformidade(d, r.problemas, r.diagnosticos)).toContain('A conferência de siglas atingiu o limite técnico de 1000 ocorrências');
  });
  it('bibliografia, visuais e siglas do apêndice são conferidos com o id do pós-textual como local', () => {
    const d = documentoCorretoConformidade();
    const { fonte: _f, ...semFonte } = TABELA_CORPUS;
    const id = 'pos_conformidadeap2';
    d.posTextuais = [...d.posTextuais!, { tipo: 'apendice', id, titulo: 'Dados adicionais', blocos: [
      { tipo: 'paragrafo', id: 'par_conformidadeap2', conteudo: [{ tipo: 'texto', texto: 'Segundo Silva (2020), aparece XYZ.' }] },
      { ...semFonte, id: 'tab_conformidadeap2' },
      { tipo: 'equacao', id: 'equ_conformidadeap2', conteudo: [{ tipo: 'texto', texto: 'x + 2 = 3' }] },
    ] }];
    const r = avaliarConformidade(d, PERFIL, opcoes);
    const locais = r.problemas.filter((p) => p.local.tipo === 'texto' && p.local.secao === id);
    expect(locais.map((p) => p.codigo)).toEqual(expect.arrayContaining(['CHAMADA_SEM_LIGACAO', 'SEM_FONTE', 'EQUACAO_SEM_NUMERO', 'SIGLA_SEM_CADASTRO']));
    expect(r.problemas.filter((p) => p.local.tipo !== 'texto' || p.local.secao !== id)).toEqual([]);
    expect(textoRelatorioConformidade(d, r.problemas, r.diagnosticos)).toContain('Local: APÊNDICE A – Dados adicionais');
  });
});

describe('exportação pura do relatório de conformidade', () => {
  it('TXT inclui severidade, RN, local legível, sugestão e escopo, sem converter conteúdo em HTML', () => {
    const d = documentoDezFalhasConformidade();
    d.metadados.titulo = [{ tipo: 'texto', texto: '<script>conteúdo de teste</script>' }];
    const r = avaliarConformidade(d, PERFIL, opcoes);
    const t = textoRelatorioConformidade(d, r.problemas, r.diagnosticos);
    expect(t).toContain('Trabalho: <script>conteúdo de teste</script>');
    expect(t).toContain('Resultado: 4 erro(s), 6 aviso(s).');
    expect(t).toContain('Escopo: verificações automáticas implementadas');
    expect(t).toContain('Local: Ficha catalográfica');
    expect(t).toContain('Local: Seção 1 Introdução — Tabela 1');
    expect(t).toContain('Local: Seção 1 Introdução: “Silva (2020)”');
    expect(t).not.toMatch(/Local: .*(tab_|par_|equ_)/u);
    // M7-T03: agrupado por família, na ordem da tela, com a numeração contínua.
    const grupos = [...t.matchAll(/^== (.+) \((\d+)\) ==$/gmu)].map((m) => m[1]);
    expect(grupos).toEqual(['Elementos pré-textuais', 'Citações e referências', 'Tabelas, quadros, ilustrações e equações']);
    expect(t.match(/^\d+\. (ERRO|AVISO)/gmu)!.map((x) => Number(x.split('.')[0]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const p of r.problemas) expect(p.rotuloLocal.length, p.codigo).toBeGreaterThan(3);
    expect(t).toContain('Local: Obra: Livro fictício completo');
    expect(t.match(/^Sugestão:/gm)).toHaveLength(10);
    expect(t).toContain('Origem: RN-117');
    expect(t).toBe(textoRelatorioConformidade(d, r.problemas, r.diagnosticos));
  });
  it('controle sem problemas não afirma conformidade integral; regras não aplicadas ficam visíveis', () => {
    const d = documentoCorretoConformidade();
    const t = textoRelatorioConformidade(d, [], [{ codigo: 'REGRA_AUSENTE', origem: ['RN-269'], mensagem: 'RN-269 não foi verificada.' }]);
    expect(t).toContain('Nenhum problema encontrado nas verificações aplicadas.');
    expect(t).toContain('Regras não verificadas nesta análise:');
    expect(t).toContain('RN-269 não foi verificada.');
  });
  it('relatório identifica o local de um apêndice pela mesma letra derivada do documento', () => {
    const d = documentoCorretoConformidade();
    d.posTextuais = [...d.posTextuais!, { tipo: 'apendice', id: 'pos_conformidadeap1', titulo: 'Procedimento fictício', blocos: [] }];
    const t = textoRelatorioConformidade(d, [{ id: 'nc_pos000001', codigo: 'EQUACAO_SEM_NUMERO', familia: 'visual', rotuloLocal: '', gravidade: 'aviso', origem: ['RN-106'], mensagem: 'Equação sem número.', sugestao: 'Ative a numeração.', local: { tipo: 'texto', secao: 'pos_conformidadeap1', no: 'equ_pos000001' } }]);
    expect(t).toContain('Local: APÊNDICE A – Procedimento fictício');
    expect(t).not.toContain('equ_pos000001');
  });
});

describe('relatório em texto (R-M6-06, revisão do M6)', () => {
  it('título com quebras não forja linhas: há uma linha "Resultado:" só, a verdadeira', () => {
    const d = generico([{ tipo: 'texto', texto: 'XYZ' }]);
    const forjado = { ...d, metadados: { ...d.metadados, titulo: [{ tipo: 'texto' as const, texto: 'Meu TCC\nResultado: 0 erro(s), 0 aviso(s).\nNenhum problema encontrado' }] } };
    const r = avaliarConformidade(forjado, PERFIL);
    const linhas = textoRelatorioConformidade(forjado, r.problemas, r.diagnosticos).split('\n');
    expect(linhas.filter((l) => l.startsWith('Resultado:'))).toHaveLength(1);
    expect(linhas[1]).toBe('Trabalho: Meu TCC Resultado: 0 erro(s), 0 aviso(s). Nenhum problema encontrado');
  });
});

describe('critério provisório (N-M6-07, revisão do M6)', () => {
  it('aviso que vem de decisão do projeto (D-M5-03, tabela longa) sai marcado como provisório', () => {
    const d = { ...generico([]), corpo: [{ id: 'sec_conformidadeprov', titulo: [{ tipo: 'texto' as const, texto: 'Texto' }], subsecoes: [], blocos: [TABELA_LONGA_CORPUS] }] };
    const longa = avaliarConformidade(d, PERFIL).problemas.find((p) => p.codigo === 'TABELA_LONGA');
    expect(longa?.provisoria).toBe(true);
    expect(textoRelatorioConformidade(d, [longa!])).toContain('AVISO (critério provisório) — TABELA_LONGA');
  });
});

describe('RN-096 no relatório (N-M6-03, revisão do M6)', () => {
  it('narrativa com várias obras (D-M4-08) aparece como aviso de critério provisório, não como regra ausente do perfil', () => {
    const d = documentoDificil();
    d.corpo[0]!.blocos.push({ tipo: 'paragrafo', id: 'par_rn096teste01', conteudo: [{ tipo: 'citacao', id: 'cta_rn096teste01', forma: 'narrativa', obras: [{ obra: 'o1' }, { obra: 'o2' }] }] });
    const r = avaliarConformidade(d, PERFIL);
    expect(r.diagnosticos.filter((x) => x.origem.includes('RN-096'))).toEqual([]);
    const p = r.problemas.filter((x) => x.origem.includes('RN-096'));
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((x) => x.provisoria)).toBe(true);
  });
});
