# BiblioDocs Pro

Aplicativo livre para Windows que ajuda a escrever e formatar trabalhos acadêmicos conforme o **Manual de Normalização
da Universidade Federal do Tocantins (UFT), 2.ª edição, 2022**, e as **Normas de Apresentação Tabular do IBGE**. Você
escreve o conteúdo; o aplicativo cuida da formatação e entrega um `.docx` que continua editável no Word.

Funciona sem internet, e os trabalhos ficam no seu computador.

> **Estado:** versão 0.1.0, de teste. Ainda não há instalador publicado: o instalador para Windows vai ser assinado
> pelo programa gratuito da SignPath Foundation para projetos de código aberto, que está sendo solicitado. Até lá, o
> aplicativo pode ser executado a partir do código-fonte (ver "Rodar a partir do código").

## O que ele faz

- Seis tipos de trabalho (TCC, artigo como TCC, dissertação, tese, relatório técnico, projeto de pesquisa), com os
  elementos e a ordem do Manual da UFT.
- Pré-textuais, seções numeradas até o 5.º nível, alíneas, citação longa e notas de rodapé.
- Citações autor-data ligadas a um cadastro de obras, com a lista de referências montada sozinha; importação de BibTeX e
  RIS.
- Tabelas e quadros (colar do Excel ou importar CSV), figuras, gráficos gerados das tabelas, equações e remissivas que
  acompanham a numeração.
- Siglas, símbolos, glossário, apêndices e anexos.
- Verificador de conformidade com a regra de origem de cada aviso.
- Exportação DOCX com margens, espaçamentos, paginação, sumário e listas.

Guia de uso: [`app/README.md`](app/README.md). Instalação: [`docs/INSTALACAO_APP.md`](docs/INSTALACAO_APP.md).

## Rodar a partir do código

Requisitos: Windows 10 ou 11 (64 bits) e Node.js 24 com npm 11.

```powershell
cd app
npm ci
npm run dev        # abre o aplicativo
npm run verificar  # tipos, testes, auditoria de dependências
```

Os demais comandos (testes de ponta a ponta, conferência no Word e no LibreOffice, empacotamento) estão em
[`app/DESENVOLVIMENTO.md`](app/DESENVOLVIMENTO.md).

## Normas e rastreabilidade

Cada regra de formatação aplicada tem um identificador (`RN-xxx`) e a fonte (documento e página) na
[matriz de requisitos normativos](docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md). Regras sem fonte disponível no projeto (as
NBR 6023 e 10520, por exemplo) ficam marcadas como pendentes ou como critério provisório, visível no verificador.

**Os documentos de referência não acompanham o repositório** (direitos de terceiros): o Manual de Normalização da UFT
está no site da UFT, e as Normas de Apresentação Tabular, na biblioteca do IBGE. Quem desenvolve coloca as cópias em
`materiais/` (ver [`materiais/LEIA-ME.md`](materiais/LEIA-ME.md)); a pasta é ignorada pelo git.

## Como foi feito

O projeto foi desenvolvido por etapas com o Claude Code, a partir de um kit de instruções, agentes e skills descrito
em [`KIT_CLAUDE_CODE.md`](KIT_CLAUDE_CODE.md). Plano, decisões (ADR), relatórios de cada marco e de revisão ficam em
[`docs/`](docs/); o histórico de entregas, em [`CHANGELOG.md`](CHANGELOG.md).

## Licença

Copyright © 2026 os autores do BiblioDocs Pro.

Este programa é software livre: você pode redistribuí-lo e modificá-lo nos termos da Licença Pública Geral GNU,
versão 3 ou (a seu critério) qualquer versão posterior, publicada pela Free Software Foundation. É distribuído na
esperança de ser útil, mas **sem nenhuma garantia**, nem mesmo a implícita de comercialização ou de adequação a um
propósito específico. Texto completo em [`LICENSE`](LICENSE).

Os componentes de terceiros usados pelo aplicativo têm as próprias licenças (todas MIT), listadas em
[`app/recursos-build/TERCEIROS.txt`](app/recursos-build/TERCEIROS.txt) e no diálogo "Sobre".
