# Relatório do Marco M4 — Citações e referências

Relatório vivo do marco: cada tarefa M4-Txx acrescenta a sua seção. Plano: `docs/PLANO_DE_IMPLEMENTACAO.md`.

| Tarefa | Situação | Data |
|---|---|---|
| M4-T00 Decisões D-M4-01 a 07 | CONCLUÍDA | 2026-11-05 |
| M4-T01 Obras e citações no formato | CONCLUÍDA | 2026-11-05 |

## M4-T00 — Decisões

O usuário aceitou as recomendações ("siga as recomendações", 2026-11-05). Como a NBR 10520 e a NBR 6023 não estão no projeto, tudo fica provisório (D-M4-07). Os detalhes estão na matriz normativa, D-M4-01 a D-M4-07.

## M4-T01 — Obras e citações no formato v1

**Implementação:** sessão principal, sem delegar a `arquiteto-software` nem a `especialista-referencias`. **Sem revisão independente:** fica para o M4-T10. Nenhuma dependência nova. Decisões técnicas no adendo do M4-T01 no ADR-0004.

**Código**
- **Modelo** (`dominio/modelo`): `Obra`, `Autor`, `ObraNoTodo`, `EventoObra`, `InlineCitacao` e `ObraCitada`; `TIPOS_OBRA`, `FUNCOES_RESPONSAVEL` e `citacoesDoDocumento`. `idsDoBloco` passa a contar a citação.
- **Formato** (`dominio/esquemas`):
  - esquemas `esquemaObra`, `esquemaAutor`, `esquemaInlineCitacao` e `esquemaObraCitada`;
  - `obras` no documento;
  - mensagem própria para citação em título ou em nota;
  - ids únicos com citação e obra, e citação sem obra recusada;
  - JSON Schema regenerado.
- **Editor:** nó `chamadaCitacao` com ida e volta exata, sem `parseDOM`. O motor avisa `CITACAO_ADIADA`.

**Testes**
- Fixture válida `documento-bordas-m4.json`, com uma obra de cada tipo e citações em parágrafo, citação longa, alínea e subalínea, com apud, grifo e "sem paginação".
- 10 fixtures inválidas: citação sem obra, apud sem obra, lista de obras vazia, id repetido, citação em nota, título vazio, página com "sem paginação", ano incerto sem ano, e outras.
- Ida e volta pelo `.bdp` e pelo editor.

**Limitações**
- Ainda não há como criar obra nem citação pelo aplicativo (M4-T06 e T07). Elas só chegam por arquivo.
- Citação dentro de nota de rodapé fica recusada até o editor de nota guardar mais que texto.
- O nome de campo `secao` (seção ou caderno do jornal) não tem relação com a seção do trabalho.
