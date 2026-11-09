# Relatório do marco M7 — Verificador de conformidade

- **Data:** 2026-11-08
- **Aceite do marco:** RF-15 com documento de teste de 10 não conformidades plantadas → **demonstrado** (FUN-09
  aprovado no domínio e no Electron real).
- **Commits (sem `git push`):** `907c981` (M6 concluído e M7-T00), `50c5371` (T01 e T02), `421d8a3` (T03), `bc43c7c`
  (T04) e o commit do T05 (revisão e fechamento).
- **Decisões:** D-M7-01 a 06, tomadas pela sessão principal por delegação do usuário, provisórias, na matriz.

## Ponto de partida

O Codex tinha começado o verificador no M6 (`conformidade.ts`): pré-textuais, bibliografia, elementos visuais e
siglas, com a aplicabilidade das regras pelo perfil, a janela com "Ir ao local" e o relatório `.txt`. Isso foi revisado
no M6 e serviu de base.

## Entregue

| Tarefa | O que mudou |
|---|---|
| M7-T00 | Plano (T01 a T05) e D-M7-01 a 05: o verificador confere o conteúdo, não a formatação; recomendação e heurística são aviso; o aceite usa seis famílias |
| M7-T01 | `verificador/texto.ts`: título secundário a quinário em caixa alta (RN-043), indicativo digitado (RN-109), supressão fora de "[...]" (RN-086), título vazio e seção sem texto (D-M7-02, provisório) |
| M7-T02 | `verificador/tabelas.ts`: dez verificações da Norma Tabular (RN-247, 256, 263, 271, 279, 284, 287, 298, 299 e RN-310 provisória, desligável no perfil); só espécie tabela; controles: Tabelas 1 e 4 do Anexo B |
| M7-T03 | Família e local legível em cada item ("Seção 1 Introdução — Tabela 1: “2020–2022”"); janela com resumo, filtro pendência/aviso e grupos; `.txt` agrupado igual |
| M7-T04 | Aceite: `documentoDezFalhasM7` (dez falhas, uma por regra, seis famílias) e `documentoCorretoM7` (nenhuma), no domínio e no E2E |
| M7-T05 | Revisão independente (`REVISAO_M7.md`): 0 Crítica/Alta; Médias e Baixas corrigidas; "Fontes:" no plural no motor (D-M7-06) |

## Testado

- `npm run verificar:tudo` (2026-11-08, depois das correções da revisão), saída 0:
  - typecheck; `vitest` 2115/2115; `npm audit` e `npm audit signatures` sem achado alto;
  - externos 28/28 (OOXML, LibreOffice e Word);
  - build; Playwright 41/41, inclusive `conformidade.spec.ts` (axe sem violação séria) e `conformidade-aceite.spec.ts`.
- Desempenho medido pelo revisor: verificador em 6–9 ms num documento de 150 páginas.

## Não testado / pendente

- R-M7-06: "Ir ao local" de título e de tabela leva ao bloco sem selecionar o trecho.
- R-M7-05: janela com 5.000 itens sem virtualização, não medida.
- N-M7-13: tabelas e citações de anexo (material de terceiros) também são verificadas; a origem do indicativo duplicado
  (RN-109) é aproximada.
- Conferência visual do "Fontes:" no Word pelo usuário: o teste externo passou, mas nenhum documento do corpus tem fonte
  com ";".
- Fora do marco, sem mudança: N-M6-12, M3-T12 (conferência no Word) e o brasão (RN-118) aguardam o usuário.
