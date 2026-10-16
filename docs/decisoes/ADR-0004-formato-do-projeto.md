# ADR-0004 — Formato do arquivo de projeto, salvamento e importação do `tcc-uft`

- **Status:** ACEITO (usuário, 2026-10-16: extensão, pasta e salvamento automático decididos).
- **Data:** 2026-10-16
- **Decisores:** agente `arquiteto-software` (proposta), com os insumos do `revisor-seguranca`; usuário (itens visíveis)
- **Etapa/Marco:** Etapa 4; implementação no M1 (formato, salvamento) e no M2 ou depois (importador)
- **Requisitos e riscos relacionados:** RF-01, RF-16, RNF-04, RNF-14, RNF-16; R12, R16, R18; S-1, S-5, S-6, S-11

## Contexto

O sistema antigo guarda os projetos no IndexedDB, preso à origem `localhost:8765`. O autosave falha em
silêncio. Não há versão de esquema nem migração. O backup JSON é importado sem validação e sobrescreve
projetos [VERIFICADO: `storage.js` 9–27 e 77–99, `state.js` 172–183; `docs/relatorios/ETAPA2_AUDITORIA.md`, S-5, S-6, S-11].

Formato do backup antigo [VERIFICADO em `analise/sistema_original_extraido/tcc-uft/src/storage.js:78` e `templates.js:194–233`]:
- envelope `{ versao: 1, exportadoEm, projetos: [...] }`;
- cada projeto tem `id`, `criadoEm`, `atualizadoEm`, `templateUsado`, `metadata` (inclui `logo` como data URL),
  `elementosPreTextuais`, `secoes` (texto puro com marcadores `[[cite:…]]`, `[[visual:…]]`, `[[nota:…]]`, `[[ref:…]]`),
  `visuais`, `referencias`, `apendices`, `anexos` e `config` (margens, fonte, `posicaoPaginacao`).

O usuário precisa:
- de um arquivo que possa copiar para outro computador (RF-01);
- de salvamento à prova de queda de energia ou encerramento forçado (RNF-04);
- de que projetos antigos abram em versões novas (RNF-16).

## Alternativas consideradas

| Critério (peso) | A. ZIP (JSON + mídias) | B. SQLite num arquivo | C. Pasta descompactada | D. JSON único com mídias em base64 |
|---|---|---|---|---|
| Arquivo único copiável (25) | 5 | 5 | 2 — o usuário pode copiar a pasta incompleta | 5 |
| Integridade com salvamento atômico (20) | 5 — grava tudo num temporário e renomeia | 4 — transações do SQLite; o arquivo `-wal` atrapalha a cópia [HIPÓTESE] | 2 — vários arquivos, sem atomicidade conjunta | 5 |
| Tamanho com imagens (15) | 5 — binário comprimido | 5 | 5 | 2 — base64 aumenta cerca de 33% |
| Segurança na leitura (15) | 4 — exige controle contra zip bomb e caminhos | 3 — arquivo SQLite malicioso; módulo nativo ou `node:sqlite` [HIPÓTESE quanto à estabilidade no Electron 44] | 4 | 4 |
| Simplicidade e depuração (15) | 4 — abre com qualquer descompactador | 2 | 5 | 5 |
| Dependências (10) | 5 — `fflate` (MIT, 0.8.3, sem dependências) | 3 | 5 | 5 |
| **Total (100)** | **94** | **77** | **69** | **85** |

## Decisão

### 1. Contêiner

Arquivo único **ZIP** com extensão sugerida **`.bdp`** ("BiblioDocs Projeto"). O nome é provisório, como o do produto.

```text
Meu TCC.bdp
├── mimetype            "application/vnd.bibliodocs.projeto+zip" (1.ª entrada, sem compressão, como ODF/EPUB)
├── manifesto.json      formato, versao_formato, app_versao, id, datas, perfil {id, versao}, tipo de trabalho, lista de mídias {caminho, sha256, bytes, tipo}
├── documento.json      modelo semântico de blocos (ADR-0005), sem números calculados nem HTML
├── bibliografia.json   obras, siglas e demais coleções do trabalho
├── ajustes.json        parâmetros de perfil sobrescritos pelo usuário (só os marcados como ajustáveis)
├── miniatura.png       capa em miniatura para a grade da biblioteca (opcional; recriável)
└── midias/<sha256>.<png|jpg>   imagens deduplicadas por hash
```

