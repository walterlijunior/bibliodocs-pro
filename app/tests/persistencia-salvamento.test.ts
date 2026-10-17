// Testes do grupo PER (M1-T06): salvamento atômico e abertura do disco (ADR-0004, seção 4, e adendo do M1-T06).
// Usam uma pasta temporária real; as falhas são injetadas por um SistemaArquivos que embrulha o real.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Documento } from '../src/dominio/modelo';
import type { Manifesto } from '../src/dominio/esquemas';
import {
  abrirProjeto,
  ESPERAS_TENTATIVAS_MS,
  gravarAtomico,
  LIMITES_CONTEINER,
  MENSAGENS_FALHA,
  salvarProjeto,
  SISTEMA_ARQUIVOS_NODE,
  type PacoteProjeto,
  type SistemaArquivos,
} from '../src/persistencia';

const pastaFixtures = join(__dirname, 'fixtures', 'projeto-v1');
const lerFixture = <T>(nome: string): T => JSON.parse(readFileSync(join(pastaFixtures, nome), 'utf8')) as T;
const texto = (s: string) => new TextEncoder().encode(s);
const PNG_CABECALHO = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pacoteValido(midia?: Uint8Array): PacoteProjeto {
  const documento = lerFixture<Documento>('documento-valido.json');
  const manifesto = lerFixture<Manifesto>('manifesto-valido.json');
  const midias = new Map<string, Uint8Array>();
  manifesto.midias = [];
  if (midia) {
    const h = createHash('sha256').update(midia).digest('hex');
    midias.set(h, midia);
    manifesto.midias = [{ caminho: `midias/${h}.png`, sha256: h, bytes: midia.length, tipo: 'image/png' }];
  }
  return { manifesto, documento, midias };
}

const erro = (code: string) => Object.assign(new Error(code), { code });

let pasta: string;
beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'bdp-salvar-'));
});
afterEach(() => {
  for (const n of readdirSync(pasta)) chmodSync(join(pasta, n), 0o666);
  rmSync(pasta, { recursive: true, force: true });
});

const ler = (nome: string) => readFileSync(join(pasta, nome), 'utf8');
const arquivos = () => readdirSync(pasta).sort();
const temporarios = () => arquivos().filter((n) => n.includes('.tmp-'));

/** Sistema real com ganchos para injetar falhas antes de cada operação. */
function comFalhas(ganchos: Partial<Record<keyof SistemaArquivos, (...args: string[]) => void | Promise<void>>>): SistemaArquivos {
  const fs = SISTEMA_ARQUIVOS_NODE;
  return {
    info: async (c) => (await ganchos.info?.(c), fs.info(c)),
    criarExclusivo: async (c) => (await ganchos.criarExclusivo?.(c), fs.criarExclusivo(c)),
    abrirLeitura: async (c) => (await ganchos.abrirLeitura?.(c), fs.abrirLeitura(c)),
    renomear: async (a, b) => (await ganchos.renomear?.(a, b), fs.renomear(a, b)),
    copiar: async (a, b) => (await ganchos.copiar?.(a, b), fs.copiar(a, b)),
    sincronizar: async (c) => (await ganchos.sincronizar?.(c), fs.sincronizar(c)),
    tornarGravavel: async (c) => (await ganchos.tornarGravavel?.(c), fs.tornarGravavel(c)),
    apagar: async (c) => (await ganchos.apagar?.(c), fs.apagar(c)),
    criarPasta: async (c) => (await ganchos.criarPasta?.(c), fs.criarPasta(c)),
    listarPasta: async (c) => (await ganchos.listarPasta?.(c), fs.listarPasta(c)),
    vincular: async (a, b) => (await ganchos.vincular?.(a, b), fs.vincular(a, b)),
    apagarPasta: async (c) => (await ganchos.apagarPasta?.(c), fs.apagarPasta(c)),
    definirModificacao: async (c, ms) => (await ganchos.definirModificacao?.(c), fs.definirModificacao(c, ms)),
  };
}

