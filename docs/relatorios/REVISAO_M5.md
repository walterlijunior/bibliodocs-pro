# Revisão de segurança, qualidade e fidelidade normativa — fechamento do marco M5

- **Data:** 2026-11-08
- **Escopo:** commits `d74f884` (M5-T00) a `f095daf` (M5-T09): tabela e quadro, colagem de planilha e CSV, figuras,
  equações, remissivas e gráfico gerado de tabela (`M5_RELATORIO_MARCO.md`).
- **Executado por:** dois revisores independentes, rodados em paralelo como agentes gerais, só de leitura. As sondas
  ficaram fora do repositório e foram apagadas.
  - Segurança, integridade e qualidade: seguiu `.claude/agents/revisor-seguranca.md`. Montou sondas com o código real
    (`rolldown` do próprio projeto).
  - Fidelidade normativa: seguiu `.claude/agents/especialista-normas.md`. Conferiu as p. 17–20 e 27 do Manual pelas
    imagens do PDF e o XML dos instantâneos.
- **Correções, medições, reverificação e consolidação:** sessão principal.
- **Skill:** `revisao-seguranca-qualidade`.

## Resumo

| Revisão | Crítica | Alta | Média | Baixa | Info |
|---|---|---|---|---|---|
| Segurança e integridade (R-M5) | 0 | 1 | 1 | 2 | 5 |
| Normativa (N-M5) | 0 | 1 | 5 | 6 | 5 |

- **As duas Altas foram corrigidas** (R-M5-01 e N-M5-01). Nada bloqueia o fechamento do marco.
- **Corrigidos nesta tarefa:**
  - segurança: R-M5-01, 02, 03, 04, 06, 07 e 08;
  - normas: N-M5-01, 02, 03, 05 (parcial), 08 e 11.
- **Decididos pela sessão principal por delegação do usuário (provisórios, na matriz):** N-M5-04 (D-M5-52) e N-M5-08
  (D-M5-53).
- **Abertos:**
  - segurança: R-M5-05 e R-M5-09;
  - normas: N-M5-06, 07, 09, 10, 12 e 13 a 16 (informativos).

## Achados corrigidos

| ID | Sev. | Problema | Correção |
|---|---|---|---|
| R-M5-01 | **Alta** | Laço sem fim no desenho do gráfico. Uma célula com "17" e 307 zeros (1,7e308) levava a escala a `Infinity`, e o laço das marcas crescia um array até `RangeError` (1,8 s e cerca de 1 GB). Uma célula digitada ou um `.bdp` hostil disparava o problema a cada abertura. [VERIFICADO pelo revisor] | Quatro barreiras: (1) `lerNumero` deixa sem valor o que passa de 10¹⁵ (`VALOR_MAXIMO`), e o gráfico avisa "um valor grande demais ficou fora"; (2) `escalaRedonda` devolve 0–1 para entrada que não é finita e confere o resultado; (3) o laço das marcas para em 50 voltas; (4) o desenho na tela, na prévia e no PNG exportado fica em `try/catch`, e a falha deixa o gráfico sem imagem em vez de derrubar a seção. Testes: 1,7e308, −1,7e308 e 309 algarismos nas quatro formas, em menos de 500 ms, e escala com `Infinity` e ±1e308 |
| N-M5-01 | **Alta** | A "Fonte:" da figura e do gráfico saía na margem do texto, não rente à borda esquerda da imagem centralizada. Contraria o Manual (p. 17, Quadro 1, e o exemplo da p. 19) e a decisão C-A4 do usuário. A Figura 1 do corpus (50,8 mm) tinha a fonte cerca de 54 mm à esquerda da imagem. [VERIFICADO pelo revisor] | O rodapé da figura e do gráfico ganha recuo esquerdo de (área útil − largura da imagem) / 2, com a RN-057 na origem. A tabela e o quadro, de largura inteira, ficam sem recuo. Testes: XML do documento difícil (`w:ind w:left="3096"` na Figura 1) e motor do gráfico (284 twips para 150 mm) |
| R-M5-02 | Média | Regex quadrática na tabela colada: `/^\n+\|\n+$/` sobre uma sequência longa de quebras. 80 mil `<br>` levavam 2 s. [VERIFICADO pelo revisor] | Primeiro junta as quebras repetidas (linear) e só depois tira uma de cada ponta. Teste: 200 mil `<br>` em menos de 1 s (medido: 204 ms) |
| N-M5-02 | Média | Tabela sem linha de cabeçalho saía com dois traços, sem aviso (IBGE p. 14–15, seções 4.3 e 4.4). | Aviso `TABELA_SEM_CABECALHO`, só para a espécie tabela (RN-251, RN-255) |
| N-M5-03 | Média | O aviso de tabela longa sugeria "Divida-a". Dividir cria tabelas com número novo e fonte em cada parte, o que contraria o IBGE p. 29, seção 8.3. | Texto novo: o cabeçalho se repete, mas o título e o "continua / continuação / conclusão" não; conferir no documento exportado |
| N-M5-05 | Média (parcial) | Regras provisórias não aparecem como tais (Política, seção 2, item 2). | O aviso `SEM_REMISSIVA` diz "recomendação provisória, sem fonte no Manual". A marca nas janelas de tabela e equação fica para o relatório de conformidade do M7, como no N-M4-06 |
| R-M5-03 | Baixa | A leitura de CSV e de texto colado guardava todas as linhas antes de cortar em 5.000. 4 MB só de quebras eram 4,2 milhões de linhas e cerca de 940 MB. | `lerTextoSeparadoComLimite` guarda no máximo 5.001 linhas e 64 campos por linha e só conta o que passa e tem texto. O relatório da planilha continua dizendo quantas linhas e células ficaram de fora. O texto colado usa o mesmo limite (`lerTextoColado`). Testes: 4 MB de quebras, 6.000 linhas e 100 colunas |
| R-M5-04 | Baixa | Documento com mais de 500 gráficos não exportava: o principal recusava o canal inteiro. | O renderer manda no máximo 500 PNG. Os demais gráficos saem sem a imagem, com aviso |
| R-M5-06 | Info | A altura do gráfico no DOCX vinha da proporção declarada no PNG recebido. Um PNG de 1 × 100000 px faria uma imagem absurda. | Largura e altura saem do domínio (`tamanhoGraficoMm`). Teste com um PNG de 1 × 2000 px |
| R-M5-07 | Info | Um `pHYs` com 0 pixels por metro dava `ppi: 0`, e a largura natural virava `Infinity`. | Resolução abaixo de 10 ppi vale como ausente (96 ppi). Teste com o `pHYs` zerado |
| R-M5-08 | Info | Um `OffscreenCanvas` por retângulo com padrão, a cada pintura. | Um ladrilho por padrão em cada pintura |
| N-M5-11 | Baixa | Linhas do IBGE na matriz sem nota do M5; a observação da RN-031 desatualizada. | Notas do M5-T03 nas RN-292, 293 e 296 (o que está feito e o que não está, D-M5-03); RN-031 corrigida (linha simples, RN-308) |

