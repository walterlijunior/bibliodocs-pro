# Política de fontes normativas

Esta política define o que pode ser tratado como regra de formatação no aplicativo e como resolver
dúvidas e conflitos. Vale para a sessão principal, todos os agentes e todas as skills.

## 1. Hierarquia de fontes

| Nível | Fonte | Uso |
|---|---|---|
| 1 | Manual de Normalização da UFT vigente fornecido em `materiais/normas/` (hoje: 2ª ed., 2022) | Fonte principal do perfil "UFT" |
| 1-T | **Normas de apresentação tabular do IBGE, 3. ed., 1993** (`materiais/normas/`) — para **tabelas**, porque o próprio Manual UFT remete a ela (p. 20, seção 2.9, e p. 43) | Fonte principal das regras de tabelas, com o mesmo peso do Manual nesse assunto |
| 2 | Norma ABNT fornecida pelo usuário (texto licenciado em `materiais/normas/` ou trecho colado na conversa, com identificação da norma, ano e seção) | Detalhar o que o Manual remete à ABNT |
| 3 | Orientação escrita da UFT (biblioteca, coordenação, programa) fornecida pelo usuário | Casos não cobertos ou atualizações |
| 4 | Modelos institucionais UFT (`materiais/modelos_uft/`) | **Exemplos**, nunca norma. Servem para comparar e encontrar casos a confirmar |
| 5 | Código do sistema antigo, trabalhos aprovados, estudo Capcom (exemplo de trabalho formatado; só a apresentação interessa, o conteúdo não), guias de outras instituições (IFPR, FURB) em `materiais/referencias_visuais/` | **Exemplos/candidatos**, nunca norma. Guias de outras instituições valem só como exemplo visual; se divergirem da UFT, vale a UFT |
| — | Memória do modelo de IA, blogs, sites de "regras ABNT", fóruns | **Não aceitos** como fonte. Podem apenas sugerir onde procurar |

## 2. Regras de uso
1. Toda regra implementada tem ID `RN-xxx` com documento, página impressa e seção.
2. Sem fonte de nível 1–3, a regra fica `PENDENTE-FONTE` e não é aplicada como definitiva.
   Se for indispensável para o produto funcionar, pode ser implementada como **configuração
   provisória visível ao usuário**, marcada como tal na interface e no relatório de conformidade.
3. Paráfrase fiel é o padrão; citação literal curta quando a redação exata importa
   (ex.: valores, pontuação). Normas ABNT são protegidas por direitos autorais: não copiar trechos
   extensos para o repositório.
4. Fato verificado (`[VERIFICADO]`, com a página conferida) é diferente de hipótese (`[HIPÓTESE]`).

## 3. Conflitos
1. **Manual × modelo institucional:** prevalece o Manual; o desvio do modelo é registrado.
2. **Manual × edição mais recente da ABNT** (ex.: NBR 10520:2002 citada no Manual × NBR 10520:2023):
   é **decisão editorial do usuário**. O `especialista-normas` apresenta: o que cada edição exige
   (com fonte disponível), o efeito visível no documento, e uma recomendação. A decisão é registrada
   na matriz (seção "Conflitos") e, se afetar a arquitetura, em ADR. O motor deve permitir a troca por
   configuração de perfil.
3. **Manual internamente ambíguo:** status `AMBÍGUA`, com as leituras possíveis; pergunta ao usuário.
4. **Tabelas:** seguem a Norma Tabular do IBGE (nível 1-T); quadros, figuras, gráficos e demais
   ilustrações seguem o Manual UFT. Se o Manual e o IBGE divergirem em algo de tabela, registre o
   conflito e pergunte ao usuário.
5. **Código antigo × Manual:** prevalece o Manual; o comportamento antigo é registrado como desvio.

## 4. Atualização de fontes
- Nova edição do Manual: nova pasta de perfil ("UFT 2026", por exemplo), sem apagar o perfil anterior;
  matriz com coluna de perfil; trabalhos antigos continuam abrindo com o perfil com que foram criados.
- Toda troca de fonte gera entrada no CHANGELOG.

## 5. Checklist antes de implementar uma regra
- [ ] A regra tem `RN-xxx` com status `CONFIRMADA`.
- [ ] A página citada foi relida nesta tarefa ou na revisão por amostragem da Etapa 3.
- [ ] Existe teste automatizado que referencia o `RN`.
- [ ] Conflitos relacionados estão resolvidos ou a regra está atrás de configuração explícita.
