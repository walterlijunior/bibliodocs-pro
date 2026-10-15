---
name: tabelas-elementos-visuais
description: Criação e formatação de tabelas e quadros (inclusive importação de planilhas CSV/XLSX), figuras, gráficos e equações, com legenda, fonte, nota, numeração e referência cruzada; inclui o estudo visual do estudo Capcom (apenas exemplo de trabalho formatado). Use para qualquer elemento visual do documento.
---

# Tabelas e elementos visuais

## Quando usar
Marco M5; estudo de apresentação de tabelas; correções em legendas/numeração de elementos.
Agente principal: `especialista-elementos-visuais`.

## Entradas
Matriz (ilustrações, tabelas, Quadro 1 "Formatos" da p. 17 do Manual UFT); **Normas de apresentação
tabular do IBGE** em `materiais/normas/` (fonte oficial das tabelas, conforme o Manual, p. 20 e 43);
exemplos visuais de outras instituições (IFPR, FURB) em `materiais/referencias_visuais/`; `materiais/referencias_visuais/`
(`.docx` do estudo Capcom, se presente; extração de texto incluída); `visual-editor.js` do sistema
antigo (em `analise/`) como candidato.

## Procedimento
1. **Estudo visual (uma vez, antes de implementar)** — o estudo Capcom é só um exemplo de trabalho
   acadêmico formatado; analise a apresentação, ignore o assunto e não use o conteúdo dele em testes:
   - Com o `.docx`: descompactar em `analise/capcom_docx/`, ler `word/document.xml` e `word/styles.xml`;
     para 5–10 tabelas e quadros representativos, registrar bordas, larguras, fonte/corpo, alinhamentos,
     posição da legenda e da linha "Fonte:", repetição de cabeçalho, quebra entre páginas.
   - Só com a extração de texto: inventariar legendas e linhas "Fonte:" (ex.: "Quadro 1 – As duas
     camadas do J-GAAP" / "Fonte: elaborado pelo autor com base em…") e declarar o que não pôde ser estudado.
   - Fazer o mesmo, de forma mais breve, com os guias do IFPR e da FURB.
   - Registrar em `docs/relatorios/ESTUDO_VISUAL_TABELAS.md` separando **norma** (com `RN`, vinda do
     Manual UFT ou da Norma Tabular do IBGE) de **escolha de estilo** dos exemplos.
2. **Tabela/Quadro:** tipo explícito; editor de células; mesclagem; cabeçalho repetido; alinhamento
   decimal; números em pt-BR; paisagem opcional.
3. **Importação de planilha:** prévia, escolha de aba/intervalo, detecção de cabeçalho, conversão de
   números e datas com locale pt-BR, relatório de células não convertidas.
4. **Legenda, fonte, nota:** campos obrigatórios conforme `RN`; numeração automática por tipo;
   referência cruzada por ID.
5. **Figuras/gráficos/equações:** imagem com resolução mínima definida em RNF; gráfico gerado dos dados;
   equação com numeração conforme a matriz.
6. **Listas automáticas** de ilustrações e de tabelas geradas a partir dos elementos.

## Saídas
Módulos e testes; relatório do estudo visual.

## Verificação de conclusão
- Teste exporta 1 de cada elemento e confere legenda, numeração, fonte e bordas no DOCX.
- Teste de importação com arquivo de planilha contendo acentos, vírgula decimal, vazios e datas.
- Lista de ilustrações/tabelas bate com os elementos do documento.

## Dependências externas
Leitura de XLSX exige biblioteca (escolher por ADR; atenção à licença e a vulnerabilidades
conhecidas). Alternativa sem biblioteca: aceitar CSV no MVP e orientar exportação CSV no Excel.
