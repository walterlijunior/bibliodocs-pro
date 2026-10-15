# Matriz de riscos

Escala: Probabilidade (P) e Impacto (I) de 1 (baixo) a 3 (alto); Exposição = P × I.
Revisar ao fim de cada etapa e de cada marco.

| ID | Risco | P | I | Exp. | Mitigação | Gatilho de alerta | Dono |
|---|---|---|---|---|---|---|---|
| R01 | Regras ABNT inventadas ou lembradas de forma errada pelo modelo de IA | 3 | 3 | 9 | Política de fontes; matriz `RN` com página; `PENDENTE-FONTE`; testes citam `RN` | Regra implementada sem `RN` | especialista-normas |
| R02 | Conflito entre Manual UFT 2022 (NBR 10520:2002) e NBR 10520:2023 adotada pelo sistema antigo | 3 | 2 | 6 | Registrar conflito e pedir decisão do usuário; perfil configurável | Etapa 3 encontrar regra divergente | especialista-normas |
| R03 | Modelos institucionais com erros tomados como norma (ex.: modelo de Tese cita "grau de Mestre") | 2 | 2 | 4 | Modelos = exemplos; Manual prevalece | Regra derivada só de modelo | especialista-normas |
| R04 | DOCX gerado difere entre Word e LibreOffice ou exige reparo | 2 | 3 | 6 | Regressão documental; PoC na Etapa 4; verificação manual nos dois | Aviso de reparo; diferença visual | especialista-documento |
| R05 | Paginação/sumário com números errados (dependem do layout do editor de texto) | 3 | 2 | 6 | Campos do Word + texto inicial calculado; documentar limitação; teste via PDF opcional | Divergência de página no teste | especialista-documento |
| R06 | Alteração acidental dos originais | 1 | 3 | 3 | `materiais/` somente leitura (regra + deny); checksums no inventário | Hash divergente | sessão principal |
| R07 | Escopo grande demais para sessões curtas; contexto perdido entre sessões | 3 | 2 | 6 | Etapas pequenas; `ESTADO_DO_PROJETO.md` sempre atualizado; `/status-projeto` | Sessão termina sem registro | sessão principal |
| R08 | Agentes editando o mesmo arquivo e gerando conflito | 2 | 2 | 4 | Áreas de edição por agente; integração pela sessão principal | Dois agentes no mesmo arquivo | sessão principal |
| R09 | Tecnologia escolhida sem prova (instalador grande, DOCX ruim) | 2 | 3 | 6 | Skill `decisao-arquitetural` com PoC e critérios | ADR sem medição | arquiteto-software |
| R10 | Dependências desatualizadas/vulneráveis (ex.: Electron 28, bibliotecas copiadas em `vendor/` sem versão) | 3 | 2 | 6 | Auditoria de dependências; versões registradas; atualização planejada | Aviso de vulnerabilidade | revisor-seguranca |
| R11 | Envio de texto do usuário a serviço on-line sem consentimento (LanguageTool no sistema antigo) | 2 | 3 | 6 | Função opcional, desligada por padrão, com aviso | Chamada de rede não declarada | revisor-seguranca |
| R12 | Perda de trabalhos do usuário (IndexedDB do navegador no sistema antigo; corrupção de arquivo) | 2 | 3 | 6 | Arquivo de projeto com salvamento atômico, backup e importador do JSON antigo | Falha no teste de recuperação | especialista-documento |
| R13 | Materiais ausentes (modelos `.doc`, `.docx` Capcom) atrasam Etapas 3 e M5 | 3 | 1 | 3 | Seguir com o Manual; pendência visível; LEIA-ME com nomes exatos | Etapa 3/M5 iniciada sem eles | sessão principal |
| R14 | Ambiente Windows sem Node/Python/Git impede executar o sistema antigo ou o build | 2 | 2 | 4 | `verificar-ambiente.ps1`; pedir instalação ao usuário com justificativa | Script aponta ausência | sessão principal |
| R15 | Identidade visual remeter demais à Apple/iTunes (marca de terceiros) | 1 | 2 | 2 | Inspiração só na organização; ícones e paleta originais (pequi) | Uso de ícone/nome de terceiros | especialista-interface |
| R16 | Pasta do projeto no OneDrive/caminho longo causa travas e erros de build | 2 | 1 | 2 | Orientação no README/INSTRUCOES (usar `C:\Projetos\`) | Erros EPERM/EBUSY/caminho longo | sessão principal |
| R17 | Custo/limite de uso do Claude Code em tarefas longas | 2 | 2 | 4 | Etapas pequenas; subagentes só quando agregam; `/context` para monitorar | Sessões interrompidas por limite | usuário |
