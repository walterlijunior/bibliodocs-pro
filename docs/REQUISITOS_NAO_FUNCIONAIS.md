# Requisitos não funcionais

Metas numéricas marcadas `[META]` são propostas iniciais; serão confirmadas ou ajustadas na Etapa 4
com medições reais e registradas em ADR.

| ID | Categoria | Requisito | Verificação |
|---|---|---|---|
| RNF-01 | Plataforma | Windows 10 (1809+) e 11, x64, como alvo principal; sem exigir privilégios de administrador para usar | Teste de instalação limpa (Etapa 7) |
| RNF-02 | Offline | Todas as funções essenciais funcionam sem internet | Teste com rede desligada |
| RNF-03 | Privacidade | Trabalhos e dados do autor ficam locais; nenhuma telemetria por padrão; funções on-line opcionais, avisadas e desligadas por padrão | Revisão de segurança (busca por chamadas de rede) |
| RNF-04 | Integridade | Salvamento atômico, salvamento automático, recuperação após encerramento inesperado, backup | Teste: encerrar o processo durante a edição e reabrir |
| RNF-05 | Compatibilidade de saída | DOCX abre sem reparo no Microsoft Word (versão atual) e no LibreOffice (versão atual) | Regressão documental + verificação manual registrada |
| RNF-06 | Desempenho | `[META]` Abrir projeto de 150 páginas em < 3 s; digitação sem atraso perceptível (< 50 ms por tecla); exportar DOCX de 150 páginas em < 10 s | Medição com o "documento difícil" do corpus |
| RNF-07 | Memória | `[META]` < 800 MB de RAM com o documento de 150 páginas aberto | Medição |
| RNF-08 | Instalador | `[META]` Instalador < 200 MB; instalação por usuário; desinstalação limpa | Etapa 7 |
| RNF-09 | Acessibilidade | Navegação por teclado; contraste WCAG 2.2 AA; escala 125%/150% | Roteiro de acessibilidade |
| RNF-10 | Idioma | Interface e mensagens em português do Brasil; formatos numéricos e datas pt-BR | Revisão de textos |
| RNF-11 | Rastreabilidade | 100% das regras de formatação com `RN-xxx` e fonte | Teste automatizado sobre o perfil de regras |
| RNF-12 | Manutenibilidade | Módulos com contratos; regras em dados; cobertura de testes `[META]` ≥ 80% no motor normativo, bibliografia e exportação | Relatório de cobertura |
| RNF-13 | Extensibilidade | Novo perfil institucional sem alterar código (apenas dados) | Teste com perfil fictício |
| RNF-14 | Segurança | Runtime com isolamento (sem acesso direto do conteúdo ao sistema), dependências sem vulnerabilidade Crítica/Alta conhecida, atualizações assinadas (se houver auto-update) | Revisão de segurança |
| RNF-15 | Licenças | Dependências com licenças compatíveis com distribuição gratuita do app; lista de terceiros no "Sobre" | Revisão de licenças |
| RNF-16 | Migração | Projetos do formato anterior abrem na versão nova (migração testada) | Teste com fixtures de cada versão de formato |
| RNF-17 | Imagens | `[META]` Aviso para figura com resolução efetiva < 150 ppi no tamanho impresso | Teste unitário |
| RNF-18 | Documentação | README do app, guia de instalação e CHANGELOG atualizados a cada entrega | Skill `fechamento-de-tarefa` |
