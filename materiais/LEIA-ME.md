# materiais/ — originais do projeto (somente leitura)

Esta pasta guarda os materiais de referência **exatamente como foram fornecidos**.
O Claude Code não edita, move nem apaga nada aqui (`Edit(/materiais/**)` está em *deny*
em `.claude/settings.json`, e a regra 1 do `CLAUDE.md` reforça isso).
Para trabalhar sobre um original, ele é copiado ou extraído para `analise/`.

| Subpasta | Conteúdo esperado | Situação na entrega do kit |
|---|---|---|
| `sistema_original/` | `tcc-uft-sistema_10.zip` | Incluído |
| `normas/` | Manual de Normalização UFT, 2ª ed. 2022 (PDF) e *Normas de apresentação tabular* do IBGE (1993) | Manual incluído; IBGE colocado pelo usuário |
| `modelos_uft/` | 6 modelos institucionais `.doc` (2022) | Colocados pelo usuário (ver `modelos_uft/LEIA-ME.md`) |
| `referencias_visuais/` | `12-estudo-capcom-jgaap-brasil-japao.docx` e guias do IFPR e da FURB — exemplos de formatação | Colocados pelo usuário; extração de texto do estudo Capcom incluída |
| `referencias_layout/` | Captura do iTunes — referência de layout do app (pequi no lugar da maçã) | Incluída |

Ao adicionar arquivos, mantenha os nomes indicados. Na Etapa 1 o Claude Code calcula o
SHA-256 de tudo e atualiza `docs/INVENTARIO_DE_MATERIAIS.md`.
Normas ABNT (textos oficiais) podem ser colocadas em `normas/` se você tiver acesso licenciado;
elas não acompanham o kit.
