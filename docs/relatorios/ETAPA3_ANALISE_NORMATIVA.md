# Relatório técnico — Etapa 3: Análise normativa

- **Data:** 2026-10-15
- **Autor:** sessão principal (integração e conferência), com três instâncias do agente `especialista-normas`
  em paralelo: frente A (Manual p. 1–29), frente B (Manual p. 30–73) e frente C (Norma Tabular do IBGE)
- **Escopo:** Manual de Normalização da UFT (2. ed., 2022) inteiro; *Normas de apresentação tabular* do IBGE
  (3. ed., 1993) inteira. Cruzamento com os 6 modelos UFT 2022, o guia FURB de ilustrações e tabelas, o
  estudo Capcom (só apresentação) e o código antigo auditado na Etapa 2. Ficaram de fora as normas ABNT, que
  não estão no projeto. As regras que dependem delas ficaram `PENDENTE-FONTE`. Nenhum arquivo de `materiais/` foi alterado.

## Resumo executivo

A matriz `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md` passou de 17 para **312 regras** (RN-001 a RN-312), todas
com fonte (documento, página impressa, seção), critério de validação automática e status:

| Status | Na entrega da análise | Após as decisões do usuário (2026-10-15) |
|---|---|---|
| CONFIRMADA | 245 | 283 |
| AMBÍGUA | 28 | 5 |
| PENDENTE-FONTE | 23 | 24 |
| CONFLITO | 16 | 0 |

(RN-182 passou de AMBÍGUA a PENDENTE-FONTE: o comportamento foi decidido, mas a regra definitiva depende da NBR 6023.)

As 17 regras da semente foram reconferidas: 6 mantidas e 11 corrigidas. RN-006 e RN-009 foram desmembradas;
RN-011 e RN-015 passaram a AMBÍGUA. **20 conflitos e ambiguidades** mudavam o resultado visível e foram
levados ao usuário, cada um com recomendação. Em 2026-10-15 o usuário **aceitou todas as recomendações**,
com escolhas próprias em três pontos (seção "Decisões do usuário"). O principal é o C-01 (NBR 10520:2002 × 2023 nas chamadas de
citação). Outros 7 foram resolvidos sem decisão editorial. As perguntas de fonte somam 43
(P-01–P-18, PF-01–PF-15, P-C1–P-C10) e dependem de normas ABNT, do CONMETRO ou de orientação da UFT.

## Método

1. Extração com `pdftotext -enc UTF-8 -layout` para `analise/normas_txt/` (marcadores de página do PDF
   inseridos por script) e conversão dos 7 `.doc` com LibreOffice (`soffice --headless --convert-to docx`,
   depois `txt`) para `analise/modelos_docx/` e `analise/modelos_txt/`.
2. Três frentes paralelas do `especialista-normas`, cada uma gravando um parcial próprio em `analise/etapa3/`,
   com IDs provisórios (A-, B-, T-).
3. Integração pela sessão principal: renumeração automática para RN-018 em diante, com troca das referências
   cruzadas (mapa em `analise/etapa3/mapa_ids.txt`). Também houve conferência mecânica: 312 linhas, 7 colunas,
   fonte preenchida e IDs contínuos. Por fim, a sessão principal resolveu as remissões entre frentes
   (RN-044, RN-045, RN-066), corrigiu uma referência quebrada (RN-029 citava um ID inexistente; correto: RN-107)
   e consolidou as duplicatas C-A1 = C-C5 e C-A3 = C-C1.
4. **Amostragem.** Frente A: 31 de 92 linhas (34 %) relidas na imagem da página, além das 17 da semente.
   Frente B: 41 de 131 (31 %). Frente C: mais de 45 de 72. Sessão principal: Manual p. 17–20 (Quadro 1,
   2.7–2.9; confirma C-A1, C-A3 e RN-055) e IBGE p. 18 impressa (sinais convencionais; RN-262/RN-263 conferem
   com a imagem) [VERIFICADO].

**Limitações:**
- A p. 18 impressa do IBGE não tem camada de texto; foi lida na imagem.
- O Quadro 1 do Manual sai embaralhado no `.txt` e foi lido na imagem.
- No Anexo B do IBGE a relação página impressa × PDF muda.
- O critério "norma × exemplo" (anotações das figuras contam como norma) foi adotado pelas frentes e validado
  pela sessão principal, mas várias ambiguidades dependem dele.

## Resultados

| Faixa | Origem | Regras | Destaques |
|---|---|---|---|
| RN-001–017 | Semente revisada | 17 | RN-017: recuo de 8 cm confirmado pela Fig. 5 (p. 34); RN-007 omitia a lista de tabelas |
| RN-018–109 | Manual p. 1–29 (frente A) | 92 | Papel, alíneas, espaçamentos, siglas, ilustrações, paginação, citações (8 em CONFLITO por C-01), notas, equações |
| RN-110–240 | Manual p. 30–73 (frente B) | 131 | Estrutura por tipo de trabalho, capa a sumário, 55 regras de referências (19 transversais + 36 por tipo), pós-textuais, entrega |
| RN-241–312 | IBGE + Manual (frente C) | 72 | Moldura (tabela aberta, sem traços laterais), cabeçalho, sinais convencionais, fonte, notas, tabela em mais de uma página |

O Manual define estrutura só para monografia/TCC, artigo como TCC, dissertação e tese (Quadro 5, p. 30–31).
Para **relatório técnico e projeto de pesquisa** não há estrutura no Manual: os elementos ficam PENDENTE-FONTE
e os modelos UFT servem só de referência (tabela "Ordem dos elementos" na matriz).

## Riscos e problemas encontrados

| ID | Descrição | Severidade | Evidência | Encaminhamento |
|---|---|---|---|---|
| N-1 | Chamadas de citação bloqueadas até decidir a edição da NBR 10520 | Alta | C-01; Manual p. 11, 17, 22, 70; README antigo | **Resolvido 2026-10-15:** NBR 10520:2002 como padrão; motor configurável |
| N-2 | Manual internamente inconsistente em pontos visíveis: secundária, título de tabela, resumo, palavras-chave, folha de aprovação | Média | C-A2, C-A3, C-B4, C-B5, C-B7 | **Resolvido 2026-10-15** (decisões registradas); vira parâmetro de perfil |
| N-3 | Normas ABNT ausentes (6023, 6024, 6027, 6028, 6034, 10520, 10719, 12225, 14724, 15287) | Média | Seção "Pendentes de fonte" da matriz | Usuário fornece trechos ou aceita configuração provisória visível |
| N-4 | Modelos UFT divergem do Manual: título de ilustração e resumo em 1,5, fonte centralizada, hífen no lugar do travessão, traços internos em tabelas, "grau de Mestre" no modelo de Tese | Baixa (são exemplos) | Apêndices A §Divergências, B D-01–D-15, C §Divergências | O app segue o Manual; não usar modelos como gabarito de teste |
| N-5 | O código antigo diverge em pontos já previstos pela auditoria: recuo 1,27 cm, nível 1 centralizado, tabela com grade completa, sem "et al." nas referências, sumário só até o nível 4 | Informativo | Apêndice B D-K1–D-K17; Apêndice C | Reforça a recomendação da Etapa 2 (não evoluir o código no lugar) |
| N-6 | IBGE sem texto extraível na p. 18 impressa | Baixa | Apêndice C, problema 1 | Regras transcritas da imagem e conferidas pela sessão principal |

## Recomendações

1. ~~O usuário decide os conflitos~~ — feito em 2026-10-15 (seção "Decisões do usuário").
2. Na Etapa 4, o motor normativo nasce **configurável por perfil**: cada conflito vira parâmetro com o valor
   escolhido como padrão do perfil "UFT 2022".
3. Regras PENDENTE-FONTE indispensáveis (ex.: recuos de alínea, espaço da citação longa) entram como
   configuração provisória visível, conforme a política (regra 2.2).

## Decisões do usuário (2026-10-15)

O usuário aceitou todas as recomendações do relatório, com estas escolhas próprias:

| Item | Decisão | Efeito visível | Linhas |
|---|---|---|---|
| P-C3 — separador de milhares | **Ponto**: "117.960.301" | Números das tabelas com ponto, como nos modelos UFT (o IBGE usa espaço) | RN-261 (valor de perfil; a Resolução do CONMETRO segue ausente) |
| C-B15 — referência de monografia/dissertação/tese | **Universidade, Programa** | "... – Universidade Federal do Tocantins, Programa de Pós-Graduação em ..., Palmas, 2020." | RN-206 |
| C-B17 — apêndices e anexos | **Título geral centralizado; identificação à esquerda** | "APÊNDICE" centralizado e, abaixo, "APÊNDICE A – Título" alinhado à esquerda | RN-237 |

Recomendações aceitas e o valor que cada uma fixou:
- **C-01:** perfil UFT 2022 segue a NBR 10520:2002, como o Manual; a forma 2023 é opção provisória.
- **C-A1:** título de ilustração e tabela em 12.
- **C-A2:** seção secundária em minúsculas e negrito.
- **C-A3:** título da tabela centralizado.
- **C-A4:** fonte rente à borda da ilustração.
- **C-A5:** separador "–" entre número e título.
- **C-B2:** capa com local e ano em caixa mista e negrito.
- **C-B3:** ficha catalográfica em página própria, contada na paginação.
- **C-B4:** folha de aprovação em caixa mista e negrito.
- **C-B5:** resumo em espaço simples.
- **C-B6:** resumo de 150 a 500 palavras.
- **C-B7:** até 4 palavras-chave, com aviso.
- **C-B8:** listas próprias por tipo a partir de 5 ilustrações.
- **C-B11:** folha de aprovação opcional no relatório técnico.
- **C-B12:** "et al." configurável.
- **C-B16:** negrito no veículo da legislação.
- **C-C3:** fonte da tabela obrigatória.
- **C-C4:** fonte da tabela em autor-data.
- **P-C1:** IBGE 1993 como edição de referência.
- **P-C2:** conteúdo da tabela em 10 pt, espaço simples.
- **P-C4:** números alinhados à direita.
- **P-C5:** título sem ponto final.
- **P-C10:** sem traços internos; zero absoluto como "–".
- **Recomendações das frentes:** RN-042, 059, 103, 302 e 308.

Registro na matriz: 46 linhas alteradas, com a nota "Decisão do usuário 2026-10-15" nas Observações.
As linhas sem norma no projeto (RN-182, 261, 310, 311, 312) continuam `PENDENTE-FONTE`. Nelas a decisão vale
como configuração provisória visível (política, regra 2.2).

## Pendências e perguntas ao usuário

Restam 5 ambiguidades não bloqueantes (RN-025, 033, 073, 085, 108), listadas na matriz em "Ambiguidades
remanescentes". Restam também 24 linhas PENDENTE-FONTE (seção "Pendentes de fonte"). As perguntas exatas estão nos
apêndices: A §PENDENTE-FONTE (P-01–P-18), B §PENDENTE-FONTE (PF-01–PF-15) e C §Perguntas ao usuário (P-C1–P-C10).

## Arquivos produzidos/alterados

- `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md` (reescrita: 312 regras, ordem dos elementos, conflitos, pendências)
- `docs/relatorios/ETAPA3_ANALISE_NORMATIVA.md` (este relatório)
- `docs/ESTADO_DO_PROJETO.md`, `CHANGELOG.md`, `tests/artefatos_futuros.txt`
- Em `analise/` (ignorada pelo git, recriável): `normas_txt/`, `modelos_docx/`, `modelos_txt/`, `etapa3/`

---

Os apêndices abaixo são os parciais das três frentes, com os IDs já renumerados para RN-xxx. Os IDs de
conflito (C-A*, C-B*, C-C*) e de pergunta (P-*, PF-*, P-C*) foram mantidos.

## Apêndice A — Frente A — Manual UFT, p. 1–29 (RN-018–RN-109)


**Autor:** especialista-normas (frente A). **Data:** 2026-10-15.
**Escopo:** páginas impressas 1–29 do Manual (M). O capítulo 5 (estrutura) começa na p. 30
[VERIFICADO p. 9, sumário; p. 30, cabeçalho]; dali em diante é a frente B. Exceções pontuais fora
do escopo: p. 31 (nota 3, conflito C-02) e p. 34 (Figura 5, recuo da natureza do trabalho, ligado a RN-017).

**Convenções**
- Fonte: "M, p. X, seção Y". A página impressa coincide com a do PDF em todas as páginas
  conferidas (15–29, 31, 34) [VERIFICADO: número no canto superior direito de cada imagem].
- Twips: 1 cm = 567. 1,25 cm = 709; 4 cm = 2268; 8 cm = 4536; 3 cm = 1701; 2 cm = 1134.
  `w:sz` em meios-pontos (24 = 12 pt; 20 = 10 pt). `w:spacing w:line` com `lineRule=auto`: 240 = simples; 360 = 1,5.
- "(ex.)" em Observações = regra derivada **só de exemplo do próprio Manual** (o texto normativo não a
  enuncia). Exemplos consistentes geram `CONFIRMADA` com essa marca; exemplos inconsistentes geram `AMBÍGUA`.
- Modelos UFT (`analise/modelos_docx/`) = nível 4; código antigo (CA-xx, relatório da Etapa 2 §4) = nível 5.
- Por decisão da matriz semente, nenhuma regra de **chamada de citação** fica `CONFIRMADA` enquanto C-01
  não for decidido: essas linhas estão como `CONFLITO`.

---

### Revisão de RN-001..RN-017

| ID | Situação | Alteração proposta |
|---|---|---|
| RN-001 | corrigida | Texto da p. 15 conferido [VERIFICADO p. 15]. Ajustar a redação: "10 para citações com mais de três linhas, notas de rodapé e **legenda** das ilustrações, tabelas e quadros". O **título** da ilustração não está claramente incluído: a anotação do exemplo da p. 19 diz "Título da figura tamanho 12" e "Fonte da figura tamanho 10". Separar em: RN-001 (Times/Arial; 12 no texto; 10 em citação longa e notas), RN-021 (título de ilustração, AMBÍGUA, C-A1) e RN-022 (fonte/legenda/nota da ilustração = 10). Acrescentar observação: o código antigo só oferece Times New Roman (CA-02); o Manual admite Arial |
| RN-002 | mantida | Conferida [VERIFICADO p. 15]. Validação ok (1701/1701/1134/1134). Acrescentar a observação de que o A4 vem de RN-018 (p. 21) |
| RN-003 | mantida | Conferida [VERIFICADO p. 15; Quadro 1, p. 17, linha "Texto"]. Acrescentar observação: o código antigo gera 1,27 cm (CA-04); os modelos usam 709 (ok) |
| RN-004 | corrigida | Conferida [VERIFICADO p. 15, 16, 17, 22]. Acrescentar "sem aspas" (p. 22, 3.1 b) — ver RN-086. A fonte deve citar também "p. 22, seção 3.1 b". O espaço antes/depois do bloco não está no Manual (ver RN-088 / PENDENTE-FONTE); os modelos usam 18 pt antes e depois |
| RN-005 | corrigida | Conferida [VERIFICADO p. 15]. Acrescentar a fonte "p. 28, cap. 4" (indicativo separado por um espaço, alinhado à esquerda). Validação concreta: regex `^\d+(\.\d+){0,4} \S` (um único espaço; sem ponto, hífen ou travessão depois do número) e `w:keepNext` no estilo |
| RN-006 | corrigida (desmembrar) | Agrupa sete regras distintas. Desmembrar em RN-029 a RN-036. Erros de redação: (1) o Manual diz "**sub**títulos" (2.6 e), não "títulos"; (2) a regra "uma linha antes da ilustração e outra após a legenda" (2.6 c) e o espaço simples das legendas (2.6 d) precisam ser linhas próprias; (3) referências em nota de rodapé (2.6 g) não estavam na semente |
| RN-007 | corrigida | A lista da p. 15 **não inclui "lista de tabelas"** (inclui: errata, agradecimento, lista de ilustrações, lista de abreviaturas e siglas, lista de símbolos, resumo, abstract, sumário, referências, glossário, apêndice(s), anexo(s), índice(s)) [VERIFICADO p. 15]. Trocar "listas" pela enumeração exata e tratar lista de tabelas em RN-044 (AMBÍGUA, por analogia). Acrescentar fonte "p. 28" (agradecimento, resumo, referências, índice, apêndices, anexos sem indicativo) |
| RN-008 | corrigida | Acrescentar a fonte "p. 28, cap. 4": "As seções primárias devem iniciar em folhas distintas" (em negrito no original) [VERIFICADO p. 28]. A Obs. da p. 15 fala em "capítulo"; a p. 28 em "seção primária" — mesma regra |
| RN-009 | corrigida (desmembrar) | Desmembrar em RN-023 a RN-027. Ponto novo: a expressão "letras dobradas" é AMBÍGUA (aa, bb… ou aa, ab…) — RN-025. O texto diz "travessão" para subalíneas, mas o exemplo da p. 16 mostra hífen (-) — observação em RN-026. Recuos de alínea/subalínea não são dados em valores (RN-027, PENDENTE-FONTE) |
| RN-010 | mantida | Conferida [VERIFICADO p. 17, Quadro 1; p. 28]. Observação: o código antigo centraliza o nível 1 (CA-06) — desvio |
| RN-011 | corrigida → AMBÍGUA | Quadro 1 (p. 17): "Minúsculo em negrito". P. 28 (exemplo do cap. 4): "1.1, 1.2 … **Maiúsculo e negrito**". Ver C-A2. Recomendação: manter minúsculas em negrito (Quadro 1 + exemplo da p. 29 + modelo de TCC) |
| RN-012 | mantida | Conferida [VERIFICADO p. 17; p. 28: "Minúsculo e normal"] |
| RN-013 | mantida | Conferida [VERIFICADO p. 17; p. 28: "Minúsculo e itálico"] |
| RN-014 | mantida | Conferida [VERIFICADO p. 17; p. 28: "Minúsculo e sublinhado"]. No Quadro 1 e na p. 28 o sublinhado também alcança o indicativo numérico (ver RN-042) |
| RN-015 | corrigida (desmembrar; ambiguidade resolvida em parte) | O texto da 2.8 (p. 18) só diz "parte superior"; o alinhamento vem do Quadro 1 ("Títulos das ilustrações das tabelas — centralizada — simples"). Todos os exemplos de ilustração do Manual têm título **centralizado** sobre a ilustração (Figuras 1 e 2, p. 19; Quadros 1–4, p. 17, 20, 24) [VERIFICADO nas imagens], e os modelos UFT também (`jc=center`). **Ilustrações: centralizado → CONFIRMADA (RN-055).** **Tabelas: os exemplos da p. 20 (reproduções do IBGE) trazem título à esquerda com recuo deslocado**, o que contradiz o Quadro 1 → CONFLITO C-A3, dependente da frente C (IBGE). **Fontes/legendas: "esquerda"** (Quadro 1), mas a borda de referência é AMBÍGUA (C-A4). A "observação de que os modelos mostram legenda acima à esquerda" na semente não se confirma: nos 6 modelos UFT o título está centralizado [VERIFICADO XML]. Desmembrar em RN-021, RN-022, RN-032, RN-051–RN-059, RN-065, RN-066 |
| RN-016 | mantida | Conferida [VERIFICADO p. 15, 16, 17, 26]. Acrescentar a fonte "p. 26, seção 3.4" (fonte 10). Chamada sobrescrita e posição em RN-102/RN-103 |
| RN-017 | corrigida | Conferida [VERIFICADO p. 17, 2.6 h]. A expressão "do meio da folha" é esclarecida pela anotação da Figura 5, p. 34 (fora do escopo; a frente B deve confirmar): "alinhada a partir do meio da área do texto para a margem direita (**recuo de 8 cm da margem esquerda**), em espaço simples de entrelinhas e justificado" [VERIFICADO p. 34]. Validação: `w:ind w:left/start=4536`, `w:jc=both`, `w:sz=20`, `w:line=240`. Os modelos UFT usam 4536 [VERIFICADO XML], e o código antigo usa 8 cm (CA-15) — coerentes |

---

