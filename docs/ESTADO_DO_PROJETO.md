# Estado do projeto

> Fonte única de verdade sobre o andamento. Atualizado pela skill `fechamento-de-tarefa` ao fim de
> cada tarefa. Lido no início de toda sessão (regra do `CLAUDE.md`).

**Última atualização:** 2026-10-17 — M2-T06 concluído (editor na aba Escrever ligado à sessão; menu Editar; nota de rodapé).
**Etapa atual:** Etapa 5 — Implementação. Marco **M1 concluído**; M2 em andamento (T01 ✔, T03 ✔, T04 ✔, T05 ✔, T06 ✔).

## Etapas

| Etapa | Status | Relatório |
|---|---|---|
| 0. Preparação do kit | CONCLUÍDA | `docs/relatorios/RELATORIO_VALIDACAO_KIT.md` |
| 1. Inventário | CONCLUÍDA | `docs/relatorios/ETAPA1_INVENTARIO.md` |
| 2. Auditoria | CONCLUÍDA | `docs/relatorios/ETAPA2_AUDITORIA.md` |
| 3. Análise normativa | CONCLUÍDA (312 RN: 283 CONFIRMADA, 5 AMBÍGUA, 24 PENDENTE-FONTE, 0 CONFLITO) | `docs/relatorios/ETAPA3_ANALISE_NORMATIVA.md` |
| 4. Planejamento arquitetural | CONCLUÍDA (ADR-0003 a 0006 aceitos) | `docs/decisoes/ADR-0003-tecnologia-do-aplicativo.md`, `docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md` |
| 5. Implementação (M1–M7) | EM ANDAMENTO (M1: T01–T15 ✔ — **M1 CONCLUÍDO**; M2: T01 ✔, T03 ✔, T04 ✔, T05 ✔, T06 ✔, T02 e T07–T12 pendentes, ADR-0007 ACEITO) | `docs/relatorios/M1_RELATORIO_MARCO.md`, `docs/relatorios/REVISAO_M1.md`, `docs/relatorios/M2_RELATORIO_MARCO.md` |
| 6. Testes e validação | PENDENTE | — |
| 7. Estabilização | PENDENTE | — |

Status possíveis: `PENDENTE`, `EM ANDAMENTO`, `AGUARDANDO USUÁRIO`, `CONCLUÍDA`.

## Próximo passo
1. **M2-T07** (árvore de seções na interface: inserir, renomear, mover, recuar/promover, com o `HistoricoEdicao` único
   de texto e estrutura), **M2-T02** (tipos de trabalho) ou **M2-T10** (backups rotativos). Recomendado: T07, que
   completa a edição começada no T06.
2. Todo incremento termina com `cd app; npm run verificar:tudo` passando.

## Decisões do M2-T06 (2026-10-17, delegadas pelo usuário: "deixo todas ao seu julgamento")
O usuário delegou todas as confirmações à sessão principal. Decisões visíveis tomadas (motivos no relatório do M2,
seção M2-T06; técnicas no adendo do M2-T06 no ADR-0007):
- Aba Escrever: dados do trabalho em cima; lista de seções à esquerda (número + título, recuo por nível) com "Nova
  seção"; editor da seção escolhida à direita com barra I, N, x², x₂ e "Nota de rodapé"; atalhos do Word.
- Trabalho sem seção não ganha seção sozinho: aparece "Use “Nova seção” para começar o texto".
- A chamada da nota aparece como a marca "nota" (sem número, RN-102 PENDENTE-FONTE); o texto abre num quadro abaixo.
- Inserir nota com texto selecionado põe a chamada no fim da seleção, sem apagar (como no Word).
- Menu Editar ligado, com "Colar sem formatação" (Ctrl+Shift+V).
- Commit do M2-T06: `9906213` (sem `git push`).

## Decisões do M2-T05 (2026-10-17, delegadas pelo usuário: "Deixo você fazer essa decisão")
- Colagem: a quebra simples do texto puro vira espaço; `&nbsp;` fica inseparável; o estilo "Citação" do Word continua
  parágrafo. Os motivos estão no relatório do M2 e no adendo do M2-T05 no ADR-0007. Commit do M2-T05 autorizado.

## Decisões da preparação do M2 (2026-10-17, delegadas pelo usuário à sessão principal)
O usuário escreveu: "deixo essas decisões para você".
- **ADR-0007 aceito:** ProseMirror puro (dependências instaladas só no M2-T05, avisando antes), um editor por seção,
  colagem própria, componentes próprios sem Radix. Riscos R38–R45 registrados na matriz de riscos.
- **Itens visíveis:** uma seção por vez; aparência neutra no editor, com a forma final na Pré-visualização (rever no
  fechamento do M3); a colagem preserva itálico, negrito, sobrescrito, subscrito e parágrafos, e recusa imagens e
  tabelas com aviso; corretor ortográfico desligado no M2.
- **C-B18:** relatório técnico e projeto de pesquisa usam os elementos dos modelos UFT como sugestão editável,
  identificada como não exigida pelo Manual; o verificador não acusa ausência.
- **C-A6 (RN-025):** depois de `z)` vem `aa), bb), cc)` (valor de perfil; continua sem fonte, P-03).

## Decisões do fechamento do M1 (2026-10-17, delegadas pelo usuário à sessão principal)
- **R-M1-01 (Alta, desempenho):** aceito para fechar o M1; vira **M2-T01**, obrigatório antes de ligar o editor
  (medir; se passar da meta, instantâneo incremental e empacotamento fora do principal). O M1 não tem conteúdo que
  dispare o problema.
- **R-M1-02 (`.bak`):** ao excluir, o `.bak` vai para a Lixeira junto; ao renomear, é renomeado junto. Implementar no
  M2 com teste (tarefa no plano).

## Pendências do usuário
- Nenhum material ausente (Etapa 1: 14/14 itens presentes, SHA-256 registrados no inventário).
- **LibreOffice:** instalado em `C:\Program Files\LibreOffice\program\soffice.exe` (fora do PATH);
  usado na Etapa 2 para converter DOCX→PDF [VERIFICADO 2026-10-15].
- (Opcional, recomendado antes do M3) Abrir `analise/poc-docx/poc_final.docx` no Microsoft Word e informar se
  aparece aviso de reparo, pergunta de atualizar campos ou diferença em relação a `analise/poc-docx/pdf/poc_final.pdf`.
- (Opcional) Abrir `analise/amostras/linha_base_tcc.docx` no Microsoft Word e informar se aparece aviso
  de reparo ou diferença em relação ao PDF do LibreOffice.

## Decisões do M2-T04 (2026-10-17, delegadas pelo usuário: "deixo você tomar as decisões")
- Nota de rodapé no título do trabalho continua recusada (sem RN que a exija; RN-116 põe o artigo-TCC no formato de
  trabalho acadêmico). Commit do M2-T04 autorizado.

