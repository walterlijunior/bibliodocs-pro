// Etapa 3 da especificação de atualização — logotipo da instituição (o brasão da capa, RN-118): vai nas mídias do
// trabalho, sai centralizado no alto da capa com a altura dos modelos da UFT (3,1 cm) e some o aviso de brasão ausente.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { aplicarDadosDoCatalogo } from '../src/aplicacao';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { criarTrabalhoDoTipo } from '../src/aplicacao/servicos/criar-trabalho';
import { midiasDoDocumento, validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Documento } from '../src/dominio/modelo';
import { ALTURA_BRASAO_CM, formatar } from '../src/dominio/normas';
import { exportarDocx } from '../src/exportacao/docx';
import { pngDeTeste } from './corpus/corpus';

const SHA = 'a'.repeat(64);
function trabalho(logotipo?: string): Documento {
  let n = 0;
  const { documento } = criarTrabalhoDoTipo({ id: 'prj_Logotipo00001', agora: new Date(0).toISOString(), appVersao: '0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
  return { ...documento, metadados: { titulo: [{ tipo: 'texto', texto: 'Com brasão' }], instituicao: 'Universidade Federal do Tocantins', ...(logotipo ? { logotipo } : {}) } };
}

describe('logotipo no trabalho', () => {
  it('aplicar a escolha com logotipo grava o sha256; `null` tira; ausente deixa', () => {
    const m = trabalho().metadados;
    const com = aplicarDadosDoCatalogo(m, {}, { instituicao: 'uft' }, { logotipo: SHA });
    expect(com.logotipo).toBe(SHA);
    expect(aplicarDadosDoCatalogo(com, {}, { instituicao: 'uft' }).logotipo).toBe(SHA);
    expect(aplicarDadosDoCatalogo(com, {}, { instituicao: 'usp' }, { logotipo: null })).not.toHaveProperty('logotipo');
  });

  it('o documento com logotipo é válido e lista a imagem como mídia necessária', () => {
    const d = trabalho(SHA);
    expect(validarDocumentoV1(d).ok).toBe(true);
    expect(midiasDoDocumento(d)).toEqual([{ sha256: SHA, caminho: 'documento.metadados.logotipo' }]);
    expect(validarDocumentoV1({ ...d, metadados: { ...d.metadados, logotipo: 'xyz' } }).ok).toBe(false);
  });
});

describe('brasão na capa (RN-118)', () => {
  const png = pngDeTeste(283, 310, 300);

  it('sai primeiro na capa, centralizado (estilo da instituição), com 3,1 cm de altura e a proporção da imagem', () => {
    const f = formatar({ ...trabalho(SHA), imagens: new Map([[SHA, png]]) }, PERFIL);
    const capa = f.secoes.find((s) => s.papel === 'capa')!;
    const b = capa.blocos[0]!;
    expect(b).toMatchObject({ tipo: 'imagem', estilo: 'capaInstituicao', formato: 'png', origem: ['RN-118'] });
    if (b.tipo !== 'imagem') throw new Error('esperava imagem');
    expect(ALTURA_BRASAO_CM).toBe(3.1);
    expect(b.alturaTw).toBe(Math.round(3.1 * 567));
    expect(b.larguraTw).toBe(Math.round((b.alturaTw * 283) / 310));
    expect(f.avisos.some((a) => a.codigo === 'BRASAO_AUSENTE')).toBe(false);
  });

  it('sem logotipo, ou com a imagem ilegível, a capa sai sem brasão e avisa', () => {
    expect(formatar(trabalho(), PERFIL).avisos.find((a) => a.codigo === 'BRASAO_AUSENTE')?.mensagem).toMatch(/catálogo acadêmico/);
    const ilegivel = formatar({ ...trabalho(SHA), imagens: new Map([[SHA, new Uint8Array([1, 2, 3])]]) }, PERFIL);
    expect(ilegivel.avisos.find((a) => a.codigo === 'BRASAO_AUSENTE')?.mensagem).toMatch(/não pôde ser lida/);
    expect(ilegivel.secoes.find((s) => s.papel === 'capa')!.blocos[0]!.tipo).toBe('paragrafo');
  });

  it('no DOCX, a imagem está no primeiro parágrafo do documento, centralizada', async () => {
    const z = unzipSync(await exportarDocx(formatar({ ...trabalho(SHA), imagens: new Map([[SHA, png]]) }, PERFIL)));
    const xml = strFromU8(z['word/document.xml']!);
    const primeiro = /<w:p>.*?<\/w:p>|<w:p .*?<\/w:p>/s.exec(xml.slice(xml.indexOf('<w:body>')))?.[0] ?? '';
    expect(primeiro).toContain('<w:drawing>');
    expect(primeiro).toContain('w:val="capaInstituicao"');
    expect(Object.keys(z).some((n) => n.startsWith('word/media/'))).toBe(true);
  });
});
