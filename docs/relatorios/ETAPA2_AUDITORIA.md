# Relatório técnico — Etapa 2: Auditoria do sistema existente (`tcc-uft`)

- **Data:** 2026-10-15
- **Autor:** sessão principal, com os agentes `arquiteto-software`, `especialista-documento`,
  `especialista-referencias` e `revisor-seguranca` (em paralelo, somente leitura)
- **Escopo:** o código extraído em `analise/sistema_original_extraido/tcc-uft/`, a partir de
  `materiais/sistema_original/tcc-uft-sistema_10.zip`. Ficaram de fora a interface no navegador (não houve
  clique na UI), a exportação PDF/ODT executada, o build do Electron e a medição de desempenho.
  Nenhum arquivo original foi alterado.

## Resumo executivo

O `tcc-uft` é uma aplicação React 18.3.1 sem build. Os scripts são carregados direto pelo `index.html`, compartilham
o namespace global `window.TCC.*` e persistem os dados no IndexedDB. A exportação **DOCX foi executada
com sucesso** fora do navegador, por um harness Node, e o arquivo gerado abre no LibreOffice. Já essa
primeira execução revelou defeitos visíveis:

- as citações inseridas pelo botão ❝ Citação **somem do DOCX**;
- os elementos pré-textuais saem **na mesma página**;
- o recuo é de 1,27 cm (e não 1,25 cm);
- as referências perdem o negrito;
- os títulos herdam o estilo azul padrão do docx.js.

Há ainda três exportadores paralelos (DOCX, PDF e ODT), com regras normativas duplicadas e fixas no
código, sem ID `RN`. Os riscos de segurança mais altos são:

- XSS nas referências, explorável por um backup JSON;
- servidor local exposto à rede;
- Electron 28 sem suporte;
- jsPDF 2.5.1 com avisos de segurança.

**Recomendação:** não evoluir o código no lugar. A lógica de `abnt.js`, as árvores de `templates.js`, o
esqueleto de seções do DOCX (campos TOC/SEQ, seções, paisagem) e a biblioteca docx.js servem de
**referência e ponto de partida** para um app novo, com modelo semântico e motor normativo único.

## Método

- Leitura integral ou dirigida (grep/sed) de `index.html`, `src/*.js`, `electron/*`, `INICIAR.bat`,
  `iniciar.sh`, `README.md` e dos cabeçalhos de `vendor/*`. Quatro agentes especialistas trabalharam em paralelo.
- **Execução:** `analise/harness/gerar_docx_linha_base.js` carrega `vendor/docx.js`, `src/templates.js`,
  `src/abnt.js` e `src/exports.js` **sem modificação** num contexto Node 24.21.0, com stubs mínimos de
  `document`/`URL`. O stub `rasterizarVisuais` devolve `{}`, porque os gráficos dependem de canvas. O harness monta um TCC fictício
  com 3 referências, 3 citações `[[cite:]]`, 1 nota, 1 tabela e 1 sigla, e chama `exportarDOCX`.
  - `node analise/harness/gerar_docx_linha_base.js analise/sistema_original_extraido/tcc-uft analise/amostras/linha_base_tcc.docx`
    → `OK … 10570 bytes`.
  - `soffice --headless --convert-to pdf` → `linha_base_tcc.pdf`, com 10 páginas, aberto sem erro.
  - XML inspecionado com Python (`zipfile`) e PDF com `pdftotext`.
  - Funções de `abnt.js` executadas diretamente em Node para confirmar os achados de referências.
- **Limitações:**
  - A interface React não foi operada.
  - PDF, ODT, gráficos rasterizados e listas com marcadores não foram executados.
  - O DOCX não foi aberto no Microsoft Word; só no LibreOffice.

## Resultados

### 1. Mapa de módulos [VERIFICADO]

