# Estudo visual de tabelas, quadros e ilustrações (M5-T00)

- **Data:** 2026-11-07
- **Feito por:** sessão principal, seguindo a skill `tabelas-elementos-visuais`.
- **Material:**
  - estudo Capcom (`materiais/referencias_visuais/12-estudo-capcom-jgaap-brasil-japao.docx`), copiado e descompactado em `analise/capcom_docx/`; levantamento automático em `analise/capcom_estudo.txt`;
  - guia do IFPR (texto em `analise/normas_txt/furb_elementos_apoio.txt`);
  - o guia da FURB (`.doc`) não foi aberto: o texto do IFPR já cobre o que importa.
- **Regra do estudo:** os exemplos mostram estilo, não norma. Separo abaixo o que vem do Manual UFT ou da Norma Tabular do IBGE (com RN) do que é escolha de estilo dos exemplos. O assunto do estudo Capcom não importa e não entra em testes.

## 1. Estudo Capcom (exemplo de trabalho formatado)

[VERIFICADO no XML, `analise/capcom_estudo.txt`]

| Aspecto | O que o arquivo faz | Norma correspondente | Adotar? |
|---|---|---|---|
| Elementos | 77 tabelas do Word: 35 "Quadro n" e 42 "Tabela n". Nenhuma imagem | RN-049, RN-061, RN-062 | — |
| Página | A4, margens 3/2/2/3 cm, largura útil 9071 twips (16 cm) | RN-002, RN-018 | Já adotado |
| Largura do elemento | Todas as tabelas com 9071 twips (largura útil inteira) | Sem regra | Padrão: largura útil, com ajuste por coluna |
| Título | Estilos `QuadroTitulo` e `TabelaTitulo`: **corpo 10**, alinhado à esquerda (sem `jc`), espaço simples, 12 pt antes, 3 pt depois, `keepNext` | RN-021 e C-A1 pedem **12**; RN-055 e RN-066 (C-A3) pedem **centralizado** | **Não**: o Manual manda 12 e centralizado. Adoto o `keepNext` (título preso ao elemento) |
| Traço entre número e título | "Quadro 1 – As duas camadas…" (meia-risca com espaços) | RN-053, C-A5 | Já adotado |
| Fonte | "Fonte: …" depois de **todos** os 77 elementos, corpo 10, espaço simples, 2 pt antes, 12 pt depois. Justificada | RN-056, RN-274 (obrigatória); RN-022 (10); RN-057 e RN-307 (**à esquerda**) | Sim, mas **à esquerda**, não justificada |
| Quadro | Bordas `single` em volta e entre todas as células (fechado) | RN-061 | Sim |
| Tabela | Moldura com traço acima e abaixo do cabeçalho e no fim; sem laterais nem traços entre linhas de dados (bordas das células anulam as da tabela) | RN-251, RN-254, RN-253 (decisão: só os três traços) | Sim. É o padrão do IBGE |
| Cabeçalho | Primeira linha repetida em cada página (`tblHeader`) em todos | RN-292 (cabeçalho em cada página) | Sim |
| Sombreamento | Cabeçalho em cinza claro (`E7E6E6`) | Sem regra; RN-300 pede uniformidade | **Não** por padrão (D-M5-02) |
| Corpo das células | 9 a 10 pt | RN-311 / P-C2: 10, espaço simples | 10 |
| Números | À direita; cabeçalhos centralizados | RN-312 / P-C4: números à direita | Sim |
| Dado nulo | "—" para valor nulo e célula vazia para linha inexistente | RN-263 e RN-264: "–" zero, ".." não se aplica, "..." não disponível | Não: seguir o IBGE |
| Milhares | Ponto ("3.811.569") | RN-261 / P-C3: decisão do usuário (perfil) | Seguir o perfil |

## 2. Guia do IFPR (exemplo de outra instituição)

[VERIFICADO no texto extraído, linhas 40–70 e 140–200]
- **Tabela:** "Tabela n" à esquerda, título com hífen, corpo 12, espaço simples. Fonte e nota embaixo, corpo 10, espaço simples; a fonte "nem sempre" existe.
- **Figura:** identificação em cima, à esquerda, corpo 12.
- **Divergências com o Manual UFT:**
  - o título vai à esquerda; o Manual o centraliza (RN-055, RN-066);
  - o separador é hífen; o Manual usa meia-risca (RN-053);
  - a fonte é dispensável; o Manual a exige (RN-056, RN-274).

  Nada do guia é adotado onde diverge do Manual.

## 3. O que vem da norma (resumo para o M5)

| Tema | Regras |
|---|---|
| Identificação | RN-049 a RN-055, RN-063, RN-243 a RN-246, RN-302, RN-310: palavra designativa, número arábico contínuo por tipo, "–", título no topo, centralizado, 12, sem negrito, sem ponto final |
| Rodapé | RN-056 a RN-058, RN-064, RN-269 a RN-277, RN-304, RN-307: Fonte obrigatória, depois nota geral, depois notas específicas, corpo 10, à esquerda, rente à borda do elemento |
| Moldura | RN-061 (quadro fechado); RN-251 a RN-254 (tabela aberta, três traços, verticais só para destacar) |
| Conteúdo da tabela | RN-255 a RN-268, RN-311, RN-312: cabeçalho, indicadores, unidade entre parênteses, números arábicos, sinais convencionais, chamadas de nota |
| Espaçamento | RN-031, RN-032, RN-306, RN-308: espaço simples; uma linha antes do elemento e outra depois do rodapé |
| Página | RN-289 a RN-297: tabela que passa da página repete topo e cabeçalho, com "continua / continuação / conclusão"; recomenda-se caber numa página |
| Equações | RN-105 a RN-108: parágrafo próprio, número entre parênteses à direita, entrelinha maior permitida |
| Listas | RN-044, RN-309: lista de ilustrações e de tabelas (M6) |

## 4. Não estudado
- Imagens: o estudo Capcom não tem nenhuma. As regras de figura vêm só do Manual (p. 18–20) e dos modelos UFT.
- Gráficos e equações nos exemplos: não há.
- O `.doc` da FURB não foi aberto.
