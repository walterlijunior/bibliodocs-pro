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

## Adendo técnico — contêiner `.bdp` (M1-T05, 2026-10-16)
Decisões técnicas da sessão principal, com as correções da revisão do `revisor-seguranca`. Não mudam o resultado visível.

**Coerência entre os arquivos (achado M3 do M1-T04):**
- `manifesto.id` e `manifesto.tipoTrabalho` têm de ser iguais aos do `documento.json`;
- esse id único nomeia as pastas de recuperação e de backup (seção 4);
- o manifesto é um índice que dá para ler sem processar o documento.

**Leitura:**
- O diretório central é analisado por código próprio. A hipótese da seção 1 não se confirmou: o `fflate` 0.8.3 não
  protege sozinho [VERIFICADO], porque o `inflateSync` com saída fixa trunca em silêncio e o `unzipSync` confia nos
  tamanhos declarados.
- A descompressão usa `node:zlib` (`inflateRawSync` com `maxOutputLength` e `info.engine.bytesWritten`). O `fflate`
  fica só na escrita (`zipSync`).
- Só é aceito o ZIP que o app grava:
  - sem ZIP64, criptografia, descritor de dados, comentário ou multivolume;
  - entradas contíguas desde o byte 0 até o diretório central;
  - cabeçalho local idêntico ao central;
  - fluxo deflate que termina exatamente no fim dos dados;
  - CRC-32 conferido.
- Descompressão **sob demanda e na ordem da validação**: nomes → `mimetype` → manifesto (para logo se for inválido) →
  documento → só as mídias declaradas. `bibliografia.json` e `ajustes.json` são recusados como "não suportados no v1" sem
  serem descomprimidos.
- Mídia com tamanho, CRC, sha256 ou assinatura divergente é descartada com aviso. Mídia não declarada é descartada sem
  ser descomprimida.

**Limites ajustados:**
- `manifesto.json` ≤ **2 MB** (os 64 MB valem para o `documento.json`);
- a razão ≤ 200:1 só é conferida acima de **1 MB** descomprimido. Abaixo disso uma bomba não causa dano, e um texto
  pequeno e repetitivo do usuário pode passar da razão.

**Escrita:**
- `empacotarProjeto` relê o resultado com `lerProjeto` antes de devolvê-lo (achado A1, Alta).
- Um documento acima de 1 MB e muito repetitivo (mais de 200:1) é **recusado ao salvar**, com mensagem, em vez de gerar
  um arquivo que não abre. O M1-T06 precisa mostrar esse erro no visor e manter o documento em memória.
- Mídias e miniatura são gravadas sem recompressão. A data das entradas é fixa (1980-01-01), então o mesmo conteúdo
  gera os mesmos bytes.

**Medição [VERIFICADO]** (3.000 parágrafos e 50 mídias de 500 KB, 25 MB):
- empacotar com a releitura: cerca de 170 ms;
- ler: cerca de 90 ms.

Isso refuta, na parte em memória, a hipótese das "centenas de ms" (seção Consequências). A gravação em disco é medida no M1-T06.

**Pendente (revisão):**
- A leitura de arquivo vindo de fora roda no processo principal. A revisão recomenda isolá-la (`utilityProcess` ou
  worker) antes de abrir arquivos pelo IPC → **M1-T08**.
- O `fs.stat` antes de ler (seção 3, item 1) → **M1-T06**.

## Adendo técnico — salvamento atômico (M1-T06, 2026-10-16)

Decisões técnicas da sessão principal, revisadas pelo `revisor-seguranca` (achados M6-01 a M6-11, no relatório do M1).
Código: `app/src/persistencia/arquivo/`.

**Passo 4 mudou: o `.bak` é cópia, não renomeação.**
- O ADR dizia: renomear o destino para `.bak` e depois o temporário para o destino. Entre os dois passos o trabalho do
  usuário não existiria no disco. Se o passo 5 esgotasse as tentativas, o original ficaria só no `.bak`.
- Agora: copiar o destino para `<nome>.bdp.bak.tmp-<pid>-<aleatório>` (cópia exclusiva), tirar o atributo somente
  leitura, `fsync`, renomear sobre o `.bak`. Depois, renomear o temporário sobre o destino (`MoveFileExW` com substituição,
  pela libuv). O destino nunca deixa de existir.
