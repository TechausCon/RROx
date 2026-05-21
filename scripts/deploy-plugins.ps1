# Deploy world + map plugin builds to AppData.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

function Deploy-Plugin( $name ) {
    $src = Join-Path $root "plugins\$name\dist"
    $dst = Join-Path $env:APPDATA "RailroadsOnline Extended\plugins\@rrox-plugins\$name\dist"
    if ( -not ( Test-Path ( Join-Path $src 'renderer\renderer.js' ) ) -and $name -eq 'map' ) {
        Write-Error "Missing map renderer build"
    }
    if ( -not ( Test-Path ( Join-Path $src 'controller\controller.js' ) ) ) {
        Write-Error "Missing $name controller build"
    }
    New-Item -ItemType Directory -Force -Path ( Join-Path $dst 'renderer' ), ( Join-Path $dst 'controller' ) | Out-Null
    robocopy ( Join-Path $src 'renderer' ) ( Join-Path $dst 'renderer' ) /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    if ( $LASTEXITCODE -ge 8 ) { throw "robocopy $name renderer failed" }
    robocopy ( Join-Path $src 'controller' ) ( Join-Path $dst 'controller' ) /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    if ( $LASTEXITCODE -ge 8 ) { throw "robocopy $name controller failed" }
    Write-Host "Deployed $name -> $dst"
}

Deploy-Plugin 'world'
Deploy-Plugin 'map'
Write-Host 'Done.'
