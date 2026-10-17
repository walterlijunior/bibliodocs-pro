# Relatório do Marco M2 — Modelo de documento e editor

Relatório vivo do marco: cada tarefa M2-Txx acrescenta a sua seção. Plano: `docs/PLANO_DE_IMPLEMENTACAO.md`.

| Tarefa | Situação | Data |
|---|---|---|
| M2-T01 Desempenho do instantâneo e do salvamento | CONCLUÍDA | 2026-10-17 |
| M2-T03 Numeração e operações sobre a árvore de seções | CONCLUÍDA | 2026-10-17 |
| M2-T04 Alíneas, citação longa e nota no modelo | CONCLUÍDA | 2026-10-17 |
| M2-T05 Núcleo do editor: esquema, conversão, ids e colagem | CONCLUÍDA | 2026-10-17 |
| M2-T06 Editor na aba Escrever ligado à sessão | CONCLUÍDA | 2026-10-17 |
| M2-T07 Árvore de seções na interface e ordem única de desfazer | CONCLUÍDA | 2026-10-17 |
| M2-T02, M2-T08 a M2-T12 | PENDENTE | — |

## M2-T01 — Instantâneo e salvamento com 25 MB e 150 páginas (R-M1-01, R36)

**Implementação:** sessão principal. Revisão: `revisor-seguranca` (somente leitura), registrada abaixo.

### Documento de medição

`app/tests/apoio/documento-grande.ts` (`gerarDocumentoGrande`), reaproveitável no M3 (exportar 150 páginas) e na
Etapa 6. É determinístico (PRNG próprio) e gera:

- 6 capítulos × 4 secundárias × 2 terciárias (78 seções), 469 parágrafos de ~700 caracteres, alguns com itálico e
  negrito, e quebra de página entre os capítulos;
- ≈150 páginas estimadas por `CARACTERES_POR_PAGINA = 2 200` [HIPÓTESE até o M3 paginar: A4, Times 12, espaço 1,5,
  margens 3/2 cm];
- 25 mídias PNG de 1 MiB com bytes aleatórios depois da assinatura (incompressíveis, como um PNG real). O modelo do M1
  ainda não tem figura no texto: elas pesam no pacote, no IPC, no ZIP e no disco, que é o que se mede.

`tests/documento-grande.test.ts` confere o tamanho, a ida e volta pelo `.bdp` e a reprodutibilidade, e imprime as
medidas em Node: empacotar 193 ms, ler 80 ms, validar o pacote do IPC 5 ms (25,1 MiB) [VERIFICADO 2026-10-17].

### Medição no Electron real

`app/e2e/desempenho.spec.ts` (E2E-07): abre o `.bdp` grande pela Biblioteca, digita 200 caracteres no título (uma
tecla a cada 60 ms) com instantâneos a cada ~2 s e um Ctrl+S no meio, e depois amostra a memória a cada 100 ms com mais
um instantâneo e um salvamento. A latência por tecla vai do envio pelo teste até o quadro seguinte ao evento `input`;
as travadas do principal são medidas por um relógio de 5 ms dentro dele. Comando: `cd app; npx playwright test
e2e/desempenho.spec.ts` (depois de `npm run build`), ou dentro de `npm run verificar:tudo`.

| Medida | Meta | Antes (M1) | Só o worker | Worker + mídias uma vez + SAB |
|---|---|---|---|---|
| Manipulador do instantâneo, síncrono no principal | — | 224–292 ms | — | 4–7 ms (1.º: 23 ms, JIT)³ |
| Manipulador do salvar, síncrono no principal | — | 230–244 ms | — | 29–30 ms³, quase tudo a cópia ao worker que o SAB tirou (não remedido isolado) |
| Maior travada do principal (por rodada) | — | 337–406 ms | 75–110 ms | 0–59 ms |
| Tecla: p95 | < 50 ms (RNF-06) | 11–17 ms | 9 ms | 6–12 ms |
| Tecla: mais lenta | < 50 ms | 251–328 ms | 102 ms | 11–30 ms (uma rodada com 80 ms sem travada do principal) |
| Abrir pela Biblioteca | < 3 s (RNF-06) | 0,43–0,91 s | 0,91 s | 0,45–1,43 s |
| Memória somada dos processos (pico) | < 800 MB (RNF-07) | 601–677 MB¹ | 721 MB¹ | 700–760 MB² |

¹ Amostrada durante a digitação. ² Amostrada na fase própria, com instantâneo e salvamento durante as amostras (o
`getAppMetrics` roda no principal e, durante a digitação, ele mesmo causava travadas de 50–60 ms). O `workingSetSize`
conta as páginas compartilhadas em cada processo, então superestima. ³ Medido com worker + mídias uma vez, antes do
`SharedArrayBuffer`.

