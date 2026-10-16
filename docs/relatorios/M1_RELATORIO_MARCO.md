# Relatório do Marco M1 — Esqueleto executável

Relatório vivo do marco: cada tarefa M1-Txx acrescenta a sua seção. Plano: `docs/PLANO_DE_IMPLEMENTACAO.md`.

| Tarefa | Situação | Data |
|---|---|---|
| M1-T01 Esqueleto `app/` | CONCLUÍDA | 2026-10-16 |
| M1-T02 Endurecimento do runtime | CONCLUÍDA (Electron 44.8.0) | 2026-10-16 |
| M1-T03 Infraestrutura de testes | CONCLUÍDA | 2026-10-16 |

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
