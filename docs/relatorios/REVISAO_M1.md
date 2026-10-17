# Revisão de segurança e qualidade — fechamento do marco M1

- **Data:** 2026-10-17
- **Escopo:** o marco inteiro (commits até `222824e`), com foco no que cruza as tarefas. Cada tarefa M1-T01..T14 já
  teve revisão própria, registrada em `docs/relatorios/M1_RELATORIO_MARCO.md`.
- **Executado por:** `revisor-seguranca` (somente leitura) e, para testes e comandos, a sessão principal.
- **Skill:** `revisao-seguranca-qualidade`.

## Resumo

| Crítica | Alta | Média | Baixa | Info |
|---|---|---|---|---|
| 0 | 1 | 3 | 6 | 3 |

O achado Alto (R-M1-01) não afeta o app do M1, porque o documento ainda é só o título. Ele afeta o editor do M2.
Pela skill, um achado Alto bloqueia o fechamento do marco até ser corrigido ou aceito por escrito pelo usuário.
**Decisão (2026-10-17, delegada pelo usuário à sessão principal):** aceito; vira **M2-T01**, a primeira tarefa do M2, antes do editor. M1 fechado.

## Comandos executados (em `app/`)

| Comando | Resultado |
|---|---|
| `npm audit --omit=dev --json` | 0 vulnerabilidades (6 pacotes de produção) |
| `npm audit --json` | 8 moderadas, todas na cadeia `electron-builder` → … → `sprintf-js` ≤ 1.1.3 (GHSA-hp3w-g68c-fv3c). É o risco R35, já aceito: só no build |
| `npm audit signatures` | 365 pacotes com assinatura do registro verificada; 90 com atestado |
| `npm ls --omit=dev --all` | fflate 0.8.3, react 19.3.1, react-dom 19.3.1, scheduler 0.28.0, zod 4.6.7 |
| `npm view electron` | 44.9.0 publicado em 2026-10-17. As notas não citam CVE. As correções #55048 e #55046 não afetam o app, que nega `window.open` |
| Varredura de segredos (arquivos versionados fora de `materiais/`) | nada |

## Achados

