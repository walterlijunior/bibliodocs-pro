# Matriz de testes

Status: `NÃO EXECUTADO` (inicial) → `PASSOU` / `FALHOU` / `BLOQUEADO`, sempre com data e evidência
(comando + resumo da saída, ou relatório). Os casos do aplicativo serão detalhados pelo
`engenheiro-qualidade` à medida que os marcos avançam; os casos KIT já são executáveis.

## Grupo KIT — infraestrutura deste kit

| ID | Caso | Como executar | Status |
|---|---|---|---|
| KIT-01 | Arquivos obrigatórios existem | `scripts\validar-kit.ps1` / `python tests/test_estrutura_kit.py` | PASSOU (2026-10-12, ver relatório de validação) |
| KIT-02 | Agentes com frontmatter válido (`name` = nome do arquivo, `description`) | idem | PASSOU (2026-10-12) |
| KIT-03 | Skills com `SKILL.md`, `name` = pasta, formato kebab-case ≤ 64, `description` ≤ 1024 | idem | PASSOU (2026-10-12) |
| KIT-04 | `settings.json` é JSON válido e contém as proteções esperadas | idem | PASSOU (2026-10-12) |
| KIT-05 | Referências cruzadas entre arquivos existem (ou estão declaradas como artefatos futuros) | idem | PASSOU (2026-10-12) |
| KIT-06 | Nenhum segredo/token no kit | idem | PASSOU (2026-10-12) |
| KIT-07 | Checksums dos materiais conferem com o inventário | idem | PASSOU (2026-10-12) |
| KIT-08 | Claude Code carrega CLAUDE.md, agentes e skills no Windows | Manual: Passo 8 de `INSTRUCOES_INICIAIS.md` | NÃO EXECUTADO (requer a máquina do usuário) |

## Grupo FUN — funcionalidades (aplicativo)

| ID | Requisito | Caso | Status |
|---|---|---|---|
| FUN-01 | RF-01 | Criar, salvar, fechar, reabrir trabalho: conteúdo idêntico | NÃO EXECUTADO |
| FUN-02 | RF-02 | Para cada tipo de trabalho, elementos obrigatórios presentes | NÃO EXECUTADO |
| FUN-03 | RF-03 | Mover seção renumera seções e remissivas | NÃO EXECUTADO |
| FUN-04 | RF-05 | Toda formatação do DOCX tem `RN` | NÃO EXECUTADO |
| FUN-05 | RF-07/08 | Documento com 1 citação órfã e 1 referência não citada é diagnosticado | NÃO EXECUTADO |
| FUN-06 | RF-09 | Importar CSV/XLSX com acentos, vírgula decimal, vazios e datas | NÃO EXECUTADO |
| FUN-07 | RF-11 | Excluir figura referenciada gera aviso | NÃO EXECUTADO |
| FUN-08 | RF-12 | Inserir seção/figura atualiza sumário e listas | NÃO EXECUTADO |
| FUN-09 | RF-15 | 10 não conformidades plantadas detectadas, 0 falsos positivos no documento correto | NÃO EXECUTADO |

## Grupo DOC — regressão documental (DOCX)

| ID | Propriedade conferida no DOCX | Fonte do esperado | Status |
|---|---|---|---|
| DOC-01 | Página A4 (11906 × 16838 twips) | `RN` de formato de papel (Etapa 3) | NÃO EXECUTADO |
| DOC-02 | Margens 3/3/2/2 cm (sup/esq/inf/dir) = 1701/1701/1134/1134 twips | RN-002 (Manual UFT p. 15) | NÃO EXECUTADO |
| DOC-03 | Fonte Times New Roman ou Arial 12 no corpo; 10 em citação longa, notas e legendas | RN-001 | NÃO EXECUTADO |
| DOC-04 | Espaçamento 1,5 no corpo (`w:line=360`), simples nos casos previstos | RN-006 | NÃO EXECUTADO |
| DOC-05 | Recuo de primeira linha 1,25 cm (709 twips); citação longa com recuo de 4 cm (2268 twips) | RN-003, RN-004 | NÃO EXECUTADO |
| DOC-06 | Estilos de título por nível conforme Quadro 1 do Manual | RN-010 a RN-014 | NÃO EXECUTADO |
| DOC-07 | Sumário presente e coerente com os títulos | `RN` de sumário (Etapa 3) | NÃO EXECUTADO |
| DOC-08 | DOCX abre sem reparo no Word e no LibreOffice | RNF-05 | NÃO EXECUTADO (manual) |

## Grupo UI — layout

| ID | Caso | Fonte do esperado | Status |
|---|---|---|---|
| UI-01 | Janela com barra superior (visor com pequi + busca), menus, navegação com abas, barra lateral e grade de trabalhos | `docs/REFERENCIA_DE_LAYOUT.md`, seção 4 | NÃO EXECUTADO |
| UI-02 | Nenhum elemento de marca de terceiros na interface e nos ícones | `docs/REFERENCIA_DE_LAYOUT.md`, seção 3 | NÃO EXECUTADO |

## Grupos DES (desempenho) e DIST (distribuição)
Definidos nas Etapas 4 e 6: demais fluxos essenciais por teclado (UI), metas RNF-06/07 (DES), instalação
limpa, abertura, exportação e desinstalação no Windows 10 e 11 (DIST).
