---
name: fechamento-de-tarefa
description: Revisão final de uma tarefa — conferir testes, atualizar ESTADO_DO_PROJETO, CHANGELOG, matriz normativa, matriz de testes e ADRs, validar o kit e relatar ao usuário o que foi implementado, testado e ficou pendente. Use ao terminar qualquer tarefa relevante ou etapa.
---

# Fechamento de tarefa

## Quando usar
Ao final de cada execução de `/iniciar-projeto`, de cada incremento e antes de encerrar a sessão.

## Procedimento
1. **Testes:** rode a suíte relevante (e a completa ao fim de marco). Anote comando e resultado.
2. **Validação do kit:** `powershell -ExecutionPolicy Bypass -File scripts\validar-kit.ps1`
   (ou `python tests/test_estrutura_kit.py`). Se falhar por causa da sua mudança, corrija.
3. **Documentação** — atualize somente o que mudou:
   - `docs/ESTADO_DO_PROJETO.md`: status da etapa, o que foi feito, próximos passos, pendências, perguntas.
   - `CHANGELOG.md`: entrada em "Não lançado" (Adicionado/Alterado/Corrigido/Removido).
   - `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md`: status `IMPLEMENTADA`/`TESTADA` das regras tocadas.
   - `docs/MATRIZ_DE_TESTES.md`: resultado real dos casos executados.
   - ADR, se houve decisão técnica relevante.
4. **Higiene:** nada criado em `materiais/`; temporários em `analise/`; sem segredos; `git status` revisado.
   Se houver git, proponha um commit com mensagem descritiva (o usuário autoriza).
5. **Relato** no formato da seção 4 do `PROMPT_EXECUCAO.md`, separando claramente:
   Implementado · Testado (comando → resultado) · Não testado/pendente · Próximo passo.

## Verificação de conclusão
Relato entregue; estado e changelog atualizados; validação do kit passou ou a falha está explicada.
