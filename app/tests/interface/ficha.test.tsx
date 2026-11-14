// Etapa 3 da especificação de atualização — texto da ficha catalográfica por arquivo: UTF-8 (com ou sem BOM) ou
// Windows-1252, fim de linha normalizado, espaços nas pontas das linhas e linhas vazias nas pontas tirados.
import { describe, expect, it } from 'vitest';
import { textoDoArquivoDeFicha } from '../../src/interface/escrever/ImportarFicha';

describe('textoDoArquivoDeFicha', () => {
  it('UTF-8 com BOM e CRLF', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('S586a  Silva, Maria.\r\n   Estudo de caso. \r\n\r\n')]);
    expect(textoDoArquivoDeFicha(bytes)).toBe('S586a  Silva, Maria.\n   Estudo de caso.');
  });
  it('Windows-1252 (acentos de arquivo salvo no Bloco de Notas antigo)', () => {
    // "Cátia" com á = 0xE1 em Windows-1252, que não é UTF-8 válido.
    expect(textoDoArquivoDeFicha(new Uint8Array([0x43, 0xe1, 0x74, 0x69, 0x61]))).toBe('Cátia');
  });
});
