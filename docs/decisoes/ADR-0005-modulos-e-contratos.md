# ADR-0005 — Módulos, contratos e regras de dependência

- **Status:** ACEITO (2026-10-16; itens visíveis decididos pelo usuário).
- **Data:** 2026-10-16
- **Decisores:** agente `arquiteto-software`. Consultas pendentes: `especialista-documento` (modelo de documento e
  DOCX), `especialista-interface` (editor e UI), `especialista-referencias` (bibliografia) e
  `especialista-elementos-visuais`
- **Etapa/Marco:** Etapa 4; vale a partir do M1
- **Requisitos e riscos relacionados:** RF-03 a RF-15, RNF-11, RNF-12, RNF-13; R01, R05, R18, R19; D1 a D6 da auditoria

## Contexto

O sistema antigo tem quatro implementações das regras (preview, DOCX, PDF e ODT), que divergem entre si.
Há regras fixas no reducer e na interface, e o conteúdo é texto com marcadores frágeis
[VERIFICADO: `docs/relatorios/ETAPA2_AUDITORIA.md`, D1 a D6].

A Etapa 3 produziu 312 regras `RN-xxx`: 283 CONFIRMADA, 5 AMBÍGUA e 24 PENDENTE-FONTE. As decisões do
usuário viram **parâmetros do perfil "UFT 2022"**, não constantes no código [VERIFICADO:
`docs/ESTADO_DO_PROJETO.md`, "Instruções para etapas futuras"; `docs/relatorios/ETAPA3_ANALISE_NORMATIVA.md`, "Decisões do usuário"].

## Alternativas consideradas

| Critério (peso) | A. Camadas com domínio puro + perfil em dados + documento formatado intermediário | B. Exportador lê o modelo e o perfil diretamente | C. Formatação embutida no editor (o modelo já guarda estilos) |
|---|---|---|---|
| Regra num só lugar (RNF-11) (35) | 5 — o motor é o único que lê regras | 3 — cada saída (DOCX, preview, verificador) interpreta o perfil | 1 — regras espalhadas pela UI, como no sistema antigo |
| Testabilidade (25) | 5 — o motor é testável sem DOCX; o DOCX é testável sem regras | 3 | 2 |
| Novo perfil só com dados (RNF-13) (20) | 5 | 4 | 1 |
| Simplicidade inicial (20) | 3 — um tipo intermediário a mais | 4 | 5 |
| **Total (100)** | **92** | **67** | **47** |

## Decisão

Adotar **A**. O **motor normativo** transforma `Documento` (semântico) + `Perfil` (dados) em
**`DocumentoFormatado`**. O exportador DOCX, a pré-visualização e (em parte) o verificador **consomem só o
`DocumentoFormatado`**. Nenhuma outra camada conhece números de regra, medidas ou fontes tipográficas.

### 1. Diagrama de módulos