- O revisor mediu [VERIFICADO]: o `rename` sobre um destino aberto por outro processo dá `EPERM` em todos os modos de
  compartilhamento testados, inclusive com `FILE_SHARE_DELETE`. O `copyFile` só falha no compartilhamento `None` (`EBUSY`).
- Falha no `.bak` não impede salvar: vira aviso no resultado.

**Tentativas:**
- "Até 6 tentativas, de 50 ms a cerca de 1,6 s" foi lido como esperas de 50, 100, 200, 400 e 800 ms, **somando cerca
  de 1,55 s**.
- O orçamento vale para o salvamento inteiro: o `.bak` e a troca dividem as mesmas esperas (M6-02). Com bloqueio
  exclusivo, o erro sai em cerca de 1,66 s, e não mais em 3,26 s.
- A criação do temporário repete só em `EBUSY`. `EACCES` ali é pasta protegida e falha na hora.

**Erros:**
- Destino somente leitura → `SOMENTE_LEITURA` na hora, sem tentativas (M6-01). Antes saía "em uso por outro programa"
  depois de 1,6 s.
- Destino que não é arquivo comum (pasta, link, junção) → `DESTINO_INVALIDO`.
- `ENOENT` na troca (temporário apagado por antivírus) → erro de gravação, não "pasta inexistente".
- Os códigos e as mensagens em pt-BR estão em `MENSAGENS_FALHA`. O `detalhe` (código do sistema) é só para o registro técnico.

**Temporários:**
- Em falha antes da troca, o temporário parcial é apagado.
- Um temporário ou `.bak.tmp` que já existia (`EEXIST`) nunca é apagado nem sobrescrito.
- Se as tentativas da troca se esgotam, o temporário completo fica para a recuperação (M1-T12). O salvamento seguinte do
  mesmo destino, na mesma sessão, apaga esse temporário, para não acumular cópias do projeto (M6-04).

**Concorrência:** salvamentos do mesmo destino (Ctrl+S e automático) passam por uma fila em memória. A chave é o caminho
resolvido, em minúsculas no Windows.

**Durabilidade [HIPÓTESE, não medida]:**
- A troca é atômica. Depois de uma queda de energia ela pode não ter sido persistida: não há `fsync` de diretório no
  Windows nem `MOVEFILE_WRITE_THROUGH` na libuv. O que se garante é encontrar o original **ou** o novo, íntegros (M6-06).
- O temporário e a cópia do `.bak` passam por `fsync`.

**Abertura (`abrirProjeto`):**
- `lstat` pelo caminho: precisa ser arquivo comum dentro do limite (1 GB).
- Ao abrir, confere de novo pelo descritor que é arquivo comum (M6-07) e o tamanho.
- Lê exatamente o tamanho conferido e recusa o arquivo se ele crescer durante a leitura.

**Medição [VERIFICADO, 2026-10-16]:**
- Projeto com 25 MB de mídia incompressível em `%TEMP%`, SSD local:
  - gravação em disco (temporário + `fsync` + troca): 64 a 107 ms;
  - com o `.bak`: 152 a 180 ms;
  - salvamento completo (empacotar com releitura + gravar): 0,24 a 0,84 s, conforme a carga da máquina;
  - abrir: 83 a 235 ms.

  Fica abaixo do critério de reversão de 2 s.
- Arquivo aberto por outro processo (PowerShell, `FileShare.Read`): 6 tentativas, `EPERM`, cerca de 1,64 s, original
  intacto. Liberado depois de cerca de 300 ms: salva na 4.ª tentativa, em cerca de 0,45 s.

**Para tarefas seguintes:**
- **M1-T12:**
  - a busca de órfãos inclui também `*.bdp.bak.tmp-*`, que pode ser apagado direto (é só cópia do original) (M6-03);
  - o resultado `{ok:false, temporario}` informa o temporário preservado.
- **M1-T08:**
  - mandar ao renderizador só o nome do arquivo, não o caminho completo (M6-11);
  - a fila por caminho não reconhece nomes 8.3, `subst` ou UNC do mesmo arquivo. Basta enquanto houver instância única
    (M6-10); se não bastar, usar `realpath.native` da pasta como chave.
