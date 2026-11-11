param(
  [Parameter(Mandatory=$true)][string]$Address,
  [Parameter(Mandatory=$true)][int]$InterfaceIndex,
  [Parameter(Mandatory=$true)][string]$NodePath
)
$ErrorActionPreference='Stop'
$parsed=$null
if (-not [Net.IPAddress]::TryParse($Address,[ref]$parsed)) { throw 'NETWORK_ADDRESS_INVALID' }
$parts=$parsed.GetAddressBytes()
if (-not ($parts.Length -eq 4 -and ($parts[0] -eq 10 -or ($parts[0] -eq 172 -and $parts[1] -ge 16 -and $parts[1] -le 31) -or ($parts[0] -eq 192 -and $parts[1] -eq 168)))) { throw 'NETWORK_PRIVATE_ADDRESS_REQUIRED' }
if ($InterfaceIndex -lt 1 -or -not (Get-NetIPAddress -InterfaceIndex $InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -eq $Address })) { throw 'NETWORK_CHANGED' }
$resolvedNode=(Get-Item -LiteralPath $NodePath -ErrorAction Stop).FullName
if ([IO.Path]::GetFileName($resolvedNode) -ne 'node.exe') { throw 'NETWORK_PROGRAM_INVALID' }
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$sha=[Security.Cryptography.SHA256]::Create()
try {$projectHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToUpperInvariant())))).Replace('-','').Substring(0,12)} finally {$sha.Dispose()}
$ruleName='NarCicegi-LAN-'+$projectHash
# This script is invoked only by a local administrator's explicit trusted-network activation.
Set-NetConnectionProfile -InterfaceIndex $InterfaceIndex -NetworkCategory Private
$rule=Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
if ($rule) { Remove-NetFirewallRule -Name $ruleName }
$null=New-NetFirewallRule -Name $ruleName -DisplayName ('Nar Cicegi HTTPS '+$projectHash) -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5443 -LocalAddress $Address -RemoteAddress LocalSubnet -Profile Private -Program $resolvedNode -EdgeTraversalPolicy Block
