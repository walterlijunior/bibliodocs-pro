<#
.SYNOPSIS
  Valida a estrutura do Kit Academico para Claude Code (somente leitura).

.DESCRIPTION
  Confere: arquivos obrigatorios; formato dos agentes (.claude/agents/*.md) e skills
  (.claude/skills/<nome>/SKILL.md); settings.json; referencias cruzadas entre arquivos;
  ausencia de segredos; checksums dos materiais registrados no inventario; coerencia do README.
  Nao altera, cria nem apaga nenhum arquivo. Compativel com Windows PowerShell 5.1 e PowerShell 7.

.PARAMETER Silencioso
  Mostra apenas falhas e o resultado final (util para hooks).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\validar-kit.ps1
#>
param([switch]$Silencioso)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot
$script:Falhas = 0
$script:Avisos = 0
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Ok($msg)    { if (-not $Silencioso) { Write-Host "[OK]    $msg" -ForegroundColor Green } }
function Falha($msg) { $script:Falhas++; Write-Host "[FALHA] $msg" -ForegroundColor Red }
function Aviso($msg) { $script:Avisos++; if (-not $Silencioso) { Write-Host "[AVISO] $msg" -ForegroundColor Yellow } }
function Ler($rel)   { return [System.IO.File]::ReadAllText((Join-Path $Raiz $rel), $Utf8) }
function Existe($rel){ return Test-Path -LiteralPath (Join-Path $Raiz $rel) }

function Ler-Frontmatter($caminho) {
  $linhas = [System.IO.File]::ReadAllLines($caminho, $Utf8)
  if ($linhas.Count -lt 3 -or $linhas[0].Trim() -ne '---') { return $null }
  $dados = @{}
  for ($i = 1; $i -lt $linhas.Count; $i++) {
    if ($linhas[$i].Trim() -eq '---') { $dados['__fim'] = $i; return $dados }
    if ($linhas[$i] -match '^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$') {
      $dados[$Matches[1]] = $Matches[2].Trim().Trim('"')
    }
  }
  return $null
}

# 1. Arquivos obrigatorios ---------------------------------------------------
$obrigatorios = @(
  'README.md','CLAUDE.md','PROMPT_EXECUCAO.md','INSTRUCOES_INICIAIS.md','CHANGELOG.md','.gitignore',
  '.claude/settings.json',
  'docs/VISAO_DO_PRODUTO.md','docs/ARQUITETURA_PRELIMINAR.md','docs/REQUISITOS_FUNCIONAIS.md',
  'docs/REQUISITOS_NAO_FUNCIONAIS.md','docs/PLANO_DE_IMPLEMENTACAO.md','docs/MATRIZ_DE_RISCOS.md',
  'docs/MATRIZ_DE_TESTES.md','docs/POLITICA_DE_FONTES_NORMATIVAS.md','docs/INVENTARIO_DE_MATERIAIS.md',
  'docs/RECURSOS_CLAUDE_CODE.md','docs/ESTADO_DO_PROJETO.md','docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md',
  'templates/ADR.md','templates/RELATORIO_TECNICO.md','templates/RELATORIO_DE_TESTES.md',
  'scripts/verificar-ambiente.ps1','tests/test_estrutura_kit.py','tests/artefatos_futuros.txt',
  'materiais/LEIA-ME.md','materiais/modelos_uft/LEIA-ME.md','materiais/referencias_visuais/LEIA-ME.md',
  'analise/LEIA-ME.md','app/README.md','docs/REFERENCIA_DE_LAYOUT.md','materiais/referencias_layout/LEIA-ME.md'
)
$faltando = @($obrigatorios | Where-Object { -not (Existe $_) })
if ($faltando.Count -eq 0) { Ok "Arquivos obrigatorios presentes ($($obrigatorios.Count))" }
else { $faltando | ForEach-Object { Falha "Arquivo obrigatorio ausente: $_" } }

$vazios = @($obrigatorios | Where-Object { (Existe $_) -and ((Get-Item -Force -LiteralPath (Join-Path $Raiz $_)).Length -lt 200) })
if ($vazios.Count -eq 0) { Ok "Nenhum arquivo obrigatorio vazio ou quase vazio" }
else { $vazios | ForEach-Object { Falha "Arquivo com menos de 200 bytes: $_" } }

# 2. Agentes ------------------------------------------------------------------
$agentesEsperados = @('arquiteto-software','especialista-normas','especialista-documento','especialista-referencias',
  'especialista-elementos-visuais','especialista-interface','engenheiro-qualidade','revisor-seguranca')
$arqAgentes = @(Get-ChildItem -LiteralPath (Join-Path $Raiz '.claude/agents') -Filter '*.md' -File)
$nomesAgentes = @()
foreach ($a in $arqAgentes) {
  $fm = Ler-Frontmatter $a.FullName
  $base = [System.IO.Path]::GetFileNameWithoutExtension($a.Name)
  if ($null -eq $fm) { Falha "Agente sem frontmatter YAML valido: $($a.Name)"; continue }
  if (-not $fm.ContainsKey('name') -or $fm['name'] -ne $base) { Falha "Agente $($a.Name): campo name deve ser '$base'" }
  if (-not $fm.ContainsKey('description') -or $fm['description'].Length -lt 40) { Falha "Agente $($a.Name): description ausente ou curta" }
  if ($fm.ContainsKey('name') -and ($fm['name'].StartsWith('-') -or $fm['name'].Contains(':'))) { Falha "Agente $($a.Name): name invalido" }
  $corpo = ([System.IO.File]::ReadAllLines($a.FullName, $Utf8) | Select-Object -Skip ($fm['__fim'] + 1)) -join "`n"
  if ($corpo.Length -lt 800) { Falha "Agente $($a.Name): corpo de instrucoes muito curto" }
  $nomesAgentes += $fm['name']
}
$faltamAg = @($agentesEsperados | Where-Object { $nomesAgentes -notcontains $_ })
if ($faltamAg.Count -eq 0 -and $arqAgentes.Count -eq $agentesEsperados.Count) { Ok "Agentes: $($arqAgentes.Count) com frontmatter valido" }
else { Falha "Agentes esperados ausentes ou extras: faltam [$($faltamAg -join ', ')], encontrados $($arqAgentes.Count)" }
$revisor = Join-Path $Raiz '.claude/agents/revisor-seguranca.md'
if (Test-Path -LiteralPath $revisor) {
  $fmR = Ler-Frontmatter $revisor
  if ($fmR['tools'] -match '\b(Edit|Write)\b') { Falha "revisor-seguranca nao deve ter Edit/Write" } else { Ok "revisor-seguranca e somente leitura" }
}

# 3. Skills -------------------------------------------------------------------
$dirSkills = @(Get-ChildItem -LiteralPath (Join-Path $Raiz '.claude/skills') -Directory)
$nomesSkills = @()
foreach ($d in $dirSkills) {
  $sk = Join-Path $d.FullName 'SKILL.md'
  if (-not (Test-Path -LiteralPath $sk)) { Falha "Skill sem SKILL.md: $($d.Name)"; continue }
  $fm = Ler-Frontmatter $sk
  if ($null -eq $fm) { Falha "Skill $($d.Name): frontmatter invalido"; continue }
  if ($fm['name'] -ne $d.Name) { Falha "Skill $($d.Name): name deve ser igual ao nome da pasta" }
  if ($d.Name -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$' -or $d.Name.Length -gt 64) { Falha "Skill $($d.Name): nome deve ser kebab-case com ate 64 caracteres" }
  if (-not $fm.ContainsKey('description') -or $fm['description'].Length -lt 40 -or $fm['description'].Length -gt 1024) { Falha "Skill $($d.Name): description ausente, curta ou maior que 1024" }
  $texto = [System.IO.File]::ReadAllText($sk, $Utf8)
  if ($texto.Length -lt 700) { Falha "Skill $($d.Name): instrucoes muito curtas" }
  $nomesSkills += $d.Name
}
if ($dirSkills.Count -eq 15) { Ok "Skills: $($dirSkills.Count) com SKILL.md valido" } else { Falha "Esperadas 15 skills, encontradas $($dirSkills.Count)" }
foreach ($cmd in @('iniciar-projeto','status-projeto')) {
  $p = Join-Path $Raiz ".claude/skills/$cmd/SKILL.md"
  if ((Test-Path -LiteralPath $p) -and ((Ler-Frontmatter $p)['disable-model-invocation'] -eq 'true')) { Ok "Comando /$cmd configurado" }
  else { Falha "Comando /$cmd ausente ou sem disable-model-invocation: true" }
}

# 4. settings.json ------------------------------------------------------------
try {
  $cfg = (Ler '.claude/settings.json') | ConvertFrom-Json
  $deny = @($cfg.permissions.deny)
  if ($deny -contains 'Edit(/materiais/**)' -and $deny -contains 'Read(**/.env)') { Ok "settings.json valido com protecoes de materiais/ e .env" }
  else { Falha "settings.json sem as regras deny esperadas" }
  if (@($cfg.permissions.allow) | Where-Object { $_ -in @('Bash','Bash(*)','Edit','Write','PowerShell','PowerShell(*)') }) { Falha "settings.json concede permissao ampla demais" }
} catch { Falha "settings.json nao e JSON valido: $($_.Exception.Message)" }

