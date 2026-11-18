# Reset a GB CarSys user's password with hidden input (Windows).
# Usage: powershell -ExecutionPolicy Bypass -File database\reset-password.ps1 -User patpon [-Php C:\xampp\php\php.exe]
param(
  [Parameter(Mandatory = $true)][string]$User,
  [string]$Php = 'C:\xampp\php\php.exe'
)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
if (-not (Test-Path $Php)) { $Php = 'php' }

function Read-Plain([string]$prompt) {
  $s = Read-Host -Prompt $prompt -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

$p1 = Read-Plain 'New password (min 6 chars)'
$p2 = Read-Plain 'Confirm new password'
$script = Join-Path $PSScriptRoot 'reset-password.php'
# send both lines via stdin so the password never appears on a command line
$psi = New-Object Diagnostics.ProcessStartInfo $Php, "`"$script`" --user=$User"
$psi.UseShellExecute = $false; $psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
$psi.StandardOutputEncoding = [Text.Encoding]::UTF8; $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
$psi.EnvironmentVariables['GBCARS_NOPROMPT'] = '1'
$proc = [Diagnostics.Process]::Start($psi)
$enc = New-Object Text.UTF8Encoding $false
$w = New-Object IO.StreamWriter($proc.StandardInput.BaseStream, $enc)
$w.Write("$p1`n$p2`n"); $w.Close()
$out = $proc.StandardOutput.ReadToEnd(); $err = $proc.StandardError.ReadToEnd(); $proc.WaitForExit()
$p1 = $null; $p2 = $null
Write-Host $out
if ($err) { Write-Host $err -ForegroundColor Red }
exit $proc.ExitCode
