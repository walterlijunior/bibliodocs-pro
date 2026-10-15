# Requisitos funcionais

Cada requisito tem critérios de aceitação verificáveis. Detalhes de formatação **não** são fixados
aqui: eles vêm da `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md` (IDs `RN-xxx`). Prioridade:
**M** = obrigatório na v1 (MVP no marco indicado), **D** = desejável na v1, **F** = futuro.

| ID | Requisito | Prior. | Marco |
|---|---|---|---|
| RF-01 | Gerenciar trabalhos (biblioteca) | M | M1 |
| RF-02 | Tipos de trabalho UFT | M | M2 |
| RF-03 | Editor estruturado de seções e texto | M | M2 |
| RF-04 | Elementos pré-textuais | M | M2 |
| RF-05 | Motor normativo com perfil UFT 2022 | M | M3 |
| RF-06 | Exportação DOCX editável | M | M3 |
| RF-07 | Citações ligadas a referências | M | M4 |
| RF-08 | Referências bibliográficas | M | M4 |
| RF-09 | Tabelas e quadros com importação de planilha | M | M5 |
| RF-10 | Figuras, gráficos e equações | M (equações: D) | M5 |
| RF-11 | Legendas, fontes, notas e referências cruzadas | M | M5–M6 |
| RF-12 | Sumário e listas automáticas | M | M6 |
| RF-13 | Siglas, abreviaturas e símbolos | M | M6 |
| RF-14 | Apêndices, anexos e demais pós-textuais | M | M6 |
| RF-15 | Verificador de conformidade | M | M7 |
| RF-16 | Importação de trabalhos existentes | D | após M7 |
| RF-17 | Exportação PDF | D | após M7 |
| RF-18 | Revisão ortográfica/gramatical | D (opcional, offline preferível) | após M7 |

## Detalhamento e critérios de aceitação

**RF-01 Gerenciar trabalhos.** Criar, abrir, salvar, duplicar, renomear, excluir (com confirmação)
e listar trabalhos na biblioteca; salvamento automático; backup.
*Aceite:* criar → fechar app → reabrir → conteúdo idêntico; excluir pede confirmação; arquivo de
projeto pode ser copiado para outro computador e aberto.

**RF-02 Tipos de trabalho.** TCC, artigo, dissertação, tese, relatório técnico, projeto de pesquisa;
cada tipo traz seus elementos obrigatórios e opcionais na ordem definida pela matriz.
*Aceite:* para cada tipo, um trabalho novo contém exatamente os elementos `RN` obrigatórios.

**RF-03 Editor estruturado.** Seções em árvore com numeração progressiva automática, mover/recuar/
promover seção, parágrafos, alíneas, citação longa, nota de rodapé; desfazer/refazer.
*Aceite:* mover a seção 3 para antes da 2 renumera tudo, inclusive remissivas.

**RF-04 Pré-textuais.** Capa, folha de rosto, ficha catalográfica (campo/anexo conforme orientação
UFT), folha de aprovação, dedicatória, agradecimentos, epígrafe, resumo e abstract com palavras-chave.
*Aceite:* campos obrigatórios validados; ausência de obrigatório aparece no verificador.

**RF-05 Motor normativo.** Aplica regras `RN` do perfil "UFT 2022"; regra sem fonte não é aplicada.
*Aceite:* toda formatação do DOCX é rastreável a um `RN`; teste falha se aparecer formatação sem `RN`.

**RF-06 Exportação DOCX.** Arquivo editável com estilos nomeados, seções, tabelas nativas, sumário.
*Aceite:* abre sem reparo no Word e no LibreOffice; propriedades conferidas por teste automatizado.

**RF-07 Citações.** Inserir citação escolhendo a obra; forma parentética ou narrativa; página;
citação direta curta/longa; apud.
*Aceite:* alterar o ano da obra atualiza todas as chamadas; citação sem obra é impossível de criar.

**RF-08 Referências.** Cadastro por tipo de obra; formatação automática; ordenação; lista gerada só
com obras citadas (ou opção explícita para incluir não citadas).
*Aceite:* cada tipo suportado tem teste com saída esperada e fonte; verificador aponta órfãs e não citadas.

**RF-09 Tabelas e quadros.** Criar/editar; importar CSV/XLSX com prévia; formatação numérica pt-BR;
cabeçalho repetido; paisagem.
*Aceite:* planilha com acentos, vírgula decimal e células vazias importada sem perda; tabela exportada
como tabela nativa do Word.

**RF-10 Figuras, gráficos, equações.** Inserir imagem; gerar gráfico de tabela; equação numerada.
*Aceite:* figura com resolução abaixo do mínimo gera aviso; gráfico atualiza ao mudar a tabela.

**RF-11 Legendas, fontes, notas, remissivas.** Legenda e linha de fonte obrigatórias conforme `RN`;
numeração por tipo; remissivas por ID.
*Aceite:* excluir elemento referenciado gera aviso de remissiva quebrada.

**RF-12 Sumário e listas.** Sumário, lista de ilustrações, de tabelas, de quadros (se aplicável),
geradas automaticamente.
*Aceite:* inserir seção/figura atualiza sumário/listas sem ação manual.

**RF-13 Siglas.** Cadastro, uso no texto, lista ordenada; aviso de sigla usada sem cadastro.

**RF-14 Pós-textuais.** Referências, glossário, apêndices e anexos (identificação por letra), índice
(F); anexação de imagens em apêndice/anexo.

**RF-15 Verificador de conformidade.** Lista de não conformidades com severidade, local (link para o
trecho), `RN` violado e sugestão de correção; exportação do relatório.
*Aceite:* documento de teste com 10 não conformidades plantadas → as 10 detectadas, sem falsos
positivos no documento correto de referência.

**RF-16 Importação.** DOCX existente → modelo (melhor esforço) com relatório; backup JSON do sistema
antigo `tcc-uft` → projeto novo.

**RF-17 PDF.** Exportação PDF fiel ao DOCX ou via conversão documentada.

**RF-18 Revisão de texto.** Opcional; se usar serviço on-line, avisar e pedir consentimento antes de
enviar texto (o sistema antigo usa LanguageTool on-line).
