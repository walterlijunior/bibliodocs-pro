# Arquitetura preliminar

> **Status: PRELIMINAR.** Hipóteses para orientar a auditoria e a Etapa 4. Nada aqui é decisão
> tomada; a tecnologia será escolhida em ADR depois da auditoria (`PROMPT_EXECUCAO.md`, Etapa 4).

## 1. O que já se sabe do sistema existente `[VERIFICADO na preparação do kit]`
- Aplicação web local: `index.html` + 8 módulos em `src/` (6.111 linhas de JS) carregados por
  `<script>`, sem etapa de build; namespace global `window.TCC.*`.
- Bibliotecas copiadas em `vendor/`: React, ReactDOM, htm, docx.js, jsPDF, html2canvas, CSS próprio.
- Persistência em IndexedDB do navegador; exportação DOCX, PDF e ODT (`.fodt`).
- Execução via `python -m http.server 8765` (`INICIAR.bat`); wrapper Electron 28 opcional em
  `electron/` com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Sem testes automatizados encontrados no pacote.

## 2. Camadas propostas (independentes da tecnologia)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Interface (biblioteca · editor · inspetor · verificador)            │
├──────────────────────────────────────────────────────────────────────┤
│ Serviços de aplicação (comandos: criar trabalho, inserir citação…)   │
├───────────────┬──────────────────┬──────────────────┬───────────────┤
│ Modelo de     │ Bibliografia     │ Elementos        │ Siglas,       │
│ documento     │ (obras,          │ visuais (tabela, │ notas,        │
│ (seções,      │ citações,        │ quadro, figura,  │ remissivas    │
│ blocos)       │ verificador)     │ gráfico, equação)│               │
├───────────────┴──────────────────┴──────────────────┴───────────────┤
│ Motor normativo (perfis de regras declarativas RN-xxx → formatação)  │
├──────────────────────────────────────────────────────────────────────┤
│ Verificador de conformidade (lê modelo + regras → não conformidades) │
├───────────────────────────┬──────────────────────────────────────────┤
│ Importação (DOCX, CSV,    │ Exportação (DOCX prioritário; PDF)       │
│ XLSX, BibTeX/RIS)         │                                          │
├───────────────────────────┴──────────────────────────────────────────┤
│ Persistência (arquivo de projeto versionado + migrações; backup)     │
└──────────────────────────────────────────────────────────────────────┘
```

Regras de dependência: camadas de baixo não conhecem as de cima; a interface nunca aplica regra
normativa diretamente; o exportador recebe o documento já resolvido pelo motor.

## 3. Alternativas de tecnologia a avaliar `[HIPÓTESE]`

| Alternativa | A favor | Contra / a verificar |
|---|---|---|
| A. Evoluir o código atual dentro do Electron (com build moderno) | Máximo reaproveitamento (React, docx.js já usados); mesma linguagem | Tamanho do instalador; Electron 28 está desatualizado; código sem módulos/testes exige refatoração |
| B. Tauri + front-end web (reaproveitando componentes React) | Instalador menor; backend nativo para arquivos | Exige Rust no ambiente de build; WebView2 no Windows; reaproveitamento parcial |
| C. Aplicativo nativo .NET (WPF/WinUI) ou Python (Qt) | Integração Windows; bibliotecas DOCX maduras em .NET (Open XML SDK) / Python (python-docx) | Reescrita total; descarta o código existente |

Critérios (pesos definidos na Etapa 4): fidelidade do DOCX; reaproveitamento; tamanho e facilidade
de instalação; segurança; manutenção e comunidade; testes automatizáveis; curva de aprendizado
para o mantenedor; licenças.

## 4. Formato de projeto do usuário `[HIPÓTESE]`
Arquivo único (ex.: `.bdp`, um ZIP com JSON do modelo + mídias), com `versao_formato` e migrações
testadas. Importador do backup JSON do sistema antigo para não perder trabalhos existentes.

## 5. Estratégia de testes
Unitários (motor, formatadores, numeração), integração (modelo → DOCX), regressão documental
(skill `regressao-documental`), E2E de fluxos essenciais, testes de instalação (Etapa 7).

## 6. Questões em aberto para a Etapa 4
1. Reaproveitar o código ou só a lógica (regras/formatadores) do sistema antigo?
2. Paginação: campos do Word (paginação feita pelo editor de texto do usuário) ou paginação
   calculada pelo app (necessária para pré-visualização fiel)?
3. Equações: OMML nativo no DOCX ou imagem?
4. Pré-visualização dentro do app: renderização própria ou conversão para PDF?
