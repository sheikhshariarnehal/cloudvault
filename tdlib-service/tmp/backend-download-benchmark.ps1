$ErrorActionPreference = 'Stop'

$key = '4vlPHE1GtjLHl7e9iz03B7PS8JFhbI4YOXJR4ZJ0DADggbbi'
$tmpSmall = Join-Path $env:TEMP 'cv_small_64kb.bin'
$tmpLarge = Join-Path $env:TEMP 'cv_large_100mb.bin'

if (!(Test-Path $tmpSmall)) {
  fsutil file createnew $tmpSmall 65536 | Out-Null
}

if (!(Test-Path $tmpLarge)) {
  fsutil file createnew $tmpLarge 104857600 | Out-Null
}

function FirstLine($lines, $pattern) {
  $m = $lines | Select-String -Pattern $pattern | Select-Object -First 1
  if ($null -eq $m) { return '' }
  return $m.ToString().Trim()
}

function HeaderVal($lines, $name) {
  $m = $lines | Select-String -Pattern ("^" + [regex]::Escape($name) + ":") | Select-Object -First 1
  if ($null -eq $m) { return '' }
  return ($m.ToString().Split(':', 2)[1]).Trim()
}

function Test-Flow([string]$label, [string]$filePath, [string]$guestId) {
  $size = (Get-Item $filePath).Length

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $uploadJson = curl.exe -s -H "x-api-key: $key" -F "file=@$filePath;type=application/octet-stream" -F "guest_session_id=$guestId" http://localhost:3001/api/upload | ConvertFrom-Json
  $sw.Stop()
  $uploadMs = $sw.ElapsedMilliseconds

  $fid = $uploadJson.file_id
  $encFid = [System.Uri]::EscapeDataString($fid)

  $sw.Restart()
  $fullHeaders = curl.exe -s -D - -o NUL -H "x-api-key: $key" "http://localhost:3001/api/download/$($encFid)?inline=true"
  $sw.Stop()
  $fullMs = $sw.ElapsedMilliseconds

  $rangeEnd = [Math]::Min(1048575, $size - 1)
  $sw.Restart()
  $rangeHeaders = curl.exe -s -D - -o NUL -H "x-api-key: $key" -H "Range: bytes=0-$rangeEnd" "http://localhost:3001/api/download/$($encFid)?inline=true"
  $sw.Stop()
  $rangeMs = $sw.ElapsedMilliseconds

  $statusJson = curl.exe -s -H "x-api-key: $key" "http://localhost:3001/api/download/status/$($encFid)" | ConvertFrom-Json

  [pscustomobject]@{
    label = $label
    size_bytes = $size
    upload_http = 201
    upload_time_ms = $uploadMs
    full_download_status = (FirstLine $fullHeaders '^HTTP/1.1')
    full_content_length = (HeaderVal $fullHeaders 'Content-Length')
    full_accept_ranges = (HeaderVal $fullHeaders 'Accept-Ranges')
    full_download_time_ms = $fullMs
    range_download_status = (FirstLine $rangeHeaders '^HTTP/1.1')
    range_content_range = (HeaderVal $rangeHeaders 'Content-Range')
    range_content_length = (HeaderVal $rangeHeaders 'Content-Length')
    range_download_time_ms = $rangeMs
    tdlib_status_file_id = $statusJson.file_id
    tdlib_is_complete = $statusJson.is_complete
    tdlib_downloaded_size = $statusJson.downloaded_size
  }
}

$small = Test-Flow -label 'small-64KB' -filePath $tmpSmall -guestId 'devtool-small-64kb-v3'
$large = Test-Flow -label 'large-100MB' -filePath $tmpLarge -guestId 'devtool-large-100mb-v3'

@($small, $large) | ConvertTo-Json -Depth 6
