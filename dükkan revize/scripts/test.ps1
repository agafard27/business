param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
if (-not $SkipBuild) { & (Join-Path $PSScriptRoot 'build.ps1') }
$projectRoot=Split-Path -Parent $PSScriptRoot
& (Join-Path $projectRoot '.local/bin/DukkanRevize.Tests.exe') (Join-Path $projectRoot '.local/test-results')
if ($LASTEXITCODE -ne 0) { throw 'TESTS_FAILED' }