| Ordem (`index.html`) | Arquivo | Linhas | Expõe | Papel |
|---|---|---|---|---|
| 9–14 | `vendor/` react, react-dom, htm, docx, jspdf, html2canvas | — | globais | bibliotecas |
| 292 | `src/storage.js` | 102 | `TCC.storage` (salvar, carregar, listar, remover, exportarBackup, importarBackup) | IndexedDB `tcc-uft-db` v1, store `projetos` (storage.js:9–27) |
| 294 | `src/templates.js` | 242 | `TCC.templates` (3 modelos + `criarProjeto`) | estruturas TCC, Consultoria e Extensão (templates.js:32–191) |
| 296 | `src/abnt.js` | 567 | `TCC.abnt` (20 funções, abnt.js:545) | numeração, citações, referências, marcadores, listas, validação |
| 298 | `src/state.js` | 191 | `TCC.state` (useProjeto, uid, findInTree) | reducer e autosave de 800 ms (state.js:84–184) |
| 300 | `src/visual-editor.js` | 1033 | `TCC.visual` | 9 editores de visuais, SVG→PNG por canvas (958–1004) |
| 302 | `src/exports.js` | 1508 | `TCC.exports` (DOCX, PDF, ODT) | três exportadores paralelos |
| 304 | `src/components.js` | 2200 | `TCC.components` (14 painéis) | interface; mistura regras normativas |
| 306 | `src/app.js` | 268 | — | montagem da interface |
| — | `electron/main.js`, `package.json` | 109 / 54 | — | wrapper desktop |

Fluxo de dados [VERIFICADO]:

1. A interface despacha uma ação ao reducer (state.js:84–166).
2. O reducer chama `abnt.reordenarNumeracao` a cada mudança de seção (state.js:106–129).
3. O estado é gravado no IndexedDB 800 ms depois (state.js:173–184); uma falha só aparece no console.
4. Os exportadores leem o estado bruto e aplicam a formatação por conta própria.

O conteúdo das seções é **texto puro com marcadores** `[[cite:refId:forma:pagina]]`, `[[visual:id]]`,
`[[nota:id]]` e `[[ref:secaoId]]` (abnt.js:300, 337–364). Não existe modelo semântico de blocos.

Versões das bibliotecas:

| Biblioteca | Versão | Evidência |
|---|---|---|
| React / ReactDOM | 18.3.1 | `version="18.3.1"` nos arquivos [VERIFICADO] |
| jsPDF | 2.5.1 (build 2022-01-28) | jspdf.js:4 [VERIFICADO] |
| html2canvas | 1.4.1 | cabeçalho [VERIFICADO]; **carregado, mas não usado** em `src/` (só citado em comentário, visual-editor.js:752) [VERIFICADO] |
| JSZip (dentro do docx.js) | 3.10.1 | docx.js:16181 [VERIFICADO] |
| docx.js | 8.x | sem string de versão; `ImageRun` sem `type` obrigatório e grafia `compatabilityModeVersion` [HIPÓTESE] |
| htm | sem cabeçalho | licença não identificada [HIPÓTESE: Apache-2.0] |

### 2. Funcionalidades

Legenda: `FUNCIONA` = executado nesta etapa e com resultado correto.