```text
 PROCESSO RENDERER (Chromium, sandbox, sem Node)              PROCESSO PRINCIPAL (Node)
┌──────────────────────────────────────────────┐      ┌────────────────────────────────────────┐
│ interface/  (React 19)                        │      │ principal/  janela, menus, protocolo    │
│  biblioteca · editor · inspetor · verificador │      │  app://, CSP, fuses, IPC (valida sender │
│  pré-visualização (HTML do DocumentoFormatado)│      │  e argumentos com esquema)              │
└───────────────┬──────────────────────────────┘      ├────────────────────────────────────────┤
                │ chama comandos                       │ persistencia/  .bdp, atômico, backup,   │
┌───────────────▼──────────────────────────────┐      │  recuperação, biblioteca (ADR-0004)     │
│ aplicacao/  serviços e comandos               │ IPC  ├────────────────────────────────────────┤
│  (criarTrabalho, inserirCitacao, moverSecao,  │◄────►│ integracoes/  conversao-pdf (LibreOffice│
│   desfazer/refazer, exportar…)                │ pre- │  após M7) · revisao-texto (LanguageTool │
│  portas: RepositorioProjetos, Exportador,     │ load │  após M7, com consentimento)            │
│  ConversorPdf, RevisorTexto, Relogio          │ tipa-├────────────────────────────────────────┤
└───────────────┬──────────────────────────────┘ do   │ processo utilitário (utilityProcess):   │
                │ usa                                  │  exportacao/docx  ← DocumentoFormatado  │
┌───────────────▼──────────────────────────────────────┴──────────────────┬─────────────────────┘
│ dominio/  (TypeScript puro: sem DOM, sem Node, sem Electron, sem React) │
│  modelo/        Documento, Secao, Bloco, Inline, ids, operações de árvore│
│  normas/        motor: Perfil + Documento → DocumentoFormatado          │
│  bibliografia/  Obra, Citacao, formatadores de referência e chamada     │
│  visuais/       Tabela, Quadro, Figura, Grafico, Equacao (dados)        │
│  numeracao/     seções, ilustrações, tabelas, notas, remissivas (derivada)│
│  verificador/   Documento + Perfil (+ Formatado) → NaoConformidade[]    │
│  esquemas/      validação (zod) e migrações do formato (ADR-0004)       │
└──────────────────────────────────────────┬──────────────────────────────┘
                                           │ lê (dados, sem código)
                           ┌───────────────▼────────────────┐
                           │ perfis/uft-2022/  (JSON)       │
                           │  regras RN-xxx, parâmetros,    │
                           │  tipos de trabalho, estilos    │
                           └────────────────────────────────┘
 importacao/ (principal + domínio): backup tcc-uft (ADR-0004), CSV/XLSX (M5), BibTeX/RIS (M4+), DOCX (após M7)
```

Organização física prevista em `app/src/`, com uma pasta por módulo e o mesmo nome do diagrama. `perfis/`
fica fora de `src/` porque são dados. O esqueleto é criado no M1-T01; esta ADR não cria código.

### 2. Regras de dependência (verificadas por teste: M1-T03)

1. `dominio/*` não importa nada de fora de `dominio/` nem bibliotecas de plataforma. A exceção é
   `zod`, permitido só em `dominio/esquemas`.
2. Dentro do domínio, a direção é única: `modelo` ← `numeracao` ← `bibliografia`/`visuais` ← `normas` ←
   `verificador`. `esquemas` pode importar `modelo`. Ninguém importa `verificador`.
3. `aplicacao/` importa `dominio/` e declara **portas** (interfaces). Não importa `interface/`, `principal/` nem Electron.
4. `interface/` importa `aplicacao/` e os tipos de `dominio/`. **Nunca** importa `dominio/normas` para obter
   valores, nem números RN, nem medidas. Para exibir formatação, usa o `DocumentoFormatado`.
5. `exportacao/docx` importa **apenas** os tipos de `dominio/normas/formatado` e a biblioteca `docx`. Não lê o
   `Perfil` nem o `Documento`.
6. `principal/`, `persistencia/` e `integracoes/` só rodam no processo principal ou no utilitário. São as
   únicas que usam `node:fs`, `child_process` e `electron`.
7. Nenhum módulo monta HTML a partir de dados do usuário. React renderiza estrutura; `dangerouslySetInnerHTML`
   e `innerHTML` são proibidos (teste de varredura).
8. Rede: só `integracoes/revisao-texto` (após o M7). Um teste de varredura falha se `fetch`, `net`, `http` ou
   `https` aparecerem em outro lugar.

### 3. Contratos principais (forma; nomes finais podem ser ajustados pelos especialistas)

**Modelo de documento semântico** (`dominio/modelo`):

