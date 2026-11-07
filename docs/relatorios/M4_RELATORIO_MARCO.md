# Relatório do Marco M4 — Citações e referências

Relatório vivo do marco: cada tarefa M4-Txx acrescenta a sua seção. Plano: `docs/PLANO_DE_IMPLEMENTACAO.md`.

| Tarefa | Situação | Data |
|---|---|---|
| M4-T00 Decisões D-M4-01 a 07 | CONCLUÍDA | 2026-11-05 |
| M4-T01 Obras e citações no formato | CONCLUÍDA | 2026-11-05 |
| M4-T02 Formatadores de referência (base e livro) | CONCLUÍDA | 2026-11-07 |
| M4-T03 Chamadas de citação | CONCLUÍDA | 2026-11-07 |
| M4-T04 Tipos da primeira leva | CONCLUÍDA | 2026-11-07 |
| M4-T05 Lista REFERÊNCIAS e chamadas no DOCX | CONCLUÍDA | 2026-11-07 |
| M4-T06 Cadastro de obras | CONCLUÍDA | 2026-11-07 |

## M4-T00 — Decisões

O usuário aceitou as recomendações ("siga as recomendações", 2026-11-05). Como a NBR 10520 e a NBR 6023 não estão no projeto, tudo fica provisório (D-M4-07). Os detalhes estão na matriz normativa, D-M4-01 a D-M4-07.

## M4-T01 — Obras e citações no formato v1

**Implementação:** sessão principal, sem delegar a `arquiteto-software` nem a `especialista-referencias`. **Sem revisão independente:** fica para o M4-T10. Nenhuma dependência nova. Decisões técnicas no adendo do M4-T01 no ADR-0004.

**Código**
- **Modelo** (`dominio/modelo`): `Obra`, `Autor`, `ObraNoTodo`, `EventoObra`, `InlineCitacao` e `ObraCitada`; `TIPOS_OBRA`, `FUNCOES_RESPONSAVEL` e `citacoesDoDocumento`. `idsDoBloco` passa a contar a citação.
- **Formato** (`dominio/esquemas`):
  - esquemas `esquemaObra`, `esquemaAutor`, `esquemaInlineCitacao` e `esquemaObraCitada`;
  - `obras` no documento;
  - mensagem própria para citação em título ou em nota;
  - ids únicos com citação e obra, e citação sem obra recusada;
  - JSON Schema regenerado.
- **Editor:** nó `chamadaCitacao` com ida e volta exata, sem `parseDOM`. O motor avisa `CITACAO_ADIADA`.

**Testes**
- Fixture válida `documento-bordas-m4.json`, com uma obra de cada tipo e citações em parágrafo, citação longa, alínea e subalínea, com apud, grifo e "sem paginação".
- 10 fixtures inválidas: citação sem obra, apud sem obra, lista de obras vazia, id repetido, citação em nota, título vazio, página com "sem paginação", ano incerto sem ano, e outras.
- Ida e volta pelo `.bdp` e pelo editor.

**Limitações**
- Ainda não há como criar obra nem citação pelo aplicativo (M4-T06 e T07). Elas só chegam por arquivo.
- Citação dentro de nota de rodapé fica recusada até o editor de nota guardar mais que texto.
- O nome de campo `secao` (seção ou caderno do jornal) não tem relação com a seção do trabalho.

## M4-T02 — Formatadores de referência

**Implementação:** sessão principal, em `app/src/dominio/bibliografia/`, sem dependência nova. **Sem revisão independente:** fica para o M4-T10.

**Escopo.** O plano pede formatadores "por tipo", e o M4-T04 traz a primeira leva de tipos. O M4-T02 entrega a base comum e o **livro**, que exercita quase todos os elementos. Os outros oito tipos respondem com o aviso `TIPO_SEM_FORMATADOR` até o M4-T04 e não inventam nada.

**Código**
- `trechos.ts`: a referência sai em trechos com texto, destaque e a RN (ou decisão D-M4) de origem. Também traz os avisos e o fecho de elemento, que não repete o ponto de "et al.", "M." ou "?".
- `autores.ts`:
  - SOBRENOME, Prenomes (RN-180, RN-181) e entidade em maiúsculas (RN-187);
  - "; " até três autores (RN-183), *et al.* em itálico depois disso (RN-184, RN-185), ou todos pela opção do C-B12;
  - (org.)/(orgs.), (coord.)/(coords.), (ed.), (comp.) (RN-186).
