# Relatório do Marco M2 — Modelo de documento e editor

Relatório vivo do marco: cada tarefa M2-Txx acrescenta a sua seção. Plano: `docs/PLANO_DE_IMPLEMENTACAO.md`.

| Tarefa | Situação | Data |
|---|---|---|
| M2-T01 Desempenho do instantâneo e do salvamento | CONCLUÍDA | 2026-10-17 |
| M2-T02 a M2-T12 | PENDENTE | — |

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
