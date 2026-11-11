param(
  [ValidateSet('Prepare')][string]$Mode='Prepare',
  [Parameter(Mandatory=$true)][string]$Directory
)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$expected=[IO.Path]::GetFullPath((Join-Path $projectRoot '.local\network'))
if ([IO.Path]::GetFullPath($Directory) -ne $expected) { throw 'NETWORK_DIRECTORY_INVALID' }
$null=New-Item -ItemType Directory -Path $expected -Force
$networks=@(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and $_.NetAdapter.HardwareInterface } | Sort-Object { $_.NetIPv4Interface.InterfaceMetric })
if ($networks.Count -eq 0) { throw 'NETWORK_NOT_FOUND' }
$network=$networks[0]
$address=[string]$network.IPv4Address[0].IPAddress
$parsed=$null
if (-not [Net.IPAddress]::TryParse($address,[ref]$parsed)) { throw 'NETWORK_ADDRESS_INVALID' }
$parts=$parsed.GetAddressBytes()
if (-not ($parts.Length -eq 4 -and ($parts[0] -eq 10 -or ($parts[0] -eq 172 -and $parts[1] -ge 16 -and $parts[1] -le 31) -or ($parts[0] -eq 192 -and $parts[1] -eq 168)))) { throw 'NETWORK_PRIVATE_ADDRESS_REQUIRED' }
$authorityFile=Join-Path $expected 'authority.json'
$rootCertificate=$null
if (Test-Path -LiteralPath $authorityFile) {
  $authority=Get-Content -LiteralPath $authorityFile -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($authority.thumbprint -notmatch '^[A-Fa-f0-9]{40}$') { throw 'NETWORK_AUTHORITY_INVALID' }
  $rootCertificate=Get-Item -LiteralPath ('Cert:\CurrentUser\My\'+$authority.thumbprint) -ErrorAction Stop
  if (-not $rootCertificate.HasPrivateKey -or $rootCertificate.NotAfter -le (Get-Date).AddDays(400)) { throw 'NETWORK_AUTHORITY_EXPIRED' }
} else {
  $rootCertificate=New-SelfSignedCertificate -Type Custom -Subject 'CN=Nar Cicegi Local Network' -FriendlyName 'Nar Cicegi Network CA' -CertStoreLocation 'Cert:\CurrentUser\My' -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy NonExportable -KeyUsage CertSign,CRLSign -TextExtension @('2.5.29.19={critical}{text}CA=1&pathlength=0') -NotAfter (Get-Date).AddYears(5)
  [IO.File]::WriteAllText($authorityFile,(@{thumbprint=$rootCertificate.Thumbprint}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
}
$rootFile=Join-Path $expected 'root.cer'
$null=Export-Certificate -Cert $rootCertificate -FilePath $rootFile -Force
$leaf=New-SelfSignedCertificate -Type Custom -Subject ('CN='+$address) -Signer $rootCertificate -FriendlyName 'Nar Cicegi Network Server' -CertStoreLocation 'Cert:\CurrentUser\My' -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -KeyUsage DigitalSignature,KeyEncipherment -TextExtension @('2.5.29.19={critical}{text}CA=0','2.5.29.37={text}1.3.6.1.5.5.7.3.1',('2.5.29.17={text}IPAddress='+$address)) -NotAfter (Get-Date).AddYears(1)
$bytes=New-Object byte[] 32
$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$secure=ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
try {
  $null=Export-PfxCertificate -Cert $leaf -FilePath (Join-Path $expected 'server.pfx') -Password $secure -ChainOption EndEntityCertOnly -CryptoAlgorithmOption AES256_SHA256 -Force
  $null=Export-Certificate -Cert $leaf -FilePath (Join-Path $expected 'server.cer') -Force
  $metadata=@{protectedPassphrase=(ConvertFrom-SecureString $secure)}
  $pending=Join-Path $expected 'tls.json.pending'
  [IO.File]::WriteAllText($pending,($metadata|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $pending -Destination (Join-Path $expected 'tls.json') -Force
} finally {
  # Remove only this freshly generated leaf private key after its encrypted export.
  Remove-Item -LiteralPath ('Cert:\CurrentUser\My\'+$leaf.Thumbprint) -DeleteKey -Force
  [Array]::Clear($bytes,0,$bytes.Length)
}
@{address=$address;interfaceIndex=[int]$network.InterfaceIndex}|ConvertTo-Json -Compress
