# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Datas em AAAA-MM-DD.
Registre aqui cada entrega do aplicativo (Etapa 5 em diante) e mudanças na infraestrutura do kit.

## [Não lançado]

### Adicionado
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
