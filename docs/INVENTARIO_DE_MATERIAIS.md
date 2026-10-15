# Inventário de materiais

Registro dos materiais de referência: o que era esperado, o que foi incluído no kit, integridade
(SHA-256) e observações já verificadas. A Etapa 1 do `PROMPT_EXECUCAO.md` atualiza este arquivo.

Situação em **2026-10-12** (preparação do kit; atualizada às 18h53 com os arquivos que o usuário colocou nas pastas, conforme capturas de tela enviadas). Status: `PRESENTE-ÍNTEGRO`, `PRESENTE-ALTERADO`,
`AUSENTE`, `EXTRAÇÃO-TEXTO-APENAS`.

## Itens esperados

| # | Material | Caminho no kit | Status | SHA-256 |
|---|---|---|---|---|
| 1 | Sistema existente `tcc-uft-sistema_10.zip` (439.969 bytes) | `materiais/sistema_original/tcc-uft-sistema_10.zip` | PRESENTE-ÍNTEGRO | `02daeb313838f8e0a0b61713c3baf23c813419c9e38060e345468003587219a4` |
| 2 | Manual de Normalização UFT, 2ª ed. rev. e atual., 2022 — 73 p., A4 (recebido com o nome `content.pdf`; renomeado no kit, conteúdo idêntico) | `materiais/normas/Manual_Normalizacao_UFT_2ed_2022.pdf` | PRESENTE-ÍNTEGRO | `e3913aa04cc6b87a86a48c16ffe9640ff0fef9bce74a1e47dae00a50964d4c73` |
| 3 | Modelo de TCC de graduação – Atualizado 2022 (`.doc`) | `materiais/modelos_uft/` | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 4 | Template de Artigo – Atualizado 2022 (`.doc`) | `materiais/modelos_uft/` | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 5 | Template de Dissertação – Atualizado 2022 (`.doc`) | `materiais/modelos_uft/` | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 6 | Template de Tese – Atualizado 2022 (`.doc`) | `materiais/modelos_uft/` | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 7 | Template de Relatório Técnico – Atualizado 2022 (`.doc`) | `materiais/modelos_uft/` | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 8 | Template de Projeto de pesquisa – Atualizado 2022 (`.doc`) | `materiais/modelos_uft/` | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 9 | `12-estudo-capcom-jgaap-brasil-japao.docx` (exemplo de trabalho formatado; tema irrelevante para o app) | `materiais/referencias_visuais/` | PRESENTE (colocado pelo usuário; 285 KB) | calcular na Etapa 1 |
| 9a | Extração de texto do item 9 (Markdown gerado pelo Projeto claude.ai; não é o arquivo original) | `materiais/referencias_visuais/extracoes_texto/12-estudo-capcom-jgaap-brasil-japao.EXTRACAO_TEXTO.md` | PRESENTE-ÍNTEGRO | `8f42429a6468d120e4f63cd1edac56ce92597b76235de2b0e8c4bf96fb5dd0f5` |

| 10 | *Normas de apresentação tabular*, IBGE, 3. ed., 1993 (`NORMAS DE APRESENTAÇÃO TABULAR.pdf`, ~1,8 MB) — **norma** para tabelas, à qual o Manual remete (p. 20 e 43) | `materiais/normas/` | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 11 | Guia "Elaboração de Elementos de Apoio ao Texto" (IFPR) — exemplo visual de outra instituição | `materiais/referencias_visuais/` (`Elaboracao-de-Elementos-de-Apoio-ao-Texto.pdf`) | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 12 | Guia "Ilustrações e Tabelas" (FURB, arquivo Word) — exemplo visual de outra instituição | `materiais/referencias_visuais/` (`202502071521040.Ilustracoes e Tabelas`) | PRESENTE (colocado pelo usuário) | calcular na Etapa 1 |
| 13 | Captura de tela do iTunes para Windows — referência de layout do app (pequi no lugar da maçã) | `materiais/referencias_layout/itunes_tela_referencia.png` | PRESENTE-ÍNTEGRO | `323aedb518ccc10c3b98139ede3922ca46ac91cf9cc6784b1bdd0a577144853f` |

**Histórico dos itens 3–9:** na preparação, esses arquivos existiam no Projeto
"PROJETO BIBLIODOCS-PRO" do claude.ai apenas como texto extraído; os binários `.doc`/`.docx` não
estavam acessíveis. O kit não cria arquivos simulados. O usuário os colocou nas pastas em 2026-10-12; os itens 10–12
foram acrescentados por ele no mesmo dia. **Na Etapa 1**, o Claude Code confirma os nomes reais,
calcula o SHA-256 de cada um e preenche a coluna correspondente.

