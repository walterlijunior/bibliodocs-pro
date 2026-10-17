# BiblioDocs Pro — aplicativo

Aplicativo desktop (Windows) para elaborar e formatar trabalhos acadêmicos conforme o Manual de
Normalização da UFT e as normas ABNT. Tecnologia: Electron 44 + electron-vite 6 (Vite 8) + React 19 +
TypeScript 7 + Vitest 5 (ADR-0003, ADR-0006). Módulos e regras de dependência: ADR-0005.

Estado: esqueleto do M1-T01 com o runtime endurecido no M1-T02. Ainda não há funcionalidade; a janela só
mostra o nome do aplicativo.

## Requisitos

- Windows 10/11 x64.
- Node.js 24 (testado com 24.21.0) e npm 11 (testado com 11.19.0).
- Nada global além do Node. Todas as dependências ficam em `app/node_modules`.

## Comandos (rodar dentro de `app/`)

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências locais com as versões exatas do `package.json` (`.npmrc` tem `save-exact=true`). O binário do Electron é baixado no primeiro `npm run dev`, ou antes com `node node_modules/electron/install.js` |
| `npm run dev` | Abre o aplicativo em desenvolvimento (servidor Vite com recarga do renderer) |
| `npm run build` | Gera `out/principal`, `out/preload` e `out/interface` |
| `npm run preview` | Abre o aplicativo a partir do build em `out/` |
| `npm run typecheck` | `tsc --noEmit` nos quatro projetos TypeScript (node, puro, web e e2e) |
| `npm test` | `vitest run` (testes em `tests/`) |
| `npm run verificar` | **Comando único de verificação:** `typecheck` → `vitest run` → `npm audit --omit=dev --audit-level=high`. Para na primeira etapa que falhar e sai com código diferente de zero. O `npm audit` consulta o registro do npm, portanto precisa de rede |
| `npm run esquemas:gerar` | Regrava o JSON Schema de `esquemas/projeto-v1/` a partir dos esquemas zod. Rode depois de mudar `src/dominio/esquemas/projeto-v1.ts`; o `verificar` falha enquanto o arquivo versionado estiver diferente |
| `npm run test:e2e` | `build` + E2E do Playwright no Electron real (`e2e/`): fluxo do trabalho, recuperação após `taskkill`, casca em 3 escalas, zero rede (net-log) e defesas do runtime. Abre janelas na tela (~25 s). Dados, biblioteca e perfil do Chromium ficam numa pasta temporária apagada no fim; roda mesmo com o app aberto |
| `npm run verificar:tudo` | `verificar` + `build` + E2E. As camadas OOXML e LibreOffice (M3) entram aqui quando existirem |
| `npm run dist` | `build` + instalador NSIS por usuário em `release/BiblioDocsPro-Instalador-<versão>.exe` (M1-T14). Configuração em `electron-builder.config.cjs`; ganchos em `empacotamento/`. Sem assinatura até a Etapa 7: **não distribuir** |
| `npm run dist:pasta` | Igual, mas só a pasta `release/win-unpacked/` (sem instalador) |
| `npm run dist:fumaca` | Pasta em `release-fumaca/` com a marca `bibliodocsFumaca`, a única que aceita `--remote-debugging-port`, `--user-data-dir` e `--log-net-log` (fumaça por CDP). Nunca distribuir |

### Instalador (M1-T14)

- Por usuário, sem administrador: vai para `%LOCALAPPDATA%\Programs\bibliodocs-pro`, com atalhos na Área de Trabalho e
  no Menu Iniciar e registro só em `HKCU`. Medido em 2026-10-17: instalador 111,8 MB, instalado 390,2 MB (meta RNF-08:
  < 200 MB para o instalador).
- Fuses (C-13) e integridade do ASAR (C-14) ligados: o Playwright não dirige o `.exe`, e o E2E roda sobre `out/`.
- O app empacotado recusa toda chave de linha de comando (`-x`, `--x`, `/x`) antes de um `--`, exceto `--updated`
  (do instalador), e sai com código 2 (`src/principal/seguranca/argumentos.ts`).
- **O desinstalador não apaga os dados do usuário.** Ficam, até que o usuário os apague:
  - `Documentos\BiblioDocs Pro\Trabalhos` (ou a pasta escolhida): os trabalhos `.bdp`;
  - `%LOCALAPPDATA%\BiblioDocsPro`: índice da biblioteca, preferências, backups e cópias de recuperação, que contêm o
    texto dos trabalhos;
  - `%APPDATA%\BiblioDocs Pro`: perfil do Chromium (cache e trava de instância única).
