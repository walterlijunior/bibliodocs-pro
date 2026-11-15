/**
 * Aceite da Etapa 9 da especificação revista (servidor falso compatível, no endereço local):
 * - gerar uma tabela a partir de um texto de teste: autorização com o conteúdo, prévia, células incertas marcadas que
 *   impedem inserir até a conferência, edição de célula, inserção pelo fluxo normal e o elemento no gerenciador;
 * - sugestão de conformidade: pedida numa ocorrência da tabela, revisada (campo marcado) antes de aplicar; aplicada pelo
 *   editor, e "Voltar ao relatório" mostra a ocorrência resolvida.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { abrirApp, criarAmbiente, criarTrabalho, type Ambiente } from './apoio/app';

let amb: Ambiente;
let servidor: Server | undefined;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => {
  await new Promise<void>((ok) => (servidor ? servidor.close(() => ok()) : ok()));
  await amb.apagar();
});

const TABELA = {
  titulo: 'Matrículas por câmpus, 2020–2022',
  fonte: 'Universidade Fictícia (2023)',
  linhasCabecalho: 1,
  linhas: [
    [{ texto: 'Câmpus' }, { texto: 'Matrículas' }],
    [{ texto: 'Palmas' }, { texto: '1.234' }],
    [{ texto: 'Gurupi' }, { texto: '9?7', incerta: true }],
  ],
  observacoes: [],
};
const SUGESTAO = { explicacao: 'Em série consecutiva, os anos são ligados por hífen.', titulo: 'Matrículas por câmpus, 2020-2022', fonte: null, nota: null, textoSugerido: null, regras: ['RN-279'] };

test('Etapa 9 revista: tabela gerada de texto com células a conferir e sugestão de conformidade revisada antes de aplicar', async () => {
  const recebidos: string[] = [];
  servidor = createServer((req, res) => {
    let corpo = '';
    req.on('data', (c: Buffer) => (corpo += c.toString('utf8')));
    req.on('end', () => {
      const j = JSON.parse(corpo) as { messages: { content: string }[] };
      const sistema = j.messages[0]!.content;
      recebidos.push(j.messages.at(-1)!.content);
      const conteudo = sistema.includes('transcreve tabelas') ? TABELA : SUGESTAO;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(conteudo) } }], usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 } }));
    });
  });
  await new Promise<void>((ok) => servidor!.listen(0, '127.0.0.1', () => ok()));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/v1`;

  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  // IA configurada (servidor local).
  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: 'Assistente de IA…' }).click();
  const painel = p.locator('.assistente-ia');
  await painel.getByLabel('Serviço').selectOption('personalizado');
  await painel.getByLabel('Endereço da API').fill(url);
  await painel.getByLabel('Modelo').fill('modelo-de-teste');
  await painel.getByRole('button', { name: 'Salvar e ativar' }).click();
  await expect(painel.getByRole('status').last()).toHaveText('Configuração da IA guardada.');

  // Gerar a tabela a partir de um texto.
  await p.getByRole('tab', { name: 'Escrever', exact: true }).click();
  await p.getByRole('treeitem', { name: '1 Introdução' }).click();
  await p.getByRole('textbox', { name: 'Texto da seção 1' }).locator('h2').click();
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.getByRole('toolbar', { name: 'Formatação do texto' }).getByRole('button', { name: 'Tabela', exact: true }).click();
  const janela = p.getByRole('dialog', { name: 'Inserir tabela ou quadro' });
  await janela.getByRole('button', { name: 'Gerar com IA…' }).click();
  await janela.getByLabel('Texto da tabela (opcional com imagem)').fill('Câmpus Palmas 1.234; Gurupi 9?7 (borrado)');
  await janela.getByRole('button', { name: 'Enviar à IA…' }).click();
  const autorizar = p.getByRole('dialog', { name: 'Autorizar o envio à IA' });
  await expect(autorizar.getByLabel('Conteúdo que será enviado')).toContainText('Gurupi 9?7 (borrado)');
  await autorizar.getByRole('button', { name: 'Autorizar e enviar' }).click();
  await expect(janela).toContainText('Sugestão da IA');
  await expect(janela.getByRole('list', { name: 'Relatório da conversão' })).toContainText('A IA marcou uma célula para conferir');
  await janela.getByRole('button', { name: 'Usar estes dados' }).click();
  await expect(janela.getByLabel('Título', { exact: true })).toHaveValue('Matrículas por câmpus, 2020–2022');
  await expect(janela.getByLabel('Fonte', { exact: true })).toHaveValue('Universidade Fictícia (2023)');
  // A célula incerta impede inserir até a conferência.
  const inserir = janela.getByRole('button', { name: 'Inserir tabela' });
  await expect(inserir).toBeDisabled();
  await expect(janela.getByRole('list', { name: 'O que impede gravar a tabela' })).toContainText('Células a conferir');
  await janela.getByLabel('Linha 3, coluna 2', { exact: true }).fill('987');
  await expect(inserir).toBeEnabled();
  await inserir.click();
  await expect(janela).toBeHidden();
  await p.getByRole('tab', { name: 'Elementos', exact: true }).click();
  await expect(p.getByRole('tabpanel')).toContainText('Matrículas por câmpus, 2020–2022');

  // Sugestão de conformidade na ocorrência da série com meia-risca.
  await p.getByRole('tab', { name: 'Conformidade', exact: true }).click();
  const relatorio = p.getByRole('region', { name: 'Relatório de conformidade' });
  const item = relatorio.locator('.conformidade__item').filter({ hasText: 'RN-279' });
  await item.getByRole('button', { name: 'Pedir sugestão à IA…' }).click();
  await expect(autorizar.getByLabel('Conteúdo que será enviado')).toContainText('Regra de origem: RN-279');
  await autorizar.getByRole('button', { name: 'Autorizar e enviar' }).click();
  const sugestao = item.getByRole('region', { name: 'Sugestão da IA (revise antes de aplicar)' });
  await expect(sugestao).toContainText('Em série consecutiva');
  const aplicar = sugestao.getByRole('button', { name: 'Aplicar os campos marcados' });
  await expect(aplicar).toBeDisabled();
  await sugestao.getByRole('checkbox', { name: /^Título:/ }).check();
  await aplicar.click();
  const voltar = p.getByRole('region', { name: 'Revisão de conformidade' });
  await expect(voltar).toBeVisible();
  await expect(p.getByRole('textbox', { name: 'Texto da seção 1' }).locator('.bd-tabela')).toHaveAttribute('aria-label', 'Tabela: Matrículas por câmpus, 2020-2022');
  await voltar.getByRole('button', { name: 'Voltar ao relatório' }).click();
  await expect(relatorio.getByRole('status').filter({ hasText: /^Resolvido:/ })).toBeVisible();
  expect(recebidos).toHaveLength(2);
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
