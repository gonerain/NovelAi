$ErrorActionPreference = "Stop"
$tsc = Join-Path $PSScriptRoot "node_modules\.bin\tsc.cmd"

if (-not (Test-Path $tsc)) {
  throw "Local tsc executable not found. Run 'cmd /c npm install' first."
}

& $tsc -p tsconfig.build.json

$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
  & node --env-file=$envFile dist/v1.js @args
} else {
  & node dist/v1.js @args
}
