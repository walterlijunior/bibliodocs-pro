# Relatório de testes — Etapa 6 (testes e validação)

> Em construção: as seções são completadas a cada tarefa da Etapa 6 (E6-T01 a T05). O fechamento é o E6-T05.

- **Data:** 2026-11-08
- **Versão/commit testado:** `c052f9a` e seguintes (ver cada seção)
- **Ambiente:** Windows 11, Node e Electron do projeto; Microsoft Word 16.0 (automação COM, só leitura); LibreOffice
  (conversão sem interface); Poppler 25.07 (`pdftoppm`, só para gerar imagens das páginas, fora do projeto)
- **Executado por:** sessão principal

## Verificações manuais — E6-T03 (conferência visual)

**Como:** os exemplos completos do E6-T02 foram gravados com `BDP_GUARDAR_EXEMPLOS` em `analise/exemplos-e6`
(pasta de trabalho, fora do git), convertidos em PDF pelo **Word** (`app/ferramentas/word/conferir-no-word.ps1 -Pdf`,
documento aberto só para leitura e não salvo) e pelo LibreOffice, e as páginas viradas imagem com o `pdftoppm`. A
sessão principal olhou as páginas do exemplo de tese gerado pelo Word (capa, folha de rosto, folha de aprovação, lista
de ilustrações, sumário, 1.ª página textual, referencial com citação longa e cinco níveis, metodologia com alíneas,
quadro e equação, resultados com tabela, gráfico e figura, referências, apêndice) e comparou com o Manual (p. 65 para
o apêndice, imagem do PDF) e com as RN da matriz.

**Conforme [VERIFICADO na imagem do PDF do Word]:**
- Capa e folha de rosto distribuídas na página (justificação vertical), natureza recuada à direita, local e ano no pé.
- Listas e sumário com pontilhado e página; páginas iguais às recalculadas pelo Word (E6-T02).
- Numeração a partir do texto ("10" na 11.ª folha, contando da folha de rosto: RN-067, RN-068).
- Sigla por extenso na 1.ª ocorrência, nota de rodapé em 10 com filete.
- Citação longa recuada em 10 e simples; chamadas autor-data; *et al.* em itálico.
- Títulos dos cinco níveis com o destaque de cada nível (Quadro 1 do Manual, decisões do usuário).
- Alíneas e subalíneas; quadro fechado; tabela aberta com cabeçalho centralizado; equação com "(1)" à direita.
- Referências em ordem alfabética, simples, separadas por uma linha, título da obra em negrito, sufixos 2020a/2020b.
- Apêndice como no exemplo da p. 65: "APÊNDICE" centralizado e, abaixo, "APÊNDICE A – Título" à esquerda (RN-237).

**Diferenças e decisões:**

| # | Diferença | Causa | Decisão |
|---|---|---|---|
| V-01 | No PDF do LibreOffice, a capa, a folha de rosto e a folha de aprovação saem com tudo no alto da página | O DOCX usa a justificação vertical da seção (`w:vAlign="both"`, RN da capa), que o Word aplica e o LibreOffice não | Limitação do LibreOffice; o alvo é o Word (ADR-0006). Registrado para o usuário que abrir no LibreOffice |
| V-02 | Nos exemplos, o gráfico sai só com título e fonte, sem a imagem | O PNG do gráfico é desenhado pelo aplicativo na exportação (D-M5-08); os exemplos são gerados por script, fora do app | Limite do teste, não do produto; o gráfico com imagem é conferido em `e2e/grafico.spec.ts` |
| V-03 | "…sem conteúdo real. (EXEMPLAR NETO, 2020a, p. 12)." com ponto antes da chamada | Texto do próprio exemplo | Exemplo corrigido. O verificador não acusa ponto antes da chamada: possível melhoria futura, sem RN registrada hoje |

**Para o usuário (manual, sem automação possível):** abrir um dos exemplos no Word e dizer se aparece aviso de reparo ou
pergunta de atualizar campos (DOC-08, M3-T12). Os arquivos ficam em `analise/exemplos-e6` depois de
`BDP_GUARDAR_EXEMPLOS=<pasta> npm run test:externos`.
