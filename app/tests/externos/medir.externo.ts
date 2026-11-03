// M3-T11 (RNF-06; ADR-0006, camada 9): tempo e memória da exportação no documento de 150 páginas. Mede no Node, sem o custo
// de passar o documento ao processo utilitário. Três rodadas, e vale o pior tempo contra a meta.
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../../src/aplicacao/perfil-padrao';
import { formatar } from '../../src/dominio/normas';
import { exportarDocx } from '../../src/exportacao/docx';
import { gerarDocumentoGrande } from '../apoio/documento-grande';

const META_EXPORTAR_MS = 10_000; // RNF-06

describe('medição', () => {
  it('exportar 150 páginas leva menos de 10 s', async () => {
    const { pacote, paginasEstimadas, secoes, paragrafos } = gerarDocumentoGrande({ paginas: 150, midias: 0 });
    const documento = {
      ...pacote.documento,
      preTextuais: [{ id: 'pre_sumariosumariosu', tipo: 'sumario' as const }],
    };
    const rodadas: { motorMs: number; docxMs: number; bytes: number; rssMb: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const f = formatar(documento, PERFIL);
      const t1 = performance.now();
      const bytes = await exportarDocx(f);
      rodadas.push({ motorMs: Math.round(t1 - t0), docxMs: Math.round(performance.now() - t1), bytes: bytes.length, rssMb: Math.round(process.memoryUsage().rss / 1048576) });
    }
    process.stderr.write(`[medir] ${paginasEstimadas} páginas, ${secoes} seções, ${paragrafos} parágrafos: ${JSON.stringify(rodadas)}
`);
    for (const r of rodadas) expect(r.motorMs + r.docxMs).toBeLessThan(META_EXPORTAR_MS);
  });
});
