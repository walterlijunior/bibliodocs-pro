// Especificação revista, Etapa 9: tabela ou quadro a partir de imagem ou texto (células incertas marcadas para conferir)
// e sugestão de conformidade com IA (revisável; só título, fonte e nota de tabela são aplicáveis).
import { describe, expect, it } from 'vitest';
import {
  celulasAConferir,
  converterPlanilha,
  estimarPedido,
  lerSugestaoConformidade,
  lerTabelaSugerida,
  MARCADOR_CONFERIR,
  opcoesSugeridas,
  pedidoGerarTabela,
  pedidoSugestaoConformidade,
  type NaoConformidade,
} from '../src/aplicacao';
import { enviarChat, type Buscar } from '../src/integracoes';

const RESPOSTA_TABELA = 'Aqui está:\n```json\n' + JSON.stringify({
  titulo: 'Matrículas por câmpus, 2024',
  fonte: 'UFT (2024)',
  linhasCabecalho: 1,
  linhas: [
    [{ texto: 'Câmpus' }, { texto: 'Matrículas' }],
    [{ texto: 'Palmas' }, { texto: '1.234' }],
    [{ texto: 'Gurupi' }, { texto: '9?7', incerta: true }],
    [{ texto: 'Total', colunas: 1 }, { texto: '', incerta: true }],
  ],
  observacoes: ['A última linha está cortada na imagem.'],
}) + '\n```';

describe('tabela a partir de imagem ou texto', () => {
  it('o pedido leva a imagem junto do texto e a estimativa conta a imagem', () => {
    const p = pedidoGerarTabela({ especie: 'tabela', imagem: { tipo: 'image/png', base64: 'iVBORw0KGgo=' } });
    expect(p.mensagens[1]!.imagem).toEqual({ tipo: 'image/png', base64: 'iVBORw0KGgo=' });
    expect(p.mensagens[1]!.texto).toContain('a partir da imagem anexa');
    expect(estimarPedido(p)).toBeGreaterThan(estimarPedido(pedidoGerarTabela({ especie: 'tabela', texto: 'x' })));
  });

  it('o cliente manda a imagem como parte "image_url" (data URL)', async () => {
    let corpo: { messages: { content: unknown }[] } | null = null;
    const buscar: Buscar = async (_u, init) => {
      corpo = JSON.parse(init.body);
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ choices: [{ message: { content: '{}' } }] }) };
    };
    await enviarChat({ url: 'https://x.org/v1', modelo: 'm' }, 'k', pedidoGerarTabela({ especie: 'quadro', imagem: { tipo: 'image/jpeg', base64: 'AAAA' } }), buscar);
    expect(corpo!.messages[1]!.content).toEqual([{ type: 'text', text: expect.stringContaining('quadro') }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }]);
  });

  it('a resposta vira planilha lida; as células incertas entram marcadas e com aviso', () => {
    const s = lerTabelaSugerida(RESPOSTA_TABELA)!;
    expect(s.titulo).toBe('Matrículas por câmpus, 2024');
    expect(s.fonte).toBe('UFT (2024)');
    expect(s.incertas).toEqual(['linha 3, coluna 2', 'linha 4, coluna 2']);
    expect(s.lida.linhas[2]![1]!.texto).toBe(`${MARCADOR_CONFERIR}9?7`);
    const c = converterPlanilha(s.lida, 'tabela', opcoesSugeridas(s.lida));
    expect(c.relatorio[0]).toMatch(/^A IA marcou 2 células para conferir/);
    expect(c.relatorio).toContain('Observação da IA: A última linha está cortada na imagem.');
    expect(celulasAConferir(c.grade)).toEqual(['linha 3, coluna 2', 'linha 4, coluna 2']);
    expect(lerTabelaSugerida('não sei')).toBeNull();
    expect(lerTabelaSugerida('{"linhas": []}')).toBeNull();
  });
});

describe('sugestão de conformidade', () => {
  const item: NaoConformidade = {
    id: 'nc_000001', chave: 'k', categoria: 'tabelas', verificacao: 'revisar', codigo: 'TABELA_SERIE_TEMPORAL', familia: 'tabela', rotuloLocal: 'Seção 1 — Tabela 1',
    gravidade: 'aviso', origem: ['RN-279'], mensagem: 'Série com meia-risca.', sugestao: 'Use hífen.', local: { tipo: 'texto', secao: 'sec_x0000001', no: 'tab_x0000001' },
  };
  it('o pedido leva a regra, a mensagem e a tabela (sem pedir para mudar células)', () => {
    const p = pedidoSugestaoConformidade(item, { tabela: { rotulo: 'Tabela 1', bloco: { tipo: 'tabela', id: 'tab_x0000001', especie: 'tabela', titulo: [{ tipo: 'texto', texto: 'Produção, 2020–2022' }], colunas: [{ alinhamento: 'esquerda' }], linhasCabecalho: 1, linhas: [[{ conteudo: [{ tipo: 'texto', texto: 'Ano' }] }]] } } });
    expect(p.mensagens[0]!.texto).toContain('Nunca proponha mudar células');
    expect(p.mensagens[1]!.texto).toContain('Regra de origem: RN-279');
    expect(p.mensagens[1]!.texto).toContain('Título: Produção, 2020–2022');
  });
  it('lê a explicação, os campos e as regras; resposta sem explicação é recusada', () => {
    expect(lerSugestaoConformidade('{"explicacao": "Série consecutiva usa hífen.", "titulo": "Produção, 2020-2022", "fonte": null, "regras": ["RN-279", "inventada"]}')).toEqual({ explicacao: 'Série consecutiva usa hífen.', titulo: 'Produção, 2020-2022', regras: ['RN-279'] });
    expect(lerSugestaoConformidade('{"titulo": "x"}')).toBeNull();
  });
});
