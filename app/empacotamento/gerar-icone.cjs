// Gera recursos-build/icone.ico a partir de recursos-build/icone.svg (32 px ou mais) e icone-pequeno.svg (16 e 24 px).
// Uso: `npm run icone:gerar` (roda no Electron já instalado: sem dependência nova para rasterizar SVG).
// Cada tamanho é desenhado do vetor num canvas do tamanho exato (não é redução de uma imagem grande).
// O .ico leva uma entrada PNG por tamanho, formato aceito pelo Windows desde o Vista.
// Com uma pasta como argumento, grava também os PNGs nela (para conferir o desenho).
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const RECURSOS = join(__dirname, '..', 'recursos-build');
const TAMANHOS = [
  { lado: 16, svg: 'icone-pequeno.svg' },
  { lado: 24, svg: 'icone-pequeno.svg' },
  { lado: 32, svg: 'icone.svg' },
  { lado: 48, svg: 'icone.svg' },
  { lado: 64, svg: 'icone.svg' },
  { lado: 128, svg: 'icone.svg' },
  { lado: 256, svg: 'icone.svg' },
];

/** Monta um .ico com uma entrada PNG por imagem (cabeçalho ICONDIR + ICONDIRENTRY de 16 bytes cada). */
function montarIco(imagens) {
  const cabecalho = Buffer.alloc(6 + 16 * imagens.length);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4);
  let deslocamento = cabecalho.length;
  imagens.forEach(({ lado, png }, i) => {
    const e = 6 + 16 * i;
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, e); // 0 = 256
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, e + 1);
    cabecalho.writeUInt8(0, e + 2); // sem paleta
    cabecalho.writeUInt8(0, e + 3);
    cabecalho.writeUInt16LE(1, e + 4); // planos
    cabecalho.writeUInt16LE(32, e + 6); // bits por pixel
    cabecalho.writeUInt32LE(png.length, e + 8);
    cabecalho.writeUInt32LE(deslocamento, e + 12);
    deslocamento += png.length;
  });
  return Buffer.concat([cabecalho, ...imagens.map((i) => i.png)]);
}

async function rasterizar(janela, svg, lado) {
  const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const dataUrl = await janela.webContents.executeJavaScript(`new Promise((ok, falha) => {
    const img = new Image(${lado}, ${lado});
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = ${lado}; c.height = ${lado};
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, ${lado}, ${lado});
      ok(c.toDataURL('image/png'));
    };
    img.onerror = () => falha(new Error('SVG inválido'));
    img.src = ${JSON.stringify(url)};
  })`);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

app.whenReady().then(async () => {
  const pastaPng = process.argv.slice(2).find((a) => !a.startsWith('-') && !a.endsWith('.cjs'));
  const janela = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await janela.loadURL('data:text/html,<!doctype html><title>icone</title>');
    const imagens = [];
    for (const { lado, svg } of TAMANHOS) {
      const png = await rasterizar(janela, readFileSync(join(RECURSOS, svg), 'utf8'), lado);
      imagens.push({ lado, png });
      if (pastaPng) {
        mkdirSync(pastaPng, { recursive: true });
        writeFileSync(join(pastaPng, `icone-${lado}.png`), png);
      }
    }
    const ico = montarIco(imagens);
    writeFileSync(join(RECURSOS, 'icone.ico'), ico);
    console.log(`icone.ico: ${imagens.map((i) => i.lado).join(', ')} px; ${ico.length} bytes`);
    app.exit(0);
  } catch (erro) {
    console.error(erro);
    app.exit(1);
  }
});