```ts
type Id = string;                       // nanoid estável, nunca reaproveitado
interface Documento {
  id: Id; tipoTrabalho: TipoTrabalhoId;  // 'tcc' | 'artigo' | 'dissertacao' | 'tese' | 'relatorio' | 'projeto' | …
  metadados: Metadados;                  // autor(es), título, subtítulo, orientador, curso, local, ano…
  preTextuais: ElementoPreTextual[];     // capa, folhaRosto, ficha, aprovacao, dedicatoria, agradecimentos,
                                         // epigrafe, resumo, abstract … (só conteúdo; ordem e obrigatoriedade vêm do perfil)
  corpo: Secao[];                        // árvore; o nível é derivado da profundidade
  posTextuais: ElementoPosTextual[];     // referencias (gerada), glossario, apendice[], anexo[], indice
  visuais: Record<Id, Visual>;  siglas: Record<Id, Sigla>;  notas: Record<Id, Nota>;
}
interface Secao { id: Id; titulo: Inline[]; blocos: Bloco[]; subsecoes: Secao[]; papel?: 'introducao' | 'conclusao' | … }
type Bloco =
  | { tipo: 'paragrafo'; id: Id; conteudo: Inline[] }
  | { tipo: 'alineas'; id: Id; itens: { conteudo: Inline[]; subitens?: Inline[][] }[] }
  | { tipo: 'citacaoLonga'; id: Id; conteudo: Inline[]; chamada: ChamadaCitacao }
  | { tipo: 'visual'; id: Id; visualId: Id }            // tabela, quadro, figura, gráfico, equação
  | { tipo: 'quebraPagina'; id: Id };                    // só quando a regra permitir (verificador avisa)
type Inline =
  | { tipo: 'texto'; texto: string; marcas?: ('italico' | 'negrito' | 'sobrescrito' | 'subscrito')[] }
  | { tipo: 'citacao'; chamada: ChamadaCitacao }         // obraIds[], forma 'parentetica'|'narrativa', paginas?, apud?
  | { tipo: 'nota'; notaId: Id }
  | { tipo: 'remissiva'; alvoId: Id }                    // seção, visual, nota ou equação
  | { tipo: 'sigla'; siglaId: Id; forma: 'curta' | 'extenso' | 'primeiraOcorrencia' };
```

Invariantes:
- sem números armazenados (seções, figuras e notas são numeradas por `numeracao/`);
- sem HTML;
- citação sem obra é impossível por tipo (RF-07);
- referências a ids inexistentes viram não conformidade, nunca exceção.

**Perfil normativo em dados** (`perfis/uft-2022/*.json`; esquema em `dominio/esquemas`):

```ts
interface Perfil {
  id: 'uft-2022'; versao: string; nome: string;
  fontes: { id: 'M' | 'I' | string; citacao: string; arquivo: string }[];
  parametros: Record<string, ParametroPerfil>;   // decisões do usuário e opções da norma
  regras: RegraNormativa[];
  tiposTrabalho: Record<TipoTrabalhoId, { elementos: { elemento: string; obrigatorio: boolean | 'condicional'; rn: string[] }[] }>;
}
interface ParametroPerfil { valor: unknown; opcoes?: unknown[]; ajustavel: boolean; rn: string[]; origem: 'norma' | 'decisao-usuario-AAAA-MM-DD' | 'provisorio' }
interface RegraNormativa {
  id: `RN-${string}`; status: 'CONFIRMADA' | 'AMBIGUA' | 'PENDENTE-FONTE';  // espelha a matriz
  fonte: string;                                 // "M, p. 15, seção 2.2"
  tipo: 'estilo' | 'estrutura' | 'procedimento' | 'verificacao';
  alvo: string;                                  // papel semântico: 'corpo.paragrafo', 'titulo.nivel2', 'pagina', 'tabela.titulo'…
  propriedades?: Partial<PropriedadesFormatacao>;// para 'estilo' (medidas em unidades do perfil: cm, pt)
  procedimento?: string;                         // para 'procedimento'/'verificacao': id de função registrada no código
  parametros?: string[];                         // chaves de Perfil.parametros que a regra lê
  provisoria?: boolean;                          // PENDENTE-FONTE com decisão do usuário (política, regra 2.2)
}
```