| Funcionalidade (README) | Status | Evidência |
|---|---|---|
| Exportação DOCX (gera arquivo válido) | **PARCIAL** | Executada; abre no LibreOffice; defeitos E-1 a E-8 abaixo [VERIFICADO] |
| Margens 3-2-2-3 cm, A4 | FUNCIONA (DOCX) | `pgMar top=1701 left=1701 right=1134 bottom=1134`, `pgSz 11906×16838` no XML [VERIFICADO]. Valores fixos: `config.margem*` é ignorado (exports.js:645–648) |
| Fonte Times 12, entrelinha 1,5 | FUNCIONA (DOCX) | exports.js:27–29, 455–460; `config.espacamento` é ignorado [VERIFICADO] |
| Recuo de parágrafo 1,25 cm | **QUEBRADA** | `w:firstLine="720"` = 1,27 cm no XML (exports.js:459) [VERIFICADO] |
| Numeração progressiva (1, 1.1, 1.1.1) | FUNCIONA (DOCX) | "1.3.1 Objetivo geral" no PDF; número gravado como texto fixo (exports.js:480) [VERIFICADO] |
| Paginação contada desde a folha de rosto e exibida a partir da Introdução | FUNCIONA (DOCX/LibreOffice) | 3 `sectPr`; `pgNumType start=1` na 2.ª seção; rodapé só na 3.ª; Introdução = "3" [VERIFICADO] |
| Número de página no canto superior direito (README) | **QUEBRADA** | o modelo grava `posicaoPaginacao: 'inferior'` (templates.js:228); a amostra saiu com o número no **rodapé** [VERIFICADO]; o fallback do exportador é `'superior'` (exports.js:651) |
| Capa e folha de rosto | PARCIAL | geradas; no LibreOffice a capa **transbordou para 2 páginas** (cidade e ano na p. 2) [VERIFICADO no PDF; HIPÓTESE quanto ao Word] |
| Resumo, abstract, listas e sumário em páginas próprias | **QUEBRADA** | os quatro na **mesma página** (p. 4 do PDF); sem quebra entre pré-textuais (exports.js:693–701) [VERIFICADO] |
| Dedicatória, agradecimentos, epígrafe no DOCX | **QUEBRADA** | 0 ocorrências em exports.js [VERIFICADO por grep] |
| Sumário automático | PARCIAL | DOCX: campo `TOC \h \o "1-4"` + `updateFields` [VERIFICADO], vazio até o Word atualizar (LibreOffice mostrou vazio) [VERIFICADO]. PDF: páginas estimadas a 300 palavras/página (abnt.js:237–253) [VERIFICADO no código] |
| Listas de ilustrações | PARCIAL | campo `TOC \c "Tabela" \h` [VERIFICADO]; vazio no LibreOffice sem atualização |
| Legendas com numeração automática | FUNCIONA (DOCX) | campo `SEQ Tabela \* ARABIC`; o LibreOffice exibiu "Tabela 1 — Dados fictícios" [VERIFICADO] |
| Tabela nativa editável | PARCIAL | gerada; bordas em toda célula, cinza 666666 (exports.js:274–294): não segue o padrão IBGE [VERIFICADO] |
| Notas de rodapé | PARCIAL | não são notas reais do Word: parágrafo com filete no fim da seção (exports.js:531–553) [VERIFICADO] |
| Citação ligada à referência (❝ Citação) | **QUEBRADA no DOCX** | E-1 [VERIFICADO]; PDF e ODT tratam o marcador (exports.js:1174, 1387) [VERIFICADO no código, NÃO executado] |
| Citação direta longa (4 cm, fonte 10) | **QUEBRADA** | `formatarCitacao` (abnt.js:79–99) é código morto; nenhum exportador gera citação longa [VERIFICADO por grep] |
| Referências formatadas e ordenadas | PARCIAL | ordem alfabética correta na amostra [VERIFICADO]; negrito removido (exports.js:572); tipo `capitulo` sai com "undefined" [VERIFICADO por execução] |
| Lista de siglas | FUNCIONA (DOCX) | "UFT ⇥ Universidade Federal do Tocantins" após as listas [VERIFICADO] |
| Painel Citações e Controle (detecção heurística) | NÃO VERIFICADA (UI) | algoritmo analisado (abnt.js:458–528); riscos de falso positivo e negativo [HIPÓTESE] |
| Revisão gramatical LanguageTool | NÃO VERIFICADA | POST a api.languagetool.org só ao clicar (components.js:414–418, 715) [VERIFICADO no código] |
| Editor visual (9 tipos), gráficos rasterizados | NÃO VERIFICADA | depende de canvas; não executado |
| Páginas em paisagem | NÃO VERIFICADA | seção LANDSCAPE própria (exports.js:749–764) [VERIFICADO no código] |
| Exportação PDF | NÃO VERIFICADA | motor paralelo com jsPDF (exports.js:815–1254) |
| Exportação ODT (.fodt) | NÃO VERIFICADA | sem folha de rosto, sumário, listas, imagens nem paginação (exports.js:1259–1490) [VERIFICADO no código] |
| Backup / restauração JSON | NÃO VERIFICADA | sem validação de esquema; sobrescreve sem confirmar (storage.js:77–99) [VERIFICADO no código] |
| Instalador Electron | NÃO VERIFICADA | O-2 e O-3 indicam falha provável [HIPÓTESE] |
| Persistência IndexedDB e autosave | NÃO VERIFICADA (UI) | — |

