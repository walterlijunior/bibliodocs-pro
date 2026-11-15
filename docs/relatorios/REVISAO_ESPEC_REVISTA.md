# Revisão do ciclo da especificação revista (2026-11-15)

Escopo: tudo o que mudou de `099f27a` (último envio antes do ciclo) até o fechamento — ficha institucional e IA da ficha,
R1 a R5 de `ESPEC_REVISTA_LACUNAS.md`, ficha catalográfica em PDF e DOC-08. Cerca de 3.900 linhas em 77 arquivos de
`app/src`. Revisão feita pela sessão principal, a pedido do usuário ("queria que tivesse feito tudo"), nos mesmos dois
eixos das revisões de marco: segurança e integridade (R-RV) e fidelidade normativa (N-RV).

## Segurança e integridade

Entradas de fora do aplicativo conferidas: ficha `.bdficha.json` importada, respostas da IA (ficha, tabela, sugestão),
área de transferência (HTML do Excel, LibreOffice e Google Planilhas), PDF da ficha, imagem enviada à IA, canal novo
`bibliodocs:catalogo:exportarFicha`.

| Id | Gravidade | Achado | Situação |
|---|---|---|---|
| R-RV-01 | Média | O canal `bibliodocs:ia:enviar` aceitava até 20 mensagens com imagem de até 8 MB cada (160 MB numa chamada) e imagem também na mensagem de instruções. | **Corrigido**: no máximo uma imagem, só na mensagem do usuário (`manipuladores-ia.ts`); teste em `tests/etapa8-ia.test.ts`. |
| R-RV-02 | Baixa | A leitura das classes CSS da colagem do Excel (`estilosDeClasse`) usava uma expressão que ficava quadrática com regras sem `}` (1,1 s com 256 KB). | **Corrigido**: varredura linear e no máximo 256 KB por folha `<style>`; teste em `tests/planilha.test.ts`. |
| R-RV-03 | Informativo | Tudo o que vem da IA e da ficha é mostrado como texto (React, nunca HTML); respostas passam por leitores próprios que só aceitam campos conhecidos e, na ficha, pelo esquema zod antes de chegar ao catálogo. Regras de perfil sugeridas passam pelo filtro do modelo de evento. | Sem ação. |
| R-RV-04 | Informativo | PDF: lido no renderer, sem rede (bytes locais, sem CMaps nem fontes externas), sem fontes embutidas e sem XFA; a versão 6 do pdf.js não avalia código do arquivo; até 2 MB e 3 páginas. O worker vem da mesma origem `app://` (CSP `script-src 'self'`). | Sem ação. |
| R-RV-05 | Informativo | Exportar a ficha: o principal confere o remetente, o nome sugerido (sem caminho), o tamanho (8 MB) e valida a ficha antes da janela de salvar; o destino vem só da janela do sistema. | Sem ação. |
| R-RV-06 | Informativo | Formato do trabalho: todas as mudanças são aditivas e validadas (sublinhado, `listaQuadros`, `listaSiglas.agrupada`, `Sigla.grupo`, `gruposSiglas` com ids únicos). Uma versão anterior recusa o arquivo que as usar, como em qualquer valor novo de enumeração (adendos no ADR-0004). | Sem ação; registrado no changelog. |
| R-RV-07 | Informativo | Dependências: pdf.js 6.4.299 (Apache-2.0) passou a `dependencies` (antes só nos testes), embutido no bundle; o canvas nativo opcional fica fora do pacote e do inventário. `npm audit --omit=dev`: 0 vulnerabilidades; as restantes (6 moderadas, 1 baixa) são de ferramentas de empacotamento e teste e só se resolvem com versões fora da faixa (`--force`). | Acompanhar nas próximas atualizações do electron-builder. |

## Fidelidade normativa

| Id | Achado | Situação |
|---|---|---|
| N-RV-01 | Caixa da folha de rosto: a edição 2022 do Manual (5.3 a–b, p. 33) pede caixa baixa; a especificação citava outra edição. | Decidido pelo usuário (D-E3-10): edição 2022. Conferido por teste. |
| N-RV-02 | Lista de quadros (D-E3-11) e siglas agrupadas (D-E3-12): a primeira se apoia em RN-161 (listas próprias por tipo); a segunda contraria a relação alfabética simples de RN-165 e por isso é opcional, desligada por padrão e gera aviso FORMA_SEM_FONTE. | Provisórias, registradas na matriz. |
| N-RV-03 | "Ajustar tamanho e posição" só oferece o que a norma aceita (centralizado no fluxo, RN-059), por decisão do usuário (D-E4-05). | Conforme. |
| N-RV-04 | Colagem com o alinhamento da origem (D-E4-04): não há regra de alinhamento dos números na matriz (o "à direita" era sugestão provisória do M5), então manter o da origem não contraria norma. | Sem ação. |
| N-RV-05 | Selo "Verificado pelo aplicativo" × "Exige revisão sua" (D-E6-04): só pendência com regra definitiva leva o primeiro; critério provisório nunca. | Conforme a Política de Fontes (2.2). |
| N-RV-06 | Sugestões da IA (ficha, tabela, conformidade) nunca entram sem revisão: ficha e perfil pela prévia (perfil sempre não revisado), tabela com células "[?]" bloqueando a inserção, conformidade com campos marcados um a um. | Conforme a especificação (Etapa 9). |

## Verificação

- `verificar:tudo` com saída 0 depois das correções (ver o commit da revisão em `ESTADO_DO_PROJETO.md`).
- Os 10 E2E novos do ciclo rodaram 3 vezes seguidas (30/30) depois de estabilizados os dois que dependiam do momento em
  que o editor registra a seleção.
- DOC-08 por automação no Word, com controle positivo (`MATRIZ_DE_TESTES.md`).

Abertos: nenhum de segurança. Pendente do usuário: testar as funções de IA com um serviço real.