Exemplos de parâmetros vindos das decisões de 2026-10-15:
- `caixaSobrenomeParentetica: "ALTA"` (C-01, NBR 10520:2002);
- `separadorMilhares: "."` (P-C3, RN-261, provisório);
- `apendiceTituloGeral: "centralizado" | identificação "esquerda"` (C-B17, RN-237);
- `etAl` configurável (C-B12);
- `numeracaoTabelas: "continua"` (RN-244);
- `sinalZero: "–"` (P-C10, RN-264);
- `resumoPalavras: [150, 500]` (C-B6, RN-154);
- `folhaAprovacaoRelatorio: "opcional"` (C-B11).

As 5 ambíguas (RN-025, 033, 073, 085, 108) entram como parâmetro **sem valor padrão**. Enquanto o usuário
não decidir, o motor não aplica a regra, e o verificador mostra "regra aguardando decisão".

**Motor normativo** (`dominio/normas`):

```ts
function formatar(doc: Documento, perfil: Perfil, ajustes: AjustesProjeto): DocumentoFormatado;
interface DocumentoFormatado {
  perfil: { id: string; versao: string };
  estilos: EstiloResolvido[];                    // estilos nomeados ("BDP Corpo", "BDP Título 1"…) com propriedades em twips/meios-pontos
  secoesPagina: SecaoPagina[];                   // tamanho, margens, orientação, numeração (início, exibida ou não, posição)
}
interface SecaoPagina { pagina: PropriedadesPagina & { origem: string[] }; cabecalho?: BlocoFormatado[]; blocos: BlocoFormatado[] }
type BlocoFormatado =
  | { tipo: 'paragrafo'; estilo: string; trechos: TrechoFormatado[]; quebraAntes?: boolean; origem: string[] }
  | { tipo: 'tabela'; …; origem: string[] } | { tipo: 'imagem'; …; origem: string[] } | { tipo: 'equacao'; omml: OmmlNo; … }
  | { tipo: 'campo'; campo: 'TOC' | 'SEQ' | 'PAGE' | 'PAGEREF'; instrucao: string; textoInicial?: string; origem: string[] }
  | { tipo: 'nota'; …; origem: string[] };
type TrechoFormatado = { texto: string; negrito?: boolean; italico?: boolean; caixa?: 'alta' | 'normal'; … }
                     | { campo: 'SEQ' | 'PAGEREF' | 'NOTA'; … };
```

- Toda propriedade e todo bloco carregam `origem: RN-xxx[]` (RF-05: um teste falha se aparecer formatação sem RN).
- A numeração, as chamadas de citação e as referências já chegam **resolvidas em texto e estrutura**.
- O motor é **determinístico e puro**. Desempenho: a formatação é incremental por seção, com cache por hash
  do conteúdo [HIPÓTESE de necessidade; medir com 150 páginas antes de otimizar].

**Bibliografia** (`dominio/bibliografia`):
- `Obra` é tipada por `tipo` (livro, capítulo, artigo, evento, site, monografia/dissertação/tese,
  legislação…), com campos estruturados: autores com sobrenome e prenome **separados** (corrige "Filho/Júnior")
  e `instituicao` com `sigla`.
- `formatarReferencia(obra, perfil): TrechoFormatado[]` e `formatarChamada(chamada, obras, perfil): TrechoFormatado[]`,
  com saída estruturada e **nunca HTML** (D3, S-1).
- `ordenar(obras, perfil)` e `obrasCitadas(doc)`.
- Contratos detalhados: `especialista-referencias`.

**Elementos visuais** (`dominio/visuais`):
- Dados: `Tabela` (células tipadas, número como valor + formato pt-BR), `Quadro`, `Figura` (mídia por
  sha256), `Grafico` (especificação + id da tabela de origem), `Equacao` (origem LaTeX restrito + árvore).
