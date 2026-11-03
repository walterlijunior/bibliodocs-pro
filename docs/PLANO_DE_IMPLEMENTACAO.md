# Plano de implementação

Complementa o `PROMPT_EXECUCAO.md` (o "como trabalhar") com o "o que entregar em cada marco".
Refinado na Etapa 4 (2026-10-16) com a tecnologia proposta no ADR-0003 (Electron + TypeScript + React + `docx`);
durações não são estimadas porque dependem do ritmo de sessões do usuário.

## Etapas (visão geral)

| Etapa | Entrega principal | Bloqueia |
|---|---|---|
| 0. Preparação do kit | Este kit (concluída em 2026-10-12) | — |
| 1. Inventário | Inventário com status e checksums; git; sistema extraído em `analise/` | 2 |
| 2. Auditoria | `docs/relatorios/ETAPA2_AUDITORIA.md` | 4 |
| 3. Análise normativa | Matriz `RN-xxx` completa; conflitos decididos pelo usuário | M3 em diante |
| 4. Arquitetura | ADR de tecnologia; módulos; guia visual; plano detalhado de M1 | 5 |
| 5. Implementação | Marcos M1–M7 | 6 |
| 6. Testes e validação | Matriz de testes executada; relatório de limitações | 7 |
| 7. Estabilização | Instalador Windows testado; documentação de instalação | — |

As Etapas 2 e 3 podem ocorrer em paralelo (agentes diferentes, arquivos diferentes).

## Marcos da Etapa 5

### M1 — Esqueleto executável
- App abre no Windows em modo desenvolvimento com um comando documentado.
- Layout "biblioteca" (barra lateral, centro, inspetor) com tema provisório.
- Criar, salvar, abrir trabalho vazio no formato de projeto versionado.
- Suíte de testes executa (mesmo que pequena) com um comando.
**Aceite:** RF-01 parcial (criar/salvar/abrir); teste de ida e volta do arquivo passa.

#### Tarefas do M1 (Etapa 4; valem com o ADR-0003 aceito)
Comandos rodam em `app/`. Cada tarefa termina com teste e registro; "Informar antes" = instala dependência local.

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

#### Paralelização possível

- Depois de T03, os grupos {T04 → T05 → T06 → T07} e {T02 → T08} podem correr em paralelo, porque tocam
  arquivos diferentes.
- T10 só depende de T08 para o contrato da API. O protótipo visual pode ser feito antes.

#### Fora do M1 (registrado para não esquecer)

- ADR do editor de texto rico (antes do M2, com o `especialista-interface`).
- Importador do backup `tcc-uft`: fim do M2 se o usuário tiver trabalhos antigos (ADR-0004, seção 6).
- Perfil `uft-2022` em dados e teste de rastreabilidade (M3).
- PoC DOCX integrada ao exportador (M3).
- LanguageTool e PDF via LibreOffice: após o M7, conforme a decisão do usuário.

#### Pendências do fechamento do M1 (revisão `docs/relatorios/REVISAO_M1.md`)

- ✔ **M2-T01 (decidido em 2026-10-17; concluído em 2026-10-17, ver o relatório do M2), antes do editor:** medir o instantâneo de recuperação e o
  salvamento com 25 MB de mídia e um documento de 150 páginas (tempo no principal, latência de teclado, RSS). Se passar
  da meta, fazer o instantâneo incremental e empacotar fora do principal (R-M1-01, R36).
