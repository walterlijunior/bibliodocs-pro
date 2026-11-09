# Relatório de testes — Etapa 6 (testes e validação)

- **Data:** 2026-11-08
- **Versão/commit testado:** `1085e5e` (E6-T04), com a última rodada completa de `npm run verificar:tudo` nesse commit
- **Ambiente:** Windows 11; Node e Electron do projeto; Microsoft Word 16.0 (automação COM, documentos abertos só
  para leitura e nunca salvos); LibreOffice (conversão sem interface); validador OOXML (.NET 10, `app/ferramentas`);
  Poppler 25.07 (`pdftoppm`, só para virar páginas em imagem na conferência visual, fora do projeto)
- **Executado por:** sessão principal (automação e conferência visual); casos manuais do usuário listados abaixo

## Resumo

| Executados | Passaram | Falharam | Bloqueados | Não executados |
|---|---|---|---|---|
| 153 | 151 (+ 2 parciais) | 0 | 0 | 1 (KIT-08, máquina do usuário) |

Os 154 casos da `docs/MATRIZ_DE_TESTES.md`, por grupo: KIT 7/8, ARQ 9, PER 32, BIB 3, IMP 1, FUN 22, REV 3, VER 1,
NOR 2, EXP 3, REG 1, DOC 8/9, UI 3/4, E2E 12, SEG 10, MOD 5, EDT 10, IPC 1, DES 1, DIST 1, LIS 6, SIG 1, CAT 1, POS 1,
M7 4, E6 3.

- **Casos críticos (D-E6-01):** RF-01 a RF-15, DOC-01 a 08, SEG, PER e DES-01. Todos `PASSOU`, menos o **DOC-08**:
  a parte automática passou (validador OOXML, LibreOffice e Word abrem os 13 documentos do corpus), mas falta a
  conferência manual do usuário no Word (aviso de reparo, pergunta de atualizar campos). É o mesmo pedido do M3-T12.
- **Parciais não críticos:** UI-01, porque escala real do Windows por monitor e leitor de tela só se conferem à mão.
- **Falhas abertas:** nenhuma. Os defeitos achados nesta etapa foram corrigidos (ver "Achados").

## Comandos executados

```text
cd app; npm run verificar:tudo        (commit 1085e5e)
  typecheck (4 configurações)          sem erro
  vitest run                           Test Files 76 passed; Tests 2145 passed (2145)
  npm audit --audit-level=high         7 moderadas (ferramentas de build), nenhuma alta
  npm audit signatures                 391 pacotes com assinatura verificada
  npm run test:externos                Tests 46 passed (46): OOXML, LibreOffice e Word, 13 documentos
  npm run build                        ok
  playwright test                      42 passed

BDP_GUARDAR_EXEMPLOS=<analise/exemplos-e6> npm run test:externos     46 passed; DOCX e PDF dos exemplos guardados
powershell -File ferramentas/word/conferir-no-word.ps1 -Arquivo exemplo-<tipo>.docx -Pdf exemplo-<tipo>-word.pdf
  tese e artigo-tcc: abriram, 19 páginas, sumário e listas iguais aos recalculados pelo Word
```

## Resultados por caso (o que mudou na Etapa 6)

