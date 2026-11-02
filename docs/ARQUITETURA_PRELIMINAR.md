# Arquitetura do aplicativo

> **Status: DEFINIDA (ADR-0003 aceito em 2026-10-16).** As decisões estão em
> `docs/decisoes/ADR-0003-tecnologia-do-aplicativo.md` (tecnologia), `docs/decisoes/ADR-0004-formato-do-projeto.md`
> (arquivo de projeto), `docs/decisoes/ADR-0005-modulos-e-contratos.md` (módulos e contratos) e
> `docs/decisoes/ADR-0006-estrategia-de-testes.md` (testes). Todas estão como PROPOSTO até o usuário aprovar
> o ADR-0003. O nome do arquivo foi mantido para não quebrar referências.

## Histórico

| Data | Versão | Mudança |
|---|---|---|
| 2026-10-12 | Preliminar | Hipóteses do kit: camadas, alternativas A/B/C, formato `.bdp`, questões em aberto |
| 2026-10-16 | Definida (proposta) | Etapa 4: tecnologia escolhida por pontuação (Electron 83,0 × Web local 76,8 × .NET 74,6 × Tauri 73,6), módulos e contratos, formato de projeto, estratégia de testes; questões da seção 6 respondidas; decisões do usuário sobre LanguageTool e PDF incorporadas |

## 1. Sistema existente (resumo) `[VERIFICADO, docs/relatorios/ETAPA2_AUDITORIA.md]`

React 18.3.1 sem build, com o namespace `window.TCC.*` e o IndexedDB. Os três exportadores (DOCX, PDF e ODT)
são paralelos e têm regras fixas. O Electron 28 está sem suporte. Não há testes.

Recomendação da auditoria: **não evoluir o código no lugar**. A lógica de `abnt.js` e de `templates.js`
e o esqueleto do exportador DOCX servem de referência.

## 2. Tecnologia (ADR-0003, PROPOSTO)

| Peça | Escolha (versão consultada em 2026-10-15) |
|---|---|
| Runtime desktop | Electron 44.x (44.9.0 desde o M2-T11), sempre numa das 3 majors com suporte |
| Build | electron-vite 6 + Vite 8 |
| Linguagem | TypeScript 7 (`tsc --noEmit` para tipos) |
| Interface | React 19 |
| DOCX | `docx` 9.x, versão exata fixada (9.11.0) |
| Arquivo de projeto | ZIP via `fflate`; esquemas `zod` → JSON Schema |
| Instalador | electron-builder 26, NSIS por usuário, sem administrador; sem atualização automática enquanto não houver assinatura |
| Testes | Vitest 5, Playwright 1.64 (Electron), LibreOffice headless, validador Open XML SDK (.NET) opcional |
| PDF | **Fora do MVP.** Após o M7, conversão do DOCX pelo LibreOffice instalado (decisão do usuário, 2026-10-15) |
| Revisão on-line | **Opcional, desligada por padrão, com consentimento.** Após o M7 (decisão do usuário, 2026-10-15) |

Endurecimento obrigatório do runtime: checklist C-1 a C-22 da revisão de segurança da Etapa 4 (referenciado no ADR-0003).

## 3. Módulos e camadas (ADR-0005)

```text
 RENDERER (sandbox, sem Node)                    PRINCIPAL (Node)            UTILITÁRIO
 interface/ (React)                              principal/ (janela, IPC,    exportacao/docx
   │                                               CSP, protocolo app://)      ▲
 aplicacao/ (comandos, portas)  ◄── IPC tipado ──► persistencia/ (.bdp)        │ DocumentoFormatado
   │                              (preload)       integracoes/ (LibreOffice,   │
   ▼                                                LanguageTool: após M7)     │
 dominio/ (TS puro) ───────────────────────────────────────────────────────────┘
   modelo → numeracao → bibliografia / visuais → normas (motor) → verificador
   esquemas (validação + migrações)
   ▲ lê dados
 perfis/uft-2022/ (regras RN-xxx, parâmetros das decisões do usuário, tipos de trabalho)
 importacao/: backup tcc-uft (ADR-0004), CSV/XLSX, BibTeX/RIS, DOCX (fases posteriores)
```

Regras de dependência, verificadas por teste:
- O domínio não conhece plataforma.
- A interface nunca aplica regra normativa.
- O exportador só recebe o `DocumentoFormatado` resolvido pelo motor e não lê o perfil.
- Nenhum HTML é montado com dados do usuário.
- Rede só no adaptador opcional de revisão.

## 4. Formato de projeto (ADR-0004)

Os projetos são salvos num **arquivo `.bdp`** (extensão sugerida), que é um ZIP com:
- `manifesto.json` (`versao_formato` = 1, perfil e mídias com sha256);
- `documento.json`;
- `bibliografia.json`;
- `ajustes.json`;
- `midias/`.

Leitura:
- feita em memória, com lista de nomes permitidos, limites contra zip bomb e JSON Schema estrito;
- migrações encadeadas e testadas;
- arquivo de versão futura abre só para leitura.

Salvamento e recuperação:
- **Salvamento atômico:** grava um temporário no mesmo diretório, faz `fsync`, guarda o anterior como `.bak` e
  renomeia; repete a tentativa em caso de `EPERM`/`EBUSY`.
- **Recuperação:** instantâneos em `%LOCALAPPDATA%\BiblioDocsPro\recuperacao`, trava de sessão,
  recuperação de temporários órfãos e backups rotativos.

O importador do backup JSON do `tcc-uft` cria projetos novos, nunca sobrescreve, recusa SVG/HTML e mostra
prévia e relatório.

## 5. Testes (ADR-0006)

- Comando do dia a dia: `npm run verificar`. Inclui tipos, unitários do motor, rastreabilidade RN,
  fronteiras, persistência, regressão DOCX por propriedades e XML normalizado, e auditoria de dependências.
- Ao fim de cada marco: `npm run verificar:tudo`. Acrescenta o validador OOXML, o LibreOffice → PDF e o E2E Playwright.
- Cobertura ≥ 80% [META] no motor, na bibliografia, na numeração, nos esquemas e na exportação.

## 6. Questões em aberto da versão preliminar: respostas (detalhe no ADR-0005, seção 5)

1. **Reaproveitamento:** só a lógica, portada para TS com testes e ligada a RN. Nada de `vendor/` nem do
   código de interface.
2. **Paginação:** a paginação final é do Word, por campos PAGE, TOC, SEQ e PAGEREF. O TOC já sai com as
   entradas; o pré-preenchimento de números por estimativa depende da PoC. Verificações por página só via PDF do LibreOffice.
3. **Equações:** OMML nativo, a partir de LaTeX restrito. Imagem só como alternativa, com aviso.
4. **Pré-visualização:** HTML aproximado a partir do mesmo `DocumentoFormatado` (sempre). PDF fiel via
   LibreOffice após o M7 (opcional).

## 7. Pendências que dependem do usuário ou da PoC

- Aprovação do ADR-0003, que afeta o custo e o instalador.
- Resultado da PoC DOCX (`analise/poc-docx/`), a integrar no ADR-0003.
- Itens visíveis do ADR-0004: extensão `.bdp`, pasta padrão e salvamento automático no arquivo do usuário.
- Assinatura de código (custo).
- Prioridade do importador `tcc-uft`.
- ADR do editor de texto rico (com o `especialista-interface`) antes do M2.
