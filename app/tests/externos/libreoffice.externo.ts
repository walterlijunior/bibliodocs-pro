// M3-T07 (ADR-0006, camada 7; DOC-07, DOC-08): o LibreOffice abre e converte, e o sumário aponta a página certa.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avisarPulo, gravarCorpus, primeiroExistente, rodar, type Corpus } from './apoio';

const soffice = primeiroExistente(process.env['SOFFICE'] ?? '', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe');
if (!soffice) avisarPulo('LibreOffice');

async function paginasDoPdf(caminho: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(readFileSync(caminho)), useSystemFonts: true });
  const pdf = await tarefa.promise;
  const paginas: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    paginas.push(c.items.map((x) => ('str' in x ? x.str : '')).join(' ').replace(/\s+/g, ' '));
  }
  await tarefa.destroy();
  return paginas;
}

describe.skipIf(!soffice)('LibreOffice', () => {
  let corpus: Corpus;
  const paginas = new Map<string, string[]>();
  beforeAll(async () => {
    corpus = await gravarCorpus();
    const perfil = pathToFileURL(join(corpus.pasta, 'perfil')).href;
    const saida = join(corpus.pasta, 'pdf');
    const r = await rodar(soffice!, ['--headless', '--norestore', `-env:UserInstallation=${perfil}`, '--convert-to', 'pdf', '--outdir', saida, ...corpus.arquivos.map((a) => a.caminho)], 280_000);
    if (r.codigo !== 0) throw new Error(`soffice falhou: ${r.codigo}`);
    for (const a of corpus.arquivos) paginas.set(a.nome, await paginasDoPdf(join(saida, `${a.nome}.pdf`)));
  });
  afterAll(() => corpus?.apagar());

  it.each(['monografia', 'artigo-tcc', 'dissertacao', 'tese', 'relatorio-tecnico', 'projeto-pesquisa', 'documento-dificil'])('%s converte, com a capa numa só página', (nome) => {
    const p = paginas.get(nome)!;
    expect(p.length).toBeGreaterThan(1);
    expect(p[0]).toContain('UNIVERSIDADE FEDERAL DO TOCANTINS');
    expect(p[0]).toMatch(/2026/);
    expect(p[1]).not.toContain('UNIVERSIDADE FEDERAL DO TOCANTINS');
  });

  it('sumário do documento difícil: cada entrada está na página que ele diz (DOC-07)', () => {
    const p = paginas.get('documento-dificil')!;
    const iSumario = p.findIndex((t) => t.startsWith('SUMÁRIO') || / SUMÁRIO /.test(` ${t} `));
    expect(iSumario).toBeGreaterThan(0);
    const entradas = [...p[iSumario]!.replace(/^.*?SUMÁRIO /, '').matchAll(/((?:\d+(?:\.\d+)* )?[A-ZÀ-Úa-zà-ú][^.]*?)\s*\.{3,}\s*(\d+)/g)].map((m) => [m[1]!.trim(), Number(m[2])] as const);
    expect(entradas.length).toBeGreaterThanOrEqual(8);
    // A capa não conta: a folha numerada n é a página física n + 1.
    for (const [titulo, n] of entradas) expect(p[n]!, `"${titulo}" na folha ${n}`).toContain(titulo.replace(/^[\d.]+ /, ''));
    expect(entradas.map(([t]) => t)).toEqual(expect.arrayContaining(['1 INTRODUÇÃO À AÇÃO', '1.1 Seção secundária', '1.1.1.1.1 Seção quinária', 'REFERÊNCIAS']));
  });

  it('número só do texto em diante, contando da folha de rosto (RN-067, RN-068)', () => {
    const p = paginas.get('documento-dificil')!;
    const iIntro = p.findIndex((t) => /1 INTRODUÇÃO À AÇÃO/.test(t) && !/\.{3}/.test(t));
    expect(iIntro).toBeGreaterThan(1);
    expect(p[iIntro]!.startsWith(String(iIntro)), 'número da folha no alto').toBe(true);
    expect(p[iIntro - 1]!.startsWith(String(iIntro - 1))).toBe(false);
  });
  it('M6-T01: listas de ilustrações e tabelas apontam às páginas iniciais dos elementos', () => {
    const p = paginas.get('documento-dificil')!;
    for (const titulo of ['LISTA DE ILUSTRAÇÕES', 'LISTA DE TABELAS']) {
      const lista = p.find((t) => t.includes(titulo));
      expect(lista, titulo).toBeDefined();
      const entradas = [...lista!.matchAll(/((?:Figura|Quadro|Tabela) \d+\s*–\s*[^.]+?)\s*\.{3,}\s*(\d+)/g)];
      expect(entradas.length, titulo).toBe(2);
      for (const e of entradas) expect(p[Number(e[2])]!, e[1]).toContain(e[1]!.trim());
    }
  });
});
