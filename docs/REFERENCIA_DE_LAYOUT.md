# Referência de layout — iTunes com pequi

> **Decisão do usuário (2026-10-12):** o aplicativo deve se inspirar no layout do iTunes para Windows,
> conforme a captura em `materiais/referencias_layout/itunes_tela_referencia.png`.
> **No lugar da maçã, um pequi**, fruto símbolo do Tocantins.
> Este documento traduz a captura em especificação para o `especialista-interface`
> (skill `interface-desktop`). Itens marcados `[PROPOSTA]` são sugestões de mapeamento que o usuário
> pode mudar; o restante descreve a referência.

## 1. O que a captura mostra `[VERIFICADO na imagem]`

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ ◀◀  ▶  ▶▶   ───────●──     │          [ maçã no visor central ]          │ ☰  │ 🔍 Buscar │  ← barra superior
├────────────────────────────────────────────────────────────────────────────────────┤
│ Arquivo  Editar  Música  Visualizar  Controles  Conta  Ajuda                       │  ← barra de menus
├────────────────────────────────────────────────────────────────────────────────────┤
│ ‹ ›  [♫ Música ⇕]            [Biblioteca]  Para Você  Explorar  Rádio  Loja        │  ← navegação
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│   Olá                                            ┌───────────────────────────┐     │
│   texto de boas-vindas                           │ barra lateral │ grade de  │     │  ← tela de
│   pergunta de consentimento                      │ (Biblioteca,  │ capas     │     │    boas-vindas
│   [ Não ]  [ Aceitar ]                           │  listas)      │           │     │
│                                                  └───────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Características visuais: janela clara, cinza-claro nas barras, fundo branco no conteúdo; destaque
azul na aba ativa e no botão principal; tipografia sem serifa; ícones simples monocromáticos;
muito espaço em branco; grade de capas como forma principal de navegar pela biblioteca.

## 2. Tradução para o BiblioDocs Pro

| Elemento do iTunes | No BiblioDocs Pro | Observação |
|---|---|---|
| Maçã no visor central | **Pequi** (ícone original, desenhado para o app) | Decisão do usuário. Nenhum elemento da marca Apple no app |
| Visor central (quando toca música mostra faixa, artista e progresso) | **Visor do trabalho aberto:** título, tipo de trabalho, estado de salvamento, contador de não conformidades e barra de progresso de exportação. Sem trabalho aberto, mostra só o pequi | `[PROPOSTA]` |
| Botões ◀◀ ▶ ▶▶ e controle de volume à esquerda | **Ações principais:** seção anterior / próxima, pré-visualizar, e um controle de zoom da página no lugar do volume | `[PROPOSTA]` — alternativa: Novo trabalho, Salvar, Exportar DOCX |
| Botão de lista + campo Buscar à direita | **Busca global** (seções, texto, referências, figuras, tabelas, siglas) e botão de alternar grade/lista | |
| Barra de menus | **Arquivo · Editar · Trabalho · Inserir · Verificar · Exportar · Ajuda** | `[PROPOSTA]` |
| Seletor "♫ Música" | **Seletor de coleção:** Trabalhos, Referências, Figuras e Tabelas, Siglas, Modelos | |
| Abas Biblioteca · Para Você · Explorar · Rádio · Loja | **Biblioteca · Escrever · Elementos · Referências · Conformidade** | `[PROPOSTA]` |
| Barra lateral (Recentes, Artistas, Álbuns, Músicas, Playlists) | **Recentes, Por tipo (TCC, Artigo, Dissertação, Tese, Relatório, Projeto), Todos, e coleções do usuário** (ex.: por disciplina) | Coleções do usuário = equivalente das playlists |
| Grade de capas de álbum | **Grade de capas dos trabalhos** (miniatura da capa gerada pelo próprio app) | |
| Tela "Olá" com Não / Aceitar | **Boas-vindas na primeira execução:** apresentação curta e o pedido de consentimento para recursos on-line (ex.: revisão gramatical externa), com **Não** como padrão seguro | Coerente com RNF-03 (privacidade) |
| Azul de destaque | **Cor de destaque derivada do pequi** (amarelo-alaranjado da polpa), com verde da casca como cor secundária | Paletas candidatas apresentadas ao usuário na Etapa 4, com contraste conferido (WCAG AA) |

**Decisão do usuário (2026-10-16):** paleta **A — Cerrado claro** (destaque laranja queimado `#B35400` com texto
branco; verde da casca como secundária), escolhida no protótipo `analise/poc-ui/prototipo.html`; 138 pares de
contraste conferidos, 0 reprovados (`python -I analise/poc-ui/contraste.py`). Os demais itens `[PROPOSTA]` (botões
da barra superior, conteúdo do visor, menus, abas, capa em miniatura, tema escuro, cor do foco) são confirmados
com o usuário no M1-T10.

## 3. Regras de uso da referência
1. **Inspiração de organização e ritmo visual, não cópia.** Não usar logotipo, ícones, nomes,
   imagens ou fontes proprietárias da Apple; o pequi e os ícones são desenhos originais.
2. O documento acadêmico em edição continua seguindo o Manual UFT; o layout vale para a **janela do
   aplicativo**, não para o trabalho exportado.
3. Itens `[PROPOSTA]` podem ser alterados pelo usuário; ao implementá-los, o `especialista-interface`
   mostra um protótipo antes (skill `interface-desktop`, passo 1).
4. A primeira tela entregue (marco M1) já deve ter: barra superior com visor do pequi e busca,
   barra de menus, linha de navegação com seletor de coleção e abas, barra lateral e grade de trabalhos.

## 4. Critérios de aceite do layout (M1)
- Estrutura das quatro faixas (barra superior, menus, navegação, conteúdo) presente e redimensionável
  de 1024×700 até tela cheia.
- Pequi visível no visor central sem trabalho aberto; com trabalho aberto, o visor mostra título e estado.
- Busca acessível por teclado (Ctrl+F) e foco visível em todos os controles.
- Nenhum elemento de marca de terceiros na interface ou nos ícones.