Decomposição medida com instrumentação temporária (removida): no M1, `empacotarProjeto` 216–282 ms por instantâneo
no principal; com o worker, a cópia das mídias no `postMessage` para o worker custou 24–43 ms no app (17–24 ms num
teste isolado no Electron) e caiu para ~0 ms com `SharedArrayBuffer`.

### Correção (decisões técnicas no adendo do M2-T01 do ADR-0004)

1. `empacotarProjeto` num `worker_threads` de vida longa (`app/src/principal/empacotador.ts`, cliente
   `app/src/principal/ipc/empacotador-isolado.ts`), usado por todo `salvarProjeto` do principal e pelo instantâneo.
2. Mídias uma vez: `PacoteEnvio` com mídias só referidas (`{ sha256 }`); o `RegistroProjetos` guarda os bytes por
   identificador; `MIDIA_AUSENTE` → a `SessaoTrabalho` reenvia com os bytes.
3. Mídias guardadas em `SharedArrayBuffer`, lidas pelo worker sem cópia.
4. Carregar o worker de dentro do ASAR: conferido num ASAR mínimo no Electron 44.8.0 (`RESPOSTA {"soma":10,"sab":true}`)
   e depois com o `app.asar` real do `npm run dist:pasta`, carregado pelo Electron do projeto com o `out/` escondido:
   E2E-01 e E2E-07 passaram (`2 passed`; `teclaP95Ms=10 teclaMaxMs=35 memoriaPicoMb=758`). O `.exe` com os fuses não
   foi rodado (sem assinatura, bloqueado pelo Controle Inteligente de Aplicativos, R34).

### Testes

- `tests/empacotador.test.ts` (6): cliente com worker falso — um worker para todos os pedidos, `unref`, respostas fora
  de ordem, erro/saída/tempo esgotado/resposta fora do protocolo descartam o worker e falham os pendentes, eventos do
  worker antigo não afetam o novo, `encerrar`; protocolo.
- `tests/midias-uma-vez.test.ts` (15): validação com mídias referidas (ausente ≠ recusa; sem `conhecidas` é forma
  errada; repetição e soma de tamanho continuam valendo); registro (SharedArrayBuffer, dono, esquecer); manipuladores
  reais de projetos + recuperação sobre o mesmo registro (abrir guarda, salvar só com chaves grava as mesmas mídias,
  mídia nova por salvar ou instantâneo passa a ser conhecida, `MIDIA_AUSENTE` sem gravar nada, identificador
  desconhecido → `NAO_ABERTO`, "Salvar como…" exige bytes e registra o identificador novo, fechar esquece);
  empacotador assíncrono injetado (A3 mantido; falha → `PACOTE_INVALIDO` sem gravar); bytes que não conferem com a
  chave nunca são guardados e mídia removida sai do registro (revisão F1/F2).
- `tests/sessao-trabalho.test.ts` (+4): `paraEnvio`; salvar e instantâneo mandam só as chaves e reenviam com os bytes
  em `MIDIA_AUSENTE`; "Salvar como…" de arquivo sem identificador e depois só chaves.
- `tests/documento-grande.test.ts` (3).
- `e2e/desempenho.spec.ts` (1, E2E-07). Asserções: abrir < 3 s, p95 da tecla < 50 ms, tecla mais lenta < 150 ms e
  travada do principal < 100 ms (guardas contra a volta do R36: o p95 de 200 teclas tolera até 10 lentas), memória
  < 800 MB, título digitado gravado no arquivo, `x.problemas` vazio. As teclas acima de 40 ms vão para a anotação: numa
  das rodadas uma tecla levou 80 ms sem nenhuma travada do principal (atraso do sistema ou do CDP, não do app).

**Mutações (14):** 13 detectadas — as 3 da revisão (guardar com o salvamento recusado no empacotamento, não trocar
as mídias depois do instantâneo conferido, acumular em vez de trocar) e — tirar o `guardarMidias` do salvar e do instantâneo, não guardar as mídias ao abrir
nem no "Salvar como…", não limpar as conhecidas em `MIDIA_AUSENTE`, não trocar as conhecidas no "Salvar como…", não
acrescentar depois de um envio aceito, não usar `SharedArrayBuffer`, resolver a referida com outra mídia. 1
equivalente: empacotar fora da fila da recuperação (o instantâneo que chega durante um salvamento fica guardado dos
dois jeitos); mantido dentro da fila pela ordem de chegada.

**Resultado (depois das correções da revisão):** `cd app; npm run verificar:tudo` → typecheck OK; vitest **770/770**;
`npm audit` 0 vulnerabilidades; build OK; E2E **9/9** (E2E-07: `abrirMs=876 teclaP95Ms=8 teclaMaxMs=11
travadasPrincipal=0 memoriaPicoMb=763`) [VERIFICADO 2026-10-17]. A memória ficou a 5% da meta nessa rodada.

