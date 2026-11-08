// M1-T10 — regras puras da casca: filtros e busca da biblioteca, teclado (grade 2D, abas, menus, atalhos),
// histórico de Voltar/Avançar e textos do visor.
import { describe, expect, it } from 'vitest';
import type { ItemBiblioteca } from '../src/aplicacao';
import {
  aplicarFiltro,
  avisoDoItem,
  buscar,
  contar,
  formatarTamanho,
  LIMITE_RECENTES,
  mesmoFiltro,
  normalizarBusca,
  rotuloDoCartao,
  rotuloTipo,
  tituloDaLista,
  tituloExibido,
} from '../src/interface/biblioteca/selecao';
import { ABAS, atalhoAria, COLECOES, comandosDesativados, MENUS } from '../src/interface/casca/definicoes';
import {
  acaoDoAtalho,
  avancar,
  iniciarHistorico,
  LIMITE_HISTORICO,
  moverCiclico,
  navegar,
  proximaAba,
  proximoIndiceGrade,
  temModificador,
  voltar,
} from '../src/interface/casca/teclado';
import { linhasDoVisor, mensagemCurta, textoNaoConformidades, textoSalvamento, visorDoTrabalho } from '../src/interface/casca/visor';
import { avisoSomenteLeitura, avisosDaAbertura, mensagemVersaoFutura } from '../src/interface/escrever/aberturas';

let seq = 0;
function item(parcial: Partial<ItemBiblioteca> = {}): ItemBiblioteca {
  seq += 1;
  return {
    identificador: `id${String(seq).padStart(20, '0')}`,
    nomeArquivo: `Trabalho ${seq}.bdp`,
    titulo: `Trabalho ${seq}`,
    estado: 'ok',
    tipoTrabalho: 'generico',
    criadoEm: '2026-10-16T10:00:00-03:00',
    atualizadoEm: '2026-10-16T10:00:00-03:00',
    modificadoEm: Date.UTC(2026, 9, 16, 13, 0, 0) + seq,
    bytes: 2048,
    ...parcial,
  };
}

