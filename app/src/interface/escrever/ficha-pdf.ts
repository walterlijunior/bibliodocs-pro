/**
 * Texto da ficha catalográfica de um PDF (Etapa 3 da especificação; D-E3-04, decisão do usuário em 2026-11-15 de fazer
 * tudo): o sistema da UFT entrega a ficha em PDF. O pdf.js (pdfjs-dist 6.4.299, Apache-2.0, a mesma versão dos testes externos) lê só o texto, no renderer,
 * com o worker do próprio pacote (mesma origem `app://`, permitido pela CSP `script-src 'self'`). Sem execução de
 * scripts do PDF (a versão 6 não avalia código do arquivo; XFA desligado), sem fontes embutidas (`disableFontFace`) e sem rede (os bytes já estão aqui).
 * Carregado sob demanda (`import()`): o restante do aplicativo não paga o tamanho da biblioteca.
 */
import urlWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Uma ficha cabe em uma página; lê no máximo três (capa da ficha + verso). */
const PAGINAS_MAX = 3;

/** Linhas do texto do PDF, na ordem do conteúdo, com as quebras de linha que o próprio PDF marca. */
export async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;
  const tarefa = pdfjs.getDocument({ data: bytes, disableFontFace: true, useSystemFonts: false, stopAtErrors: true, enableXfa: false });
  const doc = await tarefa.promise;
  try {
    const partes: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, PAGINAS_MAX); n++) {
      const pagina = await doc.getPage(n);
      const conteudo = await pagina.getTextContent();
      for (const item of conteudo.items) {
        if (!('str' in item)) continue;
        partes.push(item.str);
        if (item.hasEOL) partes.push('\n');
      }
      partes.push('\n');
    }
    return partes.join('');
  } finally {
    await tarefa.destroy();
  }
}