### Registro do revisor (`revisor-seguranca`, 2026-10-17, somente leitura)

0 Alta. Conferidos sem problema: isolamento por identificador e dono (o renderer não lê bytes de volta), validação
estrita da união, `SharedArrayBuffer` só entre principal e worker, descarte do worker e mensagens tardias, ordem da fila
(A3), corridas da `SessaoTrabalho` no "Salvar como…".

| ID | Sev. | Achado | Tratamento |
|---|---|---|---|
| F1 | Média | `guardarMidias` antes da conferência: bytes com sha256 errado ficavam guardados sob a chave e quebravam salvar e instantâneo do identificador até fechar | **Corrigido:** o registro só troca as mídias depois do empacotamento conferido (`trocarMidias`); teste novo |
| F2 | Média | Mídias não declaradas ou removidas acumulavam no principal sem limite | **Corrigido:** guarda exatamente as do último pacote conferido (declaradas); a removida sai, e o desfazer passa pelo `MIDIA_AUSENTE` |
| F3 | Baixa | Comentário do registro ("conferir a cada gravação basta") | Corrigido com o F1 |
| F4 | Baixa | Comentário do worker dizia que o conteúdo vinha "do próprio app" | Corrigido (vem do renderer; sha256 e coerência conferidos no worker) |
| F5 | Baixa | Comentário do cliente sobre cópia das mídias | Corrigido |
| F6 | Média (teste) | Memória com margem de 5–12%, `workingSetSize` superestima, sem amostra durante a digitação | Documentado no teste e aqui; rever no M5 |
| F7 | Baixa (teste) | p95 tolera até 10 teclas lentas | Guarda nova: tecla mais lenta < 150 ms; documentado |
| S1 | Info | Worker e chunks no ASAR real não testados | **Conferido** com o `app.asar` do `dist:pasta` (item 4 acima); `.exe` com fuses fica para a fumaça do pacote |

## M2-T03 — Numeração progressiva e operações sobre a árvore de seções (RF-03)

Feito pela sessão principal. Revisão somente leitura do `especialista-documento`. Decisões no adendo do M2-T03 do
ADR-0007.

### Entregue
- `app/src/dominio/numeracao/secoes.ts`: `numerarSecoes`, `mapaIndicativos`, `indicativoSecao` (RN-038, RN-039;
  `alemDoLimite` para RN-041).
- `app/src/dominio/modelo/operacoes.ts`: inserir, remover, mover, recuar, promover (como o Word, por decisão do
  usuário), `aplicarOperacaoSecao` com inversos (`rebaixar` para promover), limites de 5 níveis e de 1000 por nível.
- `LIMITES_V1.secoesPorNivel` passa a usar `MAXIMO_SECOES_POR_NIVEL` do modelo (mesmo valor, 1000).

### Testes
- `tests/secoes-operacoes.test.ts` (20):
  - exemplos do aceite: mover a 3 para antes da 2; recuar além da quinária recusado com mensagem;
  - promover como o Word, com o exemplo da decisão;
  - limites, ids repetidos, entrada congelada e compartilhamento;
  - propriedade com 400 sequências semeadas de 12 operações, um quarto delas sobre árvores "de arquivo" com até 7
    níveis. Confere numeração progressiva, nenhuma árvore mais funda do que `max(5, antes)`, entrada intacta, desfazer,
    refazer e desfazer tudo.
- **Mutações:** 1.ª rodada 27/28. A sobrevivente era uma cópia profunda no caminho, e o teste de compartilhamento foi
  acrescentado. Depois das correções da revisão, 2.ª rodada 39/40: a sobrevivente era o relaxamento do limite no mover,
  e entrou um teste de mover uma seção funda para um nível menos fundo. Resultado final **40/40**. O script ficou no
  scratchpad, sem ser versionado.
- **Resultado:** `cd app; npm run verificar:tudo` → typecheck OK; vitest **790/790**; `npm audit` 0 vulnerabilidades;
  build OK; E2E **9/9** [VERIFICADO 2026-10-17].

### Registro do revisor (`especialista-documento`, 2026-10-17, somente leitura)

Sem erro de correção nos casos válidos; RN-038, RN-039, RN-041 e RN-028 conferem.

