# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Datas em AAAA-MM-DD.
Registre aqui cada entrega do aplicativo (Etapa 5 em diante) e mudanças na infraestrutura do kit.

## [Não lançado]

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
