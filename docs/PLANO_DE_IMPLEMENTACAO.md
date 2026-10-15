# Plano de implementação

Complementa o `PROMPT_EXECUCAO.md` (o "como trabalhar") com o "o que entregar em cada marco".
O plano será refinado na Etapa 4, depois da escolha de tecnologia; durações não são estimadas
aqui porque dependem dessa escolha e do ritmo de sessões do usuário.

## Etapas (visão geral)

| Etapa | Entrega principal | Bloqueia |
|---|---|---|
| 0. Preparação do kit | Este kit (concluída em 2026-10-12) | — |
| 1. Inventário | Inventário com status e checksums; git; sistema extraído em `analise/` | 2 |
| 2. Auditoria | `docs/relatorios/ETAPA2_AUDITORIA.md` | 4 |
| 3. Análise normativa | Matriz `RN-xxx` completa; conflitos decididos pelo usuário | M3 em diante |
| 4. Arquitetura | ADR de tecnologia; módulos; guia visual; plano detalhado de M1 | 5 |
| 5. Implementação | Marcos M1–M7 | 6 |
| 6. Testes e validação | Matriz de testes executada; relatório de limitações | 7 |
| 7. Estabilização | Instalador Windows testado; documentação de instalação | — |

As Etapas 2 e 3 podem ocorrer em paralelo (agentes diferentes, arquivos diferentes).

## Marcos da Etapa 5

### M1 — Esqueleto executável
- App abre no Windows em modo desenvolvimento com um comando documentado.
- Layout "biblioteca" (barra lateral, centro, inspetor) com tema provisório.
- Criar, salvar, abrir trabalho vazio no formato de projeto versionado.
- Suíte de testes executa (mesmo que pequena) com um comando.
**Aceite:** RF-01 parcial (criar/salvar/abrir); teste de ida e volta do arquivo passa.

### M2 — Modelo de documento e editor
- Seis tipos de trabalho com elementos e ordem da matriz; seções com numeração automática; parágrafos,
  alíneas, citação longa (bloco), notas; pré-textuais com campos.
**Aceite:** RF-02, RF-03, RF-04; testes de numeração e de elementos obrigatórios por tipo.

### M3 — Motor normativo e exportação DOCX
- Perfil "UFT 2022" com as regras `CONFIRMADA` de formatação geral; exportação DOCX com estilos e seções;
  regressão documental ativa.
**Aceite:** RF-05, RF-06; teste de propriedades normativas no DOCX passa; verificação manual no Word e
LibreOffice registrada.

### M4 — Citações e referências
**Aceite:** RF-07, RF-08; verificador de órfãs/não citadas.

### M5 — Tabelas e elementos visuais
- Estudo visual (estudo Capcom, usado só como exemplo de trabalho formatado) concluído antes da implementação.
**Aceite:** RF-09, RF-10, RF-11 (legenda/fonte/numeração).

### M6 — Sumário, listas, siglas, remissivas, pós-textuais
**Aceite:** RF-11 (remissivas), RF-12, RF-13, RF-14.

### M7 — Verificador de conformidade
**Aceite:** RF-15 com documento de teste de 10 não conformidades plantadas.

## Regras de priorização
1. Algo funcionando de ponta a ponta cedo (M1 + M3 parcial) vale mais que um módulo perfeito isolado.
2. Exportação DOCX é a saída do produto: toda funcionalidade só está pronta quando sai certa no DOCX.
3. Requisito normativo sem fonte não entra no MVP; vira pendência visível.
4. Ao fim de cada marco: skill `revisao-seguranca-qualidade` e atualização deste plano.

## Reaproveitamento esperado do sistema antigo `[HIPÓTESE — confirmar na Etapa 2]`
| Módulo antigo | Destino provável |
|---|---|
| `abnt.js` (numeração, referências, detecção de citações) | Lógica candidata para motor/bibliografia, após testes |
| `exports.js` (DOCX/PDF/ODT com docx.js/jsPDF) | Referência para o exportador; possível reaproveitamento se a pilha for JS |
| `templates.js` (TCC, consultoria, extensão) | Fonte de tipos adicionais (consultoria/extensão de Ciências Contábeis) |
| `visual-editor.js` (SWOT, gráficos, organograma…) | Candidato para elementos visuais |
| `components.js`, `app.js`, `state.js`, `storage.js` | Referência de fluxos; persistência a substituir por arquivo de projeto |
