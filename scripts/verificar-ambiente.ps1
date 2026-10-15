<#
.SYNOPSIS
  Verifica (somente leitura) as ferramentas usadas no projeto e informa o que falta.

.DESCRIPTION
  Nao instala, nao altera configuracoes e nao precisa de administrador. Apenas consulta versoes
  de: Claude Code, Git, Node.js/npm, Python, LibreOffice (opcional) e a pasta do projeto
  (OneDrive, comprimento do caminho, repositorio git). Compativel com Windows PowerShell 5.1 e 7.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\verificar-ambiente.ps1
#>
$ErrorActionPreference = 'Continue'
$Raiz = Split-Path -Parent $PSScriptRoot

function Versao($comando, $argumentos) {
  $cmd = Get-Command $comando -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cmd) { return $null }
  try {
    $saida = & $cmd.Source @argumentos 2>&1 | Select-Object -First 1
    return "$saida".Trim()
  } catch { return "(encontrado, mas falhou ao consultar a versao)" }
}

function Linha($nome, $versao, $necessidade, $dica) {
  if ($versao) {
    Write-Host ("{0,-12} {1,-12} {2}" -f '[OK]', $nome, $versao) -ForegroundColor Green
  } elseif ($necessidade -eq 'OBRIGATORIO') {
    Write-Host ("{0,-12} {1,-12} {2}" -f '[FALTA]', $nome, $dica) -ForegroundColor Red
  } else {
    Write-Host ("{0,-12} {1,-12} {2}" -f "[$necessidade]", $nome, $dica) -ForegroundColor Yellow
  }
}

Write-Host "Verificacao do ambiente - Kit Academico para Claude Code"
Write-Host ("PowerShell {0} | {1}" -f $PSVersionTable.PSVersion, [System.Environment]::OSVersion.VersionString)
Write-Host ""

Linha 'Claude Code' (Versao 'claude' @('--version')) 'OBRIGATORIO' 'Instale: irm https://claude.ai/install.ps1 | iex  (depois feche e reabra o terminal)'
Linha 'Git' (Versao 'git' @('--version')) 'RECOMENDADO' 'Recomendado: https://git-scm.com/downloads/win (historico e ferramenta Bash do Claude Code)'
Linha 'Node.js' (Versao 'node' @('--version')) 'PROVAVEL' 'Provavel a partir da Etapa 2/4: https://nodejs.org (versao LTS)'
Linha 'npm' (Versao 'npm' @('--version')) 'PROVAVEL' 'Vem junto com o Node.js'
$py = Versao 'python' @('--version'); if (-not $py -or $py -match 'Microsoft Store') { $py = Versao 'py' @('--version') }
Linha 'Python' $py 'OPCIONAL' 'Opcional: https://www.python.org (marque Add Python to PATH) - roda o sistema antigo e tests/'
$lo = Versao 'soffice' @('--version')
if (-not $lo) {
  $caminhoLo = 'C:\Program Files\LibreOffice\program\soffice.exe'
  if (Test-Path -LiteralPath $caminhoLo) { $lo = "instalado em $caminhoLo (fora do PATH)" }
}
Linha 'LibreOffice' $lo 'OPCIONAL' 'Opcional: converte .doc e permite checar DOCX/PDF automaticamente'

Write-Host ""
Write-Host "Pasta do projeto: $Raiz"
if ($Raiz -match 'OneDrive') { Write-Host "[AVISO]   A pasta esta no OneDrive. Recomenda-se mover para C:\Projetos\ (evita arquivos travados)." -ForegroundColor Yellow }
if ($Raiz.Length -gt 120) { Write-Host "[AVISO]   Caminho longo ($($Raiz.Length) caracteres). Builds com Node podem falhar; prefira um caminho curto." -ForegroundColor Yellow }
if (Test-Path -LiteralPath (Join-Path $Raiz '.git')) { Write-Host "[OK]      Repositorio git inicializado" -ForegroundColor Green }
else { Write-Host "[INFO]    Ainda nao e um repositorio git (a Etapa 1 propoe git init, com sua autorizacao)" }
if (Test-Path -LiteralPath (Join-Path $Raiz 'CLAUDE.md')) { Write-Host "[OK]      CLAUDE.md encontrado - esta e a pasta certa para rodar 'claude'" -ForegroundColor Green }
else { Write-Host "[FALTA]   CLAUDE.md nao encontrado: abra a pasta KIT_ACADEMICO_CLAUDE no VS Code" -ForegroundColor Red }

Write-Host ""
Write-Host "Nada foi instalado ou alterado por este script."
