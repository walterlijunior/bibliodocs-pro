# Relatório do marco M5 — Tabelas e elementos visuais

Andamento do marco, tarefa por tarefa. Plano em `docs/PLANO_DE_IMPLEMENTACAO.md` (seção M5).

## M5-T00 — Estudo visual, regras e decisões

**Feito pela sessão principal em 2026-11-07.** O usuário delegou as decisões ("continue e decida você mesmo"). Cada uma ficou na matriz como provisória e pode ser revista.

**Estudo visual:** `docs/relatorios/ESTUDO_VISUAL_TABELAS.md`.
- **Estudo Capcom** [VERIFICADO no XML]: 77 tabelas do Word (35 quadros e 42 tabelas), nenhuma imagem.
  - Todas têm "Fonte:" e cabeçalho repetido.
  - Quadros são fechados e tabelas abertas com três traços, como no Manual e no IBGE.
  - Divergem do Manual: o título em corpo 10 e à esquerda (o Manual pede 12 e centralizado), a fonte justificada (o Manual pede à esquerda) e o cabeçalho cinza (sem norma).
- **Guia do IFPR:**
  - título à esquerda e com hífen, onde o Manual centraliza e usa meia-risca;
  - fonte dispensável, onde o Manual a exige.
- Nada que diverge do Manual é adotado.

**Base normativa:** as regras já estavam na matriz desde a Etapa 3:
- RN-015 a 066, RN-105 a 108 e RN-164 (Manual);
- RN-241 a 312 (IBGE);
- decisões do usuário C-A1 a C-A5, C-C1 a C-C5 e P-C2 a P-C4: título 12 centralizado, corpo 10 nas células, números à direita, milhares conforme o perfil, só os três traços.

**Decisões novas (D-M5-01 a 10, provisórias):**

| Decisão | Escolha |
|---|---|
| D-M5-01 | Planilha por CSV e colagem do Excel/LibreOffice; XLSX fora do M5 |
| D-M5-02 | Cabeçalho sem sombreamento |
| D-M5-03 | Cabeçalho repetido no DOCX; "continua/conclusão" não é automático, e o verificador avisa a tabela longa |
| D-M5-04 | Elemento sem remissiva no texto: só aviso |
| D-M5-05 | Equação à esquerda, como o exemplo da p. 27, com o número à direita |
| D-M5-06 | Equação em texto linear, sem editor de fórmulas |
| D-M5-07 | Numeração contínua por tipo |
| D-M5-08 | Gráfico gerado (colunas, barras, linhas, setores) em tons de cinza |
| D-M5-09 | Imagens PNG e JPEG, aviso abaixo de 150 ppi |
| D-M5-10 | O autor escolhe tabela ou quadro, e o verificador avisa tabela sem número |

**Plano:** dez tarefas, M5-T01 a M5-T10, no plano de implementação. Nenhuma dependência nova prevista.

**Verificação:** tarefa só de documentação. Rodei `npm run verificar` para confirmar que nada mudou no código.

## M5-T03 — Motor e DOCX de tabela e quadro

**Feito pela sessão principal em 2026-11-08.**

**Implementado:**
- `app/src/dominio/normas/motor-visuais.ts` (novo): título com rótulo, moldura por regra, cabeçalho repetido, rodapé na ordem da RN-277 e espaço depois (RN-031, RN-308). Sem a regra no perfil, nada sai do código.
- `motor.ts`: estilos `tituloElemento`, `rodapeElemento` e `celulaTabela`; tabela e quadro deixam de gerar `ELEMENTO_ADIADO`.
- `perfil.json` (UFT 2022): regras RN-015, 021, 022, 031, 032, 050, 052, 053, 057, 063, 066, 251 a 254, 061, 267, 277, 292, 307, 308 e 311 (esta `PENDENTE-FONTE`, corpo 10 por P-C2).
- `exportador.ts`: tabela nativa com `gridSpan`, `vMerge`, `tblHeader` e traços explícitos (ausência como `none`).
- `manipuladores-exportacao.ts`: as pendências de `verificarVisuais` vão junto dos avisos.
- Corpus: o documento difícil ganhou uma tabela com cabeçalho mesclado, um quadro e uma tabela de 61 linhas.

**Decisões por delegação (provisórias, na matriz):** D-M5-21 (parágrafo vazio de rodapé), D-M5-22 (colunas iguais), D-M5-23 (traço de baixo nas células da última linha), D-M5-24 (limite de 40 linhas mantido).

