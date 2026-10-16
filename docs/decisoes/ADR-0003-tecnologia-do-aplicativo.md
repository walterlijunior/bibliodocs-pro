# ADR-0003 — Tecnologia do aplicativo desktop

- **Status:** ACEITO (usuário, 2026-10-16)
- **Data:** 2026-10-15
- **Decisores:** agente `arquiteto-software` (proposta); usuário (aprovação)
- **Etapa/Marco:** Etapa 4, antes do M1
- **Requisitos e riscos relacionados:** RNF-01, RNF-02, RNF-03, RNF-05, RNF-08, RNF-12, RNF-14, RNF-15, RF-06, RF-17, RF-18; R04, R05, R09, R10, R11, R14, R18; S-1 a S-14 da auditoria

## Contexto

O sistema `tcc-uft` é JavaScript sem build: React 18.3.1, docx.js 8.x e jsPDF 2.5.1 copiados em
`vendor/`, IndexedDB e um wrapper Electron 28 opcional [VERIFICADO, `docs/relatorios/ETAPA2_AUDITORIA.md`, seção 1].
A auditoria recomendou **não evoluir o código no lugar**. A lógica de `abnt.js`, as árvores de
`templates.js` e o esqueleto de seções/campos do exportador DOCX servem de **referência** para um app novo,
com modelo semântico e motor normativo único (mesmo relatório, "Recomendações").

Restrições:
- Windows 10/11 x64 primeiro, sem administrador (RNF-01).
- 100% offline nas funções essenciais (RNF-02).
- DOCX editável que abra sem reparo no Word e no LibreOffice (RNF-05, RF-06).
- Instalador abaixo de 200 MB [META] (RNF-08).
- Runtime isolado e dependências sem vulnerabilidade Alta conhecida (RNF-14).

Ambiente do mantenedor [VERIFICADO pela sessão principal em 2026-10-15]:
- já instalados: Windows 11, Node 24.21.0, npm 11.19.0, Python 3.14.7, .NET SDK 10.0.300, git e
  LibreOffice (`C:\Program Files\LibreOffice\program\soffice.exe`, fora do PATH);
- ausentes: **Rust e cargo**.

O mantenedor não é programador profissional e trabalha com o Claude Code. Por isso a curva de
aprendizado e o número de linguagens pesam na escolha.

### Pesquisa em fonte primária (consulta em 2026-10-15)

