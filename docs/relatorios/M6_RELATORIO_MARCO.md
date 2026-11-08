# Relatório do Marco M6 — Listas, siglas e pós-textuais

## M6-T01 — Listas de ilustrações e de tabelas (2026-11-08)

**Situação: implementada; validação parcial.** O marco M6 continua em andamento. A implementação segue as decisões
D-M6-01/02 já registradas na matriz; nenhuma dependência foi acrescentada.

### Implementado [VERIFICADO nos arquivos citados]

- `app/src/dominio/normas/motor-listas.ts`: listas na ordem do documento e texto copiado das legendas formatadas.
  Tabela tem lista própria; quadro e gráfico são ilustrações. Espécies com cinco ou mais itens têm lista própria,
  conforme RN-161/C-B8. O restante fica na lista geral. Listas vazias são omitidas.
- `motor.ts`, `formatado.ts` e `exportacao/docx/exportador.ts`: cada legenda recebe marcador; cada entrada usa PAGEREF
  com página estimada, tabulação à direita e pontilhado. A estimativa também funciona sem sumário. Tabela longa aparece
  uma vez, pela página inicial. Estilo das entradas no perfil: 12, espaço 1,5, justificado (RN-162).
- `PreTextuais.tsx`: opção "Usar lista única de ilustrações". O campo opcional `listaUnica: true` é aditivo no v1;
  ausência preserva o agrupamento automático. Esquema estrito e JSON Schema atualizados. A opção sobrevive ao arquivo
  `.bdp` e à retirada/restauração do elemento pelo histórico.
- Corpus difícil inclui as duas listas. Instantâneos: novo estilo nos sete documentos; no documento difícil,
  listas, marcadores de legenda e páginas do sumário deslocadas pelas duas folhas novas. Revisão das diferenças
  feita com `git diff --text`; não houve troca de biblioteca.
- Conferência do Word compara PAGEREF gravado e atualizado em memória. O teste passa `-ExecutionPolicy Bypass`
  somente ao processo de PowerShell usado pelo teste; nenhuma política do Windows foi alterada.

### Testado (2026-11-08)

| Comando, em `app/` salvo indicação | Resultado real |
|---|---|
| `npm.cmd run esquemas:gerar` | 12/12; `documento.schema.json` atualizado |
| `npm.cmd run typecheck` | PASSOU |
| `npx.cmd vitest run` | 1966/1966; inclui regras do perfil, arquitetura, regressão DOCX e histórico/persistência da opção |
| `npm.cmd run test:ooxml` | 9/9; corpus com as listas válido no esquema OOXML |
| `npm.cmd run test:libreoffice` | 10/10; converte corpus e confere páginas iniciais nas duas listas |
| `npm.cmd run build`, executado por `test:e2e` | PASSOU |
| `python tests/test_estrutura_kit.py`, na raiz | 9/9; checksums dos materiais preservados |

### Validações impedidas pelo ambiente [VERIFICADO nos logs em `analise/`]

- `npm.cmd run verificar:tudo` parou em `npm audit`, depois de passar typecheck e testes: acesso ao registro npm falhou.
  A auditoria de assinaturas foi tentada separadamente. A verificação completa não é declarada aprovada.
- `npm.cmd run test:word`: 8 falhas ao criar Word.Application, antes de abrir os arquivos, HRESULT **0x80070520**
  (sessão de logon indisponível). Não foi possível comparar as páginas estimadas com o Word nesta sessão.
- `npm.cmd run test:e2e`: build aprovado; as três primeiras tentativas falharam ao iniciar Electron, antes de carregar
  a aplicação. Erro fatal `install_dir_access.cc`: ACL da pasta do Electron incompatível com o token de sandbox.
  A rodada foi interrompida após constatar o mesmo impedimento. O novo E2E da opção e a conferência axe dessa tela
  permanecem sem execução bem-sucedida. Não foram alteradas ACLs nem desativada a sandbox.

### Limites e próximo passo

As páginas são estimadas; no Word, selecionar todo o documento e pressionar F9 atualiza os campos. Mudanças de elementos
no BiblioDocs Pro refazem as listas ao exportar. Depois de editar legendas diretamente no Word, F9 só corrige páginas,
não insere nem remove entradas das listas. Apêndices e anexos só entram na contagem quando tiverem conteúdo no M6-T05.

Reexecutar Word, auditorias e E2E em sessão com os recursos disponíveis antes de encerrar M6-T01. A próxima implementação
do plano é **M6-T02**, cadastro e expansão de siglas no formato e no motor.

