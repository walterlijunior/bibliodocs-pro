# Revisão de segurança, qualidade e fidelidade normativa — fechamento do marco M6

- **Data:** 2026-11-08
- **Escopo:** commits `114526a` (M6-T00) a `db37708`.
  - A maior parte (`e93fc35`) foi escrita pelo Codex na pasta de trabalho e consolidada pela sessão principal a pedido
    do usuário (`M6_RELATORIO_MARCO.md`, seção "Revisão e consolidação").
  - Esta revisão é a segunda passada, independente.
- **Executado por:** dois revisores independentes, rodados em paralelo como agentes gerais, só de leitura. As sondas
  ficaram fora do repositório e foram apagadas.
  - Segurança e integridade: seguiu `.claude/agents/revisor-seguranca.md`, com sondas no código real.
  - Fidelidade normativa: seguiu `.claude/agents/especialista-normas.md`. Releu as p. 42–46 e 64–66 do Manual como
    imagem.
- **Correções, testes e consolidação:** sessão principal (commits `9263edb`, `fd474d8` e `8a89c3b`).
- **Skill:** `revisao-seguranca-qualidade`.

## Resumo

| Revisão | Crítica | Alta | Média | Baixa | Info |
|---|---|---|---|---|---|
| Segurança e integridade (R-M6) | 0 | 2 | 3 | 4 | 3 |
| Normativa (N-M6) | 0 | 0 | 4 | 8 | 3 |

- **As duas Altas foram corrigidas** (R-M6-01 e R-M6-02). Nada bloqueia o fechamento.
- **Corrigidos:**
  - segurança: R-M6-01 a 09 e 11;
  - normas: N-M6-01, 02, 03, 07, 09, 13 e 15.
- **Decididos pela sessão principal por delegação (provisórios, na matriz):** N-M6-04 (D-M6-10), N-M6-05 (D-M6-11) e
  N-M6-08 (D-M6-12).
- **Abertos:**
  - segurança: R-M6-10 e 12;
  - normas: N-M6-06, 10, 11 (parcial), 12 e 14.

## Achados corrigidos

