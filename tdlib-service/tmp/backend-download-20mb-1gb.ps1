$ErrorActionPreference = 'Stop'

$key = '4vlPHE1GtjLHl7e9iz03B7PS8JFhbI4YOXJR4ZJ0DADggbbi'
$sizesMb = @(20, 100, 250, 500, 1024)
$outFile = 'e:\Poject\cloudvault\tmp\download-20mb-1gb-results.json'

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

function Run-One([int]$sizeMb) {
  $bytes = $sizeMb * 1MB
  $tmp = Join-Path $env:TEMP ("cv_" + $sizeMb + "mb.bin")
  if (!(Test-Path $tmp)) {
    fsutil file createnew $tmp $bytes | Out-Null
  }

  $guest = "devtool-range-" + $sizeMb + "mb-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $uploadRaw = curl.exe -s -H "x-api-key: $key" -F "file=@$tmp;type=application/octet-stream" -F "guest_session_id=$guest" http://localhost:3001/api/upload
  $sw.Stop()
  $uploadMs = $sw.ElapsedMilliseconds

  $uploadJson = $null
  try {
    $uploadJson = $uploadRaw | ConvertFrom-Json
  } catch {
    return [pscustomobject]@{
      size_mb = $sizeMb
      upload_ok = $false
      upload_time_ms = $uploadMs
      upload_raw = $uploadRaw
      error = 'upload response not JSON'
    }
  }

  if (-not $uploadJson.file_id) {
    return [pscustomobject]@{
      size_mb = $sizeMb
      upload_ok = $false
      upload_time_ms = $uploadMs
      upload_json = $uploadJson
      error = 'missing file_id'
    }
  }

  $fileId = [string]$uploadJson.file_id
  $encFileId = [System.Uri]::EscapeDataString($fileId)
  $dlUrl = "http://localhost:3001/api/download/$($encFileId)?inline=true"
  $statusUrl = "http://localhost:3001/api/download/status/$($encFileId)"

  $sw.Restart()
  $fullHeaders = curl.exe -s -D - -o NUL -H "x-api-key: $key" $dlUrl
  $sw.Stop()
  $fullMs = $sw.ElapsedMilliseconds

  $rangeEnd = [Math]::Min((1MB - 1), ($bytes - 1))
  $sw.Restart()
  $rangeHeaders = curl.exe -s -D - -o NUL -H "x-api-key: $key" -H "Range: bytes=0-$rangeEnd" $dlUrl
  $sw.Stop()
  $rangeMs = $sw.ElapsedMilliseconds

  $sw.Restart()
  $fullHeaders2 = curl.exe -s -D - -o NUL -H "x-api-key: $key" $dlUrl
  $sw.Stop()
  $fullMs2 = $sw.ElapsedMilliseconds

  $statusJson = $null
  try {
    $statusJson = curl.exe -s -H "x-api-key: $key" $statusUrl | ConvertFrom-Json
  } catch {
    $statusJson = $null
  }

  return [pscustomobject]@{
    size_mb = $sizeMb
    size_bytes = $bytes
    upload_ok = $true
    upload_time_ms = $uploadMs
    upload_file_id_prefix = $fileId.Substring(0, [Math]::Min($fileId.Length, 24))
    encoded_file_id = $encFileId
    full_1_status = (FirstLine $fullHeaders '^HTTP/1.1')
    full_1_content_length = (HeaderVal $fullHeaders 'Content-Length')
    full_1_time_ms = $fullMs
    range_status = (FirstLine $rangeHeaders '^HTTP/1.1')
    range_content_range = (HeaderVal $rangeHeaders 'Content-Range')
    range_content_length = (HeaderVal $rangeHeaders 'Content-Length')
    range_time_ms = $rangeMs
    full_2_status = (FirstLine $fullHeaders2 '^HTTP/1.1')
    full_2_time_ms = $fullMs2
    status_is_complete = if ($statusJson) { $statusJson.is_complete } else { $null }
    status_downloaded_size = if ($statusJson) { $statusJson.downloaded_size } else { $null }
  }
}

$results = @()
foreach ($s in $sizesMb) {
  $results += Run-One -sizeMb $s
}

$results | ConvertTo-Json -Depth 8 | Set-Content -Path $outFile -Encoding UTF8
$results | ConvertTo-Json -Depth 8
