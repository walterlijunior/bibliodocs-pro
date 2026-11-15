/**
 * Ficha catalográfica por arquivo (Etapa 3 da especificação de atualização): importa o texto de um arquivo .txt para o
 * campo da ficha, sem recriar o trabalho. O texto pode vir em UTF-8 ou no código de página do Windows (1252), como os
 * arquivos salvos pelo Bloco de Notas antigo. Com texto já no campo, pergunta antes de substituir.
 *
 * PDF (D-E3-04, decidido em 2026-11-15): o texto do PDF gerado pelo sistema da UFT é lido pelo pdf.js (`ficha-pdf.ts`).
 * PDF só com imagem (digitalizado) não tem texto: a mensagem pede para colar o texto ou usar outro arquivo.
 */
import { useId, useRef, useState } from 'react';
import { textoDoPdf } from './ficha-pdf';

/** Tamanho máximo do PDF da ficha (uma página, com fontes). */
export const BYTES_MAX_FICHA_PDF = 2 * 1024 * 1024;

const ehPdf = (arquivo: File, bytes: Uint8Array): boolean =>
  /\.pdf$/i.test(arquivo.name) || (bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);

/** Tamanho máximo do arquivo da ficha: uma ficha tem poucas centenas de caracteres. */
export const BYTES_MAX_FICHA = 64 * 1024;

/** Texto do arquivo: UTF-8 (com ou sem BOM) ou, se não for UTF-8 válido, Windows-1252. Fim de linha normalizado. */
export function textoDoArquivoDeFicha(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes);
  }
  return texto
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

export interface PropsImportarFicha {
  textoAtual: string;
  aoImportar: (texto: string) => void;
}

export function ImportarFicha(p: PropsImportarFicha) {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  const [pendente, setPendente] = useState<{ nome: string; texto: string } | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);

  const aplicar = (nome: string, texto: string) => {
    p.aoImportar(texto);
    setPendente(null);
    setAnuncio(`Texto da ficha importado de “${nome}”.`);
  };

  return (
    <div className="importar-ficha">
      <input
        ref={ref}
        id={id}
        type="file"
        accept=".txt,.pdf,text/plain,application/pdf"
        hidden
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          if (!arquivo) return;
          const pdf = /\.pdf$/i.test(arquivo.name) || arquivo.type === 'application/pdf';
          if (arquivo.size > (pdf ? BYTES_MAX_FICHA_PDF : BYTES_MAX_FICHA)) {
            setAnuncio(`“${arquivo.name}” é grande demais para uma ficha catalográfica (limite de ${pdf ? '2 MB' : '64 KB'}).`);
            return;
          }
          const bytes = new Uint8Array(await arquivo.arrayBuffer());
          let texto: string;
          if (ehPdf(arquivo, bytes)) {
            try {
              setAnuncio(`Lendo “${arquivo.name}”…`);
              texto = textoDoArquivoDeFicha(new TextEncoder().encode(await textoDoPdf(bytes)));
            } catch {
              setAnuncio(`“${arquivo.name}” não pôde ser lido como PDF. Confira o arquivo ou copie o texto da ficha e cole no campo.`);
              return;
            }
            if (texto.trim() === '') {
              setAnuncio(`“${arquivo.name}” não tem texto (pode ser uma imagem digitalizada): copie o texto da ficha e cole no campo.`);
              return;
            }
          } else texto = textoDoArquivoDeFicha(bytes);
          if (texto.trim() === '') {
            setAnuncio(`“${arquivo.name}” não tem texto.`);
            return;
          }
          if (p.textoAtual.trim() !== '') setPendente({ nome: arquivo.name, texto });
          else aplicar(arquivo.name, texto);
        }}
      />
      <button type="button" className="btn-secundario" onClick={() => ref.current?.click()}>
        Importar arquivo (PDF ou texto)…
      </button>
      {pendente && (
        <div className="importar-ficha__confirmar" role="group" aria-label="Substituir o texto da ficha">
          <p className="dica">O campo já tem texto. Substituir pelo de “{pendente.nome}”?</p>
          <button type="button" className="btn-principal" onClick={() => aplicar(pendente.nome, pendente.texto)}>
            Substituir
          </button>
          <button type="button" className="btn-secundario" onClick={() => setPendente(null)}>
            Manter o texto atual
          </button>
        </div>
      )}
      <p className="dica" role="status">
        {anuncio}
      </p>
    </div>
  );
}
