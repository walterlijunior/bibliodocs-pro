---
name: sumario-listas-remissivas
description: Geração de sumário, listas automáticas (ilustrações, tabelas, abreviaturas e siglas, símbolos), referências cruzadas (seções, figuras, tabelas, equações) e notas de rodapé, com atualização automática ao editar. Use quando mexer em qualquer elemento que dependa de numeração ou paginação.
---

# Sumário, listas e referências cruzadas

## Quando usar
Marco M6; qualquer alteração em numeração de seções/elementos ou em paginação.
Responsável: sessão principal, com `especialista-documento` (sumário, notas, remissivas de seção)
e `especialista-elementos-visuais` (listas de ilustrações/tabelas).

## Entradas
Modelo de documento; matriz (sumário, listas, títulos sem indicativo numérico, paginação).

## Procedimento
1. **Uma única fonte de numeração:** seções e elementos recebem número calculado a partir do modelo;
   sumário, listas e remissivas leem desse cálculo (nunca texto fixo).
2. **Sumário:** níveis, alinhamento e destaques conforme a matriz; no DOCX, preferir campo TOC
   atualizável **e** gerar texto inicial correto (o usuário pode não atualizar campos).
3. **Paginação:** o número de página só existe no layout final; documente a estratégia (campo do Word,
   ou paginação calculada pelo app) no ADR e teste-a.
4. **Remissivas:** objeto com ID do alvo; texto "Seção 2.1", "Tabela 3" gerado; alvo removido gera
   aviso no verificador (remissiva quebrada).
5. **Listas de siglas e símbolos:** ordenação e posição conforme a matriz.
6. **Notas de rodapé:** numeração sequencial; formatação conforme `RN`.

## Saídas
Geradores com testes; avisos de remissivas quebradas no verificador.

## Verificação de conclusão
- Teste: inserir seção no meio → sumário, listas e remissivas renumeram.
- Teste: excluir figura referenciada → aviso de remissiva quebrada.
- DOCX: sumário presente e coerente com os títulos.

## Dependências externas
Nenhuma. Atualização de campos de sumário depende do Word/LibreOffice do usuário (limitação a documentar).
