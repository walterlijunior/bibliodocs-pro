# Relatório da Etapa 7 — Estabilização e distribuição Windows

- **Data:** 2026-11-08
- **Commits:** `774cd99` (E7-T00) a E7-T04 (este relatório)
- **Ambiente:** Windows 11 com o **Controle Inteligente de Aplicativos ativo** (`VerifiedAndReputablePolicyState = 1`);
  Electron 44.10.1; electron-builder 26.15.3; NSIS 3.0.4.1
- **Executado por:** sessão principal; revisão final por revisor independente (só leitura, papel do
  `revisor-seguranca`)

## Situação

| Critério da Etapa 7 | Situação |
|---|---|
| Instalador gerado e testado | **Bloqueado.** O Controle Inteligente de Aplicativos impede montar o instalador sem assinatura e, desde o build de 23:36, também abrir o app empacotado sem assinatura nesta máquina (a decisão é pela reputação de cada arquivo, e cada build gera um arquivo novo) |
| Fluxos essenciais validados | Sim, no código atual: `verificar:tudo` (unidade, externos com Word e LibreOffice, E2E no Electron real) e a fumaça de exportação no pacote de 23:19 |
| Documentação de instalação completa | Sim: `app/README.md` (usuário), `docs/INSTALACAO_APP.md`, `app/DESENVOLVIMENTO.md` |
| Pendências registradas | Sim (abaixo) |

**A Etapa 7 fica AGUARDANDO USUÁRIO** pela decisão D-E7-01 (assinatura de código). Sem ela, o aplicativo empacotado
não pode ser instalado nem garantido nesta máquina, e não deve ser distribuído.

## Feito

| Tarefa | Resultado |
|---|---|
| E7-T00 | Plano e D-E7-01 (assinatura, decisão do usuário) |
| E7-T01 | Pendências do M1-T14 avaliadas (adendo do E7-T01 no ADR-0003): NSIS 3.0.4.1 aceito sem elevação, `toolsets.nsis` 1.2.1 junto com a assinatura; fuse 8 = `WasmTrapHandlers`; cache das ferramentas; `CompanyName` segue o nome provisório |
| E7-T02 | DIST-02 `PASSOU` (fuses, ASAR, recusa da porta de depuração com saída 2, exportação pelo pacote em 383 ms); DIST-03 **BLOQUEADO** (instalador); DIST-04 não executado (sem Windows 10) |
| E7-T03 | Guias de uso e de instalação; F7 e Verificar › Verificar conformidade ligados ao verificador |
| E7-T04 | Revisão final (abaixo); R-E7-02, 04 e 09 corrigidos; `win-unpacked` regerado do código atual (R-E7-01) |

## Revisão final de segurança, dependências e licenças (E7-T04)

| Gravidade | Qtd | Situação |
|---|---|---|
| Crítica | 0 | — |
| Alta | 1 | R-E7-01: tratado em parte (ver abaixo) |
| Média | 1 | R-E7-02: depende da D-E7-01; nota do SHA-256 no guia |
| Baixa | 3 | R-E7-03 aceito; R-E7-04 corrigido; R-E7-05 sem ação |
| Info | 4 | R-E7-09 corrigido; R-E7-06 a 08 sem ação |

**Sem regressão de segurança desde o M1 [VERIFICADO pelo revisor]:** checklist C-01 a C-20 no código atual
(isolamento, sandbox, CSP, navegação e janelas bloqueadas, `app://` sem `bypassCSP`, permissões negadas, rede
bloqueada por padrão, fuses, ASAR, argumentos recusados, sem atualização automática nem `crashReporter`). Os 23 canais
IPC conferem remetente, quantidade e conteúdo dos argumentos.

**Dependências [VERIFICADO]:** 16 pacotes de produção; `npm audit --omit=dev`: 0 vulnerabilidades; o ASAR leva só o
necessário (React e ProseMirror vão embutidos no bundle da interface).

**Licenças [VERIFICADO]:** `TERCEIROS.txt` lista os 16 pacotes de produção, todos MIT, inclusive os embutidos no bundle;
igual no pacote e no "Sobre"; licenças do Electron e do Chromium no pacote; compatível com distribuição gratuita
(RNF-15).