- Com o Controle Inteligente de Aplicativos do Windows 11 ativo, um `.exe` sem assinatura pode ser bloqueado
  ("Uma política de Controle de Aplicativo bloqueou este arquivo"). Medido no M1-T14: o artefato de fumaça foi
  bloqueado e o do instalador não. Não contornar; a assinatura é decisão da Etapa 7.

### Testes de arquitetura (M1-T03)

O analisador fica em `tests/apoio/analisador-fontes.ts`: um léxico mínimo e expressões regulares, sem dependência
nova (ADR-0006, camada 3). As funções são puras e recebem `{arquivo, conteudo}`. Assim, os casos negativos usam
arquivos sintéticos em memória e nenhum arquivo violador fica em `src/`.

| Teste | O que verifica |
|---|---|
| `tests/arquitetura-fronteiras.test.ts` | Regras 1 a 6 do ADR-0005, seção 2, sobre todo o `src/` (import/export from, `import type`, `import()`, `require()`, `/// <reference>`), com a tabela de permissões do domínio escrita em `PERMISSOES_DOMINIO`. Também verifica que todo arquivo pertence a um módulo previsto. Inclui um caso negativo por regra e casos positivos (sem falso positivo) |
| `tests/arquitetura-varreduras.test.ts` | Regra 7/C-20 (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, `document.write`, `eval(`, `Function(`…); regra 8 (módulos e chamadas de rede fora de `src/integracoes/revisao-texto/`); C-6 (`shell.openExternal` só em `src/principal/seguranca/endurecimento.ts`); C-18/C-19 (lockfile v3 em sincronia, nada sem versão, sem `html2canvas`/`jspdf`) |

Comentários e conteúdo de strings são ignorados. Por isso, o texto `'https:'` da política de URLs não conta como
rede: contam as importações e as chamadas. Um `import()`/`require()` com especificador calculado é recusado,
porque não dá para verificá-lo.

Uma mensagem de falha tem esta forma: `src/dominio/modelo/x.ts:2 — import 'electron' — ADR-0005 regra 1: domínio não usa plataforma: 'electron'`.

### Formato de projeto v1 (M1-T04)

- **Fonte da verdade:** esquemas zod em `src/dominio/esquemas/projeto-v1.ts`. Os objetos são estritos (campo
  desconhecido é recusado) e toda string e lista tem limite (`limites.ts`). Os tipos do modelo ficam em
  `src/dominio/modelo/tipos.ts`, e um teste de tipos exige que `z.infer` do esquema seja igual a `Documento`.
- **Validação:** `validarDocumentoV1(json)` e `validarManifestoV1(json)` devolvem `{ok, valor}` ou `{ok:false, erros}`,
  com caminho e mensagem em pt-BR (ex.: `documento.corpo[0].subsecoes[0]: campo não permitido: "numero"`).
  Antes do zod, uma checagem iterativa recusa aninhamento JSON acima de 144 níveis; depois dele, a árvore de seções
  é limitada a 64 níveis.
- **JSON Schema** (draft 2020-12): `esquemas/projeto-v1/{documento,manifesto}.schema.json`, gerado por `z.toJSONSchema`.
  As restrições que ele não expressa estão em `RESTRICOES_SO_NO_CODIGO`. O validador do app é o zod.
- **Fixtures:** `tests/fixtures/projeto-v1/`.

### Contêiner `.bdp` (M1-T05)

- `empacotarProjeto(pacote)` valida tudo e gera o ZIP em memória:
  - a ordem das entradas é `mimetype` (primeiro e sem compressão), `manifesto.json`, `documento.json`, a `miniatura.png`
    opcional e as `midias/<sha256>.png|jpg`, gravadas sem recompressão;
  - a data das entradas é fixa, então o mesmo conteúdo gera os mesmos bytes;
  - antes de entregar, **relê o resultado com `lerProjeto`**: o app nunca grava um arquivo que ele mesmo recusaria.