**Testado:**
- `npm run verificar`: 1809/1809, audit sem alta (7 moderadas novas em `fast-uri`/`minimatch`, só de desenvolvimento; 0 em produção).
- `npm run test:externos`: 27/27 (Word abre o documento difícil com as 4 tabelas).
- `npm run build`: ok.
- Playwright: 24/25. Falhou só o E2E de desempenho por memória (813 MB contra 800); numa repetição passou. É a falha já registrada no M5-T01 (R-M3-13).

**Não testado / pendente:** conferência visual impressa da tabela longa no LibreOffice (só o Word foi aberto pelo teste externo); largura por coluna fica para o editor (M5-T04).

## M5-T04 — Editor de tabela e quadro

**Feito pela sessão principal em 2026-11-08.**

**Implementado:**
- `app/src/aplicacao/servicos/tabelas.ts` (novo): o rascunho da janela (grade completa, `null` nas posições cobertas); inserir e excluir linha e coluna (a mesclada que atravessa cresce ou encolhe), mesclar à direita e abaixo, separar, cabeçalho; sinais convencionais (RN-263, RN-264) e a explicação na nota (RN-265); `validarTabela`.
- `dominio/esquemas/validar.ts`: `validarTabelaV1` (esquema e grade de uma tabela sozinha).
- `interface/editor/tabelas.ts` (novo): inserir (no parágrafo vazio ou depois do bloco do cursor) e alterar pelo id, cada um um passo próprio do histórico.
- `interface/editor/tabela-view.ts` (novo): a tabela no texto, com título, grade, rodapé, "Falta a fonte" e as 30 primeiras linhas.
- `interface/escrever/DialogoTabela.tsx` (novo), `EditorSecao.tsx`, `AreaEscrever.tsx`, menu Inserir (`definicoes.ts`, `Aplicativo.tsx`), `casca.css`.

**Decisões por delegação (provisórias, na matriz):** D-M5-25 a 28.

**Testado:**
- `npm run verificar`: 1841/1841 (25 novos em `tabelas-servico`, 7 em `editor-tabela`); audit sem alta.
- `npm run test:externos`: 27/27. `npm run build`: ok.
- Playwright: 27/27, com `e2e/tabela.spec.ts` (FUN-14) e o axe da janela e da tabela no texto. O E2E de desempenho passou nesta rodada.
- Conferência visual por captura de tela da janela e da tabela no texto.

**Não testado / pendente:**
- Marcas (itálico, sobrescrito) dentro da célula: a janela edita texto simples (D-M5-26).
- Tabela muito grande na janela: todas as células viram campos; com milhares de linhas a janela fica pesada. Colar da planilha chega no M5-T05.

## M5-T05 — Colar do Excel e do LibreOffice e importar CSV

**Feito pela sessão principal em 2026-11-08.**

**Implementado:**
- `app/src/aplicacao/servicos/planilha.ts` (novo): texto separado com aspas (TSV e CSV), separador detectado, conversão de números (P-C3) e datas, vazios, colunas de números e alinhamento, cabeçalho sem cortar mesclagem, grade irregular, limites, relatório.
- `app/src/interface/editor/planilha-colada.ts` (novo): a primeira tabela do HTML colado, com `colspan`/`rowspan`, `th`/`thead`, `<br>` e parágrafos, linhas ocultas contadas; sem `innerHTML`.
- `colagem.ts`: `arvoreDoHtmlColado` (o `DOMParser` continua só ali, regra E3).
- `interface/escrever/PlanilhaTabela.tsx` (novo) na janela da tabela; aviso da tabela colada no texto.
- Fixtures `tests/fixtures/planilha/` (HTML do Excel e do LibreOffice escritos à mão no formato conhecido [HIPÓTESE de fidelidade]; CSV em UTF-8 com BOM e em Windows-1252), protegidas no `.gitattributes`.

**Decisões por delegação (provisórias, na matriz):** D-M5-29 a 33.

**Testado:**
- `npm run verificar`: 1859/1859 (18 novos em `planilha.test.ts`); audit sem alta.
- `npm run test:externos`: 27/27. `npm run build`: ok.
- Playwright: 28/28 na última rodada, com FUN-15 (colagem real pela área de transferência do Electron e CSV por arquivo) e o axe da prévia.
- Aceite do RF-09: CSV com acentos, vírgula decimal, células vazias e datas gravado sem perda (unitário e E2E).

