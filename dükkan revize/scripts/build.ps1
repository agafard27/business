param([switch]$SkipDependencies)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
if (-not $SkipDependencies) { & (Join-Path $PSScriptRoot 'dependencies.ps1') }
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe'
$referenceRoot=Join-Path ${env:ProgramFiles(x86)} 'Reference Assemblies/Microsoft/Framework/.NETFramework/v4.8'
if (-not (Test-Path -LiteralPath $compiler) -or -not (Test-Path -LiteralPath $referenceRoot)) { throw 'NET48_DEVELOPER_PACK_REQUIRED_ON_BUILD_COMPUTER' }
$outputRoot=Join-Path $projectRoot '.local/bin'
$null=New-Item -ItemType Directory -Path $outputRoot -Force
$sources=@(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src') -Filter '*.cs' -Recurse | ForEach-Object {$_.FullName})
$references=@('mscorlib','System','System.Core','System.Drawing','System.Windows.Forms') | ForEach-Object {'/reference:'+(Join-Path $referenceRoot ($_+'.dll'))}
$common=@('/nologo','/noconfig','/nostdlib+','/warnaserror+','/warn:4','/platform:x86','/optimize+','/codepage:65001')+$references
& $compiler @common '/target:winexe' ('/out:'+(Join-Path $outputRoot 'DukkanRevize.exe')) ('/win32manifest:'+(Join-Path $projectRoot 'src/DukkanRevize/app.manifest')) @sources
if ($LASTEXITCODE -ne 0) { throw 'APPLICATION_BUILD_FAILED' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'src/DukkanRevize/App.config') -Destination (Join-Path $outputRoot 'DukkanRevize.exe.config') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot '.local/dependencies/sqlite3.dll') -Destination (Join-Path $outputRoot 'sqlite3.dll') -Force
$testSources=@(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'tests') -Filter '*.cs' | ForEach-Object {$_.FullName})
& $compiler @common '/target:exe' '/main:DukkanRevize.Tests.TestRunner' ('/out:'+(Join-Path $outputRoot 'DukkanRevize.Tests.exe')) ('/win32manifest:'+(Join-Path $projectRoot 'src/DukkanRevize/app.manifest')) @sources @testSources
if ($LASTEXITCODE -ne 0) { throw 'TEST_BUILD_FAILED' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'src/DukkanRevize/App.config') -Destination (Join-Path $outputRoot 'DukkanRevize.Tests.exe.config') -Force
Write-Output ('Build ready: '+(Join-Path $outputRoot 'DukkanRevize.exe'))

