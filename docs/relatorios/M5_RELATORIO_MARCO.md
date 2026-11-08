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
