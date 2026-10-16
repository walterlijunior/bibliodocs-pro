# Migração fictícia v0 → v1 (só testes)

O formato v0 **não existe**: foi inventado para testar a cadeia de migrações do M1-T07 (ADR-0004, seção 2).
Diferenças do v0 em relação ao v1:

- `manifesto.perfil` é texto `"<id>@<versao>"` (no v1, objeto `{ id, versao }`);
- `documento.metadados.titulo` e `subtitulo` são texto simples (no v1, `Inline[]`; texto vazio vira lista vazia).

A função está em `tests/apoio/migracao-ficticia.ts`. Migrações reais seguem o mesmo padrão de pasta
`v<N>-para-v<N+1>/` com `entrada-*.json` e `saida-*.json`.
