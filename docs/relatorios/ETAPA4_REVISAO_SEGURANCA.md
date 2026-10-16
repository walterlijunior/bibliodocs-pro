# Relatório técnico — Etapa 4: revisão de segurança e manutenção dos runtimes

- **Data:** 2026-10-15 (fontes consultadas nesta data)
- **Autor:** agente `revisor-seguranca` (somente leitura); gravado pela sessão principal
- **Escopo:** alternativas de runtime (Electron, Tauri 2, .NET), formato de projeto, LanguageTool opcional,
  conversão PDF via LibreOffice. Testes só no scratchpad da sessão (rename sobre arquivo bloqueado;
  conversão de cópia da amostra da Etapa 2). Nenhum arquivo do projeto alterado; nada instalado.

## Resumo
Recomenda **Electron 44.x** com o checklist C-1 a C-22; **Tauri 2** é a segunda opção próxima (melhor em
atualização assinada, pior em privacidade padrão do WebView2). Três achados Altos valem para qualquer runtime:
instalador sem assinatura (Smart App Control do Windows 11 bloqueia), auto-update sem certificado (verificação
pulada) e salvamento atômico (rename falha com o arquivo aberto por outro programa — **medido**).

## Contexto verificado
- [VERIFICADO] `app/` só tem `LEIA-ME.md`; `npm audit` não se aplica ainda.
- [VERIFICADO] LibreOffice 26.8.1.1 (`soffice.com --version`); Node 24.21.0; npm 11.19.0.
- [VERIFICADO] `main.js` antigo: `setWindowOpenHandler` passa qualquer URL a `shell.openExternal` (44–47);
  DevTools no F12 do menu de produção (78) — confirma S-9.
- [VERIFICADO] LanguageTool antigo (`components.js:409–417`) envia a seção inteira a `api.languagetool.org/v2/check`.
- [VERIFICADO] Nenhuma chave/token literal fora de `analise/` e `materiais/`.

## Tabela comparativa (1–5; 5 = melhor)

| Critério | (A) Electron | (B) Tauri 2 | (C) .NET (WPF/Avalonia) |
|---|---|---|---|
| Superfície de ataque | 2 (Chromium + Node no pacote) | 4 (Rust, só comandos expostos; WebView2) | 5 (sem motor web) |
| Endurecimento disponível | 5 (checklist oficial, fuses, ASAR integrity) | 4 (capabilities, CSP; avisos de IPC em 2026) | 3 |
| Cadência exigida | 2 (major a cada 8 semanas; 3 suportadas; ~6 meses cada) | 3 (2.12.4 em 2026-10-14; 3.0 em alpha) | 4 (.NET 10 LTS até 2028-11-14) |
| Atualização assinada | 3 (sem certificado, verificação pulada) | 5 (assinatura própria obrigatória) | 2 (sem updater padrão [HIPÓTESE]) |
| Privacidade padrão | 4 (sem telemetria; corretor baixa dicionários do CDN Google) | 3 (SmartScreen/minidumps do WebView2 à Microsoft) | 5 |
| Cadeia de dependências | 2 (árvore npm grande) | 3 (Cargo + npm) | 4 (NuGet) |
| Offline / instalação por usuário | 5 (NSIS `perMachine:false`) | 4 (WebView2 pode exigir download; offline +127 MB) | 5 |
| Reuso do código existente | 5 | 4 | 1 |

## Achados

| ID | Sev. | Achado | Recomendação |
|---|---|---|---|
| SR-01 | Alta | Electron 42 sai de suporte em 2026-10-20; 45 estável na mesma data; suportadas hoje 42–44; última 44.7.2 (2026-10-13) | Electron 44.x (ou 45); política "sempre uma das 3 majors suportadas"; patch mensal |
| SR-02 | Alta | Instalador sem assinatura: aviso SmartScreen; **Smart App Control bloqueia**; Artifact Signing só para pessoa física nos EUA/Canadá | Decisão do usuário: (a) certificado OV; (b) MSIX na Microsoft Store (conta individual gratuita, Store assina); (c) sem assinatura, documentado |
| SR-03 | Alta | electron-updater sem `publisherName` pula a verificação Authenticode | Sem auto-update sem certificado; só "há versão nova?" abrindo a página de releases |
| SR-04 | Média | Corretor ortográfico do Electron ligado por padrão, baixa Hunspell do CDN Google | `spellcheck:false` ou dicionário local; rede bloqueada por padrão (C-8) |
| SR-05 | Média (B/C) | WebView2: SmartScreen ligado e minidumps à Microsoft | Desligar SmartScreen; crash reporting customizado |
| SR-06 | Alta (se B) | Tauri: GHSA-w28w-mhc8-qvjv (≤2.11.5) e GHSA-7gmj-67g7-phm9 (≤2.11.0) | Tauri ≥ 2.12.4 |
| SR-07 | Alta | **Medido:** `fs.renameSync(tmp, alvo)` com destino aberto por outro processo → EPERM (2/2) | Rotina de salvamento atômico (abaixo) |
| SR-08 | Média | **Medido:** LibreOffice com perfil novo — 1.ª conversão saiu com 0xC0000409 sem PDF (4,1 s); 2.ª OK 4,1 s; 3.ª OK 1,7 s | Perfil dedicado aquecido, 1 nova tentativa, validar saída `%PDF` |
| SR-09 | Média | LibreOffice: CVEs de 2026-10-05 (RCE via `calcext:data-mappings`) corrigidos em 26.2.5/26.8.0 | Exigir versão mínima; converter só DOCX do próprio app, sem links externos/OLE |
| SR-10 | Média | API pública do LanguageTool: 20 KB/req, 20 req/min; retém texto e IP sem prazo | Consentimento, minimização, partes ≤ 20 KB, opção de servidor local |
| SR-11 | Baixa | `.gitignore` sem `*.pfx`, `*.p12`, `*.spc` | Acrescentados pela sessão principal em 2026-10-16 |
| SR-12 | Baixa | .NET 8/9 perdem suporte em 2026-11-10 | Se C: `net10.0` |

