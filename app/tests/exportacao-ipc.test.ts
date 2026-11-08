// M3-T08: canal de exportação, sem Electron: recusas, cancelar, falhas e o que volta ao renderer.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANAIS_EXPORTACAO, criarTrabalhoDoTipo, type PacoteTransferivel, type ResultadoExportar } from '../src/aplicacao';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { ErroIpcRecusado } from '../src/principal/ipc/chamada';
import {
  criarManipuladoresExportacao,
  gravarExportacao,
  MENSAGEM_EXPORTACAO_EM_CURSO,
  MENSAGEM_EXPORTACAO_FALHOU,
  MENSAGEM_EXPORTACAO_INVALIDA,
  MENSAGEM_EXTENSAO_DOCX,
  type DependenciasExportacao,
} from '../src/principal/ipc/manipuladores-exportacao';
import type { InfoRemetente } from '../src/principal/ipc/remetente';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';
import { pngDeTeste } from './corpus/corpus';

const JANELA = 7;
const LEGITIMO: InfoRemetente = { idConteudo: JANELA, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };

function pacote(): PacoteTransferivel {
  let n = 0;
  const t = criarTrabalhoDoTipo({ id: 'prj_abcdefghijklmnop', agora: '2026-01-01T00:00:00.000Z', appVersao: '0.1.0', tipo: 'monografia', novoId: (p) => `${p}_${String(++n).padStart(16, '0')}` });
  return { manifesto: t.manifesto, documento: { ...t.documento, metadados: { titulo: [{ tipo: 'texto', texto: 'Meu trabalho' }] } }, midias: [] } as unknown as PacoteTransferivel;
}

function montar(extra: Partial<DependenciasExportacao> = {}) {
  const gravados: [string, Uint8Array][] = [];
  const pedidos: string[] = [];
  const exportados: { fonte: string | undefined }[] = [];
  const dep: DependenciasExportacao = {
    origem: ORIGEM_PRODUCAO,
    conteudosPermitidos: () => new Set([JANELA]),
    perfil: PERFIL,
    escolherDestino: async (_id, nome) => (pedidos.push(nome), `C:\\pasta\\${nome}`),
    exportar: async (f) => {
      exportados.push({ fonte: f.estilos.find((e) => e.id === 'corpo')!.propriedades.fonte });
      return { ok: true, bytes: new Uint8Array([1, 2]) };
    },
    gravar: async (d, b) => {
      gravados.push([d, b]);
      return { ok: true, avisos: [], tentativas: 1, duracaoMs: 0, bak: null } as never;
    },
    log: () => {},
    ...extra,
  };
  const m = criarManipuladoresExportacao(dep)[CANAIS_EXPORTACAO.docx];
  const relatorio = criarManipuladoresExportacao(dep)[CANAIS_EXPORTACAO.relatorio];
  return { chamar: (...a: unknown[]) => m(LEGITIMO, a) as Promise<ResultadoExportar>, m, relatorio, gravados, pedidos, exportados };
}

describe('M7: relatório TXT pelo principal', () => {
  it('gera da cópia validada do trabalho e grava texto UTF-8 sem expor destino ao renderer', async () => {
    const x = montar({ escolherDestinoRelatorio: async () => 'C:\\pasta\\relatorio.txt' });
    const r = await x.relatorio(LEGITIMO, [pacote()]) as ResultadoExportar;
    expect(r).toMatchObject({ ok: true, nomeArquivo: 'relatorio.txt' });
    expect(JSON.stringify(r)).not.toContain('C:\\pasta');
    expect(x.gravados).toHaveLength(1);
    const texto = new TextDecoder().decode(x.gravados[0]![1]);
    expect(texto).toContain('Meu trabalho');
    expect(texto).toContain('RN-');
    expect(x.exportados).toHaveLength(0);
  });
  it('cancela e recusa extensão errada sem gravar', async () => {
    const cancelado = montar({ escolherDestinoRelatorio: async () => null });
    expect(await cancelado.relatorio(LEGITIMO, [pacote()])).toEqual({ ok: false, motivo: 'CANCELADO' });
    expect(cancelado.gravados).toEqual([]);
    const errado = montar({ escolherDestinoRelatorio: async () => 'C:\\pasta\\relatorio.docx' });
    expect(await errado.relatorio(LEGITIMO, [pacote()])).toMatchObject({ ok: false, motivo: 'ERRO' });
    expect(errado.gravados).toEqual([]);
  });
  it('remetente estranho, argumento extra e pacote falso são recusados antes de diálogo/gravação', async () => {
    const x = montar({ escolherDestinoRelatorio: async (_id, nome) => (x.pedidos.push(nome), 'C:\\pasta\\relatorio.txt') });
    await expect(x.relatorio({ ...LEGITIMO, quadroPrincipal: false }, [pacote()])).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(x.relatorio(LEGITIMO, [pacote(), 'conteúdo forjado'])).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(x.relatorio(LEGITIMO, [{ arbitrario: true }])).rejects.toBeInstanceOf(ErroIpcRecusado);
    expect(x.pedidos).toEqual([]); expect(x.gravados).toEqual([]);
  });
});

