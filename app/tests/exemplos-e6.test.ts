/**
 * E6-T02 — exemplos completos por tipo de trabalho: válidos no formato, sem nenhuma não conformidade no verificador e
 * com as propriedades do DOCX conferidas (estrutura, estilos, margens, numeração de páginas, sumário, listas e
 * referências). A validação externa (OOXML, LibreOffice e Word) roda em `tests/externos`, que inclui estes exemplos.
 */
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import { formatar } from '../src/dominio/normas';
import { avaliarConformidade } from '../src/dominio/verificador/conformidade';
import { exportarDocx } from '../src/exportacao/docx';
import { TIPOS } from './corpus/corpus';
import { exemploCompleto, IMAGENS_EXEMPLOS } from './corpus/exemplos';
import { abrirDocx } from './apoio/docx-normalizado';

describe.each(TIPOS)('E6-T02: exemplo completo — %s', (tipo) => {
  const doc = exemploCompleto(tipo);

  it('válido no formato e sem nenhuma não conformidade', () => {
    expect(validarDocumentoV1(doc).ok).toBe(true);
    expect(avaliarConformidade(doc, PERFIL, { imagens: IMAGENS_EXEMPLOS })).toEqual({ problemas: [], diagnosticos: [] });
  });

  it('DOCX com A4, margens, estilos, paginação, sumário, listas, referências, imagens e pós-textuais', async () => {
    const formatado = formatar({ ...doc, imagens: IMAGENS_EXEMPLOS }, PERFIL);
    expect(formatado.regrasAguardando).toEqual([]);
    const bytes = await exportarDocx(formatado);
    const partes = abrirDocx(bytes);
    const xml = partes['word/document.xml']!;
    const estilos = partes['word/styles.xml']!;
    // A4 e margens 3/3/2/2 cm (RN-002, RN-018).
    expect(xml).toMatch(/<w:pgSz w:w="11906" w:h="16838"/);
    expect(xml).toMatch(/<w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701"/);
    // Estilos nomeados que o autor continua usando no Word.
    for (const nome of ['Heading1', 'Heading2', 'Heading3', 'Heading4', 'Heading5']) expect(estilos, nome).toContain(`w:styleId="${nome}"`);
    // Numeração de páginas: algarismo arábico a partir do texto (RN-067, RN-068).
    expect(xml).toMatch(/<w:pgNumType [^>]*w:start="\d+"/);
    // Sumário e listas em campo, com os títulos.
    expect(xml).toContain('SUMÁRIO');
    expect(xml).toContain('LISTA DE TABELAS');
    expect(xml).toMatch(/LISTA DE (ILUSTRAÇÕES|QUADROS|FIGURAS|GRÁFICOS)/u);
    expect(xml).toContain('LISTA DE ABREVIATURAS E SIGLAS');
    expect(xml).toContain('PAGEREF');
    // Referências em ordem alfabética, com as obras citadas.
    expect(xml).toContain('REFERÊNCIAS');
    // Rótulos, sigla na primeira ocorrência e pós-textuais.
    for (const r of ['Tabela 1', 'Quadro 1', 'Figura 1', 'Gráfico 1']) expect(xml, r).toContain(r);
    expect(xml).toContain('Universidade Federal do Tocantins (UFT)');
    expect(xml).toMatch(/APÊNDICE A/u);
    expect(xml).toMatch(/ANEXO A/u);
    expect(xml).toContain('GLOSSÁRIO');
    // A figura. O PNG do gráfico é desenhado no renderer ao exportar (D-M5-08), fora deste teste em Node; no app ele sai
    // com a imagem (`e2e/grafico.spec.ts`).
    expect(Object.keys(unzipSync(bytes)).filter((k) => k.startsWith('word/media/')).length).toBe(1);
  });
});
