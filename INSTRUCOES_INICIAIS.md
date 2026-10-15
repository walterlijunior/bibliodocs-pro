# Instruções iniciais — passo a passo no Windows

Este guia supõe conhecimentos básicos de VS Code. Cada passo diz **o que fazer**, **o que você
deve ver** e **o que fazer se não der certo**. Os comandos foram conferidos na documentação
oficial do Claude Code (code.claude.com/docs) em outubro de 2026; se algo mudou depois,
a documentação oficial prevalece.

---

## Passo 0 — Instalar o que não pode vir no ZIP (uma única vez)

| Item | Obrigatório? | Como instalar | Para quê |
|---|---|---|---|
| Visual Studio Code | Sim | code.visualstudio.com | Editor e terminal |
| Claude Code | Sim | Ver abaixo | O agente que desenvolve o app |
| Conta Claude Pro, Max, Team, Enterprise ou Console | Sim | claude.ai | O plano gratuito não inclui Claude Code |
| Git for Windows | Recomendado | git-scm.com/downloads/win | Histórico/rollback e ferramenta Bash do Claude Code |
| Node.js LTS | Provável (Etapa 2 em diante) | nodejs.org | O sistema original tem empacotamento Electron (Node) |
| Python 3 | Opcional | python.org (marque "Add Python to PATH") | Executar o sistema original e o teste `tests/` |

O Claude Code dirá, nas Etapas 1–4, se alguma dessas dependências se tornou necessária;
ele **não instala nada globalmente sem pedir**.

**Instalar o Claude Code (instalador nativo oficial, sem precisar de administrador)** — abra o
**PowerShell** (menu Iniciar → digite "PowerShell") e rode:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Alternativa pelo gerenciador do Windows: `winget install Anthropic.ClaudeCode`
(esta versão não se atualiza sozinha; atualize com `winget upgrade Anthropic.ClaudeCode`).

Depois de instalar, **feche e abra o terminal** e confira:

```powershell
claude --version
```

Deve aparecer um número de versão seguido de `(Claude Code)`.

---

## Passo 1 — Descompactar

1. Na pasta Downloads, clique com o botão direito em `KIT_ACADEMICO_CLAUDE_CODE.zip`.
2. Escolha **Extrair Tudo...** e clique em **Extrair**.
3. Abrirá a pasta `KIT_ACADEMICO_CLAUDE_CODE`, que contém a pasta **`KIT_ACADEMICO_CLAUDE`**.

> Dica: mova `KIT_ACADEMICO_CLAUDE` para um caminho curto, sem OneDrive, por exemplo
> `C:\Projetos\KIT_ACADEMICO_CLAUDE`. Pastas sincronizadas pelo OneDrive podem travar arquivos
> enquanto o Claude Code os edita, e caminhos longos podem estourar o limite do Windows
> durante builds com Node.js.

## Passo 2 — Abrir a pasta certa no VS Code

1. VS Code → **Arquivo → Abrir Pasta...**
2. Selecione **`KIT_ACADEMICO_CLAUDE`** (a pasta que contém `CLAUDE.md`, `README.md` e `.claude`).
3. Se o VS Code perguntar se você confia nos autores, clique em **Sim, confio nos autores**.

**Conferência:** no Explorador do VS Code (barra lateral esquerda) você deve ver `CLAUDE.md`,
`PROMPT_EXECUCAO.md`, `docs`, `materiais` e `.claude` **no primeiro nível**. Se vir apenas
uma pasta `KIT_ACADEMICO_CLAUDE` dentro, você abriu a pasta de cima: repita o passo 2.

## Passo 3 — Abrir o terminal integrado

