# DOC-08 (RNF-05): abre cada DOCX no Word real COM os alertas ligados e registra qualquer janela de diálogo que o Word
# mostrar (reparo de conteúdo ilegível, pergunta de atualizar campos, aviso de conversão). O `conferir-no-word.ps1`
# abre com os alertas desligados e por isso não prova a ausência de reparo; este fecha essa lacuna sem depender de olhar
# a tela. Só mexe no processo do Word que ele mesmo criou (identificado pelo PID novo); nunca no Word do usuário.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File conferir-reparo.ps1 -Arquivos a.docx,b.docx [-Espera 20]
#
# Saída: JSON com, para cada arquivo, `abriu`, `dialogos` (título e textos das janelas) e `erro`.
param(
  [Parameter(Mandatory = $true)][string[]]$Arquivos,
  [int]$Espera = 20
)
$ErrorActionPreference = 'Stop'

$vigia = @'
param([int]$Alvo, [string]$Saida, [string]$Parar, [int]$Espera)
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class Janelas {
  public delegate bool Cb(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Cb cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, Cb cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  public static string Texto(IntPtr h) { var s = new StringBuilder(1024); GetWindowText(h, s, 1024); return s.ToString(); }
  public static string Classe(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, 256); return s.ToString(); }
  public static List<string> Dialogos(uint alvo) {
    var r = new List<string>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid != alvo || !IsWindowVisible(h)) return true;
      var c = Classe(h);
      if (c != "#32770" && c != "NUIDialog" && c != "bosa_sdm_msword") return true;
      var partes = new List<string> { Texto(h) };
      EnumChildWindows(h, (f, m) => { var t = Texto(f); if (t.Length > 0) partes.Add(t); return true; }, IntPtr.Zero);
      r.Add(c + ": " + string.Join(" | ", partes));
      return true;
    }, IntPtr.Zero);
    return r;
  }
}
"@
$vistos = @{}
$desde = $null
while (-not (Test-Path $Parar)) {
  $d = [Janelas]::Dialogos([uint32]$Alvo)
  foreach ($x in $d) { if (-not $vistos.ContainsKey($x)) { $vistos[$x] = $true; Add-Content -Path $Saida -Value $x -Encoding UTF8 } }
  if ($d.Count -gt 0) {
    if ($null -eq $desde) { $desde = Get-Date }
    # Diálogo parado prende o Documents.Open: depois da espera, encerra só o Word criado pela conferência.
    elseif (((Get-Date) - $desde).TotalSeconds -gt $Espera) { Stop-Process -Id $Alvo -Force -ErrorAction SilentlyContinue; break }
  } else { $desde = $null }
  Start-Sleep -Milliseconds 250
}
'@

$antes = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object Id)
$word = New-Object -ComObject Word.Application
Start-Sleep -Milliseconds 500
$novos = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $antes -notcontains $_.Id } | ForEach-Object Id)
if ($novos.Count -ne 1) {
  try { $word.Quit() } catch {}
  throw "Não foi possível identificar o processo do Word criado pela conferência (novos: $($novos -join ', '))."
}
$alvo = $novos[0]
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("bdp-doc08-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
$arqVigia = Join-Path $tmp 'vigia.ps1'
Set-Content -Path $arqVigia -Value $vigia -Encoding UTF8
$resultados = @()
try {
  $word.Visible = $true
  $word.DisplayAlerts = -1 # wdAlertsAll: o Word mostra o que mostraria ao usuário
  foreach ($a in $Arquivos) {
    $caminho = (Resolve-Path $a).Path
    $saida = Join-Path $tmp ([IO.Path]::GetFileNameWithoutExtension($caminho) + '.txt')
    $parar = "$saida.parar"
    $proc = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $arqVigia, '-Alvo', $alvo, '-Saida', $saida, '-Parar', $parar, '-Espera', $Espera)
    Start-Sleep -Milliseconds 800
    $r = [ordered]@{ arquivo = [IO.Path]::GetFileName($caminho); abriu = $false; dialogos = @(); erro = $null }
    try {
      # ConfirmConversions = false, ReadOnly = true, AddToRecentFiles = false.
      $doc = $word.Documents.Open($caminho, $false, $true, $false)
      $r.abriu = $true
      Start-Sleep -Seconds 3 # perguntas depois de abrir (ex.: atualizar campos) aparecem aqui
      $doc.Close(0)
    } catch { $r.erro = $_.Exception.Message }
    New-Item -ItemType File -Path $parar | Out-Null
    $proc | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
    if (Test-Path $saida) { $r.dialogos = @(Get-Content $saida -Encoding UTF8 | ForEach-Object { [string]$_ }) }
    $resultados += [pscustomobject]$r
    if (-not (Get-Process -Id $alvo -ErrorAction SilentlyContinue)) { break }
  }
} finally {
  try { $word.Quit(0) } catch {}
  Start-Sleep -Milliseconds 500
  Stop-Process -Id $alvo -Force -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
$resultados | ConvertTo-Json -Depth 4
