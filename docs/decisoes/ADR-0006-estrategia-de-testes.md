# ADR-0006 — Estratégia de testes do aplicativo

- **Status:** ACEITO (2026-10-16; técnico, com o ADR-0003 aceito).
- **Data:** 2026-10-16
- **Decisores:** agente `arquiteto-software`; execução detalhada pelo `engenheiro-qualidade`
- **Etapa/Marco:** Etapa 4; ativo desde o M1
- **Requisitos e riscos relacionados:** RNF-05, RNF-06, RNF-11, RNF-12, RNF-14, RNF-16; RF-05, RF-06, RF-15; R04, R05, R09, R30; casos FUN, DOC e UI de `docs/MATRIZ_DE_TESTES.md`

## Contexto

O sistema antigo não tem nenhum teste [VERIFICADO, auditoria O-7].

O produto vale pelo DOCX: a saída tem de abrir sem reparo e ter as propriedades normativas certas. Na
Etapa 2, o LibreOffice headless converteu DOCX em PDF com sucesso nesta máquina [VERIFICADO,
`docs/relatorios/ETAPA2_AUDITORIA.md`, "Método"]. Há .NET SDK 10 instalado, o que permite usar o validador do Open XML SDK.

## Alternativas consideradas

| Critério (peso) | A. Vitest + Playwright (Electron) + regressão XML normalizada + LibreOffice opcional | B. Jest + Spectron/WebdriverIO | C. Só testes manuais com roteiro |
|---|---|---|---|
| Integração com Vite/TS (25) | 5 — Vitest 5.0.5 usa a mesma configuração do Vite | 3 — Jest exige transformação própria | 1 — não se aplica |
| E2E do Electron (20) | 4 — Playwright 1.64.1, suporte **experimental** ao Electron v21+ [VERIFICADO] | 2 — Spectron está descontinuado [HIPÓTESE]; WebdriverIO funciona com mais configuração | 1 |
| Regressão documental automatizada (30) | 5 | 4 | 1 |
| Custo para o mantenedor (25) | 4 — um comando | 3 | 2 — repetitivo |
| **Total (100)** | **91** | **62** | **25** |

## Decisão

Adotar **A**, em camadas, todas executáveis no Windows sem serviço externo.

### Camadas

| Camada | Ferramenta (versão de 2026-10-15) | O que cobre | Quando roda |
|---|---|---|---|
| 1. Unitários do domínio | Vitest 5.0.5 (MIT) + `@vitest/coverage-v8` 5.0.5 | Motor normativo (cada `RN` com teste nomeado `RN-xxx: …`), numeração, formatadores de referência e chamada, verificador, esquemas e migrações | `npm run verificar` |
| 2. Rastreabilidade | Vitest (teste que lê `perfis/` e a matriz) | (a) toda regra do perfil existe em `docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md` com o mesmo status; (b) regra PENDENTE-FONTE só aplicada se `provisoria` com decisão do usuário; (c) toda propriedade e bloco do `DocumentoFormatado` de cada fixture tem `origem` (RF-05, RNF-11) | `verificar`, a partir do M3 |
| 3. Arquitetura | Vitest (varredura de imports e de texto, sem dependência nova) | Fronteiras do ADR-0005, proibição de `innerHTML`/`dangerouslySetInnerHTML`, rede só no adaptador permitido | `verificar`, desde o M1 |
| 4. Persistência | Vitest, em diretório temporário real | Ida e volta do `.bdp`, salvamento atômico com falha injetada, `EPERM` simulado, órfãos, limites do ZIP, versão futura, fixtures de cada `versao_formato` (RNF-16) | `verificar` |
| 5. Regressão documental DOCX | Vitest + `fflate` (descompactar) + `fast-xml-parser` 5.11.2 (MIT) | Ver abaixo | `verificar`, a partir do M3 |
| 6. Validação OOXML (opcional, recomendada) | Pequeno executável .NET com `DocumentFormat.OpenXml` 3.5.1 (`OpenXmlValidator`) em `app/ferramentas/validar-ooxml/` | Erros de esquema que fazem o Word pedir reparo (melhor indicador automático de RNF-05) | `npm run test:ooxml`; **pula com aviso** se `dotnet` não estiver disponível. Exige baixar o pacote NuGet localmente: informar o usuário antes |
| 7. Verificação via LibreOffice | `soffice --headless --convert-to pdf` (perfil isolado) + `pdfjs-dist` 6.4.299 (Apache-2.0) para extrair texto e páginas | O DOCX abre e converte sem erro; número de páginas dentro de uma faixa; títulos, legendas "Tabela 1 – …" e numeração visível nas páginas certas; capa numa única página (defeito da Etapa 2) | `npm run test:libreoffice`; **pula com aviso** se o `soffice` não for encontrado |
| 8. E2E da interface | `@playwright/test` 1.64.1 (`_electron.launch`) + `@axe-core/playwright` 4.14.0 (MPL-2.0, só desenvolvimento) | FUN-01 (criar → fechar → reabrir idêntico), recuperação após matar o processo (RNF-04), UI-01 (faixas do layout, pequi, Ctrl+F, foco visível), contraste e teclado (RNF-09), **zero requisições de rede** na sessão (RNF-03) | `npm run test:e2e` |
| 9. Desempenho | Script Node com gerador de documento sintético de 150 páginas | RNF-06 e RNF-07 medidos e registrados (substituem as metas `[META]`) | `npm run medir`; ao fim do M3 e do M7 |
| 10. Manual registrado | Roteiro em `docs/MATRIZ_DE_TESTES.md` | Abrir os DOCX de referência no Microsoft Word: sem reparo, sumário atualizado (DOC-08) | Fim de M3 e de cada marco seguinte |