- `datas.ts`: meses do Anexo, p. 72 (RN-190); "[2016?]" e "[2016]" (D-M4-04, D-M4-05); sufixo "2020a".
- `referencia.ts`: entrada e título em negrito com subtítulo sem destaque (RN-178), entrada pelo título com a primeira palavra em maiúsculas (RN-179), edição sem a 1.ª (RN-192), imprenta com "[S. l.]" e "[s. n.]" (RN-193), páginas, on-line (RN-189), *E-book* (RN-191), tradução (RN-204).
- `ordenacao.ts`:
  - ordem alfabética pt-BR (RN-176), autor a autor e sobrenome antes dos prenomes, de modo que SILVA, José vem antes de SILVA NETO, Roberto;
  - desempate por ano e título, sem ano por último (D-M4-05);
  - sufixos a, b para mesmo autor e ano (D-M4-03).

**Testes:** `tests/bibliografia-referencias.test.ts`, com 32 casos. Os 9 exemplos de livro das p. 50–53 do Manual saem iguais, com o destaque conferido. Também cobre autores com sufixo de parentesco, meses, ano incerto, avisos, pureza, ordenação e sufixos.

**Limitações e escolhas provisórias**
- Faltam campos no modelo para coleção ou série (RN-194) e para "Título original" (RN-204). O exemplo BAUMAN sai sem o título original. Esses campos entram com o cadastro (M4-T06), por adendo aditivo.
- Título iniciado por artigo ("OS PERIGOS", PF-09 f): só a primeira palavra sobe.
- Plural de (ed.) e (comp.): o Manual não dá, e fica no singular.
- Sem local e sem editora juntos sai "[S. l.]: [s. n.]". A forma combinada da NBR 6023 não está no projeto (D-M4-07).
- Posição de *E-book* junto com "Disponível em": não há exemplo com os dois, e o *E-book* vai por último.
- A opção "listar todos os autores" (C-B12) existe no formatador. A ligação ao perfil fica para o M4-T05.

**Verificação (2026-11-07)**
- `npm run verificar` passou, com 1517 testes. `test:externos` passou, com 27 testes.
- Na primeira rodada, `tests/recuperacao.test.ts` (R-M2-09) falhou. A data fixa do teste, 2026-10-30, venceu os 7 dias de Versões descartadas em 2026-11-06. O código não regrediu: o teste passou a usar uma data de dois dias atrás.
- No `verificar:tudo`, 20 de 21 E2E passaram. O de desempenho mediu pico de memória de 814 MB, com meta abaixo de 800. Repetido sozinho duas vezes, passou com 781 e 775 MB. A interface não importa `bibliografia`. É a instabilidade da medida do R46, e a folga ficou pequena.
- `npm audit` mostra 7 avisos moderados novos (`minimatch`, `fast-uri`), todos na cadeia do `electron-builder`. Com `--omit=dev` dá 0 vulnerabilidades, e ficam no R35.

## M4-T03 — Chamadas de citação

**Implementação:** sessão principal, em `app/src/dominio/bibliografia/chamadas.ts`, sem dependência nova. **Sem revisão independente:** fica para o M4-T10.

**Código**
- `formatarChamada(citacao, contexto, opcoes)` devolve trechos com a RN de origem e avisos. A chamada é gerada da obra a cada vez, então mudar o ano ou o autor muda todas as chamadas (aceite do RF-07).
- Formas:
  - parentética (SOBRENOME, ano, p. X) e narrativa Sobrenome (ano, p. X) (RN-082, RN-083);
  - apud com a página das duas obras, sem itálico (RN-098); na narrativa, a obra consultada fica dentro dos parênteses, em maiúsculas (RN-099);
  - grifo dentro dos parênteses, depois da página (RN-090);
  - entrada pelo título, "(ANTEPROJETO..., 1987, p. 55)": artigo ou monossílabo inicial leva a palavra seguinte (RN-091).