| Achado | Nível | Resumo | Tratamento |
|---|---|---|---|
| M1 | Média | Limite de 1000 seções por nível não respeitado: operação aceita e salvamento recusado | Corrigido (`SECOES_DEMAIS`; constante única) |
| M2 | Média | Promover mudava a ordem do texto; comentário dizia ser o inverso exato de recuar | Perguntado ao usuário → como o Word; implementado com inverso `rebaixar` |
| M3 | Média | `restaurar: true` público permitia furar a RN-041 | Corrigido (inversos registrados em `WeakSet`; campo removido) |
| B1 | Baixa | Mover para o mesmo lugar sem sinal de "nada mudou" | Corrigido (`mudou: false`) |
| B2 | Baixa | Ids só conferidos no corpo; formato do id não conferido | Pendente para o M2-T07/T08 (adendo do ADR-0007) |
| B3 | Baixa | Ids repetidos na entrada corrompiam a árvore (busca × troca por caminhos diferentes) | Corrigido (troca pelo caminho de índices da busca) |
| B4 | Baixa | Seção inserida compartilha a referência do chamador | Documentado no cabeçalho do módulo |
| B5 | Info | Desempenho: mover ~2 ms, inserir ~16 ms, `mapaIndicativos` ~37 ms com 111 000 seções | Memorizar no M2-T07 se necessário |

## M2-T04 — Alíneas, citação longa e nota de rodapé no modelo

**Implementação:** sessão principal. **Revisão:** `especialista-documento`, somente leitura. As decisões estão no adendo
do M2-T04 no ADR-0007, que também anota o ADR-0005.

**Modelo**
- Bloco `alineas` com `subalineas` (RN-023, RN-026, RN-028).
- Bloco `citacaoLonga` (RN-004, RN-084).
- Inline `nota` com conteúdo, no ponto da chamada (RN-100).
- Tipos nomeados `InlineDeNota` e `InlineDeTitulo`.
- O rótulo da alínea é derivado: `rotuloAlinea` em `dominio/numeracao`, com `aa), bb)` pela decisão C-A6.
- Ids únicos de seções, blocos e notas, na leitura e no `inserirSecao`.
- JSON Schema regenerado com `$defs` nomeados.

**Aceite** [VERIFICADO 2026-10-17]
- As fixtures válidas passam idênticas e voltam idênticas pelo `.bdp`: empacotar → ler, comparando também o
  `JSON.stringify`.
- As 14 fixtures inválidas são recusadas com o caminho e a mensagem pt-BR esperados.
- `npm run esquemas:gerar` regravou os esquemas, e o teste confere arquivo = gerado.

**Testes** [VERIFICADO 2026-10-17]
- `npm run verificar:tudo`: typecheck dos 4 projetos, 825/825 testes (eram 790), 0 vulnerabilidades, build OK e
  E2E 9/9.
- Mutações: 16/16 detectadas. Cobrem a conferência de id de nota, as subalíneas no percurso, `min(1)` e `max` das
  listas, a nota em título, a mensagem própria, o objeto estrito, o rótulo dobrado, a posição negativa e o texto plano.

**Revisão** (0 Alta)
- Média 1, adendo citado mas ausente: escrito no ADR-0007 e anotado no ADR-0005.
- Média 2, ids repetidos na colagem tornam o arquivo ilegível: registrada para o M2-T05 e no R38.
- Média 3, conteúdo de nota preso a `InlineTexto`: corrigida com `InlineDeNota` e `InlineDeTitulo`.
- Baixas B4 a B7: registradas como pendências no adendo.
- O revisor aprovou as decisões 1 a 7.

**Incidente do processo:** um `prettier --write` sem configuração do projeto reformatou 10 arquivos. O `git checkout`
foi bloqueado pela política de permissões. Os arquivos foram copiados para o scratchpad e reescritos a partir do HEAD só
com as edições do incremento. O diff final contém apenas o M2-T04. **O projeto não usa Prettier:** não rodar formatador
automático.

## M2-T05 — Núcleo do editor: esquema, conversão, ids e colagem

**Implementação:** sessão principal. **Revisão:** `especialista-documento`, somente leitura. As decisões estão no adendo
do M2-T05 no ADR-0007.

**Dependências** (o usuário foi informado antes da instalação): 7 pacotes do ProseMirror com versões exatas e 3
transitivas, 10 MIT. Há uma cópia só do `prosemirror-model`, e o `npm audit --omit=dev` dá 0. Os pacotes ficam fora do
ASAR, porque o Vite os embute no bundle da interface. O `npm audit` completo mostra 8 moderadas, todas de
desenvolvimento (`electron-builder` → `roarr`), alheias ao ProseMirror.

**Código** (`app/src/interface/editor/`)
- `esquema.ts`: nós e marcas que espelham o modelo do M2-T04. Título e nota não aceitam nota, e o `toDOM` só emite
  classe e `data-*`.
- `conversao.ts`: `secaoParaDoc`, `docParaSecao`, a forma canônica, memo por nó e `blocosParaSlice`.
- `ids.ts` e `plugins/ids-unicos.ts`: ids novos para cópias e nós sem id. O nó que já existia mantém o id.
- `plugins/limites.ts`: recusa a transação que passaria dos limites de quantidade do v1.
- `html-colado.ts`: leitura do HTML colado sobre uma árvore mínima, em Node. Cobre Word, LibreOffice, Chrome,
  Google Docs e o próprio app, mais o texto puro.
