# Relatório do Marco M3 — Motor normativo e exportação DOCX

Relatório vivo do marco: cada tarefa M3-Txx acrescenta a sua seção. Plano: `docs/PLANO_DE_IMPLEMENTACAO.md`.

| Tarefa | Situação | Data |
|---|---|---|
| M3-T00 Plano e decisões de formatação (D-M3-01 a 09) | CONCLUÍDA | 2026-11-02 |
| M3-T01 PoC com `docx` 9.15.1 no Word real | CONCLUÍDA | 2026-11-02 |
| M3-T02 Perfil `uft-2022` em dados | CONCLUÍDA | 2026-11-02 |
| M3-T03 Motor: estilos e corpo do texto | CONCLUÍDA | 2026-11-02 |
| M3-T04 Motor: seções, paginação, pré e pós-textuais | CONCLUÍDA | 2026-11-02 |
| M3-T05 Exportador DOCX | CONCLUÍDA | 2026-11-02 |
| M3-T06 Regressão documental | CONCLUÍDA | 2026-11-02 |
| M3-T07 Camadas externas: validador, LibreOffice e Word | CONCLUÍDA | 2026-11-02 |
| M3-T08 Tela de Exportar DOCX | CONCLUÍDA | 2026-11-02 |
| M3-T09 Tela de cópias de segurança | CONCLUÍDA | 2026-11-02 |
| M3-T10 Achados abertos da revisão do M2 | CONCLUÍDA | 2026-11-02 |
| M3-T11 e M3-T12 | PENDENTE | — |

## M3-T01 — PoC com `docx` 9.15.1 no Word real

**Implementação:** sessão principal. **Sem revisão independente.** Dependências locais: `docx` 9.15.1 (produção) e `fast-xml-parser` 5.11.2 (desenvolvimento).

`app/ferramentas/word/conferir-no-word.ps1` abre um DOCX numa instância própria do Word, em somente leitura, e nunca salva. O sumário é atualizado só na memória, para comparar com o gravado.

**Resultados** [VERIFICADO 2026-11-02, Word 16.0, `analise/poc-docx/`]

| Verificação | Resultado |
|---|---|
| `verificar.py` em `poc_final.docx` com 9.15.1 | 60 OK, 0 falhas |
| Word, 15 páginas | Abriu; 5 seções, 1 nota, 2 tabelas, 1 equação, 1 imagem, 17 campos |
| Sumário estimado × atualizado no Word, 15 páginas | Mesmas páginas |
| Sumário estimado × atualizado no Word, 149 páginas | **Idêntico** (L12) |
| Geração de 149 páginas, com estimativa | 4,3 s, processo inteiro |
| Texto do PDF do Word × LibreOffice | Mesma página a página, salvo a extração do texto da equação e do preenchimento do sumário |

**Achados da PoC**

| ID | Situação em 9.15.1 |
|---|---|
| L2 Estilo inexistente no sumário | Com o contorno `\\u`, sem estilo indefinido; a combinação com `\\t` não foi retestada |
| L3 Tabulação das listas e `IndexLink` | `IndexLink` agora é definido; tabulação em 9025/9026, não em 9071. **Contornar no M6**, quando as listas entrarem |
| L5 `SEQ` sem valor | Contornado: `SimpleField` com o número, 3 `SEQ` corretos no Word |
| L6 Número no filete da nota | **Não aparece no Word**, conferido em imagem. O filete nativo é curto, como D-M3-08 |
| L7 Numeração `hybridMultilevel` | Títulos corretos no Word. Inserir título novo no Word não foi testado |
| L12 Paginação estimada no Word | **Fechado** nos dois documentos |
| L13 Nada aberto no Word | **Fechado pela automação**, com a limitação abaixo |

**Limitações**
- **A automação não prova "abre sem reparo".** Em 6 arquivos estragados de propósito, recusou 3: XML quebrado, célula sem parágrafo e arquivo que não é ZIP. Abriu 3 sem erro: parágrafo com tabela dentro, elemento desconhecido e arquivo sem estilos. Com alertas desligados, não se sabe se o Word os repara em silêncio ou os tolera. Por isso, a conferência manual do usuário continua no fechamento do M3 (risco R47).
- `@types/node` e `undici-types` entram no inventário como dependências declaradas do `docx`, embora só tragam tipos. O M3-T05 deve deixá-los fora do pacote.
- O teste do script ainda não está em `verificar:tudo` (M3-T07).
- Na primeira execução, uma falha de chamada no script deixou 7 processos do Word abertos e ocultos. O script foi corrigido; nas rodadas seguintes o número não aumentou. Encerrar todo processo do Word foi bloqueado, porque poderia atingir um documento do usuário. Depois da autorização, foram encerrados só esses 7, por identificador, todos sem janela e iniciados na hora do teste.