Defeitos de exportação DOCX observados:

| ID | Defeito | Evidência |
|---|---|---|
| E-1 | Citações `[[cite:…]]` desaparecem do DOCX: "Texto … com citação e narrativa . Órgão: ." | O laço de `emitirSecao` não trata `cite` (exports.js:508–525) [VERIFICADO na amostra] |
| E-2 | Pré-textuais sem quebra de página | PDF p. 4 [VERIFICADO] |
| E-3 | Recuo de 1,27 cm | `firstLine=720` [VERIFICADO] |
| E-4 | Referências sem negrito; espaço após 170 twips (~8,5 pt), embora o comentário diga 12 pt | exports.js:572, 577 [VERIFICADO] |
| E-5 | Estilo `Heading1` com cor 2E74B5 e 16 pt (padrão do docx.js); a formatação é forçada em cada trecho de texto | styles.xml da amostra [VERIFICADO] |
| E-6 | Títulos de nível 5+ caem em Heading4; níveis 3 e 4 sem diferenciação | exports.js:468–495 [VERIFICADO no código] |
| E-7 | Listas usam `numbering.reference:'default-num'`, que não é definida | exports.js:450 [VERIFICADO no código]; a amostra não tinha listas; aviso de reparo no Word [HIPÓTESE] |
| E-8 | Seções pós-textuais reconhecidas pelo título (regex `REFERÊNCIAS\|APÊNDICE\|ANEXO`) | exports.js:466 [VERIFICADO no código] |

### 3. Observações preliminares do inventário

| # | Resultado | Evidência |
|---|---|---|
| O-1 | **CONFIRMADA.** O cabeçalho de abnt.js:7 cita 10520:2002; o código, o README (92, 96, 244) e a UI (components.js:1187) seguem 2023: pessoa física em Title Case, instituição em CAIXA ALTA (abnt.js:51–57) | [VERIFICADO; saída "Pereira et al. (2021, p. 12)" por execução] |
| O-2 | **CONFIRMADA.** `icon.png` exigido em main.js:28 e package.json:35, 39, 44; `assets/` só tem `uft-logo.svg` | [VERIFICADO] |
| O-3 | **CONFIRMADA.** `build.files` (package.json:26–32) não inclui `../vendor/**`. Efeito: o app empacotado não carregaria React e docx [HIPÓTESE forte]; os caminhos `../` também são problemáticos no electron-builder [HIPÓTESE] | [VERIFICADO] |
| O-4 | **CONFIRMADA.** Electron `^28.0.0` e electron-builder `^24.9.1` (package.json:16–17). Electron 28 sem suporte desde 2024-06-10 (calendário oficial consultado pelo revisor em 2026-10-15) | [VERIFICADO] |
| O-5 | **CONFIRMADA EM PARTE.** O envio só ocorre ao clicar; o aviso fala de internet, não de privacidade; não há como desligar | components.js:414–418, 715; README:122 [VERIFICADO] |
| O-6 | **CONFIRMADA.** `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true` (main.js:31–35). Há outras lacunas (ver S-9) | [VERIFICADO] |
| O-7 | **CONFIRMADA.** Não há testes, build, linter nem `package.json` na raiz | [VERIFICADO] |
| O-8 | **CONFIRMADA.** IndexedDB preso à origem `localhost:8765`; o INICIAR.bat abre `index.html` direto quando falta Python (linha 40), o que muda a origem | storage.js:9; INICIAR.bat:40 [VERIFICADO] |

### 4. Regras normativas embutidas (candidatas para a Etapa 3, **não são verdade normativa**)