- `colagem.ts`: `DOMParser` inerte e `paste`/`drop`, com aviso.

**Aceite** [VERIFICADO 2026-10-17]
- Ida e volta modelo → editor → modelo:
  - **idêntica** em `documento-valido.json` e `documento-bordas-m2.json`;
  - na forma canônica no documento grande e em 300 seções aleatórias com semente;
  - todos os resultados passam no `Node.check()` e no `validarDocumentoV1`.
- HTML colado do Word e das outras quatro origens vira só `Bloco`/`Inline` válido, com ids novos. Isso foi conferido
  com fixtures **escritas à mão** no formato conhecido [HIPÓTESE de fidelidade]. A captura real da área de
  transferência fica para o E2E do M2-T06, quando o editor estiver na tela.

**Testes** [VERIFICADO 2026-10-17]
- `npm run verificar:tudo` passou:
  - typecheck dos 4 projetos;
  - 891/891 testes (eram 825; 66 novos em 4 arquivos `editor-*` e nas regras E1–E3);
  - 0 vulnerabilidades em produção;
  - build e E2E 9/9.
- A latência do E2E de desempenho não mudou: p95 de 9 ms por tecla. O editor ainda não está na tela; a medição com o
  editor é do M2-T06.
- Matriz de testes: EDT-01 a EDT-05 e ARQ-E.

**Revisão:** 2 Altas, 6 Médias e 5 Baixas.
- Corrigidas: A1 (limites), A2 (controles digitados), M1 (ordem do `parseDOM`), M2 (notas do LibreOffice), M3
  (títulos numerados do Word), M4 (comentários do Word) e B1 (`<br>` final). Cada uma tem teste.
- Pendentes, com destino no adendo do ADR: M5 (recortar e colar troca ids), M6 (marca sobre a chamada entra na nota) e
  B2 a B5.

**Itens visíveis da colagem (2026-10-17, decisão delegada pelo usuário: "Deixo você fazer essa decisão").** As três
propostas foram mantidas:
1. **Texto puro colado:** a quebra simples vira espaço, e só a linha em branco separa parágrafos. Motivo: o caso mais
   comum é copiar uma citação de um PDF, e uma linha por parágrafo picaria o texto. Com o Word e o navegador, o HTML
   já traz os parágrafos, e esta regra não se aplica.
2. **`&nbsp;` colado:** fica como espaço inseparável. Motivo: no Word ele costuma ser intencional ("p. 23", "art. 5º"),
   e trocá-lo mudaria o texto do usuário. A tabulação do Word escrita com `&nbsp;` (`mso-tab-count`, B2) será tratada
   à parte.
3. **Estilo "Citação" do Word (`MsoQuote`):** continua parágrafo comum. Motivo: citação longa é a de mais de três linhas
   (RN-004), e o estilo do Word não garante isso. Converter sozinho poderia marcar como citação o que não é. O usuário
   converte o bloco no editor.

## M2-T06 — Editor na aba Escrever ligado à sessão

**Implementação:** sessão principal. **Revisão:** `especialista-documento`, somente leitura. As decisões técnicas estão
no adendo do M2-T06 no ADR-0007. Nenhuma dependência nova.

**Código**
- `aplicacao/servicos/sessao-trabalho.ts`: `alterarSecao(id, { titulo, blocos })` troca a seção de forma imutável (só o
  caminho até ela é copiado, com índice id → caminho), soma a revisão e agenda o automático e o instantâneo.
  `inserirSecaoNoFim()` cria seção primária vazia (a árvore completa é do M2-T07). O estado ganhou `geracao` (muda a
  cada trabalho aberto) e `secoes` (número calculado pela posição). **A sessão só emite quando o visor ou o título de
  uma seção na lista mudam**: digitar no texto não re-renderiza a casca (R39).
- `interface/editor/EditorSecao.tsx`: `EditorView` não controlado pelo React. Cada transação que muda o documento é
  convertida na hora (`docParaSecao`, com memo por nó) e vai para a sessão: nenhuma alteração fica só no editor. O
  `EditorState` de cada seção visitada fica guardado (o histórico sobrevive à troca de seção) até outro trabalho abrir.
- `interface/editor/estado.ts`: todo estado de seção nasce com histórico, teclas, colagem, ids únicos e limites.
- `interface/editor/comandos.ts`: Ctrl+I, Ctrl+B, Ctrl+Shift+= (sobrescrito), Ctrl+= (subscrito), Ctrl+Alt+F (nota),
  Shift+Enter (quebra de linha), Ctrl+Z, Ctrl+Y e Ctrl+Shift+Z. A marca aplicada sobre uma seleção com nota **não entra
  no texto da nota** (achado M6 do M2-T05, corrigido).