**Não testado / pendente:**
- Cópia real do Excel e do LibreOffice instalados: as fixtures imitam o formato; conferir à mão no M5-T10.
- **Instabilidade antiga do E2E da citação (FUN-13):** na suíte completa, o Ctrl+Alt+F às vezes não insere a nota (linha 114). Falhou 3 de 4 vezes com o M5-T05 e 1 de 3 no commit anterior (`5c3a4a7`), sem as mudanças; isolado, passou 6 de 6. Não vem desta tarefa; investigar no M5-T10.
- E2E de desempenho: pico de memória 816–853 MB contra 800 em algumas rodadas (R-M3-13), também no commit anterior.

## M5-T06 — Figuras

**Feito pela sessão principal em 2026-11-08.**

**Implementado:**
- `dominio/visuais/imagem.ts` (novo): tipo, pixels e resolução lidos só do cabeçalho (PNG: IHDR, pHYs; JPEG: SOFn, JFIF), sem decodificar; largura impressa e resolução efetiva.
- `dominio/verificador/visuais.ts`: `RESOLUCAO_BAIXA` (RNF-17) e `avisoDeResolucao`.
- Motor: `blocosIlustracao` (título com rótulo, imagem, rodapé comum com a tabela), estilo `imagemElemento`, `areaUtilMm`, aviso `IMAGEM_AUSENTE`; perfil com a RN-059 no alvo novo `ilustracao.imagem`.
- Exportador: imagem em linha (`ImageRun`) com texto alternativo; id do desenho por documento, para o mesmo documento dar o mesmo arquivo.
- Exportação (IPC): as imagens do pacote vão ao motor e ao verificador.
- Sessão: `incluirMidia` (uma por sha256), `lerMidia`, `soMidiasUsadas` ao salvar, no instantâneo e na exportação.
- Interface: `DialogoFigura.tsx`, `figura-view.ts`, comandos de inserir e alterar generalizados em `editor/tabelas.ts`, botão "Figura", menu Inserir › Figura….
- Corpus: o documento difícil ganhou a Figura 1 (PNG de 600 × 400 px a 300 ppi gerado no teste); fixtures PNG para o E2E.

**Decisões por delegação (provisórias, na matriz):** D-M5-34 a 37.

**Testado:**
- `npm run verificar`: 1877/1877 (`figuras.test.ts` novo; sessão, exportação e regressão ampliados; instantâneos revistos: estilo novo em todos e a figura no documento difícil, 50,8 mm conferidos no XML).
- `npm run test:externos`: 27/27; o Word abre o documento difícil e conta 1 imagem.
- `npm run build`: ok. Playwright: 30/30, com FUN-16 e o axe da janela e da figura no texto.
- Aceite do RF-10 (aviso de resolução): unitário, exportação por IPC e E2E.
- Conferência visual por captura da janela e da figura no texto.

**Não testado / pendente:**
- Foto de celular com rotação no EXIF sai sem girar (D-M5-35).
- A imagem não fica presa à fonte na quebra de página (D-M5-34).
- Imagem muito grande (dezenas de MB) não foi medida quanto à memória (R-M3-13).

## M5-T07 — Equações

**Feito pela sessão principal em 2026-11-08.**

**Implementado:**
- Perfil: RN-105 (`equacaoDestacada`) e RN-106 (`numeroDaEquacao`) no alvo novo `equacao`; RN-108 (AMBÍGUA) com o parâmetro `alinhamentoEquacao` = esquerda, provisório (D-M5-05).
- Motor: estilo `equacao` (corpo, sem recuo de primeira linha, alinhamento do parâmetro), `blocosEquacao` com "	(n)" e a parada de tabulação à direita na largura útil; numeração contínua no documento, só das numeradas; aviso `EQUACAO_VAZIA`. Sai o aviso `ELEMENTO_ADIADO` da equação.
- Exportador: `tabStops` à direita no parágrafo; sem `<w:t>` vazio em volta da tabulação.
- Editor: a equação deixa de ser folha atômica e passa a nó editável (texto com marcas e quebra de linha), com o atributo `numerada`; conversão de ida e volta exata.
- Comandos: `alternarEquacao` (Alt+=, botão "Equação", Inserir › Equação), `alternarNumeroEquacao` (botão "Numerar (n)", só na equação), Enter no fim abre parágrafo, Backspace no começo volta a parágrafo. A tela mostra "(n)" à direita.
- Corpus: o documento difícil ganhou duas equações numeradas, uma com expoente, e uma sem número, com índice.

**Decisões por delegação (provisórias, na matriz):** D-M5-38 a 41.

