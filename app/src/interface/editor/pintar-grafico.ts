/**
 * Pinta as primitivas do gráfico (`dominio/visuais/grafico.ts`) num canvas: na tela (`GraficoView`, janela do gráfico) e
 * no PNG da exportação (M5-T09; D-M5-08). O desenho é o mesmo nos dois; muda só a resolução.
 *
 * Preenchimentos em tons de cinza e padrões, legíveis impressos em preto e branco: cinza escuro, listras diagonais, cinza
 * claro, pontos, quadriculado e cinza médio, em ciclo. Marcadores das linhas: círculo, quadrado, triângulo, losango,
 * círculo vazado e quadrado vazado. Texto na fonte do trabalho, em preto.
 */
import type { BlocoGrafico, BlocoTabela, Secao } from '../../dominio/modelo';
import { CORES_GRAFICO, dadosDoGrafico, desenharGrafico, tamanhoGraficoMm, type Primitiva } from '../../aplicacao';
import type { CamposGrafico } from './tabelas';
import { LIMITES_GRAFICOS_EXPORTACAO } from '../../aplicacao/portas/exportacao';

type Contexto = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const PRETO = CORES_GRAFICO.traco;
const BRANCO = CORES_GRAFICO.fundo;

/** Preenchimento do padrão `i`; `passo` é o espaçamento das listras e pontos, em pixels. */
function preenchimento(ctx: Contexto, i: number, passo: number): string | CanvasPattern {
  const tipo = i % 6;
  if (tipo === 0) return CORES_GRAFICO.escuro;
  if (tipo === 2) return CORES_GRAFICO.claro;
  if (tipo === 5) return CORES_GRAFICO.medio;
  const lado = Math.max(4, Math.round(passo));
  const ladrilho = new OffscreenCanvas(lado, lado);
  const l = ladrilho.getContext('2d')!;
  l.fillStyle = BRANCO;
  l.fillRect(0, 0, lado, lado);
  l.strokeStyle = PRETO;
  l.fillStyle = PRETO;
  l.lineWidth = Math.max(1, lado / 6);
  if (tipo === 1 || tipo === 4) {
    l.beginPath();
    l.moveTo(0, lado);
    l.lineTo(lado, 0);
    l.moveTo(-lado / 2, lado / 2);
    l.lineTo(lado / 2, -lado / 2);
    l.moveTo(lado / 2, lado * 1.5);
    l.lineTo(lado * 1.5, lado / 2);
    if (tipo === 4) {
      l.moveTo(0, 0);
      l.lineTo(lado, lado);
    }
    l.stroke();
  } else {
    l.beginPath();
    l.arc(lado / 2, lado / 2, Math.max(0.8, lado / 6), 0, Math.PI * 2);
    l.fill();
  }
  return ctx.createPattern(ladrilho, 'repeat') ?? CORES_GRAFICO.medio;
}

function marcador(ctx: Contexto, x: number, y: number, t: number, forma: number): void {
  const r = t / 2;
  const tipo = forma % 6;
  ctx.beginPath();
  if (tipo === 0 || tipo === 4) ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (tipo === 1 || tipo === 5) ctx.rect(x - r, y - r, t, t);
  else if (tipo === 2) {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.lineTo(x - r, y + r);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  }
  ctx.fillStyle = tipo >= 4 ? BRANCO : PRETO;
  ctx.fill();
  ctx.strokeStyle = PRETO;
  ctx.setLineDash([]);
  ctx.stroke();
}

