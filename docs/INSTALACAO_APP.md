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

O instalador **não tem assinatura digital** (decisão do autor, 2026-11-14: os programas gratuitos de assinatura para
código aberto pedem um projeto já usado e conhecido). Antes de instalar, **confira o arquivo**: baixe só das Releases
do repositório e compare o SHA-256 com o `SHA256SUMS.txt` publicado junto:

```powershell
Get-FileHash .\BiblioDocsPro-Instalador-<versão>.exe
```

O Windows pode reagir de dois jeitos:

1. **SmartScreen** ("O Windows protegeu o computador"): clique em **Mais informações** › **Executar assim mesmo**.
   Depois da primeira vez, o aviso não volta para esse arquivo.
2. **Controle Inteligente de Aplicativos** (Windows 11; mensagem de que um aplicativo foi bloqueado por política de
   Controle de Aplicativo): ele decide pela reputação do arquivo e **não oferece "executar assim mesmo"**. Para ver se
   está ligado: Segurança do Windows › Controle de aplicativos e navegador › Configurações do Controle Inteligente de
   Aplicativos. Se estiver **Ativado**, há duas saídas:
   - **Rodar a partir do código-fonte** (ver "Rodar a partir do código" no `README.md`): precisa do Node.js, mas não
     mexe na proteção do Windows.
   - **Desativar o Controle Inteligente de Aplicativos**, na mesma tela. Atenção: em muitas versões do Windows 11, depois
     de desativado ele **só volta reinstalando o Windows**. Os outros recursos da Segurança do Windows (antivírus,
     SmartScreen) continuam ligados. Decida com calma; se o computador é da instituição, pergunte ao suporte.

   Se estiver **Desativado** ou em **Avaliação**, só o aviso do SmartScreen pode aparecer.

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
