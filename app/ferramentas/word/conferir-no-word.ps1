# Abre um DOCX no Microsoft Word real, por automação COM, e informa o que o Word viu (M3-T01; DOC-08). Só leitura:
# abre em modo somente leitura, fora dos recentes, numa instância própria, e nunca salva.
# Uso: powershell -NoProfile -File conferir-no-word.ps1 -Arquivo x.docx [-Pdf saida.pdf]
param(
  [Parameter(Mandatory = $true)][string]$Arquivo,
  [string]$Pdf = ''
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$saida = [ordered]@{ arquivo = (Split-Path -Leaf $Arquivo); abriu = $false }
$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $saida.versaoWord = $word.Version
  $caminho = (Resolve-Path -LiteralPath $Arquivo).Path
  # Documents.Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles); OpenAndRepair fica falso, o padrão.
  $doc = $word.Documents.Open([ref]$caminho, [ref]$false, [ref]$true, [ref]$false)
  $saida.abriu = $true
  $saida.paginas = $doc.ComputeStatistics(2)
  $saida.palavras = $doc.ComputeStatistics(0)
  $saida.secoes = $doc.Sections.Count
  $saida.notas = $doc.Footnotes.Count
  $saida.tabelas = $doc.Tables.Count
  $saida.campos = $doc.Fields.Count
  $saida.sumarios = $doc.TablesOfContents.Count
  $saida.equacoes = $doc.OMaths.Count
  $saida.imagens = $doc.InlineShapes.Count
  if ($doc.TablesOfContents.Count -gt 0) {
    $saida.sumarioGravado = $doc.TablesOfContents.Item(1).Range.Text
    # Atualiza só na memória (o arquivo é somente leitura e não é salvo): mostra a paginação real do Word.
    $doc.TablesOfContents.Item(1).Update()
    $saida.sumarioAtualizado = $doc.TablesOfContents.Item(1).Range.Text
    $saida.paginasDepois = $doc.ComputeStatistics(2)
  }
  if ($Pdf -ne '') {
    # 17 = wdExportFormatPDF
    $doc.ExportAsFixedFormat([System.IO.Path]::GetFullPath($Pdf), 17)
    $saida.pdf = (Split-Path -Leaf $Pdf)
  }
} catch {
  $saida.erro = $_.Exception.Message
} finally {
  # 0 = wdDoNotSaveChanges. Só fecha a instância criada aqui; nunca encerra processos do Word à força.
  try { if ($null -ne $doc) { $doc.Close([ref]0) } } catch { $saida.erroAoFechar = $_.Exception.Message }
  try { if ($null -ne $word) { $word.Quit([ref]0) } } catch { $saida.erroAoSair = $_.Exception.Message }
}
$saida | ConvertTo-Json -Depth 3
