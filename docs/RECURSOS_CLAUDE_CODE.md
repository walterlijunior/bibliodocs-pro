# Recursos do Claude Code — decisões

Pesquisa feita em 2026-10-12 na documentação oficial (code.claude.com/docs: subagentes, skills,
settings, permissões, CLI, comandos, instalação) e, para extensões de terceiros, nas páginas
indicadas. **Nada foi instalado.** "Usado" significa configurado por arquivo neste kit;
o carregamento real só pode ser confirmado na máquina do usuário (Passo 8 de `INSTRUCOES_INICIAIS.md`).

## Tabela de decisões

| Recurso | Decisão | Onde / como | Motivo |
|---|---|---|---|
| `CLAUDE.md` do projeto | **Usado** | `CLAUDE.md` | Instruções permanentes carregadas em toda sessão |
| Subagentes de projeto | **Usado** (8) | `.claude/agents/*.md` (frontmatter `name`, `description`, `tools`, `model: inherit`, `color`) | Isolam contexto por domínio; ferramentas restritas (revisor sem edição) |
| Skills de projeto | **Usado** (15) | `.claude/skills/<nome>/SKILL.md` | Procedimentos carregados sob demanda, sem ocupar contexto fixo |
| Comandos personalizados | **Usado, no formato de skill** | `iniciar-projeto` e `status-projeto` com `disable-model-invocation: true` | A documentação atual unificou comandos em skills (`.claude/commands/` ainda funciona, mas skills são o formato recomendado). Por isso não há pasta `commands/` |
| `settings.json` do projeto | **Usado** | `.claude/settings.json` | Só proteções: *deny* para editar `materiais/` e ler `.env`/credenciais; *ask* para push, exclusões e instalações globais; *allow* só para leitura de git e hash de arquivo |
| `settings.local.json` | Não incluído | Criado pelo próprio Claude Code quando o usuário escolhe "não perguntar de novo" | Pessoal; está no `.gitignore` |
| Modo de planejamento (`/plan`, `--permission-mode plan`) | **Opcional** | Recomendado na Etapa 4 | Útil para revisar a arquitetura antes de editar; não é obrigatório |
| Hooks | **Não configurados (opcional documentado)** | Exemplo abaixo | Hooks executam comandos de shell automaticamente; no Windows dependem de PowerShell/Git Bash/Node/Python presentes e corretos. Um hook quebrado atrapalha toda sessão. A validação já é feita pela skill `fechamento-de-tarefa` |
| Servidores MCP | **Nenhum** | — | O projeto não precisa de serviço externo. Sem MCP, não há credenciais a configurar |
| Memória automática (auto memory) | Comportamento padrão do Claude Code | — | O estado oficial do projeto fica em `docs/ESTADO_DO_PROJETO.md` (versionado e legível), não na memória |
| Plugin oficial `claude-code-setup` (Anthropic, marketplace `claude-plugins-official`) | **Opcional** | `/plugin install claude-code-setup@claude-plugins-official` | Analisa o projeto e sugere automações; somente leitura segundo a descrição. Útil depois da Etapa 4, quando existir código. Desnecessário agora: o kit já traz a configuração |
| Cartographer (kingbootoshi, MIT) | **Opcional, avaliar na Etapa 2** | Plugin de terceiros (`/plugin marketplace add kingbootoshi/cartographer`) | Mapeia bases de código grandes com subagentes paralelos; o `tcc-uft` tem ~6 mil linhas — a skill `auditoria-sistema-existente` cobre. Terceiro: revisar o código antes de instalar; o plugin também edita `CLAUDE.md` |
| Grill Me (skill de Matt Pocock; há várias cópias em registros) | **Descartado como dependência; ideia incorporada** | — | A ideia (perguntar uma coisa por vez, com recomendação, antes de construir) já está nas regras de decisão editorial do `CLAUDE.md` e nas skills. Cópias de origem variada em registros de terceiros não têm procedência única verificável |
| Headroom (compressão de contexto, Apache-2.0) | **Descartado** | — | Funciona como proxy que intercepta o tráfego para a API (altera `ANTHROPIC_BASE_URL`); telemetria ligada por padrão segundo a documentação lida; ganho incerto em sessões interativas. Risco de privacidade e de suporte maior que o benefício |
| OmniRoute (gateway de modelos de IA, MIT) | **Descartado** | — | Gateway que roteia para centenas de provedores, inclusive "pools gratuitos"; senha de painel padrão insegura se não configurada; guarda chaves de vários provedores; uso com Claude Code pode conflitar com termos de serviço. Não tem finalidade neste projeto |
| "Claude Man" | **Descartado — não identificado** | — | A busca não encontrou ferramenta com esse nome e documentação verificável. Sem identidade confirmada, não é incluído |
| `--dangerously-skip-permissions` / modo bypass | **Não recomendado** | — | O projeto mexe em arquivos do usuário; manter os pedidos de permissão |

