# BiblioDocs Pro — desenvolvimento

Aplicativo desktop (Windows) para elaborar e formatar trabalhos acadêmicos conforme o Manual de
Normalização da UFT e as normas ABNT. Tecnologia: Electron 44 + electron-vite 6 (Vite 8) + React 19 +
TypeScript 7 + Vitest 5 (ADR-0003, ADR-0006). Módulos e regras de dependência: ADR-0005.

Estado: Etapa 7 (estabilização e distribuição). Marcos M1 a M7 entregues; histórico em `CHANGELOG.md` e em
`docs/ESTADO_DO_PROJETO.md`. Guia para quem usa o aplicativo: `README.md`; instalação: `docs/INSTALACAO_APP.md`.

## Requisitos

- Windows 10/11 x64.
- Node.js 24 (testado com 24.21.0) e npm 11 (testado com 11.19.0).
- Nada global além do Node. Todas as dependências ficam em `app/node_modules`.

## Comandos (rodar dentro de `app/`)

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências locais com as versões exatas do `package.json` (`.npmrc` tem `save-exact=true`). O binário do Electron é baixado no primeiro `npm run dev`, ou antes com `node node_modules/electron/install.js` |
| `npm ci` | Instala exatamente o que está no `package-lock.json`, sem alterá-lo. Prefira-o para reproduzir um build |
| `npm run dev` | Abre o aplicativo em desenvolvimento (servidor Vite com recarga do renderer) |
| `npm run build` | Gera `out/principal`, `out/preload` e `out/interface` |
| `npm run preview` | Abre o aplicativo a partir do build em `out/` |
| `npm run typecheck` | `tsc --noEmit` nos quatro projetos TypeScript (node, puro, web e e2e) |
| `npm test` | `vitest run` (testes em `tests/`) |
| `npm run verificar` | **Comando único de verificação:** `typecheck` → `vitest run` → `npm audit --audit-level=high` (com as de desenvolvimento, porque o Electron distribuído é uma delas) → `npm audit signatures`. Para na primeira etapa que falhar e sai com código diferente de zero. O `npm audit` consulta o registro do npm, portanto precisa de rede |
| `npm run esquemas:gerar` | Regrava o JSON Schema de `esquemas/projeto-v1/` a partir dos esquemas zod. Rode depois de mudar `src/dominio/esquemas/projeto-v1.ts`; o `verificar` falha enquanto o arquivo versionado estiver diferente |
| `npm run test:e2e` | `build` + E2E do Playwright no Electron real (`e2e/`): fluxo do trabalho, recuperação após `taskkill`, casca em 3 escalas, zero rede (net-log), defesas do runtime e desempenho com o documento grande (150 páginas, 25 MiB). Abre janelas na tela (~50 s). Dados, biblioteca e perfil do Chromium ficam numa pasta temporária apagada no fim; roda mesmo com o app aberto |
| `npm run test:externos` | Validador OOXML (`test:ooxml`, exige .NET SDK 10), `test:libreoffice` e `test:word`, sobre o corpus. Sem o programa, o grupo pula com aviso |
| `npm run verificar:tudo` | `verificar` + `test:externos` + `build` + E2E. As camadas OOXML e LibreOffice (M3) entram aqui quando existirem |
| `npm run dist` | `build` + instalador NSIS por usuário em `release/BiblioDocsPro-Instalador-<versão>.exe` (M1-T14). Configuração em `electron-builder.config.cjs`; ganchos em `empacotamento/`. Sem assinatura (decisão D-E7-01 pendente): **não distribuir**. Build para distribuir: com o cache do electron-builder limpo (`%LOCALAPPDATA%\electron-builder\Cache`), porque a pasta extraída é validada só pela contagem (adendo do E7-T01 no ADR-0003) |
| `npm run dist:pasta` | Igual, mas só a pasta `release/win-unpacked/` (sem instalador) |
| `node empacotamento/terceiros.cjs` | Regrava `recursos-build/TERCEIROS.txt` a partir do lockfile. Rode depois de mudar dependência de produção; com `--conferir`, só verifica (os `dist*` fazem isso) |
| `powershell -NoProfile -File ferramentas/word/conferir-no-word.ps1 -Arquivo x.docx [-Pdf x.pdf]` | Abre o DOCX no Word real, em somente leitura, e informa páginas, seções, notas, campos e sumário. **Não prova** ausência de reparo (R47) |
| Ctrl+E no aplicativo | Exportar › Exportar DOCX…: o motor roda no principal e o DOCX, em processo utilitário (`principal/exportador-docx.ts`) |
| `npm run medir` | Tempo e memória de exportar 150 páginas, contra o RNF-06 |
| `npm run fumaca:exportar` | Gera o artefato de fumaça e exporta um DOCX pelo `.exe`, com fuses e ASAR ligados |
| `npm run icone:gerar` | Regrava `recursos-build/icone.ico` (16 a 256 px) a partir de `recursos-build/icone.svg` e `icone-pequeno.svg`, desenhando no próprio Electron. Rode depois de mudar os SVGs |
| `npm run dist:fumaca` | Pasta em `release-fumaca/` com a marca `bibliodocsFumaca`, a única que aceita `--remote-debugging-port`, `--user-data-dir` e `--log-net-log` (fumaça por CDP). Nunca distribuir |

