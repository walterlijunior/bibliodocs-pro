# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Datas em AAAA-MM-DD.
Registre aqui cada entrega do aplicativo (Etapa 5 em diante) e mudanças na infraestrutura do kit.

## [Não lançado]

### Adicionado
- Etapa 4 da especificação de atualização (2026-11-15): **Importar planilha** (.xlsx) por aba, na aba Elementos ("Importar planilha…") e em Inserir › Tabelas de planilha (.xlsx)…. Lista as abas pelo nome; marque uma ou várias e deixe as auxiliares de fora. Cada aba mostra a grade da planilha e os intervalos sugeridos (vários elementos na mesma aba viram elementos separados); escolha outro intervalo arrastando na grade ou digitando. Cada elemento tem espécie, título, fonte, opções e prévia, com o relatório do que muda na aparência. Os valores entram como a planilha mostra (formato de número, fórmula pelo resultado gravado, zero, vazio e "N/A" distintos, quebras de linha, mesclagens). Todos entram no cursor num só Ctrl+Z, com a origem (arquivo, aba e intervalo) guardada no trabalho; o arquivo de origem não muda (D-E4-06).
- Etapa 4: as **larguras das colunas** da planilha importada vão para a tabela, na mesma proporção, no editor, na prévia e no DOCX (com mínimo por coluna; inserir e excluir coluna mantêm as demais). Colagem editável do Excel real conferida: a grade colada de `QUADROS.xlsx` é igual à importada do arquivo (D-E4-06).
- Etapa 5 (2026-11-15): tipos de obra **relatório institucional, técnico ou empresarial (RI)**, **demonstrações financeiras** (com o período) e **base de dados**, com padrão provisório sobre o de monografia de autor entidade e o de documento on-line (D-E5-05). **Referência pronta**: cole a referência do portal; ela fica guardada como veio, pode sair assim na lista ou ser convertida em campos, com a prévia do que foi lido e do que conferir (D-E5-06). **Sugerir com IA…** (opcional) propõe tipo, autoria e metadados a partir do mesmo texto, com a fonte de cada campo, sem mexer no que você já preencheu (D-E5-07).

- Etapa 6 (2026-11-15): **visão geral do painel de conformidade**, na organização do Gerenciador de Tarefas: categorias com os itens no trabalho, os verificados sem ocorrência e os com pendência ou aviso; em tabelas, quadros, figuras, gráficos e equações, cada elemento com rótulo, título, menções ligadas e situação, e os botões para ir ao elemento ou à menção. O filtro por categoria passou a dizer que conta ocorrências (D-E6-05).

- Etapa 10 (2026-11-15): **Arquivo › Criar backup de cadastros e configurações…** e **Restaurar backup…**. O backup leva o catálogo acadêmico (instituições com logotipo, câmpus, cursos, disciplinas, docentes, vínculos, manuais e perfis), a configuração da IA sem a chave e as preferências da interface, para qualquer pasta ou pendrive; restaurar mostra antes o que entra e os conflitos e deixa escolher acrescentar ou substituir. Trabalhos não entram (use as cópias de segurança); a chave de IA é informada de novo (D-E10-01).
- Etapa 3: acesso visível em **Arquivo › Cadastrar instituição (catálogo acadêmico)…** e **Editar perfis de formatação…**.

- Etapa 2 (2026-11-15): **títulos no painel Seções**. Criar e renomear seções no painel (F2 ou Renomear; a seção nova já abre o campo); a página mostra o número e o título gerados pela estrutura e reserva a digitação para o corpo (D-E2-04).

- Etapa 2: **busca no documento** (Ctrl+F na aba Escrever), sem diferença de acentos, com a lista de resultados e o salto ao trecho (D-E2-05); **régua** alinhada à folha, com as margens e o recuo do perfil (D-E2-06).

### Corrigido
- Tabelas e quadros saíam no DOCX com todas as colunas iguais, quebrando o texto das colunas largas e sobrando espaço nas de números: agora as larguras seguem o conteúdo (D-E4-08).
- A página de escrita aparecia como uma coluna estreita na seção vazia e alargava ao digitar: agora a folha tem a largura e as margens do perfil desde a primeira linha, com o zoom (D-E2-06).
- A legenda da tabela e do quadro no editor mostrava só "Tabela – título": agora traz o número ("Tabela 2 – título") e acompanha a renumeração, como a menção no texto (D-E4-07).

## [0.1.0] — 2026-11-15

Primeira versão publicada: as sete etapas do plano mestre, as oito etapas da especificação de atualização e a especificação revista (ficha institucional, painel de conformidade, IA para tabelas e conformidade). Instalador para Windows sem assinatura de código (ver o README).

### Projeto
- Código aberto sob a GNU GPL v3 ou posterior (`LICENSE`); o diálogo "Sobre" informa a licença e o instalador leva `LICENSE.txt`.
- README da raiz apresenta o aplicativo; o guia do kit do Claude Code passou para `KIT_CLAUDE_CODE.md`.
- Material de terceiros (`materiais/`) fora do controle de versão.
- Integração contínua (`.github/workflows/ci.yml`) e instalador por tag (`release.yml`), com assinatura pela SignPath Foundation quando o projeto for aprovado.
- README com a seção "Code signing policy" exigida pela SignPath Foundation (papéis da equipe, privacidade, desinstalação); as notas da release apontam para ela.
- Instalador sem assinatura de código (decisão de 2026-11-14): o README troca a "Code signing policy" pela seção "Instalador sem assinatura"; o guia de instalação explica o SmartScreen, o Controle Inteligente de Aplicativos e a conferência pelo SHA-256; as notas da release avisam e apontam para as instruções.

