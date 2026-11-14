// Etapa 2 da especificação de atualização — alinhamento e recuo escolhidos pelo autor e listas com marcadores e
// numeradas: do modelo ao motor (blocos formatados, aviso de forma provisória) e ao DOCX (w:jc, w:ind, w:numPr).
import { strFromU8, unzipSync } from 'fflate';
import { XMLValidator } from 'fast-xml-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Documento, InlineTexto } from '../src/dominio/modelo';
import { formatar } from '../src/dominio/normas';
import { exportarDocx } from '../src/exportacao/docx';

const t = (texto: string): InlineTexto[] => [{ tipo: 'texto', texto }];
const documento: Documento = {
  id: 'prj_Paragrafo0001',
  tipoTrabalho: 'generico',
  metadados: { titulo: t('Parágrafos e listas') },
  corpo: [
    {
      id: 'sec_secao0000001',
      titulo: t('Introdução'),
      blocos: [
        { tipo: 'paragrafo', id: 'par_padrao000001', conteudo: t('Parágrafo do perfil: justificado e com recuo.') },
        { tipo: 'paragrafo', id: 'par_centro000001', conteudo: t('Trecho centralizado'), alinhamento: 'centralizado', semRecuo: true },
        { tipo: 'paragrafo', id: 'par_direita00001', conteudo: t('À direita, com recuo'), alinhamento: 'direita' },
        { tipo: 'lista', id: 'lst_marcadores01', itens: [t('primeiro marcador'), t('segundo marcador')] },
        { tipo: 'lista', id: 'lst_numerada0001', numerada: true, itens: [t('primeiro número'), t('segundo número'), t('terceiro número')] },
        { tipo: 'lista', id: 'lst_numerada0002', numerada: true, itens: [t('recomeça em 1')] },
      ],
      subsecoes: [],
    },
  ],
};

let xml: string;
let numeracao: string;
let estilos: string;
beforeAll(async () => {
  const z = unzipSync(await exportarDocx(formatar(documento, PERFIL)));
  xml = strFromU8(z['word/document.xml']!);
  numeracao = strFromU8(z['word/numbering.xml']!);
  estilos = strFromU8(z['word/styles.xml']!);
  for (const [n, b] of Object.entries(z)) if (n.endsWith('.xml')) expect(XMLValidator.validate(strFromU8(b)), n).toBe(true);
});

/** Parágrafo do DOCX que contém o texto. */
const paragrafo = (texto: string): string => (xml.match(/<w:p>.*?<\/w:p>|<w:p .*?<\/w:p>/gs) ?? []).find((p) => p.includes(texto)) ?? '';
/** `w:abstractNum` do formato pedido (`bullet`, `decimal`). */
const abstrato = (formato: string) => (numeracao.match(/<w:abstractNum .*?<\/w:abstractNum>/gs) ?? []).filter((a) => a.includes(`w:numFmt w:val="${formato}"`));

describe('modelo (formato v1, aditivo)', () => {
  it('o documento com alinhamento, recuo e listas é válido', () => {
    const r = validarDocumentoV1(documento);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });
  it('lista vazia e alinhamento desconhecido são recusados', () => {
    const lista = { ...documento, corpo: [{ ...documento.corpo[0]!, blocos: [{ tipo: 'lista', id: 'lst_vazia0000001', itens: [] }] }] };
    expect(validarDocumentoV1(lista).ok).toBe(false);
    const alinhamento = { ...documento, corpo: [{ ...documento.corpo[0]!, blocos: [{ tipo: 'paragrafo', id: 'par_x00000000001', conteudo: [], alinhamento: 'meio' }] }] };
    expect(validarDocumentoV1(alinhamento).ok).toBe(false);
  });
});

describe('motor', () => {
  it('leva o alinhamento e o recuo escolhidos só aos parágrafos que os têm', () => {
    const f = formatar(documento, PERFIL);
    const paragrafos = f.secoes.flatMap((s) => s.blocos).filter((b) => b.tipo === 'paragrafo' && b.estilo === 'corpo');
    expect(paragrafos.map((b) => (b.tipo === 'paragrafo' ? [b.alinhamento ?? null, b.semRecuoPrimeiraLinha ?? false] : null))).toEqual([
      [null, false],
      ['centralizado', true],
      ['direita', false],
    ]);
  });
  it('cada lista recomeça, com rótulo "•" ou "n.", e avisa uma vez que a forma é provisória (D-E2-03)', () => {
    const f = formatar(documento, PERFIL);
    const itens = f.secoes.flatMap((s) => s.blocos).flatMap((b) => (b.tipo === 'paragrafo' && b.estilo === 'itemLista' && b.lista ? [b.lista] : []));
    expect(itens.map((i) => i.rotulo)).toEqual(['•', '•', '1.', '2.', '3.', '1.']);
    expect(new Set(itens.map((i) => i.lista)).size).toBe(3);
    expect(f.avisos.filter((a) => a.codigo === 'FORMA_SEM_FONTE' && a.mensagem.includes('D-E2-03'))).toHaveLength(1);
  });
  it('sem lista, nenhum aviso de lista', () => {
    const sem = { ...documento, corpo: [{ ...documento.corpo[0]!, blocos: documento.corpo[0]!.blocos.slice(0, 3) }] };
    expect(formatar(sem, PERFIL).avisos.some((a) => a.mensagem.includes('D-E2-03'))).toBe(false);
  });
});

describe('DOCX', () => {
  it('o parágrafo do perfil não leva alinhamento nem recuo próprios: vêm do estilo (justificado, 1,25 cm)', () => {
    const p = paragrafo('Parágrafo do perfil');
    expect(p).not.toContain('<w:jc ');
    expect(p).not.toContain('<w:ind ');
    const corpo = /<w:style [^>]*w:styleId="corpo".*?<\/w:style>/s.exec(estilos)?.[0] ?? '';
    expect(corpo).toContain('<w:jc w:val="both"/>');
    expect(corpo).toMatch(/<w:ind [^>]*w:firstLine="709"/);
  });
  it('o trecho centralizado sai centralizado e sem recuo de primeira linha', () => {
    const p = paragrafo('Trecho centralizado');
    expect(p).toContain('<w:jc w:val="center"/>');
    expect(p).toMatch(/<w:ind [^>]*w:firstLine="0"/);
  });
  it('o parágrafo à direita mantém o recuo do estilo', () => {
    const p = paragrafo('À direita, com recuo');
    expect(p).toContain('<w:jc w:val="right"/>');
    expect(p).not.toContain('<w:ind ');
  });
  it('lista com marcadores e numerada usam numerações próprias, e cada lista numerada recomeça', () => {
    expect(abstrato('bullet').some((a) => a.includes('w:lvlText w:val="•"'))).toBe(true);
    expect(abstrato('decimal').some((a) => a.includes('w:lvlText w:val="%1."'))).toBe(true);
    const num = (texto: string) => /<w:numId w:val="(\d+)"\/>/.exec(paragrafo(texto))?.[1];
    expect(num('primeiro marcador')).toBeDefined();
    expect(num('primeiro marcador')).toBe(num('segundo marcador'));
    expect(num('primeiro número')).toBe(num('terceiro número'));
    expect(num('primeiro número')).not.toBe(num('primeiro marcador'));
    expect(num('recomeça em 1')).not.toBe(num('primeiro número'));
    for (const texto of ['primeiro marcador', 'primeiro número']) expect(paragrafo(texto)).toContain('w:val="itemLista"');
  });
});