### Regras novas

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-018 | Papel formato A4 (210 × 297 mm) | M, p. 21, seção 2.11 | Todos | `w:pgSz w:w=11906 w:h=16838` | CONFIRMADA | CA-01 e modelos coerentes |
| RN-019 | Texto na cor preta, exceto ilustrações | M, p. 21, seção 2.11 | Todos | `w:color` ausente, `auto` ou `000000` em runs fora de desenhos/ilustrações | CONFIRMADA | O modelo de TCC define o estilo Hyperlink em azul (`0000FF`), um desvio quando houver URL no texto. Os cabeçalhos coloridos dos Quadros 1, 3 e 4 do Manual são ilustração (permitido) |
| RN-020 | Papel branco | M, p. 21, seção 2.11 | Impressão | Sem `w:background` de cor no documento | CONFIRMADA | Só para impressão. TCC de graduação e especialização são entregues em formato digital (RN-075) |
| RN-021 | Corpo do **título** da ilustração: 12 (anotação do exemplo) × 10 (leitura ampla de "legenda" na 2.1) | M, p. 15, seção 2.1; p. 19, exemplo (anotação "Título da figura tamanho 12") | Ilustrações e tabelas | `w:sz` do parágrafo de título = 24 (leitura A) ou 20 (leitura B) | AMBÍGUA | Ver C-A1. Modelos: 24 (12 pt). Código: 10 (CA-09) |
| RN-022 | Fonte, legenda e notas abaixo da ilustração ou tabela em corpo 10 | M, p. 15, seção 2.1; p. 19, anotação "Fonte da figura tamanho 10" | Ilustrações e tabelas | Parágrafos iniciados por `Fonte:`/`Nota`/`Legenda` com `w:sz=20` | CONFIRMADA | Modelos: 20 [VERIFICADO XML]. Código: 10 (CA-10) |
| RN-023 | Alíneas indicadas por letra minúscula seguida de parêntese: "a)" | M, p. 16, seção 2.5 (cita NBR 6024:2012) | Texto | Regex `^[a-z]{1,2}\) ` no início do item | CONFIRMADA | O modelo de TCC usa listas com marcador e listas numeradas "1." em instruções (desvio do modelo, não norma) |
| RN-024 | Texto da alínea começa com minúscula e termina com ponto e vírgula; a última alínea termina com ponto final | M, p. 16, seção 2.5 | Texto | Regex: item `^[a-z]{1,2}\) [a-zà-ú]`; final `;` e, no último item, `\.` | CONFIRMADA | Verificação de pontuação = aviso (o conteúdo é do autor) |
| RN-025 | Esgotado o alfabeto, usar "letras dobradas" | M, p. 16, seção 2.5 | Texto | Sequência de rótulos após `z)` | AMBÍGUA | Leituras: (i) `aa), bb), cc)`; (ii) `aa), ab), ac)`. O Manual não exemplifica. Remete à NBR 6024:2012 (PENDENTE-FONTE P-03) |
| RN-026 | Subalíneas: travessão seguido de espaço; recuo em relação à alínea; texto com minúscula e ponto e vírgula; a última termina com ponto final | M, p. 16, seção 2.5 | Texto | Regex `^[–—-] [a-zà-ú]`; `w:ind w:left` da subalínea > `w:ind w:left` da alínea | CONFIRMADA | Glifo: o texto diz "travessão", mas o exemplo da p. 16 mostra hífen "-" [VERIFICADO imagem p. 16]. Decidir junto com C-A5 |
| RN-027 | Valores de recuo das alíneas e subalíneas | M, p. 16, seção 2.5 (só exemplo) | Texto | `w:ind` de listas | PENDENTE-FONTE | No exemplo, a letra da alínea fica no recuo de parágrafo (~1,25 cm) com o texto deslocado (ex.). Sem valor normativo. P-03 |
| RN-028 | Assuntos sem título próprio dentro de uma seção são divididos em alíneas; acima da quinária, usar alíneas | M, p. 16, seção 2.5; p. 28, cap. 4 | Texto | Profundidade de título ≤ 5 (ver RN-041) | CONFIRMADA | — |
| RN-029 | Entrelinha 1,5 no corpo do texto | M, p. 16, seção 2.6 a; p. 17, Quadro 1 | Texto | Estilo de corpo: `w:spacing w:line=360 w:lineRule=auto` | CONFIRMADA | Parte de RN-006. Exceção: equações (RN-107) |
| RN-030 | Entrelinha simples em citações diretas longas, notas de rodapé, resumo, abstract e natureza do trabalho | M, p. 16, seção 2.6 b; p. 17, 2.6 h | Citações, notas, resumo, folha de rosto | `w:line=240` nesses estilos | CONFIRMADA | Parte de RN-006. O modelo de TCC usa `line=360` no parágrafo do RESUMO [VERIFICADO XML] — desvio do modelo; a frente B deve confirmar na seção 5.9 |
| RN-031 | Deixar uma linha em branco antes da ilustração/tabela/quadro e outra depois da legenda | M, p. 16, seção 2.6 c | Ilustrações e tabelas | Parágrafo vazio, ou `w:spacing w:before` no título e `w:after` no último parágrafo (fonte/nota), ≥ uma linha | CONFIRMADA | "Legenda" aqui designa o bloco abaixo da ilustração (fonte/nota), coerente com o Quadro 1 [interpretação]. A altura da "linha" (simples ou 1,5) não é dita; recomenda-se uma linha de 1,5 do texto [HIPÓTESE] |
| RN-032 | Título, fonte e legenda de ilustrações e tabelas em entrelinha simples | M, p. 16, seção 2.6 d; p. 17, Quadro 1; p. 19, anotações "Espaço simples" | Ilustrações e tabelas | `w:line=240` nos estilos de título e de fonte | CONFIRMADA | **Modelos UFT: título com `line=360` (1,5)** [VERIFICADO XML, modelos 2–7] — desvio do modelo |
| RN-033 | Espaço de 1,5 entre o subtítulo e o texto que o precede e o que o sucede | M, p. 16, seção 2.6 e | Títulos | `w:spacing w:before/w:after` dos estilos de título | AMBÍGUA | Leituras: (i) uma linha em branco de 1,5 antes e depois (≈ `before=after=360` com texto de 12 pt); (ii) apenas a entrelinha 1,5, sem linha extra. O próprio Manual (p. 15–28) mostra uma linha em branco entre título e texto, o que apoia (i). O texto diz "subtítulos": aplicar também à seção primária? [HIPÓTESE: sim]. Modelo de TCC: `before=after=0` nos títulos — desvio, se valer (i) |
| RN-034 | Referências no fim do trabalho: alinhadas só à margem esquerda, entrelinha simples, separadas entre si por uma linha em branco simples | M, p. 17, seção 2.6 f; Quadro 1 | Referências | `w:jc=left/start` (não `both`); `w:line=240`; `w:after=240` ou parágrafo vazio de 240 | CONFIRMADA | Aqui só a forma. O conteúdo das referências é da frente B (5.19). CA-17 coerente |
| RN-035 | Referências em nota de rodapé: da 2.ª linha em diante, alinhadas sob a primeira letra da primeira palavra (destacando o expoente), sem espaço entre elas | M, p. 17, seção 2.6 g | Notas de rodapé | Nota: `w:ind w:hanging` = largura do número + espaço; `w:after=0` | CONFIRMADA | A largura exata do recuo depende do número (1 ou 2 dígitos); o validador mede o alinhamento, não um valor fixo |
| RN-036 | Agradecimentos e dedicatória: entrelinha 1,5, corpo 12, Times New Roman ou Arial, texto justificado | M, p. 17, "Outras orientações importantes" | Agradecimentos, dedicatória | `w:line=360`, `w:sz=24`, `w:jc=both` | CONFIRMADA | **Modelo de TCC:** a instrução manda a dedicatória "em itálico, alinhada à direita, na base da página", com recuo de 8 cm [VERIFICADO txt/XML] — desvio do modelo. A frente B deve cruzar com 5.7/5.8 (p. 38–39) |
| RN-037 | Epígrafe: pode aparecer no pré-textual e/ou no início dos capítulos e segue a norma de citação (NBR 10520:2002) | M, p. 17, "Outras orientações importantes" | Epígrafe | — | PENDENTE-FONTE | A forma de apresentação (posição na folha, recuo, corpo, chamada) não é dada; a remissão é à NBR 10520. Também depende de C-01. P-04 |
| RN-038 | Indicativo numérico das seções em algarismos arábicos | M, p. 28, cap. 4 | Títulos numerados | Regex `^\d+(\.\d+){0,4}` | CONFIRMADA | — |
| RN-039 | Seções primárias 1, 2, 3; secundárias 1.1; terciárias 1.1.1; quaternárias 1.1.1.1; quinárias 1.1.1.1.1 — numeração progressiva | M, p. 28, cap. 4 (cita NBR 6024:2012) | Títulos numerados | Sequência sem saltos: o filho de `n` começa em `n.1`; renumeração automática | CONFIRMADA | Código antigo reordena (abnt.js `reordenarNumeracao`) [VERIFICADO] |
| RN-040 | Indicativo e título das seções em corpo 12 | M, p. 28, cap. 4 ("fonte tamanho 12") | Títulos | `w:sz=24` nos estilos Título 1–5 | CONFIRMADA | Nos modelos UFT, os estilos de título definem 14–16 pt, mas os parágrafos sobrescrevem para 12 [VERIFICADO XML]; o app deve definir 12 no estilo |
| RN-041 | Não ultrapassar a seção quinária | M, p. 28, cap. 4 | Títulos | `w:outlineLvl` ≤ 4 (5 níveis) | CONFIRMADA | Sumário do modelo: até 4 níveis (CA-16 também) |
| RN-042 | O indicativo numérico recebe o mesmo destaque tipográfico do título (negrito, itálico, sublinhado) | M, p. 28, exemplo; p. 17, Quadro 1 (sublinhado em "5.1.1.1.1") | Títulos | Runs do número com as mesmas `w:b`/`w:i`/`w:u` do título | AMBÍGUA | (ex.) O texto só diz que "os títulos" são destacados; os exemplos aplicam o destaque também ao número (p. 28: "1.1" em negrito, "1.1.1.1" em itálico, "1.1.1.1.1" sublinhado). Recomendação: aplicar ao número (os estilos de título do Word fazem isso naturalmente) |
| RN-043 | "Minúsculo" nos títulos secundário a quinário = só a inicial maiúscula (mais nomes próprios), sem caixa alta integral | M, p. 17, Quadro 1; p. 28–29, exemplos | Títulos 2–5 | Texto do título ≠ `upper()`; `w:caps` ausente | CONFIRMADA | (ex.) Exemplos: "Primeiro teste: ocupação inicial de disco" (p. 29). Depende de C-A2 para o nível 2 |
| RN-044 | Título "LISTA DE TABELAS" centralizado e sem indicativo | M, p. 15, seção 2.4 (por analogia) | Lista de tabelas | `w:jc=center` | AMBÍGUA | A 2.4 enumera os títulos centralizados e omite a lista de tabelas. Quase certamente uma omissão [HIPÓTESE]. Recomendação: centralizar por analogia; a frente B verifica a Figura 13 (p. 43) |
| RN-045 | Destaque tipográfico (caixa alta/negrito) dos títulos sem indicativo numérico | M, p. 15, seção 2.4 (só alinhamento) | Pré/pós-textuais | `w:caps`/`w:b` nos estilos | PENDENTE-FONTE | A 2.4 define apenas a centralização. O exemplo da p. 29 (de NBR 6027) mostra "REFERÊNCIAS" em caixa alta e negrito. A frente B deve conferir as Figuras 9–16 (p. 39–46) antes de virar pergunta ao usuário. P-05 |
| RN-046 | Siglas e abreviaturas: na primeira ocorrência no texto, nome por extenso seguido da sigla entre parênteses | M, p. 18, seção 2.7 | Texto | Na 1.ª ocorrência de token `\b[A-Z][A-Za-z]{1,}\b` cadastrado como sigla: deve estar entre parênteses, depois da forma extensa | CONFIRMADA | Formato "Nome (SIGLA)" vem dos exemplos (ex.) |
| RN-047 | Nas ocorrências seguintes, usar só a sigla | M, p. 18, seção 2.7 | Texto | Aviso se a forma extensa reaparecer depois da definição | CONFIRMADA | Aviso, não erro (títulos e citações podem repetir a forma extensa) |
| RN-048 | Grafia das siglas (maiúsculas × só a inicial, ex.: "Unitins") | M, p. 18, nota 2 (remete ao Manual de Comunicação da Secom/Senado) | Texto | — | PENDENTE-FONTE | O Manual remete a um site de terceiros, que não é fonte aceita sem decisão do usuário. P-06 |
| RN-049 | Ilustrações incluem desenho, esquema, fluxograma, fotografia, gráfico, mapa, organograma, planta, quadro, retrato etc.; cada uma é identificada pela palavra designativa do seu tipo | M, p. 18, seção 2.8 | Ilustrações | Rótulo ∈ {Desenho, Esquema, Fluxograma, Fotografia, Gráfico, Mapa, Organograma, Planta, Quadro, Retrato, Figura, …} | CONFIRMADA | A lista é aberta ("etc."); o Manual usa "Figura" nos exemplos. CA-11 só oferece Figura/Quadro/Tabela/Gráfico — lacuna do código |
| RN-050 | Identificação da ilustração **na parte superior** | M, p. 18, seção 2.8 | Ilustrações | Parágrafo de título imediatamente antes do desenho/tabela | CONFIRMADA | Modelos: título acima [VERIFICADO XML]. A instrução em texto do modelo de TCC diz "legendas e fontes aparecem abaixo da figura" (linha 443 do txt) — contradição interna do modelo. CA-09 coerente |
| RN-051 | Identificação: palavra designativa + número de ordem em algarismos arábicos + travessão + título | M, p. 18, seção 2.8 | Ilustrações | Regex `^(Figura\|Quadro\|Gráfico\|…) \d+ – \S` (glifo conforme C-A5) | CONFIRMADA | Modelos: " - " (hífen) nos títulos; "." ou "-" nas listas; código: "—" (CA-09) |
| RN-052 | Numeração sequencial própria por tipo, em ordem de ocorrência, contínua no documento (não reinicia por capítulo) | M, p. 18, seção 2.8; p. 7–8 (listas de figuras 1–20 e quadros 1–5) | Ilustrações | Por rótulo, números 1..n na ordem do documento | CONFIRMADA | (ex.) A sequência separada por tipo vem das listas do próprio Manual |
| RN-053 | Glifo do "travessão" entre número e título | M, p. 18, seção 2.8; exemplos | Ilustrações e tabelas | Caractere U+2013 ou U+2014 | AMBÍGUA | Ver C-A5. Contagem no texto extraído: 42 ocorrências de "–" (U+2013) e 8 de "-" (hífen) depois de "Figura/Quadro n" [VERIFICADO] |
| RN-054 | Título da ilustração sem negrito e sem caixa alta | M, p. 17, Quadro 1 (sem formato especial); p. 19–20, 24, exemplos | Ilustrações | `w:b` ausente; texto não todo em maiúsculas | CONFIRMADA | (ex.) Modelos coerentes |
| RN-055 | Título da ilustração **centralizado** | M, p. 17, Quadro 1; p. 19–20, 24, exemplos | Ilustrações (não tabelas) | `w:jc=center` no parágrafo de título | CONFIRMADA | Resolve RN-015 para ilustrações. Modelos e código (CA-09) coerentes. Para tabelas, ver RN-066 |
| RN-056 | Após a ilustração, indicar a fonte consultada; obrigatória mesmo quando a ilustração é produção do próprio autor | M, p. 18, seção 2.8 | Ilustrações | Parágrafo imediatamente após o desenho/quadro iniciado por `Fonte:` | CONFIRMADA | O prefixo "Fonte:" é constante nos exemplos (ex.). A redação para produção própria não é dada (P-07); o código usa "Elaborado pelos autores." por padrão |
| RN-057 | Fonte e legenda alinhadas **à esquerda** | M, p. 17, Quadro 1 | Ilustrações e tabelas | `w:jc=left/start` | AMBÍGUA | A borda de referência é ambígua (margem × borda da ilustração): C-A4. **Modelos e código centralizam a fonte** (`jc=center`; CA-10) — desvio de ambos em relação ao Quadro 1 |
| RN-058 | Notas e outras informações necessárias, quando houver, vêm depois da fonte | M, p. 18, seção 2.8; p. 20, exemplo (Fonte → Nota) | Ilustrações e tabelas | Ordem: título → elemento → `Fonte:` → `Nota:`/`Legenda:` | CONFIRMADA | A ordem Fonte → Nota vem do exemplo (ex.); para tabelas, quem decide é o IBGE (frente C) |
| RN-059 | Ilustração posicionada centralizada na página | M, p. 19–20, exemplos | Ilustrações | `w:jc=center` no parágrafo do desenho/tabela | AMBÍGUA | O texto não fala do alinhamento do elemento; todos os exemplos o centralizam. Recomendação: centralizar (padrão) |
| RN-060 | Ilustração citada no texto e inserida próxima ao trecho a que se refere | — (o Manual não trata) | Ilustrações | Referência cruzada "Figura n" no texto antes do elemento | PENDENTE-FONTE | O guia da FURB (nível 5) traz essa regra citando a ABNT; o Manual UFT não a traz. P-08 |
| RN-061 | Quadro: formado por linhas horizontais e verticais, portanto **fechado** | M, p. 19, seção 2.8.1 | Quadros | `w:tblBorders` top/left/bottom/right/insideH/insideV ≠ `nil/none` | CONFIRMADA | Os cabeçalhos coloridos dos Quadros 1–4 do Manual são estilo de exemplo, não regra |
| RN-062 | Tabela: formada por colunas, linhas e células, portanto **aberta** | M, p. 20, seção 2.9 (remete a IBGE, 1993) | Tabelas | Bordas laterais externas `w:left/w:right = nil` (detalhes de traços: frente C) | CONFIRMADA | **CA-12 põe bordas em todas as células** — desvio. Detalhes de traços: frente C |
| RN-063 | Identificação da tabela na parte superior, precedida da palavra "Tabela" | M, p. 20, seção 2.9 | Tabelas | Parágrafo `^Tabela \d+` imediatamente antes de `w:tbl` | CONFIRMADA | — |
| RN-064 | Fonte da tabela abaixo dela, com prefixo "Fonte:"; nota depois da fonte | M, p. 20, exemplos (reprodução do IBGE) | Tabelas | Parágrafo `Fonte:` após `w:tbl` | CONFIRMADA | (ex.) Regra detalhada na Norma Tabular (frente C) |
| RN-065 | Corpo e entrelinha do título e da fonte da tabela iguais aos das ilustrações (RN-021, RN-022, RN-032) | M, p. 15 (2.1), p. 16 (2.6 d), p. 17 (Quadro 1) | Tabelas | idem RN-021/RN-022/RN-032 | CONFIRMADA | Sujeito a eventual divergência com o IBGE (frente C) |
| RN-066 | Alinhamento do título da tabela: centralizado (Quadro 1) × à esquerda, com recuo deslocado (exemplos IBGE da p. 20) | M, p. 17, Quadro 1; p. 20, exemplos | Tabelas | `w:jc` e `w:ind w:hanging` do título | CONFLITO | Ver C-A3. Depende da leitura da frente C na Norma Tabular |
| RN-067 | Todas as folhas, a partir da folha de rosto, são contadas (a capa não entra na contagem) | M, p. 21, seção 2.10 | Todos | `w:pgNumType w:start` da seção textual = n.º de folhas pré-textuais da folha de rosto em diante + 1 | CONFIRMADA | CA-05 coerente ("contagem desde a folha de rosto") |
| RN-068 | A numeração só aparece a partir da primeira folha textual (geralmente a introdução) | M, p. 21, seção 2.10 | Todos | Seções pré-textuais sem campo `PAGE` visível; a seção textual com `PAGE` no cabeçalho | CONFIRMADA | Modelos: as seções pré-textuais têm `fmt=lowerRoman`, mas os rodapés estão vazios (nada visível) [VERIFICADO XML] |
| RN-069 | Número da página no canto superior direito | M, p. 21, seção 2.10 | Todos | Cabeçalho (`w:hdr`) com campo `PAGE`, `w:jc=right/end` | CONFIRMADA | **CA-05 permite cabeçalho ou rodapé** — desvio. Modelos: cabeçalho, `jc=end` [VERIFICADO] |
| RN-070 | Número em algarismos arábicos, Arial ou Times New Roman, corpo 10 | M, p. 21, seção 2.10 | Todos | `w:pgNumType w:fmt=decimal`; run do `PAGE` com `w:sz=20` | CONFIRMADA | **Modelos: 12 pt** (herdado do Normal, sem `w:sz` no cabeçalho) [VERIFICADO XML] — desvio do modelo. CA-05: 10 (ok) |
| RN-071 | Contagem por "folhas" × páginas com impressão frente e verso (a ficha catalográfica fica no **verso** da folha de rosto, p. 34) | M, p. 21, seção 2.10; p. 34, seção 5.4 | Todos | Regra de contagem de RN-067 | AMBÍGUA | Leituras: (i) cada página do PDF conta (ficha = 1 página); (ii) só os anversos contam (ficha no verso não soma). Para entrega digital, (i) é o resultado visível usual [HIPÓTESE]. P-09 |
| RN-072 | Distância do número de página à borda superior/direita | — (o Manual não trata) | Todos | `w:pgMar w:header`; recuo direito do cabeçalho | PENDENTE-FONTE | Modelos: `header=709` (1,25 cm) [VERIFICADO]. P-10 |
| RN-073 | Numeração contínua até a última folha (referências, apêndices, anexos) | M, p. 21, seção 2.10 (implícito: "todas as folhas") | Pós-textuais | `PAGE` sem reinício (`w:start` ausente) nas seções pós-textuais | AMBÍGUA | Leitura literal sugere continuidade [HIPÓTESE]. A frente B confere os caps. 7–8 |
| RN-074 | TCC de graduação e de especialização entregues em formato digital | M, p. 21, seção 2.12 | TCC de graduação/especialização | Não se aplica ao DOCX (a exportação em PDF é o meio) | CONFIRMADA | Informativa: checklist de entrega |
| RN-075 | Dissertação: capa dura verde-escura com letras douradas; tese: capa dura vermelho-vinho com letras douradas | M, p. 21, seção 2.12 a–b | Dissertação, tese | Não automatizável | CONFIRMADA | Informativa: checklist de entrega |
| RN-076 | Depósito digital obrigatório no Repositório Institucional, na BDTD e na BDM; pré-requisito do nada consta | M, p. 21, seção 2.12 | Todos os trabalhos de conclusão | Não automatizável | CONFIRMADA | Informativa. A frente B cobre o cap. 10 (p. 68) |
| RN-077 | A citação é indicada pelo sobrenome do autor, pelo nome da instituição ou pelo título do documento | M, p. 22, cap. 3 | Citações | Chamada contém um desses elementos | CONFLITO | A grafia depende de C-01 |
| RN-078 | Toda citação no texto tem a referência completa na lista de referências | M, p. 22, cap. 3 | Citações/referências | Cruzamento chamada (autor+ano) × lista de referências; aviso para órfãs nos dois sentidos | CONFIRMADA | Independe da edição da NBR |
| RN-079 | Citação direta: reprodução exata do original, inclusive erros de ortografia e concordância | M, p. 22, seção 3.1 | Citações diretas | Não automatizável; o app não deve aplicar autocorreção ou revisão dentro de citação direta | CONFIRMADA | Afeta o recurso de revisão gramatical (pergunta 1 da Etapa 2) |
| RN-080 | Citação direta deve trazer o autor e a página citada | M, p. 22, seção 3.1 | Citações diretas | Chamada da citação direta contém `p\. \d` (ou equivalente) | CONFIRMADA | Ausência de página = erro. Formas para documentos sem paginação: P-11 |
| RN-081 | Citação direta de até três linhas: no corpo do texto, entre aspas duplas | M, p. 22, seção 3.1 a | Citações diretas curtas | Regex `“[^”]+”` no parágrafo de texto | CONFIRMADA | Exemplos com aspas curvas “ ”; **o código usa aspas retas `"`** (abnt.js `formatarCitacao`) [VERIFICADO] — desvio |
| RN-082 | Grafia do autor na chamada: entre parênteses, em caixa alta ("(SUDBRACK, 2001, p. 27)"); na chamada narrativa, só a inicial maiúscula ("Sudbrack (2001, p. 27)") | M, p. 22, seção 3.1 a (texto: "autor em caixa alta") + exemplos p. 22–26 | Chamadas | Regex parentética `\((\p{Lu}[\p{Lu} ]+)[,;]`; narrativa `\b\p{Lu}\p{Ll}+ \(\d{4}` | CONFLITO | C-01. O código usa Title Case entre parênteses (CA-19); o modelo de TCC usa caixa alta "(FULANO, 2003)" |
| RN-083 | Chamada parentética: (SOBRENOME, ano, p. X); narrativa: Sobrenome (ano, p. X) | M, p. 22–26, exemplos | Chamadas | Regex `\([^()]+, \d{4}[a-z]?(, p\. [\d\-]+)?\)` | CONFLITO | C-01 (estrutura provavelmente igual nas duas edições, mas não verificável sem a NBR 10520:2023) |
| RN-084 | Citação direta com mais de três linhas: sem aspas | M, p. 22, seção 3.1 b | Citações longas | Bloco com estilo de citação longa não começa nem termina com aspas | CONFIRMADA | Complementa RN-004. No exemplo, a chamada vem ao fim do próprio bloco "(NICHOLS, 1993, p. 181)." (ex.); o modelo de TCC admite a chamada no parágrafo anterior |
| RN-085 | Pontuação final da citação em relação às aspas e à chamada | M, p. 22–23, exemplos (inconsistentes) | Citações | Posição do ponto final | AMBÍGUA | Exemplos: "…Deus" (SUDBRACK, 2001, p. 27). (ponto só depois da chamada); "…sociedade." (SOUTO, 1916, p. 46). (ponto dentro e fora); "…dimensão. (NICHOLS, 1993, p. 181)." (citação longa). O Manual não enuncia regra. P-12 |
| RN-086 | Supressões indicadas por [...] | M, p. 23, seção 3.1 | Citações | Aviso se `(...)` ou `…` isolado aparecer dentro de citação; aceito `[...]` | CONFIRMADA | — |
| RN-087 | Interpolações, acréscimos ou comentários entre colchetes [ ] | M, p. 23, seção 3.1 | Citações | Colchetes dentro de citação direta | CONFIRMADA | — |
| RN-088 | Espaço antes e depois do bloco de citação longa | — (o Manual não trata) | Citações longas | `w:spacing w:before/after` do estilo | PENDENTE-FONTE | Modelos: 18 pt antes e depois (`before=after=360`) [VERIFICADO XML]. P-13 |
| RN-089 | Ênfase ou destaque em citação: grifo, negrito ou itálico | M, p. 23, seção 3.1 c | Citações | Runs com `w:u`, `w:b` ou `w:i` dentro de citação exigem a expressão de RN-090 | CONFIRMADA | "Grifo" = sublinhado? O termo não é definido [HIPÓTESE: sublinhado]. Os exemplos usam itálico |
| RN-090 | Destaque indicado por "grifo nosso" (feito por quem cita) ou "grifo do autor" (já no original), após a chamada | M, p. 24, seção 3.1; p. 23, exemplos | Citações | Regex `, grifo (nosso\|do autor)\)` | CONFLITO | O texto diz "entre parênteses, após a chamada"; os exemplos o colocam **dentro** dos parênteses da chamada, depois da página: "(SOUTO, 1916, p. 46, grifo nosso)". Elemento de chamada → C-01 |
| RN-091 | Entrada pelo título: primeira palavra do título seguida de reticências, ano e página; se o título começa por artigo ou monossílabo, ele entra na indicação | M, p. 23–24, Obs. e exemplo "(ANTEPROJETO..., 1987, p. 55)" | Chamadas | Regex `\(\p{Lu}+\.\.\., \d{4}` | CONFLITO | A regra "primeira palavra + reticências" só aparece no exemplo (ex.); a regra do artigo está no texto, mas o exemplo não a ilustra (o título "Anteprojeto" não começa por artigo). C-01 |
| RN-092 | Citação indireta: sem aspas; indicação de página opcional | M, p. 25, seção 3.2 | Citações indiretas | Sem aspas no trecho; a falta de página não gera erro | CONFIRMADA | — |
| RN-093 | Dois autores na chamada narrativa ligados por "e": "Aranha e Martins (1993)" | M, p. 25, exemplo | Chamadas | Regex `\p{Lu}\p{Ll}+ e \p{Lu}\p{Ll}+ \(\d{4}` | CONFLITO | (ex.) C-01. O código usa "e" também entre parênteses (CA-19); o modelo usa ";" entre parênteses "(FULANO; CICLANO, 2004)" |
| RN-094 | Chamada parentética com dois ou três autores (separador) | — (o Manual não exemplifica) | Chamadas | — | PENDENTE-FONTE | P-14 |
| RN-095 | Chamada com mais de três autores ("et al.", citar todos?) | — (o Manual não trata) | Chamadas | — | PENDENTE-FONTE | O código usa "et al." a partir de 3 (CA-19), com comentário atribuindo a opção à 10520:2023 — nível 5, não verificável. P-14 |
| RN-096 | Várias obras na mesma chamada; mesmo autor e mesmo ano (a, b); autores com o mesmo sobrenome | — (o Manual não trata) | Chamadas | — | PENDENTE-FONTE | P-15 |
| RN-097 | Chamada sem data ou sem página (ex.: "s.d.", "[s.d.]", "[1990?]", "não paginado") | — (o Manual não trata no cap. 3) | Chamadas | — | PENDENTE-FONTE | O código usa "s.d." (CA-20). A frente B confere se o cap. 5.19 trata datas incertas nas referências. P-11 |
| RN-098 | Citação de citação (apud): só quando o original não está acessível; usa a expressão latina "apud" ("citado por"): primeiro a obra original, depois a consultada | M, p. 25, seção 3.3 | Chamadas | Regex `\d{4}(, p\. [\d\-]+)? apud ` | CONFLITO | Grafia: C-01. Exemplo com página das duas obras: "(VIANNA, 1986, p. 172 apud SEGATTO, 1995, p. 214-215)"; **CA-21 descarta a página** — desvio. "apud" sem itálico nos exemplos [VERIFICADO imagem p. 25] |
| RN-099 | Apud em chamada narrativa: "Ramazzini (1998 apud OLIVEIRA, 1998)" — o autor consultado fica em caixa alta dentro dos parênteses | M, p. 26, exemplo | Chamadas | Regex `\p{Lu}\p{Ll}+ \(\d{4} apud \p{Lu}+, \d{4}\)` | CONFLITO | (ex.) C-01 |
| RN-100 | Notas de rodapé: chamada por número arábico **sobrescrito**, logo após a última palavra do trecho | M, p. 26, seção 3.4 | Notas | `w:footnoteReference` com `w:vertAlign=superscript` | CONFIRMADA | No exemplo, o número vem antes do ponto final: "(informação verbal)¹." (ex.) |
| RN-101 | A nota aparece no pé da mesma página | M, p. 26, seção 3.4 | Notas | Notas nativas `w:footnote` (não `w:endnote`) | CONFIRMADA | — |
| RN-102 | Numeração das notas: contínua no documento × reiniciada por capítulo/página | — (o Manual não trata) | Notas | `w:footnotePr/w:numRestart` | PENDENTE-FONTE | Modelos: `numFmt=decimal`, sem `numRestart` (contínua) [VERIFICADO XML]. P-16 |
| RN-103 | Informação obtida verbalmente: "(informação verbal)" no texto e os dados da fonte em nota de rodapé | M, p. 26, exemplos | Citações/notas | Regex `\(informação verbal\)` seguido de `w:footnoteReference` | AMBÍGUA | (ex.) Só exemplificado, sem regra no texto. Recomendação: adotar como modelo; remete à NBR 10520 (C-01) |
| RN-104 | Filete separador das notas (extensão) | — (o Manual não trata) | Notas | Separador do Word | PENDENTE-FONTE | Exemplos com filete curto (~5 cm) [VERIFICADO imagem p. 18, 26]. Baixa prioridade. P-17 |
| RN-105 | Equações e fórmulas destacadas do texto (em parágrafo próprio) | M, p. 27, seção 3.5 | Equações | Objeto `m:oMath`/equação em parágrafo próprio | CONFIRMADA | — |
| RN-106 | Equações numeradas com algarismos arábicos entre parênteses, alinhados à direita | M, p. 27, seção 3.5 | Equações | Parágrafo com tabulação direita na largura útil (`w:tab w:val=right w:pos≈9071`) e texto terminando em `\(\d+\)` | CONFIRMADA | Numeração sequencial (1), (2) (ex.) |
| RN-107 | Na sequência do texto, é permitida entrelinha maior para comportar expoentes, índices etc. | M, p. 27, seção 3.5 | Equações | O validador aceita `w:line` > 360 em parágrafos com equação | CONFIRMADA | Exceção a RN-029 |
| RN-108 | Alinhamento da própria equação (esquerda × centralizada) | M, p. 27, exemplo | Equações | `w:jc` | AMBÍGUA | O exemplo põe a equação na margem esquerda, em negrito, sem recuo; o texto não diz nada. O negrito do exemplo é provavelmente estilo da caixa de exemplo [HIPÓTESE]. P-18 |
| RN-109 | Indicativo numérico sem ponto final depois do último número ("1 INTRODUÇÃO", "2.1 Título") | M, p. 15, seção 2.3; p. 28–29, exemplos | Títulos | Regex proíbe `^\d+(\.\d+)*\.\s` | CONFIRMADA | O modelo de TCC usa "Figura 1." nas listas de ilustrações (fora deste escopo; frente B) |

**Total de linhas novas: 92** (RN-018 a RN-109).

---

### Conflitos

#### C-01 — Edição da NBR 10520: 2002 (Manual) × 2023 (README do código antigo)

**Evidência**
- O Manual adota a NBR 10520:2002: apresentação, p. 11 ("Citações em documentos (ABNT NBR 10520:2002)");
  p. 17 (epígrafes, "ABNT NBR 10520:2002"); p. 22 ("NBR 10520 (ASSOCIAÇÃO BRASILEIRA DE NORMAS
  TÉCNICAS, 2002)"); referências, p. 70 ("NBR 10520 … Rio de Janeiro: ABNT, 2002") [VERIFICADO texto; imagens p. 17 e 22].
- Prática visível no Manual [VERIFICADO imagens p. 22–26]:
  - parentética, pessoa física: `(SUDBRACK, 2001, p. 27)`; `(NICHOLS, 1993, p. 181)`; `(SOUTO, 1916, p. 46, grifo nosso)`;
  - narrativa: `Sudbrack (2001, p. 27)`; `Aranha e Martins (1993)`; `Authier-Reiriz (1982)`;
  - instituição: `(ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS, 2002)` (p. 22); `(IBGE, 1993)` (p. 20);
  - título: `(ANTEPROJETO..., 1987, p. 55)`;
  - apud: `(VIANNA, 1986, p. 172 apud SEGATTO, 1995, p. 214-215)`; `(ILDA, 1995 apud ALENCAR, 2000)`;
    `Ramazzini (1998 apud OLIVEIRA, 1998)`;
  - regra textual: "autor em caixa alta, ano e página" (p. 22, 3.1 a).
- Código antigo (nível 5, **não é fonte**): o README (l. 92, 96–99, 244) declara seguir a NBR 10520:2023, com
  "pessoa física em Title Case nas citações (ex.: 'Silva, 2020' — e não mais 'SILVA, 2020')" e instituições
  "em CAIXA ALTA (ex.: 'IBGE, 2021')". O cabeçalho de `src/abnt.js` (l. 7) cita 10520:2002; o bloco de citações
  (l. ~37–48) diz 2023 [VERIFICADO]. O comentário em `chamadaAutores` atribui à 2023 a opção "citar todos OU usar et al." [VERIFICADO; afirmação não verificável].

**O que muda visivelmente (só com o que há no projeto)**

| Situação | Opção A — Manual UFT 2022 (NBR 10520:2002) | Opção B — "2023" conforme o README antigo |
|---|---|---|
| Parentética, pessoa física | (SUDBRACK, 2001, p. 27) | (Sudbrack, 2001, p. 27) |
| Parentética, instituição | (IBGE, 1993) | (IBGE, 1993) — igual, segundo o README |
| Instituição por extenso | (ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS, 2002) | [não verificável] o README não trata nomes institucionais por extenso |
| Narrativa | Sudbrack (2001, p. 27) | Sudbrack (2001, p. 27) — igual |
| Apud | (VIANNA, 1986, p. 172 apud SEGATTO, 1995, p. 214-215) | [HIPÓTESE] (Vianna, 1986, p. 172 apud Segatto, 1995, p. 214-215) |
| Apud narrativo | Ramazzini (1998 apud OLIVEIRA, 1998) | [HIPÓTESE] Ramazzini (1998 apud Oliveira, 1998) |
| Entrada por título | (ANTEPROJETO..., 1987, p. 55) | [não verificável] |
| "grifo nosso", [...], [ ], et al., sem data, várias obras, pontuação | Como no Manual (onde há exemplo) | [não verificável] sem o texto da NBR 10520:2023 |

**Não verificável sem a NBR 10520:2023 (nível 2):** se a mudança de caixa alcança o apud, a entrada por título
e as instituições por extenso; as regras de et al., de dois e três autores, do separador entre autores e
entre obras, de "sem data"; a forma das expressões de destaque e de supressão; a pontuação; a apresentação
da citação longa (recuo, corpo). O README não é fonte e não pode sustentar nenhuma dessas regras.

**Opções**
1. **A — seguir o Manual (2002)** em todo o perfil "UFT 2022". Efeito: chamadas parentéticas em CAIXA ALTA,
   iguais aos exemplos do Manual, que é o documento que a biblioteca da UFT usa para conferir.
2. **B — seguir a 2023** (perfil alternativo). Efeito: sobrenomes de pessoas em Title Case dentro dos
   parênteses; o restante, indefinido até o usuário fornecer a NBR 10520:2023. Risco de divergir do que a
   biblioteca confere pelo Manual.
3. **C — motor configurável**, com padrão A e B como opção marcada "provisória" até chegar a fonte de nível 2 ou 3.

**Recomendação:** C com padrão A. O perfil "UFT 2022" reproduz o Manual (nível 1); a grafia do sobrenome na
chamada fica como parâmetro do perfil (`caixaSobrenomeParentetica: "ALTA" | "TITULO"`). A opção B só deixa
de ser provisória com o texto da NBR 10520:2023 (nível 2) ou com uma orientação escrita da biblioteca/coordenação
da UFT aceitando a 2023 (nível 3). **Pergunta ao usuário:** qual padrão usar e se pode fornecer a NBR
10520:2023 ou uma orientação da biblioteca da UFT.

#### C-02 — NBR 14724:2011 × 2018 dentro do Manual

