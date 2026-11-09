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
| M3-T07 ✔ | Camadas externas: `test:libreoffice` (converte e confere páginas e títulos) e `test:word` (COM: abre sem reparo, conta páginas). Pulam com aviso se o programa faltar; validador .NET só se autorizado, porque exige instalar o .NET | engenheiro-qualidade | T06 | DOC-08 no Word e no LibreOffice com versão registrada | `npm run verificar:tudo` |
| M3-T08 ✔ | Tela: Exportar DOCX (Ctrl+E, Exportar › Exportar DOCX…), destino por diálogo do principal, progresso, avisos de pendência e de regra aguardando decisão, sem gravar por cima em silêncio | especialista-interface + revisor-seguranca | T05 | Canal validado; arquivo aberto no Word não perde dados; E2E exporta e confere | `npm run verificar:tudo` (E2E, axe) |
| M3-T09 ✔ | Tela de restaurar backups rotativos de `backups\<id>\` (decisão do usuário, 2026-11-02): lista por trabalho e abre como trabalho sem arquivo, sem alterar nada | especialista-interface + especialista-documento | — | Sem caminho no renderer; nada é sobrescrito; E2E | `npm run verificar:tudo` |
| M3-T10 ✔ | Achados abertos que protegem dados: R-M2-04 (cópia de recuperação em trabalho sem arquivo), R-M2-06 e R-M2-08; depois R-M2-05, 12, 14, 16 | especialista-documento | T09 | Cada achado fechado, ou com motivo registrado | `npm run verificar:tudo` |
| M3-T11 ✔ | Medir RNF-06/07 com exportação (`npm run medir`); rever R46 (memória, medida mais estável); instalador com o Electron atual; lista de terceiros no "Sobre", incluindo `docx` | engenheiro-qualidade | T08 | Medidas registradas; instalador instala e abre | `npm run medir`; `npm run dist` |
| M3-T12 | Fechamento: `REVISAO_M3.md` com revisão independente, relatório do marco, README, matriz de testes e verificação no Word registrada pelo usuário | sessão principal | T01–T11 | Aceite do M3 demonstrado | `npm run verificar:tudo` |

### M4 — Citações e referências
**Aceite:** RF-07, RF-08; verificador de órfãs/não citadas.

#### Tarefas do M4 (2026-11-05; decisões D-M4 na matriz)
Comandos rodam em `app/`. Cada tarefa termina com `npm run verificar:tudo` passando e registro.
- **Base normativa:** Manual, cap. 3 (citações, RN-077 a 103) e 5.19 (referências, RN-175 a 229), quase tudo
  `CONFIRMADA`. Lacunas: RN-085 e RN-094 a 097 (NBR 10520) e PF-09, de (a) a (j) (NBR 6023), que o projeto não tem.
- **Limite do marco:** os tipos de obra da primeira leva (M4-T04). Os demais tipos do 5.19 entram no M4-T09 ou
  ficam como "não suportado" com aviso. Detecção de citações em texto colado só sugere vínculo, nunca liga em silêncio.

| ID | Tarefa | Agente | Depende | Critério de aceite | Verificação |
|---|---|---|---|---|---|
| M4-T00 ✔ | Decisões do usuário: NBRs disponíveis; P-11, P-12, P-14, P-15; PF-09 (a)–(j); tipos da primeira leva | usuário + especialista-normas | — | Cada decisão na matriz como parâmetro de perfil ou PENDENTE-FONTE provisória | Revisão da matriz |
| M4-T01 ✔ | Adendo ao ADR-0004: `bibliografia.json` no `.bdp` (aditivo; arquivo antigo abre sem ele); modelo de obra tipado (pessoas, entidade, título, edição, local, editora, ano, páginas, volume, número, URL, acesso, DOI) e de chamada (obra, localizador, forma, apud) | arquiteto-software + especialista-referencias | T00 | Esquema estrito; v1 sem bibliografia abre igual; teste de ida e volta | `npm run verificar` |
| M4-T02 ✔ | Domínio: formatadores puros obra → trechos com destaque, por tipo, cada elemento com a RN; datas e meses (RN-190); autores (RN-180 a 187); ordenação pt-BR com desempate (RN-176, PF-09 g) | especialista-referencias | T01 | Tabela entrada → saída esperada → página do Manual para cada tipo | `npm run verificar` |
| M4-T03 ✔ | Domínio: chamadas (RN-077 a 099) parentética e narrativa, página, apud, entrada pelo título, sufixo a/b; perfil 2002 e opção 2023 provisória (C-01) | especialista-referencias | T01 | Mudar o ano da obra muda todas as chamadas (aceite do RF-07); chamada sem obra não existe no modelo | `npm run verificar` |
| M4-T04 ✔ | Primeira leva de tipos: livro (RN-194 a 199, 204, 205), capítulo (200, 201), trabalho acadêmico (206), artigo de periódico (212 a 214), trabalho em anais (209), artigo de jornal (215 a 218), norma (222), legislação (223), documento on-line (189) | especialista-referencias | T02 | Cada tipo com caso tirado do exemplo do Manual | `npm run verificar` |
| M4-T05 ✔ | Motor e exportador: lista REFERÊNCIAS gerada das obras citadas (opção de incluir não citadas), estilo RN-034/177 com separação (N-M3-10); chamada no texto como trecho | especialista-documento | T03, T04 | DOCX com lista ordenada e chamadas; instantâneos novos explicados | `npm run verificar:tudo` |
| M4-T06 ✔ | Tela: cadastro de obras por tipo (formulário com os campos do tipo, prévia da referência formatada), lista de obras, excluir com aviso se citada | especialista-interface | T04 | Sem obra inválida salva; axe; E2E | `npm run verificar:tudo` |
| M4-T07 ✔ | Editor: inserir citação (Ctrl+Alt+C? → Ctrl+Shift+C, o atalho do menu) escolhendo a obra; forma, página, apud; a chamada é um nó do ProseMirror ligado ao id; colagem de texto com "(AUTOR, ano)" sugere vínculo | especialista-interface + especialista-referencias | T03, T06 | Aceite do RF-07; desfazer junto com o texto | `npm run verificar:tudo` |
| M4-T08 ✔ | Verificador: órfãs, não citadas, a/b ausente, grafia divergente do mesmo autor, prenomes não uniformes (RN-182) | especialista-referencias | T05 | Documento com 1 órfã e 1 não citada diagnosticado (aceite da skill) | `npm run verificar` |
| M4-T09 ✔ | Importar BibTeX e RIS em subconjunto próprio, sem dependência nova: campos mapeados, não reconhecidos listados, prévia antes de gravar; demais tipos do 5.19 conforme o T00 | especialista-referencias | T04, T06 | Arquivos de exemplo com acentos e campos estranhos importados sem perda silenciosa | `npm run verificar:tudo` |
| M4-T10 ✔ | Fechamento: `REVISAO_M4.md` com revisão independente (normativa e segurança da importação), relatório do marco, matriz de testes | sessão principal | T01–T09 | Aceite do M4 demonstrado | `npm run verificar:tudo` |

Paralelização: T02 e T03 tocam arquivos diferentes; T06 pode começar depois do T01 com dados fictícios.

### M5 — Tabelas e elementos visuais
- Estudo visual (estudo Capcom, usado só como exemplo de trabalho formatado) concluído antes da implementação:
  `docs/relatorios/ESTUDO_VISUAL_TABELAS.md` (M5-T00).
**Aceite:** RF-09, RF-10, RF-11 (legenda/fonte/numeração).

#### Tarefas do M5 (2026-11-07; decisões D-M5 na matriz, tomadas pela sessão principal por delegação do usuário)
Comandos rodam em `app/`. Cada tarefa termina com `npm run verificar:tudo` passando e registro.
- **Base normativa:** Manual, p. 15–20, 27 e 43 (RN-015 a 066, RN-105 a 108, RN-164) e Norma Tabular do IBGE
  (RN-241 a 312), quase tudo `CONFIRMADA`, com as decisões do usuário C-A1 a C-A5, C-C1 a C-C5 e P-C2 a P-C4.
- **Limite do marco:** sem dependência nova. Planilha por CSV e por colagem do Excel e do LibreOffice (D-M5-01);
  imagens PNG e JPEG (ADR-0004); equação em texto linear (D-M5-06). Listas de ilustrações e de tabelas são do M6
  (RF-12); a referência cruzada (remissiva) a elementos entra aqui (RF-11).

| ID | Tarefa | Agente | Depende | Critério de aceite | Verificação |
|---|---|---|---|---|---|
| M5-T00 ✔ | Estudo visual (Capcom, IFPR), levantamento das RN e decisões D-M5-01 a 10; plano de tarefas | sessão principal | — | `ESTUDO_VISUAL_TABELAS.md`; decisões na matriz | Revisão da matriz |
| M5-T01 ✔ | Formato v1 (aditivo): blocos `tabela` (tabela ou quadro; título; colunas com alinhamento; linhas de cabeçalho; células com texto e marcas; mesclagem; fonte; notas geral e específicas), `ilustracao` (tipo da RN-049; título; mídia por sha256; largura; fonte; nota) e `equacao` (texto; numerada); esquema, limites, fixtures válidas e inválidas | especialista-documento | — | Leitura recusa elemento sem título, mídia inexistente e mesclagem fora da grade; JSON Schema regenerado | `npm run verificar` |
| M5-T02 ✔ | Domínio: numeração contínua por tipo (RN-052, RN-244; D-M5-07), rótulo "Tabela n – Título" (RN-051, RN-053), ordem do rodapé Fonte → Nota → notas específicas (RN-277), pendências (sem fonte RN-056/274, sem título RN-246, tabela sem dado numérico RN-241, D-M5-10) | especialista-elementos-visuais | T01 | Testes de tabela com fonte de cada RN | `npm run verificar` |
| M5-T03 | Motor e DOCX de tabela e quadro: tabela aberta com três traços (RN-251, RN-254), quadro fechado (RN-061), título 12 centralizado preso ao elemento (RN-021, RN-066), cabeçalho repetido (RN-292), corpo 10 simples (P-C2), números à direita (P-C4), fonte e notas 10 à esquerda (RN-057, RN-307), uma linha antes e depois (RN-031, RN-308), página em paisagem opcional (RF-09); aviso de tabela longa (RN-297, D-M5-03) | especialista-elementos-visuais | T02 | Tabela nativa do Word; Word e LibreOffice abrem sem reparo; instantâneo | `npm run verificar:tudo` |
| M5-T04 | Editor: inserir e editar tabela e quadro (grade com linhas e colunas, cabeçalho, mesclar, alinhamento por coluna, sinais convencionais RN-263) com título, fonte e notas; Ctrl+Z junto com o texto | especialista-interface | T01, T02 | E2E; axe; só tabela válida gravada | `npm run verificar:tudo` |
| M5-T05 | Colar do Excel e do LibreOffice (HTML/TSV) e importar CSV com prévia: números pt-BR (P-C3), datas, vazios, sinais convencionais (RN-263, RN-264), relatório do que não converteu (D-M5-01) | especialista-elementos-visuais | T04 | Aceite do RF-09: planilha com acentos, vírgula decimal e células vazias sem perda | `npm run verificar:tudo` |
| M5-T06 | Figuras: inserir PNG/JPEG com título, fonte e largura; mídia deduplicada no `.bdp`; aviso abaixo de 150 ppi no tamanho impresso (RNF-17, D-M5-09); DOCX com a imagem centralizada (RN-059) | especialista-elementos-visuais + especialista-interface | T01, T02 | Aceite do RF-10 (aviso de resolução) | `npm run verificar:tudo` |
| M5-T07 | Equações: bloco em texto linear com sobrescrito e subscrito, numeração "(n)" à direita (RN-105, RN-106), entrelinha livre (RN-107), alinhamento D-M5-05 | especialista-elementos-visuais | T01 | DOCX com tabulação à direita e número | `npm run verificar:tudo` |
| M5-T08 | Remissivas: nó "referência a elemento" ligado ao id ("Tabela 3") que acompanha a numeração; aviso ao excluir elemento referenciado (aceite do RF-11); verificador de elemento sem remissiva (RN-060, D-M5-04) | especialista-interface + especialista-elementos-visuais | T02 | Excluir elemento referenciado gera aviso | `npm run verificar:tudo` |
| M5-T09 | Gráfico gerado da tabela (colunas, barras, linhas, setores) como ilustração guardada em dados (ADR-0004) e desenhado em PNG ao exportar (D-M5-08); atualiza ao mudar a tabela | especialista-elementos-visuais | T03, T06 | Aceite do RF-10 (gráfico acompanha a tabela) | `npm run verificar:tudo` |
| M5-T10 | Fechamento: `REVISAO_M5.md` com revisão independente (normas e segurança da colagem e das imagens), relatório do marco, matriz de testes | sessão principal | T01–T09 | Aceite do M5 demonstrado | `npm run verificar:tudo` |

### M6 — Sumário, listas, siglas, remissivas, pós-textuais
**Aceite:** RF-11 (remissivas), RF-12, RF-13, RF-14.

#### Tarefas do M6 (2026-11-08; decisões D-M6 na matriz, tomadas pela sessão principal por delegação do usuário)
M6-T01 implementada em 2026-11-08, com validação parcial: testes locais, OOXML e LibreOffice aprovados;
Word, auditorias e E2E impedidos pelo ambiente. Detalhes em `docs/relatorios/M6_RELATORIO_MARCO.md`.

Comandos rodam em `app/`. Cada tarefa termina com `npm run verificar:tudo` passando e registro.
- **Base normativa:** Manual, p. 15, 18, 31 e 42–45 (RN-007, 045, 046, 047, 112, 113, 160 a 167), p. 64–67 (RN-230 a
  238), quase tudo `CONFIRMADA`, com as decisões do usuário C-B8, C-B9 e C-B17. O sumário existe desde o M3.
- **Limite do marco:** sem dependência nova. Página das listas por campo PAGEREF com a página estimada (D-M6-01), como o
  sumário. Índice fica fora (D-M6-09).

| ID | Tarefa | Agente(s) | Depende de | Aceite | Verificação |
|---|---|---|---|---|---|
| M6-T00 ✔ | Plano do M6 e decisões D-M6-01 a 09 | sessão principal | M5 | Plano e matriz | Revisão do plano |
| M6-T01 | Listas de ilustrações e de tabelas no DOCX: marcador no título de cada elemento, itens "Figura 1 – Título" com pontilhado e PAGEREF, listas por espécie com 5 ou mais (RN-160 a 163, RN-309; D-M6-01, 02) e opção de lista única | especialista-documento | T00 | Aceite do RF-12: inserir figura atualiza a lista sem ação manual | `npm run verificar:tudo` |
| M6-T02 | Siglas no formato e no motor: cadastro, inline `sigla`, primeira ocorrência por extenso, lista de abreviaturas e siglas (RN-046, 047, 165, 166; D-M6-03, 04) | especialista-documento | T00 | DOCX com "Extenso (SIGLA)" e a lista | `npm run verificar:tudo` |
| M6-T03 | Siglas na tela: cadastro, inserir no editor, sugestão de ligar o texto digitado, aviso de sigla sem cadastro (RF-13) | especialista-interface | T02 | Aceite do RF-13 | `npm run verificar:tudo` |
| M6-T04 | Símbolos e glossário: cadastros, lista de símbolos e glossário no DOCX (RN-167, RN-230; D-M6-05, 06) | especialista-documento + especialista-interface | T02 | DOCX com as duas listas ordenadas | `npm run verificar:tudo` |
| M6-T05 | Conteúdo de apêndices e anexos: blocos no formato, tela de incluir/retirar/renomear, edição no editor, DOCX (RF-14; RN-231 a 237; D-M6-07) | especialista-documento + especialista-interface | T00 | Aceite do RF-14 (apêndice com figura) | `npm run verificar:tudo` |
| M6-T06 | Remissiva a seção e a apêndice/anexo (RF-11; D-M6-08) | especialista-interface | T05 | Mover seção renumera a remissiva | `npm run verificar:tudo` |
| M6-T07 | Fechamento: `REVISAO_M6.md` com revisão independente, relatório do marco, matriz de testes | sessão principal | T01–T06 | Aceite do M6 demonstrado | `npm run verificar:tudo` |

### M7 — Verificador de conformidade
**Aceite:** RF-15 com documento de teste de 10 não conformidades plantadas.

#### Tarefas do M7 (2026-11-08; decisões D-M7 na matriz, tomadas pela sessão principal por delegação do usuário)
Comandos rodam em `app/`. Cada tarefa termina com `npm run verificar:tudo` passando e registro.
- **Ponto de partida (feito no M6 pelo Codex e revisado):** `dominio/verificador/conformidade.ts` consolida pré-textuais,
  bibliografia, elementos visuais e siglas (RN-046, 047, 050, 051, 056, 060, 063, 078, 096, 106, 181, 182, 241, 246,
  251, 255, 269, 274, 297), com aplicabilidade pelo perfil (regra ausente, ambígua sem decisão, pendente de fonte ou
  desativada vira diagnóstico, nunca acusação), janela "Verificar conformidade" com "Ir ao local" e relatório `.txt`.
  O teste do RF-15 já planta 10 defeitos, mas só de quatro famílias.
- **Base normativa das verificações novas:** coluna "Validação automática" da matriz, só regras `CONFIRMADA` ou com
  decisão provisória autorizada. Texto: RN-043, RN-086, RN-109 (título digitado com número), RN-081/082 (chamada
  escrita fora do padrão já coberta por CHAMADA_SEM_LIGACAO). Tabelas (IBGE): RN-247, 256, 257, 263, 270, 271, 279,
  284, 287, 298, 299, e RN-310 provisória.
- **Limite do marco:** só o que se verifica no modelo, sem layout. Formatação (fonte, margens, espaçamento) é gerada pelo
  motor e conferida na regressão DOCX, não no verificador (D-M7-01). Sem dependência nova.

| ID | Tarefa | Agente(s) | Depende de | Aceite | Verificação |
|---|---|---|---|---|---|
| M7-T00 ✔ | Plano do M7 e decisões D-M7-01 a 05 | sessão principal | M6 | Plano e matriz | Revisão do plano |
| M7-T01 ✔ | Verificações do texto: título de seção secundária a quinária em caixa alta integral (RN-043), título com indicativo digitado (RN-109), supressão "(...)" ou "…" em citação (RN-086), seção sem texto e título vazio (D-M7-02) | especialista-documento | T00 | Cada código com teste positivo e negativo; controle correto sem falso positivo | `npm run verificar:tudo` |
| M7-T02 ✔ | Verificações de tabela da Norma Tabular: título com sigla (RN-247), coluna indicadora (RN-256), unidade (RN-257), célula fora dos sinais (RN-263), fonte (RN-270, 271), série temporal (RN-279), classes abertas (RN-284), total divergente (RN-287), sinais ≥ dados (RN-298), "Outros" maior (RN-299), ponto final no título (RN-310, provisória) — todas aviso | especialista-elementos-visuais | T00 | Idem; corpus de tabelas do IBGE (Anexo B) sem falso positivo | `npm run verificar:tudo` |
| M7-T03 ✔ | Tela: agrupamento por família, filtro erro/aviso, contagem, local legível ("Seção 2.1", "Tabela 3"), "Ir ao local" para pré-textual e obra, foco devolvido, relatório com as mesmas famílias | especialista-interface | T01, T02 | E2E: verificar, filtrar, ir ao local e exportar; axe sem violação | `npm run verificar:tudo` |
| M7-T04 ✔ | Aceite do RF-15 ampliado: documento de 10 não conformidades de famílias diferentes (texto, tabela, pré-textual, bibliografia, siglas, visual) e documento correto de referência, no domínio e no E2E | sessão principal | T01–T03 | As 10 detectadas, nenhum falso positivo | `npm run verificar:tudo` |
| M7-T05 ✔ | Fechamento: `REVISAO_M7.md` com revisão independente (normas: falso positivo e fonte de cada aviso; segurança: relatório e desempenho em 150 páginas), relatório do marco, matriz de testes | sessão principal | T01–T04 | Aceite do M7 demonstrado | `npm run verificar:tudo` |

## Etapa 6 — Testes e validação

**Base:** `PROMPT_EXECUCAO.md`, Etapa 6. **Critério de conclusão:** todos os casos críticos da matriz de testes
`PASSOU`; falhas restantes documentadas com impacto e plano em `docs/relatorios/ETAPA6_VALIDACAO.md`.
Plano feito em 2026-11-08 pela sessão principal ("prosseguir"), com o M3-T12 ainda aguardando o usuário: a conferência
manual no Word entra aqui como caso manual (DOC-08), sem bloquear as tarefas automáticas.

- **Casos críticos** (D-E6-01): os de RF com prioridade M (RF-01 a RF-15), DOC-01 a 08, SEG, PER e DES-01. UI e KIT
  são importantes, não críticos.
- **Limite:** sem dependência nova; a conferência visual usa o LibreOffice já instalado (PDF → imagem) e a automação do
  Word já usada no M3. Documentos de exemplo só com dados fictícios.

| ID | Tarefa | Agente(s) | Depende de | Aceite | Verificação |
|---|---|---|---|---|---|
| E6-T00 ✔ | Plano da Etapa 6 e D-E6-01 | sessão principal | M7 | Plano | Revisão do plano |
| E6-T01 ✔ | Reconciliar a matriz de testes: cada caso com o teste que o cobre hoje, executado, e o resultado real; casos sem teste ganham teste (FUN-03 a 08, FUN-11, UI-01) | engenheiro-qualidade | T00 | Nenhum caso crítico `NÃO EXECUTADO` | `npm run verificar:tudo` |
| E6-T02 ✔ | Documentos de exemplo, um por tipo de trabalho (seis), com todos os elementos (pré-textuais, cinco níveis, citações, tabela, figura, gráfico, equação, siglas, listas, referências, apêndice e anexo), gerados por script e validados no DOCX: estrutura, estilos, margens, numeração de páginas, sumário, listas e referências, no validador OOXML, no LibreOffice e no Word | engenheiro-qualidade + especialista-documento | T01 | Seis DOCX sem erro nos três validadores; propriedades conferidas por teste | `npm run test:externos` |
| E6-T03 ✔ | Conferência visual: páginas-chave dos exemplos (capa, folha de rosto, resumo, sumário, listas, 1.ª página textual, tabela, figura, referências, apêndice) renderizadas pelo LibreOffice e comparadas com os exemplos do Manual; diferenças registradas com descrição | sessão principal | T02 | Diferenças registradas, cada uma com RN e decisão | Relatório |
| E6-T04 ✔ | Pendências de teste herdadas: E2E de diálogos nativos e da Lixeira (R-M1-10); sinal convencional sem explicação na nota geral e chamada × nota específica no verificador (N-M5-06; RN-265, RN-276) | engenheiro-qualidade + especialista-elementos-visuais | T01 | Teste de cada uma | `npm run verificar:tudo` |
| E6-T05 ✔ | Relatório `ETAPA6_VALIDACAO.md` (modelo `templates/RELATORIO_DE_TESTES.md`): resultado por caso, limitações conhecidas, casos manuais do usuário (DOC-08, KIT-08) | sessão principal | T01–T04 | Critério de conclusão da Etapa 6 | Revisão |

## Etapa 7 — Estabilização e distribuição Windows

**Base:** `PROMPT_EXECUCAO.md`, Etapa 7; ADR-0003 (empacotamento, assinatura); pendências do M1-T14
(`docs/relatorios/M1_RELATORIO_MARCO.md`). **Critério de conclusão:** instalador gerado e testado; fluxos essenciais
validados; documentação de instalação completa; pendências registradas para a próxima versão.
Plano feito em 2026-11-08 pela sessão principal ("siga o próximo passo"), com a Etapa 6 aguardando o usuário (DOC-08,
F-E6-01), que não bloqueia o empacotamento.

- **Decisão do usuário pendente (D-E7-01, assinatura de código, ADR-0003):** (i) certificado OV, (ii) MSIX na
  Microsoft Store, (iii) sem assinatura, com o alerta do SmartScreen documentado. Até a resposta, o instalador sai
  **sem assinatura e sem atualização automática** (recomendação do ADR-0003 para uso próprio) e **não deve ser
  distribuído a outras pessoas**.
- **Limite:** Windows 10 não está disponível nesta máquina: o roteiro DIST roda no Windows 11 e o Windows 10 fica como
  caso manual. Sem dependência nova.

| ID | Tarefa | Agente(s) | Depende de | Aceite | Verificação |
|---|---|---|---|---|---|
| E7-T00 ✔ | Plano da Etapa 7 | sessão principal | E6 | Plano | Revisão do plano |
| E7-T01 ✔ | Pendências do pacote (M1-T14): NSIS 3.0.4.1 × CVE-2023-37378 avaliado e registrado; fuse do índice 8; cache das ferramentas; `CompanyName` | arquiteto-software | T00 | Cada item corrigido ou aceito com motivo | `npm run dist`; `tests/empacotamento.test.ts` |
| E7-T02 ✔ (parcial) | Roteiro DIST no Windows 11: instalação limpa por usuário sem administrador, abrir com dados isolados, fumaça de exportação no pacote, reinstalar por cima, desinstalar com o app aberto, desinstalação limpa (só ficam os dados do usuário), tamanhos contra o RNF-08 | engenheiro-qualidade | T01 | DIST-01 a 05 `PASSOU` ou limitação registrada | Roteiro com saída real |
| E7-T03 | Documentação: `app/README.md` para o usuário final (o conteúdo de desenvolvimento passa para `app/DESENVOLVIMENTO.md`) e `docs/INSTALACAO_APP.md` (instalar, primeiro uso, onde ficam os dados, desinstalar, SmartScreen) | sessão principal | T02 | Guias completos | Revisão |
| E7-T04 | Revisão final de segurança e de dependências e licenças (`revisor-seguranca`), relatório `ETAPA7_DISTRIBUICAO.md` com as pendências para a próxima versão | sessão principal + revisor-seguranca | T01–T03 | Critério de conclusão da Etapa 7 | `npm run verificar:tudo` |

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