## Decisão do M2-T03 (2026-10-17, do usuário)
- **Promover como o Word:** a seção vira a irmã logo depois da mãe e as irmãs seguintes passam a ser subseções dela; a
  ordem do texto não muda (adendo do M2-T03 no ADR-0007).

## Instruções para etapas futuras
- Núcleo do editor (M2-T05; adendo do M2-T05 no ADR-0007; `app/README.md`, "Núcleo do editor"):
  - **Feito no M2-T06** (adendo do M2-T06 no ADR-0007): todo `EditorState` nasce em `criarEstadoSecao`; E2E de colagem
    real e net-log; NodeView da nota; M6 e B5 corrigidos; latência medida com o editor.
  - **Para o M2-T07:**
    - o `HistoricoEdicao` único (texto + estrutura, ADR-0007 §4) entra com as operações estruturais; hoje cada seção tem
      só o histórico de texto (`MemoriaEditores` em `EditorSecao.tsx`), e "Nova seção" não se desfaz;
    - operação estrutural na sessão: refazer `#caminhos` e `#secoes` (como `inserirSecaoNoFim`); a geração **não** muda
      (senão a `MemoriaEditores` perde os históricos); seção excluída → guardar o `EditorState` no inverso;
    - o `rotulo` do `EditorSecao` ("Texto da seção N") já acompanha a renumeração por `setProps`.
  - **Pendências do M2-T06 sem marco:** conferir as fixtures de colagem com a cópia real do Word e do LibreOffice
    (roteiro manual); roteiro com teclado ABNT2 físico (R41) e NVDA (R42, inclusive o `role="doc-noteref"` da chamada);
    E2E de nota em trabalho só leitura (precisa de um arquivo de versão futura com nota).
  - Menu Editar: Recortar, Copiar e Colar só pelo canal `edicao` (`webContents.cut/copy/paste`); nunca dar à página
    permissão de área de transferência. Ação nova → `ACOES_EDICAO` + `COMANDOS_EDICAO` em `registrar.ts` + teste. O
    preload só chama o canal com gesto do usuário (`userActivation`); não tirar essa condição.
  - Colagem: `neutralizarEstilos` antes do `DOMParser` (a CSP é herdada); não afrouxar a CSP por causa de colagem.
  - E2E: selecionar texto pelo DOM (`Range`), não por setas atravessando a chamada da nota (o número de passos varia).
  - **Para o M6:** recortar e colar dentro do app troca os ids (M5 da revisão); reaproveitar o `data-id` livre antes
    das remissivas.
  - Pendências de colagem sem marco: `mso-tab-count` e NBSP (B2, decisão do usuário), `white-space:pre` em `span`
    (B3), `p` dentro de `li` e listas seguidas (B4).
  - Mudou o formato v1 (limites, padrão de id ou de texto) → atualizar as cópias em `interface/editor/` (o teste falha).
- **Não rodar Prettier nem outro formatador automático:** o projeto não tem configuração, e o estilo (aspas simples,
  ~120 colunas) é manual. Em 2026-10-17, um `--write` reformatou 10 arquivos (ver o relatório do M2, M2-T04).
- Modelo M2 (M2-T04; adendo no ADR-0007, que **substitui** o esboço do ADR-0005 §3 e do ADR-0007 §2):
  - nota embutida `{ tipo:'nota', id, conteudo: InlineDeNota[] }`, sem `Documento.notas`; `citacaoLonga` sem
    `chamada`; `alineas.itens[].subalineas` (omitido quando vazio);
  - para alargar o conteúdo de nota ou de título (M4 citação, M6 remissiva e sigla), mexer em `InlineDeNota` e
    `InlineDeTitulo` (`tipos.ts`) e em `conteudoSoTexto` (`projeto-v1.ts`);
  - rótulo da alínea só por `rotuloAlinea` (`dominio/numeracao`); percorrer conteúdos ou ids de bloco por
    `conteudosDoBloco` e `idsDoBloco`;
  - **para o M2-T05:** colar (inclusive dentro do app) e dividir bloco dão ids novos a blocos **e a notas**, porque um
    id repetido torna o `.bdp` ilegível (R38); a conversão é validada com `validarDocumentoV1` nos testes; as fixtures
    de ida e volta são `documento-valido.json` e `documento-bordas-m2.json`;
  - **para o M3:** nota, citação e alínea vazias são válidas no modelo (não exportar `w:footnote` vazia; avisar); nota
    é de um parágrafo; numeração das notas segue pendente (RN-102, PENDENTE-FONTE);
  - **para o M4:** repetir o teste "estrutura mais funda" quando a `citacao` entrar na nota (139 dos 144 níveis
    JSON hoje);
  - nota no título do trabalho: **recusada** (decisão de 2026-10-17, delegada pelo usuário). Nenhuma RN a exige, e o artigo
    como TCC segue o formato de trabalho acadêmico (RN-116). Se surgir fonte ou pedido, alargar `InlineDeTitulo`
    (mudança aditiva).
- Árvore de seções (M2-T03):
  - Numeração só por `numerarSecoes`/`mapaIndicativos` (`dominio/numeracao`); nunca gravar número no modelo.
  - Mudança estrutural só pelas operações de `dominio/modelo/operacoes.ts`; mostrar `mensagem` da recusa como texto.
  - **Para o M2-T06/T07:**
    - o `HistoricoEdicao` guarda o `inverso` como o recebeu, sem copiar nem serializar (senão ele perde a permissão de
      restaurar além dos limites);
    - `mudou: false` não soma revisão nem empilha desfazer;
    - seção nova precisa de id no formato do esquema (fábrica a criar; `inserirSecao` não confere o formato);
    - memorizar `mapaIndicativos` pelo `corpo` se recalcular a cada transação.
  - **Para o M2-T08/T09:** quando pré e pós-textuais tiverem blocos, a unicidade de ids do `inserirSecao` deve
    considerá-los (B2 da revisão).
- Desempenho (M2-T01):
  - Todo `salvarProjeto` do principal passa pelo empacotador (`worker_threads`, `src/principal/empacotador.ts`):
    chamada nova de gravação no principal → `salvar` de `registrar.ts` (com `{ empacotar }`), nunca `salvarProjeto`
    direto. Nada de `empacotarProjeto` síncrono no principal.
  - Projeto entregue ao renderer com identificador → registrar com as mídias **conferidas**
    (`registro.registrar(caminho, dono, id, midias)`), senão o primeiro salvar paga um `MIDIA_AUSENTE` e o reenvio de
    tudo. Canal novo que grava pacote de um identificador → `PacoteEnvio` + `lerPacoteTransferivel(v, registro.midias(...)
    ?? new Map())` + `trocarMidias` **só depois** de o empacotamento dar certo (revisão F1). Nunca guardar bytes
    vindos do renderer antes disso.
  - **Medido no M2-T06 com o editor** (seção 1.1.1 do documento grande): p95 8–15 ms. Se um dia passar de 50 ms, o
    próximo passo é mandar só as seções alteradas (o principal ainda desserializa o `documento.json` inteiro).
  - Memória perto da meta (pico 738–787 MB de 800 no M2-T06; 700–760 no M2-T01): rever no M5, com figuras de verdade.
  - Worker dentro do ASAR: conferido com o `app.asar` do `dist:pasta` (E2E-01 e E2E-07 com o `out/` escondido). Na
    próxima fumaça do pacote (Etapa 7 ou troca de Electron), conferir também no `.exe` com os fuses.