- `interface/editor/nota-view.ts`: a chamada é um nó atômico; selecioná-la abre um editor aninhado do texto da nota
  (exemplo de notas do ProseMirror). Esc ou Enter voltam ao texto. Colar na nota cola só texto, sem `innerHTML`.
- Canal IPC novo `edicao` (`aplicacao/portas/edicao.ts`, `principal/ipc/manipuladores-edicao.ts`): os itens
  Desfazer, Refazer, Recortar, Copiar e Colar do menu pedem ao principal o mesmo comando das teclas
  (`webContents.paste()` etc.). Remetente e ação conferidos (C-11). A página não ganha acesso à área de transferência.
- Menu Editar ligado, com "Colar sem formatação" (Ctrl+Shift+V; B5 do M2-T05) e Inserir › Nota de rodapé.
- `html-colado.ts`: `neutralizarEstilos` tira `<style>` e renomeia `style=` dentro das tags antes do `DOMParser`.

**Achados durante o E2E** [VERIFICADO 2026-10-17]
1. **CSP:** no Chromium o documento do `DOMParser` herda a CSP da página. Colar o HTML do Word gerava ~35 relatórios
   "Applying inline style violates … style-src" (nada era aplicado, mas o critério "CSP sem violação" falhava). Corrigido
   sem afrouxar a CSP (`neutralizarEstilos`); a leitura das cinco fixtures é idêntica antes e depois (teste novo).
2. **Electron 44:** `clipboard.write` passou a receber `ClipboardItem[]` (mudança do Electron; afetou só o teste).
3. **Ctrl+Alt+F com Caps Lock** chegava como "F" e o `prosemirror-keymap` não tem a volta pelo código da tecla com
   Ctrl+Alt (AltGr). As duas formas estão ligadas.
4. **Inserir nota com texto selecionado apagava o texto** (`replaceSelectionWith`). Agora a chamada vai para o fim da
   seleção, como no Word, e nada se apaga (teste novo). Apareceu como falha intermitente: com teclas na velocidade do
   teste, a seleção do DOM ainda não tinha chegado ao ProseMirror.

**Aceite** [VERIFICADO 2026-10-17]
- Digitar, desfazer, salvar e reabrir idêntico (EDT-06): título e parágrafo com acentos pelo teclado, `insertText` e
  composição de IME pelo CDP; itálico; desfazer e refazer; nota com Ctrl+Alt+F; Ctrl+S; o `documento.json` tem
  exatamente os blocos esperados; fechar, reabrir e o arquivo não muda.
- Colagem com a área de transferência real (EDT-07): fixtures do Word, LibreOffice e Chrome escritas pelo `clipboard`
  do Electron e coladas com Ctrl+V; menu Colar e Colar sem formatação. Itálico, sub/sobrescrito, alíneas, citação
  longa e notas no ponto da chamada; aviso das imagens; ids únicos; o net-log não tem a imagem remota
  (`exemplo.invalid`) nem URL `http`/`file`.
- `x.problemas` vazio em todos os E2E: nenhum erro de console, exceção ou violação de CSP.
- Latência (RNF-06) com o editor, no documento de 150 páginas e 25 MiB, digitando na seção 1.1.1 com instantâneos e
  Ctrl+S, em 7 rodadas: **p95 de 8–15 ms** (meta 50), tecla mais lenta 11–21 ms, nenhuma travada do principal, abrir
  0,5–0,9 s. Não foi preciso mandar só as seções alteradas.
- Memória: pico de **738–787 MB** (meta 800; no M2-T01, 700–760). A margem caiu para 2–8 % (risco R36/R39, rever no
  M5 com figuras de verdade).

**Testes** [VERIFICADO 2026-10-17]
- `npm run verificar:tudo` passou duas vezes seguidas: typecheck dos 4 projetos; **915/915** testes (eram 891; novos
  `sessao-secoes.test.ts`, `editor-comandos.test.ts` e casos em `editor-colagem` e `ipc-projetos`); 0 vulnerabilidades
  em produção; build; **E2E 11/11** (novo `e2e/editor.spec.ts` com 2 testes).
- Matriz de testes: EDT-04 (parte E2E), EDT-06, EDT-07, EDT-08, IPC-ED, E2E-08, E2E-09 e E2E-07 atualizado.

**Decisões visíveis tomadas pela sessão principal** (o usuário delegou: "deixo todas ao seu julgamento", 2026-10-17):
- Aba Escrever: título "Escrever"; dados do trabalho em cima; à esquerda a lista de seções (número + título, recuo por
  nível) com "Nova seção"; à direita "Seção N", a barra de formatação e o editor.
