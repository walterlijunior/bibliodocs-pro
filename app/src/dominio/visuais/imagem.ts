/**
 * Imagem da ilustração (M5-T06; RF-10; RNF-17; D-M5-09): tipo, tamanho em pixels e resolução gravada no arquivo, lidos
 * só do cabeçalho do PNG (IHDR, pHYs) e do JPEG (SOFn, JFIF). Nada é decodificado: o arquivo de fora não chega a um
 * decodificador aqui, e um cabeçalho fora do formato devolve `null`.
 *
 * - Largura impressa: a do autor (`larguraMm`) ou a natural (pixels na resolução do arquivo, 96 ppi se não há), nunca
 *   maior que a área útil.
 * - Resolução efetiva: pixels por polegada no tamanho impresso. Abaixo de 150 ppi, aviso (RNF-17, D-M5-09).
 */

export interface InfoImagem {
  tipo: 'image/png' | 'image/jpeg';
  larguraPx: number;
  alturaPx: number;
  /** Resolução horizontal gravada no arquivo; `null` quando não há (ou é só proporção). */
  ppi: number | null;
}

/** RNF-17 e D-M5-09: abaixo disto, a figura sai borrada impressa. */
export const RESOLUCAO_MINIMA_PPI = 150;
/** Resolução suposta quando o arquivo não grava a sua (a do Word e dos navegadores). */
export const PPI_PADRAO = 96;
const MM_POR_POLEGADA = 25.4;
/** Tamanho máximo aceito em cada lado (o Word recusa desenho com mais de 225 457 px; folga grande abaixo disso). */
const MAX_PX = 100_000;

const u16 = (b: Uint8Array, i: number): number => (b[i]! << 8) | b[i + 1]!;
const u32 = (b: Uint8Array, i: number): number => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const ascii = (b: Uint8Array, i: number, n: number): string => String.fromCharCode(...b.subarray(i, i + n));

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function lerPng(b: Uint8Array): InfoImagem | null {
  if (b.length < 33 || ascii(b, 12, 4) !== 'IHDR') return null;
  const larguraPx = u32(b, 16);
  const alturaPx = u32(b, 20);
  let ppi: number | null = null;
  // Blocos até o primeiro IDAT: o pHYs vem antes dele (especificação do PNG).
  for (let i = 8; i + 12 <= b.length; ) {
    const tamanho = u32(b, i);
    const tipo = ascii(b, i + 4, 4);
    if (tipo === 'IDAT' || tipo === 'IEND') break;
    if (tipo === 'pHYs' && tamanho >= 9 && i + 17 <= b.length && b[i + 16] === 1) ppi = u32(b, i + 8) * 0.0254;
    i += 12 + tamanho;
  }
  // R-M5-07: pHYs com 0 (ou absurdamente baixo) não é resolução: vale a padrão, como sem o bloco.
  return { tipo: 'image/png', larguraPx, alturaPx, ppi: ppi !== null && ppi >= 10 ? ppi : null };
}

/** Marcadores SOF com o tamanho do quadro (todos os SOFn, menos DHT C4, JPG C8 e DAC CC). */
const ehSof = (m: number): boolean => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

function lerJpeg(b: Uint8Array): InfoImagem | null {
  let ppi: number | null = null;
  for (let i = 2; i + 4 <= b.length; ) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1]!;
    if (m === 0xff) {
      i++;
      continue;
    }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) {
      i += 2;
      continue;
    }
    if (m === 0xd9 || m === 0xda) return null; // fim, ou dados da imagem sem quadro antes
    const tamanho = u16(b, i + 2);
    if (tamanho < 2 || i + 2 + tamanho > b.length) return null;
    if (m === 0xe0 && tamanho >= 14 && ascii(b, i + 4, 5) === 'JFIF\0') {
      const unidade = b[i + 11];
      const x = u16(b, i + 12);
      if (unidade === 1 && x > 0) ppi = x;
      else if (unidade === 2 && x > 0) ppi = x * 2.54;
    }
    if (ehSof(m) && tamanho >= 7) return { tipo: 'image/jpeg', larguraPx: u16(b, i + 7), alturaPx: u16(b, i + 5), ppi };
    i += 2 + tamanho;
  }
  return null;
}

/** Tipo, pixels e resolução, pelo cabeçalho. `null`: não é PNG nem JPEG, ou o cabeçalho não fecha. */
export function lerInfoImagem(bytes: Uint8Array): InfoImagem | null {
  let info: InfoImagem | null = null;
  if (bytes.length >= 8 && ASSINATURA_PNG.every((x, i) => bytes[i] === x)) info = lerPng(bytes);
  else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) info = lerJpeg(bytes);
  if (!info || info.larguraPx < 1 || info.alturaPx < 1 || info.larguraPx > MAX_PX || info.alturaPx > MAX_PX) return null;
  return info;
}

/** Largura impressa em mm: a do autor ou a natural, limitada à área útil. */
export function larguraImpressaMm(info: InfoImagem, larguraMm: number | undefined, areaUtilMm: number): number {
  const natural = (info.larguraPx / (info.ppi ?? PPI_PADRAO)) * MM_POR_POLEGADA;
  return Math.min(larguraMm ?? natural, areaUtilMm);
}

/** Pixels por polegada no tamanho impresso. */
export function resolucaoEfetivaPpi(info: InfoImagem, larguraImpressa: number): number {
  return info.larguraPx / (larguraImpressa / MM_POR_POLEGADA);
}

/** Largura que dá exatamente a resolução mínima (para sugerir ao autor), em mm inteiros. */
export function larguraParaResolucaoMinimaMm(info: InfoImagem): number {
  return Math.floor((info.larguraPx / RESOLUCAO_MINIMA_PPI) * MM_POR_POLEGADA);
}
