// Gancho afterPack do electron-builder (M1-T14).
// Com `electronDist` apontando para node_modules/electron/dist, o electron-builder não faz a limpeza que faz no zip
// baixado (ElectronFramework.cleanupAfterUnpack com isFullCleanup = false). Sobram resources/default_app.asar
// (o app padrão do Electron) e o arquivo `version`. Os dois saem aqui, antes do instalador ser montado.
// A-8: confere que sumiram, para que uma mudança de caminho numa versão futura não passe calada.
const { existsSync } = require('node:fs');
const { rm } = require('node:fs/promises');
const { join } = require('node:path');

/** @param {{ appOutDir: string }} contexto */
exports.default = async function aposEmpacotar(contexto) {
  for (const relativo of [join('resources', 'default_app.asar'), 'version']) {
    const caminho = join(contexto.appOutDir, relativo);
    await rm(caminho, { force: true });
    if (existsSync(caminho)) throw new Error(`afterPack: não consegui apagar ${caminho}`);
  }
};
