// E6-T01 — casos da matriz de testes que não tinham teste próprio: FUN-03 (mover seção renumera a remissiva a seção),
// FUN-04 (toda formatação do DOCX tem RN do perfil, em documentos completos e não só no trabalho novo) e FUN-07 (excluir
// figura citada gera aviso). Parágrafo do corpo não tem origem própria: a formatação vem do estilo, conferido aqui.
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { criarTrabalhoVazio, SessaoTrabalho, type PacoteTransferivel } from '../src/aplicacao';
import type { Bloco, BlocoIlustracao, Documento, Inline, Secao } from '../src/dominio/modelo';
import { moverParaBaixo } from '../src/dominio/modelo/operacoes';
import { formatar } from '../src/dominio/normas';
import { rotulosDeRemissiva } from '../src/dominio/visuais';
import { documentoCorretoM7, documentoDezFalhasM7, IMAGENS_CONFORMIDADE } from './corpus/conformidade';
import { documentoDificil, FIGURA_CORPUS, TIPOS, trabalhoDoTipo } from './corpus/corpus';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const par = (id: string, ...conteudo: Inline[]): Bloco => ({ tipo: 'paragrafo', id, conteudo });
const sec = (id: string, titulo: string, blocos: Bloco[], subsecoes: Secao[] = []): Secao => ({ id, titulo: [t(titulo)], blocos, subsecoes });

describe('FUN-04 (RF-05): toda formatação tem RN do perfil', () => {
  const rn = new Set(PERFIL.regras.map((r) => r.id));
  const documentos: [string, Documento][] = [
    ['documento difícil do corpus', documentoDificil()],
    ['controle do RF-15', documentoCorretoM7()],
    ['dez falhas do RF-15', documentoDezFalhasM7()],
    ...TIPOS.map((tipo): [string, Documento] => [`corpus ${tipo}`, trabalhoDoTipo(tipo)]),
  ];
  it.each(documentos)('%s', (_nome, doc) => {
    const d = formatar(doc, PERFIL);
    const estilos = new Set(d.estilos.map((e) => e.id));
    expect(d.regrasAguardando).toEqual([]);
    for (const s of d.secoes) {
      for (const o of s.origem) expect(rn.has(o), `seção ${s.papel}: ${o}`).toBe(true);
      for (const b of s.blocos) {
        if (b.tipo !== 'quebraPagina') expect(estilos.has(b.estilo), b.estilo).toBe(true);
        for (const o of b.origem) expect(rn.has(o), `${b.tipo}: ${o}`).toBe(true);
      }
    }
    for (const e of d.estilos) {
      expect(Object.keys(e.origem).sort()).toEqual(Object.keys(e.propriedades).sort());
      for (const o of Object.values(e.origem).flat()) expect(rn.has(o), `estilo ${e.id}: ${o}`).toBe(true);
    }
  });
});

describe('FUN-03 (RF-03): mover seção renumera seções e a remissiva a seção', () => {
  it('a remissiva a "2.1" passa a "1.1" quando o capítulo sobe, sem tocar no texto', () => {
    const corpo = [
      sec('sec_e6000000000001', 'Introdução', [par('par_e6000000000001', t('Ver a seção '), { tipo: 'remissiva', id: 'rem_e6000000000001', alvo: 'sec_e6000000000021' }, t('.'))]),
      sec('sec_e6000000000002', 'Método', [par('par_e6000000000002', t('Texto.'))], [sec('sec_e6000000000021', 'Amostra', [par('par_e6000000000021', t('Texto.'))])]),
    ];
    expect(rotulosDeRemissiva({ corpo }).get('sec_e6000000000021')).toBe('2.1');
    const r = moverParaBaixo(corpo, 'sec_e6000000000001');
    if (!r.ok) throw new Error(r.mensagem);
    expect(rotulosDeRemissiva({ corpo: r.corpo }).get('sec_e6000000000021')).toBe('1.1');
    expect(JSON.stringify(r.corpo)).toContain('"alvo":"sec_e6000000000021"');
  });
});

describe('FUN-07 (RF-11): excluir figura citada gera aviso', () => {
  it('aviso com a quantidade de remissivas quebradas; voltar a figura tira o aviso', () => {
    const figura: BlocoIlustracao = structuredClone(FIGURA_CORPUS);
    const p = par('par_e6000000000003', t('Ver a '), { tipo: 'remissiva', id: 'rem_e6000000000003', alvo: figura.id }, t('.'));
    const base = criarTrabalhoVazio({ id: 'prj_e6matriz00000001', agora: '2026-11-08T10:00:00.000Z', appVersao: '0.1.0' });
    const corpo = [sec('sec_e6000000000003', 'Seção', [p, figura])];
    const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, corpo }, midias: [...IMAGENS_CONFORMIDADE].map(([sha256, bytes]) => ({ sha256, bytes })) };
    const s = new SessaoTrabalho({ api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} }, agora: () => new Date(0), agendar: () => () => {} });
    s.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
    s.alterarSecao('sec_e6000000000003', { titulo: [t('Seção')], blocos: [p] });
    expect(s.obterEstado().avisos.map((x) => [x.nivel, x.texto])).toEqual([['alerta', 'Figura 1 excluída do texto: 1 remissiva ficou quebrada. Ctrl+Z desfaz.']]);
    s.alterarSecao('sec_e6000000000003', { titulo: [t('Seção')], blocos: [p, figura] });
    expect(s.obterEstado().avisos).toEqual([]);
  });
});