- Decisões provisórias:
  - "; " entre autores na parentética; mais de três, *et al.* (D-M4-02);
  - várias obras com "; " e sufixos a, b iguais aos da referência (D-M4-03);
  - "[2016?]" e "não paginado" (D-M4-04).
- `contextoDeChamadas(obras)` calcula uma vez por documento os sufixos e as obras cujas chamadas sairiam iguais sem serem do mesmo autor, que geram o aviso `SOBRENOME_E_ANO_REPETIDOS` (D-M4-03).
- Perfil: `edicaoNbr10520` vale "2002" por padrão, como o Manual (C-01). "2023" é opção provisória: caixa mista também nos parênteses, com a origem C-01. A ligação ao perfil fica para o M4-T05.

**Testes:** `tests/bibliografia-chamadas.test.ts`, com 32 casos. Os 12 exemplos das p. 22–26 do Manual saem iguais. Também cobre as decisões D-M4-02 a 04, C-01 (2002 e 2023), entrada pelo título, RF-07 e obra ausente.

**Escolhas sem exemplo no Manual** (as quatro primeiras foram aceitas pelo usuário como D-M4-08 em 2026-11-07; todas são provisórias)
- Três autores na narrativa: "Lima, Costa e Souza (2010)". O Manual só mostra dois ("Aranha e Martins").
- Narrativa com várias obras: cada obra com o seu ano, separadas por "; ", e aviso `NARRATIVA_COM_VARIAS_OBRAS`.
- Obra sem ano: a chamada sai sem data, "(LIMA, p. 5)", com aviso. D-M4-04 só trata a data provável.
- Sobrenome digitado todo em maiúsculas desce na narrativa ("SILVA NETO" → "Silva Neto", com "da", "de", "do" minúsculas). Digitado em caixa mista fica como está. Nome de entidade fica como digitado na narrativa, para siglas como ABNT não descerem.
- Monossílabo reconhecido por ter um só grupo de vogais, o que erra em hiatos curtos ("Rio").
- Volume na chamada, "(CANDIDO, 1993, v. 2, p. 12)", p. 23: não há campo de volume em `ObraCitada`. Fica para quando o editor de citação existir (M4-T07).
- A pontuação final em volta da chamada (D-M4-01) depende do texto do usuário. Fica para o motor (M4-T05) ou o verificador (M4-T08).

**Verificação (2026-11-07):** `npm run verificar:tudo` passou: 1549 testes unitários, 27 externos e 21 de 21 E2E. O pico de memória foi de 744 MB.

## M4-T04 — Tipos da primeira leva

**Implementação:** sessão principal, sem dependência nova. **Sem revisão independente:** fica para o M4-T10. O formatador foi dividido para não criar ciclo de importação:
- `elementos.ts`: elementos comuns, como entrada, título, *In*:, edição, imprenta, páginas, data, DOI e on-line;
- `tipos-obra.ts`: um formatador por tipo;
- `referencia.ts`: só a distribuição pelo tipo.

**Tipos e regras**
- **Capítulo e verbete** (RN-200 a 203, *In*: em itálico, RN-188):
  - o todo leva negrito;
  - sem autor no todo, entra pelo título ("*In*: DICIONÁRIO da língua portuguesa");
  - páginas "p. 39-68", ou o que foi digitado ("Cap. 2").
- **Trabalho acadêmico** (RN-206):
  - ano, "222 f." (D-M4-05) e natureza – Universidade, Programa, Cidade, ano (C-B15).
- **Artigo de periódico** (RN-212 a 214):
  - periódico em negrito, depois v., n., p. e a data do fascículo como digitada;
  - DOI antes de "Disponível em", como no exemplo DANTAS.
- **Trabalho em evento** (RN-207, 209):
  - NOME DO EVENTO, número., ano, local; depois "**Anais** [...]" ou o título dos anais (`noTodo.titulo`);
  - sem ano de publicação, vale o ano do evento.
- **Artigo de jornal** (RN-215 a 218):
  - os três padrões: com seção; com autor e sem seção (página antes da data); sem autor (seção e página depois da data, como o exemplo da p. 57).
