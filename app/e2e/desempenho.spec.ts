/**
 * RNF-06 / RNF-07 (M2-T01, R-M1-01, R36): o documento grande (≈150 páginas, 25 MiB de mídia) no Electron real.
 *
 * - abrir pela Biblioteca em menos de 3 s;
 * - digitar 200 caracteres no editor da primeira seção (uma tecla a cada 60 ms), com instantâneos de recuperação a
 *   cada ~2 s e um Ctrl+S no meio, com p95 abaixo de 50 ms por tecla (RNF-06; gatilho do ADR-0007). Desde o M2-T06 a
 *   tecla passa pelo ProseMirror, pela conversão editor → modelo e pela `SessaoTrabalho.alterarSecao` (no M2-T01 era o
 *   campo do título);
 * - travadas do processo principal: no Electron, o JS do principal roda na thread que encaminha o teclado ao
 *   renderer, então travar o principal atrasa a tecla. Antes do M2-T01 eram 250–400 ms por instantâneo;
 * - menos de 800 MB somando todos os processos do app, numa fase à parte (o `getAppMetrics` roda no principal e
 *   atrapalharia a medida das teclas), com um instantâneo e um salvamento durante as amostras.
 *
 * Latência por tecla: do envio pelo teste (`Date.now()` antes do `keyboard.press`) até o quadro seguinte ao evento
 * `input` na página (`requestAnimationFrame`), no mesmo relógio do sistema. Inclui a ida pelo CDP: é um teto.
 * O relógio das travadas tem a granularidade do temporizador do Windows (~16 ms): só conta atraso acima de 40 ms.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { textoPlano, type Documento } from '../src/dominio/modelo';
import { empacotarProjeto } from '../src/persistencia';
import { gerarDocumentoGrande } from '../tests/apoio/documento-grande';
import { abrirApp, criarAmbiente, lerDocumento, type Ambiente } from './apoio/app';

const TECLAS = 200;
const INTERVALO_TECLAS_MS = 60;
const META_TECLA_MS = 50;
const META_ABRIR_MS = 3_000;
const META_MEMORIA_MB = 800;
/** Guardas contra a volta do R36 (antes: travadas de 244–406 ms e tecla de até 328 ms). */
const LIMITE_TRAVADA_MS = 100;
const LIMITE_TECLA_MAIS_LENTA_MS = 150;

let amb: Ambiente;
test.beforeEach(() => {
  amb = criarAmbiente();
});
test.afterEach(async () => amb.apagar());

const percentil = (valores: readonly number[], p: number) => {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)]!;
};