/** Opções sem espera real, registrando as esperas pedidas. */
function semEspera() {
  const esperas: number[] = [];
  // Cede ao laço de eventos: uma regressão que repita sem fim vira timeout do teste, não trava a suíte.
  const aguardar = (ms: number) => new Promise<void>((ok) => (esperas.push(ms), setImmediate(ok)));
  return { esperas, opcoes: { aguardar } };
}

const ehTroca = (de: string, para: string) => de.includes('.bdp.tmp-') && para.endsWith('.bdp');
const somenteLeitura = (c: string) => (statSync(c).mode & 0o200) === 0;

describe('gravarAtomico — caminho feliz', () => {
  it('arquivo novo: grava, não cria .bak, não deixa temporário', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    const r = await gravarAtomico(destino, texto('v1'));
    expect(r).toMatchObject({ ok: true, caminho: destino, bak: null, avisos: [], tentativas: 1 });
    expect(arquivos()).toEqual(['trabalho.bdp']);
    expect(ler('trabalho.bdp')).toBe('v1');
  });

  it('arquivo existente: substitui e guarda o anterior no .bak; o .bak seguinte substitui o anterior', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    const r2 = await gravarAtomico(destino, texto('v2'));
    expect(r2).toMatchObject({ ok: true, bak: `${destino}.bak` });
    expect([ler('trabalho.bdp'), ler('trabalho.bdp.bak')]).toEqual(['v2', 'v1']);
    await gravarAtomico(destino, texto('v3'));
    expect([ler('trabalho.bdp'), ler('trabalho.bdp.bak')]).toEqual(['v3', 'v2']);
    expect(arquivos()).toEqual(['trabalho.bdp', 'trabalho.bdp.bak']);
  });

  it('o temporário fica no mesmo diretório, com pid e sufixo aleatório', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    const vistos: string[] = [];
    await gravarAtomico(destino, texto('v1'), { fs: comFalhas({ criarExclusivo: (c) => void vistos.push(c) }), aleatorio: () => 'abcd1234' });
    expect(vistos).toEqual([`${destino}.tmp-${process.pid}-abcd1234`]);
  });
});

