$key = '4vlPHE1GtjLHl7e9iz03B7PS8JFhbI4YOXJR4ZJ0DADggbbi'

# The ISTIS jpeg that fails with TDLib (has expired photo file reference)
$fileId = 'AgACAv7___8hBgAE5jY8zgACAfpplrvoX6NexEq8A5hxJsd0lCpHZwACQg5rG-7tsVTnfAABKXcZx_wBAAMCAANpAAM6BA'
# telegram_message_id from DB = 530579456 (this is TDLib format = server_msg_id * 1048576)

Write-Output "=== Test 1: Download with message_id (triggers forwardMessage refresh) ==="
$url = "http://localhost:3001/api/download/$fileId`?inline=true&message_id=530579456"
$req = [System.Net.HttpWebRequest]::Create($url)
$req.Headers.Add("x-api-key", $key)
$req.Timeout = 60000
try {
    $resp = $req.GetResponse()
    Write-Output "SUCCESS: Status=$($resp.StatusCode) Length=$($resp.ContentLength) Type=$($resp.ContentType)"
    $resp.Close()
} catch [System.Net.WebException] {
    $resp = $_.Exception.Response
    if ($resp) { 
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        Write-Output "FAILED $([int]$resp.StatusCode): $($sr.ReadToEnd())"
        $sr.Close(); $resp.Close() 
    }
}

Write-Output ""
Write-Output "=== Test 2: Download a working document (PDF) ==="
$docId = 'BQACAgUAAyEGAATmNjzOAAMXaZRUeH_nNgI-uwQ78xL9kv7jk_UAAugfAALkU6FU3_3R4tcuvBw6BA'
$req2 = [System.Net.HttpWebRequest]::Create("http://localhost:3001/api/download/$docId`?inline=true")
$req2.Headers.Add("x-api-key", $key)
$req2.Timeout = 60000
try {
    $resp = $req2.GetResponse()
    Write-Output "SUCCESS: Status=$($resp.StatusCode) Length=$($resp.ContentLength) Type=$($resp.ContentType)"
    $resp.Close()
} catch [System.Net.WebException] {
    $resp = $_.Exception.Response
    if ($resp) {
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        Write-Output "FAILED $([int]$resp.StatusCode): $($sr.ReadToEnd())"
        $sr.Close(); $resp.Close()
    }
}
