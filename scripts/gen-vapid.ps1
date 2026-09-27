$cng = [System.Security.Cryptography.ECDsaCng]::new(256)
$params = $cng.ExportParameters($true)

function To-B64Url([byte[]]$arr) {
    return [Convert]::ToBase64String($arr).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$prefix = [byte[]]@([byte]4)
$pubBytes = New-Object byte[] 65
$pubBytes[0] = 4
[Array]::Copy($params.Q.X, 0, $pubBytes, 1, 32)
[Array]::Copy($params.Q.Y, 0, $pubBytes, 33, 32)

$privBytes = $params.D

$pubB64 = To-B64Url $pubBytes
$privB64 = To-B64Url $privBytes

Write-Host "VAPID_PUBLIC_KEY=$pubB64"
Write-Host "VAPID_PRIVATE_KEY=$privB64"
