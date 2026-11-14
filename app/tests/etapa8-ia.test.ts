// Etapa 8 da especificação de atualização — integração com IA: cliente no formato de chat da OpenAI (qualquer serviço
// compatível), canais do principal (chave cifrada, envio, uso do mês, pontos de retomada), tarefas (pedido, leitura
// das sugestões, células intactas) e o aceite: interrupção no meio da tarefa e retomada sem repetir etapa; uso
// informado pelo provedor sem cota restante.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  atualizarEtapa,
  CANAIS_IA,
  dadosComSugestao,
  etapasPendentes,
  lerSugestaoModelo,
  lerSugestaoTabela,
  limiteProximo,
  novoPonto,
  pedidoRevisarTabela,
  tarefaTerminada,
  type PontoRetomada,
  type ResultadoIA,
} from '../src/aplicacao';
import type { BlocoTabela } from '../src/dominio/modelo';
import { enviarChat, urlBaseValida, type Buscar } from '../src/integracoes';
import { criarManipuladoresIa } from '../src/principal/ipc/manipuladores-ia';
import { ORIGEM_PRODUCAO } from '../src/principal/seguranca/politica-urls';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const tabela: BlocoTabela = {
  tipo: 'tabela',
  id: 'tab_et8000000001',
  especie: 'tabela',
  titulo: [t('Matrículas por ano.')],
  colunas: [{ alinhamento: 'esquerda' }, { alinhamento: 'direita' }],
  linhasCabecalho: 1,
  linhas: [[{ conteudo: [t('Ano')] }, { conteudo: [t('Total')] }], [{ conteudo: [t('2024')] }, { conteudo: [t('1.234')] }]],
  fonte: [t('INEP')],
};

/** Servidor falso: responde com o texto dado, `usage` e cabeçalhos opcionais, e guarda os pedidos. */
function servidor(respostas: { status?: number; corpo: unknown; cabecalhos?: Record<string, string> }[]) {
  const pedidos: { url: string; headers: Record<string, string>; body: unknown }[] = [];
  const buscar: Buscar = async (url, init) => {
    pedidos.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const r = respostas.shift() ?? { corpo: {} };
    const corpo = typeof r.corpo === 'string' ? r.corpo : JSON.stringify(r.corpo);
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, headers: { get: (n: string) => r.cabecalhos?.[n] ?? null }, text: async () => corpo };
  };
  return { buscar, pedidos };
}
const resposta = (conteudo: string, usage?: object) => ({ choices: [{ message: { content: conteudo } }], ...(usage ? { usage } : {}) });