describe('gravarAtomico — falhas', () => {
  it('falha injetada entre o .bak e a troca: no momento da falha o original e o .bak estão íntegros', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'original');
    writeFileSync(`${destino}.bak`, 'bak-antigo');
    let estadoNaFalha: string[] = [];
    const fs = comFalhas({
      renomear: (de, para) => {
        if (!ehTroca(de, para)) return;
        estadoNaFalha = [ler('trabalho.bdp'), ler('trabalho.bdp.bak')];
        throw erro('EIO'); // queda simulada: nada depois deste ponto acontece
      },
    });
    const r = await gravarAtomico(destino, texto('novo'), { fs });
    expect(estadoNaFalha).toEqual(['original', 'original']);
    expect(r).toMatchObject({ ok: false, codigo: 'FALHA_E_S', detalhe: 'EIO' });
    expect(ler('trabalho.bdp')).toBe('original');
    expect(ler('trabalho.bdp.bak')).toBe('original');
    // O temporário completo fica para a recuperação (M1-T12).
    expect(temporarios()).toHaveLength(1);
    expect(ler(temporarios()[0]!)).toBe('novo');
    if (!r.ok) expect(r.temporario).toBe(join(pasta, temporarios()[0]!));
  });

  it('EPERM transitório na troca: repete com espera crescente e salva', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    let falhas = 2;
    const fs = comFalhas({
      renomear: (de, para) => {
        if (ehTroca(de, para) && falhas-- > 0) throw erro('EPERM');
      },
    });
    const { esperas, opcoes } = semEspera();
    const r = await gravarAtomico(destino, texto('v2'), { fs, ...opcoes });
    expect(r).toMatchObject({ ok: true, tentativas: 3 });
    expect(esperas).toEqual([50, 100]);
    expect(ler('trabalho.bdp')).toBe('v2');
    expect(temporarios()).toEqual([]);
  });

  it.each(['EPERM', 'EBUSY', 'EACCES'])('%s persistente: 6 tentativas, mensagem de arquivo em uso, original intacto', async (codigo) => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    let trocas = 0;
    const fs = comFalhas({
      renomear: (de, para) => {
        if (!ehTroca(de, para)) return;
        trocas++;
        throw erro(codigo);
      },
    });
    const { esperas, opcoes } = semEspera();
    const r = await gravarAtomico(destino, texto('v2'), { fs, ...opcoes });
    expect(trocas).toBe(6);
    expect(esperas).toEqual([...ESPERAS_TENTATIVAS_MS]);
    expect(r).toMatchObject({ ok: false, codigo: 'EM_USO', mensagem: MENSAGENS_FALHA.EM_USO, detalhe: codigo });
    expect(ler('trabalho.bdp')).toBe('v1');
    expect(temporarios()).toHaveLength(1);
  });

  it('erro não transitório na troca não é repetido', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    let trocas = 0;
    const fs = comFalhas({
      renomear: (de, para) => {
        if (ehTroca(de, para)) {
          trocas++;
          throw erro('EXDEV');
        }
      },
    });
    const r = await gravarAtomico(destino, texto('v1'), { fs, ...semEspera().opcoes });
    expect(trocas).toBe(1);
    expect(r).toMatchObject({ ok: false, codigo: 'FALHA_E_S' });
  });

  it('disco cheio ao gravar o temporário: apaga o temporário parcial, original intacto', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    const fs: SistemaArquivos = {
      ...SISTEMA_ARQUIVOS_NODE,
      criarExclusivo: async (c) => {
        const a = await SISTEMA_ARQUIVOS_NODE.criarExclusivo(c);
        return {
          ...a,
          gravarTudo: async (d) => {
            await a.gravarTudo(d.subarray(0, 1));
            throw erro('ENOSPC');
          },
        };
      },
    };
    const r = await gravarAtomico(destino, texto('v2'), { fs });
    expect(r).toMatchObject({ ok: false, codigo: 'SEM_ESPACO', temporario: null });
    expect(arquivos()).toEqual(['trabalho.bdp']);
    expect(ler('trabalho.bdp')).toBe('v1');
  });

  it('falha no fsync também descarta o temporário', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    const fs: SistemaArquivos = {
      ...SISTEMA_ARQUIVOS_NODE,
      criarExclusivo: async (c) => {
        const a = await SISTEMA_ARQUIVOS_NODE.criarExclusivo(c);
        return { ...a, sincronizar: () => Promise.reject(erro('EIO')) };
      },
    };
    const r = await gravarAtomico(destino, texto('v1'), { fs });
    expect(r).toMatchObject({ ok: false, codigo: 'FALHA_E_S' });
    expect(arquivos()).toEqual([]);
  });

  it('temporário com o mesmo nome já existente (EEXIST): não sobrescreve nem apaga o que não criou', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    const alheio = `${destino}.tmp-${process.pid}-fixo`;
    writeFileSync(alheio, 'alheio');
    const r = await gravarAtomico(destino, texto('v1'), { aleatorio: () => 'fixo' });
    expect(r.ok).toBe(false);
    expect(readFileSync(alheio, 'utf8')).toBe('alheio');
  });

  it('falha ao atualizar o .bak: salva mesmo assim, com aviso, sem deixar temporário do .bak', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    writeFileSync(`${destino}.bak`, 'v0');
    const fs = comFalhas({
      renomear: (_de, para) => {
        if (para.endsWith('.bak')) throw erro('EBUSY');
      },
    });
    const r = await gravarAtomico(destino, texto('v2'), { fs, ...semEspera().opcoes });
    expect(r).toMatchObject({ ok: true, bak: null });
    if (r.ok) expect(r.avisos).toHaveLength(1);
    expect(arquivos()).toEqual(['trabalho.bdp', 'trabalho.bdp.bak']);
    expect([ler('trabalho.bdp'), ler('trabalho.bdp.bak')]).toEqual(['v2', 'v0']);
  });

  it('destino que é pasta → DESTINO_INVALIDO, sem gravar nada', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    mkdirSync(destino);
    const r = await gravarAtomico(destino, texto('v1'));
    expect(r).toMatchObject({ ok: false, codigo: 'DESTINO_INVALIDO' });
    expect(arquivos()).toEqual(['trabalho.bdp']);
  });

  it('pasta de destino inexistente → PASTA_INEXISTENTE', async () => {
    const r = await gravarAtomico(join(pasta, 'nao-existe', 'trabalho.bdp'), texto('v1'));
    expect(r).toMatchObject({ ok: false, codigo: 'PASTA_INEXISTENTE', mensagem: MENSAGENS_FALHA.PASTA_INEXISTENTE });
  });

  it('nunca lança, mesmo com exceção sem código', async () => {
    const fs = comFalhas({
      info: () => {
        throw new Error('inesperado');
      },
    });
    await expect(gravarAtomico(join(pasta, 'x.bdp'), texto('v1'), { fs })).resolves.toMatchObject({ ok: false, codigo: 'FALHA_E_S' });
  });
});

