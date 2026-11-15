# Especificação nova (2026-11-15) — lacunas e plano

A especificação `BiblioDocs-Pro-Especificacao.md` (fora do repositório, recebida em 2026-11-15) reescreve a revista e
acrescenta itens. Este relatório compara o texto com o código em `694b684` (importação por aba feita). Busca no código
por nome de função, rótulo da interface e tipo do modelo [VERIFICADO nos arquivos citados], salvo onde marcado.

## Já atendido

| Etapa | Item | Onde |
|---|---|---|
| 1 | Novo trabalho, Exportar, zoom, menus | `5a72c3d`; reconferir no fim (G1) |
| 2 | alinhamento, recuo, listas, sublinhado, divisor do painel, estilo nos campos, ajuda contextual | `9444158`, `9fbfb13` |
| 3 | catálogo, seletores dependentes, ficha institucional, titulação, lista de quadros, grupos de siglas, ficha catalográfica | `9c7c33e` a `d94ddfe` |
| 4 | gerenciador, remissivas, menção sem número, Ligar menção, Ajustar tamanho e posição, cancelar sem perder a posição, importar por aba, número na legenda | `31cba30`, `49210d0`, `42ae739`, `694b684` |
| 5 | fontes com link e PDF, citações ligadas, histórico | `3936d62` |
| 6 | filtros por categoria, verificado × revisão, ir e voltar | `3b90115` |
| 7, 8, 9 | registro e cronograma; modelo DOCX; IA, consumo, retomada, tabela por imagem | `854a1a9`, `5a0465f`, `d013d3f`, `ca5846c` |

## Lacunas

| # | Etapa | Lacuna | Situação |
|---|---|---|---|
| G4a | 4 | Larguras das colunas como na planilha (hoje iguais) | `ColunaTabela` só tem alinhamento |
| G4b | 4 | Colagem editável do Excel conferida com `QUADROS.xlsx` | Colagem existe; conferir com a área de transferência real do Excel |
| G5a | 5 | Tipos de obra: relatório institucional ou empresarial (RI), demonstração financeira, base de dados, página web, resolução | `TipoObra` tem livro, capítulo, trabalho acadêmico, artigos, evento, norma, legislação, documento online |
| G5b | 5 | Colar referência pronta (texto livre preservado, conversão opcional em campos com prévia e incertezas) | Não existe |
| G5c | 5 | IA opcional para propor tipo, autoria e metadados | Não existe na bibliografia |
| G6a | 6 | Visão geral × detalhes (categorias com contagens: no trabalho, verificados, com aviso) | Só filtros e lista |
| G6b | 6 | Tabelas e quadros: rótulo, título, menções ligadas; navegar entre ocorrência, tabela e menção | Não existe |
| G10 | 10 | Criar e restaurar backup de cadastros e configurações | Não existe ("Cópias de segurança…" é dos trabalhos) |
| G2a | 2 | Títulos criados e renomeados no painel Seções; a página mostra número e título | Título é editado na página |
| G2b | 2 | Página com largura do perfil desde a primeira linha | Reconferir |
| G2c | 2 | Régua alinhada à página; painel de navegação recolhível; busca no documento | Não existem (Ctrl+F busca na biblioteca) |
| G3a | 3 | Acesso visível a Cadastrar instituição e Editar perfis de formatação | Dentro de "Catálogo acadêmico…" |

## Plano

Um commit por lacuna, com `verificar:tudo`. Ordem: G4a, G4b, G5a–c, G6a–b, G10, G2a–c, G3a, G1.

## Situação em 2026-11-15 (fim do ciclo)

| # | Commit | Situação |
|---|---|---|
| G4a, G4b | `98ffe81` | Feito: larguras da planilha; colagem do Excel real igual à importação (teste externo `colagem-excel`, com `BDP_COLAGEM`) |
| G5a–c | `c0c2d97` | Feito: relatório, demonstrações financeiras, base de dados (padrão provisório, D-E5-05); referência colada (D-E5-06); IA na bibliografia (D-E5-07) |
| G6a, G6b | `fefc2da` | Feito: visão geral por categoria e elementos com menções (D-E6-05) |
| G10, G3a | `464c402` | Feito: backup e restauração (D-E10-01); acesso no menu Arquivo ao catálogo e aos perfis |
| G2a | `3411ed0` | Feito: títulos pelo painel Seções (D-E2-04) |
| G2b, G2c | `45fde17` | Feito: folha com a largura do perfil, régua, busca no documento (D-E2-05, D-E2-06) |
| G1 | — | Reconferido pelos E2E de exportação, menus e zoom (todos passam); o zoom escala a folha |

Pendências: paginação real no editor (o texto não passa para a folha seguinte; há só a marca do fim de cada folha); "(continua)/(conclusão)" de tabela entre páginas (o DOCX repete o cabeçalho, mas a quebra é do Word); régua só de leitura (perfil UFT fixo); IA da bibliografia testada só com resposta simulada.

## Continuação (2026-11-15)

| Item | Commit | Situação |
|---|---|---|
| Tabela 1 do relato de experiência (p. 3–4) | `2539cda` | Conferida no PDF pelo LibreOffice: números, sinais, vírgula decimal, fonte e notas iguais; as colunas, antes todas iguais, passaram a seguir o conteúdo (D-E4-08) |
| Quadro 1 do relatório da UFT (p. 16) e lista de quadros (p. 6) | `8b92353` | O quadro do exemplo é uma imagem: a figura ganhou a espécie "Quadro", na mesma sequência dos quadros e na lista de quadros (D-E4-09, revê a D-M5-11 aceita pelo usuário — confirmar) |
| E2E de desempenho instável | `8541d0f` | Corrida do teste (lia o arquivo antes do último salvamento); agora espera o arquivo |

Continua pendente: paginação real no editor (o texto passar para a folha seguinte), que muda o desenho do editor e fica para um ciclo próprio.
