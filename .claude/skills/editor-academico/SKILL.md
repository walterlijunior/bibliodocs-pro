---
name: editor-academico
description: Desenvolvimento do modelo de documento e do editor acadêmico (seções numeradas, parágrafos, elementos pré-textuais, textuais e pós-textuais, tipos de trabalho, apêndices e anexos, siglas). Use ao criar ou alterar a estrutura do documento ou a edição de conteúdo no app.
---

# Editor acadêmico e modelo de documento

## Quando usar
Marcos M2 e M6 da Etapa 5; qualquer mudança na estrutura do documento ou na edição de texto.
Agente principal: `especialista-documento`.

## Entradas
ADR de tecnologia; contrato do modelo de documento (Etapa 4); `RN-xxx` de estrutura (elementos
obrigatórios/opcionais por tipo, ordem, numeração progressiva, títulos sem indicativo numérico).

## Procedimento
1. **Modelo antes da tela:** defina/atualize os tipos do modelo (Trabalho, TipoDeTrabalho,
   Seção, Bloco, ElementoPré/Pós, Apêndice, Anexo, Sigla) com testes unitários puros.
2. **Tipos de trabalho** (TCC, artigo, dissertação, tese, relatório técnico, projeto de pesquisa):
   cada um declara seus elementos e ordem a partir da matriz — não por cópia dos modelos `.doc`.
3. **Numeração progressiva calculada**, nunca digitada: inserir/mover/remover seção renumera tudo
   (o sistema antigo tem `reordenarNumeracao` em `abnt.js` — candidato a reaproveitar).
4. **Objetos no texto:** citação, remissiva, nota de rodapé, sigla e chamada de figura/tabela são
   nós do modelo com ID estável; o texto exibido é derivado.
5. **Persistência:** formato de projeto versionado; teste de salvar → abrir → comparar.
6. **Apêndices/anexos:** identificação por letras e título conforme a matriz; suporte a imagem anexada.
7. **Siglas:** cadastro, ordenação alfabética, uso no texto ligado ao cadastro.

## Saídas
Código do modelo/editor em `app/` com testes; atualização do contrato se mudou (com aviso ao arquiteto).

## Verificação de conclusão
- Testes: criar trabalho de cada tipo e conferir elementos obrigatórios; mover seção e conferir
  numeração; salvar/abrir sem perda.
- Nenhuma regra estrutural sem `RN-xxx`.

## Dependências externas
Nenhuma além da pilha escolhida no ADR.
