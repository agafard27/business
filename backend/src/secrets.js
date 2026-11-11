import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

// Windows DPAPI via the existing signed PowerShell installation. Secrets only cross
// the child process environment/stdout, never a command argument or plaintext file.
export async function protect(value) {
  if (process.platform !== 'win32') throw Object.assign(new Error('Windows required'), { code: 'CONFIG_ERROR' });
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$ErrorActionPreference="Stop"; $secure=ConvertTo-SecureString $env:NAR_MEMORY_SECRET -AsPlainText -Force; ConvertFrom-SecureString $secure'],
  { windowsHide: true, timeout: 10000, env: { ...process.env, NAR_MEMORY_SECRET: value } });
  return stdout.trim();
}

export async function unprotect(value) {
  if (process.platform !== 'win32') throw Object.assign(new Error('Windows required'), { code: 'CONFIG_ERROR' });
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$ErrorActionPreference="Stop"; $s=ConvertTo-SecureString $env:NAR_MEMORY_SECRET; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}'],
  { windowsHide: true, timeout: 10000, env: { ...process.env, NAR_MEMORY_SECRET: value } });
  return stdout;
}