- `lerProjeto(bytes)` devolve `{ok, pacote, avisos}` ou `{ok:false, erros}`. Nunca grava nada em disco.
  - O diretório central do ZIP é analisado por código próprio (`src/persistencia/conteiner/zip-leitura.ts`). Só é aceito
    o ZIP que o app grava:
    - sem ZIP64, criptografia, descritor de dados, comentário ou multivolume;
    - entradas contíguas, sem lacuna nem sobreposição;
    - cabeçalho local igual ao central.
  - Antes de descomprimir, o leitor confere:
    - a lista de nomes permitidos;
    - os limites do ADR-0004 (1 GB por arquivo, 5.000 entradas, 2 MB para o manifesto, 64 MB por JSON ou mídia, 2 GB no total);
    - a razão de compressão de até 200:1, conferida acima de 1 MB.
  - A descompressão é **sob demanda e na ordem da validação**: `mimetype` → manifesto (para logo se for inválido) →
    documento → só as mídias declaradas. Usa `node:zlib` com `maxOutputLength`, exige que o fluxo deflate termine no fim
    dos dados e confere o CRC-32. Os bytes devolvidos são cópias, sem memória compartilhada com o arquivo.
  - O `id` e o `tipoTrabalho` do manifesto têm de ser iguais aos do documento.
  - Mídia com sha256, tamanho, CRC ou assinatura PNG/JPEG divergente é **descartada com aviso**, sem impedir a abertura.
- O `fflate` só é usado para **escrever** (`zipSync`).
- Os pacotes maliciosos dos testes são montados por `tests/apoio/zip-bruto.ts`.

## Estrutura

```text
app/
├─ electron.vite.config.mts   build dos três alvos (principal, preload, renderer)
├─ vitest.config.mts          testes em Node
├─ tsconfig.base.json         opções estritas comuns
├─ tsconfig.node.json         principal, preload, persistencia, integracoes, exportacao, importacao, testes
├─ tsconfig.puro.json         dominio e aplicacao: sem DOM e sem Node (ADR-0005, regras 1 e 3)
├─ tsconfig.web.json          interface (renderer, DOM, JSX)
├─ esquemas/projeto-v1/       JSON Schema gerado do formato .bdp v1 (versionado)
├─ perfis/uft-2022/           perfil normativo em dados (JSON, a partir do M3)
├─ src/
│  ├─ principal/              processo principal do Electron (janela, menus, protocolo, IPC)
│  ├─ preload/                ponte isolada entre renderer e principal (CommonJS, sandbox)
│  ├─ persistencia/           arquivo .bdp, salvamento atômico, backup, biblioteca (ADR-0004)
│  ├─ integracoes/            LibreOffice e LanguageTool (após o M7)
│  ├─ aplicacao/              serviços, comandos e portas
│  ├─ interface/              React 19 (renderer)
│  ├─ exportacao/docx/        DOCX a partir do DocumentoFormatado
│  ├─ importacao/             backup tcc-uft, CSV/XLSX, BibTeX/RIS
│  └─ dominio/                TypeScript puro
│     ├─ modelo/  numeracao/  bibliografia/  visuais/
│     ├─ normas/  verificador/  esquemas/
└─ tests/                     testes Vitest
```

Cada pasta de `src/` tem um `index.ts` que descreve o módulo e as regras de dependência dele. As
fronteiras entre módulos são verificadas por `tests/arquitetura-fronteiras.test.ts` (M1-T03).

## Segurança

Checklist C-1 a C-22: `docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md` (raiz do repositório). O M1-T02 cobre os
itens do runtime. As decisões ficam em funções puras testadas sem Electron; só
`src/principal/seguranca/endurecimento.ts` e `src/principal/index.ts` importam `electron`.

