# Estado do projeto

> Fonte única de verdade sobre o andamento. Atualizado pela skill `fechamento-de-tarefa` ao fim de
> cada tarefa. Lido no início de toda sessão (regra do `CLAUDE.md`).

**Última atualização:** 2026-10-16 — Etapa 4 concluída; ADR-0003 a 0006 aceitos.
**Etapa atual:** Etapa 5 — Implementação, marco M1 (`PENDENTE`).

## Etapas

| Etapa | Status | Relatório |
|---|---|---|
| 0. Preparação do kit | CONCLUÍDA | `docs/relatorios/RELATORIO_VALIDACAO_KIT.md` |
| 1. Inventário | CONCLUÍDA | `docs/relatorios/ETAPA1_INVENTARIO.md` |
| 2. Auditoria | CONCLUÍDA | `docs/relatorios/ETAPA2_AUDITORIA.md` |
| 3. Análise normativa | CONCLUÍDA (312 RN: 283 CONFIRMADA, 5 AMBÍGUA, 24 PENDENTE-FONTE, 0 CONFLITO) | `docs/relatorios/ETAPA3_ANALISE_NORMATIVA.md` |
| 4. Planejamento arquitetural | CONCLUÍDA (ADR-0003 a 0006 aceitos) | `docs/decisoes/ADR-0003-tecnologia-do-aplicativo.md`, `docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md` |
| 5. Implementação (M1–M7) | PENDENTE | — |
| 6. Testes e validação | PENDENTE | — |
| 7. Estabilização | PENDENTE | — |

Status possíveis: `PENDENTE`, `EM ANDAMENTO`, `AGUARDANDO USUÁRIO`, `CONCLUÍDA`.

## Próximo passo
Executar `/iniciar-projeto` → Etapa 5, incremento **M1-T01** (esqueleto `app/` com Electron 44 + electron-vite +
React 19 + TypeScript; tarefas em `docs/PLANO_DE_IMPLEMENTACAO.md`). **Informar antes:** `npm install` local em
`app/` (~300–500 MB em `node_modules`, estimativa). Agente `arquiteto-software`.

## Pendências do usuário
- Nenhum material ausente (Etapa 1: 14/14 itens presentes, SHA-256 registrados no inventário).
- **LibreOffice:** instalado em `C:\Program Files\LibreOffice\program\soffice.exe` (fora do PATH);
  usado na Etapa 2 para converter DOCX→PDF [VERIFICADO 2026-10-15].
- (Opcional, recomendado antes do M3) Abrir `analise/poc-docx/poc_final.docx` no Microsoft Word e informar se
  aparece aviso de reparo, pergunta de atualizar campos ou diferença em relação a `analise/poc-docx/pdf/poc_final.pdf`.
- (Opcional) Abrir `analise/amostras/linha_base_tcc.docx` no Microsoft Word e informar se aparece aviso
  de reparo ou diferença em relação ao PDF do LibreOffice.

## Instruções para etapas futuras
- Insumos da Etapa 3 em `analise/` (recriáveis): `normas_txt/` (`pdftotext -enc UTF-8 -layout` + marcadores
  "=== PDF p.N ==="), `modelos_docx/` e `modelos_txt/` (LibreOffice), `etapa3/` (parciais e `mapa_ids.txt`).
- Página IBGE: impressa = PDF − 1 no corpo; no Anexo B a diferença muda. A p. 18 impressa só existe como imagem.
- Etapa 4: cada conflito decidido vira parâmetro de perfil ("UFT 2022"), não constante no código.
- PoCs da Etapa 4 (recriáveis, ignoradas pelo git): `analise/poc-docx/` (`gen.js`, `verificar.py`,
  `comparar_sumario.py`, `RESULTADO.md` com contornos do `docx` 9.11.0 e contrato motor → exportador) e
  `analise/poc-ui/` (protótipo, `tokens.css` da paleta A, `contraste.py`, `teste_teclado.mjs`, `PROPOSTA.md`).
  O M1-T10 parte de `analise/poc-ui/`; o M3 parte de `analise/poc-docx/`.
- Runtime: seguir o checklist C-1 a C-22 de `docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md`; Electron sempre numa
  das 3 majors suportadas (R20).

## Decisões aguardando o usuário
- (Antes do M2) ADR do editor de texto rico (recomendação do `especialista-interface`: TipTap só com núcleo MIT
  ou ProseMirror puro) e da biblioteca de componentes (React Aria Components ou Radix) — técnico, conferir versões.