| ID | Sev. | Achado | Recomendação | Dono | Situação |
|---|---|---|---|---|---|
| R-M1-01 | **Alta** | O instantâneo de recuperação (~2 s depois de cada alteração) manda o pacote inteiro, com os bytes das mídias, pelo IPC. O principal empacota de forma **síncrona** (`manipuladores-recuperacao.ts:349` → `zipSync` e releitura com `inflateRawSync`). Medido: ~170 ms para 25 MB. [HIPÓTESE] Com o editor do M2 e um documento grande, o principal travado atrasa a digitação | Antes do editor: medir a latência de teclado com 25 MB de mídia e um documento de 150 páginas. Se passar da meta, fazer o instantâneo incremental (só `documento.json`; mídias por sha256 uma vez) e empacotar fora do principal | arquiteto-software + engenheiro-qualidade | Aceito (decisão delegada pelo usuário, 2026-10-17); M2-T01. Risco R36 |
| R-M1-02 | Média | Excluir manda só o `.bdp` para a Lixeira; o `<nome>.bdp.bak`, com o texto anterior, fica na pasta. Renomear deixa o `.bak` com o nome antigo | Levar o `.bak` junto ao excluir e ao renomear, com teste | especialista-documento | Decidido (delegado pelo usuário, 2026-10-17): levar o `.bak` junto nos dois casos; implementar no M2. Risco R37 |
| R-M1-03 | Média | Os backups rotativos do ADR-0004 §4 (`backups\<id>\`, 10 + 1 por dia durante 7 dias) não existem; hoje há o `.bak` e os backups de migração | Implementar no M2, junto com o editor | especialista-documento | Registrado no plano do M2 |
| R-M1-04 | Média | Falta o inventário de licenças (C-19/RNF-15): não há `TERCEIROS.txt` no pacote nem tela "Sobre". O React vai no bundle só com o cabeçalho `@license`. O produto está como `UNLICENSED` | Script de inventário a partir do lockfile, com teste que recuse GPL/AGPL/LGPL em produção; `TERCEIROS.txt` no pacote; lista no "Sobre". A licença do produto é decisão do usuário (Etapa 7) | engenheiro-qualidade; "Sobre": especialista-interface | Registrado no plano do M2 |
| R-M1-05 | Baixa | `npm audit signatures` não está no `verificar`; não há `npm ci` documentado nem CI (C-18 parcial) | Acrescentar ao `verificar`; documentar `npm ci` | engenheiro-qualidade | `npm ci` documentado no `app/README.md` (M1-T15); o script fica para o M2 |
| R-M1-06 | Baixa | Electron 44.8.0; o 44.9.0 já saiu, e o 45 fica estável em 2026-10-20 | Subir para 44.9.0 na rodada mensal, com `test:e2e` e a fumaça do pacote | arquiteto-software | Registrado no plano do M2 |
| R-M1-07 | Baixa | Logs com `e.message` de erros do sistema de arquivos podem conter o caminho completo (`ipc/chamada.ts:28`, `manipuladores-biblioteca.ts:413`, `manipuladores-recuperacao.ts:461`). O log só vai para o stdout | Registrar só o código do erro, ou o `basename` | sessão principal | Limitação descrita no `app/README.md`; correção no M2 |
| R-M1-08 | Baixa | A trava de sessão fica em `%LOCALAPPDATA%` e não protege o mesmo `.bdp` aberto de outro computador (OneDrive, rede) | Registrar como limitação do C-22 | arquiteto-software | Registrado no `app/README.md` (M1-T15) |
| R-M1-09 | Baixa | Documentação desatualizada: Segurança, Estrutura e lista de testes do `app/README.md`; "3 projetos" no ESTADO; tabela do topo do relatório do M1 | Corrigir | sessão principal | **Corrigido no M1-T15** |
| R-M1-10 | Baixa | Pendências sem marco: tela para reabrir `recuperacao-antigos`; oferta de recuperação com a Biblioteca em erro; diálogos nativos e Lixeira sem E2E; axe-core (RNF-09) | Pôr no plano | sessão principal | Registrado no plano do M2 e da Etapa 6 |
| R-M1-11 | Info | `abrirLinkExterno` sem chamador (proposital, lista vazia); `exportacao/`, `importacao/`, `integracoes/` e `perfis/` são só esqueleto; nenhum TODO em `src/` | Manter | — | — |
| R-M1-12 | Info | O `verificar` falha sem rede por causa do `npm audit` | Documentado no `app/README.md` | — | — |
| R-M1-13 | Info | [HIPÓTESE] Os diálogos nativos de abrir e salvar entram no histórico de recentes do Windows | Citar na política de privacidade | — | Etapa 7 |

## Checklist C-1..C-22 — situação final no M1

| Item | Situação | Onde / pendência |
|---|---|---|
| C-1 | Parcial (processo) | Electron 44.8.0, suportado; 44.9.0 disponível (R-M1-06) |
| C-2 | Feito | `src/principal/index.ts`; `app.enableSandbox()` |
| C-3 | Feito | `seguranca/endurecimento.ts`, `seguranca/protocolo-caminho.ts` |
| C-4 | Feito | `seguranca/csp.ts`; cabeçalho em `endurecimento.ts` |
| C-5 | Feito | `endurecimento.ts` |
| C-6 | Feito, sem chamador | `endurecimento.ts:154`; lista de hosts vazia |
| C-7 | Feito | `endurecimento.ts` |
| C-8 | Feito | `endurecimento.ts`; `no-proxy-server`; E2E SEG-08. Pendente: B-3 (LanguageTool, depois do M7) |
| C-9 | Feito | `spellcheck:false` e `setSpellCheckerEnabled(false)`; sem `crashReporter` |
| C-10 | Feito | `preload/api.ts` |
| C-11 | Feito | `ipc/chamada.ts`, `ipc/remetente.ts`, `ipc/argumentos.ts` |
| C-12 | Feito | identificadores opacos (`registro-projetos.ts`); diálogos em `registrar.ts` |
| C-13 | Feito | `electron-builder.config.cjs`. Fuse do índice 8 sem nome: Etapa 7 |
| C-14 | Feito | ASAR e fuse; testado com 1 byte alterado (M1-T14) |
| C-15 | Feito | `devTools: !app.isPackaged`, menu nulo, recusa de chaves de linha de comando |
| C-16 | Feito | NSIS por usuário, sem elevação |
| C-17 | Feito (desligado) | `publish: null`, sem `electron-updater`. Assinatura: Etapa 7 |
| C-18 | Parcial | Falta `audit signatures` no script e CI (R-M1-05) |
| C-19 | Parcial | Falta o inventário de licenças (R-M1-04) |
| C-20 | Feito, por meio equivalente | Varredura em `tests/arquitetura-varreduras.test.ts` (sem ESLint) |
| C-21 | Feito | `.gitignore` da raiz e de `app/` |
| C-22 | Feito / parcial | Instância única; trava por projeto só nesta instalação (R-M1-08) |

## Dependências e licenças

**Produção:** fflate 0.8.3 (MIT), zod 4.6.7 (MIT), react 19.3.1 (MIT), react-dom 19.3.1 (MIT), scheduler 0.28.0
(MIT, transitiva); runtime Electron 44.8.0 (MIT, com `LICENSES.chromium.html` no pacote).

**Desenvolvimento:** @playwright/test 1.64.1, @types/node 24.19.2, @types/react 19.3.0, @types/react-dom 19.3.0,
@vitejs/plugin-react 6.1.2, electron 44.8.0, electron-builder 26.15.3, electron-vite 6.0.0, typescript 7.0.2,
vite 8.3.4, vitest 5.0.5.

**Árvore do lockfile (409 pacotes):** MIT 292, ISC 41, Apache-2.0 33, MPL-2.0 12, BSD-3 10, BlueOak-1.0.0 8, BSD-2 6,
mais algumas avulsas (Python-2.0, CC-BY-4.0, 0BSD, WTFPL). **Nenhuma GPL, AGPL ou LGPL, e nenhum pacote sem licença.**
Tudo o que não é MIT, ISC ou BSD está em dependências de build; o `app.asar` leva só `out/`, `package.json`, zod e
fflate.

## Desempenho

**Medido no M1** (reexecutado em 2026-10-17 com `npx vitest run tests/persistencia-salvamento.test.ts
tests/biblioteca.test.ts`, 139/139):
- 25 MB de mídia incompressível: salvar novo 396 ms (gravação 41 ms); salvar sobre existente 221 ms (gravação e `.bak`
  72 ms); abrir 88 ms.
- Arquivo bloqueado por outro processo: `EM_USO` em ~1,58 s; liberado depois de ~300 ms: salvo em 383 ms, na 4.ª
  tentativa.
- Medidos em tarefas anteriores: empacotar 25 MB ~170 ms; leitor isolado 25 MB × 20, 307–408 ms cada; biblioteca com
  5.000 arquivos em menos de 15 s; app abre em ~0,4 s (E2E); instalador 111,9 MB (meta: menos de 200 MB).

**Falta medir (M2):**
- instantâneo e salvamento com 25 MB e com um documento de 150 páginas: tempo no principal e latência de teclado
  (R-M1-01);
- validação zod e IPC com um documento grande;
- memória (RSS);
- primeira abertura do pacote com o disco frio.

O "documento difícil" do corpus só faz sentido a partir do M2, porque o M1 não tem conteúdo de documento.

## Privacidade: onde o texto do usuário fica no disco

- `Documentos\BiblioDocs Pro\Trabalhos\*.bdp`, e ao lado `*.bdp.bak` (ver R-M1-02) e restos `*.tmp-*`.
- `%LOCALAPPDATA%\BiblioDocsPro`:
  - `biblioteca.json` (títulos);
  - `preferencias.json`;
  - `sessao\<id>.lock` (PID e caminho);
  - `recuperacao\<id>\` (texto completo);
  - `recuperacao-antigos\` (7 dias);
  - `backups\` (migração, sem prazo).
- `%APPDATA%\BiblioDocs Pro`: perfil do Chromium. O renderer não usa armazenamento web, e as respostas do `app://`
  vão com `no-store`.
- O renderer recebe só o nome do arquivo e o código do erro. Nenhuma rede por padrão (E2E pelo net-log).

## Bloqueios para o M2

Só o R-M1-01: medir antes de ligar o editor. A escolha do editor de texto rico (ADR antes do M2) segue pendente.
