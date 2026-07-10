param(
  [string] $EveRoot = "E:\Projects\Eve",
  [string] $AetheriaRoot = "E:\Projects\Aetheria",
  [string] $ElectronPath = "node_modules\electron\dist\electron.exe",
  [string] $OutputRoot = "artifacts\capture"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$ElectronPath = if ([IO.Path]::IsPathRooted($ElectronPath)) { $ElectronPath } else { Join-Path $repoRoot $ElectronPath }
$output = if ([IO.Path]::IsPathRooted($OutputRoot)) { $OutputRoot } else { Join-Path $repoRoot $OutputRoot }
$captureApp = Join-Path $repoRoot "capture"
if (-not (Test-Path -LiteralPath $ElectronPath)) { throw "Electron executable not found: $ElectronPath" }

$cases = @(
  @{
    id = "generic-world"
    advertisement = Join-Path $EveRoot "web\fixtures\eve-world-smoke.provider-advertisement.json"
    surface = Join-Path $EveRoot "web\fixtures\eve-world-smoke-surface.json"
    surfaceId = "eve.world-smoke.surface"
  },
  @{
    id = "aetheria-world"
    advertisement = Join-Path $AetheriaRoot "conformance\eve\aetheria.provider-advertisement.json"
    surface = Join-Path $AetheriaRoot "conformance\eve\aetheria-world-surface.json"
    surfaceId = "aetheria.daemon.game"
  }
)

foreach ($case in $cases) {
  $caseRoot = Join-Path $output $case.id
  New-Item -ItemType Directory -Force -Path $caseRoot | Out-Null
  $stdout = Join-Path $caseRoot "capture.stdout.log"
  $stderr = Join-Path $caseRoot "capture.stderr.log"
  $arguments = @(
    $captureApp,
    "--advertisement", $case.advertisement,
    "--surface", $case.surface,
    "--surface-id", $case.surfaceId,
    "--output", (Join-Path $caseRoot "window.png"),
    "--witness", (Join-Path $caseRoot "runtime-witness.json")
  )
  $process = Start-Process -FilePath $ElectronPath -ArgumentList $arguments -WorkingDirectory $repoRoot `
    -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    $diagnosticText = Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue
    $diagnostic = if ($diagnosticText) { $diagnosticText.Trim() } else { "See runtime-witness.json.trace.log" }
    throw "EveElectron capture failed for $($case.id) with exit code $($process.ExitCode): $diagnostic"
  }
}

Write-Host "EveElectron captures: $output"