## Decididos pela sessão principal por delegação do usuário

Os dois são provisórios, estão na matriz e podem ser revistos.

| ID | Decisão |
|---|---|
| N-M5-04 → D-M5-52 | A equação sem número continua permitida, por exemplo para uma fórmula no meio do raciocínio, e o verificador avisa `EQUACAO_SEM_NUMERO`. O Manual pede equações numeradas (p. 27, seção 3.5) |
| N-M5-08 → D-M5-53 | Células do cabeçalho da tabela centralizadas, como nos exemplos do IBGE (Anexo B). O corpo segue o alinhamento da coluna (números à direita, P-C4) |

## Achados abertos

### Segurança e integridade
- **R-M5-05 (Info):** não há teto para o total de bytes dos PNG dos gráficos no canal (até 500 × 20 MB). Um renderer
  comprometido só consegue pôr imagem errada no DOCX ou pressionar a memória. Não há caminho para injetar XML. A
  proposta é um teto somado ao das mídias, junto com o R-M3-13.
- **R-M5-09 (Info):** uma imagem usada com sha256 divergente impede de abrir o projeto inteiro (D-M5-12, decisão do
  usuário). A alternativa seria abrir com a figura marcada "imagem danificada". É decisão do usuário; fica para a
  Etapa 6.

### Normativos
- **N-M5-06 (Média):** nada confere se o sinal convencional usado está explicado na nota geral (IBGE p. 19, 4.8.2), nem
  chamada × nota específica (p. 21, 4.12). Os critérios já estão nas RN-265 e RN-276; ficam para o verificador do M7.
  A tabela do corpus usa "..." sem explicá-lo e tem a nota "(2)" sem chamada: o corpus testa a exportação, não a norma.
- **N-M5-07 (Baixa, do usuário):** "Nota:" fixo, mesmo para dois esclarecimentos; os exemplos do IBGE usam "Notas:".
  Rever as D-M5-16 e 17.
- **N-M5-09 (Baixa):** a imagem não fica presa à fonte, que pode cair sozinha na página seguinte (D-M5-34). Pede regra
  ou decisão para `keepNext` na imagem e na última linha da tabela.
