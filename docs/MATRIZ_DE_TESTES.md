# Matriz de testes

Status: `NÃO EXECUTADO` (inicial) → `PASSOU` / `FALHOU` / `BLOQUEADO`, sempre com data e evidência
(comando + resumo da saída, ou relatório). Os casos do aplicativo serão detalhados pelo
`engenheiro-qualidade` à medida que os marcos avançam; os casos KIT já são executáveis.

## Grupo KIT — infraestrutura deste kit

| ID | Caso | Como executar | Status |
|---|---|---|---|
| KIT-01 | Arquivos obrigatórios existem | `scripts\validar-kit.ps1` / `python tests/test_estrutura_kit.py` | PASSOU (2026-10-12, ver relatório de validação) |
| KIT-02 | Agentes com frontmatter válido (`name` = nome do arquivo, `description`) | idem | PASSOU (2026-10-12) |
| KIT-03 | Skills com `SKILL.md`, `name` = pasta, formato kebab-case ≤ 64, `description` ≤ 1024 | idem | PASSOU (2026-10-12) |
| KIT-04 | `settings.json` é JSON válido e contém as proteções esperadas | idem | PASSOU (2026-10-12) |
| KIT-05 | Referências cruzadas entre arquivos existem (ou estão declaradas como artefatos futuros) | idem | PASSOU (2026-10-12) |
| KIT-06 | Nenhum segredo/token no kit | idem | PASSOU (2026-10-12) |
| KIT-07 | Checksums dos materiais conferem com o inventário | idem | PASSOU (2026-10-12) |
| KIT-08 | Claude Code carrega CLAUDE.md, agentes e skills no Windows | Manual: Passo 8 de `INSTRUCOES_INICIAIS.md` | NÃO EXECUTADO (requer a máquina do usuário) |

## Grupo ARQ — arquitetura e varreduras (aplicativo, desde o M1-T03)

Executar: `cd app; npm run verificar`. Testes em `app/tests/arquitetura-*.test.ts` e `app/tests/apoio/analisador-fontes.ts`.

| ID | Caso | Fonte do esperado | Status |
|---|---|---|---|
| ARQ-01 | Nenhum import de `src/` viola as regras 1–6 de dependência (código real) | ADR-0005 §2 + adendo M1-T03 | PASSOU (2026-10-16; 258/258; reexecutado no M1-T04 com zod em `dominio/esquemas`: 310/310) |
| ARQ-02 | Casos negativos sintéticos: ao menos um por regra 1–6 é detectado | idem | PASSOU (2026-10-16) |
| ARQ-03 | Arquivo violador real em `src/` faz `npm run verificar` falhar (`src/dominio/modelo/_violacao.ts` → `import 'electron'`) | ADR-0006, critério do M1 | PASSOU (2026-10-16; EXIT=1 com "ADR-0005 regra 1"; arquivo apagado) |
| ARQ-04 | Sem `innerHTML`/`dangerouslySetInnerHTML`/`eval`/`new Function` e afins em `src/` | ADR-0005 regra 7; C-20 | PASSOU (2026-10-16) |
| ARQ-05 | Sem import de rede nem `fetch`/`XMLHttpRequest`/`WebSocket`/`net.*` fora de `integracoes/revisao-texto`; `openExternal` só em `endurecimento.ts` | ADR-0005 regra 8; C-6, C-8 | PASSOU (2026-10-16) |
| ARQ-06 | Lockfile ≥ v3 em sincronia com o `package.json`; sem `html2canvas`/`jspdf` | C-18, C-19 | PASSOU (2026-10-16) |

## Grupo PER — formato e persistência (aplicativo, desde o M1-T04)

Executar: `cd app; npm run verificar`. Testes em `app/tests/esquemas-*.test.ts`; fixtures em `app/tests/fixtures/projeto-v1/`.

