// Empacotamento do BiblioDocs Pro (M1-T14). Decisões: ADR-0003 (electron-builder, NSIS por usuário) e checklist
// C-13 a C-17 de docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md. Assinatura de código: Etapa 7 (decisão do usuário).
// Em módulo (e não YAML) para o teste tests/empacotamento.test.ts conferir os valores sem dependência nova.

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'app.bibliodocspro.desktop',
  productName: 'BiblioDocs Pro',
  copyright: 'Copyright © 2026 BiblioDocs Pro',

  directories: { output: 'release', buildResources: 'recursos-build' },

  // Só o build do electron-vite e o package.json. As dependências de produção entram sozinhas; React, react-dom e o
  // ProseMirror (com as 3 dependências dele, M2-T05) já vão embutidos no bundle da interface, então ficam fora. Só zod
  // e fflate são carregados pelo principal em execução, e o docx pelo processo utilitário que gera o DOCX (R-E7-09).
  files: [
    'out/**/*',
    'package.json',
    '!out/**/*.map',
    '!node_modules/react/**',
    '!node_modules/react-dom/**',
    '!node_modules/scheduler/**',
    '!node_modules/prosemirror-*/**',
    '!node_modules/orderedmap/**',
    '!node_modules/rope-sequence/**',
    '!node_modules/w3c-keyname/**',
    '!node_modules/**/src/**',
    // O `docx` declara estes dois como dependência, mas eles só trazem tipos; e os formatos que o Node não carrega ficam fora.
    '!node_modules/@types/**',
    '!node_modules/undici-types/**',
    '!node_modules/docx/dist/*.iife.js',
    '!node_modules/docx/dist/*.umd.cjs',
    '!node_modules/**/*.{ts,mts,cts}',
  ],

  // C-19: inventário de licenças (empacotamento/terceiros.cjs), ao lado das licenças do Electron.
  // Licença do próprio aplicativo (GPL-3.0-or-later, decisão do usuário em 2026-11-08), ao lado do executável.
  extraFiles: [
    { from: 'recursos-build/TERCEIROS.txt', to: 'TERCEIROS.txt' },
    { from: '../LICENSE', to: 'LICENSE.txt' },
  ],

  // Usa o binário do Electron já instalado e conferido (SHA-256, M1-T02) em vez de baixar de novo.
  electronDist: 'node_modules/electron/dist',
  // Tira o default_app.asar e o `version` que a limpeza do electron-builder pula com electronDist próprio.
  afterPack: 'empacotamento/apos-empacotar.cjs',
  // Sem módulos nativos.
  npmRebuild: false,
  // C-14
  asar: true,

  // C-13. Sem --inspect o `_electron.launch` do Playwright não dirige o .exe: o E2E roda sobre out/. As chaves do
  // Chromium (ex.: --remote-debugging-port), que nenhum fuse cobre, são recusadas pelo app empacotado
  // (src/principal/seguranca/argumentos.ts); só o artefato de `npm run dist:fumaca` aceita as da fumaça.
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },

  // Ícone: o pequi da interface (recursos-build/icone*.svg → icone.ico por `npm run icone:gerar`). Vale também para o
  // instalador, o desinstalador e os atalhos.
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'recursos-build/icone.ico' },

  // C-16: instalação por usuário, sem elevação. C-17: sem atualização automática (publish: null).
  nsis: {
    oneClick: true,
    perMachine: false,
    allowElevation: false,
    // A-3: o elevate.exe só serve à atualização automática de instalação por máquina; fica fora do pacote.
    packElevateHelper: false,
    // Só cobre %APPDATA%\BiblioDocs Pro (perfil do Chromium), que fica. %LOCALAPPDATA%\BiblioDocsPro (recuperação,
    // backups, índice) e Documentos\BiblioDocs Pro nunca são tocados pelo desinstalador (app/README.md).
    deleteAppDataOnUninstall: false,
    artifactName: 'BiblioDocsPro-Instalador-${version}.${ext}',
    // Apaga a cópia do instalador que o modelo guarda para a atualização automática (que não existe).
    include: 'empacotamento/instalador.nsh',
  },

  publish: null,
};
