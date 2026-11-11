$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$dependencyRoot=Join-Path $projectRoot '.local/dependencies'
$null=New-Item -ItemType Directory -Path $dependencyRoot -Force
$sqliteLock=Get-Content -LiteralPath (Join-Path $projectRoot 'dependencies/sqlite.lock.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($sqliteLock.url -notmatch '^https://www\.sqlite\.org/[0-9]{4}/sqlite-dll-win-x86-[0-9]+\.zip$' -or $sqliteLock.sha3_256 -notmatch '^[a-f0-9]{64}$') { throw 'SQLITE_LOCK_INVALID' }
$archivePath=Join-Path $dependencyRoot 'sqlite-x86.zip'
if (-not (Test-Path -LiteralPath $archivePath)) {
  $downloadPath=$archivePath+'.pending'
  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $sqliteLock.url -OutFile $downloadPath -UseBasicParsing -TimeoutSec 60
  Move-Item -LiteralPath $downloadPath -Destination $archivePath -Force
}
# The SHA3 checker runs on the development computer, never on the IBM target.
$actualHash= & node.exe --input-type=module -e "import{readFileSync}from'node:fs';import{createHash}from'node:crypto';console.log(createHash('sha3-256').update(readFileSync(process.argv[1])).digest('hex'));" $archivePath
if ($LASTEXITCODE -ne 0 -or $actualHash.Trim() -ne $sqliteLock.sha3_256) { throw 'SQLITE_DOWNLOAD_HASH_MISMATCH' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $dllEntries=@($archive.Entries | Where-Object {$_.FullName -eq 'sqlite3.dll'})
  if ($dllEntries.Count -ne 1) { throw 'SQLITE_DLL_MISSING' }
  [IO.Compression.ZipFileExtensions]::ExtractToFile($dllEntries[0],(Join-Path $dependencyRoot 'sqlite3.dll'),$true)
} finally {$archive.Dispose()}
Write-Output ('SQLite '+$sqliteLock.version+' x86: SHA3-256 verified.')