- Fechamento do M1 (M1-T15):
  - Revisão do marco em `docs/relatorios/REVISAO_M1.md` (R-M1-01..13, checklist C-1..C-22 final, licenças,
    desempenho, onde o texto do usuário fica no disco). Riscos novos R36 e R37.
  - `app/README.md` cobre todos os comandos (13 conferidos em 2026-10-17), as partes do T06 ao T14, os E2E e a
    situação final da segurança. Comando novo ou parte nova → atualizar o README no mesmo incremento.
  - Matriz de testes: grupo E2E (E2E-01..06) criado; caso E2E novo → linha nova ali, ligada ao caso funcional.
  - Fim de cada marco: repetir a skill `revisao-seguranca-qualidade` e gerar `REVISAO_M<n>.md`.
- Empacotamento (M1-T14):
  - Configuração em `app/electron-builder.config.cjs` (não há YAML); ganchos em `app/empacotamento/`; decisões e
    medidas no adendo do M1-T14 no ADR-0003. `npm run dist` (instalador), `dist:pasta`, `dist:fumaca`.
  - **Nunca distribuir** o instalador sem assinatura (R34: o Controle Inteligente de Aplicativos ativo nesta máquina
    bloqueou o `.exe` do `dist:fumaca`). Não contornar o bloqueio.
  - O app empacotado recusa toda chave de linha de comando antes de `--`, exceto `--updated`
    (`src/principal/seguranca/argumentos.ts`). Chave nova necessária no pacote → lista de permissão + teste. A
    associação `.bdp` (futura) deve registrar `"...exe" -- "%1"` e tratar o argv de `second-instance` do mesmo jeito.
  - Fumaça do pacote: script de referência descrito no relatório do M1 (fuses em execução, ASAR adulterado, CDP no
    `dist:fumaca`, negativo no instalador). Repetir a cada troca de Electron ou electron-builder (SEG-09/10).
  - Mudou o `name` do `package.json` → mudar a pasta `bibliodocs-pro-updater` em `empacotamento/instalador.nsh`
    (o teste confere).
  - **Para a Etapa 7:**
    - assinatura (`forceCodeSigning`, `publisherName`);
    - NSIS legado 3.0.4.1 (CVE-2023-37378) → avaliar `toolsets.nsis`;
    - build de release com cache do electron-builder limpo ou em CI;
    - `CompanyName` definitivo;
    - instalação limpa no Windows 10/11, atualização por cima e desinstalação com o app aberto (DIST);
    - aviso de terceiros consolidado (RNF-15).
  - Desinstalar mantém `%LOCALAPPDATA%\BiblioDocsPro` (recuperação e backups com texto dos trabalhos),
    `%APPDATA%\BiblioDocs Pro` e `Documentos\BiblioDocs Pro` (documentado no `app/README.md`). Uma opção "apagar
    dados" seria decisão do usuário. Decidido em 2026-10-17 (delegado pelo usuário): o desinstalador nunca apaga dados.
  - Ícone: `app/recursos-build/icone*.svg` → `npm run icone:gerar` → `icone.ico` (versionado). Mudou o pequi da
    interface → atualizar os SVGs do ícone também.
- E2E (M1-T13):
  - `app/e2e/`; apoio em `e2e/apoio/app.ts` (`criarAmbiente`, `abrirApp`, `fechar`, `matar`, `atividadeDeRede`,
    `lerDocumento`). Decisões e armadilhas medidas no adendo do M1-T13 no ADR-0006 (eval no `page.evaluate`, `%2e%2e`
    normalizado, `will-frame-navigate`, janela mínima 1026×700). Sempre fechar/matar pelo apoio (a limpeza encerra
    o que ficou aberto).
  - Novo fluxo de interface → um cenário E2E; conferir `x.problemas` vazio (console, exceções, CSP).
  - **Rodar `npm run test:e2e` a cada troca de Electron** (SEG-03, SEG-08).
  - **Para o M1-T14:** o pacote liga fuses (ex.: `EnableNodeCliInspectArguments` desligado) que impedem o
    Playwright de dirigir o `.exe`; o E2E continua sobre o build (`out/`). Conferir no pacote, à mão, a chave
    `no-proxy-server` (net-log) e a ausência de DevTools.
  - Pendentes: diálogos nativos e Lixeira sem E2E; axe-core (RNF-09) no M2; escala real por monitor; a chave
    `no-proxy-server` ignora proxy manual — rever junto com o LanguageTool (B-3).
