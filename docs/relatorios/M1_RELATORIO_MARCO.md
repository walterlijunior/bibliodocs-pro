# Relatório do Marco M1 — Esqueleto executável

Relatório vivo do marco: cada tarefa M1-Txx acrescenta a sua seção. Plano: `docs/PLANO_DE_IMPLEMENTACAO.md`.

| Tarefa | Situação | Data |
|---|---|---|
| M1-T01 Esqueleto `app/` | CONCLUÍDA | 2026-10-16 |
| M1-T02 Endurecimento do runtime | CONCLUÍDA (Electron 44.8.0) | 2026-10-16 |
| M1-T03 Infraestrutura de testes | CONCLUÍDA | 2026-10-16 |
| M1-T04 Contratos e esquemas v1 | CONCLUÍDA | 2026-10-16 |
| M1-T05 Contêiner `.bdp` | CONCLUÍDA | 2026-10-16 |
| M1-T06 Salvamento atômico | CONCLUÍDA | 2026-10-16 |
| M1-T07 Migrações | CONCLUÍDA | 2026-10-16 |

## M1-T02 — Endurecimento do runtime (checklist C-1..C-22)

**Implementação:** `arquiteto-software`, com ajustes da sessão principal após a revisão. Arquivos:
`app/src/principal/index.ts`, `app/src/principal/seguranca/{politica-urls,protocolo-caminho,csp,endurecimento}.ts`,
`app/tests/seguranca-{politica-urls,protocolo-caminho,runtime}.test.ts`, `app/.gitignore`, `app/README.md` (seção Segurança).

### Registro do revisor (`revisor-seguranca`, 2026-10-16, somente leitura)

| Item | Situação | Evidência |
|---|---|---|
| C-2 | CONFORME | `index.ts` (webPreferences) + `app.enableSandbox()`; preload vazio |
| C-3 | CONFORME | `endurecimento.ts` (esquema privilegiado sem bypassCSP/CORS/SW; `protocol.handle`); `protocolo-caminho.ts` (traversal, codificações, host, método, lista MIME) |
| C-4 | CONFORME | `csp.ts` idêntica ao checklist; cabeçalho em toda resposta `app://`; CSP de dev só com `!app.isPackaged` + URL de loopback; não vaza para o build |
| C-5 | CONFORME | `will-navigate`/`will-redirect`/`will-frame-navigate`, `setWindowOpenHandler` → deny, `will-attach-webview`, via `web-contents-created` |
| C-6 | CONFORME (sem chamador até o T08) | `validarLinkExterno` + confirmação; lista vazia |
| C-7 | CONFORME | request/check/device negam; eventos `select-*-device` sem tratador cancelam [VERIFICADO em `electron.d.ts`] |
| C-8 | CONFORME | `onBeforeRequest` + `requisicaoPermitida` |
| C-9 | CONFORME | `spellcheck:false`; sem `crashReporter` |
| C-15 | CONFORME | `devTools: !app.isPackaged`; menu nulo no pacote; DevTools fechadas no pacote |
| C-21 | CONFORME | `app/.gitignore` + `.gitignore` da raiz (`*.pem`, `*.key`) |
| C-22 (parte 1) | CONFORME | `requestSingleInstanceLock()` + foco na segunda instância |

Adiados corretamente: C-10..C-12 → M1-T08; C-18..C-20 → M1-T03; C-13, C-14, C-16, C-17 → M1-T14;
C-22 parte 2 → M1-T12; C-1 é processo.

### Achados e tratamento

| Achado | Severidade | Tratamento |
|---|---|---|
| M-1 Conformidade provada só por teste estático + funções puras; sem E2E do Electron | Média | Encaminhado ao M1-T13 (Playwright `_electron`): script inline bloqueado, `fetch` remoto falha, navegação/`window.open` sem efeito, `app://interface/../x` → 400/404, segunda instância. Rodar a cada troca de Electron. Mitigação atual: sondas CDP manuais do arquiteto (abaixo) |
| B-1 Log com URL completa | Baixa | **Corrigido:** `urlParaLog` (só `protocolo//host`) + teste e varredura estática |
| B-2 `data:` liberado para qualquer tipo de recurso | Baixa | **Corrigido:** `data:` só `image`; `blob:` só `image`/`xhr` (`details.resourceType`) + testes |
| B-3 Filtro de rede bloqueará o LanguageTool futuro (`net.fetch` passa pelo `webRequest`) | Baixa | Pendente para a tarefa do LanguageTool (após M7): sessão dedicada endurecida ou exceção explícita só para o host, só com a opção ligada |
| B-4 Corretor desligado só por janela | Baixa | **Corrigido:** `session.setSpellCheckerEnabled(false)`; medir ausência de conexões no E2E do T13 |
| B-5 Modo dev ativado por variável de ambiente fora do pacote | Baixa | Risco aceito e documentado em `app/README.md` (não afeta o instalador) |
| B-6 Lacunas do teste estático; `.map` servido | Baixa | **Corrigido:** `nodeIntegrationInSubFrames`/`navigateOnDragDrop` no teste; `.map` removido da lista MIME (teste → 404) |

### Versão do Electron