Regras do conteúdo:
- **Sem HTML em nenhum campo.** Texto rico é estrutura (`Inline[]`, ADR-0005). Isso fecha o vetor de S-1/R18.
- **Sem SVG nas mídias** no formato v1. Gráficos e diagramas gerados pelo app são guardados como **dados**
  e renderizados na exportação. Imagens do usuário em SVG são rasterizadas na importação [recomendação; o
  `especialista-elementos-visuais` pode propor SVG sanitizado em ADR próprio].
- Biblioteca ZIP: **`fflate`** 0.8.3 (MIT) [VERIFICADO `npm view fflate`, 2026-10-15]. Ela permite inspecionar o
  tamanho declarado de cada entrada antes de descomprimir [HIPÓTESE forte, a confirmar no M1-T05]. O `jszip`,
  que vem com o `docx`, continua só como dependência transitiva.

### 2. Esquema e versões

- `manifesto.json.versao_formato`: inteiro, começando em **1**. Mudanças incompatíveis incrementam o número.
  Campos opcionais novos também incrementam o número, se exigirem migração de valor.
- **JSON Schema estrito** para cada JSON do pacote (`additionalProperties: false`, tipos, enumerações e
  limites de tamanho de string e de array):
  - a fonte da verdade fica em código (`zod` 4.6.7, MIT, objetos `.strict()`) [VERIFICADO versão/licença];
  - o JSON Schema (draft 2020-12) é exportado e versionado em `app/esquemas/projeto-v1/`;
  - se a exportação do zod não for fiel [HIPÓTESE a conferir no M1-T04], inverter: JSON Schema escrito à mão
    e validado com `ajv` 8.20.0 (MIT).
- Validação **na leitura** (sempre) e **antes da escrita** (em desenvolvimento e nos testes).
- **Migrações** com a forma `migrar_N_para_N+1(json) → json`:
  - funções puras, encadeadas, cada uma com fixture de entrada e de saída esperada nos testes (RNF-16);
  - antes de migrar, a cópia original vai para os backups (seção 4).
- Arquivo com `versao_formato` **maior** que a suportada: o app **não abre para edição**. Mostra "criado por
  uma versão mais nova do BiblioDocs Pro" e oferece abrir só para leitura (R33).
- Perfil normativo referenciado por `{id: "uft-2022", versao}`. Se o app tiver uma versão mais nova do
  perfil, o verificador avisa e o usuário escolhe atualizar. Mudar o perfil muda a formatação, e isso é
  efeito visível.

### 3. Leitura segura (zip bomb, caminhos, conteúdo)

