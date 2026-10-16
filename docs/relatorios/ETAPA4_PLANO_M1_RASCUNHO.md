# Rascunho — plano detalhado do Marco M1 (esqueleto executável)

- **Data:** 2026-10-16
- **Autor:** agente `arquiteto-software`
- **Situação:** INTEGRADO em `docs/PLANO_DE_IMPLEMENTACAO.md` (2026-10-16); este arquivo fica como histórico.
  Vale se o ADR-0003 (Electron + TS + React + `docx`) for aprovado.
- **Aceite do M1** (`docs/PLANO_DE_IMPLEMENTACAO.md`): RF-01 parcial (criar, salvar, abrir), teste de ida
  e volta do arquivo passando e suíte executável por um comando.

Convenções:
- Cada tarefa é uma mudança coesa, termina com teste e registro (regra 2 do `CLAUDE.md`) e indica o agente
  responsável.
- Os comandos rodam em `app/`.
- "Informar antes" marca as tarefas que instalam dependências locais (regra 7).

| ID | Tarefa | Agente | Depende | Critério de aceite | Verificação |
|---|---|---|---|---|---|
| M1-T01 | Criar o esqueleto `app/`: `package.json` com versões **exatas** (electron 44.7.2, electron-vite, vite 8, react 19, typescript 7, vitest 5); pastas de `app/src/` conforme o ADR-0005 (vazias, com `index.ts` de marcação); `app/README.md` substituindo `app/LEIA-ME.md`; `.gitignore` de `node_modules/`, `out/` e `dist/`. **Informar antes:** `npm install` local (cerca de 300–500 MB em `node_modules` [HIPÓTESE]) | arquiteto-software | ADR-0003 aceito | `npm run dev` abre uma janela com o título "BiblioDocs Pro"; `npm run build` termina sem erro | `npm install`; `npm run build`; `npm run dev` (fechar a janela manualmente) |
| M1-T02 | Endurecer o runtime conforme o checklist C-1 a C-22 da revisão de segurança: `sandbox`, `contextIsolation`, sem `nodeIntegration`; protocolo `app://`; CSP sem origens remotas; bloquear `will-navigate` e `setWindowOpenHandler`; `openExternal` só `https:` com confirmação; DevTools só em desenvolvimento; bloqueio de rede da sessão (`webRequest`) | arquiteto-software + revisor-seguranca (revisão) | T01 | Testes unitários dos filtros de URL e navegação passam; o revisor confere os itens do checklist aplicáveis ao M1 | `npm run verificar`; registro do revisor no relatório do marco |
| M1-T03 | Infraestrutura de testes: Vitest, `npm run verificar` (`tsc --noEmit` + vitest + `npm audit --omit=dev --audit-level=high`); teste de **fronteiras** (imports proibidos do ADR-0005, regras 1–8) e varreduras (`innerHTML`, rede) | engenheiro-qualidade | T01 | `verificar` passa; um caso negativo (arquivo de teste que viola a fronteira) é detectado | `npm run verificar` |
| M1-T04 | Contratos e esquemas v1: tipos `Documento`/`Secao`/`Bloco`/`Inline` mínimos e `Manifesto`; esquemas `zod` estritos; exportação do JSON Schema para `app/esquemas/projeto-v1/` (ou `ajv`, se a exportação não for fiel) | arquiteto-software (contrato) + especialista-documento (revisão do modelo) | T03 | Fixture válida passa; campo extra, tipo errado e profundidade excessiva são recusados com mensagem pt-BR; o JSON Schema gerado está versionado | `npm run verificar` |
| M1-T05 | Contêiner `.bdp` com `fflate`: empacotar e ler em memória; `mimetype` como 1.ª entrada sem compressão; lista de nomes permitidos; limites contra zip bomb; sha256 das mídias | especialista-documento | T04 | Ida e volta com conteúdo idêntico; ZIP com `..`, nome não permitido, razão de compressão acima do limite e mídia com hash errado são recusados ou descartados conforme o ADR-0004 | `npm run verificar` (testes PER) |
| M1-T06 | Salvamento atômico no processo principal: temporário no mesmo diretório, `fsync`, `.bak`, `rename` com tentativas para `EPERM`/`EBUSY`/`EACCES`; mensagem de erro sem falha silenciosa | especialista-documento + revisor-seguranca (revisão) | T05 | Falha injetada entre `.bak` e `rename` mantém o original ou o `.bak` íntegro; `EPERM` simulado gera as tentativas e depois o erro tratado; teste real com arquivo aberto por outro processo repete a medição do revisor | `npm run verificar`; registro da medição manual |
| M1-T07 | Migrações: registro `migrar_N_para_N+1`, backup antes de migrar, versão futura → só leitura. No v1 não há migração real; o teste usa uma migração fictícia v0→v1 só nos testes | especialista-documento | T04 | Cadeia aplicada na ordem; versão futura recusa a edição; a fixture por versão existe | `npm run verificar` |
| M1-T08 | IPC tipado: preload expondo `window.bibliodocs.projetos.*`; validação de argumentos com esquema e verificação do `sender` no principal; destinos de gravação só por diálogo | arquiteto-software | T02, T06 | Chamada com argumento inválido ou de origem não permitida é recusada (teste unitário dos manipuladores) | `npm run verificar` |
| M1-T09 | Biblioteca: pasta padrão `Documentos\BiblioDocs Pro\Trabalhos\` (configurável); índice-cache em `%LOCALAPPDATA%\BiblioDocsPro\biblioteca.json`, recriável; criar trabalho vazio (tipo genérico; os tipos UFT ficam no M2); renomear, duplicar, excluir para a Lixeira com confirmação; aviso se a pasta estiver no OneDrive | especialista-documento | T06, T08 | Apagar o índice e reabrir recria a lista; excluir pede confirmação e o arquivo vai para a Lixeira | `npm run verificar`; verificação manual da Lixeira registrada |
| M1-T10 | Casca da interface conforme `docs/REFERENCIA_DE_LAYOUT.md` seção 4: barra superior com visor (pequi provisório original) e busca, menus, navegação com seletor de coleção e abas, barra lateral, grade de trabalhos. **Antes:** protótipo aprovado pelo usuário (skill `interface-desktop`, passo 1; ver `analise/poc-ui/` se houver). Tema provisório | especialista-interface | T08 | UI-01 parcial: as quatro faixas presentes e redimensionáveis de 1024×700 até tela cheia; Ctrl+F foca a busca; foco visível; nenhum elemento de marca de terceiros (UI-02) | `npm run dev` + revisão do usuário; E2E em T13 |
| M1-T11 | Fluxo criar → editar título → salvar → fechar → abrir na UI; indicador de estado no visor ("Salvo", "Salvando…", "Alterações não salvas", "Erro ao salvar"); salvamento automático conforme a opção escolhida pelo usuário no ADR-0004 | especialista-interface + especialista-documento | T09, T10 | Alteração aparece como "Alterações não salvas" e depois "Salvo"; erro de gravação aparece no visor | `npm run dev`; E2E em T13 |
| M1-T12 | Recuperação: instantâneos em `%LOCALAPPDATA%\BiblioDocsPro\recuperacao\<id>\`; trava de sessão; instância única; na inicialização, oferta de recuperação (trava órfã, temporário órfão, `.bak`) | especialista-documento | T06, T11 | Matar o processo durante a edição e reabrir oferece a versão recuperada com o conteúdo da última alteração (até cerca de 2 s antes) | `npm run verificar` (unidade); E2E em T13 |
| M1-T13 | E2E Playwright: FUN-01 (criar → fechar → reabrir idêntico), RNF-04 (matar e recuperar), UI-01 parcial, zero requisições de rede | engenheiro-qualidade | T11, T12 | Os três cenários passam em execução limpa; as versões do Playwright e do Electron ficam registradas | `npm run build && npm run test:e2e` |
| M1-T14 | Empacotamento de fumaça: electron-builder NSIS (`oneClick`, `perMachine: false`), fuses, sem atualização automática; **medir o tamanho do instalador** e o tamanho instalado (substitui a `[HIPÓTESE]` do ADR-0003). A instalação limpa completa fica para a Etapa 7 | arquiteto-software + revisor-seguranca | T02 | `npm run dist` gera o `.exe`; instala sem pedir administrador nesta máquina; abre; desinstala; tamanho registrado e comparado à meta de 200 MB (RNF-08) | `npm run dist`; registro manual |
| M1-T15 | Fechamento do marco: `app/README.md` com os comandos; `docs/MATRIZ_DE_TESTES.md` com os grupos ARQ, PER e E2E; revisão `revisao-seguranca-qualidade`; `npm run verificar:tudo` (as partes de LibreOffice e OOXML pulam com aviso até o M3) | sessão principal | T01–T14 | Todos os comandos documentados funcionam; relatório do marco a partir de `templates/RELATORIO_DE_TESTES.md` | `npm run verificar:tudo` |

## Paralelização possível

- Depois de T03, os grupos {T04 → T05 → T06 → T07} e {T02 → T08} podem correr em paralelo, porque tocam
  arquivos diferentes.
- T10 só depende de T08 para o contrato da API. O protótipo visual pode ser feito antes.

## Fora do M1 (registrado para não esquecer)

- ADR do editor de texto rico (antes do M2, com o `especialista-interface`).
- Importador do backup `tcc-uft`: fim do M2 se o usuário tiver trabalhos antigos (ADR-0004, seção 6).
- Perfil `uft-2022` em dados e teste de rastreabilidade (M3).
- PoC DOCX integrada ao exportador (M3).
- LanguageTool e PDF via LibreOffice: após o M7, conforme a decisão do usuário.
