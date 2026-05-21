# Start RROx release build (kills stale instances first)
$ErrorActionPreference = 'Stop'
$releaseDir = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '_release')).Path
$exe = Join-Path $releaseDir 'RailroadsOnline Extended.exe'

if (-not (Test-Path $exe)) {
    Write-Error "Not found: $exe - run from repo with _release folder present."
}

Get-CimInstance Win32_Process -Filter "Name = 'RailroadsOnline Extended.exe'" -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Write-Host "Starting RROx from $releaseDir"
$proc = Start-Process -FilePath $exe -WorkingDirectory $releaseDir -PassThru -WindowStyle Normal
Start-Sleep -Seconds 6

$running = Get-CimInstance Win32_Process -Filter "Name = 'RailroadsOnline Extended.exe'" -ErrorAction SilentlyContinue
if (-not $running) {
    Write-Warning "RROx process not found after start (may have exited). Try double-click:"
    Write-Host "  $exe"
    explorer.exe "/select,`"$exe`""
    exit 1
}

$windows = Get-Process -Id ($running | Select-Object -ExpandProperty ProcessId -Unique) -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Select-Object Id, MainWindowTitle

Write-Host "RROx running ($($running.Count) process(es))."
if ($windows) {
    Write-Host "Visible windows:"
    $windows | ForEach-Object { Write-Host "  - $($_.MainWindowTitle) (pid $($_.Id))" }
    Write-Host "Tip: Alt+Tab or check the taskbar if the main window is behind the game."
} else {
    Write-Warning "Process running but no main window yet - wait a few seconds, then Alt+Tab."
}

exit 0