**Testes:** `npm run verificar:tudo`: 1112/1112, 388 assinaturas, sem achado alto, E2E 17/17, memória 766 MB. Só a instalação das dependências mudou no app; o exportador ainda não as usa.

## M3-T02 — Perfil `uft-2022` em dados

**Implementação:** sessão principal, sem delegar a `especialista-normas`. **Sem revisão independente:** vale conferir no M3-T12 se cada propriedade transcreve a norma.

**Código**
- `perfis/uft-2022/perfil.json`: 43 regras (31 CONFIRMADA, 5 AMBÍGUA, 6 PENDENTE-FONTE provisórias, 1 IMPLEMENTADA), 17 parâmetros, 6 tipos de trabalho.
- `dominio/normas/perfil.ts` (tipos) e `dominio/esquemas/perfil.ts` (zod). `aplicacao/perfil-padrao.ts` é o único ponto que lê o JSON.
- `estruturaInicial` e `pendenciasPreTextuais` recebem o perfil por parâmetro. Os dados de tipos foram copiados por programa do TypeScript anterior, e os testes de tipos continuam iguais.

**Testes** [VERIFICADO 2026-11-02]: `verificar:tudo` 1174/1174, 388 assinaturas, E2E 17/17, memória 783 MB. `tests/perfil.test.ts` confere status e fonte de cada regra contra a matriz, conflito entre regras e perfil fictício (RNF-13). Mutações no JSON: 11/11.

**Limitações**
- O teste confere status e fonte contra a matriz, mas não o valor de cada medida contra o Manual, salvo nos pontos do DOC-01 a DOC-06. Um valor errado em outra regra só apareceria na revisão.
- Só formatação geral: a forma de capa, folha de rosto e demais elementos entra no M3-T04.
- O motor ainda não lê as regras: nada muda no documento até o M3-T03.
- O perfil é validado por teste, não ao carregar: ele faz parte do build.
- Deslocamentos de alínea (0,75 cm), recuo e deslocamento de subalínea (2,25 e 0,5 cm) vêm da PoC, com `origem: provisorio`. Sua decisão D-M3-04 fixou só o recuo da letra.

## M3-T03 — Motor: estilos e corpo do texto

**Implementação:** sessão principal, sem delegar a `especialista-documento`. **Sem revisão independente:** fica para o M3-T12. Nenhuma dependência nova.

**Código**
- `dominio/normas/formatado.ts`: só tipos, em twips e meios-pontos. `dominio/normas/motor.ts`: `formatar(doc, perfil, ajustes)`, puro.
- 15 estilos com nomes em português, como "Título 1 – Seção primária". Toda propriedade traz as RN de origem.
- Ambígua sem valor e PENDENTE-FONTE não provisória não são aplicadas e saem em `regrasAguardando`.
- Avisos: nota, citação ou alínea vazia e seção além do quinto nível, que sai como quinária.

**Testes** [VERIFICADO 2026-11-02]: `verificar:tudo` 1220/1220, 388 assinaturas, E2E 17/17, memória 755 MB. Mutações no motor: 16/16. Sem nenhuma regra no perfil, todo estilo sai vazio: nenhuma medida vem do código.

**Limitações**
- O motor ainda não é chamado pelo aplicativo, e nada foi exportado: a saída só foi conferida por teste de unidade.
- Falta o M3-T04: seções, paginação, pré e pós-textuais; título sem indicativo e referência têm estilo, sem blocos que os usem.
- `tituloSemIndicativo`, `referencia` e `numeroPagina` não têm entrelinha ou fonte de corpo próprias quando a regra não as define; a conferência no Word fica para o M3-T06 e T07.
- `rotuloAlineasDobradas` aceita só o valor decidido: não há outra sequência implementada.
- A opção de Arial existe no motor (`ajustes.fonte`), mas o trabalho ainda não guarda essa escolha, nem há tela: M3-T08.

## M3-T04 — Motor: seções, paginação, pré e pós-textuais