| # | Regra no código | Local |
|---|---|---|
| CA-01 | A4; margens superior e esquerda 3 cm, inferior e direita 2 cm (fixas); em paisagem: 2/2/2 e esquerda 3 | exports.js:645–648 |
| CA-02 | Fonte Times New Roman 12; elementos menores em 10 | exports.js:27–29; templates.js:216–217 |
| CA-03 | Entrelinha 1,5; texto justificado | exports.js:455–460 |
| CA-04 | Recuo de primeira linha: 1,25 cm declarado, 1,27 cm gerado | templates.js:225; exports.js:459; components.js:555 |
| CA-05 | Contagem de páginas desde a folha de rosto; número exibido a partir da 1.ª seção textual, alinhado à direita, fonte 10, cabeçalho ou rodapé | exports.js:651–712 |
| CA-06 | Título de nível 1: caixa alta, negrito, centralizado, em nova página; nível 2: negrito | exports.js:468–495 |
| CA-07 | Pós-textuais (Referências, Apêndice, Anexo) sem número de seção | exports.js:466 |
| CA-08 | Apêndice/Anexo: "APÊNDICE A – TÍTULO" (UI de A a J; exportação de A a Z) | components.js:1712, 1721 |
| CA-09 | Legenda acima do elemento: "Rótulo n — Título", centralizada, fonte 10 | exports.js:311–321 |
| CA-10 | Fonte abaixo do elemento: "Fonte: …", centralizada, fonte 10; padrão "Elaborado pelos autores." | exports.js:356–360 |
| CA-11 | Tipo de visual → rótulo Figura/Quadro/Tabela/Gráfico | components.js:944 |
| CA-12 | Tabela com bordas em todas as células | exports.js:274–294 |
| CA-13 | Resumo e abstract com 150 a 500 palavras (cita NBR 6028:2003) | abnt.js:270–272; components.js:326, 345 |
| CA-14 | Lista de siglas em ordem alfabética, após as listas de ilustrações e antes do sumário | README; exports.js:255 |
| CA-15 | Natureza do trabalho com recuo de 8 cm (preview) | components.js:1687 |
| CA-16 | Sumário com níveis 1–4, incluindo pós-textuais | exports.js:217–227 |
| CA-17 | Referências: entrelinha simples, alinhamento à esquerda, separadas por espaço; título "REFERÊNCIAS" centralizado | exports.js:563–578 |
| CA-18 | Referências: 21 padrões de autoria e formatação por tipo (livro, artigo, evento, site, TCC/dissertação/tese, capítulo, lei) | abnt.js:135–231; detalhados no relato do `especialista-referencias` |
| CA-19 | Chamada: pessoa física em Title Case, instituição em CAIXA ALTA; 2 autores com "e"; 3 ou mais com "et al." | abnt.js:51–75 |
| CA-20 | Chamada parentética `(Autor, ano, p. X)` e narrativa `Autor (ano, p. X)`; sem data, "s.d." | abnt.js:427–444 |
| CA-21 | Apud `(A, ano apud B, ano)`, com a página descartada | abnt.js:89–92 |
| CA-22 | Citação longa: 4 cm, fonte 10, sem aspas (só em comentário) | abnt.js:41–43, 94–97 |

Suspeitas para o `especialista-normas` [HIPÓTESE]:

- ano repetido no tipo TCC (abnt.js:220);
- lei sem "Acesso em";
- sobrenome = última palavra, o que falha com Filho, Júnior e Neto;
- chamada institucional truncada para a última palavra: "(ESTATÍSTICA, 1993)" para o IBGE [VERIFICADO por execução];
- sigla sem a flag institucional vira "Sebrae" na chamada e "SEBRAE" na referência [VERIFICADO por execução];
- "et al." obrigatório a partir de 3 autores;
- tabela com bordas laterais, contra a Norma Tabular do IBGE.

### 5. Testes existentes e dívidas técnicas [VERIFICADO]

- **Testes:** nenhum. Não há manifesto de dependências, lockfile, build nem linter.
- **D1.** Regras duplicadas em quatro implementações (preview, DOCX, PDF, ODT) que divergem entre si:
  - PDF: recuo de 12 mm, tabela como texto com "|", nota como "(n)";
  - ODT: título de nível 1 à esquerda e pós-textuais numerados.
- **D2.** Parâmetros de `config` (margens, espaçamento, recuo) são ignorados pelo DOCX.
- **D3.** `formatarReferencia` devolve HTML com `<strong>`, e não estrutura; a exportação remove o negrito.
- **D4.** Regra normativa dentro do reducer (`reordenarNumeracao`); a ação genérica `SET_CAMPO` aceita qualquer chave;
  campos transitórios (`_dirty`) são persistidos; não há esquema versionado nem migração.
