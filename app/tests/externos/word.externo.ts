// M3-T07 (DOC-08; R47): abre no Word real, em somente leitura. Aprovar aqui não prova ausência de reparo: o validador OOXML
// cobre o esquema, e a conferência manual fica no fechamento do marco.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avisarPulo, gravarCorpus, RAIZ_APP, rodar, type Corpus } from './apoio';

const POWERSHELL = 'powershell.exe';
const temWord = process.platform === 'win32'
  && spawnSync(POWERSHELL, ['-NoProfile', '-Command', "if (Test-Path 'Registry::HKEY_CLASSES_ROOT\\Word.Application') { exit 0 } else { exit 1 }"]).status === 0;
if (!temWord) avisarPulo('Microsoft Word');
const SCRIPT = join(RAIZ_APP, 'ferramentas', 'word', 'conferir-no-word.ps1');

interface Relatorio {
  abriu: boolean;
  erro?: string;
  paginas: number;
  paginasDepois?: number;
  secoes: number;
  notas: number;
  sumarios: number;
  sumarioGravado?: string;
  sumarioAtualizado?: string;
}

describe.skipIf(!temWord)('Microsoft Word', () => {
  let corpus: Corpus;
  beforeAll(async () => {
    corpus = await gravarCorpus();
  });
  afterAll(() => corpus?.apagar());
  const abrir = async (nome: string): Promise<Relatorio> => {
    const caminho = corpus.arquivos.find((a) => a.nome === nome)!.caminho;
    const r = await rodar(POWERSHELL, ['-NoProfile', '-File', SCRIPT, '-Arquivo', caminho], 150_000);
    return JSON.parse(r.saida) as Relatorio;
  };
  const limpo = (s: string | undefined) => (s ?? '').replace(/[\r\n]+$/, '');

  it.each(['monografia', 'artigo-tcc', 'dissertacao', 'tese', 'relatorio-tecnico', 'projeto-pesquisa', 'documento-dificil'])('%s abre', async (nome) => {
    const r = await abrir(nome);
    expect(r.erro).toBeUndefined();
    expect(r.abriu).toBe(true);
    expect(r.paginas).toBeGreaterThan(1);
    expect(r.sumarios).toBe(1);
    // As páginas gravadas valem o mesmo que as calculadas pelo Word.
    expect(limpo(r.sumarioAtualizado)).toBe(limpo(r.sumarioGravado));
    expect(r.paginasDepois).toBe(r.paginas);
  });

  it('documento difícil: notas e seções como previsto', async () => {
    const r = await abrir('documento-dificil');
    expect(r.notas).toBe(4); // a 4.ª é a nota com citação (M4-T07)
    expect(r.secoes).toBe(6);
    expect(r.sumarioGravado).toContain('1.1.1.1.1 Seção quinária');
    expect(r.sumarioGravado).toContain('REFERÊNCIAS');
  });
});