- Recuperação (M1-T12):
  - Disco em `app/src/persistencia/recuperacao/`; regras e ganchos em `app/src/principal/ipc/manipuladores-recuperacao.ts`;
    decisões e desvios no adendo do M1-T12 no ADR-0004. Regra: nada da recuperação é apagado sem decisão do usuário
    (descartado → `recuperacao-antigos`, 7 dias do arquivamento).
  - Gravação nova no arquivo do usuário → passar por `antesDeGravar`/`aoGravar` (senão os instantâneos não são apagados,
    ou um instantâneo mais novo é apagado). Registro de projeto novo → `registrar(caminho, dono, idProjeto)` com o id
    conhecido pelo principal.
  - Edição nova do documento (M2) → além de somar revisão, chamar `#agendarInstantaneo()` (como `alterarTitulo`).
  - **Para o M1-T13:** E2E RNF-04 pode partir da fumaça do T12 (relatório do M1): `taskkill /F /T` na árvore, reabrir,
    conferir a oferta (texto aceita "HH:MM" e "DD/MM/AAAA às HH:MM"). `LOCALAPPDATA` redirecionado isola os dados.
  - Pendentes: medir o instantâneo com 25 MB e, se travar a interface, empacotar fora do principal (antes do editor do
    M2); tela para reabrir `recuperacao-antigos`; oferta visível mesmo com a Biblioteca em erro; backups rotativos
    (`backups\<id>\`, 10 + 1/dia por 7 dias, ADR-0004 §4) ainda não implementados (não constavam do T12).
- Sessão de edição (M1-T11):
  - `SessaoTrabalho` em `app/src/aplicacao/servicos/sessao-trabalho.ts`; hook em `interface/escrever/useSessao.ts`;
    decisões no adendo do M1-T11 no ADR-0004. Toda gravação passa pela fila (`#enfileirar`); nada grava fora dela.
  - Edição nova do documento (M2) → método na sessão que soma revisão e agenda o automático, como `alterarTitulo`.
  - **Para o M1-T12:** o instantâneo de ~2 s pode ouvir a sessão (`assinar`) e usar `pacote`; ao gravar no arquivo
    (`aoSalvar`), apagar os instantâneos do projeto; a trava de sessão nasce no `abrir`/`criar` do principal.
  - **Para o M1-T13:** E2E dos diálogos (Abrir…, Salvar como…), versão futura só leitura, arquivo sem `.bdp`; o roteiro
    da fumaça do T11 no relatório do M1 serve de base (atenção: Enter que envia formulário precisa de `text: "\r"`).
  - Pendentes: botões de seção/zoom/pré-visualizar seguem desativados até M2/M3; título perde marcas ao editar (M2).
- Interface (M1-T10):
  - Decisões visuais em `docs/GUIA_VISUAL.md`; decisões técnicas no adendo do M1-T10 no ADR-0005.
  - Cor/medida nova → token em `app/src/interface/estilos/tokens.css` (o teste recusa cor solta e confere contraste).
  - Regra de teclado/filtro/texto nova → função pura em `casca/` ou `biblioteca/` com teste em Node; componente →
    `tests/interface/*.test.tsx` (`react-dom/server`, sem tipos do Node).
  - Controles com setas ignoram Ctrl/Alt/Windows (`temModificador`); atalhos globais ficam em `acaoDoAtalho`.
  - **Para o M1-T11:**
    - `BarraSuperior` recebe `visor`: passar `{ tipo: 'trabalho', ... }` com `salvamento` (`casca/visor.ts` já tem os 4
      textos); ligar os botões de seção, zoom e os itens de menu Abrir/Salvar/Fechar (hoje sem `comando`);
    - `useBiblioteca.criar` hoje fecha o identificador logo após criar: passar a manter o trabalho aberto no editor;
    - Enter/duplo clique no cartão e "Abrir" no painel de detalhes; renomear/duplicar/excluir na interface;
    - `ABERTO_NO_APP` → orientar a fechar o trabalho.
  - **Para o M1-T13:** E2E das faixas (o CDP do Electron não redimensiona a janela: usar a API do Playwright) e do
    `minWidth`; escala 125%/150%; roteiro da fumaça do T10 no relatório do M1 serve de base.
  - Pendências sem marco: coleções do usuário na barra lateral (precisa de onde guardar), tema escuro (tokens prontos),
    capa fiel (motor normativo, M3), rótulos dos seis tipos UFT em `ROTULOS_TIPO` (M2).
- Biblioteca (M1-T09):
  - Contrato em `app/src/aplicacao/portas/biblioteca.ts`; manipuladores em `app/src/principal/ipc/manipuladores-biblioteca.ts`;
    disco em `app/src/persistencia/biblioteca/`. Decisões no adendo do M1-T09 no ADR-0004.
  - Todo manipulador novo passa por `blindar` (em `registrar.ts`) e por `criarConferencia`; operação que mexe na pasta
    entra na fila (`emFila`), e diálogo fica **fora** dela, com reconferência dentro.
  - **Para o M1-T10/T11:**
    - grade a partir de `ItemBiblioteca`, com `estado` `versaoFutura`/`invalido` visível;
    - aviso quando `pasta.naNuvem`; mostrar os `avisos` da listagem (lista parcial, falha de leitura);
    - `criar` já devolve `ProjetoAberto` com identificador de gravação;
    - `ABERTO_NO_APP` → orientar a fechar o trabalho;
    - nome digitado vai cru ao `renomear` (o principal valida e devolve a mensagem);
    - texto sempre como texto (nunca `innerHTML`).
  - **Para o M1-T12:**
    - a varredura ignora `*.bdp.tmp-*` e `.bak`; a recuperação deles é do T12 e pode reaproveitar `listarPasta`;
    - id novo no duplicar já separa as pastas `backups/<id>` e `recuperacao/<id>`.
  - **Para o M1-T13:** E2E clicando nos diálogos (escolher pasta, confirmar exclusão) e Lixeira real.
  - Resíduos aceitos: corrida de processo externo em criar/duplicar e `projetos.abrir` por diálogo durante um
    renomear. Miniatura no índice quando houver miniatura (M2+).
- IPC (M1-T08):
  - Contrato em `app/src/aplicacao/portas/projetos.ts`; manipuladores puros em `app/src/principal/ipc/`, ligados ao
    Electron só em `registrar.ts`. Canal novo: constante no contrato, função no `preload/api.ts`, manipulador com
    `conferir` (remetente + quantidade de argumentos) e caso de recusa em `tests/ipc-projetos.test.ts`.
  - Nunca devolver caminho completo ao renderer; arquivo novo de destino só por diálogo ou pasta do app.
  - Leitura de `.bdp` sempre por `lerIsolado` (processo `leitor-projeto`), nunca `abrirProjeto` no principal.
  - **Para o M1-T09:** `listar/criar/duplicar/renomear/excluir` entram como canais novos; a biblioteca pode registrar
    identificadores para os arquivos da pasta padrão (o `RegistroProjetos` aceita qualquer caminho do principal).
  - **Para o M1-T11:** `identificador: null` no `abrir` = só "Salvar como"; `VERSAO_FUTURA` traz `leitura`; usar
    `codigo` (`EM_USO`, `NAO_ABERTO`...) para oferecer "Salvar como…"; mostrar texto como texto (nunca `innerHTML`).
  - **Para o M1-T13:** E2E do leitor (tempo esgotado, saída sem resposta) e da recusa por iframe/origem.
  - **Etapa 7:** avaliar sandbox do processo leitor (S8-01: isola falha, não privilégio).
- Migrações (M1-T07):
  - API: `migrarParaAtual`/`motivoParaNaoMigrar` em `app/src/dominio/esquemas`; `abrirProjeto(caminho, { pastaBackups })`.
  - Migração nova: registrar em `MIGRACOES_REGISTRADAS`, subir `VERSAO_FORMATO_ATUAL` e criar
    `tests/fixtures/migracoes/v<N>-para-v<N+1>/` com `entrada-*`/`saida-*` (o teste exige). A migração deve ser pura e
    manter o `id`.
  - Nome novo de arquivo no pacote: incluir em `NOMES_V1` (`pacote.ts`) e na política do ZIP; senão é recusado.
  - **Para o M1-T08:**
    - ✔ feito no M1-T08 (`pastaBackups` e só o nome do backup ao renderer).
  - **Para o M1-T11:**
    - versão futura → mensagem e "abrir só para leitura" quando `leitura` não for `null`. O `PacoteSomenteLeitura` não
      pode entrar no fluxo de salvamento: o tipo já impede, então não use `as`;
    - avisar que o projeto foi atualizado e onde ficou a cópia.
  - **Para o M1-T12:** a rotação de backups não apaga `*-formato-v<N>.bdp` [HIPÓTESE de política].
- Salvamento (M1-T06):
  - API: `gravarAtomico`, `salvarProjeto` e `abrirProjeto` em `app/src/persistencia`. Nada lança exceção.
  - Em erro, o resultado traz `codigo` e `mensagem` pt-BR para o visor; `detalhe` é só para o registro técnico.
  - Testes injetam falhas pela interface `SistemaArquivos`.
  - **Para o M1-T07:** o backup obrigatório antes de migrar usa `gravarAtomico` (cópia nova, não o `.bak`).
  - M1-T08: ✔ só o nome do arquivo ao renderer (M6-11); a fila por destino supõe instância única (M6-10, aceito).
  - **Para o M1-T11:** mostrar `mensagem` no visor; `avisos` do `.bak` não bloqueiam "Salvo".
  - **Para o M1-T12:**
    - órfãos `*.bdp.tmp-*` **e** `*.bdp.bak.tmp-*` (este pode ser apagado direto) (M6-03);
    - na recuperação, gravar com `gravarAtomico`.
  - Os testes do Windows abrem o arquivo num PowerShell (`FileShare.Read`/`None`) e só rodam no win32.
  - Teste de mutação: um laço sem fim de tentativas com espera síncrona trava o vitest; o `semEspera` dos testes cede
    ao laço de eventos (`setImmediate`) para virar timeout.
- Contêiner (M1-T05):
  - API: `empacotarProjeto`/`lerProjeto` em `app/src/persistencia`. Nada lança exceção; tudo devolve `{ok, ...}`.
  - O empacotamento relê o próprio resultado, então documento acima de 1 MB e muito repetitivo é recusado ao salvar,
    com mensagem.
  - **Para o M1-T06:**
    - `fs.stat` antes de ler (≤ 1 GB);
    - mostrar no visor o erro de `empacotarProjeto` sem perder o documento em memória;
    - medir a gravação em disco.
  - ✔ M1-T08: leitura isolada num `utilityProcess` (adendo no ADR-0004).
  - Os testes maliciosos usam `app/tests/apoio/zip-bruto.ts`.
- Formato v1 (M1-T04):
  - Esquemas zod em `app/src/dominio/esquemas/projeto-v1.ts` (fonte da verdade).
  - Depois de mudar um esquema, rode `npm run esquemas:gerar`; o `verificar` falha se o JSON Schema versionado divergir.
  - Tipo novo no modelo exige a variante equivalente no esquema: o teste de tipos (`expectTypeOf`) quebra o typecheck.
  - O v1 recebe acréscimos sem subir `versaoFormato` até a 1.ª distribuição (adendo do ADR-0004).
  - Para o M1-T09/M2: função de texto plano de `Inline[]`, para o índice da biblioteca e para nomes de arquivo.
- Testes (M1-T03): `npm run verificar` é o comando do dia a dia (precisa de rede por causa do `npm audit`). O teste de fronteiras é
  a única barreira da regra 1 do ADR-0005 (o `tsconfig.puro.json` não bloqueia `electron`). Interpretações das regras estão no
  adendo do ADR-0005. Pasta nova em `src/` precisa entrar no mapa do analisador (`app/tests/apoio/analisador-fontes.ts`),
  senão o teste falha. Pendentes: inventário de licenças (C-19) e `npm audit signatures` no `verificar` (C-18).
- Segurança do runtime (M1-T02): decisões em funções puras `app/src/principal/seguranca/` (`politica-urls`,
  `protocolo-caminho`, `csp`); só cinco arquivos importam `electron` (lista no `app/README.md`, seção Segurança). Recurso novo servido pelo
  `app://` precisa constar em `TIPOS_MIME` (senão 404). Link externo novo → host em `HOSTS_EXTERNOS_PERMITIDOS` com o
  requisito que o exige. LanguageTool (após M7): o filtro `webRequest` também pega `net.fetch` do principal → usar
  sessão dedicada endurecida ou exceção explícita (achado B-3). M1-T13 deve ter E2E de segurança (achado M-1).
- App (M1-T01; Electron 44.8.0 desde o T02): `cd app; npm install; npm run typecheck; npm test; npm run build; npm run dev`. `typecheck` roda
  4 projetos (`tsconfig.node/puro/web/e2e.json`); `puro` = `dominio/` + `aplicacao/` sem DOM nem Node. Preload sai como
  CommonJS (`out/preload/index.cjs`), por isso o `package.json` não tem `"type": "module"`. O Electron 44 baixa o binário
  sob demanda (`node node_modules/electron/install.js`). `node_modules` = 478 MB (368 MB do Electron) [VERIFICADO].
- Insumos da Etapa 3 em `analise/` (recriáveis): `normas_txt/` (`pdftotext -enc UTF-8 -layout` + marcadores
  "=== PDF p.N ==="), `modelos_docx/` e `modelos_txt/` (LibreOffice), `etapa3/` (parciais e `mapa_ids.txt`).
- Página IBGE: impressa = PDF − 1 no corpo; no Anexo B a diferença muda. A p. 18 impressa só existe como imagem.
- Etapa 4: cada conflito decidido vira parâmetro de perfil ("UFT 2022"), não constante no código.
- PoCs da Etapa 4 (recriáveis, ignoradas pelo git): `analise/poc-docx/` (`gen.js`, `verificar.py`,
  `comparar_sumario.py`, `RESULTADO.md` com contornos do `docx` 9.11.0 e contrato motor → exportador) e
  `analise/poc-ui/` (protótipo, `tokens.css` da paleta A, `contraste.py`, `teste_teclado.mjs`, `PROPOSTA.md`).
  O M1-T10 parte de `analise/poc-ui/`; o M3 parte de `analise/poc-docx/`.
- Runtime: seguir o checklist C-1 a C-22 de `docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md`; Electron sempre numa
  das 3 majors suportadas (R20).

## Decisões aguardando o usuário
- (M5) Margens da seção em paisagem: sem RN no Manual; decisão editorial.
- (Etapa 7) Assinatura de código: certificado OV, MSIX na Microsoft Store ou sem assinatura.
- (Etapa 5, antes de implementar a regra) 4 ambiguidades remanescentes (RN-025 decidida em C-A6): RN-033
  (linha em branco após subtítulo), RN-073 (numeração nos pós-textuais), RN-085 (pontuação final da citação),
  RN-108 (alinhamento da equação).
- (Etapa 3, sem prazo) Fornecer trechos de normas ABNT/CONMETRO ou orientação da UFT para as 43 perguntas de fonte
  (P-01–P-18, PF-01–PF-15, P-C1–P-C10; texto exato no relatório da Etapa 3). P-C1–P-C5, P-C10, C-B10 já têm
  valor de perfil decidido; o que falta é a fonte para torná-los definitivos.

## Registro de sessões
| Data | Etapa | Resumo |
|---|---|---|
| 2026-10-12 | 0 | Kit criado e validado (estrutura, formatos, referências, checksums). Ver relatório de validação. |
| 2026-10-12 | 0 | kit-1.1.0: Norma Tabular do IBGE como fonte oficial de tabelas; referência de layout iTunes com pequi (`docs/REFERENCIA_DE_LAYOUT.md`); materiais do usuário registrados no inventário. |
| 2026-10-15 | 1 | Inventário: 14/14 itens presentes, checksums conferidos/registrados; sistema original extraído em `analise/`; ambiente verificado (LibreOffice ausente); `git init` + commit inicial `acc4f73` (autorizado); `.gitattributes` protege `materiais/`. |
| 2026-10-15 | 2 | Auditoria: 4 agentes em paralelo (somente leitura); DOCX de linha de base gerado por harness Node com os scripts originais e convertido em PDF no LibreOffice; O-1 a O-8 confirmadas; defeitos E-1 a E-8 (citações somem do DOCX, pré-textuais sem quebra, recuo 1,27 cm); riscos S-1 a S-14; 22 regras candidatas (CA-01 a CA-22). Harness em `analise/` (ignorada pelo git; recriável a partir do relatório). |
| 2026-10-15 | 3 | Análise normativa: 3 frentes do `especialista-normas` em paralelo (Manual p. 1–29, p. 30–73, IBGE); integração e renumeração pela sessão principal; matriz com 312 RN (245 CONFIRMADA, 28 AMBÍGUA, 23 PENDENTE-FONTE, 16 CONFLITO); semente revisada (11 correções); 20 conflitos para o usuário, 7 resolvidos com registro; amostragem > 30% por frente + conferência da sessão principal (Manual p. 17–20, IBGE p. 18). |
| 2026-10-15 | 3 | Decisões do usuário: todas as recomendações aceitas; escolhas próprias: separador de milhares = ponto (RN-261), referência de monografia "Universidade, Programa" (RN-206), apêndices/anexos com título geral centralizado e identificação à esquerda (RN-237). 46 linhas da matriz atualizadas; 0 CONFLITO; Etapa 3 CONCLUÍDA. Sem commit (aguarda autorização). |
| 2026-10-15/16 | 4 | Planejamento arquitetural: 4 agentes em paralelo (arquiteto, documento, segurança, interface), interrompidos por limite de uso e retomados. Comparação de 4 alternativas (Electron 83,0; D web 76,8; .NET 74,6; Tauri 73,6). PoC DOCX `docx` 9.11.0: 8 OK + 2 PARCIAL com contorno, 60/60 verificações de XML, sumário 52/52 páginas = PDF (reexecutado pela sessão principal). Protótipo de UI com 3 paletas (138 pares de contraste OK; 12/12 testes de teclado). Revisão de segurança com checklist C-1..C-22 e medições (EPERM no rename; 1.ª conversão LibreOffice falha). Decisões do usuário: Electron; paleta A; autosave no arquivo ~30 s; sumário estimado + Word recalcula; `.bdp` em Documentos; importador antigo após M7; assinatura na Etapa 7; LanguageTool opcional desligado; MVP só DOCX. ADR-0003..0006 ACEITOS; riscos R20–R33; plano M1-T01..T15. Commit `fc520a4` (Etapas 2–4, autorizado pelo usuário). |
| 2026-10-16 | 5 (M1-T01) | Esqueleto `app/` pelo `arquiteto-software`: electron 44.7.2, electron-vite 6.0.0, vite 8.3.4, react 19.3.1, typescript 7.0.2, vitest 5.0.5 (versões exatas); 14 módulos do ADR-0005 com `index.ts` de marcação; janela "BiblioDocs Pro" com contextIsolation/sandbox. Reexecutado pela sessão principal: typecheck OK, 16/16 testes, build OK; validador do kit ajustado para `app/README.md` (0 falhas). `npm audit`: 0 vulnerabilidades. Sem commit (aguarda autorização). |
| 2026-10-16 | 5 (M1-T02) | Endurecimento do runtime pelo `arquiteto-software` (C-2..C-9, C-15, C-21, C-22 parte 1; protocolo `app://interface`, CSP de produção no cabeçalho e CSP de dev separada, filtros de navegação/rede/link externo em funções puras). `revisor-seguranca`: todos CONFORMES, 1 Média (E2E → T13) e 6 Baixas; B-1, B-2, B-4, B-6 corrigidos pela sessão principal, B-3 adiado, B-5 aceito. Revisor recomendou Electron 44.8.0; usuário autorizou → trocado (integridade do lock e SHA-256 do zip conferidos com o `SHASUMS256.txt`; `npm audit signatures` 95/95; `npm audit` 0). Reexecutado no 44.8.0: typecheck OK, 156/156 testes, build OK, preview sem erro. Commit autorizado pelo usuário (M1-T01 + M1-T02). |
| 2026-10-16 | 5 (M1-T03) | Infraestrutura de testes pelo `engenheiro-qualidade`: `npm run verificar` (typecheck + vitest + audit) e `verificar:tudo` (+ build); analisador de imports sem dependência nova; teste de fronteiras do ADR-0005 (regras 1–6) e varreduras (HTML, rede, `openExternal`, lockfile). A sessão principal acrescentou a proibição `aplicacao` → `persistencia`/`integracoes`/`preload` e registrou as interpretações como adendo do ADR-0005. Reexecutado: verificar 258/258, 0 vulnerabilidades; arquivo violador → EXIT=1; build OK. Grupos ARQ e SEG na matriz de testes. Commit autorizado pelo usuário. |
| 2026-10-16 | 5 (M1-T04) | Contratos e esquemas v1 pela sessão principal: tipos mínimos do modelo; esquemas zod estritos (`zod` 4.6.7, dependência local informada) de `documento.json`/`manifesto.json`; validação pt-BR com limites de profundidade (iterativa); JSON Schema 2020-12 gerado e versionado em `app/esquemas/projeto-v1/` (exportação do zod considerada fiel, sem `ajv`). Revisão do `especialista-documento`: M1/M2/B4/B5 corrigidos (XML 1.0, marcas, ids únicos), M3 → T05. Adendo técnico no ADR-0004. Verificar 310/310, 0 vulnerabilidades; build OK; kit 0 falhas. Commit `e3129cf` autorizado pelo usuário. |
| 2026-10-16 | 5 (M1-T05) | Contêiner `.bdp` pela sessão principal (`fflate` 0.8.3, dependência local informada, só para escrever). Parser próprio do diretório central; descompressão sob demanda com `node:zlib` (`maxOutputLength`, sem sobra, CRC-32); lista de nomes; limites do ADR-0004; coerência manifesto × documento; mídia divergente descartada com aviso. `revisor-seguranca`: A1 (Alta) a A5 corrigidos, A6 eliminado, isolamento de processo → T08. 10 mutações detectadas. Medição: empacotar com releitura ~170 ms e ler ~90 ms (25 MB). Verificar 370/370, 0 vulnerabilidades. Commit autorizado pelo usuário. |
| 2026-10-16 | 5 (M1-T06) | Salvamento atômico pela sessão principal: temporário exclusivo com `fsync`; `.bak` por cópia (desvio do ADR registrado em adendo: o destino nunca some); troca por `rename`; tentativas EPERM/EBUSY/EACCES num orçamento único; fila por destino; `abrirProjeto` com limite conferido pelo caminho e pelo descritor. `revisor-seguranca`: 0 Alta, M6-01/M6-02 (Média) e 5 Baixas corrigidos, M6-03 → T12, M6-10/11 → T08. Bloqueio real medido (PowerShell): EPERM, 6 tentativas, ~1,64 s, original intacto. 25 MB: gravação 64–180 ms. 13/13 mutações detectadas. `verificar:tudo` 407/407, 0 vulnerabilidades, build OK. Commit autorizado pelo usuário. |
| 2026-10-16 | 5 (M1-T07) | Migrações pela sessão principal (retomado de sessão anterior com o código já escrito): cadeia pura `migrar_N_para_N+1`, registro de produção vazio, migração fictícia v0→v1 só nos testes com fixtures de entrada e saída; versão futura → `ok: false` com `PacoteSomenteLeitura`; backup obrigatório antes de migrar. `especialista-documento`: 0 Alta, M1/M2 (Média) e B1–B5 corrigidos; o teste novo da troca do backup revelou um temporário que sobrava, também corrigido. 27/28 mutações detectadas (1 equivalente). `verificar:tudo` 443/443, 0 vulnerabilidades, build OK; kit 0 falhas. Commit `bdc9176` autorizado pelo usuário. |
| 2026-10-16 | 5 (M1-T08) | IPC tipado pela sessão principal: contrato `window.bibliodocs.projetos` (abrir, salvar, salvarComo, fechar) em `aplicacao/portas`; preload com 4 funções de canal fixo; principal confere remetente (webContents, quadro principal, origem) e argumentos (zod estrito, limites) antes de qualquer diálogo; identificadores opacos por janela; só nomes de arquivo ao renderer; leitura do `.bdp` num `utilityProcess`. `revisor-seguranca`: 0 Alta, S8-01/S8-02 (Média) e S8-03–S8-07 corrigidos (sandbox do leitor → Etapa 7). 8/8 mutações detectadas. Fumaça no Electron 44.8.0: `Uint8Array` atravessa `contextBridge` e `utilityProcess`; 25 MB × 20 leituras, 307–408 ms. `verificar` 492/492, 0 vulnerabilidades; build OK; kit 0 falhas. Commit `0c0acad` autorizado pelo usuário. |
| 2026-10-16 | 5 (M1-T09) | Biblioteca pela sessão principal: contrato `window.bibliodocs.biblioteca` (7 canais); pasta padrão `Documentos\BiblioDocs Pro\Trabalhos` configurável (`preferencias.json`); índice-cache `biblioteca.json` recriável, com resumo no processo leitor em lotes; criar, renomear (link físico, nunca sobrescreve), duplicar (id novo), excluir para a Lixeira com confirmação do principal; aviso de OneDrive. `revisor-seguranca`: A1 (Alta, listagem quadrática ~40 s com 5 000 itens), M1–M4, B1–B4 e B6 corrigidos; B5 aceito; 2 resíduos registrados no adendo do ADR-0004. 19/19 mutações detectadas. Fumaça no Electron 44.8.0: resumo real em 233 ms; `shell.trashItem` → arquivo na Lixeira do Windows (conferido por `Shell.Application`). `verificar` 594/594, 0 vulnerabilidades; build OK; kit 0 falhas. Commit `cc5c6ed` autorizado pelo usuário. |
| 2026-10-16 | 5 (M1-T10) | Casca da interface pela sessão principal, após o usuário aprovar o protótipo (todos os `[PROPOSTA]` aceitos; `docs/GUIA_VISUAL.md`). Quatro faixas, menus ARIA, abas, Voltar/Avançar, biblioteca real (grade, lateral, detalhes, estados, aviso de OneDrive), criar trabalho, escolher pasta; janela mínima 1024×700; menu nativo nulo também no dev (F12). Sem dependência nova. `verificar:tudo` 630/630, 0 vulnerabilidades, build OK; 10/10 mutações; fumaça no Electron 44.8.0 por CDP 21/21 (achou e corrigiu Alt+Seta duplicado nas abas); kit 0 falhas. Commit `3040a9a` autorizado pelo usuário. |
| 2026-10-17 | 5 (M1-T12) | Recuperação pela sessão principal: instantâneo ~2 s depois de cada alteração em `%LOCALAPPDATA%\BiblioDocsPro\recuperacao\<id>\` (atual + anterior, sem `.bak`), trava de sessão, oferta na Biblioteca (Recuperar / Abrir o arquivo salvo / Decidir depois), restaurar a partir de temporário ou `.bak` de arquivo que não abre, `recuperacao-antigos` por 7 dias. `revisor-seguranca`: 4 Alta (prazo pela data errada, queda adiada arquivada, salvamento apagando instantâneo mais novo, restauração que tirava o original), 5 Média e 2 Baixa corrigidas; B2/B4 aceitas. 27/27 mutações. Fumaça no Electron 44.8.0 por CDP 20/20 (`taskkill` e reabrir oferece a versão). `verificar:tudo` 711/711, 0 vulnerabilidades, build OK; kit 0 falhas. Commit `abbe147` autorizado pelo usuário. |
| 2026-10-17 | 5 (M1-T13) | E2E pela sessão principal com `@playwright/test` 1.64.1 (dependência local informada) no Electron 44.8.0: FUN-01 (reabrir idêntico, também após reiniciar; SHA-256 do arquivo igual), RNF-04 (`taskkill /F /T`, instantâneo 1992 ms, Recuperar, "Abrir o arquivo salvo"), UI-01 (faixas de 1024×700 a maximizada em 100/125/150%), zero rede pelo net-log e SEG-03. O net-log achou WPAD + checagem de IPv6 ao iniciar → `no-proxy-server` no principal. `engenheiro-qualidade`: 1 Alta (travessia com alvo inexistente), 4 Média (perfil do Chromium real, órfão, laços vazios, corrida no `taskkill`) e 7 Baixa; corrigidas, exceto 3 Baixas aceitas. 4/5 mutações (a de `..` é inalcançável pela página). `verificar:tudo` 712/712 + E2E 8/8, 0 vulnerabilidades; repetições 24/24 e 16/16; kit 0 falhas. Commit `c93933f` autorizado pelo usuário. |
| 2026-10-17 | 5 (M1-T14) | Empacotamento de fumaça pela sessão principal com electron-builder 26.15.3 (dependência local informada): NSIS por usuário, fuses e ASAR, `electronDist` local, `afterPack` e gancho NSIS. Instalador 111 841 150 bytes (< 200 MB, RNF-08), instalado 390 MB. `revisor-seguranca`: 0 Alta, A-1 (Média, `--remote-debugging-port` abria CDP no pacote) corrigido com recusa de argumentos; `elevate.exe`, comentários e afterPack corrigidos; assinatura, NSIS legado e cache para a Etapa 7. Instalar/desinstalar autorizado pelo usuário: 1.ª rodada achou a cópia de 112 MB em `bibliodocs-pro-updater` → corrigida, 2.ª limpa. Fumaça CDP 11/11 (antes do A-1), negativa 6/6; ASAR adulterado recusado. O Controle Inteligente de Aplicativos bloqueou o `.exe` do `dist:fumaca` (R34). `verificar:tudo` 741/741 + E2E 8/8, 0 vulnerabilidades; 10/10 mutações; kit 0 falhas (busca de segredos passa a ignorar `node_modules`/builds). Depois, a pedido do usuário: ícone próprio (pequi) e decisão delegada de nunca apagar dados ao desinstalar (742/742). Commits `1efbb74` e `e02ae4f` autorizados pelo usuário. |
| 2026-10-16 | 5 (M1-T11) | Fluxo criar → editar título → salvar → fechar → abrir pela sessão principal: `SessaoTrabalho` pura (fila única de gravações, revisões, automático de 30 s, trocar/fechar gravam antes, só leitura, "Salvar como…"); aba Escrever com título; visor ligado; menu Arquivo e atalhos; abrir/renomear/duplicar/excluir na Biblioteca; fechar a janela grava antes. `especialista-interface`: 0 Alta, M1–M4 e 5 Baixas corrigidas. 13/13 mutações. Fumaça no Electron 44.8.0 por CDP 31/31 (automático em 30,2 s; erro visível; achou e corrigiu erro longo escondido no visor). `verificar:tudo` 665/665, 0 vulnerabilidades, build OK; kit 0 falhas. Commit `f6203ee` autorizado pelo usuário. |
| 2026-10-17 | 5 (M2-T01) | Desempenho pela sessão principal: gerador do documento grande (≈150 páginas, 25 MiB) e E2E-07 no Electron 44.8.0. Medido antes: manipuladores do instantâneo e do salvar 224–292 ms síncronos no principal, travadas de 244–406 ms, tecla de até 328 ms. Corrigido com empacotador em `worker_threads`, mídias uma vez por identificador (`PacoteEnvio`, `MIDIA_AUSENTE` com reenvio) e `SharedArrayBuffer`; depois: p95 da tecla 6–12 ms, travada ≤ ~60 ms, abrir 0,45–1,43 s, pico 700–760 MB. `revisor-seguranca`: 0 Alta, F1/F2 (Médias: mídia guardada antes da conferência, acúmulo) corrigidos, comentários F3–F5 corrigidos, F6/F7 documentados e guarda da tecla mais lenta < 150 ms; S1 conferido com o `app.asar` do `dist:pasta`. 13/14 mutações (1 equivalente). `verificar:tudo` 770/770 + E2E 9/9, 0 vulnerabilidades. Commit `4cb58b9` autorizado pelo usuário. |
| 2026-10-17 | 5 (M2-T03) | Numeração progressiva e operações da árvore de seções pela sessão principal: `numerarSecoes` derivada (RN-038/039, `alemDoLimite` para RN-041) e operações puras inserir/remover/mover/recuar/promover com inverso, limite de 5 níveis (mensagem orienta alíneas, RN-028) e de 1000 por nível. `especialista-documento`: 0 Alta, M1–M3 e B1, B3 corrigidas, B2 → T07/T08. Decisão do usuário: promover como o Word (ordem do texto igual). 40/40 mutações. `verificar:tudo` 790/790 + E2E 9/9, 0 vulnerabilidades; kit 0 falhas. Commit `5998fed` autorizado pelo usuário. |
| 2026-10-17 | 5 (M2-T05) | Núcleo do editor pela sessão principal. Dependências do ADR-0007 instaladas, com o usuário informado antes: 10 pacotes MIT, uma cópia do `prosemirror-model`, fora do ASAR. Código: `interface/editor/` com esquema, conversão com forma canônica, ids únicos, limites do v1, leitura do HTML colado (5 origens) e colagem com `DOMParser` inerte. Regras de fronteira E1–E3. `especialista-documento`: A1, A2, M1–M4 e B1 corrigidas; M5, M6 e B2–B5 registradas. `verificar:tudo` 891/891 + E2E 9/9, 0 vulnerabilidades em produção. Colagem real e editor na tela: M2-T06. Itens visíveis da colagem decididos por delegação. Commit `444fa84` autorizado pelo usuário. |
| 2026-10-17 | 5 (M2-T04) | Modelo M2 pela sessão principal: blocos `alineas` (com `subalineas`) e `citacaoLonga`, inline `nota` com conteúdo embutido, rótulo derivado `a)…z), aa), bb)` (C-A6), ids únicos também para notas, mensagens pt-BR próprias, JSON Schema com `$defs` nomeados; 2 fixtures válidas e 14 inválidas. `especialista-documento`: 0 Alta, M1 (adendo) e M3 (tipos nomeados) corrigidas, M2 (ids na colagem) para o M2-T05, B4–B7 registradas. 16/16 mutações. `verificar:tudo` 825/825 + E2E 9/9, 0 vulnerabilidades. Incidente: `prettier --write` reformatou 10 arquivos; desfeito reescrevendo a partir do HEAD (o `git checkout` foi bloqueado pela permissão). Decisão delegada: nota no título continua recusada. Commit `41ca279` autorizado pelo usuário. |
| 2026-10-17 | 5 (prep. M2) | Preparação do M2: tarefas M2-T01..T12 detalhadas no plano pela sessão principal (dependências, aceite, decisões do usuário necessárias); ADR-0007 redigido pelo `especialista-interface` e aceito (com os itens visíveis, C-B18 e C-A6) por decisão delegada pelo usuário, com versões conferidas por `npm view` (ProseMirror 86,0 × TipTap 77,4 × Lexical 69,2 × próprio 62,4 × Slate 61,0); achados: TipTap e React Aria injetam `<style>` (CSP), Radix injeta `<style>` variável, colagem padrão do ProseMirror usa `innerHTML` → colagem própria. Sem mudança de código. Kit validado. Commit `9480c8c` autorizado pelo usuário. |