describe('gravarAtomico — achados da revisão (M6)', () => {
  it('M6-01: destino somente leitura → SOMENTE_LEITURA na hora, sem tentativas e sem gravar nada', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    chmodSync(destino, 0o444);
    const { esperas, opcoes } = semEspera();
    const r = await gravarAtomico(destino, texto('v2'), opcoes);
    expect(r).toMatchObject({ ok: false, codigo: 'SOMENTE_LEITURA', mensagem: MENSAGENS_FALHA.SOMENTE_LEITURA, temporario: null });
    expect(esperas).toEqual([]);
    expect(arquivos()).toEqual(['trabalho.bdp']);
  });

  it('M6-01: o .bak não herda o somente leitura, e um .bak antigo somente leitura é substituído', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    writeFileSync(`${destino}.bak`, 'v0');
    chmodSync(`${destino}.bak`, 0o444);
    const r = await gravarAtomico(destino, texto('v2'));
    expect(r).toMatchObject({ ok: true, bak: `${destino}.bak`, avisos: [], tentativas: 1 });
    expect(ler('trabalho.bdp.bak')).toBe('v1');
    expect(somenteLeitura(`${destino}.bak`)).toBe(false);
  });

  it('M6-01: destino que vira somente leitura depois da conferência — o .bak sai gravável e íntegro', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    chmodSync(destino, 0o444);
    // Corrida simulada: a conferência do passo 1 ainda viu o arquivo gravável.
    const fs: SistemaArquivos = {
      ...SISTEMA_ARQUIVOS_NODE,
      info: async (c) => ({ ...(await SISTEMA_ARQUIVOS_NODE.info(c)), somenteLeitura: false }),
    };
    const r = await gravarAtomico(destino, texto('v2'), { fs, ...semEspera().opcoes });
    expect(r.ok).toBe(false); // a troca sobre um destino somente leitura dá EPERM
    expect(ler('trabalho.bdp')).toBe('v1');
    expect(ler('trabalho.bdp.bak')).toBe('v1');
    expect(somenteLeitura(`${destino}.bak`)).toBe(false);
  });

  it('M6-02: .bak e troca bloqueados dividem um único orçamento de esperas', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    const fs = comFalhas({
      copiar: () => {
        throw erro('EBUSY');
      },
      renomear: (de, para) => {
        if (ehTroca(de, para)) throw erro('EPERM');
      },
    });
    const { esperas, opcoes } = semEspera();
    const r = await gravarAtomico(destino, texto('v2'), { fs, ...opcoes });
    expect(esperas).toEqual([...ESPERAS_TENTATIVAS_MS]);
    expect(r).toMatchObject({ ok: false, codigo: 'EM_USO' });
    expect(ler('trabalho.bdp')).toBe('v1');
  });

  it('M6-04: o temporário de uma falha anterior é apagado no salvamento seguinte do mesmo destino', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    let bloqueado = true;
    const fs = comFalhas({
      renomear: (de, para) => {
        if (bloqueado && ehTroca(de, para)) throw erro('EPERM');
      },
    });
    for (const v of ['v2', 'v3']) expect((await gravarAtomico(destino, texto(v), { fs, ...semEspera().opcoes })).ok).toBe(false);
    expect(temporarios()).toHaveLength(1);
    expect(ler(temporarios()[0]!)).toBe('v3');
    bloqueado = false;
    expect((await gravarAtomico(destino, texto('v4'), { fs })).ok).toBe(true);
    expect(arquivos()).toEqual(['trabalho.bdp', 'trabalho.bdp.bak']);
  });

  it('M6-05: a cópia do .bak passa por fsync antes de entrar no lugar', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    const ordem: string[] = [];
    const fs = comFalhas({
      sincronizar: (c) => void ordem.push(`fsync ${c.includes('.bak.tmp-') ? 'bak-tmp' : c}`),
      renomear: (_de, para) => void ordem.push(`rename ${para.endsWith('.bak') ? 'bak' : 'destino'}`),
    });
    await gravarAtomico(destino, texto('v2'), { fs });
    expect(ordem).toEqual(['fsync bak-tmp', 'rename bak', 'rename destino']);
  });

  it('M6-08: temporário que some antes da troca (ENOENT) não vira "pasta inexistente"', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    const fs = comFalhas({
      renomear: (de, para) => {
        if (ehTroca(de, para)) throw erro('ENOENT');
      },
    });
    expect(await gravarAtomico(destino, texto('v1'), { fs })).toMatchObject({ ok: false, codigo: 'FALHA_E_S' });
  });

  it('M6-08: EBUSY ao criar o temporário é repetido; EACCES (pasta protegida) não', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    let ocupado = 2;
    const fsOcupado = comFalhas({
      criarExclusivo: () => {
        if (ocupado-- > 0) throw erro('EBUSY');
      },
    });
    const a = semEspera();
    expect(await gravarAtomico(destino, texto('v1'), { fs: fsOcupado, ...a.opcoes })).toMatchObject({ ok: true });
    expect(a.esperas).toEqual([50, 100]);
    const fsNegado = comFalhas({
      criarExclusivo: () => {
        throw erro('EACCES');
      },
    });
    const b = semEspera();
    expect(await gravarAtomico(destino, texto('v2'), { fs: fsNegado, ...b.opcoes })).toMatchObject({ ok: false, codigo: 'SEM_PERMISSAO' });
    expect(b.esperas).toEqual([]);
  });

  it('M6-09: a cópia do .bak é exclusiva e não sobrescreve um .bak.tmp alheio', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v1');
    const alheio = `${destino}.bak.tmp-${process.pid}-fixo`;
    writeFileSync(alheio, 'alheio');
    let n = 0;
    const r = await gravarAtomico(destino, texto('v2'), { aleatorio: () => (n++ === 0 ? 'principal' : 'fixo') });
    expect(r).toMatchObject({ ok: true, bak: null });
    expect(readFileSync(alheio, 'utf8')).toBe('alheio');
    expect(ler('trabalho.bdp')).toBe('v2');
  });
});