- OneDrive e pastas de rede não foram testados [HIPÓTESE]. As tentativas cobrem `EACCES`/`EPERM` transitórios.

## Adendo técnico — migrações (M1-T07, 2026-10-16)

Decisões técnicas da sessão principal, revisadas pelo `especialista-documento` (relatório do M1; achados M1, M2 e
B1–B5 incorporados abaixo).
Código: `app/src/dominio/esquemas/migracoes.ts` (puro) e `app/src/persistencia/`.

**Forma da migração:**
- `Migracao = { de: N, migrar({manifesto, documento}) → {manifesto, documento} }`. A migração recebe o par de JSON
  porque a versão mora no manifesto e uma mudança de formato pode mexer nos dois.
- A entrada são os JSON já lidos e **ainda não validados**. A validação estrita roda uma vez, depois da cadeia inteira,
  contra a versão atual. O aninhamento é limitado antes de chamar a primeira migração (as migrações podem ser recursivas).
- Depois de cada passo, o manifesto precisa declarar exatamente `N + 1` e manter o mesmo `id` (ele nomeia as pastas de
  backup e de recuperação); exceção dentro da migração, ou saída que não é objeto, vira erro em pt-BR.
- Toda migração registrada é testada sobre a fixture de entrada congelada (pureza).
- O registro (`MIGRACOES_REGISTRADAS`) precisa ser contíguo e terminar na versão atual. No v1 ele é **vazio**. Teste
  confere o registro e exige `tests/fixtures/migracoes/v<N>-para-v<N+1>/` com entrada e saída para cada migração
  (RNF-16). A migração fictícia v0 → v1 existe só nos testes.

**Versão futura (R33):**
- `lerProjeto` devolve `ok: false` com `versaoFutura: { versaoFormato, leitura }`. Como o resultado é de falha, nenhum
  caminho de edição ou de salvamento recebe esse pacote: a recusa da edição está no tipo.
- `leitura` é o pacote validado **como se fosse v1**, para abrir só para leitura. Depois da validação o manifesto
  volta a declarar a versão do arquivo, com o tipo `PacoteSomenteLeitura` (`versaoFormato: number`): `salvarProjeto`
  não o aceita na compilação e `empacotarProjeto` o recusa na execução, então um arquivo novo nunca é regravado no
  formato antigo. Se a versão nova usa algo que o v1 não conhece, `leitura` é `null` e o app só mostra a mensagem.
- O leitor do ZIP aceita, com limite e **sem descomprimir**, nomes que uma versão futura pode trazer
  (`<nome>.json` na raiz, `midias/<sha256>.<ext>`). A recusa pelo nome (desconhecido ou `bibliografia.json`/`ajustes.json`)
  vem depois do manifesto, para que um arquivo de versão futura receba a mensagem de versão nova; na versão atual a
  mensagem continua "nome de entrada não permitido no pacote".
- Versão antiga: a recusa pelo nome e a falta de migração são conferidas antes de descomprimir o `documento.json`.

**Backup obrigatório antes de migrar:**
- Quem faz é `abrirProjeto`: grava os bytes originais com `gravarAtomico` em
  `<pastaBackups>/<id>/AAAAMMDD-HHMMSS-mmm-formato-v<N>.bdp` (hora local). O `id` vem do manifesto já validado
  (`PADRAO_ID`), então é seguro como nome de pasta.
- Um backup nunca substitui outro: se o nome existe, usa `-2`, `-3`... (até 20) antes de `.bdp`. Ids que diferem só
  em maiúsculas dividem a pasta no Windows, mas os nomes continuam únicos.
- Se a gravação do backup falha, o temporário que o `gravarAtomico` deixaria para a recuperação é apagado (o original
  está intacto).
- Sem `pastaBackups`, ou com falha ao criar a pasta ou gravar, o projeto antigo **não abre**, com mensagem. O arquivo
  original nunca é alterado na abertura; o formato novo só vai para o disco no salvamento seguinte.
- `SistemaArquivos` ganhou `criarPasta` (recursiva).

