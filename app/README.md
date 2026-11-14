# BiblioDocs Pro

Aplicativo para Windows que ajuda a escrever e formatar trabalhos acadêmicos conforme o **Manual de Normalização da
Universidade Federal do Tocantins (UFT), 2.ª edição, 2022**, e a **Norma de Apresentação Tabular do IBGE**. Você escreve o
conteúdo; o aplicativo cuida da formatação e entrega um arquivo do Word (`.docx`) pronto para continuar editando.

Funciona sem internet. Os trabalhos ficam no seu computador; nada é enviado para fora.

> Versão 0.1.0, de teste. O instalador não tem assinatura digital: o Windows pode avisar ou bloquear ao instalar.
> Veja `docs/INSTALACAO_APP.md` antes de instalar.

## O que ele faz

- **Seis tipos de trabalho:** TCC (monografia), artigo como TCC, dissertação, tese, relatório técnico e projeto de
  pesquisa, cada um com os elementos e a ordem do Quadro 5 do Manual.
- **Pré-textuais:** capa, folha de rosto, ficha catalográfica (o texto vem do sistema de fichas da UFT), errata, folha
  de aprovação, dedicatória, agradecimentos, epígrafe, resumo e abstract com palavras-chave, listas e sumário.
- **Texto:** seções numeradas automaticamente até o 5.º nível, alíneas e subalíneas, citação longa, notas de rodapé,
  itálico, negrito, sobrescrito e subscrito.
- **Citações e referências:** cadastro de obras (livro, capítulo, artigo, legislação e outros), chamadas autor-data
  inseridas no texto e a lista de REFERÊNCIAS montada e ordenada sozinha; importação de BibTeX e RIS.
- **Tabelas, quadros, figuras, gráficos e equações:** numeração automática, título, fonte e notas; colar do Excel ou do
  LibreOffice e importar CSV; gráfico gerado da tabela; aviso de imagem com resolução baixa.
- **Remissivas** ("ver a Tabela 3", "seção 2.1") que acompanham a numeração, menções sem número ("o quadro a seguir")
  ligadas ao elemento e, na aba **Elementos**, o gerenciador de tabelas, quadros, figuras, gráficos e equações, com
  prévia, fonte, contagem de remissivas e os rótulos digitados à mão que ainda não estão ligados.
- **Siglas, símbolos e glossário:** a primeira ocorrência da sigla sai por extenso, e as listas são geradas.
- **Apêndices e anexos** com conteúdo próprio.
- **Verificador de conformidade** (F7): lista o que falta ou foge do Manual e da Norma Tabular, com a regra de origem
  e uma sugestão, e leva você ao lugar do problema; o relatório pode ser exportado em `.txt`.
- **Exportação DOCX** (Ctrl+E) em Times New Roman ou Arial, com margens, espaçamentos, paginação, sumário e listas.
- **Segurança dos dados:** salvamento automático, cópias de segurança e recuperação depois de uma queda.

## Primeiros passos

1. Abra o BiblioDocs Pro pelo atalho da Área de Trabalho ou do Menu Iniciar.
2. **Criar primeiro trabalho** (ou Ctrl+N) e escolha o tipo.
3. Preencha o título na aba **Escrever**. Na aba **Elementos**, a capa (autoria, curso) e a folha de rosto (natureza,
   orientação; Trabalho › **Dados do trabalho…** leva direto a ela), e os demais pré-textuais e pós-textuais.
4. Cadastre as obras na aba **Referências** (ou importe BibTeX e RIS).
5. Escreva na aba **Escrever**. Use a barra e o menu **Inserir** para citação, tabela, figura, gráfico, equação,
   remissiva, nota de rodapé e sigla.
6. Confira a aba **Conformidade** (ou F7) antes de entregar; F8 leva à próxima não conformidade.
7. **Exportar DOCX** (Ctrl+E) e confira o arquivo no Word. Ao abrir, o Word pode oferecer atualizar o sumário e as
   listas: pode aceitar.

## Atalhos principais

| Atalho | Ação |
|---|---|
| Ctrl+N | Novo trabalho |
| Ctrl+O | Abrir trabalho |
| Ctrl+S / Ctrl+Shift+S | Salvar / Salvar como |
| Ctrl+W | Fechar trabalho |
| Ctrl+Z / Ctrl+Y | Desfazer / Refazer |
| Ctrl+F | Buscar |
| Ctrl+Shift+C | Inserir citação |
| Ctrl+Alt+F | Nota de rodapé |
| Alt+= | Equação |
| Ctrl+Shift+L / Ctrl+Shift+Q | Alíneas / Citação longa |
| Ctrl+L / Ctrl+Shift+E / Ctrl+R / Ctrl+J | Alinhar o parágrafo à esquerda / centralizar / à direita / justificar |
| Ctrl+Shift+8 / Ctrl+Shift+7 | Lista com marcadores / lista numerada |
| Ctrl+PageUp / Ctrl+PageDown | Seção anterior / próxima |
| F5 | Atualizar a biblioteca |
| F7 | Verificar conformidade |
| F8 | Próxima não conformidade |
| F1 | Guia rápido |
| Ctrl+E | Exportar DOCX |

A lista completa fica em Ajuda › **Atalhos de teclado**.

Na Biblioteca, o seletor de coleção mostra, além dos trabalhos, as **Referências**, as **Figuras e Tabelas** e as
**Siglas** de todos os trabalhos da pasta, e os **Modelos** (um para cada tipo de trabalho do Manual da UFT).

## Onde ficam os seus dados

| O quê | Onde |
|---|---|
| Trabalhos (`.bdp`) | `Documentos\BiblioDocs Pro\Trabalhos`, ou a pasta escolhida em Arquivo › Escolher pasta da biblioteca |
| Cópias de segurança, recuperação, preferências | `%LOCALAPPDATA%\BiblioDocsPro` |
| Cache da janela | `%APPDATA%\BiblioDocs Pro` |

Copie o arquivo `.bdp` para levar o trabalho a outro computador. **Desinstalar não apaga nada disso.**

## Limitações desta versão

- Exporta só DOCX (não PDF). Para PDF, use "Salvar como PDF" no Word.
- Planilhas: colar do Excel ou importar CSV; arquivo `.xlsx` não é aberto direto.
- As regras de citação e referência seguem o Manual da UFT; as NBR 6023 e 10520 não estavam disponíveis, então alguns
  detalhes são critérios provisórios, marcados assim no verificador.
- No LibreOffice, a capa e a folha de rosto aparecem com o texto no alto da página (no Word saem distribuídas).
- Não há atualização automática: para atualizar, instale a versão nova por cima.

## Licença e componentes de terceiros

Ajuda › **Sobre o BiblioDocs Pro** mostra a versão e as licenças dos componentes de terceiros (também no arquivo
`TERCEIROS.txt`, na pasta do programa).

Para quem desenvolve: `DESENVOLVIMENTO.md`.