### Adicionado
- DOC-08 fechado sem conferência manual: `app/ferramentas/word/conferir-reparo.ps1` abre DOCX no Word com os alertas ligados e registra qualquer diálogo (reparo, atualizar campos); só encerra o Word que ele mesmo abriu.
- Etapa 3 (2026-11-15): **ficha catalográfica em PDF** — "Importar arquivo (PDF ou texto)…" lê o texto do PDF gerado pelo sistema da biblioteca (como o da UFT) e o põe no campo da ficha, linha por linha. PDF só com imagem ou inválido dá mensagem e não muda o campo (D-E3-04). Dependência nova da interface: pdf.js 6.4.299 (Apache-2.0), embutido no bundle e carregado só quando usado.
- Especificação revista, Etapa 9 (2026-11-15): **tabela ou quadro a partir de imagem ou texto, com IA** (janela da tabela › Gerar com IA…). A IA transcreve sem calcular; o que não leu com segurança vem marcado com "[?]" e a tabela só entra depois da sua conferência; tudo passa pela prévia da colagem e entra com o estilo acadêmico, no gerenciador. **Sugestão de conformidade com IA** em cada ocorrência do painel: explicação e proposta com as regras de base, revisada antes de aplicar (título, fonte e nota de tabelas e quadros; o resto fica para copiar) (D-E8-04 e 05).
- Especificação revista, Etapa 6 (2026-11-15): **painel de conformidade**. Na aba Conformidade (e na janela do F7, agora mais larga), filtros por categoria, que podem ser combinados: tabelas, quadros, figuras, gráficos, equações, citações, fontes e referências, pré-textuais, texto e siglas. Cada ocorrência diz se foi "Verificado pelo aplicativo" ou se "Exige revisão sua". "Ir ao local" abre o item e deixa a barra "Voltar ao relatório", que refaz a verificação e diz se a ocorrência foi resolvida ou leva o foco a ela. "O que esta verificação cobre" separa o que é conferido no conteúdo, o que o aplicativo aplica na exportação e o que pede revisão manual (D-E6-04).
- Especificação revista, Etapa 4 (2026-11-15): **Ajustar tamanho e posição…** nas janelas de figura, gráfico e tabela ou quadro. Mostra a página do perfil, com margens e o texto ao redor, e o elemento centralizado no fluxo do texto, como o Manual pede (RN-059). Na figura e no gráfico, a largura muda pelas alças (arrastando ou com as setas), pelo campo em milímetros ou por "Largura do texto", "Metade" e "Tamanho natural"; só "Aplicar" muda a janela. Posições nos cantos e texto ao redor aparecem desativadas, com a explicação (D-E4-05).
- Especificação revista, Etapa 4 (2026-11-15): a planilha colada do Excel, do LibreOffice ou do Google Planilhas traz também o **alinhamento** das colunas; o relatório da prévia diz quando bordas, negrito ou cores da origem não entram (o estilo acadêmico decide) e sugere "Quadro" quando a origem tinha linhas verticais (D-E4-04).
- Etapa 3 da especificação revista (2026-11-15): **titulação por seletor** para orientador, coorientador e banca (Doutor (Dr.), Doutora (Dra.)… ou outra titulação; a que já estava gravada continua). **Lista de quadros** no seletor dos pré-textuais: os quadros saem nela, numerados e na ordem do texto, e não na lista de ilustrações. **Grupos de siglas** em Cadastros (criar, renomear, reordenar, excluir, escolher o grupo de cada sigla) e a opção "Separar por grupos" na lista de siglas; sem ela, a lista continua alfabética, como pede o Manual da UFT (D-E3-09 a 12).
- Etapa 2 da especificação revista (2026-11-15): **sublinhado** (botão S na barra e Ctrl+U, também nas notas; a colagem do Word e de páginas traz o sublinhado), no arquivo e no DOCX. **Divisor** entre a estrutura e o texto na aba Escrever: arraste ou use as setas (Home e End vão aos limites; duplo clique volta ao padrão); de 180 a 560 px e nunca mais de 45% da área, lembrado neste computador. Os campos de texto corrido (natureza, resumo, abstract, agradecimentos, dedicatória, epígrafe, errata, ficha) mostram ao digitar o alinhamento, os recuos, o itálico e a caixa alta do estilo do perfil, inclusive com modelo de evento aplicado.
- Etapa 3 da especificação de atualização, ficha institucional (2026-11-15): em **Catálogo acadêmico… › Ficha institucional**, importar a ficha de uma instituição (`.bdficha.json`) com prévia do que entra ou muda, dos vínculos novos, dos campos que faltam, dos valores diferentes do catálogo (o seu valor fica até você marcar a substituição) e das pendências (escolha numa ambiguidade); reimportar não duplica. Exportar a ficha da instituição escolhida para outra pessoa e baixar o modelo de preenchimento. Manuais e **perfis de formatação** da instituição com a fonte de cada regra; o perfil só é usado depois de revisado e entra no trabalho por Trabalho › Modelo de evento (DOCX)… › Usar este perfil. Formato em `docs/FICHA_INSTITUCIONAL.md` (D-E3-06 e 07).
- Ficha institucional com IA (opcional, 2026-11-15): **Preencher com IA…** envia o texto colado da página oficial ou do manual (ou um .txt/.html salvo), depois da autorização com o conteúdo exato; a sugestão passa pela prévia da importação com o trecho de origem de cada item e o que ficou incerto, e os perfis sugeridos chegam sem revisão. Sem IA, tudo continua manual (D-E3-08).
- Etapa 8 da especificação de atualização (2026-11-14): **assistente de IA** (Trabalho › Assistente de IA…, ou na aba Elementos). Funciona com o ChatGPT e com qualquer serviço compatível com a API de chat da OpenAI (Gemini, Claude, OpenRouter, Ollama no próprio computador ou outro endereço), pela chave de API do serviço, guardada cifrada pelo Windows. Desativado por padrão; nada é enviado sem a autorização na janela que mostra o conteúdo exato. Tarefas: revisar título, fonte e nota de tabelas e quadros (as células nunca mudam) e interpretar as instruções do modelo de evento. Mostra o consumo informado pelo provedor e a estimativa do aplicativo separados, os limites por minuto quando o serviço os informa, e diz quando a cota restante não está disponível; barra de progresso com o limite mensal que você definir. Grava um ponto de retomada a cada etapa e quando o limite está perto: se o aplicativo fechar no meio, o trabalho avisa ao abrir e "Retomar" envia só o que faltava (D-E8-01 a 03).
- Etapa 7 da especificação de atualização (2026-11-14): **modelo de congresso ou evento em DOCX** (Trabalho › Modelo de evento (DOCX)…, ou na aba Elementos). O aplicativo lê do DOCX oficial a página e as margens, a fonte, o tamanho, a entrelinha, o alinhamento e o recuo do texto, os estilos de título e as seções, lista as instruções escritas no modelo e diz o que a exportação não reproduz (colunas, cabeçalho e rodapé, imagens). Antes de aplicar, mostra o que reconheceu; depois, cada aspecto pode ser corrigido ou voltar ao Manual da UFT. O texto não muda. "Criar as seções que faltam" acrescenta as seções do modelo; "Conferir um DOCX exportado…" compara o exportado com o modelo original (D-E7-01 a 03).
- Etapa 6 da especificação de atualização (2026-11-14): **registro de atividades e cronograma** (Trabalho › Registro de atividades…, ou na aba Elementos). Modelo pronto com data, tipo (atividade ou reunião com o orientador), atividade desenvolvida e encaminhamentos; colunas adaptáveis; "Nova atividade", "Nova reunião com o orientador" e "Ordenar por data". Fica separado do texto: "Exportar cronograma…" gera um DOCX só com o quadro, e "Incorporar registro/cronograma ao trabalho" o põe num apêndice novo ou no fim de um apêndice, com "Atualizar no trabalho" e "Retirar do trabalho" (D-E6-01 a 03).
- Etapa 5 da especificação de atualização (2026-11-14): **link e PDF da obra.** Cada obra pode ter o endereço eletrônico, com "Copiar endereço", e um PDF do computador ("Associar PDF…", "Abrir PDF" no leitor do sistema, "Retirar PDF"). O PDF não entra no arquivo do trabalho nem na referência (D-E5-01, D-E5-02). A obra mostra quantas citações tem e se sai na lista de referências.
- Etapa 5: **ligar citação escrita.** Selecionar "(SILVA, 2007)" ou "Silva (2007)" já digitado e pedir a citação (Ctrl+Shift+C ou Inserir › Citação…) abre "Ligar citação escrita", com a obra escolhida quando só uma produz aquele texto; o trecho vira a chamada ligada (D-E5-03).
- Etapa 5: **histórico do trabalho** (Trabalho › Histórico do trabalho…): os estados de antes de inserir ou retirar citação, de incluir ou excluir obra, de excluir seção, e ao salvar, com quantas citações e referências cada um tinha. Restaurar volta o texto, as citações ligadas e a lista de referências juntos; o estado de antes fica no histórico (D-E5-04).
- Etapa 4 da especificação de atualização (2026-11-14): **gerenciador de elementos** na aba Elementos. Cada tabela, quadro, figura, gráfico e equação mostra a prévia (a grade, a imagem, a tabela de origem do gráfico ou a equação), o rótulo, o título, a fonte, a nota e quantas remissivas o citam; dali se vai ao texto, se edita título, legenda e fonte, se insere a remissiva no ponto do cursor da aba Escrever e se cria tabela, quadro, figura ou gráfico novo no cursor.
- Etapa 4: **menção sem número.** Na janela da remissiva, "Sem número, com o meu texto" escreve, por exemplo, "o quadro a seguir" ligado ao quadro: o texto fica como o autor escreveu, a ligação conta no gerenciador e o aviso de remissiva quebrada vale também para ela (D-E4-01).
- Etapa 4: **ligar menção escrita.** Selecionar "Quadro 1" já digitado e abrir a remissiva (botão Remissiva ou Inserir › Remissiva…) mostra "Ligar menção" com o quadro de mesmo rótulo escolhido e troca o trecho pela remissiva, que passa a acompanhar a numeração. Em "Menções no texto", o gerenciador lista os rótulos digitados sem ligação, com "Ir ao texto" e "Ligar…", e as menções sem número já ligadas (D-E4-02, D-E4-03).
- Etapa 3 da especificação de atualização (2026-11-14): **catálogo acadêmico.** Instituições, câmpus ou polos, cursos ou programas, disciplinas e docentes, com a UFT pré-carregada das páginas oficiais (5 câmpus, 46 cursos presenciais de graduação, com fonte e data) e a estrutura para USP, UnB e UFRGS. O usuário acrescenta e corrige em "Catálogo acadêmico…"; o que ele muda fica em `%LOCALAPPDATA%\BiblioDocsPro\catalogo.json`.
- Etapa 3: **dados institucionais** na capa e na folha de rosto por seletores dependentes (a instituição filtra os câmpus, o câmpus os cursos, o curso as disciplinas e os docentes). Textos no modelo do Manual (Fig. 3 e 5), natureza proposta, orientador do catálogo; trocar uma escolha tira o que deixou de valer e não toca nos dados do autor. O "Novo trabalho" aceita instituição, câmpus e curso, e o curso limita os tipos de trabalho ao nível dele.
- Etapa 3: **brasão na capa** (RN-118) a partir do logotipo cadastrado no catálogo, com a altura dos modelos da UFT (3,10 cm); **ficha catalográfica por arquivo de texto**, sem recriar o trabalho, com a página reservada enquanto ela não chega.
- Etapa 2 da especificação de atualização (2026-11-14): **parágrafo e listas.** Alinhar o parágrafo à esquerda, centralizar, à direita ou justificar (Ctrl+L, Ctrl+Shift+E, Ctrl+R, Ctrl+J), tirar ou repor o recuo de primeira linha e abrir um parágrafo novo depois de qualquer bloco. Sem escolha, vale o perfil: justificado com recuo de 1,25 cm (RN-003), agora também na tela. Listas com marcadores (Ctrl+Shift+8) e numeradas (Ctrl+Shift+7), além das alíneas. Tudo persiste no arquivo (adendo no ADR-0004) e sai no DOCX; a forma das listas é provisória (D-E2-03).
- Etapa 2: **área de escrita maior.** Na aba Escrever a lateral da Biblioteca sai; a estrutura (elementos, seções, obras) se recolhe com "Ocultar estrutura"; a estrutura e o texto rolam cada um no seu painel, com a barra de formatação fixa no alto; o título do trabalho ocupa uma linha; o zoom da barra superior amplia o texto do editor (50% a 200%).
- Etapa 2: **ajuda contextual.** Botão "?" nos grupos da barra de formatação (Texto, Parágrafo, Listas, Citações e notas, Elementos), no título do trabalho e nos painéis de seções, pré-textuais e pós-textuais: abre pelo clique, por Enter ou Espaço e ao passar o mouse; Esc fecha.
- F-E6-01 (2026-11-14): as abas **Elementos** (pré-textuais, pós-textuais, lista de tabelas, quadros, figuras, gráficos e equações, e os cadastros de siglas, símbolos e glossário), **Referências** (obras, importação e conferência) e **Conformidade** (relatório na própria página, com "Ir ao local" levando à aba certa) mostram as funções do trabalho aberto.
- F-E6-01: as coleções da Biblioteca **Referências**, **Figuras e Tabelas** e **Siglas** juntam o conteúdo de todos os trabalhos da pasta, com o trabalho de origem e o botão para abri-lo; **Modelos** cria um trabalho de cada tipo do Manual da UFT. A busca e a barra lateral filtram também as coleções.
- F-E6-01: Trabalho › Dados do trabalho… e Elementos pré-textuais…, Inserir › Sigla…, Verificar › Ir para a próxima não conformidade (F8), Ajuda › Guia rápido (F1) e Atalhos de teclado passaram a funcionar. Todo item de menu tem ação.

### Alterado
- Etapa 4 (2026-11-14): "Ir ao texto" de uma tabela, figura ou gráfico (aba Conformidade, conferência, gerenciador) deixa o elemento selecionado, e Enter abre a janela dele.
- Etapa 2 (2026-11-14): os botões ⏪ e ⏩ da barra superior, que lembravam um player de vídeo, viraram setas "Seção anterior" e "Próxima seção" com o nome escrito; o botão "Pré-visualizar", que não tinha função, saiu. A barra de formatação foi organizada em grupos com ícones de editor (alinhamentos, recuo, listas).

