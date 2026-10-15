---
name: rastreabilidade-normativa
description: Inventário de materiais e construção/manutenção da matriz de requisitos normativos (RN-xxx) com fonte identificável (documento, página, seção) e critério de validação. Use na Etapa 1 (inventário), na Etapa 3 (análise normativa) e sempre que uma regra ABNT/UFT for implementada ou questionada.
---

# Rastreabilidade normativa

## Quando usar
- Etapa 1: inventariar materiais e verificar integridade.
- Etapa 3: construir `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md`.
- Em qualquer etapa: antes de implementar ou alterar uma regra de formatação.

## Entradas
`materiais/` (somente leitura), `docs/POLITICA_DE_FONTES_NORMATIVAS.md`,
`docs/INVENTARIO_DE_MATERIAIS.md`, relatório da auditoria (regras embutidas no código antigo).

## Procedimento — inventário (Etapa 1)
1. Listar `materiais/` e comparar com a tabela "Itens esperados" do inventário.
2. SHA-256 de cada arquivo (`Get-FileHash -Algorithm SHA256 <arquivo>` ou `sha256sum`).
3. Atualizar o status de cada item: `PRESENTE-ÍNTEGRO`, `PRESENTE-ALTERADO`, `AUSENTE`,
   `EXTRAÇÃO-TEXTO-APENAS`. Registrar data.

## Procedimento — matriz (Etapa 3)
1. Extrair o texto do Manual com número de página impressa.
2. Para cada regra: criar linha `RN-xxx` com colunas
   `ID | Regra | Fonte (doc, p., seção) | Aplica-se a | Validação automática | Status | Observações`.
   Status possíveis: `CONFIRMADA`, `PENDENTE-FONTE`, `CONFLITO`, `AMBÍGUA`, `IMPLEMENTADA`, `TESTADA`.
3. Cruzar com modelos (se presentes) e com regras embutidas no código antigo; divergências vão
   para "Observações" e, se relevantes, para a seção "Conflitos".
4. Conflitos → perguntar ao usuário com opções e efeito visível de cada uma.

## Saídas
Inventário atualizado; matriz preenchida; lista de conflitos e de `PENDENTE-FONTE`.

## Verificação de conclusão
- Nenhuma linha sem fonte ou status; IDs únicos e sequenciais.
- Amostragem de 20% das linhas conferida na página citada.
- Toda regra do sumário do Manual (regras gerais, citações, numeração, estrutura, ilustrações,
  tabelas, referências) aparece na matriz ou na lista de exclusões justificadas.

## Dependências externas
Extração de PDF: `pdftotext` (Poppler, via Git Bash/MSYS2) **ou** a ferramenta Read do Claude Code
com o parâmetro de páginas, **ou** biblioteca PDF da pilha escolhida. Qualquer uma serve.
