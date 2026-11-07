# Revisão de segurança, qualidade e fidelidade normativa — fechamento do marco M4

- **Data:** 2026-11-07
- **Escopo:** commits `1c15b3a` (M4-T00) a `e92bd61` (M4-T09), feitos sem revisão independente (`M4_RELATORIO_MARCO.md`).
- **Executado por:** dois revisores independentes, rodados como agentes gerais em paralelo. Os dois eram só de leitura; as sondas ficaram fora do repositório e foram apagadas.
  - Segurança, integridade e qualidade: seguiu `.claude/agents/revisor-seguranca.md`.
  - Fidelidade normativa: seguiu `.claude/agents/especialista-normas.md`. Comparou com o texto do Manual e com as fontes (negrito e itálico) extraídas do PDF.
- **Correções, reverificação e consolidação:** sessão principal.
- **Skill:** `revisao-seguranca-qualidade`.

## Resumo

| Revisão | Crítica | Alta | Média | Baixa | Info |
|---|---|---|---|---|---|
| Segurança e integridade (R-M4) | 0 | 1 | 2 | 4 | 2 |
| Normativa (N-M4) | 0 | 1 | 5 | 6 | 6 |

- **Corrigidos nesta tarefa (sessão principal):**
  - segurança: R-M4-01, 02, 03, 05, 06, 07 e 09;
  - normas: N-M4-04, 05, 06, 07, 08, 09 e 10, e o comentário do N-M4-11;
  - N-M4-03 registrado na matriz (D-M4-11), porque já era decisão do usuário.
- **Aguardam o usuário (mudam o documento sem fonte clara):** N-M4-01, N-M4-02, N-M4-12 e o estreitamento da D-M4-10 (N-M4-11).
- **Abertos, de baixa prioridade:** R-M4-04 e R-M4-08; N-M4-13 a 18 (informativos).

## Achados corrigidos

| ID | Sev. | Problema | Correção |
|---|---|---|---|
| R-M4-01 | **Alta** | Macros `@string` do BibTeX dobravam de tamanho a cada linha. Um arquivo de 1 KB travava a tela por 21 s; com 26 dobras, `RangeError`. [VERIFICADO pelo revisor] | Teto de 20 mil caracteres por valor, já com as macros, e de 4 milhões na soma do arquivo. Campo cortado e leitura interrompida vêm com aviso. Teste: 30 dobras e 8 entradas terminam em menos de 3 s, com aviso |
| R-M4-02 | Média | Regex com custo quadrático: `detectarFormato` (`^\s*` com a flag `m`), o recomeço depois de entrada quebrada (`\n\s*@`) e `dividirAutores` (`\s+and\s+`). 200 mil quebras: 35 s | `[ \t]*` no lugar de `\s*`; recomeço por laço linear (`proximaLinhaComArroba`); espaços normalizados antes de dividir os autores. Teste: 200 mil quebras e 80 mil espaços, menos de 1,5 s cada |
| R-M4-03 | Média | Cada colagem reconhecia chamadas na seção inteira, duas vezes, e remontava o formatador e uma regex por obra em cada parágrafo. Com 1.000 obras: 8,3 s | `reconhecedorDeChamadas(obras)` é montado uma vez por lista de obras (`useMemo`), com uma regex só. A colagem examina só os blocos que mudou (`blocosMudados`), e "Ligar às obras" age só neles. Isso também resolve a limitação do M4-T07 de oferecer de novo chamadas deixadas como texto. Teste: 1.000 obras e 600 parágrafos em menos de 3 s |
| R-M4-05 | Baixa | Erro na leitura do arquivo importado sumia em silêncio (promise rejeitada) | `try/catch` com o aviso "não pôde ser lido" |
| R-M4-06 | Baixa | `@constructor` encontrava a chave herdada em `TIPOS_BIBTEX` e virava obra sem tipo (a validação barrava, mas a mensagem saía errada) | `Object.hasOwn` nas duas tabelas de tipos e nas origens provisórias. Teste em BibTeX e RIS |
| R-M4-07 | Baixa | Regex da chamada narrativa no verificador era quadrática numa lista longa de nomes | Até 11 sobrenomes na lista. Teste: 120 mil caracteres em menos de 0,8 s |
| R-M4-09 | Info | Chave e tipo do arquivo sem limite de tamanho | Cortados em 200 caracteres |
| N-M4-04 | Média | Chamada narrativa sem ano e sem página saía "Lima ()" | Sai "Lima", com o aviso de obra sem ano. Teste |
| N-M4-05 | Média | Importação: o tipo BibTeX passava por cima do `type` com a área, e a natureza "Trabalho acadêmico" era inventada sem aviso | O `type` (e o M3 do RIS) vem primeiro. Sem ele, `@phdthesis`/`@mastersthesis` mantêm a categoria com o aviso "acrescente a área" (RN-206). `@thesis` e RIS sem M3 ficam sem natureza, e a referência avisa |
| N-M4-06 | Média | Regras PENDENTE-FONTE e decisões D-M4 aplicadas sem marca de provisórias na interface (POLÍTICA §2.2) | `ORIGENS_PROVISORIAS` e `origensProvisorias` (domínio). A prévia da obra e a janela da citação mostram "Forma provisória, sem fonte no Manual: …", a partir das origens dos trechos. O relatório de conformidade fica para o M7 |
| N-M4-07 | Baixa | A importação tirava o `https://doi.org/` do DOI (forma sem fonte, PF-09 i; o único exemplo do Manual traz a URL) | O DOI fica como veio no arquivo |
| N-M4-08 | Baixa | "editor" virava "(ed.)" sem aviso; o A3 do RIS (autor terciário) também | Aviso "confira se a função é org., coord. ou ed. (RN-186)". O A3 fica de fora, listado |
| N-M4-09 | Baixa | "Silva Neto", sem prenome, invertia para NETO, Silva | Duas palavras terminadas em sufixo de parentesco: o nome todo é o sobrenome (RN-181). Teste |
| N-M4-10 | Baixa | A mensagem da CHAMADA_AMBIGUA mandava "acrescentar o prenome", sem fonte e sem como fazer na chamada gerada | Só informa e cita a pendência de fonte (RN-096) |
| N-M4-11 | Baixa | Comentário da D-M4-10 descrevia um agrupamento que o código não faz | Comentário corrigido. O estreitamento da regra é decisão do usuário (abaixo) |
| N-M4-03 | Média | Apud: original e consultada entram as duas na lista, sem linha na matriz | Era decisão do usuário de 2026-11-07 (relatório do M4-T05 e adendo do ADR-0004). Agora está registrada como D-M4-11 |

