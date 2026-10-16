# Builds the archive to send to the server (code only: no .env, no secrets, no node_modules, no mobile app).
# From the project folder, in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\package_release.ps1
# Result: ..\gofix-release.tar.gz (next to the gofix-mvp folder)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path (Split-Path -Parent $root) "gofix-release.tar.gz"

# Files read by Linux tools must use LF line endings (the project is edited on Windows).
$utf8 = New-Object System.Text.UTF8Encoding($false)
$lf = @("scripts\*.sh", "deploy\nginx\conf.d\*.conf", "frontend\nginx.conf", "backend\Dockerfile", "frontend\Dockerfile",
        "docker-compose.yml", ".env.example")
foreach ($pattern in $lf) {
  foreach ($f in Get-ChildItem -Path (Join-Path $root $pattern) -File -ErrorAction SilentlyContinue) {
    $text = [IO.File]::ReadAllText($f.FullName)
    if ($text.Contains("`r`n")) { [IO.File]::WriteAllText($f.FullName, $text.Replace("`r`n", "`n"), $utf8) }
  }
}

if (Test-Path $out) { Remove-Item $out -Confirm:$false }
& "$env:SystemRoot\System32\tar.exe" -czf $out `
  --exclude=node_modules --exclude=__pycache__ --exclude=.git --exclude=.env `
  --exclude=./mobile --exclude=./backups --exclude=./frontend/build --exclude=./backend/storage `
  -C $root .
if ($LASTEXITCODE -ne 0) { throw "tar failed ($LASTEXITCODE)" }

$size = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Host "Archive ready: $out ($size Mo)"
Write-Host "Send it to the server:  scp `"$out`" root@<IP_DU_SERVEUR>:/opt/"
