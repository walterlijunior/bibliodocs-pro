# ADR-0007 — Editor de texto rico e biblioteca de componentes

- **Status:** ACEITO (2026-10-17, decisão delegada pelo usuário à sessão principal)
- **Data:** 2026-10-17
- **Decisores:** agente `especialista-interface` (proposta); sessão principal (aceite e itens visíveis, por delegação do usuário em 2026-10-17)
- **Etapa/Marco:** antes do M2; vale para o M2-T05, T06, T07 e T08 e para os nós de M4 a M6
- **Requisitos e riscos relacionados:** RF-03, RF-04, RF-07, RF-09, RF-10, RF-11, RF-13; RNF-03, RNF-06, RNF-09,
  RNF-14, RNF-15; R36 (R-M1-01); riscos novos R38–R45 (seção "Riscos novos"; registrados na matriz de riscos)

## Contexto

### O que já existe

- **Modelo semântico** [VERIFICADO: `app/src/dominio/modelo/tipos.ts`]:
  - `Documento { id, tipoTrabalho, metadados: { titulo: Inline[], subtitulo? }, corpo: Secao[] }`;
  - `Secao { id, titulo: Inline[], blocos: Bloco[], subsecoes: Secao[] }`;
  - `Bloco` = `paragrafo { id, conteudo: Inline[] }` | `quebraPagina { id }`;
  - `Inline` = só `texto { texto, marcas?: ('italico'|'negrito'|'sobrescrito'|'subscrito')[] }`.
- **Invariantes:**
  - sem HTML;
  - sem números armazenados (o nível da seção vem da profundidade);
  - ids de seções e blocos únicos, conferidos na leitura;
  - `\n` no texto é quebra de linha manual, e `\t` é tabulação;
  - marcas sem repetição e sem sobrescrito junto com subscrito.

  Fonte: `app/src/dominio/esquemas/projeto-v1.ts` (`PADRAO_TEXTO_XML`, `superRefine` das marcas) e o adendo do
  M1-T04 no ADR-0004 [VERIFICADO].
- **O v1 é aditivo até a 1.ª distribuição.** O M2 acrescenta variantes sem subir `versaoFormato` (adendo do M1-T04 no
  ADR-0004) [VERIFICADO]. O ADR-0005, seção 3, já prevê estes acréscimos [VERIFICADO]:
  - blocos `alineas`, `citacaoLonga` e `visual`;
  - inlines `citacao`, `nota`, `remissiva` e `sigla`;
  - `notas`, `siglas` e `visuais` como `Record<Id, …>` no `Documento`.
- **Sessão de edição** [VERIFICADO: `app/src/aplicacao/servicos/sessao-trabalho.ts`]:
  - a `SessaoTrabalho` é pura;
  - a única edição de hoje é `alterarTitulo`, que troca o pacote de forma imutável e faz `#revisao += 1`;
  - em seguida, põe `naoSalvo` (se não estiver em `salvando`) e chama `#agendarAutomatico()`, `#agendarInstantaneo()`
    e `#emitir()`;
  - `#emitir()` cria um `EstadoSessao` novo a cada chamada;
  - a interface o lê por `useSyncExternalStore` (`app/src/interface/escrever/useSessao.ts`).

  O ESTADO pede que toda edição nova do M2 faça o mesmo: somar revisão, agendar o automático e chamar
  `#agendarInstantaneo()` [VERIFICADO: `docs/ESTADO_DO_PROJETO.md`, "Instruções para etapas futuras", M1-T11 e M1-T12].
- **Aba Escrever:** hoje só tem um `<input>` com o título. O título perde as marcas ao ser editado (`tituloDoTexto`). O
  editor rico deve corrigir isso [VERIFICADO: `AreaEscrever.tsx`; adendo do M1-T11 no ADR-0004].
- **Layout escolhido pelo usuário:** botões **"Seção anterior · Pré-visualizar · Próxima seção"** na barra superior
  [VERIFICADO: `docs/GUIA_VISUAL.md`]. A navegação já pressupõe trabalhar **uma seção por vez**.

### O que o M2 e os marcos seguintes exigem

- **M2 (RF-03, RF-04):**
  - seções em árvore com numeração calculada;
  - mover, recuar e promover seções;
  - parágrafos, alíneas e subalíneas, citação longa e nota de rodapé;
  - desfazer e refazer;
  - pré-textuais com texto (resumo, agradecimentos, epígrafe…).

  Aceite do RF-03: "mover a seção 3 para antes da 2 renumera tudo, inclusive remissivas" [VERIFICADO:
  `docs/REQUISITOS_FUNCIONAIS.md`].
- **M4–M6:**
  - nós **atômicos inline**: citação ligada à obra (RF-07: "citação sem obra é impossível de criar"), remissiva
    (RF-11), sigla (RF-13) e chamada de figura/tabela;
  - **blocos** atômicos: tabela, quadro, figura e equação (RF-09, RF-10).

### Restrições