**Achado ao validar:** no fim do texto do documento difícil, as equações fizeram o LibreOffice levar REFERÊNCIAS para a folha seguinte, e o teste DOC-07 com o LibreOffice falhou. A estimativa do sumário não mudou com as equações nem com três parágrafos comuns no lugar delas. O Word, conferido por automação, deixa REFERÊNCIAS na folha 12, como a estimativa. É diferença de diagramação entre os dois editores, já prevista no R05, agora anotada lá. As equações do corpus foram para a seção 1, antes da quebra de página pedida, onde há folga.

**Testado:**
- `tests/equacoes.test.ts` (novo, 10 testes): motor, estilo, sem as regras, equação vazia, conversão, comandos.
- `tests/regressao-docx.test.ts`: equações no XML (tabulação à direita em 9071, "(1)" e "(2)", sobrescrito, estilo à esquerda sem recuo, entrelinha automática). Instantâneos revistos: estilo "Equação" em todos, e as três equações no documento difícil (diffs só com acréscimos; a mudança de lugar deu diff equilibrado).
- `e2e/equacao.spec.ts` (FUN-17) e axe da equação com o botão "Numerar (n)".
- `npm run verificar:tudo` (2026-11-08, depois de mudar as equações de lugar no corpus): saída 0. `verificar` 1892/1892 (auditoria: 7 avisos moderados de ferramentas de empacotamento, abaixo do limite "alto"); externos 27/27, com DOC-07 no LibreOffice, o Word e o validador OOXML; build ok; Playwright 32/32.

**Não testado / pendente:**
- Não houve conferência visual por captura da equação no editor.
- Fórmulas com frações, raízes ou matrizes não cabem no texto linear (D-M5-06); OMML fica para depois do M5.
- Equação colada de outro programa entra como parágrafo; o autor a converte com Alt+=.

## M5-T08 — Remissivas

**Feito pela sessão principal em 2026-11-08.**

**Implementado:**
- Formato: `InlineRemissiva` `{ tipo: 'remissiva', id, alvo }`, só no texto corrido; alvo não conferido na leitura (adendo do M5-T08 no ADR-0004). JSON Schema regenerado. Fixture `documento-bordas-m5.json` com três remissivas (uma quebrada); fixture inválida `remissiva-no-titulo.json`.
- Domínio: `dominio/visuais/remissivas.ts` (alvos na ordem do documento, com rótulo e descrição; remissivas do texto; texto da quebrada).
- Motor: a remissiva sai como o rótulo atual ("Tabela 3", "(2)") ou "[remissiva quebrada]"; DOCX em texto simples (D-M5-44).
- Verificador: `REMISSIVA_QUEBRADA` (pendência, RF-11) e `SEM_REMISSIVA` (aviso, RN-060/D-M5-04, só tabela, quadro e ilustração). A exportação mostra os dois.
- Sessão: `elementos` na tela (alvos com a contagem de remissivas), estável enquanto nada muda; cache das contagens por lista de blocos, então só a seção editada é relida. Aviso de remissiva quebrada ao excluir o elemento citado ou tirar o número da equação citada; ele sai quando o elemento volta.
- Editor: nó atômico `remissiva` (`remissivas.ts`, puro; `remissiva-view.ts`, na tela), comandos de inserir e trocar o alvo, cópia com o texto, botão "Remissiva", menu Inserir › Remissiva…, Enter e duplo clique na remissiva abrem a janela. `DialogoRemissiva.tsx` lista os elementos com o alvo atual marcado e avisa quando a remissiva está quebrada.
- Corpus: o documento difícil cita a Tabela 1 na seção 1 ("ver a Tabela 1"), longe do fim do texto, por causa do DOC-07.

**Decisões por delegação (provisórias, na matriz):** D-M5-42 a 46.

**Achado ao revisar:** a remissiva quebrada gerava dois avisos na exportação, um do motor e um do verificador. Ficou só o do verificador, que é pendência com a RF-11.

**Testado:**
- `tests/remissivas.test.ts` (novo, 10 testes): alvos e rótulos, renumeração no motor, quebrada no DOCX, comandos do editor, lista da sessão e aceite do RF-11 (aviso ao excluir, aviso que sai ao voltar, equação sem número, outro trabalho aberto).
- `tests/visuais-numeracao.test.ts`: SEM_REMISSIVA e REMISSIVA_QUEBRADA; os testes anteriores citam os elementos, para continuarem isolados.
- `tests/regressao-docx.test.ts`: "Texto entre listas; ver a Tabela 1." no XML; instantâneo revisto (diff só da remissiva).
- `e2e/remissiva.spec.ts` (FUN-18) e o axe da janela e da remissiva quebrada.
- `npm run verificar:tudo` (2026-11-08): saída 0. `verificar` 1906/1906; externos 27/27 (DOC-07 no LibreOffice, Word, OOXML); build ok; Playwright 34/34.