**Terminal → Novo Terminal** (ou ``Ctrl+` ``). O prompt deve terminar em
`...\KIT_ACADEMICO_CLAUDE>`. Normalmente é PowerShell (o prompt começa com `PS`).

## Passo 4 — (Opcional) Conferir o kit e o ambiente

```powershell
powershell -ExecutionPolicy Bypass -File scripts\validar-kit.ps1
powershell -ExecutionPolicy Bypass -File scripts\verificar-ambiente.ps1
```

- `validar-kit.ps1` confere se todos os arquivos do kit estão presentes e bem formados.
  Deve terminar com `RESULTADO: 0 falha(s)`.
- `verificar-ambiente.ps1` apenas **lê** o que está instalado (Claude Code, Git, Node, Python)
  e mostra o que falta. Não instala nem altera nada.
- `-ExecutionPolicy Bypass` vale só para esse comando: não muda a configuração do Windows.

## Passo 5 — Iniciar o Claude Code

```powershell
claude
```

Na primeira vez nesta pasta, o Claude Code pergunta se você confia nos arquivos dela.
Escolha **Yes, proceed** (ou equivalente em português). Isso permite que ele aplique o
`CLAUDE.md`, os agentes, as skills e as regras de `.claude/settings.json`.

## Passo 6 — Autenticar (se pedir)

Se for o primeiro uso, o Claude Code abre o navegador para você entrar na sua conta Claude.
Faça o login e volte ao terminal. Se o navegador não abrir, digite `/login` dentro do Claude Code.
Para conferir a conta em uso, rode no PowerShell (fora do Claude Code): `claude auth status --text`.

## Passo 7 — Iniciar o projeto

Dentro do Claude Code, digite:

```text
/iniciar-projeto
```

Alternativa equivalente (copiar e colar), se o comando não aparecer:

```text
Leia CLAUDE.md, docs/ESTADO_DO_PROJETO.md e PROMPT_EXECUCAO.md e execute a próxima etapa pendente do plano.
```

Durante o trabalho, o Claude Code vai pedir permissão para editar arquivos e rodar comandos.
Leia cada pedido; aprovar "Yes" vale para aquela ação. Ele pedirá autorização explícita antes
de operações como `git init`, instalar dependências, apagar arquivos ou `git push`.

## Passo 8 — Como saber se o ambiente carregou corretamente

Dentro do Claude Code:

| Comando | O que deve mostrar |
|---|---|
| `/skills` | As 15 skills do projeto, incluindo `iniciar-projeto` e `status-projeto` |
| `/memory` | O arquivo `CLAUDE.md` do projeto entre as memórias carregadas |
| `/status` | Versão, conta e a fonte de configuração do projeto (`.claude/settings.json`) |
| `/permissions` | Regras do projeto (por exemplo `Edit(/materiais/**)` em *deny*) |
| `/status-projeto` | Resumo da etapa atual do desenvolvimento |

Para os agentes, pergunte: *"Quais subagentes deste projeto você tem disponíveis?"* — devem
aparecer os 8 listados no README. Você também pode chamá-los com `@` (ex.: `@agent-especialista-normas`).

## Passo 9 — Se algo não funcionar

| Sintoma | Causa provável | Solução |
|---|---|---|
| `claude : O termo 'claude' não é reconhecido...` | Instalação não concluída ou terminal aberto antes da instalação | Feche **todas** as janelas do VS Code e abra de novo; rode `claude --version`. Se persistir, reinstale (Passo 0) e veja code.claude.com/docs/en/troubleshoot-install |
| `'irm' is not recognized` | Você está no CMD, não no PowerShell | Use o PowerShell, ou no CMD: `curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd` |
| `/iniciar-projeto` não aparece ao digitar `/` | Pasta errada aberta, ou confiança na pasta recusada | Confira o Passo 2; saia (`/exit`), rode `claude` de novo e aceite a confiança. Enquanto isso, use a instrução alternativa do Passo 7 |
| Mensagem sobre conta/assinatura | Plano sem Claude Code ou login em outra conta | `/login` e entre com a conta paga; `claude auth status --text` para conferir |
| `validar-kit.ps1 não pode ser carregado... execução de scripts desabilitada` | Política de execução do Windows | Use exatamente `powershell -ExecutionPolicy Bypass -File scripts\validar-kit.ps1` |
| Erros de configuração ao abrir | `settings.json` editado com erro de JSON | Rode `claude doctor` no PowerShell; ele aponta o erro. Restaure o arquivo do ZIP |
| Claude Code diz que não encontra Git Bash | Git for Windows ausente | Opcional: instale o Git for Windows. Sem ele, o Claude Code usa PowerShell |
| Lentidão ou erros de arquivo em uso | Pasta dentro do OneDrive | Mova o kit para `C:\Projetos\` (Passo 1, dica) |

Diagnóstico completo, sem iniciar sessão: `claude doctor`.
Para continuar a conversa anterior na mesma pasta: `claude -c`.
