# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Datas em AAAA-MM-DD.
Registre aqui cada entrega do aplicativo (Etapa 5 em diante) e mudanças na infraestrutura do kit.

## [Não lançado]

### Adicionado
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

### Alterado
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