### Corrigido
- Revisão do ciclo: o envio à IA aceita no máximo uma imagem, só na mensagem do usuário (R-RV-01); a leitura dos estilos da planilha colada do Excel é linear mesmo com folhas de estilo malformadas (R-RV-02).
- Dependências de desenvolvimento atualizadas dentro das faixas (`npm audit fix`); nenhuma vulnerabilidade nas dependências do aplicativo (`npm audit --omit=dev`).
- Especificação revista, Etapa 4 (2026-11-15): na janela **Ligar menção**, a mensagem sobre a menção escrita e o rótulo "Como aparece no texto" se sobrepunham (captura A): o corpo da janela usava 4 linhas fixas e a mensagem caía numa linha que podia encolher a zero. Agora cada bloco cresce com o conteúdo, o corpo rola e os botões ficam presos embaixo, também na menor janela com escala de 150%.
- Especificação revista, Etapa 4: **cancelar** a janela de tabela (colar ou importar planilha), de figura ou de gráfico levava a rolagem do texto ao topo da seção; o cursor e o texto ficavam certos. As janelas devolvem o foco sem rolar (`preventScroll`).
- E2E FUN-13 instável (2026-11-14): falhava em 1 a 2 de cada 5 rodadas, também no CI. Duas causas no teste, não no aplicativo: (1) o clique no parágrafo logo depois do duplo clique na chamada às vezes contava como triplo clique, e o Enter apagava o parágrafo selecionado; (2) o editor só registra a seleção nova quando recebe o `selectionchange`, que às vezes chegava depois da tecla seguinte (Enter com a chamada ainda selecionada reabria a janela; Ctrl+Alt+F com tudo selecionado não inseria a nota). O teste passa a posicionar o cursor pelo teclado e a esperar o estado do editor (chamada fora da seleção, botão "Nota de rodapé" ativo). 40 de 40 rodadas.
- Etapa 1 da especificação de atualização (2026-11-14): no `npm run dev`, "Novo trabalho" abria o diálogo e ele sumia logo em seguida, sem criar nada. Causa: o `StrictMode` do React desfaz e refaz o efeito do diálogo, e o evento `close` da limpeza chegava com o diálogo já reaberto e era tratado como "Cancelar". Os oito diálogos com `onClose` (Novo trabalho, Versões descartadas, Sobre, Citação, Exportar, Figura, Importação de obras e Tabela) passam por `aoFecharDialogo`, que ignora esse evento atrasado. O build de produção não era afetado.
- Primeiro CI (2026-11-13): Enter no título da seção não divide mais o título; abre um parágrafo vazio logo depois dele. Antes, Enter no começo do título passava o texto todo para o corpo e deixava o título vazio.
- Primeiro CI (2026-11-13): com a janela estreita (até 1100 px), o botão "Novo trabalho" da Biblioteca fica à esquerda e não some por baixo do painel de detalhes.
- CI: o E2E roda numa tela de 1920×1080 (o runner vem com 1024×768, onde a janela mínima em 125% e 150% não cabe).
- Etapa 7, E7-T04 (revisão final): o canal de exportação recusa gráficos que, somados, passem de 1 GiB.
- Etapa 7, E7-T03: Verificar › Verificar conformidade e a tecla F7 abrem o verificador (o item do menu não fazia nada).

### Documentação
- Etapa 7, E7-T03: `app/README.md` passa a ser o guia de quem usa o aplicativo; o conteúdo de desenvolvimento foi para `app/DESENVOLVIMENTO.md`. Novo `docs/INSTALACAO_APP.md` (instalar, aviso do Windows sem assinatura, dados, atualizar, desinstalar, problemas comuns).

### Adicionado
- Etapa 6, E6-T04: dois avisos novos nas tabelas: sinal convencional usado sem explicação na nota geral, e chamada sem nota específica (ou nota sem chamada).

### Alterado
- Etapa 6, E6-T04: o painel do trabalho na Biblioteca não diz mais que a verificação de conformidade não está disponível; indica o botão "Verificar conformidade" da aba Escrever.

### Corrigido
- Etapa 6, E6-T01: três regras usadas pelo motor (título da lista de tabelas, ordem alfabética e destaque do título nas referências: RN-044, RN-176, RN-178) passam a constar do perfil, para que toda formatação do DOCX tenha regra de origem conferível.

### Corrigido
- Etapa 5, M7-T05 (revisão do M7):
  - Menos avisos falsos nas tabelas: período "de 1956 a 1964" no título, classe "1500 a 1999" ou "Mais de 0 a 5", sigla junto da forma por extenso ("Índice Nacional de Preços ao Consumidor - INPC"), mês abreviado e moeda, total com subtotais ou taxas, linha separadora vazia.
  - Menos avisos falsos no texto: reticências do próprio original ("eu... não sei") e título que é uma sigla longa ("EMBRAPA").
  - Números enormes ou com muitas casas não geram mais aviso de total errado; texto muito longo de uma célula sai cortado no relatório; o relatório .txt não aceita mais caracteres que forjam linhas.

### Alterado
- Etapa 5, M7-T05: tabela com mais de uma fonte, separadas por ";", sai com "Fontes:" no DOCX e no editor, como no IBGE (critério provisório).

### Adicionado
- Etapa 5, M7-T01: o verificador de conformidade passa a conferir o texto (avisos):
  - título de seção secundária a quinária escrito todo em maiúsculas (RN-043);
  - título que começa com um número digitado ("2.1 Objetivos"), que sairia em dobro (RN-109);
  - supressão em citação indicada por "(...)" ou reticências, em vez de [...] (RN-086);
  - seção sem título ou sem texto (critério provisório, D-M7-02).
- Etapa 5, M7-T04: aceite do verificador (RF-15) com um trabalho de dez não conformidades de seis assuntos diferentes, todas detectadas, e o mesmo trabalho corrigido sem nenhuma, também no aplicativo.
- Etapa 5, M7-T03: janela "Verificar conformidade" reorganizada:
  - resumo com o número de pendências e de avisos, e filtro para ver só uns ou outros;
  - itens agrupados por assunto (pré-textuais, texto, citações, elementos visuais, tabelas, siglas);
  - local legível em cada item ("Seção 1 Introdução — Tabela 1", trecho entre aspas), também no relatório .txt, que sai agrupado do mesmo jeito.
- Etapa 5, M7-T02: avisos da Norma Tabular do IBGE nas tabelas (não nos quadros): sigla no título, cabeçalho da coluna indicadora vazio, célula vazia ou com "n/d" em vez de sinal convencional, fonte só com sigla, série temporal com meia-risca ou "a", classe aberta, total diferente da soma sem nota, mais sinais que dados, "Outros" maior que outra classe e ponto final no título (provisório).

### Corrigido
- Etapa 5, M6-T07 (revisão do M6):
  - A tela "Elementos pós-textuais" passa a funcionar no app: incluir, retirar e ordenar apêndices, anexos e glossário, com Ctrl+Z. O título do apêndice é escrito na primeira linha do editor.
  - Desfazer a inclusão ou a retirada de um apêndice não apaga mais o texto de outro.
  - Gráfico dentro de apêndice sai com a imagem no DOCX.
  - O relatório de conformidade não pode ser falsificado por um título com quebras de linha, e a conferência de siglas fica rápida mesmo com milhares de siglas.

### Alterado
- Etapa 5, M6-T07 (revisão do M6):
  - Sigla dentro de citação longa não é expandida nem conferida (a citação reproduz o original). A primeira vez que a sigla aparece no texto corrido sai sempre por extenso, mesmo se já apareceu numa nota.
  - Glossário sem recuo de primeira linha; apêndice e anexo com conteúdo começam em folha nova.
  - Novos avisos: apêndice ou anexo sem título, lista incluída sem itens, forma por extenso repetida depois da sigla. Numeral romano não é tomado por sigla. Avisos que vêm de decisões do projeto saem como "critério provisório" no relatório.

### Adicionado
- Etapa 5, M6-T02 a T06 (Codex, revisado pela sessão principal):
  - Siglas: cadastro, botão "Sigla" no editor, primeira ocorrência por extenso no DOCX ("Universidade Federal do Tocantins (UFT)") e depois só a sigla; lista de abreviaturas e siglas; sugestão de ligar sigla digitada e aviso de sigla sem cadastro.
  - Símbolos e glossário: cadastros na janela "Siglas, símbolos e glossário…", lista de símbolos e glossário em ordem alfabética no DOCX.
  - Apêndices e anexos com conteúdo (texto, tabelas, figuras), na tela "Elementos pós-textuais", com incluir, retirar, renomear e ordenar.
  - Remissiva a seção ("2.1") e a apêndice ou anexo ("APÊNDICE A").
  - Início do verificador de conformidade (M7): janela "Verificar conformidade", com "Ir ao local" e relatório em .txt.
- Etapa 5, M6-T01: listas de ilustrações e tabelas no DOCX.
  - Legendas e numeração compartilhadas com o texto; quadros e gráficos na lista de ilustrações; tabelas longas aparecem uma vez.
  - Listas próprias por espécie com cinco ou mais itens, ou opção "Usar lista única de ilustrações", salva no projeto.
  - Títulos em folha própria, entradas em 12 e espaço 1,5, pontilhado e página estimada por campo PAGEREF, atualizável com F9.

### Corrigido
- Etapa 5, M5-T10 (revisão do M5):
  - Número enorme numa célula (como 1 seguido de 300 zeros) não trava mais o gráfico: fica fora do desenho, com aviso.
  - A fonte da figura e do gráfico começa na borda esquerda da imagem, como no Manual, e não na margem.
  - Colar tabela com muitas quebras de linha numa célula não trava mais a tela; CSV ou texto colado muito grandes não ocupam mais memória além do limite da tabela.
  - Documento com mais de 500 gráficos exporta (os excedentes saem sem a imagem, com aviso).

### Alterado
- Etapa 5, M5-T10 (revisão do M5):
  - O cabeçalho da tabela sai centralizado, como nos exemplos do IBGE.
  - Novos avisos: tabela sem linha de cabeçalho e equação sem número. O aviso de tabela longa não sugere mais dividi-la em tabelas numeradas à parte.