## Conteúdo do sistema existente `[VERIFICADO — listagem do ZIP]`

22 arquivos em `tcc-uft/`: `README.md`, `INICIAR.bat`, `iniciar.sh`, `index.html`;
`src/` (`abnt.js` 567 linhas, `app.js` 268, `components.js` 2200, `exports.js` 1508, `state.js` 191,
`storage.js` 102, `templates.js` 242, `visual-editor.js` 1033); `vendor/` (`react.js`, `react-dom.js`,
`htm.js`, `docx.js`, `jspdf.js`, `html2canvas.js`, `utilities.css`); `assets/uft-logo.svg`;
`electron/` (`main.js` 109 linhas, `package.json`).

## Observações preliminares (a confirmar ou refutar na Etapa 2/3)

Verificadas por leitura direta na preparação do kit; nenhuma foi testada em execução.

| # | Observação | Evidência |
|---|---|---|
| O-1 | O Manual UFT 2022 cita NBR 10520:2002; o README do sistema declara NBR 10520:2023; o cabeçalho de `src/abnt.js` cita NBR 10520:2002 (inconsistência interna do sistema e conflito com o Manual) | Manual p. 17; `README.md` (seções "Citações e referências" e "Normas ABNT aplicadas"); `src/abnt.js` linha 7 |
| O-2 | `electron/package.json` aponta ícone `../assets/icon.png`, mas `assets/` só contém `uft-logo.svg` | Listagem do ZIP |
| O-3 | A lista `build.files` do `electron/package.json` inclui `../index.html`, `../src/**/*`, `../assets/**/*`, mas **não** `../vendor/**/*`; o instalador gerado pode não carregar as bibliotecas `[HIPÓTESE sobre o efeito]` | `electron/package.json` |
| O-4 | Electron `^28.0.0` e electron-builder `^24.9.1` — versões antigas em 2026 `[HIPÓTESE sobre suporte; verificar na Etapa 4]` | `electron/package.json` |
| O-5 | Revisão gramatical envia o texto a `https://api.languagetool.org/v2/check` (serviço on-line) | `src/components.js` linha 414 |
| O-6 | Renderizador Electron com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (boa prática a manter) | `electron/main.js` linhas 31–35 |
| O-7 | Não há testes automatizados nem `package.json` na raiz (sem build) | Listagem do ZIP |
| O-8 | Trabalhos ficam no IndexedDB do navegador associado a `http://localhost:8765`; backup manual em JSON | `README.md` do sistema |

## Observações sobre os modelos institucionais `[VERIFICADO — texto extraído no Projeto claude.ai]`
- Os seis modelos trazem orientações de uso (tabelas sem linhas verticais laterais, quadros com
  bordas laterais, legendas por recurso automático do Word, fonte das tabelas abaixo delas).
  São orientações de modelo; confirmar contra o Manual antes de virar `RN`.
- O "Template de Tese" diz "requisito à obtenção do grau de Mestre (a)" — erro do modelo
  (deveria ser Doutor). Exemplo de por que modelos não são norma.
- Parte dos modelos (TCC, Artigo, Relatório Técnico, Projeto) usa rótulo com ponto nas listas
  ("Tabela 1. Exemplo…") e com hífen no corpo ("Tabela 1 - Exemplo…"); Dissertação e Tese usam
  "Tabela 1- Exemplo…" nas listas — inconsistência a resolver pelo Manual.

## Observações sobre o estudo Capcom (extração de texto) `[VERIFICADO]`

**O estudo Capcom é apenas um exemplo de trabalho acadêmico já formatado.** Serve para ver como tabelas, quadros, legendas, linhas "Fonte:", listas e demais elementos ficam num trabalho pronto. O tema dele (contabilidade japonesa, Capcom) não tem relação com o aplicativo: não vira requisito, funcionalidade, tipo de trabalho, regra normativa nem dado de teste. Os itens 3–9 formam o grupo de **exemplos de formatação**.

- Documento do curso de Ciências Contábeis da UFT, Câmpus de Palmas, 2026; contém lista de quadros e
  de tabelas; legendas no formato "Quadro n – Título" e "Tabela n – Título" com travessão; linhas
  "Fonte: elaborado pelo autor com base em …" após cada elemento.
- A extração não preserva bordas, larguras, fontes, alinhamentos ou quebras — o estudo visual
  depende do `.docx` original.