### Regressão documental DOCX (camada 5)

1. **Fixtures de entrada:** documentos sintéticos em `app/tests/fixtures/documentos/`, sem dados pessoais
   (regra 9 do `CLAUDE.md`).
   - Incluem o equivalente ao TCC fictício do harness da Etapa 2 (`analise/harness/gerar_docx_linha_base.js`)
     para comparação com a linha de base.
   - Incluem um "documento difícil" com todos os elementos.
2. **Teste de propriedades (principal):** consultas ao XML de `word/document.xml`, `styles.xml`,
   `numbering.xml`, `footnotes.xml` e `settings.xml`, com valores esperados **tirados do perfil** e nomeados pelo RN.
   - DOC-01: `w:pgSz` A4.
   - DOC-02 (RN-002): `w:pgMar` 1701/1701/1134/1134.
   - DOC-05 (RN-003): `w:firstLine=709`.
   - Também: estilo de título por nível (RN-010 a RN-014), `pageBreakBefore` na seção primária (RN-008),
     campos TOC/SEQ, `w:footnoteReference`, ausência da cor 2E74B5 (E-5) e `numbering` definida (E-7).
   - Estes testes **não** quebram com mudanças irrelevantes.
3. **Instantâneo de XML normalizado (complementar):**
   - **Normalização:** descompactar; formatar o XML com indentação; ordenar os atributos; remover `w:rsid*`
     e datas de `docProps/core.xml`; trocar ids gerados (`nanoid`, `w:id` de notas e marcadores) por
     sequenciais estáveis.
   - **Comparação:** com `toMatchFileSnapshot` em `app/tests/instantaneos/`.
   - **Mudança no instantâneo:** só com revisão humana, e o commit explica o motivo.
     Isso detecta regressões causadas por atualização da biblioteca `docx` (R32).
4. **Fidelidade a decisões do usuário:** para cada parâmetro de perfil decidido, um teste com os dois
   valores, garantindo que a opção muda a saída.

### Comandos (`app/package.json`)

| Comando | Faz |
|---|---|
| `npm run verificar` | **Comando único do dia a dia.** `tsc --noEmit` (TypeScript 7) + Vitest (camadas 1–5) + `npm audit --omit=dev --audit-level=high` |
| `npm run verificar:tudo` | `verificar` + `test:ooxml` + `test:libreoffice` + `build` + `test:e2e`. Roda ao fim de cada marco |
| `npm run test:cobertura` | Vitest com cobertura e limites |

Limites de cobertura (RNF-12) [META]: ≥ 80% de linhas e ramos em `dominio/normas`, `dominio/bibliografia`,
`dominio/numeracao`, `dominio/esquemas` e `exportacao/docx`. Abaixo disso, `test:cobertura` falha. Os limites
começam a valer no módulo quando ele é entregue: M2 para numeração e esquemas, M3 para normas e exportação,
M4 para bibliografia. A interface não tem limite numérico e é coberta pelo E2E.

Lint: sem typescript-eslint no M1, porque o TypeScript 7 não tem API (R29). Se adotado depois, usar o alias
`@typescript/typescript6`, conforme o anúncio oficial do TS 7.

## Consequências

- **Positivas:**
  - Regressões do DOCX detectadas automaticamente e ligadas a RN.
  - LibreOffice e Open XML SDK aproveitam ferramentas que o usuário já tem.
  - Um comando para o dia a dia.
- **Negativas / custos:**
  - O E2E depende de recurso experimental do Playwright (R30). Mitigação: versões fixadas, E2E restrito a
    poucos fluxos e lógica testada nas camadas 1–5.
  - Os testes LibreOffice e OOXML são lentos e opcionais. Rodam no fim do marco, não a cada mudança.
  - Os instantâneos exigem disciplina de revisão.
- **O que muda:** a matriz de testes ganha os grupos ARQ (camada 3), PER (camada 4), DES (camada 9) e os
  DOC-xx ligados às camadas 5–7. Tarefas M1-T03, M1-T13 e M3 em diante.

## Critério de reversão

- Se o suporte do Playwright ao Electron quebrar sem correção numa atualização necessária do Electron,
  trocar o E2E por WebdriverIO com o driver do Electron e manter as camadas 1–7.
- Se o validador .NET gerar falsos positivos frequentes contra o Word real (comparação no roteiro manual),
  rebaixá-lo a informativo.

## Verificação

- No M1: `cd app && npm run verificar` passa; um teste de fronteira propositalmente violado falha (caso negativo registrado).
- `npm run test:e2e` executa FUN-01.
- No M3: `npm run verificar:tudo` gera o relatório com a contagem por camada, a partir de `templates/RELATORIO_DE_TESTES.md`.