describe('cliente no formato da OpenAI', () => {
  it('aceita https e http só no próprio computador; sem credenciais nem parâmetros', () => {
    expect(urlBaseValida('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
    expect(urlBaseValida('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
    for (const ruim of ['http://exemplo.com/v1', 'https://u:s@api.openai.com/v1', 'https://api.openai.com/v1?x=1', 'file:///c:/x', 'javascript:alert(1)']) expect(urlBaseValida(ruim)).toBeNull();
  });

  it('manda modelo, mensagens e a chave no cabeçalho; lê texto, uso e limites por minuto', async () => {
    const s = servidor([{ corpo: resposta('{"titulo": null}', { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }), cabecalhos: { 'x-ratelimit-remaining-tokens': '9000', 'x-ratelimit-limit-tokens': '10000' } }]);
    const r = await enviarChat({ url: 'https://api.openai.com/v1', modelo: 'gpt-4o-mini' }, 'sk-teste', { mensagens: [{ papel: 'sistema', texto: 'S' }, { papel: 'usuario', texto: 'U' }], maxTokens: 50 }, s.buscar);
    expect(r).toEqual({ ok: true, texto: '{"titulo": null}', uso: { entrada: 120, saida: 30, total: 150 }, limites: { tokensRestantes: 9000, tokensLimite: 10000 } });
    expect(s.pedidos[0]).toMatchObject({
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: 'Bearer sk-teste' },
      body: { model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], max_tokens: 50 },
    });
  });

  it('erros com mensagem compreensível: chave recusada, cota, limite por minuto, provedor e resposta inválida', async () => {
    const enviar = (status: number, corpo: unknown) => enviarChat({ url: 'https://x.org/v1', modelo: 'm' }, 'k', { mensagens: [{ papel: 'usuario', texto: 'U' }] }, servidor([{ status, corpo }]).buscar);
    expect(await enviar(401, {})).toMatchObject({ ok: false, motivo: 'CHAVE_RECUSADA' });
    expect(await enviar(429, { error: { code: 'insufficient_quota' } })).toMatchObject({ ok: false, motivo: 'LIMITE', mensagem: expect.stringContaining('cota') });
    expect(await enviar(429, {})).toMatchObject({ ok: false, motivo: 'LIMITE', mensagem: expect.stringContaining('por minuto') });
    expect(await enviar(500, {})).toMatchObject({ ok: false, motivo: 'PROVEDOR' });
    expect(await enviar(200, 'não é json')).toMatchObject({ ok: false, motivo: 'RESPOSTA' });
  });

  it('sem resposta a tempo: TEMPO', async () => {
    const lento: Buscar = (_u, init) => new Promise((_ok, falha) => init.signal.addEventListener('abort', () => falha(new Error('abortado'))));
    expect(await enviarChat({ url: 'https://x.org/v1', modelo: 'm' }, null, { mensagens: [{ papel: 'usuario', texto: 'U' }] }, lento, 20)).toMatchObject({ ok: false, motivo: 'TEMPO' });
  });
});

describe('canais do principal', () => {
  let pasta: string;
  afterEach(() => rmSync(pasta, { recursive: true, force: true }));
  const r = { idConteudo: 1, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };
  const cifra = { disponivel: () => true, cifrar: (s: string) => new TextEncoder().encode(`cifrado:${[...s].reverse().join('')}`), decifrar: (b: Uint8Array) => [...new TextDecoder().decode(b).slice(8)].reverse().join('') };
  function criar(buscar: Buscar) {
    pasta = mkdtempSync(join(tmpdir(), 'bdp-ia-'));
    return criarManipuladoresIa({ origem: ORIGEM_PRODUCAO, conteudosPermitidos: () => new Set([1]), arquivoConfig: join(pasta, 'ia-config.json'), arquivoRetomada: join(pasta, 'ia-retomada.json'), cifra, buscar, agora: () => new Date('2026-11-14T12:00:00Z'), log: () => {} });
  }
  const config = { ativa: true, provedor: 'openai' as const, url: 'https://api.openai.com/v1', modelo: 'gpt-4o-mini' };

  it('a chave é gravada cifrada e nunca volta; desativada, nada é enviado', async () => {
    const s = servidor([]);
    const m = criar(s.buscar);
    await m[CANAIS_IA.gravarConfig](r, [{ ...config, ativa: false }, 'sk-segredo-123']);
    const arquivo = readFileSync(join(pasta, 'ia-config.json'), 'utf8');
    expect(arquivo).not.toContain('sk-segredo-123');
    const estado = await m[CANAIS_IA.lerConfig](r, []);
    expect(estado).toMatchObject({ ativa: false, temChave: true, cifraDisponivel: true, usoMes: { mes: '2026-11', tokens: 0 } });
    expect(JSON.stringify(estado)).not.toContain('sk-segredo');
    expect(await m[CANAIS_IA.enviar](r, [{ mensagens: [{ papel: 'usuario', texto: 'U' }] }])).toMatchObject({ ok: false, motivo: 'DESATIVADA' });
    expect(s.pedidos).toEqual([]);
  });

  it('envia com a chave decifrada e soma ao uso do mês só o que o provedor informou', async () => {
    const s = servidor([{ corpo: resposta('ok', { total_tokens: 150 }) }, { corpo: resposta('ok') }]);
    const m = criar(s.buscar);
    await m[CANAIS_IA.gravarConfig](r, [config, 'sk-segredo-123']);
    const r1 = await m[CANAIS_IA.enviar](r, [{ mensagens: [{ papel: 'usuario', texto: 'U' }] }]);
    expect(r1).toMatchObject({ ok: true, uso: { total: 150 }, limites: null, usoMes: { mes: '2026-11', tokens: 150 } });
    expect(s.pedidos[0]!.headers['Authorization']).toBe('Bearer sk-segredo-123');
    const r2 = await m[CANAIS_IA.enviar](r, [{ mensagens: [{ papel: 'usuario', texto: 'U' }] }]);
    expect(r2).toMatchObject({ ok: true, uso: null, usoMes: { tokens: 150 } });
  });

  it('sem cifra no sistema, a chave não é gravada; endereço inválido é recusado', async () => {
    const m = criarManipuladoresIa({ origem: ORIGEM_PRODUCAO, conteudosPermitidos: () => new Set([1]), arquivoConfig: join((pasta = mkdtempSync(join(tmpdir(), 'bdp-ia-'))), 'c.json'), arquivoRetomada: join(pasta, 'r.json'), cifra: { ...cifra, disponivel: () => false }, buscar: servidor([]).buscar, log: () => {} });
    expect(await m[CANAIS_IA.gravarConfig](r, [config, 'sk-x'])).toMatchObject({ ok: false, mensagem: expect.stringContaining('cifra') });
    expect(await m[CANAIS_IA.gravarConfig](r, [{ ...config, url: 'http://exemplo.com/v1' }, null])).toMatchObject({ ok: false });
  });

  it('pontos de retomada por trabalho: gravar, ler, descartar; ponto fora do esquema é recusado', async () => {
    const m = criar(servidor([]).buscar);
    const ponto = novoPonto({ id: 'prj_abcdefghijklmnop', nome: 'TCC' }, 'revisarTabelas', [{ chave: 'tab_1aaaaaaa', rotulo: 'Tabela 1' }], new Date('2026-11-14T12:00:00Z'));
    expect(await m[CANAIS_IA.gravarRetomada](r, [ponto])).toEqual({ ok: true });
    expect(await m[CANAIS_IA.lerRetomada](r, ['prj_abcdefghijklmnop'])).toEqual(ponto);
    await expect(m[CANAIS_IA.gravarRetomada](r, [{ ...ponto, etapas: [] }])).rejects.toThrow();
    expect(await m[CANAIS_IA.descartarRetomada](r, ['prj_abcdefghijklmnop'])).toEqual({ ok: true });
    expect(await m[CANAIS_IA.lerRetomada](r, ['prj_abcdefghijklmnop'])).toBeNull();
  });
});

describe('tarefas', () => {
  it('o pedido da tabela leva título, fonte, cabeçalho e até 5 linhas; a sugestão nunca toca nas células', () => {
    const p = pedidoRevisarTabela(tabela, 'Tabela 1');
    expect(p.mensagens[1]!.texto).toContain('Título: Matrículas por ano.');
    expect(p.mensagens[1]!.texto).toContain('2024 | 1.234');
    const s = lerSugestaoTabela('Aqui está:\n```json\n{"titulo": "Matrículas na graduação, Tocantins – 2024", "fonte": "INEP (2025).", "nota": null, "observacoes": ["Sem ponto final no título."]}\n```');
    expect(s).toEqual({ titulo: 'Matrículas na graduação, Tocantins – 2024', fonte: 'INEP (2025).', observacoes: ['Sem ponto final no título.'] });
    const dados = dadosComSugestao(tabela, s!, ['titulo']);
    expect(dados.titulo).toEqual([t('Matrículas na graduação, Tocantins – 2024')]);
    expect(dados.fonte).toEqual(tabela.fonte);
    expect(dados.linhas).toBe(tabela.linhas);
    expect(lerSugestaoTabela('sem json')).toBeNull();
  });

  it('a sugestão do modelo só aceita aspectos conhecidos e valores plausíveis', () => {
    expect(lerSugestaoModelo('{"margemSuperiorCm": 2.5, "fonte": "Arial", "corpoPt": 500, "entrelinha": "1,5", "cor": "azul", "observacoes": ["Até 10 páginas."]}')).toEqual({
      regras: { margemSuperiorCm: 2.5, fonte: 'Arial', entrelinha: '1,5' },
      observacoes: ['Até 10 páginas.'],
    });
  });

  it('limite próximo: pelo que o provedor informou por minuto ou pelo limite mensal do autor', () => {
    expect(limiteProximo({ tokensRestantes: 100 }, 500, 0, undefined)).toMatch(/100 tokens restantes/);
    expect(limiteProximo({ tokensRestantes: 9000 }, 500, 0, undefined)).toBeNull();
    expect(limiteProximo(null, 500, 950, 1000)).toMatch(/95%/);
    expect(limiteProximo(null, 500, 10, undefined)).toBeNull();
  });
});

describe('aceite da Etapa 8', () => {
  it('interrupção no meio da tarefa: o ponto guarda o que foi feito; retomar envia só o que falta e não aplica duas vezes', async () => {
    let pasta2 = mkdtempSync(join(tmpdir(), 'bdp-ia-'));
    try {
      const r = { idConteudo: 1, urlQuadro: 'app://interface/index.html', quadroPrincipal: true };
      const s = servidor([{ corpo: resposta('{"titulo": "T1"}', { total_tokens: 100 }) }, { corpo: resposta('{"titulo": "T3"}', { total_tokens: 90 }) }, { corpo: resposta('{"titulo": "T2"}', { total_tokens: 80 }) }]);
      const deps = { origem: ORIGEM_PRODUCAO, conteudosPermitidos: () => new Set([1]), arquivoConfig: join(pasta2, 'c.json'), arquivoRetomada: join(pasta2, 'r.json'), cifra: { disponivel: () => true, cifrar: (x: string) => new TextEncoder().encode(x), decifrar: (b: Uint8Array) => new TextDecoder().decode(b) }, buscar: s.buscar, log: () => {} };
      let m = criarManipuladoresIa(deps);
      await m[CANAIS_IA.gravarConfig](r, [{ ativa: true, provedor: 'personalizado', url: 'http://localhost:9/v1', modelo: 'teste' }, null]);
      const id = 'prj_abcdefghijklmnop';
      let ponto: PontoRetomada = novoPonto({ id, nome: 'TCC' }, 'revisarTabelas', ['tab_1aaaaaaa', 'tab_2aaaaaaa', 'tab_3aaaaaaa'].map((c, i) => ({ chave: c, rotulo: `Tabela ${i + 1}` })), new Date());
      await m[CANAIS_IA.gravarRetomada](r, [ponto]);
      // Etapa 1 concluída e gravada; a 2.ª "cai" (o aplicativo é fechado antes da resposta).
      const r1 = (await m[CANAIS_IA.enviar](r, [{ mensagens: [{ papel: 'usuario', texto: 'tabela 1' }] }])) as ResultadoIA;
      if (!r1.ok) throw new Error(r1.mensagem);
      ponto = atualizarEtapa(ponto, 'tab_1aaaaaaa', { estado: 'concluida', resposta: r1.texto, ...(r1.uso ? { uso: r1.uso } : {}) }, 'etapa', new Date());
      await m[CANAIS_IA.gravarRetomada](r, [ponto]);

      // "Reabrir o aplicativo": manipuladores novos sobre os mesmos arquivos.
      m = criarManipuladoresIa(deps);
      const lido = (await m[CANAIS_IA.lerRetomada](r, [id])) as PontoRetomada;
      expect(lido.etapas.map((e) => [e.chave, e.estado])).toEqual([
        ['tab_1aaaaaaa', 'concluida'],
        ['tab_2aaaaaaa', 'pendente'],
        ['tab_3aaaaaaa', 'pendente'],
      ]);
      const pendentes = etapasPendentes(lido);
      expect(pendentes.map((e) => e.chave)).toEqual(['tab_2aaaaaaa', 'tab_3aaaaaaa']);
      // Aplicar a sugestão da etapa 1 marca "aplicada": ela não volta como pendente nem sem decisão.
      ponto = atualizarEtapa(lido, 'tab_1aaaaaaa', { estado: 'aplicada' }, 'decisao', new Date());
      expect(etapasPendentes(ponto)).toHaveLength(2);
      expect(tarefaTerminada(ponto)).toBe(false);
      // Só as pendentes vão ao serviço: 1 envio antes, 2 depois, 3 no total (nenhuma etapa repetida).
      for (const e of pendentes) {
        const x = (await m[CANAIS_IA.enviar](r, [{ mensagens: [{ papel: 'usuario', texto: e.rotulo }] }])) as ResultadoIA;
        if (!x.ok) throw new Error(x.mensagem);
        ponto = atualizarEtapa(ponto, e.chave, { estado: 'descartada', resposta: x.texto }, 'etapa', new Date());
      }
      expect(s.pedidos.map((x) => (x.body as { messages: { content: string }[] }).messages[0]!.content)).toEqual(['tabela 1', 'Tabela 2', 'Tabela 3']);
      expect(tarefaTerminada(ponto)).toBe(true);
      // O uso do mês somou só o que o provedor informou: 100 + 90 + 80.
      expect(await m[CANAIS_IA.lerConfig](r, [])).toMatchObject({ usoMes: { tokens: 270 } });
    } finally {
      rmSync(pasta2, { recursive: true, force: true });
      pasta2 = '';
    }
  });
});
