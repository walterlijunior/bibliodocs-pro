---
name: importacao-exportacao-docx
description: Importação e exportação de documentos — geração de DOCX editável fiel às regras (prioridade), PDF quando aplicável, importação de DOCX existente e conversão de modelos .doc antigos. Use ao implementar ou depurar qualquer entrada/saída de arquivo de documento.
---

# Importação e exportação (DOCX primeiro)

## Quando usar
Marco M3 (exportação DOCX), importação de trabalhos existentes, conversão dos modelos UFT `.doc`.
Agente principal: `especialista-documento`.

## Entradas
Modelo de documento formatado pelo motor; contrato de exportação; fixtures de regressão.

## Procedimento — exportação DOCX
1. Página A4, seções do Word separando pré-textuais (sem número exibido) e textuais (numeração exibida
   a partir do ponto definido na matriz), paisagem por seção quando necessário.
2. Estilos nomeados em português (ex.: "Título 1 – Seção primária", "Corpo do texto", "Citação longa",
   "Legenda", "Fonte da ilustração", "Referência") — o usuário continua editando no Word sem quebrar o padrão.
3. Tabelas nativas (não imagem); gráficos como imagem com resolução adequada; equações como OMML se a
   biblioteca permitir, senão imagem com texto alternativo (registrar limitação).
4. Campos: sumário (TOC), páginas (PAGE), legendas (SEQ) quando viável.
5. Metadados (autor, título) preenchidos; nada de dados pessoais além do informado pelo usuário.

## Procedimento — importação
1. DOCX: mapear estilos/títulos para seções, parágrafos, tabelas e imagens; produzir **relatório de
   importação** (reconhecido × não reconhecido). Nunca descartar conteúdo silenciosamente.
2. `.doc` (binário antigo): converter para `.docx` em `analise/` com LibreOffice headless
   (`soffice --headless --convert-to docx --outdir analise/convertidos <arquivo>`) ou pedir ao usuário
   que salve como `.docx` no Word. Instalar LibreOffice exige autorização.

## Saídas
Exportador/importador com testes e fixtures.

## Verificação de conclusão
- DOCX gerado abre como ZIP válido e o XML é bem formado (teste automatizado).
- Propriedades conferidas por teste: tamanho A4 (11906×16838 twips), margens, estilos, espaçamento.
- Abertura no Word e LibreOffice sem reparo — verificação manual registrada (quem, quando, versão).

## Dependências externas
Biblioteca DOCX da pilha (o sistema antigo usa docx.js embutido em `vendor/`). LibreOffice opcional
para conversão `.doc` e para verificação/visualização automatizada (`--convert-to pdf`).