**Implementação:** sessão principal. **Sem revisão independente.** Nenhuma dependência nova. Capa, folha de rosto e folha de aprovação foram conferidas com as Figuras 3, 5 e 7 do Manual.

**Código**
- `DocumentoFormatado` passa a ter `pagina`, `notas` e `secoes`: capa, folha de rosto, ficha, pré-textual, textual, pós-textual. Blocos novos: `quadro` e `sumario`.
- `dominio/normas/motor-elementos.ts`: conteúdo de cada elemento. Perfil com 84 regras e 19 parâmetros: toda RN citada pelo motor existe no perfil, com status e fonte da matriz.
- Contagem desde a folha de rosto (RN-067), número do texto em diante (RN-068), sem recomeçar (RN-073).

**Testes** [VERIFICADO 2026-11-02]: `verificar:tudo` 1314/1314 antes do último teste, E2E 17/17, memória 764 MB; `tests/motor-elementos.test.ts` cobre os seis tipos. Mutações: 16/18; uma revelou falta de teste de página nova, acrescentado, e a outra não muda o comportamento.

**Limitações**
- **Brasão (RN-118):** a capa sai sem ele e com aviso; não há o arquivo no projeto.
- **Distribuição vertical:** usa `vAlign=both`, que espalha todos os parágrafos, aproximando a Figura 3. O LibreOffice pode ignorá-lo; conferir no M3-T05 e T07.
- **Sem conteúdo ainda:** referências (M4), glossário, índice, listas e corpo de apêndice e anexo (M6): saem título e identificação; as listas, só aviso.
- **Sumário:** todas as entradas com o mesmo estilo (RN-171); forma por nível fica para o M6.
- **Epígrafe:** sai como corpo, com aviso, porque RN-037 depende da NBR 10520.
- **Folha de aprovação:** o alinhamento central da banca vem do desenho, porque a anotação do Manual está cortada (RN-144). Os títulos fixos e os rótulos ("Keywords", "Área de concentração") estão no motor, não no perfil: um perfil em outra língua exigiria código, o que limita o RNF-13.
- Assinatura da banca é uma linha de sublinhados em texto.

## M3-T05 — Exportador DOCX

**Implementação:** sessão principal. **Sem revisão independente:** o plano pede `revisor-seguranca` no processo utilitário; fica para o M3-T12.

**Código**
- `exportacao/docx/exportador.ts`: `exportarDocx(formatado)`, sem decisão normativa, com duas passadas para o sumário sair com a página calculada.
- `principal/exportador-docx.ts`, `ipc/exportador-isolado.ts` e `ipc/protocolo-exportacao.ts`: processo utilitário, um por pedido, com prazo de 180 s.
- Motor: título 1 em maiúsculas também no texto, porque o sumário do Word copia o texto; âncoras; metadados do arquivo; estilo `tituloPosTextual`.
- `@types/node`, `undici-types` e os formatos `iife` e `umd` do `docx` saem do pacote. O `app.asar` ficou com 14 MB.

**Testes** [VERIFICADO 2026-11-02]
- `verificar:tudo`: 1341/1341 antes do ajuste final de um teste, E2E 17/17, memória 742 MB. Mutações: 15/15, depois de 3 testes acrescentados.
- **Word 16:** documento de monografia abriu com 11 páginas, 6 seções, 1 nota, 1 quadro; sumário gravado igual ao atualizado. Páginas da capa, da folha de rosto e da ficha conferidas em imagem. LibreOffice: mesmas 11 páginas.
- **O teste no Word achou um defeito** que o XML não mostrava: atualizar o sumário tirava REFERÊNCIAS e APÊNDICE. Corrigido com nível de estrutura só nos títulos pós-textuais.

**Limitações**
- **O processo utilitário e o pacote não exportaram nada ainda:** `exportarDocx` foi testada direto no Node. O caminho completo só roda com a tela, no M3-T08, e o `dist:fumaca` só confirmou que o pacote é gerado.
- Sem mídia: figuras e tabelas chegam no M5.
- Filete das notas: é o nativo do Word, curto, como D-M3-08; `fileteTw` ainda não é gravado no arquivo.
- Distribuição vertical na folha de rosto também é aproximada; o LibreOffice não foi conferido em imagem.
- O arquivo traz a data de geração em `docProps/core.xml`: não é byte a byte determinístico. A regressão do M3-T06 normaliza isso.

## M3-T06 — Regressão documental