describe('biblioteca: títulos, filtros e busca', () => {
  it('sem título, mostra o nome do arquivo sem .bdp', () => {
    expect(tituloExibido(item({ titulo: '  ', nomeArquivo: 'Meu TCC.BDP' }))).toBe('Meu TCC');
    expect(tituloExibido(item({ titulo: 'Água do Tocantins' }))).toBe('Água do Tocantins');
  });

  it('"Todos" ordena pelo título em pt-BR (acentos e números naturais)', () => {
    const itens = [item({ titulo: 'Zebra' }), item({ titulo: 'água' }), item({ titulo: 'Capítulo 10' }), item({ titulo: 'Capítulo 2' })];
    expect(aplicarFiltro(itens, { tipo: 'todos' }).map(tituloExibido)).toEqual(['água', 'Capítulo 2', 'Capítulo 10', 'Zebra']);
  });

  it('"Recentes" traz os modificados por último, no máximo LIMITE_RECENTES', () => {
    const itens = Array.from({ length: LIMITE_RECENTES + 3 }, (_, i) => item({ modificadoEm: 1000 + i }));
    const r = aplicarFiltro(itens, { tipo: 'recentes' });
    expect(r).toHaveLength(LIMITE_RECENTES);
    expect(r[0]!.modificadoEm).toBe(1000 + LIMITE_RECENTES + 2);
    expect(contar(itens).recentes).toBe(LIMITE_RECENTES);
  });

  it('filtro por tipo e contagens só com os tipos presentes (ilegível fica fora de "Por tipo")', () => {
    const itens = [item(), item(), item({ tipoTrabalho: 'outro' }), item({ estado: 'invalido', tipoTrabalho: null })];
    expect(aplicarFiltro(itens, { tipo: 'tipoTrabalho', id: 'generico' })).toHaveLength(2);
    expect(contar(itens)).toEqual({
      todos: 4,
      recentes: 4,
      porTipo: [
        { id: 'generico', rotulo: 'Genérico', quantidade: 2 },
        { id: 'outro', rotulo: 'outro', quantidade: 1 },
      ],
    });
  });

  it('busca sem acento e sem caixa, exigindo todas as palavras, no título e no nome do arquivo', () => {
    const a = item({ titulo: 'Letramento digital na Educação' });
    const b = item({ titulo: '', nomeArquivo: 'rascunho-educacao.bdp' });
    const c = item({ titulo: 'Outra coisa' });
    expect(normalizarBusca('  EDUCAÇÃO ')).toBe('educacao');
    expect(buscar([a, b, c], 'educacao')).toEqual([a, b]);
    expect(buscar([a, b, c], 'digital educação')).toEqual([a]);
    expect(buscar([a, b, c], '   ')).toEqual([a, b, c]);
  });

  it('textos: título da lista, rótulo de tipo, aviso de estado e nome acessível do cartão', () => {
    expect(tituloDaLista({ tipo: 'todos' })).toBe('Todos os trabalhos');
    expect(tituloDaLista({ tipo: 'tipoTrabalho', id: 'generico' })).toBe('Trabalhos do tipo Genérico');
    expect(rotuloTipo(null)).toBe('Tipo desconhecido');
    expect(avisoDoItem(item({ estado: 'versaoFutura' }))).toBe('Criado por versão mais nova');
    expect(avisoDoItem(item())).toBeNull();
    const r = rotuloDoCartao(item({ titulo: 'X', estado: 'invalido', tipoTrabalho: null }));
    expect(r).toMatch(/^X, Não pôde ser lido, modificado em \d{2}\/\d{2}\/\d{4}$/);
    expect(mesmoFiltro({ tipo: 'tipoTrabalho', id: 'a' }, { tipo: 'tipoTrabalho', id: 'b' })).toBe(false);
    expect(mesmoFiltro({ tipo: 'todos' }, { tipo: 'todos' })).toBe(true);
  });

  it('tamanho com vírgula decimal', () => {
    expect(formatarTamanho(500)).toBe('500 bytes');
    expect(formatarTamanho(2048)).toBe('2 KB');
    expect(formatarTamanho(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });
});

describe('teclado', () => {
  const t = (key: string, mod: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
    key,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...mod,
  });

  it('atalhos globais: Ctrl+F (inclusive com Caps Lock), Ctrl+N, Alt+setas; o resto passa', () => {
    expect(acaoDoAtalho(t('f', { ctrlKey: true }))).toBe('buscar');
    expect(acaoDoAtalho(t('F', { ctrlKey: true }))).toBe('buscar');
    expect(acaoDoAtalho(t('n', { ctrlKey: true }))).toBe('novoTrabalho');
    expect(acaoDoAtalho(t('ArrowLeft', { altKey: true }))).toBe('voltar');
    expect(acaoDoAtalho(t('ArrowRight', { altKey: true }))).toBe('avancar');
    expect(acaoDoAtalho(t('f'))).toBeNull();
    expect(acaoDoAtalho(t('f', { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(acaoDoAtalho(t('ArrowLeft'))).toBeNull();
  });

  it('atalhos do trabalho (M1-T11): Ctrl+O, Ctrl+S, Ctrl+Shift+S (com Caps Lock), Ctrl+W', () => {
    expect(acaoDoAtalho(t('o', { ctrlKey: true }))).toBe('abrir');
    expect(acaoDoAtalho(t('s', { ctrlKey: true }))).toBe('salvar');
    expect(acaoDoAtalho(t('S', { ctrlKey: true, shiftKey: true }))).toBe('salvarComo');
    expect(acaoDoAtalho(t('s', { ctrlKey: true, shiftKey: true }))).toBe('salvarComo');
    expect(acaoDoAtalho(t('w', { ctrlKey: true }))).toBe('fecharTrabalho');
    expect(acaoDoAtalho(t('s', { ctrlKey: true, altKey: true }))).toBeNull();
    expect(acaoDoAtalho(t('w', { ctrlKey: true, shiftKey: true }))).toBeNull();
    // M2-T07: seção anterior e próxima (botões da barra superior).
    expect(acaoDoAtalho(t('PageUp', { ctrlKey: true }))).toBe('secaoAnterior');
    expect(acaoDoAtalho(t('PageDown', { ctrlKey: true }))).toBe('proximaSecao');
    expect(acaoDoAtalho(t('PageDown'))).toBeNull();
    expect(acaoDoAtalho(t('PageUp', { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(acaoDoAtalho(t('s'))).toBeNull();
  });

  it('grade 2D: setas respeitam colunas e bordas; Home/End; outras teclas = null', () => {
    // 10 itens em 4 colunas: linha 0 = 0..3, linha 1 = 4..7, linha 2 = 8..9
    expect(proximoIndiceGrade('ArrowDown', 1, 10, 4)).toBe(5);
    expect(proximoIndiceGrade('ArrowDown', 7, 10, 4)).toBe(9);
    expect(proximoIndiceGrade('ArrowUp', 2, 10, 4)).toBe(0);
    expect(proximoIndiceGrade('ArrowRight', 9, 10, 4)).toBe(9);
    expect(proximoIndiceGrade('ArrowLeft', 0, 10, 4)).toBe(0);
    expect(proximoIndiceGrade('End', 3, 10, 4)).toBe(9);
    expect(proximoIndiceGrade('Home', 3, 10, 4)).toBe(0);
    expect(proximoIndiceGrade('Enter', 3, 10, 4)).toBeNull();
    expect(proximoIndiceGrade('ArrowDown', 0, 0, 4)).toBeNull();
    expect(proximoIndiceGrade('ArrowDown', 0, 3, 0)).toBe(1);
  });

  it('tecla com Ctrl, Alt ou Windows é dos atalhos globais (grade, abas e menus a ignoram)', () => {
    expect(temModificador(t('ArrowLeft', { altKey: true }))).toBe(true);
    expect(temModificador(t('ArrowLeft', { ctrlKey: true }))).toBe(true);
    expect(temModificador({ ...t('ArrowLeft'), metaKey: true })).toBe(true);
    expect(temModificador(t('ArrowLeft', { shiftKey: true }))).toBe(false);
    expect(temModificador(t('ArrowLeft'))).toBe(false);
  });

  it('abas e menus são circulares', () => {
    expect(proximaAba('ArrowRight', 4, 5)).toBe(0);
    expect(proximaAba('ArrowLeft', 0, 5)).toBe(4);
    expect(proximaAba('End', 1, 5)).toBe(4);
    expect(proximaAba('a', 1, 5)).toBeNull();
    expect(moverCiclico(0, -1, 7)).toBe(6);
    expect(moverCiclico(6, 1, 7)).toBe(0);
  });
});

describe('histórico de Voltar/Avançar', () => {
  const igual = (a: number, b: number) => a === b;

  it('navegar, voltar, avançar; ir a um lugar novo descarta o futuro; mesmo lugar não empilha', () => {
    let h = iniciarHistorico(1);
    h = navegar(h, 2, igual);
    h = navegar(h, 2, igual);
    h = navegar(h, 3, igual);
    expect(h).toEqual({ passado: [1, 2], atual: 3, futuro: [] });
    h = voltar(voltar(h));
    expect(h).toEqual({ passado: [], atual: 1, futuro: [2, 3] });
    expect(voltar(h)).toBe(h);
    h = avancar(h);
    expect(h.atual).toBe(2);
    h = navegar(h, 9, igual);
    expect(h).toEqual({ passado: [1, 2], atual: 9, futuro: [] });
    expect(avancar(h)).toBe(h);
  });

  it('guarda no máximo LIMITE_HISTORICO lugares passados', () => {
    let h = iniciarHistorico(0);
    for (let i = 1; i <= LIMITE_HISTORICO + 10; i++) h = navegar(h, i, igual);
    expect(h.passado).toHaveLength(LIMITE_HISTORICO);
  });
});

describe('visor', () => {
  const base = { titulo: 'T', tipo: 'Genérico', naoConformidades: null, exportacao: null } as const;

  it('estados de salvamento do M1-T11', () => {
    expect(textoSalvamento({ tipo: 'salvando' })).toBe('Salvando…');
    expect(textoSalvamento({ tipo: 'naoSalvo' })).toBe('Alterações não salvas');
    expect(textoSalvamento({ tipo: 'erro', mensagem: 'disco cheio' })).toBe('Erro ao salvar: disco cheio');
    expect(textoSalvamento({ tipo: 'salvo', em: new Date(2026, 9, 16, 14, 32) })).toBe('Salvo às 14:32');
    expect(textoSalvamento({ tipo: 'salvo', em: null })).toBe('Salvo');
    expect(textoSalvamento({ tipo: 'somenteLeitura' })).toBe('Somente leitura');
  });

  it('visor a partir da sessão: pequi sem trabalho; "Sem título"; tipo pelo rótulo; erro sem prefixo repetido', () => {
    expect(visorDoTrabalho(null)).toEqual({ tipo: 'vazio' });
    const trabalho = {
      nomeArquivo: 'Trabalho.bdp',
      titulo: '   ',
      tipoTrabalho: 'generico',
      somenteLeitura: false,
      podeSalvar: true,
      salvamento: { tipo: 'erro', codigo: 'EM_USO', mensagem: 'Não foi possível salvar: o arquivo está em uso por outro programa.' },
      geracao: 1,
      secoes: [], preTextuais: null, obras: [],
    } as const;
    const v = visorDoTrabalho(trabalho);
    expect(v.tipo === 'trabalho' && linhasDoVisor(v.trabalho)).toEqual([
      { texto: 'Genérico', erro: false },
      { texto: 'Erro ao salvar: o arquivo está em uso por outro programa.', erro: true },
    ]);
    expect(v.tipo === 'trabalho' && v.trabalho.titulo).toBe('Sem título');
    const v2 = visorDoTrabalho({ ...trabalho, titulo: ' Meu TCC ', salvamento: { tipo: 'naoSalvo' } });
    expect(v2.tipo === 'trabalho' && [v2.trabalho.titulo, textoSalvamento(v2.trabalho.salvamento)]).toEqual(['Meu TCC', 'Alterações não salvas']);
    expect(mensagemCurta('Disco cheio.')).toBe('Disco cheio.');
  });
  it('tipo, salvamento e não conformidades; exportação substitui o salvamento', () => {
    expect(linhasDoVisor({ ...base, salvamento: { tipo: 'naoSalvo' } })).toEqual([
      { texto: 'Genérico', erro: false },
      { texto: 'Alterações não salvas', erro: false },
    ]);
    expect(linhasDoVisor({ ...base, salvamento: { tipo: 'erro', mensagem: 'x' }, naoConformidades: 3 })[1]!.erro).toBe(true);
    expect(linhasDoVisor({ ...base, salvamento: { tipo: 'salvando' }, naoConformidades: 1, exportacao: 0.604 }).map((l) => l.texto)).toEqual([
      'Genérico',
      'Exportando DOCX… 60%',
      '1 não conformidade',
    ]);
    expect(textoNaoConformidades(0)).toBe('Sem não conformidades');
    expect(textoNaoConformidades(2)).toBe('2 não conformidades');
  });
});

describe('abertura de trabalho (M1-T11)', () => {
  it('avisos da leitura e da atualização de formato (com o nome da cópia)', () => {
    expect(avisosDaAbertura({ avisos: [], atualizacao: null })).toEqual([]);
    const a = avisosDaAbertura({
      avisos: [{ caminho: 'midias/x.png', mensagem: 'Uma imagem foi descartada.' }],
      atualizacao: { versaoOrigem: 0, nomeBackup: 'Trabalho-formato-v0.bdp' },
    });
    expect(a.map((x) => x.nivel)).toEqual(['alerta', 'info']);
    expect(a[0]!.texto).toBe('Uma imagem foi descartada.');
    expect(a[1]!.texto).toContain('Trabalho-formato-v0.bdp');
  });

  it('versão futura: aviso de só leitura e mensagem quando nem abre', () => {
    expect(avisoSomenteLeitura('Novo.bdp').texto).toContain('só para leitura');
    expect(mensagemVersaoFutura('Novo.bdp', 3)).toContain('formato 3');
    expect(mensagemVersaoFutura('Novo.bdp', 3)).toContain('não foi alterado');
  });
});

describe('conteúdo aprovado da casca (decisões do usuário, 2026-10-16)', () => {
  it('menus, abas e coleções na ordem aprovada', () => {
    expect(MENUS.map((m) => m.rotulo)).toEqual(['Arquivo', 'Editar', 'Trabalho', 'Inserir', 'Verificar', 'Exportar', 'Ajuda']);
    expect(ABAS.map((a) => a.rotulo)).toEqual(['Biblioteca', 'Escrever', 'Elementos', 'Referências', 'Conformidade']);
    expect(COLECOES.map((c) => c.rotulo)).toEqual(['Trabalhos', 'Referências', 'Figuras e Tabelas', 'Siglas', 'Modelos']);
  });

  it('cada menu tem ao menos um item; atalho ARIA usa "Control"', () => {
    for (const m of MENUS) expect(m.itens.some((i) => i !== 'separador')).toBe(true);
    expect(atalhoAria('Ctrl+Shift+C')).toBe('Control+Shift+C');
  });

  it('comandos desativados conforme o trabalho aberto', () => {
    const lista = (t: Parameters<typeof comandosDesativados>[0]) => [...comandosDesativados(t)].sort();
    expect(lista(null)).toEqual(['estruturaSecoes', 'exportarDocx', 'fecharTrabalho', 'inserirCitacao', 'inserirNota', 'inserirTabela', 'proximaSecao', 'salvar', 'salvarComo', 'secaoAnterior']);
    expect(lista({ podeSalvar: true, somenteLeitura: false })).toEqual([]);
    // Sem .bdp: Salvar continua ativo para mostrar o aviso que leva ao "Salvar como…".
    expect(lista({ podeSalvar: false, somenteLeitura: false })).toEqual([]);
    expect(lista({ podeSalvar: false, somenteLeitura: true })).toEqual(['exportarDocx', 'inserirCitacao', 'inserirNota', 'inserirTabela', 'salvar', 'salvarComo']);
  });

  it('Arquivo (M1-T11): Abrir, Salvar, Salvar como e Fechar trabalho ligados aos comandos e aos atalhos', () => {
    const arquivo = MENUS[0]!.itens.filter((i) => i !== 'separador');
    expect(arquivo.map((i) => [i.rotulo, i.atalho, i.comando])).toEqual([
      ['Novo trabalho', 'Ctrl+N', 'novoTrabalho'],
      ['Abrir…', 'Ctrl+O', 'abrir'],
      ['Salvar', 'Ctrl+S', 'salvar'],
      ['Salvar como…', 'Ctrl+Shift+S', 'salvarComo'],
      ['Escolher pasta da biblioteca…', undefined, 'escolherPasta'],
      ['Atualizar biblioteca', 'F5', 'atualizarBiblioteca'],
      ['Versões descartadas…', undefined, 'versoesDescartadas'], // M2-T11
      ['Cópias de segurança…', undefined, 'copiasSeguranca'], // M3-T09
      ['Fechar trabalho', 'Ctrl+W', 'fecharTrabalho'],
      ['Sair', 'Alt+F4', 'sair'],
    ]);
  });
});