| ID (MATRIZ_DE_TESTES) | Requisito/RN | Resultado | Evidência | Observação |
|---|---|---|---|---|
| FUN-03 | RF-03 | PASSOU | `tests/etapa6-matriz.test.ts` | Remissiva a seção acompanha a mudança de lugar ("2.1" → "1.1") |
| FUN-04 | RF-05 | PASSOU | `tests/etapa6-matriz.test.ts` | Achou RN-044, 176 e 178 fora do perfil (corrigido) |
| FUN-05 | RF-07/08 | PASSOU | `e2e/conferencia.spec.ts` | Já existia (marcado FUN-14 no arquivo); faltava o registro |
| FUN-06 | RF-09 | PASSOU (CSV e colagem) | `e2e/tabela.spec.ts`, `tests/planilha.test.ts` | XLSX não é importado (D-M5-01), limitação conhecida |
| FUN-07 | RF-11 | PASSOU | `tests/etapa6-matriz.test.ts`, `e2e/remissiva.spec.ts` | Excluir figura citada avisa; Ctrl+Z tira o aviso |
| FUN-08 | RF-12 | PASSOU | `tests/motor-listas.test.ts`, LIS-05, LIS-06 | |
| FUN-10 | RNF-04 | PASSOU | `e2e/recuperacao.spec.ts` | Estava "parcial" por registro antigo |
| FUN-11 | RF-04 | PASSOU | `tests/pre-textuais.test.ts`, verificador do M7 | |
| E6-02 | RF-02, RF-05, RNF-05 | PASSOU | `tests/exemplos-e6.test.ts`, `tests/externos` | Exemplo completo de cada tipo, sem nenhuma não conformidade |
| E6-03 | RNF-05 | PASSOU | Este relatório, "Verificações manuais" | Conferência visual pelo PDF do Word |
| E6-04 | RF-01, RF-15; R-M1-10; RN-265, RN-276 | PASSOU | `e2e/dialogos.spec.ts`, `tests/verificador-tabelas.test.ts` | A Lixeira real não é exercida |
| DOC-08 | RNF-05 | PARCIAL | Automação | Falta a conferência manual do usuário |

## Achados da Etapa 6 (todos corrigidos, salvo F-E6-01)

| Id | Achado | Correção |
|---|---|---|
| A-E6-01 | RN-044, RN-176 e RN-178 eram citadas pelo motor como origem da formatação, mas não estavam no perfil (rastreabilidade RNF-11 incompleta) | Incluídas no perfil como procedimento, com a fonte da matriz; teste em documentos completos |
| A-E6-02 | Os controles "corretos" do RF-15 e a transcrição da Tabela 4 do IBGE tinham sinal sem explicação na nota geral e nota específica sem chamada | Controles corrigidos; o verificador passou a apontar os dois casos (N-M5-06) |
| A-E6-03 | O painel do trabalho na Biblioteca dizia que a verificação de conformidade não estava disponível | Texto indica o botão "Verificar conformidade" da aba Escrever |
| A-E6-04 | Linha EDT-06 da matriz de testes quebrada em duas (fora da tabela) | Juntada |
| **F-E6-01** | As abas **Elementos**, **Referências** e **Conformidade** e as coleções da Biblioteca **Referências**, **Figuras e Tabelas**, **Siglas** e **Modelos** ainda mostram "Esta área ainda não está disponível nesta versão." As funções existem, mas dentro da aba Escrever (pré-textuais, obras, verificador) e na janela "Siglas, símbolos e glossário…" | **Aberto: decisão do usuário** (a casca foi aprovada por ele no M1, `docs/GUIA_VISUAL.md`). Opções: ligar cada aba à função que já existe, ou retirar as abas e coleções que não terão tela própria nesta versão |

## Falhas

Nenhuma falha aberta.

## Verificações manuais — E6-T03 (conferência visual)

**Como:** os exemplos completos do E6-T02 foram gravados com `BDP_GUARDAR_EXEMPLOS` em `analise/exemplos-e6`
(pasta de trabalho, fora do git), convertidos em PDF pelo **Word** (`app/ferramentas/word/conferir-no-word.ps1 -Pdf`,
documento aberto só para leitura e não salvo) e pelo LibreOffice, e as páginas viradas imagem com o `pdftoppm`. A
sessão principal olhou as páginas do exemplo de tese gerado pelo Word (capa, folha de rosto, folha de aprovação, lista
de ilustrações, sumário, 1.ª página textual, referencial com citação longa e cinco níveis, metodologia com alíneas,
quadro e equação, resultados com tabela, gráfico e figura, referências, apêndice) e comparou com o Manual (p. 65 para
o apêndice, imagem do PDF) e com as RN da matriz.

