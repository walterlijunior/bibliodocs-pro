---
name: interface-desktop
description: Desenvolvimento da interface desktop — layout inspirado no iTunes para Windows com um pequi no lugar da maçã (docs/REFERENCIA_DE_LAYOUT.md), identidade visual pequi, componentes, estados de tela, acessibilidade e fluxos de produtividade acadêmica. Use ao criar ou alterar qualquer tela, componente ou tema.
---

# Interface desktop

## Quando usar
Marcos M1–M7 sempre que houver tela; Etapa 4 para o guia visual. Agente: `especialista-interface`.

## Entradas
ADR de tecnologia; `docs/VISAO_DO_PRODUTO.md`; **`docs/REFERENCIA_DE_LAYOUT.md`** e a captura
`materiais/referencias_layout/itunes_tela_referencia.png` (abra a imagem antes de desenhar telas);
contratos dos módulos; `docs/GUIA_VISUAL.md` (quando existir).

## Procedimento
1. **Guia visual (Etapa 4):** propor 2–3 variações de paleta pequi (com contraste calculado), tipografia
   de interface (diferente da tipografia do documento), ícone original; registrar a escolha do usuário em
   `docs/GUIA_VISUAL.md`.
2. **Estrutura de tela** conforme `docs/REFERENCIA_DE_LAYOUT.md`: barra superior com visor central
   (pequi / estado do trabalho) e busca, barra de menus, navegação com seletor de coleção e abas,
   barra lateral, grade de capas; inspetor de detalhes e conformidade. Descrever estados: vazio, carregando, erro, cheio.
3. **Componentes com tokens** de tema; nenhum valor de cor/tamanho solto.
4. **Acessibilidade:** teclado em todos os fluxos, foco visível, rótulos, contraste AA, escala de 125%/150%.
5. **Texto da interface** em pt-BR, verbos de ação, sem jargão.
6. **Teste:** E2E dos fluxos essenciais (criar trabalho, inserir citação, inserir tabela de planilha,
   ver conformidade, exportar DOCX) ou roteiro manual registrado quando E2E não for viável.

## Saídas
Telas e componentes com testes; guia visual; capturas no relatório da tarefa.

## Verificação de conclusão
Fluxo navegável por teclado; estados tratados; teste/roteiro executado e registrado; sem elementos de
marca de terceiros (Apple/iTunes, Microsoft).

## Dependências externas
Framework de UI definido no ADR. Ferramenta de E2E (ex.: Playwright) exige instalação local — pedir
autorização; alternativa: roteiro manual documentado.
