---
name: iniciar-projeto
description: Inicia ou retoma o desenvolvimento do BiblioDocs Pro executando a próxima etapa pendente do PROMPT_EXECUCAO.md. Use quando o usuário digitar /iniciar-projeto ou pedir para começar/continuar o projeto.
disable-model-invocation: true
argument-hint: "[etapa opcional, ex.: 2]"
---

# Iniciar ou retomar o projeto

Você vai avançar o desenvolvimento do aplicativo seguindo o plano mestre.

## Passos

1. Leia, nesta ordem: `CLAUDE.md`, `docs/ESTADO_DO_PROJETO.md`, `PROMPT_EXECUCAO.md`.
2. Determine a etapa:
   - Se o usuário informou uma etapa em "$ARGUMENTS", use-a **somente** se as anteriores estiverem
     `CONCLUÍDA`; caso contrário explique o que falta e proponha a etapa correta.
   - Sem argumento: a primeira etapa cujo status não é `CONCLUÍDA`.
3. Se a etapa estiver `AGUARDANDO USUÁRIO`, reapresente a pergunta pendente (opções, efeito de cada
   uma, recomendação) e pare.
4. Anuncie em uma frase o que vai fazer e o que vai pedir de autorização (ex.: `git init`, extração
   para `analise/`). Crie uma lista de tarefas para a etapa.
5. Execute a etapa conforme a seção correspondente do `PROMPT_EXECUCAO.md`, usando os agentes e as
   skills indicados ali. Respeite os critérios de conclusão.
6. Ao final, use a skill `fechamento-de-tarefa` e responda no formato da seção 4 do
   `PROMPT_EXECUCAO.md`.

## Regras
- Uma etapa por execução (na Etapa 5: um incremento por execução, salvo pedido do usuário).
- Nunca pule o registro em `docs/ESTADO_DO_PROJETO.md`; é ele que permite retomar depois.
- Se faltar material (ex.: modelos `.doc`), siga com o que for possível e liste a pendência.
