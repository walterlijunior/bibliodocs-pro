/**
 * F-E6-01: abas Elementos, Referências e Conformidade, coleções da Biblioteca e itens de menu que não tinham ação.
 * Lógica pura (conteúdo do índice, coleções, próxima não conformidade, atalhos); a tela é conferida no E2E.
 */
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import type { ItemBiblioteca } from '../src/aplicacao';
import { avaliarConformidade } from '../src/dominio/verificador/conformidade';
import { esquemaResumoProjeto, MAX_ITENS_CONTEUDO } from '../src/persistencia';
import { conteudoDoDocumento } from '../src/persistencia/biblioteca/resumo';
import { entradasDaColecao } from '../src/interface/biblioteca/colecoes';
import { atalhosDosMenus } from '../src/interface/casca/atalhos';
import { acaoDoAtalho } from '../src/interface/casca/teclado';
import { modoDoLocal, proximaComLocal } from '../src/interface/escrever/navegacao';
import { documentoDezFalhasM7, IMAGENS_CONFORMIDADE } from './corpus/conformidade';
import { exemploCompleto } from './corpus/exemplos';

let seq = 0;
function item(titulo: string, conteudo: ItemBiblioteca['conteudo']): ItemBiblioteca {
  seq += 1;
  return {
    identificador: `id${String(seq).padStart(20, '0')}`,
    nomeArquivo: `${titulo}.bdp`,
    titulo,
    estado: 'ok',
    tipoTrabalho: 'monografia',
    criadoEm: '2026-11-14T10:00:00-03:00',
    atualizadoEm: '2026-11-14T10:00:00-03:00',
    modificadoEm: 0,
    bytes: 1,
    conteudo,
  };
}

describe('conteúdo do trabalho no índice da biblioteca', () => {
  it('exemplo completo: referências, elementos visuais e siglas, válidos pelo esquema do índice', () => {
    const doc = exemploCompleto('tese');
    const c = conteudoDoDocumento(doc);
    expect(c.referencias.length).toBe(doc.obras?.length ?? 0);
    expect(c.referencias.length).toBeGreaterThan(0);
    expect(c.visuais.length).toBeGreaterThan(0);
    expect(c.visuais.every((v) => v.descricao.startsWith(v.rotulo.split(' ')[0]!))).toBe(true);
    expect(c.siglas.length).toBe(doc.siglas?.length ?? 0);
    const r = esquemaResumoProjeto.safeParse({
      estado: 'ok',
      id: 'prj_0123456789abcdef0123456789abcdef',
      titulo: 'T',
      tipoTrabalho: 'tese',
      criadoEm: 'x',
      atualizadoEm: 'x',
      conteudo: c,
    });
    expect(r.success).toBe(true);
  });

  it('corta o texto longo e o número de itens', () => {
    const doc = exemploCompleto('monografia');
    const siglas = Array.from({ length: MAX_ITENS_CONTEUDO + 20 }, (_, i) => ({ id: `sig_${String(i).padStart(32, '0')}`, sigla: `S${i}`, extenso: 'x'.repeat(2000) }));
    const c = conteudoDoDocumento({ ...doc, siglas });
    expect(c.siglas).toHaveLength(MAX_ITENS_CONTEUDO);
    expect(c.siglas[0]!.extenso.length).toBeLessThanOrEqual(600);
    expect(c.siglas[0]!.extenso.endsWith('…')).toBe(true);
  });
});

