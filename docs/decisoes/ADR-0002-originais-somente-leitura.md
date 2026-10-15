# ADR-0002 — Materiais originais somente leitura e área de análise separada

- **Status:** ACEITO
- **Data:** 2026-10-12
- **Decisores:** preparação do kit (Claude), conforme requisitos do usuário
- **Etapa/Marco:** Etapa 0
- **Requisitos e riscos relacionados:** R06, R13

## Contexto
O usuário exigiu preservar o sistema original e não simular materiais ausentes. Os originais
precisam ser lidos, extraídos e comparados ao longo de todo o projeto.

## Decisão
- `materiais/` guarda os originais como recebidos, com SHA-256 registrado em
  `docs/INVENTARIO_DE_MATERIAIS.md`; regra 1 do `CLAUDE.md` e `deny: Edit(/materiais/**)` em
  `.claude/settings.json` impedem edição pelo Claude Code.
- Extrações, conversões e provas de conceito vão para `analise/` (ignorada pelo git).
- O novo aplicativo nasce em `app/`.

## Consequências
- Positivas: sempre é possível voltar ao original e provar integridade por hash.
- Negativas: a regra de *deny* não cobre programas que escrevem arquivos indiretamente
  (ex.: um script Node). A regra do `CLAUDE.md` e a checagem de hash na Etapa 1 compensam.

## Critério de reversão
Nenhum previsto.

## Verificação
Recalcular SHA-256 dos originais (Etapa 1 e a qualquer momento) e comparar com o inventário.
