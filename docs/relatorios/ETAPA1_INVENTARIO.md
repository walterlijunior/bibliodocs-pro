# Relatório técnico — Etapa 1: Inventário

- **Data:** 2026-10-15
- **Autor:** sessão principal (skill `rastreabilidade-normativa`, parte de inventário)
- **Escopo:** conferência de `materiais/` contra `docs/INVENTARIO_DE_MATERIAIS.md`, SHA-256, extração
  do sistema original em `analise/`, verificação do ambiente e criação do repositório git.
  Fora do escopo: leitura do conteúdo dos materiais (Etapas 2 e 3) e conversão dos `.doc`.

## Resumo executivo
Os 14 itens esperados (13 + a extração 9a) estão presentes; nenhum ausente, nenhum arquivo inesperado.
Os 4 checksums registrados na preparação do kit conferem; os 10 itens que não tinham checksum
passaram a ter (registrados em 2026-10-15). O sistema original foi extraído em
`analise/sistema_original_extraido/tcc-uft/` (22 arquivos, contagens de linhas iguais às do inventário).
O repositório git foi criado com autorização do usuário (commit inicial `acc4f73`).
Única lacuna de ambiente: LibreOffice ausente — necessário para converter os `.doc` antes da Etapa 3.

## Método
- `find materiais -type f` + `ls -l` (tamanhos) e `sha256sum` sobre todos os arquivos.
- Assinatura dos primeiros 8 bytes (`head -c 8 | xxd -p`) para confirmar o formato real.
- `unzip -o -q materiais/sistema_original/tcc-uft-sistema_10.zip -d analise/sistema_original_extraido`;
  `wc -l` nos fontes.
- `powershell -ExecutionPolicy Bypass -File scripts\verificar-ambiente.ps1`.
- `git init -b main`, `.gitattributes`, commit inicial.
- Limitação: o checksum só prova que os arquivos não mudaram **a partir de agora**; para os itens 3–12
  não há valor anterior para comparar (o usuário os colocou nas pastas em 2026-10-12).

## Resultados

### Materiais `[VERIFICADO — sha256sum e listagem de 2026-10-15]`
| Item | Arquivo | Assinatura | Status |
|---|---|---|---|
| 1 | `tcc-uft-sistema_10.zip` | ZIP | PRESENTE-ÍNTEGRO (confere) |
| 2 | `Manual_Normalizacao_UFT_2ed_2022.pdf` | `%PDF-1.7` | PRESENTE-ÍNTEGRO (confere) |
| 3–8 | 6 modelos UFT `.doc` | OLE2 `D0CF11E0` (Word 97–2003) | PRESENTE-ÍNTEGRO (novo checksum) |
| 9 | `12-estudo-capcom-jgaap-brasil-japao.docx` (291.655 bytes) | ZIP/OOXML | PRESENTE-ÍNTEGRO (novo checksum) |
| 9a | extração de texto do item 9 | Markdown | EXTRAÇÃO-TEXTO-APENAS (confere) |
| 10 | `NORMAS DE APRESENTAÇÃO TABULAR.pdf` (IBGE) | `%PDF-1.6` | PRESENTE-ÍNTEGRO (novo checksum) |
| 11 | `Elaboracao-de-Elementos-de-Apoio-ao-Texto.pdf` (IFPR) | `%PDF-1.7` | PRESENTE-ÍNTEGRO (novo checksum) |
| 12 | `202502071521040.Ilustracoes e Tabelas.doc` (FURB) | OLE2 (Word 97–2003) | PRESENTE-ÍNTEGRO (novo checksum) |
| 13 | `itunes_tela_referencia.png` | PNG | PRESENTE-ÍNTEGRO (confere) |

Valores completos de SHA-256 e tamanhos: `docs/INVENTARIO_DE_MATERIAIS.md`.
O nome real do item 12 tem extensão `.doc` (o inventário anterior o citava sem extensão) — corrigido.

### Sistema original extraído `[VERIFICADO — unzip + wc -l]`
22 arquivos em `analise/sistema_original_extraido/tcc-uft/`. Linhas: `abnt.js` 567, `app.js` 268,
`components.js` 2200, `exports.js` 1508, `state.js` 191, `storage.js` 102, `templates.js` 242,
`visual-editor.js` 1033, `electron/main.js` 109 — todas iguais ao registrado no inventário.

### Ambiente `[VERIFICADO — scripts/verificar-ambiente.ps1]`
| Ferramenta | Versão |
|---|---|
| Windows | 11 Home 10.0.26300; PowerShell 5.1.26100 |
| Claude Code | 2.1.296 |
| Git | 2.54.0.windows.1 |
| Node.js / npm | v24.21.0 / 11.19.0 |
| Python | 3.14.7 |
| LibreOffice | **ausente** (opcional) |

### Repositório git `[VERIFICADO — git log]`
- `git init -b main`; commit `acc4f73` "Estado inicial do kit (kit-1.1.0) com materiais originais"
  (75 arquivos, inclui `materiais/`, exclui `analise/` conforme `.gitignore`).
- O git global está com `core.autocrlf=true`. Para que um checkout nunca altere os originais
  (e invalide os SHA-256), foi criado `.gitattributes` com `materiais/** -text -diff`.
  Decisão técnica pequena, registrada aqui e no CHANGELOG (sem ADR).

## Riscos e problemas encontrados
| ID | Descrição | Severidade | Evidência | Encaminhamento |
|---|---|---|---|---|
| I-1 | LibreOffice ausente: os 7 `.doc` não podem ser convertidos/lidos estruturalmente (estilos, bordas, margens) | Média (bloqueia a comparação modelo × Manual na Etapa 3, não a Etapa 2) | `verificar-ambiente.ps1` | Usuário decide: instalar LibreOffice (dependência global — requer autorização) ou converter os `.doc` para `.docx` no Word e colocá-los em `analise/` |
| I-2 | Itens 3–12 sem checksum anterior: não é possível provar que são os mesmos arquivos vistos no Projeto claude.ai | Baixa | Inventário de 2026-10-12 | Resolvido: o usuário confirmou em 2026-10-15 que baixou os 10 arquivos do Projeto do claude.ai (registrado no inventário) |
| I-3 | `core.autocrlf=true` poderia alterar `.md` de `materiais/` num checkout | Baixa | aviso do `git add` | Resolvido com `.gitattributes` |

## Recomendações
1. Prosseguir para a Etapa 2 (auditoria do sistema existente) — não depende dos `.doc`.
2. Antes da Etapa 3, resolver I-1 (conversão dos `.doc`).

## Pendências e perguntas ao usuário
- I-1: decidido em 2026-10-15 — o usuário instala o LibreOffice via `winget`; a conversão para
  `analise/modelos_docx/` é feita no início da Etapa 3 (caminho alternativo:
  `C:\Program Files\LibreOffice\program\soffice.exe`).

## Arquivos produzidos/alterados
- `docs/INVENTARIO_DE_MATERIAIS.md` (tabela de itens: caminhos completos, bytes, formato, status, SHA-256)
- `docs/relatorios/ETAPA1_INVENTARIO.md` (este relatório)
- `.gitattributes` (novo)
- `docs/ESTADO_DO_PROJETO.md`, `CHANGELOG.md`
- `analise/sistema_original_extraido/` (ignorado pelo git; recriável)