| ID | Sev. | Problema | Correção |
|---|---|---|---|
| R-M6-01 | **Alta** | O typecheck falhava no HEAD por causa de um teste do RN-047 escrito pela sessão principal, com tipo errado no título. O vitest passava, mas o portão do marco estava vermelho. [VERIFICADO pelo revisor] | Tipo corrigido. A sessão principal passou a rodar o typecheck antes de cada commit (falhas parecidas foram pegas depois, antes do commit) |
| R-M6-02 | **Alta** | A tela "Elementos pós-textuais" não estava ligada ao app: só um teste a usava. No app real não dava para incluir ou retirar apêndice, anexo ou glossário. O relatório a dava como entregue. [VERIFICADO pelo revisor] | Ligada na `AreaEscrever`, com incluir, retirar e ordenar, e Ctrl+Z na lista (ordem única). E2E novo (FUN-20) e axe. **O E2E achou mais um defeito:** o título do apêndice tinha duas fontes, o campo da tela e a linha de título do editor aberto, e o editor apagava o título digitado no campo. O título agora fica só na linha de título do editor, como nas seções |
| R-M6-03 | Média (latente) | Desfazer o passo estrutural dos pós-textuais trazia a lista inteira de volta, com os `blocos`. Se o passo de texto do apêndice se perdesse, o Ctrl+Z apagava em silêncio o texto digitado. [VERIFICADO pelo revisor] | O passo estrutural mantém o conteúdo atual dos apêndices que continuam no trabalho; só o elemento que volta traz os blocos guardados. O teste falha sem a correção (conferido) |
| R-M6-04 | Média | Gráfico dentro de apêndice saía sem imagem: o renderer e o principal percorriam só o corpo | Os dois lados percorrem também apêndices e anexos. Teste no canal |
| R-M6-05 | Média | A conferência do RN-047 era O(trechos × siglas). Um `.bdp` hostil congelava o processo principal ao gerar o relatório (5.000 siglas × 20.000 parágrafos: 2,6 s, e cerca de 50 s no máximo do formato) | Árvore de palavras com as formas já apresentadas, linear no texto: 5.000 siglas × 4.000 parágrafos em 43 ms. Uma expressão regular alternada foi tentada e era pior (25 s); ficou registrada no teste |
| R-M6-06 | Baixa | Título com quebra de linha forjava linhas no relatório `.txt` (uma "Resultado: 0 erro(s)" falsa antes da verdadeira) | Cada item vira uma linha só; quebras, tabulações e separadores Unicode viram espaço. Teste |
| R-M6-07 | Baixa | RN-047 sem limite de palavra: "Unidade" apresentada acusava "comunidade" | A árvore compara palavra inteira. Teste |
| R-M6-08 | Baixa | Renomear apêndice gravava a cada tecla | Resolvido pelo título único no editor (R-M6-02) |
| R-M6-09 | Baixa | Tabulação ou quebra no cadastro desalinhava as listas; lista incluída e vazia sumia sem aviso | Viram espaço no motor (texto e listas); aviso `LISTA_VAZIA` para as listas e o glossário vazios (também N-M6-15) |
| R-M6-11 | Info | Falha de gravação do relatório não ia para o log | Vai, como no DOCX |
| N-M6-01 | Média | Apêndice ou anexo sem título saía só "APÊNDICE A", sem aviso; o Manual pede "letra, travessão e título" (p. 65–66) | Aviso `POS_TEXTUAL_SEM_TITULO` na exportação |
| N-M6-02 | Média | Na citação longa (reprodução exata, Manual p. 22), o verificador sugeria mexer nas siglas, e o motor expandia a sigla ligada | A citação longa fica fora da conferência de siglas. Nela a sigla sai como está e não gasta a primeira ocorrência; continua contando para a lista |
| N-M6-03 | Média | A RN-096 não estava no perfil: os avisos de chamada ambígua e de narrativa com várias obras sumiam do relatório | RN-096 no perfil como verificação provisória (PENDENTE-FONTE, com as decisões do usuário D-M4-03 e 08). Teste: o aviso volta, marcado como provisório |
| N-M6-07 | Baixa | Avisos que vêm de decisão do projeto (D-M5-03, 10, 52…) saíam sem a marca de critério provisório | Toda origem `D-M…` sai como "critério provisório" no relatório (Política, 2.2). Teste |
| N-M6-09 | Baixa | O glossário usava o estilo do corpo, com recuo de 1,25 cm; o exemplo da p. 64, de onde veio a forma "Termo: definição", não tem recuo | Estilo "Entrada de glossário": o do corpo sem o recuo de primeira linha |
| N-M6-13 | Info | Numeral romano ("século XX") era apontado como sigla sem cadastro | Ignorado, a menos que esteja no cadastro. Teste |

## Decididos pela sessão principal por delegação do usuário

Os três são provisórios, estão na matriz e podem ser revistos.

| ID | Decisão |
|---|---|
| N-M6-04 → D-M6-10 | As listas de ilustrações, de tabelas e de siglas incluem o que está em apêndices e anexos, com numeração seguida (a leitura (i) do revisor). O Manual fala em "corpo do trabalho" e não trata dos apêndices |
| N-M6-05 → D-M6-11 | Sigla em nota de rodapé: nota e texto corrido contam a primeira ocorrência à parte. Assim a forma por extenso sempre aparece no texto corrido (Manual p. 18: "na primeira vez em que aparecerem no texto") |
| N-M6-08 → D-M6-12 | Apêndice e anexo com conteúdo começam em folha nova (a partir do segundo), para o conteúdo de um não emendar na identificação do seguinte |

## Achados abertos