- **Norma** (RN-222): **NBR 6023**: título.
- **Legislação** (RN-223, C-B16):
  - com veículo oficial, o negrito vai no veículo, seguido de seção, local, n., p. e data;
  - sem veículo, vai no título, com identificação antes ("Constituição (1988)") e imprenta.
- **Documento on-line** (RN-189):
  - o Manual não tem padrão próprio: AUTOR. **Título**. Imprenta só se houver local ou editora, senão só o ano. Depois o endereço e o acesso. Provisório.
- O que falta vira aviso `ELEMENTO_AUSENTE` com a RN, nunca texto inventado.

**Testes:** `tests/bibliografia-tipos.test.ts`, com 40 casos.
- 20 exemplos do Manual (p. 52–60, 70) saem iguais, com o destaque conferido.
- Também cobre o documento on-line, os avisos, o ano do evento, o sufixo na data do periódico e cada obra da fixture do M4-T01 (sem espaço duplo nem pontuação repetida).

**Fora por falta de campo** (os exemplos foram testados sem o elemento)
- suplemento do periódico ("Supl. 3", DOREA);
- "ano 138" do Diário Oficial;
- dois eventos na mesma referência (ZUBEN, CONGRESSO DO CENTRO-OESTE);
- legislação dentro de coletânea ("*In*: VADE mecum", Decreto-lei 200);
- coleção ou série e título original (do M4-T02).

O cadastro (M4-T06) é o lugar de decidir quais desses campos entram.

**Outros tipos do 5.19** (RN-208, 210, 211, 219 a 221, 224 a 229: evento digital, palestra, coleção de periódico, entrevistas, correspondência, jurisprudência, patente, iconográfico, cartográfico, audiovisual, tridimensional) seguem fora até a segunda leva, como decidido no D-M4-06.

**Verificação (2026-11-07):** `npm run verificar:tudo` passou: 1589 testes unitários, 27 externos e 21 de 21 E2E. O pico de memória foi de 774 MB.

## M4-T05 — Lista REFERÊNCIAS e chamadas no motor e no DOCX

**Implementação:** sessão principal, sem delegar ao `especialista-documento`. **Sem revisão independente:** fica para o M4-T10. É a primeira mudança visível do marco: o DOCX exportado passa a ter as chamadas no texto e a lista REFERÊNCIAS.

**Motor** (`dominio/normas/motor.ts`, `motor-elementos.ts`)
- A chamada é gerada da obra a cada exportação. Os trechos com o mesmo destaque viram um run só.
- A lista REFERÊNCIAS:
  - sai logo depois do título, das obras citadas, inclusive a original e a consultada do apud (RN-078);
  - pode incluir também as obras não citadas, se o trabalho pedir;
  - vem ordenada (RN-176), e os sufixos a, b são os mesmos das chamadas.
- Estilo Referência com uma linha simples depois de cada referência: 12 pt, `w:after="240"` (RN-177). Fecha o N-M3-10.
- Avisos novos:
  - `CHAMADA_COM_AVISO` e `REFERENCIA_COM_AVISO`, com a RN;
  - `REFERENCIAS_AUSENTES`: há citação e o trabalho não tem o elemento;
  - `REFERENCIAS_VAZIAS`: há o elemento e nenhuma obra citada.
- `CITACAO_ADIADA` sai.
- Corrigido no caminho: legislação sem `autores` entra pela jurisdição também na ordem e na chamada ("(BRASIL, 2000)"). Antes ia pelo título.

**Perfil** (`perfis/uft-2022/perfil.json`)
- `espacoEntreReferenciasPt` = 12 (RN-177, norma).
- `edicaoNbr10520` = "2002", com a opção "2023" (RN-082, C-01).
- `autoresReferencia` = "etAl", com a opção "todos" (RN-184, C-B12).
- Alvo novo `citacao.chamada`.

**Formato:** `incluirNaoCitadas?: true` no elemento `referencias` (aditivo; adendo do M4-T05 no ADR-0004). JSON Schema regenerado.

**Decisão do usuário (2026-11-07, "siga as recomendações"):** na citação de citação, entram na lista a obra original e a consultada.

