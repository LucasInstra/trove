# Assembles the local release folder: the MSI, the portable exe and its zip.
param(
    [string]$Root = "C:\Users\Lucas\opencode\cofre"
)

$ErrorActionPreference = "Stop"
$target = Join-Path $Root "src-tauri\target\release"
$out = Join-Path $Root "release"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$msi = Get-ChildItem (Join-Path $target "bundle\msi\*.msi") -ErrorAction SilentlyContinue | Select-Object -First 1
$exe = Join-Path $target "trove.exe"

if (-not $msi) { throw "no MSI in $target\bundle\msi" }
if (-not (Test-Path $exe)) { throw "no trove.exe in $target" }

Copy-Item $msi.FullName (Join-Path $out "trove-setup.msi") -Force
Copy-Item $exe (Join-Path $out "trove.exe") -Force
Compress-Archive -Path $exe -DestinationPath (Join-Path $out "trove-portable-x64.zip") -Force
Write-Output "MSI: $($msi.Name) $([math]::Round($msi.Length / 1MB, 1)) MB"
Write-Output "EXE: $([math]::Round((Get-Item $exe).Length / 1MB, 1)) MB"
Write-Output "folder: $out"