- **D5.** Marcadores em texto livre são frágeis:
  - `:` ou `]` na página quebra o `cite`;
  - `_(.+?)_` aplica itálico a `snake_case` e URLs (exports.js:380);
  - quebras de linha simples são apagadas (exports.js:371);
  - apagar uma nota só remove a 1.ª ocorrência (components.js:521).
- **D6.** `components.js` monolítico (2200 linhas, 14 painéis), com regras normativas na interface.
- **D7.** Dependências externas em tempo de execução: Google Fonts (index.html:20) e LanguageTool.

## Riscos e problemas encontrados

| ID | Descrição | Severidade | Evidência | Encaminhamento |
|---|---|---|---|---|
| S-1 | XSS: `formatarReferencia` monta HTML sem escape, exibido por `dangerouslySetInnerHTML`; o vetor real é um backup JSON de terceiros | Alta | abnt.js:196–232; components.js:1284, 1314, 1400, 1704 [VERIFICADO no código; não explorado] | Novo app: saída estruturada, sem HTML em string; CSP |
| S-2 | `python -m http.server 8765` sem `--bind` escuta em todas as interfaces; o README diz "só na sua máquina" | Alta | INICIAR.bat:59; iniciar.sh:48; README:41 [VERIFICADO no código] | Novo app sem servidor (ou 127.0.0.1) |
| S-3 | jsPDF 2.5.1 com avisos de segurança publicados (GHSA-w532-jxjh-hjhj, GHSA-8mvj-3j78-4qmw, entre outros) | Alta | jspdf.js:4 [VERIFICADO]; faixa afetada [HIPÓTESE] | Dependências gerenciadas com auditoria (Etapa 4) |
| S-4 | Electron 28 sem suporte | Alta | package.json:16 [VERIFICADO] | Versão suportada no ADR de tecnologia |
| S-5 | Backup importado sem validação: sobrescreve sem confirmar e restaura pela metade se falhar | Alta | storage.js:88–96 [VERIFICADO no código] | Validação de esquema, prévia, transação |
| S-6 | Dados presos à origem do navegador | Alta | storage.js:9; INICIAR.bat:40 [VERIFICADO] | Arquivo de projeto em disco com salvamento atômico (R12) |
| S-7 | LanguageTool sem aviso de privacidade nem opção de desligar | Média | components.js:414, 715 [VERIFICADO] | Opcional, desligado por padrão, com consentimento (R11) |
| S-8 | Google Fonts carregado a cada abertura | Média | index.html:20 [VERIFICADO] | Embutir as fontes (verificar licença) |
| S-9 | Sem CSP; `openExternal` sem filtro de esquema; sem `will-navigate`; DevTools no menu de produção | Média | main.js:44–47, 57, 78 [VERIFICADO] | Endurecer o runtime no ADR |
| S-10 | Empacotamento quebrado (O-2, O-3) | Média | package.json:26–35 [VERIFICADO] | Testar o instalador na Etapa 7 |
| S-11 | Falha de autosave silenciosa; sem versões nem migração | Média | state.js:172–183 [VERIFICADO] | Indicador de salvamento, migrações testadas |
| S-12 | Recálculo total a cada tecla; exportação na thread principal | Média | components.js:708, 1896 [VERIFICADO]; impacto [HIPÓTESE, não medido] | Medir com documento sintético de 150 páginas |
| S-13 | html2canvas (198 KB) carregado sem uso; docx e htm sem versão | Baixa | [VERIFICADO] | Remover; registrar versões e licenças |
| S-14 | `innerHTML` no painel de erro | Baixa | index.html:278 [VERIFICADO] | `textContent` |
| E-1…E-8 | Defeitos de exportação DOCX (seção 2) | Alta (E-1, E-2) / Média | amostra `analise/amostras/linha_base_tcc.docx` | Testes de regressão documental (M3) |

Riscos existentes da `docs/MATRIZ_DE_RISCOS.md` confirmados por esta auditoria: R02 (O-1), R10 (S-3, S-4, S-13),
R11 (S-7), R12 (S-5, S-6), R04 (E-7, pendente de teste no Word) e R05 (campos TOC vazios até a
atualização; sumário do PDF estimado).

