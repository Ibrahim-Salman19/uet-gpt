$lockFile = '.agent\run.lock'
if (Test-Path $lockFile) {
    $lockAge = (Get-Date) - (Get-Item $lockFile).LastWriteTime
    if ($lockAge.TotalSeconds -lt 7200) {
        Write-Output "ABORT: Previous run still active. Exiting."
        exit 0
    } else {
        Write-Output "WARN: Stale lock. Clearing."
        Remove-Item $lockFile -Force
    }
}
New-Item -ItemType Directory -Force -Path '.agent' | Out-Null
$time = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
Set-Content -Path $lockFile -Value "$pid:$time"
Write-Output "Lock acquired."