Hipóteses a confirmar na PoC/Etapa 7: H-1 `kill` do `soffice.com` não mata `soffice.bin` (usar `taskkill /T`);
H-2 download real do dicionário no Windows; H-3 conversões simultâneas no mesmo perfil conflitam (fila);
H-4 instalador Electron < 200 MB; H-5 OneDrive causa EBUSY/conflito; H-6 perfil headless sem verificação de
atualização; H-7 manifestos Ed25519 só no electron-builder 27; H-8 certificado OV ~US$ 150–300/ano (fonte
secundária); H-9 licença do servidor LanguageTool; H-10 updater .NET exige terceiros.

## Checklist de endurecimento obrigatório (Electron 44.x)

**Runtime e janela**
- C-1 Electron numa das 3 majors suportadas; patch mensal; tarefa antes de cada fim de vida.
- C-2 `contextIsolation:true`, `sandbox:true`, `nodeIntegration:false`, `webSecurity:true`, `webviewTag:false`,
  `nodeIntegrationInWorker:false`; sem `allowRunningInsecureContent`/`experimentalFeatures`/`enableBlinkFeatures`.
- C-3 UI por protocolo próprio `app://` (`protocol.handle`), não `file://`, com normalização contra `..`.
- C-4 CSP: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self';
  connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. Fontes embutidas.
- C-5 `will-navigate`/`will-redirect` bloqueiam tudo fora de `app://`; `setWindowOpenHandler` → `deny`.
- C-6 `shell.openExternal` só no processo principal, só `https:` de lista fixa; nunca URL do documento.
- C-7 `setPermissionRequestHandler`/`setPermissionCheckHandler` negam tudo.
- C-8 Rede bloqueada por padrão (`webRequest.onBeforeRequest`); LanguageTool via `net.fetch` no principal, só se ligado.
- C-9 `spellcheck:false` ou dicionário local; `crashReporter` não iniciado.

**IPC**
- C-10 `contextBridge` com API mínima nomeada; nunca `ipcRenderer` cru.
- C-11 Todo `ipcMain.handle` valida `senderFrame.origin` e os argumentos por esquema, com limite de tamanho.
- C-12 Caminhos só de diálogos do processo principal, circulando por identificador opaco.

**Empacotamento**
- C-13 Fuses: `RunAsNode=false`, `EnableNodeOptionsEnvironmentVariable=false`, `EnableNodeCliInspectArguments=false`,
  `EnableEmbeddedAsarIntegrityValidation=true`, `OnlyLoadAppFromAsar=true`, `GrantFileProtocolExtraPrivileges=false`.
- C-14 Integridade do ASAR ligada.
- C-15 DevTools só fora do pacote (`devTools: !app.isPackaged`), sem menu/atalho.
- C-16 NSIS por usuário (`perMachine:false`), sem elevação, desinstalação limpa.
- C-17 Auto-update desligado sem certificado; com certificado, `publisherName` e `forceCodeSigning:true`.

**Dependências e repositório**
- C-18 `package-lock.json` versionado; `npm ci`; `npm audit --omit=dev --audit-level=high`; `npm audit signatures`.
- C-19 Nada sem versão; inventário de licenças (RNF-15); sem html2canvas nem jsPDF.
- C-20 Nenhum HTML montado de dado do usuário; lint proíbe `dangerouslySetInnerHTML`/`innerHTML`.
- C-21 `.gitignore` com `*.pfx`, `*.p12`, `*.spc`; segredos só no CI, nunca com prefixo `VITE_`.
- C-22 Instância única e trava por projeto aberto.