## Aguardam decisão do usuário

| ID | Sev. | Questão | Recomendação |
|---|---|---|---|
| N-M4-01 | Alta | "[S. l.]" e "[s. n.]" saem sem itálico. Em todos os exemplos do Manual (p. 54, 55, 59, 62), "S. l." e "s. n." estão em itálico, com os colchetes em redondo [VERIFICADO pelo revisor nas fontes do PDF]. A RN-193 e a D-M4-05 não falam de itálico | **Itálico**, como em todos os exemplos. Complementa a D-M4-05 |
| N-M4-02 | Média | Título iniciado por artigo: a lista sobe só a primeira palavra ("OS perigos…"), mas a chamada sobe duas ("OS PERIGOS..."). O único exemplo de lista (p. 63) mostra "OS PERIGOS do uso de tóxicos". PF-09 (f) não foi decidida | **Duas palavras na lista**, como na p. 63 e na chamada (RN-091) |
| N-M4-12 | Baixa | Obras "SILVA, A. *et al.*" do mesmo primeiro autor e ano são ordenadas pelos coautores ocultos, então o leitor vê títulos fora de ordem | **Autoria visível**: com *et al.*, desempatar pelo título |
| N-M4-11 | Baixa | A D-M4-10 gera falso positivo: "SILVA, Ana" × "SILVA, Antônio" (mesma inicial) | Avisar só quando os prenomes por extenso diferirem em até 2 letras ("Luiz" × "Luis"), além do acento no sobrenome |

## Achados abertos

### Segurança e integridade
- **R-M4-04 (Baixa):** `alterarSecao` aceita citação a obra inexistente, e o envio para gravar acontece. O processo principal recusa o documento antes de gravar, então não há arquivo corrompido, só falha ao salvar. O revisor não chegou a esse estado pela interface: a ordem única de desfazer desfaz primeiro a exclusão da obra. Fica para o próximo incremento que mexer na sessão: conferir citações × obras antes de salvar, com mensagem clara.
- **R-M4-08 (Info):** URL ou data inválida tira o registro inteiro da importação, em vez de descartar só o campo. É seguro; a melhora é de usabilidade.