describe('gravarAtomico — concorrência', () => {
  it('salvamentos simultâneos do mesmo destino rodam um de cada vez, na ordem de chegada', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'v0');
    let ativos = 0;
    let maximo = 0;
    const fs = comFalhas({
      criarExclusivo: async () => {
        ativos++;
        maximo = Math.max(maximo, ativos);
        await new Promise((r) => setTimeout(r, 5));
      },
      renomear: (de, para) => {
        if (ehTroca(de, para)) ativos--;
      },
    });
    const rs = await Promise.all(['v1', 'v2', 'v3'].map((v) => gravarAtomico(destino, texto(v), { fs })));
    expect(rs.every((r) => r.ok)).toBe(true);
    expect(maximo).toBe(1);
    expect([ler('trabalho.bdp'), ler('trabalho.bdp.bak')]).toEqual(['v3', 'v2']);
    expect(temporarios()).toEqual([]);
  });
});

describe('salvarProjeto e abrirProjeto', () => {
  it('ida e volta pelo disco', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    const p = pacoteValido(new Uint8Array([...PNG_CABECALHO, 1, 2, 3]));
    expect((await salvarProjeto(destino, p)).ok).toBe(true);
    const r = await abrirProjeto(destino);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pacote.documento).toEqual(p.documento);
      expect(r.pacote.midias).toEqual(p.midias);
    }
  });

  it('pacote inválido: nada é gravado, os erros voltam para o visor e o documento em memória não muda', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'original');
    const p = pacoteValido();
    p.manifesto.id = 'outro-id';
    const antes = structuredClone(p.documento);
    const r = await salvarProjeto(destino, p);
    expect(r).toMatchObject({ ok: false, codigo: 'PACOTE_INVALIDO', temporario: null });
    if (!r.ok && 'erros' in r) expect(r.erros[0]?.caminho).toBe('manifesto.id');
    expect(p.documento).toEqual(antes);
    expect(arquivos()).toEqual(['trabalho.bdp']);
    expect(ler('trabalho.bdp')).toBe('original');
  });

  it('abrir arquivo inexistente, pasta ou não-projeto devolve erro em pt-BR', async () => {
    mkdirSync(join(pasta, 'pasta.bdp'));
    writeFileSync(join(pasta, 'texto.bdp'), 'não sou zip');
    const msg = async (n: string) => {
      const r = await abrirProjeto(join(pasta, n));
      return r.ok ? '' : r.erros[0]!.mensagem;
    };
    expect(await msg('nada.bdp')).toBe('o arquivo não foi encontrado');
    expect(await msg('pasta.bdp')).toBe('o caminho não é um arquivo comum');
    expect(await msg('texto.bdp')).not.toBe('');
  });

  it('M6-07: caminho que deixa de ser arquivo comum entre a conferência e a abertura é recusado pelo descritor', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    await salvarProjeto(destino, pacoteValido());
    const fs: SistemaArquivos = {
      ...SISTEMA_ARQUIVOS_NODE,
      abrirLeitura: async (c) => ({ ...(await SISTEMA_ARQUIVOS_NODE.abrirLeitura(c)), arquivoComum: async () => false }),
    };
    const r = await abrirProjeto(destino, { fs });
    expect(r.ok ? '' : r.erros[0]!.mensagem).toBe('o caminho não é um arquivo comum');
  });

  it('arquivo acima do limite é recusado antes de abrir para leitura', async () => {
    const destino = join(pasta, 'grande.bdp');
    writeFileSync(destino, new Uint8Array(2048));
    let abriu = false;
    const fs = comFalhas({ abrirLeitura: () => void (abriu = true) });
    const r = await abrirProjeto(destino, { fs, limites: { ...LIMITES_CONTEINER, bytesArquivo: 1024 } });
    expect(r.ok).toBe(false);
    expect(abriu).toBe(false);
  });

  it('arquivo que cresce entre a conferência e a leitura é recusado, sem ler além do tamanho conferido', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    await salvarProjeto(destino, pacoteValido());
    const fs: SistemaArquivos = {
      ...SISTEMA_ARQUIVOS_NODE,
      abrirLeitura: async (c) => {
        const a = await SISTEMA_ARQUIVOS_NODE.abrirLeitura(c);
        const real = await a.tamanho();
        return { ...a, tamanho: async () => real - 10 };
      },
    };
    const r = await abrirProjeto(destino, { fs });
    expect(r.ok ? '' : r.erros[0]!.mensagem).toBe('o arquivo mudou durante a leitura');
  });
});