## Revisão e consolidação pela sessão principal (2026-11-08) — trabalho do Codex, M6-T01 a T06 e início do M7

**Contexto:** depois do commit `114526a` (M6-T00), o Codex implementou na mesma pasta, sem commit, o M6-T01 (relatado
acima) e também, sem relatório, partes do M6-T02 a T06 e o início do verificador de conformidade do M7. O usuário
pediu (2026-11-08) que a sessão principal revisasse esse trabalho e continuasse. Estado encontrado: 63 arquivos
alterados e 23 novos; typecheck aprovado; 2025 de 2030 testes aprovados (5 falhas da regressão DOCX com o corpus
ampliado, ainda sem os instantâneos e as expectativas atualizados).

**O que o trabalho do Codex entrega (conferido na leitura do código e nos testes):**
- M6-T01: listas de ilustrações e de tabelas (relatado acima).
- M6-T02: siglas no formato e no motor: cadastro, `sigla` no texto, "Extenso (SIGLA)" na primeira ocorrência e "SIGLA"
  depois (RN-046, RN-047), lista de abreviaturas e siglas só com as usadas, em ordem pt-BR, em duas colunas (RN-165,
  RN-166/C-B9).
- M6-T03: sigla na tela: botão "Sigla" e janela de inserir, sugestão de ligar o texto digitado que coincide com o
  cadastro (só com o aceite do autor), aviso de sigla escrita em maiúsculas sem cadastro (aceite do RF-13).
- M6-T04: símbolos e glossário: cadastros na janela "Siglas, símbolos e glossário…"; lista de símbolos ordenada pelo
  significado (D-M6-05) e glossário "Termo: definição" em ordem pt-BR, com aviso de forma provisória (D-M6-06).
- M6-T05: conteúdo de apêndices e anexos: blocos no formato, tela "Elementos pós-textuais" (incluir, retirar, renomear,
  ordenar), edição no editor de seção, DOCX com identificação e conteúdo; elementos visuais de dentro numerados em
  sequência com o texto.
- M6-T06: remissiva a seção ("2.1") e a apêndice/anexo ("APÊNDICE A") no domínio e no motor.
- Início do M7 (RF-15): `dominio/verificador/conformidade.ts`, janela "Verificar conformidade" com "Ir ao local" e
  exportação do relatório em `.txt` por canal novo (`bibliodocs:exportacao:relatorio`), com regras de verificação no
  perfil, cada uma com fonte (as sem fonte no Manual, RN-060 e RN-182, marcadas provisórias).

**Achados da revisão e correções:**

| Achado | Correção |
|---|---|
| Marcador `_Pos_${id}` na identificação de apêndice e anexo: o id tem até 64 caracteres e pode ter "-", e o Word só aceita nome de marcador de até 40 caracteres, com letras, algarismos e "_" (risco de reparo ou recusa do arquivo). O corpus usava ids curtos e não pegava | `_Pos_A1`, `_Pos_N1` (contador). Teste novo em todos os documentos do corpus: todo `w:bookmarkStart` com nome válido para o Word |
| A lista de elementos da tela (alvos de remissiva e tabelas dos gráficos, M5-T08/T09) era montada só com o corpo. Com o M6-T05/T06, remissiva a seção ou a apêndice aparecia "[remissiva quebrada]" no editor, embora saísse certa no DOCX, e as tabelas e figuras dos apêndices não apareciam nas janelas | A sessão usa o documento todo (corpo, apêndices e anexos), com cache pelo corpo e pelos pós-textuais; o aviso de quebra diz "Seção 2.1". Teste novo na sessão |
| Cinco testes da regressão DOCX desatualizados com o corpus ampliado (glossário, siglas, símbolos, apêndices com marcador) | Expectativas e instantâneos atualizados depois de conferir o diff: só as duas folhas novas (siglas e símbolos), o glossário, "Universidade Federal do Tocantins (UFT)" e depois "UFT", páginas do sumário deslocadas em 2 e os marcadores |
| E2E da remissiva (FUN-18 e axe) contava 1 e 2 alvos; com as seções na janela, são mais | Os testes escolhem a equação pelo nome; a janela da remissiva cita seção e apêndice nos textos |
| Comentário desatualizado em `motor-elementos.ts` ("siglas e símbolos ainda saem só com aviso") | Atualizado |
| Os acréscimos ao formato do M6-T02 a T06 não estavam no ADR-0004 | Adendo do M6-T02 a T06 |