- Porta `RenderizadorVisual`, que devolve `{tipo:'tabelaNativa'} | {tipo:'imagem', png, larguraCm} | {tipo:'equacaoOmml'}`.
  A rasterização de gráficos roda no renderer (canvas) e o PNG é enviado à exportação. O gráfico nativo do
  Word (`docx` ≥ 9.8) fica como opção a avaliar no M5.
- Contratos detalhados: `especialista-elementos-visuais`.

**Verificador** (`dominio/verificador`):

```ts
function verificar(doc: Documento, perfil: Perfil, formatado?: DocumentoFormatado): NaoConformidade[];
interface NaoConformidade { id: string; rn: string; severidade: 'erro' | 'aviso' | 'info'; local: { blocoId?: Id; secaoId?: Id; caminho: string };
                            mensagem: string; sugestao?: string; regraProvisoria?: boolean }
```

Regras do tipo `verificacao` são funções registradas por id e ligadas a um RN no perfil. Exemplos: resumo
fora de 150–500 palavras, obrigatório ausente, citação órfã, remissiva quebrada, figura abaixo de 150 ppi.
Roda no renderer, com espera, ou num Web Worker se a medição pedir.

**Exportação** (`exportacao/docx`, processo utilitário):

```ts
function exportarDocx(f: DocumentoFormatado, midias: (sha256: string) => Uint8Array): Promise<Uint8Array>;
```

- Mapeamento 1:1: estilos nomeados próprios (corrige E-5), seções, campos, notas reais
  (`FootnoteReferenceRun`), tabelas nativas e OMML.
- Não toma nenhuma decisão normativa. Uma decisão encontrada no exportador é defeito.

**Persistência e IPC** (processo principal; ADR-0004). API exposta pelo preload em `window.bibliodocs`,
validada no principal com esquema e `sender`:
- `projetos.listar()`, `projetos.criar(tipo)`, `projetos.abrir(id | dialogo)`, `projetos.salvar(id, pacote)`;
- `projetos.salvarRecuperacao(id, pacote)`, `projetos.duplicar`, `projetos.renomear`, `projetos.excluir`;
- `exportar.docx(formatado, destino via diálogo)`;
- após o M7: `exportar.pdf(...)` e `revisao.verificar(...)`.

O renderer **nunca recebe caminhos arbitrários** para gravar. O destino vem sempre de um diálogo aberto pelo principal.

**Estado e comandos** (`aplicacao/`):
- o renderer mantém o `Documento` em memória (fonte da verdade durante a edição);
- toda mudança é um **comando** tipado (substitui `SET_CAMPO` genérico, D4), com inverso para desfazer/refazer;
- a numeração é derivada, nunca gravada no reducer (D4).

### 4. Processo principal × renderer

| Função | Onde roda | Motivo |
|---|---|---|
| UI, edição, motor normativo, verificador, pré-visualização | Renderer | Resposta imediata; o domínio é puro |
| Arquivos, diálogos, recuperação, biblioteca, LibreOffice, rede opcional | Principal | Só o principal tem Node; superfície controlada |
| Exportação DOCX | Processo utilitário (`utilityProcess`) | Não trava a UI (S-12); recebe o `DocumentoFormatado` serializado |

O motor roda no renderer para pré-visualizar e no utilitário de novo antes de exportar, a partir do mesmo
`Documento`. É o mesmo código nos dois lugares, não uma segunda implementação.

### 5. Respostas às questões em aberto (`docs/ARQUITETURA_PRELIMINAR.md`, seção 6)

1. **Reaproveitar código ou só lógica?** Só a **lógica**, portada para TS com testes:
   - `abnt.js`: funções puras para `bibliografia/` e `numeracao/`, ligando cada regra a um RN e corrigindo os
     defeitos da auditoria (chamada institucional, sigla, fronteira de palavra);
   - `templates.js`: árvores de seções viram dados de `tiposTrabalho` no perfil, com obrigatoriedade e RN;
   - `exports.js`: esqueleto de seções, campos e paisagem como **referência** do `exportacao/docx`;
   - `visual-editor.js`: geradores SVG adaptados atrás de `RenderizadorVisual` (M5).
   - Constantes antigas só entram com RN (R19). Nada de `vendor/` é copiado.