**Implementação:** sessão principal, sem delegar a `engenheiro-qualidade`. **Sem revisão independente.** Conteúdo do corpus: fictício.

**Código**
- `tests/corpus/corpus.ts`: seis tipos e um documento difícil, com 5 níveis, notas, citação, listas de 28 itens, marcas, apêndices e anexos.
- `tests/regressao-docx.test.ts`: propriedades com a RN na mensagem e valores escritos a partir do Manual, fora do perfil; um erro no perfil, portanto, reprova. Toda marca dos estilos do motor precisa de RN (RF-05), e parágrafos não têm formatação direta.
- `tests/apoio/docx-normalizado.ts` e `tests/instantaneos/`: 35 instantâneos, sem data nem ids gerados. Aprovados nesta tarefa como linha de base da saída atual: **não é aprovação da aparência**.

**Limitações**
- Sem tabelas, figuras e equações, que chegam no M5.
- Propriedades conferem o que está em DOC-01 a DOC-06 e parte dos pré-textuais; o resto só tem instantâneo. DOC-07 e DOC-08 dependem do M3-T07.
- `toMatchFileSnapshot` grava instantâneo novo fora de CI: um arquivo apagado seria recriado em silêncio. Em CI, falha.

**Testes do M3-T06** [VERIFICADO 2026-11-02]: `verificar:tudo` 1421/1421, 388 assinaturas, sem achado alto, E2E 17/17, memória 753 MB. Mutações: 7/7, em CI, sem gravar instantâneo novo; o valor errado no perfil reprovou citando RN-004.

## M3-T07 — Validador OOXML, LibreOffice e Word

**Implementação:** sessão principal. **Sem revisão independente.** Instalado: .NET SDK 10.0.403 (`winget`, global, autorizado pelo usuário). Local: `DocumentFormat.OpenXml` 3.5.1, com `packages.lock.json`, e `pdfjs-dist` 6.4.299, ambos só para teste.

**Testes** [VERIFICADO 2026-11-02, nos 7 documentos do corpus]
- **Validador OOXML (Office 2021):** os 7 válidos, sem erro. Os 2 controles que a automação do Word deixou passar, parágrafo com tabela e elemento desconhecido, são reprovados. **R47 cai de risco:** agora há conferência de esquema automática.
- **LibreOffice:** os 7 convertem, com a capa numa só página; no documento difícil, cada entrada do sumário está na página indicada (DOC-07), e o número aparece do texto em diante.
- **Word 16:** os 7 abrem; sumário gravado igual ao atualizado, mesmas páginas, 3 notas e 6 seções no documento difícil.
- Mutação: página do sumário somada em 1 é reprovada no Word e no LibreOffice.

**Limitações**
- `verificar:tudo` agora abre o Word e o LibreOffice, e pede o SDK: sem o programa, o grupo pula com aviso. Se o Word travar num diálogo, o processo oculto pode ficar aberto; não é encerrado à força, para não atingir um Word do usuário.
- **Conferência manual continua:** aviso de reparo com alertas ligados e aparência final só o usuário vê. Válido no esquema não prova ausência de todo aviso.
- Regex do sumário no LibreOffice só cobre títulos sem ponto.
- `ferramentas/` não entra no pacote.

## M3-T08 — Tela de Exportar DOCX

**Implementação:** sessão principal. **Sem revisão independente:** o plano pede `revisor-seguranca`; fica para o M3-T12. Nenhuma dependência nova.

**Código**
- `aplicacao/portas/exportacao.ts`, `principal/ipc/manipuladores-exportacao.ts`, `interface/escrever/DialogoExportar.tsx`. O motor roda no principal, o DOCX no processo utilitário, e o renderer nunca vê caminho.
- Exporta o que está na memória, mesmo sem salvar. Uma exportação por vez. Grava por gravação atômica; se o arquivo já existia, sobra um `.bak`.

**Testes** [VERIFICADO 2026-11-02]
- `verificar:tudo`: unidade, externos 26/26 e E2E, com o número no registro do commit. Mutações no canal: 9/9. Axe sem violação séria no diálogo.
- **E2E no Electron real:** Ctrl+E, escolhe Arial, grava; o processo utilitário roda de verdade, e o XML gravado traz título e fonte. O diálogo nativo é trocado no teste.
- Pacote: `dist:fumaca` gerou o `app.asar` com `exportador-docx.js`, `docx` e `docx/layout`, sem `@types/node`; o `.exe` empacotado **não exportou** nesta tarefa.