| Item | Versão atual e data | Licença | Fonte | Status |
|---|---|---|---|---|
| Electron | 44.7.2 (2026-10-14), tag `latest`. A 45.0.0 tem estabilização prevista para 2026-10-20. Política oficial: "the latest three stable major versions are supported", com uma major a cada 8 semanas. O fim de suporte da 44 é 2027-03-02. Node embutido: 24.18.1 (na 44) | MIT | [schedule](https://releases.electronjs.org/schedule), [timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), `npm view electron` | [VERIFICADO] |
| Runtime Electron win32-x64 (zip) | 157.867.015 bytes (asset `electron-v44.7.2-win32-x64.zip`) | — | `gh api repos/electron/electron/releases/tags/v44.7.2` | [VERIFICADO] |
| Tauri | crate `tauri` 2.12.4 (2026-10-14); `@tauri-apps/cli` 2.12.3 (2026-10-14). Há uma 3.0.0-alpha.5 publicada | Apache-2.0 OR MIT | [releases](https://github.com/tauri-apps/tauri/releases), `npm view @tauri-apps/cli` | [VERIFICADO] |
| Requisitos Tauri no Windows | Microsoft C++ Build Tools ("Desktop development with C++"); Rust via `rustup` com toolchain MSVC como padrão (`rustup default stable-msvc`); WebView2, que já vem no Windows 10 1803+ e no 11; VBSCRIPT só para MSI | — | [prerequisites](https://v2.tauri.app/start/prerequisites/) | [VERIFICADO] |
| `docx` (npm) | 9.11.0 (2026-10-13). Cadência alta: 9.7.2 → 9.11.0 em 20 dias (cinco versões). Dependências: jszip, nanoid, xml, xml-js, hash.js | MIT | `npm view docx`, [releases](https://github.com/dolanmiu/docx/releases) | [VERIFICADO] |
| `docx`: recursos | **Footnotes/endnotes** reais (`FootnoteReferenceRun`, opções `footnoteProperties`); **TOC** como campo, com entradas pré-escritas a partir dos títulos; **campos** `PAGE`, `SEQ`, `PAGEREF`, `SimpleField` (com `locked` na 9.9.0); **math** (`docx/math`: frações, radicais, matrizes, `MathEquationArray` com `equationNumber`; `latexToMath` na 9.8.1). A 9.9.0 trouxe `docx/layout` (`estimatePageNumbers`), que pré-preenche os números de página do TOC, de `PAGEREF` e de `SEQ` por **estimativa** de layout; os números não determinados ficam vazios | MIT | [docs/usage](https://github.com/dolanmiu/docx/tree/master/docs/usage): `table-of-contents.md`, `math.md`, `footnotes.md`; notas das versões 9.8.0–9.11.0 | [VERIFICADO na documentação]. A saída do math como OMML (`m:oMath`) é [HIPÓTESE forte]: a documentação cita elementos `m:eqArr`, `m:limLoc`, `m:nor`. **A fidelidade real depende da PoC** |
| DocumentFormat.OpenXml (.NET) | 3.5.1 (atualizado em 2026-03-18). Cadência irregular, de 3 a 10 meses | MIT | [NuGet](https://www.nuget.org/packages/DocumentFormat.OpenXml), [releases](https://github.com/dotnet/Open-XML-SDK/releases) | [VERIFICADO] |
| .NET | .NET 10 LTS (2025-11-11; patch 10.0.12 em 2026-09-08; suporte até 2028-11-14) | MIT | [política](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core) | [VERIFICADO] |
| WPF / Avalonia | WPF em `dotnet/wpf` (MIT, ativo em 2026-10-15); Avalonia 12.1.4 (2026-10-09, núcleo MIT; o XPF é comercial) | MIT | `gh api repos/dotnet/wpf`, [NuGet Avalonia](https://www.nuget.org/packages/Avalonia), [GitHub](https://github.com/AvaloniaUI/Avalonia) | [VERIFICADO] |
| Vite | 8.3.4 (2026-10-08); as séries 8, 7 e 6 têm suporte. Node `^20.19.0 \|\| >=22.12.0` | MIT | [releases](https://vite.dev/releases), `npm view vite` | [VERIFICADO] |
| electron-vite | 6.0.0 (2026-10-14; peer `vite ^6 \|\| ^7 \|\| ^8`). Builds de main, preload e renderer numa só configuração | MIT | [guia](https://electron-vite.org/guide/), `npm view electron-vite` | [VERIFICADO]. A 6.0.0 foi lançada há 1 dia: o risco de imaturidade é [HIPÓTESE] |
| React | 19.3.1 (2026-10-14). A linha 18 não tem tag ativa no npm; só `backport` 19.1.10 | MIT | `npm view react dist-tags` | [VERIFICADO] |
| TypeScript | 7.0.2 (2026-07-08). É o **compilador nativo** (porta em Go); "it does not ship with an API". Ferramentas que usam a API (typescript-eslint) ficam no 6.0 via `@typescript/typescript6` (6.0.2) | Apache-2.0 | [anúncio TS 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), `npm view typescript` | [VERIFICADO] |
| electron-builder | 26.15.3 (tag `latest`). NSIS: `oneClick` padrão `true`, `perMachine` padrão `false` (instalação **por usuário**, sem administrador) | MIT | [NsisOptions](https://www.electron.build/app-builder-lib.interface.nsisoptions), `npm view electron-builder` | [VERIFICADO] |
| Electron Forge | 8.0.1 (2026-09-29). Makers oficiais para Windows: Squirrel.Windows (recomendado pela Forge), WiX MSI e MSIX; **não há maker NSIS oficial** | MIT | [makers](https://www.electronforge.io/config/makers/squirrel.windows), [wix-msi](https://www.electronforge.io/config/makers/wix-msi) | [VERIFICADO] |
| Playwright | 1.64.1 (2026-10-14). Suporte a Electron **experimental**, Electron v21+ | Apache-2.0 | [class-electron](https://playwright.dev/docs/api/class-electron) | [VERIFICADO] |
| Segurança do Electron | Checklist oficial de 20 itens: isolamento de contexto, sandbox, CSP, limitar navegação/janelas, `openExternal`, validar o `sender` do IPC, protocolo próprio em vez de `file://`, fuses | — | [security](https://www.electronjs.org/docs/latest/tutorial/security) | [VERIFICADO] |

## Alternativas consideradas

- **A.** Electron 44/45 + electron-vite (Vite 8) + TypeScript + React 19 + `docx` 9.x. Exportação no Node
  (processo utilitário). Empacotamento com electron-builder NSIS por usuário.
- **B.** Tauri 2.12 + o mesmo front-end (React/TS/Vite). Exportação em JS (`docx` dentro do WebView2),
  com o shell em Rust para arquivos e LibreOffice.
- **C.** .NET 10 nativo (WPF, ou Avalonia 12 para multiplataforma) + DocumentFormat.OpenXml 3.5.1.
  Reescrita total em C#.
- **D.** Aplicação web local no navegador (PWA estático, sem servidor), versão modernizada do formato atual:
  Vite + React + `docx`, persistência pela File System Access API.

Notas de 1 (pior) a 5 (melhor). Pontos = nota × peso / 5. Total máximo: 100.

| Critério (peso) | A. Electron + TS | B. Tauri 2 | C. .NET + Open XML SDK | D. Web local (PWA) |
|---|---|---|---|---|
| Fidelidade DOCX (18) | 4 — `docx` 9.11 cobre notas reais, TOC/SEQ/PAGE, seções, OMML; resultado da PoC pendente | 4 — mesma biblioteca | 5 — o SDK cobre todo o esquema OOXML e tem validador; tudo é escrito à mão em baixo nível | 4 — mesma biblioteca |
| Reaproveitamento (14) | 5 — a lógica de `abnt.js`/`templates.js` porta para TS quase linha a linha; `docx` é a mesma família do exportador antigo | 4 — front-end igual; arquivos e LibreOffice em Rust | 1 — reescrita em C#; só as ideias são aproveitadas | 4 — front-end igual; persistência mais limitada |
| Curva de aprendizado com o Claude Code (12) | 4 — uma linguagem (TS) em todo o app | 2 — duas linguagens; erros de compilação Rust são mais difíceis para quem não programa | 3 — C#/XAML; uma linguagem, porém nova para o projeto | 4 — uma linguagem |
| Segurança do runtime (10) | 3 — superfície grande (Chromium + Node); mitigável pelo checklist, fuses e atualização a cada ~8 semanas | 4 — modelo de capacidades; superfície menor | 4 — sem conteúdo web; XSS deixa de existir como classe | 3 — sandbox do navegador forte; dados presos à origem (S-6) |
| Integração com o sistema: arquivos, salvamento atômico, LibreOffice (8) | 5 | 5 | 5 | 1 — não executa `soffice`; salvamento atômico não garantido; RF-17 inviável |
| Testabilidade (9) | 4 — Vitest + Playwright (Electron experimental) | 3 — E2E com `tauri-driver`/WebDriver, menos maduro no Windows [HIPÓTESE] | 3 — xUnit forte; UI WPF exige FlaUI/WinAppDriver [HIPÓTESE] | 5 — Playwright no navegador, estável |
| Manutenção e comunidade (8) | 4 — muito ativo (123 mil estrelas); exige atualizar a major a cada ~6 meses | 4 — ativo (112 mil); 3.0 em alfa indica migração futura | 5 — LTS de 3 anos; SDK da Microsoft | 3 — APIs de arquivo só no Chromium |
| Ferramentas novas a instalar (7) | 5 — nada além do Node já instalado | 1 — Rust (rustup) + C++ Build Tools: instalação **global**, vários GB [HIPÓTESE de tamanho] | 4 — .NET SDK já instalado; só pacotes NuGet locais | 5 — nada |
| Tamanho do instalador (6) | 2 — runtime zipado tem 158 MB [VERIFICADO]; instalador NSIS estimado em 90–130 MB [HIPÓTESE], dentro da meta de 200 MB | 5 — 3–15 MB [HIPÓTESE]; usa o WebView2 do sistema | 3 — autocontido 60–150 MB [HIPÓTESE], ou pequeno se exigir o .NET Desktop Runtime instalado | 5 — sem instalador |
| Offline (4) | 5 | 5 | 5 | 4 — depende de service worker e do navegador |
| Licenças (4) | 5 — MIT/Apache | 5 | 5 | 5 |
| **Total (100)** | **83,0** | **73,6** | **74,6** | **76,8** |

Contas (soma de nota × peso, dividida por 5):
- A = (72+70+48+30+40+36+32+35+12+20+20)/5 = **83,0**
- B = (72+56+24+40+40+27+32+7+30+20+20)/5 = **73,6**
- C = (90+14+36+40+40+27+40+28+18+20+20)/5 = **74,6**
- D = (72+56+48+30+8+45+24+35+30+16+20)/5 = **76,8**

**Sensibilidade.**
- Dobrar o peso da fidelidade DOCX (36, renormalizando os demais) não muda a ordem. A vantagem de C
  nesse critério vale 1 ponto de nota; a desvantagem em reaproveitamento vale 4.
- Dobrar o peso do instalador (12) aproxima B de A, mas A continua à frente pelo custo de instalar Rust.
- D só empataria se a integração com o sistema deixasse de importar. Não é o caso: o PDF via LibreOffice
  foi decidido pelo usuário e RNF-04 exige salvamento atômico.

## Decisão

**Alternativa A (PROPOSTA).**

A pilha:
- Electron 44.x (44.7.2 ou correção posterior), com versão fixada exatamente e passagem para a 45 depois
  de ela amadurecer. Regra permanente: sempre uma das 3 majors com suporte.
- electron-vite + Vite 8, TypeScript 7 (`tsc --noEmit` para checagem de tipos), React 19.
- `docx` 9.x, versão exata fixada, para a exportação DOCX.
- electron-builder (NSIS, `oneClick`, `perMachine: false`) para o instalador por usuário.

Motivos:
1. Maior reaproveitamento da lógica auditada, numa única linguagem.
2. Nenhuma instalação global nova para o usuário.
3. Integração completa com o sistema de arquivos e com o LibreOffice.
4. Biblioteca DOCX ativa e com notas reais, campos, TOC e OMML.
5. Instalador estimado dentro da meta de 200 MB.

**Desempate.** C seria a escolha se a PoC mostrar que o `docx` não gera algo essencial e que não dá para
contornar com XML bruto (ver "Critério de reversão"). Nesse caso a reversão é **parcial**:
- Electron continua na interface;
- a exportação passa a um executável .NET auxiliar (Open XML SDK), já possível porque o .NET SDK está instalado.

### Itens decididos pelo usuário (2026-10-15, comunicados pela sessão principal)

| Item | Decisão do usuário | Efeito nesta arquitetura |
|---|---|---|
| (a) Revisão gramatical on-line (LanguageTool), RF-18 | **Mantida como recurso opcional**, desligada por padrão, com aviso de privacidade e consentimento antes de enviar texto. Entra **após o M7** | Porta `RevisorTexto` no domínio de aplicação; adaptador `LanguageTool` **só no processo principal**. O renderer continua com CSP `connect-src 'self'` e sem rede. O consentimento é gravado nas preferências do app (não no projeto), com padrão "Não" (tela de boas-vindas, `docs/REFERENCIA_DE_LAYOUT.md`). O IPC `revisao.verificar` recusa a chamada sem consentimento. O teste de privacidade (ADR-0006) permite rede apenas nesse adaptador. Nada disso entra no M1–M7 |
| (b) PDF, RF-17 | **MVP entrega só DOCX.** Após o M7, o PDF é gerado **convertendo o DOCX pelo LibreOffice instalado na máquina**. Se o LibreOffice estiver ausente, o botão fica desabilitado com uma explicação. **Sem motor PDF próprio** | jsPDF e html2canvas saem do projeto (resolve S-3 e S-13). Módulo `conversao-pdf` no processo principal: localiza `soffice.exe` (configuração do usuário → `Program Files` → PATH), executa com `execFile` sem shell, perfil de usuário LibreOffice isolado (`-env:UserInstallation`), tempo limite e pasta temporária. O mesmo localizador serve aos testes de verificação via PDF (ADR-0006), que já podem rodar no M3 |

Alternativas descartadas para (b), para registro:
- jsPDF próprio: um terceiro motor de layout divergente (D1 da auditoria).
- Imprimir pelo Chromium (`printToPDF`) a partir da pré-visualização HTML: a paginação não é a do Word.

### Alinhamento com a revisão de segurança (`revisor-seguranca`, Etapa 4)

A revisão de segurança chegou à mesma ordem desta análise:
1. **Electron 44.x**, a partir da 44.7.2 (publicada no npm em 2026-10-14T01:32Z; em 2026-10-13 no fuso das Américas). Política
   do projeto: estar **sempre numa das 3 majors com suporte**. A 42 perde o suporte em 2026-10-20, quando sai a 45.
2. **Tauri 2** como segunda opção, no mínimo 2.12.4, por causa dos avisos GHSA-w28w-mhc8-qvjv e GHSA-7gmj-67g7-phm9
   (identificadores informados pelo revisor; esta análise não os conferiu).
3. **.NET 10 LTS**, se a alternativa C for escolhida.

Ajuste da decisão: o M1 começa na **44.x** e não espera a 45.0.0. A atualização para a 45 fica para o fim
do M1 ou o início do M2, depois de ela ter algumas versões de correção [recomendação].

### Endurecimento obrigatório

O app só pode ser distribuído com o checklist **C-1 a C-22** cumprido. O checklist foi gravado pela sessão
principal no relatório de revisão de segurança da Etapa 4 (`docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md`) e
não é copiado aqui. O checklist prevalece sobre qualquer resumo neste ADR. Na arquitetura (ADR-0005), ele se traduz em:
- renderer com `sandbox`, `contextIsolation` e sem `nodeIntegration`;
- protocolo próprio `app://` em vez de `file://`;
- CSP estrita sem origens remotas;
- navegação e novas janelas bloqueadas;
- `openExternal` só para `https:`, com confirmação;
- IPC com `sender` validado e argumentos validados por esquema;
- fuses (`RunAsNode`, `NodeOptions` e `NodeCliInspect` desligados; integridade do ASAR e `OnlyLoadAppFromAsar` ligados);
- DevTools fora do build de produção;
- dependências fixadas, com `npm audit` no `verificar`.

As tarefas M1-T02 e M1-T14 do plano verificam esses itens.

**Atualização e assinatura.**
- **Sem atualização automática** enquanto não houver assinatura de código: RNF-14 exige atualizações assinadas.
- A assinatura é **decisão de custo pendente do usuário**:
  - (i) certificado OV, com custo anual;
  - (ii) MSIX pela Microsoft Store, com conta de desenvolvedor e outro empacotamento (o electron-builder tem alvo `appx` [HIPÓTESE, conferir]);
  - (iii) sem assinatura, com alerta do SmartScreen e atualização manual baixando o novo instalador.
- Recomendação: (iii) até a Etapa 7; decidir entre (i) e (ii) antes de distribuir para outras pessoas.

## Resultado da PoC DOCX

PoC executada pelo `especialista-documento` em 2026-10-15/16, em `analise/poc-docx/` (descartável; ignorada
pelo git): `docx` **9.11.0** instalado localmente (0 vulnerabilidades no `npm install`), Node 24.21.0,
LibreOffice 26.8.1.1. Word não disponível. Evidência completa em `analise/poc-docx/RESULTADO.md`.

| # | Item | Resultado |
|---|---|---|
| 1 | Estilos nomeados próprios; nada de formatação por trecho (E-5); títulos 1–5 distintos (E-6) | OK — 47 estilos; `Heading1..5` em preto |
| 2 | Seções com paginação oculta nos pré-textuais, reinício e PAGE no canto superior direito | OK — cada pré-textual em folha própria (corrige E-2); Introdução = "8" no PDF |
| 3 | Sumário (TOC) e lista de tabelas (TOC \c) pré-preenchidos | PARCIAL — funciona com contorno: o motor entrega entradas prontas (indicativo + página estimada por `docx/layout` em 2 passadas) |
| 4 | Nota de rodapé real | OK — `footnotes.xml` nativo |
| 5 | Legenda com campo SEQ, tabela IBGE, cabeçalho repetido, "Fonte:" | OK com `SimpleField`; `SequentialIdentifier` sai sem número no LibreOffice (não usar) |
| 6 | Citação longa (2268 twips, corpo 10, simples) e recuo 709 twips (corrige E-3) | OK |
| 7 | Listas com numeração definida (E-7) | OK |
| 8 | Equação OMML | OK — `m:oMath` com fração e radical, número "(1)" à direita |
| 9 | Seção em paisagem | OK |
| 10 | Imagem PNG com texto alternativo | OK |

**Verificação reexecutada pela sessão principal (2026-10-16):**
- `python -I verificar.py poc_final.docx` e `... carga_150.docx` → `60 OK, 0 falhas; estilos: 47` (ambos).
- `python -I comparar_sumario.py pdf/poc_final.pdf` → 11/11 páginas do sumário iguais ao PDF;
  `pdf/carga_150.pdf` → 52/52.

**Medições (documento sintético de 149 páginas):** geração sem estimativa de páginas 68–75 ms; com estimativa
~4,1 s (deve rodar fora da interface ou ser opcional); conversão LibreOffice → PDF 4,3 s; DOCX de 24 KB;
`node_modules` 25 MB (≈ 5,6 MB carregados).

**Contornos que dependem da versão (fixar `docx` em 9.11.x exata):** sumário com indicativo entregue pelo motor;
switch `\u` com nível de tópico 0 nos estilos pós-textuais (defeito da 9.11.0 com `\t`); estilo `IndexLink`
definido pelo app; legendas só com `SimpleField`.

**Pendências:** abrir `analise/poc-docx/poc_final.docx` no Microsoft Word (verificação manual do usuário — filete de
nota e formato de numeração de títulos incomuns); "(continua)/(conclusão)" em tabelas que quebram página
(RN-293, RN-295) exige que o motor divida a tabela após a paginação; `latexToMath` não testado; margens da
seção em paisagem sem RN (decisão editorial pendente); distância do cabeçalho segue RN-072 `PENDENTE-FONTE`.

**Conclusão:** os 9 itens exigidos foram confirmados (o item "abertura sem reparo" só no LibreOffice). A decisão
por `docx` + Electron se mantém; o plano B (.NET Open XML SDK) não é necessário.

## Consequências

- **Positivas:**
  - Uma linguagem (TS) do domínio à interface.
  - Lógica de `abnt.js` portada com testes.
  - Exportação DOCX e testes em Node.
  - LibreOffice usado para PDF (após o M7) e para verificação automática.
  - O runtime atual fecha S-4, S-9 e S-10 se o checklist for seguido.
- **Negativas / custos:**
  - Instalador de cerca de 100 MB [HIPÓTESE, medir na tarefa M1-T14].
  - Obrigação de atualizar o Electron a cada ~6 meses para continuar com suporte (R20).
  - TypeScript 7 sem API: typescript-eslint, se adotado, exige o alias do TS 6 (R29).
  - E2E do Electron no Playwright é experimental (R30).
  - Instalador sem assinatura de código mostra alerta do SmartScreen (R21; custo de certificado é decisão do usuário).
- **O que muda:**
  - `app/` recebe o esqueleto (ADR-0005), com `npm install` local, informado ao usuário antes.
  - `docs/ARQUITETURA_PRELIMINAR.md` vira "DEFINIDA".
  - Matriz de testes ganha os casos de ADR-0006.
  - jsPDF, html2canvas, htm e o `vendor/` antigo não são reaproveitados.

## Critério de reversão

1. **PoC/M3:** se o `docx` não produzir corretamente algum dos itens 1–7 da PoC, e nem a injeção de XML
   bruto nem um pós-processamento do pacote (JSZip) resolverem com esforço pequeno, migrar só a
   exportação para um auxiliar .NET com Open XML SDK. A interface e o domínio ficam em TS; o contrato
   `DocumentoFormatado` (ADR-0005) é serializado em JSON para o auxiliar.
2. **Instalador:** se o instalador medido passar de 200 MB, ou o consumo de memória medido passar de RNF-07
   (800 MB com 150 páginas), reavaliar B. A interface e o domínio são reaproveitáveis, porque não dependem do Electron.
3. **Segurança:** se o Electron deixar de ter versão com suporte compatível com o código, ou surgir
   vulnerabilidade crítica sem correção, reavaliar B.
4. **Biblioteca `docx`:** se o projeto ficar sem versão por mais de 12 meses, ou introduzir regressão
   que a regressão documental (ADR-0006) não consiga contornar fixando a versão, reavaliar a exportação.

## Verificação

- `cd app && npm run dev` abre a janela (M1-T01).
- `npm run verificar` passa (ADR-0006).
- `npm ls electron docx` mostra as versões fixadas.
- `npm audit --omit=dev` sem Alta/Crítica.
- `npm run dist` gera o instalador NSIS por usuário e o tamanho é registrado (M1-T14).
- Teste de fumaça das webPreferences e da CSP (M1-T02).


## Decisões do usuário (2026-10-16)
- **Tecnologia aceita:** Electron 44.x + TypeScript + React 19 + `docx` 9.11.x (versão exata fixada).
- **Assinatura de código:** decidir na Etapa 7; até lá, sem assinatura e sem atualização automática (C-17).
- **Paleta da interface:** A — Cerrado claro (tokens em `analise/poc-ui/tokens.css`, a migrar para `app/` no M1-T10).
- Anteriores (2026-10-15): LanguageTool opcional, desligado por padrão, com consentimento, após o M7;
  MVP só DOCX, PDF via LibreOffice após o M7.
