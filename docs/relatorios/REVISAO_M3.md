# Revisão de segurança, qualidade e fidelidade normativa — fechamento do marco M3

- **Data:** 2026-11-05
- **Escopo:** commits `d48ad07` (M3-T01) a `da73b81` (M3-T11), todos feitos sem revisão independente (`M3_RELATORIO_MARCO.md`).
- **Executado por:** dois revisores independentes, só leitura, rodados como agentes gerais em paralelo:
  - segurança, integridade e qualidade, seguindo `.claude/agents/revisor-seguranca.md`;
  - fidelidade normativa do perfil e do motor, seguindo `.claude/agents/especialista-normas.md`, sem editar a matriz.
- **Correções, reverificação e consolidação:** sessão principal.
- **Skill:** `revisao-seguranca-qualidade`.

## Resumo

| Revisão | Crítica | Alta | Média | Baixa | Info |
|---|---|---|---|---|---|
| Segurança e integridade (R-M3) | 0 | 0 | 2 (1 é hipótese) | 4 | 6 |
| Normativa (N-M3) | 0 | 1 | 4 | 5 | 3 |

- **Corrigidos nesta tarefa:** o achado Alto (N-M3-01), o Médio verificado (R-M3-01) e dois menores (R-M3-02, R-M3-08).
- **Decididos pelo usuário em 2026-11-05** ("pode seguir", aceitando as recomendações) e feitos: N-M3-02 a 05 e R-M3-06.

## Comandos executados (em `app/`)

| Comando | Resultado |
|---|---|
| `npm run verificar:tudo` (1ª rodada, antes das correções, junto com os revisores) | Unidade: 1454/1454. **Falhou em `test:externos`:** exportar 150 páginas levou 8,4 s, 10,7 s e 10,2 s (meta < 10 s). `build` e E2E não rodaram |
| `npm run medir`, sozinho, depois dos revisores | Passou: 6,7 s, 9,1 s e 8,7 s. CPU da máquina em 40% com outros programas abertos |
| `npx vitest run` depois das correções | 1457/1457 |
| Mutação do R-M3-01 (contador global de volta) | O teste novo falhou como esperado. O código foi restaurado |
| `npm audit --audit-level=high` (revisor) | 0 achados altos ou críticos; 7 moderados, todos na cadeia do `electron-builder` |
| `npm audit signatures` (revisor) | 391 assinaturas verificadas, 101 atestados |
| Ficha da Fig. 6 exportada e convertida no LibreOffice | O texto inteiro coube na caixa de 12,5 × 7,5 cm. O LibreOffice ignora `vAlign=bottom` da seção e põe a ficha no alto da página |
| `npm run verificar:tudo` (2ª rodada, com as correções) | **Passou:** 1457/1457, externos 27/27, E2E 21/21 |

## Achados corrigidos

| ID | Sev. | Problema | Correção |
|---|---|---|---|
| N-M3-01 | **Alta** | A ficha catalográfica saía em pé, com 7,5 cm de largura e 12,5 cm de altura. O Manual (Fig. 6, p. 35) cota 7,5 cm na vertical e 12,5 cm na horizontal, e a matriz (RN-136) já pedia altura ≈ 4252 e largura ≈ 7087 twips. Dois testes e os 6 instantâneos fixavam o erro. [VERIFICADO na imagem da p. 35] | `perfil.json`: largura 12,5 e altura 7,5. Testes do motor e do exportador corrigidos, com a figura citada no nome. Instantâneos regenerados (só as medidas da ficha mudaram) |
| R-M3-01 | Média | O nome do conjunto da cópia aberta usava um contador global, somado também em cada oferta e em cada versão listada. Passando de 99, o nome ficava inválido no `RE_RESERVADO` e a cópia ficava sem instantâneo. Na prática, isso desfazia a correção do R-M2-04 depois de uso normal. [VERIFICADO] | `abrirCopia` procura uma ordem de 1 a 99 no mesmo segundo. `nomeConjuntoReservado` recusa ordem fora da faixa. Se não sobrar nome livre, a cópia não abre e aparece uma mensagem clara. Teste: 110 listagens e depois o instantâneo tem de dar `ok` |
| R-M3-02 | Baixa | A cópia aberta e a queda reservada dividiam o espaço de nomes `id~carimbo-N`. Duas cópias abertas no mesmo segundo também podiam cair no mesmo conjunto, porque a pasta só nasce no primeiro instantâneo | Sufixo `-cN` exclusivo da cópia aberta, aceito pelo `RE_RESERVADO`. Ao escolher o nome, contam também os conjuntos já dados a outras cópias abertas. Teste com duas cópias |
| R-M3-08 | Info | Comentário de `PERMITIDAS` estava em cima de `FORA_DO_PACOTE` (`empacotamento/terceiros.cjs`) | Comentário no lugar certo |

