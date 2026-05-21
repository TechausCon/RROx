# Deploy map plugin build output to AppData (mirrors dist/renderer + dist/controller).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root 'plugins\map\dist'
$dst = Join-Path $env:APPDATA 'RailroadsOnline Extended\plugins\@rrox-plugins\map\dist'

if ( -not ( Test-Path ( Join-Path $src 'renderer\renderer.js' ) ) ) {
    Write-Error "Build missing. Run: cd plugins\map && npm run build"
}

New-Item -ItemType Directory -Force -Path ( Join-Path $dst 'renderer' ) | Out-Null
New-Item -ItemType Directory -Force -Path ( Join-Path $dst 'controller' ) | Out-Null

robocopy ( Join-Path $src 'renderer' ) ( Join-Path $dst 'renderer' ) /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ( $LASTEXITCODE -ge 8 ) { throw "robocopy renderer failed: $LASTEXITCODE" }

robocopy ( Join-Path $src 'controller' ) ( Join-Path $dst 'controller' ) /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ( $LASTEXITCODE -ge 8 ) { throw "robocopy controller failed: $LASTEXITCODE" }

Write-Host "Deployed map plugin to $dst"
if ( Select-String -Path ( Join-Path $dst 'renderer\renderer.js' ) -Pattern '\.e\(679\)' -Quiet ) {
    Write-Host 'OK: renderer.js references chunk 679'
}
if ( Select-String -Path ( Join-Path $dst 'renderer\679.js' ) -Pattern 'font-weight:800' -Quiet ) {
    Write-Host 'OK: 679.js contains player name label styles'
}
