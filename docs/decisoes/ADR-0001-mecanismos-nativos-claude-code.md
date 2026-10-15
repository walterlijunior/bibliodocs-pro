# ADR-0001 — Usar apenas mecanismos nativos do Claude Code no kit

- **Status:** ACEITO
- **Data:** 2026-10-12
- **Decisores:** preparação do kit (Claude), conforme requisitos do usuário
- **Etapa/Marco:** Etapa 0
- **Requisitos e riscos relacionados:** RNF-03, R07, R08, R11

## Contexto
O usuário pediu um kit que funcione abrindo a pasta no VS Code e iniciando o Claude Code, sem
alterações globais e sem plugins desnecessários. Foram avaliados recursos nativos (CLAUDE.md,
subagentes, skills, comandos, hooks, MCP, settings) e extensões citadas pelo usuário (Cartographer,
claude-code-setup, Claude Man, Headroom, OmniRoute, Grill Me). Detalhes em `docs/RECURSOS_CLAUDE_CODE.md`.

## Alternativas consideradas
| Critério | A. Só nativos, configuração de projeto | B. Nativos + plugins de terceiros | C. Nativos + hooks automáticos |
|---|---|---|---|
| Funciona após descompactar | Sim | Exige instalação de plugins | Depende de shell/interpretador no Windows |
| Segurança/privacidade | Alta | Depende de código de terceiros | Comandos executados automaticamente |
| Manutenção | Baixa | Média/alta | Média |

## Decisão
Alternativa A: `CLAUDE.md`, 8 subagentes, 15 skills (2 como comandos), `settings.json` com regras
restritivas. Plugins e hooks ficam documentados como opcionais ou descartados.

## Consequências
- Positivas: zero instalação extra além do Claude Code; nada executa sem o usuário ver.
- Negativas: validação não é automática a cada resposta (é feita pela skill `fechamento-de-tarefa`).

## Critério de reversão
Se a validação manual for esquecida com frequência, ativar o hook opcional documentado.

## Verificação
`scripts/validar-kit.ps1` confere formatos; Passo 8 de `INSTRUCOES_INICIAIS.md` confere o carregamento.