describe('exportação', () => {
  it('grava no destino escolhido, sugere o nome do título e não devolve a pasta', async () => {
    const x = montar();
    const r = await x.chamar(pacote(), {});
    expect(x.pedidos).toEqual(['Meu trabalho.docx']);
    expect(x.gravados[0]![0]).toBe('C:\\pasta\\Meu trabalho.docx');
    expect(r).toMatchObject({ ok: true, nomeArquivo: 'Meu trabalho.docx' });
    expect(JSON.stringify(r)).not.toContain('pasta');
  });
  it('devolve os avisos do motor em texto', async () => {
    const r = await montar().chamar(pacote(), {});
    expect(r.ok && r.avisos.join(' ')).toContain('brasão');
  });
  it('devolve também as pendências de tabelas: sem fonte e tabela longa (M5-T03; RN-274, RN-297)', async () => {
    const p = pacote() as unknown as { documento: { corpo: unknown[] } };
    const cel = (texto: string) => ({ conteudo: [{ tipo: 'texto', texto }] });
    p.documento.corpo = [
      {
        id: 'sec_abcdefghijklmnop',
        titulo: [{ tipo: 'texto', texto: 'Seção' }],
        subsecoes: [],
        blocos: [
          {
            tipo: 'tabela',
            id: 'tab_abcdefghijklmnop',
            especie: 'tabela',
            titulo: [{ tipo: 'texto', texto: 'Valores' }],
            colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'direita' }],
            linhasCabecalho: 1,
            linhas: [[cel('Item'), cel('Valor')], ...Array.from({ length: 45 }, (_, i) => [cel(`Item ${i}`), cel(String(i))])],
          },
        ],
      },
    ];
    const r = await montar().chamar(p, {});
    expect(r.ok).toBe(true);
    const avisos = r.ok ? r.avisos.join('\n') : '';
    expect(avisos).toContain('Tabela 1: falta a fonte');
    expect(avisos).toContain('Tabela 1: 46 linhas; recomenda-se que a tabela caiba em uma página');
  });
  it('aceite do RF-10: figura com resolução baixa gera aviso, e a imagem chega ao exportador (M5-T06)', async () => {
    const png = pngDeTeste(300, 200, null); // natural: 79 mm a 96 ppi
    const sha = createHash('sha256').update(png).digest('hex');
    const p = pacote() as unknown as { documento: { corpo: unknown[] }; manifesto: { midias: unknown[] }; midias: unknown[] };
    p.documento.corpo = [
      {
        id: 'sec_abcdefghijklmnop',
        titulo: [{ tipo: 'texto', texto: 'Seção' }],
        subsecoes: [],
        blocos: [{ tipo: 'ilustracao', id: 'ilu_abcdefghijklmnop', especie: 'figura', titulo: [{ tipo: 'texto', texto: 'Foto' }], midia: sha, fonte: [{ tipo: 'texto', texto: 'Autor (2026).' }] }],
      },
    ];
    p.manifesto.midias = [{ caminho: `midias/${sha}.png`, sha256: sha, bytes: png.length, tipo: 'image/png' }];
    p.midias = [{ sha256: sha, bytes: png }];
    const imagens: number[] = [];
    const x = montar({
      exportar: async (f) => {
        for (const s of f.secoes) for (const b of s.blocos) if (b.tipo === 'imagem') imagens.push(b.dados.length);
        return { ok: true, bytes: new Uint8Array([1]) };
      },
    });
    const r = await x.chamar(p, {});
    expect(imagens).toEqual([png.length]);
    expect(r.ok ? r.avisos : []).toContain(
      'Figura 1: a imagem fica com 96 ppi no tamanho impresso (o mínimo é 150) e pode sair borrada. Use uma imagem maior ou reduza a largura para até 50 mm.',
    );
  });
  it('a fonte das opções vale; fora da lista do perfil, fica a padrão', async () => {
    const x = montar();
    await x.chamar(pacote(), { fonte: 'Arial' });
    await x.chamar(pacote(), { fonte: 'Comic Sans' });
    expect(x.exportados.map((e) => e.fonte)).toEqual(['Arial', 'Times New Roman']);
  });
  it('cancelar o diálogo não gera nem grava', async () => {
    const x = montar({ escolherDestino: async () => null });
    expect(await x.chamar(pacote(), {})).toEqual({ ok: false, motivo: 'CANCELADO' });
    expect(x.exportados).toEqual([]);
    expect(x.gravados).toEqual([]);
  });
  it('destino sem .docx é recusado antes de gerar', async () => {
    const x = montar({ escolherDestino: async () => 'C:\\pasta\\trabalho.bdp' });
    expect(await x.chamar(pacote(), {})).toEqual({ ok: false, motivo: 'ERRO', mensagem: MENSAGEM_EXTENSAO_DOCX });
    expect(x.gravados).toEqual([]);
  });
  it('falha do exportador não grava nada', async () => {
    const x = montar({ exportar: async () => ({ ok: false }) });
    expect(await x.chamar(pacote(), {})).toEqual({ ok: false, motivo: 'ERRO', mensagem: MENSAGEM_EXPORTACAO_FALHOU });
    expect(x.gravados).toEqual([]);
  });
  it('falha na gravação (arquivo aberto no Word) volta com a mensagem, sem o detalhe', async () => {
    const logs: string[] = [];
    const x = montar({ log: (l) => logs.push(l), gravar: async () => ({ ok: false, codigo: 'EM_USO', mensagem: 'O arquivo está em uso.', detalhe: 'EBUSY', temporario: null, duracaoMs: 0 }) as never });
    expect(await x.chamar(pacote(), {})).toEqual({ ok: false, motivo: 'ERRO', mensagem: 'O arquivo está em uso.' });
    expect(logs.join(' ')).toContain('EBUSY');
  });
  it('conteúdo inválido não abre o diálogo', async () => {
    const x = montar();
    const p = pacote() as unknown as { documento: { corpo: unknown } };
    p.documento.corpo = 'errado';
    expect(await x.chamar(p, {})).toEqual({ ok: false, motivo: 'ERRO', mensagem: MENSAGEM_EXPORTACAO_INVALIDA });
    expect(x.pedidos).toEqual([]);
  });
  it('uma por vez; depois de terminar, ou falhar, libera', async () => {
    let soltar!: () => void;
    const x = montar({ escolherDestino: () => new Promise((r) => (soltar = () => r(null))) });
    const primeira = x.chamar(pacote(), {});
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(await x.chamar(pacote(), {})).toEqual({ ok: false, motivo: 'ERRO', mensagem: MENSAGEM_EXPORTACAO_EM_CURSO });
    soltar();
    await primeira;
    const segunda = x.chamar(pacote(), {});
    await new Promise((r) => setTimeout(r, 0));
    soltar();
    expect(await segunda).toEqual({ ok: false, motivo: 'CANCELADO' });
  });
});