Se Tauri: ≥ 2.12.4; capabilities explícitas sem `remote.urls`; comandos restritos; CSP configurada; SmartScreen do
WebView2 desligado; WebView2 embutido/offline (RNF-02); chave do updater fora do repositório.

## Recomendações específicas

**Arquivo de projeto (ZIP + JSON).** Ler em memória, só nomes permitidos (`mimetype`, `manifest.json`,
`projeto.json`, `midia/<sha256>.<ext>`); rejeitar `..`, absolutos, `\`, unidade, duplicados, links. Limites
`[META]`: arquivo ≤ 500 MB, ≤ 10 000 entradas, `projeto.json` ≤ 50 MB, total ≤ 1 GB, razão ≤ 100:1, contando bytes
reais. JSON Schema estrito com `formatoVersao` e migrações testadas; versão mais nova → só leitura ou recusa.
`manifest.json` com SHA-256 por entrada. Imagens: bytes mágicos e limite de pixels; SVG saneado ou rasterizado.
Texto como nós estruturados, nunca HTML. Importador do JSON antigo pelo mesmo validador, com prévia.

**Salvamento atômico.** (1) gravar `<nome>.bdp.tmp-<aleatório>` no mesmo diretório; (2) fsync e fechar;
(3) preservar o atual como `.bak` (ou `ReplaceFileW`); (4) renomear o temporário; (5) em EPERM/EBUSY/EACCES,
~5 tentativas em ~2 s; (6) se falhar, manter original e temporário, avisar, oferecer "Salvar como";
(7) ao abrir, oferecer recuperação de `.tmp-*` órfão. Autosave em `%LOCALAPPDATA%\BiblioDocsPro\recuperacao\`
com versões rotativas e indicador na interface. Aviso para caminho no OneDrive.

**LanguageTool (opcional, decidido pelo usuário em 2026-10-15).** Desligado por padrão; consentimento no
primeiro uso (o que vai, para quem, retenção, limites, link da política); revogável. Só a seção corrente por
ação explícita, nunca capa/autor/referências; partes ≤ 20 KB; 20 req/min. Servidor configurável (local
`http://127.0.0.1:8081` aceito só em loopback; remoto só `https:`). Chamada pelo processo principal.

**PDF via LibreOffice (após o M7, decidido pelo usuário).** Caminho absoluto de `soffice.com` (registro ou
escolha do usuário), nunca PATH; `spawn(..., {shell:false, windowsHide:true})`, nunca `.bat`/`.cmd`
(CVE-2024-27980). Cópia com nome ASCII gerado em diretório temporário exclusivo. Argumentos:
`-env:UserInstallation=<file URL do perfil dedicado> --headless --norestore --nologo --nodefault --nolockcheck
--convert-to pdf --outdir <tmp> <arquivo>`. Perfil dedicado aquecido, fila única, 1 nova tentativa, validação
`%PDF`, tempo limite 120 s `[META]` encerrando a árvore de processos, versão mínima exigida.

## Fontes primárias (consultadas em 2026-10-15)
- Electron: https://releases.electronjs.org/schedule · https://releases.electronjs.org/releases/stable ·
  https://www.electronjs.org/docs/latest/tutorial/electron-timelines · https://www.electronjs.org/docs/latest/tutorial/security ·
  https://www.electronjs.org/docs/latest/tutorial/fuses · https://www.electronjs.org/docs/latest/tutorial/spellchecker ·
  https://www.electronjs.org/docs/latest/api/crash-reporter
- electron-builder: https://www.electron.build/docs/features/security/ · https://www.electron.build/docs/win/ ·
  https://www.electron.build/docs/nsis · https://github.com/electron-userland/electron-builder/releases
- Tauri: https://v2.tauri.app/security/capabilities/ · https://v2.tauri.app/security/csp/ · https://v2.tauri.app/plugin/updater/ ·
  https://v2.tauri.app/distribute/windows-installer/ · https://github.com/tauri-apps/tauri/releases ·
  https://github.com/tauri-apps/tauri/security/advisories
- WebView2: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution ·
  https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/data-privacy
- .NET: https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core · https://github.com/AvaloniaUI/Avalonia/releases
- Assinatura/Store: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation ·
  https://learn.microsoft.com/azure/artifact-signing/quickstart ·
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements
- npm audit: https://docs.npmjs.com/cli/v11/commands/npm-audit · Node CVE-2024-27980:
  https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2
- Windows: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-replacefilew
- LibreOffice: https://www.libreoffice.org/about-us/security/advisories/
- LanguageTool: https://dev.languagetool.org/public-http-api · https://dev.languagetool.org/http-server ·
  https://languagetool.org/legal/privacy