### Adicionado
- Etapa 5, M5-T09: gráfico gerado de tabela.
  - Botão "Gráfico" e Inserir › Gráfico…: escolhe a tabela, a forma (colunas, barras, linhas ou setores) e as colunas que viram séries, com a prévia na janela.
  - O gráfico fica ligado à tabela: mudar um número da tabela muda o gráfico, no texto e no arquivo exportado.
  - Desenho em tons de cinza e padrões, legível impresso em preto e branco, com números no padrão brasileiro e legenda.
  - No DOCX, "Gráfico 1 – Título" acima, a imagem a 300 ppi e a fonte abaixo; o gráfico conta junto com os gráficos de imagem.
  - Tabela excluída ou sem números aparece como pendência, e a linha de total fica fora do gráfico, com aviso.
- Etapa 5, M5-T08: remissivas.
  - Botão "Remissiva" e Inserir › Remissiva…: a janela lista as tabelas, quadros, figuras e equações numeradas do trabalho, na ordem do texto.
  - No texto aparece só o rótulo, "Tabela 3" ou "(2)" na equação, que muda sozinho quando a numeração muda. Duplo clique troca o elemento citado.
  - Excluir um elemento citado, ou tirar o número de uma equação citada, mostra o aviso de remissiva quebrada, que some com o Ctrl+Z. A remissiva quebrada aparece como "[remissiva quebrada]", na tela e no DOCX.
  - A exportação aponta remissiva quebrada e tabela, quadro ou figura que o texto não cita.
- Etapa 5, M5-T07: equações.
  - Alt+=, o botão "Equação" ou Inserir › Equação fazem do parágrafo uma equação, editada no próprio texto com itálico, negrito, sobrescrito e subscrito; o mesmo comando a desfaz.
  - A equação nova já vem numerada; "Numerar (n)" tira e põe o número. Enter no fim volta ao texto; Backspace no começo a devolve a parágrafo.
  - No DOCX, a equação sai em parágrafo próprio no estilo "Equação", na margem esquerda e sem recuo, com "(1)", "(2)"… alinhados à direita por tabulação. A contagem é do documento todo e só das numeradas.
  - Equação vazia gera aviso na exportação.
- Etapa 5, M5-T06: figuras.
  - Botão "Figura" e menu Inserir › Figura…: imagem PNG ou JPEG, espécie (Figura, Fotografia, Gráfico, Mapa…), título, largura, fonte e nota.
  - A janela mostra o tamanho em pixels, a largura impressa e a resolução; abaixo de 150 ppi, avisa e sugere a largura que resolve. O aviso também sai na exportação.
  - No texto, a figura aparece com a imagem na proporção da página; duplo clique altera, inclusive trocando a imagem; Ctrl+Z desfaz.
  - No DOCX, "Figura 1 – Título" acima, a imagem centralizada com texto alternativo, e a fonte abaixo.
  - A mesma imagem em várias figuras é gravada uma vez, e o arquivo leva só as imagens usadas.
- Etapa 5, M5-T05: dados de planilha na janela da tabela.
  - Colar as células copiadas no Excel ou no LibreOffice (com mesclagens) ou importar um CSV (";" ou ",", UTF-8 ou Windows-1252).
  - Prévia com separador decimal, sinal para as células vazias e linhas de cabeçalho; números com ponto decimal convertidos para o padrão brasileiro; datas ISO para dia/mês/ano.
  - Relatório do que mudou e do que não converteu (texto em coluna de números, células vazias, linhas ocultas, limites).
  - Tabela colada no texto avisa para usar a janela da tabela.
- Etapa 5, M5-T04: inserir e editar tabela e quadro no editor.
  - Botão "Tabela" na barra e menu Inserir › Tabela ou quadro…; duplo clique, "Editar" ou Enter na tabela selecionada abrem a janela.
  - Janela com espécie, título, grade (inserir e excluir linha e coluna, cabeçalho, mesclar e separar, alinhamento por coluna), fonte, nota e notas específicas.
  - Sinais convencionais do IBGE em botões; "-" sozinho na célula é gravado como "–"; a nota geral pode explicar os sinais usados.
  - Só a tabela que o formato aceita é gravada; Ctrl+Z e Ctrl+Y desfazem e refazem a tabela junto com o texto.
- Etapa 5, M5-T03: tabela e quadro saem no DOCX como tabela nativa do Word.
  - Título "Tabela n – Título" em 12, centralizado, acima e preso à tabela, com uma linha antes.
  - Tabela aberta com três traços (acima, abaixo do cabeçalho e no fim), sem laterais nem traços internos; quadro fechado.
  - Cabeçalho repetido em cada página; corpo das células em 10 simples; alinhamento da coluna (números à direita); mesclagem de linhas e colunas.
  - Fonte, nota e notas específicas "(1)" em 10, à esquerda, com uma linha depois.
  - A exportação devolve também as pendências de tabela (sem fonte, tabela longa).
- Etapa 5, M5-T02: numeração e conferência de tabelas, quadros, ilustrações e equações no domínio.
  - Cada palavra designativa numera à parte, contínua no documento: Tabela 1, Quadro 1, Figura 1, Gráfico 1; equação numerada "(1)".
  - Rótulo "Tabela 3 – Título" com o separador do perfil; rodapé na ordem Fonte, Nota e notas específicas.
  - Pendências de elemento sem fonte e sem título; avisos de tabela sem dado numérico (sugere quadro) e de tabela com mais de 40 linhas.
  - Ainda sem mudança visível.
- Etapa 5, M5-T01: tabela ou quadro, ilustração e equação no formato v1, de modo aditivo (adendo do M5-T01 no ADR-0004).
  - Tabela: título, colunas com alinhamento, linhas de cabeçalho, células com marcas, mesclagem, fonte e notas. A leitura recusa grade irregular, mesclagem fora da grade, sobreposta ou que atravessa o cabeçalho.
  - Ilustração: espécie da RN-049, título, imagem por sha256, largura, fonte e nota. Imagem que não está no pacote é recusada ao abrir e ao salvar.
  - Equação: texto com sobrescrito e subscrito, numerada ou não.
  - Ainda sem tela e sem DOCX: o editor preserva os blocos e a exportação os deixa de fora com aviso.

### Alterado
- Etapa 5, revisão do M4 (decisões do usuário, 2026-11-07):
  - "[S. l.]" e "[s. n.]" com a abreviatura em itálico, como nos exemplos do Manual.
  - Título iniciado por artigo ou monossílabo leva a palavra seguinte em maiúsculas na lista: "OS PERIGOS do uso de tóxicos".
  - Obras com "et al." do mesmo primeiro autor e ano se ordenam pelo título.
  - O aviso de grafia divergente do mesmo autor não dispara mais para prenomes bem diferentes com a mesma inicial.

### Corrigido
- Etapa 5, M4-T10 (revisão do M4):
  - Importação: arquivo BibTeX com abreviações (`@string`) que crescem não trava mais a tela. Arquivos com muitas quebras de linha ou espaços são lidos rápido. A natureza do trabalho acadêmico vem do arquivo, sem texto inventado. O DOI fica como veio no arquivo. A função dos editores vem com aviso para conferir. "Silva Neto" sem prenome fica todo como sobrenome.
  - Colar não examina mais a seção inteira: só o que foi colado, e "Ligar às obras" age só ali.
  - Chamada narrativa de obra sem ano e sem página sai "Lima", não "Lima ()".
  - A prévia da obra e a da citação mostram as formas provisórias, sem fonte no Manual.

### Adicionado
- Etapa 5, M4-T09: "Importar BibTeX ou RIS…" na Bibliografia.
  - A janela mostra cada registro com a referência formatada, o que impede gravar e o que ficou de fora do arquivo. As obras que já estão no trabalho vêm desmarcadas.
  - Só as escolhidas entram, num passo só do Ctrl+Z.
  - Tipos fora da primeira leva não são importados.
- Etapa 5, M4-T08: "Conferir citações e referências" na Bibliografia.
  - Aponta chamada escrita como texto (sem ligação com a obra), obra não citada, falta do elemento REFERÊNCIAS, chamadas iguais para obras diferentes, mesmo autor com grafias diferentes, prenomes não uniformes e os avisos das chamadas e referências.
  - "Ir ao texto" seleciona o trecho; "Abrir obra" abre o formulário.
- Etapa 5, M4-T07: citação no editor.
  - Ctrl+Shift+C, o botão "Citação" ou Inserir › Citação… abrem a janela: obra, forma, volume, página, apud e grifo, com a prévia da chamada.
  - A chamada mostra o texto do documento e acompanha a obra. Duplo clique altera. Ctrl+Z desfaz junto com o texto.
  - Texto colado com "(AUTOR, ano)" de uma obra cadastrada mostra a sugestão de ligar.
  - Copiar leva o texto da chamada.
  - Campo novo na obra citada: volume, "(CANDIDO, 1993, v. 2, p. 12)" (Manual, p. 23).
  - Citação dentro de nota de rodapé: Ctrl+Shift+C no texto da nota. A chamada sai no rodapé do DOCX.
- Etapa 5, M4-T06: Bibliografia na aba Escrever.
  - Lista das obras na ordem das referências e "Nova obra".
  - Formulário com os campos de cada tipo e a prévia da referência como sai no documento.
  - Só a obra válida é gravada. Obra citada não é excluída. Incluir e excluir entram no Ctrl+Z.
  - Campos novos na obra: coleção ou série, título original, suplemento e ano do veículo oficial (D-M4-09).
- Etapa 5, M4-T05: o DOCX exportado passa a ter as chamadas de citação no texto e a lista REFERÊNCIAS, gerada das obras citadas e em ordem alfabética, com uma linha simples entre as referências (RN-177). Opção de incluir as obras não citadas no formato (aditiva).
- Etapa 5, M4-T04: referências dos nove tipos da primeira leva (livro, capítulo e verbete, trabalho acadêmico, artigo de periódico, trabalho em evento, artigo de jornal, norma, legislação, documento on-line). O que falta vira aviso. Ainda sem mudança visível.
- Etapa 5, M4-T03: chamadas de citação no domínio, geradas da obra a cada vez:
  - parentética e narrativa, apud, grifo, entrada pelo título, várias obras e sufixos a/b;
  - perfil 2002 como padrão e opção 2023 provisória.

  Ainda sem mudança visível.