O revisor recomendou **subir de 44.7.2 para 44.8.0**, publicada em 2026-10-16 e confirmada no npm e no GitHub.
A 44.8.0 traz o Chromium 152.0.7977.158 → .167, com 5 CVEs críticas e pelo menos 23 altas no boletim Extended Stable,
e mais 10 correções do Chromium/V8 marcadas `security` (PR #55034). Ela não muda nenhuma API usada pelo checklist.
O publicador e as assinaturas no npm são os mesmos da 44.7.2. **Troca feita em 2026-10-16**, autorizada pelo usuário (a primeira tentativa foi bloqueada pelo modo de permissão).
Condições exigidas e resultado:
1. Fixar `44.8.0` e regenerar o lock, que deve ter a integridade `sha512-Yn2tJ335…zd3Q==`.
2. Rodar `npm audit signatures` e `npm audit --omit=dev --audit-level=high`.
3. Conferir o SHA-256 do zip baixado contra o `SHASUMS256.txt`.
4. Repetir typecheck, testes, build e preview.

Resultado [VERIFICADO]: integridade do lock = `sha512-Yn2tJ335…zd3Q==`; `npm audit signatures` → 95 pacotes com
assinatura do registro verificada (52 com atestado); `npm audit --omit=dev --audit-level=high` → 0 vulnerabilidades; SHA-256 do
`electron-v44.8.0-win32-x64.zip` = `1c9319ba…6f573`, igual ao `SHASUMS256.txt` do release; typecheck OK; 156/156 testes;
build OK; preview → 4 processos `electron.exe`, log só com "starting electron app...".

### Verificação executada

- Sessão principal:
  - `npm run typecheck` → OK (3 projetos);
  - `npm test` → 4 arquivos, **156/156**;
  - `npm run build` → OK;
  - `electron-vite preview --skipBuild` por 20 s → só "starting electron app...", sem violação de CSP nem bloqueio no log.
- Arquiteto (sondas CDP no build, Electron 44.7.2):
  - interface em `app://interface/index.html`;
  - `require`/`process` indefinidos no renderer;
  - cabeçalho CSP igual ao checklist;
  - script inline bloqueado;
  - `fetch` https remoto bloqueado;
  - `..%5c` → 400;
  - `window.open` → null;
  - navegação externa bloqueada;
  - `file:` e https via `Page.navigate` → `ERR_BLOCKED_BY_CLIENT`;
  - segunda instância sai com código 0;
  - `npm run dev` com HMR conectado e sem violação de CSP.
- Não verificado:
  - o foco visual da janela na segunda instância;
  - as sondas repetidas depois dos ajustes B-1/B-2/B-4 (só o preview de fumaça foi repetido).

## M1-T03 — Infraestrutura de testes

**Implementação:** `engenheiro-qualidade`. A sessão principal acrescentou a proibição `aplicacao` → `persistencia`/`integracoes`/`preload`.
**Arquivos:** `app/package.json` (scripts `verificar` e `verificar:tudo`), `app/tests/apoio/{analisador-fontes,ler-fontes}.ts`,
`app/tests/arquitetura-{fronteiras,varreduras}.test.ts` e `app/README.md`. Nenhuma dependência nova.

- **`npm run verificar`:** `typecheck && vitest run && npm audit --omit=dev --audit-level=high`.
- **`npm run verificar:tudo`:** `verificar && build`. E2E, OOXML e LibreOffice entram nos marcos seguintes.
- **Grupo ARQ:** ARQ-01..06 em `docs/MATRIZ_DE_TESTES.md`. As interpretações das regras estão no adendo do ADR-0005.

**Verificação [VERIFICADO, sessão principal]:**
- `npm run verificar` → typecheck OK, 6 arquivos, **258/258**, `found 0 vulnerabilities`, EXIT=0.
- Experimento negativo: `src/dominio/modelo/_violacao.ts` com `export { app } from 'electron'` → EXIT=1, falha em
  "nenhuma importação viola as regras 1 a 6". O arquivo foi apagado em seguida.
- `npm run build` → OK.

**Limitações conhecidas:**
- Aliases de chamada escapam da varredura de rede (ex.: `const f = globalThis.fetch; f()`); mitigados pelo E2E "zero requisições" do T13.
- Montagens dinâmicas de propriedade escapam (`el['inner'+'HTML']`).
- Se forem criados aliases de caminho (`paths` no tsconfig), o analisador precisa aprender a resolvê-los.
- O `npm audit` precisa de rede.

**Pendente:** inventário de licenças (C-19/RNF-15) e `npm audit signatures` dentro do `verificar` (C-18; hoje é rodado manualmente).

## M1-T04 — Contratos e esquemas v1

**Implementação:** sessão principal. **Revisão do modelo:** `especialista-documento` (somente leitura).
**Arquivos:**
- `app/src/dominio/modelo/{tipos,index}.ts`;
- `app/src/dominio/esquemas/{limites,projeto-v1,validar,json-schema,index}.ts`;
- `app/esquemas/projeto-v1/{documento,manifesto}.schema.json`;
- `app/tests/esquemas-{projeto-v1,json-schema}.test.ts` e `app/tests/fixtures/projeto-v1/`;
- `app/package.json` (`zod` 4.6.7 e o script `esquemas:gerar`).

**Decisões técnicas:** adendo do M1-T04 no ADR-0004 (camelCase, v1 aditivo até a 1.ª distribuição, exportação do zod
considerada fiel e sem `ajv`, profundidade, mensagens).

**Revisão do `especialista-documento`:** 3 achados médios e 5 baixos; nenhum bloqueia o M1-T05.
- Corrigidos pela sessão principal:
  - M1 — caracteres proibidos em XML 1.0;
  - M2 — marcas repetidas ou sobrescrito+subscrito;
  - B4 — ids repetidos;
  - B5 — adendo do ADR inexistente.
- Encaminhados:
  - M3 — coerência de `id`/`tipoTrabalho` entre o manifesto e o documento → M1-T05;
  - B7 — função de texto plano do título → M1-T09/M2;
  - B8 — teste bytes → `JSON.parse` → validar → M1-T05.
- Aceito: B6 — o código depende do texto `'No matching discriminator'` do zod. Se ele mudar, a mensagem cai no
  locale pt-BR; o zod tem versão fixa.

**Verificação [VERIFICADO, sessão principal]:**
- `npm run verificar` → typecheck OK, 8 arquivos, **310/310**, `found 0 vulnerabilities`.
- `npm run build` → OK.
- `scripts/validar-kit.ps1` → 0 falhas.
- Experimentos negativos:
  - campo extra no tipo `Documento` → erro TS2344 no typecheck;
  - JSON Schema versionado alterado → teste de sincronia falha;
  - esquema zod alterado sem regenerar → teste de sincronia falha.

## M1-T05 — Contêiner `.bdp`

**Implementação:** sessão principal. **Revisão:** `revisor-seguranca` (somente leitura, com sondagens fora do repositório).

**Arquivos:**
- `app/src/persistencia/conteiner/{zip-leitura,pacote,limites,crc32}.ts` e `app/src/persistencia/index.ts`;
- `app/tests/persistencia-conteiner.test.ts` e `app/tests/apoio/zip-bruto.ts`;
- `app/tests/fixtures/projeto-v1/documento-valido.json` (id igual ao do manifesto);
- `app/package.json` (`fflate` 0.8.3).

**Decisões técnicas:** adendo do M1-T05 no ADR-0004:
- coerência de id e tipo entre o manifesto e o documento;
- parser próprio do diretório central e descompressão por `node:zlib`;
- leitura sob demanda;
- manifesto ≤ 2 MB e piso de 1 MB para a razão de compressão;
- releitura no empacotamento.

**Revisão do `revisor-seguranca`:** 1 Alta, 2 Médias e 3 Baixas. O revisor não conseguiu fazer `lerProjeto` lançar
exceção em vez de devolver `{ok:false}`.

| Achado | Tratamento |
|---|---|
| A1 (Alta): o app gravava um `.bdp` que ele mesmo recusa (razão de compressão) | Corrigido: piso de 1 MB para a razão e releitura com `lerProjeto` dentro de `empacotarProjeto` |
| A2 (Média): tudo era descomprimido antes da validação (2,16 GB de RSS e 9 s com mídias não declaradas) | Corrigido: descompressão sob demanda, na ordem da validação; mídia não declarada e `bibliografia.json` nunca são descomprimidos |
| A3 (Média): heap alto com manifesto de 63 MB; documento processado com o manifesto já inválido | Corrigido: manifesto ≤ 2 MB; retorno imediato no erro do manifesto |
| A4 (Baixa): lixo depois do fluxo deflate; lacunas; descritor de dados | Corrigido: `info.engine.bytesWritten` igual ao tamanho comprimido; contiguidade desde o byte 0 até o diretório central; flag 8 recusada |
| A5 (Baixa): `Buffer.slice` devolvia vista do arquivo | Corrigido: cópia explícita (também da saída do zlib, que usa um pool compartilhado) |
| A6 (Baixa, hipótese): buffer interno do `Inflate` do `fflate` | Eliminado: a leitura usa `node:zlib` com `maxOutputLength` |
| Isolar a leitura num `utilityProcess` ou worker | Pendente → M1-T08 (abertura de arquivos pelo IPC) |

**Verificação [VERIFICADO, sessão principal]:**
- `npm run verificar` → typecheck OK, 9 arquivos, **370/370**, `found 0 vulnerabilities`.
- Mutação: 10 checagens desligadas uma a uma, todas detectadas:
  - `maxOutputLength`, sobra do deflate, contiguidade, lacuna final, CRC, razão;
  - cópia do zlib, cópia do método 0, releitura no empacotar, leitura sob demanda.

  Duas mutações sobreviveram na primeira rodada (lacuna final e cópia do zlib), e os testes correspondentes foram acrescentados.
- Medição (3.000 parágrafos e 50 mídias de 500 KB, 25 MB): empacotar com a releitura leva cerca de 170 ms; ler leva cerca de 90 ms.

**Limitações:**
- Ainda não há leitura de arquivo em disco nem `fs.stat` (M1-T06).
- A leitura roda no processo que a chamar, e o isolamento fica para o M1-T08.

## M1-T06 — Salvamento atômico

**Implementação:** sessão principal. **Revisão:** `revisor-seguranca` (somente leitura, com experimentos no scratchpad).

**Arquivos:**
- `app/src/persistencia/arquivo/{sistema-arquivos,gravacao-atomica,projeto-em-disco}.ts`;
- `app/src/persistencia/index.ts`;
- `app/tests/persistencia-salvamento.test.ts`.

**Decisões técnicas:** adendo do M1-T06 no ADR-0004:
- `.bak` por cópia, de modo que o destino nunca some;
- orçamento único de tentativas (esperas de 50 a 800 ms, cerca de 1,55 s);
- `SOMENTE_LEITURA` detectado antes de gravar;
- fila por destino;
- limpeza do temporário de uma falha anterior;
- durabilidade da troca registrada como hipótese.

**Revisão do `revisor-seguranca`:** nenhum achado Crítico ou Alto; 2 Médios e 9 Baixos.

| Achado | Tratamento |
|---|---|
| M6-01 (Média): destino somente leitura → "em uso" após 1,66 s; o `.bak` herdava o somente leitura e travava os salvamentos seguintes | Corrigido: `SOMENTE_LEITURA` no passo 1, sem tentativas; `.bak.tmp` e `.bak` antigo ficam graváveis |
| M6-02 (Média): bloqueio exclusivo → 6 + 6 tentativas, 3,26 s | Corrigido: orçamento único; medido 1,66 s |
| M6-03 (Baixa): `*.bdp.bak.tmp-*` órfão fora da busca de recuperação | Pendente → M1-T12 |
| M6-04 (Baixa): temporários de falhas repetidas se acumulavam | Corrigido: o salvamento seguinte do mesmo destino apaga o anterior |
| M6-05 (Baixa): cópia do `.bak` sem `fsync` | Corrigido |
| M6-06 (Baixa): durabilidade da troca sem `MOVEFILE_WRITE_THROUGH` | Aceito e registrado no ADR (atomicidade garantida, durabilidade não) |
| M6-07 (Baixa): TOCTOU entre `lstat` e `open` | Corrigido: o tipo é conferido também pelo descritor |
| M6-08 (Baixa): `ENOENT` na troca virava "pasta inexistente"; `EBUSY` ao criar não repetia | Corrigido |
| M6-09 (Baixa): cópia do `.bak` sem `COPYFILE_EXCL` | Corrigido. O teste novo revelou um defeito, também corrigido: em `EEXIST`, o app apagava o `.bak.tmp` alheio |
| M6-10 (Baixa): chave da fila não reconhece 8.3, `subst` ou UNC | Aceito enquanto houver instância única; reavaliar no M1-T08 |
| M6-11 (Baixa): caminhos completos no resultado | → M1-T08: o IPC manda só o nome do arquivo ao renderizador |

**Verificação [VERIFICADO, sessão principal]:**
- `npm run verificar:tudo`: typecheck OK, 10 arquivos, **407/407**, `found 0 vulnerabilities`, build OK.
- `python tests/test_estrutura_kit.py`: 9 OK.
- Mutação: 13 checagens desligadas uma a uma, todas detectadas:
  - somente leitura, orçamento único, `fsync` do `.bak`, `fsync` do temporário;
  - tirar o somente leitura do `.bak.tmp`, limpeza do temporário anterior, fila;
  - `ENOENT` na troca, `.bak.tmp` alheio, `EBUSY` ao criar;
  - tipo pelo descritor, crescimento do arquivo, `COPYFILE_EXCL`.

  Uma sobreviveu na primeira rodada (somente leitura do `.bak.tmp`), e o teste da corrida foi acrescentado.
- Medição real no Windows, em `%TEMP%`:
  - arquivo aberto por outro processo com `FileShare.Read` → `EPERM`, 6 tentativas, cerca de 1,64 s, original intacto;
  - liberado depois de cerca de 300 ms → salva na 4.ª tentativa, em cerca de 0,45 s;
  - com `FileShare.None` → erro em cerca de 1,66 s;
  - 25 MB: gravação em disco de 64 a 107 ms (152 a 180 ms com o `.bak`), salvamento completo de 0,24 a 0,84 s, abertura de 83 a 235 ms.

**Limitações:**
- OneDrive e pasta de rede não foram testados [HIPÓTESE].
- A durabilidade depois de uma queda de energia não foi medida.
- O visor (indicador de estado) é do M1-T11. Aqui só existe o resultado com código e mensagem.
- Ainda não há IPC (M1-T08).

## M1-T07 — Migrações

**Implementação:** sessão principal (o plano indicava o `especialista-documento`, que ficou como revisor).
**Revisão:** `especialista-documento` (somente leitura).

**Arquivos:**
- `app/src/dominio/esquemas/migracoes.ts` (novo, puro) e `index.ts`;
- `app/src/persistencia/conteiner/pacote.ts`, `arquivo/projeto-em-disco.ts`, `arquivo/sistema-arquivos.ts` (`criarPasta`), `index.ts`;
- `app/tests/persistencia-migracoes.test.ts`, `app/tests/apoio/migracao-ficticia.ts`, `app/tests/fixtures/migracoes/v0-para-v1/`;
- ajustes de forma em `persistencia-conteiner.test.ts` e `persistencia-salvamento.test.ts`.

**Decisões técnicas:** adendo do M1-T07 no ADR-0004 (forma da migração, versão futura, backup obrigatório).

**Critérios de aceite:**
- Cadeia aplicada na ordem: teste com registro fora de ordem e início no meio da cadeia [VERIFICADO].
- Versão futura recusa a edição: resultado `ok: false` com `versaoFutura`; o pacote de leitura tem tipo próprio que
  `salvarProjeto` não aceita [VERIFICADO].
- Fixture por versão: `fixtures/projeto-v1/` e `fixtures/migracoes/v0-para-v1/`; teste exige as quatro fixtures para
  cada migração registrada [VERIFICADO]. No v1 o registro de produção é vazio; v0 → v1 é fictícia e só existe nos testes.

**Revisão do `especialista-documento`:** nenhum achado Alto; 2 Médios e 5 Baixos.

| Achado | Tratamento |
|---|---|
| M1 (Média): versão futura com arquivo novo no ZIP (`estilos.json`, mídia `.svg`) era recusada pelo leitor do ZIP, sem `versaoFutura` | Corrigido: nomes possíveis de versão futura passam pelo ZIP com limite e sem descompressão; a recusa pelo nome vem depois do manifesto |
| M2 (Média): o pacote de leitura de versão futura tinha tipo `PacoteProjeto` com versão 1 e podia ser salvo, rebaixando um v2 | Corrigido: `PacoteSomenteLeitura` com a versão original; recusado na compilação e na execução (`PACOTE_INVALIDO`) |
| B1 (Baixa): backup podia substituir outro com o mesmo nome | Corrigido: sufixo `-2`, `-3`... |
| B2 (Baixa): migração que devolve não-objeto fazia `migrarParaAtual` lançar | Corrigido: conferência dentro do `try` |
| B3 (Baixa): versão antiga descomprimia o documento antes de recusas que não dependem dele | Corrigido: nome e cadeia (`motivoParaNaoMigrar`) antes do documento |
| B4 (Baixa): nada garantia que a migração preservasse o id | Corrigido: troca de id recusada |
| B5 (observação): pureza testada só na migração fictícia | Corrigido: teste de entrada congelada para toda migração registrada |
| Lacuna: falha na troca do backup | Teste novo. Revelou que sobrava um temporário na pasta de backups; corrigido (apagado) |

**Verificação [VERIFICADO, sessão principal]:**
- `npm run verificar:tudo`: typecheck OK, 11 arquivos, **443/443**, `found 0 vulnerabilities`, build OK.
- `scripts/validar-kit.ps1`: 0 falhas, 0 avisos.
- Mutação (cópia de `app/` no scratchpad): 28 mutações. 27 foram detectadas. A que sobreviveu é equivalente:
  tratar como nome livre um erro de `info` que não seja ENOENT não muda o resultado, porque o `gravarAtomico` repete
  a conferência e falha. Na primeira rodada (antes das correções), "ignorar falha ao criar a pasta" também era
  equivalente pelo mesmo motivo.

**Limitações:**
- Nenhuma migração real existe; a forma foi validada só com a fictícia.
- A rotação de backups não existe ainda (M1-T12); os `*-formato-v<N>.bdp` não devem ser apagados por ela [HIPÓTESE de política].
- `pastaBackups` só é passado pelo app a partir do M1-T08; a mensagem e a opção "abrir só para leitura" são do M1-T11.

## M1-T08 — IPC tipado

**Implementação:** sessão principal (o plano indicava o `arquiteto-software`).
**Revisão:** `revisor-seguranca` (somente leitura).

**Arquivos:**
- novos: `app/src/aplicacao/portas/projetos.ts`, `app/src/preload/api.ts`, `app/src/interface/bibliodocs.d.ts`,
  `app/src/principal/ipc/` (`remetente`, `argumentos`, `registro-projetos`, `manipuladores-projetos`,
  `protocolo-leitor`, `leitor-isolado`, `registrar`), `app/src/principal/leitor-projeto.ts`,
  `app/src/dominio/modelo/texto-plano.ts`, `app/tests/ipc-projetos.test.ts`;
- alterados: `app/src/preload/index.ts`, `app/src/principal/index.ts`, `app/src/aplicacao/index.ts`,
  `app/src/dominio/modelo/index.ts`, `app/electron.vite.config.mts` (entrada `leitor-projeto`).

**Decisões técnicas:** adendo do M1-T08 no ADR-0005 (contrato) e no ADR-0004 (leitura isolada).

**Critério de aceite:** chamada com argumento inválido ou de origem não permitida é recusada, em todos os canais e antes
de qualquer diálogo [VERIFICADO, `tests/ipc-projetos.test.ts`].

**Revisão do `revisor-seguranca`:** nenhum achado Alto; 2 Médios e 5 Baixos. C-10 conforme; C-11 e C-12 conformes,
com as ressalvas abaixo, todas tratadas.

| Achado | Tratamento |
|---|---|
| S8-01 (Média): o leitor isola falha, não privilégio; sem teto de heap | Teto `--max-old-space-size=2048`; alcance registrado no ADR-0004; sandbox do leitor → Etapa 7 |
| S8-02 (Média): `process.exit` logo após `postMessage` podia vencer a mensagem | Corrigido: o leitor não sai; o principal o encerra. Fumaça com 25 MB, 20/20 |
| S8-03 (Baixa): identificadores sobreviviam à recarga | Corrigido: `did-start-navigation` (quadro principal, outro documento) esquece os da janela |
| S8-04 (Baixa): arquivo aberto com outra extensão virava destino de `salvar` | Corrigido: identificador `null`; só "Salvar como" |
| S8-05 (Baixa): resposta do leitor com campos livres e sem limite | Corrigido: envelope estrito, sha256 com padrão, nome do backup sem separador, listas e textos limitados |
| S8-06 (Baixa): lista de erros sem limite ao renderer | Corrigido: corte em `LIMITES_V1.errosRelatados` (50) |
| S8-07 (Baixa): quadro principal por identidade de objeto | Corrigido: `senderFrame.parent === null` |
| M6-10 | Continua aceito (instância única) |
| M6-11 | Resolvido: só nomes de arquivo vão ao renderer |

**Verificação [VERIFICADO, sessão principal]:**
- `npm run verificar`: typecheck OK, 12 arquivos, **492/492**, `found 0 vulnerabilities`; `npm run build` OK
  (preload de 1,7 kB, sem zod); `electron-vite preview` abre sem erro.
- Mutação: 8 de 8 detectadas (sem conferir webContents, aceitar iframe, sem origem, sem contagem de argumentos,
  sem dono do identificador, pacote frouxo, registrar qualquer extensão, caminho completo do backup).
- Fumaça no Electron 44.8.0 (scripts no scratchpad, fora do repositório): leitor real com arquivo inválido e válido;
  `contextBridge` com o preload real (`Uint8Array` nos dois sentidos; sem `ipcRenderer`/`require` na página);
  25 MB x 20 leituras, 307–408 ms.
- `scripts/validar-kit.ps1`: 0 falhas, 0 avisos.

**Limitações:**
- O caminho do `leitor-isolado.ts` com tempo esgotado e saída sem resposta não tem teste automático (precisa do
  Electron) → E2E do M1-T13.
- Diálogos nativos não foram exercitados com clique; a interface que os chama é do M1-T10/T11.
- O teto de heap de 2 GB é estimativa.

## M1-T09 — Biblioteca de trabalhos

**Implementação:** sessão principal (o plano indicava o `especialista-documento`).
**Revisão:** `revisor-seguranca` (somente leitura).

**Arquivos:**
- novos:
  - `app/src/aplicacao/portas/biblioteca.ts` e `app/src/aplicacao/servicos/criar-trabalho.ts`;
  - `app/src/persistencia/biblioteca/` (`nomes`, `indice`, `resumo`, `varredura`, `renomear`);
  - `app/src/principal/ipc/manipuladores-biblioteca.ts` e `app/src/principal/ipc/chamada.ts`;
  - `app/tests/biblioteca.test.ts`;
- alterados:
  - `sistema-arquivos.ts`: `listarPasta`, `vincular`, `modificadoEmMs`, identidade;
  - `projeto-em-disco.ts`: `lerArquivoLimitado` extraído;
  - no IPC: `registro-projetos.ts`, `protocolo-leitor.ts`, `leitor-isolado.ts`, `leitor-projeto.ts`, `registrar.ts`,
    `manipuladores-projetos.ts`;
  - `preload/api.ts`, `aplicacao/index.ts`, `persistencia/index.ts` e dois testes antigos (a forma da API e o falso do
    `SistemaArquivos`).

**Decisões técnicas:** adendo do M1-T09 no ADR-0004 (índice e preferências, lote no leitor, operações, OneDrive,
resíduos).

**Critérios de aceite:**
- Apagar o índice e reabrir recria a mesma lista. [VERIFICADO, `tests/biblioteca.test.ts`]
- Excluir pede confirmação no principal e o arquivo vai para a Lixeira:
  - [VERIFICADO, unidade] cancelar não toca no arquivo;
  - [VERIFICADO, Electron real] com `shell.trashItem`, o arquivo sumiu da pasta e apareceu na Lixeira do Windows
    (consulta `Shell.Application`, `Namespace(10)`) com o local de origem.

**Revisão do `revisor-seguranca`:** 1 achado Alto, 4 Médios e 6 Baixos. Todos tratados, com 2 resíduos registrados.

| Achado | Tratamento |
|---|---|
| A1 (Alta): `idPara` quadrático; 5 000 itens levavam cerca de 40 s por listagem, com o principal congelado | Corrigido: chave do caminho calculada ao registrar e índice por janela + caminho. Teste: 5 000 `idPara` + `manterSo` < 1 s; listagem de 5 000 arquivos dentro do prazo do teste |
| M1 (Média): exceção inesperada (ex.: `lstat` depois de gravar) chegava ao renderer com o caminho | Corrigido: `registrarNoIndice` nunca lança (índice é cache) e `blindar` troca qualquer exceção por `ErroIpcRecusado` genérico, com o detalhe só no log |
| M2 (Média): diálogos dentro da fila única a travavam; varredura sem prazo | Corrigido: diálogos fora da fila, com reconferência dentro; prazo total de 180 s, com lista parcial e aviso |
| M3 (Média): um arquivo hostil derrubava o lote de 50 em toda listagem | Corrigido: lote perdido refeito um a um, e o hostil fica inválido no índice; desvio registrado no ADR-0004 |
| M4 (Média): corridas de `abrir` com renomear e excluir | Corrigido: `abrir` da biblioteca na fila; excluir reconfere caminho e "aberto" depois da confirmação. Resíduo: `projetos.abrir` por diálogo durante um renomear |
| B1 (Baixa): `rename` do Windows sobrescreve | Corrigido no renomear: link físico (EEXIST) e remoção do nome antigo, com alternativa para volume sem link. Resíduo: criar/duplicar contra processo externo |
| B2 (Baixa): troca só de caixa em pasta sensível à caixa | Corrigido: exige a mesma identidade `dev:ino` |
| B3 (Baixa): surrogates órfãos, `\p{Cf}`, `CONIN$`/`CONOUT$` | Corrigido na validação e na limpeza do nome |
| B4 (Baixa): preferência com caminho relativo; mensagem de link confusa | Corrigido: caminho absoluto exigido; link de pasta recusado com mensagem própria |
| B5 (Baixa): índice adulterado altera só a exibição | Aceito (quem escreve em `%LOCALAPPDATA%` já controla a conta; abrir e duplicar releem o arquivo) |
| B6 (Baixa): link trocado entre `lstat` e `open` | Corrigido: `lerArquivoLimitado` compara a identidade do caminho com a do descritor |

**Verificação [VERIFICADO, sessão principal]:**
- `npm run verificar`: typecheck OK, 13 arquivos, **594/594** (102 novos), `found 0 vulnerabilities`;
  `npm run build` OK.
- Mutação: 19 de 19 detectadas. Entre elas: sem confirmação, excluir ou renomear aberto, renomear sobrescreve,
  duplicar mantém o id, sem fila, id de item de outra janela, cache ignora a data, índice de outra pasta, sem conferir
  o remetente, caminho ao renderer, `blindar` repassa o erro, lote sem refazer um a um, troca de caixa sem identidade,
  sem identidade do descritor. A primeira rodada mostrou que, com o link físico, a fila deixou de ser necessária no
  renomear simultâneo; o teste de duas cópias simultâneas passou a cobri-la.
- Fumaça no Electron 44.8.0 (script no scratchpad, fora do repositório):
  - pedido de resumo real ao `leitor-projeto` (válido, inválido, inexistente) → `ok`, `invalido`, `invalido`, em
    233 ms;
  - `shell.trashItem` → arquivo fora da pasta e presente na Lixeira.
- `scripts/validar-kit.ps1`: 0 falhas, 0 avisos.
- Defeito achado pelos testes durante a implementação: `.bdp` digitado sozinho virava o nome `.bdp.bdp` (o `extname`
  trata `.bdp` como arquivo oculto). Corrigido.

**Limitações:**
- Diálogos nativos (escolher pasta, confirmar exclusão) não foram exercitados com clique; a interface é do M1-T10/T11.
- O aviso de OneDrive só chega como `naNuvem` na resposta; o texto do aviso na tela é do M1-T10/T11.
- A miniatura do índice (ADR-0004, seção 5) não foi feita: ainda não existe miniatura nos projetos.
- A fumaça deixou dois arquivos de teste (`bdp-fumaca-lixeira-*.bdp`) na Lixeira do usuário.

## M1-T10 — Casca da interface

**Pré-requisito:** protótipo `analise/poc-ui/prototipo.html` aprovado pelo usuário em 2026-10-16; todos os itens
`[PROPOSTA]` aceitos como recomendados (registro em `docs/GUIA_VISUAL.md`).

**Implementado** (sessão principal, `app/src/interface/`): quatro faixas (barra superior com visor do pequi e busca,
menus, navegação com coleção e abas, conteúdo); biblioteca real pela API do M1-T09 (barra lateral, grade de capas,
detalhes, estados, aviso de OneDrive e avisos da listagem, cartões `versaoFutura`/`invalido`); criar trabalho;
escolher pasta; janela mínima 1024×700; menu nativo removido também no desenvolvimento (F12 para DevTools). Decisões
técnicas no adendo do ADR-0005.

**Verificação executada:**
- `npm run verificar:tudo`: typecheck OK (3 projetos), 16 arquivos, **630/630** (36 novos), `found 0 vulnerabilities`,
  build OK.
- Mutação: 10 de 10 detectadas (contraste de token claro e escuro, cor solta no CSS, tabindex móvel, seta para baixo
  na grade, busca com "alguma palavra", aviso de OneDrive, botão sem `disabled`, Ctrl+F com modificadores, limite de
  Recentes).
- Fumaça no Electron 44.8.0 com o build de produção (`app://`), dados locais e biblioteca numa pasta temporária
  (`LOCALAPPDATA` redirecionado + `preferencias.json`), dirigida por CDP (script no scratchpad, fora do repositório):
  **21/21** — arquivo ilegível com aviso; "Novo trabalho" e Ctrl+N criam 3 arquivos e o último fica selecionado com
  foco; Ctrl+F foca a busca; setas e End na grade; Esc fecha o painel e devolve o foco; contorno de foco
  `rgb(31, 95, 191)`; setas nas abas; Alt+Seta volta; menu por teclado (abrir, passar ao lado, Esc); faixas inteiras e
  sem rolagem horizontal em 1008×661 (área útil da janela mínima) e 1920×1017; busca sem resultado e Esc limpa;
  console sem erro, exceção ou violação de CSP. Capturas conferidas visualmente.
- Defeito achado pela fumaça e corrigido: Alt+Seta com foco numa aba era tratado pela aba e pelo atalho global ao
  mesmo tempo (a troca se desfazia). Teste novo para `temModificador`.
- `scripts/validar-kit.ps1`: 0 falhas, 0 avisos.

**Limitações:**
- O Electron não implementa o domínio `Browser` do CDP: o tamanho foi emulado (`Emulation.setDeviceMetricsOverride`);
  o limite `minWidth`/`minHeight` da janela não foi exercitado arrastando a borda.
- Escala do Windows 125%/150% não foi medida no app (só no protótipo da Etapa 4).
- Leitor de tela real (Narrador/NVDA) não foi usado; papéis e nomes ARIA conferidos no HTML renderizado.
- Itens de menu sem função ficam desativados (`aria-disabled`); abas e coleções além de Biblioteca/Trabalhos mostram
  "ainda não disponível".

## M1-T11 — Fluxo criar → editar → salvar → fechar → abrir

**Implementado** (sessão principal):
- `app/src/aplicacao/servicos/sessao-trabalho.ts` — `SessaoTrabalho`, pura (API, relógio e agendador injetados):
  trabalho aberto, estado de salvamento do visor, salvamento automático da opção (1) do ADR-0004 (30 s depois da
  última alteração, ao trocar de trabalho e ao fechar; Ctrl+S imediato), fila única de gravações (salvar, automático,
  "Salvar como…"), só leitura para versão futura e "Salvar como…" para arquivo sem `.bdp`.
- Interface: aba Escrever com o título editável (`interface/escrever/`); visor ligado à sessão; menu Arquivo com
  Abrir… (Ctrl+O), Salvar (Ctrl+S), Salvar como… (Ctrl+Shift+S, item novo) e Fechar trabalho (Ctrl+W), desativados
  quando não se aplicam; Enter/duplo clique no cartão e "Abrir" no painel abrem; renomear, duplicar e excluir no
  painel; `ABERTO_NO_APP` com orientação para fechar; fechar a janela grava antes (cancelando o `beforeunload`).
- Criar trabalho deixa o trabalho aberto na aba Escrever (antes era fechado logo após criar).
- Decisões técnicas no adendo do M1-T11 no ADR-0004.

**Revisão** (`especialista-interface`, somente leitura): 0 Alta, 4 Média e 5 Baixa, corrigidas:
- M1 "Salvar como…" fora da fila: com o diálogo aberto, o automático gravava no arquivo antigo e trocava o nome de
  volta → entrou na fila única e para o automático (teste novo; mutação detectada);
- M2 `ocupado` era estado do React (duas teclas seguidas criavam dois trabalhos) → travas síncronas em `useRef`;
- M3 o visor inteiro era região viva (título anunciado a cada tecla) → só a linha de salvamento é `role="status"`;
- M4 foco perdido ao fechar o trabalho, excluir e renomear → foco no cartão, no vizinho e no botão "Renomear…";
- Baixas: papel vivo fora do `<li>`; Ctrl+S em arquivo sem `.bdp` mostra o aviso; alvo ≥ 24 px nos botões de aviso
  (token `--alvo-minimo`); comentário sobre descartar durante a gravação. Botões da aba Escrever sem `ocupado`:
  aceito (gravar não conflita com a biblioteca).

**Verificação executada:**
- `npm run verificar:tudo`: typecheck OK (3 projetos), 17 arquivos, **665/665** (35 novos), `found 0
  vulnerabilities`, build OK. `scripts/validar-kit.ps1`: 0 falhas, 0 avisos.
- Mutação: 12 de 12 detectadas (atraso de 30 s, visor durante a gravação, aviso de erro, fechar sem gravar, resultado
  atrasado depois de descartar, `garantirSalvo` sem conferir, aviso sem `.bdp`, automático não agendado, prefixo do
  erro no visor, Ctrl+Shift+S, Salvar em só leitura, campo editável em só leitura), mais 1 da revisão ("Salvar como…"
  fora da fila).
- Fumaça no Electron 44.8.0 (build `app://`, `LOCALAPPDATA` e biblioteca em pasta temporária, CDP; script no
  scratchpad, fora do repositório): **31/31** — criar abre a aba Escrever com foco no título; visor "Salvo" →
  "Alterações não salvas" → Ctrl+S "Salvo às HH:MM", com o título no `documento.json`; automático ainda pendente aos
  25 s e gravado aos **30,2 s**; arquivo marcado somente leitura → "Erro ao salvar: …" visível no visor, aviso com
  "Salvar como…", arquivo intacto; Ctrl+W com erro não fecha e oferece "Fechar sem salvar"; com o arquivo liberado,
  Ctrl+S volta a "Salvo"; renomear aberto → `ABERTO_NO_APP` com orientação; Esc no campo cancela só o renomear;
  Ctrl+W → pequi e foco no cartão; renomear fechado → arquivo novo e foco no botão; Enter no cartão reabre com o
  título; fechar a janela com alteração pendente grava e sai em ~0,3 s; console sem erro nem violação de CSP.
  Capturas conferidas.
- Defeito achado pela captura e corrigido: a mensagem de erro longa quebrava para baixo do corte do visor e ficava
  invisível (a checagem por texto passava). A linha do visor agora não quebra (reticências + dica com o texto
  inteiro), e a fumaça confere a posição da linha vermelha dentro do visor.

**Limitações:**
- Diálogos nativos (Abrir…, Salvar como…, confirmar exclusão) não foram clicados na fumaça; a lógica está nos testes
  com API falsa. Versão futura em só leitura e arquivo sem `.bdp` só nos testes de unidade.
- Leitor de tela real não foi usado (papéis conferidos no HTML).
- O título editado perde as marcas (itálico) até o editor rico do M2 [HIPÓTESE aceitável: nada no M1 cria marcas].
- Seções, pré-visualização e zoom da barra superior continuam desativados mesmo com trabalho aberto (não há seções
  nem página no M1).

## M1-T12 — Recuperação após encerramento inesperado

**Implementado** (sessão principal):
- `app/src/persistencia/recuperacao/recuperacao.ts`: instantâneos (`atual.bdp`/`anterior.bdp`), trava de sessão,
  reserva de queda não decidida (`<id>~<carimbo>`), `recuperacao-antigos` com 7 dias contados do arquivamento, procura
  de restos de gravação na pasta da biblioteca. `gravarAtomico` ganhou `semBak`; `SistemaArquivos` ganhou
  `apagarPasta` e `definirModificacao`.
- `app/src/principal/ipc/manipuladores-recuperacao.ts`: canais `instantaneo`, `listar`, `recuperar`, `abrirSalvo`;
  sessões ativas; ganchos `antesDeGravar`/`aoGravar`/`aoFechar` nos manipuladores de projetos; fim da sessão no
  `closed` da janela e espera da fila antes de sair. O registro dos projetos passou a guardar o id lido ao abrir.
- `SessaoTrabalho`: instantâneo com limite de ~2 s (espaçado em documentos lentos), aviso em falha, abertura de versão
  recuperada como "Alterações não salvas". Interface: ofertas como avisos da Biblioteca (padrão visual existente, sem
  componente novo), aviso "Versão recuperada de HH:MM" na aba Escrever.
- Instância única já existia (M1-T02). Decisões e desvios no adendo do M1-T12 no ADR-0004.

**Revisão** (`revisor-seguranca`, somente leitura): 4 Alta, 5 Média e 4 Baixa.
- A1 a cópia mantinha a data da origem, e o "prazo de 7 dias" apagaria na hora um instantâneo ou original antigo
  arquivado → data do arquivamento aplicada ao arquivar (teste novo);
- A2 "Decidir depois" + editar de novo arquivava a queda sem avisar → reserva `<id>~<carimbo>`, continua oferecida;
- A3 o salvamento podia apagar um instantâneo mais novo que ele → marca antes de gravar; só apaga se nada chegou;
- A4 restaurar tirava o original da pasta se a gravação falhasse, e substituía o `.bak` íntegro se o arquivamento
  falhasse → aborta sem guardar; devolve o original em falha;
- M1 id do projeto vinha do renderer → id registrado pelo principal; M2 caminho com outro trabalho → sem destino;
  M3 nada é arquivado por comparação de datas; M4 restos com mais de 10 min e no máximo 100 por listagem;
  M5 instantâneos espaçados (4 × a duração do último) — **não medido** com 25 MB;
- B1 limpeza no `closed`; B3 trabalho aberto não é recuperado por cima; B2 (UNC na trava) e B4 (restos fora da
  biblioteca) aceitos e registrados no ADR.

**Verificação executada:**
- `npm run verificar:tudo`: typecheck OK, 18 arquivos, **711/711** (45 novos), `found 0 vulnerabilities`, build OK.
  `scripts/validar-kit.ps1`: 0 falhas, 0 avisos.
- Mutação (script no scratchpad): **27/27** detectadas, entre elas: apagar sem conferir a marca, fechar sem limpar,
  sessão ativa oferecida, arquivar em vez de reservar, restaurar sem guardar/sem devolver, sem reconferência, origem
  sempre aceita, sem conferir trabalho aberto, id do pacote aceito, oferta de outra janela, restos sem idade mínima ou
  do próprio processo, arquivamento sem data, `.bak` nos instantâneos, espera que recomeça, instantâneo sem alteração,
  automático não agendado na versão recuperada, espaçamento ausente.
- Fumaça no Electron 44.8.0 (build `app://`, `LOCALAPPDATA` e biblioteca em pasta temporária, CDP; script no
  scratchpad): **20/20** — instantâneo ~1,2 s depois da alteração, trava criada, arquivo intacto; processo encerrado
  com `taskkill /F /T`; reabrir → oferta com o texto do ADR-0004 e os três botões; Recuperar → título da memória,
  "Alterações não salvas", aviso; Ctrl+S grava e apaga os instantâneos; segunda queda → "Abrir o arquivo salvo" abre o
  arquivo e guarda o instantâneo; fechamento normal apaga a trava e não deixa oferta; console sem erro nem CSP.
  Captura da oferta conferida. (Uma execução cruzou a meia-noite e o texto passou, corretamente, a "16/10/2026 às
  23:59"; a expressão da fumaça foi ajustada para os dois formatos.)

**Limitações:**
- Restaurar a partir de temporário ou `.bak` e a reserva de queda adiada só nos testes de unidade (disco real).
- Desempenho do instantâneo com 25 MB não medido; o empacotamento roda no processo principal.
- Não há tela para reabrir o que está em `recuperacao-antigos` (só pelo Explorer, por 7 dias).
- A oferta aparece só com a Biblioteca carregada (se a pasta da biblioteca falha, a oferta de instantâneo não aparece).

## M1-T13 — E2E com Playwright

**Implementado** (sessão principal; `@playwright/test` 1.64.1, dependência local informada; Electron 44.8.0):
- `app/e2e/fluxo-trabalho.spec.ts` (FUN-01), `recuperacao.spec.ts` (RNF-04/FUN-10), `casca.spec.ts` (UI-01 parcial e
  UI-02), `rede-e-seguranca.spec.ts` (zero rede, SEG-08; defesas do runtime, SEG-03 do achado M-1).
- `app/e2e/apoio/app.ts`: ambiente isolado (`LOCALAPPDATA`, biblioteca e `--user-data-dir` numa pasta temporária),
  fechar como o usuário, matar com `taskkill /F /T`, leitura do net-log e do `documento.json`; limpeza encerra o que
  uma falha deixou aberto.
- `npm run test:e2e`; `verificar:tudo` agora roda os E2E; quarto projeto de typecheck (`tsconfig.e2e.json`).
- **Correção no app:** `no-proxy-server` (o net-log mostrou consulta DNS `wpad` e checagem de IPv6 na abertura).
  Decisões e armadilhas no adendo do M1-T13 no ADR-0006.

**Revisão** (`engenheiro-qualidade`, somente leitura): 1 Alta, 4 Média e 7 Baixa.
- A1 travessia com alvo inexistente (`out/package.json`) daria 404 mesmo vulnerável → alvos que existem fora da raiz,
  controle 200, e conferência da URL normalizada. Medido: o Chromium resolve `%2e%2e` antes do pedido; `%5c` e
  `%252e` chegam ao manipulador e dão 400. A mutação das checagens de `..`/raiz **não** é detectada pelo E2E (inalcançáveis
  a partir da página); ficam na unidade (SEG-01);
- M1 perfil do Chromium real do usuário → `--user-data-dir` por teste; M2 Electron órfão se a janela não abrisse →
  registro logo após o `launch` e `taskkill` na falha; M3 laços de rede vazios → controle positivo do net-log e
  recursos da carga pela `performance` (o laço antigo de `requisicoes` não conferia nada: o ouvinte entra depois do
  carregamento); M4 corrida no `taskkill` → tolerada;
- Baixas corrigidas: atraso do instantâneo pelo `mtime` (limite 3 s, valor anotado); navegação provada pelo
  `defaultPrevented` (e também `file:`); cor do anel lida dos tokens, inclusive o da busca; segunda instância
  restaura a janela minimizada; segunda instância encerrada com `taskkill /T`. Aceitas e registradas: espera fixa de
  3 s no teste de rede (heurística), escala por `--force-device-scale-factor` (não é a escala real do Windows),
  efeito do `no-proxy-server` (ADR-0006).

**Verificação executada:**
- `npm run verificar:tudo`: typecheck OK (4 projetos), vitest 18 arquivos **712/712** (1 novo: chave de proxy),
  `found 0 vulnerabilities`, build OK, **E2E 8/8** (~25 s). `npx playwright test --repeat-each=3` 24/24 (antes da
  revisão) e `--repeat-each=2` 16/16 (depois). `scripts/validar-kit.ps1`: 0 falhas, 0 avisos.
- Medidas: instantâneo gravado 1992 ms depois da alteração; janela mínima 1026×700; abertura do app ~0,4 s.
- Mutação (build refeito a cada uma): sem `no-proxy-server` → 6 resoluções de nome; `webRequest` com `cancel: false`
  → `net.fetch` do principal passa; sem instância única → segunda instância não sai; sem as guardas de navegação →
  a página navega; checagens de `..`/raiz removidas → **não detectada** (ver A1). 4 de 5.

**Limitações:**
- Diálogos nativos (Abrir…, Salvar como…, escolher pasta, confirmar exclusão) e a Lixeira continuam sem E2E.
- Automático de 30 s, erro de gravação, versão futura só leitura e restauração de temporário/`.bak` só na unidade e
  nas fumaças.
- Escala real do Windows por monitor, leitor de tela e axe-core não exercitados.
- O E2E abre janelas na tela e precisa de sessão gráfica (não roda em CI sem área de trabalho).

## M1-T14 — Empacotamento de fumaça

**Implementado** (sessão principal; electron-builder 26.15.3, dependência local informada):
- `app/electron-builder.config.cjs`: NSIS `oneClick`, `perMachine: false`, `allowElevation: false`,
  `packElevateHelper: false`, `publish: null`, os 6 fuses do C-13, ASAR, `electronDist` local, `npmRebuild: false`,
  só `out/` e `package.json` (React fora; zod e fflate sem fontes `.ts`).
- `app/empacotamento/apos-empacotar.cjs` (afterPack: tira `default_app.asar` e `version`) e
  `app/empacotamento/instalador.nsh` (apaga a cópia do instalador em `bibliodocs-pro-updater`).
- `src/principal/seguranca/argumentos.ts` + ligação em `index.ts`: o app empacotado recusa chaves de linha de comando.
- Scripts `dist`, `dist:pasta`, `dist:fumaca`; `author` no `package.json` (o exe dizia "GitHub, Inc."); testes
  `tests/empacotamento.test.ts` e `tests/seguranca-argumentos.test.ts`.
- Kit: a busca de segredos do `validar-kit.ps1`/`test_estrutura_kit.py` passa a ignorar `node_modules`, `out` e
  `release*` (READMEs de `aws4` e `dotenv`, que vieram com o electron-builder, têm exemplos de chave). A busca de
  arquivos proibidos continua em tudo. Controle: segredo plantado em `docs/` → 2/2 detectados.

**Revisão** (`revisor-seguranca`, somente leitura, duas passagens): 0 Crítica e 0 Alta.
- A-1/S-1 (Média): `--remote-debugging-port` abria porta CDP sem senha no pacote. Corrigido.
- A-2/S-3 (Média, distribuição): sem assinatura. Etapa 7.
- Baixas corrigidas:
  - `elevate.exe` no pacote;
  - comentários errados (o Playwright e o `deleteAppDataOnUninstall`);
  - afterPack calado se o caminho mudar;
  - caminho fixo no `customUnInstall`.
- Baixas para a Etapa 7: NSIS 3.0.4.1 (CVE-2023-37378), cache de ferramentas validado só pela contagem, fuse do
  índice 8 sem nome.
- Baixa aceita: as moderadas do `npm audit` na cadeia de build (R35).
- **Desvio:** a fumaça funcional usa um artefato separado (`dist:fumaca`) em vez de `--remote-debugging-pipe` no
  mesmo artefato. Motivo registrado no adendo do ADR-0003.

**Verificação executada** (2026-10-17, Windows 11):
- `npm run dist`: ~38 s.
  - Instalador **111 841 150 bytes**, contra a meta de 200 MB do RNF-08.
  - `win-unpacked` 390 065 666 bytes; `app.asar` 3,9 MB; `resources/` só com `app.asar`.
  - `NotSigned` nos dois binários.
- Fuses lidos com `@electron/fuses read`: os 6 do checklist e "undefined is Enabled" (índice 8).
- Fumaça por CDP no pacote antes da correção A-1, 11/11, no `win-unpacked` e no instalado:
  - fuses em execução;
  - `app://interface/`;
  - criar, salvar e reabrir pelo leitor dentro do ASAR em ~2 s;
  - F12 sem DevTools; console sem erro; net-log sem URL externa nem WPAD.
- C-14: com 1 byte alterado, o app sai com 1 e sem processo vivo; com o original, a janela "BiblioDocs Pro" abre.
- Instalação 1 (`/S`): saída 0 em 21 s.
  - `requestedExecutionLevel asInvoker`; só HKCU (`DisplayName` "BiblioDocs Pro 0.1.0", `Publisher` "BiblioDocs Pro").
  - 390 310 951 bytes instalados; atalhos na Área de Trabalho e no Menu Iniciar.
  - Desinstalação (`/S /currentuser`): **sobrou** `bibliodocs-pro-updater\installer.exe` (111 889 446 bytes).
- Instalação 2, com as correções:
  - a instalação já apagou a sobra da 1.ª;
  - sem `-updater`, sem `elevate.exe`; atalhos sem argumentos; nenhum `ns*.tmp` em `%TEMP%`.
  - Fumaça negativa 6/6 no instalado: porta recusada com saída 2, porta nunca aberta (consulta em laço), controle
    sem argumentos abre.
  - Desinstalação: sem programa, `-updater`, atalhos e chaves HKCU. Ficam `%APPDATA%\BiblioDocs Pro` e
    `Documentos\BiblioDocs Pro` (dados do usuário).
- `npm run verificar:tudo`: typecheck OK, vitest 20 arquivos **741/741** (29 novos), `found 0 vulnerabilities`,
  build OK, **E2E 8/8**. 10/10 mutações detectadas: argumentos ×6, `packElevateHelper`, `RMDir /r`, afterPack,
  fuse `runAsNode`. `scripts/validar-kit.ps1`: 0 falhas; `python tests/test_estrutura_kit.py`: 9 OK.

**Limitações:**
- **Fluxo funcional depois da correção A-1 não reexecutado no pacote.** O `.exe` do `dist:fumaca` foi bloqueado pelo
  Controle Inteligente de Aplicativos (`VerifiedAndReputablePolicyState = 1`, eventos CodeIntegrity 3033/3077), e
  não foi contornado. A mudança só acrescenta a checagem de argumentos no início. O mesmo código passa no E2E sobre
  `out/`, e o instalado abre a janela sem argumentos.
- Instalação em máquina limpa, Windows 10, atualização por cima de versão anterior, desinstalação com o app aberto e
  SmartScreen ao baixar: Etapa 7 (DIST).
- `CompanyName` provisório.

**Complemento (2026-10-17, depois do commit `1efbb74`):**
- Ícone próprio: o pequi em `app/recursos-build/` (`icone.svg`, `icone-pequeno.svg` → `icone.ico`; gerador
  `app/empacotamento/gerar-icone.cjs`). Conferido visualmente em 256 px e ampliado em 16, 24, 32 e 48 px; extraído do
  `.exe` do app e do instalador pelo `System.Drawing.Icon.ExtractAssociatedIcon`. Instalador: 111 915 440 bytes.
- Decisão do desinstalador: nunca apagar dados do usuário (adendo do ADR-0003).
- Associação `.bdp` ainda não existe. Quando existir, registrar `"...exe" -- "%1"`.