2. **Paginação.** A paginação **final é do editor de texto do usuário**: campos `PAGE`, `TOC`, `SEQ` e
   `PAGEREF` no DOCX. O app **não calcula** a paginação definitiva.
   - Para o sumário não sair vazio, o exportador escreve as entradas do TOC a partir dos títulos (recurso do
     `docx` [VERIFICADO na documentação]) e mantém `updateFields` para o Word atualizar ao abrir.
   - O pré-preenchimento dos números por `docx/layout` (`estimatePageNumbers`) é **estimativa**. Usar só se a
     PoC mostrar números corretos na maior parte dos casos (R05, R31). Senão, o TOC sai sem números até a atualização.
   - **Visível:** o usuário verá ou não a pergunta "atualizar campos?" do Word ao abrir. Decisão depois da PoC.
   - Verificações dependentes de página (ex.: título como última linha da página, RN-005) usam o PDF do
     LibreOffice quando disponível. Sem ele, ficam como "não verificável".
3. **Equações.** **OMML nativo**, editável no Word, gerado pelo `docx/math`. A entrada no app é um
   subconjunto de LaTeX convertido para a árvore `Equacao` (`latexToMath` como referência). O número da
   equação vai em parágrafo com tabulação à direita, recomendação da própria documentação do `docx` para
   igualar Word e LibreOffice. O alinhamento depende de RN-108 (AMBÍGUA, decisão do usuário).
   - **Imagem** só como alternativa para construções que o conversor não suporte, com aviso.
   - Pré-visualização na UI por MathML (Chromium suporta MathML Core [HIPÓTESE, conferir no M5]).
4. **Pré-visualização.** Duas camadas:
   - (a) **Pré-visualização interna aproximada:** HTML/CSS gerado a partir do **mesmo `DocumentoFormatado`**,
     em "folhas" A4 com as margens do perfil e quebras de página só onde o modelo as declara (sem
     paginação calculada). Fica sempre disponível e offline, e não cria uma segunda fonte de regras.
   - (b) **Pré-visualização fiel:** PDF gerado do DOCX pelo LibreOffice, exibido no visualizador de PDF do
     Chromium/Electron [HIPÓTESE de suporte, conferir]. Só após o M7 e só com LibreOffice instalado,
     coerente com a decisão (b) do usuário.

### 6. Decisões do usuário (2026-10-15) e seu lugar na arquitetura

- **LanguageTool:** opcional, desligado por padrão, com consentimento, após o M7.
  - Porta `RevisorTexto` em `aplicacao/`; adaptador em `integracoes/revisao-texto` no principal.
  - Preferência `revisaoOnline.consentido` com padrão `false`, gravada fora do projeto.
  - Sem o adaptador, o app funciona igual. A remoção futura é só apagar o adaptador.
- **PDF:** só DOCX no MVP; após o M7, conversão pelo LibreOffice.
  - Porta `ConversorPdf`; adaptador em `integracoes/conversao-pdf`.
  - Sem motor PDF próprio.
  - Botão desabilitado com explicação quando `localizarSoffice()` não encontra o executável.

## Consequências

- **Positivas:**
  - Uma única implementação de regra.
  - Cada saída é testável isoladamente.
  - Novo perfil só com dados.
  - Exportador simples e sem decisões.
  - Fronteiras verificadas por teste.
