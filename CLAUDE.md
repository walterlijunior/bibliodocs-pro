# CLAUDE.md — Projeto BiblioDocs Pro (nome provisório)

Aplicativo desktop para elaborar e formatar trabalhos acadêmicos conforme o Manual de
Normalização da UFT e as normas ABNT aplicáveis. Evolui o sistema existente
`materiais/sistema_original/tcc-uft-sistema_10.zip`. Idioma de trabalho: português do Brasil.

## Antes de qualquer tarefa relevante

1. Leia `docs/ESTADO_DO_PROJETO.md` (etapa atual, pendências, próximos passos).
2. Leia a seção correspondente de `PROMPT_EXECUCAO.md` (plano mestre em 7 etapas).
3. Consulte o documento de `docs/` ligado ao assunto (requisitos, riscos, testes, fontes).
4. Examine os arquivos reais antes de decidir. Nunca descreva código ou documento que não abriu.

## Mapa do repositório

| Pasta | Uso | Regra |
|---|---|---|
| `materiais/` | Originais: sistema existente, Manual UFT e Norma Tabular do IBGE (normas), referência de layout (iTunes com pequi), modelos e o estudo Capcom (estes dois são só **exemplos de formatação**; o tema do estudo Capcom é irrelevante para o app) | **Somente leitura.** Nunca editar, mover ou apagar |
| `analise/` | Extrações e cópias de trabalho dos originais (ignorada pelo git) | Pode ser recriada a qualquer momento |
| `app/` | Código do novo aplicativo | Criado a partir da Etapa 4/5 |
| `docs/` | Documentação viva, decisões (`docs/decisoes/`) e relatórios (`docs/relatorios/`) | Atualizar ao fim de cada tarefa |
| `templates/` | Modelos de relatório, ADR e relatório de testes | Copiar, não editar o modelo |
| `scripts/`, `tests/` | Validação do kit e do ambiente | Manter funcionando |

## Agentes e skills

- Agentes em `.claude/agents/` — delegue pelo domínio (ver tabela em `docs/RECURSOS_CLAUDE_CODE.md`).
  Você (sessão principal) coordena: divide a tarefa, delega, integra e valida. Não há agente coordenador.
- Skills em `.claude/skills/` — carregue a skill do tipo de trabalho antes de executá-lo.
  Comandos do usuário: `/iniciar-projeto` (executa a etapa atual) e `/status-projeto` (resumo).

## Regras permanentes

1. **Preserve o original.** `materiais/` é intocável; trabalhe sobre cópias em `analise/` ou em `app/`.
2. **Etapas pequenas.** Uma mudança coesa por vez; termine-a com teste e registro antes da próxima.
3. **Normas não se inventam.** Toda regra ABNT/UFT implementada precisa de fonte identificável
   (documento, página/seção) registrada em `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md`.
   Sem fonte, a regra fica marcada `PENDENTE-FONTE` e não é implementada como definitiva.
   Siga `docs/POLITICA_DE_FONTES_NORMATIVAS.md`.
4. **Fato × hipótese.** Escreva `[VERIFICADO]` (com o arquivo/página conferido) ou `[HIPÓTESE]`
   ao afirmar algo sobre o sistema, as normas ou o ambiente.
5. **Testes após mudanças relevantes.** Rode os testes existentes; acrescente teste para o que mudou.
   Nunca declare "testado" o que não foi executado.
6. **Registre.** Decisões técnicas → ADR em `docs/decisoes/` (modelo em `templates/`).
   Progresso e pendências → `docs/ESTADO_DO_PROJETO.md`. Mudanças entregues → `CHANGELOG.md`.
7. **Peça autorização antes de:** apagar ou sobrescrever arquivos fora de `analise/`, migrações grandes,
   trocar a tecnologia escolhida, instalar dependências globais, `git push`, publicar algo,
   ou qualquer operação irreversível. Instalação de dependências locais do projeto: informe antes.
8. **Sem conflitos entre agentes.** Cada agente edita apenas a área listada na sua definição.
   Dois agentes nunca editam o mesmo arquivo na mesma rodada; integração é feita pela sessão principal.
9. **Privacidade.** Não leia, copie nem exiba `.env`, chaves, tokens ou dados pessoais.
   Documentos de usuários usados como exemplo ficam fora de testes públicos, salvo autorização.
10. **Decisões editoriais são do usuário.** Decida sozinho o técnico (estrutura de dados, nomes,
    organização de arquivos). Pergunte quando a escolha muda o resultado visível do documento,
    a interpretação de uma norma ou a identidade visual do produto.

## Ao concluir cada tarefa, informe

- **Implementado:** o que mudou (arquivos).
- **Testado:** comandos executados e resultado real.
- **Não testado / pendente:** o que ficou de fora e por quê.
- **Próximo passo** recomendado.
