# Especificação revista — lacunas e plano (2026-11-15)

A especificação de atualização (`BiblioDocs-Pro-Especificacao.md`, fora do repositório) foi revista em 2026-11-14:
ganhou itens novos nas Etapas 2 a 4, a ficha institucional (Etapa 3, feita em `6fb5a52` e `bd03f4a`), o painel de
conformidade (nova Etapa 6) e a renumeração das antigas Etapas 6 a 8 para 7 a 9. Este relatório compara o texto revisto
com o código em `bd03f4a`. Conferido nos arquivos indicados [VERIFICADO], salvo onde marcado.

## Já atendido (sem mudança)

| Item | Onde |
|---|---|
| E1 Novo trabalho, Exportar, zoom só em Escrever com trabalho aberto | `5a72c3d`; `interface/Aplicativo.tsx` (`podeZoom={escrevendo && trabalho !== null}`) |
| E2 alinhamento, recuo, listas, ícones de seção, ajuda contextual (quebra, lado da janela, teclado, passar o mouse) | `9444158`; `interface/casca/AjudaContextual.tsx` |
| E3 catálogo, seletores dependentes, UFT oficial, brasão, ficha catalográfica por texto e .txt | `9c7c33e`, `db46ac5`, `e9e3e6b` |
| E3 ficha institucional, importação, perfis, IA | `6fb5a52`, `bd03f4a` |
| E4 gerenciador, remissivas estáveis, menção sem número, ligar menção escrita | `31cba30` |
| E5 fontes, citações, histórico | `3936d62` |
| E7 registro e cronograma; E8 modelo DOCX; E9 configuração, consumo, retomada | `854a1a9`, `5a0465f`, `d013d3f` |

## Lacunas

| # | Etapa | Lacuna | Situação no código |
|---|---|---|---|
| L1 | 2 | Sublinhar e tirar o sublinhado do trecho selecionado | O editor só tem itálico, negrito, sobrescrito e subscrito (`interface/editor/esquema.ts`, `ORDEM_MARCAS`); o DOCX já sabe sublinhar estilos |
| L2 | 2 | Divisor para redimensionar o painel lateral de Escrever, com limites | Não existe |
| L3 | 2 | Resumo, Agradecimentos, Natureza e outros campos de texto corrido mostram a justificação do perfil ao digitar | São `<textarea>` simples (`interface/escrever/PreTextuais.tsx`) |
| L4 | 3 | Titulação do orientador como seletor (Dr., Dra., Me., Ma.… e "outra") | Campo de texto livre |
| L5 | 3 | Caixa alta por campo na folha de rosto (natureza em caixa mista) | O motor tem estilo por campo (`rostoAutoria`, `rostoTitulo`, `naturezaTrabalho`); [HIPÓTESE] já correto: falta o teste que exporta e confere cada campo |
| L6 | 3 | Lista de quadros no seletor dos pré-textuais, sincronizada | Só `listaIlustracoes` e `listaTabelas` |
| L7 | 3 | Lista de siglas com grupos opcionais (criar, renomear, reordenar, mover entradas), alfabética no perfil UFT | Só a lista simples |
| L8 | 3 | Ficha catalográfica nos formatos do serviço da UFT | Texto e .txt feitos; PDF aguarda decisão do usuário (D-E3-04) |
| L9 | 4 | Colagem do Excel com bordas e alinhamento (mesclagem já entra) | `aplicacao/servicos/planilha.ts` lê texto e mesclagem; alinhamento e bordas não |
| L10 | 4 | "Ajustar tamanho e posição" com prévia da página, arrastar, redimensionar, posições predefinidas, quebra de texto | Não existe |
| L11 | 4 | Cancelar a janela de colagem ou importação volta à mesma posição (seção, rolagem, seleção) | Não conferido: precisa de teste |
| L12 | 4 | "Ligar menção": rótulo e mensagem sobrepostos (captura A) | Não conferido: precisa de reprodução |
| L13 | 6 | Painel de conformidade com filtros por categoria (gráficos, quadros, tabelas, figuras, citações, fontes), abrir o item e voltar, cobertura de cada verificação (verificado × revisão manual × aplicado na saída) | Famílias atuais: pré-textual, bibliografia, visual, tabela, texto, sigla (`dominio/verificador/conformidade.ts`) |
| L14 | 9 | Gerar tabela ou quadro editável a partir de imagem ou texto, com prévia e células incertas marcadas | Não existe |
| L15 | 9 | Sugestão de conformidade por IA, revisável antes de aplicar | Não existe |

## Plano (um commit por incremento, `verificar:tudo` em cada um)

1. **R1 — Etapa 2:** L1 (sublinhado no editor, no arquivo e no DOCX), L2 (divisor), L3 (justificação nos campos). **Feito em 2026-11-15** (`e2e/editor-revisto.spec.ts`).
2. **R2 — Etapa 3:** L4, L5 (teste e correção se precisar), L6, L7. **Feito em 2026-11-15** (`e2e/pre-textuais-revisto.spec.ts`, `tests/caixa-folha-rosto.test.ts`, `tests/motor-listas.test.ts`). L5: a edição 2022 do Manual pede a folha de rosto em caixa baixa e é o que sai; o usuário decidiu seguir a edição 2022 (D-E3-10).
3. **R3 — Etapa 4:** L12, L11, L9, L10. **L12, L11 e L9 feitos em 2026-11-15** (`e2e/ligar-mencao-layout.spec.ts` reproduz a captura A na versão anterior e passa na nova; `e2e/cancelar-posicao.spec.ts` achou a rolagem indo ao topo ao cancelar; `tests/planilha.test.ts`). **L10 feito em 2026-11-15** na opção 1 do usuário (só o que a norma aceita; `e2e/ajuste-tamanho.spec.ts`). R3 concluído.
4. **R4 — Etapa 6:** L13. **Feito em 2026-11-15** (`e2e/painel-conformidade.spec.ts`).
5. **R5 — Etapa 9:** L14, L15.

L8 continua com o usuário (D-E3-04: ler PDF pede uma biblioteca nova).
