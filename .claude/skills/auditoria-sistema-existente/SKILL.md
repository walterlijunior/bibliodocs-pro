---
name: auditoria-sistema-existente
description: Procedimento para auditar o sistema existente tcc-uft (ou qualquer código legado) antes de alterações — mapa de módulos, funcionalidades, regras embutidas, testes, riscos e reaproveitamento. Use na Etapa 2 ou quando for decidir reaproveitar código antigo.
---

# Auditoria de sistema existente

## Quando usar
Etapa 2 do `PROMPT_EXECUCAO.md`; ou antes de copiar qualquer trecho do sistema antigo para `app/`.

## Entradas
- `materiais/sistema_original/tcc-uft-sistema_10.zip` (somente leitura).
- `docs/INVENTARIO_DE_MATERIAIS.md` (seção "Observações preliminares" a confirmar).

## Procedimento
1. **Extrair** para `analise/sistema_original_extraido/` (PowerShell:
   `Expand-Archive materiais\sistema_original\tcc-uft-sistema_10.zip analise\sistema_original_extraido`;
   ou `unzip` no Git Bash). Nunca extrair dentro de `materiais/`.
2. **Inventário de arquivos:** caminho, tamanho, linhas, papel. Bibliotecas em `vendor/`: identificar
   versão pelo cabeçalho/conteúdo do arquivo (não supor).
3. **Arquitetura:** ponto de entrada (`index.html`), ordem de carga dos scripts, namespace
   `window.TCC.*`, estado (reducer), persistência (IndexedDB), exportações, wrapper Electron.
4. **Funcionalidades:** listar o que o README promete e classificar após verificação:
   `FUNCIONA` (executado), `PARCIAL`, `QUEBRADA`, `NÃO VERIFICADA`.
5. **Execução (se o ambiente permitir):** servir a pasta extraída localmente (o sistema usa
   `python -m http.server 8765`; alternativa Node: `npx http-server` — pedir autorização para baixar
   pacote), criar um trabalho de teste, exportar DOCX para `analise/amostras/`.
   Se não for possível executar, declare e siga com análise estática.
6. **Regras embutidas:** buscar constantes e funções normativas (margens, fontes, espaçamentos,
   numeração, citações) com `Grep`; registrar arquivo:linha. Elas viram candidatas para a matriz.
7. **Testes existentes e dívidas:** presença de testes, duplicações, acoplamento UI × regra,
   pontos frágeis de exportação.
8. **Reaproveitamento:** para cada módulo: reaproveitar como está / adaptar / reescrever, com motivo.

## Saídas
`docs/relatorios/ETAPA2_AUDITORIA.md` (modelo `templates/RELATORIO_TECNICO.md`) contendo:
resumo executivo; mapa de módulos; tabela de funcionalidades; regras embutidas (arquivo:linha);
confirmação/refutação das observações preliminares; riscos; recomendação de reaproveitamento.

## Verificação de conclusão
- Toda afirmação marcada `[VERIFICADO]` (com evidência) ou `[HIPÓTESE]`.
- `git status` (se houver git) não mostra alteração fora de `analise/` e `docs/`.
- Observações preliminares do inventário todas respondidas.

## Dependências externas
Nenhuma obrigatória. Executar o sistema antigo requer Python ou Node; sem eles, a auditoria é estática.