- **R-M6-10 (Info):** a sugestão de ligar sigla volta a cada tecla depois de "Manter como texto", compara sem
  normalizar e não procura nas notas.
- **R-M6-12 (Info):** falta testar a trava `emCurso` comum ao DOCX e ao relatório.
- **N-M6-06 (Baixa):** a forma por extenso digitada logo antes da primeira sigla ligada não gera aviso.
- **N-M6-10 (Baixa):** procedimentos `tituloDaListaDeSiglas` (RN-166) e `siglaAposPrimeira` (RN-047) estão no perfil
  sem uso no código, e o alvo `lista.entrada` das RN-046/047 não é o do texto. O título da lista é fixo; o ajuste
  manual de C-B9 fica no Word.
- **N-M6-12 (Baixa, do usuário):** os títulos sem indicativo (listas, resumo, apêndices) não têm espaço depois, e os
  exemplos do Manual mostram espaço. Decidir se a D-M3-02 (18 pt antes e depois nos títulos de seção) vale também para
  eles. Muda todas as folhas pré-textuais, então fica para o usuário.
- **N-M6-14 (Info):** não há ajuda contra cadastrar abreviaturas comuns ("cm"), que a p. 44 manda não listar.
- **N-M6-11 (Baixa, parcial):** notas do M6 acrescentadas na matriz para as RN de siglas, símbolos, glossário e
  apêndices. Os status continuam CONFIRMADA, como no resto da matriz.

## Medições

| Medida | Resultado |
|---|---|
| Exportar 150 páginas com 50 tabelas, 50 figuras, listas de ilustrações, tabelas e siglas e sumário | 4,9 a 5,3 s (meta: 10 s). O documento não tem gráficos nem equações: não é diretamente comparável aos 7,3–9,0 s do M5 |
| `avaliarConformidade` em 150 páginas com 5.000 siglas (revisor) | 181 ms, antes da correção do R-M6-05 |
| Uma tecla na sessão, no corpo e em apêndice (revisor) | 0,2 ms |
| `npm audit --omit=dev` | 0 vulnerabilidades |

## Conferido e correto (resumo)

- **Formato:**
  - ids únicos, também entre cadastros e blocos de apêndices;
  - esquemas estritos;
  - sigla e remissiva para o nada viram pendência, sem exceção.
- **Canal do relatório:** remetente, pacote validado no principal, destino só pelo diálogo, `.txt`, gravação atômica.
- **DOCX:** texto escapado; marcadores curtos e válidos para o Word; PAGEREF só para marcadores do motor.
- **Normas:**
  - títulos e folha própria das quatro listas;
  - entradas "Quadro 1 – Título" com pontilhado e página, na ordem do texto;
  - listas por espécie a partir de 5 (C-B8);
  - siglas "Universidade Federal do Tocantins (UFT)" e depois "UFT", com a lista ordenada só com as usadas (Fig. 14);
  - símbolos pelo significado (Fig. 15);
  - glossário "Termo: definição";
  - apêndices e anexos como na C-B17;
  - ordem dos pré-textuais (RN-113);
  - fontes das 14 regras novas do perfil iguais às da matriz.

## Não verificado

- Páginas reais das listas no LibreOffice além do que o DOC-07 confere (o Word confere as 4 entradas do corpus).
- Latência de digitação em apêndice longo, medida no React e no DOM: a sessão é barata.
- NBR 6027, 6034 e 14724: não estão no projeto.

## Comandos executados (em `app/`)

- `npx vitest run` → 2055/2055; `npm run typecheck` → sem erros.
- `npm run verificar:tudo` → interrompido pelo sistema por falta de memória na máquina (não é falha de teste). Passaram antes da interrupção: typecheck, `verificar` 2055/2055 (auditoria só com avisos moderados), externos 28/28 (Word, LibreOffice, OOXML) e build. A suíte E2E (39 testes) foi parada no início; FUN-20 e o axe novo passaram rodados sozinhos. **Falta reexecutar o E2E completo**.
