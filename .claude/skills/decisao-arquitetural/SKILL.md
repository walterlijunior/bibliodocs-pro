---
name: decisao-arquitetural
description: Procedimento para tomar e registrar decisões de arquitetura (ADR) — escolha de tecnologia, módulos, contratos, formato de projeto, dependências. Use na Etapa 4 e sempre que uma mudança for cara de reverter ou cruzar módulos.
---

# Decisão arquitetural (ADR)

## Quando usar
Escolha de framework/runtime, biblioteca de DOCX, formato de arquivo do projeto, mudança de contrato
entre módulos, nova dependência relevante, mudança de estratégia de testes.

## Entradas
Relatório da auditoria (Etapa 2), `docs/ARQUITETURA_PRELIMINAR.md`, requisitos (RF/RNF),
matriz de riscos.

## Procedimento
1. Enunciar o problema e as restrições (offline, Windows primeiro, DOCX fiel, privacidade).
2. Levantar ≥ 3 alternativas, incluindo "evoluir o que existe".
3. Pesquisar em fonte primária: versão atual, data da última versão, licença, suporte a Windows.
   Registrar links e data de consulta.
4. Quando a escolha depender de comportamento incerto (ex.: qualidade de um DOCX gerado), fazer
   prova de conceito descartável em `analise/poc-*` e medir.
5. Comparar em tabela com pesos explícitos; recomendar uma; descrever consequências e o critério
   que faria reverter a decisão.
6. Escrever `docs/decisoes/ADR-00NN-<titulo-curto>.md` a partir de `templates/ADR.md`;
   status `PROPOSTO` → `ACEITO` (após o usuário, quando afetar custo/resultado visível).
7. Atualizar `docs/ARQUITETURA_PRELIMINAR.md` e, se necessário, `docs/MATRIZ_DE_RISCOS.md`.

## Saídas
ADR numerado; arquitetura atualizada; riscos novos registrados.

## Verificação de conclusão
ADR com todas as seções do modelo preenchidas; links verificados; PoC (se houver) com resultado medido.

## Dependências externas
Acesso à web para consulta de documentação (WebFetch/WebSearch pedem permissão). Sem web,
registre a decisão como `PROPOSTO` com a ressalva de que versões não foram verificadas.