**Para tarefas seguintes:**
- **M1-T08:** passar `pastaBackups` (`%LOCALAPPDATA%\BiblioDocsPro\backups`) ao `abrirProjeto`; mandar ao renderizador
  `versaoFutura.versaoFormato` e o pacote de leitura, nunca o caminho do backup completo.
- **M1-T11:** mensagem de versão futura com a opção "abrir só para leitura" quando `leitura` não for `null`; avisar que o
  projeto foi atualizado e onde ficou a cópia.
- **M1-T12:** a rotação de backups não apaga os `*-formato-v<N>.bdp` [HIPÓTESE de política; ajustável].

## Adendo técnico — leitura isolada (M1-T08, 2026-10-16)
Resolve a pendência do M1-T05 ("isolar a leitura de arquivo vindo de fora").
- `abrirProjeto` roda num `utilityProcess` (`app/src/principal/leitor-projeto.ts`), um processo por abertura.
  O principal espera no máximo 60 s; saída sem resposta, resposta fora do protocolo ou tempo esgotado viram
  "não foi possível ler o arquivo". Quem encerra o leitor é o principal, depois da resposta (S8-02).
- Teto de heap do leitor: `--max-old-space-size=2048` [HIPÓTESE, a calibrar] (S8-01).
- **Alcance:** o isolamento protege o principal contra queda, falta de memória e laço longo causados pelo arquivo.
  **Não** isola privilégio: o leitor é um Node sem sandbox, com o mesmo acesso a disco. Avaliar o leitor com sandbox
  antes da distribuição (Etapa 7).
- O principal confere o envelope da resposta com esquema estrito (S8-05), mas não refaz a validação profunda do
  documento; tudo é validado de novo antes de qualquer gravação.
- Backups de migração em `%LOCALAPPDATA%\BiblioDocsPro\backups`; ao renderer só vai o nome do backup.
- Medição [VERIFICADO]: projeto de 25 MB aberto pelo leitor, 20 vezes: 20 sucessos, 307 a 408 ms cada, incluindo
  a criação do processo.