// Repete a medição do revisor (ETAPA4_REVISAO_SEGURANCA, SR-07): outro processo segura o arquivo aberto com
// compartilhamento só de leitura, como o Word faz com documentos abertos.
describe.runIf(process.platform === 'win32')('Windows — arquivo aberto por outro processo', () => {
  const SCRIPT =
    "$f = [System.IO.File]::Open($env:BDP_ALVO, 'Open', 'Read', $env:BDP_COMPARTILHAR); [Console]::Out.WriteLine('pronto'); " +
    '[Console]::Out.Flush(); [void][Console]::In.ReadLine(); $f.Close()';

  /** Abre `alvo` em outro processo. `compartilhar`: 'Read' (como o Word) ou 'None' (bloqueio exclusivo). */
  async function segurar(alvo: string, compartilhar: 'Read' | 'None' = 'Read'): Promise<ChildProcessWithoutNullStreams> {
    const env = { ...process.env, BDP_ALVO: alvo, BDP_COMPARTILHAR: compartilhar };
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT], { env });
    await new Promise<void>((ok, falhou) => {
      p.stdout.on('data', (d: Buffer) => d.toString().includes('pronto') && ok());
      p.on('exit', (c) => falhou(new Error(`powershell saiu com ${c}`)));
    });
    return p;
  }
  const soltar = (p: ChildProcessWithoutNullStreams) => new Promise<void>((ok) => (p.on('exit', () => ok()), p.stdin.end()));

  it('bloqueio permanente: tentativas esgotam, EM_USO, original intacto, temporário preservado', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'original');
    const p = await segurar(destino);
    try {
      const r = await gravarAtomico(destino, texto('novo'));
      console.log(`[medição M1-T06] bloqueio permanente: ${JSON.stringify(r)}`);
      expect(r).toMatchObject({ ok: false, codigo: 'EM_USO' });
      expect(ler('trabalho.bdp')).toBe('original');
      expect(temporarios()).toHaveLength(1);
    } finally {
      await soltar(p);
    }
  }, 30_000);

  it('bloqueio exclusivo (compartilhamento None): .bak e troca dividem o orçamento, erro em cerca de 1,6 s', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'original');
    const p = await segurar(destino, 'None');
    try {
      const r = await gravarAtomico(destino, texto('novo'));
      console.log(`[medição M1-T06] bloqueio exclusivo: ${JSON.stringify({ ...r, temporario: undefined })}`);
      expect(r).toMatchObject({ ok: false, codigo: 'EM_USO' });
      expect(r.duracaoMs).toBeLessThan(2_500);
    } finally {
      await soltar(p);
    }
    expect(ler('trabalho.bdp')).toBe('original');
  }, 30_000);

  it('destino que é junção (não exige administrador) → DESTINO_INVALIDO', async () => {
    mkdirSync(join(pasta, 'alvo'));
    const destino = join(pasta, 'trabalho.bdp');
    symlinkSync(join(pasta, 'alvo'), destino, 'junction');
    expect(await gravarAtomico(destino, texto('v1'))).toMatchObject({ ok: false, codigo: 'DESTINO_INVALIDO' });
    rmSync(destino);
  });

  it('bloqueio liberado durante as tentativas: salva', async () => {
    const destino = join(pasta, 'trabalho.bdp');
    writeFileSync(destino, 'original');
    const p = await segurar(destino);
    const liberacao = new Promise((r) => setTimeout(r, 300)).then(() => soltar(p));
    const r = await gravarAtomico(destino, texto('novo'));
    await liberacao;
    console.log(`[medição M1-T06] bloqueio liberado após ~300 ms: ${JSON.stringify(r)}`);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.tentativas).toBeGreaterThan(1);
    expect([ler('trabalho.bdp'), ler('trabalho.bdp.bak')]).toEqual(['novo', 'original']);
  }, 30_000);
});