## Exemplo de hook opcional (não ativado)

Se o usuário quiser validar o kit automaticamente ao fim de cada resposta do Claude Code, pode
acrescentar ao `.claude/settings.local.json` (pessoal) — **somente** se `powershell` funcionar no
terminal e após testar o comando manualmente:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validar-kit.ps1 -Silencioso"
          }
        ]
      }
    ]
  }
}
```

Consulte `/hooks` e a documentação oficial de hooks antes de usar; o formato de eventos pode mudar
entre versões.

## Como os agentes são acionados
- Automaticamente, quando o pedido combina com a `description` do agente.
- Por linguagem natural: "use o especialista-normas para…".
- Por menção: `@agent-especialista-normas`.
- Agentes trabalham em contexto separado e devolvem um resumo à sessão principal, que integra.

## Mapa domínio → agente → skills

| Domínio | Agente | Skills |
|---|---|---|
| Inventário e normas | `especialista-normas` | `rastreabilidade-normativa` |
| Sistema antigo | sessão principal + especialistas (leitura) | `auditoria-sistema-existente` |
| Arquitetura | `arquiteto-software` | `decisao-arquitetural` |
| Modelo/editor/DOCX | `especialista-documento` | `editor-academico`, `regras-formatacao`, `importacao-exportacao-docx`, `sumario-listas-remissivas` |
| Bibliografia | `especialista-referencias` | `citacoes-referencias` |
| Tabelas e visuais | `especialista-elementos-visuais` | `tabelas-elementos-visuais`, `sumario-listas-remissivas` |
| Interface | `especialista-interface` | `interface-desktop` |
| Testes | `engenheiro-qualidade` | `regressao-documental` |
| Segurança | `revisor-seguranca` | `revisao-seguranca-qualidade` |
| Fechamento | sessão principal | `fechamento-de-tarefa`, `status-projeto`, `iniciar-projeto` |

**Coordenador técnico:** não foi criado como agente. A coordenação (dividir, delegar, integrar,
validar) é papel da sessão principal; um subagente coordenador não pode delegar com o mesmo
contexto e duplicaria esse papel.

## Fontes consultadas
- Subagentes: https://code.claude.com/docs/en/sub-agents
- Skills: https://code.claude.com/docs/en/skills
- Settings: https://code.claude.com/docs/en/settings · Permissões: https://code.claude.com/docs/en/permissions
- CLI: https://code.claude.com/docs/en/cli-reference · Comandos: https://code.claude.com/docs/en/commands
- Instalação: https://code.claude.com/docs/en/setup
- claude-code-setup: https://unimon.co.th/en/blog/claude-code-official-plugins
- Cartographer: https://cdn.jsdelivr.net/gh/kingbootoshi/cartographer@main/README.md
- Grill Me: https://lertechnotes.substack.com/p/stop-letting-claude-code-guess-what
- Headroom: https://mer.vin/2026/06/headroom-explained-open-source-context-compression-for-ai-agents-60-95-fewer-tokens/
- OmniRoute: https://pinggy.io/blog/omniroute_ai_gateway_security/
