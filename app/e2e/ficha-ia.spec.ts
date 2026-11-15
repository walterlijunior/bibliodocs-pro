/**
 * Etapa 3 da especificação de atualização, ficha institucional, "Preenchimento opcional com IA" (aceite): com a IA
 * desativada nada é enviado e o fluxo manual continua; com a IA configurada (servidor falso compatível, no endereço
 * local), o trecho de manual colado é mostrado na autorização, a sugestão passa pela prévia com o trecho de origem e o
 * que ficou incerto, a ligação a um câmpus desconhecido vira pendência e o perfil sugerido entra sem revisão.
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

const SUGESTAO = {
  instituicao: { nome: 'Universidade Federal de Teste', sigla: 'UFTE' },
  campi: [{ nome: 'Campus Sul', especie: 'campus', cidade: 'Gurupi', uf: 'TO', trecho: 'Câmpus de Gurupi' }],
  cursos: [
    { nome: 'Agronomia', nivel: 'graduacao', grau: 'bacharelado', campi: ['Campus Sul'], trecho: 'Agronomia (bacharelado), em Gurupi' },
    { nome: 'Zootecnia', nivel: 'graduacao', campi: ['Campus Leste'], incerto: true },
  ],
  disciplinas: [],
  docentes: [],
  manuais: [{ titulo: 'Manual de Normalização', edicao: '2. ed.', data: '2024', trecho: 'Manual de Normalização, 2. ed.' }],
  perfis: [{ nome: 'TCC da UFTE', manual: 'Manual de Normalização', secao: 'Seção 3', regras: { margemSuperiorCm: 3 }, instrucoes: ['Até 60 páginas.'], trecho: 'margem superior de 3 cm' }],
  observacoes: ['O texto não informa a entrelinha.'],
};

test('Etapa 3: preencher a ficha com IA passa pela autorização e pela prévia, com origem e incertezas', async () => {
  const recebidos: string[] = [];
  servidor = createServer((req, res) => {
    let corpo = '';
    req.on('data', (c: Buffer) => (corpo += c.toString('utf8')));
    req.on('end', () => {
      recebidos.push((JSON.parse(corpo) as { messages: { content: string }[] }).messages.at(-1)!.content);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(SUGESTAO) } }], usage: { prompt_tokens: 300, completion_tokens: 200, total_tokens: 500 } }));
    });
  });
  await new Promise<void>((ok) => servidor!.listen(0, '127.0.0.1', () => ok()));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/v1`;

  const x = await abrirApp(amb);
  const p = x.pagina;
  await criarTrabalho(p);
  await p.getByRole('navigation', { name: 'Elementos pré-textuais' }).getByRole('button', { name: /^Capa/ }).click();
  const abrirCatalogo = async () => {
    await p.getByRole('button', { name: 'Catálogo acadêmico…' }).click();
    const cat = p.getByRole('dialog', { name: 'Catálogo acadêmico' });
    const ficha = cat.getByRole('group', { name: 'Ficha institucional' });
    await ficha.getByRole('button', { name: 'Preencher com IA…' }).click();
    await ficha.getByLabel('Endereço da fonte (https)').fill('https://www.exemplo.edu.br/manual');
    await ficha.getByLabel('Texto da fonte').fill('Manual de Normalização, 2. ed. O curso de Agronomia (bacharelado), em Gurupi, usa margem superior de 3 cm.');
    return { cat, ficha };
  };

  // IA desativada: o envio é recusado com a explicação e nada sai.
  let { cat, ficha } = await abrirCatalogo();
  await ficha.getByRole('button', { name: 'Enviar à IA…' }).click();
  await expect(ficha.getByRole('status').last()).toContainText('A IA está desativada');
  expect(recebidos).toEqual([]);
  await cat.getByRole('button', { name: 'Cancelar' }).click();

  // Configurar a IA (servidor local compatível).
  await p.getByRole('menuitem', { name: 'Trabalho' }).click();
  await p.getByRole('menuitem', { name: 'Assistente de IA…' }).click();
  const painel = p.locator('.assistente-ia');
  await painel.getByLabel('Serviço').selectOption('personalizado');
  await painel.getByLabel('Endereço da API').fill(url);
  await painel.getByLabel('Modelo').fill('modelo-de-teste');
  await painel.getByRole('button', { name: 'Salvar e ativar' }).click();
  await expect(painel.getByRole('status').last()).toHaveText('Configuração da IA guardada.');
  await p.getByRole('tab', { name: 'Escrever', exact: true }).click();
  await p.getByRole('navigation', { name: 'Elementos pré-textuais' }).getByRole('button', { name: /^Capa/ }).click();

  // Autorização com o conteúdo exato; cancelar não envia.
  ({ cat, ficha } = await abrirCatalogo());
  await ficha.getByRole('button', { name: 'Enviar à IA…' }).click();
  const autorizar = p.getByRole('dialog', { name: 'Autorizar o envio à IA' });
  await expect(autorizar.getByLabel('Conteúdo que será enviado')).toContainText('usa margem superior de 3 cm');
  await expect(autorizar.getByLabel('Conteúdo que será enviado')).toContainText('Origem do texto: https://www.exemplo.edu.br/manual');
  await autorizar.getByRole('button', { name: 'Cancelar' }).click();
  await expect(ficha.getByRole('status').last()).toContainText('Nada saiu do computador');
  expect(recebidos).toEqual([]);
  await ficha.getByRole('button', { name: 'Enviar à IA…' }).click();
  await autorizar.getByRole('button', { name: 'Autorizar e enviar' }).click();
  await expect.poll(() => recebidos.length).toBe(1);

  // A sugestão passa pela prévia: origem, incerteza, pendência; nada entra antes de "Incluir no catálogo".
  const previa = cat.getByRole('region', { name: /Prévia da importação/ });
  const origens = previa.getByRole('group', { name: 'Origem das sugestões da IA' });
  await expect(origens).toContainText('Curso ou programa: Agronomia — “Agronomia (bacharelado), em Gurupi”');
  await expect(origens).toContainText('Incerto: Curso ou programa: Zootecnia');
  await expect(origens).toContainText('O texto não informa a entrelinha.');
  await expect(previa.getByRole('group', { name: 'Pendências para revisar' })).toContainText('Zootecnia');
  await previa.getByRole('button', { name: 'Incluir no catálogo' }).click();
  await expect(ficha).toContainText('TCC da UFTE — ainda não revisado');
  await ficha.getByRole('button', { name: 'Ver as regras' }).click();
  await expect(ficha).toContainText('Fonte: Manual de Normalização, 2. ed., Seção 3');
  await cat.getByRole('button', { name: 'Guardar' }).click();
  await expect(cat).toHaveCount(0);

  // O câmpus e o curso sugeridos aparecem no seletor do trabalho; Zootecnia (pendente) não.
  await p.getByLabel('Instituição do catálogo').selectOption({ label: 'Universidade Federal de Teste (UFTE)' });
  await p.getByLabel('Câmpus ou polo do catálogo').selectOption({ label: 'Campus Sul' });
  await expect(p.getByLabel('Curso ou programa do catálogo').locator('option')).toHaveText(['Escolha…', 'Agronomia (graduação)']);
  expect(x.problemas).toEqual([]);
  await x.fechar();
});
