---
name: revisao-seguranca-qualidade
description: Revisão de segurança, privacidade, dependências, desempenho e qualidade de código antes de encerrar um marco ou preparar a distribuição. Use ao fim de cada marco da Etapa 5, antes da Etapa 7 e ao adicionar dependências.
---

# Revisão de segurança e qualidade

## Quando usar
Fim de marco (M1…M7), nova dependência, mudança em rede/arquivos/runtime, antes do instalador.
Agente: `revisor-seguranca` (somente leitura) + `engenheiro-qualidade` para os testes.

## Entradas
Diferenças desde a última revisão (`git diff` / `git log`), lista de dependências, configuração do runtime.

## Procedimento
1. Delegar ao `revisor-seguranca` o escopo completo descrito na definição do agente.
2. Rodar, sem alterar estado: testes, lint/checagem de tipos do projeto, auditoria de dependências
   em modo leitura (ex.: `npm audit --omit=dev` ou equivalente da pilha).
3. Medir desempenho com o "documento difícil" do corpus (tempo de abrir, de exportar; memória).
4. Consolidar achados em `docs/relatorios/REVISAO_<marco>.md` com severidade e dono.
5. Achados Críticos/Altos bloqueiam o fechamento do marco até correção ou aceitação explícita do usuário.

## Saídas
Relatório de revisão; tarefas de correção registradas em `docs/ESTADO_DO_PROJETO.md`.

## Verificação de conclusão
Relatório existe; achados Críticos/Altos resolvidos ou aceitos por escrito; medições registradas.

## Dependências externas
Gerenciador de pacotes da pilha para a auditoria; sem rede, registrar auditoria como não executada.
