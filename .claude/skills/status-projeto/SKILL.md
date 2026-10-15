---
name: status-projeto
description: Mostra um resumo do estado do projeto BiblioDocs Pro (etapa atual, concluído, pendências, decisões aguardando o usuário, materiais ausentes). Use quando o usuário digitar /status-projeto ou perguntar em que pé está o projeto.
disable-model-invocation: true
allowed-tools: Read Grep Glob
---

# Status do projeto

1. Leia `docs/ESTADO_DO_PROJETO.md`, as últimas entradas de `CHANGELOG.md`, a lista de
   `docs/decisoes/` e a tabela de situação de `docs/INVENTARIO_DE_MATERIAIS.md`.
2. Responda em até 15 linhas, sem alterar arquivos:
   - Etapa atual e status.
   - Últimas entregas (até 3).
   - Pendências e bloqueios (inclua materiais ausentes).
   - Decisões aguardando o usuário (com a pergunta).
   - Próximo passo recomendado e o comando para executá-lo (`/iniciar-projeto`).
3. Se `docs/ESTADO_DO_PROJETO.md` parecer desatualizado em relação ao CHANGELOG ou aos arquivos,
   diga isso explicitamente.
