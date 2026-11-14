# Catálogo acadêmico: dados iniciais

`catalogo-inicial.json` vem com o aplicativo (Etapa 3 da especificação de atualização). O formato é validado por
`src/dominio/esquemas/catalogo.ts` e por `tests/catalogo.test.ts`.

- **UFT:** câmpus em <https://www.uft.edu.br/campus> e cursos presenciais de graduação em
  <https://www.uft.edu.br/graduacao/cursos>, consultados em 2026-11-14. Cada registro guarda a página e a data em
  `fonte`. A página não informa o grau dos cursos: só os que têm "Licenciatura" no nome vêm com grau.
- **Fora dos dados iniciais:** programas de pós-graduação (a página dos programas monta a lista no navegador), cursos EaD,
  disciplinas e docentes. Quem usa o aplicativo acrescenta pelo catálogo; o acréscimo fica no computador
  (`%LOCALAPPDATA%\BiblioDocsPro\catalogo.json`) e não altera este arquivo.
- **USP, UnB e UFRGS:** só o nome e a sigla, sem perfil de formatação nem fonte confirmada; a tela mostra "sem fonte
  confirmada".
- **Logotipo:** nenhum vem com o aplicativo (identidade visual da instituição; o arquivo oficial do brasão da UFT é
  pendência do usuário, PF-02). Quem usa cadastra o logotipo em "Catálogo acadêmico…"; ele fica guardado no catálogo
  do computador e é copiado para o trabalho ao escolher a instituição.
