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