**Privacidade [VERIFICADO]:** nenhuma chamada de rede, telemetria ou envio de texto no código; dados em
`Documentos\BiblioDocs Pro`, `%LOCALAPPDATA%\BiblioDocsPro` e `%APPDATA%\BiblioDocs Pro` (cache do Chromium).

| Id | Grav. | Achado | Situação |
|---|---|---|---|
| R-E7-01 | Alta | Artefatos de `app/release/` velhos: o `.exe` do instalador tem 217 504 bytes (sobra do build bloqueado) e o `win-unpacked` era anterior ao commit do F7 | `win-unpacked` regerado do código atual (ASAR com `index-Bd321Nsk.js`, fuses conferidos). **O instalador só pode ser regerado e testado com assinatura ou em máquina sem o Controle Inteligente**; o `.exe` de 217 KB em `release/` não é instalador e é sobrescrito no próximo `npm run dist` |
| R-E7-02 | Média | Sem assinatura, o Controle Inteligente bloqueia sem opção de prosseguir | D-E7-01. Guia de instalação passa a pedir o SHA-256 publicado junto do link |
| R-E7-03 | Baixa | NSIS 3.0.4.1 (CVE-2023-37378) | Aceito: instalação por usuário, sem elevação. `toolsets.nsis` 1.2.1 junto com a assinatura |
| R-E7-04 | Baixa | Sem teto somado para os PNG dos gráficos no canal de exportação (até ~10 GB) | **Corrigido:** teto de 1 GiB somado, como o das mídias; teste em `tests/exportacao-ipc.test.ts` |
| R-E7-05 | Baixa | O perfil do Chromium em `%APPDATA%` guarda caches (de execuções de desenvolvimento) | Sem ação; documentado no guia |
| R-E7-06 | Info | Fuse `EnableCookieEncryption` desligado | Sem impacto: o app não usa cookies |
| R-E7-07 | Info | O ASAR leva `zod/v3`, `zod/locales`, `zod/mini` e `nanoid/bin`, que não são usados | Sem ação nesta versão (só tamanho) |
| R-E7-08 | Info | Fuse 8 sem nome na ferramenta | Documentado (adendo do E7-T01) |
| R-E7-09 | Info | Comentário da configuração omitia o `docx` no processo utilitário | **Corrigido** |

## Decisões que dependem do usuário

1. **D-E7-01 — assinatura de código** (ADR-0003):
   - (i) certificado de assinatura (OV, ou serviço como o Azure Trusted Signing), com custo;
   - (ii) MSIX pela Microsoft Store, com conta de desenvolvedor e outro empacotamento;
   - (iii) sem assinatura: nesta máquina, o instalador não é montado e o app empacotado pode ser bloqueado; o uso
     continuaria pelo modo de desenvolvimento (`npm run dev`), que roda o Electron assinado.
   A assinatura é o único caminho para instalar e distribuir sem desligar a proteção do Windows.
2. **DOC-08 / M3-T12** (Etapa 6): conferência manual de um DOCX no Word.
3. **F-E6-01** (Etapa 6): abas e coleções sem tela própria, e itens de menu ainda sem ação (Dados do trabalho…,
   Elementos pré-textuais…, Sigla…, F8, Guia rápido, Atalhos de teclado).

## Pendências para a próxima versão

- Instalação limpa, reinstalação por cima, desinstalação com o app aberto (DIST-03) e Windows 10 (DIST-04), depois da
  assinatura.
- `toolsets.nsis` 1.2.1 (makensis 3.12); build de distribuição com o cache do electron-builder limpo.
- Exportação PDF (RF-17), importação de DOCX e do sistema antigo (RF-16), revisão de texto (RF-18): requisitos
  desejáveis, depois do M7.
- Abertos das revisões: `REVISAO_M1.md` a `REVISAO_M7.md` e `ETAPA6_VALIDACAO.md` ("Limitações conhecidas").

## Testado (E7-T04)

- `npm run verificar:tudo` depois das correções: typecheck, `vitest` 2146/2146, auditoria, externos 46/46 e build
  passaram; o Playwright deu 41/42 na rodada completa (o teste de acessibilidade da remissiva, "Numerar (n)", esperou
  30 s pelo botão, com a máquina carregada: rodada de 2,8 min contra 2,1 habituais). O mesmo teste passou 3/3 sozinho
  e a repetição do E2E completo deu **42/42**. Nada do E7-T04 toca a interface.
