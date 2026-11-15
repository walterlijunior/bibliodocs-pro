/**
 * Ficha catalográfica em PDF (Etapa 3 da especificação; D-E3-04): o PDF com o texto da ficha (como o gerado pelo sistema
 * da UFT) entra no campo da ficha, linha por linha, com acentos; um PDF sem texto (imagem digitalizada) e um arquivo que
 * não é PDF dão mensagem e não mudam o campo. Os PDFs são montados aqui, com a fonte padrão Helvetica (WinAnsi).
 */
import { expect, test, type Page } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

/** PDF de uma página com as linhas dadas (Latin-1), cada uma numa linha do conteúdo. */
function pdfComLinhas(linhas: readonly string[]): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const conteudo = `BT /F1 10 Tf 14 TL 72 760 Td ${linhas.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let corpo = '%PDF-1.4\n';
  const posicoes: number[] = [];
  objetos.forEach((o, i) => {
    posicoes.push(Buffer.byteLength(corpo, 'latin1'));
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(corpo, 'latin1');
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, 'latin1');
}

const LINHAS = [
  'Dados Internacionais de Catalogação na Publicação (CIP)',
  'Sistema de Bibliotecas da Universidade Federal do Tocantins',
  'S586t Souza, Ana.',
  'Título fictício da monografia. / Ana Souza. - Palmas, TO, 2026.',
  '45 f.',
];

const elemento = (p: Page, nome: RegExp) => p.getByRole('navigation', { name: 'Elementos pré-textuais' }).getByRole('button', { name: nome });

test('Etapa 3: a ficha catalográfica em PDF entra no campo; PDF sem texto e arquivo inválido não mudam nada', async () => {
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await elemento(p, /^Ficha catalográfica/).click();
  const arquivo = p.locator('.importar-ficha input[type="file"]');
  const campo = p.getByLabel('Texto da ficha');

  await arquivo.setInputFiles({ name: 'ficha-uft.pdf', mimeType: 'application/pdf', buffer: pdfComLinhas(LINHAS) });
  await expect(p.getByText('Texto da ficha importado de “ficha-uft.pdf”.')).toBeVisible();
  await expect(campo).toHaveValue(LINHAS.join('\n'));

  // PDF só com imagem (sem texto): avisa e não muda o campo.
  await arquivo.setInputFiles({ name: 'digitalizada.pdf', mimeType: 'application/pdf', buffer: pdfComLinhas([]) });
  await expect(p.getByText(/“digitalizada\.pdf” não tem texto/)).toBeVisible();
  await expect(campo).toHaveValue(LINHAS.join('\n'));

  // Arquivo com extensão .pdf que não é PDF.
  await arquivo.setInputFiles({ name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('não sou um PDF') });
  await expect(p.getByText(/“falso\.pdf” não pôde ser lido como PDF/)).toBeVisible();
  await expect(campo).toHaveValue(LINHAS.join('\n'));
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
