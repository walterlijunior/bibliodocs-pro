# Kit Acadêmico para Claude Code — BiblioDocs Pro

Ambiente pronto para desenvolver, com o **Claude Code**, um aplicativo desktop de elaboração e
formatação de trabalhos acadêmicos conforme o **Manual de Normalização da UFT (2022)** e as normas
ABNT aplicáveis (tabelas: Norma Tabular do IBGE), com layout inspirado no iTunes e um pequi no lugar da maçã.
O kit não contém o aplicativo: contém tudo o que o Claude Code precisa para
construí-lo por etapas — instruções permanentes, 8 agentes, 15 skills, plano mestre, documentação,
scripts e os materiais originais disponíveis.

> Guia passo a passo detalhado (com solução de problemas): **[INSTRUCOES_INICIAIS.md](INSTRUCOES_INICIAIS.md)**.

---

## Início rápido (Windows)

**Pré-requisitos:** VS Code; Claude Code instalado e uma conta Claude **Pro, Max, Team, Enterprise
ou Console** (o plano gratuito não inclui Claude Code). Git for Windows é recomendado.

1. Clique com o botão direito em `KIT_ACADEMICO_CLAUDE_CODE.zip` → **Extrair Tudo...** → **Extrair**.
2. No VS Code: **Arquivo → Abrir Pasta...** → selecione a pasta **`KIT_ACADEMICO_CLAUDE`**
   (a que contém este `README.md` e o `CLAUDE.md` — não a pasta acima dela).
