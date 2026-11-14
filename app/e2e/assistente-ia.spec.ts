/**
 * Etapa 8 da especificação de atualização (aceite): integração com IA, consumo e retomada. Um servidor falso no formato
 * da API de chat da OpenAI roda no próprio teste (no endereço local, como um Ollama): informa os tokens usados, mas não
 * os limites nem a cota. A tarefa "Revisar tabelas e quadros" é autorizada, a 1.ª etapa conclui, e o aplicativo é
 * derrubado (taskkill) enquanto a 2.ª espera a resposta. Ao reabrir, o trabalho avisa da tarefa guardada; retomar
 * mostra e envia só a etapa que faltava; a tabela 1 não é enviada de novo. A sugestão aceita entra no editor uma vez.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type Page } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
let servidor: Server;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => {
  await new Promise<void>((ok) => (servidor ? servidor.close(() => ok()) : ok()));
  await amb.apagar();
});

interface Recebido {
  conteudo: string;
}

/** Servidor compatível: responde com uma sugestão de título; `segurar` deixa o pedido sem resposta. */
async function iniciarServidor(estado: { segurar: boolean; recebidos: Recebido[] }): Promise<string> {
  servidor = createServer((req, res) => {
    let corpo = '';
    req.on('data', (c: Buffer) => (corpo += c.toString('utf8')));
    req.on('end', () => {
      const j = JSON.parse(corpo) as { messages: { content: string }[] };
      const conteudo = j.messages.at(-1)!.content;
      estado.recebidos.push({ conteudo });
      if (estado.segurar) return; // sem resposta: a etapa fica "no ar"
      const rotulo = /Rótulo: (.*)/.exec(conteudo)?.[1] ?? '';
      const resposta = { titulo: `Título revisado de ${rotulo}`, fonte: null, nota: null, observacoes: ['Título sem ponto final.'] };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(resposta) } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }));
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', () => ok()));
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/v1`;
}

async function inserirQuadro(p: Page, titulo: string, pelo: 'barra' | 'gerenciador' = 'barra'): Promise<void> {
  if (pelo === 'barra') await p.getByRole('toolbar', { name: 'Formatação do texto' }).getByRole('button', { name: 'Tabela', exact: true }).click();
  else {
    // "Nova tabela ou quadro…" do gerenciador (Etapa 4): sempre um novo, depois do selecionado.
    await p.getByRole('tab', { name: 'Elementos', exact: true }).click();
    await p.getByRole('button', { name: 'Nova tabela ou quadro…' }).click();
  }
  const janela = p.getByRole('dialog', { name: 'Inserir tabela ou quadro' });
  await janela.getByLabel('Quadro: conteúdo em texto, fechado').check();
  await janela.getByLabel('Título', { exact: true }).fill(titulo);
  await janela.getByLabel('Cabeçalho, linha 1, coluna 1', { exact: true }).fill('Item');
  await janela.getByLabel('Linha 2, coluna 1', { exact: true }).fill(`Conteúdo de ${titulo}`);
  await janela.getByLabel('Fonte', { exact: true }).fill('O autor.');
  await janela.getByRole('button', { name: 'Inserir quadro' }).click();
  await expect(janela).toBeHidden();
}

const abrirAssistente = async (p: Page) => {
  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: 'Assistente de IA…' }).click();
  await expect(p.locator('.assistente-ia')).toBeVisible();
  return p.locator('.assistente-ia');
};

test('Etapa 8: autorização, consumo sem cota informada, interrupção e retomada sem repetir etapa', async () => {
  const estado = { segurar: false, recebidos: [] as Recebido[] };
  const url = await iniciarServidor(estado);
  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByLabel('Título do trabalho').fill('Trabalho com IA');
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await p.getByRole('textbox', { name: 'Texto da seção 1' }).locator('h2').click();
  await inserirQuadro(p, 'Primeiro quadro');
  await inserirQuadro(p, 'Segundo quadro', 'gerenciador');
  await p.keyboard.press('Control+S');
  await expect(p.locator('.visor [role="status"]')).toHaveText(/^Salvo às/);

  // Sem IA configurada: as tarefas ficam desativadas e nada é enviado.
  let painel = await abrirAssistente(p);
  await expect(painel.getByRole('button', { name: /^Revisar tabelas e quadros/ })).toBeDisabled();
  await painel.getByLabel('Serviço').selectOption('personalizado');
  await painel.getByLabel('Endereço da API').fill(url);
  await painel.getByLabel('Modelo').fill('modelo-de-teste');
  await painel.getByRole('button', { name: 'Salvar e ativar' }).click();
  await expect(painel.getByRole('status').last()).toHaveText('Configuração da IA guardada.');

  // Autorização: o conteúdo exato aparece antes; a 1.ª etapa conclui e a 2.ª fica sem resposta.
  await painel.getByRole('button', { name: 'Revisar tabelas e quadros (2)' }).click();
  const autorizar = p.getByRole('dialog', { name: 'Autorizar o envio à IA' });
  await expect(autorizar).toContainText('2 envios');
  await expect(autorizar.getByLabel('Conteúdo que será enviado')).toContainText('Título: Primeiro quadro');
  await expect(autorizar.getByLabel('Conteúdo que será enviado')).toContainText('Título: Segundo quadro');
  await expect.poll(() => estado.recebidos.length).toBe(0);
  await autorizar.getByRole('button', { name: 'Autorizar e enviar' }).click();
  await expect(painel).toContainText('1 de 2 etapas concluídas');
  estado.segurar = true;
  await expect.poll(() => estado.recebidos.length).toBe(2);

  // Consumo: o provedor informou tokens, mas não limites nem cota.
  const consumo = painel.getByRole('region', { name: 'Consumo' });
  await expect(consumo).toContainText('120 tokens (100 de entrada, 20 de saída) em 1 envio');
  await expect(consumo).toContainText('Indisponível: o serviço não informa a cota restante');
  await expect(consumo).not.toContainText('Limite por minuto');

  // Interrupção: o processo cai durante a 2.ª etapa.
  await x.matar();

  // Reabrir: o trabalho avisa da tarefa guardada e o assistente retoma só a 2.ª etapa.
  estado.segurar = false;
  const y = await abrirApp(amb);
  const q = y.pagina;
  await q.getByRole('option', { name: /Trabalho com IA/ }).first().dblclick();
  const aviso = q.getByRole('list', { name: 'Tarefa de IA interrompida' });
  await expect(aviso).toContainText('1 de 2 etapas concluídas, 1 pendentes');
  await aviso.getByRole('button', { name: 'Abrir o assistente de IA' }).click();
  painel = q.locator('.assistente-ia');
  await expect(painel).toContainText('1 de 2 etapas concluídas');
  await painel.getByRole('button', { name: 'Retomar (1 pendentes)' }).click();
  const autorizar2 = q.getByRole('dialog', { name: 'Autorizar o envio à IA' });
  await expect(autorizar2).toContainText('1 envio');
  await expect(autorizar2.getByLabel('Conteúdo que será enviado')).toContainText('Título: Segundo quadro');
  await expect(autorizar2.getByLabel('Conteúdo que será enviado')).not.toContainText('Título: Primeiro quadro');
  await autorizar2.getByRole('button', { name: 'Autorizar e enviar' }).click();
  await expect(painel).toContainText('2 de 2 etapas concluídas');
  // O quadro 1 foi enviado uma vez só; o 2 duas (a que caiu e a retomada).
  expect(estado.recebidos.filter((r) => r.conteudo.includes('Título: Primeiro quadro'))).toHaveLength(1);
  expect(estado.recebidos.filter((r) => r.conteudo.includes('Título: Segundo quadro'))).toHaveLength(2);

  // Aplicar a sugestão do quadro 1: entra no editor (título trocado) e não pode ser aplicada de novo.
  const sugestao = painel.locator('.assistente-ia__sugestao', { hasText: 'Quadro 1' });
  await expect(sugestao).toContainText('Título: “Título revisado de Quadro 1”');
  await sugestao.getByRole('button', { name: 'Aplicar no texto' }).click();
  const editor = q.getByRole('textbox', { name: 'Texto da seção 1' });
  await expect(editor.locator('.bd-tabela').first()).toHaveAttribute('aria-label', 'Quadro: Título revisado de Quadro 1');
  await expect(editor.locator('.bd-tabela').nth(1)).toHaveAttribute('aria-label', 'Quadro: Segundo quadro');
  painel = await abrirAssistente(q);
  await expect(painel).toContainText('Quadro 1 – Primeiro quadro: sugestão aplicada');
  await expect(painel.locator('.assistente-ia__sugestao', { hasText: 'Quadro 1' })).toHaveCount(0);
});