**Evidência** [VERIFICADO por grep em todo o texto e imagem da p. 31]: 34 linhas mencionam "14724".
- **2011 (33 menções):** apresentação, p. 11; texto do cap. 5, p. 30 ("NBR 14724 (ASSOCIAÇÃO…, 2011)");
  Quadro 5, p. 30–31 (coluna "Norma específica", 14 vezes); "Fonte: ABNT NBR (14724:2011)" sob o Quadro 5
  e sob as Figuras 3–19 (p. 31–49); lista de referências, p. 70 ("NBR 14724 … 2011").
- **2018 (1 menção):** nota de rodapé 3, p. 31 — "os elementos pré-textuais deverão seguir o formato da
  norma de trabalho acadêmico ABNT (NBR 14724:2018) ver elementos pré-textuais do Quadro 2 deste manual".
  A mesma nota remete ao "Quadro 2", que é "Obras apresentadas na roda de conversa" (p. 20); o quadro de
  estrutura é o **Quadro 5**. Duas imprecisões na mesma nota.
- A 14724 não aparece nas p. 15–29 (regras gerais e citações). Mesmo assim, as regras gerais do Manual
  (fonte, margens, paginação) cobrem matéria da 14724 sem citar edição.

**Leitura:** a edição adotada pelo Manual é a 2011 (texto, quadro, fontes e referências). A menção a 2018 é
isolada, numa nota com outro erro de remissão [HIPÓTESE: erro de digitação]. Pelo material do projeto, não dá
para afirmar se existe uma edição 2018 da NBR 14724 nem o que ela mudaria.

**Opções e efeito visível**
1. **Tratar como 2011** em todo o perfil. Efeito: nenhum no documento gerado, porque o app segue o texto do
   Manual, não o da NBR. Só o rótulo "NBR 14724:2011" nos relatórios de conformidade.
2. **Tratar artigos como TCC conforme "14724:2018"**. Efeito: indeterminado, sem o texto da norma; não há
   regra concreta a implementar.

**Recomendação:** opção 1. Registrar a nota 3 como imprecisão do Manual e informar o usuário, sem bloquear
nada. Se o usuário tiver a NBR 14724 vigente, ela entra como nível 2 para detalhar o que o Manual remete.
Escopo de impacto: elementos pré-textuais de artigos como TCC (frente B, seção 5 e Quadro 5).

#### C-A1 — Corpo do título das ilustrações e tabelas: 12 ou 10?

- **Evidência:** a 2.1 (p. 15) manda corpo 10 para a "legenda das ilustrações, tabelas e quadros". A anotação
  do exemplo da p. 19 diz "Título da figura tamanho 12 / Espaço simples" e "Fonte da figura tamanho 10 /
  Espaço simples" [VERIFICADO imagem p. 19]. O Quadro 1 (p. 17) separa "Títulos das ilustrações" de
  "Fontes e legendas", o que sugere que "legenda" não é o título. Modelos UFT: título 12, fonte 10 [VERIFICADO XML]. Código: título 10 (CA-09).
- **Opções:** (a) título 12, fonte/legenda/nota 10; (b) tudo em 10 (título incluído).
- **Efeito visível:** em (a), o título da figura fica do tamanho do texto e a fonte abaixo fica menor. Em (b),
  título e fonte ficam em 10, destacando menos o título.
- **Recomendação:** (a). Tem a seu favor a anotação explícita da p. 19, a distinção do Quadro 1 e os modelos.
  O exemplo do próprio Manual também mostra o título maior que a fonte (p. 19, 20, 24).

#### C-A2 — Seção secundária: minúsculas (Quadro 1) × "Maiúsculo e negrito" (p. 28)

- **Evidência:** Quadro 1, p. 17: "Título 2.1 – seção secundária … Minúsculo em negrito". Exemplo da p. 28:
  "1.1, 1.2, 1.3, 1.4 etc. — **Maiúsculo e negrito**", escrito em caixa baixa com inicial maiúscula, enquanto a
  linha da primária está em "MAIÚSCULO E NEGRITO" [VERIFICADO imagens]. Exemplo da p. 29 (atribuído à NBR 6027:2012):
  "3.1 Primeiro teste: ocupação inicial de disco", em negrito e caixa baixa. Modelo de TCC: seção com
  `caps=false`, negrito [VERIFICADO XML].
- **Opções:** (a) secundária em negrito, só com a inicial maiúscula ("2.1 Objetivo geral"); (b) secundária em
  negrito e caixa alta integral ("2.1 OBJETIVO GERAL"), o que a deixaria igual à primária, distinta só pelo
  número.
- **Efeito visível:** (b) faz primária e secundária ficarem iguais visualmente, contra a ideia de hierarquia da p. 28.
- **Recomendação:** (a). Quadro 1, exemplo da p. 29 e modelo concordam; a palavra "Maiúsculo" na p. 28 parece
  erro ou indicação da inicial [HIPÓTESE]. Confirmar com o usuário.

#### C-A3 — Título da tabela: centralizado (Quadro 1) × à esquerda (exemplos IBGE, p. 20)

- **Evidência:** Quadro 1 (p. 17): "Títulos das ilustrações das tabelas — centralizada". Exemplos da 2.9 (p. 20),
  reproduzidos do IBGE: "Tabela 1 – Pessoas residentes…" e "Tabela 9 – …" alinhados à esquerda da tabela, com a 2.ª
  linha recuada sob o início do título [VERIFICADO imagem p. 20]. A política (§3.4) manda as tabelas seguirem o
  IBGE e registrar a divergência com o Manual. Modelos UFT: título da tabela centralizado. Código: centralizado (CA-09).
- **Opções:** (a) seguir o Quadro 1: centralizado, igual às ilustrações; (b) seguir o IBGE/exemplo: à esquerda,
  com recuo deslocado.
- **Efeito visível:** em (a), todas as legendas superiores ficam centralizadas e uniformes. Em (b), as tabelas
  ficam com o título encostado à esquerda, diferentes de figuras e quadros.
- **Recomendação:** aguardar a leitura da Norma Tabular pela frente C. Se o IBGE prescrever o alinhamento à
  esquerda, perguntar ao usuário, com recomendação preliminar de (b), porque a 2.9 remete expressamente ao
  IBGE e os exemplos do Manual para tabelas são do IBGE. Se o IBGE for omisso, (a).

#### C-A4 — Fonte e legenda "à esquerda": de qual borda?

- **Evidência:** Quadro 1: "Fontes e legendas — esquerda — simples". Exemplos: Figura 1 (p. 19), "Fonte:" alinhada
  à borda esquerda da figura, não à margem; Figura 2, idem; Quadro 2 (p. 20) e Quadro 1 (p. 17), à margem, que
  coincide com a borda do quadro; **Quadros 3 e 4 (p. 24–25), "Fonte:" centralizada** [VERIFICADO imagens].
  Modelos e código: centralizada (desvio).
- **Opções:** (a) à esquerda na margem do texto; (b) à esquerda alinhada à borda esquerda da ilustração;
  (c) centralizada (modelos/código; contraria o Quadro 1).
- **Efeito visível:** em ilustrações de largura total, (a) = (b). Em ilustrações estreitas e centralizadas, (a)
  deixa a fonte longe da figura, encostada na margem; (b) a mantém rente à figura.
- **Recomendação:** (b), que é a forma predominante nos exemplos do Manual e respeita o "esquerda" do Quadro 1.
  Implementação: título, elemento e fonte num bloco com a largura da ilustração. Alternativa simples aceitável: (a).

#### C-A5 — Glifo do "travessão" no título das ilustrações

- **Evidência:** o texto diz "travessão" (p. 18). Os exemplos usam "–" (U+2013) em 42 ocorrências e "-" em 8
  (Quadros 1, 4, 5…) [VERIFICADO no texto extraído]. Modelos: " - " (hífen). Código: "—" (U+2014, CA-09).
- **Opções:** (a) "–" U+2013 (meia-risca), como nos exemplos; (b) "—" U+2014 (travessão tipográfico);
  (c) hífen "-" (modelos).
- **Efeito visível:** traço curto, longo ou mínimo entre o número e o título ("Figura 1 – Título" / "Figura 1 — Título" / "Figura 1 - Título").
- **Recomendação:** (a), por fidelidade visual ao Manual; parametrizável no perfil. Aplicar o mesmo glifo a
  "APÊNDICE A – …" (frente B) e às subalíneas (RN-026), se o usuário quiser uniformidade.

---

### Divergências Manual × modelos × código

| # | Assunto | Manual (nível 1) | Modelos UFT (nível 4) | Código antigo (nível 5) | Prevalece / ação |
|---|---|---|---|---|---|
| D-01 | Entrelinha do título de ilustração/tabela | Simples (p. 16, 17, 19) | 1,5 (`line=360`, modelos 2–7) | não verificado | Manual |
| D-02 | Alinhamento da fonte da ilustração | Esquerda (Quadro 1) | Centralizada | Centralizada (CA-10) | Manual (C-A4) |
| D-03 | Separador no título | "travessão" ("–" nos exemplos) | " - " (hífen); "." / "-" nas listas | "—" (CA-09) | C-A5 |
| D-04 | Corpo do título de ilustração | 12 (p. 19) × 10 (2.1) | 12 | 10 (CA-09) | C-A1 |
| D-05 | Número de página | Canto superior direito, corpo 10 | Cabeçalho à direita, 12 pt (herdado) | Corpo 10, cabeçalho **ou rodapé** (CA-05) | Manual: só cabeçalho, 10 |
| D-06 | Título de seção primária | Alinhado à esquerda | Esquerda/justificado (uma linha) | **Centralizado** (CA-06) | Manual |
| D-07 | Recuo de parágrafo | 1,25 cm | 709 twips (ok) | 1,27 cm gerado (CA-04) | Manual |
| D-08 | Tabela | Aberta (p. 20) | não verificado (tabelas aninhadas) | Bordas em todas as células (CA-12) | Manual/IBGE |
| D-09 | Grafia na chamada parentética | CAIXA ALTA (p. 22–26) | CAIXA ALTA "(FULANO, 2003)" | Title Case (CA-19) | C-01 |
| D-10 | Separador entre autores na parentética | Não exemplificado | ";" "(FULANO; CICLANO, 2004)" | "e" (CA-19) | PENDENTE-FONTE (P-14) |
| D-11 | Apud | Página das duas obras | Sem página no exemplo | Descarta a página (CA-21) | Manual (permitir as duas páginas) |
| D-12 | Aspas da citação curta | Curvas “ ” | Curvas | Retas `"` | Manual |
| D-13 | Dedicatória | 1,5; 12; justificado (p. 17) | Itálico, à direita, na base, recuo 8 cm | não verificado | Manual (frente B confere a seção 5.7) |
| D-14 | Fonte do texto | Times New Roman **ou** Arial | Times New Roman | Só Times New Roman (CA-02) | O app deve oferecer as duas |
| D-15 | Tipos de ilustração | Lista aberta (desenho … retrato) | Figura/Quadro/Tabela | Figura/Quadro/Tabela/Gráfico (CA-11) | Ampliar os rótulos |
| D-16 | Natureza do trabalho | 8 cm da margem esquerda (p. 34) | 4536 twips (ok) | 8 cm (CA-15, ok) | Coerentes |
| D-17 | Citação longa | 4 cm, 10, simples, sem aspas | 2268, 20, 240, 18 pt antes/depois | 4 cm, 10, sem aspas (CA-22) | Coerentes; espaço antes/depois PENDENTE (P-13) |
| D-18 | Posição da legenda (instrução em texto do modelo) | Acima (p. 18) | Texto do modelo de TCC diz "abaixo da figura" (l. 443), mas o DOCX põe acima | Acima (CA-09) | Manual |
| D-19 | Hiperlink | Texto preto (exceto ilustrações) | Estilo Hyperlink azul | não verificado | Manual |
| D-20 | Fonte padrão de ilustração própria | Obrigatória; redação livre | "Adaptado de Autor (Ano)" | "Elaborado pelos autores." | P-07 |

Observação: o "modelo" `202502071521040.Ilustracoes e Tabelas` é guia da **FURB/Blumenau** (margens
3/3/2,5/2,5; cita "ABNT, 2024") — nível 5, já classificado assim no inventário. Não foi usado como evidência.

---

### PENDENTE-FONTE

| # | Linha(s) | Pergunta exata |
|---|---|---|
| P-01 | C-01 (RN-077, RN-082, RN-083, RN-090, RN-091, RN-093, RN-098, RN-099, RN-103) | O usuário quer as chamadas pela NBR 10520:2002 (como no Manual) ou pela 2023? Se pela 2023, pode fornecer o texto da NBR 10520:2023 (ou uma orientação escrita da biblioteca da UFT) para definir: caixa do sobrenome entre parênteses, no apud e na entrada por título; instituições por extenso; separadores; et al.; destaque; pontuação? |
| P-02 | C-02 | O usuário tem a NBR 14724 vigente? Confirma que a menção "14724:2018" da nota 3 (p. 31) é erro e que vale a 2011 citada no restante do Manual? |
| P-03 | RN-025, RN-027 | Pela NBR 6024:2012 (citada na p. 16): "letras dobradas" significa `aa), bb)` ou `aa), ab)`? Qual o recuo da alínea em relação à margem e o da subalínea em relação à alínea? |
| P-04 | RN-037 | Pela NBR 10520 (edição escolhida em C-01) ou NBR 14724: como se apresenta a epígrafe (posição na folha, recuo, corpo, alinhamento, autoria/chamada)? |
| P-05 | RN-045 | Os títulos sem indicativo numérico (RESUMO, SUMÁRIO, REFERÊNCIAS…) são em caixa alta e negrito? (A frente B deve conferir primeiro as Figuras 9–16 do Manual.) |
| P-06 | RN-048 | A UFT adota as regras de grafia de siglas do Manual de Comunicação da Secom/Senado (nota 2, p. 18)? Se sim, o usuário fornece o texto (para não depender de site de terceiros)? |
| P-07 | RN-056 | Há redação preferida pela UFT para a fonte de ilustração de produção própria (ex.: "Fonte: elaborado pelo autor (2026)")? |
| P-08 | RN-060 | A UFT exige que toda ilustração/tabela seja citada no texto e inserida próxima ao trecho? (O Manual não diz; a NBR 14724 poderia dizer — trazer o trecho.) |
| P-09 | RN-071 | Na contagem de folhas do PDF digital, a ficha catalográfica (verso da folha de rosto) conta como uma página? O trabalho é paginado por folha (anverso) ou por página? |
| P-10 | RN-072 | A que distância das bordas superior e direita deve ficar o número de página? |
| P-11 | RN-080, RN-097 | Como indicar, na chamada, documento sem data e citação direta de documento sem paginação? |
| P-12 | RN-085 | Onde fica o ponto final em citação curta (antes das aspas, depois da chamada, ou ambos) e em citação longa (antes ou depois da chamada)? |
| P-13 | RN-088 | Há espaço (linha em branco) antes e depois do bloco de citação longa? De quanto? |
| P-14 | RN-094, RN-095 | Na chamada parentética com 2 ou 3 autores, qual o separador (";" ou "e")? Com mais de 3, "et al." é obrigatório ou opcional? |
| P-15 | RN-096 | Formas para várias obras na mesma chamada, mesmo autor e mesmo ano (2020a, 2020b) e autores com o mesmo sobrenome e ano? |
| P-16 | RN-102 | A numeração das notas de rodapé é contínua no trabalho todo ou reinicia a cada capítulo? |
| P-17 | RN-104 | Há extensão prescrita para o filete separador das notas? (Baixa prioridade; o padrão do Word serve como provisório.) |
| P-18 | RN-108 | A equação fica centralizada ou na margem esquerda? |

Itens AMBÍGUA que precisam de decisão do usuário (não são pendências de fonte): RN-021/C-A1, RN-033, RN-042,
RN-044, RN-053/C-A5, RN-057/C-A4, RN-059, RN-066/C-A3, RN-073, RN-011/C-A2.

---

### Amostragem

Releitura no PDF (ferramenta Read com `pages`) nesta tarefa: p. 15–29, 31 e 34, todas como imagem. Linhas
conferidas uma a uma contra a imagem da página citada (31 de 92 linhas novas, 34%, mais as 17 RN):

| ID | Página | Resultado |
|---|---|---|
| RN-021, RN-022 | 19 | Anotações "Título da figura tamanho 12 / Espaço simples" e "Fonte da figura tamanho 10 / Espaço simples" conferidas |
| RN-025 | 16 | "utilizam-se letras dobradas quando esgotadas as letras do alfabeto" — sem exemplo; ambiguidade confirmada |
| RN-026 | 16 | Exemplo com "-" (hífen) visível; texto diz "travessão" — confirmado |
| RN-030, RN-031, RN-032 | 16 | 2.6 b, c, d conferidas literalmente |
| RN-033 | 16 | 2.6 e: "nos subtítulos, o espaçamento … é de 1,5" — confirmado |
| RN-034, RN-035 | 17 | 2.6 f e g conferidas |
| RN-036, RN-037 | 17 | "Outras orientações importantes" conferidas |
| RN-046, RN-048 | 18 | 2.7 e nota 2 (Secom/Senado) conferidas |
| RN-050, RN-051, RN-056 | 18 | "identificação aparece na parte superior… algarismos arábicos, travessão e respectivo título"; fonte "elemento obrigatório, mesmo que seja produção do próprio autor" — conferido |
| RN-055, RN-057 | 17, 19, 20, 24 | Títulos centralizados; fontes à borda da ilustração (p. 19), à margem (p. 17, 20), centralizadas (p. 24–25) — confirmado |
| RN-061 | 19 | "linhas horizontais e verticais sendo, portanto, fechado" — conferido |
| RN-062, RN-063, RN-066 | 20 | "abertas"; "parte superior, precedida da palavra tabela (IBGE, 1993)"; exemplos IBGE com título à esquerda — conferido |
| RN-067–RN-070 | 21 | 2.10 conferida literalmente |
| RN-074, RN-075 | 21 | 2.12 conferida |
| RN-081, RN-082 | 22 | "aspas duplas, autor em caixa alta, ano e página"; exemplos Sudbrack — conferido |
| RN-084 | 22 | "recuo de 4 cm … letra tamanho 10 e sem as aspas duplas" — conferido |
| RN-085 | 22–23 | Pontuação inconsistente nos exemplos — confirmado |
| RN-090 | 23–24 | "grifo nosso" dentro dos parênteses no exemplo; texto diz "após a chamada" — confirmado |
| RN-098, RN-099 | 25–26 | Exemplos apud conferidos; "apud" sem itálico |
| RN-100, RN-101 | 26 | 3.4 conferida |
| RN-106, RN-108 | 27 | 3.5 conferida; equação na margem esquerda, em negrito, no exemplo |
| RN-038–RN-043 | 28–29 | Cap. 4 e exemplos conferidos; "Maiúsculo e negrito" para 1.1 confirmado (C-A2) |
| RN-017 | 34 | "recuo de 8 cm da margem esquerda" na anotação da Figura 5 — conferido |
| C-02 | 31 | Nota 3 com "NBR 14724:2018" e remissão ao "Quadro 2" — conferido |

Nenhuma divergência entre o texto extraído e a imagem, exceto a ordem embaralhada das colunas do Quadro 1 no
texto extraído (o `.txt` desloca "em itálico" e "sublinhado" para linhas erradas). **A leitura do Quadro 1 deve
ser feita pela imagem, não pelo txt.**

---

### Cobertura

| Seção do sumário (p. 9) | Página | Onde ficou |
|---|---|---|
| Capa, ficha técnica, comitês (p. 1–6) | 1–6 | Excluída: elementos editoriais do Manual, sem regra |
| Listas de figuras e quadros do Manual (p. 7–8) | 7–8 | Usadas só como evidência em RN-052 (numeração por tipo) |
| Apresentação | 11–12 | Excluída como regra; usada como evidência das edições adotadas (C-01, C-02) |
| 1 Introdução | 13–14 | Excluída: introdutória/institucional. A obrigatoriedade de depósito (p. 14) está em RN-076 |
| 2 Regras gerais | 15 | — |
| 2.1 Fonte | 15 | RN-001 (corrigida), RN-021, RN-022 |
| 2.2 Margens | 15 | RN-002 |
| 2.3 Alinhamentos | 15 | RN-003, RN-004, RN-005, RN-109 |
| 2.4 Título | 15 | RN-007 (corrigida), RN-008, RN-044, RN-045 |
| 2.5 Alíneas | 16 | RN-009 (desmembrar), RN-023–RN-028 |
| 2.6 Espaçamento (a–h e "Outras orientações") | 16–17 | RN-006 (desmembrar), RN-029–RN-037, RN-017 |
| Quadro 1 – Formatos | 17 | RN-010–RN-016, RN-032, RN-054, RN-055, RN-057; C-A1, C-A2 |
| 2.7 Siglas e abreviaturas | 18 | RN-046–RN-048 |
| 2.8 Ilustrações | 18–19 | RN-049–RN-060; C-A1, C-A4, C-A5 |
| 2.8.1 Quadro | 19–20 | RN-061 |
| 2.9 Tabelas | 20 | RN-062–RN-066; C-A3 (detalhes de tabela → frente C, IBGE) |
| 2.10 Paginação | 21 | RN-067–RN-073 |
| 2.11 Papel para impressão | 21 | RN-018–RN-020 |
| 2.12 Encadernação | 21 | RN-074–RN-076 |
| 3 Citações (introdução) | 22 | RN-077, RN-078; C-01 |
| 3.1 Citação direta (curta, longa, supressão, interpolação, destaque, entrada por título) | 22–24 | RN-079–RN-091, RN-004 |
| Quadros 3 e 4 (verbos) | 24–25 | Excluídos: sugestão de estilo de redação, sem regra de formatação. Podem virar dica no editor |
| 3.2 Citação indireta | 25 | RN-092–RN-097 |
| 3.3 Citação de citação | 25–26 | RN-098, RN-099 |
| 3.4 Notas de rodapé | 26 | RN-016, RN-035, RN-100–RN-104 |
| 3.5 Equações e fórmulas | 26–27 | RN-105–RN-108 |
| 4 Numeração progressiva | 28 | RN-038–RN-043, RN-028, RN-005, RN-008, RN-010–RN-014; C-A2 |
| Exemplo de sumário (p. 29, de NBR 6027) | 29 | Evidência para C-A2 e RN-043; regras de sumário → frente B (5.15) |
| Fora do escopo, consultadas só para conflitos | 31, 34, 70 | C-02 (p. 31), RN-017 (p. 34), referências da NBR 10520/14724 (p. 70) |

Não há seção "gráficos" separada no Manual: gráfico é tipo de ilustração (RN-049). Não há regra sobre lista de
siglas nem ordem dos elementos no escopo (frente B).

## Apêndice B — Frente B — Manual UFT, p. 30–73 (RN-110–RN-240)


Frente B do `especialista-normas`. Escopo: Manual UFT 2022, p. 30–72 (cap. 5 a 11, Referências e
Anexo do Manual). IDs provisórios `B-xxx` (a sessão principal renumera para `RN-xxx`).

**Fonte M:** UNIVERSIDADE FEDERAL DO TOCANTINS. *Manual de normalização...* 2. ed. Palmas: UFT, 2022
(`materiais/normas/Manual_Normalizacao_UFT_2ed_2022.pdf`). Página impressa = página do PDF em todas
as páginas 30–72 [VERIFICADO: número impresso no topo direito de cada página, conferido nas imagens
das p. 30–72 nesta tarefa].

**Critério norma × exemplo adotado nesta parcial**
- *Norma*: texto corrido do Manual, padrões de referência (linhas-modelo "SOBRENOME, Prenome...") e
  as caixas de instrução amarelas ("ATENÇÃO: ...", "Inicia-se em folha distinta...") dentro das
  figuras-modelo, porque são redigidas como prescrição.
- *Exemplo*: o desenho das figuras-modelo (posições, caixa, tipografia não descrita em texto), os
  exemplos de referência e os modelos `.doc`/código antigo. Quando um tipo de referência só tem
  exemplo (sem linha-padrão), a regra foi derivada do exemplo e isso está dito em Observações.
- Divergência entre texto e caixa de instrução do próprio Manual = conflito interno (C-B*).

Siglas de modelos: **TCC** = Modelo de TCC de graduação; **ART** = Template de Artigo; **DIS** =
Dissertação; **TES** = Tese; **REL** = Relatório Técnico; **PRO** = Projeto de pesquisa (todos em
`analise/modelos_txt/` e `analise/modelos_docx/`, versões "Atualizado 2022"). **CA-xx** = regra
candidata do código antigo (`docs/relatorios/ETAPA2_AUDITORIA.md` §4).

Unidades usadas na validação: 1 cm = 567 twips; 8 cm = 4536; 7,5 cm = 4252; 12,5 cm = 7087;
`w:sz` 24 = 12 pt, 20 = 10 pt; `w:line` 360 = 1,5, 240 = simples.

### Regras novas

#### Estrutura geral e tipos de trabalho (cap. 5, p. 30–31)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-110 | O trabalho se organiza em parte externa (capa; lombada), elementos pré-textuais, textuais e pós-textuais, nesta ordem | M, p. 30, seção 5 a–d; Quadro 5, p. 30–31 | TCC de graduação e pós-graduação, dissertação, tese, artigo como TCC | Sequência de blocos do documento: externa → pré → textual → pós | CONFIRMADA | Manual cita NBR 14724:2011. [VERIFICADO p. 30] |
| RN-111 | Elementos obrigatórios: capa, folha de rosto, ficha catalográfica, folha de aprovação, resumo em língua portuguesa, resumo em língua estrangeira, sumário, introdução, desenvolvimento, considerações finais/conclusão, referências | M, p. 30–31 (Quadro 5); p. 34 (5.4); p. 47–49 (5.16–5.18) | Idem RN-110 | Checagem de presença de cada bloco antes da exportação (erro se ausente) | CONFIRMADA | A ficha não consta do Quadro 5, mas a seção 5.4 a declara obrigatória (ver C-B1). Os textuais não têm designação no Quadro 5; as seções 5.16–5.18 dizem "(obrigatório)" |
| RN-112 | Elementos opcionais: lombada, errata, dedicatória, agradecimentos, epígrafe, lista de ilustrações, lista de tabelas, lista de abreviaturas e siglas, lista de símbolos, glossário, apêndice(s), anexo(s), índice | M, p. 30–31 (Quadro 5); seções 5.2, 5.5, 5.7, 5.8, 5.11–5.14, 6–9 | Idem RN-110 | Bloco opcional: ausência não gera aviso | CONFIRMADA | Exceção: agradecimentos obrigatórios para bolsista (RN-149) |
| RN-113 | Ordem dos pré-textuais: folha de rosto; [ficha no verso]; errata; folha de aprovação; dedicatória; agradecimentos; epígrafe; resumo; abstract; lista de ilustrações; lista de tabelas; lista de abreviaturas e siglas; lista de símbolos; sumário | M, p. 30–31 (Quadro 5); p. 34 (5.4, ficha no verso da folha de rosto); p. 35 (5.5, errata logo após a folha de rosto) | Idem RN-110 | Índice de ordem fixo por tipo de bloco; erro se fora de ordem | CONFIRMADA | Código antigo exporta folha de rosto → ficha → resumo → abstract → listas → siglas → sumário, sem errata, aprovação, dedicatória, agradecimentos e epígrafe [VERIFICADO exports.js:693–701] |
| RN-114 | Ordem dos pós-textuais: referências; glossário; apêndice(s); anexo(s); índice | M, p. 31 (Quadro 5) | Idem RN-110 | Idem RN-113 | CONFIRMADA | Modelos: referências → apêndice → anexo (sem glossário/índice) — compatível |
| RN-115 | TCC do curso de Letras-Libras: contém pré e pós-textuais; os textuais (introdução, desenvolvimento, considerações finais) são substituídos por link de acesso ao trabalho em vídeo-registro em plataforma de acesso livre | M, p. 30, seção 5 | TCC Letras-Libras | Perfil "Letras-Libras": bloco textual = parágrafo com URL válida | CONFIRMADA | Manual não diz onde o link fica nem como é apresentado → PF-15 |
| RN-116 | Artigo apresentado como TCC deve conter os elementos pré-textuais do Quadro 5 (formato da norma de trabalho acadêmico); para artigo já aprovado/publicado, recomenda-se não incluir o artigo no template da revista | M, p. 30, seção 5; p. 31, nota 3 | Artigo como TCC | Perfil "Artigo-TCC" herda pré-textuais de RN-113 | CONFIRMADA | Nota 3 remete a "Quadro 2" e "NBR 14724:2018" — erro material provável (ver C-B14). Estrutura textual do artigo não definida → PF-14 |