## Adendo técnico — biblioteca (M1-T09, 2026-10-16)
Detalha a seção 5 e o item "Excluir trabalho" da seção 4.
- **Arquivos locais** em `%LOCALAPPDATA%\BiblioDocsPro\`:
  - `biblioteca.json`: **cache**. Guarda nome, tamanho, data de modificação e resumo (título em texto plano, tipo,
    datas) de cada `.bdp` da pasta. Um arquivo só é resumido de novo quando o tamanho ou a data mudam. Índice ausente,
    corrompido, de outro formato ou de outra pasta começa vazio e é recriado.
  - `preferencias.json`: a pasta escolhida pelo usuário (`null` = padrão). Não é cache, por isso fica fora do índice.
    Apagar o índice não muda a pasta. Preferência inválida ou com caminho relativo volta para a padrão.
  - Os dois são lidos com limite (16 MB) e esquema estrito, e gravados por `gravarAtomico`.
- **Varredura:** só arquivos comuns `.bdp` do primeiro nível, sem seguir links (temporários e `.bak` ficam de fora).
  Limite de 5 000 itens, com aviso. Prazo total de 180 s: passado o prazo, a lista sai parcial, com aviso, e o
  restante fica para a próxima listagem.
- **Desvio do "um processo por abertura" (adendo do M1-T08):** o **resumo** da lista roda no processo leitor em lotes
  de até 50 arquivos por processo. Um processo por arquivo custaria cerca de 0,3 s × N na primeira listagem.
  - O lote só devolve texto curto, conferido por esquema estrito e na ordem do pedido.
  - Se o lote falha, ele é refeito um arquivo por vez (revisão do M1-T09, M3). Assim, um arquivo que derruba o leitor
    fica marcado como inválido no índice e não leva os outros junto. Se todos falham sozinhos, a falha é do leitor, e
    nada entra no índice.
  - **Abrir e duplicar** continuam com um processo por arquivo.
  - Resíduo aceito: um leitor comprometido por um arquivo pode falsear o resumo exibido dos outros do mesmo lote. Abrir
    e duplicar releem o arquivo.
- **Identificadores de item:** registro próprio, separado do registro dos projetos abertos. São estáveis por janela
  e por caminho (índice por janela + caminho, tempo constante; revisão A1). Não servem como destino de
  `projetos.salvar`.
- **Operações** (fila única por processo; diálogos fora da fila e reconferência dentro dela):
  - criar: `Trabalho sem título.bdp` (ou `(2)`, `(3)`…), tipo genérico, id novo, já aberto;
  - renomear: o nome digitado é validado, nunca corrigido. São recusados os caracteres proibidos do Windows,
    invisíveis (`\p{Cf}`), surrogates órfãos, nomes reservados (inclusive `CONIN$`/`CONOUT$`) e mais de 80 caracteres.
    O nome novo nasce como link físico, que falha se o nome já existir; só depois o nome antigo é removido. Volume sem
    link físico usa conferência + `rename`. A troca só de caixa exige a mesma identidade de arquivo (`dev:ino`);
  - duplicar: `<nome> (cópia).bdp` com id novo no manifesto e no documento (o id dá nome às pastas de backup e de
    recuperação);
  - excluir: confirmação por diálogo do principal, com Cancelar como padrão, e depois `shell.trashItem`. Se a Lixeira
    falha, nada é apagado;
  - renomear e excluir recusam um trabalho aberto no app (`ABERTO_NO_APP`), porque um salvamento em curso recriaria o
    arquivo.
- **OneDrive (R16):** a pasta está dentro de `%OneDrive%`, `%OneDriveConsumer%` ou `%OneDriveCommercial%`, ou tem no
  caminho uma pasta `OneDrive` ou `OneDrive - <organização>`. O resultado vai para a interface, que mostra o aviso
  (M1-T10/T11). [HIPÓTESE] Outros clientes de sincronização não são detectados.
- **Leitura:** `lerArquivoLimitado` passou a conferir que o descritor aberto é o mesmo arquivo conferido pelo caminho
  (revisão B6).
- **Resíduos registrados:** dentro do app, a fila protege as operações. Ainda há duas corridas raras:
  - um processo externo que crie o mesmo nome entre `nomeLivre` e o salvamento atômico em criar/duplicar
    (o salvamento substitui);
  - `projetos.abrir` (diálogo) do mesmo arquivo durante um renomear da biblioteca.

## Adendo técnico — sessão de edição e salvamento automático (M1-T11, 2026-10-16)
Decisões técnicas da sessão principal ao implementar a opção (1) escolhida pelo usuário. Não mudam o resultado do
documento.
- **Onde mora:** `SessaoTrabalho` em `app/src/aplicacao/servicos/` (pura; relógio e agendador injetados). O renderer
  guarda o documento em memória e chama `projetos.salvar`; o principal continua sendo o único que conhece caminhos.
- **Fila única de gravações:** salvar, automático e "Salvar como…" rodam um de cada vez; o pedido que chega durante
  outro espera e só grava se houve alteração no meio. "Salvar como…" para o automático enquanto o diálogo está aberto.
- **Revisões:** cada alteração soma uma revisão; "Salvo" só quando a revisão gravada é a atual. Alteração durante a
  gravação mantém "Alterações não salvas" e reagenda o automático.
- **Depois de um erro**, o automático tenta de novo em 30 s (arquivo preso por pouco tempo: OneDrive, antivírus); o
  erro continua no visor e nos avisos até uma gravação dar certo.
- **Trocar de trabalho** (criar, abrir) grava antes; se não gravar, a troca não acontece e a aba Escrever mostra o
  motivo. **Fechar o trabalho** grava antes; se não gravar, oferece "Salvar como…" e "Fechar sem salvar".
- **Fechar a janela:** o renderer cancela o `beforeunload` quando há pendência (no Electron isso impede o fechamento,
  sem diálogo), grava e chama `window.close()` com permissão. Se a gravação falha, oferece "Salvar como…" e "Sair sem
  salvar". Descartar durante uma gravação não a interrompe (o principal termina de gravar o pacote que já recebeu).
- **`atualizadoEm`** do manifesto passa a ser a hora de cada gravação (UTC, `toISOString`, como no criar/duplicar do
  M1-T09).
- **Título editado** vira um trecho sem marcas até o editor rico (M2); sem alteração, o original é preservado.
- **Recuperação** (instantâneos de ~2 s, trava de sessão) continua no M1-T12.