- **N-M5-10 (Baixa, do usuário):** não há traço sob a célula mesclada do cabeçalho (agrupador do IBGE, Anexo B).
- **N-M5-12 (Baixa):** os zeros de arredondamento (0, 0,0, −0, RN-263) não estão entre os sinais que a nota explica. O
  app não sabe se "0" é absoluto ou arredondado.
- **N-M5-13 a 16 (Info):**
  - abrangência e período no título (RN-246, 247, 279, 310);
  - linha "Brasil" como total no gráfico;
  - campo de legenda na ilustração;
  - chamada de nota específica como texto livre.

  A maior parte fica para o M7.
- **N-M5-17 (Info):** confirma a leitura da D-M5-05. "Alinhados", no masculino, concorda com "algarismos": quem fica à
  direita é o número, não a equação. Anotado na RN-108.

## Medições (RNF-06, RNF-07)

Medidas na máquina de desenvolvimento, em Node, sem o processo utilitário.

| Medida | Resultado |
|---|---|
| Exportar 150 páginas só de texto (`npm run medir`) | 5,8 a 6,2 s; meta 10 s |
| Exportar 150 páginas com 50 tabelas de 13 × 3, 50 figuras, 20 gráficos, 30 equações e 50 remissivas | 7,3 a 9,0 s (o motor leva menos de 25 ms; o resto é a geração do DOCX com a estimativa das páginas do sumário); RSS de 284 a 354 MB. **Dentro da meta, com folga pequena** (R-M3-13) |
| Verificador dos elementos visuais no mesmo documento | 2 a 8 ms |
| Uma tecla (`alterarSecao`) com 78 seções, 50 tabelas, 20 gráficos, 50 equações e remissivas | mediana 0,25 ms, p95 0,73 ms, máx. 2 ms |
| `npm audit --omit=dev` | 0 vulnerabilidades |

## Conferido e correto (resumo dos dois revisores)

- **Grade de tabela hostil:**
  - linha incompleta, sobreposição, mesclagem fora da grade ou atravessando o cabeçalho;
  - teto de 50 mil posições na leitura, no IPC e no editor.
- **Mídias:**
  - sha256, tamanho e tipo conferidos na leitura;
  - só as usadas no salvar, no instantâneo e na exportação;
  - Ctrl+Z de figura depois de salvar não perde a imagem: o renderer reenvia os bytes.
- **Colagem e XSS:**
  - nenhum `innerHTML` nem `eval` no M5;
  - as vistas usam só `textContent`;
  - `DOMParser` inerte;
  - tabela, ilustração, gráfico e remissiva não têm `parseDOM`.
- **Expressões regulares:**
  - os números e as conversões da planilha não têm retrocesso catastrófico;
  - a planilha de 6.000 × 20 com mesclagens absurdas converte em menos de 200 ms.
- **DOCX:**
  - texto do usuário barrado por `PADRAO_TEXTO_XML`;
  - tabulação da equação sem `<w:t>` vazio;
  - id dos desenhos estável por documento.
- **Canal dos gráficos:** forma, ids e PNG conferidos; não há injeção de XML.
- **Normas:**
  - título "Tabela n – Título" com U+2013, centralizado, simples, 12 pt antes, `keepNext`;
  - três traços na tabela e quadro fechado;
  - cabeçalho repetido;
  - rodapé Fonte → Nota → notas específicas, em 10, à esquerda;
  - numeração contínua por espécie, com o gráfico gerado na sequência "Gráfico";
  - imagem centralizada;
  - equação com "(n)" por tabulação à direita em 9071;
  - remissiva com o rótulo resolvido;
  - perfil igual à matriz.

## Não verificado

- Impressão real da tabela que passa de página no Word e no LibreOffice (traço de baixo só no fim). Só o XML foi lido.
- Abertura de um `.bdp` hostil de ponta a ponta pelo contêiner: o código e os testes de fixture foram lidos, mas
  nenhum zip foi montado.
- Queda do renderer por falta de memória com colagem de dezenas de MB, e o limite de mensagem do IPC.
- Custo real de pintar 60 categorias × 62 séries no Chromium.
- Achados abertos do M3 e do M4: não reavaliados. Nada do M5 os altera, pelo que os revisores leram.

## Comandos executados (em `app/`)

- Antes das correções: `npm run verificar:tudo` → saída 0 (`verificar` 1936/1936, externos 27/27, Playwright 36/36).
- `npm audit --omit=dev` → 0 vulnerabilidades. `npm run medir` → 5,8 a 6,2 s.
- Medição com elementos visuais e custo por tecla: teste temporário, apagado depois.
- Depois das correções: `npx vitest run` → 1950/1950; `npm run verificar:tudo` → saída 0: `verificar` 1950/1950 (auditoria só com avisos moderados de ferramentas de empacotamento), externos 27/27, build ok, Playwright 36/36.