describe('medição da gravação em disco (M1-T06)', () => {
  it('projeto com 25 MB de mídia incompressível: salvar e abrir', async () => {
    const midia = new Uint8Array(25 * 1024 * 1024);
    midia.set(randomBytes(midia.length));
    midia.set(PNG_CABECALHO);
    const p = pacoteValido(midia);
    const destino = join(pasta, 'grande.bdp');
    const t0 = performance.now();
    const s1 = await salvarProjeto(destino, p);
    const t1 = performance.now();
    const s2 = await salvarProjeto(destino, p);
    const t2 = performance.now();
    const a = await abrirProjeto(destino);
    const t3 = performance.now();
    expect(s1.ok && s2.ok && a.ok).toBe(true);
    const ms = (x: number) => `${Math.round(x)} ms`;
    console.log(
      `[medição M1-T06] 25 MB: salvar novo ${ms(t1 - t0)} (gravação ${s1.ok ? ms(s1.duracaoMs) : '-'}); ` +
        `salvar sobre existente ${ms(t2 - t1)} (gravação + .bak ${s2.ok ? ms(s2.duracaoMs) : '-'}); abrir ${ms(t3 - t2)}`,
    );
    // O critério de reversão do ADR-0004 (2 s) é conferido pela medição registrada; aqui só se pega uma regressão
    // grosseira, com folga para máquina lenta ou antivírus (revisão do M1-T06).
    expect(t2 - t1).toBeLessThan(10_000);
  }, 60_000);
});