- Etapa 5, M4-T02: formatador de referência no domínio. A referência sai em trechos com destaque e a RN de cada elemento. Autores, meses, ano incerto, ordenação pt-BR com desempate e sufixos a/b. Por enquanto só o livro; os demais tipos avisam até o M4-T04. Ainda sem mudança visível.
- Etapa 5, M4-T01: obras da bibliografia e citações ligadas a elas no formato v1, de modo aditivo, com citação sem obra recusada na leitura. Ainda sem tela: cadastro no M4-T06 e inserção no M4-T07.

### Corrigido
- Etapa 5, M3-T12 (revisão do M3): a ficha catalográfica sai deitada, com 12,5 cm de largura por 7,5 cm de altura, como na Fig. 6 do Manual (RN-136); antes saía em pé. A cópia aberta sem arquivo não perde mais o instantâneo de recuperação depois de muitas listagens (R-M3-01), e não divide o conjunto com outra cópia nem com uma queda reservada (R-M3-02).
- Etapa 5, M3-T12: exportar por cima de um `.docx` não deixa mais um `.docx.bak` na pasta (decisão do usuário).

### Alterado
- Etapa 5, M3-T12 (decisões do usuário, 2026-11-05):
  - Banca da folha de aprovação centralizada, distribuição da folha de rosto e rótulos "Palabras clave" e "Mots-clés" passam a regras provisórias do perfil (RN-313 a RN-315), sem fonte no Manual.
  - O rótulo em espanhol ou francês sai com aviso.
  - O sinal da subalínea (travessão) vem do perfil.
  - O documento exportado não muda.

### Adicionado
- Etapa 5, M3-T11: Ajuda › Sobre, com versão e licenças de terceiros (RNF-15); `npm run medir` e `npm run fumaca:exportar`.

### Corrigido
- Etapa 5, M3-T10: versão descartada ou cópia de segurança aberta agora tem cópia de recuperação; o que "Salvar como…" substitui fica 7 dias em Versões descartadas; `.bak` antigo não passa a parecer do trabalho renomeado; excluir leva os restos de gravação para a Lixeira; log sem caminho em argumento recusado.

