param([switch]$Integration)
. "$PSScriptRoot/scripts/Ortam.ps1"
$env:NAR_LOCAL_CONFIG = $null
& dotnet build (Join-Path $projectRoot 'NarCicegi.slnx') --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Derleme tamamlanamadi.' }
$testProject = Join-Path $projectRoot 'tests/NarCicegi.Checks/NarCicegi.Checks.csproj'
Push-Location $projectRoot
try {
    if ($Integration) { & dotnet run --project $testProject --no-build -- --integration }
    else { & dotnet run --project $testProject --no-build }
    if ($LASTEXITCODE -ne 0) { throw 'Kontroller basarisiz.' }
} finally { Pop-Location }