describe('coleções da Biblioteca', () => {
  const vazio = { referencias: [], visuais: [], siglas: [] };
  const a = item('Água', {
    ...vazio,
    referencias: ['SILVA, J. Livro. 2. ed. Palmas: EDUFT, 2020.', 'ABREU, M. Outro. Palmas: EDUFT, 2019.'],
    siglas: [{ sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' }],
    visuais: [{ tipo: 'tabela', rotulo: 'Tabela 1', descricao: 'Tabela 1 – Vazão' }],
  });
  const b = item('Bacias', {
    ...vazio,
    referencias: ['SILVA, J. Livro. 2. ed. Palmas: EDUFT, 2020.'],
    siglas: [{ sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' }, { sigla: 'ANA', extenso: 'Agência Nacional de Águas' }],
    visuais: [{ tipo: 'ilustracao', rotulo: 'Figura 1', descricao: 'Figura 1 – Mapa' }],
  });
  const sem = item('Sem conteúdo', null);

  it('referência igual em dois trabalhos vira uma entrada, com os dois, em ordem alfabética', () => {
    const e = entradasDaColecao([b, a, sem], 'referencias');
    expect(e.map((x) => x.texto)).toEqual(['ABREU, M. Outro. Palmas: EDUFT, 2019.', 'SILVA, J. Livro. 2. ed. Palmas: EDUFT, 2020.']);
    expect(e[1]!.trabalhos.map((t) => t.titulo)).toEqual(['Água', 'Bacias']);
  });

  it('siglas juntam sigla e extenso; elementos visuais ficam um por trabalho, na ordem dos trabalhos', () => {
    expect(entradasDaColecao([a, b], 'siglas').map((x) => [x.texto, x.trabalhos.length])).toEqual([['ANA', 1], ['UFT', 2]]);
    expect(entradasDaColecao([b, a], 'visuais').map((x) => x.texto)).toEqual(['Tabela 1 – Vazão', 'Figura 1 – Mapa']);
  });

  it('a busca alcança o texto, o complemento e o título do trabalho, sem acento', () => {
    expect(entradasDaColecao([a, b], 'siglas', 'agencia').map((x) => x.texto)).toEqual(['ANA']);
    expect(entradasDaColecao([a, b], 'visuais', 'bacias').map((x) => x.texto)).toEqual(['Figura 1 – Mapa']);
    expect(entradasDaColecao([a, b], 'referencias', 'nada disso')).toEqual([]);
  });
});

describe('próxima não conformidade (F8) e aba de cada local', () => {
  const r = avaliarConformidade(documentoDezFalhasM7(), PERFIL, { imagens: IMAGENS_CONFORMIDADE });
  const comLocal = r.problemas.filter((c) => c.local.tipo !== 'trabalho');

  it('percorre só as que têm local e volta ao começo', () => {
    expect(comLocal.length).toBeGreaterThan(1);
    let atual = -1;
    const visitados: number[] = [];
    for (let i = 0; i < comLocal.length + 1; i++) {
      const p = proximaComLocal(r.problemas, atual)!;
      expect(p.total).toBe(comLocal.length);
      visitados.push(p.ordem);
      atual = p.indice;
    }
    expect(visitados).toEqual([...comLocal.map((_, i) => i + 1), 1]);
    expect(proximaComLocal([], -1)).toBeNull();
  });

  it('pré-textual vai à aba Elementos, obra à Referências, texto à Escrever', () => {
    expect(modoDoLocal({ tipo: 'preTextual', elemento: 'capa' })).toBe('elementos');
    expect(modoDoLocal({ tipo: 'obra', obra: 'obr_0123456789abcdef0123456789abcdef' })).toBe('referencias');
    expect(modoDoLocal({ tipo: 'texto', secao: 'sec_1', no: 'par_1' })).toBe('escrever');
  });
});

describe('ajuda e atalhos', () => {
  it('F1 abre o guia rápido; F8, a próxima não conformidade', () => {
    const t = (key: string) => ({ key, ctrlKey: false, altKey: false, shiftKey: false });
    expect(acaoDoAtalho(t('F1'))).toBe('guiaRapido');
    expect(acaoDoAtalho(t('F8'))).toBe('proximaNaoConformidade');
  });

  it('a lista de atalhos traz os dos menus', () => {
    const todos = atalhosDosMenus().flatMap((g) => g.itens.map(([tecla]) => tecla));
    for (const tecla of ['Ctrl+N', 'Ctrl+S', 'F7', 'F8', 'Ctrl+E', 'F1']) expect(todos).toContain(tecla);
  });
});
