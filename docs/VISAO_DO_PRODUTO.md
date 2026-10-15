# Visão do produto — BiblioDocs Pro (nome provisório)

## Problema
Estudantes e pesquisadores da UFT gastam tempo formatando trabalhos à mão no Word, com erros
recorrentes em margens, numeração, citações, referências, legendas de tabelas e sumário. O manual
institucional existe (UFT, 2ª ed., 2022), mas transformá-lo em documento correto depende de
conhecimento que o autor nem sempre tem. Os modelos `.doc` ajudam, mas quebram com facilidade
e contêm inconsistências próprias.

## Proposta
Um aplicativo desktop em que o autor **escreve e organiza o conteúdo** e o aplicativo **garante a
forma**: estrutura do tipo de trabalho, numeração, citações ligadas às referências, tabelas e figuras
com legenda e fonte, sumário e listas automáticos, verificação de conformidade com o Manual e
exportação para DOCX editável.

## Público
1. Graduandos da UFT escrevendo TCC, artigo, relatório técnico ou projeto de pesquisa (primário).
2. Pós-graduandos (dissertação, tese).
3. Orientadores e bibliotecários que conferem conformidade (secundário).
Usuário inicial de referência: estudante de Ciências Contábeis da UFT (o sistema antigo nasceu
desse contexto, com modelos de consultoria e extensão).

## Princípios
- **Conteúdo separado da forma.** O usuário diz *o que* é cada trecho; o app aplica *como* fica.
- **Toda regra tem fonte.** Cada formatação aplicada é rastreável a uma página do Manual ou norma
  fornecida (ver `docs/POLITICA_DE_FONTES_NORMATIVAS.md`).
- **Offline e privado.** Trabalhos ficam no computador do usuário; recursos on-line são opcionais.
- **Saída editável.** O DOCX exportado continua editável no Word/LibreOffice com estilos nomeados.
- **Identidade própria.** Não é clone de Word nem de LibreOffice.

## Experiência e identidade
- **Layout inspirado no iTunes para Windows, com um pequi no lugar da maçã** (decisão do usuário,
  com captura de referência): barra superior com visor central, barra de menus, linha de navegação
  com seletor de coleção e abas, barra lateral de biblioteca e grade de capas dos trabalhos.
  Especificação em `docs/REFERENCIA_DE_LAYOUT.md`. Nenhum logotipo, ícone ou elemento de marca da
  Apple é usado; o pequi e os ícones são originais.
- **Pequi como identidade gráfica:** paleta derivada do fruto do Cerrado tocantinense, ícone e
  ilustrações originais. Variações serão apresentadas ao usuário (decisão editorial).

## Escopo da versão 1 (alvo)
Editor estruturado; seis tipos de trabalho UFT; motor normativo perfil "UFT 2022"; citações e
referências com verificação; tabelas/quadros com importação de planilha; figuras, gráficos e equações;
legendas, fontes e notas; sumário, listas, siglas, remissivas; apêndices e anexos; verificador de
conformidade; exportação DOCX; instalador Windows.

## Fora do escopo da versão 1
Colaboração em tempo real; nuvem própria; outros perfis institucionais (a arquitetura deve permitir);
revisão gramatical própria (pode existir integração opcional); macOS/Linux como alvo de distribuição
(desejável se a tecnologia permitir sem custo extra).

## Indicadores de sucesso
- Um TCC de exemplo completo exportado sem nenhuma não conformidade apontada pelo verificador e sem
  divergência encontrada em revisão manual contra o Manual.
- Tempo para criar um trabalho novo com capa, folha de rosto, sumário e uma tabela importada:
  menos de 10 minutos para um usuário que nunca viu o app (teste com usuário).
- DOCX abre sem reparo no Word e no LibreOffice.

## Relação com o sistema existente
O `tcc-uft` (web local React sem build, docx.js, jsPDF, IndexedDB, wrapper Electron opcional) é o
ponto de partida. A auditoria (Etapa 2) decide o que é reaproveitado; a arquitetura (Etapa 4) decide
se o novo app evolui esse código ou o substitui com migração de projetos.
