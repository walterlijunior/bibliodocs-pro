# Instalação do BiblioDocs Pro

Guia para instalar, usar pela primeira vez, atualizar e desinstalar o aplicativo no Windows. Para o que o aplicativo
faz, veja `app/README.md`; para gerar o instalador a partir do código, `app/DESENVOLVIMENTO.md`.

## Requisitos

- Windows 10 (1809 ou mais novo) ou Windows 11, 64 bits.
- Cerca de 400 MB livres no disco (o instalador tem cerca de 112 MB).
- Não precisa de administrador nem de internet.
- Para abrir o resultado: Microsoft Word (recomendado) ou LibreOffice.

## Instalar

1. Execute `BiblioDocsPro-Instalador-<versão>.exe`.
2. A instalação é automática, só para o seu usuário, sem perguntas: o programa vai para
   `%LOCALAPPDATA%\Programs\bibliodocs-pro`, com atalhos na Área de Trabalho e no Menu Iniciar.
3. Abra o BiblioDocs Pro pelo atalho.

### Aviso do Windows (instalador sem assinatura)

Nesta versão o instalador **não tem assinatura digital** (decisão pendente D-E7-01). Por isso o Windows pode avisar:

- **SmartScreen** ("O Windows protegeu o computador"): só continue se o arquivo veio de uma fonte em que você confia,
  em "Mais informações" › "Executar assim mesmo".
- **Controle Inteligente de Aplicativos** do Windows 11 (mensagem de bloqueio por política de Controle de Aplicativo): ele decide pela
  reputação do arquivo e **não oferece "executar assim mesmo"**. Não desligue essa proteção para instalar o
  BiblioDocs Pro: depois de desligada, ela só volta reinstalando o Windows. A solução é a versão assinada.

Por isso, **não distribua** o instalador desta versão a outras pessoas. Quando houver distribuição, publique junto do
link o SHA-256 do instalador (`Get-FileHash BiblioDocsPro-Instalador-<versão>.exe`), para quem baixar conferir que o
arquivo é o original (R-E7-02).

## Primeiro uso

- A biblioteca começa vazia, em `Documentos\BiblioDocs Pro\Trabalhos`. Para usar outra pasta: Arquivo › Escolher pasta
  da biblioteca.
- **Criar primeiro trabalho** e escolha o tipo. O resto está em `app/README.md` ("Primeiros passos").

## Onde ficam os dados

| O quê | Onde | Ao desinstalar |
|---|---|---|
| Programa | `%LOCALAPPDATA%\Programs\bibliodocs-pro` | Apagado |
| Trabalhos (`.bdp`) | `Documentos\BiblioDocs Pro\Trabalhos` (ou a pasta escolhida) | **Ficam** |
| Índice da biblioteca, preferências, cópias de segurança e de recuperação | `%LOCALAPPDATA%\BiblioDocsPro` | **Ficam** |
| Cache da janela | `%APPDATA%\BiblioDocs Pro` | **Ficam** |

As cópias de segurança e de recuperação contêm o texto dos trabalhos. Se quiser apagar tudo, apague essas pastas à mão,
depois de conferir que não precisa mais dos trabalhos.

## Atualizar

Não há atualização automática. Execute o instalador da versão nova: ele substitui o programa e mantém os trabalhos e
as preferências. Trabalhos de versões anteriores do formato são migrados ao abrir, com cópia do original.

## Desinstalar

Configurações › Aplicativos › Aplicativos instalados › **BiblioDocs Pro** › Desinstalar (ou "Adicionar ou remover
programas"). Feche o aplicativo antes. Os dados ficam, como na tabela acima.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| O Windows bloqueia o instalador | Ver "Aviso do Windows" acima |
| Ao abrir o DOCX, o Word pergunta se deve atualizar campos | Pode aceitar: atualiza o sumário e as listas com a paginação do seu Word |
| No LibreOffice a capa fica com o texto no alto da página | Limitação do LibreOffice com a justificação vertical; no Word sai certo |
| O aplicativo fechou sem salvar | Abra de novo: ele oferece recuperar a versão de poucos segundos antes |
| Um trabalho não abre ("arquivo danificado") | Arquivo › Cópias de segurança… mostra as cópias anteriores daquele trabalho |