**Testes**
- `tests/motor-referencias.test.ts`, com 15 casos: só as citadas, ordem, sufixos iguais no texto e na lista, *et al.* em itálico nos dois lugares, título em negrito, incluir não citadas, estilo RN-034/177, avisos, perfil 2023 e "todos", formato.
- O documento difícil do corpus ganhou cinco obras fictícias e quatro chamadas: parentética, narrativa com *et al.*, apud e duas obras com grifo.

**Instantâneos (explicados)**
- `styles.xml` dos 7 documentos: só a linha do estilo Referência, que ganha `w:after="240"` (RN-177).
- `document.xml` do documento difícil: as chamadas no texto e as cinco referências depois do título REFERÊNCIAS.

**Verificação (2026-11-07):** `npm run verificar:tudo` passou: 1609 testes unitários, 27 externos e 21 de 21 E2E. Os externos incluem o validador OOXML, o LibreOffice e o Word, sobre o corpus com o documento difícil, que agora tem lista e chamadas. O pico de memória foi de 768 MB.

## M4-T06 — Cadastro de obras

**Implementação:** sessão principal, em três commits: campos, serviço e tela. Sem delegar ao `especialista-interface`. **Sem revisão independente:** fica para o M4-T10.

**Decisão do usuário (D-M4-09, 2026-11-07, "siga as recomendações")**
- Entram quatro campos novos na obra (aditivos):
  - coleção ou série: "(Coleção)" depois das páginas, RN-194;
  - título original: "Título original: …", RN-204;
  - suplemento: "Supl. 3", RN-212;
  - ano do veículo oficial: "ano 138", RN-223.
- Ficam para a segunda leva: dois eventos na mesma referência e legislação em coletânea.
- Os exemplos BAUMAN, DOREA e Lei 9.979 agora saem completos.

**Serviço** (`aplicacao/servicos/obras.ts`, `sessao-trabalho.ts`)
- Cada tipo tem os seus campos, na ordem da referência (`CAMPOS_DO_TIPO`).
- `prepararObra` dá a forma única: tira os campos de outro tipo, apara, limpa o que o XML 1.0 não aceita e deixa ausente o que ficou vazio.
- `validarObra` confere pelo esquema v1 (`validarObraV1`, novo no domínio).
- `previaDaObra` devolve a referência formatada, os avisos e o que impede gravar.
- Na sessão:
  - `incluirObra` dá um id novo e só grava a obra válida;
  - `alterarObra` grava na hora o que for válido;
  - `excluirObra` recusa a obra citada, com a contagem de chamadas, porque a chamada ficaria sem obra (RN-078);
  - incluir e excluir entram no Ctrl+Z, e o desfazer não tira obra que passou a ser citada;
  - a lista vai para a tela na ordem das referências, já com o texto da referência.

**Tela** (`interface/escrever/Bibliografia.tsx`)
- "Bibliografia" na coluna da aba Escrever, depois da árvore de seções: as obras pela referência, mais "Nova obra".
- O formulário abre no lugar do editor e tem:
  - tipo de obra;
  - autoria, com várias pessoas ou entidades e a função (org., coord., ed., comp.);
  - os campos do tipo, com dica;
  - o livro de que o capítulo faz parte;
  - o evento e o título dos anais;
  - ano impresso, provável ou não impresso;
  - e-book.
- A prévia mostra "Como sai na lista de referências", com negrito e itálico. Logo abaixo vêm o que impede gravar (com o nome do campo) e os elementos que faltam (com a RN).
- Obra nova: entra pelo botão "Incluir obra", que fica desativado enquanto houver campo assinalado.

**Testes**
- `tests/sessao-obras.test.ts`, com 13 casos: incluir, ordem, obra inválida recusada, excluir com desfazer, obra citada, ids, só leitura, forma única, ordem das chaves e prévia.
- Exemplos completos nos testes do M4-T02 e do M4-T04.
- E2E FUN-12 (`e2e/bibliografia.spec.ts`): cadastrar com prévia, alterar, campo inválido assinalado, excluir e Ctrl+Z, salvar e reabrir.
- axe no cadastro de obra (`e2e/acessibilidade.spec.ts`).

