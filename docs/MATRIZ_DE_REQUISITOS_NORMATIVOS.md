# Matriz de requisitos normativos (RN)

> **Situação: SEMENTE.** Contém apenas as regras gerais das p. 15–17 do Manual UFT, conferidas na
> preparação do kit. A matriz completa é construída na **Etapa 3** pelo `especialista-normas`
> (skill `rastreabilidade-normativa`), seguindo `docs/POLITICA_DE_FONTES_NORMATIVAS.md`.

**Fonte M:** UNIVERSIDADE FEDERAL DO TOCANTINS. *Manual de normalização para elaboração de
trabalhos acadêmico-científicos da Universidade Federal do Tocantins*. 2. ed. rev. e atual.
Palmas: UFT, 2022. Arquivo: `materiais/normas/Manual_Normalizacao_UFT_2ed_2022.pdf`
(73 p.; a numeração impressa coincide com a página do PDF nas páginas conferidas).

**Fonte I:** INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. *Normas de apresentação tabular*.
3. ed. Rio de Janeiro: IBGE, 1993. Arquivo em `materiais/normas/` (colocado pelo usuário). É a fonte
principal das regras de **tabelas**: o Manual UFT remete a ela (p. 20, seção 2.9: identificação da
tabela na parte superior, precedida da palavra Tabela; p. 43: tabelas padronizadas conforme a Norma
Tabular do IBGE). As linhas `RN` de tabelas serão extraídas dela na Etapa 3, citando a página.

Status: `CONFIRMADA` · `PENDENTE-FONTE` · `CONFLITO` · `AMBÍGUA` · `IMPLEMENTADA` · `TESTADA`.

