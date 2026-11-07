# Relatório do Marco M4 — Citações e referências

Relatório vivo do marco: cada tarefa M4-Txx acrescenta a sua seção. Plano: `docs/PLANO_DE_IMPLEMENTACAO.md`.

| Tarefa | Situação | Data |
|---|---|---|
| M4-T00 Decisões D-M4-01 a 07 | CONCLUÍDA | 2026-11-05 |
| M4-T01 Obras e citações no formato | CONCLUÍDA | 2026-11-05 |
| M4-T02 Formatadores de referência (base e livro) | CONCLUÍDA | 2026-11-07 |

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

## M4-T02 — Formatadores de referência

**Implementação:** sessão principal, em `app/src/dominio/bibliografia/`, sem dependência nova. **Sem revisão independente:** fica para o M4-T10.

**Escopo.** O plano pede formatadores "por tipo", e o M4-T04 traz a primeira leva de tipos. O M4-T02 entrega a base comum e o **livro**, que exercita quase todos os elementos. Os outros oito tipos respondem com o aviso `TIPO_SEM_FORMATADOR` até o M4-T04 e não inventam nada.

**Código**
- `trechos.ts`: a referência sai em trechos com texto, destaque e a RN (ou decisão D-M4) de origem. Também traz os avisos e o fecho de elemento, que não repete o ponto de "et al.", "M." ou "?".
- `autores.ts`:
  - SOBRENOME, Prenomes (RN-180, RN-181) e entidade em maiúsculas (RN-187);
  - "; " até três autores (RN-183), *et al.* em itálico depois disso (RN-184, RN-185), ou todos pela opção do C-B12;
  - (org.)/(orgs.), (coord.)/(coords.), (ed.), (comp.) (RN-186).
- `datas.ts`: meses do Anexo, p. 72 (RN-190); "[2016?]" e "[2016]" (D-M4-04, D-M4-05); sufixo "2020a".
- `referencia.ts`: entrada e título em negrito com subtítulo sem destaque (RN-178), entrada pelo título com a primeira palavra em maiúsculas (RN-179), edição sem a 1.ª (RN-192), imprenta com "[S. l.]" e "[s. n.]" (RN-193), páginas, on-line (RN-189), *E-book* (RN-191), tradução (RN-204).
- `ordenacao.ts`:
  - ordem alfabética pt-BR (RN-176), autor a autor e sobrenome antes dos prenomes, de modo que SILVA, José vem antes de SILVA NETO, Roberto;
  - desempate por ano e título, sem ano por último (D-M4-05);
  - sufixos a, b para mesmo autor e ano (D-M4-03).

**Testes:** `tests/bibliografia-referencias.test.ts`, com 32 casos. Os 9 exemplos de livro das p. 50–53 do Manual saem iguais, com o destaque conferido. Também cobre autores com sufixo de parentesco, meses, ano incerto, avisos, pureza, ordenação e sufixos.

**Limitações e escolhas provisórias**
- Faltam campos no modelo para coleção ou série (RN-194) e para "Título original" (RN-204). O exemplo BAUMAN sai sem o título original. Esses campos entram com o cadastro (M4-T06), por adendo aditivo.
- Título iniciado por artigo ("OS PERIGOS", PF-09 f): só a primeira palavra sobe.
- Plural de (ed.) e (comp.): o Manual não dá, e fica no singular.
- Sem local e sem editora juntos sai "[S. l.]: [s. n.]". A forma combinada da NBR 6023 não está no projeto (D-M4-07).
- Posição de *E-book* junto com "Disponível em": não há exemplo com os dois, e o *E-book* vai por último.
- A opção "listar todos os autores" (C-B12) existe no formatador. A ligação ao perfil fica para o M4-T05.

**Verificação (2026-11-07)**
- `npm run verificar` passou, com 1517 testes. `test:externos` passou, com 27 testes.
- Na primeira rodada, `tests/recuperacao.test.ts` (R-M2-09) falhou. A data fixa do teste, 2026-10-30, venceu os 7 dias de Versões descartadas em 2026-11-06. O código não regrediu: o teste passou a usar uma data de dois dias atrás.
- No `verificar:tudo`, 20 de 21 E2E passaram. O de desempenho mediu pico de memória de 814 MB, com meta abaixo de 800. Repetido sozinho duas vezes, passou com 781 e 775 MB. A interface não importa `bibliografia`. É a instabilidade da medida do R46, e a folga ficou pequena.
- `npm audit` mostra 7 avisos moderados novos (`minimatch`, `fast-uri`), todos na cadeia do `electron-builder`. Com `--omit=dev` dá 0 vulnerabilidades, e ficam no R35.
