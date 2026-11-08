import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Documento } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { exportarDocx } from '../src/exportacao/docx';

const doc = (): Documento => ({ id: 'prj_catalogo01', tipoTrabalho: 'monografia', metadados: { titulo: [] }, corpo: [], preTextuais: [{ tipo: 'listaSimbolos', id: 'pre_simbolos1' }], posTextuais: [{ tipo: 'glossario', id: 'pos_glossario1' }], simbolos: [{ id: 'smb_beta0001', simbolo: 'β', significado: 'Beta' }, { id: 'smb_alfa0001', simbolo: 'α', significado: 'Alfa' }], glossario: [{ id: 'gls_zeta0001', termo: 'Zeta', definicao: 'Última entrada.' }, { id: 'gls_alfa0001', termo: 'Álgebra', definicao: 'Primeira entrada.' }] });
const textos = (d: Documento) => formatar(d, PERFIL).secoes.flatMap((s) => s.blocos).flatMap((b) => b.tipo === 'paragrafo' ? [b.trechos.map((t) => t.tipo === 'texto' ? t.texto : '').join('')] : []);

describe('M6-T04: símbolos e glossário', () => {
  it('RN-167: símbolos em duas colunas, ordenados pelo significado (D-M6-05)', async () => {
    const d = doc();
    expect(validarDocumentoV1(d).ok).toBe(true);
    expect(textos(d).slice(0, 3)).toEqual(['LISTA DE SÍMBOLOS', 'α\tAlfa', 'β\tBeta']);
    const z = unzipSync(await exportarDocx(formatar(d, PERFIL)));
    const xml = strFromU8(z['word/document.xml']!);
    expect(xml).toContain('LISTA DE SÍMBOLOS');
    expect(xml).toContain('<w:tab/>');
    expect(xml).toMatch(/<w:tab [^>]*w:val="left"/);
  });
  it('RN-230: glossário ordenado em pt-BR, forma escolhida com aviso provisório', () => {
    const d = doc();
    expect(textos(d).slice(3)).toEqual(['GLOSSÁRIO', 'Álgebra: Primeira entrada.', 'Zeta: Última entrada.']);
    expect(formatar(d, PERFIL).avisos).toContainEqual(expect.objectContaining({ codigo: 'FORMA_SEM_FONTE', mensagem: expect.stringContaining('PF-10') }));
    expect(d.glossario![0]!.termo).toBe('Zeta');
  });
  it('catálogo vazio ou campos de outro tipo são recusados, ids são globais', () => {
    const d = doc();
    expect(validarDocumentoV1({ ...d, simbolos: [] }).ok).toBe(false);
    expect(validarDocumentoV1({ ...d, glossario: [{ ...d.glossario![0], extra: true }] }).ok).toBe(false);
    expect(validarDocumentoV1({ ...d, glossario: [{ ...d.glossario![0], id: 'smb_alfa0001' }] }).ok).toBe(false);
  });
  it('sem elemento, cadastro não cria lista ou glossário automaticamente', () => {
    const { preTextuais: _pre, posTextuais: _pos, ...d } = doc();
    expect(textos(d)).toEqual([]);
  });
  it('sem regra no perfil, conteúdo não é aplicado', () => {
    const p = { ...PERFIL, regras: PERFIL.regras.filter((r) => r.id !== 'RN-167' && r.id !== 'RN-230') };
    const f = formatar(doc(), p);
    expect(f.secoes.flatMap((s) => s.blocos).filter((b) => b.tipo === 'paragrafo' && b.estilo !== 'tituloPosTextual')).toEqual([]);
  });
});