## Achados abertos

### Normativos

**Atualização 2026-11-05.** O usuário aceitou as recomendações. Os quatro Médios foram feitos sem mudar a aparência do documento: os instantâneos de XML não mudaram.

- **N-M3-02:** RN-313, provisória; banca centralizada.
- **N-M3-03:** RN-314, provisória. O motor passa a ler do perfil as distribuições da capa e da folha de rosto.
- **N-M3-04:** RN-315, provisória, com aviso `ROTULO_PROVISORIO` ao exportar.
- **N-M3-05:** travessão no parâmetro `marcadorSubalinea` (D-M3-10). O exportador não tem mais o sinal fixo.

As decisões são a D-M3-10 a 12 na matriz.

| ID | Sev. | RN | Problema | Recomendação |
|---|---|---|---|---|
| N-M3-02 | Média | RN-144 | A folha de aprovação sai centralizada como regra CONFIRMADA. O alinhamento só aparece no desenho da Fig. 7; a anotação da p. 37 está cortada, e a matriz manda o caso para PF-04 | Manter centralizado como provisório PENDENTE-FONTE, com aviso, como o RN-125 da capa |
| N-M3-03 | Média | — (cita RN-067/068) | A folha de rosto sai com distribuição vertical fixa no código (`motor.ts:359`), sem RN própria | Mesmo tratamento do RN-125: parâmetro provisório no perfil |
| N-M3-04 | Média | RN-158 / PF-06 | "Palabras clave" e "Mots-clés" estão fixos no código como definitivos. O Manual só mostra "Keywords:" | Passar para o perfil como provisórios, com aviso |
| N-M3-05 | Média | RN-026 | A subalínea usa travessão "–" fixo no código. O texto do Manual diz "travessão", mas o exemplo da p. 16 usa hífen, e não há decisão registrada | Decidir o sinal e levá-lo para o perfil |
| N-M3-06 | Baixa | RN-027 | O traço da subalínea fica a 2,25 cm. No exemplo, ele fica alinhado ao texto da alínea, a cerca de 2,0 cm | Considerar 2,0 cm ao confirmar os valores provisórios |
| N-M3-07 | Baixa | RN-033 | 18 pt antes e depois de cada título: dois títulos seguidos poderiam somar duas linhas | **Refutado no Word 16 (2026-11-05, automação COM).** Título 2 seguido de título 3: 39 pt entre os topos (linha de 21 pt + 18 pt); título seguido de texto: 38,4 pt. O espaço não dobra |
| N-M3-14 | Baixa | RN-008, D-M3-02 | [VERIFICADO no Word 16] O primeiro título da parte textual começa 18 pt abaixo da margem (topo a 103,2 pt), e os capítulos seguintes começam na margem (85,2 pt). O Word mantém o espaço antes depois de uma quebra de seção e o descarta depois de uma quebra de página | Aberto. Uniformizar no M6: sem espaço antes no título que abre página, ou o mesmo nos dois casos |
| N-M3-08 | Baixa | RN-171 | O "justificado" da anotação da Fig. 16 não está no sumário | Já previsto em PF-08 e no M6 |
| N-M3-09 | Baixa | RN-140/143 | Redação fixa ("Data de aprovação:", "Banca examinadora") difere em detalhe da Fig. 7 (exemplo) | Uniformizar com a figura |
| N-M3-10 | Baixa | RN-034 | O estilo das referências não separa uma referência da outra por linha simples (2.6 f) | Corrigido no M4-T05 (RN-177, `w:after=240`) |
| N-M3-11 | Info | RN-151 | O título do resumo vale, por extensão, para os pós-textuais sem indicativo | Anotar a extensão na matriz |
| N-M3-12 | Info | RN-237 | Entrelinha da identificação do apêndice e página nova a cada apêndice sem RN | Registrar como PENDENTE-FONTE ou decisão |
| N-M3-13 | Info | RN-156 | "Palavras-chave:" sai sem negrito; as Fig. 10 e 11 (exemplo) mostram negrito | Decisão editorial |

### Segurança e integridade