| Restrição | Fato conferido |
|---|---|
| **CSP de produção** | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; …` [VERIFICADO: `app/src/principal/seguranca/csp.ts`, `CSP_PRODUCAO`]. Sem `unsafe-inline` e sem `unsafe-eval`. Consequências: um `<style>` injetado em tempo de execução é **bloqueado**, e o mesmo vale para `setAttribute('style', …)`. Estilo por CSSOM (`el.style.x = …`, `style.cssText`, `style.setProperty`, o `style={{}}` do React) **não** é bloqueado [HIPÓTESE forte, conforme a descrição de `style-src` no MDN; confirmar no E2E]. O E2E já falha com violação de CSP no console (`x.problemas`, adendo do M1-T13 no ADR-0006) [VERIFICADO] |
| **Nada de `innerHTML`** | A varredura recusa `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, `createContextualFragment`, `srcdoc`, `document.write`, `eval` e `Function`. A varredura cobre **só `src/`**, não `node_modules` [VERIFICADO: `app/tests/apoio/analisador-fontes.ts`, `PADROES_HTML`] |
| **Zero rede** | `fetch`, `XMLHttpRequest` e `WebSocket` são proibidos fora de `src/integracoes/revisao-texto/`. O E2E confere pelo net-log [VERIFICADO: `PADROES_REDE`; adendo do M1-T13] |
| **Fronteiras (ADR-0005)** | `interface` só importa **tipos** do domínio (regra 4). `aplicacao` não usa Node nem Electron, mas **pode importar pacotes**: hoje nada a impede de importar um pacote de editor [VERIFICADO: função `avaliar`, regra 3]. `src/interface/<qualquer subpasta>` já é reconhecida como módulo `interface` [VERIFICADO: `moduloDoCaminho`, `MODULOS_SIMPLES`]. `tsconfig.puro.json` (domínio + aplicação) usa `lib: ["ES2023"]` sem DOM; `tsconfig.web.json` tem DOM [VERIFICADO] |
| **Latência** | < 50 ms por tecla com o documento de 150 páginas (RNF-06, `[META]`) [VERIFICADO: `docs/REQUISITOS_NAO_FUNCIONAIS.md`]. O instantâneo síncrono no principal é o R36 (R-M1-01). A medição é o M2-T01, antes de ligar o editor [VERIFICADO: `docs/relatorios/REVISAO_M1.md`; `docs/PLANO_DE_IMPLEMENTACAO.md`] |
| **Acessibilidade** | Teclado, contraste AA, escala de 125%/150% (RNF-09). Leitor de tela NVDA exigido pela tarefa. O axe-core entra no M2 (adendo do M1-T13) [VERIFICADO] |
| **Licenças** | RNF-15. A revisão do M1 recomenda um teste que recuse GPL/AGPL/LGPL em produção (R-M1-04) [VERIFICADO] |
| **Colagem** | O conteúdo vindo do Word ou do navegador deve virar só `Bloco`/`Inline` (aceite do M2-T05 no plano) [VERIFICADO] |
| **Corretor ortográfico** | Desligado (`spellcheck:false`, C-9) para não baixar dicionários [VERIFICADO: `REVISAO_M1.md`, checklist C-9] |

## Alternativas consideradas

### Consulta ao registro npm (2026-10-17, 09:17 BRT)

Comando: `npm view <pacote> version license time.modified dependencies` (e `peerDependencies`). Nenhuma consulta
falhou.

Para contar as dependências transitivas, um `package-lock.json` foi gerado **só no scratchpad da sessão**
(`npm install --package-lock-only --ignore-scripts`, sem `node_modules`). A contagem não inclui `react`, `react-dom`
e `scheduler`, que o app já tem. Para conferir a CSP e a colagem, os tarballs foram baixados com `npm pack` no
scratchpad e o código distribuído foi lido. Nada foi instalado em `app/`.

