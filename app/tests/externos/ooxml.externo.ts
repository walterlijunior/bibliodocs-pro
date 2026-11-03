// M3-T07 (ADR-0006, camada 6; R47): esquema OOXML com o validador da Microsoft. É o controle que a automação do Word não dá.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avisarPulo, estragar, gravarCorpus, primeiroExistente, RAIZ_APP, rodar, type Corpus } from './apoio';

const dotnet = primeiroExistente('C:\\Program Files\\dotnet\\dotnet.exe');
if (!dotnet) avisarPulo('dotnet');
const projeto = join(RAIZ_APP, 'ferramentas', 'validar-ooxml');
const dll = join(projeto, 'bin', 'Release', 'net10.0', 'ValidarOoxml.dll');

describe.skipIf(!dotnet)('validador OOXML', () => {
  let corpus: Corpus;
  const validar = async (arquivo: string) => {
    const r = await rodar(dotnet!, [dll, arquivo], 120_000);
    return { codigo: r.codigo, json: JSON.parse(r.saida) as { abriu: boolean; erros?: { descricao: string; caminho: string; parte: string }[] } };
  };
  beforeAll(async () => {
    const env = { DOTNET_CLI_TELEMETRY_OPTOUT: '1' };
    // Restaura preso ao packages.lock.json: pacote diferente do aprovado reprova.
    const r = await rodar(dotnet!, ['restore', projeto, '--locked-mode', '--nologo'], 200_000, { env });
    if (r.codigo !== 0) throw new Error(`restauração do validador falhou: ${r.saida.slice(-800)}`);
    const b = await rodar(dotnet!, ['build', projeto, '-c', 'Release', '--no-restore', '--nologo', '-v', 'q'], 200_000, { env });
    if (b.codigo !== 0) throw new Error(`build do validador falhou: ${b.saida.slice(-800)}`);
    corpus = await gravarCorpus();
  });
  afterAll(() => corpus?.apagar());

  it.each(['monografia', 'artigo-tcc', 'dissertacao', 'tese', 'relatorio-tecnico', 'projeto-pesquisa', 'documento-dificil'])('%s é válido', async (nome) => {
    const { codigo, json } = await validar(corpus.arquivos.find((a) => a.nome === nome)!.caminho);
    expect(json.erros ?? [], JSON.stringify(json.erros?.slice(0, 5))).toEqual([]);
    expect(codigo).toBe(0);
  });

  it.each([
    ['parágrafo com tabela dentro', '<w:p><w:tbl/></w:p></w:body>'],
    ['elemento desconhecido', '<w:naoexiste/></w:body>'],
  ])('controle: reprova %s, que a automação do Word deixou passar', async (_n, trecho) => {
    const destino = join(corpus.pasta, 'estragado.docx');
    estragar(readFileSync(corpus.arquivos[0]!.caminho), (x) => x.replace('</w:body>', trecho), destino);
    const { codigo, json } = await validar(destino);
    expect(codigo).toBe(1);
    expect(json.erros!.length).toBeGreaterThan(0);
  });
});