#### Capa (5.1, p. 31–32)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-117 | Capa contém, nesta ordem: brasão da UFT; nome da instituição, câmpus e curso/programa; autoria; título, subtítulo (se houver) e número do volume (se mais de um); local e ano do depósito | M, p. 31, seção 5.1 a–e | TCC grad./pós, artigo-TCC, dissertação, tese | Ordem dos parágrafos da seção de capa | CONFIRMADA | Fig. 3 (p. 32) mostra 3 linhas: "UNIVERSIDADE FEDERAL DO TOCANTINS / CAMPUS UNIVERSITÁRIO DE... / PROGRAMA DE PÓS-GRADUAÇÃO E/OU CURSO DE GRADUAÇÃO..." |
| RN-118 | Brasão (identidade visual da instituição) centralizado no topo | M, p. 31, 5.1 a | Idem | Imagem inline no 1.º parágrafo, `w:jc=center` | CONFIRMADA | Arquivo do brasão é identidade visual → perguntar ao usuário a fonte oficial (PF-02) |
| RN-119 | Instituição, câmpus e curso/programa em caixa alta, negrito, centralizados | M, p. 31, 5.1 b | Idem | `w:caps` ou texto em maiúsculas; `w:b`; `w:jc=center` | CONFIRMADA | Texto grafa "câmpus"; Fig. 3 e modelos grafam "CAMPUS"; REL grafa "CÂMPUS" |
| RN-120 | Autoria centralizada, caixa alta, negrito | M, p. 31, 5.1 c | Idem | maiúsculas; `w:b`; `w:jc=center` | CONFIRMADA | |
| RN-121 | Título em negrito e caixa alta, centralizado | M, p. 31, 5.1 d; anotação Fig. 3, p. 32 | Idem | maiúsculas; `w:b`; `w:jc=center` | CONFIRMADA | Modelo TCC traz "TÍTULO Da monografia" (caixa mista, erro de digitação do modelo) |
| RN-122 | Subtítulo (se houver) em caixa alta, centralizado; negrito não explícito no texto | M, p. 31, 5.1 d; Fig. 3, p. 32 | Idem | maiúsculas; `w:jc=center`; `w:b` conforme decisão | AMBÍGUA | Texto: "subtítulo (se houver, em caixa alta)" sem citar negrito; anotação da Fig. 3: "Título, subtítulo, local e ano centralizados, letras maiúsculas em negrito". Ver C-B2 |
| RN-123 | Local e ano do depósito na capa: texto diz "(normal e negrito)"; anotação diz maiúsculas em negrito; desenho mostra "Local, TO / Ano" em caixa mista | M, p. 31, 5.1 e; Fig. 3, p. 32 | Idem | `w:jc=center`; `w:b`; caixa conforme decisão | AMBÍGUA | Ver C-B2. Modelos: "Local, TO" / "Ano" em negrito, caixa mista, 12 pt, 1,5 [VERIFICADO docx TCC] |
| RN-124 | Elementos da capa em fonte 12 (Arial ou Times New Roman) e espaçamento 1,5 | M, p. 32, anotação da Fig. 3 | Idem | `w:sz=24`; `w:line=360` | CONFIRMADA | Anotação cita "Título, subtítulo, local e ano"; demais linhas por extensão [HIPÓTESE] |
| RN-125 | Distribuição vertical da capa (instituição no topo; autor; título ao centro; local e ano no pé da página) | M, Fig. 3, p. 32 (desenho) | Idem | Posição vertical aproximada | PENDENTE-FONTE | Só o desenho indica; nenhuma medida em texto. PF-01 |

#### Lombada (5.2, p. 33)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-126 | Lombada (dorso) é opcional e segue a NBR 12225:2004 | M, p. 30 (Quadro 5); p. 33, 5.2 | Trabalhos impressos encadernados (dissertação, tese) | Não aplicável ao DOCX/PDF (elemento físico); no máximo gerar arte separada | PENDENTE-FONTE | Manual só define o termo e mostra a Fig. 4 (texto "NORMA" no sentido vertical). Elementos e sentido da escrita dependem da NBR 12225, ausente → PF-03. Cor da encadernação: p. 21 (frente A) |

#### Folha de rosto (5.3, p. 33–34)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-127 | Folha de rosto contém, nesta ordem: autoria; título e subtítulo; natureza (tipo, objetivo, instituição, área de concentração); orientador(a) com titulação; coorientador(a), se houver, com titulação; local e ano | M, p. 33, 5.3 a–f | TCC grad./pós, artigo-TCC, dissertação, tese | Ordem dos parágrafos da seção | CONFIRMADA | [VERIFICADO p. 33] |
| RN-128 | Autoria centralizada, negrito, caixa baixa (maiúsculas/minúsculas) | M, p. 33, 5.3 a | Idem | `w:jc=center`; `w:b`; sem `w:caps` | CONFIRMADA | Modelos conferem (estilo com `w:b`, run `caps=false`) [VERIFICADO docx TCC] |
| RN-129 | Título e subtítulo centralizados, negrito, caixa baixa | M, p. 33, 5.3 b | Idem | `w:jc=center`; `w:b`; sem `w:caps` | CONFIRMADA | Fig. 5 mostra subtítulo com inicial minúscula após dois-pontos |
| RN-130 | Autor e título começam na margem superior; fonte 12; espaçamento 1,5 | M, p. 34, anotação da Fig. 5 | Idem | 1.º parágrafo sem espaço antes; `w:sz=24`; `w:line=360` | CONFIRMADA | |
| RN-131 | Natureza do trabalho: recuo de 8 cm da margem esquerda (do meio da área de texto até a margem direita), fonte 10, espaço simples, justificado | M, p. 34, anotação da Fig. 5; p. 17, 2.6 h | Idem | `w:ind w:left=4536`; `w:sz=20`; `w:line=240`; `w:jc=both` | CONFIRMADA | Refina RN-017 ("≈ metade"): área útil A4 = 21 − 3 − 2 = 16 cm, metade = 8 cm. Modelos usam `start=4536` [VERIFICADO docx TCC]; CA-15 também 8 cm |
| RN-132 | Texto de natureza indica tipo do trabalho, objetivo (grau/título pretendido), instituição e área de concentração; orientador(a) e coorientador(a) no formato "Orientador (a): Titulação/Nome" | M, p. 33, 5.3 c–e; Fig. 5, p. 34 | Idem | Campos obrigatórios preenchidos: tipo, grau, instituição, área, orientador | CONFIRMADA | Redação da Fig. 5 é exemplo: graduação "Monografia/Artigo apresentada à UFT, Campus ... para obtenção do título de bacharel/licenciado..."; pós "Tese/Dissertação apresentada ao Programa de Pós-Graduação em ... como requisito à obtenção do grau de Mestre(a) / Doutor(a) em..." |
| RN-133 | O grau declarado deve corresponder ao tipo: dissertação → Mestre(a); tese → Doutor(a) | M, Fig. 5, p. 34 (par "Tese/Dissertação" × "Mestre(a) / Doutor(a)"); p. 53 (exemplo "Dissertação (Mestrado...)"); p. 21 (dissertação/tese em mestrado/doutorado) | Dissertação, tese | Regra cruzada tipo × grau no texto de natureza e na folha de aprovação | CONFIRMADA | Modelo TES diz "grau de Mestre (a)" na folha de rosto e "título de Mestre (a)" na folha de aprovação — erro do modelo (D-01) |
| RN-134 | Local e ano centralizados, fonte 12, espaçamento 1,5 | M, p. 33, 5.3 f; p. 34, anotação da Fig. 5 | Idem | `w:jc=center`; `w:sz=24`; `w:line=360` | CONFIRMADA | Texto diz "ano de publicação"; capa diz "ano do depósito" |