describe('recusas (C-11)', () => {
  it('remetente estranho, quantidade errada, pacote e opções fora do contrato', async () => {
    const x = montar();
    const estranho: InfoRemetente = { ...LEGITIMO, idConteudo: 99 };
    await expect(x.m(estranho, [pacote(), {}])).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(x.chamar(pacote())).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(x.chamar('C:\\x.bdp', {})).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(x.chamar(pacote(), 'x')).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(x.chamar(pacote(), { fonte: 1 })).rejects.toBeInstanceOf(ErroIpcRecusado);
    await expect(x.chamar(pacote(), { fonte: 'x'.repeat(65) })).rejects.toBeInstanceOf(ErroIpcRecusado);
    expect(x.gravados).toEqual([]);
  });
});

describe('gravação do .docx (R-M3-06, decisão do usuário 2026-11-05)', () => {
  it('substitui o arquivo confirmado no diálogo sem deixar .bak na pasta', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'bdp-exportar-'));
    try {
      const destino = join(pasta, 'Trabalho.docx');
      writeFileSync(destino, 'antigo');
      const r = await gravarExportacao(destino, new TextEncoder().encode('novo'));
      expect(r.ok).toBe(true);
      expect(readFileSync(destino, 'utf8')).toBe('novo');
      expect(existsSync(`${destino}.bak`)).toBe(false);
      expect(readdirSync(pasta)).toEqual(['Trabalho.docx']);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});