**Defeito do teste, não do app:** EDT-06 falhava em cerca de 1 de 5 rodadas. Instrumentado, a causa é o `handlers.focus` do ProseMirror, que repõe a seleção 20 ms depois do foco; o teste selecionava antes disso. Com a espera, 30/30. Uma pessoa não seleciona em menos de 20 ms depois de sair da nota.

**Limitações**
- A fonte vale para a sessão: o trabalho ainda não a guarda, embora D-M3-01 fale em opção por trabalho. Guardar exige campo novo no formato v1.
- Arquivo aberto no Word: a gravação falha com a mensagem do salvamento, sem perda; não há E2E desse caso, só teste de unidade.
- O diálogo nativo real e a confirmação de sobrescrever não têm teste automático.
- Avisos repetidos não são agrupados.

## M3-T09 — Cópias de segurança

**Implementação:** sessão principal. **Sem revisão independente.** Nenhuma dependência nova.

**Código:** canais `listarBackups` e `abrirBackup`; `DialogoVersoes` agora serve às versões descartadas e às cópias. Novo item visível: Arquivo › Cópias de segurança…. Identificador opaco por janela e por listagem; no máximo 100 cópias, com aviso quando há mais.

**Testes** [VERIFICADO 2026-11-02]: unidade e E2E no Electron real: abrir a cópia não altera o arquivo nem a cópia. Mutações: 6/6, 3 delas depois de novos testes. Números no registro do commit.

**Limitações**
- Abre e deixa salvar como arquivo novo; **não substitui o original** por um clique. Para voltar, o autor escolhe o arquivo no "Salvar como…" (R-M2-05, R-M2-06).
- A lista mostra título e data do conteúdo: duas cópias do mesmo dia só se distinguem pela hora.
- Sem backups de trabalho aberto com o mesmo id: abrir a cópia enquanto ele está em edição é recusado como "já aberto".
- Edições na cópia aberta não têm recuperação até "Salvar como…" (R-M2-04, M3-T10).

## M3-T10 — Achados abertos da revisão do M2

**Implementação:** sessão principal. **Sem revisão independente:** mexe em recuperação e substituição de arquivos; o M3-T12 precisa cobrir.

| Achado | Situação |
|---|---|
| R-M2-04 | **Corrigido.** Trabalho sem arquivo manda instantâneo num conjunto reservado próprio, e a queda vira oferta. Fechar sem salvar guarda 7 dias; "Salvar como…" apaga |
| R-M2-06 | **Corrigido.** O arquivo substituído fica em `recuperacao-antigos` como `<nome>-substituido`, e aparece em Versões descartadas |
| R-M2-08 | **Corrigido.** `.bak` antigo no nome novo vai para `recuperacao-antigos`; a oferta de `.bak` mostra o título |
| R-M2-12 | **Corrigido.** Recuperar sem arquivo não abre sessão, então fechar não deixa o trabalho "já aberto" |
| R-M2-14 | **Corrigido.** Só o nome da chave vai ao log. Sem teste, por estar na inicialização do app empacotado |
| R-M2-16 | **Corrigido.** Excluir leva `<nome>.tmp-*` e `<nome>.bak.tmp-*` para a Lixeira |
| R-M2-05 | **Aceito, sem correção.** Dois arquivos com o mesmo id dividem a rotação: só pesa em dupla falha, e a saída é mudar o id no "Salvar como…", decisão maior que o achado. Fica registrado |
| R-M2-13, R-M2-15 | Sem mudança: Info; crédito do empacotador e política de privacidade na Etapa 7 |

Os testes acharam um defeito meu: dois conjuntos no mesmo segundo, em execuções diferentes, podiam coincidir e apagar uma queda sem decisão. Corrigido: o nome só é usado se não houver instantâneos nele.

**Testes** [VERIFICADO 2026-11-02]: unidade e E2E com queda real por `taskkill`: versão editada, processo morto, texto de volta como oferta. Mutações: 13/13, 2 delas depois de novos testes. Números no registro do commit.

**Limitações**
- Lixeira real e erros de disco nessas rotas só testados com falsos.
- Se a cópia do que será substituído falhar, "Salvar como…" segue, porque o usuário confirmou no diálogo: fica o `.bak` e uma linha no log.
- O nome `-substituido` não é mostrado: a tela só traz título e data.