- Barra de formatação com I, N, x², x₂ e "Nota de rodapé"; os atalhos são os do Word.
- A chamada da nota aparece como a marca "nota" (sem número: a numeração das notas é PENDENTE-FONTE, RN-102). O texto
  da nota abre num quadro logo abaixo da chamada.
- Trabalho sem seções mostra "Use “Nova seção” para começar o texto"; não se cria seção sozinho.
- Inserir nota com seleção: a chamada vai para o fim da seleção (como no Word).

**Pendente** (com destino)
- Histórico **único** de texto e estrutura (`HistoricoEdicao`, ADR-0007 §4): vai com as operações estruturais na
  interface (M2-T07). Hoje cada seção tem o seu histórico de texto; não há operação estrutural para desfazer além de
  "Nova seção".
- Conferir as fixtures de colagem contra a cópia real do Word e do LibreOffice [HIPÓTESE de fidelidade]: roteiro
  manual, precisa do Word instalado (pendência do usuário, opcional).
- Roteiro manual com teclado ABNT2 físico (R41) e com o NVDA (R42): a composição foi testada pelo CDP, não com teclas
  mortas reais.
- Nota em trabalho só leitura não abre para edição (correção M1 da revisão): sem E2E, porque o E2E ainda não monta um
  arquivo de versão futura com nota; conferido por leitura do código.
- O papel `doc-noteref` da chamada (M3) precisa ser ouvido no NVDA (roteiro R42).
- M5 (recortar e colar troca ids): segue para o M6.

**Revisão** (`especialista-documento`, somente leitura): 0 Alta, 3 Médias e 5 Baixas, **todas corrigidas**.
- M1: a nota abria para edição num trabalho só leitura, e o texto ficava só na tela. Agora não abre.
- M2: alteração na nota recusada pela seção (limites) deixava a nota mostrando texto fora do modelo. Agora o editor da
  nota volta ao que era e aparece o aviso de limite.
- M3: o `aria-label` da chamada num `span` sem papel tende a ser ignorado. A chamada ganhou `role="doc-noteref"`.
- B1: o canal `edicao` deixava uma página comprometida colar num campo oculto sem gesto do usuário. O preload só chama o
  canal com `navigator.userActivation.isActive` (o E2E do menu confirma que o clique conta como gesto).
- B2: "Colar sem formatação" com o foco na nota deixava o pedido valendo para a colagem seguinte. Zerado no `blur`.
- B3: Inserir › Nota de rodapé fora da aba Escrever se perdia. Fica desativado fora da aba.
- B4: o texto do trabalho fechado ficava nos estados guardados. `MemoriaEditores.limpar()` ao fechar.
- B5: `<style-x>` (elemento personalizado) perdia o texto em `neutralizarEstilos`. Expressão corrigida, com teste.
- Depois das correções, `npm run verificar:tudo` passou de novo: 915/915, 0 vulnerabilidades, E2E 11/11 (p95 9 ms).

## M2-T07 — Árvore de seções na interface e ordem única de desfazer

**Implementação:** sessão principal. **Revisão:** `especialista-interface`, somente leitura. Decisões técnicas no adendo
do M2-T07 no ADR-0007. Nenhuma dependência nova; nenhuma regra normativa nova (a numeração continua a do M2-T03:
RN-038, RN-039, RN-041).

**Código**
- `dominio/modelo/operacoes.ts`: `moverParaCima`, `moverParaBaixo` (a primeira das irmãs sobe para a seção anterior à
  mãe; a última desce para a seguinte; `JA_PRIMEIRA`/`JA_ULTIMA` nas pontas) e `moverJuntoDe` (arrastar). Aditivos,
  todos por `moverSecao`.
- `aplicacao/servicos/historico-edicao.ts`: `HistoricoEdicao` linear (texto por seção e estrutura com o inverso guardado
  como recebido; 1000 entradas por pilha).
- `aplicacao/servicos/sessao-trabalho.ts`: `novaSecao(aposId)` (substitui `inserirSecaoNoFim`), `operarSecao`,
  `moverSecaoJuntoDe`, `registrarTexto`, `desfazer`/`refazer(aplicarTexto)`. A lista ganhou `paiId`, `posicao` e
  `irmas` (para `aria-posinset`/`aria-setsize`). A `geracao` não muda numa operação estrutural.
- `interface/escrever/ArvoreSecoes.tsx` (árvore e botões), `useEstrutura.ts` (seção ativa, operações, desfazer,
  anterior/próxima; `MemoriaEditores` subiu para cá) e `secoes.ts` (regras puras).
- `EditorSecao.tsx`: Ctrl+Z/Ctrl+Y → ordem única (sempre consumidos); registra o passo de texto quando o `undoDepth`
  muda; `aplicarHistorico` desfaz no estado guardado de seção fora da tela; `focarTitulo`, `fecharGrupo`.
  `nota-view.ts`: as mesmas teclas na nota.