**Conferido e correto:** esquemas estritos e aditivos; regras novas do perfil com fonte igual à da matriz (teste de
rastreabilidade) e as sem fonte marcadas provisórias; canal novo do relatório no padrão seguro (remetente conferido,
pacote validado no principal, destino só pelo diálogo do sistema, `.txt` obrigatório, gravação atômica); sugestões de
sigla limitadas (200) e verificador limitado (1.000 itens); nada de `innerHTML`.

**Pendências registradas (não corrigidas aqui):**
- RN-047, segunda parte: aviso quando a forma por extenso reaparece depois da primeira ocorrência. **Feito no M6-T07** (`SIGLA_EXTENSO_REPETIDO`, aviso, na ordem de leitura; testes em `tests/siglas.test.ts`).
- Glossário no estilo do corpo (recuo de primeira linha e justificado): a forma não tem fonte (D-M6-06 provisória).
- Índice (D-M6-09) fora do M6.
- O verificador de conformidade é do M7: entra no plano do M7 como ponto de partida, a ser revisto e completado lá.

**Testado:** `npx vitest run` 2038/2038; E2E da remissiva e axe depois do ajuste. `npm run verificar:tudo`: saída 0 nas camadas de verificação: `verificar` 2038/2038 (auditoria só com avisos moderados de ferramentas de empacotamento), externos 28/28 (Word confere as 4 páginas das listas: PAGEREF gravado = recalculado), build ok; Playwright 36/37 na suíte completa (FUN-13 da citação, instabilidade já registrada no M5-T05) e 37/37 na repetição, FUN-13 3/3 sozinho.

## M6-T07 — Revisão independente e fechamento do M6

**Feito pela sessão principal em 2026-11-08**, com dois revisores independentes só de leitura (segurança e normas).
Relatório: `docs/relatorios/REVISAO_M6.md`.

- **Altas corrigidas:**
  - R-M6-01: typecheck vermelho por um teste da sessão principal;
  - R-M6-02: tela de pós-textuais não ligada ao app. Ao ligá-la, o E2E achou o título do apêndice com duas fontes; o
    título ficou só no editor.
- **Médias corrigidas:**
  - R-M6-03: desfazer estrutural apagava texto de apêndice;
  - R-M6-04: gráfico em apêndice;
  - R-M6-05: RN-047 com custo quadrático;
  - N-M6-01: apêndice sem título;
  - N-M6-02: citação longa;
  - N-M6-03: RN-096 fora do perfil.
- **Também feitos:**
  - RN-047, 2.ª parte (aviso da forma por extenso repetida);
  - D-M6-10 a 12 por delegação;
  - as Baixas e Infos listadas no relatório.
- **Abertos:** R-M6-10 e 12; N-M6-06, 10, 11 (parcial), 12 (do usuário) e 14.

**Aceite do M6 (RF-11, RF-12, RF-13, RF-14):**

| Requisito | Aceite | Onde foi demonstrado |
|---|---|---|
| RF-11 | Remissivas por id, também a seção e a apêndice | `tests/remissivas.test.ts` (inclusive a lista da tela com seção e apêndice), `e2e/remissiva.spec.ts` |
| RF-12 | Inserir seção ou figura atualiza sumário e listas sem ação manual | Listas e sumário gerados na exportação a partir da numeração: `tests/motor-listas.test.ts`, `e2e/listas.spec.ts`; Word confere a página de cada entrada |
| RF-13 | Cadastro, uso no texto, lista ordenada, aviso de sigla usada sem cadastro | `tests/siglas.test.ts`, `tests/editor-siglas.test.ts`, conformidade |
| RF-14 | Referências, glossário, apêndices e anexos com letra; imagens em apêndice e anexo | `e2e/pos-textuais.spec.ts` (FUN-20), `tests/pos-textuais-sessao.test.ts`, `tests/grafico.test.ts` (gráfico em apêndice), regressão DOCX. Índice (F) fora (D-M6-09) |

**Testado:** `npx vitest run` 2055/2055; `npm run typecheck` sem erros. `npm run verificar:tudo`: interrompido pelo sistema por falta de memória na máquina (não é falha de teste). Passaram antes da interrupção: typecheck, `verificar` 2055/2055 (auditoria só com avisos moderados), externos 28/28 (Word, LibreOffice, OOXML) e build. A suíte E2E (39 testes) foi parada no início; FUN-20 e o axe novo passaram rodados sozinhos. **Falta reexecutar o E2E completo**.

**M6 pronto para fechar**: falta só o E2E completo, a reexecutar quando houver memória livre.

