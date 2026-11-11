param([switch]$SkipRestore)
. "$PSScriptRoot/scripts/Ortam.ps1"
Write-Host 'Nar Cicegi - MySQL ilk kurulumu'
Write-Host 'Mevcut MySQL yonetici parolaniz terminalde gizli olarak sorulacak.'
if (-not $SkipRestore) {
    & dotnet restore (Join-Path $projectRoot 'NarCicegi.slnx') --locked-mode --configfile (Join-Path $projectRoot 'NuGet.Config')
    if ($LASTEXITCODE -ne 0) { throw 'Paketler yuklenemedi.' }
}
# The setup command must be able to create the optional local config itself.
$env:NAR_LOCAL_CONFIG = $null
& dotnet build $apiProject --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Derleme tamamlanamadi.' }
$env:NAR_LOCAL_CONFIG = Join-Path $projectRoot '.local/database.json'
Push-Location (Join-Path $projectRoot 'src/NarCicegi.Api')
try {
    & dotnet run --project $apiProject --no-build -- --contentRoot (Join-Path $projectRoot 'src/NarCicegi.Api') --setup-local
    if ($LASTEXITCODE -ne 0) { throw 'Kurulum tamamlanamadi. Yukaridaki aciklamayi kontrol edin.' }
} finally { Pop-Location }