**Conforme [VERIFICADO na imagem do PDF do Word]:**
- Capa e folha de rosto distribuídas na página (justificação vertical), natureza recuada à direita, local e ano no pé.
- Listas e sumário com pontilhado e página; páginas iguais às recalculadas pelo Word (E6-T02).
- Numeração a partir do texto ("10" na 11.ª folha, contando da folha de rosto: RN-067, RN-068).
- Sigla por extenso na 1.ª ocorrência, nota de rodapé em 10 com filete.
- Citação longa recuada em 10 e simples; chamadas autor-data; *et al.* em itálico.
- Títulos dos cinco níveis com o destaque de cada nível (Quadro 1 do Manual, decisões do usuário).
- Alíneas e subalíneas; quadro fechado; tabela aberta com cabeçalho centralizado; equação com "(1)" à direita.
- Referências em ordem alfabética, simples, separadas por uma linha, título da obra em negrito, sufixos 2020a/2020b.
- Apêndice como no exemplo da p. 65: "APÊNDICE" centralizado e, abaixo, "APÊNDICE A – Título" à esquerda (RN-237).

**Diferenças e decisões:**

| # | Diferença | Causa | Decisão |
|---|---|---|---|
| V-01 | No PDF do LibreOffice, a capa, a folha de rosto e a folha de aprovação saem com tudo no alto da página | O DOCX usa a justificação vertical da seção (`w:vAlign="both"`), que o Word aplica e o LibreOffice não | Limitação do LibreOffice; o alvo é o Word (ADR-0006). Registrado para quem abrir no LibreOffice |
| V-02 | Nos exemplos, o gráfico sai só com título e fonte, sem a imagem | O PNG do gráfico é desenhado pelo aplicativo na exportação (D-M5-08); os exemplos são gerados por script, fora do app | Limite do teste, não do produto; o gráfico com imagem é conferido em `e2e/grafico.spec.ts` |
| V-03 | "…sem conteúdo real. (EXEMPLAR NETO, 2020a, p. 12)." com ponto antes da chamada | Texto do próprio exemplo | Exemplo corrigido. O verificador não acusa ponto antes da chamada: possível melhoria, sem RN registrada hoje |

**Casos manuais do usuário:**
- **DOC-08 / M3-T12:** abrir um DOCX exportado pelo app (Ctrl+E), ou um dos exemplos em `analise/exemplos-e6`, no
  Word, e dizer se aparece aviso de reparo ou pergunta de atualizar campos.
- **UI-01:** a janela com a escala do Windows do seu monitor (125% ou 150%) e, se usar, com leitor de tela.
- **KIT-08:** Claude Code carrega o `CLAUDE.md`, os agentes e as skills na sua máquina (passo 8 de
  `INSTRUCOES_INICIAIS.md`).

## Limitações conhecidas

- **XLSX** não é importado; a janela da tabela orienta salvar como CSV (D-M5-01).
- **LibreOffice:** não aplica a justificação vertical da capa e da folha de rosto (V-01); a paginação pode diferir da
  do Word em uma linha (anotado no R05).
- **Lixeira real do Windows** não é exercida no E2E (o teste usa uma pasta do ambiente, para não deixar arquivos na
  Lixeira do usuário); o `shell.trashItem` do Electron é chamado com o caminho certo.
- **Leitor de tela e escala real por monitor** (UI-01) só se conferem à mão.
- **Normas não disponíveis no projeto** (NBR 6023 e 10520): as regras de citação e referência seguem o Manual e as
  decisões provisórias D-M4 (Etapa 3; `PENDENTE-FONTE` registrados na matriz).
- **Gráfico** nos documentos gerados fora do app sai sem imagem (V-02); no app sai com ela.
- **Pendências de revisões anteriores** ainda abertas (não críticas): R-M3-03 a 05, 07, 09 a 14; R-M5-05, 09; R-M6-10,
  12; R-M7-05 a 08; N-M3-06 a 13; N-M5-07, 09, 10, 12 a 16; N-M6-06, 10, 11, 12, 14; N-M7-10 (parte) e N-M7-13 (parte).
  Estão nos relatórios `REVISAO_M*.md`.

## Conclusão

Critério da Etapa 6 ("todos os casos críticos `PASSOU`; falhas restantes documentadas com impacto e plano"): cumprido
na parte automática. Falta só a conferência manual do DOC-08 pelo usuário, e a decisão do F-E6-01. A Etapa 6 fica
**AGUARDANDO USUÁRIO**.