- **Negativas / custos:**
  - O `DocumentoFormatado` é um tipo grande, que precisa evoluir com cuidado (versão interna, não persistida).
  - Formatar duas vezes (renderer e utilitário) custa CPU [HIPÓTESE: irrelevante abaixo de 150 páginas; medir].
  - O editor de texto rico ainda não foi escolhido: ProseMirror, Lexical ou outro. O mapeamento editor ↔
    `Bloco/Inline` é trabalho do `especialista-interface`, com ADR próprio antes do M2.
- **O que muda:**
  - Estrutura de `app/src/` no M1-T01.
  - Teste de fronteiras no M1-T03.
  - Perfil `uft-2022` criado no M3 a partir da matriz pelo `especialista-normas` (dados), com teste RNF-11.

## Critério de reversão

- Se o `DocumentoFormatado` exigir decisões que só o exportador sabe tomar (ex.: algo que depende da
  paginação real), mover aquela decisão para um campo do Word e documentar, sem pôr regra no exportador.
- Se a formatação no renderer passar de 50 ms por tecla (RNF-06) no documento de 150 páginas, mover motor e
  verificador para um Web Worker; o contrato não muda.

## Verificação

- `npm run verificar` inclui:
  - o teste de fronteiras (imports proibidos);
  - a varredura de `innerHTML`/`dangerouslySetInnerHTML` e de rede;
  - o teste "toda propriedade do `DocumentoFormatado` tem `origem` RN existente na matriz" (a partir do M3).
- Revisão dos contratos com os especialistas citados, registrada no relatório da Etapa 4.


## Decisões do usuário (2026-10-16)
- Sumário e listas: o DOCX sai com números de página **estimados** (`docx/layout`, validado na PoC: 52/52 iguais ao
  LibreOffice) **e** com `updateFields` para o Word oferecer a atualização ao abrir. A combinação dos dois é
  verificada no M3 (abertura no Word pelo usuário).

## Adendo técnico — interpretação das regras no teste de fronteiras (M1-T03, 2026-10-16)
Decisões técnicas da sessão principal ao implementar `app/tests/arquitetura-fronteiras.test.ts`. Elas não mudam o resultado
visível do documento.
- **Regra 2:** "A ← B" significa "B importa A". A tabela `PERMISSOES_DOMINIO` em `app/tests/apoio/analisador-fontes.ts` é a forma
  executável da regra:
  - modelo: nada;
  - numeracao: modelo;
  - bibliografia e visuais: modelo e numeracao, mas não um ao outro;
  - normas: os quatro anteriores;
  - verificador: todos, inclusive esquemas;
  - esquemas: modelo.

  `normas → esquemas` fica proibido enquanto não houver necessidade justificada.
  "Ninguém importa verificador" vale dentro do domínio; `aplicacao` pode importá-lo.
  O agregador `dominio/index.ts` não reexporta `normas` nem `verificador`, para não abrir um atalho que contorne a regra 4.
- **Regras 4 e 5:** `interface` e `exportacao/docx` usam apenas `import type` do domínio. De `dominio/normas`, só podem importar
  tipos de `dominio/normas/formatado`.
- **Regras 3 e 6:** um import de `node:*` ou `electron` conta como violação mesmo quando é só de tipo.
- **Regra 3, acréscimo:** `aplicacao` também não importa `persistencia`, `integracoes` nem `preload`; os adaptadores entram por
  portas declaradas em `aplicacao/`.
- **Regra 6:** `importacao` não usa `node:fs`. A leitura do arquivo fica em `persistencia`/`principal`, e `importacao` recebe os
  bytes. Rever esta regra se o M4/M5 mostrar que ela não se sustenta.
- **Observação:** o `tsconfig.puro.json` não impede `import 'electron'` no domínio, porque o typecheck passa. Quem garante a
  regra 1 é o teste de fronteiras.
- **Imports com especificador calculado** (`import(x)`, `require` com template) são recusados, porque não podem ser analisados.