1. `fs.stat`: recusar arquivo acima do limite total. Ler o arquivo **inteiro em memória**: nunca extrair para o disco.
2. **Lista de nomes permitidos** (expressão fixa):
   - `mimetype`, `manifesto.json`, `documento.json`, `bibliografia.json`, `ajustes.json`, `miniatura.png` e
     `midias/[0-9a-f]{64}\.(png|jpg)`;
   - qualquer outro nome → recusa com relatório;
   - também são recusados nomes absolutos, com `..`, `\`, duplicados ou de diretório.
3. Limites, calibrados por medição [HIPÓTESE inicial]:

   | Limite | Valor |
   |---|---|
   | Arquivo | ≤ 1 GB |
   | Entradas | ≤ 5.000 |
   | Cada JSON descomprimido | ≤ 64 MB |
   | Cada mídia | ≤ 64 MB |
   | Soma descomprimida | ≤ 2 GB |
   | Razão de compressão por entrada | ≤ 200:1 |
   | Profundidade da árvore de blocos | ≤ 64 |

   Os limites são conferidos antes e durante a descompressão.
4. `JSON.parse` + validação de esquema. Depois, verificar o `sha256` de cada mídia contra o manifesto e a
   assinatura binária (PNG/JPEG). Mídia divergente é descartada com aviso, sem derrubar o projeto.
5. Todas as strings são texto. A interface nunca usa `innerHTML` ou `dangerouslySetInnerHTML` com dados do
   projeto (regra verificada por teste, ADR-0006).

### 4. Salvamento atômico, backup e recuperação

Quem grava é **só o processo principal** (ADR-0005), pelo serviço `persistencia`.

**Salvar** (explícito ou automático no arquivo do usuário):
1. Serializar e validar. Gerar o ZIP em memória.
2. Gravar `<nome>.bdp.tmp-<pid>-<aleatório>` **no mesmo diretório** do destino, para o `rename` não cruzar volumes.
3. `fsync` do arquivo temporário. O `fsync` do diretório não existe no Windows e não é usado ali.
4. Se o destino existe, renomear o destino para `<nome>.bdp.bak`, substituindo o `.bak` anterior.
5. Renomear o temporário para `<nome>.bdp`.
6. Os passos 4 e 5 usam **tentativas com espera crescente**: até 6 tentativas, de 50 ms a cerca de 1,6 s, para
   `EPERM`, `EBUSY` e `EACCES`.
   - O revisor de segurança **mediu `EPERM`** ao renomear sobre um arquivo aberto por outro processo.
   - Antivírus, OneDrive (R16) e indexação causam o mesmo efeito [HIPÓTESE quanto à frequência].
   - Se as tentativas se esgotam, o original continua intacto (ou o `.bak` é restaurado se o passo 5
     falhar). O temporário permanece. O usuário vê "não foi possível salvar: o arquivo está em uso por
     outro programa", com a opção "Salvar como…".
7. Indicador de estado no visor: "Salvo", "Salvando…", "Alterações não salvas" ou "Erro ao salvar". **Nenhuma falha silenciosa** (S-11).

**Salvamento automático e recuperação** (insumo do `revisor-seguranca`):
- A cada alteração, com espera de cerca de 2 s, o app grava um **instantâneo de recuperação** em
  `%LOCALAPPDATA%\BiblioDocsPro\recuperacao\<id-do-projeto>\` pelo mesmo procedimento atômico.
- A pasta é local e fora de pastas sincronizadas; guarda só o instantâneo mais recente e um anterior.
- Ao salvar no arquivo do usuário, os instantâneos daquele projeto são apagados.
- **Trava de sessão:** `%LOCALAPPDATA%\BiblioDocsPro\sessao\<id>.lock`, com PID e horário. O app tem uma
  única instância (`requestSingleInstanceLock`). Projeto já aberto por outra instância abre só para leitura.
- **Na inicialização** o app procura:
  - (a) trava órfã com instantâneo mais novo que o arquivo → "O BiblioDocs Pro foi fechado inesperadamente.
    Recuperar a versão de HH:MM?", com as opções Recuperar, Abrir o arquivo salvo e Decidir depois;
  - (b) **temporários órfãos** `*.bdp.tmp-*` ao lado dos projetos da biblioteca:
    - se o original é válido, o temporário vai para a recuperação e é apagado depois de 7 dias;
    - se o original falta ou é inválido e o temporário é válido, o app oferece restaurar o temporário;
  - (c) `.bak` válido com original inválido → oferecer restaurar o `.bak`.
- **Backups rotativos:** a cada salvamento explícito, no máximo um a cada 10 min, o arquivo anterior é
  copiado para `%LOCALAPPDATA%\BiblioDocsPro\backups\<id>\AAAAMMDD-HHMMSS.bdp`. Ficam os 10 mais recentes
  mais 1 por dia dos últimos 7 dias [HIPÓTESE de política; ajustável]. Antes de qualquer migração, um backup obrigatório.
- **Excluir trabalho:** confirmação e envio para a **Lixeira do Windows** (`shell.trashItem`), nunca exclusão definitiva.

**Comportamento do salvamento automático no arquivo do usuário**: visível, decide o usuário.
- (1) **Recomendado:** além da recuperação, o app salva no arquivo do usuário de forma automática, cerca de
  30 s depois da última alteração, ao trocar de trabalho e ao fechar. O usuário nunca "perde por não ter
  salvado". Ctrl+S força o salvamento imediato.
- (2) Modelo do Word: o arquivo só muda com Ctrl+S; o automático vai só para a recuperação.
- A arquitetura suporta as duas opções; muda um parâmetro das preferências.

### 5. Biblioteca

- Pasta padrão sugerida: `Documentos\BiblioDocs Pro\Trabalhos\` (visível; o usuário pode escolher outra).
  O app avisa se a pasta estiver no OneDrive (R16).
- Índice da biblioteca (títulos, tipo, datas, miniatura): `%LOCALAPPDATA%\BiblioDocsPro\biblioteca.json`.
  É **cache** recriável a partir dos `.bdp`; o arquivo do projeto é a fonte da verdade.

### 6. Importador do backup JSON do `tcc-uft` (RF-16; S-5, S-6, R12)

| Passo | Regra |
|---|---|
| Entrada | Arquivo `.json` ≤ 100 MB [HIPÓTESE], lido no processo principal |
| Validação | Esquema **tolerante para leitura**: campos desconhecidos são **ignorados e listados no relatório**, nunca copiados. Tipos conferidos campo a campo; envelope `versao: 1` obrigatório; projeto sem `secoes`/`metadata` válidos é recusado individualmente, não o lote inteiro |
| Prévia | Lista dos projetos (título, tipo, datas, número de seções, referências e visuais) com caixa de seleção. **Nada é gravado antes da confirmação** |
| Destino | Cada projeto vira **um `.bdp` novo**, com id novo e o id antigo guardado em `manifesto.origem`. **Nunca sobrescreve** um trabalho existente (corrige S-5) |
| Transação | Todos os projetos selecionados são convertidos e validados em memória. A gravação usa o salvamento atômico, um por um. Uma falha em um não afeta os outros e aparece no relatório |
| Conversão de texto | Marcadores `[[cite:refId:forma:pagina]]`, `[[nota:id]]`, `[[visual:id]]`, `[[ref:secaoId]]` → inlines estruturados (ADR-0005). Marcador malformado (D5) → texto literal com aviso. `_itálico_` só fora de URLs e identificadores; quebra de linha simples preservada |
| Referências | Os campos são mapeados para o esquema de `Obra`. A string HTML gerada pelo `abnt.js` **nunca é importada**: a referência é reformatada pelo motor novo |
| Imagens | Data URLs aceitos só como `image/png` e `image/jpeg`, com assinatura binária conferida. `image/svg+xml` e outros tipos são **recusados** e listados (vetor de S-1). Logotipo da capa: idem |
| `config` antigo | Margens, fonte, recuo e posição da paginação **não** viram formatação do projeto: a formatação vem do perfil (R19). Valores diferentes do perfil aparecem no relatório |
| Relatório | O que foi importado, ignorado, convertido com perda e as pendências, em pt-BR; salvo com o projeto e exibido ao fim |

Quando implementar: depende do modelo de blocos (M2). **Recomendação:** antecipar para o fim do M2 se o
usuário tiver trabalhos no sistema antigo (R12). Caso contrário, manter após o M7, como em RF-16.

## Consequências

- **Positivas:**
  - Arquivo único, portátil e inspecionável.
  - Corrupção por queda de energia evitada por construção.
  - Recuperação após encerramento inesperado.
  - Migrações testadas.
  - Leitura resistente a arquivos maliciosos.
  - Projetos antigos trazidos sem sobrescrever nada.
- **Negativas / custos:**
  - Cada salvamento regrava o ZIP inteiro. Com mídias grandes isso pode levar centenas de ms [HIPÓTESE; medir
    com 150 páginas e 50 figuras]. Se passar de 1 s, gravar as mídias sem recompressão (`level: 0` para JPEG/PNG).
  - Duas cópias extras locais (recuperação e backups) ocupam espaço em `%LOCALAPPDATA%`.
- **O que muda:**
  - Módulo `persistencia` no processo principal (ADR-0005).
  - Esquemas em `app/esquemas/`.
  - Fixtures de formato por versão.
  - Casos FUN-01 e RNF-04 na matriz de testes.

## Critério de reversão

- Salvamento medido acima de 2 s em projeto típico → separar as mídias (ZIP sem compressão para `midias/`) ou avaliar SQLite (alternativa B).
- `EPERM` persistente em pastas sincronizadas mesmo com as tentativas → mudar a estratégia para gravar
  primeiro na recuperação e copiar para o destino quando o arquivo for liberado.
- Necessidade de edição colaborativa ou de histórico detalhado → reavaliar o contêiner.

## Verificação

Testes de M1-T04 a M1-T07 e M1-T12 em `npm run verificar` (ADR-0006):
- ida e volta idêntica;
- arquivo com nome proibido, `..`, zip bomb sintético e JSON com campo extra → recusados;
- falha simulada entre os passos 4 e 5 → original ou `.bak` íntegro;
- `EPERM` simulado → tentativas e mensagem;
- temporário órfão → oferta de recuperação;
- versão de formato futura → abertura só para leitura.

E2E: matar o processo durante a edição e reabrir, oferecendo a recuperação (RNF-04).


## Decisões do usuário (2026-10-16)
- Extensão `.bdp`; pasta padrão `Documentos\BiblioDocs Pro\Trabalhos\` (configurável).
- Salvamento automático: opção (1) — grava no arquivo do usuário ~30 s após a última alteração, ao trocar de
  trabalho e ao fechar; Ctrl+S força o salvamento.
- Importador do backup do `tcc-uft`: sem trabalhos antigos a migrar; fica para depois do M7 (RF-16).

## Adendo técnico — esquemas v1 (M1-T04, 2026-10-16)
Decisões técnicas da sessão principal ao implementar `app/src/dominio/esquemas/`. Não mudam o resultado visível do documento.
- **Nomes em camelCase em todos os JSON**, inclusive no manifesto: `versaoFormato` e `appVersao` (o texto acima grafa
  `versao_formato`). Um único estilo para o modelo (ADR-0005) e o pacote. `formato` = `"bibliodocs-projeto"`.
- **v1 mínimo e aditivo até a 1.ª distribuição:** o v1 tem só `Inline` `texto`, blocos `paragrafo`/`quebraPagina`,
  `metadados.titulo`/`subtitulo` (como `Inline[]`, para permitir itálico em nome científico) e `tipoTrabalho: "generico"`.
  O M2 acrescenta variantes e campos **sem incrementar `versaoFormato`** enquanto não houver versão distribuída
  (Etapa 7), porque ainda não existe arquivo de usuário em circulação. A partir da 1.ª distribuição valem as regras da
  seção 2 (mudança que exige migração incrementa a versão).
- **Exportação do zod considerada fiel** (a alternativa `ajv` da seção 2 não foi necessária): `z.toJSONSchema`
  (draft 2020-12) gera `additionalProperties:false`, `maxLength`, `maxItems`, `pattern`, `enum`/`const`, `oneOf` com
  discriminador e `$defs` recursiva (`Secao`). Diferenças conhecidas, listadas em `RESTRICOES_SO_NO_CODIGO` e na
  `description` dos arquivos: profundidade (seções ≤ 64, aninhamento JSON ≤ 144), `maxLength` em UTF-16 × pontos de
  código, coerência caminho/sha256/tipo da mídia e sha256 único. O validador oficial do app é o zod; o JSON Schema
  serve para documentação e ferramentas externas. Um teste falha se o arquivo versionado divergir do gerado.
- **Profundidade:** checagem iterativa do aninhamento JSON antes do zod (evita estouro de pilha com arquivo
  malicioso) e da árvore de seções depois dele.
- **Mensagens:** locale `ptBR` do zod com mensagens próprias para campo não permitido, campo ausente, tipo
  desconhecido, id, data, caminho de mídia e versões; caminho legível (`documento.corpo[0].titulo`).
- **Após a revisão do `especialista-documento`:**
  - `texto` recusa caracteres que o XML 1.0 não admite: controles C0, exceto tabulação e quebra de linha (que vale
    como quebra de linha manual dentro do parágrafo); `CR`; U+FFFE; U+FFFF; e surrogates isolados;
  - `marcas` sem repetição e sem sobrescrito junto com subscrito, para que o exportador não precise decidir (ADR-0005);
  - ids de seções e blocos **únicos** no documento, verificados na leitura.
- **Fora do esquema:** referências a ids inexistentes ficam para o verificador (ADR-0005: "viram não conformidade, nunca exceção").
- **Pendente para o M1-T05:** `id` e `tipoTrabalho` existem no manifesto e no documento. O contêiner define a regra de
  coerência entre os dois arquivos (iguais, ou o manifesto como cópia) e qual id nomeia a pasta de recuperação.
