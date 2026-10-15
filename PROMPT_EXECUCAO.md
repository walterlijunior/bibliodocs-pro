# PROMPT MESTRE DE EXECUÇÃO — Aplicativo BiblioDocs Pro

> **Como usar:** este arquivo é o plano que o Claude Code segue para desenvolver o aplicativo.
> O usuário o aciona com `/iniciar-projeto` (ou pedindo: "Leia PROMPT_EXECUCAO.md e execute a
> próxima etapa pendente"). Cada execução avança **uma etapa ou um incremento** — nunca o produto
> inteiro de uma vez. O estado fica em `docs/ESTADO_DO_PROJETO.md`.

---

## 0. Papel, objetivo e limites

**Seu papel:** engenheiro-líder do projeto. Você coordena os agentes de `.claude/agents/`,
usa as skills de `.claude/skills/` e responde ao usuário (Walterli), que toma as decisões editoriais.

**Objetivo do produto:** um aplicativo desktop (Windows primeiro) que permita escrever, organizar,
verificar e exportar trabalhos acadêmicos (TCC, artigo, dissertação, tese, relatório técnico,
projeto de pesquisa) conforme o Manual de Normalização da UFT (2ª ed., 2022) e as normas ABNT
aplicáveis, com identidade própria — **layout inspirado no iTunes para Windows, com um pequi no lugar
da maçã** (especificação em `docs/REFERENCIA_DE_LAYOUT.md`, captura de referência em
`materiais/referencias_layout/`), usando o pequi como referência à cultura do Tocantins. Não é um clone do Word/LibreOffice.

**Limites desta execução:**
- Avance uma etapa (ou um incremento da Etapa 5) por sessão de trabalho; pare no ponto de
  verificação, relate e aguarde o usuário quando a etapa exigir decisão dele.
- Respeite todas as regras de `CLAUDE.md` (originais intocáveis, fontes normativas, autorização).
- Se o contexto ficar grande, atualize `docs/ESTADO_DO_PROJETO.md` antes de qualquer `/compact`
  ou nova sessão, para que o trabalho continue sem perda.

## 1. Como decidir o que fazer agora

1. Leia `docs/ESTADO_DO_PROJETO.md`. A primeira etapa com status diferente de `CONCLUÍDA` é a atual.
2. Se a etapa atual depende de decisão do usuário marcada `AGUARDANDO USUÁRIO`, apresente a
   pergunta de forma objetiva (opções + recomendação) e pare.
3. Caso contrário, execute a etapa conforme a seção correspondente abaixo.
4. Ao terminar: rode `scripts/validar-kit.ps1` (ou `python tests/test_estrutura_kit.py`) para
   garantir que a infraestrutura continua íntegra, atualize o estado, o CHANGELOG e relate.

---

## Etapa 1 — Inventário

**Objetivo:** saber exatamente quais materiais existem, onde estão e o que falta.

**Agentes/skills:** sessão principal + skill `rastreabilidade-normativa` (parte de inventário).

**Passos:**
1. Liste `materiais/` recursivamente. Compare com `docs/INVENTARIO_DE_MATERIAIS.md`
   (itens esperados, nomes, SHA-256 registrados na preparação do kit).
2. Recalcule o SHA-256 dos arquivos presentes (`Get-FileHash` no PowerShell ou `sha256sum`).
   Divergência = arquivo alterado ou substituído: registre e pergunte ao usuário qual versão vale.
3. Para cada item ausente (ex.: modelos `.doc` da UFT, `.docx` original do estudo Capcom),
   registre como `AUSENTE` e informe ao usuário exatamente onde colocá-lo.
4. Se a pasta não for um repositório git, **proponha** `git init` + primeiro commit (pede autorização).
   Git dá ponto de retorno para todas as etapas seguintes.
5. Extraia o sistema original para `analise/sistema_original_extraido/` (nunca em `materiais/`).
6. Verifique ferramentas disponíveis: `powershell -ExecutionPolicy Bypass -File scripts\verificar-ambiente.ps1`.

**Entregáveis:** `docs/INVENTARIO_DE_MATERIAIS.md` atualizado (status de cada item);
`docs/relatorios/ETAPA1_INVENTARIO.md` (modelo: `templates/RELATORIO_TECNICO.md`).

**Critério de conclusão:** todos os itens esperados têm status (`PRESENTE-ÍNTEGRO`, `PRESENTE-ALTERADO`,
`AUSENTE`, `EXTRAÇÃO-TEXTO-APENAS`); o sistema original está extraído em `analise/`; ferramentas
disponíveis registradas. Itens ausentes **não bloqueiam** a Etapa 2, mas bloqueiam as regras
normativas que dependem deles.

---

## Etapa 2 — Auditoria do sistema existente

**Objetivo:** diagnóstico documentado do `tcc-uft` antes de qualquer grande alteração.

**Agentes/skills:** skill `auditoria-sistema-existente`; agentes `arquiteto-software`
(arquitetura), `especialista-documento` (exportação DOCX/PDF/ODT), `especialista-referencias`
(`abnt.js`), `revisor-seguranca` (riscos), em paralelo e somente leitura.

**Passos:**
1. Mapear arquitetura: arquivos, módulos (`window.TCC.*`), fluxo de dados (estado → reducer →
   IndexedDB → exportação), bibliotecas em `vendor/` e versões reais (ler cabeçalhos dos arquivos).
2. Inventariar funcionalidades existentes e classificar cada uma: `FUNCIONA`, `PARCIAL`,
   `QUEBRADA`, `NÃO VERIFICADA` — só marque `FUNCIONA` se executou/testou.
3. Executar o sistema original, se possível (requer Python ou Node; ver `scripts/verificar-ambiente.ps1`),
   e gerar um DOCX de amostra em `analise/amostras/` para servir de linha de base.
4. Verificar as observações já levantadas na preparação (em `docs/INVENTARIO_DE_MATERIAIS.md`,
   seção "Observações preliminares") e confirmar ou refutar cada uma.
5. Listar regras normativas embutidas no código (margens, fontes, numeração, citações) com
   arquivo:linha — elas alimentam a Etapa 3 como **candidatas**, não como verdade.
6. Avaliar testes existentes (cobertura, ausência) e dívidas técnicas.

**Entregáveis:** `docs/relatorios/ETAPA2_AUDITORIA.md` com: resumo executivo, mapa de módulos,
tabela de funcionalidades, regras embutidas, riscos, o que pode ser reaproveitado e o que não.

**Critério de conclusão:** relatório completo, cada afirmação marcada `[VERIFICADO]` ou `[HIPÓTESE]`;
nenhuma alteração no código original.

---

## Etapa 3 — Análise normativa

**Objetivo:** matriz de requisitos normativos com fonte identificável e critério de validação.

**Agentes/skills:** agente `especialista-normas`; skill `rastreabilidade-normativa`.

**Passos:**
1. Ler `docs/POLITICA_DE_FONTES_NORMATIVAS.md` e aplicá-la integralmente.
2. Extrair do Manual UFT (`materiais/normas/`) cada regra formal, com página e seção; para
   **tabelas**, extrair as regras das *Normas de apresentação tabular* do IBGE (3. ed., 1993), também
   em `materiais/normas/`, às quais o Manual remete (p. 20 e 43).
3. Cruzar com os exemplos de formatação (6 modelos institucionais e o estudo Capcom, se presentes)
   e com o código auditado; registrar divergências. O estudo Capcom é só um exemplo de trabalho
   formatado: dele interessa a apresentação, nunca o conteúdo. **Modelos e exemplos não são norma**: o Manual tem precedência sobre o modelo,
   e um modelo com erro (ex.: o modelo de Tese da UFT cita "grau de Mestre") é registrado como tal.
4. Registrar conflitos de edição (ex.: o Manual 2022 cita NBR 10520:2002, enquanto o sistema
   original declara seguir NBR 10520:2023). Conflitos são **decisões editoriais**: apresente ao
   usuário as opções, o efeito visível de cada uma e uma recomendação; aguarde a decisão.
5. Normas ABNT não disponíveis no projeto (textos são protegidos e pagos) **não podem ser
   presumidas**: a regra fica `PENDENTE-FONTE` até o usuário fornecer o trecho ou confirmar
   o critério com base no Manual UFT.
6. Preencher `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md`: ID (`RN-xxx`), regra, fonte (doc, página,
   seção), tipo de documento afetado, como validar automaticamente, status.

**Critério de conclusão:** todas as regras do Manual referentes a formatação, estrutura, citações,
referências, ilustrações, tabelas, sumário e listas estão na matriz com fonte; conflitos listados
e encaminhados ao usuário. Etapa termina em `AGUARDANDO USUÁRIO` se houver conflito em aberto.

---

## Etapa 4 — Planejamento arquitetural

**Objetivo:** escolher tecnologia e arquitetura com justificativa, após a auditoria.

**Agentes/skills:** agente `arquiteto-software` (lidera), `especialista-interface`,
`especialista-documento`, `revisor-seguranca`; skill `decisao-arquitetural`.

**Passos:**
1. Partir de `docs/ARQUITETURA_PRELIMINAR.md` (hipóteses) e do relatório da Etapa 2.
2. Comparar no mínimo três alternativas (ex.: evoluir o Electron existente; Tauri; outra
   justificada pela auditoria) em: reaproveitamento do código, qualidade da exportação DOCX,
   tamanho do instalador, segurança, manutenção, curva de aprendizado, offline, licenças.
3. Definir os módulos: interface; **modelo de documento** (estrutura semântica independente de
   formato); **motor normativo** (regras declarativas ligadas à matriz RN); gerenciador
   bibliográfico; elementos visuais (tabelas, figuras, gráficos, equações); importação;
   exportação (DOCX primeiro); persistência; verificação de conformidade; testes.
4. Definir o formato de arquivo do projeto do usuário (versionado, com migração).
5. Definir a estratégia de testes (unitários do motor, regressão documental de DOCX, E2E da UI).
6. Registrar ADRs (`docs/decisoes/ADR-00xx-*.md`) e atualizar `docs/ARQUITETURA_PRELIMINAR.md`
   para versão "definida".
7. Apresentar ao usuário apenas o que afeta o resultado visível ou o custo (ex.: tamanho do
   instalador, necessidade de instalar algo). Detalhes internos não precisam de aprovação.

**Critério de conclusão:** ADR de tecnologia aceito; diagrama de módulos; plano do MVP
(Marco M1 de `docs/PLANO_DE_IMPLEMENTACAO.md`) detalhado em tarefas pequenas.

---

## Etapa 5 — Implementação incremental

**Objetivo:** construir o app em incrementos pequenos, sempre executável.

**Ordem dos marcos** (detalhes e critérios em `docs/PLANO_DE_IMPLEMENTACAO.md`):
- **M1 — Esqueleto:** app abre no Windows, cria/salva/abre projeto, janela no layout de
  `docs/REFERENCIA_DE_LAYOUT.md` (visor com pequi, menus, abas, barra lateral, grade de trabalhos).
- **M2 — Modelo e editor:** seções com numeração progressiva, parágrafos, elementos pré/pós-textuais.
- **M3 — Motor normativo + exportação DOCX:** regras RN com fonte aplicadas; DOCX abre no Word e
  no LibreOffice; teste de regressão documental ativo.
- **M4 — Citações e referências:** cadastro, formatação, cruzamento citação × referência.
- **M5 — Tabelas e elementos visuais:** tabelas (importação de planilha), quadros, figuras,
  gráficos, equações, legendas e fontes; apresentação de tabelas estudada no documento Capcom,
  que é **apenas um exemplo de trabalho acadêmico formatado** (o assunto dele não importa ao app).
- **M6 — Sumário, listas, siglas, remissivas, apêndices/anexos.**
- **M7 — Verificador de conformidade** (relatório de não conformidades com referência RN).

**Ciclo de cada incremento:**
1. Escolha a menor tarefa útil do marco atual; registre em `docs/ESTADO_DO_PROJETO.md`.
2. Delegue ao agente do domínio (um agente por área de arquivos; ver `CLAUDE.md` regra 8).
3. Escreva/atualize testes junto com o código.
4. Rode testes + lint do projeto; corrija até passar.
5. Skill `fechamento-de-tarefa`: atualiza docs, CHANGELOG e estado; relata ao usuário.

**Critério de conclusão de cada marco:** critérios de aceitação do marco cumpridos e
demonstrados (comando + resultado), sem regressão nos testes anteriores.

---

## Etapa 6 — Testes e validação

**Agentes/skills:** `engenheiro-qualidade`; skill `regressao-documental`.

1. Executar toda a `docs/MATRIZ_DE_TESTES.md`; registrar resultado real por caso.
2. Gerar documentos de exemplo para cada tipo de trabalho e validar o DOCX: estrutura XML,
   estilos, margens, numeração de páginas, sumário, listas e referências.
3. Verificação visual: abrir no Word/LibreOffice (manual, pelo usuário, quando necessário) e
   comparar com o Manual UFT; registrar diferenças com captura ou descrição.
4. Registrar limitações conhecidas em `docs/relatorios/ETAPA6_VALIDACAO.md`
   (modelo: `templates/RELATORIO_DE_TESTES.md`).

**Critério de conclusão:** todos os casos críticos `PASSOU`; falhas restantes documentadas com
impacto e plano.

---

## Etapa 7 — Estabilização e distribuição Windows

1. Gerar instalador/portátil para Windows conforme o ADR de tecnologia.
2. Testar instalação limpa, abertura, criação de projeto, exportação DOCX e desinstalação
   (roteiro em `docs/MATRIZ_DE_TESTES.md`, grupo DIST).
3. Escrever `app/README.md` (usuário final) e `docs/INSTALACAO_APP.md`.
4. Revisão final de segurança (`revisor-seguranca`) e de dependências/licenças.

**Critério de conclusão:** instalador gerado e testado; fluxos essenciais validados; documentação
de instalação completa; pendências registradas para a próxima versão.

---

## 2. Requisitos (resumo — fonte completa em `docs/`)

- **Funcionais:** `docs/REQUISITOS_FUNCIONAIS.md` (RF-01 a RF-18, com critérios de aceitação).
- **Não funcionais:** `docs/REQUISITOS_NAO_FUNCIONAIS.md` (offline, desempenho, privacidade,
  acessibilidade, manutenção, distribuição).
- **Normativos:** `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md` (gerada e mantida na Etapa 3).

## 3. Regras de qualidade

- Código com testes; nenhuma regra normativa sem ID `RN` e fonte.
- Exportação DOCX deve abrir sem erro no Word e no LibreOffice e manter estilos nomeados
  (para que o usuário continue editando).
- Dados do usuário ficam locais; funções que usam internet (ex.: revisão gramatical externa)
  são opcionais, desligadas por padrão e avisam antes de enviar texto.
- Nada de dependência nova sem justificar (licença, manutenção, tamanho) no ADR ou no CHANGELOG.

## 4. Formato do relato ao fim de cada sessão

```
## Etapa X — <nome> (status: CONCLUÍDA | EM ANDAMENTO | AGUARDANDO USUÁRIO)
Implementado: ...
Testado (comando → resultado): ...
Não testado / pendente: ...
Decisões registradas: ADR-...
Perguntas ao usuário (se houver): ...
Próximo passo: ...
```
