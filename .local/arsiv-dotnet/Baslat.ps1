. "$PSScriptRoot/scripts/Ortam.ps1"
if (-not (Test-Path -LiteralPath $env:NAR_LOCAL_CONFIG)) {
    Write-Host 'MySQL kurulumu henuz yapilmamis. Durum ekrani hazir degil bilgisini gosterecek. Kurulum.ps1 ile baglayin.'
    $env:NAR_LOCAL_CONFIG = $null
}
& dotnet build $apiProject --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Derleme tamamlanamadi. Once Kurulum.ps1 veya dotnet restore calistirin.' }
Write-Host 'Sistem durumu: http://127.0.0.1:5080 (durdurmak icin Ctrl+C)'
Push-Location (Join-Path $projectRoot 'src/NarCicegi.Api')
try { & dotnet run --project $apiProject --no-build -- --contentRoot (Join-Path $projectRoot 'src/NarCicegi.Api') } finally { Pop-Location }