## Adendo técnico — IPC tipado (M1-T08, 2026-10-16)
Decisões técnicas da sessão principal, revisadas pelo `revisor-seguranca` (achados S8-01 a S8-07, no relatório do M1).
- **Onde mora o contrato:** `app/src/aplicacao/portas/projetos.ts` (canais e tipos). A interface importa só os tipos;
  o preload importa só os nomes dos canais; o principal implementa. Nenhum módulo novo no ADR.
- **API do M1-T08:** `projetos.abrir()`, `projetos.salvar(identificador, pacote)`, `projetos.salvarComo(pacote)` e
  `projetos.fechar(identificador)`. `listar`, `criar`, `duplicar`, `renomear`, `excluir` (M1-T09) e
  `salvarRecuperacao` (M1-T12) entram nas tarefas deles.
- **Sem caminhos no renderer (C-12, M6-11):** o arquivo aberto é um identificador opaco de 128 bits, ligado ao
  `webContents` que o recebeu e esquecido quando a janela fecha, recarrega ou navega. O renderer recebe só o nome do
  arquivo. Arquivo aberto sem a extensão `.bdp` recebe identificador `null` e só grava por "Salvar como".
  Projeto de versão futura nunca recebe identificador.
- **Forma transferível:** mídias em lista (`{sha256, bytes: Uint8Array}`), sem `Map`. Conferido no Electron 44.8.0 que
  o `Uint8Array` atravessa o `contextBridge` e o `utilityProcess` [VERIFICADO, fumaça].
- **Recusa × erro:** remetente não permitido ou argumento fora do contrato rejeita a promessa (`ErroIpcRecusado`,
  mensagem genérica, motivo só no log). Conteúdo inválido do usuário, cancelamento e falha de gravação voltam como
  resultado `ok: false` com mensagem pt-BR. A lista de erros devolvida tem o limite `LIMITES_V1.errosRelatados`.
- **Limite de tamanho (C-11):** o Electron desserializa antes do manipulador; o limite (mídias, total até 1 GB) é
  conferido logo depois. Aceito enquanto o renderer for só a interface do próprio app.

## Adendo técnico — casca da interface (M1-T10, 2026-10-16)
Decisões técnicas da sessão principal; as escolhas visíveis são do usuário (`docs/GUIA_VISUAL.md`).
- **Organização de `src/interface/`:** `casca/` (faixas, menus, abas, visor), `biblioteca/` (grade, barra lateral,
  detalhes, hook de estado), `estilos/` (tokens e layout) e `Icones.tsx`. Regras de teclado, filtros e textos ficam em
  arquivos `.ts` puros (`casca/teclado.ts`, `casca/visor.ts`, `biblioteca/selecao.ts`), testados em Node.
- **Testes de componente sem dependência nova:** `tests/interface/*.test.tsx` renderiza com `react-dom/server` em Node
  e é checado pelo `tsconfig.web.json` (sem tipos do Node), para valer a mesma restrição do renderer. Interação real
  (foco, clique) fica para o E2E do M1-T13; até lá, fumaça com o Electron dirigido por CDP (roteiro no relatório).
- **API injetada:** `Aplicativo` recebe `api: ApiBiblioDocs` por propriedade (`main.tsx` passa `window.bibliodocs`),
  para ser renderizado nos testes sem `window`.
- **Menus desenhados pela interface:** a barra de menus faz parte do layout de referência, então o menu nativo do
  Electron fica nulo também no desenvolvimento (antes só no app empacotado, C-15). Fora do app empacotado, F12 abre as
  DevTools (`before-input-event`); no empacotado `devTools: false` continua valendo.
- **Teclas com Ctrl/Alt/Windows** pertencem aos atalhos globais; grade, abas e menus as ignoram (`temModificador`).
  Achado da fumaça: sem isso, Alt+Seta numa aba trocava de aba e voltava no histórico ao mesmo tempo.
- **Criar no M1-T10:** sem editor, o trabalho criado é fechado logo após `biblioteca.criar` (o identificador de gravação
  não fica preso) e aparece selecionado. O M1-T11 passa a mantê-lo aberto.
