# Relatório de validação do kit

- **Data:** 2026-10-12
- **Versão:** kit-1.0.1 (revalidada após o esclarecimento sobre o estudo Capcom)
- **Ambiente da validação:** contêiner Linux x64 da preparação (não é Windows). Ferramentas
  disponíveis: PowerShell 7.4.6 (portátil, só para os testes), Python 3.13, Claude Code 2.1.296,
  Git 2.43, Node 22, LibreOffice 24.2.
- **Executado por:** Claude (preparação do kit).

## Resumo

| Verificação | Resultado |
|---|---|
| Estrutura, formatos, referências, segredos, checksums (`scripts/validar-kit.ps1` no PowerShell 7) | **0 falhas**, 2 avisos (materiais pendentes do usuário) |
| Mesmas verificações em Python (`tests/test_estrutura_kit.py`, 9 testes) | **9/9 passaram** |
| Claude Code real carregando o kit (`claude -p` na pasta do kit) | **Passou**: 8 agentes e 13 skills invocáveis pelo modelo reconhecidos; regra do `CLAUDE.md` citada corretamente |
| Comando `/status-projeto` executado pelo Claude Code real | **Passou**: resumo correto do estado, sem alterar arquivos |
| `claude doctor` na pasta do kit | Nenhum erro de validação de settings do projeto (2 avisos sobre a instalação do próprio contêiner, sem relação com o kit) |
| ZIP gerado, testado (`unzip -t`) e validado após extração em pasta limpa | Ver seção "Pacote ZIP" |

## Detalhes

### 1. `scripts/validar-kit.ps1` (PowerShell 7.4.6)
Verifica: 30 arquivos obrigatórios presentes e não vazios; 8 agentes com `name` igual ao arquivo,
`description` e corpo de instruções; `revisor-seguranca` sem Edit/Write; 15 skills com `SKILL.md`,
`name` igual à pasta, kebab-case ≤ 64, `description` entre 40 e 1024 caracteres; `/iniciar-projeto`
e `/status-projeto` com `disable-model-invocation: true`; `settings.json` válido com as regras
*deny* esperadas e sem *allow* amplo; referências cruzadas entre arquivos (caminhos citados entre
crases em README, CLAUDE.md, PROMPT_EXECUCAO.md, INSTRUCOES_INICIAIS.md, `.claude/` e `docs/`);
README e `docs/RECURSOS_CLAUDE_CODE.md` citam todos os agentes e skills; nenhum padrão de segredo
nem arquivo de credencial; SHA-256 dos 3 materiais conferem com o inventário.

Na primeira execução o validador encontrou problemas reais que foram corrigidos antes da entrega:
`.gitignore` não era lido por ser arquivo oculto no Linux (corrigido com `-Force`), e três referências
apontavam para arquivos ainda inexistentes (este relatório, criado agora, e
`.claude/settings.local.json`, que é pessoal e foi declarado em `tests/artefatos_futuros.txt`).

### 2. `tests/test_estrutura_kit.py`
`python3 -I tests/test_estrutura_kit.py` → `Ran 9 tests … OK`.

### 3. Carregamento pelo Claude Code
Comando executado na pasta do kit (modo não interativo, modo de planejamento, sem ferramentas de edição):
`claude -p --max-turns 3 --permission-mode plan "<pergunta sobre subagentes, skills e regra 1>"`.
Resposta listou exatamente os 8 agentes e as 13 skills que o modelo pode carregar sozinho; as skills
`iniciar-projeto` e `status-projeto` não aparecem nessa lista por design (`disable-model-invocation: true`,
só o usuário as aciona). Em seguida, `claude -p "/status-projeto"` executou o comando e produziu o
resumo correto. O Claude Code avisou que as 4 regras *allow* do `settings.json` são ignoradas até a
pasta ser marcada como confiável — comportamento documentado; no Windows o usuário aceita a confiança
na primeira execução interativa (Passo 5 de `INSTRUCOES_INICIAIS.md`).

### 4. O que NÃO foi testado (e por quê)
| Item | Motivo | Como o usuário confere |
|---|---|---|
| Execução no **Windows** e no **Windows PowerShell 5.1** | Ambiente da preparação é Linux; testado só em PowerShell 7. Os scripts foram escritos sem recursos exclusivos do PS 7 e com texto ASCII (evita problemas de codificação do 5.1) | Passo 4 de `INSTRUCOES_INICIAIS.md` |
| Sessão **interativa** do Claude Code (diálogo de confiança, menu `/`, `/skills`, `@agent-…`) | Sem terminal interativo na preparação | Passos 5–8 de `INSTRUCOES_INICIAIS.md` |
| `/iniciar-projeto` (Etapa 1) | Executá-lo alteraria o estado do projeto entregue; é o primeiro passo do usuário | Primeira execução |
| Hooks e plugins opcionais | Não configurados por decisão (ADR-0001) | — |
| Conteúdo normativo além das p. 15–17 do Manual | Fica para a Etapa 3 | Etapa 3 |

## Dependências externas identificadas
Obrigatórias: Claude Code e conta paga compatível; VS Code. Recomendada: Git for Windows.
Prováveis (Etapa 2/4): Node.js LTS. Opcionais: Python 3, LibreOffice. Nenhuma é instalada pelo kit.

## Pacote ZIP
- Arquivo: `KIT_ACADEMICO_CLAUDE_CODE.zip`, contendo a pasta `KIT_ACADEMICO_CLAUDE/` (94 entradas,
  cerca de 1,9 MB; o tamanho é dominado pelo Manual UFT em PDF e pelo ZIP do sistema original).
- `unzip -t` → "No errors detected in compressed data".
- Extraído em pasta vazia e validado de novo dentro da cópia extraída:
  `validar-kit.ps1` → 0 falhas, 2 avisos; `tests/test_estrutura_kit.py` → 9/9 OK.
- Não contém: credenciais, `settings.local.json`, caches (`__pycache__`, `node_modules`), arquivos
  temporários, nem os binários auxiliares usados só na validação (PowerShell portátil).
- O relatório foi finalizado e o ZIP regerado depois desta seção; a regeração foi verificada da mesma forma.
