---
name: regressao-documental
description: Testes de regressão documental — gerar documentos de referência, comparar o DOCX exportado com fixtures por XML normalizado e por propriedades normativas, e relatar diferenças. Use após qualquer mudança no motor normativo, modelo de documento ou exportação, e na Etapa 6.
---

# Regressão documental

## Quando usar
Depois de mudanças em `regras-formatacao`, `editor-academico`, `importacao-exportacao-docx`,
`tabelas-elementos-visuais`, `citacoes-referencias`, `sumario-listas-remissivas`; Etapa 6.
Agente principal: `engenheiro-qualidade`.

## Entradas
Documentos-fonte de teste (projetos do app) cobrindo cada tipo de trabalho; fixtures DOCX aprovadas.

## Procedimento
1. **Corpus de teste** (criar na primeira vez, em `app/tests/corpus/`): um projeto por tipo de trabalho
   + um "documento difícil" (tabela longa com quebra, quadro, figura, equação, citação longa, nota,
   apêndice, anexo, siglas, 5 níveis de seção). Conteúdo fictício e neutro — nunca dados reais do usuário
   sem autorização, nem o conteúdo do estudo Capcom (que é só exemplo de formatação).
2. **Exportar** cada projeto para DOCX em diretório temporário.
3. **Comparar em dois níveis:**
   - *Propriedades normativas:* extrair do XML margens, página, estilos, espaçamentos, recuos,
     numeração e conferir com os `RN` (falha cita o `RN`).
   - *Estrutural:* XML normalizado (sem IDs aleatórios, datas, rsid) comparado à fixture; diferença
     gera relatório legível.
4. **Fixture só muda conscientemente:** quando a diferença for intencional, atualizar a fixture no
   mesmo commit e explicar no CHANGELOG.
5. Opcional: converter para PDF com LibreOffice headless e comparar contagem de páginas/posições de
   títulos (detecta quebras de página erradas).

## Saídas
Testes automatizados; relatório de diferenças; atualização de `docs/MATRIZ_DE_TESTES.md`.

## Verificação de conclusão
Suíte roda com um comando; resultado real registrado; nenhuma fixture alterada sem justificativa.

## Dependências externas
Nenhuma obrigatória (DOCX é ZIP + XML). LibreOffice é opcional para o nível PDF; sem ele,
registrar "verificação visual manual pendente".