### Adicionado
- Etapa 5, M3-T09: Arquivo › Cópias de segurança…: lista as cópias de `backups\<id>\` e abre como trabalho sem arquivo, sem alterar nada.
- Etapa 5, M3-T08: Exportar › Exportar DOCX… (Ctrl+E): escolhe a fonte, grava pelo diálogo do sistema e mostra os avisos. É a primeira exportação pelo próprio aplicativo.
- Etapa 5, M3-T07: `test:ooxml`, `test:libreoffice`, `test:word` e `test:externos`, parte de `verificar:tudo`. Validador em `app/ferramentas/validar-ooxml/`. .NET SDK 10 instalado na máquina, com autorização; `pdfjs-dist` como dependência de desenvolvimento.
- Etapa 5, M3-T06: regressão documental: corpus com os seis tipos e um documento difícil, propriedades com a RN na falha e 35 instantâneos de XML aprovados.
- Etapa 5, M3-T05: exportador DOCX (`exportacao/docx`), com processo utilitário e estilos em português, notas reais, numeração no estilo e sumário com páginas. Sem botão ainda: a tela chega no M3-T08.
- Etapa 5, M3-T04: motor com seções, paginação, capa, folha de rosto, ficha, folha de aprovação, resumos, sumário e pós-textuais. Perfil com 84 regras e 19 parâmetros. Ainda sem exportação.
- Etapa 5, M3-T03: motor normativo `formatar(doc, perfil)`: estilos, títulos de 1 a 5, parágrafo, alíneas, citação longa e notas, cada propriedade com a RN de origem. Ainda sem exportação nem mudança visível.
- Etapa 5, M3-T02: perfil `uft-2022` em dados (43 regras, 17 parâmetros), com esquema e conferência contra a matriz. Elementos por tipo e limites do resumo saem do código e passam a vir do perfil. Sem mudança visível no aplicativo.
- Etapa 5, M3-T01: PoC com `docx` 9.15.1 conferida no Word real; `app/ferramentas/word/conferir-no-word.ps1`. Dependências `docx` e `fast-xml-parser`, ainda sem uso no aplicativo.
- Etapa 5, M2-T13: alíneas, subalíneas e citação longa pelo editor (botões, Ctrl+Shift+L, Ctrl+Shift+Q, Tab, Shift+Tab).

### Alterado
- Cópias em `backups\<id>\` de um trabalho excluído são apagadas 30 dias depois; voltando à biblioteca, ficam.
- RN-232 e RN-235 passam a `AMBÍGUA`, com `AA, BB, CC` por decisão do usuário; `AAA` em diante é PENDENTE-FONTE.

### Corrigido
- Etapa 5, M2-T12 (revisão do M2): salvar com uma queda adiada não apaga mais a versão recuperável; título ou subtítulo com
  caractere inválido não trava mais a gravação; Electron 44.10.1 (GHSA-jr5w-w6x2-84p9) e `verificar` auditando também as
  dependências de desenvolvimento; textos, data e lista incompleta em Versões descartadas; temporário de backup órfão.

### Adicionado
- Etapa 5, M2-T11: pendências técnicas do M1. Inventário de licenças com `TERCEIROS.txt` no pacote e recusa de copyleft em
  produção; `npm audit signatures` no `verificar`; logs só com código ou tipo do erro; Electron 44.9.0; axe-core nos E2E;
  diálogo Arquivo › Versões descartadas…, que abre o que está em `recuperacao-antigos` sem alterar nenhum arquivo.
- Etapa 5, M2-T10: backups rotativos em `%LOCALAPPDATA%\BiblioDocsPro\backups\<id>\` (no máximo um a cada 10 minutos; 10
  recentes e 1 por dia em 7 dias); o `.bak` acompanha excluir e renomear (R-M1-02, R-M1-03, R37).
- Etapa 5, M2-T09: lugares dos pós-textuais na ordem do Quadro 5 e letras de apêndice e anexo derivadas da posição
  (`A…Z, AA, BB`), só no domínio. Formato v1: `titulo` opcional em apêndice e anexo (aditivo).

### Corrigido
- Matriz normativa, RN-232: sequência `AA, AB` sem fonte trocada por `AA, BB, CC` (como C-A6; provisório, P-03).

### Adicionado
- Etapa 5, M2-T08: elementos pré-textuais com campos na aba Escrever (RF-04; adendo M2-T08 no ADR-0004).
  - Lista dos elementos com a marca de sugestão e a contagem de pendências; incluir e retirar, com Ctrl+Z.
  - Formulários de capa, folha de rosto, ficha, errata, folha de aprovação com banca, dedicatória, agradecimentos,
    epígrafe, resumo e resumo em língua estrangeira com palavras-chave.
  - Pendências com a RN (obrigatório ausente, campo vazio, bolsista) e avisos (extensão do resumo, palavras-chave, grau
    incoerente com o tipo). Nada impede de salvar.
  - Formato v1: dados de identificação em `metadados` e campos nos elementos (aditivo).
- Etapa 5, M2-T02: tipos de trabalho como dados e diálogo "Novo trabalho" (RF-02; adendo M2-T02 no ADR-0004).
  - Seis tipos (monografia, artigo-TCC, dissertação, tese, relatório técnico, projeto de pesquisa), cada elemento com
    presença, RN e fonte; o trabalho novo nasce com os elementos e as seções do tipo, na ordem do Quadro 5.
  - Relatório técnico, projeto de pesquisa e corpo do artigo-TCC entram como sugestão do modelo UFT (C-B18).
  - Formato v1: `tipoTrabalho` com os seis tipos; `preTextuais` e `posTextuais` no `documento.json` (aditivo).
  - `biblioteca.criar(tipo)` recusa tipo desconhecido; "Genérico" só existe para arquivos antigos.
- Etapa 5, M2-T07: árvore de seções na aba Escrever e ordem única de desfazer (ADR-0007, seção 4 e adendo M2-T07).
  - Árvore acessível (padrão ARIA "tree": nível, posição e número anunciados) com Nova seção, Subir, Descer, Recuar,
    Promover e Excluir; teclas do modo de tópicos do Word (Alt+Shift+setas), Delete, F2, Enter e setas; arrastar e soltar.
  - Domínio: `moverParaCima`, `moverParaBaixo` e `moverJuntoDe` (aditivos, com inverso).
  - `HistoricoEdicao`: Ctrl+Z/Ctrl+Y desfazem texto e estrutura numa ordem só, inclusive o texto de outra seção e a
    exclusão de seção (volta com o texto). Menu Editar segue a mesma ordem na aba Escrever.
  - Barra superior: "Seção anterior" e "Próxima seção" ligados (Ctrl+Page Up/Down); Trabalho › Estrutura de seções… foca
    a árvore.
  - Testes: `estrutura-secoes` (domínio, histórico, sequências com o estado do editor, regras da árvore), casos novos de
    sessão e de renderização (943 no total); E2E EDT-09 (12/12).

- Etapa 5, M2-T06: editor de texto na aba Escrever, ligado à sessão de trabalho (ADR-0007, seção 3 e adendo M2-T06).
  - Aba Escrever: lista das seções numeradas pela posição, "Nova seção" e o editor da seção escolhida, com barra de
    formatação (itálico, negrito, sobrescrito, subscrito, nota de rodapé) e os atalhos do Word.
  - Cada tecla vai para `SessaoTrabalho.alterarSecao`: salvar, fechar e o instantâneo sempre têm o texto digitado; a
    casca só re-renderiza quando o visor ou a lista mudam.
  - Nota de rodapé com editor aninhado (Ctrl+Alt+F); a marca aplicada no texto não entra na nota (M6 do M2-T05).
  - Menu Editar ligado (Desfazer, Refazer, Recortar, Copiar, Colar e o novo "Colar sem formatação") pelo canal IPC
    `edicao`; Inserir › Nota de rodapé.
  - Testes: `sessao-secoes`, `editor-comandos`, casos novos de colagem e IPC (915 no total); `e2e/editor.spec.ts` com a
    área de transferência real (E2E 11/11). Latência com o editor no documento de 150 páginas: p95 8–15 ms.
  - Revisão do `especialista-documento`: 3 Médias e 5 Baixas, todas corrigidas (nota em só leitura, nota recusada pelos
    limites, papel `doc-noteref`, canal `edicao` só com gesto do usuário, entre outras).

- Etapa 5, M2-T05: núcleo do editor ProseMirror (ADR-0007), ainda sem tela.
  - Dependências: 7 pacotes `prosemirror-*` com versões exatas (10 com as transitivas, todos MIT), fora do ASAR.
  - `app/src/interface/editor/`: esquema espelhando o modelo do M2-T04, conversão modelo ↔ editor com forma canônica,
    plugins de ids únicos e de limites do v1, leitura do HTML colado (Word, LibreOffice, Chrome, Google Docs, o próprio
    app e texto puro) e tratador de colar e soltar sem o `innerHTML` da biblioteca.
  - Regras de fronteira E1–E3 (`prosemirror-*` só no editor; arquivos puros sem `prosemirror-view`; `DOMParser` só
    em `colagem.ts`).
  - Testes: ida e volta nas fixtures, no documento grande e em 300 seções aleatórias; ids por transação real; colagem
    sobre 5 fixtures HTML; limites e controles. 891 testes no total.
  - Revisão do `especialista-documento`: 2 Altas e 4 Médias corrigidas, M5, M6 e 4 Baixas registradas.

- Etapa 5, M2-T04: alíneas, citação longa e nota de rodapé no modelo de documento (RN-004, RN-023, RN-025, RN-026,
  RN-100).
  - `app/src/dominio/modelo/tipos.ts`: blocos `alineas` (com `subalineas`) e `citacaoLonga`, inline `nota` com
    conteúdo embutido; títulos e metadados só com texto (`InlineDeTitulo`).
  - `app/src/dominio/numeracao/alineas.ts`: rótulo derivado a) … z), aa), bb) (decisão C-A6).
  - Esquemas zod com mensagens próprias, ids únicos também para notas, JSON Schema regenerado com `$defs` nomeados.
  - Fixtures: `documento-bordas-m2.json` e 14 inválidas em `tests/fixtures/projeto-v1/invalidos/`.
  - Revisão do `especialista-documento`: 0 Alta, 3 Médias (2 corrigidas, 1 registrada para o M2-T05), 4 Baixas
    registradas. Adendo M2-T04 no ADR-0007. 16/16 mutações detectadas.

- Etapa 5, M2-T03: numeração progressiva e operações sobre a árvore de seções (RF-03; RN-028, RN-038, RN-039, RN-041).
  - `app/src/dominio/numeracao/secoes.ts`: numeração derivada (1, 1.1 ... 1.1.1.1.1), nunca gravada.
  - `app/src/dominio/modelo/operacoes.ts`: inserir, remover, mover, recuar e promover, puras e com inverso para
    desfazer/refazer.
    - Promover funciona como o modo de tópicos do Word (decisão do usuário): as irmãs seguintes viram subseções e a
      ordem do texto não muda.
    - Recuar além da quinária é recusado com mensagem que orienta usar alíneas.
    - Limite de 1000 seções por nível, igual ao do formato.
  - Revisão do `especialista-documento`: 3 Médias e 2 Baixas corrigidas; B2 (ids fora do corpo, formato do id) fica
    para o M2-T07/T08. Adendo M2-T03 no ADR-0007. 40/40 mutações detectadas.

- Etapa 5, M2-T01: desempenho do instantâneo de recuperação e do salvamento com o documento grande (R-M1-01, R36).
  - `app/tests/apoio/documento-grande.ts`: gerador determinístico de um trabalho de ≈150 páginas com 25 MiB de mídia,
    para o M3 e a Etapa 6.
  - `app/e2e/desempenho.spec.ts` (E2E-07, DES-01): abrir, digitar com instantâneos e Ctrl+S, travadas do principal e
    memória no Electron real.
  - Medido antes: travadas de 244–406 ms no processo principal a cada instantâneo, tecla de até 328 ms. Corrigido:
    empacotamento num `worker_threads` (`src/principal/empacotador.ts`), mídias mandadas uma vez por trabalho aberto
    (`PacoteEnvio`, código `MIDIA_AUSENTE` com reenvio) e guardadas em `SharedArrayBuffer`. Depois: p95 da tecla
    6–12 ms, no máximo ~60 ms de travada, abrir < 1,5 s, pico de 700–760 MB (meta 800).
  - Revisão do `revisor-seguranca`: 0 Alta; F1 e F2 (Médias: mídia guardada antes da conferência, acúmulo sem
    limite) corrigidos — o principal só guarda as mídias do último pacote conferido.
  - Adendo M2-T01 no ADR-0004; relatório novo `docs/relatorios/M2_RELATORIO_MARCO.md`.

- Etapa 5, preparação do M2.
  - `docs/decisoes/ADR-0007-editor-de-texto-rico.md` (ACEITO, decisão delegada pelo usuário): ProseMirror puro, um
    editor por seção, colagem própria sem `innerHTML`, histórico único texto + estrutura, componentes próprios.
  - Riscos R38–R45 na matriz de riscos; decisões C-A6 (RN-025, `aa), bb)`) e C-B18 (relatório técnico e projeto de
    pesquisa com os modelos UFT como sugestão editável) na matriz normativa.
  - `docs/PLANO_DE_IMPLEMENTACAO.md`: tarefas M2-T01..T12 com dependências, aceite e decisões do usuário.

- Etapa 5, M1-T15: fechamento do marco M1.
  - `docs/relatorios/REVISAO_M1.md`: revisão de segurança e qualidade do marco, com 0 Crítica, 1 Alta (R-M1-01,
    instantâneo síncrono; aceito como M2-T01), 3 Médias, 6 Baixas e 3 Info, mais o checklist C-1..C-22 final,
    licenças (nenhuma copyleft) e medições de desempenho.
  - Grupo E2E (E2E-01..06) em `docs/MATRIZ_DE_TESTES.md`; ARQ e PER reexecutados.
  - **Marco M1 concluído.** Decisões delegadas pelo usuário: R-M1-01 vira M2-T01; o `.bak` acompanha o trabalho ao
    excluir e renomear (M2).
  - Relatório de testes do marco em `docs/relatorios/M1_RELATORIO_MARCO.md`; riscos R36 e R37; pendências do M2 no
    plano.

- Etapa 5, M1-T14: instalador do Windows (fumaça) com electron-builder 26.15.3 (só desenvolvimento).
  - `npm run dist` gera `release/BiblioDocsPro-Instalador-0.1.0.exe` (111,8 MB; meta < 200 MB): por usuário, sem
    administrador, sem atualização automática, sem assinatura (Etapa 7). Não distribuir.
  - Fuses e integridade do ASAR ligados (C-13, C-14), conferidos no `.exe` e em execução.
  - O app empacotado recusa chaves de linha de comando, como `--remote-debugging-port` (achado da revisão), e sai
    com código 2.
  - A desinstalação não deixa cópia do instalador para trás e mantém os dados do usuário (lista no `app/README.md`).
  - `npm run dist:pasta` e `npm run dist:fumaca` (artefato só para a fumaça por CDP).
  - 29 testes novos (total 741); 10/10 mutações detectadas; instalação e desinstalação conferidas nesta máquina.
  - Ícone próprio do app e do instalador: o pequi da interface (`npm run icone:gerar`), no lugar do ícone padrão do
    Electron. O desinstalador nunca apaga os dados do usuário.
- Etapa 5, M1-T13: testes E2E no Electron real com Playwright (`@playwright/test` 1.64.1, só desenvolvimento).
  - `npm run test:e2e` (build + E2E); `npm run verificar:tudo` passa a rodá-los.
  - FUN-01: criar → salvar → fechar → reabrir (também depois de reiniciar o app) com o título idêntico e o arquivo
    sem regravação; RNF-04: matar o processo com `taskkill /F /T` e recuperar; UI-01: quatro faixas da janela
    mínima à maximizada em 100%, 125% e 150%; zero atividade de rede pelo net-log; defesas do runtime (CSP, `eval`,
    rede, `app://`, navegação, `window.open`, instância única).
  - Cada teste roda isolado numa pasta temporária (dados locais, biblioteca e perfil do Chromium).
  - 8 testes E2E; 4 de 5 mutações detectadas (a quinta é inalcançável pela página e fica nos testes de unidade).