## Recomendações (reaproveitamento por módulo)

| Módulo | Decisão | Motivo |
|---|---|---|
| `abnt.js` | **Reescrever como motor declarativo, aproveitando a lógica** | As funções são puras e testáveis [VERIFICADO por execução em Node]. Devem devolver estrutura (trechos com estilo), não HTML. Cada regra recebe `RN-xxx`. Corrigir a chamada institucional, a detecção de sigla e a fronteira de palavra na heurística |
| `templates.js` | **Adaptar** | As árvores de seções viram dados de entrada; faltam obrigatoriedade por tipo de trabalho e fonte normativa |
| `state.js` | **Adaptar** | As operações de árvore são reaproveitáveis; tirar a numeração do reducer; usar ações tipadas |
| `exports.js` (DOCX) | **Reescrever, usando o esqueleto como referência** | Seções capa / pré-textuais sem número / textuais, campos TOC/SEQ, `Caption` e paisagem estão no caminho certo; o resto tem os defeitos E-1 a E-8 e regras fixas |
| `exports.js` (PDF/ODT) | **Descartar ou adiar** | Motores paralelos e divergentes; PDF a partir do DOCX (LibreOffice headless, já validado nesta etapa) é a hipótese a avaliar na Etapa 4 |
| `visual-editor.js` | **Adaptar** | Os geradores de SVG são independentes; isolar a rasterização atrás de uma interface |
| `components.js` | **Reescrever** | Monolítico, com regras na interface e `dangerouslySetInnerHTML`; o novo layout segue `docs/REFERENCIA_DE_LAYOUT.md` |
| `storage.js` / backup JSON | **Adaptar** | Formato versionado e importador do JSON antigo, com validação |
| `electron/` | **Reescrever a configuração** | Manter webPreferences (O-6); versão suportada, CSP, filtro de links, empacotamento correto |
| `vendor/` | **Substituir por dependências gerenciadas** | docx.js: avaliar a versão atual (a API de `ImageRun` mudou na 9.x [HIPÓTESE]) |

Outras recomendações:

- O harness `analise/harness/gerar_docx_linha_base.js` e a amostra servem de **linha de base**. Ao
  implementar o M3, gerar o mesmo conteúdo no app novo e comparar.
- A decisão de tecnologia (Etapa 4) deve considerar que o LibreOffice headless já está disponível
  para conversão DOCX→PDF e verificação automática.

## Pendências e perguntas ao usuário

As perguntas abaixo afetam o resultado visível ou a privacidade. Serão retomadas na Etapa 3 ou 4; nenhuma bloqueia a Etapa 3.

1. **Revisão gramatical on-line (LanguageTool):** manter no app novo como recurso opcional,
   desligado por padrão e com aviso de que o texto vai a um serviço externo, ou remover? (Etapa 4)
2. **PDF no MVP:** gerar o PDF a partir do DOCX (via LibreOffice ou Word do usuário) ou só DOCX no
   MVP? (Etapa 4)
3. **Edição da NBR 10520** (conflito C-01 já registrado no estado do projeto): continua para a Etapa 3.

Pendências técnicas:

- abrir a amostra no Microsoft Word, que não está disponível nesta sessão (o usuário pode abrir
  `analise/amostras/linha_base_tcc.docx`);
- executar PDF, ODT, gráficos e a UI no navegador;
- medir o desempenho;
- identificar a versão exata do docx.js.

## Arquivos produzidos/alterados

- `docs/relatorios/ETAPA2_AUDITORIA.md` (este relatório).
- `analise/harness/gerar_docx_linha_base.js` (harness; não altera o original).
- `analise/amostras/linha_base_tcc.docx` e `linha_base_tcc.pdf` (linha de base; pasta ignorada pelo git).
- `docs/ESTADO_DO_PROJETO.md`, `docs/INVENTARIO_DE_MATERIAIS.md` (status das observações),
  `docs/MATRIZ_DE_RISCOS.md`, `CHANGELOG.md`.
