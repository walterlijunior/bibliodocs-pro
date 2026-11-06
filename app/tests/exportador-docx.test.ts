// M3-T05 (RF-06; DOC-01 a DOC-07): do documento ao XML do DOCX, sem Word. O arquivo aberto no Word é conferido pelo script.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { criarTrabalhoDoTipo } from '../src/aplicacao/servicos/criar-trabalho';
import { formatar } from '../src/dominio/normas';
import type { Documento, Secao } from '../src/dominio/modelo';
import { exportarDocx } from '../src/exportacao/docx';
import { lerPedidoExportacao, lerRespostaExportacao, RESPOSTA_FALHA_EXPORTACAO } from '../src/principal/ipc/protocolo-exportacao';

const sec = (id: string, titulo: string, blocos: Secao['blocos'] = [], subsecoes: Secao[] = []): Secao => ({ id, titulo: [{ tipo: 'texto', texto: titulo }], blocos, subsecoes });
function trabalho(): Documento {
  let n = 0;
  const { documento } = criarTrabalhoDoTipo({ id: 'prj_Tipo000001', agora: new Date(0).toISOString(), appVersao: '0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
  return {
    ...documento,
    metadados: {
      titulo: [{ tipo: 'texto', texto: 'Estudo de ' }, { tipo: 'texto', texto: 'Caryocar brasiliense', marcas: ['italico'] }],
      autoria: 'Ana Souza',
      instituicao: 'Universidade Federal do Tocantins',
      local: 'Palmas, TO',
      ano: '2026',
      natureza: 'Monografia apresentada.',
      orientador: { titulacao: 'Dra.', nome: 'Bia Lima' },
    },
    preTextuais: documento.preTextuais!.map((e) => (e.tipo === 'fichaCatalografica' ? { ...e, texto: 'Dados da ficha' } : e.tipo === 'resumo' ? { ...e, texto: 'Resumo do trabalho', palavrasChave: ['Um', 'Dois'] } : e)),
    corpo: [
      sec('s1', 'Introdução', [
        { tipo: 'paragrafo', id: 'p1', conteudo: [{ tipo: 'texto', texto: 'Texto com nota' }, { tipo: 'nota', id: 'n1', conteudo: [{ tipo: 'texto', texto: 'Texto da nota' }] }, { tipo: 'texto', texto: ' e H' }, { tipo: 'texto', texto: '2', marcas: ['subscrito'] }, { tipo: 'texto', texto: 'O\nsegunda\tlinha' }] },
        { tipo: 'citacaoLonga', id: 'c1', conteudo: [{ tipo: 'texto', texto: 'Citação longa.' }] },
        { tipo: 'alineas', id: 'a1', itens: [{ conteudo: [{ tipo: 'texto', texto: 'um' }], subalineas: [[{ tipo: 'texto', texto: 'sub' }]] }, { conteudo: [{ tipo: 'texto', texto: 'dois' }] }] },
        { tipo: 'alineas', id: 'a2', itens: [{ conteudo: [{ tipo: 'texto', texto: 'outra lista' }] }] },
      ], [sec('s2', 'Secundária', [], [sec('s3', 'Terciária')])]),
      sec('s4', 'Considerações finais'),
    ],
    posTextuais: [{ tipo: 'referencias', id: 'r' }, { tipo: 'apendice', id: 'ap', titulo: 'Roteiro' }],
  } as Documento;
}

let partes: Record<string, string>;
let bytes: Uint8Array;
beforeAll(async () => {
  bytes = await exportarDocx(formatar(trabalho(), PERFIL));
  // Para conferir no Word: `SAIDA_DOCX=x.docx npx vitest run tests/exportador-docx.test.ts` e o script de ferramentas/word.
  if (process.env['SAIDA_DOCX']) writeFileSync(process.env['SAIDA_DOCX'], bytes);
  const z = unzipSync(bytes);
  partes = Object.fromEntries(Object.entries(z).filter(([n]) => /\.(xml|rels)$/.test(n)).map(([n, b]) => [n, strFromU8(b)]));
});
const doc = () => partes['word/document.xml']!;
const estilo = (id: string): string => new RegExp(`<w:style [^>]*w:styleId="${id}".*?</w:style>`, 's').exec(partes['word/styles.xml']!)?.[0] ?? '';
const secoes = () => doc().match(/<w:sectPr.*?<\/w:sectPr>/gs) ?? [];

describe('pacote', () => {
  it('todas as partes são XML bem formado', () => {
    for (const [n, x] of Object.entries(partes)) expect(XMLValidator.validate(x), n).toBe(true);
  });
  it('todo estilo usado está definido, e toda numeração usada existe', () => {
    const ids = new Set([...partes['word/styles.xml']!.matchAll(/w:styleId="([^"]+)"/g)].map((m) => m[1]));
    const usados = [...`${doc()}${partes['word/footnotes.xml']}`.matchAll(/<w:(?:pStyle|rStyle) w:val="([^"]+)"/g)].map((m) => m[1]!);
    expect(usados.filter((u) => !ids.has(u))).toEqual([]);
    const definidos = new Set([...partes['word/numbering.xml']!.matchAll(/<w:num w:numId="(\d+)"/g)].map((m) => m[1]));
    for (const m of doc().matchAll(/<w:numId w:val="(\d+)"/g)) if (m[1] !== '0') expect(definidos.has(m[1]), m[1]).toBe(true);
  });
  it('metadados com autor e título, sem o nome padrão da biblioteca', () => {
    const c = partes['docProps/core.xml']!;
    expect(c).toContain('Ana Souza');
    expect(c).toContain('Estudo de Caryocar brasiliense');
    expect(c).not.toContain('Un-named');
  });
  it('analisa com o parser usado na regressão', () => {
    expect(new XMLParser({ ignoreAttributes: false }).parse(doc())['w:document']).toBeDefined();
  });
});

describe('página e seções (DOC-01, DOC-02)', () => {
  it('seis seções em A4 com as margens da norma e cabeçalho a 1,25 cm', () => {
    expect(secoes()).toHaveLength(6);
    for (const s of secoes()) {
      expect(s).toMatch(/<w:pgSz [^>]*w:w="11906"[^>]*w:h="16838"/);
      expect(s).toMatch(/w:top="1701"/);
      expect(s).toMatch(/w:left="1701"/);
      expect(s).toMatch(/w:bottom="1134"/);
      expect(s).toMatch(/w:right="1134"/);
      expect(s).toMatch(/w:header="709"/);
    }
  });
  it('contagem começa uma vez, na folha de rosto; número só do texto em diante (RN-067, RN-068)', () => {
    expect(secoes().map((s) => /w:start="1"/.test(s))).toEqual([false, true, false, false, false, false]);
    expect(secoes().map((s) => /headerReference/.test(s))).toEqual([false, false, false, false, true, true]);
    const cab = Object.entries(partes).filter(([n]) => /word\/header\d+\.xml/.test(n)).map(([, x]) => x);
    expect(cab.some((x) => x.includes('w:val="numeroPagina"') && x.includes('PAGE'))).toBe(true);
  });
  it('capa e folha de rosto distribuídas; ficha no pé', () => {
    expect(secoes().map((s) => /<w:vAlign w:val="(\w+)"/.exec(s)?.[1])).toEqual(['both', 'both', 'bottom', undefined, undefined, undefined]);
  });
});

describe('estilos em XML (DOC-03 a DOC-06)', () => {
  it('corpo: Times 12, 1,5, justificado, 709', () => {
    const e = estilo('corpo');
    expect(e).toContain('w:ascii="Times New Roman"');
    expect(e).toMatch(/<w:sz w:val="24"/);
    expect(e).toMatch(/w:line="360"/);
    expect(e).toMatch(/<w:jc w:val="both"/);
    expect(e).toMatch(/w:firstLine="709"/);
    expect(e).toContain('Corpo do texto');
  });
  it('citação longa: 2268, 10 pt, simples, 18 pt', () => {
    const e = estilo('citacaoLonga');
    expect(e).toMatch(/w:left="2268"/);
    expect(e).toMatch(/<w:sz w:val="20"/);
    expect(e).toMatch(/w:line="240"/);
    expect(e).toMatch(/w:before="360"/);
    expect(e).toMatch(/w:after="360"/);
  });
  it('título 1: maiúsculas, negrito, nível 0, quebra de página, numeração no estilo', () => {
    const e = estilo('titulo1');
    expect(e).toContain('<w:caps/>');
    expect(e).toContain('<w:b/>');
    expect(e).toContain('<w:pageBreakBefore/>');
    expect(e).toContain('<w:keepNext/>');
    expect(e).toMatch(/<w:outlineLvl w:val="0"/);
    expect(e).toMatch(/<w:numPr>/);
  });
  it('títulos 4 e 5: itálico e sublinhado', () => {
    expect(estilo('titulo4')).toContain('<w:i/>');
    expect(estilo('titulo5')).toContain('<w:u ');
  });
  it('título pós-textual tem nível de estrutura e não tem número; o pré-textual não tem nível', () => {
    expect(estilo('tituloPosTextual')).toMatch(/<w:outlineLvl w:val="0"/);
    expect(estilo('tituloPosTextual')).not.toMatch(/<w:numPr>/);
    expect(estilo('tituloSemIndicativo')).not.toMatch(/outlineLvl/);
  });
  it('nota: 10 pt, simples', () => {
    expect(estilo('textoNota')).toMatch(/<w:sz w:val="20"/);
    expect(estilo('textoNota')).toMatch(/w:line="240"/);
  });
});

describe('conteúdo', () => {
  it('nota real, com o texto em footnotes.xml', () => {
    expect(doc()).toMatch(/<w:footnoteReference w:id="1"/);
    expect(partes['word/footnotes.xml']).toContain('Texto da nota');
    expect(partes['word/footnotes.xml']).toMatch(/<w:pStyle w:val="textoNota"/);
  });
  it('marcas, quebra de linha e tabulação', () => {
    expect(doc()).toMatch(/<w:vertAlign w:val="subscript"\/>.*?<w:t[^>]*>2<\/w:t>/s);
    expect(doc()).toContain('<w:i/>');
    expect(doc()).toContain('<w:br/>');
    expect(doc()).toMatch(/segunda<\/w:t><w:tab\/><w:t[^>]*>linha/);
  });
  it('cada lista de alíneas tem numeração própria, para recomeçar em a)', () => {
    const p = (texto: string) => doc().match(new RegExp(`<w:p>(?:(?!</w:p>).)*>${texto}<`, 's'))?.[0] ?? '';
    const id = (texto: string) => /<w:numId w:val="(\d+)"/.exec(p(texto))?.[1];
    expect(id('um')).toBeDefined();
    expect(id('um')).toBe(id('dois'));
    expect(id('um')).not.toBe(id('outra lista'));
    expect(partes['word/numbering.xml']).toMatch(/<w:lvlText w:val="%1\)"/);
    expect(partes['word/numbering.xml']).toMatch(/<w:numFmt w:val="lowerLetter"/);
    expect(partes['word/numbering.xml']).toMatch(/<w:ind w:left="1134" w:hanging="425"/);
  });
  it('sumário em campo, com indicativo e página estimada; título 1 em maiúsculas no próprio texto', () => {
    expect(doc()).toMatch(/TOC [^<]*\\u/);
    expect(doc()).toMatch(/1 INTRODUÇÃO/);
    expect(doc()).toMatch(/1\.1 Secundária/);
    expect(doc()).toMatch(/REFERÊNCIAS/);
    expect(doc()).toMatch(/w:name="_Toc_1"/);
    expect(estilo('TOC1')).toMatch(/w:line="360"/);
    // Com as páginas calculadas, o Word não precisa perguntar se atualiza os campos ao abrir (L4).
    expect(/<w:fldChar[^>]*w:dirty="true"/.test(doc())).toBe(false);
  });
  it('ficha numa caixa deitada de 12,5 × 7,5 cm (largura × altura; Manual, Fig. 6, p. 35)', () => {
    expect(doc()).toMatch(/<w:tblW w:type="dxa" w:w="7088"|<w:tblW w:w="7088"/);
    expect(doc()).toMatch(/<w:trHeight [^>]*w:val="4253"/);
    expect(doc()).toMatch(/<w:trHeight [^>]*w:hRule="exact"/);
    expect(doc()).toContain('Dados da ficha');
  });
  it('apêndice com o travessão da decisão C-A5', () => {
    expect(doc()).toContain('APÊNDICE A – Roteiro');
  });
  it('seção além do quinto nível sai com indicativo em texto, sem a numeração do Word', async () => {
    let s = sec('n6', 'Seis');
    for (let i = 5; i >= 1; i--) s = sec(`n${i}`, `N${i}`, [], [s]);
    const x = strFromU8(unzipSync(await exportarDocx(formatar({ corpo: [s] }, PERFIL)))['word/document.xml']!);
    expect(x).toContain('1.1.1.1.1.1 ');
    expect(x).toMatch(/<w:numId w:val="0"/);
  });
});

describe('fronteira e protocolo', () => {
  it('o exportador não cita RN nem lê perfil', () => {
    const fonte = readFileSync(join(__dirname, '..', 'src', 'exportacao', 'docx', 'exportador.ts'), 'utf8');
    expect(fonte).not.toMatch(/\bRN-\d{3}\b/);
    expect(fonte).not.toMatch(/perfil/i);
  });
  it('recusa pedido e resposta fora do protocolo', () => {
    expect(lerPedidoExportacao({})).toBeNull();
    expect(lerPedidoExportacao({ formatado: { secoes: [], estilos: [] } })).toBeNull();
    expect(lerPedidoExportacao({ formatado: { secoes: [], estilos: [], pagina: {} } })).not.toBeNull();
    expect(lerRespostaExportacao({ ok: true, bytes: 'x' })).toBeNull();
    expect(lerRespostaExportacao({ ok: false })).toEqual(RESPOSTA_FALHA_EXPORTACAO);
    expect(lerRespostaExportacao({ ok: true, bytes: new Uint8Array(1) })).toMatchObject({ ok: true });
  });
});