| Pacote | Versão | Licença | Modificado | Dependências diretas |
|---|---|---|---|---|
| prosemirror-model | 1.25.12 | MIT | 2026-09-21 | orderedmap ^2.0.0 |
| prosemirror-state | 1.4.4 | MIT | 2025-10-23 | model, transform, view |
| prosemirror-view | 1.42.6 | MIT | 2026-09-25 | model ^1.25.12, state, transform |
| prosemirror-transform | 1.12.2 | MIT | 2026-09-25 | model ^1.21.0 |
| prosemirror-history | 1.5.1 | MIT | 2026-09-29 | rope-sequence, view, state, transform |
| prosemirror-keymap | 1.2.3 | MIT | 2025-05-04 | w3c-keyname, state |
| prosemirror-commands | 1.7.2 | MIT | 2026-08-05 | model, state, transform |
| orderedmap / rope-sequence / w3c-keyname | 2.1.1 / 1.3.4 / 2.2.8 | MIT | 2023 | — |
| (opcionais) prosemirror-gapcursor / dropcursor / inputrules / tables | 1.4.1 / 1.8.4 / 1.5.1 / 1.8.5 | MIT | 2025–2026 | — |
| @tiptap/core, @tiptap/pm, @tiptap/react, @tiptap/extensions | 3.32.0 | MIT | 2026-10-13 | `@tiptap/pm` puxa 13 pacotes prosemirror (inclusive tables, changeset, schema-list); `@tiptap/react` puxa fast-equals e use-sync-external-store |
| @tiptap/starter-kit | 3.32.0 | MIT | 2026-10-13 | 23 extensões (link, code, strike, underline, heading…) |
| lexical | 0.52.0 | MIT | 2026-10-16 | @lexical/internal; peer `typescript >=5.2` |
| @lexical/react | 0.52.0 | MIT | 2026-10-16 | 19 pacotes `@lexical/*`, inclusive yjs, markdown, devtools-core e `@floating-ui/react`; peer `yjs` |
| @lexical/rich-text, @lexical/history | 0.52.0 | MIT | 2026-10-16 | clipboard, html, selection, utils, extension… |
| slate | 0.143.0 | MIT | 2026-10-17 | — |
| slate-react / slate-dom / slate-history | 0.142.0 / 0.142.0 / 0.140.0 | MIT | 2026-10-15/16 | lodash, direction, is-hotkey, tiny-invariant, @juggle/resize-observer, scroll-into-view-if-needed |
| react-aria-components | 1.22.1 | Apache-2.0 | 2026-10-09 | react-aria 3.53.1, react-stately 3.51.0, @internationalized/*, @swc/helpers |
| radix-ui (pacote único) / @radix-ui/react-dropdown-menu / react-dialog / react-popover | 1.8.1 / 2.2.1 / 1.3.1 / 1.3.1 | MIT | 2026-10-14 | O pacote único depende de 56 primitivas; dialog, popover e menu dependem de `react-remove-scroll` |

**Árvore resolvida por alternativa** [VERIFICADO: lockfile gerado no scratchpad]:

| Conjunto mínimo | Pacotes novos | Licenças |
|---|---|---|
| ProseMirror puro (7 pacotes) | **10** | 10 MIT |
| TipTap (core, pm, react, extensions, document, paragraph, text) | 34 | todas MIT (inclui `@types/react` como peer e `@floating-ui/*`) |
| Lexical (lexical, react, rich-text, history) | 35 | todas MIT (inclui yjs, lib0 e isomorphic.js como peers) |
| Slate (slate, react, dom, history) | 12 | 11 MIT, 1 Apache-2.0 |
| React Aria Components | 13 | 8 Apache-2.0, 4 MIT, 1 0BSD |
| Radix (dropdown, dialog, popover) | 41 | 40 MIT, 1 0BSD |

Nenhuma licença copyleft aparece em nenhuma alternativa [VERIFICADO].

### Alternativas avaliadas

**A. ProseMirror puro** (model, state, view, transform, history, keymap, commands). [Fonte primária:
prosemirror.net, guia e referência; repositórios `github.com/ProseMirror/*`.]
- **Mapeamento:**
  - esquema **declarativo** com expressões de conteúdo (`"titulo bloco*"`, `"inline*"`);
  - `Node.check()` recusa documento fora do esquema;
  - os nós carregam `attrs` (o `id` do bloco, a `chamada` da citação).

  O esquema e a conversão usam só o `prosemirror-model`, que não toca no DOM ao construir ou validar nós. Por isso
  dá para testá-los em Node [HIPÓTESE forte; o `index.d.ts` só cita `window.Node` nos tipos do `DOMParser` e do
  `DOMSerializer`, VERIFICADO].
- **Nós atômicos:**
  - `atom: true`, inline ou bloco, com `NodeView` próprio;
  - a nota de rodapé com conteúdo editável é o exemplo oficial "footnote" (editor aninhado).
- **Desfazer:** `prosemirror-history`, por estado de editor.
- **Colagem** [VERIFICADO no código do `prosemirror-view` 1.42.6]:
  - o `DOMParser.fromSchema` só aceita o que o esquema declara e descarta o resto;
  - o caminho padrão da colagem (`readHTML`) usa `innerHTML` num documento destacado
    (`document.implementation.createHTMLDocument`);
  - esse caminho pode ser substituído por `handleDOMEvents.paste`, que roda antes do tratador interno
    (`runCustomHandler` → `doPaste`).
- **IME e teclas mortas:**
  - o `prosemirror-view` trata `compositionstart`/`compositionend` e observa o DOM;
  - durante a composição, a colagem fica com o navegador.

  A biblioteca é madura e é a base do TipTap [HIPÓTESE forte; conferir com o teclado ABNT2].
- **Acessibilidade:** `contenteditable` nativo, sem camada própria [HIPÓTESE: com o NVDA no Chromium, funciona no modo
  de foco; os nós atômicos precisam de texto acessível].
- **CSP** [VERIFICADO: `grep` em `dist/index.js`]:
  - **nenhum `<style>` injetado**: o CSS vem em `style/prosemirror.css`, sem `url(`, e entra como arquivo pelo Vite;
  - os estilos dinâmicos usam `style.cssText`, por CSSOM (linhas 1761, 2166, 3710 e 3760);
  - o `prosemirror-model` só usa `setAttribute` com os atributos que o **nosso** `toDOM` emitir.
- **Esforço:** API de nível mais baixo. Teclas, menus e comandos são escritos por nós, mas são poucas linhas por recurso.

**B. TipTap 3, só com pacotes MIT do núcleo** (core, pm, react e extensões avulsas, sem starter-kit nem Pro). É
construído sobre o ProseMirror: o mesmo `EditorView`, a mesma colagem e o mesmo IME.
- **Mapeamento:** o esquema é gerado a partir de "extensões". Os nós próprios são possíveis, mas o esquema real fica
  atrás de uma camada a mais.
- **Atômicos:** os `ReactNodeViewRenderer` são convenientes.
- **CSP:** **o `@tiptap/core` injeta `<style>` por padrão** [VERIFICADO: `dist/index.js`, `injectCSS: true` (l. 6540)
  e `createStyleTag` com `document.createElement("style")` e `styleNode.innerHTML = style` (l. 4125–4130)]. Com a CSP
  atual, isso gera violação. Exige `injectCSS: false` e CSS próprio.
- **Dependências:** 34 pacotes, inclusive os que não usaremos (tables, changeset, floating-ui).
- **Esforço:** menor no começo; a depuração exige conhecer o ProseMirror do mesmo jeito.

**C. Lexical 0.52** (Meta).
- **Mapeamento:**
  - nós como classes (`ElementNode`, `TextNode`, `DecoratorNode`);
  - sem expressão de conteúdo declarativa: a validade se mantém com *transforms* e normalização escrita por nós.
- **Atômicos:** `DecoratorNode` renderiza React.
- **Colagem:** usa `new DOMParser()` [VERIFICADO: `@lexical/clipboard` `LexicalClipboard.dev.js` l. 311 e 590].
- **CSP:** nenhum `<style>` no núcleo; estilos por `style.setProperty` [VERIFICADO: `grep` em `Lexical.dev.js`].
- **Contras:**
  - série 0.x, com versão nova publicada a cada poucas semanas (0.52.0 saiu em 2026-10-16), o que indica API instável
    [HIPÓTESE quanto à quebra de API];
  - o `@lexical/react` puxa yjs, markdown, devtools e floating-ui (35 pacotes);
  - o histórico de defeitos com composição no Chrome/Windows é [HIPÓTESE, não conferido].

**D. Slate 0.143** (`slate-react`).
- **Mapeamento:** o modelo JSON (`Element { type, children }`, `Text { text, bold }`) é muito parecido com o nosso, mas
  **não tem esquema**: toda a validade fica no `normalizeNode` escrito à mão.
- **Atômicos:** inline *void*, sabidamente delicado com seleção e IME [HIPÓTESE].
- **Colagem:** sem desserializador de HTML pronto.
- **CSP:** nenhum `<style>` injetado em `slate-react`/`slate-dom` [VERIFICADO: `grep`].
- **Riscos:** série 0.x, com publicação hoje (0.143.0); a renderização React de cada elemento pede "chunking" em
  documento grande [HIPÓTESE].

**E. Editor por blocos próprio** (um `contenteditable` por parágrafo).
- **A favor:** zero dependências, mapeamento direto.
- **Contras:**
  - a seleção entre parágrafos não existe nativamente;
  - teclas mortas, IME, desfazer, colagem e atômicos `contenteditable=false` teriam de ser escritos e mantidos por nós.

  É o caminho com maior risco de perder texto.

### Tabela de critérios

Notas de 1 (pior) a 5 (melhor). Pontos = nota × peso / 5. Total máximo: 100.

| Critério (peso) | A. ProseMirror puro | B. TipTap (núcleo MIT) | C. Lexical | D. Slate | E. Próprio |
|---|---|---|---|---|---|
| Fidelidade ao modelo `Bloco/Inline`: esquema estrito e validável (20) | 5 — expressões de conteúdo e `check()` | 4 — mesmo motor, atrás das extensões | 3 — validade por *transforms* | 3 — JSON parecido, sem esquema | 5 — direto |
| Nós atômicos inline e blocos (M4–M6) (12) | 5 | 5 | 4 | 3 | 2 |
| Desfazer/refazer e ligação com a sessão (10) | 4 | 4 | 4 | 3 | 2 |
| Colagem saneada (8) | 4 — parser pelo esquema; tratador próprio possível | 4 | 4 | 3 | 3 |
| IME, teclas mortas e seleção (10) | 4 | 4 | 3 | 2 | 1 |
| Acessibilidade: teclado e NVDA (10) | 3 | 3 | 3 | 3 | 2 |
| CSP sem afrouxar (8) | 5 — nada injetado | 3 — injeta `<style>`; precisa de opção | 4 | 4 | 5 |
| Dependências e licenças (7) | 5 — 10, MIT | 3 — 34 | 3 — 35, 0.x | 4 — 12 | 5 |
| Desempenho em 150 páginas (8) | 4 | 4 | 4 | 3 | 4 |
| Esforço para o mantenedor com o Claude Code (7) | 3 | 4 | 3 | 3 | 1 |
| **Total (100)** | **86,0** | **77,4** | **69,2** | **61,0** | **62,4** |

Contas (soma de nota × peso, dividida por 5):
- A = (100+60+40+32+40+30+40+35+32+21)/5 = **86,0**
- B = (80+60+40+32+40+30+24+21+32+28)/5 = **77,4**
- C = (60+48+40+32+30+30+32+21+32+21)/5 = **69,2**
- D = (60+36+30+24+20+30+32+28+24+21)/5 = **61,0**
- E = (100+24+20+24+10+20+40+35+32+7)/5 = **62,4**

**Sensibilidade:**
- Mesmo que a CSP do TipTap valesse 5 (a opção `injectCSS: false` resolve) e o peso do esforço fosse triplicado, B
  ficaria abaixo de A.
- A vantagem de A está no esquema estrito e nas dependências, e B herda o mesmo motor. Por isso **migrar de A para B
  depois custa pouco**: o esquema é o mesmo.
- A recomendação do `especialista-interface` registrada no ESTADO ("TipTap só com núcleo MIT ou ProseMirror puro") se
  resolve a favor de A, por causa da injeção de `<style>` verificada no TipTap e das 24 dependências a mais.

## Decisão

**Proposta: ProseMirror puro (alternativa A), com um editor por seção.** A árvore de seções fica no modelo do domínio,
e a conversão modelo ↔ editor é pura e testável em Node. Motivos:
- tem o esquema mais estrito para garantir "só `Bloco`/`Inline`";
- não injeta nada que a CSP bloqueie;
- tem 10 dependências MIT;
- é o mesmo motor do TipTap, o que deixa uma saída barata.

### 1. Um editor por seção, não por documento

| | Um editor por documento | **Um editor por seção (proposto)** |
|---|---|---|
| Árvore de seções | Dentro do documento do editor (nós `secao` aninhados) | No `Documento` do domínio; o editor recebe só `titulo` + `blocos` da seção ativa |
| Mover, recuar e promover (RF-03) | Transformações do ProseMirror sobre nós grandes, que se misturam com o histórico de texto | Operações puras de `dominio/modelo` (M2-T03), testadas sem editor |
| Tamanho do documento do editor | 150 páginas inteiras | Uma seção (no pior caso, um capítulo longo) |
| Layout de referência | — | Combina com "Seção anterior · Próxima seção" (`GUIA_VISUAL.md`) e com a árvore na barra lateral |
| Perde | — | Selecionar texto atravessando seções; rolagem contínua do trabalho todo (a leitura contínua fica na Pré-visualização) |

Os pré-textuais com texto (resumo, abstract, agradecimentos, dedicatória, epígrafe) usam o **mesmo componente** com
um esquema restrito por elemento. O título do trabalho usa um editor de uma linha, só com marcas, e deixa de perder o
itálico.

### 2. Esquema do editor

Os nomes finais ficam para o M2-T05, depois do modelo do M2-T04.

```text
secaoDoc      content: "titulo bloco*"
titulo        content: "inline*"          (marcas: italico, negrito, sobrescrito, subscrito)
paragrafo     attrs { id }  content: "inline*"
alineas       attrs { id }  content: "alinea+"   → alinea: "linhaAlinea subalinea*"
citacaoLonga  attrs { id, chamada }  content: "inline*"
quebraPagina  attrs { id }  atom, folha
visual        attrs { id, visualId }  atom, folha            (M5)
texto + quebraLinha (inline folha) ↔ "\n" dentro de `texto`
nota          inline, atom, content "inline*" (editor aninhado) ↔ { tipo:'nota', notaId } + Documento.notas[notaId]
citacao       inline, atom, attrs { chamada }                 (M4)
remissiva     inline, atom, attrs { alvoId }                  (M6)
sigla         inline, atom, attrs { siglaId, forma }          (M6)
```

Regras do esquema:
- `toDOM` emite **só classes e `data-*`**, nunca `style` nem atributos de evento. Um teste em Node confere isso
  percorrendo a saída de cada `toDOM`.
- Nenhuma marca além das quatro do modelo: sem sublinhado, cor ou fonte, para não parecer Word.
- **Forma canônica.** O ProseMirror junta textos vizinhos com as mesmas marcas e ordena as marcas pelo esquema. Por
  isso a ida e volta compara com `normalizarConteudo(modelo)`, que:
  - junta trechos iguais vizinhos;
  - remove o texto vazio;
  - ordena as marcas.

  Para entrada já canônica, a igualdade é exata.
- **Ids únicos.** Um plugin `appendTransaction` dá id novo ao bloco duplicado (Enter divide o parágrafo e copia os
  `attrs`; colar dentro do app também copia). A primeira ocorrência fica com o id antigo. O id vem de um gerador
  injetado (`crypto.getRandomValues` no renderer e no Node 24) no `PADRAO_ID` do esquema v1.
- **Números nunca vão para o editor.** O número da seção e o texto de remissivas e citações vêm de um estado de plugin
  (`numeracao`, `rotulos`), atualizado por transação sem mudança de documento (`addToHistory: false`). Os `NodeView`
  relêem esse estado. O texto exibido das citações vem de `aplicacao/` (que pode chamar `dominio/bibliografia`), nunca
  de `dominio/normas` (regra 4).

### 3. Transações → `SessaoTrabalho`

Proposta de contrato para o M2-T06; o código da sessão não muda neste ADR.

1. O `EditorView` é **não controlado** pelo React. O React monta e desmonta; o `dispatchTransaction` aplica o estado.
2. Se `tr.docChanged`, a conversão editor → modelo roda **na hora** e é memorizada por identidade de nó
   (`WeakMap<Node, Bloco>`). Os nós que não mudaram são o mesmo objeto no ProseMirror, então o custo é proporcional ao
   que mudou.
3. Chama `sessao.alterarSecao(secaoId, { titulo, blocos })` (e `alterarElemento(...)` nos pré-textuais). Como
   `alterarTitulo`, o método:
   - troca o nó na árvore de forma imutável, com índice id → caminho;
   - faz `#revisao += 1` e põe `naoSalvo` se não estiver `salvando`;
   - chama `#agendarAutomatico()` e `#agendarInstantaneo()`.
4. **`#emitir()` só quando o estado visível muda** (por exemplo, `salvo` → `naoSalvo`). Hoje cada emissão cria um
   `EstadoSessao` novo e re-renderiza a casca. Uma emissão por tecla gastaria a margem de 50 ms [HIPÓTESE; medir no
   M2-T06].
5. Invariante: **nenhuma alteração fica só no editor.** Como a conversão é síncrona, `salvar`, `garantirSalvo` e o
   instantâneo sempre veem o texto digitado. Se a medição pedir conversão adiada, a sessão passa a chamar um
   `descarregar()` registrado pelo editor antes de gravar.
6. Somente leitura (versão futura): `editable: () => false`.
7. O conteúdo vindo de fora (abrir, recuperar, desfazer estrutural, trocar de seção) cria um `EditorState` novo, ou
   reaproveita o guardado, sem passar pela sessão como alteração.

### 4. Desfazer e refazer com renumeração e operações estruturais

- **Texto:** o `prosemirror-history` de cada seção. O `EditorState` de cada seção visitada fica guardado num
  `Map<secaoId, EditorState>`, e o histórico sobrevive à troca de seção.
- **Estrutura** (inserir, excluir, mover, recuar e promover seção; mais tarde, excluir uma figura citada): **comando
  do domínio com inverso**, como o ADR-0005 já prevê ("toda mudança é um comando tipado, com inverso").
- **Ordem única:** um `HistoricoEdicao` puro em `aplicacao/` guarda a sequência
  `{ tipo: 'texto', secaoId } | { tipo: 'estrutura', comando, inverso }`. Uma entrada de texto é empilhada quando o
  `undoDepth` da seção cresce.
  - Ctrl+Z desempilha. Se for texto, abre a seção (se outra estiver ativa) e chama o `undo` do ProseMirror. Se for
    estrutura, aplica o inverso. Refazer é simétrico.
  - O resultado é linear, como no Word.
- **Renumeração não se desfaz**, porque não é armazenada. Desfazer um "mover" devolve a árvore, a numeração é
  recalculada e os rótulos das remissivas mudam pelo estado de plugin (RF-03).
- Como o `secaoId` é estável, mover uma seção não invalida o histórico de texto dela. Excluir guarda o `EditorState`
  no inverso, e desfazer a exclusão devolve a seção com o texto.
- Testes de sequência em Node (aplicação + `prosemirror-state`, sem view), por exemplo: digitar em 1, mover 3 para
  antes de 2, digitar em 3, desfazer três vezes → documento inicial.

### 5. Colagem

- O app trata `paste` e `drop` em `handleDOMEvents` (roda antes do tratador interno [VERIFICADO]), sem passar pelo
  `readHTML` da biblioteca:
  - `new DOMParser().parseFromString(html, 'text/html')`, que gera um documento inerte, sem scripts;
  - em seguida, `DOMParser.fromSchema(esquema).parseSlice(...)`.
- Regras de leitura para `b/strong/i/em/sup/sub` e para `span style="font-weight|font-style|vertical-align"`, comum
  no Word.
- Comentários condicionais `<!--[if …]>`, `<style>`, classes `Mso*` e tudo o que o esquema não conhece são
  descartados, e o texto fica.
- Imagens e tabelas coladas não entram no M2 e geram um aviso ("use Inserir › Tabela/Figura").
- Listas do Word (`mso-list`) → alíneas é [HIPÓTESE de viabilidade]. Se falhar, a lista vira parágrafos.
- Texto puro (Ctrl+Shift+V) → parágrafos por linha em branco.
- Durante uma composição IME, o ProseMirror deixa a colagem com o navegador [VERIFICADO no código]. O
  `appendTransaction` de ids e a validação do esquema cobrem esse caso.

### 6. Onde o código fica (módulos do ADR-0005)

| Arquivo (proposta) | Conteúdo | Dependências | Testável em Node |
|---|---|---|---|
| `src/interface/editor/esquema.ts` | `Schema` do ProseMirror | `prosemirror-model` | Sim |
| `src/interface/editor/conversao.ts` | `secaoParaDoc`, `docParaSecao`, `normalizarConteudo`, memo | `prosemirror-model` + `import type` do domínio | Sim |
| `src/interface/editor/plugins/*.ts` | ids únicos, numeração/rótulos, teclas, histórico | `prosemirror-state`, `-transform`, `-history`, `-keymap`, `-commands` | Sim (sem view) |
| `src/interface/editor/colagem.ts` | `DOMParser` + `parseSlice` | `prosemirror-model`, DOM | E2E |
| `src/interface/editor/EditorSecao.tsx`, `nos/*.ts` | `EditorView`, NodeViews (DOM com `textContent`, nunca HTML) | `prosemirror-view` | E2E |
| `src/aplicacao/servicos/historico-edicao.ts` | ordem única de desfazer | nenhum pacote do editor | Sim |
| `src/dominio/modelo/operacoes.ts` (M2-T03) | mover/recuar/promover com inverso | nenhum | Sim |

**Teste de fronteiras.** A pasta `interface/editor/` não exige mudança no mapa do analisador [VERIFICADO:
`moduloDoCaminho`]. Exige, porém, **três regras novas** no `arquitetura-fronteiras.test.ts`, com caso negativo cada uma:
1. Pacotes `prosemirror-*` só em `src/interface/editor/**`. Hoje `aplicacao/` poderia importá-los.
2. `esquema.ts`, `conversao.ts` e `plugins/` não importam `prosemirror-view`. Isso garante que rodem em Node.
3. `DOMParser` só em `src/interface/editor/colagem.ts`, na mesma forma da regra do `openExternal`.

Também entra um teste do esquema: nenhum `toDOM` emite `style` nem `on*`.

**`innerHTML` de terceiros.** O `prosemirror-view` contém `innerHTML` no `readHTML` (documento destacado) e no
`serializeForClipboard` [VERIFICADO]. A varredura não cobre `node_modules`. Com a colagem própria da seção 5, o
caminho de entrada não usa esse código. O de saída (copiar) serializa o nosso próprio esquema.

### 7. Biblioteca de componentes

| | React Aria Components 1.22.1 | Radix (radix-ui 1.8.1 / primitivas) | **Componentes próprios (proposto)** |
|---|---|---|---|
| Licença e árvore | Apache-2.0; 13 pacotes | MIT; 41 pacotes (3 primitivas) | — |
| CSP | **Injeta `<style>`** em todo componente "pressionável" (`usePress`, `touch-action`). O nonce é lido de `<meta name="csp-nonce">` [VERIFICADO: `dist/private/interactions/usePress.mjs` l. 585–598; `utils/getNonce.mjs`]. Conteúdo **fixo**: daria para liberar com um hash `'sha256-…'` em `style-src` | Dialog, Popover e Menu modais usam `react-remove-scroll` → `react-style-singleton`, que **injeta `<style>`** com nonce de `get-nonce` [VERIFICADO: `react-style-singleton` 2.2.3, `singleton.js`]. Conteúdo **dinâmico**: só nonce por carga resolveria | Nada injetado |
| Acessibilidade | A mais completa (Tree com arrastar acessível por teclado, ComboBox, textos pt-BR) [HIPÓTESE quanto às traduções] | Boa para menus e diálogos | Menus ARIA feitos no M1, com testes; `<dialog>` nativo (`showModal`: foco preso e fundo inerte) [HIPÓTESE de suficiência] |

**Recomendação:** continuar com componentes próprios no M2, como no M1, e usar `<dialog>` nativo para diálogos e
popovers.
- **Radix: não.** A injeção dinâmica de `<style>` obrigaria a mudar a CSP para nonce.
- **React Aria Components fica como opção** para a árvore de seções com arrastar (M2-T07) e para a busca de obra
  (combobox, M4). Se adotado, a CSP ganha **um** hash fixo, com teste que recalcule o hash a partir do pacote
  instalado. A decisão fica para o início do M2-T07, depois de medir o esforço da árvore própria.

## Consequências

- **Positivas:**
  - Esquema estrito: o editor não produz nada fora de `Bloco`/`Inline`.
  - O esquema, a conversão e os plugins são testáveis em Node.
  - A CSP não muda.
  - 10 dependências MIT.
  - Mover seção e desfazer estrutural são operações puras do domínio.
  - O histórico é linear.
  - O título do trabalho volta a guardar marcas.
- **Negativas e custos:**
  - Mais código próprio que com o TipTap: teclas, comandos de menu, NodeViews e a colagem.
  - Sem seleção entre seções.
  - A coordenação de histórico (texto × estrutura) é código novo.
  - A colagem própria só é testável no E2E (sem DOM no Node, e sem dependência nova como happy-dom).
  - A manutenção do ProseMirror é concentrada em poucos mantenedores (R43).
- **O que muda:**
  - **Código (M2-T05 a T07):**
    - `app/package.json` ganha 7 dependências de produção, com versões exatas (lista abaixo);
    - `src/interface/editor/`;
    - `aplicacao/servicos/historico-edicao.ts`;
    - métodos novos na `SessaoTrabalho` (`alterarSecao`, `executar(comando)`, emissão só quando o visível muda);
    - `prosemirror.css` importado como arquivo.
  - **Testes:** as três regras novas de fronteira e o teste de `toDOM`; ida e volta; sequências de desfazer; E2E de
    digitação, colagem, CSP e latência.
  - **Documentação:**
    - `MATRIZ_DE_RISCOS.md` (R38–R45, a cargo da sessão principal);
    - `MATRIZ_DE_TESTES.md`;
    - `app/README.md` (parte do editor);
    - inventário de licenças (R-M1-04).

**Dependências que seriam instaladas (produção, versões exatas, informar o usuário antes; M2-T05):**
`prosemirror-model@1.25.12`, `prosemirror-state@1.4.4`, `prosemirror-view@1.42.6`, `prosemirror-transform@1.12.2`,
`prosemirror-history@1.5.1`, `prosemirror-keymap@1.2.3`, `prosemirror-commands@1.7.2`. Transitivas: `orderedmap@2.1.1`,
`rope-sequence@1.3.4`, `w3c-keyname@2.2.8`. Todas MIT. Nenhuma de desenvolvimento.
`prosemirror-gapcursor@1.4.1` (cursor ao lado de um bloco atômico) só no M5, se a figura e a tabela pedirem.

### Riscos novos (sugestão de linhas para a matriz; a sessão principal decide)

| ID | Risco | P | I | Mitigação | Gatilho | Dono |
|---|---|---|---|---|---|---|
| R38 | Conversão editor ↔ modelo com perda (texto, marca, id ou nota some ao salvar) | 2 | 3 | Ida e volta em todas as fixtures; gerador aleatório com semente; `esquemaSecao` (zod) validando o resultado da conversão nos testes; `Node.check()` | Diferença na ida e volta; relato de texto perdido | especialista-interface + especialista-documento |
| R39 | Latência acima de 50 ms por tecla (conversão por transação, emissão React, instantâneo R36) | 2 | 3 | Memo por identidade de nó; emitir só quando o visível muda; editor por seção; medição E2E (p95) no documento do M2-T01 | p95 > 50 ms | especialista-interface |
| R40 | Colagem do Word/navegador traz estrutura indevida, perde itálico ou lista, ou passa pelo `innerHTML` da biblioteca | 2 | 2 | Tratador próprio (`DOMParser` inerte + esquema); fixtures de HTML do Word, LibreOffice e Chrome no E2E; aviso do que foi descartado; net-log sem requisição ao colar `<img src=https://…>` | Conteúdo estranho após colar; requisição no net-log | especialista-interface |
| R41 | Teclas mortas e composição (ABNT2: á, ç, ã, ü) duplicam ou perdem caracteres | 2 | 3 | Roteiro manual com teclado ABNT2 registrado; E2E com `insertText` e eventos de composição; versões fixadas | Relato ou roteiro falho | especialista-interface |
| R42 | O NVDA não anuncia nós atômicos (citação, nota, remissiva), o número da seção ou o modo de edição | 2 | 2 | `aria-label`/texto acessível nos NodeViews; roteiro NVDA registrado; axe-core no E2E | Roteiro NVDA falho | especialista-interface |
| R43 | ProseMirror com manutenção concentrada, ou mudança incompatível | 1 | 3 | Versões exatas; MIT; camada própria fina; TipTap como saída de baixo custo (mesmo motor) | Sem versão por 12 meses; quebra numa atualização de segurança | arquiteto-software |
| R44 | Biblioteca de UI ou extensão que injeta `<style>` (React Aria `usePress`, Radix `react-remove-scroll`, TipTap `injectCSS`) leva a afrouxar a CSP | 2 | 2 | E2E falha com violação; só hash fixo e testado, nunca `unsafe-inline`; Radix fora | Pedido de `unsafe-inline` | revisor-seguranca |
| R45 | Desfazer incoerente entre histórico de texto e operações estruturais (ordem errada, desfazer em seção excluída) | 2 | 2 | `HistoricoEdicao` único com testes de sequência; exclusão guarda o `EditorState` no inverso | Teste de sequência falha; relato | especialista-interface |

## Critério de reversão

1. **Latência.** p95 acima de 50 ms por tecla no documento do M2-T01 depois do memo e da emissão seletiva, com o perfil
   mostrando o `prosemirror-view` como gargalo (não a sessão nem o instantâneo):
   - primeiro, adiar a conversão (`descarregar()`);
   - só depois reavaliar a alternativa.
2. **IME ou NVDA.** Defeito de composição ou de leitor de tela no `prosemirror-view` sem correção em duas versões, e
   sem contorno no app: avaliar Lexical (C), porque o TipTap herda o mesmo `view`.
3. **Esforço.** Se a camada própria repetir recursos prontos do TipTap a ponto de dobrar o esforço estimado do M2-T05/T06:
   migrar para TipTap (B), com `injectCSS: false`. O esquema e a conversão são reaproveitados.
4. **Editor por seção.** Se o usuário, ao usar, pedir rolagem contínua do trabalho todo: um documento do editor com nós
   `secao`, compondo a conversão por seção (mesmo código). As operações estruturais continuam no domínio.

## Verificação

- **Ida e volta (Node, `npm run verificar`):**
  - para cada fixture de `tests/fixtures/` e para documentos aleatórios com semente:
    `docParaSecao(secaoParaDoc(s))` deve ser igual a `normalizarConteudo(s)`;
  - `Node.check()` sem erro;
  - resultado válido em `esquemaSecao`;
  - ids únicos depois de dividir, juntar e colar (via `EditorState.apply`, sem view).
- **Fronteiras:**
  - as três regras novas, com casos negativos;
  - teste do esquema: nenhum `toDOM` com `style`/`on*`.
- **CSP no E2E:**
  - digitar, aplicar itálico, criar nota, colar HTML do Word (fixture) e desfazer;
  - `x.problemas` vazio;
  - nenhum evento `securitypolicyviolation`;
  - net-log sem requisição (inclusive ao colar `<img>` remoto).
- **Latência no E2E:**
  - digitar 200 caracteres numa seção do documento de 150 páginas (gerador do M2-T01);
  - medir a duração dos eventos `keydown`/`input` pela Event Timing API [HIPÓTESE de disponibilidade no Electron 44;
    conferir] e o tempo de `dispatchTransaction` → `alterarSecao`;
  - registrar a p95 (meta ≤ 50 ms, RNF-06).
- **Desfazer:** sequências mistas texto/estrutura em Node; um E2E de "mover a seção 3 para antes da 2 → desfazer →
  numeração e remissiva voltam".
- **Manual registrado:** roteiro ABNT2 (teclas mortas e Alt+código) e roteiro NVDA (ler parágrafo, anunciar citação e
  nota, navegar entre seções).
- **Dependências:**
  - `npm ls prosemirror-model` com **uma** cópia (cópias duplicadas quebram o `instanceof` interno);
  - `npm audit --omit=dev` sem Alta/Crítica;
  - inventário de licenças sem copyleft.

## Itens visíveis para decisão do usuário

1. **Escrever uma seção por vez** (navegação por "Seção anterior/Próxima" e pela árvore), como proposto, ou rolagem
   contínua do trabalho inteiro.
2. **Aparência do texto no editor:**
   - neutra: fonte da interface, sem medidas normativas, com a forma final na Pré-visualização. É a proposta e segue a
     regra 4 do ADR-0005;
   - aproximada do documento (fonte e recuos do perfil, via `DocumentoFormatado`).
3. **O que a colagem preserva:** itálico, negrito, sobrescrito, subscrito e parágrafos; lista → alíneas quando
   possível; imagens e tabelas recusadas com aviso.
4. **Corretor ortográfico** desligado no M2 (C-9; RF-18 só depois do M7): confirmar se é aceitável.

### Decisões dos itens visíveis (2026-10-17, delegadas pelo usuário à sessão principal)

O usuário escreveu: "deixo essas decisões para você". As quatro propostas foram aceitas:

1. **Uma seção por vez**, com "Seção anterior/Próxima" e a árvore. Motivos: é o desenho de latência do item 1 da
   Decisão (R39); segue a barra do `docs/GUIA_VISUAL.md`; a rolagem contínua pode ser acrescentada depois como
   modo de leitura sem trocar o motor.
2. **Aparência neutra no editor**, com a forma final na Pré-visualização. Motivos: regra 4 do ADR-0005 (formatação
   só no motor normativo); evita mostrar como "conforme" uma aproximação antes do M3. Revisar no fechamento do M3, se
   a Pré-visualização se mostrar insuficiente.
3. **Colagem** preserva itálico, negrito, sobrescrito, subscrito e parágrafos; listas viram alíneas quando possível;
   imagens e tabelas são recusadas com aviso (entram pelos fluxos próprios do M5). Motivo: nada fora do modelo
   `Bloco/Inline` e nenhuma requisição de rede ao colar (R40).
4. **Corretor ortográfico desligado no M2.** Motivo: o corretor do Chromium baixa dicionários (C-9; zero rede); a
   revisão de texto é a do RF-18, depois do M7, opcional e desligada por padrão.

## Adendo do M2-T03 (2026-10-17) — numeração e operações sobre a árvore de seções

Código: `app/src/dominio/numeracao/secoes.ts` e `app/src/dominio/modelo/operacoes.ts`; testes em
`app/tests/secoes-operacoes.test.ts`.

**Decisão do usuário (2026-10-17, regra 10 do CLAUDE.md):** **promover funciona como o modo de tópicos do Word.** A
seção vira a irmã logo depois da mãe, e as irmãs que vinham depois dela passam a ser as suas últimas subseções. A ordem
do texto não muda. Exemplo: em `2 Método` com `2.1 Coleta` e `2.2 Análise`, promover Coleta dá `3 Coleta` com
`3.1 Análise`. A alternativa recusada fazia a seção subir sozinha, e o texto dela passava a vir depois do das irmãs.

**Decisões técnicas (sessão principal):**
- **Numeração derivada.** `numerarSecoes(corpo)` devolve as seções em ordem de leitura, com indicativo, nível, pai e
  `alemDoLimite`. Nada é gravado no modelo (ADR-0005 §3). As funções são iterativas e aceitam os 64 níveis do formato.
- **Operações puras.** São elas: `inserirSecao`, `removerSecao`, `moverSecao`, `recuarSecao`, `promoverSecao` e
  `aplicarOperacaoSecao`.
  - Nunca lançam exceção. A recusa traz `codigo` e `mensagem` pt-BR.
  - A entrada não é alterada: só o caminho até a mudança é copiado.
  - `mudou: false` marca o mover para o mesmo lugar, para a sessão não somar revisão nem empilhar desfazer.
- **Índice de destino.** `destino.indice` conta as posições da lista sem a seção que se move.
- **Recuar** leva a seção, com as suas subseções, para o fim da seção anterior. A ordem do texto também não muda.
- **Limites.**
  - Quinária (RN-041): a mensagem orienta usar alíneas (RN-028). Só é recusado o que leva a seção mais fundo do que a
    quinária **e** mais fundo do que ela já estava. Assim, um arquivo que já passa do limite pode ser corrigido.
  - 1000 seções por nível: `MAXIMO_SECOES_POR_NIVEL` fica em `dominio/modelo`, e `LIMITES_V1.secoesPorNivel` usa o
    mesmo valor. Sem isso, uma operação aceita gerava um trabalho que o salvamento recusava (achado M1 da revisão).
- **Inversos.** Toda operação aceita devolve o seu inverso. Promover tem um inverso próprio, `rebaixar`, com o número
  de subseções a devolver.
  - Um inverso só pula os limites quando é o **mesmo objeto** devolvido por uma operação aceita (registro em
    `WeakSet`). Um inverso montado à mão, ou serializado e lido de volta, passa pelos limites normais (achado M3).
  - Consequência para o M2-T06/T07: o `HistoricoEdicao` guarda o inverso como o recebeu, sem copiar.
- **Ids.** A unicidade do que se insere é conferida contra seções e blocos do corpo. As operações supõem ids únicos na
  entrada, como a leitura do arquivo garante.

**Pendências para o M2-T07/T08 (revisão do `especialista-documento`, Baixas):**
- conferir a unicidade também contra os ids dos pré e pós-textuais quando eles tiverem blocos (B2);
- criar uma fábrica de seção nova com id no formato do esquema, porque `inserirSecao` não confere o formato (B2);
- memorizar `mapaIndicativos` pela identidade do `corpo` se o editor recalcular a cada transação (B5: 37 ms com
  111 000 seções).

