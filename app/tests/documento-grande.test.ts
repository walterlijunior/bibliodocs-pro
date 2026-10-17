/**
 * M2-T01: o gerador do documento grande produz um projeto válido do tamanho pedido, e de forma reprodutível. As medidas
 * de tempo (empacotar, validar o pacote recebido pelo IPC, ler) vão para o console, sem limite: o limite é conferido
 * no E2E de desempenho, no Electron real (e2e/desempenho.spec.ts).
 */
import { describe, expect, it } from 'vitest';
import { empacotarProjeto, lerProjeto } from '../src/persistencia';
import { lerPacoteTransferivel, paraTransferivel } from '../src/principal/ipc/argumentos';
import { CARACTERES_POR_PAGINA, gerarDocumentoGrande } from './apoio/documento-grande';

const medir = <T>(f: () => T): [T, number] => {
  const inicio = performance.now();
  const r = f();
  return [r, performance.now() - inicio];
};

describe('documento grande (M2-T01)', () => {
  const grande = gerarDocumentoGrande();

  it('tem cerca de 150 páginas e 25 MiB de mídia', () => {
    expect(grande.paginasEstimadas).toBeGreaterThanOrEqual(150);
    expect(grande.caracteres).toBeLessThan(151 * CARACTERES_POR_PAGINA);
    expect(grande.bytesMidias).toBe(25 * 1024 * 1024);
    expect(grande.pacote.midias.size).toBe(25);
    expect(grande.secoes).toBe(6 + 24 + 48);
  });

  it('empacota, relê e volta idêntico; a validação do IPC aceita', () => {
    const [empacotado, tEmpacotar] = medir(() => empacotarProjeto(grande.pacote));
    if (!empacotado.ok) throw new Error(JSON.stringify(empacotado.erros.slice(0, 3)));
    const [lido, tLer] = medir(() => lerProjeto(empacotado.bytes));
    if (!lido.ok) throw new Error(JSON.stringify(lido.erros.slice(0, 3)));
    expect(lido.pacote.documento).toEqual(grande.pacote.documento);
    expect(lido.pacote.manifesto).toEqual(grande.pacote.manifesto);

    const transferivel = structuredClone(paraTransferivel(grande.pacote));
    const [recebido, tValidar] = medir(() => lerPacoteTransferivel(transferivel));
    expect(recebido.ok).toBe(true);
    console.log(
      `[M2-T01] ${grande.paginasEstimadas} páginas, ${grande.paragrafos} parágrafos, ${(empacotado.bytes.length / 1048576).toFixed(1)} MiB: ` +
        `empacotar ${tEmpacotar.toFixed(0)} ms; ler ${tLer.toFixed(0)} ms; validar o pacote do IPC ${tValidar.toFixed(0)} ms`,
    );
  });

  it('é reprodutível', () => {
    const outro = gerarDocumentoGrande();
    expect(outro.pacote.documento).toEqual(grande.pacote.documento);
    expect(outro.pacote.manifesto.midias).toEqual(grande.pacote.manifesto.midias);
  });
});
