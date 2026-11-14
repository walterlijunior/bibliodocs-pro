/**
 * Ficha catalográfica por arquivo (Etapa 3 da especificação de atualização): importa o texto de um arquivo .txt para o
 * campo da ficha, sem recriar o trabalho. O texto pode vir em UTF-8 ou no código de página do Windows (1252), como os
 * arquivos salvos pelo Bloco de Notas antigo. Com texto já no campo, pergunta antes de substituir.
 *
 * PDF: não é lido aqui. A leitura de PDF pede uma biblioteca nova no aplicativo (decisão pendente do usuário); até lá, o
 * texto do PDF gerado pelo sistema da UFT pode ser copiado e colado no campo.
 */
import { useId, useRef, useState } from 'react';

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
        accept=".txt,text/plain"
        hidden
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          if (!arquivo) return;
          if (arquivo.size > BYTES_MAX_FICHA) {
            setAnuncio(`“${arquivo.name}” é grande demais para uma ficha catalográfica (limite de 64 KB).`);
            return;
          }
          const texto = textoDoArquivoDeFicha(new Uint8Array(await arquivo.arrayBuffer()));
          if (texto.trim() === '') {
            setAnuncio(`“${arquivo.name}” não tem texto.`);
            return;
          }
          if (p.textoAtual.trim() !== '') setPendente({ nome: arquivo.name, texto });
          else aplicar(arquivo.name, texto);
        }}
      />
      <button type="button" className="btn-secundario" onClick={() => ref.current?.click()}>
        Importar arquivo de texto…
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