**Não testado / pendente:**
- Recortar e colar dentro do app perde a ligação da remissiva (vira texto), como já acontece com a tabela (pendência M5 do ADR-0007).
- O aviso de elemento sem remissiva aparece para quem escreve "Tabela 1" à mão: não há sugestão de ligar texto escrito, como existe para as citações.
- A posição do elemento "próximo ao trecho" (RN-060) não é conferida.

## M5-T09 — Gráfico gerado de tabela

**Feito pela sessão principal em 2026-11-08.**

**Implementado:**
- Formato: bloco `grafico` ligado à tabela (adendo do M5-T09 no ADR-0004); fixture `documento-bordas-m5.json` com dois gráficos, um de tabela excluída.
- Domínio: `dominio/visuais/grafico.ts`: leitura dos números no padrão brasileiro, dados da tabela, escala, tamanho e desenho em primitivas (colunas, barras, linhas, setores, legenda). Numeração "Gráfico n" na sequência dos gráficos com imagem; alvo de remissiva.
- Motor: `blocosGrafico` (título, imagem do PNG, rodapé); aviso `GRAFICO_NAO_DESENHADO` sem o PNG.
- Verificador: `GRAFICO_SEM_TABELA`, `GRAFICO_SEM_DADOS` (pendências) e `GRAFICO_PARCIAL` (aviso); título e fonte como a ilustração.
- Exportação: o renderer desenha os PNG a 300 ppi (`graficosParaExportar`) e manda nas opções; o principal confere forma, tamanho, id e PNG antes de usar.
- Sessão: a lista de elementos leva a tabela, e a revisão dela entra na chave: mudar a tabela redesenha os gráficos.
- Interface: `pintar-grafico.ts` (canvas, padrões e marcadores), `grafico-view.ts` (gráfico no texto), `DialogoGrafico.tsx` (tabela, forma, séries, prévia, título, largura, fonte, nota), botão "Gráfico", menu Inserir › Gráfico…. As cores do desenho ficam no domínio (`CORES_GRAFICO`): são do documento impresso, não da tela.

**Decisões por delegação (provisórias, na matriz):** D-M5-47 a 51.

**Achados ao validar:**
- Conferência visual dos quatro tipos exportados (colunas, barras, linhas, setores): a marca mais alta do eixo ficava cortada ao meio no topo nas colunas e nas linhas. Corrigido, com teste que impede texto fora da borda de cima.
- Duas regras do projeto pegaram desvios na primeira versão: a interface importava funções do domínio (passaram para `aplicacao/servicos/graficos.ts`) e havia cores escritas à mão na interface (foram para o domínio).
- Um clique no título logo depois de fechar a janela (menos de cerca de 300 ms) ainda deixa o gráfico recém-inserido selecionado por um instante, e o botão "Gráfico" abre "Alterar" em vez de "Inserir". Medido: não há tarefa longa nem redesenho a mais; é o tempo do editor ao receber o foco de volta. O mesmo vale para a figura. Fica anotado, sem correção.

**Testado:**
- `tests/grafico.test.ts` (novo, 30 testes) e o modelo do M5 com os gráficos na fixture.
- `e2e/grafico.spec.ts` (FUN-19): tabela de CSV, gráfico pela janela, mudar a tabela redesenha (aceite do RF-10), exportação com o PNG de 1772 px no DOCX. Axe da janela e do gráfico no texto.
- `npm run verificar:tudo` (2026-11-08): saída 0. `verificar` 1936/1936; externos 27/27; build ok; Playwright 36/36.

**Não testado / pendente:**
- O documento difícil do corpus (instantâneos, Word e LibreOffice) não ganhou gráfico: um gráfico de 9 cm mexeria na paginação que o DOC-07 confere. O PNG no DOCX passa pelo mesmo caminho da figura, já conferido no Word no M5-T06; o E2E confere o arquivo exportado.
- O texto do gráfico usa a fonte do trabalho, se instalada no Windows; sem ela, o canvas usa a serifada padrão.
- Gráfico com dezenas de categorias inclina os rótulos a 45°, mas não foi conferido visualmente com nomes longos.