- (M1-T10) Itens `[PROPOSTA]` do layout: botões da barra superior, visor, menus/abas, capa em miniatura, tema escuro.
- (M5) Margens da seção em paisagem: sem RN no Manual; decisão editorial.
- (Etapa 7) Assinatura de código: certificado OV, MSIX na Microsoft Store ou sem assinatura.
- (Etapa 5, antes de implementar a regra) 5 ambiguidades remanescentes: RN-025 (letras dobradas), RN-033
  (linha em branco após subtítulo), RN-073 (numeração nos pós-textuais), RN-085 (pontuação final da citação),
  RN-108 (alinhamento da equação).
- (Etapa 3, sem prazo) Fornecer trechos de normas ABNT/CONMETRO ou orientação da UFT para as 43 perguntas de fonte
  (P-01–P-18, PF-01–PF-15, P-C1–P-C10; texto exato no relatório da Etapa 3). P-C1–P-C5, P-C10, C-B10 já têm
  valor de perfil decidido; o que falta é a fonte para torná-los definitivos.

## Registro de sessões
| Data | Etapa | Resumo |
|---|---|---|
| 2026-10-12 | 0 | Kit criado e validado (estrutura, formatos, referências, checksums). Ver relatório de validação. |
| 2026-10-12 | 0 | kit-1.1.0: Norma Tabular do IBGE como fonte oficial de tabelas; referência de layout iTunes com pequi (`docs/REFERENCIA_DE_LAYOUT.md`); materiais do usuário registrados no inventário. |
| 2026-10-15 | 1 | Inventário: 14/14 itens presentes, checksums conferidos/registrados; sistema original extraído em `analise/`; ambiente verificado (LibreOffice ausente); `git init` + commit inicial `acc4f73` (autorizado); `.gitattributes` protege `materiais/`. |
| 2026-10-15 | 2 | Auditoria: 4 agentes em paralelo (somente leitura); DOCX de linha de base gerado por harness Node com os scripts originais e convertido em PDF no LibreOffice; O-1 a O-8 confirmadas; defeitos E-1 a E-8 (citações somem do DOCX, pré-textuais sem quebra, recuo 1,27 cm); riscos S-1 a S-14; 22 regras candidatas (CA-01 a CA-22). Harness em `analise/` (ignorada pelo git; recriável a partir do relatório). |
| 2026-10-15 | 3 | Análise normativa: 3 frentes do `especialista-normas` em paralelo (Manual p. 1–29, p. 30–73, IBGE); integração e renumeração pela sessão principal; matriz com 312 RN (245 CONFIRMADA, 28 AMBÍGUA, 23 PENDENTE-FONTE, 16 CONFLITO); semente revisada (11 correções); 20 conflitos para o usuário, 7 resolvidos com registro; amostragem > 30% por frente + conferência da sessão principal (Manual p. 17–20, IBGE p. 18). |
| 2026-10-15 | 3 | Decisões do usuário: todas as recomendações aceitas; escolhas próprias: separador de milhares = ponto (RN-261), referência de monografia "Universidade, Programa" (RN-206), apêndices/anexos com título geral centralizado e identificação à esquerda (RN-237). 46 linhas da matriz atualizadas; 0 CONFLITO; Etapa 3 CONCLUÍDA. Sem commit (aguarda autorização). |
| 2026-10-15/16 | 4 | Planejamento arquitetural: 4 agentes em paralelo (arquiteto, documento, segurança, interface), interrompidos por limite de uso e retomados. Comparação de 4 alternativas (Electron 83,0; D web 76,8; .NET 74,6; Tauri 73,6). PoC DOCX `docx` 9.11.0: 8 OK + 2 PARCIAL com contorno, 60/60 verificações de XML, sumário 52/52 páginas = PDF (reexecutado pela sessão principal). Protótipo de UI com 3 paletas (138 pares de contraste OK; 12/12 testes de teclado). Revisão de segurança com checklist C-1..C-22 e medições (EPERM no rename; 1.ª conversão LibreOffice falha). Decisões do usuário: Electron; paleta A; autosave no arquivo ~30 s; sumário estimado + Word recalcula; `.bdp` em Documentos; importador antigo após M7; assinatura na Etapa 7; LanguageTool opcional desligado; MVP só DOCX. ADR-0003..0006 ACEITOS; riscos R20–R33; plano M1-T01..T15. Sem commit (aguarda autorização). |
