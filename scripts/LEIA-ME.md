# scripts/ e tests/ — o que cada arquivo faz

Nenhum script instala dependências, altera configurações do Windows ou apaga arquivos.

| Arquivo | Função | Pré-requisito | Como executar (terminal do VS Code, na pasta do kit) |
|---|---|---|---|
| `scripts/validar-kit.ps1` | Valida a estrutura do kit: arquivos obrigatórios, formato de agentes e skills, `settings.json`, referências cruzadas, segredos, checksums dos materiais, coerência do README | PowerShell 5.1 (já vem no Windows) ou 7 | `powershell -ExecutionPolicy Bypass -File scripts\validar-kit.ps1` |
| `scripts/verificar-ambiente.ps1` | Mostra versões de Claude Code, Git, Node, Python, LibreOffice e avisa sobre OneDrive/caminho longo | PowerShell 5.1 ou 7 | `powershell -ExecutionPolicy Bypass -File scripts\verificar-ambiente.ps1` |
| `tests/test_estrutura_kit.py` | Mesmas verificações do `validar-kit.ps1`, em Python (útil para CI ou para quem prefere Python) | Python 3.9+ (somente biblioteca padrão) | `python tests\test_estrutura_kit.py` |
| `tests/artefatos_futuros.txt` | Lista de arquivos citados na documentação que serão criados nas etapas futuras | — | Lido pelos validadores |

**Por que `-ExecutionPolicy Bypass`:** por padrão o Windows pode bloquear a execução de scripts `.ps1`.
O parâmetro libera **apenas aquele comando**, sem mudar a configuração do computador.

**Código de saída:** `validar-kit.ps1` e o teste Python terminam com código 0 quando não há falhas e
1 quando há falha — o Claude Code usa isso na skill `fechamento-de-tarefa`. Avisos (como materiais
pendentes) não contam como falha.

**Quando o aplicativo existir**, seus testes ficarão dentro de `app/` (definidos na Etapa 4); estes
arquivos continuam validando apenas a infraestrutura do kit.