# 5. Referencias cruzadas -----------------------------------------------------
$futuros = @((Ler 'tests/artefatos_futuros.txt') -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') })
$fontes = @('README.md','CLAUDE.md','PROMPT_EXECUCAO.md','INSTRUCOES_INICIAIS.md') +
  @(Get-ChildItem -Force -LiteralPath (Join-Path $Raiz '.claude') -Recurse -Filter '*.md' -File | ForEach-Object { $_.FullName.Substring($Raiz.Length + 1) }) +
  @(Get-ChildItem -LiteralPath (Join-Path $Raiz 'docs') -Recurse -Filter '*.md' -File | ForEach-Object { $_.FullName.Substring($Raiz.Length + 1) })
$prefixos = '^(docs|templates|scripts|tests|\.claude|materiais)/|^(README|CLAUDE|PROMPT_EXECUCAO|INSTRUCOES_INICIAIS|CHANGELOG)\.md$'
$quebradas = @()
$conferidas = 0
foreach ($f in $fontes) {
  $txt = [System.IO.File]::ReadAllText((Join-Path $Raiz $f), $Utf8)
  foreach ($m in [regex]::Matches($txt, '`([^`\s]+)`')) {
    $ref = ($m.Groups[1].Value -replace '\\','/').TrimEnd('/','.',',',')')
    if ($ref -notmatch $prefixos) { continue }
    if ($ref -match '[\*<>]|NN|xxx|AAAA') { continue }
    if ($ref -notmatch '\.(md|ps1|py|json|txt|zip|pdf)$') { continue }
    $conferidas++
    if (-not (Existe $ref) -and ($futuros -notcontains $ref)) { $quebradas += "$f -> $ref" }
  }
}
if ($quebradas.Count -eq 0) { Ok "Referencias cruzadas: $conferidas conferidas, nenhuma quebrada" }
else { $quebradas | Sort-Object -Unique | ForEach-Object { Falha "Referencia quebrada: $_" } }

# 6. Agentes e skills citados no README e na documentacao --------------------
$readme = Ler 'README.md'; $recursos = Ler 'docs/RECURSOS_CLAUDE_CODE.md'
$ausentesDoc = @(($nomesAgentes + $nomesSkills) | Where-Object { -not $readme.Contains($_) -or -not $recursos.Contains($_) })
if ($ausentesDoc.Count -eq 0) { Ok "README e RECURSOS_CLAUDE_CODE citam todos os agentes e skills" }
else { $ausentesDoc | ForEach-Object { Falha "Nao citado no README ou em docs/RECURSOS_CLAUDE_CODE.md: $_" } }

# 7. Segredos -----------------------------------------------------------------
$padroes = @('sk-ant-[A-Za-z0-9_-]{10,}','AKIA[0-9A-Z]{16}','-----BEGIN [A-Z ]*PRIVATE KEY-----','ghp_[A-Za-z0-9]{30,}','xox[bp]-[A-Za-z0-9-]{10,}','"?(api[_-]?key|token|password|senha)"?\s*[:=]\s*"[^"\s]{12,}"')
$textos = @(Get-ChildItem -LiteralPath $Raiz -Recurse -File -Force | Where-Object { $_.Extension -in @('.md','.json','.ps1','.py','.txt','.gitignore') -or $_.Name -eq '.gitignore' })
$achados = @()
foreach ($t in $textos) {
  $c = [System.IO.File]::ReadAllText($t.FullName, $Utf8)
  foreach ($p in $padroes) { if ($c -match $p -and $t.Name -notin @('validar-kit.ps1','test_estrutura_kit.py')) { $achados += "$($t.FullName.Substring($Raiz.Length + 1)) ($p)" } }
}
$proibidos = @(Get-ChildItem -LiteralPath $Raiz -Recurse -File -Force | Where-Object { $_.Name -in @('.env','.credentials.json','settings.local.json','.claude.json') })
if ($achados.Count -eq 0 -and $proibidos.Count -eq 0) { Ok "Nenhum segredo ou arquivo de credencial encontrado ($($textos.Count) arquivos de texto)" }
else { ($achados + ($proibidos | ForEach-Object { $_.FullName })) | ForEach-Object { Falha "Possivel segredo/credencial: $_" } }

# 8. Checksums dos materiais --------------------------------------------------
$inv = Ler 'docs/INVENTARIO_DE_MATERIAIS.md'
$linhasInv = [regex]::Matches($inv, '`(materiais/[^`]+\.(zip|pdf|md|doc|docx|png))`[^\r\n]*?`([0-9a-f]{64})`')
if ($linhasInv.Count -eq 0) { Aviso "Nenhum checksum encontrado no inventario" }
foreach ($l in $linhasInv) {
  $rel = $l.Groups[1].Value; $esperado = $l.Groups[3].Value
  if (-not (Existe $rel)) { Falha "Material listado com checksum, mas ausente: $rel"; continue }
  $real = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $Raiz $rel)).Hash.ToLower()
  if ($real -eq $esperado) { Ok "Checksum confere: $rel" } else { Falha "Checksum diferente do inventario: $rel" }
}
foreach ($pendente in @('materiais/modelos_uft','materiais/referencias_visuais')) {
  $extras = @(Get-ChildItem -LiteralPath (Join-Path $Raiz $pendente) -File | Where-Object { $_.Extension -in @('.doc','.docx') })
  if ($extras.Count -eq 0) { Aviso "Ainda sem arquivos .doc/.docx em $pendente (material pendente do usuario)" }
  else { Ok "$($extras.Count) arquivo(s) .doc/.docx em $pendente - registre no inventario na Etapa 1" }
}

# Resultado -------------------------------------------------------------------
Write-Host ""
Write-Host "RESULTADO: $($script:Falhas) falha(s), $($script:Avisos) aviso(s)"
if ($script:Falhas -gt 0) { exit 1 } else { exit 0 }
