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