**Limitações**
- O título é campo de texto simples. As marcas que vieram de arquivo, como um nome científico em itálico, ficam até o texto do título ser alterado.
- Excluir obra citada é recusado. A remoção das chamadas chega com o editor de citação (M4-T07).
- A escolha do tipo não pede confirmação: ao trocar, os campos que o tipo novo não usa saem da obra gravada.

**Verificação (2026-11-07):** `npm run verificar:tudo` passou: 1623 testes unitários, 27 externos e 22 de 22 E2E. O pico de memória foi de 741 MB.

## M4-T07 — Inserir citação no editor

**Implementação:** sessão principal, sem delegar. **Sem revisão independente:** fica para o M4-T10.

**Decisões técnicas (da sessão principal, podem ser revistas)**
- Atalho **Ctrl+Shift+C**, o que o menu Inserir › Citação… já mostrava desde o M1. O plano sugeria Ctrl+Alt+C, mas no teclado ABNT2 Ctrl+Alt é o AltGr, e AltGr+C escreve "₢".
- A chamada entra no fim da seleção, sem apagar o selecionado, como a nota de rodapé.
- Inserir, alterar, retirar e ligar chamadas coladas são passos próprios do Ctrl+Z: não se juntam com o que se digita antes ou depois.
- Colar nunca cria citação sozinho. O texto colado com "(AUTOR, ano)" de uma obra cadastrada mostra a sugestão "Ligar às obras" ou "Manter como texto".
- A sugestão não liga chamada que serviria a duas obras (mesmo sobrenome e ano). Também não liga obra sem ano.

**Formato:** campo `volume` na obra citada, aditivo: "(CANDIDO, 1993, v. 2, p. 12)". Fonte: Manual, p. 23 [VERIFICADO `analise/normas_txt/manual_uft.txt:726`]. O exemplo CANDIDO das chamadas agora sai completo.

**Serviço** (`aplicacao/servicos/citacoes.ts`)
- `formatadorDeChamadas`: o texto da chamada na tela sai do mesmo formatador do DOCX, com as obras atuais e a edição da NBR 10520 do perfil (C-01).
- `validarCitacao`: apara volume e página, tira a página quando há "sem paginação" e confere com o esquema v1 (`validarCitacaoV1`, novo no domínio) e com as obras do trabalho.
- `reconhecerChamadasEscritas`: acha no texto as duas formas, com volume e página opcionais, sem distinguir maiúsculas.

**Editor** (`interface/editor/citacoes.ts`, `chamada-view.ts`, `EditorSecao.tsx`)
- A chamada mostra o texto do documento, com "et al." em itálico. Ela tem o papel `doc-biblioref` e o nome "Citação: (CAGLIARI, 2003, p. 12)".
- Com aviso (obra sem ano, sobrenome repetido), a chamada fica sublinhada e o aviso aparece no nome e no `title`.
- Mudar a obra redesenha as chamadas sem mexer no documento nem no histórico.
- Duplo clique, ou Enter com a chamada selecionada, abre a janela para alterar.
- O botão "Citação" fica na barra de formatação, e o menu Inserir › Citação… está ligado.
- Copiar leva o texto da chamada, e não a palavra "citação". Colar de volta traz o texto e a sugestão de ligar.

**Janela** (`interface/escrever/DialogoCitacao.tsx`)
- Forma entre parênteses ou no texto.
- Uma ou mais obras na mesma chamada (RN-096), cada uma com volume, página e "sem paginação".
- Apud com a obra consultada (RN-098).
- Destaque: grifo nosso ou do autor (RN-090).
- A prévia "Como sai no texto" fica acompanhada do que impede inserir e dos avisos da chamada.
- Com a chamada já no texto: "Alterar citação" e "Retirar citação".
- Sem obras: "Cadastrar obra" abre o formulário da Bibliografia.

**Testes**
- `tests/citacoes-servico.test.ts`, com 10 casos: formatador, obra alterada, opção 2023, obra ausente, validação e reconhecimento.
- `tests/editor-citacao.test.ts`, com 7 casos:
  - inserir no fim da seleção com id novo;
  - o título recusa citação;
  - alterar e retirar pelo id;
  - Ctrl+Z e Ctrl+Y;
  - ligar chamadas coladas, também entre trechos com marcas, sem entrar na nota, num passo só.
