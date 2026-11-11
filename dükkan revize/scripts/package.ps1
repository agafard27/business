param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
if (-not $SkipBuild) { & (Join-Path $PSScriptRoot 'build.ps1') }
& (Join-Path $PSScriptRoot 'test.ps1') -SkipBuild
$projectRoot=Split-Path -Parent $PSScriptRoot
$stage=Join-Path $projectRoot '.local/package'
$null=New-Item -ItemType Directory -Path $stage -Force
foreach ($name in @('DukkanRevize.exe','DukkanRevize.exe.config','sqlite3.dll')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot ('.local/bin/'+$name)) -Destination (Join-Path $stage $name) -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'CIHAZDA-CALISTIRMA.txt') -Destination $stage -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'dependencies/sqlite.lock.json') -Destination $stage -Force
$outputRoot=Join-Path $projectRoot 'dagitim'
$null=New-Item -ItemType Directory -Path $outputRoot -Force
$packagePath=Join-Path $outputRoot 'DukkanRevize-CihazDenemesi-x86.zip'
# A fixed file list keeps test runners and stale business data out of the package.
$packageFiles=@('DukkanRevize.exe','DukkanRevize.exe.config','sqlite3.dll','CIHAZDA-CALISTIRMA.txt','sqlite.lock.json') | ForEach-Object {Join-Path $stage $_}
Compress-Archive -LiteralPath $packageFiles -DestinationPath $packagePath -Force
Get-Item -LiteralPath $packagePath | Select-Object FullName,Length

