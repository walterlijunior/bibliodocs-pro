# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Datas em AAAA-MM-DD.
Registre aqui cada entrega do aplicativo (Etapa 5 em diante) e mudanças na infraestrutura do kit.

## [Não lançado]

### Adicionado
- Etapa 1 — Inventário: `docs/relatorios/ETAPA1_INVENTARIO.md`; repositório git (commit inicial `acc4f73`);
  `.gitattributes` (`materiais/** -text -diff`) para preservar os originais byte a byte apesar de `core.autocrlf`.

### Alterado
- `docs/INVENTARIO_DE_MATERIAIS.md`: caminhos completos, tamanhos, formato conferido e SHA-256 dos 14 itens
  (10 checksums novos), agora verificados por `validar-kit.ps1` e `test_estrutura_kit.py`.

### A fazer
- Etapa 2 — Auditoria do sistema existente.

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
