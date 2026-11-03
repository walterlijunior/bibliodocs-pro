// Apoio dos testes com programas externos (M3-T07): grava o corpus em DOCX numa pasta temporária.
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { PERFIL_UFT_2022 as PERFIL } from '../../src/aplicacao/perfil-padrao';
import { formatar } from '../../src/dominio/normas';
import { exportarDocx } from '../../src/exportacao/docx';
import { documentoDificil, TIPOS, trabalhoDoTipo } from '../corpus/corpus';

export const RAIZ_APP = join(__dirname, '..', '..');

export interface Corpus {
  pasta: string;
  arquivos: readonly { nome: string; caminho: string }[];
  apagar(): void;
}

export async function gravarCorpus(): Promise<Corpus> {
  const pasta = mkdtempSync(join(tmpdir(), 'bdp-externos-'));
  const documentos = [...TIPOS.map((t) => [t, trabalhoDoTipo(t)] as const), ['documento-dificil', documentoDificil()] as const];
  const arquivos = [];
  for (const [nome, d] of documentos) {
    const caminho = join(pasta, `${nome}.docx`);
    writeFileSync(caminho, await exportarDocx(formatar(d, PERFIL)));
    arquivos.push({ nome, caminho });
  }
  return { pasta, arquivos, apagar: () => rmSync(pasta, { recursive: true, force: true, maxRetries: 3 }) };
}

/** Cópia com uma parte trocada: controle negativo, para provar que a ferramenta reprova o que deve. */
export function estragar(origem: Uint8Array, troca: (xml: string) => string, destino: string): void {
  const z = unzipSync(origem);
  const doc = new TextDecoder().decode(z['word/document.xml']!);
  writeFileSync(destino, zipSync({ ...z, 'word/document.xml': strToU8(troca(doc)) }));
}

export function rodar(programa: string, args: readonly string[], tempoMs: number, opcoes: { env?: NodeJS.ProcessEnv; cwd?: string } = {}): Promise<{ codigo: number; saida: string; erro: string }> {
  return new Promise((resolver) => {
    execFile(programa, [...args], { timeout: tempoMs, maxBuffer: 50 * 1024 * 1024, env: { ...process.env, ...opcoes.env }, ...(opcoes.cwd ? { cwd: opcoes.cwd } : {}) }, (falha, saida, erro) => {
      const codigo = falha === null ? 0 : typeof falha.code === 'number' ? falha.code : -1;
      resolver({ codigo, saida, erro });
    });
  });
}

export const primeiroExistente = (...caminhos: string[]): string | null => caminhos.find((c) => existsSync(c)) ?? null;

export function avisarPulo(programa: string): void {
  console.warn(`[externos] ${programa} não encontrado: grupo pulado.`);
}