export function pintar(ctx: Contexto, primitivas: readonly Primitiva[], fonte: string, largura: number, altura: number, tamanhoTexto: number): void {
  ctx.save();
  ctx.fillStyle = BRANCO;
  ctx.fillRect(0, 0, largura, altura);
  const fino = Math.max(1, tamanhoTexto / 14);
  const passo = tamanhoTexto * 0.45;
  // R-M5-08: um ladrilho por padrão em cada pintura, não um por retângulo.
  const cache = new Map<number, string | CanvasPattern>();
  const preencher = (i: number): string | CanvasPattern => {
    const k = i % 6;
    let f = cache.get(k);
    if (f === undefined) cache.set(k, (f = preenchimento(ctx, k, passo)));
    return f;
  };
  for (const p of primitivas) {
    switch (p.tipo) {
      case 'retangulo':
        ctx.fillStyle = preencher(p.padrao);
        ctx.fillRect(p.x, p.y, p.largura, p.altura);
        ctx.lineWidth = fino;
        ctx.strokeStyle = PRETO;
        ctx.setLineDash([]);
        ctx.strokeRect(p.x, p.y, p.largura, p.altura);
        break;
      case 'setor':
        ctx.beginPath();
        ctx.moveTo(p.cx, p.cy);
        ctx.arc(p.cx, p.cy, p.raio, p.inicio, p.fim);
        ctx.closePath();
        ctx.fillStyle = preencher(p.padrao);
        ctx.fill();
        ctx.lineWidth = fino;
        ctx.strokeStyle = PRETO;
        ctx.setLineDash([]);
        ctx.stroke();
        break;
      case 'traco':
        ctx.beginPath();
        p.pontos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.lineWidth = p.espessura;
        ctx.strokeStyle = PRETO;
        ctx.setLineDash([...p.tracejado]);
        ctx.stroke();
        break;
      case 'marcador':
        ctx.lineWidth = fino;
        marcador(ctx, p.x, p.y, p.tamanho, p.forma);
        break;
      case 'texto':
        ctx.save();
        ctx.fillStyle = PRETO;
        ctx.font = `${p.tamanho}px "${fonte}", serif`;
        ctx.textAlign = p.alinhar === 'inicio' ? 'left' : p.alinhar === 'fim' ? 'right' : 'center';
        ctx.textBaseline = p.base === 'topo' ? 'top' : p.base === 'meio' ? 'middle' : 'alphabetic';
        ctx.translate(p.x, p.y);
        if (p.rotacao) ctx.rotate(p.rotacao);
        ctx.fillText(p.texto, 0, 0);
        ctx.restore();
        break;
    }
  }
  ctx.restore();
}

/** Medida real do texto na fonte do trabalho (o domínio só estima). */
function medidor(ctx: Contexto, fonte: string): (texto: string, tamanho: number) => number {
  return (texto, tamanho) => {
    ctx.font = `${tamanho}px "${fonte}", serif`;
    return ctx.measureText(texto).width;
  };
}

/** Desenha no contexto em `largura` × `altura` px, com o texto em 10 pt na resolução `ppi`. `false` = sem dados. */
export function desenharEm(ctx: Contexto, campos: Pick<CamposGrafico, 'forma' | 'series'>, tabela: BlocoTabela | null | undefined, largura: number, altura: number, ppi: number, fonte: string): boolean {
  const d = dadosDoGrafico(campos, tabela);
  if (!d.ok) return false;
  const tamanhoTexto = (10 * ppi) / 72;
  const primitivas = desenharGrafico(d, campos.forma, largura, altura, { tamanhoTexto, medir: medidor(ctx, fonte) });
  pintar(ctx, primitivas, fonte, largura, altura, tamanhoTexto);
  return true;
}

/** Resolução do PNG exportado (D-M5-48): 300 ppi no tamanho impresso. */
export const PPI_GRAFICO = 300;

/** PNG do gráfico no tamanho impresso, a 300 ppi; `null` sem dados (a exportação sai sem a imagem, com aviso). */
export async function pngDoGrafico(campos: Pick<CamposGrafico, 'forma' | 'series'>, tabela: BlocoTabela | null | undefined, larguraMm: number, alturaMm: number, fonte: string): Promise<Uint8Array | null> {
  const largura = Math.round((larguraMm / 25.4) * PPI_GRAFICO);
  const altura = Math.round((alturaMm / 25.4) * PPI_GRAFICO);
  const canvas = new OffscreenCanvas(largura, altura);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    if (!desenharEm(ctx, campos, tabela, largura, altura, PPI_GRAFICO, fonte)) return null;
  } catch {
    return null; // R-M5-01: o gráfico sai sem a imagem, com aviso, em vez de travar a exportação.
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * PNG de todos os gráficos gerados do documento, pelo id, para a exportação (M5-T09). Gráfico sem dados fica de fora: a
 * exportação sai sem a imagem dele, com aviso.
 */
export async function graficosParaExportar(corpo: readonly Secao[], areaUtilMm: number, fonte: string): Promise<Record<string, Uint8Array>> {
  const tabelas = new Map<string, BlocoTabela>();
  const graficos: BlocoGrafico[] = [];
  const visitar = (secoes: readonly Secao[]): void => {
    for (const s of secoes) {
      for (const b of s.blocos) {
        if (b.tipo === 'tabela') tabelas.set(b.id, b);
        else if (b.tipo === 'grafico') graficos.push(b);
      }
      visitar(s.subsecoes);
    }
  };
  visitar(corpo);
  const saida: Record<string, Uint8Array> = {};
  // R-M5-04: no máximo o que o principal aceita; os demais saem sem a imagem, com aviso, em vez de recusar a exportação.
  for (const g of graficos.slice(0, LIMITES_GRAFICOS_EXPORTACAO.quantidade)) {
    const { larguraMm, alturaMm } = tamanhoGraficoMm(g, areaUtilMm);
    const png = await pngDoGrafico(g, tabelas.get(g.tabela), larguraMm, alturaMm, fonte);
    if (png !== null) saida[g.id] = png;
  }
  return saida;
}