- O exemplo CANDIDO com volume entrou em `tests/bibliografia-chamadas.test.ts`.
- E2E FUN-13 (`e2e/citacao.spec.ts`):
  - Ctrl+Shift+C, página inválida assinalada e prévia;
  - chamada no texto com o foco de volta;
  - Ctrl+Z e Ctrl+Y;
  - o ano da obra muda a chamada, e a obra citada não se exclui;
  - duplo clique para alterar;
  - cópia com o texto da chamada;
  - sugestão ao colar;
  - salvar com a ligação.
- axe na janela da citação (`e2e/acessibilidade.spec.ts`).

**Limitações**
- Citação dentro de nota de rodapé: resolvida no complemento abaixo. A sugestão ao colar não olha dentro das notas.
- A sugestão ao colar procura na seção inteira. Uma chamada escrita antes, que o usuário deixou como texto, volta a ser oferecida na próxima colagem que trouxer outra.
- Recortar e colar uma chamada dentro do editor devolve texto, e não a chamada. O aceite da sugestão religa.
- A chamada narrativa com várias obras sai com aviso (D-M4-08). A janela permite, porque o Manual não proíbe.

**Verificação (2026-11-07):** `npm run verificar:tudo` passou: 1640 testes unitários, 27 externos e 23 de 23 E2E. O pico de memória foi de 753 MB. Na primeira rodada, o FUN-13 falhou por corrida no próprio teste (o Enter caiu no começo do título); o teste agora espera o foco e usa Ctrl+End, e passou em 3 rodadas seguidas antes da rodada completa.

### M4-T07, complemento — Citação dentro de nota de rodapé

Recomendação aceita pelo usuário em 2026-11-07 ("siga as recomendações").

**Formato** (aditivo, continua v1)
- O conteúdo da nota passa a aceitar a chamada de citação além do texto (`InlineDeNota = InlineTexto | InlineCitacao`).
- Nota dentro de nota continua recusada.
- Os percursos da validação, das citações do documento e dos ids do bloco agora entram nas notas. Por isso:
  - id repetido e citação sem obra dentro da nota são recusados na leitura;
  - a obra citada só na nota entra na lista REFERÊNCIAS;
  - a obra citada só na nota não pode ser excluída.
- A fixture inválida `citacao-em-nota.json` passou a testar a citação em nota com obra fora da bibliografia.
- A `documento-bordas-m4.json` ganhou uma nota com citação e volume.

**Editor**
- No texto da nota, Ctrl+Shift+C, o botão "Citação" e o menu Inserir › Citação… abrem a mesma janela, com a nota como destino. A citação nunca cai no texto da seção.
- Ao fechar a janela, o foco volta para a nota.
- A chamada aparece na nota como no texto, e o duplo clique ou o Enter a abrem para alterar.

**DOCX:** a chamada sai dentro do rodapé. Instantâneo `documento-dificil` atualizado com uma nota nova, "Ver (EXEMPLAR NETO, 2020b, v. 2, p. 9).":
- `document.xml`: a referência da nota 4;
- `footnotes.xml`: o texto da nota 4.

**Testes**
- `tests/modelo-m2.test.ts`: ordem de leitura com a citação da nota, ids do bloco e chamada no texto da nota pelo motor.
- `tests/editor-citacao.test.ts`: inserir no editor da nota e voltar ao modelo dentro da nota.
- E2E FUN-13: citação inserida pelo texto da nota, foco de volta na nota e gravação dentro da nota.

**Limitação:** colar na nota continua só texto. A sugestão de ligar "(AUTOR, ano)" não vale dentro da nota.

**Verificação do complemento (2026-11-07):** `npm run verificar:tudo` passou: 1642 testes unitários, 27 externos e 23 de 23 E2E. O pico de memória foi de 778 MB. Na primeira rodada, o teste do Word falhou porque esperava 3 notas no documento difícil. O Word contou 4, e a quarta é a nota nova com citação, então o esperado passou a 4.
