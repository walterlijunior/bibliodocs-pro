# Guia visual do BiblioDocs Pro

> Registro das escolhas do usuário sobre a identidade visual e o layout (skill `interface-desktop`, passo 1).
> Referência de organização: `docs/REFERENCIA_DE_LAYOUT.md`. Protótipo de origem: `analise/poc-ui/prototipo.html`
> (Etapa 4, recriável). Implementação: `app/src/interface/` (M1-T10).

## Decisões do usuário

| Item | Escolha | Data |
|---|---|---|
| Paleta | **A — Cerrado claro**: cinzas claros e branco; destaque laranja queimado `#B35400` com texto branco; verde da casca `#2F6B3A` como secundária | 2026-10-16 (Etapa 4) |
| Tema escuro | **Só o claro no M1.** Os tokens do escuro já existem (`:root[data-tema="escuro"]`, contraste conferido), mas nada os liga ainda | 2026-10-16 (M1-T10) |
| Pequi | Meia casca com três caroços, **colorido** no visor e no estado vazio | 2026-10-16 (M1-T10) |
| Botões à esquerda da barra superior | **Seção anterior · Pré-visualizar · Próxima seção + zoom da página** (desativados sem trabalho aberto) | 2026-10-16 (M1-T10) |
| Visor central | Sem trabalho: só o pequi. Com trabalho: **título, tipo, estado de salvamento, nº de não conformidades e progresso da exportação** | 2026-10-16 (M1-T10) |
| Menus | **Arquivo · Editar · Trabalho · Inserir · Verificar · Exportar · Ajuda** | 2026-10-16 (M1-T10) |
| Abas | **Biblioteca · Escrever · Elementos · Referências · Conformidade** | 2026-10-16 (M1-T10) |
| Capas da grade | **Miniatura da capa** do trabalho. No M1, capa simplificada (título e ano); a capa fiel vem com o motor normativo | 2026-10-16 (M1-T10) |
| Ícone do app | **O pequi da interface**, sem fundo, em `.ico` de 16 a 256 px: desenho completo de 32 px para cima e versão simplificada (contornos grossos, faixa creme do corte) em 16 e 24 px. Fontes: `app/recursos-build/icone.svg` e `icone-pequeno.svg`; `npm run icone:gerar`. O usuário pediu um ícone próprio e delegou o desenho | 2026-10-17 (M1-T14) |
| Cor do foco | **Azul** `#1F5FBF` (claro) / `#8AB4FF` (escuro), distinta de destaque, seleção e sucesso | 2026-10-16 (M1-T10) |

## Regras de implementação

- Cores e medidas só por tokens (`app/src/interface/estilos/tokens.css`); o teste `tests/interface-tokens.test.ts`
  confere o contraste WCAG 2.2 (23 pares por tema: texto ≥ 4,5:1, não texto ≥ 3:1) e recusa cor escrita à mão fora
  dos tokens.
- Tipografia da interface: Segoe UI (sistema). A tipografia do documento é outra e vem do perfil normativo.
- Ícones: SVG próprios em `app/src/interface/Icones.tsx`; nenhum pacote de ícones nem elemento de marca de terceiros
  (UI-02, também testado).
- Escala do Windows (125%/150%): aplicada pelo Chromium; as medidas são em px CSS.
- Janela: mínimo 1024×700; abaixo de ~1100 px de largura, o painel de detalhes sobrepõe a grade.
