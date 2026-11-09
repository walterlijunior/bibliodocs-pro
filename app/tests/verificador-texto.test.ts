import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import type { Bloco, Documento, Secao } from '../src/dominio/modelo';
import { avaliarConformidade } from '../src/dominio/verificador/conformidade';
import { MAXIMO_PROBLEMAS_TEXTO, verificarTexto } from '../src/dominio/verificador/texto';
import { documentoCorretoConformidade } from './corpus/conformidade';
import { documentoDificil } from './corpus/corpus';

let n = 0;
const par = (texto: string): Bloco => ({ tipo: 'paragrafo', id: `par_vt${++n}`, conteudo: [{ tipo: 'texto', texto }] });
const sec = (titulo: string, blocos: Bloco[] = [par('Texto.')], subsecoes: Secao[] = []): Secao =>
  ({ id: `sec_vt${++n}`, titulo: titulo ? [{ tipo: 'texto', texto: titulo }] : [], blocos, subsecoes });
const doc = (...corpo: Secao[]): Documento => ({ id: 'prj_verificadortexto', tipoTrabalho: 'generico', metadados: { titulo: [] }, corpo });
const codigos = (d: Documento) => verificarTexto(d).map((p) => p.codigo);

describe('M7-T01: RN-043, título secundário a quinário em caixa alta', () => {
  it('acusa o secundário todo em maiúsculas, não o primário', () => {
    const d = doc(sec('INTRODUÇÃO', [par('a')], [sec('OBJETIVOS DO TRABALHO')]));
    const r = verificarTexto(d);
    expect(r.map((p) => p.codigo)).toEqual(['TITULO_CAIXA_ALTA']);
    expect(r[0]).toMatchObject({ origem: ['RN-043'], secao: d.corpo[0]!.subsecoes[0]!.id });
  });
  it('não acusa título que é só sigla, nem título com minúsculas e sigla', () => {
    expect(codigos(doc(sec('Texto', [par('a')], [sec('UFT'), sec('Ensino na UFT'), sec('O CNPQ e a UFT em 2020'), sec('EMBRAPA'), sec('COVID-19')])))).toEqual([]);
  });
});

describe('M7-T01: RN-109, indicativo digitado no título', () => {
  it.each(['1 Introdução', '2.1 Objetivos', '3. Método', '1.2.3.4.5 Item'])('acusa “%s”', (t) => {
    expect(codigos(doc(sec(t)))).toContain('TITULO_COM_INDICATIVO');
  });
  it.each(['2020 em perspectiva', 'Lei 8666', 'Introdução', '1990-2000: uma década'])('não acusa “%s”', (t) => {
    expect(codigos(doc(sec(t)))).not.toContain('TITULO_COM_INDICATIVO');
  });
});

describe('M7-T01: RN-086, supressão fora de colchetes em citação', () => {
  it('acusa na citação longa e entre aspas no texto corrido', () => {
    const longa: Bloco = { tipo: 'citacaoLonga', id: 'cit_vt1', conteudo: [{ tipo: 'texto', texto: 'O texto (...) continua … até aqui.' }] };
    const r = verificarTexto(doc(sec('Texto', [longa, par('Disse que “a pesquisa ... avançou” ontem.')])));
    expect(r.map((p) => [p.codigo, p.no])).toEqual([['SUPRESSAO_FORA_DO_PADRAO', 'cit_vt1'], ['SUPRESSAO_FORA_DO_PADRAO', expect.stringMatching(/^par_vt/)]]);
    expect(r[0]!.mensagem).toContain('“(...)”');
    expect(r[0]!.mensagem).toContain('“…”');
  });
  it('aceita [...] e não olha reticências fora de citação', () => {
    const longa: Bloco = { tipo: 'citacaoLonga', id: 'cit_vt2', conteudo: [{ tipo: 'texto', texto: 'O texto [...] continua [ … ].' }] };
    expect(codigos(doc(sec('Texto', [longa, par('Ficou assim... sem citação.'), par('Disse “a [...] pesquisa”.')])))).toEqual([]);
  });
  it('N-M7-08: reticências coladas à palavra são do original, não supressão', () => {
    const longa: Bloco = { tipo: 'citacaoLonga', id: 'cit_vt3', conteudo: [{ tipo: 'texto', texto: 'Eu... não sei, disse… e calou.' }] };
    expect(codigos(doc(sec('Texto', [longa, par('Respondeu “talvez... amanhã”.')])))).toEqual([]);
    expect(codigos(doc(sec('Texto', [par('Disse “... e depois saiu”.')])))).toEqual(['SUPRESSAO_FORA_DO_PADRAO']);
  });
});

describe('M7-T01: D-M7-02, título vazio e seção sem texto', () => {
  it('acusa título só com espaços e seção sem blocos nem subseções; seção só com subseções passa', () => {
    const d = doc(sec('  '), sec('Vazia', []), sec('Mãe', [], [sec('Filha')]));
    expect(codigos(d)).toEqual(['TITULO_VAZIO', 'SECAO_SEM_TEXTO']);
  });
  it('sai como aviso de critério provisório no relatório', () => {
    const r = avaliarConformidade(doc(sec('Vazia', [])), PERFIL);
    expect(r.problemas).toEqual([expect.objectContaining({ codigo: 'SECAO_SEM_TEXTO', gravidade: 'aviso', provisoria: true })]);
  });
  it('apêndice sem conteúdo não gera aviso', () => {
    const d: Documento = { ...doc(sec('Texto')), posTextuais: [{ id: 'pos_vtapendice', tipo: 'apendice', titulo: 'Questionário' }] } as Documento;
    expect(codigos(d)).toEqual([]);
  });
});

describe('M7-T01: integração e limites', () => {
  it('as regras novas estão no perfil e saem como aviso com sugestão', () => {
    const r = avaliarConformidade(doc(sec('1 Texto', [par('a')], [sec('MÉTODO DE PESQUISA')])), PERFIL);
    expect(r.diagnosticos).toEqual([]);
    expect(r.problemas.map((p) => [p.codigo, p.gravidade, p.provisoria])).toEqual([
      ['TITULO_COM_INDICATIVO', 'aviso', undefined], ['TITULO_CAIXA_ALTA', 'aviso', undefined],
    ]);
    for (const p of r.problemas) expect(p.sugestao.length).toBeGreaterThan(15);
  });
  it('controle correto e documento difícil do corpus sem aviso de texto', () => {
    expect(verificarTexto(documentoCorretoConformidade())).toEqual([]);
    expect(verificarTexto(documentoDificil())).toEqual([]);
  });
  it('limite técnico vira diagnóstico explícito', () => {
    const d = doc(...Array.from({ length: MAXIMO_PROBLEMAS_TEXTO + 5 }, () => sec('Vazia', [])));
    const r = avaliarConformidade(d, PERFIL);
    expect(r.problemas).toHaveLength(MAXIMO_PROBLEMAS_TEXTO);
    expect(r.diagnosticos).toContainEqual(expect.objectContaining({ codigo: 'LIMITE_RELATORIO' }));
  });
  it('não muda o documento', () => {
    const d = doc(sec('1 TEXTO', []));
    const antes = JSON.stringify(d);
    verificarTexto(d);
    expect(JSON.stringify(d)).toBe(antes);
  });
});