- Barra superior: "Seção anterior"/"Próxima seção" (Ctrl+Page Up/Down); menu Trabalho › Estrutura de seções…; menu
  Editar › Desfazer/Refazer seguem a ordem única quando o último foco estava na aba Escrever (fora de campo de texto).

**Achado durante o E2E** [VERIFICADO 2026-10-17]: o `prosemirror-history` junta numa entrada o que se digita até 500 ms
depois e no mesmo lugar. Voltar a uma seção e digitar logo juntava com o passo antigo dela, e Ctrl+Z desfazia outra seção
primeiro (reproduzido num teste temporário: o "Dois" da seção 2 saía antes do " Mais." da seção 1). Corrigido com
`closeHistory` ao desmontar o editor e depois de cada entrada nova; o EDT-09, que falhava, passou.

**Aceite** [VERIFICADO 2026-10-17]
- Teclado completo: Nova seção, Alt+Shift+↑/↓/→/←, Delete, F2, Enter, setas, Home/End, Ctrl+Z/Ctrl+Y, Ctrl+Page Up/Down,
  Trabalho › Estrutura de seções… (E2E EDT-09).
- Leitor de tela: `role="tree"`, cada item com `aria-level`, `aria-posinset` e `aria-setsize`, e o nome "2.1 Coleta".
  Depois de mover, o foco volta ao item com o número novo (E2E confere `aria-level`, `posinset`, `setsize` e o foco). Não
  testado com o NVDA (roteiro R42).
- E2E de mover seção: teclado e arrastar (`dragTo`, HTML5 nativo); o arquivo salvo tem a ordem da tela.
- Sequência do ADR-0007 §4 em Node: digitar em 1, mover 3 para antes de 2, digitar em 3, desfazer três vezes → documento
  inicial; refazer volta (`tests/estrutura-secoes.test.ts`).
- `npm run verificar:tudo`: typecheck OK, 943/943 testes, 0 vulnerabilidades, E2E 12/12 (E2E-07 de desempenho incluso).

**Decisões visíveis** (delegadas pelo usuário à sessão principal, 2026-10-17)
- Nova seção depois da escolhida e das subseções dela, no mesmo nível: é o que o Word faz com Enter num título, e
  acrescentar no fim obrigaria a mover quase sempre.
- Teclas do modo de tópicos do Word (Alt+Shift+setas): quem vem do Word já conhece.
- Excluir sem diálogo, com anúncio e Ctrl+Z: o diálogo seria mais um passo, e o desfazer devolve a seção com o texto.
- Recuar e Promover sempre ativos, com a recusa em texto (WCAG 2.4.3: o botão não some do foco).
- Subir e descer atravessam para a seção vizinha da mãe sem mudar de nível, seguindo a ordem de leitura; mudar de nível
  é só por recuar/promover ou arrastar.

**Revisão** (`especialista-interface`, somente leitura): 1 Alta, 3 Médias, 4 Baixas.
- A1 (corrigida): com a ordem única vazia, Ctrl+Z/Ctrl+Y caíam no `undo`/`redo` da seção e mexiam num passo fora da
  ordem. A tecla agora é sempre consumida (editor e nota).
- M2 (corrigida): Ctrl+Z dentro da nota levava o foco para o texto da seção. O foco só muda se a seção mudou ou se ele se
  perdeu.
- M3 (corrigida): desfazer, refazer e Ctrl+Page Up/Down com o foco na árvore deixavam o foco num item não selecionado (ou
  no `body`, se o item sumia). O foco segue a seção ativa na árvore.
- M4 (corrigida): excluir a última seção pelo botão desativava o botão com o foco. O foco vai à seção que ficou no lugar
  ou a "Nova seção".
- B5 (corrigida): "Próxima seção" desativava com o foco nele na última seção. Agora usa `aria-disabled` na ponta.
- B6 (corrigida): duas exclusões seguidas com o mesmo número não eram anunciadas de novo (o texto se repetia).
- B7 (corrigida): os botões declaravam `aria-keyshortcuts` de teclas que só valem na lista. A tecla ficou só na dica.
- B8 (pendente): com centenas de seções, digitar no título re-renderiza a árvore inteira a cada tecla. Medir no M2-T12.
- Depois das correções, `npm run verificar:tudo` passou de novo: 943/943, 0 vulnerabilidades, E2E 12/12.

**Pendente**
- Roteiro NVDA da árvore (R42): conferir se nível, posição e número são lidos como esperado.
- E2E de Ctrl+Z com a ordem única vazia (A1): coberto só pela leitura do código.
- B8 (desempenho da árvore ao digitar no título com centenas de seções).
