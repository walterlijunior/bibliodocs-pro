# Revisão de segurança e qualidade — fechamento do marco M2

- **Data:** 2026-11-02
- **Escopo:** commits `9869e03` (M2-T08), `01713fc` (T09), `3560a53` (T10) e `7165a80` (T11), feitos sem revisão independente. T01–T07 foram revisadas nas próprias tarefas (`M2_RELATORIO_MARCO.md`).
- **Executado por:** revisor independente em somente leitura, seguindo `.claude/agents/revisor-seguranca.md` (executado como agente geral, porque o tipo não estava disponível na sessão). Correções e reverificação: sessão principal.
- **Skill:** `revisao-seguranca-qualidade`.

## Resumo

| Crítica | Alta | Média | Baixa | Info |
|---|---|---|---|---|
| 0 | 1 | 3 | 8 | 4 |

O achado Alto e 2 Médios foram corrigidos; o terceiro Médio (R-M2-04) foi mitigado. Com a lacuna abaixo tratada no M2-T13 e as decisões do usuário registradas, o M2 foi fechado em 2026-11-02.

## Lacuna de aceite (achada no fechamento, não pelo revisor)

O RF-03 pede alíneas e citação longa no editor. [VERIFICADO: `comandos.ts`, `EditorSecao.tsx`, `definicoes.ts`, `e2e/editor.spec.ts`] O modelo e a tela os aceitam, mas **só entravam por colagem**. Decisão do usuário: comandos antes de fechar. **Feito no M2-T13.**

## Comandos executados (em `app/`)

| Comando | Resultado |
|---|---|
| `npm run verificar:tudo` | 1097/1097 testes, E2E 16/16, memória 779 MB nessa rodada |
| `npm audit --audit-level=high` | Sem achado alto ou crítico; restam 16 moderados, todos da cadeia de build |
| `npm audit signatures` | 376 assinaturas verificadas |
| `npm run dist:fumaca` e abertura por CDP | Pasta com `TERCEIROS.txt`; `app://interface/index.html` abriu em Chrome/152.0.7977.169 |
| SHA-256 de `electron-v44.10.1-win32-x64.zip` | `5099bdc1…6011`, igual ao `SHASUMS256.txt` do release |
| Mutações das correções | 8 mutações: 7 detectadas de início; a sobrevivente ganhou teste, sem nova rodada de mutação |

## Achados

| ID | Sev. | Problema | Situação |
|---|---|---|---|
| R-M2-01 | Alta | Salvar com uma queda adiada e sem instantâneo novo apagava em definitivo os instantâneos da queda (`aoGravar`) | **Corrigido:** sem sessão ativa, nada é apagado. Teste novo. Também tirou a recusa de versão descartada com oferta pendente |
| R-M2-02 | Média | Electron distribuído com aviso Alto (GHSA-jr5w-w6x2-84p9), invisível ao `--omit=dev`; o M2-T11 descreveu os 17 achados como só de desenvolvimento, o que estava errado | **Corrigido:** Electron 44.10.1; `verificar` audita tudo em nível alto |
| R-M2-03 | Média | Título ou subtítulo com caractere de controle ou acima do limite recusava toda gravação. Colagem real do Word segue como [HIPÓTESE] | **Corrigido:** `tituloDoTexto` limpa o texto. Teste de unidade; sem E2E de colagem |
| R-M2-04 | Média | Edições em versão descartada não têm salvamento automático nem instantâneo, e o diálogo sugeria o contrário | **Mitigado:** diálogo e aviso dizem que não há cópia de recuperação até "Salvar como…". Falta instantâneo para sessão sem arquivo |
| R-M2-05 | Baixa | Dois arquivos com o mesmo id dividem a rotação de backups | Aberto |
| R-M2-06 | Baixa | "Salvar como…" por cima de arquivo existente não faz backup rotativo | Aberto |
| R-M2-07 | Baixa | Temporário de backup órfão nunca era apagado | **Corrigido** |
| R-M2-08 | Baixa | Renomear pode associar o `.bak` de outro trabalho | Aberto |
| R-M2-09 | Baixa | Data da versão descartada era a do último salvamento | **Corrigido:** mostra quando foi guardada e marca a cópia anterior |
| R-M2-10 | Baixa | Versão descartada mostrava "não é um trabalho .bdp", e o aviso ficava depois de salvar | **Corrigido** |
| R-M2-11 | Baixa | Falha do leitor aparecia como "nenhuma versão" | **Corrigido na lista:** `resumirTodos` e aviso de lista incompleta. A listagem ainda ocupa a fila da recuperação |
| R-M2-12 | Baixa | Sessão sem arquivo sobrevive ao fechamento até a janela fechar: "já está aberto", sem perda | Aberto |
| R-M2-13 | Info | `TERCEIROS.txt` não credita helpers do empacotador embutidos no bundle | Aberto |
| R-M2-14 | Info | Argumento recusado vai inteiro ao stderr e pode conter caminho | Aberto |
| R-M2-15 | Info | Logs citam o id aleatório do projeto | Citar na política de privacidade (Etapa 7) |
| R-M2-16 | Info | `.tmp-*` de gravação interrompida não vai à Lixeira ao excluir | Aberto |

## Decisões do usuário (2026-11-02)

1. Trabalho excluído: as cópias saem 30 dias depois. **Feito no M2-T13.**
2. Tela de restaurar backups: M3. **No plano.**
3. `AA, BB, CC` mantido; RN-232 e RN-235 como `AMBÍGUA`, citando P-03. **Feito.**
4. `AAA` em diante: PENDENTE-FONTE (`letraSemFonte`). O M3 e o M6 devem avisar. **Feito no domínio.**

## Não verificado

- Colagem real do Word no título (R-M2-03), tempo do backup e da listagem com arquivos grandes, conteúdo do `app.asar`.
- Instalador NSIS com o Electron 44.10.1: só a pasta de fumaça foi aberta.
- Memória: a rodada final deu 779 MB; o risco R46 continua aberto, porque 44.10.1 só teve essa rodada.

**Atualização (M3-T10, 2026-11-02):** R-M2-04, 06, 08, 12, 14 e 16 corrigidos; R-M2-05 aceito com motivo. Detalhes em `M3_RELATORIO_MARCO.md`.
