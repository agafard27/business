[CmdletBinding(SupportsShouldProcess=$true)]
param([switch]$Remove,[switch]$Start,[switch]$Restart)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$entry = Join-Path $projectRoot 'backend/scripts/run-hidden.ps1'
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $entry + '"'
$powershellPath = Join-Path $PSHOME 'powershell.exe'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$hasher = [Security.Cryptography.SHA256]::Create()
try { $suffix = ([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant())))).Replace('-','').Substring(0,12) } finally { $hasher.Dispose() }
$taskName = "NarCicegi-$suffix"
function Stop-ProjectNodes {
  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  # Stop the supervisor before its server. Match the complete executable/entry
  # arguments, never every node.exe or processes that merely mention the folder.
  foreach ($relativeEntry in @('backend/scripts/start.js','backend/src/server.js')) {
    $expectedEntry = Join-Path $projectRoot $relativeEntry
    $pattern = '^(?:"[^"]*\\node\.exe"|[^\s]+\\node\.exe)\s+"?' + [regex]::Escape($expectedEntry) + '"?\s*$'
    $matches = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.ExecutablePath -eq $nodePath -and $_.CommandLine -match $pattern })
    foreach ($candidate in $matches) {
      $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($candidate.ProcessId)" -ErrorAction SilentlyContinue
      if ($current -and $current.ExecutablePath -eq $nodePath -and $current.CommandLine -match $pattern) { Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop }
    }
  }
}
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and ($existing.Actions.Count -ne 1 -or $existing.Actions[0].Arguments -ne $arguments)) { throw 'Task name belongs to a different action. No change made.' }
if ($Restart) {
  if (-not $existing) { throw 'Project startup task is not installed.' }
  if ($PSCmdlet.ShouldProcess($taskName,'Restart this project task')) {
    Stop-ScheduledTask -TaskName $taskName
    Stop-ProjectNodes
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do { Start-Sleep -Milliseconds 200; $state = (Get-ScheduledTask -TaskName $taskName).State } while ($state -eq 'Running' -and [DateTime]::UtcNow -lt $deadline)
    if ($state -eq 'Running') { throw 'Task did not stop. No second process started.' }
    Start-ScheduledTask -TaskName $taskName
  }
} elseif ($Remove) {
  if ($existing -and $PSCmdlet.ShouldProcess($taskName,'Remove this project logon task')) { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue; Stop-ProjectNodes; Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
} elseif ($PSCmdlet.ShouldProcess($taskName,'Install current-user logon task')) {
  $action = New-ScheduledTaskAction -Execute $powershellPath -Argument $arguments -WorkingDirectory $projectRoot
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
  $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Nar Cicegi loopback backend. Uses this Windows user DPAPI settings.' -Force | Out-Null
  if ($Start) { Start-ScheduledTask -TaskName $taskName }
}
Write-Output "Task: $taskName; user: $identity; project: $projectRoot"