test('RNF-06/07: documento de 150 páginas e 25 MiB — abrir, digitar com instantâneos e salvar', async () => {
  test.setTimeout(180_000);
  const grande = gerarDocumentoGrande({ titulo: 'Documento grande' });
  const empacotado = empacotarProjeto(grande.pacote);
  if (!empacotado.ok) throw new Error('documento grande inválido');
  const arquivo = join(amb.trabalhos, 'Documento grande.bdp');
  writeFileSync(arquivo, empacotado.bytes);

  const x = await abrirApp(amb);
  const p = x.pagina;
  const visor = p.locator('.visor [role="status"]');
  const travadasPrincipal = () => x.app.evaluate(() => (globalThis as unknown as { __travadas: number[] }).__travadas.splice(0));
  const memoriaMb = () =>
    x.app.evaluate(({ app }) => app.getAppMetrics().reduce((soma, m) => soma + m.memory.workingSetSize, 0) / 1024);

  // Relógio de 5 ms no próprio processo principal: cada atraso acima de 40 ms é uma travada.
  await x.app.evaluate(() => {
    const g = globalThis as unknown as { __travadas: number[] };
    g.__travadas = [];
    let anterior = performance.now();
    setInterval(() => {
      const agora = performance.now();
      if (agora - anterior > 45) g.__travadas.push(agora - anterior - 5);
      anterior = agora;
    }, 5);
  });

  // 1. Abrir pela Biblioteca.
  const cartao = p.getByRole('option', { name: /^Documento grande,/ });
  await expect(cartao).toBeVisible();
  const campo = p.getByLabel('Título do trabalho');
  const inicioAbrir = Date.now();
  await cartao.dblclick();
  await expect(campo).toHaveValue('Documento grande', { timeout: 20_000 });
  const abrirMs = Date.now() - inicioAbrir;

  // 2. Digitar no fim do texto da seção 1.1.1 (os capítulos e as secundárias só têm título; o texto fica nas terciárias,
  // ~1/48 do documento cada): a página anota, por tecla, o quadro seguinte ao `input`.
  await p.locator('.lista-secoes__botao', { has: p.locator('.lista-secoes__numero', { hasText: /^1\.1\.1$/ }) }).click();
  const editor = p.getByRole('textbox', { name: 'Texto da seção 1.1.1' });
  await editor.click();
  await p.keyboard.press('Control+End');
  await p.evaluate(() => {
    const g = globalThis as unknown as { __quadros: number[] };
    g.__quadros = [];
    document.querySelector('.bd-editor')!.addEventListener('input', () => {
      requestAnimationFrame(() => g.__quadros.push(Date.now()));
    });
  });
  await travadasPrincipal(); // descarta as da abertura

  const envios: number[] = [];
  let digitado = '';
  for (let i = 0; i < TECLAS; i++) {
    const inicio = Date.now();
    envios.push(inicio);
    await p.keyboard.press(i % 10 === 4 ? 'Space' : 'a');
    digitado += i % 10 === 4 ? ' ' : 'a';
    // Salvamento no meio da digitação (o automático de 30 s faz o mesmo); Ctrl+S não gera `input`.
    if (i === TECLAS / 2) await p.keyboard.press('Control+S');
    const espera = INTERVALO_TECLAS_MS - (Date.now() - inicio);
    if (espera > 0) await p.waitForTimeout(espera);
  }
  await expect.poll(() => p.evaluate(() => (globalThis as unknown as { __quadros: number[] }).__quadros.length)).toBe(TECLAS);
  // O último instantâneo (~2 s depois da última tecla) também conta.
  await p.waitForTimeout(3_000);
  const quadros = await p.evaluate(() => (globalThis as unknown as { __quadros: number[] }).__quadros);
  const latencias = quadros.map((q, i) => q - envios[i]!);
  const travadas = await travadasPrincipal();

  // 3. Memória: amostras a cada 100 ms enquanto mais uma alteração gera instantâneo e o Ctrl+S grava.
  let memoriaPico = await memoriaMb();
  const memoriaAberto = memoriaPico;
  await p.keyboard.press('b');
  const fimAmostras = Date.now() + 4_000;
  let salvou = false;
  while (Date.now() < fimAmostras) {
    memoriaPico = Math.max(memoriaPico, await memoriaMb());
    if (!salvou && Date.now() > fimAmostras - 1_500) {
      await p.keyboard.press('Control+S');
      salvou = true;
    }
    await p.waitForTimeout(100);
  }
  await expect(visor).toHaveText(/^Salvo às/, { timeout: 20_000 });
  memoriaPico = Math.max(memoriaPico, await memoriaMb());

  // 4. O arquivo tem o que foi digitado, no fim da seção 1.1.1.
  const corpo = (JSON.parse(lerDocumento(arquivo).json) as Documento).corpo;
  const ultimo = corpo[0]!.subsecoes[0]!.subsecoes[0]!.blocos.at(-1)!;
  expect(ultimo.tipo === 'paragrafo' && textoPlano(ultimo.conteudo).endsWith(`${digitado}b`)).toBe(true);

  const resumo = {
    paginas: grande.paginasEstimadas,
    mibMidias: grande.bytesMidias / 1048576,
    abrirMs,
    teclaP50Ms: percentil(latencias, 50),
    teclaP95Ms: percentil(latencias, 95),
    teclaMaxMs: Math.max(...latencias),
    travadasPrincipal: travadas.length,
    maiorTravadaMs: travadas.length ? Math.max(...travadas) : 0,
    memoriaAbertoMb: memoriaAberto,
    memoriaPicoMb: memoriaPico,
  };
  const texto = Object.entries(resumo)
    .map(([k, v]) => `${k}=${Math.round(v)}`)
    .join(' ');
  const lentas = latencias.flatMap((l, i) => (l > 40 ? [`${i}:${l}`] : [])).join(',');
  console.log(`[M2-T06] ${texto} lentas=${lentas}`);
  test.info().annotations.push({ type: 'desempenho', description: `${texto} lentas=${lentas}` });

  await p.keyboard.press('Control+W');
  await x.fechar();
  expect(x.problemas).toEqual([]);

  expect(abrirMs).toBeLessThan(META_ABRIR_MS);
  expect(resumo.teclaP95Ms).toBeLessThan(META_TECLA_MS);
  // O p95 de 200 teclas tolera até 10 lentas, mais que os ~6 instantâneos: quem pega a volta do R36 são as guardas
  // abaixo (revisão do M2-T01, F7). A tecla mais lenta tem limite largo: em 9 rodadas foi de 11 a 30 ms, com uma de
  // 80 ms sem nenhuma travada do principal (atraso do sistema ou do CDP, não do app).
  expect(resumo.teclaMaxMs).toBeLessThan(LIMITE_TECLA_MAIS_LENTA_MS);
  expect(resumo.maiorTravadaMs).toBeLessThan(LIMITE_TRAVADA_MS);
  // Memória: margem de 5–12% na medição do M2-T01 (pico 700–760 MB); a soma do `workingSetSize` conta em cada processo
  // as páginas compartilhadas, então superestima. Não é amostrada durante a digitação (o `getAppMetrics` trava o
  // principal); a fase 3 repete um instantâneo e um salvamento (revisão F6).
  expect(memoriaPico).toBeLessThan(META_MEMORIA_MB);
});
