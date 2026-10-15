---
name: regras-formatacao
description: Implementação do motor normativo — regras de formatação declarativas (margens, fonte, espaçamento, recuos, alinhamento, títulos por nível, paginação, citações longas) ligadas aos IDs RN-xxx da matriz. Use ao implementar, alterar ou corrigir qualquer regra de formatação.
---

# Motor de regras de formatação

## Quando usar
Marco M3 e qualquer correção de formatação. Agentes: `especialista-documento` (implementa),
`especialista-normas` (confere).

## Entradas
`docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md` (linhas `CONFIRMADA`); contrato do motor (ADR).

## Procedimento
1. **Regra = dado, não código espalhado.** Cada regra vive em uma tabela/arquivo de configuração
   do motor com o campo `rn: "RN-xxx"`. Ex. (ilustrativo):
   `{ rn: "RN-002", alvo: "pagina", margens_cm: { sup: 3, esq: 3, inf: 2, dir: 2 } }`.
2. **Perfis:** "UFT 2022" é o perfil inicial; a arquitetura deve permitir outros perfis
   (outras instituições) sem mudar código.
3. **Conversões testadas:** cm → twips (×567), pt → meio-ponto, espaçamento 1,5 → `w:line=360`
   com `lineRule=auto`, simples → 240.
4. **Regra só com status `CONFIRMADA`.** Linhas `PENDENTE-FONTE`, `CONFLITO` ou `AMBÍGUA` não entram;
   se forem indispensáveis, implemente atrás de opção explícita com aviso ao usuário.
5. Atualize o status da linha para `IMPLEMENTADA` e, após teste, `TESTADA`.

## Saídas
Configuração do perfil UFT; código do motor; testes por regra.

## Verificação de conclusão
- Para cada `RN` implementado, existe teste com o ID no nome ou na descrição.
- Teste de regressão documental passa (skill `regressao-documental`).
- `especialista-normas` conferiu a amostra das regras alteradas.

## Dependências externas
Nenhuma.
