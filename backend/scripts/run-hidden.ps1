$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$entry = Join-Path $PSScriptRoot 'start.js'
$logDirectory = Join-Path $projectRoot '.local/startup'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$process = Start-Process -FilePath $nodePath -ArgumentList ('"' + $entry + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'stdout.log') -RedirectStandardError (Join-Path $logDirectory 'stderr.log')
exit $process.ExitCode