| ID | Regra (paráfrase) | Fonte | Aplica-se a | Validação automática | Status |
|---|---|---|---|---|---|
| RN-001 | Fonte Times New Roman ou Arial; corpo 12 no texto; 10 em citações com mais de três linhas, notas de rodapé e legendas de ilustrações, tabelas e quadros | M, p. 15, seção 2.1 | Todos | Estilos do DOCX: `w:rFonts`, `w:sz` (24 = 12 pt; 20 = 10 pt) | CONFIRMADA |
| RN-002 | Margens: superior e esquerda 3 cm; inferior e direita 2 cm | M, p. 15, seção 2.2 | Todos | `w:pgMar` top/left = 1701, bottom/right = 1134 twips | CONFIRMADA |
| RN-003 | Parágrafo com recuo de primeira linha de 1,25 cm e texto justificado | M, p. 15, seção 2.3 | Texto | `w:ind w:firstLine=709`; `w:jc=both` | CONFIRMADA |
| RN-004 | Citação direta com mais de três linhas: recuo de 4 cm da margem esquerda, justificada, fonte 10, espaço simples | M, p. 15 (2.3) e p. 16 (2.6 b); Quadro 1, p. 17 | Texto | `w:ind w:left=2268`; `w:sz=20`; `w:line=240` | CONFIRMADA |
| RN-005 | Títulos com numeração alinhados à esquerda, separados do numeral por um espaço, sem ponto/hífen/travessão; não podem ficar como última linha da página | M, p. 15, seção 2.3 | Títulos numerados | Texto do título; `w:keepNext` no estilo | CONFIRMADA |
| RN-006 | Espaçamento entre linhas 1,5 no texto; simples em citações longas, notas, resumo, abstract, natureza do trabalho, legendas; referências em espaço simples separadas por uma linha simples; uma linha antes da ilustração e outra após a legenda; títulos separados do texto por 1,5 | M, p. 16–17, seção 2.6 a–f | Todos | `w:spacing` por estilo (360 = 1,5; 240 = simples) | CONFIRMADA |
| RN-007 | Títulos sem indicativo numérico centralizados: errata, agradecimentos, listas, resumo, abstract, sumário, referências, glossário, apêndice(s), anexo(s), índice(s). Folha de aprovação, dedicatória e epígrafe sem título e sem indicativo | M, p. 15, seção 2.4 | Pré/pós-textuais | `w:jc=center` nos estilos desses títulos | CONFIRMADA |
| RN-008 | Todo novo capítulo inicia em nova folha | M, p. 15, seção 2.4 (Obs.) | Seções primárias | `w:pageBreakBefore` no estilo Título 1 | CONFIRMADA |
| RN-009 | Alíneas: letra minúscula seguida de parêntese; texto inicia em minúscula e termina em ponto e vírgula, a última em ponto final; subalíneas com travessão e recuo; letras dobradas após esgotar o alfabeto | M, p. 16, seção 2.5 (citando NBR 6024:2012) | Texto | Formatação de lista e pontuação final | CONFIRMADA |
| RN-010 | Seção primária: alinhada à esquerda, 1,5, MAIÚSCULAS EM NEGRITO | M, p. 17, Quadro 1 | Títulos | Estilo Título 1 | CONFIRMADA |
| RN-011 | Seção secundária: esquerda, 1,5, minúsculas em negrito | M, p. 17, Quadro 1 | Títulos | Estilo Título 2 | CONFIRMADA |
| RN-012 | Seção terciária: esquerda, 1,5, minúsculas sem negrito | M, p. 17, Quadro 1 | Títulos | Estilo Título 3 | CONFIRMADA |
| RN-013 | Seção quaternária: esquerda, 1,5, minúsculas sem negrito em itálico | M, p. 17, Quadro 1 | Títulos | Estilo Título 4 | CONFIRMADA |
| RN-014 | Seção quinária: esquerda, 1,5, minúsculas sem negrito e sublinhado | M, p. 17, Quadro 1 | Títulos | Estilo Título 5 | CONFIRMADA |
| RN-015 | Títulos de ilustrações e tabelas: centralizados, espaço simples; fontes e legendas: alinhadas à esquerda, espaço simples | M, p. 17, Quadro 1 | Elementos visuais | Estilos Legenda/Fonte | AMBÍGUA — o Quadro 1 diz "centralizada" para títulos de ilustrações, enquanto os modelos UFT mostram legenda acima à esquerda; confirmar no capítulo de ilustrações/tabelas do Manual na Etapa 3 |
| RN-016 | Notas de rodapé justificadas, espaço simples, fonte 10 | M, p. 15 (2.1), p. 16 (2.6 b), p. 17 (Quadro 1) | Notas | Estilo Texto de nota | CONFIRMADA |
| RN-017 | Natureza do trabalho na folha de rosto: espaço simples, fonte 10, justificado do meio da folha para a margem direita | M, p. 17, seção 2.6 h | Folha de rosto | Recuo esquerdo ≈ metade da largura útil | CONFIRMADA |

## Conflitos registrados

| ID | Conflito | Evidência | Encaminhamento |
|---|---|---|---|
| C-01 | Edição da NBR 10520 (citações): o Manual UFT 2022 cita a NBR 10520:2002; o sistema antigo declara seguir a NBR 10520:2023 (README) e, no cabeçalho de `src/abnt.js`, cita 10520:2002. A edição de 2023 alterou, entre outras coisas, a grafia do sobrenome nas chamadas, segundo o README do sistema antigo | Manual p. 17 (e demais menções); `tcc-uft/README.md`; `tcc-uft/src/abnt.js` linhas 1–10 | **Decisão editorial do usuário** na Etapa 3, após o `especialista-normas` levantar o que muda. Até lá, nenhuma regra de chamada de citação é `CONFIRMADA` |
| C-02 | Manual cita NBR 14724:2011 (13 menções) e uma vez NBR 14724:2018 | Texto extraído do Manual | Verificar contexto na Etapa 3 |

## Pendentes de fonte (a completar na Etapa 3)
Regras de tabelas a partir da Fonte I (IBGE): estrutura, título, cabeçalho, traços, fonte, notas,
quebra entre páginas; paginação; estrutura e ordem de pré/pós-textuais por tipo; capa e folha de rosto; resumo e
palavras-chave; citações (diretas, indiretas, apud, supressões, destaques); referências por tipo;
ilustrações e tabelas (posição da legenda, fonte, numeração); sumário; listas; siglas; apêndices e
anexos; glossário; normas de entrega.
