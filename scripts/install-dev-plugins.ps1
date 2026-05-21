# Copy built workspace plugins into RROx userData (for local testing)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$userPlugins = Join-Path $env:APPDATA 'RailroadsOnline Extended\plugins\@rrox-plugins'

foreach ($name in @('world', 'map')) {
    $src = Join-Path $repo "plugins\$name"
    $dst = Join-Path $userPlugins $name

    if (-not (Test-Path (Join-Path $src 'dist\controller\controller.js'))) {
        Write-Host "Building @rrox-plugins/$name ..."
        Push-Location $src
        node "$repo\packages\plugin\cli.js" clean 2>$null
        node "$repo\packages\plugin\cli.js" build
        if ($LASTEXITCODE -ne 0) { throw "Build failed for $name" }
        Pop-Location
    }

    Write-Host "Installing $name -> $dst"
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
    Copy-Item $src $dst -Recurse -Force
}

Write-Host "Done. Restart RROx and attach while IN A RUNNING SESSION (not main menu only)."