| ID | Sev. | Problema | Situação |
|---|---|---|---|
| R-M3-11 | Média, se confirmada | [HIPÓTESE] Ao recuperar uma queda sem aceitar o arquivo, a cópia usa o conjunto da oferta, que pode ser o do próprio id. Se o arquivo verdadeiro desse id for aberto e salvo em seguida, pode apagar os instantâneos da cópia | Aberto: reproduzir com teste no próximo incremento que mexer na recuperação |
| R-M3-03 | Baixa | Uma cópia de um trabalho aberto e ainda sem instantâneo abre: a recusa "já aberto" só vale depois do primeiro instantâneo. O relatório do M3-T09 dizia o contrário | Aberto. O texto do relatório foi corrigido |
| R-M3-04 | Baixa | O timeout, a queda e a mensagem fora do protocolo do processo utilitário não têm teste. Um `fork` que lança fica só para o `blindar` | Aberto (engenheiro-qualidade) |
| R-M3-05 | Baixa | Na 21ª substituição do mesmo nome em 7 dias, o original não é guardado, e nada aparece na tela | Aberto |
| R-M3-06 | Info | Exportar por cima de um `.docx` deixa um `.docx.bak` permanente na pasta do usuário | **Feito (2026-11-05):** `gravarExportacao` grava sem `.bak`, por decisão do usuário. Teste com mutação |
| R-M3-07 | Info | Versões descartadas e cópias de segurança dividem o mapa de identificadores | Aberto; só muda o nome exibido |
| R-M3-09 | Info | O teste da fumaça confere uma string literal do código | Aceito |
| R-M3-10 | Info | 7 moderados do `npm audit`, só no empacotador | Acompanhar o `electron-builder` |
| R-M3-12 | Info | [HIPÓTESE] Se o Word se ligar a uma instância já aberta, `conferir-no-word.ps1` fecharia documentos sem salvar | Aberto: guarda `Documents.Count` antes de usar |
| R-M3-13 | Info | Exportar 150 páginas leva de 4,3 a 10,7 s conforme a carga da máquina (na reverificação, 4,3–4,9 s); o teto é 10 s. O tempo é quase todo da montagem do ZIP pela `docx` (motor: até 5 ms) | Aberto: medir no utilitário e procurar o custo no M6 |
| R-M3-14 | Info | O LibreOffice ignora o alinhamento vertical da seção: capa, rosto e ficha ficam no alto da página nele. O Word respeita | Limitação externa; anotar no guia do usuário |

## Conferido e correto

- **Exportação:**
  - O renderizador nunca escolhe o caminho: o diálogo roda no principal e só o nome volta.
  - Entrada validada por remetente, argumentos, pacote, fonte e extensão.
  - Uma exportação por vez, em processo utilitário com prazo e resposta validada.
  - Logs só com código de erro.
- **Fumaça:** só com `isPackaged`, marca no ASAR e integridade do ASAR ligada.
- **Sobre:** texto como React em `<pre>`; CSP sem mudança.
- **Rede e HTML perigoso:** nenhum `fetch`, XHR, WebSocket, `eval` ou `innerHTML` novo.
- **Licenças:** dependências de produção novas todas MIT. LibreOffice com perfil próprio; o validador .NET usa `--locked-mode`.
- **Perfil:**
  - Cerca de 62 das 84 regras e os 19 parâmetros conferidos na página.
  - Regras gerais, títulos de 1 a 5, paginação, capa, rosto, aprovação, dedicatória, resumos e pós-textuais conferem.
  - O exportador converte sem alterar valor (cm → twip × 567, pt → meio-ponto × 2, 1,5 → 360).

## Não verificado

- Conferência manual no Word (DOC-08), que depende do usuário.
- Não conferidos: RN-139, RN-230 e RN-238 em detalhe, as listas da p. 42–43 e a presença de elementos fora da monografia.
- R-M3-11 e R-M3-12 não foram reproduzidos.
- Exportação de 150 páginas no processo utilitário.
- Avisos do `docx` 9.15.1 em fontes primárias: sem consulta à rede; o `npm audit` nada aponta.

## Reverificação (2026-11-05)

`npm run verificar:tudo` passou com as correções:

| Parte | Resultado |
|---|---|
| Unidade | 1457/1457 |
| `test:externos` (OOXML, LibreOffice, Word, medição) | 27/27 |
| Exportar 150 páginas | 4,3 s, 4,9 s e 4,3 s |
| E2E | 21/21 |
| Documento de 150 páginas aberto | abrir 1051 ms; tecla p95 8 ms; memória de pico 762 MB |

As medidas da exportação voltaram aos valores do M3-T11 com a máquina menos carregada. Isso confirma que o R-M3-13 é sensibilidade à carga, não regressão.
