# Dump live UE struct from running game (Electron Node ABI for injector.node).
# Close RROx first. arr-Win64-Shipping.exe must be running.
param(
    [Parameter( Position = 0 )]
    [string] $StructName = 'Class arr.ARRPlayerController'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if ( -not ( Get-Process -Name 'arr-Win64-Shipping' -ErrorAction SilentlyContinue ) ) {
    Write-Error 'Game not running. Start Railroads Online first.'
}

$electron = Join-Path $root '_release\RailroadsOnline Extended.exe'
if ( -not ( Test-Path $electron ) ) {
    Write-Error "Electron runtime not found: $electron"
}

Write-Host "Dumping: $StructName"
$env:ELECTRON_RUN_AS_NODE = '1'
& $electron ( Join-Path $root 'scripts\dump-struct.mjs' ) $StructName
