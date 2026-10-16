// Lê os arquivos de código de app/src/ para os testes de arquitetura (M1-T03).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArquivoFonte } from './analisador-fontes';

/** Extensões de código analisadas (index.html e CSS ficam de fora: não têm import de módulo TS). */
export const EXTENSOES_CODIGO = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/** Todos os arquivos de código em `<raizApp>/src`, com caminho relativo à raiz do app e separador '/'. */
export function lerFontesDoSrc(raizApp: string): ArquivoFonte[] {
  const entradas = readdirSync(join(raizApp, 'src'), { recursive: true, encoding: 'utf8' });
  return entradas
    .map((relativo) => relativo.split('\\').join('/'))
    .filter((relativo) => EXTENSOES_CODIGO.test(relativo))
    .sort()
    .map((relativo) => ({
      arquivo: `src/${relativo}`,
      conteudo: readFileSync(join(raizApp, 'src', relativo), 'utf8'),
    }));
}