| Item | O que está feito | Onde |
|---|---|---|
| C-2 | `contextIsolation`, `sandbox`, `nodeIntegration:false`, `nodeIntegrationInWorker:false`, `nodeIntegrationInSubFrames:false`, `webSecurity:true`, `webviewTag:false`, `allowRunningInsecureContent:false`, `experimentalFeatures:false`; `app.enableSandbox()` | `src/principal/index.ts` |
| C-3 | Produção servida por `app://interface/` (`registerSchemesAsPrivileged` antes do ready + `protocol.handle`) a partir de `out/interface`; nada de `loadFile`/`file://`. Recusa `..`, `%2e%2e`, `\`, `%5c`, `%2f`, `%00`, `:`, codificação dupla, host diferente, métodos que não sejam GET/HEAD e extensões sem tipo MIME conhecido | `seguranca/protocolo-caminho.ts`, `seguranca/endurecimento.ts` |
| C-4 | CSP de produção idêntica ao checklist, no cabeçalho de toda resposta do `app://` (com `nosniff`). CSP de desenvolvimento separada (ver abaixo) | `seguranca/csp.ts` |
| C-5 | `will-navigate`, `will-redirect`, `will-frame-navigate` bloqueiam tudo fora da origem; `setWindowOpenHandler` → `deny`; `will-attach-webview` bloqueado; aplicado a todo webContents por `web-contents-created` | `seguranca/politica-urls.ts`, `seguranca/endurecimento.ts` |
| C-6 | `abrirLinkExterno` só no principal: `https:`, porta padrão, sem credenciais, host exato de `HOSTS_EXTERNOS_PERMITIDOS` (vazia no M1), com confirmação por `dialog.showMessageBox`. Ainda não é chamada (sem IPC até o M1-T08) | idem |
| C-7 | `setPermissionRequestHandler`, `setPermissionCheckHandler` e `setDevicePermissionHandler` negam tudo | `seguranca/endurecimento.ts` |
| C-8 | `webRequest.onBeforeRequest` cancela tudo fora de `app://interface`, `data:` só como imagem e `blob:` da origem só como imagem ou xhr/fetch; em desenvolvimento, também a origem http exata do Vite, o `ws://` do mesmo host:porta e `devtools:` | idem |
| C-9 | `spellcheck:false` na janela e `setSpellCheckerEnabled(false)` na sessão; `crashReporter` não é iniciado (teste estático) | `src/principal/index.ts`, `seguranca/endurecimento.ts` |
| C-15 | `devTools: !app.isPackaged`; menu nulo no app empacotado (sem item nem atalho); DevTools fechadas se abertas no pacote | `src/principal/index.ts`, `seguranca/endurecimento.ts` |
| C-21 | `.gitignore` com `*.pfx`, `*.p12`, `*.spc`, `.env`, `.env.*` | `.gitignore` |
| C-22 (parte 1) | `app.requestSingleInstanceLock()`; a segunda instância foca a janela existente | `src/principal/index.ts` |

**Produção × desenvolvimento.** O modo de desenvolvimento só é usado com o app **não empacotado** e
`ELECTRON_RENDERER_URL` apontando para `http://` em loopback (`localhost`, `127.0.0.1`, `[::1]`); qualquer outro
valor é ignorado e o app usa `app://`. No desenvolvimento, o Vite + `@vitejs/plugin-react` precisam de script
inline (preâmbulo do React Refresh), estilos inline e WebSocket (HMR). Por isso a CSP de desenvolvimento acrescenta
`'unsafe-inline'` em `script-src`/`style-src` e `ws://<host:porta do Vite>` em `connect-src`, sempre restrita à
origem exata do servidor dev e sem `'unsafe-eval'`. Ela é aplicada por `webRequest.onHeadersReceived` só nesse
modo e não existe no build (o `index.html` não tem `<meta>` de CSP). `npm run preview` usa o build e o `app://`,
portanto a CSP de produção.

**Logs.** Bloqueios são registrados no console só como `protocolo//host` (`urlParaLog`), nunca com caminho,
query ou fragmento, para não expor dados do usuário.

**Risco aceito (revisão M1-T02, B-5).** Quem roda pelo código-fonte (`npm run preview`, `electron .`) com
`ELECTRON_RENDERER_URL` de loopback definida no shell entra no modo de desenvolvimento. Não afeta o instalador,
porque o controle `app.isPackaged` vem antes.

**Fica para outras tarefas:** C-10 a C-12 (IPC tipado, validação de `sender`, caminhos por diálogo) no M1-T08;
C-18 a C-20 cobertos no M1-T03 (`npm run verificar` com `npm audit`; lockfile, `html2canvas`/`jspdf` e varreduras de `innerHTML`/rede em `tests/arquitetura-varreduras.test.ts`), exceto o inventário de licenças (RNF-15) e `npm audit signatures`, que continuam pendentes; C-13, C-14, C-16 e C-17 (fuses,
integridade do ASAR, NSIS por usuário, sem auto-update) no M1-T14; trava por projeto aberto (C-22, parte 2) na
persistência (M1-T12); C-1 (política de atualização do Electron) é processo, não código.

Testes: `tests/seguranca-politica-urls.test.ts`, `tests/seguranca-protocolo-caminho.test.ts` e
`tests/seguranca-runtime.test.ts` (CSP e verificação estática do processo principal).