- Etapa 5, M1-T12: recuperação após encerramento inesperado (ADR-0004, seção 4).
  - Até cerca de 2 s depois de cada alteração, uma cópia de recuperação vai para
    `%LOCALAPPDATA%\BiblioDocsPro\recuperacao\` (nunca para o arquivo do usuário), com trava de sessão.
  - Ao iniciar, a Biblioteca oferece "Recuperar a versão de HH:MM?" com Recuperar, Abrir o arquivo salvo e Decidir
    depois; também oferece restaurar um trabalho que não abre a partir de uma gravação interrompida ou do `.bak`.
  - Nada da recuperação é apagado sem decisão: o que o usuário descarta fica 7 dias em `recuperacao-antigos`.
  - Canal novo `window.bibliodocs.recuperacao` (`instantaneo`, `listar`, `recuperar`, `abrirSalvo`).
  - 45 testes novos (total 711); 27/27 mutações detectadas; fumaça no Electron 20/20.
- Etapa 5, M1-T11: fluxo criar → editar título → salvar → fechar → abrir.
  - Sessão de edição (`app/src/aplicacao/servicos/sessao-trabalho.ts`) com o salvamento automático escolhido no
    ADR-0004: grava ~30 s depois da última alteração, ao trocar de trabalho e ao fechar a janela; Ctrl+S grava na hora.
  - Visor com "Salvo às HH:MM", "Salvando…", "Alterações não salvas", "Erro ao salvar: …" e "Somente leitura".
    Nenhum erro é silencioso: o aviso oferece "Salvar como…", e fechar com erro oferece descartar.
  - Aba Escrever com o título do trabalho editável (o editor do texto vem no M2).
  - Menu Arquivo: Abrir… (Ctrl+O), Salvar (Ctrl+S), Salvar como… (Ctrl+Shift+S, novo) e Fechar trabalho (Ctrl+W).
  - Biblioteca: Enter ou duplo clique no cartão abre; painel com Abrir, Renomear…, Duplicar e Excluir…; trabalho de
    versão mais nova abre só para leitura.
  - 35 testes novos (total 665); 13 mutações detectadas; fumaça no Electron 31/31.
- Etapa 5, M1-T10: casca da interface (decisões do usuário em `docs/GUIA_VISUAL.md`).
  - Quatro faixas no estilo da referência: barra superior (seção anterior / pré-visualizar / próxima + zoom,
    desativados sem trabalho; visor com o pequi; grade/lista; busca com Ctrl+F), barra de menus no padrão ARIA
    `menubar`, navegação (Voltar/Avançar com Alt+setas, seletor de coleção, 5 abas) e conteúdo.
  - Biblioteca real pela API do M1-T09: barra lateral (Recentes, Todos, Por tipo), grade de capas em miniatura com
    setas em 2D, busca sem acento, painel de detalhes, estados carregando/erro/vazio/sem resultado, aviso de OneDrive,
    avisos da listagem e cartões de arquivo de versão futura ou ilegível. "Novo trabalho" (e Ctrl+N) cria o arquivo e o
    seleciona; "Escolher pasta da biblioteca…" e "Atualizar biblioteca" (F5) no menu Arquivo.
  - Tokens da paleta A (claro e escuro preparado) em `app/src/interface/estilos/`; ícones SVG próprios.
  - Janela com mínimo de 1024×700; o menu nativo deixa de existir também no desenvolvimento (DevTools com F12 só
    fora do app empacotado).
  - 36 testes novos (lógica pura, contraste WCAG dos tokens, renderização com `react-dom/server`, UI-02); 10 de 10
    mutações detectadas; total de 630 testes.
- Etapa 5, M1-T09: biblioteca de trabalhos.
  - Contrato `window.bibliodocs.biblioteca` (`listar`, `escolherPasta`, `criar`, `abrir`, `renomear`, `duplicar`,
    `excluir`) em `app/src/aplicacao/portas/biblioteca.ts`. Cada arquivo da lista tem um identificador opaco por
    janela; a pasta aparece só pelo nome.
  - Pasta padrão `Documentos\BiblioDocs Pro\Trabalhos` (criada se faltar), configurável. A escolha fica em
    `%LOCALAPPDATA%\BiblioDocsPro\preferencias.json`.
  - Índice-cache `%LOCALAPPDATA%\BiblioDocsPro\biblioteca.json`, recriável. Resumo (título, tipo, datas) feito no
    processo leitor, em lotes, só para arquivos novos ou alterados.
  - Criar trabalho vazio (tipo genérico), renomear sem sobrescrever (link físico), duplicar com id novo e excluir para
    a Lixeira com confirmação do principal. Renomear e excluir recusam trabalho aberto.
  - Indicador de pasta no OneDrive (R16) para a interface.
  - `blindar`: exceção inesperada de qualquer manipulador IPC volta ao renderer como recusa genérica, sem caminho.
  - Revisão do `revisor-seguranca`: A1 (Alta: listagem quadrática), M1–M4 e B1–B4, B6 corrigidos; B5 aceito.
    Adendo técnico no ADR-0004. Total de 594 testes (102 novos); PER-21, PER-22, SEG-06 e SEG-07 na matriz de testes;
    19 de 19 mutações detectadas.
- Etapa 5, M1-T08: IPC tipado.
  - Contrato `window.bibliodocs.projetos` (`abrir`, `salvar`, `salvarComo`, `fechar`) em
    `app/src/aplicacao/portas/projetos.ts`; o preload expõe só essas quatro funções, cada uma com canal fixo (C-10).
  - Principal (`app/src/principal/ipc/`): remetente conferido (janela do app, quadro principal, origem da interface) e
    argumentos validados com esquema estrito e limites antes de qualquer diálogo (C-11); arquivos por identificador
    opaco e destinos só por diálogo (C-12); ao renderer só vai o nome do arquivo (M6-11).
  - Leitura do `.bdp` num `utilityProcess` (`leitor-projeto`), com tempo máximo e teto de heap; backups de migração
    em `%LOCALAPPDATA%\BiblioDocsPro\backups`.
  - `textoPlano(Inline[])` no domínio, usado no nome sugerido do "Salvar como".
  - Revisão do `revisor-seguranca`: nenhum achado Alto; S8-01 a S8-07 tratados. Total de 492 testes (49 novos);
    SEG-04 e SEG-05 na matriz de testes; 8 de 8 mutações detectadas.
- Etapa 5, M1-T07: migrações do formato de projeto.
  - `migrarParaAtual` (`app/src/dominio/esquemas/migracoes.ts`):
    - cadeia `migrar_N_para_N+1` sobre os JSON ainda não validados, aplicada na ordem;
    - conferência do registro, da versão e do id depois de cada passo;
    - nunca lança.

    O registro de produção é vazio no v1. A migração fictícia v0 → v1 e as suas fixtures existem só nos testes.
  - `lerProjeto`: versão antiga é migrada e validada depois; versão futura → `ok: false` com `versaoFutura` e, quando
    possível, um `PacoteSomenteLeitura` que não pode ser salvo.
  - `abrirProjeto`: backup obrigatório dos bytes originais em `<pastaBackups>/<id>/` antes de entregar o projeto migrado;
    sem backup, o projeto antigo não abre. O arquivo original nunca é alterado na abertura.
  - Revisão do `especialista-documento`: nenhum achado Alto; M1, M2 e B1–B5 corrigidos. Adendo técnico no ADR-0004.
  - Total de 443 testes (36 novos); PER-17 a PER-20 na matriz de testes; 27 de 28 mutações detectadas (1 equivalente).
- Etapa 5, M1-T06: salvamento atômico e abertura do disco (`app/src/persistencia/arquivo/`).
  - `gravarAtomico`/`salvarProjeto`:
    - temporário exclusivo no mesmo diretório, com `fsync`;
    - `.bak` por **cópia** (o destino nunca some do disco);
    - troca por `rename`;
    - tentativas com espera crescente em `EPERM`/`EBUSY`/`EACCES`, num único orçamento de cerca de 1,55 s;
    - fila por destino.

    Nada lança exceção. Os erros têm código e mensagem em pt-BR: em uso, somente leitura, sem permissão, sem espaço,
    pasta inexistente, destino inválido, pacote inválido, falha de gravação.
  - `abrirProjeto`: confere tipo e tamanho (≤ 1 GB) pelo caminho e pelo descritor antes de ler, e recusa o arquivo que
    cresce durante a leitura.
  - Interface `SistemaArquivos` injetável, para testar falhas.
  - Total de 407 testes (37 novos), incluindo bloqueio real por outro processo no Windows. PER-12 a PER-16 na matriz de testes.
  - Revisão do `revisor-seguranca`: nenhum achado Alto. M6-01 (somente leitura) e M6-02 (orçamento duplicado) corrigidos,
    assim como M6-04, M6-05, M6-07, M6-08 e M6-09; um defeito achado pelo teste do M6-09 (o app apagava um `.bak.tmp` que não era dele) também foi corrigido. M6-03 vai para o T12; M6-10 e M6-11 vão para o T08. Adendo técnico no ADR-0004.
  - Medição: gravação de 25 MB em disco entre 64 e 180 ms (com o `.bak`).
- Etapa 5, M1-T05: contêiner `.bdp` em memória (`app/src/persistencia/conteiner/`).
  - `empacotarProjeto` valida tudo e relê o resultado antes de devolvê-lo. A saída é determinística, com `mimetype`
    primeiro e sem compressão.
  - `lerProjeto` analisa o diretório central do ZIP com código próprio e descomprime sob demanda com `node:zlib`. Recusa:
    - nomes fora da lista e nomes repetidos;
    - ZIP64, criptografia, descritor de dados e comentário;
    - lacunas, sobreposição e lixo depois do fluxo deflate;
    - CRC errado;
    - quem passar dos limites do ADR-0004.

    Também exige `id` e `tipoTrabalho` iguais entre o manifesto e o documento. Mídia divergente é descartada com aviso.
  - Montador de ZIP malicioso para testes (`app/tests/apoio/zip-bruto.ts`).
  - Total de 370 testes (60 novos); PER-07 a PER-11 na matriz de testes.
  - Revisão do `revisor-seguranca`: achados A1 (Alta) e A2 a A5 corrigidos; A6 eliminado ao trocar o `Inflate` do
    `fflate` pelo `node:zlib`. Adendo técnico no ADR-0004.
  - Dependência nova: **`fflate` 0.8.3** (MIT, sem dependências; prevista no ADR-0004), usada só para escrever o ZIP.
- Etapa 5, M1-T04: contratos e esquemas do formato de projeto v1.
  - Tipos mínimos do modelo (`app/src/dominio/modelo/tipos.ts`): `Documento`, `Secao`, `Bloco` (`paragrafo`, `quebraPagina`)
    e `Inline` (`texto` com marcas).
  - Esquemas zod estritos de `documento.json` e `manifesto.json`, com limites (`app/src/dominio/esquemas/`).
  - Validação com caminho e mensagens em pt-BR. Recusa:
    - aninhamento JSON patológico (verificado antes do zod) e mais de 64 níveis de seção;
    - ids repetidos;
    - caracteres proibidos em XML 1.0;
    - marcas conflitantes;
    - mídias com caminho, tipo ou sha256 incoerentes.
  - JSON Schema draft 2020-12 gerado e versionado em `app/esquemas/projeto-v1/`; comando `npm run esquemas:gerar`.
  - Fixtures em `app/tests/fixtures/projeto-v1/`. Total de 310 testes (52 novos); grupo PER na matriz de testes.
  - Adendo técnico no ADR-0004.
  - Dependência nova: **`zod` 4.6.7** (MIT, sem dependências; prevista no ADR-0004), só em `dominio/esquemas`.
- Etapa 5, M1-T03: infraestrutura de testes.
  - Comandos `npm run verificar` (typecheck + Vitest + `npm audit --omit=dev --audit-level=high`) e `verificar:tudo` (+ build).
  - Analisador de imports sem dependência nova (`app/tests/apoio/`).
  - Teste de fronteiras do ADR-0005 (regras 1–6, com casos negativos por regra).
  - Varreduras de HTML inseguro, rede, `openExternal` e lockfile (C-18..C-20).
  - Total de 258 testes; grupos ARQ e SEG em `docs/MATRIZ_DE_TESTES.md`; adendo técnico no ADR-0005.
- Etapa 5, M1-T02 — endurecimento do runtime Electron (checklist C-2..C-9, C-15, C-21, C-22 parte 1):
  protocolo `app://interface` com resolução segura de caminho; CSP de produção idêntica ao checklist (cabeçalho) e
  CSP de desenvolvimento restrita à origem do Vite; bloqueio de navegação, janelas, webview, permissões e rede
  (`data:` só imagem, `blob:` só imagem/xhr); `abrirLinkExterno` (https de lista fixa, com confirmação); corretor
  desligado; DevTools só fora do pacote; instância única; logs só com `protocolo//host`. Módulos em
  `app/src/principal/seguranca/`; 140 novos casos de teste (156 no total); `docs/relatorios/M1_RELATORIO_MARCO.md`
  com o registro do `revisor-seguranca`.