#### Ficha catalográfica (5.4, p. 34–35)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-135 | Ficha catalográfica obrigatória, no verso da folha de rosto, na parte inferior da página | M, p. 34, 5.4 | TCC grad./pós, artigo-TCC, dissertação, tese | Página seguinte à folha de rosto contém a ficha ancorada no pé | CONFIRMADA | Para PDF digital sem frente e verso, ver C-B3 |
| RN-136 | Ficha segue AACR2 e mede 7,5 cm × 12,5 cm | M, p. 34, 5.4; Fig. 6, p. 35 | Idem | Imagem/quadro com altura ≈ 4252 e largura ≈ 7087 twips | CONFIRMADA | |
| RN-137 | A ficha é elaborada pelo Sistema Eletrônico de Geração de Fichas Catalográficas da UFT (https://sistemas.uft.edu.br/ficha/) | M, p. 34, 5.4 | Idem | App não gera ficha: importa PDF/imagem fornecido pelo sistema UFT, ou deixa espaço reservado com aviso | CONFIRMADA | Código antigo aceita imagem ou texto em moldura [VERIFICADO exports.js:172–182]. Modelos trazem só o link |

#### Errata (5.5, p. 35–36)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-138 | Errata opcional, inserida logo após a folha de rosto, em papel avulso ou encartado, acrescentada depois de impresso o trabalho | M, p. 35, 5.5 | Todos com pré-textuais | Bloco "errata" posicionado após folha de rosto/ficha | CONFIRMADA | |
| RN-139 | Errata constituída pela referência do trabalho e pelo texto da errata | M, p. 35, 5.5; exemplo p. 36 | Idem | Bloco contém uma referência (RN-172 ss.) + tabela de correções | CONFIRMADA | Exemplo p. 36: tabela "Folha / Linha / Onde se lê / Leia-se" (exemplo, não norma). Título "ERRATA" centralizado = RN-007 |

#### Folha de aprovação (5.6, p. 36–37)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-140 | Folha de aprovação contém: autor; título e subtítulo; natureza; objetivo; instituição; área de concentração; data de aprovação; nome, titulação e instituição dos componentes da banca | M, p. 36, 5.6 | TCC grad./pós, artigo-TCC, dissertação, tese (e relatório, ver C-B11) | Campos presentes | CONFIRMADA | Sem título (RN-007). Código antigo não gera folha de aprovação [VERIFICADO exports.js, sem ocorrência] |
| RN-141 | Autor e título iniciam na margem superior, centralizados, fonte 12, espaçamento 1,5; caixa e negrito em conflito | M, p. 37, anotação da Fig. 7 | Idem | `w:jc=center`; `w:sz=24`; `w:line=360`; caixa/negrito conforme decisão | AMBÍGUA | Anotação: "letras maiúsculas, sem negrito"; desenho: negrito, caixa mista; modelos: negrito, caixa mista. Ver C-B4 |
| RN-142 | Natureza na folha de aprovação: recuo de 8 cm, fonte 10, espaço simples, justificado | M, p. 37, anotação da Fig. 7 | Idem | `w:ind w:left=4536`; `w:sz=20`; `w:line=240`; `w:jc=both` | CONFIRMADA | Texto-exemplo: "...foi avaliado para a obtenção do título de ... e aprovada em sua forma final pelo Orientador e pela Banca Examinadora" |
| RN-143 | Data de aprovação em fonte 12, espaço 1,5, alinhada à esquerda | M, p. 37, anotação da Fig. 7 | Idem | `w:jc=left`; `w:sz=24`; `w:line=360` | CONFIRMADA | Modelos usam estilo centralizado sobrescrito para `start` (esquerda) [VERIFICADO docx TCC] |
| RN-144 | Nome, titulação e assinatura dos membros da banca em maiúsculas/minúsculas, fonte 12, espaço 1,5 | M, p. 37, anotação da Fig. 7 | Idem | `w:sz=24`; `w:line=360`; linha de assinatura por membro | CONFIRMADA | A caixa de anotação está cortada após "e" (alinhamento ilegível); desenho mostra linhas de assinatura centralizadas no formato "Prof.(a) Dr.(a) nome, sigla da Instituição onde atua" → alinhamento PF-04 |

#### Dedicatória, agradecimentos, epígrafe (5.7–5.8, p. 38–39; Quadro 5)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-145 | Dedicatória: texto curto, opcional, sem a palavra "dedicatória" como título | M, p. 38, 5.7 e anotação da Fig. 8; p. 15 (RN-007) | Todos com pré-textuais | Bloco sem parágrafo de título | CONFIRMADA | |
| RN-146 | Dedicatória inicia abaixo do meio da folha, recuo de 8 cm da margem esquerda, fonte 12, justificada, espaço 1,5 | M, p. 38, anotação da Fig. 8; p. 17 (outras orientações) | Idem | `w:ind w:left=4536`; `w:sz=24`; `w:jc=both`; `w:line=360`; espaço antes ≥ meia página | CONFIRMADA | Texto-instrução dos 6 modelos manda "itálico, alinhadas à direita e na base da página" — contradiz o Manual (D-05); a formatação real do parágrafo nos modelos segue o Manual (`start=4536`, justificado, 1,5) [VERIFICADO docx TCC] |
| RN-147 | Agradecimentos opcionais; tornam-se obrigatórios quando o autor é bolsista de alguma instituição | M, p. 39, 5.8 | Todos com pré-textuais | Se metadado "bolsista = sim" → bloco obrigatório (erro se ausente) | CONFIRMADA | |
| RN-148 | Agradecimentos iniciam em folha distinta com o título AGRADECIMENTOS em maiúsculas, negrito, centralizado, na margem superior, sem indicativo numérico, fonte 12, espaço 1,5; texto fonte 12, espaço 1,5, justificado | M, p. 39, anotação da Fig. 9; p. 17 | Idem | Quebra de página antes; título `w:b`, `w:jc=center`; texto `w:jc=both`, `w:line=360` | CONFIRMADA | Exemplo mostra parágrafos com recuo de 1.ª linha (exemplo) |
| RN-149 | Epígrafe opcional, posicionada após agradecimentos e antes do resumo; sem título | M, p. 30 (Quadro 5); p. 15 (2.4); p. 17 | Todos com pré-textuais | Posição na ordem RN-113; sem parágrafo de título | CONFIRMADA | Cap. 5 não tem seção de epígrafe; formatação na página (posição, recuo, autoria) → PF-05 |

#### Resumo e resumo em língua estrangeira (5.9–5.10, p. 40–41)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-150 | Resumo na língua do texto (vernácula) é obrigatório e é seguido de palavras-chave | M, p. 40, 5.9 | Todos com pré-textuais | Bloco "resumo" não vazio + lista de palavras-chave não vazia | CONFIRMADA | Manual cita NBR 6028:2003 |
| RN-151 | Resumo inicia em folha distinta; título RESUMO em maiúsculas, negrito, centralizado, fonte 12, espaço 1,5, na margem superior, sem indicativo | M, p. 40, 5.9 (texto) e anotação da Fig. 10 | Idem | Quebra de página antes; `w:b`; `w:jc=center`; `w:sz=24`; `w:line=360` | CONFIRMADA | |
| RN-152 | Texto do resumo em fonte 12 e justificado | M, p. 40, 5.9 e anotação da Fig. 10 | Idem | `w:sz=24`; `w:jc=both` | CONFIRMADA | |
| RN-153 | Espaçamento do texto do resumo: simples (texto 5.9 e regra geral 2.6 b) × 1,5 (anotação da Fig. 10) | M, p. 40, 5.9; p. 16, 2.6 b; p. 40 e p. 41 (anotações Fig. 10 e 11) | Idem | `w:line=240` ou `360` conforme decisão | CONFLITO | Ver C-B5. Modelos usam 1,5 (`line=360`) [VERIFICADO docx TCC]; código antigo usa simples (exports.js:197) |
| RN-154 | Extensão do resumo: 150 a 500 palavras em trabalhos acadêmicos (teses, dissertações e outros) e relatórios técnico-científicos; 100 a 250 em artigos de periódicos; 50 a 100 em indicações breves | M, p. 40, 5.9 a–c | Por tipo de trabalho | Contagem de palavras do texto do resumo (sem título e sem palavras-chave), faixa por perfil | CONFIRMADA | Faixa para artigo-TCC: ver C-B6. Código antigo aplica 150–500 a todos (CA-13; abnt.js:270–272) |
| RN-155 | Quantidade de palavras-chave: "no máximo quatro" (texto) × "no mínimo quatro" (anotação) | M, p. 40, 5.9 (texto); anotação da Fig. 10, p. 40; anotação da Fig. 11, p. 41 | Idem | Contagem de itens | CONFLITO | Ver C-B7. Modelos: "de três a cinco"; código: aviso se < 3 (abnt.js) |
| RN-156 | Palavras-chave separadas entre si por ponto e finalizadas por ponto | M, p. 40, anotação da Fig. 10 (e Fig. 11, p. 41) | Idem | Regex: itens separados por ". " e terminados em "." | CONFIRMADA | Exemplo: "Palavras-chave: Interação bibliotecária. Usuário. Bibliotecas. Sistema." com rótulo em negrito (exemplo). Código antigo separa por "; " (exports.js:201) — desvio |
| RN-157 | Resumo em língua estrangeira obrigatório (inglês Abstract, espanhol Resumen ou francês Résumé), com a mesma formatação do resumo em português | M, p. 41, 5.10 | Todos com pré-textuais | Mesmas propriedades de RN-151 a RN-156 no bloco estrangeiro | CONFIRMADA | Código antigo põe abstract e keywords em itálico (exports.js:209, 213) — desvio. Fig. 11 mostra margens direita e inferior de 3 cm (erro de figura, ver C-B13) |
| RN-158 | Título do resumo estrangeiro: ABSTRACT, RESUMEN ou RÉSUMÉ, maiúsculas, negrito, centralizado, margem superior, sem indicativo | M, p. 41, anotação da Fig. 11 | Idem | Texto do título conforme idioma; `w:b`; `w:jc=center` | CONFIRMADA | Anotação grafa "RESUMEM" (erro tipográfico); texto 5.10 grafa "Resumen". Rótulo das palavras-chave: exemplo "Keywords:"; modelos "Key-words:"; espanhol/francês não informados → PF-06 |
| RN-159 | Forma do texto do resumo (parágrafo único, recuo, pessoa verbal, conteúdo) | M, p. 40 (remete à NBR 6028:2003) | Idem | — | PENDENTE-FONTE | Exemplo Fig. 10 mostra parágrafo único sem recuo; modelos citam "sequência de frases concisas" atribuída à NBR 6028. Sem a norma, não confirmar → PF-07 |

#### Listas (5.11–5.14, p. 42–45)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-160 | Lista de ilustrações: relação das ilustrações na ordem em que aparecem no texto, cada item com identificação, título (enunciado) e página | M, p. 42, 5.11 | Todos com pré-textuais | Itens gerados das legendas, na ordem do documento; página de cada item | CONFIRMADA | Exemplo: "Figura 1 - Modelo de berço......10" (linha pontilhada até o número — exemplo) |
| RN-161 | Listas próprias por tipo de ilustração: "quando necessário, recomenda-se" (texto) × "a partir de 5 ilustrações do mesmo tipo criar listas próprias" (anotação) | M, p. 42, 5.11 e anotação da Fig. 12 | Idem | Contagem por rótulo (Figura, Quadro, Gráfico...) | AMBÍGUA | Ver C-B8. Código antigo sempre separa (LISTA DE FIGURAS/QUADROS/GRÁFICOS/TABELAS) [VERIFICADO exports.js:228–250] |
| RN-162 | Título LISTA DE ILUSTRAÇÕES; cada lista inicia em folha distinta, título em maiúsculas, negrito, centralizado, margem superior, sem indicativo; corpo das listas fonte 12, espaço 1,5, justificado | M, p. 42, anotação da Fig. 12; p. 15 (2.4) | Idem | Quebra de página antes; título `w:b`, `w:jc=center`; itens `w:sz=24`, `w:line=360` | CONFIRMADA | Desenho da Fig. 12 e modelos TCC/ART/DIS/TES grafam "LISTA DE ILUSTRAÇÃO" (singular) — erro de exemplo (D-06) |
| RN-163 | Lista de tabelas: relação das tabelas na ordem do texto, com enunciado e página em que se encontram ou iniciam; título LISTA DE TABELAS com a mesma apresentação de RN-162 | M, p. 43, 5.12 e anotação da Fig. 13 | Idem | Itens gerados das legendas "Tabela n"; página inicial | CONFIRMADA | |
| RN-164 | Tabelas padronizadas conforme a Norma Tabular do IBGE (edição atual) | M, p. 43, 5.12; Quadro 5, p. 31 | Tabelas | Ver regras de tabela da Fonte I (outra frente) | CONFIRMADA | Remissão — regras extraídas pela frente responsável pelas tabelas |
| RN-165 | Lista de abreviaturas e siglas: relação em ordem alfabética, cada sigla/abreviatura seguida da forma por extenso; não incluir abreviaturas comuns (ex.: centímetro, milímetro) | M, p. 44, 5.13 | Idem | Ordenação alfabética (collation pt-BR); 2 colunas (sigla / extenso) | CONFIRMADA | Exemplo mostra 2 colunas alinhadas. Código: ordem alfabética, após listas e antes do sumário (CA-14) — compatível |
| RN-166 | Título da lista de siglas: "LISTA DE ABREVIATURAS E SIGLAS" (título da seção 5.13 e desenho) × "LISTA DE SIGLAS" (anotação); apresentação igual a RN-162 | M, p. 44, 5.13 e Fig. 14 | Idem | Texto do título | AMBÍGUA | Ver C-B9. Modelos: "LISTA DE ABREVIATURAS E SIGLAS", exceto REL: "LISTA DE SIGLAS" |
| RN-167 | Lista de símbolos: relação dos símbolos na ordem alfabética, cada um seguido do significado; título LISTA DE SÍMBOLOS com apresentação igual a RN-162 | M, p. 45, 5.14 e anotação da Fig. 15 | Idem | Ordenação; 2 colunas | CONFIRMADA | "Ordem alfabética" de símbolos: no exemplo a ordem segue o nome do significado (Alfa, Beta, Infinito, Ômega, Sigma, Somatório) [VERIFICADO p. 45] — critério de ordenação pelo significado é [HIPÓTESE] |

#### Sumário (5.15, p. 46)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-168 | Sumário obrigatório: enumera as principais divisões/seções na mesma ordem do texto, com a página inicial de cada uma | M, p. 46, 5.15 | Todos | Campo TOC gerado dos títulos; número de página real | CONFIRMADA | Manual cita NBR 6027:2012. Código antigo estimava páginas por heurística em abnt.js (gerarSumario) mas o DOCX usa campo TOC |
| RN-169 | Sumário não ultrapassa a seção quinária | M, p. 46, 5.15 | Todos | TOC com níveis 1–5 (`\o "1-5"`); erro se houver nível 6 | CONFIRMADA | Código antigo limita a 1–4 (CA-16; exports.js:223) — desvio: omite quinárias |
| RN-170 | No sumário, os títulos e subtítulos sucedem os indicativos de seção | M, p. 46, 5.15 (citando NBR 6027:2012) | Todos | Entrada = "indicativo + espaço/tab + título" | CONFIRMADA | |
| RN-171 | Sumário inicia em folha distinta; título SUMÁRIO maiúsculas, negrito, centralizado, margem superior, sem indicativo; entradas em fonte 12, espaço 1,5 | M, p. 46, anotação da Fig. 16 | Todos | Quebra de página antes; título `w:b`/`w:jc=center`; entradas `w:sz=24`, `w:line=360` | CONFIRMADA | Anotação também diz "justificado". Tipografia das entradas por nível, alinhamento e pré/pós-textuais no sumário → PF-08 (Fig. 16 é exemplo) |

#### Elementos textuais (5.16–5.18, p. 47–49)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-172 | Introdução obrigatória, parte inicial do texto (expõe a natureza e a importância do tema) | M, p. 47, 5.16 | Todos exceto Letras-Libras (RN-115) | Primeira seção primária do bloco textual | CONFIRMADA | Fig. 17 mostra "1 INTRODUÇÃO" com número de página no canto superior direito (exemplo coerente com p. 21, 2.10). Fig. 17 tem espaço largo entre "1" e "INTRODUÇÃO" e modelos usam tabulação — RN-005 exige um espaço (frente A) |
| RN-173 | Desenvolvimento obrigatório, dividido em seções e subseções conforme o tema e o método | M, p. 48, 5.17 | Idem | Ao menos uma seção primária entre introdução e conclusão | CONFIRMADA | Títulos de seção do desenvolvimento são livres |
| RN-174 | Considerações finais e/ou conclusão(ões) obrigatória, fecho do texto | M, p. 49, 5.18; Quadro 5, p. 31 ("Conclusão") | Idem | Última seção primária do bloco textual | CONFIRMADA | Rótulo aceito: "Considerações finais" ou "Conclusão" (texto 5.18 admite ambos) |

#### Referências — regras transversais (5.19, p. 49–63; Anexo, p. 72)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-175 | Referências são obrigatórias; elementos essenciais variam com o tipo/suporte e podem ser acrescidos elementos complementares | M, p. 49–50, 5.19 (citando NBR 6023:2018) | Todos | Bloco "REFERÊNCIAS" presente se houver citações | CONFIRMADA | Elementos complementares não detalhados → PF-09 (i) |
| RN-176 | Ordenação das referências alfabética | M, p. 50, 5.19 | Todos | Lista ordenada por chave de entrada (collation pt-BR) | CONFIRMADA | Critérios de desempate (mesmo autor, mesmo ano) não constam → PF-09 (g). Código antigo ordena pela última palavra do nome (abnt.js chaveOrdenacao) — errado para "SILVA NETO" (D-K1) |
| RN-177 | Referências alinhadas só à margem esquerda, espaço simples, separadas entre si por uma linha em branco em espaço simples | M, p. 17, 2.6 f; Quadro 1, p. 17 | Todos | `w:jc=left`; `w:line=240`; separação = 1 linha simples (ex.: `w:after=240` ou parágrafo vazio de 12 pt) | CONFIRMADA | Possível duplicata da frente A (RN-006). Confirmado pela lista de referências do próprio Manual (p. 70–71). Modelos: "12 pontos antes e depois"; código: `after=170` (exports.js:577) — desvios |
| RN-178 | Destaque tipográfico: título da obra (ou do periódico/jornal/evento/veículo, conforme o tipo) em negrito; subtítulo sem destaque | M, padrões e exemplos p. 50–63 (ex.: p. 50, linha-padrão "SOBRENOME, Prenome do autor. **Título**: subtítulo.") | Todos | Run do título com `w:b`; run do subtítulo sem `w:b` | CONFIRMADA | Texto não define o destaque em prosa, mas todas as linhas-padrão aplicam negrito. Código antigo gera `<strong>` mas a exportação DOCX remove o negrito (exports.js:572, que apaga as marcas `strong`; o mesmo ocorre nas linhas 1213 e 1414) — desvio grave (D-K4) |
| RN-179 | Quando a entrada é pelo título (sem autoria), a primeira palavra vai em maiúsculas e esse título não recebe negrito | M, p. 51 (5.19.2, "Título (primeira palavra com letras maiúsculas)"; ex. "MANUAL de editoração..."); p. 56 ("MUITO por fazer"); p. 57 ("CLIMA de campanha..."); p. 52 ("POLÍTICA. In: DICIONÁRIO da língua...") | Livro, artigo, jornal, verbete, audiovisual sem autoria | Primeira palavra `toUpperCase`; sem `w:b` no título de entrada | CONFIRMADA | Título iniciado por artigo: exemplos "OS PERIGOS do uso..." (artigo + palavra seguinte em maiúsculas, p. 63) — regra geral não explícita → PF-09 (f). Código antigo usa "[s.a.]" no lugar do autor (abnt.js formatarAutores) — desvio |
| RN-180 | Autor pessoal: SOBRENOME em maiúsculas, vírgula, prenome(s) | M, p. 50, 5.19.1 (exemplos "SILVA, José Antônio Costa da") | Todos | Regex do bloco de autoria | CONFIRMADA | Partícula ("da") fica após os prenomes (exemplo p. 50) |
| RN-181 | Sobrenomes com Filho, Júnior, Neto, Sobrinho entram junto com o sobrenome anterior (SILVA NETO, Roberto da; TOURINHO FILHO, F. C.) | M, p. 50, Obs. em 5.19.1 | Todos | Lista de sufixos de parentesco no inversor de nomes | CONFIRMADA | Código antigo inverte só a última palavra → "NETO, Roberto da Silva" (D-K1) |
| RN-182 | Prenomes por extenso ou abreviados | M, p. 50 (padrão "Prenome"; exemplos abreviados "PASSOS, L. M. M."; por extenso "CAGLIARI, Luiz Carlos") | Todos | Uniformidade dentro da lista (aviso) | AMBÍGUA | Ver C-B10 e PF-09 (a) |
| RN-183 | Até três autores: todos indicados, separados por ponto e vírgula | M, p. 50, 5.19.1 b | Todos | Separador "; " entre autores | CONFIRMADA | Exemplo PASSOS; FONSECA; CHAVES |
| RN-184 | Mais de três autores: primeiro autor seguido de "et al." | M, p. 50, 5.19.1 c; exemplos p. 51 (LUCKESI), p. 56 (DANTAS), p. 61 (BERTAZZOLI) | Todos | Se n > 3: "AUTOR1 et al." | CONFLITO | Outros exemplos do Manual listam todos (4 a 7 autores: DOREA p. 56; ZUBEN p. 54; FUJIMURA p. 61). Ver C-B12. Código antigo lista sempre todos |
| RN-185 | Expressão "et al." em itálico | M, p. 50 (texto: "et al", itálico, sem ponto); exemplos p. 51, 56, 61 ("et al." itálico, com ponto) | Todos | Run "et al." com `w:i` | CONFIRMADA | Grafia com ponto adotada dos exemplos; o texto omite o ponto (erro tipográfico provável) |
| RN-186 | Obra coletiva com responsável: entrada pelo responsável seguida da abreviatura da função entre parênteses em minúsculas: (org.)/(orgs.), (comp.), (ed.), (coord.)/(coords.) | M, p. 51, 5.19.1 | Livro, capítulo, mapa | Sufixo de função a partir de campo estruturado | CONFIRMADA | Modelos usam "(Coord.)" maiúsculo; código antigo força "(org.)" em todo capítulo (abnt.js, case 'capitulo') — desvios |
| RN-187 | Autor entidade: nome da entidade por extenso, todo em maiúsculas | M, p. 51, 5.19.1 d | Todos | Campo "autor corporativo" → maiúsculas, sem inversão | CONFIRMADA | |
| RN-188 | Expressão "In:" em itálico, seguida de dois-pontos, antes da obra no todo | M, padrões e exemplos p. 51–52, 54–55, 60 | Capítulo, verbete, trabalho em evento, documento em coletânea | Run "In" com `w:i` | CONFIRMADA | O texto extraído perde o itálico; conferido na imagem [VERIFICADO p. 51–52]. Código antigo: "In:" sem itálico |
| RN-189 | Documento on-line: acrescentar "Disponível em: URL. Acesso em: dia mês abreviado ano." | M, p. 53 (5.19.6); p. 55 (5.19.9.2); p. 57 (5.19.9.3) | Todos os tipos em meio eletrônico | Padrão de texto: "Disponível em: " + URL + ". Acesso em: " + dia + mês abreviado (RN-190) + ano + "." | CONFIRMADA | URL sem sinais < > nos exemplos; modelos usam "<URL>" e "Disponível:" — desvio (D-09) |
| RN-190 | Meses abreviados conforme o Anexo do Manual: jan., fev., mar., abr., maio, jun., jul., ago., set., out., nov., dez. (e tabelas para espanhol, italiano, francês, inglês, alemão) | M, p. 72, Anexo – Abreviatura dos meses | Datas em referências | Tabela de abreviaturas por idioma | CONFIRMADA | "maio" sem abreviação. Tabela tem erros em outros idiomas (ex.: espanhol "enero" sem abreviação, alemão "Ok." para Oktober) — registrar, usar só português até decisão. Código antigo tem a tabela portuguesa correta (abnt.js formatarDataAcesso) mas o tipo "artigo" acrescenta ponto ao mês (gera "maio.") |
| RN-191 | Livro em formato e-book: acrescentar "E-book" (itálico) ao final | M, p. 53, 5.19.6, Exemplo 2 | Livros eletrônicos | Sufixo "*E-book*." | CONFIRMADA | Derivada de exemplo (sem linha-padrão) |
| RN-192 | Edição indicada por número arábico seguido de ". ed." (ex.: "10. ed.", "3. ed.") | M, exemplos p. 50, 52, 59 | Livros e similares | Regex `\d+\. ed\.` | CONFIRMADA | Derivada dos exemplos; omissão da 1.ª edição não declarada → PF-09 (c) |
| RN-193 | Sem local / sem editora / data incerta | M, exemplos p. 54 ("[S. l]"), p. 55 ("[S.l.]"), p. 59 ("[S. l.]"), p. 62 ("[s.n.]"), p. 60 ("[2016]"), p. 63 ("c1991", "ca.") | Todos | — | PENDENTE-FONTE | Grafias inconsistentes entre exemplos; nenhuma regra em texto → PF-09 (d, e). Código antigo usa "[s.l.]" minúsculo |

#### Referências — padrões por tipo de documento (5.19.1 a 5.19.9.13, p. 50–63)

Notação dos padrões: **negrito** = destaque; *itálico* = itálico.

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-194 | Livro, 1 autor: SOBRENOME, Prenome. **Título**: subtítulo. Edição. Local: Editora, ano. Páginas. (Coleção ou série). | M, p. 50, 5.19.1 a; ex. CAGLIARI (p. 50) | Livro | Montagem por campos; ordem e pontuação fixas | CONFIRMADA | Código antigo omite páginas e série (abnt.js case 'livro') |
| RN-195 | Livro, até 3 autores: autores separados por "; " no padrão RN-194 | M, p. 50, 5.19.1 b; ex. PASSOS (p. 50) | Livro | Idem | CONFIRMADA | |
| RN-196 | Livro, mais de 3 autores: primeiro autor + *et al.* no padrão RN-194 | M, p. 50–51, 5.19.1 c; ex. LUCKESI (p. 51) | Livro | Idem | CONFLITO | Ver C-B12 |
| RN-197 | Coletânea com responsável: RESPONSÁVEL, Prenome (org.). **Título**: subtítulo. Local: Editora, ano. | M, p. 51; ex. ROVAI (p. 51) | Livro | Idem | CONFIRMADA | |
| RN-198 | Livro de autor entidade: NOME DA ENTIDADE. **Título**: subtítulo. edição. Local: Editora, ano. páginas. Notas. | M, p. 51, 5.19.1 d; ex. CONFERÊNCIA NACIONAL DOS BISPOS DO BRASIL (p. 51) | Livro | Idem | CONFIRMADA | |
| RN-199 | Livro sem autoria: TÍTULO (1.ª palavra maiúscula) subtítulo. edição. Local: Editora, ano. páginas. Notas. | M, p. 51, 5.19.2; ex. MANUAL de editoração (p. 51) | Livro | Idem + RN-179 | CONFIRMADA | |
| RN-200 | Capítulo com autoria própria: AUTOR DO CAPÍTULO. Título do capítulo: subtítulo. *In*: AUTOR DO LIVRO (org.). **Título do livro**: subtítulo. edição. Local: Editora, ano. p. inicial-final (ou capítulo). | M, p. 51–52, 5.19.3; ex. COOMONTE (p. 52) | Capítulo | Idem | CONFIRMADA | Título do capítulo sem destaque |
| RN-201 | Capítulo de mesmo autor da obra ("sem autoria especial"): mesmo padrão, repetindo o nome do autor após *In*:; volume e capítulo/páginas ao final | M, p. 52, 5.19.3.1; ex. CAGLIARI ... Cap. 2 (p. 52) | Capítulo | Idem | CONFIRMADA | Exemplo repete o nome por extenso (não usa traço) |
| RN-202 | Verbete com autor: como capítulo sem autoria especial | M, p. 52, 5.19.4; ex. FERREIRA ... Babaçu (p. 52) | Verbete | Idem | CONFIRMADA | |
| RN-203 | Verbete sem autoria: VERBETE. *In*: TÍTULO do dicionário/enciclopédia: subtítulo. edição. Local: Editora, ano. volume, páginas. + endereço eletrônico e acesso (se on-line) | M, p. 52, 5.19.4.1; ex. POLÍTICA (p. 52) | Verbete | Idem | CONFIRMADA | Título da obra sem negrito (entrada por título, RN-179) |
| RN-204 | Livro traduzido: AUTOR. **Título**: subtítulo. Tradução de Nome. edição. Local: Editora, ano. páginas. Título original: Título na língua de origem. | M, p. 52–53, 5.19.5; ex. BAUMAN; MAY (p. 53) | Livro | Idem | CONFIRMADA | |
| RN-205 | Livro on-line: padrão de livro + "Disponível em: ... Acesso em: ..." | M, p. 53, 5.19.6; ex. ANCHIETA (p. 53) | Livro | Idem + RN-189 | CONFIRMADA | |
| RN-206 | Monografia, dissertação, tese: AUTOR. **Título**: subtítulo. Ano de defesa. Natureza (categoria e área de concentração) – Centro/Programa/Faculdade, Universidade, Cidade, ano. | M, p. 53, 5.19.7 a; ex. PEREIRA JÚNIOR (p. 53) | Trabalho acadêmico | Idem; travessão meia-risca "–" (U+2013) antes da instituição | CONFIRMADA | Ordem Programa/Universidade diverge entre padrão e exemplo (C-B15). Número de folhas aparece só na lista do Manual (p. 70, "222f.") → PF-09 (h). Código antigo usa "—" (U+2014), omite área e programa (D-K7) |
| RN-207 | Evento no todo: NOME DO EVENTO, número, ano, local. **Anais** (ou ata, tópico temático) [...]. Local: editora, data. páginas ou volumes. | M, p. 54, 5.19.8 a; ex. CONGRESSO DE INICIAÇÃO CIENTÍFICA DA UFPE; CONGRESSO DO CENTRO-OESTE... (p. 54) | Evento | Idem | CONFIRMADA | Exemplo usa "**Anais eletrônicos** [...]". Código antigo usa "Anais…" sem colchetes nem negrito (D-K6) |
| RN-208 | Evento no todo em formato digital (Meet, YouTube, Instagram): NOME DO EVENTO, número, ano. [S. l.]: Instituição, ano. 1 vídeo (duração). Disponível em... Acesso em... | M, p. 54, 5.19.8 b; ex. SEMINÁRIO INTERNACIONAL TURISMO... (p. 54) | Evento | Idem | CONFIRMADA | Derivada só do exemplo |
| RN-209 | Trabalho em anais: AUTOR. Título do trabalho. *In*: NOME DO EVENTO, número, ano, local. **Anais** [...]. Local: editora, data. p. inicial-final. | M, p. 54, 5.19.8 c; ex. ZUBEN et al. (p. 54) | Evento | Idem | CONFIRMADA | Exemplo lista 7 autores (C-B12) |
| RN-210 | Trabalho apresentado em formato digital (palestra, mesa-redonda): AUTOR. Título. *In*: NOME DO EVENTO, n., ano. [S.l.]. **Título da atividade** [...]. [S.l.]: Instituição, ano. Disponível em... Acesso em... 1 vídeo (duração). Nota de transmissão. | M, p. 54–55, 5.19.8 d; ex. CASTROGIOVANNI (p. 55) | Evento | Idem | CONFIRMADA | Derivada só do exemplo; posição de "1 vídeo" após o acesso difere de RN-208 (inconsistência do exemplo) |
| RN-211 | Periódico, coleção inteira: TÍTULO DO PERIÓDICO (maiúsculas). Local: Editora, ano inicial-ano final. ISSN. Elementos complementares. | M, p. 55, 5.19.9.1; ex. REVISTA BRASILEIRA DE GEOGRAFIA; ACTA CIRÚRGICA BRASILEIRA (p. 55) | Periódico | Idem | CONFIRMADA | Título em maiúsculas, sem negrito |
| RN-212 | Artigo de periódico com autor: AUTOR. Título do artigo. **Título do Periódico**, local, volume, número, páginas, mês ano. | M, p. 55, 5.19.9.2 a; ex. DOREA (p. 56), DANTAS (p. 56, com DOI) | Artigo | Idem; formas "v.", "n.", "p." nos exemplos | CONFIRMADA | DOI aparece só em exemplo ("DOI: ..." antes de "Disponível em") → PF-09 (i) |
| RN-213 | Artigo de periódico sem autoria: TÍTULO do artigo. **Título do Periódico**, local, v., n., p., mês ano. | M, p. 56, 5.19.9.2 b; ex. MUITO por fazer (p. 56) | Artigo | Idem + RN-179 | CONFIRMADA | |
| RN-214 | Artigo de periódico on-line: padrão RN-212 + "Disponível em: ... Acesso em: ..." | M, p. 55–56, 5.19.9.2 c; ex. PORTO JUNIOR; OLIVEIRA (p. 56) | Artigo | Idem + RN-189 | CONFIRMADA | Exemplo omite o local e usa data completa "30 maio 2016" |
| RN-215 | Artigo de jornal com autor e com seção/caderno: AUTOR. Título. **Título do jornal**, local, data. Seção/caderno/parte, paginação. | M, p. 56–57, 5.19.9.3 a; ex. SILVA, Leila (p. 57) | Jornal | Idem | CONFIRMADA | |
| RN-216 | Artigo de jornal com autor, sem seção: AUTOR. Título. **Título do jornal**, local, página, data. | M, p. 57, 5.19.9.3 b; ex. SILVA JUNIOR (p. 57) | Jornal | Idem | CONFIRMADA | Página antes da data só neste subtipo |
| RN-217 | Artigo de jornal sem autor: TÍTULO do artigo. **Título do jornal**, local, data, seção/caderno. Página. | M, p. 57, 5.19.9.3 c; ex. CLIMA de campanha (p. 57) | Jornal | Idem + RN-179 | CONFIRMADA | Padrão usa ". Página"; exemplo usa ", p. 17" |
| RN-218 | Artigo de jornal on-line: AUTOR. Título. **Título do jornal**, local, data. Disponível em... Acesso em... | M, p. 57–58, 5.19.9.3 d; ex. LEITÃO (p. 58) | Jornal | Idem + RN-189 | CONFIRMADA | Exemplo tem erro: "LEITÃO. Miriam" (ponto em vez de vírgula) |
| RN-219 | Entrevista publicada: ENTREVISTADO. Título. [Entrevista cedida a] Entrevistador. **Título do jornal/revista**, local, v., n., p., data. | M, p. 58, 5.19.9.4; ex. HAMEL (p. 58) | Entrevista | Idem | CONFIRMADA | Padrão põe "Entrevistador" no fim; exemplo põe após o título — adotado o exemplo [HIPÓTESE]; registrar na decisão C-B15 |
| RN-220 | Entrevista oral (em trabalho acadêmico): ENTREVISTADO. Título da entrevista, [Entrevista cedida a] entrevistador. **Título do trabalho acadêmico**: subtítulo, local da entrevista, dia mês ano. | M, p. 58, 5.19.9.5; ex. MACHADO (p. 58) | Entrevista | Idem | CONFIRMADA | |
| RN-221 | Correspondência (carta, bilhete, cartão, e-mail): REMETENTE. [**Correspondência**] ou [**descrição**]. Destinatário: Nome. Local, data. Quantidade e tipo (1 carta, 1 bilhete, 1 E-mail). + Disponível/Acesso se on-line. | M, p. 58–59, 5.19.9.6; ex. PILLA, AZNAR, PEREIRA JUNIOR, LISPECTOR | Correspondência | Idem | CONFIRMADA | Derivada só dos exemplos |
| RN-222 | Norma técnica: ENTIDADE. **Título da norma e número**: descrição. Local: editora, ano. número de páginas. | M, p. 59, 5.19.9.7; ex. ABNT NBR 6023 (p. 59) | Norma | Idem | CONFIRMADA | |
| RN-223 | Legislação (constituição, lei, decreto): JURISDIÇÃO ou ENTIDADE (maiúsculas). Título, numeração e data. Ementa/complementares. Dados da publicação. | M, p. 59, 5.19.9.8 a; ex. BRASIL Constituição; Lei 9.979; Lei 11.310; Decreto-lei 200 (p. 59–60) | Documento jurídico | Idem | CONFLITO | Destaque: o padrão põe o título em negrito, mas nos exemplos de lei o negrito vai no veículo (**Diário Oficial [da] República Federativa do Brasil**) e na Constituição vai no título. Ver C-B16. Código antigo: "BRASIL. **Título**. Brasília, ano." sem numeração/data/publicação (D-K8) |
| RN-224 | Jurisprudência (acórdão, súmula, sentença...): JURISDIÇÃO. Órgão. Título (natureza/ementa). Tipo e número. Partes. Relator. Local, data. Dados da publicação (veículo em negrito). | M, p. 60–61, 5.19.9.8 b; ex. TOCANTINS Tribunal de Justiça; BRASIL STF; BRASIL STJ Súmula 333 | Documento jurídico | Idem | CONFIRMADA | |
| RN-225 | Patente: inventor, **título**, depositante e/ou titular, procurador (se houver), número da patente, data de depósito, data de concessão (se houver) | M, p. 61, 5.19.9.9; ex. BERTAZZOLI, FUJIMURA, GALEMBECK (p. 61–62) | Patente | Idem | CONFIRMADA | |
| RN-226 | Documento iconográfico (fotografia, desenho técnico, pintura, gravura): AUTOR. **Título**. Data. Quantidade e especificação. | M, p. 62, 5.19.9.10; ex. MACHADO, Alan dos Santos. **Jalapão** (p. 62) | Iconográfico | Idem | CONFIRMADA | |
| RN-227 | Documento cartográfico: AUTOR ou ENTIDADE. **Título**: subtítulo. Local: Editora, data. Especificação. Escala. | M, p. 62, 5.19.9.11; ex. AGÊNCIA NACIONAL DE ÁGUAS; MIRANDA; COUTINHO (coord.) | Cartográfico | Idem | CONFIRMADA | |
| RN-228 | Audiovisual em suporte (CD, DVD, vinil, cassete, blu-ray, VHS, filme): COMPOSITOR ou intérprete. **Título**. Local: Gravadora, data. Quantidade e especificação. | M, p. 62, 5.19.9.12 a; ex. ANGRA, RIBEIRO (p. 62–63) | Audiovisual | Idem | CONFIRMADA | Filmes nos exemplos entram pelo título com direção/produção/intérpretes ("BLADE Runner. Direção: ...", "OS PERIGOS...") — padrão para filme não escrito → PF-09 (j) |
| RN-229 | Documento tridimensional (escultura, maquete, objeto): AUTOR. **Título**. Data. Especificação (quantidade, material). | M, p. 63, 5.19.9.13; ex. DUCHAMP, TOLEDO | Tridimensional | Idem | CONFIRMADA | Derivada só dos exemplos |

#### Glossário, apêndice, anexo, índice (cap. 6–9, p. 64–67)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-230 | Glossário opcional: lista em ordem alfabética de termos pouco conhecidos usados no texto, com as definições | M, p. 64, cap. 6 | Todos | Entradas ordenadas (collation pt-BR) | CONFIRMADA | Exemplo: título GLOSSÁRIO centralizado em negrito; entrada "Termo: definição". Formato da entrada → PF-10 |
| RN-231 | Apêndice identificado pela palavra APÊNDICE, letra maiúscula consecutiva, travessão e título (APÊNDICE A – Título) | M, p. 65, cap. 7 | Todos | Regex `^APÊNDICE [A-Z]{1,2} – .+` (travessão U+2013) | CONFIRMADA | Modelos usam hífen e minúsculas ("apêndice a - TÍTULO") — D-10. Código antigo: "APÊNDICE A – TÍTULO" (CA-08) |
| RN-232 | Esgotado o alfabeto, usam-se letras maiúsculas dobradas na identificação dos apêndices | M, p. 65, cap. 7 | Todos | Sequência A…Z, AA, AB… | CONFIRMADA | Código antigo: UI de A a J, exportação de A a Z, sem dobradas (CA-08) |
| RN-233 | Apêndice = material elaborado pelo próprio autor (ex.: roteiro de entrevista, questionário); não confundir com anexo | M, p. 65, cap. 7 | Todos | Ajuda contextual na UI (não verificável) | CONFIRMADA | |
| RN-234 | Anexo identificado pela palavra ANEXO, letra maiúscula consecutiva, travessão e título (ANEXO A – Título) | M, p. 66, cap. 8 | Todos | Regex `^ANEXO [A-Z]{1,2} – .+` | CONFIRMADA | |
| RN-235 | Esgotado o alfabeto, letras maiúsculas dobradas na identificação dos anexos | M, p. 66, cap. 8 | Todos | Idem RN-232 | CONFIRMADA | |
| RN-236 | Anexo = documento externo, não elaborado pelo autor (ex.: material institucional de terceiros) | M, p. 66, cap. 8 | Todos | Ajuda contextual na UI | CONFIRMADA | |
| RN-237 | Disposição gráfica de apêndices/anexos: o exemplo mostra um título geral centralizado ("APÊNDICE"/"ANEXO") e, abaixo, a identificação "APÊNDICE A – ..." alinhada à esquerda | M, p. 65–66 (exemplos) | Todos | — | AMBÍGUA | Ver C-B17 |
| RN-238 | Índice opcional: relação de palavras/frases ordenada por critério (alfabético, sistemático, cronológico etc.) que remete às informações do texto; pode ser especial (autores, assuntos, títulos, pessoas/entidades); não confundir com sumário e lista | M, p. 67, cap. 9 (citando NBR 6034:2004) | Todos | Último elemento pós-textual (RN-114) | CONFIRMADA | Formato (Fig. 20: "ÍNDICE ONOMÁSTICO" em 2 colunas, "Sobrenome, Prenome, páginas") é exemplo → PF-11 |

#### Entrega na UFT (cap. 10, p. 68)

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-239 | Todo trabalho acadêmico da UFT deve estar no Repositório Institucional (BDTD / BDM) em texto completo; é obrigatória a entrega da versão final em formato digital desbloqueado | M, p. 68, cap. 10 | Todos | PDF exportado sem senha e sem restrições de cópia/impressão (sem `/Encrypt` no PDF) | CONFIRMADA | Complementa p. 21, 2.12 (frente A) |
| RN-240 | Para a biblioteca (sistema Asten) entregam-se: (a) versão final em PDF desprotegido contendo a folha de aprovação com banca e orientador(a); (b) termo de autorização para publicação no Repositório; (c) ata de defesa assinada (pode ser digital) pela banca ou pelo orientador(a) | M, p. 68, 10.1 a–c | TCC, dissertação, tese | Checklist de entrega na UI; validação de (a): PDF sem criptografia e com bloco "folha de aprovação" | CONFIRMADA | (b) e (c) são documentos externos ao app — só checklist |

### Ordem dos elementos por tipo de trabalho

Legenda: **Obr.** obrigatório; **Opc.** opcional; **Obr.\*** obrigatório condicionado; **PF** = Manual
não define para este tipo (PENDENTE-FONTE), entre parênteses o que o modelo UFT traz (exemplo, não norma).
O Manual define uma única estrutura (Quadro 5) para "trabalhos de conclusão de cursos de graduação e
pós-graduação" (p. 30), aplicada a monografia, dissertação, tese e artigo como TCC (p. 30; nota 3, p. 31).
Relatório técnico e projeto de pesquisa não têm estrutura no Manual [VERIFICADO p. 30–31, 40, 69].

| # | Elemento | TCC grad./espec. (monografia) | Artigo como TCC | Dissertação | Tese | Relatório técnico | Projeto de pesquisa | Fonte |
|---|---|---|---|---|---|---|---|---|
| 1 | Capa | Obr. | Obr. | Obr. | Obr. | PF (modelo: presente) | PF (modelo: presente) | p. 30 Q5; p. 31 5.1 |
| 2 | Lombada | Opc. (só impresso) | Opc. | Opc. | Opc. | PF (ausente) | PF (ausente) | p. 30 Q5; p. 33 5.2 |
| 3 | Folha de rosto | Obr. | Obr. | Obr. | Obr. | PF (presente) | PF (presente; "Coordenador" em vez de orientador) | p. 30 Q5; p. 33 5.3 |
| 4 | Ficha catalográfica (verso da folha de rosto) | Obr. | Obr. | Obr. | Obr. | PF (presente) | PF (ausente) | p. 34 5.4 (ausente do Q5, C-B1) |
| 5 | Errata | Opc. | Opc. | Opc. | Opc. | PF (ausente) | PF (ausente) | p. 30 Q5; p. 35 5.5 |
| 6 | Folha de aprovação | Obr. | Obr. | Obr. | Obr. | PF (ausente; Fig. 7 cita "Relatório", C-B11) | PF (ausente) | p. 30 Q5; p. 36 5.6 |
| 7 | Dedicatória | Opc. | Opc. | Opc. | Opc. | PF (presente) | PF (ausente) | p. 30 Q5; p. 38 5.7 |
| 8 | Agradecimentos | Opc.; Obr.\* se bolsista | idem | idem | idem | PF (presente) | PF (ausente) | p. 30 Q5; p. 39 5.8 |
| 9 | Epígrafe | Opc. | Opc. | Opc. | Opc. | PF (ausente) | PF (ausente) | p. 30 Q5; p. 17 |
| 10 | Resumo (língua vernácula) + palavras-chave | Obr. (150–500 palavras) | Obr. (faixa: C-B6) | Obr. (150–500) | Obr. (150–500) | PF (presente); se exigido, 150–500 (p. 40 a: "relatórios técnico-científicos") | PF (ausente) | p. 30 Q5; p. 40 5.9 |
| 11 | Resumo em língua estrangeira + keywords | Obr. | Obr. | Obr. | Obr. | PF (presente) | PF (ausente) | p. 30 Q5; p. 41 5.10 |
| 12 | Lista de ilustrações | Opc. | Opc. | Opc. | Opc. | PF (presente) | PF (presente) | p. 31 Q5; p. 42 5.11 |
| 13 | Lista de tabelas | Opc. | Opc. | Opc. | Opc. | PF (presente) | PF (presente) | p. 31 Q5; p. 43 5.12 |
| 14 | Lista de abreviaturas e siglas | Opc. | Opc. | Opc. | Opc. | PF (presente, "LISTA DE SIGLAS") | PF (ausente) | p. 31 Q5; p. 44 5.13 |
| 15 | Lista de símbolos | Opc. | Opc. | Opc. | Opc. | PF (presente) | PF (ausente) | p. 31 Q5; p. 45 5.14 |
| 16 | Sumário | Obr. | Obr. | Obr. | Obr. | PF (presente) | PF (presente) | p. 31 Q5; p. 46 5.15 |
| 17 | Introdução | Obr. | PF (corpo do artigo: PF-14) | Obr. | Obr. | PF (presente) | PF (presente) | p. 31 Q5; p. 47 5.16 |
| 18 | Desenvolvimento | Obr. | PF (PF-14) | Obr. | Obr. | PF (presente) | PF (objetivos e cronograma no modelo) | p. 31 Q5; p. 48 5.17 |
| 19 | Considerações finais / conclusão | Obr. | PF (PF-14) | Obr. | Obr. | PF (presente) | PF (ausente) | p. 31 Q5; p. 49 5.18 |
| 20 | Referências | Obr. | Obr. | Obr. | Obr. | PF (presente) | PF (presente) | p. 31 Q5; p. 49 5.19 |
| 21 | Glossário | Opc. | Opc. | Opc. | Opc. | PF (ausente) | PF (ausente) | p. 31 Q5; p. 64 cap. 6 |
| 22 | Apêndice(s) | Opc. | Opc. | Opc. | Opc. | PF (presente) | PF (presente) | p. 31 Q5; p. 65 cap. 7 |
| 23 | Anexo(s) | Opc. | Opc. | Opc. | Opc. | PF (presente) | PF (presente) | p. 31 Q5; p. 66 cap. 8 |
| 24 | Índice | Opc. | Opc. | Opc. | Opc. | PF (ausente) | PF (ausente) | p. 31 Q5; p. 67 cap. 9 |

**Variante Letras-Libras (TCC):** itens 1–16 e 20–24 como na coluna TCC; itens 17–19 substituídos por
link de acesso ao vídeo-registro em plataforma de acesso livre (p. 30) — apresentação do link: PF-15.

**Paginação** (frente A, p. 21, 2.10): folhas contadas a partir da folha de rosto, numeradas a partir da
primeira folha textual. Interação com a ficha no verso: C-B3.

### Conflitos e ambiguidades

| ID | Tema | Evidência | Opções e efeito visível | Recomendação |
|---|---|---|---|---|
| C-B1 | Ficha catalográfica obrigatória, mas ausente do Quadro 5 | p. 34, 5.4 "(obrigatório)"; Quadro 5, p. 30–31, sem a ficha | (a) Obrigatória: app exige/reserva a página da ficha após a folha de rosto. (b) Opcional: ficha pode faltar | (a) — a seção específica declara obrigatória; a omissão é lacuna do quadro. Só registro, sem decisão do usuário |
| C-B2 | Capa: subtítulo e local/ano | 5.1 d: subtítulo "em caixa alta" (sem citar negrito); 5.1 e: local e ano "(normal e negrito)"; anotação Fig. 3 (p. 32): título, subtítulo, local e ano "letras maiúsculas em negrito"; desenho: subtítulo em maiúsculas negrito, "Local, TO / Ano" em caixa mista negrito | (a) Tudo em MAIÚSCULAS NEGRITO (anotação): "PALMAS, TO / 2026". (b) Subtítulo maiúsculo negrito; local e ano em caixa mista negrito (desenho e modelos): "Palmas, TO / 2026". (c) Subtítulo maiúsculo sem negrito; local e ano sem negrito (leitura literal de "normal") | (b): coincide com o desenho do Manual e com os 6 modelos; "normal e negrito" lido como "caixa normal, em negrito". **Pergunta ao usuário** |
| C-B3 | Ficha no "verso" em trabalho entregue só em PDF | p. 34, 5.4 (verso da folha de rosto); p. 21, 2.10 (todas as folhas contadas); p. 68 (entrega digital) | (a) Ficha em página própria logo após a folha de rosto (como os 6 modelos e o código antigo), contada na paginação. (b) Impressão frente e verso: ficha no verso, folha de rosto e ficha contam como uma folha | (a) para PDF/DOCX; (b) como opção de impressão. **Pergunta ao usuário** (muda o número exibido a partir da introdução) |
| C-B4 | Folha de aprovação: caixa e negrito do autor e do título | Anotação Fig. 7 (p. 37): "centralizados em letras maiúsculas, sem negrito"; desenho Fig. 7: negrito, caixa mista; folha de rosto (5.3) usa negrito e caixa baixa; modelos: negrito, caixa mista | (a) "NOME DO AUTOR / TÍTULO..." em maiúsculas sem negrito. (b) "Nome do autor / Título..." em negrito, caixa mista, igual à folha de rosto | (b): desenho do Manual + coerência com 5.3 + todos os modelos. **Pergunta ao usuário** |
| C-B5 | Espaçamento do texto do resumo/abstract | Simples: p. 16, 2.6 b ("resumo, abstract ... espaçamento simples") e p. 40, texto 5.9 ("entrelinhamento simples"). 1,5: anotações das Fig. 10 e 11 (p. 40–41); modelos docx (`line=360`) | (a) Simples: resumo de 300 palavras ocupa cerca de meia página. (b) 1,5: ocupa cerca de uma página | (a): é o que dizem os dois textos normativos; anotações e modelos ficam como desvio. **Pergunta ao usuário** |
| C-B6 | Extensão do resumo do artigo como TCC | p. 40: 150–500 para "trabalhos acadêmicos"; 100–250 para "artigos de periódicos"; p. 30: artigo-TCC segue pré-textuais de trabalho acadêmico | (a) 150–500 (trabalho acadêmico). (b) 100–250 (artigo). (c) aceitar 100–500 com aviso | (a) com aviso informativo. **Pergunta ao usuário** |
| C-B7 | Quantidade de palavras-chave | p. 40 texto: "no máximo quatro palavras"; anotações Fig. 10/11: "no mínimo, quatro palavras-chave"; modelos: "de três a cinco"; código antigo: aviso se < 3 | (a) 1 a 4 (texto). (b) 4 ou mais (anotação). (c) exatamente 4 (satisfaz as duas frases). (d) 3 a 5 (modelos) | (a) como **aviso** (não erro), pois o texto corrido é a regra; (c) como opção conservadora. **Pergunta ao usuário** |
| C-B8 | Quando separar listas por tipo de ilustração | p. 42, 5.11: "quando necessário, recomenda-se"; anotação Fig. 12: "a partir de 5 ilustrações do mesmo tipo criar listas próprias"; código antigo: sempre separa | (a) Lista única "LISTA DE ILUSTRAÇÕES"; listas próprias só por escolha do usuário. (b) Lista própria automática para tipo com 5 ou mais itens. (c) Sempre separar | (b) como padrão sugerido (único critério objetivo do Manual), com opção de desligar. **Pergunta ao usuário** |
| C-B9 | Título da lista de siglas | Título da seção 5.13 e desenho Fig. 14: "LISTA DE ABREVIATURAS E SIGLAS"; anotação: "LISTA DE SIGLAS"; modelo REL: "LISTA DE SIGLAS" | (a) Sempre "LISTA DE ABREVIATURAS E SIGLAS". (b) Título conforme o conteúdo | (a) como padrão; (b) como ajuste manual. Baixa gravidade |
| C-B10 | Prenome por extenso ou abreviado | Padrão p. 50 "Prenome"; exemplos misturam extenso (CAGLIARI, Luiz Carlos) e abreviado (PASSOS, L. M. M.) | (a) Manter como digitado. (b) Forçar extenso. (c) Forçar abreviado. (d) Manter, com aviso se a lista não for uniforme | (d). Regra definitiva depende da NBR 6023 (PF-09 a) |
| C-B11 | Folha de aprovação no relatório técnico | Fig. 7 (p. 37): "Monografia/Artigo/Relatório apresentado à UFT ... aprovada ... pela Banca Examinadora"; modelo REL sem folha de aprovação; Manual não define a estrutura do relatório | (a) Relatório com folha de aprovação. (b) Sem folha de aprovação | Depende de o relatório ser avaliado por banca. **Pergunta ao usuário**; sugestão: opcional configurável no perfil "Relatório" |
| C-B12 | Mais de três autores | p. 50, 5.19.1 c: primeiro autor + et al.; exemplos que listam todos: ZUBEN (7 autores, p. 54), DOREA (6, p. 56), FUJIMURA (4, p. 61); exemplos com et al.: LUCKESI, DANTAS, BERTAZZOLI | (a) Sempre "et al." acima de 3. (b) Sempre todos. (c) Configurável, padrão (a) | (c). **Pergunta ao usuário**. Liga-se à chamada no texto (citações, frente A) |
| C-B13 | Margens desenhadas na Fig. 11 (abstract) | Fig. 11, p. 41: marcadores de 3 cm à direita e embaixo; p. 15, 2.2 (RN-002): 2 cm | (a) 2 cm. (b) 3 cm | (a) — erro de figura. Sem decisão do usuário |
| C-B14 | Nota 3 (p. 31): "NBR 14724:2018" e "Quadro 2" | Única menção a 14724:2018 no Manual (as demais citam 2011); o Quadro 2 do Manual é "Obras apresentadas na roda de conversa" (p. 20); o quadro de estrutura é o Quadro 5 | (a) Erro material: perfil cita NBR 14724:2011 e remete ao Quadro 5. (b) Considerar 14724:2018 | (a). Explica o conflito semente C-02. Confirmar com o usuário só se ele tiver outra edição da norma |
| C-B15 | Ordem de elementos que diverge entre padrão e exemplo | Monografia/tese (p. 53): padrão "Centro/Programa, Universidade", exemplo "Universidade Federal do Tocantins, Programa de Pós-Graduação..."; entrevista (p. 58): padrão põe "Entrevistador" no fim, exemplo logo após o título | (a) Seguir a linha-padrão. (b) Seguir o exemplo | (b) para entrevista (coerente com 5.19.9.5); para monografia, **pergunta ao usuário** (efeito: ordem dos nomes da instituição) |
| C-B16 | Destaque em legislação | Padrão p. 59: "JURISDIÇÃO. **Título**, numeração e data"; exemplos: Constituição com título em negrito; leis com negrito no veículo (**Diário Oficial [da] República Federativa do Brasil**); decreto em coletânea sem negrito | (a) Negrito no título/número da lei. (b) Negrito no veículo quando a lei é citada pela publicação oficial; no título quando é obra autônoma | (b): reproduz os exemplos do Manual. **Pergunta ao usuário** |
| C-B17 | Disposição de apêndices/anexos | p. 65–66: título geral centralizado "APÊNDICE"/"ANEXO" e, abaixo, "APÊNDICE A – ..." à esquerda; RN-007 (p. 15): títulos de apêndice(s)/anexo(s) centralizados; modelos: título geral + "apêndice a - TÍTULO" | (a) Página-título geral + cada apêndice com identificação centralizada em folha própria. (b) Como no exemplo: título geral centralizado + identificação à esquerda. (c) Sem título geral; cada "APÊNDICE A – Título" centralizado | (c) é a leitura mais coerente com RN-007; (b) a mais fiel ao exemplo. **Pergunta ao usuário** |

### Divergências Manual × modelos × código

#### Modelos UFT (exemplos; prevalece o Manual)

| ID | Divergência | Onde [VERIFICADO] | Manual | Encaminhamento |
|---|---|---|---|---|
| D-01 | Modelo de **Tese** declara "grau de Mestre (a)" na folha de rosto e "título de Mestre (a)" na folha de aprovação | `analise/modelos_txt/Template de Tese - Atualizado 2022.txt`, linhas 67 e 127 | Fig. 5, p. 34 (Mestre(a)/Doutor(a)); RN-133 | Erro do modelo. O app deve gerar "Doutor(a)" para tese |
| D-02 | Folha de aprovação de DIS/TES: "...apresentada ao Programa de Pós-Graduação em ........ Foi avaliado..." (frase truncada, sem a UFT) | DIS e TES, folha de aprovação | p. 36, 5.6 (natureza, objetivo, instituição) | Texto do app deve incluir a instituição |
| D-03 | Palavras-chave "de três a cinco" | 6 modelos | p. 40 (máx. 4) / anotação (mín. 4) | C-B7 |
| D-04 | Rótulos "Palavras-chaves:" e "Key-words:" | 6 modelos | Fig. 10–11: "Palavras-chave:", "Keywords:" | Usar a grafia das figuras do Manual |
| D-05 | Instrução da dedicatória: "itálico, alinhadas à direita e posicionadas na base da página" | TCC, ART, DIS, TES, REL | p. 38: abaixo do meio, recuo 8 cm, justificado, 12, 1,5 | Prevalece o Manual (RN-146); a formatação real do parágrafo nos modelos já segue o Manual |
| D-06 | "LISTA DE ILUSTRAÇÃO" (singular) | TCC, ART, DIS, TES; desenho da Fig. 12 | p. 15 (2.4), p. 42 (5.11 e anotação): "lista de ilustrações" | Usar "LISTA DE ILUSTRAÇÕES" |
| D-07 | Itens das listas: "Figura 1. Título" (TCC, ART, REL, PRO) ou "Figura 1- Título" (DIS, TES); TCC/ART/REL/PRO trazem página "263" (erro) | Listas dos modelos | Exemplos p. 42–43: "Figura 1 - Título....10"; identificação com travessão (p. 18, frente A) | Usar travessão, como na legenda |
| D-08 | Sumário: TCC rotulado "(MODELO PARA ARTIGO)"; REL "SUMARIO" sem acento; TCC/ART/REL pulam 4.1 (4 → 4.2); só DIS/TES exemplificam a quinária | Sumários dos modelos | p. 46 (5.15; Fig. 16) | Erros de exemplo; sem impacto normativo |
| D-09 | Referências: "Disponível: <URL>"; "(Coord.)"; "Proceedings…"; ";" antes do título (PATTERSON...; HENNESSY, John L.;); espaço antes de ":" ("Porto Alegre :"); separação "12 pontos antes e depois" | 6 modelos, seção REFERÊNCIAS | RN-177, RN-186, RN-189, RN-207 | Prevalece o Manual |
| D-10 | Apêndice/anexo: "apêndice a - TÍTULO" (minúsculas, hífen); "ANEXO A   –   TÍTULO" (espaços extras) | 6 modelos | p. 65–66: "APÊNDICE A – Título" | Prevalece o Manual (RN-231, RN-234) |
| D-11 | Relatório técnico sem folha de aprovação; projeto sem ficha, aprovação, resumo, abstract, dedicatória | REL, PRO | Manual não define REL/PRO | C-B11; PF-12, PF-13 |
| D-12 | Projeto: "PRAGRAMA", "NOME DOS AUTOR (ES)", "Coordenador: Titulação/Nome" | PRO, capa e folha de rosto | — | Erros do modelo |
| D-13 | Capa: "TÍTULO Da monografia" (TCC), "TÍTULO DO relatório técnico" (REL) em caixa mista | TCC, REL | p. 31, 5.1 d: título em caixa alta | Erro do modelo |
| D-14 | "CAMPUS" (TCC, ART, DIS, TES, Fig. 3) × "CÂMPUS" (REL) × "câmpus" (texto 5.1 b); PRO: "CAMPUS DE" | Capas | p. 31 | Grafia a confirmar com o usuário (identidade institucional); baixa gravidade |
| D-15 | Espaçamento do resumo em 1,5 | docx TCC (`w:line=360` no parágrafo do resumo) | p. 16 e p. 40: simples | C-B5 |

#### Código antigo (`analise/sistema_original_extraido/tcc-uft/src/`; prevalece o Manual)

| ID | Divergência | Onde [VERIFICADO] | Manual |
|---|---|---|---|
| D-K1 | Inversão do nome usa só a última palavra como sobrenome ("Roberto da Silva Neto" → "NETO, Roberto da Silva"); a ordenação usa a mesma chave | abnt.js `formatarAutores` e `chaveOrdenacao` (l. 159) | p. 50: "SILVA NETO, Roberto da" (RN-181) |
| D-K2 | Sempre lista todos os autores; nunca usa et al. | abnt.js `formatarAutores` | p. 50 (RN-184; C-B12) |
| D-K3 | Sem autor → "[s.a.]" | abnt.js l. 68 e 136 | p. 51: entrada pelo título (RN-179) |
| D-K4 | Negrito do título removido na exportação DOCX, e também nas linhas 1213 e 1414 (outros formatos) | exports.js l. 572, 1213, 1414 | p. 50 ss. (RN-178) |
| D-K5 | Capítulo: "(org.)" fixo; "In:" sem itálico | abnt.js case 'capitulo' (l. 223) | RN-186, RN-188, RN-200 |
| D-K6 | Evento: "Anais…" sem "[...]" e sem negrito | abnt.js case 'conferencia' (l. 209) | RN-207, RN-209 |
| D-K7 | Trabalho acadêmico: travessão "—" (U+2014); "Dissertação (Mestrado)" sem área; sem programa | abnt.js case 'tese' (l. 218) | RN-206 |
| D-K8 | Legislação: "BRASIL. **Título**. Brasília, ano." sem numeração, data, ementa e publicação | abnt.js case 'lei' (l. 226) | RN-223 |
| D-K9 | Artigo: acrescenta "." ao mês (gera "maio.") | abnt.js case 'artigo' | RN-190 |
| D-K10 | Resumo 150–500 para todos os tipos; palavras-chave 3–5 | abnt.js l. 270–276 (CA-13) | RN-154, RN-155 |
| D-K11 | Palavras-chave separadas por "; "; abstract e keywords em itálico | exports.js l. 201, 209, 213 | RN-156, RN-157 |
| D-K12 | Sumário só até nível 4 | exports.js l. 223 (CA-16) | RN-169 |
| D-K13 | Listas sempre separadas por tipo (FIGURAS, QUADROS, GRÁFICOS, TABELAS) | exports.js l. 234–239 | RN-161, RN-162 (C-B8) |
| D-K14 | Exportação não gera errata, folha de aprovação, dedicatória, agradecimentos nem epígrafe; pré-textuais separados por parágrafo vazio | exports.js l. 693–701 | RN-113 |
| D-K15 | Separação entre referências `after=170` twips (cerca de 8,5 pt) | exports.js l. 577 | RN-177 (uma linha simples) |
| D-K16 | Apêndices de A a J (UI) / A a Z (exportação), sem letras dobradas | CA-08 | RN-232, RN-235 |
| D-K17 | "[s.l.]" minúsculo | abnt.js case 'livro' | Exemplos "[S. l.]" (PF-09 d) |

### PENDENTE-FONTE

| ID | Regra pendente | Pergunta exata | Quem pode responder |
|---|---|---|---|
| PF-01 | Distribuição vertical da capa (RN-125) | A UFT define distâncias/posições (ex.: título no centro da página, local e ano na última linha), ou basta reproduzir a Fig. 3 do Manual? | Usuário / NBR 14724 / biblioteca UFT |
| PF-02 | Brasão na capa (RN-118) | Qual arquivo oficial do brasão usar, em que tamanho, e existe manual de identidade visual da UFT? | Usuário / UFT |
| PF-03 | Lombada (RN-126) | Quais elementos vão na lombada (autor, título, volume, logo?) e em que sentido é escrita? (NBR 12225:2004 não está no projeto) | NBR 12225 licenciada ou biblioteca UFT |
| PF-04 | Alinhamento da banca na folha de aprovação (RN-144) | A anotação da Fig. 7 está cortada após "...espaço 1,5 de entrelinhas e". Os nomes e assinaturas da banca são centralizados (como no desenho) ou alinhados de outra forma? | Biblioteca UFT / usuário |
| PF-05 | Epígrafe (RN-149) | Como a epígrafe é disposta na página (posição vertical, recuo, alinhamento, fonte, indicação de autoria)? O Manual só diz que segue a NBR 10520 | NBR 14724/10520 licenciada ou orientação UFT |
| PF-06 | Rótulo das palavras-chave em espanhol e francês (RN-158) | Que rótulos usar com Resumen e Résumé? | Usuário / NBR 6028 |
| PF-07 | Forma do texto do resumo (RN-159) | O resumo é parágrafo único? Tem recuo de primeira linha? Há exigências de pessoa verbal/conteúdo? Qual edição da NBR 6028 vale (o Manual cita 2003)? | NBR 6028 licenciada / usuário |
| PF-08 | Apresentação do sumário (RN-171) | As entradas reproduzem a tipografia de cada nível (primária negrito maiúsculo ... quinária sublinhada, como na Fig. 16)? Como alinhar indicativos e títulos? Pré-textuais ficam fora do sumário? Referências, apêndices e anexos entram sem indicativo, alinhados aos títulos? | NBR 6027:2012 licenciada |
| PF-09 | Referências — pontos que o Manual não define | (a) Prenome por extenso, abreviado ou ambos; exige uniformidade? (b) Mais de 3 autores: é permitido listar todos? (c) A 1.ª edição é omitida? (d) Grafia e itálico de "[S. l.]" e "[s. n.]"? (e) Datas incertas ("[2016]", "c1991", "ca.")? (f) Título iniciado por artigo ("OS PERIGOS"): artigo e palavra seguinte em maiúsculas? (g) Ordenação de várias obras do mesmo autor e do mesmo ano; substituição do nome repetido por traço? (h) Número de folhas ("222 f.") é obrigatório em monografia/dissertação/tese? (i) Quais elementos complementares (DOI, ISBN, ISSN, séries, notas) são aceitos e em que posição? (j) Padrão para filme/vídeo, site, rede social, software e outros tipos não listados | NBR 6023:2018 licenciada |
| PF-10 | Glossário (RN-230) | Formato da entrada (termo em negrito? dois-pontos? recuo? espaçamento)? | Usuário / NBR 14724 |
| PF-11 | Índice (RN-238) | Formato do índice (colunas, pontuação, subentradas, remissivas)? | NBR 6034:2004 licenciada |
| PF-12 | Estrutura do relatório técnico | Quais elementos são obrigatórios/opcionais e em que ordem (folha de aprovação? ficha?)? | NBR 10719 licenciada ou coordenação |
| PF-13 | Estrutura do projeto de pesquisa | Quais elementos e em que ordem (resumo, cronograma, orçamento, ficha)? | NBR 15287 licenciada ou coordenação |
| PF-14 | Corpo do artigo como TCC | Além dos pré-textuais, como se estrutura o texto do artigo (resumo no corpo? seções? referências ao fim)? | NBR 6022 licenciada ou coordenação |
| PF-15 | Link do TCC em Letras-Libras (RN-115) | Onde e como o link do vídeo-registro é apresentado (seção própria, título, QR code, plataformas aceitas)? | Coordenação de Letras-Libras / biblioteca |

### Amostragem

Releitura no PDF (ferramenta Read, imagem da página) **depois** da redação das linhas, nesta tarefa.
Páginas relidas: 31, 37, 40, 50, 53, 60, 65, 68. Linhas conferidas: 41 de 131 (31 %).

| Página | Linhas conferidas | Resultado |
|---|---|---|
| 31 | RN-111, RN-112, RN-114, RN-116, RN-117, RN-118, RN-119, RN-120, RN-121, RN-122, RN-123 | Confere (Quadro 5 sem ficha; 5.1 a–e; nota 3 com "14724:2018" e "Quadro 2") |
| 37 | RN-140, RN-141, RN-142, RN-143, RN-144 | Confere (anotação "maiúsculas, sem negrito"; caixa da banca cortada após "e") |
| 40 | RN-150, RN-151, RN-152, RN-153, RN-154, RN-155, RN-156 | Confere ("no máximo quatro" × "no mínimo quatro"; "entrelinhamento simples" × anotação 1,5) |
| 50 | RN-176, RN-180, RN-181, RN-183, RN-184, RN-185, RN-194, RN-195 | Confere ("et al" sem ponto no texto; linha-padrão com **Título**) |
| 53 | RN-191, RN-204, RN-205, RN-206 | Confere (padrão Programa → Universidade; exemplo Universidade → Programa; sem número de folhas) |
| 60 | RN-223, RN-224 | Confere (negrito no Diário Oficial nas leis; Constituição com título em negrito) |
| 65 | RN-231, RN-232, RN-233, RN-237 | Confere (título geral centralizado; "APÊNDICE A –" à esquerda) |
| 68 | RN-239, RN-240 | Confere |

Além disso, todas as páginas 30–72 foram vistas como imagem durante a extração. Isso foi necessário porque
as figuras-modelo e o negrito/itálico das referências não aparecem no texto extraído.

### Cobertura

| Seção do sumário do Manual (p. 9–10) | Página | IDs | Observação |
|---|---|---|---|
| 5 Estrutura dos trabalhos acadêmicos da UFT (Quadro 5, Letras-Libras, artigo) | 30–31 | RN-110 a RN-116 | |
| 5.1 Capa | 31–32 | RN-117 a RN-125 | |
| 5.2 Lombada | 33 | RN-126 | PENDENTE-FONTE |
| 5.3 Folha de rosto | 33–34 | RN-127 a RN-134 | |
| 5.4 Ficha catalográfica | 34–35 | RN-135 a RN-137 | |
| 5.5 Errata | 35–36 | RN-138, RN-139 | |
| 5.6 Folha de aprovação | 36–37 | RN-140 a RN-144 | |
| 5.7 Dedicatória | 38 | RN-145, RN-146 | |
| 5.8 Agradecimentos | 39 | RN-147, RN-148 | |
| (Epígrafe: só no Quadro 5 e nas p. 15/17) | 30, 17 | RN-149 | Formatação: PF-05 |
| 5.9 Resumo | 40 | RN-150 a RN-156, RN-159 | |
| 5.10 Resumo em língua estrangeira | 41 | RN-157, RN-158 | |
| 5.11 Lista de ilustrações | 42 | RN-160 a RN-162 | |
| 5.12 Lista de tabelas | 43 | RN-163, RN-164 | Regras de tabela: frente da Fonte I |
| 5.13 Lista de abreviaturas e siglas | 44 | RN-165, RN-166 | |
| 5.14 Lista de símbolos | 45 | RN-167 | |
| 5.15 Sumário | 46 | RN-168 a RN-171 | |
| 5.16 Introdução | 47 | RN-172 | |
| 5.17 Desenvolvimento | 48 | RN-173 | |
| 5.18 Considerações finais e/ou conclusões | 49 | RN-174 | |
| 5.19 Referências (regras gerais) | 49–50 | RN-175 a RN-193 | RN-177 pode duplicar regra da frente A (p. 17) |
| 5.19.1 Livros com autoria (a–d) | 50–51 | RN-194 a RN-198 | |
| 5.19.2 Livros com autoria desconhecida | 51 | RN-199 | |
| 5.19.3 / 5.19.3.1 Capítulo de livro | 51–52 | RN-200, RN-201 | |
| 5.19.4 / 5.19.4.1 Verbete | 52 | RN-202, RN-203 | |
| 5.19.5 Livro traduzido | 52–53 | RN-204 | |
| 5.19.6 Livros na internet / e-books | 53 | RN-191, RN-205 | |
| 5.19.7 Monografia, dissertação e tese | 53 | RN-206 | |
| 5.19.8 Anais e eventos (a–d) | 53–55 | RN-207 a RN-210 | |
| 5.19.9 Periódicos / 5.19.9.1 Coleção inteira | 55 | RN-211 | |
| 5.19.9.2 Artigo de periódico (a–c) | 55–56 | RN-212 a RN-214 | |
| 5.19.9.3 Artigo de jornal (a–d) | 56–58 | RN-215 a RN-218 | A nota 4 (p. 57), que recomenda citação indireta para material eletrônico sem paginação, é tema de citações (frente A) |
| 5.19.9.4 Entrevista de jornal | 58 | RN-219 | |
| 5.19.9.5 Entrevistas orais | 58 | RN-220 | |
| 5.19.9.6 Correspondências | 58–59 | RN-221 | |
| 5.19.9.7 Normas técnicas | 59 | RN-222 | |
| 5.19.9.8 Documento jurídico (a–b) | 59–61 | RN-223, RN-224 | |
| 5.19.9.9 Patente | 61–62 | RN-225 | |
| 5.19.9.10 Fotografias, desenhos etc. | 62 | RN-226 | |
| 5.19.9.11 Documentos cartográficos | 62 | RN-227 | |
| 5.19.9.12 Documento audiovisual | 62–63 | RN-228 | |
| 5.19.9.13 Documento tridimensional | 63 | RN-229 | |
| 6 Glossário | 64 | RN-230 | |
| 7 Apêndice | 65 | RN-231 a RN-233, RN-237 | |
| 8 Anexo | 66 | RN-234 a RN-237 | |
| 9 Índice | 67 | RN-238 | Formato: PF-11 |
| 10 Normas para entrega / 10.1 Asten | 68 | RN-239, RN-240 | |
| 11 Considerações finais | 69 | — | Excluída: texto institucional, sem regra formal |
| Referências do Manual | 70–71 | — | Excluída: lista bibliográfica do próprio Manual; usada só como evidência de RN-177/RN-178 e PF-09 (h) |
| Anexo – Abreviatura dos meses | 72 | RN-190 | |
| p. 73 | 73 | — | Página só com o número |

## Apêndice C — Frente C — Tabelas, Norma Tabular do IBGE (RN-241–RN-312)


Frente C da Etapa 3. Produzido pelo `especialista-normas`. IDs provisórios `T-xxx` (a sessão principal renumera para `RN-xxx`).

**Fontes normativas usadas**

- **I** = IBGE. *Normas de apresentação tabular*. 3. ed. Rio de Janeiro: IBGE, 1993. Arquivo
  `materiais/normas/NORMAS DE APRESENTAÇÃO TABULAR.pdf` (nível 1-T). **Página citada = página impressa.**
  No corpo da norma (PDF p. 8–35) a página impressa é a do PDF menos 1. **No Anexo B o deslocamento muda:**
  PDF p. 41 traz o rodapé "45" (PDF + 4), porque o escaneamento omitiu as páginas em branco. No Anexo A
  (PDF p. 36–39) não há número impresso legível; cito "Anexo A".
- **M** = UFT. *Manual de normalização…* 2. ed. 2022 (nível 1). Página impressa = página do PDF (conferido nas p. 15–20 e 42–43).

**Exemplos usados (nível 4/5, não são norma):** modelos UFT 2022 (`analise/modelos_txt`, `analise/modelos_docx`,
cópias **convertidas** dos `.doc`); guia "Ilustrações e tabelas" da Biblioteca da FURB, 2025
(`202502071521040.Ilustracoes e Tabelas`); apresentação da FURB (`furb_elementos_apoio.txt`); estudo Capcom (DOCX original);
código antigo `analise/sistema_original_extraido/tcc-uft`.

Convenções: `[VERIFICADO p. X]` = página relida nesta tarefa (imagem do PDF ou texto paginado). `[HIPÓTESE]` = não conferido.
Twips: 240 = espaço simples; 360 = 1,5. `w:sz` em meios-pontos (20 = 10 pt; 24 = 12 pt).

---

### Regras novas

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status | Observações |
|---|---|---|---|---|---|---|
| RN-241 | Tabela é a forma não discursiva de apresentar informações em que o **dado numérico** é a informação central. Para o Manual, a tabela é **aberta** (colunas, linhas e células); o quadro (formado por linhas horizontais e verticais) é **fechado**. Conteúdo predominantemente textual vai para Quadro, não para Tabela | I, p. 9, seção 3.1; M, p. 19, seção 2.8.1 e p. 20, seção 2.9 | Classificação do elemento (Tabela × Quadro) | Aviso se um elemento do tipo Tabela tiver menos de 50% de células de dados numéricas ou com sinal convencional (heurística; o limite é técnico, não é norma) | CONFIRMADA | [VERIFICADO I p. 9; M p. 19–20]. O IBGE não define "quadro"; a distinção vem do Manual (que cita Oliveira, 2007). Os modelos UFT repetem a distinção (dados quantitativos × qualitativos). O código antigo deixa o usuário escolher livremente o rótulo (components.js:944, 990–991) |
| RN-242 | A tabela tem três espaços: **topo** (número e título), **centro** (moldura, cabeçalho, colunas indicadoras e de dados, linhas, células) e **rodapé** (fonte, nota geral, nota específica) | I, p. 10–11, seções 3.2–3.2.3; Anexo A | Todas as tabelas | Modelo de dados: parágrafo de título **antes** de `w:tbl`; fonte e notas em parágrafos **depois** de `w:tbl`, nunca dentro de células | CONFIRMADA | [VERIFICADO p. 10–11 em texto]. No modelo TCC UFT, a fonte fica dentro de uma tabela de layout invisível junto com a tabela (ver Divergências) |
| RN-243 | A tabela deve ter **número**, no topo, sempre que o documento tiver **duas ou mais** tabelas | I, p. 12, seção 4.1 | Todas as tabelas | Se houver ≥ 2 tabelas, todo título começa por `Tabela n` | CONFLITO | [VERIFICADO p. 12]. Ver **C-C2** (tabela única). Recomendação: numerar sempre |
| RN-244 | Identificação em **algarismos arábicos**, em ordem **crescente**, precedidos da palavra **Tabela**. A numeração pode ser contínua no documento (Tabela 2) ou subordinada ao capítulo (Tabela 16.3 = 3.ª tabela do capítulo 16). O Manual confirma a palavra "tabela" e a posição superior | I, p. 12–13, seção 4.1.1; M, p. 20, seção 2.9 | Todas as tabelas | Texto do título com regex `^Tabela \d+(\.\d+)?`; campo `SEQ Tabela \* ARABIC` (ou `SEQ Tabela \s 1` se for por capítulo); sequência sem lacunas nem repetições | CONFIRMADA | [VERIFICADO p. 12–13]. Numeração por capítulo é **opção** da norma; os modelos UFT e o estudo Capcom usam numeração contínua. Padrão sugerido: contínua, com a outra opção no perfil (decisão técnica, sem efeito normativo) |
| RN-245 | A apresentação do número deve seguir a NB 69 (Numeração progressiva das seções de um documento) | I, p. 13, seção 4.1.2 | Numeração subordinada a capítulos | — | PENDENTE-FONTE | NB 69 não está no projeto. O exemplo "16.3" da própria norma já basta para a forma `capítulo.ordem`. [HIPÓTESE] NB 69 corresponde hoje à NBR 6024 (o Manual cita NBR 6024:2012 na p. 16), mas a correspondência não foi conferida |
| RN-246 | A tabela deve ter **título**, no **topo**, indicando a **natureza** e as abrangências **geográfica** e **temporal** dos dados numéricos | I, p. 13, seção 4.2; M, p. 20, seção 2.9 (identificação na parte superior) | Todas as tabelas | Título não vazio, acima de `w:tbl`. Aviso (não erro) se o título não tiver referência temporal (ano, período) ou geográfica: verificação semântica, só como alerta | CONFIRMADA | [VERIFICADO p. 13]. Em trabalhos experimentais ou de laboratório pode não existir "abrangência geográfica". O validador deve **alertar**, não bloquear. Os modelos UFT seguem a regra ("Série histórica (1997-2001) da produção de carne de frango no Brasil") |
| RN-247 | A natureza e a abrangência geográfica vão **por extenso, sem abreviações**, de forma clara e concisa | I, p. 13, seção 4.2.1 | Título | Aviso para siglas e abreviações no título (regex: palavras de 2 ou mais letras maiúsculas; abreviaturas com ponto) | CONFIRMADA | [VERIFICADO p. 13]. Tensão com a regra de siglas do Manual (p. 18, seção 2.7: sigla por extenso na 1.ª ocorrência e depois só a sigla). No título da tabela, o IBGE manda escrever por extenso |
| RN-248 | A abrangência temporal vai de forma clara e concisa e pode seguir o capítulo 5 (séries temporais) | I, p. 14, seção 4.2.2 | Título | Ver RN-278 a RN-281 | CONFIRMADA | [VERIFICADO p. 14] |
| RN-249 | A natureza do dado é composta pelo **tipo** (absoluto ou relativo) mais o **fato observado**. É dispensável indicar o tipo quando a tabela só tem números absolutos | I, p. 14, seção 4.2.3 e Nota | Título | Não automatizável (alerta opcional se houver coluna com `%` e o título não mencionar "relativo"/"percentual") | CONFIRMADA | [VERIFICADO p. 14] |
| RN-250 | A abrangência geográfica é o nome próprio do espaço de referência, complementado, quando necessário, pelas unidades político-administrativas de nível maior. A abrangência temporal é o ponto no tempo ou a série temporal de referência | I, p. 14, seções 4.2.4–4.2.5 | Título | Não automatizável | CONFIRMADA | [VERIFICADO p. 14] |
| RN-251 | A tabela deve ter **moldura** com **no mínimo três traços horizontais paralelos**: o 1.º separa o topo (acima do cabeçalho), o 2.º separa o espaço do cabeçalho (abaixo do cabeçalho) e o 3.º separa o rodapé (abaixo da última linha) | I, p. 14, seção 4.3; p. 15, seção 4.3.1 | Todas as tabelas | `w:tblBorders/w:top` ≠ `none`; borda inferior (`w:tcBorders/w:bottom`) em todas as células da última linha de cabeçalho; `w:tblBorders/w:bottom` ≠ `none` (ou `w:bottom` nas células da última linha) | CONFIRMADA | [VERIFICADO p. 15]. Na pré-visualização, o código antigo desenha os 3 traços (visual-editor.js:646–670); o DOCX desenha a grade completa (ver Divergências) |
| RN-252 | Traços **verticais** só são acrescentados quando for preciso **destacar parte do cabeçalho ou dos dados** | I, p. 15, seção 4.3.2 (exemplos: Anexo B, Tabelas 3, 5, 6, 7, 9, 10, 11, 12, 14, 15) | Todas as tabelas | Padrão: `w:tblBorders/w:insideV` = `none`. Traço vertical interno só com opção explícita por coluna (`w:tcBorders/w:start` ou `w:end`) | CONFIRMADA | [VERIFICADO p. 15]. Os modelos UFT (cópia convertida) trazem traço vertical entre todas as colunas; o DOCX do código antigo também |
| RN-253 | Traços **horizontais internos** além dos três obrigatórios (por exemplo, entre todas as linhas de dados) | I, p. 15, seção 4.3.1 ("no mínimo três") e Anexo B | Todas as tabelas | Padrão proposto: `w:insideH` = `none` no corpo; permitir traço horizontal no cabeçalho para agrupar colunas (como nas Tabelas 5, 10, 11 e 12 do Anexo B) | AMBÍGUA | Leitura (a): "no mínimo" admite traços extras. Leitura (b): o texto só prevê os 3 traços e os verticais de destaque, e os exemplos do Anexo B nunca usam traço entre linhas de dados. Recomendação: (b) como padrão, com (a) como opção do usuário. Os modelos UFT têm traço entre todas as linhas (cópia convertida) |
| RN-254 | A moldura **não** tem traços verticais nas laterais esquerda e direita (tabela aberta) | I, p. 15, seção 4.3.3; M, p. 20, seção 2.9 ("abertas") | Todas as tabelas | `w:tblBorders/w:left`(`w:start`) e `w:right`(`w:end`) = `none`/`nil`; nenhuma célula da 1.ª coluna com `w:tcBorders/w:start` visível e nenhuma da última com `w:end` visível | CONFIRMADA | [VERIFICADO I p. 15; M p. 20]. Manual e IBGE **concordam**. Violada pelo código antigo (exports.js:274–294: quatro bordas em toda célula) [VERIFICADO no código; também na auditoria CA-12] |
| RN-255 | A tabela deve ter **cabeçalho** no espaço do cabeçalho, indicando o conteúdo das colunas com palavras ou notações, de forma clara e concisa; recomenda-se escrever por extenso, sem abreviações | I, p. 15, seções 4.4–4.4.2 | Todas as tabelas | ≥ 1 linha de cabeçalho no modelo; essas linhas levam `w:trPr/w:tblHeader`; aviso para abreviações (4.4.2 é recomendação) | CONFIRMADA | [VERIFICADO p. 15]. Negrito no cabeçalho **não** está na norma: é escolha gráfica (modelos UFT usam negrito; IBGE, Capcom e FURB não) |
| RN-256 | A tabela deve ter **indicadores de linha** nas **colunas indicadoras**, com palavras ou notações, de forma clara e concisa (por extenso recomendado). A coluna indicadora tem cabeçalho próprio | I, p. 15–16, seção 4.5 e 4.5.1–4.5.2; Anexo A ("cabeçalho das colunas indicadoras") | Todas as tabelas | 1.ª coluna (ou colunas indicadoras declaradas) não numérica; célula de cabeçalho da coluna indicadora não vazia (aviso) | CONFIRMADA | [VERIFICADO p. 15]. No impresso o título "4.5" saiu sem o número (p. 15), mas o sumário (p. 6) confirma que é 4.5. O exemplo do Manual (p. 20) e a Tabela 1 do IBGE trazem cabeçalho na coluna indicadora ("Situação do domicílio") |
| RN-257 | Quando preciso, a **unidade de medida** vai no espaço do cabeçalho ou nas colunas indicadoras, com símbolo ou palavra **entre parênteses** (ex.: (t) ou (tonelada); (m) ou (metro)) | I, p. 16, seções 4.6 e 4.6.1 | Tabelas com grandezas | Aviso se o cabeçalho de coluna numérica não tiver `\(.+\)` e o título também não indicar unidade | CONFIRMADA | [VERIFICADO p. 16 em texto]. O modelo UFT usa "(ton)" no cabeçalho e "(em toneladas)" no título; o IBGE usa "t" ou "tonelada" (ver RN-259) |
| RN-258 | Quando os dados forem divididos por uma constante, ela é indicada entre parênteses e precede a unidade: (1 000 t); (%) para proporção a cem; (‰) ou (por mil); (1/1000) | I, p. 16–17, seção 4.6.2 | Tabelas com dados escalonados | Regex no cabeçalho: `\((\d[\d ]*\s?)?[^)]+\)` | CONFIRMADA | [VERIFICADO p. 17 em texto] |
| RN-259 | Unidades de medida seguem a Resolução do CONMETRO (Quadro Geral de Unidades de Medida); unidades e combinações que não constam nela são escritas com base na forma que ela estabelece (ex.: t/km; hab/km²) | I, p. 17, seções 4.6.3–4.6.4; p. 9, seção 2 | Tabelas com grandezas | — | PENDENTE-FONTE | A Resolução CONMETRO não está no projeto. Os símbolos (t, km², %) não podem ser validados sem ela |
| RN-260 | A tabela deve ter **dados numéricos** nas células, em **algarismos arábicos** | I, p. 17, seção 4.7; p. 18, seção 4.7.1 | Todas as tabelas | Cada célula de dados casa com regex numérica (`^-?\d{1,3}([ .]\d{3})*(,\d+)?$` ou similar, conforme RN-261) **ou** com um sinal convencional (RN-263) | CONFIRMADA | [VERIFICADO p. 18]. Como célula vazia não é sinal previsto, deve gerar aviso (interpretação de 4.7 + 4.8; ver RN-263) |
| RN-261 | A grafia dos números (separador decimal e agrupamento de milhares) segue a Resolução do CONMETRO – Quadro Geral de Unidades de Medida | I, p. 18, seção 4.7.2 | Todas as tabelas | — | PENDENTE-FONTE | Resolução não fornecida. Exemplos do IBGE (Anexo B): vírgula decimal e milhares separados por **espaço** ("117 960 301", p. 45). Modelos UFT e estudo Capcom usam **ponto** ("3.811.569"). O efeito visível é grande; ver pergunta P-C3 |
| RN-262 | Um **sinal convencional** vai na célula sempre que for preciso substituir um dado numérico | I, p. 18, seção 4.8 | Todas as tabelas | Ver RN-263 | CONFIRMADA | [VERIFICADO p. 18] |
| RN-263 | Sinais convencionais, lista fechada: **-** dado igual a zero que não resulta de arredondamento; **..** não se aplica dado numérico; **...** dado não disponível; **X** dado omitido para evitar individualização da informação; **0 / 0,0 / 0,00** zero resultante de arredondamento de dado originalmente positivo; **-0 / -0,0 / -0,00** zero resultante de arredondamento de dado originalmente negativo | I, p. 18, seção 4.8.1 | Todas as tabelas | Célula não numérica ∈ {`-`, `..`, `...`, `X`/`x`}; aviso para célula vazia ou com outros textos ("n/d", "—", "s/d") | CONFIRMADA | [VERIFICADO p. 18, imagem]. O texto traz "X" maiúsculo; os exemplos (Tabela 14, p. 60) usam "x" minúsculo. Glifo do traço: ver RN-264. O estudo Capcom usa "—" para "valor nulo" e célula vazia para "linha inexistente" (o IBGE usaria `-` e `..`) |
| RN-264 | Caractere do sinal "dado igual a zero" (traço) | I, p. 18, seção 4.8.1; exemplos Anexo B, p. 46, 58, 60 | Todas as tabelas | Normalizar na entrada: o usuário digita `-` e o motor grava o caractere escolhido | AMBÍGUA | Na seção 4.8.1 o sinal aparece datilografado como hífen; nos exemplos tipografados ele é um traço mais longo, centrado na célula, distinto do sinal de menos de "-0,08" (p. 49). Leituras: hífen U+002D; meia-risca U+2013. Recomendação: meia-risca "–" para o sinal e hífen ou menos tipográfico para números negativos, como configuração de perfil |
| RN-265 | Os sinais convencionais usados em uma tabela são explicados em **nota geral**, cada um com seu significado. A nota é dispensável quando a publicação apresenta os sinais e significados em destaque | I, p. 19, seção 4.8.2 e Nota | Tabelas com sinais | Se o corpo tiver um sinal de RN-263, a nota geral deve conter "Sinal convencional utilizado"/"Sinais convencionais utilizados" e a explicação de cada sinal usado (forma dos exemplos, p. 46, 49, 58–60) | CONFIRMADA | [VERIFICADO p. 19, imagem]. A dispensa ("em destaque na publicação") pode corresponder a uma "Lista de símbolos" pré-textual (M p. 15, seção 2.4). Essa equivalência é interpretação ([HIPÓTESE]); padrão recomendado: nota em cada tabela |
| RN-266 | A tabela leva **chamada**, em qualquer de seus espaços, sempre que um elemento precisar remeter a uma nota específica | I, p. 19, seção 4.9 | Tabelas com notas específicas | Ver RN-267, RN-268 e RN-275 | CONFIRMADA | [VERIFICADO p. 19] |
| RN-267 | Chamada em **algarismos arábicos em destaque**: entre parênteses, entre colchetes ou exponencial | I, p. 19, seção 4.9.1 | Tabelas com notas específicas | Regex `\(\d+\)` ou `\[\d+\]`, ou run com `w:vertAlign="superscript"` contendo só dígitos | CONFIRMADA | [VERIFICADO p. 19]. Os exemplos do Anexo B usam parênteses: "(1)", "(2) 42,74" (p. 50). Recomendação técnica: padrão entre parênteses, para não confundir com a chamada de nota de rodapé do texto, que é sobrescrita. As três formas são válidas |
| RN-268 | Havendo várias chamadas, numeram-se em ordem **crescente**, de **cima para baixo** e da **esquerda para a direita** | I, p. 19, seção 4.9.2 | Tabelas com ≥ 2 chamadas | Percorrer título → cabeçalho → linhas (cada linha da esquerda para a direita) e verificar a sequência 1..n | CONFIRMADA | [VERIFICADO p. 19] |
| RN-269 | A tabela deve ter **fonte**, a partir da **primeira linha do rodapé**, identificando o responsável (pessoa física ou jurídica) ou os responsáveis pelos dados | I, p. 20, seção 4.10 | Todas as tabelas | 1.º parágrafo após `w:tbl` começa por `Fonte` ou `Fontes` | CONFIRMADA | [VERIFICADO p. 20, imagem]. A dispensa prevista na Nota de 4.10 está em RN-273 |
| RN-270 | A fonte é escrita com palavras e precedida da palavra **Fonte** ou **Fontes** | I, p. 20, seção 4.10.1 | Todas as tabelas | Regex `^Fontes?:\s` (dois-pontos conforme RN-271); aviso se houver mais de um responsável (separados por ";" ou " - ") e a palavra estiver no singular | CONFIRMADA | [VERIFICADO p. 20]. O texto do IBGE não fixa o sinal depois de "Fonte". Os exemplos usam ":" (p. 45, 46, 49) e às vezes "–" (p. 57, 59). O Manual usa ":" em todos os exemplos (p. 17, 19, 20) |
| RN-271 | Recomenda-se identificar a fonte **por extenso** | I, p. 20, seção 4.10.2 | Todas as tabelas | Aviso se a fonte tiver só sigla | CONFIRMADA | [VERIFICADO p. 20]. É recomendação ("recomenda-se"). Interage com a forma da chamada autor-data: ver **C-C4** |
| RN-272 | Recomenda-se que, com dados extraídos de um documento, a fonte indique a **referência bibliográfica** do documento | I, p. 20, seção 4.10.3 (exemplos: Tabelas 13 e 14, p. 59–60) | Tabelas com dados de terceiros | — | CONFLITO | [VERIFICADO p. 20]. Ver **C-C4** (referência completa × autor-data) |
| RN-273 | Se os dados resultarem de **transformação** dos dados da fonte, quem fez a operação é identificado em **nota geral ou nota específica** | I, p. 20, seção 4.10.4 | Tabelas com dados calculados ou adaptados | Não automatizável; o editor oferece o campo "dados transformados por…", que gera nota | CONFIRMADA | [VERIFICADO p. 20]. Os modelos UFT põem a transformação na própria fonte ("Fonte: Adaptado de Autor(a) (Ano).") e o estudo Capcom faz o mesmo ("elaborado pelo autor com base em…"). Pelo IBGE, isso vai em nota |
| RN-274 | Dispensa da fonte em cada tabela quando todas as tabelas da publicação vêm de **uma única fonte** já identificada na própria publicação | I, p. 20, seção 4.10, Nota | Trabalho inteiro | — | CONFLITO | [VERIFICADO p. 20]. Ver **C-C3** (o Manual exige fonte nas ilustrações mesmo quando são produção do autor) |
| RN-275 | **Nota geral**, quando necessária, vai no rodapé **logo após a fonte**, de forma clara e concisa, precedida de **Nota** ou **Notas** | I, p. 20, seção 4.11; p. 21, seção 4.11.1 | Tabelas com nota geral | Regex `^Notas?:\s`; o parágrafo vem depois do de Fonte; "Notas" quando houver mais de um esclarecimento (exemplos p. 49, 50, 56, 58) | CONFIRMADA | [VERIFICADO p. 20–21, imagem]. Nos exemplos, notas gerais múltiplas aparecem em linhas próprias (p. 58) ou numeradas 1, 2, 3 (p. 56) |
| RN-276 | **Nota específica** vai no rodapé, **após a nota geral** (se houver), precedida da respectiva chamada. Notas múltiplas seguem a ordem das chamadas e são **separadas uma da outra por ponto** | I, p. 21, seções 4.12–4.12.2 | Tabelas com chamadas | Cada chamada do corpo tem nota correspondente e vice-versa; mesma sequência; cada nota termina em "." | CONFIRMADA | [VERIFICADO p. 21, imagem]. Os exemplos mostram as notas em sequência num mesmo parágrafo (p. 50) ou uma por linha (p. 59–60): as duas formas são compatíveis |
| RN-277 | Ordem obrigatória do rodapé: **Fonte → Nota(s) geral(is) → Notas específicas** | I, p. 20–21, seções 4.10, 4.11, 4.12 (decorre de "a partir da primeira linha", "logo após a fonte", "logo após a nota geral") | Todas as tabelas | Ordem dos parágrafos após `w:tbl` | CONFIRMADA | [VERIFICADO p. 20–21]. O guia FURB 2025 insere "Legenda:" entre Fonte e Notas, o que não está previsto no IBGE |
| RN-278 | Pontos no tempo seguem a NB 113 (Normas para datar) | I, p. 21, seção 5.1; p. 9, seção 2 | Datas em tabelas | — | PENDENTE-FONTE | NB 113 não está no projeto. Os exemplos usam "01.09.1980", "OUT 1991", "30.05.1991" (p. 22, 59) |
| RN-279 | Série temporal **consecutiva**: pontos inicial e final ligados por **hífen** (1981-1985; OUT 1991-MAR 1992; 30.05.1991-06.06.1991) | I, p. 21–22, seção 5.2 | Título, cabeçalho e indicadores | Regex `\d{4}-\d{4}` com hífen U+002D (o texto diz "hífen (-)"); aviso para "a" ou "–" em série consecutiva | CONFIRMADA | [VERIFICADO p. 21, imagem]. O modelo UFT "(1997-2001)" está conforme |
| RN-280 | Série temporal **não consecutiva**: pontos inicial e final ligados por **barra** (1981/1985). Com poucos pontos, pode-se listar todos separados por vírgula (1988, 1990, 1991) | I, p. 22–23, seção 5.3 e Nota | Título, cabeçalho e indicadores | Não totalmente automatizável: depende de saber se há lacuna. Se as colunas de ano tiverem lacunas e o título usar hífen → aviso | CONFIRMADA | [VERIFICADO p. 22–23 em texto]. Exemplo do Anexo B: "Brasil - 1940/1980" (p. 50) |
| RN-281 | Safra de dois anos: dois últimos algarismos de cada ano ligados por barra e precedidos de **Safra** (Safra 91/92) | I, p. 23, seção 5.4 | Tabelas agrícolas | Regex `Safra \d{2}/\d{2}` | CONFIRMADA | [VERIFICADO p. 23 em texto]. Pouco frequente; implementar só como validação |
| RN-282 | Período anual diferente do ano civil: indicar no título, em nota geral ou em nota específica | I, p. 23, seção 5.5 | Tabelas com anos fiscais ou letivos | Não automatizável | CONFIRMADA | [VERIFICADO p. 23 em texto]. O estudo Capcom (exercícios encerrados em 31/03) indica isso no título, como pede a regra |
| RN-283 | Classe de frequência, sem ambiguidade, por extenso ou por notação. Inclui o extremo inferior e exclui o superior: "w a menos de z" ou "w ⊢ z". Exclui o inferior e inclui o superior: "mais de w a z" ou "w ⊣ z". Inclui ambos: "w a z" ou "w ⊢⊣ z" | I, p. 23–24, seções 6–6.3 | Tabelas de distribuição de frequência | Aviso para classes ambíguas nos indicadores (ex.: "10-20", "10 – 20") | CONFIRMADA | [VERIFICADO p. 24, imagem]. Os glifos ⊢ ⊣ são aproximações dos traços com barra do impresso (p. 24). A escolha do caractere Unicode é técnica e cabe ao `especialista-elementos-visuais` |
| RN-284 | Recomenda-se que as classes inicial e final sejam **fechadas**, evitando "até z", "menos de z", "w ou mais" e "mais de w" | I, p. 24, seção 6.4 | Distribuições de frequência | Aviso por regex nessas expressões | CONFIRMADA | [VERIFICADO p. 24, imagem]. Recomendação, não obrigação |
| RN-285 | Dados arredondados devem ser indicados em **nota geral ou específica**, e o arredondamento deve respeitar as diferenças significativas entre os dados | I, p. 25, seção 7 e 7.1 | Tabelas com arredondamento | Se o app arredondar, gerar a nota "Dados numéricos arredondados." (forma do exemplo, p. 49) | CONFIRMADA | [VERIFICADO p. 25 em texto] |
| RN-286 | Regra de arredondamento: se o 1.º algarismo abandonado for 0–4, o último mantido fica inalterado; se for 5–9, soma-se uma unidade ao último mantido | I, p. 25–26, seções 7.2–7.3 | Arredondamento feito pelo app | Teste unitário com os exemplos da norma: 9,2377 → 9 / 9,2 / 9,24; 21,0509 → 21,05; 399,85 → 400 / 399,9 | CONFIRMADA | [VERIFICADO p. 25–26 em texto]. Nota técnica: `Number.toFixed` do JavaScript erra em casos binários (ex.: 1,005). Implementar com aritmética decimal |
| RN-287 | Se a soma das parcelas arredondadas divergir do total arredondado: (a) nota geral explicando a divergência; ou (b) corrigir a parcela com menor valor absoluto da razão (original − corrigido)/original | I, p. 26–27, seção 7.4 | Tabelas com linha de total | Se houver linha "Total" marcada: comparar a soma com o total e alertar | CONFIRMADA | [VERIFICADO p. 26–27 em texto]. Exemplo de nota na Tabela 12 (p. 58) |
| RN-288 | Zero resultante de arredondamento aparece como 0 / 0,0 / 0,00 ou -0 / -0,0 / -0,00, conservando o sinal do dado original, para distingui-lo do zero absoluto (sinal "-") | I, p. 28, seção 7.5 | Tabelas com arredondamento | Arredondamento que zera um valor não pode gerar "-" | CONFIRMADA | [VERIFICADO p. 28, imagem]. Erro de remissão no original: 7.5 remete à "seção 4.8.2", mas os sinais estão em 4.8.1 |
| RN-289 | Tabela que ultrapassa a página em linhas e/ou colunas é apresentada em **duas ou mais partes** | I, p. 28, seção 8 | Tabelas grandes | Detectada na paginação (pós-renderização) | CONFIRMADA | [VERIFICADO p. 28, imagem] |
| RN-290 | Muitas linhas e poucas colunas: o centro pode ser dividido em partes **lado a lado** na mesma página, separadas por **traço vertical duplo** e com o cabeçalho repetido | I, p. 28, seção 8.1 (exemplos: Tabelas 3 e 6) | Tabelas longas e estreitas | `w:tcBorders/w:end` (ou `w:start`) com `w:val="double"` na divisão; células de cabeçalho repetidas | CONFIRMADA | [VERIFICADO p. 28 e exemplo p. 47–49]. É faculdade ("pode") |
| RN-291 | Muitas colunas e poucas linhas: o centro pode ser dividido em partes **uma abaixo da outra** na mesma página, repetindo o cabeçalho das colunas indicadoras e os indicadores de linha | I, p. 28, seção 8.2 (exemplos: Tabelas 2, 4 e 10) | Tabelas largas | Repetição da coluna indicadora em cada parte; nos exemplos, as partes são separadas por traço horizontal duplo (`w:val="double"`) | CONFIRMADA | [VERIFICADO p. 28 e exemplos p. 46, 50, 56]. O traço duplo entre partes vem só dos exemplos |
| RN-292 | Tabela em mais de uma página: **cada página** repete o conteúdo do **topo** (número e título) e o **cabeçalho** (da tabela ou da parte) | I, p. 29, seção 8.3 a | Tabelas que quebram página | Cabeçalho: `w:trPr/w:tblHeader` nas linhas de cabeçalho. Título: o Word não repete parágrafo; é preciso dividir a tabela por página ou incluir o título numa linha de cabeçalho sem bordas | CONFIRMADA | [VERIFICADO p. 29, imagem]. O guia FURB 2025 só repete o cabeçalho (sem título) na página de continuação; o estudo Capcom usa só `tblHeader` [VERIFICADO no XML]. O código antigo não usa nenhum dos dois |
| RN-293 | Cada página leva a indicação **continua** (1.ª), **continuação** (intermediárias) ou **conclusão** (última) | I, p. 29, seção 8.3 b | Tabelas que quebram página | Parágrafo `(continua)`/`(continuação)`/`(conclusão)` acima do traço superior, `w:jc="right"` (forma dos exemplos) | CONFIRMADA | [VERIFICADO p. 29 e exemplos p. 47–49]. O texto fixa só as palavras. Parênteses, minúsculas e alinhamento à direita entre o título e o traço superior vêm do Anexo B. O guia FURB segue a mesma forma |
| RN-294 | Cada página leva as colunas indicadoras e seus cabeçalhos | I, p. 29, seção 8.3 c | Tabelas que quebram página | Implícito em `tblHeader` + estrutura de linhas; nas partes lado a lado, verificar a repetição | CONFIRMADA | [VERIFICADO p. 29]. A Nota sobre páginas confrontantes está em Exclusões |
| RN-295 | O traço horizontal que separa o rodapé aparece **só na página que contém a última linha** da tabela | I, p. 29, seção 8.3 d | Tabelas que quebram página | Sem `insideH` no corpo; borda inferior só na última linha (`w:tcBorders/w:bottom` da última `w:tr`) | CONFIRMADA | [VERIFICADO p. 29]. [HIPÓTESE] O Word desenha `w:tblBorders/w:bottom` apenas no fim da tabela, sem repetir na quebra. Testar na Etapa 5 |
| RN-296 | O conteúdo do rodapé (fonte e notas) aparece **só na página de conclusão** | I, p. 29, seção 8.3 e | Tabelas que quebram página | Parágrafos de Fonte/Nota só depois do último `w:tbl` da tabela dividida | CONFIRMADA | [VERIFICADO p. 29] |
| RN-297 | Recomenda-se que a tabela caiba em **uma única página** | I, p. 30, seção 9.1 | Todas as tabelas | Aviso pós-renderização quando a tabela quebrar página | CONFIRMADA | [VERIFICADO p. 30, imagem]. Recomendação. O modelo UFT impede a quebra com uma tabela de layout invisível, o que contraria RN-292 a RN-296 quando a tabela não cabe numa página |
| RN-298 | Recomenda-se mais células com dado numérico do que com sinal convencional | I, p. 30, seção 9.2 | Todas as tabelas | Contar células: aviso se sinais ≥ dados | CONFIRMADA | [VERIFICADO p. 30] |
| RN-299 | Recomenda-se que a classificação **outros/outras** indique dado proporcionalmente inferior aos das demais classificações | I, p. 30, seção 9.3 | Tabelas com categoria residual | Aviso se a linha "Outros/Outras" for maior que alguma outra categoria | CONFIRMADA | [VERIFICADO p. 30] |
| RN-300 | Recomenda-se **uniformidade gráfica** entre as tabelas do trabalho: corpo e tipo de letras e números, maiúsculas e minúsculas, sinais gráficos | I, p. 30, seção 9.4 | Trabalho inteiro | Todas as tabelas usam os mesmos estilos (ex.: `TabelaTitulo`, `TabelaCabecalho`, `TabelaCorpo`, `TabelaFonte`); sem formatação direta divergente | CONFIRMADA | [VERIFICADO p. 30] |
| RN-301 | A Norma Tabular preserva o direito do editor de seguir suas preferências estéticas na escolha de recursos gráficos e tipologias. Por isso, fonte, tamanho, negrito e alinhamento **não** são fixados pelo IBGE e cabem ao Manual UFT (ou ao usuário, se o Manual for omisso) | I, p. 7–8, Prefácio | Regra de precedência | — | CONFIRMADA | [VERIFICADO p. 7–8 em texto; PDF p. 8–9]. Base para tratar C-C1 e C-C5 como questões do Manual, e não como conflito Manual × IBGE (política, regra 3.4) |
| RN-302 | Separador entre "Tabela n" e o título: **travessão** (o Manual define isso para ilustrações: número em arábicos, travessão e título) | M, p. 18, seção 2.8; exemplos M p. 20 (tabelas do IBGE com "–") e p. 43 (lista de tabelas com "–" e "-"); I, Anexo B, p. 45–60 ("Tabela 1 – …") | Título de tabela | Regex `^Tabela \d+(\.\d+)? – \S` (espaço, meia-risca U+2013, espaço) | AMBÍGUA | [VERIFICADO M p. 18, 20, 43; I p. 45]. O IBGE não fixa o separador no texto, só nos exemplos. Ambiguidades: (1) a seção 2.8 trata de ilustrações, e a 2.9 (tabelas) não repete a exigência; (2) caractere: no texto extraído do Manual, 42 legendas usam U+2013 e 8 usam hífen; o código antigo usa U+2014 (exports.js:319). Modelos UFT: hífen na legenda e ponto na lista ("Tabela 1."); o texto do modelo TCC manda separar "por ponto". Recomendação: "Tabela 1 – Título", com U+2013 |
| RN-303 | Tamanho da fonte do **título** da tabela | M, p. 15, seção 2.1 ("10 para … legenda das ilustrações, tabelas e quadros"); M, p. 19 (anotação do exemplo: "Título da figura tamanho 12 / Espaço simples"; "Fonte da figura tamanho 10") | Título de tabela | `w:sz` do estilo `TabelaTitulo` (24 ou 20) | AMBÍGUA | Ver **C-C5**. Afeta a leitura de RN-001 |
| RN-304 | Fonte (tipo) 10 na fonte e nas notas da tabela ("legenda") | M, p. 15, seção 2.1; M, p. 19 (anotação "Fonte da figura tamanho 10") | Rodapé da tabela | `w:sz="20"` no estilo `TabelaFonte`/`TabelaNota` | CONFIRMADA | [VERIFICADO M p. 15, 19]. IBGE silente (RN-301). Concordam o guia FURB, o estudo Capcom e o código antigo (10 pt) |
| RN-305 | **Alinhamento do título** da tabela | M, p. 17, Quadro 1 ("Títulos das ilustrações das tabelas — centralizada — simples"); M, p. 20 (exemplos de tabela alinhados à esquerda, com recuo deslocado); I, Anexo B (Tabela 1 à esquerda, p. 45; Tabelas 2–14 centralizadas, p. 46–60) | Título de tabela | `w:jc="center"` (opção A) ou `w:jc="left"` + `w:ind w:hanging` (opção B) no estilo `TabelaTitulo` | AMBÍGUA | Ver **C-C1**. Contribui para resolver **RN-015** quanto a tabelas |
| RN-306 | Título da tabela e fonte/notas em **espaço simples** | M, p. 16, seção 2.6 d; p. 17, Quadro 1 | Título e rodapé | `w:spacing w:line="240" w:lineRule="auto"` nos estilos `TabelaTitulo`, `TabelaFonte`, `TabelaNota` | CONFIRMADA | [VERIFICADO M p. 16–17]. O modelo TCC UFT usa 1,5 (`w:line="360"`) nas legendas das Tabelas 1 e 2 (cópia convertida) |
| RN-307 | Fonte e notas (rodapé) **alinhadas à esquerda** | M, p. 17, Quadro 1 ("Fontes e legendas — esquerda — simples"); I, Anexo B (todas as fontes alinhadas à esquerda da moldura) | Rodapé da tabela | `w:jc="left"`/`"start"` (ou ausente) em `TabelaFonte`/`TabelaNota` | CONFIRMADA | [VERIFICADO M p. 17; I p. 45–60]. Manual e IBGE concordam. O código antigo centraliza a fonte (exports.js:356–360; ODT; PDF); o estudo Capcom justifica (`both`) |
| RN-308 | Deixar **uma linha** antes da tabela e outra **depois do rodapé** (o Manual diz "depois da legenda") | M, p. 16, seção 2.6 c | Tabelas | `w:spacing w:before` no título e `w:after` no último parágrafo do rodapé equivalentes a uma linha | AMBÍGUA | [VERIFICADO M p. 16]. Pontos ambíguos: (1) "antes das ilustrações": antes do título ou entre o título e a tabela? Os exemplos do Manual (p. 19–20) deixam o espaço antes do título; (2) altura da "linha": simples (12 pt ≈ 240 twips) ou 1,5. Recomendação: uma linha simples antes do título e uma depois do último parágrafo do rodapé. Também coordenar com a frente A (ilustrações) |
| RN-309 | Lista de tabelas (opcional): relação das tabelas na ordem do texto, com o enunciado e a página **em que se encontram ou iniciam**. As tabelas são padronizadas conforme a Norma Tabular do IBGE, **edição atual** | M, p. 43, seção 5.12 | Pré-textual; todas as tabelas | Campo `TOC \c "Tabela"` (já usado no código antigo); página = página de início da tabela dividida | CONFIRMADA | [VERIFICADO M p. 43]. A estrutura da lista é da frente B. Aqui interessa: (1) tabela dividida aparece **uma vez**, com a página inicial. O guia FURB 2025 lista também "(continua)" e "(conclusão)", o que diverge do Manual; (2) "edição atual": ver P-C1 |
| RN-310 | Título da tabela **sem ponto final** | Nenhum texto normativo; exemplos unânimes: I, Anexo B, p. 45–60; M, p. 19–20, 43 | Título de tabela | Aviso se o título terminar em "." | PENDENTE-FONTE | O texto normativo é silente. Modelos UFT (texto do modelo TCC: "não se coloca o ponto final… no final do título") e FURB concordam. Ver P-C5 |
| RN-311 | Tamanho e entrelinha do **conteúdo** da tabela (cabeçalho, indicadores, dados) | Nem o Manual nem o IBGE fixam (RN-301) | Corpo da tabela | `w:sz` e `w:spacing` do estilo `TabelaCorpo` | PENDENTE-FONTE | Exemplos: modelo TCC UFT (texto: "pode ser feita em fonte 11 ou 10"); FURB 10; Capcom 9; código antigo 10 no DOCX e 11 na pré-visualização; Anexo B do IBGE em corpo menor que o texto. Ver P-C2 |
| RN-312 | Alinhamento dos dados numéricos nas células | Nenhum texto normativo; I, Anexo B (números alinhados à direita, cabeçalhos centralizados, indicadores à esquerda, p. 45–60) | Corpo da tabela | `w:jc="right"` nas células numéricas (ou tabulação decimal `w:tab w:val="decimal"`) | PENDENTE-FONTE | O texto normativo é silente; o padrão vem dos exemplos. Capcom: dados à direita, cabeçalho centralizado. Modelo UFT e código antigo: tudo centralizado. Ver P-C4 |

---

### Conflitos

> Pela política (regra 3.4), só é "conflito" o desacordo Manual × IBGE em matéria de tabela. Quando um dos dois é
> silente, ou quando o desacordo é interno ao Manual, a questão é tratada como **AMBÍGUA** (regra 3.3). Ainda assim,
> a questão vai ao usuário quando muda o resultado visível.

#### C-C1 — Alinhamento do título da tabela (contribui para RN-015) — AMBÍGUA (Manual interno; IBGE silente)

- **Evidência:** o Quadro 1 do Manual (p. 17) diz "Títulos das ilustrações das tabelas — **centralizada** — simples"
  [VERIFICADO]. O exemplo de tabela do Manual (p. 20) reproduz as Tabelas 1 e 9 do IBGE com o título **à esquerda**,
  alinhado à margem da tabela, com recuo deslocado nas linhas seguintes [VERIFICADO, imagem]. Os exemplos de figuras e
  quadros do Manual (p. 19–20) estão centralizados. O IBGE só diz "inscrito no topo" (p. 13); o Anexo B mistura as duas
  formas (Tabela 1 à esquerda, p. 45; Tabelas 2–14 centralizadas, p. 46–60), e o Prefácio deixa a escolha gráfica ao
  editor (p. 7–8). Não há, portanto, conflito Manual × IBGE: a decisão é do Manual, que é internamente ambíguo.
  A redação do Quadro 1 ("Títulos das ilustrações das tabelas") parece erro de digitação de "das ilustrações e das tabelas" [HIPÓTESE].
- **Opção A — centralizado** (texto do Quadro 1). Efeito: "Tabela 1 – Título…" centralizado sobre a tabela; nas
  linhas seguintes do título, todas as linhas ficam centralizadas.
- **Opção B — à esquerda, alinhado à margem da tabela, com recuo deslocado** (exemplo da p. 20, IBGE Tabela 1, guias
  FURB, estudo Capcom). Efeito: título começa rente à esquerda; a 2.ª linha começa sob a 1.ª letra do título.
- **Recomendação:** **A** como padrão do perfil UFT 2022: o texto normativo explícito prevalece sobre a imagem
  reproduzida, e é coerente com as figuras e quadros do próprio Manual. **B** fica como opção de perfil.
  Para RN-015, a parte "títulos centralizados" é sustentada pelo Quadro 1. A divergência vem dos modelos e do
  exemplo da p. 20, não do texto. **Pergunta ao usuário: P-C6.**

#### C-C2 — Número em trabalho com uma só tabela — conflito aparente, resolvível sem decisão editorial

- **IBGE:** número obrigatório "sempre que um documento apresentar duas ou mais tabelas" (p. 12, seção 4.1).
- **Manual:** a identificação "aparece na parte superior, precedida da palavra tabela" (p. 20, seção 2.9). Para
  ilustrações, há sempre número de ordem (p. 18, seção 2.8). Não há exceção para tabela única.
- **Opção A — numerar sempre** ("Tabela 1 – …"). Atende às duas fontes: o IBGE não proíbe numerar a tabela única.
- **Opção B — omitir o número** quando houver uma só tabela. Atende ao IBGE, mas não à leitura literal do Manual.
- **Recomendação:** **A**. Só informar o usuário, sem pedir decisão.

#### C-C3 — Dispensa da fonte na tabela

- **IBGE:** "Toda tabela deve ter fonte" (p. 20, seção 4.10), mas a Nota de 4.10 a dispensa quando todas as tabelas
  vêm de uma única fonte já identificada na publicação.
- **Manual:** para ilustrações, a fonte é "elemento obrigatório, mesmo que seja produção do próprio autor" (p. 18,
  seção 2.8). Na seção 2.9 (tabelas) o Manual não repete a regra, mas os exemplos sempre trazem fonte (p. 20).
  O guia FURB diz que "nem sempre terá fonte" (dados primários). Esse guia é exemplo e não prevalece.
- **Opção A — fonte sempre obrigatória** em toda tabela (inclusive "Fonte: elaborada pelo autor (ano)." ou
  "Fonte: dados da pesquisa (ano)."). Efeito: toda tabela termina com a linha "Fonte: …".
- **Opção B — admitir a dispensa do IBGE** quando o trabalho declarar a fonte única (ex.: na metodologia). Efeito:
  tabelas sem a linha de fonte.
- **Recomendação:** **A**. Atende ao Manual e à regra principal do IBGE; a dispensa do IBGE é faculdade, não
  obrigação. Pergunta P-C7, só para confirmar.

#### C-C4 — Forma da identificação da fonte: referência completa (IBGE) × chamada autor-data (Manual)

- **IBGE:** recomenda escrever a fonte por extenso (4.10.2) e, quando os dados vêm de um documento, indicar a
  **referência bibliográfica** (4.10.3). Exemplos: "Fonte - Sinopse Preliminar do Censo Demográfico 1991. Roraima,
  Amapá. Rio de Janeiro: IBGE n.º 4, 31p." (p. 59); "Fonte: IBGE, Diretoria de Pesquisas, …" (p. 56–58) (p. 20).
- **Manual:** todos os exemplos usam **chamada autor-data** ("Fonte: Nascimento (2014).", "Fonte: Pereira Junior
  (2019).", p. 19–20), com a referência completa na lista de Referências.
- **Opção A — chamada autor-data** ("Fonte: Instituto Brasileiro de Geografia e Estatística (2020)." ou
  "Fonte: IBGE (2020)."), com a referência completa nas Referências. Efeito: rodapé curto, igual ao das figuras.
- **Opção B — referência completa no rodapé** (forma do IBGE). Efeito: rodapé longo, com a referência repetida.
- **Opção C — combinar:** autor-data no rodapé + referência completa nas Referências + nome da entidade por extenso
  na chamada (atende a 4.10.2).
- **Recomendação:** **A** (com a entidade grafada como na chamada definida para o texto). As regras 4.10.2–4.10.3 do
  IBGE são recomendações ("recomenda-se"), e o Manual adota autor-data. **Dependência:** a grafia da chamada
  (CAIXA ALTA ou não, sigla ou nome por extenso) depende de **C-01** (NBR 10520:2002 × 2023), da frente A/B.
  Pergunta P-C8.

#### C-C5 — Tamanho da fonte do título da tabela (afeta RN-001) — AMBÍGUA (Manual interno)

- **Evidência:** M p. 15 (2.1): tamanho 10 para "legenda das ilustrações, tabelas e quadros". M p. 17 (Quadro 1)
  separa "Títulos das ilustrações…" de "Fontes e legendas". M p. 19: o exemplo anotado diz "Título da figura
  **tamanho 12**, espaço simples" e "Fonte da figura **tamanho 10**" [VERIFICADO, imagem].
- **Leitura A — título 12; fonte e notas 10:** "legenda" (2.1) = textos explicativos abaixo do elemento, como sugere
  o Quadro 1. Efeito: o título tem o tamanho do texto, e o rodapé fica menor.
- **Leitura B — título e rodapé em 10:** "legenda" = toda a identificação. Assim faz o código antigo (CA-09) e o
  estudo Capcom (`TabelaTitulo` sz 20). Efeito: tudo o que cerca a tabela fica menor que o texto.
- **Recomendação:** **A**. É a única leitura com indicação explícita de tamanho para o título (p. 19); FURB e o
  guia FURB 2025 também usam título 12. Ajustar RN-001 para dizer "fonte e notas (legendas) em 10; título em 12".
  Coordenar com a frente A, porque vale também para figuras e quadros. Pergunta P-C9.

---

### Divergências Manual/IBGE × modelos × código

#### Modelos UFT 2022 (TCC, Artigo, Dissertação, Tese, Relatório técnico, Projeto) — nível 4, exemplos

Fonte: `analise/modelos_txt/*` e XML de `analise/modelos_docx/Modelo de TCC de graduação - Atualizado 2022.docx`.
É uma **cópia convertida do .doc**: a conversão pode ter alterado bordas e espessuras. [VERIFICADO no XML da cópia; não conferido no .doc original.]

| Ponto | Modelo | Norma | Regra |
|---|---|---|---|
| Separador do título | "Tabela 1 - Exemplo" (hífen); na lista "Tabela 1." (TCC, Artigo, Projeto, Relatório) ou "Tabela 1-" (Dissertação, Tese); o texto do modelo diz "separados por ponto" | Travessão (M 2.8) | RN-302 |
| Alinhamento do título | Tabela 1 `jc=center`; Tabela 2 sem `jc` (herda o estilo `WW-Legenda`) | Centralizado (Quadro 1) | RN-305 / C-C1 |
| Entrelinha do título | `w:line="360"` (1,5) | Simples | RN-306 |
| Traços | Bordas `top`/`bottom` em todas as células e `start`/`end` internos: grade sem laterais. O texto do modelo diz "sem linhas verticais nas laterais", com traço superior, inferior e do cabeçalho "mais espessos" e cabeçalho em negrito | Sem laterais (conforme); verticais só para destaque; horizontais internos ambíguos | RN-252, RN-253, RN-254 |
| Unidade | "(ton)" no cabeçalho e "(em toneladas)" no título | Símbolo entre parênteses (t), conforme CONMETRO | RN-257, RN-259 |
| Números | Milhares com ponto (3.811.569) | Pendente (CONMETRO); o IBGE usa espaço nos exemplos | RN-261 |
| Alinhamento dos dados | Células centralizadas | Exemplos do IBGE: à direita | RN-312 |
| Fonte | "Fonte: Adaptado de Autor(a) (Ano)." | Transformação em nota (4.10.4) | RN-273 |
| Paginação | Tabela dentro de uma tabela de layout invisível que impede a quebra | Tabela grande deve quebrar com continua/conclusão | RN-292–RN-297 |
| Corpo | "pode ser feita em fonte 11 ou 10" | Sem norma | RN-311 |

#### Guia "Ilustrações e tabelas" — Biblioteca Universitária FURB, 2025 (nível 5)

- Título "Tabela 1 – Título" em 12 pt [VERIFICADO no XML: `sz=24`], estilo "Lista de tabelas"; "(continua)" e
  "(continuação)" alinhados à direita (`jc=end`) logo abaixo do título; cabeçalho com `tblHeader` só na 1.ª parte;
  corpo em 10 pt.
- Texto: "As tabelas são formadas por linhas verticais, deve-se manter as bordas laterais abertas". A 1.ª frase
  contradiz o IBGE 4.3.1 (traços horizontais) e é, provavelmente, erro de redação [HIPÓTESE].
- Rodapé na ordem "Fonte → Legenda → Notas": "Legenda" não está no IBGE (RN-277).
- A lista de tabelas traz linhas "(continua)" e "(conclusão)" (diverge de M p. 43, RN-309).
- Cita ABNT NBR 14724:2024 (4. ed.). Indica uma edição mais recente que a 2011 citada no Manual. Registrar para
  as frentes A/B; não é fonte para nós.

#### Apresentação FURB "Tabelas, quadros e figuras" (nível 5)

- "Tabela" alinhada à esquerda, título após **hífen**, só a 1.ª letra maiúscula, sem ponto final, Arial 12, espaço
  simples. Fonte e nota em 10, simples. Diz que "nem sempre terá fonte" (dados primários): diverge da opção
  recomendada em C-C3.

#### Estudo Capcom (nível 5; só apresentação)

[VERIFICADO no XML de `materiais/referencias_visuais/12-estudo-capcom-jgaap-brasil-japao.docx`]

- Estilo `TabelaTitulo`: **alinhado à esquerda**, **10 pt**, simples, `keepNext`, 12 pt antes (opção B de C-C1 e leitura B de C-C5).
- Moldura conforme RN-251/RN-254: só três traços (topo e base do cabeçalho; base da última linha), laterais `none`,
  sem traços internos. Cabeçalho com `w:tblHeader` em todas as 77 tabelas/quadros.
- Corpo em 9 pt; números alinhados à direita; cabeçalho centralizado (como os exemplos do IBGE, RN-312).
- Milhares com ponto (32.553); "—" (travessão) para "valor nulo na fonte" e **célula em branco** para "linha
  inexistente", explicados em nota. O IBGE usaria "-" e ".." (RN-263/RN-264).
- Fonte **justificada** (`both`), 10 pt; "Nota:" depois da fonte (ordem conforme RN-277).
- Quadros com grade completa (fechados), conforme M p. 19.

#### Código antigo `tcc-uft` (nível 5)

[VERIFICADO em `src/exports.js` e `src/visual-editor.js`]

| Ponto | Código | Norma | Regra |
|---|---|---|---|
| Bordas no DOCX | `tabelaDocx`: `top/bottom/left/right` em **todas** as células, cinza `666666`, `size: 2` (exports.js:274–294) | Aberta; 3 traços | RN-251, RN-252, RN-254 |
| Bordas na pré-visualização | 3 traços (topo 1,5 px, base do cabeçalho 1 px, base 1,5 px), sem laterais (visual-editor.js:645–670) | Conforme | RN-251, RN-254 |
| Inconsistência | A pré-visualização mostra uma tabela que o DOCX não gera | — | — |
| Cabeçalho repetido | Não usa `tableHeader`/`w:tblHeader` | Exigido | RN-292 |
| continua/conclusão | Inexistente | Exigido | RN-293 |
| Alinhamento das células | Tudo centralizado (exports.js:281) | Exemplos do IBGE: dados à direita | RN-312 |
| Título | `Caption` centralizado, 10 pt, "Tabela SEQ — Título" com **U+2014** (exports.js:311–321) | Centralizado (A); tamanho ambíguo; travessão (caractere a definir) | RN-302, RN-303, RN-305 |
| Fonte | Centralizada, 10 pt; padrão "Elaborado pelos autores." (exports.js:356–360) | Esquerda | RN-307 |
| PDF/ODT | Tabela emitida como texto com " \| " (exports.js:1125–1134, 1317–1326) | Não é tabela | RN-251 em diante |
| Notas, chamadas, sinais | Sem suporte | — | RN-263–RN-277 |
| Pré-visualização do corpo | 11 pt (DOCX 10 pt) | Sem norma | RN-311 |

---

### PENDENTE-FONTE

| ID | Pergunta exata | A quem |
|---|---|---|
| RN-245 | A NB 69 (Numeração progressiva) citada pelo IBGE 1993 corresponde hoje à ABNT NBR 6024? Há algo nela sobre a forma do número da tabela além do exemplo "16.3"? (Na prática o exemplo basta; baixa prioridade.) | Usuário / norma licenciada |
| RN-259, RN-261 | Qual a Resolução CONMETRO vigente sobre o Quadro Geral de Unidades de Medida e a grafia de números (separador decimal, **separação de milhares por espaço ou por ponto**)? Pode fornecer o texto ou uma orientação escrita da biblioteca da UFT? | Usuário |
| RN-278 | O que a NB 113 (Normas para datar), citada pelo IBGE, determina para datas em tabela (ex.: "01.09.1991", "OUT 1991")? Existe norma ABNT vigente equivalente e disponível? | Usuário / norma licenciada |
| RN-310 | Título da tabela sem ponto final: aceita como convenção (todos os exemplos do Manual e do IBGE são assim) ou há orientação escrita? | Usuário |
| RN-311 | Que tamanho de fonte e entrelinha usar **dentro** da tabela (cabeçalho, indicadores, dados)? O Manual e o IBGE não fixam. Exemplos: 10 (FURB), 11 ou 10 (modelo UFT), 9 (Capcom). | Usuário (decisão editorial) |
| RN-312 | Alinhamento dos números: à direita (como nos exemplos do IBGE), por vírgula decimal, ou centralizado (como no modelo UFT)? | Usuário (decisão editorial) |

#### Perguntas ao usuário (consolidadas)

- **P-C1:** O Manual (p. 43) manda seguir a Norma Tabular "edição atual". O arquivo fornecido é a 3. ed. (1993). Ela é a edição atual, ou existe edição mais recente a fornecer?
- **P-C2:** Tamanho e entrelinha do conteúdo das tabelas (RN-311). Sugestão: 10 pt, espaço simples.
- **P-C3:** Separador de milhares: espaço "117 960 301" (exemplos do IBGE) ou ponto "117.960.301" (modelos UFT)? (RN-261)
- **P-C4:** Alinhamento dos números (RN-312). Sugestão: à direita.
- **P-C5:** Título sem ponto final (RN-310). Sugestão: sim.
- **P-C6:** Título da tabela centralizado (Quadro 1) ou à esquerda com recuo deslocado (exemplo da p. 20)? (C-C1; recomendação: centralizado)
- **P-C7:** Fonte obrigatória em toda tabela, mesmo com dados próprios? (C-C3; recomendação: sim)
- **P-C8:** Fonte da tabela em chamada autor-data ou com referência completa no rodapé? (C-C4; recomendação: autor-data)
- **P-C9:** Título da tabela em 12 e rodapé em 10, ou tudo em 10? (C-C5; recomendação: título 12, rodapé 10)
- **P-C10 (baixa prioridade):** Traços horizontais entre as linhas de dados: proibidos por padrão (recomendado) ou permitidos? (RN-253) Caractere do sinal de zero: "–" ou "-"? (RN-264)

---

### Exclusões justificadas

| Item do IBGE | Motivo |
|---|---|
| Apresentação, Prefácio (exceto o princípio de liberdade gráfica, RN-301), Bibliografia, Índice (p. 4–8, 31–34) | Texto institucional ou instrumental, sem regra de formatação |
| Definições 3.2.2.2–3.2.2.4 e 3.3.1–3.3.13 como linhas próprias (p. 10–12) | São definições; foram incorporadas às regras que as usam (RN-242, RN-251 a RN-276) |
| 2 Documentos complementares (p. 9) | As remissões geram as pendências RN-245, RN-259/RN-261 e RN-278 |
| Nota de 8.3 c — páginas **confrontantes** sem colunas indicadoras na página da direita, com colunas de número de ordem nas extremidades (p. 29) | Supõe impressão frente e verso com páginas espelhadas, layout de publicação; o perfil de trabalho acadêmico não prevê esse arranjo. Reavaliar se a frente A confirmar impressão em anverso e verso com páginas espelhadas |
| Nota de 4.8.2 — publicação com quadro de sinais em destaque (p. 19) | **Não excluída**: mantida em RN-265 como opção ambígua (lista de símbolos) |
| Nota de 4.10 — dispensa da fonte em publicação de fonte única (p. 20) | **Não excluída**: tratada como conflito C-C3 |
| Exemplos de conteúdo do Anexo B (unidades monetárias como cruzeiro real, dados censitários) | Conteúdo ilustrativo; só a forma foi usada, como observação |
| Anexo A (representação gráfica dos espaços) | Didático; usado como apoio a RN-242 e RN-256 |

---

### Amostragem

72 linhas; meta de 20% = 15 linhas. Páginas relidas na **imagem do PDF** nesta tarefa (Read com `pages`), com o
rodapé impresso conferido:

| Página impressa (PDF) | Linhas conferidas |
|---|---|
| I p. 12 (PDF 13) | RN-243, RN-244 |
| I p. 13 (PDF 14) | RN-244, RN-245, RN-246, RN-247 |
| I p. 14 (PDF 15) | RN-248, RN-249, RN-250 |
| I p. 15 (PDF 16) | RN-251, RN-252, RN-253, RN-254, RN-255, RN-256 |
| I p. 18 (PDF 19; esta página não tem texto no arquivo extraído, só imagem) | RN-260, RN-262, RN-263, RN-264 |
| I p. 19 (PDF 20) | RN-265, RN-266, RN-267, RN-268 |
| I p. 20 (PDF 21) | RN-269, RN-270, RN-271, RN-272, RN-274 |
| I p. 21 (PDF 22) | RN-275, RN-276, RN-277, RN-279 |
| I p. 24 (PDF 25) | RN-283, RN-284 |
| I p. 28 (PDF 29) | RN-288, RN-289, RN-290, RN-291 |
| I p. 29 (PDF 30) | RN-292 a RN-296 |
| I p. 30 (PDF 31) | RN-297 a RN-300 |
| I Anexo B p. 45–51 e 56–60 (PDF 41–47, 52–56) | Observações de RN-263, RN-270, RN-276, RN-293, RN-305, RN-312 |
| M p. 15–20 e 42–43 (PDF = impressa) | RN-241, RN-302 a RN-309, C-C1, C-C5 |

Total: mais de 45 das 72 linhas conferidas na imagem da página. As demais (RN-257–RN-259, RN-278, RN-280–RN-282,
RN-285–RN-287, RN-301) foram conferidas no texto paginado, com o rodapé impresso verificado.

**Achados da amostragem:**
1. A página impressa 18 (PDF 19) **não tem texto** em `ibge_tabular_paginado.txt`. As regras 4.7.1, 4.7.2, 4.8 e 4.8.1 (sinais convencionais) só existem na imagem e foram transcritas daqui. Recomenda-se OCR ou registro manual na extração.
2. No Anexo B a regra "impressa = PDF − 1" **não vale** (PDF 41 = p. 45).
3. Erro de remissão no original: 7.5 remete a "4.8.2" em vez de 4.8.1 (p. 28).
4. O título "4.5 Indicador de linha" saiu sem número no impresso (p. 15).

---

### Cobertura

| Seção do IBGE (página impressa) | IDs |
|---|---|
| Prefácio (p. 7–8) | RN-301 |
| 1 Objetivo; 2 Documentos complementares (p. 9) | Exclusões; RN-245, RN-259, RN-261, RN-278 |
| 3.1 Tabela (p. 9) | RN-241 |
| 3.2 Espaços: topo, centro, cabeçalho, coluna, linha, célula, rodapé (p. 10–11) | RN-242 |
| 3.3 Elementos (p. 11–12) | Incorporados em RN-242, RN-251–RN-277 |
| 4.1 Número; 4.1.1; 4.1.2 (p. 12–13) | RN-243, RN-244, RN-245 |
| 4.2 Título; 4.2.1–4.2.5 (p. 13–14) | RN-246–RN-250 |
| 4.3 Moldura; 4.3.1–4.3.3 (p. 14–15) | RN-251–RN-254 |
| 4.4 Cabeçalho (p. 15) | RN-255 |
| 4.5 Indicador de linha (p. 15–16) | RN-256 |
| 4.6 Unidade de medida; 4.6.1–4.6.4 (p. 16–17) | RN-257–RN-259 |
| 4.7 Dado numérico; 4.7.1–4.7.2 (p. 17–18) | RN-260, RN-261 |
| 4.8 Sinal convencional; 4.8.1–4.8.2 (p. 18–19) | RN-262–RN-265 |
| 4.9 Chamada; 4.9.1–4.9.2 (p. 19) | RN-266–RN-268 |
| 4.10 Fonte; 4.10.1–4.10.4; Nota (p. 20) | RN-269–RN-274 |
| 4.11 Nota geral (p. 20–21) | RN-275, RN-277 |
| 4.12 Nota específica (p. 21) | RN-276, RN-277 |
| 5 Apresentação de tempo; 5.1–5.5 (p. 21–23) | RN-278–RN-282 |
| 6 Classe de frequência; 6.1–6.4 (p. 23–24) | RN-283, RN-284 |
| 7 Arredondamento; 7.1–7.5 (p. 25–28) | RN-285–RN-288 |
| 8 Diagramação; 8.1–8.3 (p. 28–29) | RN-289–RN-296; Exclusões (Nota de 8.3 c) |
| 9 Recomendações gerais; 9.1–9.4 (p. 30) | RN-297–RN-300 |
| Bibliografia; Índice (p. 31–34) | Exclusões |
| Anexo A (p. 35 ss.) | RN-242, RN-256 (apoio) |
| Anexo B — Tabelas 1–15 (p. 43 ss.) | Observações de RN-263, RN-264, RN-270, RN-276, RN-291, RN-293, RN-305, RN-312 |

| Trecho do Manual sobre tabelas | IDs |
|---|---|
| M p. 15, seção 2.1 (fonte 10 nas legendas) | RN-303, RN-304, C-C5 |
| M p. 16, seção 2.6 c–d | RN-306, RN-308 |
| M p. 17, Quadro 1 | RN-305, RN-306, RN-307, C-C1 |
| M p. 18, seção 2.8 (travessão; fonte obrigatória) | RN-302, C-C3 |
| M p. 19, seção 2.8.1 (quadro fechado) e anotações do exemplo | RN-241, RN-303, C-C5 |
| M p. 20, seção 2.9 (tabelas abertas; identificação superior com a palavra Tabela) | RN-241, RN-244, RN-246, RN-254, C-C1, C-C2 |
| M p. 43, seção 5.12 (lista de tabelas; Norma Tabular, edição atual) | RN-309, P-C1 |
