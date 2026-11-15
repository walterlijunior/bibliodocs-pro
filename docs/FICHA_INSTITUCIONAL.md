# Ficha institucional (`.bdficha.json`)

A ficha institucional é o formulário padronizado para cadastrar os dados de uma instituição (câmpus ou polos, cursos
ou programas, disciplinas, docentes, manuais e perfis de formatação) e compartilhá-los com quem usa o BiblioDocs Pro.
Etapa 3 da especificação de atualização, "Ficha institucional, contribuições e importação".

## No aplicativo

Em **Catálogo acadêmico…** (na capa ou na folha de rosto), seção **Ficha institucional**:

- **Importar ficha…** lê um arquivo `.bdficha.json`. A prévia mostra o que será incluído ou atualizado, os vínculos
  novos (curso → câmpus, disciplina ou docente → curso), os campos que a ficha não traz, os valores diferentes do
  catálogo e as pendências. Nada muda antes de **Incluir no catálogo**, e o catálogo só fica gravado neste computador
  depois de **Guardar**.
- **Exportar ficha da SIGLA…** grava a ficha da instituição escolhida, para enviar a outra pessoa.
- **Modelo de preenchimento…** grava uma ficha de exemplo (Universidade Exemplo, UEX), com um registro de cada tipo,
  para servir de ponto de partida num editor de texto.
- **Manuais e perfis**: cada perfil mostra as regras e a fonte (manual, edição, seção). Perfil importado chega
  **não revisado** e só pode ser usado num trabalho depois de **Marcar como revisado**. No trabalho, o perfil revisado
  que vale para o curso e o tipo escolhidos aparece em Trabalho › Modelo de evento (DOCX)… › **Usar este perfil** e
  passa pela mesma prévia de um modelo de evento antes de aplicar.

## Preencher com IA (opcional)

Com o assistente de IA configurado (Trabalho › Assistente de IA…), **Preencher com IA…** aparece na seção da ficha:

1. Cole o texto da página oficial ou do trecho do manual, ou abra um arquivo `.txt`, `.md` ou `.html` salvo da página
   (até 60 mil caracteres por envio), e informe o endereço (https) de onde veio. O aplicativo **não acessa o endereço**:
   ele só vira a fonte dos registros. PDF não é lido (D-E3-04).
2. **Enviar à IA…** mostra o conteúdo exato na janela de autorização; cancelar não envia nada.
3. A resposta vira uma ficha e passa pela **mesma prévia** da importação, com a lista **Origem das sugestões da IA**
   (o trecho citado de cada item e o que a IA marcou como incerto). Nome de câmpus ou curso que não casa vira
   pendência. As regras do perfil passam pelo filtro do modelo de evento (só aspectos conhecidos, valores nos limites)
   e o perfil chega **não revisado**.

Com a IA desativada, o envio é recusado com a explicação; o formulário, a importação e a exportação funcionam sem IA.
Um envio só, sem ponto de retomada (D-E3-08).

## Como a importação cruza os dados

- Os registros são comparados pelo **nome normalizado** (sem acento, caixa, pontuação nem espaços repetidos): "Câmpus
  de Palmas" e "campus de palmas" são o mesmo registro. O que já existe é reaproveitado; o que falta é incluído.
- **Valor diferente** do catálogo (cidade, grau, titulação…): o do catálogo continua até o usuário marcar
  "Usar o da ficha". Campo vazio no catálogo é preenchido pela ficha sem perguntar.
- **Ambiguidade** (dois registros do catálogo servem): a importação espera a escolha, que pode ser "Incluir como
  registro novo".
- **Relação incompleta** (curso sem câmpus, chave que não existe na ficha): vira pendência e o registro não entra.
- **Reimportar** a mesma ficha não inclui nada; a revisão de um perfil é mantida se as regras não mudaram.

## Formato

JSON em UTF-8 (com ou sem BOM), até 8 MB. As ligações usam `chave` (minúsculas, algarismos e hífen), que só vale dentro
da ficha. Campos que quem preencheu não sabe vão em `desconhecidos`, para a prévia não os tratar como esquecidos.

| Campo | Conteúdo |
|---|---|
| `formato`, `versao` | Sempre `"bibliodocs-ficha-institucional"` e `1`. |
| `preenchidaEm` | Opcional: data e hora ISO 8601. |
| `instituicao` | `nome`, `sigla` (até 20), `logotipo?` (`sha256`, `tipo` PNG ou JPEG, `dados` em base64, até 2 MB), `desconhecidos?: ["logotipo"]`. |
| `fontes` | Página oficial consultada por conjunto (`instituicao`, `campi`, `cursos`, `disciplinas`, `docentes`, `manuais`): `url` (https), `consultadoEm` (AAAA-MM-DD), `observacao?`. Vale para os registros sem `fonte` própria. |
| `campi[]` | `chave`, `nome`, `especie` (`campus` ou `polo`), `cidade?`, `uf?` (duas maiúsculas), `desconhecidos?`, `fonte?`. |
| `cursos[]` | `chave`, `nome`, `nivel` (`graduacao`, `especializacao`, `mestrado`, `doutorado`), `grau?` (`bacharelado`, `licenciatura`, `tecnologia`), `areaConcentracao?`, `campi` (chaves), `desconhecidos?`, `fonte?`. |
| `disciplinas[]` | `chave`, `nome`, `cursos` (chaves), `fonte?`. |
| `docentes[]` | `chave`, `nome`, `titulacao?` ("Dr.", "Dra.", "Me.", "Ma."), `cursos` (chaves), `desconhecidos?`, `fonte?`. |
| `manuais[]` | `chave`, `titulo`, `url?` (https) ou `arquivo?`, `edicao?`, `data?` (AAAA ou AAAA-MM-DD), `cursos?`, `tipos?`, `desconhecidos?`, `fonte?`. |
| `perfis[]` | `chave`, `nome`, `manual?` (chave), `secao?` (seção ou página do manual), `regras` (os aspectos do modelo de evento: página, margens, fonte, corpo, entrelinha, alinhamento, recuo, títulos), `instrucoes?` (o que o aplicativo não aplica sozinho), `cursos?`, `tipos?` (`monografia`, `artigo-tcc`, `dissertacao`, `tese`, `relatorio-tecnico`, `projeto-pesquisa`). |

`cursos` e `tipos` vazios ou ausentes num manual ou perfil: vale para todos. O esquema completo está em
`app/src/dominio/esquemas/ficha.ts`; o exemplo, em `fichaModelo()` (`app/src/aplicacao/catalogo.ts`).

## Privacidade

A ficha pode ter nomes de docentes. Ela só sai do computador quando o usuário exporta e envia o arquivo; o aplicativo não
publica nada. Fichas de teste e exemplos do repositório usam nomes fictícios.