- Etapa 5, M1-T01 — esqueleto do aplicativo em `app/`: `package.json` com versões exatas (electron 44.7.2,
  electron-vite 6.0.0, vite 8.3.4, react 19.3.1, typescript 7.0.2, vitest 5.0.5), `.npmrc` (`save-exact`),
  configuração electron-vite (principal, preload, interface), tsconfigs estritos (node/puro/web), pastas de `app/src/`
  do ADR-0005 com `index.ts` de marcação, `app/perfis/uft-2022/`, teste de estrutura (16 casos) e `app/README.md`.

- Etapa 1 — Inventário: `docs/relatorios/ETAPA1_INVENTARIO.md`; repositório git (commit inicial `acc4f73`);
  `.gitattributes` (`materiais/** -text -diff`) para preservar os originais byte a byte apesar de `core.autocrlf`.

- Etapa 2 — Auditoria: `docs/relatorios/ETAPA2_AUDITORIA.md` (mapa de módulos, funcionalidades,
  defeitos E-1..E-8, riscos S-1..S-14, regras candidatas CA-01..CA-22, reaproveitamento por módulo);
  harness `analise/harness/gerar_docx_linha_base.js` e DOCX de linha de base em `analise/amostras/`.
- `docs/MATRIZ_DE_RISCOS.md`: riscos R18 (XSS) e R19 (regras antigas tomadas como norma).
- Etapa 3 — Análise normativa: `docs/relatorios/ETAPA3_ANALISE_NORMATIVA.md` (método, amostragem, riscos N-1..N-6
  e, em apêndice, as análises das três frentes com divergências Manual × modelos × código e as perguntas de fonte).

- Etapa 4 — Planejamento arquitetural (ADRs ACEITOS em 2026-10-16): `docs/decisoes/ADR-0003-tecnologia-do-aplicativo.md`
  (Electron 44 + TypeScript + React 19 + `docx` 9.11.x, com resultado da PoC DOCX), `ADR-0004-formato-do-projeto.md`
  (`.bdp`, salvamento atômico, recuperação, importador do backup antigo), `ADR-0005-modulos-e-contratos.md`,
  `ADR-0006-estrategia-de-testes.md`; `docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md` (checklist C-1..C-22);
  `docs/relatorios/ETAPA4_PLANO_M1_RASCUNHO.md`. PoCs descartáveis em `analise/poc-docx/` e `analise/poc-ui/`.
- `docs/MATRIZ_DE_RISCOS.md`: riscos R20–R33 (suporte do runtime, assinatura de código, auto-update, rede implícita,
  salvamento com EPERM, arquivo malicioso, LibreOffice, chaves, LanguageTool, TS 7, Playwright, estimativa de
  páginas, versões do `docx`, downgrade de formato).

### Corrigido
- M2-T06: colar HTML com `style` gerava relatórios de violação da CSP (o `DOMParser` herda a CSP da página); a CSP
  continua a mesma e os estilos são neutralizados antes da leitura.
- M2-T06: inserir nota com texto selecionado apagava o texto; agora a chamada vai para o fim da seleção.

### Alterado
- `app/README.md`: estado do M1, `npm ci`, partes do M1-T06 ao M1-T14, testes E2E, estrutura e situação final da
  segurança (antes parada no M1-T02). Os 13 comandos documentados foram executados e funcionam.
- `docs/ESTADO_DO_PROJETO.md`: o `typecheck` roda 4 projetos, e 5 arquivos importam `electron` (corrigido).
- Kit: a busca de segredos de `scripts/validar-kit.ps1` e `tests/test_estrutura_kit.py` ignora pastas geradas e
  ignoradas pelo git (`node_modules`, `out`, `release`, `release-fumaca`). READMEs de dependências trazem exemplos de chave.
- M1-T13: ao iniciar, o Chromium procurava proxy automático (consulta DNS `wpad` na rede local) e testava o IPv6,
  mesmo sem nenhuma requisição. O app agora inicia com `no-proxy-server` e não faz nenhuma atividade de rede
  (RNF-03).
- Electron 44.7.2 → **44.8.0** (correções de segurança do Chromium 152.0.7977.167/.169 e V8; recomendação do
  `revisor-seguranca`, autorizada pelo usuário). Lock e SHA-256 do binário conferidos.
- `scripts/validar-kit.ps1` e `tests/test_estrutura_kit.py`: esperam `app/README.md` no lugar de `app/LEIA-ME.md`.
- `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md`: de semente (17 regras) para 312 regras RN-001..RN-312 com fonte,
  validação automática e status; coluna Observações; ordem dos elementos por tipo de trabalho; conflitos
  consolidados (20 aguardando o usuário, 7 resolvidos); pendências de fonte por norma. Semente revisada:
  RN-001, 004–009, 011, 015–017 corrigidas; RN-006 e RN-009 desmembradas.
- `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md`: decisões do usuário de 2026-10-15 registradas em 46 linhas
  (todas as recomendações aceitas; separador de milhares = ponto, RN-261; referência de monografia
  "Universidade, Programa", RN-206; apêndices/anexos com título geral centralizado e identificação à esquerda,
  RN-237). Situação final: 283 CONFIRMADA, 5 AMBÍGUA, 24 PENDENTE-FONTE, 0 CONFLITO. Seções "Decisões do
  usuário" e "Ambiguidades remanescentes".
- `docs/relatorios/ETAPA3_ANALISE_NORMATIVA.md`: seção "Decisões do usuário (2026-10-15)"; riscos N-1 e N-2 resolvidos.
- `docs/ARQUITETURA_PRELIMINAR.md`: status "DEFINIDA (ADR-0003 aceito em 2026-10-16)".
- `docs/REFERENCIA_DE_LAYOUT.md`: paleta A — Cerrado claro escolhida pelo usuário.
- `docs/PLANO_DE_IMPLEMENTACAO.md`: tarefas M1-T01..T15 com critério de aceite e comando de verificação.
- `.gitignore`: `*.pfx`, `*.p12`, `*.spc` (chaves de assinatura; SR-11).
- `tests/artefatos_futuros.txt`: retirados os relatórios das Etapas 1 e 2, que já existem.
- `docs/INVENTARIO_DE_MATERIAIS.md`: resultado das observações O-1..O-8 (Etapa 2).
- `docs/INVENTARIO_DE_MATERIAIS.md`: caminhos completos, tamanhos, formato conferido e SHA-256 dos 14 itens
  (10 checksums novos), agora verificados por `validar-kit.ps1` e `test_estrutura_kit.py`.

### A fazer
- Etapa 4 — Planejamento arquitetural.

### Removido
- `app/LEIA-ME.md` (substituído por `app/README.md`, conforme o M1-T01).

## [kit-1.1.0] — 2026-10-12

### Adicionado
- `docs/REFERENCIA_DE_LAYOUT.md` e `materiais/referencias_layout/itunes_tela_referencia.png`: layout
  inspirado no iTunes para Windows, com um pequi no lugar da maçã (decisão do usuário).
- Norma Tabular do IBGE (1993) como fonte oficial das tabelas, conforme remissão do Manual UFT (p. 20 e 43).
- Guias do IFPR e da FURB registrados como exemplos visuais de outras instituições.

### Alterado
- Inventário: modelos `.doc`, estudo Capcom `.docx`, IBGE e guias marcados como presentes (checksums na Etapa 1).
- Política de fontes, matriz normativa, agentes `especialista-normas`, `especialista-elementos-visuais`,
  `especialista-interface`, skills `tabelas-elementos-visuais` e `interface-desktop`, `PROMPT_EXECUCAO.md`,
  visão do produto, matriz de testes (UI-01, UI-02), README e LEIA-ME de `materiais/`.

## [kit-1.0.1] — 2026-10-12

### Alterado
- Esclarecido em toda a documentação, agentes e skills que o estudo Capcom é apenas um exemplo de
  trabalho acadêmico formatado (referência de apresentação, junto com os 6 modelos `.doc`); o tema dele
  não gera requisito, funcionalidade, regra ou dado de teste.

## [kit-1.0.0] — 2026-10-12

### Adicionado
- Kit de desenvolvimento com Claude Code: `CLAUDE.md`, `PROMPT_EXECUCAO.md` (plano em 7 etapas),
  `README.md`, `INSTRUCOES_INICIAIS.md`.
- 8 agentes em `.claude/agents/` e 15 skills em `.claude/skills/` (2 como comandos do usuário).
- `.claude/settings.json` com regras de proteção (sem permissões amplas, sem credenciais).
- Documentação em `docs/` (visão, requisitos, arquitetura preliminar, plano, riscos, testes,
  política de fontes, inventário, recursos do Claude Code, estado do projeto, matriz normativa semente).
- ADR-0001 (mecanismos nativos do Claude Code) e ADR-0002 (originais somente leitura).
- Scripts PowerShell `validar-kit.ps1` e `verificar-ambiente.ps1`; teste Python `tests/test_estrutura_kit.py`.
- Materiais incluídos: `tcc-uft-sistema_10.zip`, Manual de Normalização UFT 2022 e extração de texto
  do estudo Capcom. Modelos `.doc` da UFT pendentes (não disponíveis como arquivo na preparação).