- Backups rotativos `backups\<id>\` (ADR-0004 §4), junto com o editor (R-M1-03).
- `.bak` ao excluir (vai para a Lixeira junto) e ao renomear (renomeado junto), com teste (R-M1-02, R37; decidido em 2026-10-17).
- Inventário de licenças, `TERCEIROS.txt` no pacote e teste contra licença copyleft em produção; `npm audit signatures`
  no `verificar` (R-M1-04, R-M1-05). Tela "Sobre": especialista-interface.
- Electron 44.9.0 na rodada mensal, com `test:e2e` e a fumaça do pacote (R-M1-06).
- Logs sem `e.message` com caminho completo (R-M1-07).
- Tela para reabrir `recuperacao-antigos`; oferta de recuperação mesmo com a Biblioteca em erro; axe-core (RNF-09).
  Diálogos nativos e Lixeira em E2E: Etapa 6 (R-M1-10).


### M2 — Modelo de documento e editor
- Seis tipos de trabalho com elementos e ordem da matriz; seções com numeração automática; parágrafos,
  alíneas, citação longa (bloco), notas; pré-textuais com campos.
**Aceite:** RF-02, RF-03, RF-04; testes de numeração e de elementos obrigatórios por tipo.

#### Tarefas do M2 (detalhadas em 2026-10-17, preparação do M2)
Comandos rodam em `app/`. Cada tarefa termina com `npm run verificar:tudo` passando e registro. A ordem segue a
regra "modelo antes da tela" (skill `editor-academico`). O ADR-0007 foi aceito em 2026-10-17.

| ID | Tarefa | Agente | Depende | Critério de aceite | Verificação |
|---|---|---|---|---|---|
| M2-T01 ✔ | Medir instantâneo de recuperação e salvamento com 25 MB de mídia e documento de 150 páginas (tempo no principal, latência de teclado, RSS). Se passar da meta: instantâneo incremental e empacotamento fora do principal (R-M1-01, R36). Gerador de documento grande reaproveitável no M3 e na Etapa 6 | especialista-documento + engenheiro-qualidade (medição) | — | Medidas registradas contra RNF-06 (abrir 150 páginas < 3 s; < 50 ms por tecla) e RNF-07 (< 800 MB); o instantâneo não atrasa a tecla além de 50 ms | `npm run verificar:tudo`; script de medição com resultado no relatório do marco |
| M2-T02 ✔ | Tipos de trabalho no domínio: os seis tipos (TCC monografia, artigo-TCC, dissertação, tese, relatório técnico, projeto de pesquisa) como **dados** com elementos e ordem da tabela "Ordem dos elementos por tipo" da matriz, cada elemento com RN; `TipoTrabalhoId` ampliado (aditivo no v1); `ROTULOS_TIPO` na interface; criar trabalho escolhendo o tipo. Relatório técnico e projeto de pesquisa: elementos dos modelos UFT como sugestão editável (C-B18) | especialista-documento + especialista-normas (revisão de fontes) | — | RF-02: para cada tipo, trabalho novo contém exatamente os elementos obrigatórios, na ordem; elemento PF não entra como definitivo | `npm run verificar` (teste por tipo) |
| M2-T03 ✔ | Numeração progressiva pura em `dominio/numeracao` e operações estruturais puras sobre a árvore de seções (inserir, remover, mover, recuar, promover), limite de 5 níveis (RN-039, RN-041, RN-028) | especialista-documento | — | RF-03: mover a seção 3 para antes da 2 renumera tudo; recuar além da quinária é recusado com mensagem | `npm run verificar` (propriedades + mutação) |
| M2-T04 ✔ | Modelo M2: alíneas e subalíneas (RN-023, RN-024, RN-026; RN-025 com `aa), bb)` conforme C-A6), citação longa como bloco (RN-004), nota de rodapé como inline atômico com conteúdo; esquemas zod + JSON Schema + fixtures | especialista-documento | T03 | Fixtures válidas passam; inválidas recusadas em pt-BR; ida e volta `.bdp` idêntica | `npm run verificar`; `npm run esquemas:gerar` |
| M2-T05 ✔ | Núcleo do editor (ADR-0007): esquema do editor e conversão modelo ↔ editor testável em Node; colagem saneada para o modelo. **Informar antes:** instalação das dependências do ADR | especialista-interface + especialista-documento (revisão do mapeamento) | T04 | Ida e volta modelo → editor → modelo idêntica em todas as fixtures; HTML colado do Word vira só `Bloco/Inline` | `npm run verificar` |
| M2-T06 ✔ | Editor na aba Escrever ligado à `SessaoTrabalho`: transação soma revisão, agenda o automático e `#agendarInstantaneo()`; desfazer/refazer; IME/acentos; CSP sem violação | especialista-interface | T05, T01 | Digitar, desfazer, salvar, reabrir idêntico; latência ≤ RNF-06 no documento do T01; `x.problemas` vazio no E2E | `npm run verificar:tudo` (E2E novo) |
| M2-T07 ✔ | Árvore de seções na interface: inserir, renomear, mover (teclado e arrastar), recuar/promover, numeração exibida; ligar os botões de seção da barra | especialista-interface | T03, T06 | Teclado completo; leitor de tela anuncia nível e número; E2E de mover seção | `npm run verificar:tudo` |
| M2-T08 ✔ | Pré-textuais com campos: capa, folha de rosto, ficha catalográfica, errata, folha de aprovação, dedicatória, agradecimentos, epígrafe, resumo e abstract com palavras-chave (RN do Quadro 5 e cap. 5 do Manual); validação dos obrigatórios por tipo | especialista-documento (modelo) → especialista-interface (formulários) | T02, T06 | RF-04: obrigatório ausente aparece como pendência (o verificador completo é do M7) | `npm run verificar:tudo` |
| M2-T09 ✔ | Lugares dos pós-textuais na estrutura (referências, glossário, apêndices, anexos) com ordem por tipo; conteúdo detalhado fica no M4/M6 | especialista-documento | T02 | Ordem conforme a matriz; apêndice/anexo identificados por letra (RN do cap. 7–8) | `npm run verificar` |
| M2-T10 ✔ | Backups rotativos `backups\<id>\` (ADR-0004 §4) e `.bak` acompanhando excluir/renomear (R-M1-02, R-M1-03, R37) | especialista-documento | — | Rotação 10 + 1/dia por 7 dias; `*-formato-v<N>.bdp` preservado; `.bak` na Lixeira junto ao excluir | `npm run verificar` |
| M2-T11 ✔ | Pendências técnicas do M1: inventário de licenças e `TERCEIROS.txt`, teste contra copyleft em produção, `npm audit signatures` no `verificar` (R-M1-04/05); logs sem caminho completo (R-M1-07); Electron 44.9.0 com `test:e2e` e fumaça do pacote (R-M1-06); axe-core (RNF-09); tela de `recuperacao-antigos` | engenheiro-qualidade + revisor-seguranca (revisão) | — | Itens fechados ou com motivo registrado | `npm run verificar:tudo` |
| M2-T12 ✔ | Fechamento do marco: README, matriz de testes, `REVISAO_M2.md` (skill `revisao-seguranca-qualidade`), relatório do marco | sessão principal | T01–T11 | Aceite do M2 demonstrado | `npm run verificar:tudo` |
| M2-T13 ✔ | Comandos de alíneas e citação longa no editor (lacuna do RF-03 achada no M2-T12) e prazo de 30 dias para as cópias de trabalho excluído | sessão principal | T06, T10 | Botões e teclas criam e desfazem alínea, subalínea e citação longa; a seção é válida no v1 | `npm run verificar:tudo` |

Decisões do M2 tomadas em 2026-10-17 (delegadas pelo usuário à sessão principal): ADR-0007 aceito, com os quatro
itens visíveis como propostos; relatório técnico e projeto de pesquisa seguem os modelos UFT como sugestão editável
(C-B18); "letras dobradas" = `aa), bb), cc)` como valor de perfil (C-A6).
Paralelização: T01, T02, T03 e T10 tocam arquivos diferentes e podem correr juntos.

### M3 — Motor normativo e exportação DOCX
- Perfil "UFT 2022" com as regras `CONFIRMADA` de formatação geral; exportação DOCX com estilos e seções;
  regressão documental ativa.
**Aceite:** RF-05, RF-06; teste de propriedades normativas no DOCX passa; verificação manual no Word e
LibreOffice registrada.

#### Tarefas do M3 (detalhadas em 2026-11-02; decisões D-M3 na matriz)
Comandos rodam em `app/`. Cada tarefa termina com `npm run verificar:tudo` passando e registro. Ordem: provar a saída no
Word, depois perfil, motor, exportador e tela. **Limite do marco:** sumário como campo real, com título, indicativo e
página; listas de ilustrações, siglas e remissivas ficam no M6, e tabelas, figuras e equações, no M5.

| ID | Tarefa | Agente | Depende | Critério de aceite | Verificação |
|---|---|---|---|---|---|
| M3-T00 ✔ | Decisões editoriais de formatação: RN-001 (fonte padrão), RN-027, RN-033, RN-072, RN-073, RN-088, RN-102, RN-104, RN-125 | usuário + especialista-normas | — | Cada decisão na matriz, como parâmetro de perfil | Revisão da matriz |
| M3-T01 ✔ | Refazer a PoC com `docx` 9.15.1 (a do ADR era 9.11.0) e conferir no **Word real** por automação COM (`Word 16`, disponível nesta máquina): L2, L3, L5, L6, L7, L13. **Informar antes:** `docx` e `fast-xml-parser` | especialista-documento | — | Sem pedido de reparo; achados L1–L13 fechados ou com contorno; versão fixada | Script de abertura no Word; `soffice` |
| M3-T02 ✔ | Perfil em dados: esquema, `perfis/uft-2022/` com regras `CONFIRMADA` de formatação geral, parâmetros decididos, `ESTRUTURA_POR_TIPO` movida para o perfil; teste contra a matriz (ADR-0006, camada 2) | especialista-normas + especialista-documento | T00 | Regra e status iguais aos da matriz; PENDENTE-FONTE só com `provisoria`; ambígua sem decisão não é aplicada | `npm run verificar` |
| M3-T03 ✔ | Motor: `formatar(doc, perfil)` puro; `DocumentoFormatado` com `origem` RN; estilos, títulos 1–5, parágrafo, alíneas, citação longa e notas | especialista-documento | T02 | Formatação sem RN reprova teste (RF-05); parâmetros decididos com os dois valores | `npm run verificar`, propriedades e mutação |
| M3-T04 ✔ | Motor: seções e paginação (RN-067, RN-068, RN-073), ordem física, pré-textuais com capa e folha de rosto, pós-textuais com letras e aviso de `letraSemFonte`; conteúdo vazio (B6) | especialista-documento | T03 | Seis tipos com a ordem da matriz; contagem da folha de rosto em diante; vazio não vira nota vazia | `npm run verificar` |
| M3-T05 ✔ | Exportador `exportacao/docx` em processo utilitário: mapeamento 1:1, notas reais, numeração `SEQ`/títulos, sumário em cache com páginas estimadas e aviso de F9 | especialista-documento + revisor-seguranca (utilitário e limites) | T01, T04 | Nenhuma decisão normativa no exportador (teste de arquitetura); XML bem formado | `npm run verificar` |
| M3-T06 ✔ | Regressão documental: corpus com um projeto por tipo e "documento difícil" sem conteúdo real; propriedades com falha citando a RN; instantâneo de XML normalizado | engenheiro-qualidade | T05 | DOC-01 a DOC-07 automáticos; cada mudança de instantâneo explicada | `npm run verificar` |
| M3-T07 | Camadas externas: `test:libreoffice` (converte e confere páginas e títulos) e `test:word` (COM: abre sem reparo, conta páginas). Pulam com aviso se o programa faltar; validador .NET só se autorizado, porque exige instalar o .NET | engenheiro-qualidade | T06 | DOC-08 no Word e no LibreOffice com versão registrada | `npm run verificar:tudo` |
| M3-T08 | Tela: Exportar DOCX (Ctrl+E, Exportar › Exportar DOCX…), destino por diálogo do principal, progresso, avisos de pendência e de regra aguardando decisão, sem gravar por cima em silêncio | especialista-interface + revisor-seguranca | T05 | Canal validado; arquivo aberto no Word não perde dados; E2E exporta e confere | `npm run verificar:tudo` (E2E, axe) |
| M3-T09 | Tela de restaurar backups rotativos de `backups\<id>\` (decisão do usuário, 2026-11-02): lista por trabalho e abre como trabalho sem arquivo, sem alterar nada | especialista-interface + especialista-documento | — | Sem caminho no renderer; nada é sobrescrito; E2E | `npm run verificar:tudo` |
| M3-T10 | Achados abertos que protegem dados: R-M2-04 (cópia de recuperação em trabalho sem arquivo), R-M2-06 e R-M2-08; depois R-M2-05, 12, 14, 16 | especialista-documento | T09 | Cada achado fechado, ou com motivo registrado | `npm run verificar:tudo` |
| M3-T11 | Medir RNF-06/07 com exportação (`npm run medir`); rever R46 (memória, medida mais estável); instalador com o Electron atual; lista de terceiros no "Sobre", incluindo `docx` | engenheiro-qualidade | T08 | Medidas registradas; instalador instala e abre | `npm run medir`; `npm run dist` |
| M3-T12 | Fechamento: `REVISAO_M3.md` com revisão independente, relatório do marco, README, matriz de testes e verificação no Word registrada pelo usuário | sessão principal | T01–T11 | Aceite do M3 demonstrado | `npm run verificar:tudo` |

### M4 — Citações e referências
**Aceite:** RF-07, RF-08; verificador de órfãs/não citadas.

### M5 — Tabelas e elementos visuais
- Estudo visual (estudo Capcom, usado só como exemplo de trabalho formatado) concluído antes da implementação.
**Aceite:** RF-09, RF-10, RF-11 (legenda/fonte/numeração).

### M6 — Sumário, listas, siglas, remissivas, pós-textuais
**Aceite:** RF-11 (remissivas), RF-12, RF-13, RF-14.

### M7 — Verificador de conformidade
**Aceite:** RF-15 com documento de teste de 10 não conformidades plantadas.

## Regras de priorização
1. Algo funcionando de ponta a ponta cedo (M1 + M3 parcial) vale mais que um módulo perfeito isolado.
2. Exportação DOCX é a saída do produto: toda funcionalidade só está pronta quando sai certa no DOCX.
3. Requisito normativo sem fonte não entra no MVP; vira pendência visível.
4. Ao fim de cada marco: skill `revisao-seguranca-qualidade` e atualização deste plano.

## Reaproveitamento esperado do sistema antigo `[HIPÓTESE — confirmar na Etapa 2]`
| Módulo antigo | Destino provável |
|---|---|
| `abnt.js` (numeração, referências, detecção de citações) | Lógica candidata para motor/bibliografia, após testes |
| `exports.js` (DOCX/PDF/ODT com docx.js/jsPDF) | Referência para o exportador; possível reaproveitamento se a pilha for JS |
| `templates.js` (TCC, consultoria, extensão) | Fonte de tipos adicionais (consultoria/extensão de Ciências Contábeis) |
| `visual-editor.js` (SWOT, gráficos, organograma…) | Candidato para elementos visuais |
| `components.js`, `app.js`, `state.js`, `storage.js` | Referência de fluxos; persistência a substituir por arquivo de projeto |
