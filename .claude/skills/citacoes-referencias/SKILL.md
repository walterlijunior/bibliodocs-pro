---
name: citacoes-referencias
description: Gerenciamento e validação de citações e referências bibliográficas — cadastro de obras, formatação de referências, chamadas de citação, citação direta longa, apud, et al., ordenação, detecção de citações órfãs e referências não citadas, importação BibTeX/RIS. Use em qualquer trabalho no módulo de bibliografia.
---

# Citações e referências

## Quando usar
Marco M4; correções de formato de referência; verificação citação × referência.
Agente principal: `especialista-referencias`.

## Entradas
Matriz (seções de citações e referências do Manual UFT); decisão do usuário sobre a edição da
NBR 10520 a seguir (conflito 2002 × 2023 registrado no inventário); código antigo `abnt.js`
(em `analise/`) como candidato.

## Procedimento
1. **Modelo de obra** com campos tipados (autores pessoa/entidade, título, subtítulo, edição, local,
   editora, ano, páginas, volume, número, URL, data de acesso, DOI…).
2. **Formatadores puros** (obra → texto com marcação de destaque) por tipo; regras referenciando `RN-xxx`.
3. **Chamadas de citação** como objetos ligados à obra (ID), com página/localizador e forma
   (parentética ou narrativa). Citação direta longa vira bloco com formatação própria (`RN`).
4. **Verificador:** órfãs, não citadas, ambiguidade autor-ano (sufixo a/b), divergência de grafia.
   Para texto colado/importado, a detecção heurística (como a do sistema antigo) gera **sugestões**,
   nunca vínculo automático silencioso.
5. **Ordenação** das referências conforme a matriz (alfabética pelo elemento de entrada, com regras
   de desempate registradas).
6. **Importação BibTeX/RIS:** mapear campos, listar o que não foi reconhecido.

## Saídas
Módulo de bibliografia com testes de tabela (entrada → saída esperada + fonte do esperado).

## Verificação de conclusão
- Todos os tipos suportados têm casos de teste com fonte.
- Documento de teste com 1 órfã e 1 não citada é diagnosticado corretamente.
- Tipos sem fonte normativa disponível aparecem como "não suportado" (não inventados).

## Dependências externas
Parser BibTeX/RIS pode vir de biblioteca (avaliar licença via `decisao-arquitetural`) ou ser
implementado em subconjunto simples. Sem biblioteca, suporte só cadastro manual no MVP.