| ID | Caso | Fonte do esperado | Status |
|---|---|---|---|
| PER-01 | Fixtures v1 válidas (documento e manifesto) passam; ida e volta por JSON idêntica | ADR-0004 §2 | PASSOU (2026-10-16; 310/310) |
| PER-02 | Campo extra (raiz e aninhado), tipo errado, campo ausente, tipo de bloco/enum desconhecido, id inválido, id repetido, texto acima do limite, caractere proibido em XML 1.0 (NUL, CR, VT, U+FFFF, surrogate isolado) e marcas repetidas ou sobrescrito+subscrito são recusados com caminho e mensagem pt-BR; nenhuma mensagem em inglês | ADR-0004 §2–3; plano M1-T04 | PASSOU (2026-10-16) |
| PER-03 | 64 níveis de seção aceitos, 65 recusados; aninhamento JSON de 100.000 níveis recusado sem estouro de pilha | ADR-0004 §3 | PASSOU (2026-10-16) |
| PER-04 | Manifesto: versão ≠ 1, data sem fuso, caminho de mídia com `..`, caminho incoerente com sha256/tipo, SVG, mídia repetida e acima de 64 MB são recusados | ADR-0004 §1–3 | PASSOU (2026-10-16) |
| PER-05 | JSON Schema versionado = gerado do zod; objetos com `additionalProperties:false`; listas com `maxItems`; strings limitadas; `oneOf` com discriminador; `uniqueItems` nas marcas | ADR-0004 §2 | PASSOU (2026-10-16; mutações no arquivo e no esquema detectadas) |
| PER-06 | `z.infer` do esquema = tipo `Documento` do modelo (verificado pelo typecheck) | ADR-0005 §3 | PASSOU (2026-10-16; campo extra no tipo → erro TS2344) |
| PER-07 | Contêiner: ida e volta idêntica; bytes determinísticos; `mimetype` como 1.ª entrada sem compressão; pacote montado à mão também é lido | ADR-0004 §1 | PASSOU (2026-10-16; 370/370) |
| PER-08 | Contêiner recusa: não ZIP, truncado, com comentário, nome fora da lista (`..`, absoluto, `\`, diretório, `.svg`, maiúsculas), nome repetido, `mimetype` ausente/fora de ordem/comprimido/de outro formato, obrigatório ausente, `bibliografia.json`/`ajustes.json` (não suportados no v1), criptografia, método desconhecido, sobreposição, CRC errado, JSON inválido/não UTF-8, id do manifesto ≠ documento, versão futura (mensagem própria), aninhamento patológico dentro do arquivo | ADR-0004 §3 | PASSOU (2026-10-16) |
| PER-09 | Zip bomb: razão > 200:1, tamanho declarado menor que o real (interrompido), maior que o real, sem compressão com tamanhos divergentes; limites de arquivo/entradas/JSON/mídia/soma | ADR-0004 §3 | PASSOU (2026-10-16; 10 mutações do leitor e do empacotador detectadas) |
| PER-10 | Mídia com sha256 divergente, assinatura ≠ tipo (SVG disfarçado de PNG), declarada e ausente, presente e não declarada; miniatura não PNG → descartadas com aviso, projeto abre | ADR-0004 §3 item 4 | PASSOU (2026-10-16) |
| PER-11 | Correções da revisão de segurança: (A1) empacotar recusa o que a leitura recusaria, e texto repetitivo abaixo de 1 MB é aceito; (A2) mídia não declarada e `bibliografia.json` não são descomprimidos; (A3) manifesto inválido encerra a leitura antes do documento, e manifesto acima de 2 MB é recusado; (A4) lixo depois do fluxo deflate, lacuna entre entradas ou antes do diretório central e descritor de dados são recusados; (A5) os bytes lidos não compartilham memória com o `Buffer` de entrada nem com o pool do zlib | `docs/relatorios/M1_RELATORIO_MARCO.md` (M1-T05) | PASSOU (2026-10-16) |

## Grupo SEG — runtime (aplicativo, desde o M1-T02)

| ID | Caso | Fonte do esperado | Status |
|---|---|---|---|
| SEG-01 | Filtros de URL, navegação, rede, link externo e caminho do `app://` (funções puras) | Checklist C-3, C-5, C-6, C-8 | PASSOU (2026-10-16; `npm test`) |
| SEG-02 | CSP de produção idêntica ao checklist; verificação estática das webPreferences | C-2, C-4, C-9, C-15 | PASSOU (2026-10-16) |
| SEG-03 | E2E: script inline bloqueado, `fetch` remoto falha, navegação/`window.open` sem efeito, segunda instância | Revisão M1-T02, achado M-1 | NÃO EXECUTADO (M1-T13; sondas manuais em 44.7.2 em `docs/relatorios/M1_RELATORIO_MARCO.md`) |

## Grupo FUN — funcionalidades (aplicativo)

| ID | Requisito | Caso | Status |
|---|---|---|---|
| FUN-01 | RF-01 | Criar, salvar, fechar, reabrir trabalho: conteúdo idêntico | NÃO EXECUTADO |
| FUN-02 | RF-02 | Para cada tipo de trabalho, elementos obrigatórios presentes | NÃO EXECUTADO |
| FUN-03 | RF-03 | Mover seção renumera seções e remissivas | NÃO EXECUTADO |
| FUN-04 | RF-05 | Toda formatação do DOCX tem `RN` | NÃO EXECUTADO |
| FUN-05 | RF-07/08 | Documento com 1 citação órfã e 1 referência não citada é diagnosticado | NÃO EXECUTADO |
| FUN-06 | RF-09 | Importar CSV/XLSX com acentos, vírgula decimal, vazios e datas | NÃO EXECUTADO |
| FUN-07 | RF-11 | Excluir figura referenciada gera aviso | NÃO EXECUTADO |
| FUN-08 | RF-12 | Inserir seção/figura atualiza sumário e listas | NÃO EXECUTADO |
| FUN-09 | RF-15 | 10 não conformidades plantadas detectadas, 0 falsos positivos no documento correto | NÃO EXECUTADO |

## Grupo DOC — regressão documental (DOCX)

| ID | Propriedade conferida no DOCX | Fonte do esperado | Status |
|---|---|---|---|
| DOC-01 | Página A4 (11906 × 16838 twips) | `RN` de formato de papel (Etapa 3) | NÃO EXECUTADO |
| DOC-02 | Margens 3/3/2/2 cm (sup/esq/inf/dir) = 1701/1701/1134/1134 twips | RN-002 (Manual UFT p. 15) | NÃO EXECUTADO |
| DOC-03 | Fonte Times New Roman ou Arial 12 no corpo; 10 em citação longa, notas e legendas | RN-001 | NÃO EXECUTADO |
| DOC-04 | Espaçamento 1,5 no corpo (`w:line=360`), simples nos casos previstos | RN-006 | NÃO EXECUTADO |
| DOC-05 | Recuo de primeira linha 1,25 cm (709 twips); citação longa com recuo de 4 cm (2268 twips) | RN-003, RN-004 | NÃO EXECUTADO |
| DOC-06 | Estilos de título por nível conforme Quadro 1 do Manual | RN-010 a RN-014 | NÃO EXECUTADO |
| DOC-07 | Sumário presente e coerente com os títulos | `RN` de sumário (Etapa 3) | NÃO EXECUTADO |
| DOC-08 | DOCX abre sem reparo no Word e no LibreOffice | RNF-05 | NÃO EXECUTADO (manual) |

## Grupo UI — layout

| ID | Caso | Fonte do esperado | Status |
|---|---|---|---|
| UI-01 | Janela com barra superior (visor com pequi + busca), menus, navegação com abas, barra lateral e grade de trabalhos | `docs/REFERENCIA_DE_LAYOUT.md`, seção 4 | NÃO EXECUTADO |
| UI-02 | Nenhum elemento de marca de terceiros na interface e nos ícones | `docs/REFERENCIA_DE_LAYOUT.md`, seção 3 | NÃO EXECUTADO |

## Grupos DES (desempenho) e DIST (distribuição)
Definidos nas Etapas 4 e 6: demais fluxos essenciais por teclado (UI), metas RNF-06/07 (DES), instalação
limpa, abertura, exportação e desinstalação no Windows 10 e 11 (DIST).
