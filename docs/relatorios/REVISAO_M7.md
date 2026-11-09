# Revisão de segurança, qualidade e fidelidade normativa — fechamento do marco M7

- **Data:** 2026-11-08
- **Escopo:** commits `907c981` (M7-T00) a `bc43c7c` (M7-T04): verificações do texto (`dominio/verificador/texto.ts`),
  da Norma Tabular (`tabelas.ts`), consolidação, família e local legível (`conformidade.ts`), janela
  `interface/escrever/Conformidade.tsx`, regras novas no perfil e o aceite do RF-15.
- **Executado por:** dois revisores independentes, rodados em paralelo como agentes gerais, só de leitura; as sondas
  ficaram fora do repositório e foram apagadas.
  - Segurança, integridade e desempenho: papel de `.claude/agents/revisor-seguranca.md`, com medições no código real.
  - Fidelidade normativa: papel de `.claude/agents/especialista-normas.md`; conferiu as páginas do IBGE (p. 13–30 e
    Anexo B, Tabelas 6 e 7) e do Manual (p. 15, 17, 20, 23, 28) como imagem.
- **Correções, testes e consolidação:** sessão principal.
- **Skill:** `revisao-seguranca-qualidade`.

## Resumo

| Revisão | Crítica | Alta | Média | Baixa | Info |
|---|---|---|---|---|---|
| Segurança e integridade (R-M7) | 0 | 0 | 0 | 3 | 5 |
| Normativa (N-M7) | — | 0 | 6 | 5 | 1 |

- Nada bloqueia o fechamento.
- **Corrigidos:** R-M7-01 a 04; N-M7-01 (com N-M7-06), N-M7-02 a 05, 07, 08, 09, 11, 12; a maior parte de N-M7-13.
- **Abertos:** R-M7-05 a 08 (informativos), N-M7-10 (parte da meia-risca) e parte de N-M7-13.

## Medições do revisor de segurança [VERIFICADO pelo revisor]

- Expressões regulares com 1 MB de entrada adversarial: todas lineares; pior caso 98 ms (aspas retas alternadas).
- Documento de 150 páginas: `avaliarConformidade` em 6–9 ms; com 2.000 tabelas defeituosas, corte em 5.000 itens com
  `LIMITE_RELATORIO` em 50 ms. Cada tabela gera no máximo 10 itens: o limite global basta.
- O verificador não muda o documento (JSON idêntico antes e depois).

## Segurança e integridade

| Id | Grav. | Achado | Situação |
|---|---|---|---|
| R-M7-01 | Baixa | Número extremo (Infinity, acima de 2^53, 17+ casas) dava total divergente falso ou escondia o verdadeiro | **Corrigido:** `numero()` descarta valor não finito, com mais de 6 casas ou além de 2^53; teste novo |
| R-M7-02 | Baixa | NEL (U+0085) passava pelo filtro de quebras do `.txt` | **Corrigido:** o filtro tira todo controle C0/C1 e os de direção bidi; teste com célula forjada |
| R-M7-03 | Baixa | Célula de 1 MB entrava inteira na mensagem e no local | **Corrigido:** texto do usuário cortado em 80 caracteres; teste |
| R-M7-04 | Info | `Math.max(...array)` estoura a pilha com 200 mil linhas (não alcançável: limite de 5.000) | **Corrigido** com `reduce` no verificador; o mesmo padrão em `visuais/grafico.ts` fica anotado |
| R-M7-05 | Info | Interface sem `innerHTML`; 5.000 itens sem virtualização não medidos | Aberto (informativo) |
| R-M7-06 | Info | "Ir ao local" de título e de tabela leva ao bloco, sem selecionar o trecho; na supressão, seleciona a 1.ª ocorrência | Aberto (usabilidade) |
| R-M7-07 | Info | Lacunas de teste | **Corrigido** em parte: testes de R-M7-01 a 03 |
| R-M7-08 | Info | Canal de exportação recalcula no principal, síncrono, < 60 ms | Sem ação |

## Fidelidade normativa

| Id | Grav. | Achado | Situação |
|---|---|---|---|
| N-M7-01/06 | Média | O motor sempre escrevia "Fonte:"; com vários responsáveis a norma pede "Fontes:" (IBGE p. 20, 4.10.1; Anexo B, Tabela 6) | **Corrigido:** `prefixoFonte` — na tabela (espécie tabela) com ";" na fonte, "Fontes:", no DOCX e no editor (D-M7-06) |
| N-M7-02 | Média | "aaaa a aaaa" acusado no título (o IBGE p. 14, 4.2.2 dá o exemplo "de 1956 a 1964") e "w a z" na indicadora (classe válida, 6.3) | **Corrigido:** só a meia-risca e o travessão são acusados |
| N-M7-03 | Média | "Mais de w a z" acusado como classe aberta (é fechada, 6.2 a) | **Corrigido** |
| N-M7-04 | Média | Sigla no título: falso positivo no Anexo B, Tabela 7 (INPC junto da forma por extenso, JUN/DEZ, US$) | **Corrigido:** fora numeral romano, mês abreviado, moeda e sigla depois de " - " ou "("; mensagem com "abrangência geográfica" |
| N-M7-05 | Média | Total divergente acusado com subtotais, taxas e parcelas parciais (a 7.4 trata só de arredondamento) | **Corrigido:** só diferença de até meia unidade da última casa por parcela; "Subtotal" fora das parcelas |
| N-M7-07 | Média | Linha separadora ou de grupo acusada como célula vazia; mensagem afirmava "nenhuma célula fica vazia" | **Corrigido:** linha com dados todos vazios fica de fora; mensagem reescrita |
| N-M7-08 | Baixa | Qualquer reticência na citação acusada (fala transcrita, poesia) | **Corrigido:** "(...)" sempre; "..." e "…" só soltos |
| N-M7-09 | Baixa | Título que é sigla longa ("EMBRAPA") acusado; mensagem atribuía ao Manual o que é decisão C-A2 | **Corrigido:** duas palavras de 4+ letras; mensagem cita Quadro 1 e C-A2 |
| N-M7-10 | Baixa | Meia-risca × hífen tipograficamente ambíguos no Anexo B; séries no cabeçalho não verificadas | **Cabeçalho corrigido.** A meia-risca continua acusada, como manda a matriz (RN-279 diz "hífen (-)"), com aviso; ambiguidade anotada na RN-279 |
| N-M7-11 | Baixa | "50 e mais bovinos" e "15 ou mais anos" escapavam | **Corrigido** |
| N-M7-12 | Baixa | Sugestão afirmava "sigla entre parênteses" | **Corrigido:** "a sigla pode acompanhar a forma por extenso" |
| N-M7-13 | Info | RN-257 ainda com critério de aviso na matriz; coluna de regras da D-M7-04 incompleta; anexo de terceiros verificado; RN-109 como origem aproximada do indicativo duplicado | **Matriz corrigida** (RN-257 "não verificada", D-M7-04). Anexo e origem da RN-109: abertos, anotados |

## Testado (sessão principal)

- `npx vitest run`: 2115/2115 depois das correções (antes 2107).
- `npm run verificar:tudo`: ver o relatório do marco (`M7_RELATORIO_MARCO.md`).