### Instalador (M1-T14)

- Por usuário, sem administrador: vai para `%LOCALAPPDATA%\Programs\bibliodocs-pro`, com atalhos na Área de Trabalho e
  no Menu Iniciar e registro só em `HKCU`. Medido em 2026-11-02: instalador 113 MB, instalado 381 MB (meta RNF-08:
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

### Do salvamento ao pacote (M1-T06 a M1-T14)

As decisões e os desvios de cada parte estão no adendo indicado. As regras para mexer em cada parte ficam em
`docs/ESTADO_DO_PROJETO.md`, na seção "Instruções para etapas futuras".

| Parte | Onde | Testes | Decisões |
|---|---|---|---|
| Salvamento atômico (temporário → `fsync` → `.bak` → troca, com tentativas no Windows) e abertura do disco | `src/persistencia/arquivo/` | `tests/persistencia-salvamento.test.ts` | ADR-0004, adendo M1-T06 |
| Migrações de formato (funções puras, backup antes de migrar, versão futura só leitura) | `src/dominio/esquemas/`, `src/persistencia/arquivo/projeto-em-disco.ts` | `tests/persistencia-migracoes.test.ts`, `tests/fixtures/migracoes/` | ADR-0004, adendo M1-T07 |
| IPC tipado (remetente conferido, identificadores opacos, caminho só por diálogo, leitura no processo `leitor-projeto`) | `src/aplicacao/portas/`, `src/principal/ipc/`, `src/preload/` | `tests/ipc-projetos.test.ts` | ADR-0005, adendo M1-T08 |
| Biblioteca (pasta de trabalhos, índice-cache recriável, criar/renomear/duplicar/excluir) | `src/persistencia/biblioteca/`, `src/principal/ipc/manipuladores-biblioteca.ts` | `tests/biblioteca.test.ts` | ADR-0004, adendo M1-T09 |
| Casca da interface (visor com pequi, menus, abas, barra lateral, grade), tokens e teclado | `src/interface/casca/`, `src/interface/biblioteca/`, `src/interface/estilos/` | `tests/interface/casca.test.tsx`, `tests/interface-logica.test.ts`, `tests/interface-tokens.test.ts` | ADR-0005, adendo M1-T10; `docs/GUIA_VISUAL.md` |
| Sessão de edição (fila única de gravação, automático ~30 s depois da última alteração, estado no visor) | `src/aplicacao/servicos/sessao-trabalho.ts`, `src/interface/escrever/` | `tests/sessao-trabalho.test.ts` | ADR-0004, adendo M1-T11 |
| Recuperação (instantâneo ~2 s, trava de sessão, restos de gravação, `recuperacao-antigos`) | `src/persistencia/recuperacao/`, `src/principal/ipc/manipuladores-recuperacao.ts` | `tests/recuperacao.test.ts` | ADR-0004, adendo M1-T12 |
| E2E no Electron real | `e2e/` (apoio em `e2e/apoio/app.ts`) | ver abaixo | ADR-0006, adendo M1-T13 |
| Empacotador fora da thread do principal (`worker_threads` de vida longa) e mídias uma vez por identificador (`PacoteEnvio`, bytes guardados no `RegistroProjetos` em `SharedArrayBuffer`) | `src/principal/empacotador.ts`, `src/principal/ipc/empacotador-isolado.ts`, `src/principal/ipc/registro-projetos.ts` | `tests/empacotador.test.ts`, `tests/midias-uma-vez.test.ts`, `e2e/desempenho.spec.ts` | ADR-0004, adendo M2-T01 |
| Documento grande de medição (≈150 páginas, 25 MiB de mídia, determinístico) | `tests/apoio/documento-grande.ts` | `tests/documento-grande.test.ts` | relatório do M2 (M2-T01) |
| Empacotamento (NSIS por usuário, fuses, ASAR íntegro, recusa de chaves de linha de comando) | `electron-builder.config.cjs`, `empacotamento/`, `src/principal/seguranca/argumentos.ts` | `tests/empacotamento.test.ts`, `tests/seguranca-argumentos.test.ts` | ADR-0003, adendo M1-T14 |

### Testes E2E (M1-T13; desempenho no M2-T01; editor no M2-T06; árvore de seções no M2-T07; tipos no M2-T02; pré-textuais no M2-T08)

`npm run test:e2e` roda 14 testes, um Electron por vez:

| Arquivo | O que verifica | Casos da matriz |
|---|---|---|
| `e2e/fluxo-trabalho.spec.ts` | Criar, salvar, fechar e reabrir (também depois de reiniciar o app): título idêntico e `.bdp` não regravado ao abrir | FUN-01 |
| `e2e/recuperacao.spec.ts` | Encerrar o processo com `taskkill /F /T` durante a edição, recuperar, salvar, segunda queda e "Abrir o arquivo salvo" | FUN-10 (RNF-04) |
| `e2e/casca.spec.ts` | As quatro faixas da janela da largura mínima à maximizada, em 100%, 125% e 150% (3 testes); Ctrl+F, foco visível, sem marca de terceiros | UI-01, UI-02 |
| `e2e/rede-e-seguranca.spec.ts` | Zero atividade de rede pelo net-log do Chromium; CSP, `eval`, navegação, `window.open`, travessia do `app://` e instância única | SEG-08, SEG-03 |
| `e2e/desempenho.spec.ts` | Documento grande (150 páginas, 25 MiB): abrir < 3 s, p95 por tecla < 50 ms **digitando no editor da seção 1.1.1** com instantâneos e Ctrl+S, travada do principal < 100 ms, memória < 800 MB. As medidas saem no console (`[M2-T06] ...`) e na anotação do teste | DES-01 (RNF-06, RNF-07) |
| `e2e/editor.spec.ts` | Editor de seção: acentos (teclado, `insertText`, IME pelo CDP), itálico, desfazer/refazer, nota, salvar e reabrir idêntico; colagem com a área de transferência real (`clipboard.write([new ClipboardItem(...)])`) e pelo menu Editar; net-log sem a imagem remota; árvore de seções pelo teclado e arrastando, barra superior e desfazer único (3 testes) | E2E-08, E2E-09, E2E-10 |

Os dados, a biblioteca e o perfil do Chromium ficam numa pasta temporária. Um teste novo deve usar `criarAmbiente`,
`abrirApp` e `fechar`/`matar` do apoio e conferir que `x.problemas` termina vazio (console, exceções e CSP).

### Tipos de trabalho (M2-T02)

"Novo trabalho" abre `interface/biblioteca/DialogoNovoTrabalho.tsx`; o principal cria o arquivo com `criarTrabalhoDoTipo`
(`src/aplicacao/servicos/criar-trabalho.ts`). Elementos, presença, RN e fonte de cada tipo em
`src/dominio/normas/tipos-trabalho.ts`; ordem e repetição em `src/dominio/modelo/elementos.ts`. Testes:
`tests/tipos-trabalho.test.ts` (confere as RN na matriz normativa) e FUN-02 em `e2e/fluxo-trabalho.spec.ts`.

### Backups (M2-T10)

`src/persistencia/arquivo/backups-rotativos.ts`, ligado em `principal/ipc/registrar.ts`. Ao lado do trabalho fica `<nome>.bdp.bak`
(última versão); em `%LOCALAPPDATA%\BiblioDocsPro\backups\<id>\`, as cópias `AAAAMMDD-HHMMSS.bdp`. Excluir o trabalho marca essa pasta:
30 dias depois, as cópias são apagadas ao listar a biblioteca, inclusive as de migração; se o trabalho voltar à biblioteca, ficam.

### Pré-textuais (M2-T08)

Lista e formulários em `src/interface/escrever/PreTextuais.tsx`; edição em `src/aplicacao/servicos/pre-textuais.ts`, pela
`SessaoTrabalho`; pendências com RN em `src/dominio/normas/pendencias-pre-textuais.ts`. A interface recebe as pendências
prontas em `trabalho.preTextuais` (não importa `dominio/normas`). Testes: `tests/pre-textuais.test.ts` e FUN-11.

### Núcleo do editor (M2-T05), editor na tela (M2-T06) e árvore de seções (M2-T07)

Em `src/interface/editor/` (ADR-0007, adendos do M2-T05 a M2-T07). Na aba Escrever, a árvore de seções
(`escrever/ArvoreSecoes.tsx`) e o editor da seção escolhida (`escrever/AreaEscrever.tsx`). A seção ativa, os estados
guardados dos editores e a ordem única de desfazer ficam em `escrever/useEstrutura.ts` (acima da aba); as regras puras da
árvore, em `escrever/secoes.ts`; o `HistoricoEdicao`, em `src/aplicacao/servicos/historico-edicao.ts`.

| Arquivo | Papel | Testável em Node |
|---|---|---|
| `esquema.ts` | `Schema` do ProseMirror espelhando `Bloco`/`Inline`; `toDOM` só com classe e `data-*` | Sim |
| `conversao.ts` | `secaoParaDoc`, `docParaSecao`, forma canônica (`normalizarSecao`), `blocosParaSlice` | Sim |
| `ids.ts`, `plugins/ids-unicos.ts` | ids novos para cópias e nós sem id (o nó que já existia mantém o seu) | Sim |
| `plugins/limites.ts` | recusa a transação que passaria dos limites de quantidade do v1 | Sim |
| `html-colado.ts` | HTML colado (Word, LibreOffice, navegador, o próprio app) e texto puro → `Bloco[]` com avisos | Sim (árvore de `tests/apoio/html-minimo.ts`) |
| `colagem.ts` | `DOMParser` inerte (com `neutralizarEstilos` antes, por causa da CSP herdada) e `paste`/`drop`; único arquivo com `DOMParser`; `colarSemFormatacaoNaProxima` para o menu | Não (`e2e/editor.spec.ts`) |
| `comandos.ts` | marcas (fora do texto das notas), nota, quebra de linha, desfazer/refazer, mapa de teclas | Sim |
| `estado.ts` | `criarEstadoSecao`: o único jeito de criar o `EditorState` de uma seção (histórico, teclas e os três plugins) | Sim |
| `nota-view.ts` | NodeView da nota com o editor aninhado do texto dela | Não (E2E) |
| `EditorSecao.tsx` | `EditorView` não controlado; cada transação vai para `SessaoTrabalho.alterarSecao`; `MemoriaEditores` por geração; barra de formatação | Não (E2E) |

- Todo `EditorState` do app nasce em `criarEstadoSecao` (que põe `pluginIdsUnicos`, `pluginLimites` e `pluginColagem`).
- A sessão só emite quando o visor ou a lista de seções mudam; não passe a emitir por tecla (R39, medido no E2E-07).
- Mudança estrutural nova → método da sessão que passa por `#aplicarEstrutura` (registra o inverso no histórico) e, na
  interface, por `concluir` de `useEstrutura` (fecha o grupo de digitação e escolhe a seção ativa). Ctrl+Z/Ctrl+Y no
  editor e na nota vão para `aoHistorico`, nunca direto para o `undo` do estado.
- Menu Editar: Recortar, Copiar e Colar vão pelo canal `edicao` (`src/principal/ipc/manipuladores-edicao.ts`), que pede
  ao principal o mesmo comando das teclas. A página nunca lê a área de transferência por API.
- `prosemirror-*` só pode ser importado dentro desta pasta, e os arquivos testáveis em Node não importam
  `prosemirror-view` (regras E1–E3 em `tests/arquitetura-fronteiras.test.ts`).
- Constantes copiadas do domínio (`PADRAO_ID_EDITOR`, `LIMITE_TEXTO_INLINE`, `CARACTERES_FORA_DO_XML`,
  `LIMITES_EDITOR`) têm teste que as compara com o original. Mudou o formato v1 → atualizar as cópias.
- Fixtures de colagem em `tests/fixtures/colagem/*.html`, escritas à mão no formato de cada origem.

## Estrutura

```text
app/
├─ electron.vite.config.mts   build dos três alvos (principal, preload, renderer)
├─ vitest.config.mts          testes em Node
├─ tsconfig.base.json         opções estritas comuns
├─ tsconfig.json              referência dos projetos abaixo (para o editor)
├─ tsconfig.node.json         principal, preload, persistencia, integracoes, exportacao, importacao, testes
├─ tsconfig.puro.json         dominio e aplicacao: sem DOM e sem Node (ADR-0005, regras 1 e 3)
├─ tsconfig.web.json          interface (renderer, DOM, JSX)
├─ tsconfig.e2e.json          testes E2E (e2e/)
├─ playwright.config.ts       E2E no Electron real, um por vez
├─ electron-builder.config.cjs instalador NSIS e pasta do pacote (M1-T14)
├─ empacotamento/             ganchos do pacote (afterPack, script NSIS) e gerador do ícone
├─ recursos-build/            ícone do app (SVG de origem e .ico gerado)
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
├─ tests/                     testes Vitest
└─ e2e/                       testes E2E (Playwright)
```

Cada pasta de `src/` tem um `index.ts` que descreve o módulo e as regras de dependência dele. As
fronteiras entre módulos são verificadas por `tests/arquitetura-fronteiras.test.ts` (M1-T03).

## Segurança

Checklist C-1 a C-22: `docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md` (raiz do repositório). O M1-T02 cobre os
itens do runtime. As decisões ficam em funções puras testadas sem Electron. Só cinco arquivos importam `electron`:
`src/principal/index.ts`, `src/principal/seguranca/endurecimento.ts`, `src/principal/ipc/registrar.ts`,
`src/principal/ipc/leitor-isolado.ts` e `src/preload/index.ts`.

| Item | O que está feito | Onde |
|---|---|---|
| C-2 | `contextIsolation`, `sandbox`, `nodeIntegration:false`, `nodeIntegrationInWorker:false`, `nodeIntegrationInSubFrames:false`, `webSecurity:true`, `webviewTag:false`, `allowRunningInsecureContent:false`, `experimentalFeatures:false`; `app.enableSandbox()` | `src/principal/index.ts` |
| C-3 | Produção servida por `app://interface/` (`registerSchemesAsPrivileged` antes do ready + `protocol.handle`) a partir de `out/interface`; nada de `loadFile`/`file://`. Recusa `..`, `%2e%2e`, `\`, `%5c`, `%2f`, `%00`, `:`, codificação dupla, host diferente, métodos que não sejam GET/HEAD e extensões sem tipo MIME conhecido | `seguranca/protocolo-caminho.ts`, `seguranca/endurecimento.ts` |
| C-4 | CSP de produção idêntica ao checklist, no cabeçalho de toda resposta do `app://` (com `nosniff`). CSP de desenvolvimento separada (ver abaixo) | `seguranca/csp.ts` |
| C-5 | `will-navigate`, `will-redirect`, `will-frame-navigate` bloqueiam tudo fora da origem; `setWindowOpenHandler` → `deny`; `will-attach-webview` bloqueado; aplicado a todo webContents por `web-contents-created` | `seguranca/politica-urls.ts`, `seguranca/endurecimento.ts` |
| C-6 | `abrirLinkExterno` só no principal: `https:`, porta padrão, sem credenciais, host exato de `HOSTS_EXTERNOS_PERMITIDOS` (vazia no M1), com confirmação por `dialog.showMessageBox`. Nenhum canal de IPC a chama no M1 | idem |
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

**Itens feitos depois do M1-T02** (situação conferida na revisão de fechamento do M1, `docs/relatorios/REVISAO_M1.md`):

| Item | O que está feito | Onde |
|---|---|---|
| C-10 a C-12 | API nomeada no preload; remetente e argumentos conferidos (zod estrito e limites); identificadores opacos; caminho de destino só por diálogo (M1-T08) | `src/preload/api.ts`, `src/principal/ipc/` |
| C-13, C-14 | Fuses e integridade do ASAR (M1-T14) | `electron-builder.config.cjs` |
| C-16, C-17 | NSIS por usuário, sem elevação; sem atualização automática (`publish: null`) (M1-T14) | idem |
| C-18 a C-20 | Lockfile em sincronia, versões exatas, `npm audit` no `verificar`, varreduras de `innerHTML`/`eval`/rede (M1-T03) | `tests/arquitetura-varreduras.test.ts` |
| C-22 (parte 2) | Trava de sessão por trabalho aberto, válida dentro desta instalação (M1-T12) | `src/persistencia/recuperacao/` |

**Pendentes:**
- C-1: a atualização do Electron é processo (rodada mensal com `test:e2e` e a fumaça do pacote);
- assinatura de código (Etapa 7);
- a trava de sessão não protege o mesmo `.bdp` aberto de outro computador (OneDrive, pasta de rede).

**Logs.** Erros vão ao console só pelo código (`ENOENT`) ou pelo tipo (`TypeError`), por `descreverErro`, nunca com
a mensagem, que no Node traz o caminho completo (R-M1-07). O log só vai para o stdout; nada é gravado em disco.

Testes de segurança: `tests/seguranca-politica-urls.test.ts`, `tests/seguranca-protocolo-caminho.test.ts`,
`tests/seguranca-runtime.test.ts` (CSP e verificação estática do processo principal), `tests/ipc-projetos.test.ts`,
`tests/seguranca-argumentos.test.ts`, `tests/empacotamento.test.ts` e `e2e/rede-e-seguranca.spec.ts`.

### Versões descartadas (M2-T11)

Arquivo › Versões descartadas… lista o que está em `%LOCALAPPDATA%\BiblioDocsPro\recuperacao-antigos` e ainda abre
(prazo de 7 dias). A versão abre como trabalho sem arquivo: nada é alterado, e só "Salvar como…" a grava.
Até lá, não há salvamento automático; o que for escrito tem cópia de recuperação, que volta como oferta se o app cair (R-M2-04).

### Cópias de segurança (M3-T09)

Arquivo › Cópias de segurança… lista `backups\<id>\` e abre a cópia como trabalho sem arquivo: nada é alterado, e só "Salvar como…" a grava.

### Listas de ilustrações e tabelas (M6-T01)

Em Escrever, inclua os elementos "Lista de ilustrações" e "Lista de tabelas". Ao exportar o DOCX, as listas são geradas
das legendas, na ordem do trabalho. Quadros e gráficos entram nas ilustrações; tabelas têm lista própria e aparecem
uma vez, pela página inicial. Cada espécie com cinco ou mais ilustrações ganha uma lista própria. Marque "Usar lista
única de ilustrações" para reunir as espécies. Listas vazias são omitidas.

As páginas são estimadas e gravadas como campos PAGEREF. No Word, selecione todo o documento e pressione F9 para atualizar
após editar ou repaginar. Inserir ou excluir elementos no BiblioDocs Pro refaz as listas na próxima exportação; editar
as legendas diretamente no Word exige refazer o conteúdo da lista. A atualização de campos corrige as páginas.
