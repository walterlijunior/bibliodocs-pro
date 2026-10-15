# Estado do projeto

> Fonte única de verdade sobre o andamento. Atualizado pela skill `fechamento-de-tarefa` ao fim de
> cada tarefa. Lido no início de toda sessão (regra do `CLAUDE.md`).

**Última atualização:** 2026-10-15 — Etapa 1 concluída.
**Etapa atual:** Etapa 2 — Auditoria do sistema existente (`PENDENTE`).

## Etapas

| Etapa | Status | Relatório |
|---|---|---|
| 0. Preparação do kit | CONCLUÍDA | `docs/relatorios/RELATORIO_VALIDACAO_KIT.md` |
| 1. Inventário | CONCLUÍDA | `docs/relatorios/ETAPA1_INVENTARIO.md` |
| 2. Auditoria | PENDENTE | — |
| 3. Análise normativa | PENDENTE (matriz semente com RN-001 a RN-017) | — |
| 4. Planejamento arquitetural | PENDENTE | — |
| 5. Implementação (M1–M7) | PENDENTE | — |
| 6. Testes e validação | PENDENTE | — |
| 7. Estabilização | PENDENTE | — |

Status possíveis: `PENDENTE`, `EM ANDAMENTO`, `AGUARDANDO USUÁRIO`, `CONCLUÍDA`.

## Próximo passo
Executar `/iniciar-projeto` → Etapa 2 (auditoria do sistema existente extraído em
`analise/sistema_original_extraido/tcc-uft/`, skill `auditoria-sistema-existente`).

## Pendências do usuário
- Nenhum material ausente (Etapa 1: 14/14 itens presentes, SHA-256 registrados no inventário).
- **LibreOffice:** o usuário decidiu (2026-10-15) instalá-lo ele mesmo via `winget`. Conferir com
  `scripts\verificar-ambiente.ps1` antes da Etapa 3.

## Instruções para etapas futuras
- **Etapa 3, primeiro passo:** converter os 7 `.doc` (6 modelos UFT + guia FURB) para `.docx` em
  `analise/modelos_docx/` com `soffice --headless --convert-to docx --outdir analise/modelos_docx <arquivo>`.
  Se `soffice` não estiver no PATH, usar `C:\Program Files\LibreOffice\program\soffice.exe`.
  Os originais em `materiais/` não são tocados.

## Decisões aguardando o usuário
- (Etapa 3) Conflito C-01: qual edição da NBR 10520 seguir nas citações (2002, citada no Manual UFT
  2022, ou 2023). Será apresentado com opções e efeito visível.

## Registro de sessões
| Data | Etapa | Resumo |
|---|---|---|
| 2026-10-12 | 0 | Kit criado e validado (estrutura, formatos, referências, checksums). Ver relatório de validação. |
| 2026-10-12 | 0 | kit-1.1.0: Norma Tabular do IBGE como fonte oficial de tabelas; referência de layout iTunes com pequi (`docs/REFERENCIA_DE_LAYOUT.md`); materiais do usuário registrados no inventário. |
| 2026-10-15 | 1 | Inventário: 14/14 itens presentes, checksums conferidos/registrados; sistema original extraído em `analise/`; ambiente verificado (LibreOffice ausente); `git init` + commit inicial `acc4f73` (autorizado); `.gitattributes` protege `materiais/`. |