3. Abra o terminal integrado: **Terminal → Novo Terminal** (atalho ``Ctrl+` ``).
4. Digite `claude` e pressione Enter.
5. Quando o Claude Code abrir, digite **`/iniciar-projeto`** e pressione Enter.

### Exemplo real do terminal

```text
PS C:\Users\walter\Downloads\KIT_ACADEMICO_CLAUDE_CODE\KIT_ACADEMICO_CLAUDE> claude --version
2.x.x (Claude Code)

PS C:\Users\walter\Downloads\KIT_ACADEMICO_CLAUDE_CODE\KIT_ACADEMICO_CLAUDE> powershell -ExecutionPolicy Bypass -File scripts\validar-kit.ps1
[OK]    Arquivos obrigatorios presentes (30)
[OK]    Agentes: 8 com frontmatter valido
[OK]    Skills: 15 com SKILL.md valido
...
[AVISO] Ainda sem arquivos .doc/.docx em materiais/modelos_uft (material pendente do usuario)

RESULTADO: 0 falha(s), 2 aviso(s)

PS C:\Users\walter\Downloads\KIT_ACADEMICO_CLAUDE_CODE\KIT_ACADEMICO_CLAUDE> claude
```

Dentro do Claude Code:

```text
> /iniciar-projeto
```

Se o comando `/iniciar-projeto` não aparecer, cole esta instrução (funciona sempre):

```text
Leia CLAUDE.md, docs/ESTADO_DO_PROJETO.md e PROMPT_EXECUCAO.md e execute a próxima etapa pendente do plano.
```

O número de versão e o caminho acima são ilustrativos; o seu terminal mostrará os seus.
A linha `validar-kit.ps1` é opcional (confere se o kit está íntegro).

### O que acontece na primeira execução

1. O Claude Code pergunta se você confia nos arquivos da pasta → responda **Yes / Sim**
   (necessário para ele ler `CLAUDE.md`, agentes, skills e permissões do projeto).
2. Se for o primeiro uso, ele abre o navegador para você entrar na sua conta.
3. Com `/iniciar-projeto`, ele executa a **Etapa 1 — Inventário**: lista os materiais, confere
   os checksums, pede autorização para `git init`, extrai o sistema original em `analise/`,
   e informa quais materiais faltam (os modelos `.doc` da UFT e o `.docx` do estudo Capcom).
4. Ele termina com um relatório e o próximo passo. A cada nova sessão, rode `/iniciar-projeto`
   de novo: o estado fica salvo em `docs/ESTADO_DO_PROJETO.md`.

---

## Estrutura do kit

```text
KIT_ACADEMICO_CLAUDE/
├── README.md                  ← este arquivo
├── INSTRUCOES_INICIAIS.md     ← guia Windows passo a passo + problemas comuns
├── CLAUDE.md                  ← regras permanentes lidas pelo Claude Code em toda sessão
├── PROMPT_EXECUCAO.md         ← plano mestre em 7 etapas (Componente B)
├── CHANGELOG.md
├── .gitignore
├── .claude/
│   ├── settings.json          ← permissões do projeto (proteções; sem credenciais)
│   ├── agents/                ← 8 agentes especializados
│   └── skills/                ← 15 skills (2 delas são comandos: /iniciar-projeto, /status-projeto)
├── docs/                      ← visão, requisitos, arquitetura, plano, riscos, testes, fontes,
│   │                            inventário, recursos do Claude Code, estado do projeto
│   ├── decisoes/              ← ADRs (registro de decisões)
│   └── relatorios/            ← relatórios de etapa e de validação
├── materiais/                 ← ORIGINAIS (somente leitura para o Claude)
│   ├── sistema_original/      ← tcc-uft-sistema_10.zip (incluído)
│   ├── normas/                ← Manual de Normalização UFT 2022 (incluído) + Norma Tabular do IBGE (você coloca)
│   ├── modelos_uft/           ← coloque aqui os 6 modelos .doc da UFT (ver LEIA-ME)
│   ├── referencias_visuais/   ← estudo Capcom (.docx) e guias do IFPR/FURB: exemplos de formatação
│   └── referencias_layout/    ← captura do iTunes: referência de layout (pequi no lugar da maçã)
├── analise/                   ← área de trabalho para extrações (criada vazia, ignorada pelo git)
├── app/                       ← onde o aplicativo será criado (a partir da Etapa 4/5)
├── scripts/                   ← verificação do ambiente e validação do kit (PowerShell)
├── templates/                 ← modelos de relatório técnico, ADR e relatório de testes
└── tests/                     ← teste automatizado da estrutura do kit (Python, opcional)
```

## Agentes

| Agente | Domínio |
|---|---|
| `arquiteto-software` | Arquitetura, tecnologia, ADRs, integração entre módulos |
| `especialista-normas` | Manual UFT / ABNT, matriz de requisitos normativos (somente documentação) |
| `especialista-documento` | Modelo de documento, editor, importação/exportação DOCX |
| `especialista-referencias` | Citações e referências bibliográficas |
| `especialista-elementos-visuais` | Tabelas, quadros, figuras, gráficos, equações, legendas, listas |
| `especialista-interface` | Interface desktop, UX "biblioteca", identidade pequi |
| `engenheiro-qualidade` | Testes, regressão documental, validação |
| `revisor-seguranca` | Segurança, desempenho, manutenção, dependências (somente leitura) |

## Skills

`auditoria-sistema-existente` · `rastreabilidade-normativa` · `decisao-arquitetural` ·
`editor-academico` · `regras-formatacao` · `citacoes-referencias` · `tabelas-elementos-visuais` ·
`sumario-listas-remissivas` · `importacao-exportacao-docx` · `regressao-documental` ·
`interface-desktop` · `revisao-seguranca-qualidade` · `fechamento-de-tarefa` ·
`iniciar-projeto` (comando) · `status-projeto` (comando)

## Materiais originais

| Material | Situação no kit |
|---|---|
| Sistema existente `tcc-uft-sistema_10.zip` | **Incluído** em `materiais/sistema_original/` |
| Manual de Normalização UFT, 2ª ed. 2022 (era `content.pdf`) | **Incluído** em `materiais/normas/` |
| 6 modelos institucionais UFT (`.doc`) | Não vêm no ZIP (os binários não estavam acessíveis na preparação); coloque-os em `materiais/modelos_uft/` |
| Normas de apresentação tabular do IBGE (1993) | Não vem no ZIP; coloque em `materiais/normas/` — é a norma das tabelas, à qual o Manual UFT remete |
| Guias de outras instituições (IFPR, FURB) | Opcionais; exemplos visuais em `materiais/referencias_visuais/` |
| Captura do iTunes (referência de layout) | **Incluída** em `materiais/referencias_layout/` |
| `12-estudo-capcom-jgaap-brasil-japao.docx` — exemplo de trabalho acadêmico formatado (o tema não importa ao app) | Extração de texto incluída; coloque o `.docx` original em `materiais/referencias_visuais/` |

Detalhes, checksums e observações: `docs/INVENTARIO_DE_MATERIAIS.md`.
O kit funciona mesmo sem os itens ausentes; as etapas que dependem deles ficam sinalizadas.

## Segurança e privacidade

- Nenhuma credencial, token ou configuração pessoal está no kit. A autenticação é feita por você,
  na sua máquina, e fica fora da pasta.
- `.claude/settings.json` só **restringe** (bloqueia edição de `materiais/` e leitura de `.env`;
  pede confirmação para `git push`, exclusões e publicação). Não dá permissões amplas.
- Nenhum plugin, hook ou servidor MCP externo é instalado. Ver `docs/RECURSOS_CLAUDE_CODE.md`.

## Validação

- `scripts\validar-kit.ps1` (PowerShell) e `tests/test_estrutura_kit.py` (Python) conferem
  estrutura, formato de agentes/skills, referências cruzadas e ausência de segredos.
- Resultado da validação feita na preparação: `docs/relatorios/RELATORIO_VALIDACAO_KIT.md`.