### Normativos (informativos)
- **N-M4-13:** o Manual põe em itálico só "et al", sem o ponto; o app põe o ponto também em itálico. Diferença visual mínima.
- **N-M4-14:** o exemplo ANTEPROJETO de lei (p. 24) não tem negrito no periódico. É provável inconsistência do Manual, porque o exemplo MUITO por fazer (p. 56) tem.
- **N-M4-15:** "Histórico ABNT. São Paulo, 2006." (p. 70) sem editora. O app gera "[s. n.]", como manda a D-M4-05.
- **N-M4-16:** evento no todo (RN-207) não tem formatador próprio; fora do D-M4-06.
- **N-M4-17:** formas coerentes, mas sem fonte: "[2016a?]", obra sem ano no fim do grupo e título de entrada em maiúsculas também na narrativa.
- **N-M4-18:** pontuação final em volta da chamada (D-M4-01) segue sem implementação. Fica para o verificador do M7.
- **Exemplos do Manual sem teste:** Lei nº 11.310 (p. 60; o formatador acerta), itens da lista das p. 70–71, DOREA com 6 autores e ZUBEN com 7.

## Conferido e correto (resumo dos dois revisores)
- **Interface:**
  - nenhum `innerHTML`, `dangerouslySetInnerHTML`, `eval` nem `new Function`;
  - a chamada é montada com `createTextNode` e `textContent`;
  - URL e DOI não viram link.
- **Colagem:**
  - `chamadaCitacao` não tem `parseDOM`, então colar nunca cria citação;
  - a nota cola só texto;
  - os ids repetidos são corrigidos pelo plugin de ids únicos, inclusive o `cta_`.
- **Importação:**
  - os laços sempre avançam e os limites são respeitados;
  - `__proto__` não vira campo;
  - tudo passa por `prepararObra` e `validarObra`;
  - 2 MB válidos em 24 ms.
- **Sessão:**
  - a importação gera ids sem colisão e entra num passo só do desfazer;
  - obra citada não sai nem pela exclusão nem pelo desfazer.
- **Gravação:** o empacotamento e o IPC validam o documento inteiro, inclusive citação sem obra.
- **Fronteiras ADR-0005:** respeitadas.
- **Dependências:**
  - nenhuma dependência nova;
  - `npm audit --omit=dev`: 0;
  - 7 avisos moderados, só nas ferramentas de empacotamento (R35).
- **Normas:**
  - as chamadas das p. 22–26 conferem caractere a caractere, inclusive "apud" e "grifo" sem itálico;
  - CANDIDO "v. 2" confere, também em nota;
  - as referências testadas saem iguais ao Manual, com o negrito e o itálico do PDF;
  - autoria (RN-180 a 187), datas, edição, ordenação, sufixos a/b e as decisões C-01, C-B10, C-B12, C-B15, C-B16 e D-M4-02 a 10 estão aplicados como registrado;
  - no DOCX, o estilo `referencia` está alinhado à esquerda, em espaço simples, com 12 pt depois, sem recuo (RN-177, RN-034).

## Não verificado
- **Na interface em execução:** travamento visível e mensagem de falha ao salvar. Prévia e janelas só foram vistas pelos E2E.
- **Ordem única de desfazer:** se ela pode reintroduzir citação órfã num ramo novo do histórico (R-M4-04).
- **Exportações reais:** BibTeX e RIS do Zotero e do Mendeley.
- **Desempenho no documento de 150 páginas:** o verificador e a exportação não foram medidos com muitas citações.
- **Tipos fora da primeira leva:** não foram verificados.

## Comandos executados (em `app/`)

| Comando | Resultado |
|---|---|
| Revisores: `npx vitest run`, `npm run typecheck`, `npm audit` e sondas de tempo fora do repositório | 1685/1685; sem erro de tipos; audit sem alto |
| `npx vitest run` depois das correções | 1695/1695 |
| `npm run verificar:tudo` | ver a reverificação abaixo |

## Reverificação (2026-11-07)

`npm run verificar:tudo` passou com as correções: 1695 testes unitários, 27 externos e 25 de 25 E2E. O pico de memória foi de 757 MB. O `npm audit` não mostrou nenhum aviso alto, só os mesmos 7 moderados de antes (R35).
